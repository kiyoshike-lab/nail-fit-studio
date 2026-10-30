export type TrackingStage = "idle" | "A-camera" | "B-initialization" | "C-frames" | "D-no-hands" | "D-inference-error" | "E-geometry" | "F-visibility" | "G-render" | "tracking";
export type TrackingHealth = "searching" | "waiting-frames" | "no-hand" | "recovering" | "tracking";
export type DiagnosticError = { phase: string; name: string; code: string };
export type TrackingDiagnostic = {
  schema: 1; stage: TrackingStage;
  environment: { browser: string; os: string; secure: boolean; frameCallback: boolean };
  camera: { state: string; width: number; height: number; readyState: number; currentTime: number; updates: number; paused: boolean };
  engine: { state: string; delegate: "GPU" | "CPU" | null; attempts: number; initializationMs: number | null };
  inference: { attempts: number; successes: number; errors: number; emptyResults: number; hands: number; landmarks: number; input: string; width: number; height: number; lastMs: number; intervalMs: number; actualIntervalMs: number | null };
  nails: { estimated: number; eligible: number; rendered: number; drawMs: number; drawFps: number; before: boolean; manual: boolean; canvasWidth: number; canvasHeight: number; canvasOpacity: number };
  performance: { cameraFps: number | null; detectionFps: number; inferenceMs: number; memoryMB: number | null };
  lastError: DiagnosticError | null;
};

function initial(): TrackingDiagnostic {
  return { schema: 1, stage: "idle", environment: { browser: "unknown", os: "unknown", secure: false, frameCallback: false },
    camera: { state: "idle", width: 0, height: 0, readyState: 0, currentTime: 0, updates: 0, paused: false },
    engine: { state: "idle", delegate: null, attempts: 0, initializationMs: null },
    inference: { attempts: 0, successes: 0, errors: 0, emptyResults: 0, hands: 0, landmarks: 0, input: "none", width: 0, height: 0, lastMs: 0, intervalMs: 0, actualIntervalMs: null },
    nails: { estimated: 0, eligible: 0, rendered: 0, drawMs: 0, drawFps: 0, before: false, manual: false, canvasWidth: 0, canvasHeight: 0, canvasOpacity: 1 },
    performance: { cameraFps: null, detectionFps: 0, inferenceMs: 0, memoryMB: null }, lastError: null };
}
let value = initial();
let enabled = false;
export function enableTrackingDiagnostics(active = true) { enabled = active; }
export function diagnosticsEnabled() { return enabled; }
export function updateTrackingDiagnostics(update: (value: TrackingDiagnostic) => void) { update(value); }
export function resetTrackingDiagnostics() {
  const environment = value.environment;
  value = initial(); value.environment = environment;
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
export function readTrackingDiagnostics(): TrackingDiagnostic { return JSON.parse(JSON.stringify(value)); }
