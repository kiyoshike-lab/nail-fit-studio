import type { NailPose } from "./types";
import { nailFromHandFrame, nailInHandFrame, type HandReference } from "./handReference";

type FilterOptions = { minCutoff: number; beta: number };

// Casiez et al., One Euro Filter: speed-dependent cutoff, using real seconds.
export class OneEuroFilter {
  private value?: number;
  private raw?: number;
  private derivative = 0;
  private timestamp?: number;

  constructor(private options: FilterOptions) {}

  filter(value: number, timestamp: number) {
    if (this.timestamp !== undefined && timestamp <= this.timestamp) return this.value!;
    if (this.value === undefined || this.timestamp === undefined || timestamp - this.timestamp > 500) {
      this.value = this.raw = value;
      this.derivative = 0;
      this.timestamp = timestamp;
      return value;
    }
    const dt = (timestamp - this.timestamp) / 1000;
    const speed = (value - this.raw!) / dt;
    this.derivative += alpha(1, dt) * (speed - this.derivative);
    const cutoff = this.options.minCutoff + this.options.beta * Math.abs(this.derivative);
    this.value += alpha(cutoff, dt) * (value - this.value);
    this.raw = value;
    this.timestamp = timestamp;
    return this.value;
  }
}

type FingerFilters = { x: OneEuroFilter; y: OneEuroFilter; width: OneEuroFilter; height: OneEuroFilter; rotation: OneEuroFilter; angle: number };
export type HandIdentity = { label: string; score: number } | undefined;

export class NailTrackStabilizer {
  private filters: FingerFilters[] = [];
  private nails: NailPose[] = [];
  private timestamp = -Infinity;
  private lastDetectedAt = -Infinity;
  private identity?: string;
  private pendingIdentity?: string;
  private identityFrames = 0;
  private outlierFrames: number[] = [];
  private relative = false;

  update(next: NailPose[], timestamp: number, identity?: HandIdentity, reference?: HandReference): NailPose[] | null {
    if (timestamp <= this.timestamp || next.length !== 5 || !next.every(validPose)) return null;
    this.timestamp = timestamp;
    const label = identity && identity.score >= 0.8 ? identity.label : undefined;
    const changedHand = Boolean(label && this.identity && label !== this.identity);
    if (changedHand) {
      this.identityFrames = this.pendingIdentity === label ? this.identityFrames + 1 : 1;
      this.pendingIdentity = label;
      if (this.identityFrames < 3) return null;
    } else {
      this.pendingIdentity = undefined;
      this.identityFrames = 0;
    }
    const relative = Boolean(reference);
    // Filter finger motion relative to the current palm, then reconstruct using
    // this frame's measured translation/rotation/scale. Common hand movement no
    // longer waits for five independent screen-coordinate filters to catch up.
    const observations = reference ? next.map((nail) => nailInHandFrame(nail, reference)) : next;
    const reset = !this.filters.length || timestamp - this.lastDetectedAt > 450 || changedHand || relative !== this.relative;
    if (reset) {
      this.filters = observations.map((nail) => ({
        x: new OneEuroFilter({ minCutoff: 1.5, beta: relative ? 0.1 : 0.35 }),
        y: new OneEuroFilter({ minCutoff: 1.5, beta: relative ? 0.1 : 0.35 }),
        width: new OneEuroFilter({ minCutoff: 2.5, beta: 2 }),
        height: new OneEuroFilter({ minCutoff: 2.5, beta: 2 }),
        rotation: new OneEuroFilter({ minCutoff: 1.3, beta: 0.035 }),
        angle: nail.rotation,
      }));
      this.outlierFrames = next.map(() => 0);
    }
    this.relative = relative;
    if (label) this.identity = label;
    const motions = observations.map((nail, index) => this.nails[index]
      ? Math.hypot(nail.x - this.nails[index].x, nail.y - this.nails[index].y) : 0);
    const globalMotion = [...motions].sort((a, b) => a - b)[2];
    this.nails = observations.map((nail, index) => {
      const previous = this.nails[index];
      // A single finger teleporting is usually a bad landmark. Coherent hand
      // motion is accepted immediately; persistent finger movement after 2 frames.
      const outlier = !reset && previous && motions[index] > Math.max(previous.height * 1.4, 4) && globalMotion < motions[index] * 0.35;
      this.outlierFrames[index] = outlier ? this.outlierFrames[index] + 1 : 0;
      if (outlier && this.outlierFrames[index] < 3) return previous;
      const filters = this.filters[index];
      filters.angle += angleDelta(filters.angle, nail.rotation);
      return {
        ...nail,
        x: filters.x.filter(nail.x, timestamp),
        y: filters.y.filter(nail.y, timestamp),
        // Log-size filtering responds to percentage changes equally for a small
        // pinky and a large thumb, and always reconstructs positive dimensions.
        width: Math.exp(filters.width.filter(Math.log(nail.width), timestamp)),
        height: Math.exp(filters.height.filter(Math.log(nail.height), timestamp)),
        rotation: normalizeAngle(filters.rotation.filter(filters.angle, timestamp)),
      };
    });
    this.lastDetectedAt = timestamp;
    return reference ? this.nails.map((nail) => nailFromHandFrame(nail, reference)) : this.nails;
  }

  opacity(timestamp: number) {
    return trackingOpacity(timestamp - this.lastDetectedAt);
  }
}

export function trackingOpacity(missingForMs: number) {
  return Math.max(0, Math.min(1, 1 - (missingForMs - 120) / 300));
}

export class TrackingPerformance {
  private duration = 0;
  private samples = 0;
  private windowStart = 0;
  private frames = 0;
  private detections = 0;
  private lastVideoTime = -1;
  private cameraFrames = 0;
  private presentedFrames = 0;
  private lastPresentedFrame?: number;
  private phases?: { landmarkMs: number; refinementMs: number; stabilizationMs: number };

  frame(timestamp: number, videoTime: number) {
    if (!this.windowStart) this.windowStart = timestamp;
    this.frames += 1;
    if (videoTime !== this.lastVideoTime) this.cameraFrames += 1;
    this.lastVideoTime = videoTime;
  }

  recordInference(durationMs: number, phases?: { landmarkMs: number; refinementMs: number; stabilizationMs: number }) {
    this.duration = this.samples ? this.duration * 0.85 + durationMs * 0.15 : durationMs;
    if (phases) {
      const previous = this.phases;
      this.phases = previous ? {
        landmarkMs: previous.landmarkMs * 0.85 + phases.landmarkMs * 0.15,
        refinementMs: previous.refinementMs * 0.85 + phases.refinementMs * 0.15,
        stabilizationMs: previous.stabilizationMs * 0.85 + phases.stabilizationMs * 0.15,
      } : phases;
    }
    this.samples += 1;
    this.detections += 1;
  }

  recordCameraFrame(presentedFrame: number) {
    this.presentedFrames += this.lastPresentedFrame === undefined ? 1 : Math.max(0, presentedFrame - this.lastPresentedFrame);
    this.lastPresentedFrame = presentedFrame;
  }

  get budget() {
    const slow = this.samples >= 8 && this.duration > 30;
    return {
      intervalMs: slow ? Math.min(100, Math.max(66, this.duration * 1.5)) : 50,
      maxSide: slow ? 640 : 960,
    };
  }

  snapshot(timestamp: number) {
    const seconds = (timestamp - this.windowStart) / 1000;
    if (seconds < 2) return null;
    const result = {
      cameraFps: this.lastPresentedFrame === undefined ? null : this.presentedFrames / seconds,
      observedVideoFps: this.cameraFrames / seconds,
      schedulerFps: this.frames / seconds,
      detectionFps: this.detections / seconds,
      inferenceMs: this.duration,
      ...this.phases,
      ...this.budget,
    };
    this.windowStart = timestamp;
    this.frames = this.detections = this.cameraFrames = this.presentedFrames = 0;
    return result;
  }
}

export function validPose(nail: NailPose) {
  return [nail.x, nail.y, nail.width, nail.height, nail.rotation].every(Number.isFinite)
    && nail.width > 0 && nail.height > 0;
}

function alpha(cutoff: number, dt: number) {
  return 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
}

function angleDelta(from: number, to: number) {
  return ((to - from + 540) % 360 + 360) % 360 - 180;
}

function normalizeAngle(value: number) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}
