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
  getNaturalLength: () => NaturalNailLength = () => "auto",
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
  let stabilizer = new NailTrackStabilizer();
  let previousNaturalLength = getNaturalLength();
  const refiner = new NailFrameRefiner();
  const visibilityTracker = new NailVisibilityTracker();
  let previousPose: HandPose | undefined;
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
        const fit: NailRefinementResult = search && input instanceof HTMLCanvasElement
          ? refiner.refine(input, input.width, input.height, rawNails, mirrored, performance.now(), pose.view !== "back" || pose.fingers.some(f => f.facing < 0.3))
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
