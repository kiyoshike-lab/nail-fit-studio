import type { HandPose } from "./handPose";
import type { NailLandmark } from "./nailGeometry";
import type { NailFitDiagnostic } from "./nailImageRefinement";
import type { NailPose } from "./types";

export type NailVisibilityEvidence = {
  state: "visible" | "partial" | "hidden" | "uncertain"; confidence: number;
  reason: string; hardHidden: boolean; contour?: { x: number; y: number }[]; holes?: { x: number; y: number }[][];
};
export type NailVisibility = NailVisibilityEvidence & { alpha: number; becameVisible: boolean };
const tips = [4, 8, 12, 16, 20];

export function assessNailVisibility(pose: HandPose, landmarks: NailLandmark[], nails: NailPose[], fits: NailFitDiagnostic[], width: number, height: number, mirrored: boolean): NailVisibilityEvidence[] {
  const aspect = width / height;
  return nails.map((nail, finger) => {
    const hide = (reason: string, uncertain = false): NailVisibilityEvidence => ({ state: uncertain ? "uncertain" : "hidden", confidence: 0, reason, hardHidden: true });
    const joint = pose.fingers[finger];
    const uncertain = (reason: string): NailVisibilityEvidence => ({ state: "uncertain", confidence: 0, reason, hardHidden: false });
    if (pose.view === "unknown" || !joint || pose.confidence < 0.6) return uncertain("uncertain-hand-pose");
    const pixels = Math.min(nail.width / 100 * width, nail.height / 100 * height);
    // Small nails cannot support boundary fitting, but a visible dorsal hand
    // can still use the original landmark placement. Do not require 6px/0.72
    // boundary confidence merely to render a landmark-estimated pinky.
    if (pixels < 1) return uncertain("insufficient-nail-pixels");
    const fit = fits[finger];
    const bounded = Boolean(fit?.accepted && fit.confidence >= 0.8 && fit.contour && fit.contour.length >= 3
      && (fit.supportThresholds ?? 0) >= 2 && pixels >= 6);
    const occluded = overlapsCloserFinger(finger, landmarks, nails, aspect, mirrored);
    const resolutionConfidence = Math.min(1, pixels / 6);
    if (pose.view === "back" && joint.facing >= 0.3 && !occluded) {
      return { state: "visible", confidence: pose.confidence, reason: "dorsal-pose-prior", hardHidden: false };
    }
    // Thumb roll is underdetermined by its centreline. On a curled palm it needs
    // stronger independent image support; a palm plane alone must not show it.
    // Total joint bend includes in-plane spreading: it is not sufficient proof
    // that an open-palm thumb has curled out of the palm plane.
    // A chroma-only natural-plate proposal cannot resolve a negatively facing
    // thumb's roll: pressure-pink pads can have the same colour. Keep that
    // ambiguous case hidden rather than treating our new cue as nail identity.
    const thumbImageOverride = finger === 0 && !fit?.chromaticEvidence && joint.bendDegrees > 70 && joint.outOfPlaneDegrees > 15 && bounded
      && fit.confidence >= 0.88 && (fit.supportThresholds ?? 0) >= 3;
    const supportedCore = bounded && (fit.chromaticEvidence?.supportedRays ?? 0) >= 20 && (fit.chromaticEvidence?.stability ?? 0) >= 0.75;
    if (supportedCore && occluded) return hide("chromatic-core-occluded");
    const facingVisible = joint.facing >= 0.4 || (supportedCore && joint.facing >= 0.2 && joint.outOfPlaneDegrees > 15);
    const curvedVisible = facingVisible && (pose.view !== "palm" || joint.bendDegrees > 60);
    if (bounded && (curvedVisible || thumbImageOverride)) {
      return { state: "partial", confidence: Math.min(pose.confidence, fit.confidence, resolutionConfidence),
        reason: occluded ? "bounded-visible-fragment" : "pose-and-current-boundary", hardHidden: false, contour: fit.contour, holes: fit.contourHoles };
    }
    if (finger === 0 && supportedCore && joint.facing < 0.2) return hide("thumb-roll-unconfirmed", true);
    if (occluded) return hide("overlapping-closer-finger");
    if (pose.view === "palm") return hide("palm-no-visible-nail-evidence");
    return hide("side-or-rolled-nail-unconfirmed", true);
  });
}

// These image-space capsule tests are conservative occlusion proposals, not
// reconstructed finger surfaces. A current bounded contour can retain a fragment.
function overlapsCloserFinger(finger: number, landmarks: NailLandmark[], nails: NailPose[], aspect: number, mirrored: boolean) {
  if (landmarks.length !== 21) return true;
  const nail = nails[finger], angle = (nail.rotation - 90) * Math.PI / 180;
  const cx = nail.x / 100 * aspect + Math.cos(angle) * nail.height / 200;
  const cy = nail.y / 100 + Math.sin(angle) * nail.height / 200;
  const x = mirrored ? aspect - cx : cx;
  const z = (landmarks[tips[finger]].z ?? 0) * aspect;
  for (let other = 0; other < 5; other++) {
    if (other === finger) continue;
    const end = tips[other];
    for (const index of [end - 2, end - 1]) {
      const a = landmarks[index], b = landmarks[index + 1];
      const dx = (b.x - a.x) * aspect, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x * aspect) * dx + (cy - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const distance = Math.hypot(x - (a.x * aspect + dx * t), cy - (a.y + dy * t));
      const radius = (nail.width + nails[other].width) / 100 * aspect * 0.35;
      const depth = ((a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * t) * aspect;
      if (distance < radius && z - depth > radius * 0.2) return true;
    }
  }
  return false;
}

export class NailVisibilityTracker {
  private states: { alpha: number; since: number; eligible: boolean; lastStrong: number; dorsal: boolean; partialSince: number; lastPartial: number }[] = [];
  private lastAt = -Infinity;
  private identity?: string;

  reset() { this.states = []; this.identity = undefined; this.lastAt = -Infinity; }

  update(evidence: NailVisibilityEvidence[], now: number, identity?: string): NailVisibility[] {
    if (!Number.isFinite(now) || now < this.lastAt) return evidence.map(() => ({
      state: "uncertain", confidence: 0, reason: "stale-visibility-frame", hardHidden: true, alpha: 0, becameVisible: false,
    }));
    const changed = Boolean(identity && this.identity && identity !== this.identity);
    // Continuous, slow inference is NOT a lost hand. The caller resets on actual
    // missing landmarks; otherwise a >450ms inference cadence never entered.
    const reset = changed;
    if (reset) this.states = [];
    if (identity) this.identity = identity;
    const dt = Math.max(0, Math.min(100, now - this.lastAt));
    this.lastAt = now;
    return evidence.map((value, index) => {
      const previous = this.states[index] ?? { alpha: 0, since: now, eligible: false, lastStrong: -Infinity, dorsal: false, partialSince: now, lastPartial: -Infinity };
      const wasVisible = previous.alpha > 0;
      const strong = !value.hardHidden && value.confidence >= 0.6;
      if (strong && value.state === "partial") {
        if (now - previous.lastPartial > 250) previous.partialSince = now;
        previous.lastPartial = now;
      }
      if (value.hardHidden) {
        previous.alpha = 0; previous.since = now; previous.eligible = false; previous.dorsal = false;
      } else {
        // Losing current fragment evidence cannot fade a full, UNCLIPPED plate.
        // Confirmation memory survives a short gap, but permission to paint does not.
        if (!strong && !previous.dorsal) previous.alpha = 0;
        if (strong) { previous.lastStrong = now; previous.dorsal = value.state === "visible"; }
        // Only a recent, confirmed DORSAL landmark prior may survive a short
        // unknown. Never carry an absolute partial contour into another frame.
        const hold = !strong && value.state === "uncertain" && previous.dorsal && previous.alpha > 0 && now - previous.lastStrong <= 350;
        const eligible = strong || hold;
        if (eligible !== previous.eligible) previous.since = now;
        previous.eligible = eligible;
        if (hold) { /* keep current alpha, without renewing lastStrong */ }
        else if (eligible && (now - previous.since >= 70 || (value.state === "partial" && now - previous.partialSince >= 70))) previous.alpha = Math.min(1, previous.alpha + dt / 120);
        else if (!eligible) previous.alpha = Math.max(0, previous.alpha - dt / 80);
      }
      this.states[index] = previous;
      return { ...value, alpha: previous.alpha, becameVisible: !wasVisible && previous.alpha > 0 };
    });
  }
}

export function withNailVisibility(nails: NailPose[], visibility: NailVisibility[] | NailVisibilityEvidence[]): NailPose[] {
  return nails.map((nail, index) => {
    const value = visibility[index];
    return { ...nail, visibility: value && "alpha" in value ? value.alpha : value && !value.hardHidden && value.confidence >= 0.6 ? 1 : 0,
      visibilityState: value?.state ?? "uncertain", visibilityConfidence: value?.confidence ?? 0,
      clipContour: value?.state === "partial" ? value.contour : undefined,
      clipHoles: value?.state === "partial" ? value.holes : undefined };
  });
}
