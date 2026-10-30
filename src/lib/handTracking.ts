import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { NailPose } from "./types";
import { buildNailsFromLandmarks } from "./nailGeometry";
import { NailTrackStabilizer, TrackingPerformance } from "./trackingQuality";
import { NailFrameRefiner } from "./nailFrameRefiner";
import type { NailRefinementResult } from "./nailImageRefinement";
import { publishNailAlignmentDebug } from "./nailAlignmentDebug";
import { handReference } from "./handReference";
import { naturalNailLength, type NaturalNailLength } from "./naturalNailLength";
import { estimateHandPose, type HandPose } from "./handPose";
import { assessNailVisibility, NailVisibilityTracker, withNailVisibility } from "./nailVisibility";
import { initializeWithDelegateFallback, withTrackingTimeout, type TrackingDelegate } from "./trackingFallback";
import { VideoFrameGate } from "./videoFrameGate";
import { configureDiagnosticEnvironment, diagnosticError, isMobileTrackingEnvironment, resetTrackingDiagnostics, updateTrackingDiagnostics, type TrackingHealth } from "./trackingDiagnostics";
import {
  calculateProcessingSize,
  nextHandDetectionState,
  selectDetectionInputMode,
  type DetectionInputMode,
  type HandDetectionState,
  type NormalizedLandmark,
} from "./handDetectionInput";

export type { HandDetectionState, NormalizedLandmark } from "./handDetectionInput";

type HandLandmarkerInstance = Awaited<ReturnType<typeof HandLandmarker.createFromOptions>>;

export type HandTracker = {
  stop: () => void;
};

type TrackingErrorHandler = (error: unknown) => void;
type DetectionStateHandler = (state: HandDetectionState) => void;

const maxConsecutiveDetectionErrors = 5;
const detectionIntervalMs = 50;
let landmarkerPromise: Promise<HandLandmarkerInstance> | null = null;
let imageLandmarkerPromise: Promise<HandLandmarkerInstance> | null = null;
let activeTracker: HandTracker | null = null;
let videoSession = 0;
let lastInferenceTimestamp = 0;
let pendingEngines = 0;
const delegates = new WeakMap<HandLandmarkerInstance, TrackingDelegate>();
const closedEngines = new WeakSet<HandLandmarkerInstance>();
const initializationTimeoutMs = 15000;
function closeEngine(instance: HandLandmarkerInstance) {
  if (closedEngines.has(instance)) return;
  closedEngines.add(instance);
  try { instance.close(); } catch (error) { debugTracking("MediaPipe disposal failed", error); }
}

export async function startHandTracking(
  video: HTMLVideoElement,
  onUpdate: (nails: NailPose[], detected: boolean) => void,
  mirrored: boolean,
  onTrackingError?: TrackingErrorHandler,
  onDetectionState?: DetectionStateHandler,
  getNaturalLength: () => NaturalNailLength = () => "auto",
  onHealth?: (state: TrackingHealth) => void,
): Promise<HandTracker> {
  const session = ++videoSession;
  activeTracker?.stop();
  resetTrackingDiagnostics();
  configureDiagnosticEnvironment();
  updateTrackingDiagnostics(d => {
    d.stage = "B-initialization"; d.engine.state = "initializing";
    d.camera = { state: "live", width: video.videoWidth, height: video.videoHeight, readyState: video.readyState, currentTime: video.currentTime, updates: 0, paused: video.paused === true };
  });
  let landmarker = await getLandmarker();
  if (session !== videoSession) return { stop() {} };
  updateTrackingDiagnostics(d => { d.engine.state = "ready"; d.engine.delegate = delegates.get(landmarker) ?? null; d.engine.initializationMs ??= 0; d.stage = "C-frames"; });
  let stopped = false;
  let raf = 0;
  const frameGate = new VideoFrameGate();
  let lastInferenceAt = performance.now();
  let lastDetectionAt = -Infinity;
  let lastDetectedAt = performance.now();
  let consecutiveDetectionErrors = 0;
  let successfulDetections = 0;
  let failedDetections = 0;
  let consecutiveMisses = 0;
  let everDetected = false;
  let previousState: HandDetectionState | null = null;
  // Preserve the proven PC snapshot path; fallback labels now select REAL inputs.
  let inputMode: DetectionInputMode = "canvas-960";
  let previousInputMode: DetectionInputMode = inputMode;
  let stabilizer = new NailTrackStabilizer();
  let previousNaturalLength = getNaturalLength();
  const refiner = new NailFrameRefiner();
  const visibilityTracker = new NailVisibilityTracker();
  let previousPose: HandPose | undefined;
  let recovering = false;
  let cpuRecoveryRequested = false;
  let previousHealth: TrackingHealth | undefined;
  const health = (state: TrackingHealth) => { if (state !== previousHealth) { previousHealth = state; onHealth?.(state); } };
  const metrics = new TrackingPerformance();
  let videoFrameCallback = 0;
  const observeVideoFrame: VideoFrameRequestCallback = (now, metadata) => {
    if (stopped) return;
    metrics.recordCameraFrame(metadata.presentedFrames);
    frameGate.observe(now, metadata.presentedFrames);
    videoFrameCallback = video.requestVideoFrameCallback(observeVideoFrame);
  };
  if (typeof video.requestVideoFrameCallback === "function") {
    videoFrameCallback = video.requestVideoFrameCallback(observeVideoFrame);
  }
  const processingCanvas = document.createElement("canvas");
  const processingContext = processingCanvas.getContext("2d", { alpha: false });

  const recoverCpu = () => {
    if (recovering || cpuRecoveryRequested || delegates.get(landmarker) !== "GPU") return false;
    cpuRecoveryRequested = true; recovering = true; health("recovering");
    const old = landmarker;
    // One engine replacement, no stream restart and no unlimited GPU/CPU loop.
    closeEngine(old);
    const pending = createLandmarkerWithFallback("VIDEO", true);
    landmarkerPromise = pending;
    pending.then(next => {
      if (stopped || session !== videoSession) return;
      landmarker = next; recovering = false; consecutiveDetectionErrors = 0;
      lastInferenceAt = performance.now(); health("searching");
    }).catch(error => {
      if (landmarkerPromise === pending) landmarkerPromise = null;
      if (stopped || session !== videoSession) return;
      tracker.stop(); diagnosticError("initialization", error, "cpu-recovery-failed"); onTrackingError?.(error);
    });
    return true;
  };

  const loop = (frameTime: number) => {
    if (stopped) return;
    metrics.frame(frameTime, video.currentTime);
    updateTrackingDiagnostics(d => {
      d.camera.width = video.videoWidth; d.camera.height = video.videoHeight; d.camera.readyState = video.readyState;
      d.camera.currentTime = video.currentTime; d.camera.paused = video.paused === true; d.camera.updates = frameGate.updates;
    });
    if (
      !recovering && video.paused !== true && video.ended !== true &&
      frameTime - lastDetectionAt >= Math.max(detectionIntervalMs, metrics.budget.intervalMs)
      && video.readyState >= 2
      && video.videoWidth > 0 && video.videoHeight > 0
      && frameGate.take(frameTime, video.currentTime, video.getVideoPlaybackQuality?.().totalVideoFrames)
    ) {
      lastDetectionAt = frameTime;
      const actualIntervalMs = performance.now() - lastInferenceAt;
      lastInferenceAt = performance.now();
      try {
        const startedAt = performance.now();
        const effectiveMode = metrics.budget.maxSide === 640 && inputMode === "canvas-960" ? "canvas-640" : inputMode;
        const input = prepareDetectionInput(video, processingCanvas, processingContext, effectiveMode, metrics.budget.maxSide);
        updateTrackingDiagnostics(d => { d.inference.attempts++; d.inference.input = effectiveMode;
          d.inference.width = input instanceof HTMLCanvasElement ? input.width : video.videoWidth;
          d.inference.height = input instanceof HTMLCanvasElement ? input.height : video.videoHeight;
          d.inference.intervalMs = Math.max(detectionIntervalMs, metrics.budget.intervalMs); d.inference.actualIntervalMs = actualIntervalMs; });
        lastInferenceTimestamp = Math.max(performance.now(), lastInferenceTimestamp + 0.01);
        const result = landmarker.detectForVideo(input, lastInferenceTimestamp);
        const landmarkCompletedAt = performance.now();
        consecutiveDetectionErrors = 0;
        const landmarks = result.landmarks?.[0] as NormalizedLandmark[] | undefined;
        const identity = result.handedness?.[0]?.[0];
        const pose = estimateHandPose(landmarks ?? [], result.worldLandmarks?.[0], identity, video.videoWidth / video.videoHeight);
        if (pose.view !== "unknown" && previousPose && (pose.view !== previousPose.view || pose.normal.x * previousPose.normal.x
          + pose.normal.y * previousPose.normal.y + pose.normal.z * previousPose.normal.z < 0.75)) {
          refiner.dispose();
          stabilizer = new NailTrackStabilizer();
        }
        if (pose.view !== "unknown") previousPose = pose;
        const naturalLength = naturalNailLength(getNaturalLength());
        if (naturalLength !== previousNaturalLength) {
          stabilizer = new NailTrackStabilizer();
          refiner.dispose();
          previousNaturalLength = naturalLength;
        }
        const rawNails = landmarks?.length
          ? buildNailsFromLandmarks(landmarks, mirrored, video.videoWidth / video.videoHeight, naturalLength) : [];
        if (!rawNails.length) visibilityTracker.reset();
        // The Canvas input is a snapshot: landmark inference and pixel fitting
        // must inspect the same unpainted frame, never the nail overlay.
        const search = pose.view !== "unknown" && (pose.view !== "palm" || pose.fingers.some(f => f.facing >= 0.4 || f.bendDegrees > 70));
        const fit: NailRefinementResult = search && processingContext
          ? refiner.refine(processingCanvas, processingCanvas.width, processingCanvas.height, rawNails, mirrored, performance.now(), pose.view !== "back" || pose.fingers.some(f => f.facing < 0.3))
          : { nails: rawNails, diagnostics: rawNails.map(() => ({ accepted: false, confidence: 0, reason: search ? "no-frame-snapshot" : "nail-visibility-unconfirmed" })) };
        const pixelScale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        const evidence = assessNailVisibility(pose, landmarks ?? [], fit.nails, fit.diagnostics, video.videoWidth * pixelScale, video.videoHeight * pixelScale, mirrored);
        const visibility = visibilityTracker.update(evidence, frameTime, identity && identity.score >= 0.75 ? identity.categoryName : undefined);
        stabilizer.resetFingers(visibility.flatMap((value, index) => value.becameVisible ? [index] : []));
        const refinementCompletedAt = performance.now();
        const stableNails = stabilizer.update(fit.nails, frameTime, identity
          ? { label: identity.categoryName, score: identity.score } : undefined,
          landmarks ? handReference(landmarks, mirrored, video.videoWidth / video.videoHeight) : undefined);
        const busyMs = performance.now() - startedAt;
        metrics.recordInference(busyMs, {
          landmarkMs: landmarkCompletedAt - startedAt,
          refinementMs: refinementCompletedAt - landmarkCompletedAt,
          stabilizationMs: performance.now() - refinementCompletedAt,
        });
        // Also leave main-thread time after inference and refinement complete.
        lastDetectionAt = frameTime + busyMs;
        const validHandGeometry = rawNails.length === 5 && rawNails.every(nail =>
          [nail.x, nail.y, nail.width, nail.height, nail.rotation].every(Number.isFinite) && nail.width > 0 && nail.height > 0);
        let drawnNails = 0;
        updateTrackingDiagnostics(d => { d.inference.successes++; d.inference.hands = result.landmarks?.length ?? 0;
          d.inference.landmarks = landmarks?.length ?? 0; d.inference.lastMs = busyMs; d.nails.estimated = rawNails.length; d.nails.eligible = 0;
          d.stage = !landmarks?.length ? "D-no-hands" : !validHandGeometry ? "E-geometry" : "F-visibility";
          if (!landmarks?.length) d.inference.emptyResults++; });
        if (stableNails || validHandGeometry) {
          successfulDetections += 1;
          consecutiveMisses = 0;
          everDetected = true;
          lastDetectedAt = performance.now();
          previousState = publishDetectionState("detected", previousState, onDetectionState);
          // A pending identity switch must clear the OLD hand's overlay, not
          // retain it via the generic short detection-loss fade.
          const currentVisibility = stableNails ? visibility : visibility.map(value => ({
            ...value, state: "uncertain" as const, confidence: 0, alpha: 0, hardHidden: true, reason: "unstable-hand-identity",
          }));
          const visibleNails = withNailVisibility((stableNails ?? rawNails).map((nail, index) => currentVisibility[index]?.state === "partial" ? fit.nails[index] : nail), currentVisibility);
          drawnNails = visibleNails.filter(nail => (nail.visibility ?? 1) > 0.05).length;
          updateTrackingDiagnostics(d => { d.nails.eligible = drawnNails; d.stage = drawnNails ? "tracking" : "F-visibility"; });
          health("tracking");
          onUpdate(visibleNails, true);
          if (process.env.NODE_ENV !== "production" && landmarks) publishNailAlignmentDebug({
            landmarks, coarse: rawNails, refined: fit.nails, stable: visibleNails, fits: fit.diagnostics, pose, visibility: currentVisibility,
            sourceWidth: video.videoWidth, sourceHeight: video.videoHeight, mirrored, timestamp: performance.now(),
            sourceMode: "camera",
          });
        } else {
          failedDetections += 1;
          consecutiveMisses += 1;
          const missingForMs = performance.now() - lastDetectedAt;
          inputMode = selectDetectionInputMode(inputMode, missingForMs);
          const state = nextHandDetectionState(everDetected, consecutiveMisses, false);
          previousState = publishDetectionState(state, previousState, onDetectionState);
          health(missingForMs >= 6000 ? "no-hand" : "searching");
          if (!everDetected && missingForMs >= 10000 && failedDetections >= 12 && isMobileTrackingEnvironment()) recoverCpu();
          onUpdate([], false);
          if (process.env.NODE_ENV !== "production") publishNailAlignmentDebug({
            landmarks: [], coarse: [], refined: [], stable: [], fits: [], pose, visibility: [],
            sourceWidth: video.videoWidth, sourceHeight: video.videoHeight, mirrored, timestamp: performance.now(), sourceMode: "camera",
          });
        }

        if (
          successfulDetections + failedDetections === 1
          || (successfulDetections + failedDetections) % 20 === 0
          || inputMode !== previousInputMode
        ) {
          debugTracking("Hand detection frame", {
            landmarksLength: result.landmarks?.length ?? 0,
            handDetected: landmarks?.length === 21,
            drawnNails,
            handedness: result.handedness ?? [],
            successfulDetections,
            failedDetections,
            consecutiveMisses,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            currentTime: video.currentTime,
            readyState: video.readyState,
            inputMode,
            processingWidth: input instanceof HTMLCanvasElement ? input.width : video.videoWidth,
            processingHeight: input instanceof HTMLCanvasElement ? input.height : video.videoHeight,
            fits: fit.diagnostics.map(({ accepted, reason, rejected, candidates, supportThresholds }) => ({ accepted, reason, rejected, candidates, supportThresholds })),
            pose: { view: pose.view, source: pose.source, confidence: pose.confidence, facing: pose.facing },
            visibility: visibility.map(({ state, reason, alpha }) => ({ state, reason, alpha })),
          });
          previousInputMode = inputMode;
        }
      } catch (error) {
        consecutiveDetectionErrors += 1;
        diagnosticError("inference", error, "detect-for-video-failed");
        updateTrackingDiagnostics(d => { d.inference.errors++; d.stage = "D-inference-error"; });
        debugTracking("detectForVideo error", error);
        if (consecutiveDetectionErrors >= maxConsecutiveDetectionErrors) {
          if (recoverCpu()) { raf = requestAnimationFrame(loop); return; }
          tracker.stop();
          resetHandTrackingEngine();
          updateTrackingDiagnostics(d => { d.engine.state = "failed"; });
          onTrackingError?.(error);
          return;
        }
      }
    }
    if (!recovering && performance.now() - lastInferenceAt > 3000 && document.visibilityState !== "hidden") {
      updateTrackingDiagnostics(d => { d.stage = "C-frames"; }); health("waiting-frames");
    }
    if (everDetected && performance.now() - lastDetectedAt > 450) {
      previousState = publishDetectionState("lost", previousState, onDetectionState);
    }
    const measurement = metrics.snapshot(frameTime);
    if (measurement) {
      updateTrackingDiagnostics(d => { d.performance.cameraFps = measurement.cameraFps; d.performance.detectionFps = measurement.detectionFps; d.performance.inferenceMs = measurement.inferenceMs; });
      debugTracking("Tracking performance", measurement);
    }
    raf = requestAnimationFrame(loop);
  };

  raf = requestAnimationFrame(loop);
  const tracker: HandTracker = {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      if (videoFrameCallback && typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(videoFrameCallback);
      }
      processingCanvas.width = processingCanvas.height = 1;
      refiner.dispose();
      updateTrackingDiagnostics(d => { d.engine.state = "stopped"; });
      if (activeTracker === tracker) activeTracker = null;
    },
  };
  activeTracker = tracker;
  return tracker;
}

export function resetHandTrackingEngine() {
  videoSession += 1;
  activeTracker?.stop();
  const previous = landmarkerPromise;
  const previousImage = imageLandmarkerPromise;
  landmarkerPromise = null;
  imageLandmarkerPromise = null;
  void previous?.then(closeEngine).catch(() => undefined);
  void previousImage?.then(closeEngine).catch(() => undefined);
}

export async function detectHandNails(image: HTMLImageElement, naturalLength: NaturalNailLength = "auto"): Promise<NailPose[]> {
  const landmarker = await getLandmarker("IMAGE");
  const result = landmarker.detect(image);
  const landmarks = result.landmarks?.[0] as NormalizedLandmark[] | undefined;
  const coarse = landmarks?.length ? buildNailsFromLandmarks(landmarks, false, image.naturalWidth / image.naturalHeight, naturalLength) : [];
  const pose = estimateHandPose(landmarks ?? [], result.worldLandmarks?.[0], result.handedness?.[0]?.[0], image.naturalWidth / image.naturalHeight);
  const refiner = new NailFrameRefiner();
  try {
    const fit = refiner.refine(image, image.naturalWidth, image.naturalHeight, coarse, false, performance.now(), pose.view !== "back" || pose.fingers.some(f => f.facing < 0.3));
    const pixelScale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
    const visibility = assessNailVisibility(pose, landmarks ?? [], fit.nails, fit.diagnostics, image.naturalWidth * pixelScale, image.naturalHeight * pixelScale, false);
    const visibleNails = withNailVisibility(fit.nails, visibility);
    if (process.env.NODE_ENV !== "production" && landmarks) publishNailAlignmentDebug({
      landmarks, coarse, refined: fit.nails, stable: visibleNails, fits: fit.diagnostics, pose, visibility,
      sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight, mirrored: false, timestamp: performance.now(),
      sourceMode: "photo",
    });
    return visibleNails;
  } finally {
    refiner.dispose();
  }
}

async function getLandmarker(mode: "IMAGE" | "VIDEO" = "VIDEO") {
  if (mode === "IMAGE") {
    if (!imageLandmarkerPromise) {
      const pending = createLandmarkerWithFallback(mode);
      imageLandmarkerPromise = pending;
      pending.catch(() => {
        if (imageLandmarkerPromise === pending) imageLandmarkerPromise = null;
      });
    }
    return imageLandmarkerPromise;
  }
  if (!landmarkerPromise) {
    const pending = createLandmarkerWithFallback(mode);
    landmarkerPromise = pending;
    pending.catch(() => {
      if (landmarkerPromise === pending) landmarkerPromise = null;
    });
  }
  return landmarkerPromise;
}

async function createLandmarkerWithFallback(runningMode: "IMAGE" | "VIDEO", cpuOnly = false) {
  debugTracking("MediaPipe initialization start");
  const started = performance.now();
  const vision = await withTrackingTimeout(FilesetResolver.forVisionTasks(
    "/mediapipe",
  ), initializationTimeoutMs).catch(error => {
    diagnosticError("initialization", error, "wasm-resolution-failed");
    updateTrackingDiagnostics(d => { d.engine.state = "failed"; }); throw error;
  });

  const create = (delegate: "GPU" | "CPU") => {
    if (pendingEngines >= 2) return Promise.reject(new Error("Previous engine initialization still pending"));
    pendingEngines++;
    updateTrackingDiagnostics(d => { d.stage = "B-initialization"; d.engine.state = "initializing"; d.engine.delegate = delegate; d.engine.attempts++; });
    const pending = Promise.resolve().then(() => HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "/mediapipe/hand_landmarker.task",
          delegate,
        },
        runningMode,
        numHands: 1,
        minHandDetectionConfidence: 0.35,
        minHandPresenceConfidence: 0.35,
        minTrackingConfidence: 0.35,
      })).finally(() => { pendingEngines--; });
    return withTrackingTimeout(pending, initializationTimeoutMs, closeEngine).then(instance => {
      delegates.set(instance, delegate); return instance;
    });
  };

  try {
    const instance = cpuOnly ? await create("CPU") : await initializeWithDelegateFallback(create, (message, detail) => {
      if (detail) diagnosticError("initialization", detail, message.startsWith("GPU") ? "gpu-initialization-failed" : "cpu-initialization-failed");
      debugTracking(message, detail);
    });
    updateTrackingDiagnostics(d => { d.engine.state = "ready"; d.engine.delegate = delegates.get(instance) ?? null; d.engine.initializationMs = performance.now() - started; });
    return instance;
  } catch (error) {
    diagnosticError("initialization", error, "engine-initialization-failed");
    updateTrackingDiagnostics(d => { d.engine.state = "failed"; }); throw error;
  }
}

function debugTracking(message: string, detail?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    if (detail === undefined) console.debug(`[Nail Fit Studio] ${message}`);
    else console.debug(`[Nail Fit Studio] ${message}`, detail);
  }
}

function publishDetectionState(
  state: HandDetectionState,
  previousState: HandDetectionState | null,
  handler?: DetectionStateHandler,
) {
  if (state !== previousState) handler?.(state);
  return state;
}

function prepareDetectionInput(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D | null,
  mode: DetectionInputMode,
  maxSide = 960,
) {
  if (!context) return video;
  const sideLimit = mode === "canvas-640" ? 640 : mode === "canvas-native" ? Math.max(video.videoWidth, video.videoHeight) : Math.min(960, maxSide);
  const maxWidth = Math.round(video.videoWidth * Math.min(1, sideLimit / Math.max(video.videoWidth, video.videoHeight)));
  const size = calculateProcessingSize(video.videoWidth, video.videoHeight, maxWidth);
  if (canvas.width !== size.width) canvas.width = size.width;
  if (canvas.height !== size.height) canvas.height = size.height;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return mode === "video" ? video : canvas;
}
