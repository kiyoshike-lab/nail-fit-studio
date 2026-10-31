export type TrackingStage = "idle" | "A-camera" | "B-initialization" | "C-frames" | "D-no-hands" | "D-inference-error" | "E-geometry" | "F-visibility" | "G-render" | "tracking";
export type TrackingHealth = "searching" | "waiting-frames" | "no-hand" | "recovering" | "tracking";
export type DiagnosticError = { phase: string; name: string; code: string };
export type FramePhases = { inputMs: number; modelMs: number; geometryMs: number; pixelsMs: number; visibilityMs: number; stabilizationMs: number; totalMs: number };
type TimingStats = { samples: number; meanMs: number; p50Ms: number; p90Ms: number; maxMs: number };
type FingerProfile = { finger: number; frames: number; fresh: number; accepted: number; cached: number; held: number; skipped: number; fitReason: string; visibility: string; visibilityReason: string; rejections: Record<string, number> };
type FrameProfile = { windowSize: number; frames: number; latest: FramePhases | null; timings: Partial<Record<keyof FramePhases, TimingStats>>; fingers: FingerProfile[] };
export type TrackingDiagnostic = {
  schema: 2; stage: TrackingStage;
  environment: { browser: string; os: string; secure: boolean; frameCallback: boolean };
  camera: { state: string; width: number; height: number; readyState: number; currentTime: number; updates: number; paused: boolean };
  engine: { state: string; delegate: "GPU" | "CPU" | null; attempts: number; initializationMs: number | null };
  inference: { attempts: number; successes: number; errors: number; emptyResults: number; hands: number; landmarks: number; input: string; width: number; height: number; lastMs: number; intervalMs: number; actualIntervalMs: number | null };
  nails: { estimated: number; eligible: number; rendered: number; drawMs: number; drawFps: number; before: boolean; manual: boolean; canvasWidth: number; canvasHeight: number; canvasOpacity: number };
  performance: { cameraFps: number | null; detectionFps: number; inferenceMs: number; memoryMB: number | null };
  profile: FrameProfile;
  lastError: DiagnosticError | null;
};

function initial(): TrackingDiagnostic {
  return { schema: 2, stage: "idle", environment: { browser: "unknown", os: "unknown", secure: false, frameCallback: false },
    camera: { state: "idle", width: 0, height: 0, readyState: 0, currentTime: 0, updates: 0, paused: false },
    engine: { state: "idle", delegate: null, attempts: 0, initializationMs: null },
    inference: { attempts: 0, successes: 0, errors: 0, emptyResults: 0, hands: 0, landmarks: 0, input: "none", width: 0, height: 0, lastMs: 0, intervalMs: 0, actualIntervalMs: null },
    nails: { estimated: 0, eligible: 0, rendered: 0, drawMs: 0, drawFps: 0, before: false, manual: false, canvasWidth: 0, canvasHeight: 0, canvasOpacity: 1 },
    performance: { cameraFps: null, detectionFps: 0, inferenceMs: 0, memoryMB: null },
    profile: { windowSize: 120, frames: 0, latest: null, timings: {}, fingers: Array.from({ length: 5 }, (_, finger) => ({ finger, frames: 0, fresh: 0, accepted: 0, cached: 0, held: 0, skipped: 0, fitReason: "none", visibility: "unknown", visibilityReason: "none", rejections: {} })) }, lastError: null };
}
let value = initial();
const phaseWindow: FramePhases[] = [];
let enabled = false;
export function enableTrackingDiagnostics(active = true) { enabled = active; }
export function diagnosticsEnabled() { return enabled; }
export function updateTrackingDiagnostics(update: (value: TrackingDiagnostic) => void) { update(value); }
export function resetTrackingDiagnostics() {
  const environment = value.environment;
  value = initial(); value.environment = environment;
  phaseWindow.length = 0;
}
export function diagnosticError(phase: string, error: unknown, code: string) {
  // Never export error.message/stack: SDK errors can contain paths, URLs, tokens
  // or arbitrary caller input. A real error NAME plus a controlled reason is enough.
  const names = ["Error", "TypeError", "RangeError", "AbortError", "TimeoutError", "NotAllowedError", "NotFoundError", "NotReadableError", "SecurityError"];
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "Error";
  value.lastError = { phase, name: names.includes(name) ? name : "Error", code };
}
export function configureDiagnosticEnvironment() {
  if (typeof navigator === "undefined") return;
  const ua = navigator.userAgent;
  value.environment = { browser: /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome/.test(ua) ? "Chrome" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "other",
    os: /iPhone|iPad|iPod/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1) ? "iOS/iPadOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : "other",
    secure: globalThis.isSecureContext === true, frameCallback: typeof HTMLVideoElement !== "undefined" && "requestVideoFrameCallback" in HTMLVideoElement.prototype };
}
export function isMobileTrackingEnvironment() { return value.environment.os === "iOS/iPadOS" || value.environment.os === "Android"; }
// All reasons are internal enumerated codes. Do not copy SDK messages, contours,
// poses or arbitrary caller strings into production diagnostics.
const fitCodes = new Set(["none", "color-boundary", "supported-edge-profile", "chromatic-visible-core", "recent-relative-fit", "temporal-jump-pending", "pixels-unavailable", "nail-visibility-unconfirmed", "no-frame-snapshot", "insufficient-pixels", "no-reliable-boundary", "unstable-boundary"]);
const visibilityCodes = new Set(["none", "uncertain-hand-pose", "insufficient-nail-pixels", "dorsal-pose-prior", "chromatic-core-occluded", "bounded-visible-fragment", "pose-and-current-boundary", "thumb-roll-unconfirmed", "overlapping-closer-finger", "palm-no-visible-nail-evidence", "side-or-rolled-nail-unconfirmed", "stale-visibility-frame", "unstable-hand-identity"]);
const phaseKeys: (keyof FramePhases)[] = ["inputMs", "modelMs", "geometryMs", "pixelsMs", "visibilityMs", "stabilizationMs", "totalMs"];
export function recordFrameProfile(phases: FramePhases, fits: { accepted: boolean; reason: string; reused?: boolean }[], visibility: { state: string; reason: string }[], pixelsAttempted: boolean) {
  if (!enabled || !phaseKeys.every(key => Number.isFinite(phases[key]) && phases[key] >= 0)) return;
  const safe = Object.fromEntries(phaseKeys.map(key => [key, phases[key]])) as FramePhases;
  // A bounded rolling window, summarized only when explicitly read (500ms UI).
  phaseWindow.push(safe); if (phaseWindow.length > 120) phaseWindow.shift();
  value.profile.frames++; value.profile.latest = { ...safe };
  if (fits.length !== 5) return;
  fits.forEach((fit, index) => {
    const finger = value.profile.fingers[index]; finger.frames++;
    const reason = fitCodes.has(fit.reason) ? fit.reason : "other";
    finger.fitReason = reason;
    if (fit.reused || reason === "recent-relative-fit") finger.cached++;
    else if (reason === "temporal-jump-pending") finger.held++;
    else if (pixelsAttempted && reason !== "pixels-unavailable") {
      finger.fresh++; if (fit.accepted) finger.accepted++;
      else finger.rejections[reason] = (finger.rejections[reason] ?? 0) + 1;
    } else finger.skipped++;
    const v = visibility[index];
    finger.visibility = ["visible", "partial", "hidden", "uncertain"].includes(v?.state) ? v.state : "unknown";
    finger.visibilityReason = visibilityCodes.has(v?.reason) ? v.reason : "other";
  });
}
export function readTrackingDiagnostics(): TrackingDiagnostic {
  const snapshot: TrackingDiagnostic = JSON.parse(JSON.stringify(value));
  if (phaseWindow.length) for (const key of phaseKeys) {
    const samples = phaseWindow.map(frame => frame[key]).sort((a, b) => a - b);
    snapshot.profile.timings[key] = { samples: samples.length, meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
      p50Ms: samples[Math.ceil(samples.length * 0.5) - 1], p90Ms: samples[Math.ceil(samples.length * 0.9) - 1], maxMs: samples.at(-1)! };
  }
  return snapshot;
}
