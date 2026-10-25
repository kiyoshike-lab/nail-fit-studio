import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { NailPose } from "./types";
import { buildNailsFromLandmarks } from "./nailGeometry";
import { NailTrackStabilizer, TrackingPerformance } from "./trackingQuality";
import { NailFrameRefiner } from "./nailFrameRefiner";
import { publishNailAlignmentDebug } from "./nailAlignmentDebug";
import { initializeWithDelegateFallback } from "./trackingFallback";
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

export async function startHandTracking(
  video: HTMLVideoElement,
  onUpdate: (nails: NailPose[], detected: boolean) => void,
  mirrored: boolean,
  onTrackingError?: TrackingErrorHandler,
  onDetectionState?: DetectionStateHandler,
): Promise<HandTracker> {
  const session = ++videoSession;
  activeTracker?.stop();
  const landmarker = await getLandmarker();
  if (session !== videoSession) return { stop() {} };
  let stopped = false;
  let raf = 0;
  let lastVideoTime = -1;
  let lastDetectionAt = -Infinity;
  let lastDetectedAt = performance.now();
  let consecutiveDetectionErrors = 0;
  let successfulDetections = 0;
  let failedDetections = 0;
  let consecutiveMisses = 0;
  let everDetected = false;
  let previousState: HandDetectionState | null = null;
  let inputMode: DetectionInputMode = "video";
  let previousInputMode: DetectionInputMode = inputMode;
  const stabilizer = new NailTrackStabilizer();
  const refiner = new NailFrameRefiner();
  const metrics = new TrackingPerformance();
  let videoFrameCallback = 0;
  const observeVideoFrame: VideoFrameRequestCallback = (_now, metadata) => {
    if (stopped) return;
    metrics.recordCameraFrame(metadata.presentedFrames);
    videoFrameCallback = video.requestVideoFrameCallback(observeVideoFrame);
  };
  if (typeof video.requestVideoFrameCallback === "function") {
    videoFrameCallback = video.requestVideoFrameCallback(observeVideoFrame);
  }
  const processingCanvas = document.createElement("canvas");
  const processingContext = processingCanvas.getContext("2d", { alpha: false });

  const loop = (frameTime: number) => {
    if (stopped) return;
    metrics.frame(frameTime, video.currentTime);
    if (
      frameTime - lastDetectionAt >= Math.max(detectionIntervalMs, metrics.budget.intervalMs)
      && video.readyState >= 2
      && video.currentTime !== lastVideoTime
    ) {
      lastDetectionAt = frameTime;
      lastVideoTime = video.currentTime;
      try {
        const startedAt = performance.now();
        const effectiveMode = metrics.budget.maxSide === 640 ? "canvas-640" : inputMode;
        const input = prepareDetectionInput(video, processingCanvas, processingContext, effectiveMode, metrics.budget.maxSide);
        lastInferenceTimestamp = Math.max(performance.now(), lastInferenceTimestamp + 0.01);
        const result = landmarker.detectForVideo(input, lastInferenceTimestamp);
        consecutiveDetectionErrors = 0;
        const landmarks = result.landmarks?.[0] as NormalizedLandmark[] | undefined;
        const identity = result.handedness?.[0]?.[0];
        const rawNails = landmarks?.length
          ? buildNailsFromLandmarks(landmarks, mirrored, video.videoWidth / video.videoHeight) : [];
        // The Canvas input is a snapshot: landmark inference and pixel fitting
        // must inspect the same unpainted frame, never the nail overlay.
        const fit = input instanceof HTMLCanvasElement
          ? refiner.refine(input, input.width, input.height, rawNails, mirrored, performance.now())
          : { nails: rawNails, diagnostics: rawNails.map(() => ({ accepted: false, confidence: 0, reason: "no-frame-snapshot" })) };
        const stableNails = stabilizer.update(fit.nails, frameTime, identity
          ? { label: identity.categoryName, score: identity.score } : undefined);
        const busyMs = performance.now() - startedAt;
        metrics.recordInference(busyMs);
        // Also leave main-thread time after inference and refinement complete.
        lastDetectionAt = frameTime + busyMs;
        if (stableNails) {
          successfulDetections += 1;
          consecutiveMisses = 0;
          everDetected = true;
          lastDetectedAt = performance.now();
          previousState = publishDetectionState("detected", previousState, onDetectionState);
          onUpdate(stableNails, true);
          if (process.env.NODE_ENV !== "production" && landmarks) publishNailAlignmentDebug({
            landmarks, coarse: rawNails, refined: fit.nails, stable: stableNails, fits: fit.diagnostics,
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
          onUpdate([], false);
        }

        if (
          successfulDetections + failedDetections === 1
          || (successfulDetections + failedDetections) % 20 === 0
          || inputMode !== previousInputMode
        ) {
          debugTracking("Hand detection frame", {
            landmarksLength: result.landmarks?.length ?? 0,
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
          });
          previousInputMode = inputMode;
        }
      } catch (error) {
        consecutiveDetectionErrors += 1;
        debugTracking("detectForVideo error", error);
        if (consecutiveDetectionErrors >= maxConsecutiveDetectionErrors) {
          stopped = true;
          resetHandTrackingEngine();
          onTrackingError?.(error);
          return;
        }
      }
    }
    if (everDetected && performance.now() - lastDetectedAt > 450) {
      previousState = publishDetectionState("lost", previousState, onDetectionState);
    }
    const measurement = metrics.snapshot(frameTime);
    if (measurement) debugTracking("Tracking performance", measurement);
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
  void previous?.then((landmarker) => landmarker.close()).catch(() => undefined);
  void previousImage?.then((landmarker) => landmarker.close()).catch(() => undefined);
}

export async function detectHandNails(image: HTMLImageElement): Promise<NailPose[]> {
  const landmarker = await getLandmarker("IMAGE");
  const result = landmarker.detect(image);
  const landmarks = result.landmarks?.[0] as NormalizedLandmark[] | undefined;
  const coarse = landmarks?.length ? buildNailsFromLandmarks(landmarks, false, image.naturalWidth / image.naturalHeight) : [];
  const refiner = new NailFrameRefiner();
  try {
    const fit = refiner.refine(image, image.naturalWidth, image.naturalHeight, coarse, false, performance.now());
    if (process.env.NODE_ENV !== "production" && landmarks) publishNailAlignmentDebug({
      landmarks, coarse, refined: fit.nails, stable: fit.nails, fits: fit.diagnostics,
      sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight, mirrored: false, timestamp: performance.now(),
      sourceMode: "photo",
    });
    return fit.nails;
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

async function createLandmarkerWithFallback(runningMode: "IMAGE" | "VIDEO") {
  debugTracking("MediaPipe initialization start");
  const vision = await FilesetResolver.forVisionTasks(
    "/mediapipe",
  );

  const create = (delegate: "GPU" | "CPU") =>
    HandLandmarker.createFromOptions(vision, {
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
      });

  return initializeWithDelegateFallback(create, debugTracking);
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
  const sideLimit = mode === "canvas-640" ? 640 : maxSide;
  const maxWidth = Math.round(video.videoWidth * Math.min(1, sideLimit / Math.max(video.videoWidth, video.videoHeight)));
  const size = calculateProcessingSize(video.videoWidth, video.videoHeight, maxWidth);
  if (canvas.width !== size.width) canvas.width = size.width;
  if (canvas.height !== size.height) canvas.height = size.height;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}
