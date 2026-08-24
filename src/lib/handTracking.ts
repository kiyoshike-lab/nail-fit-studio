import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { NailPose } from "./types";
import { buildNailsFromLandmarks } from "./nailGeometry";
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

export async function startHandTracking(
  video: HTMLVideoElement,
  onUpdate: (nails: NailPose[], detected: boolean) => void,
  mirrored: boolean,
  onTrackingError?: TrackingErrorHandler,
  onDetectionState?: DetectionStateHandler,
): Promise<HandTracker> {
  const landmarker = await getLandmarker();
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
  const processingCanvas = document.createElement("canvas");
  const processingContext = processingCanvas.getContext("2d", { alpha: false });

  const loop = (frameTime: number) => {
    if (stopped) return;
    if (
      frameTime - lastDetectionAt >= detectionIntervalMs
      && video.readyState >= 2
      && video.currentTime !== lastVideoTime
    ) {
      lastDetectionAt = frameTime;
      lastVideoTime = video.currentTime;
      try {
        const input = prepareDetectionInput(video, processingCanvas, processingContext, inputMode);
        const result = landmarker.detectForVideo(input, performance.now());
        consecutiveDetectionErrors = 0;
        const landmarks = result.landmarks?.[0] as NormalizedLandmark[] | undefined;
        if (landmarks?.length) {
          successfulDetections += 1;
          consecutiveMisses = 0;
          everDetected = true;
          lastDetectedAt = frameTime;
          previousState = publishDetectionState("detected", previousState, onDetectionState);
          onUpdate(buildNailsFromLandmarks(landmarks, mirrored, video.videoWidth / video.videoHeight), true);
        } else {
          failedDetections += 1;
          consecutiveMisses += 1;
          const missingForMs = frameTime - lastDetectedAt;
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
    raf = requestAnimationFrame(loop);
  };

  raf = requestAnimationFrame(loop);
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
    },
  };
}

export function resetHandTrackingEngine() {
  const previous = landmarkerPromise;
  landmarkerPromise = null;
  void previous?.then((landmarker) => landmarker.close()).catch(() => undefined);
}

export async function detectHandNails(image: HTMLImageElement): Promise<NailPose[]> {
  const landmarker = await getLandmarker();
  await landmarker.setOptions({ runningMode: "IMAGE" });
  try {
    const result = landmarker.detect(image);
    const landmarks = result.landmarks?.[0] as NormalizedLandmark[] | undefined;
    return landmarks?.length ? buildNailsFromLandmarks(landmarks, false, image.naturalWidth / image.naturalHeight) : [];
  } finally {
    await landmarker.setOptions({ runningMode: "VIDEO" });
  }
}

async function getLandmarker() {
  if (!landmarkerPromise) {
    const pending = createLandmarkerWithFallback();
    landmarkerPromise = pending;
    pending.catch(() => {
      if (landmarkerPromise === pending) landmarkerPromise = null;
    });
  }
  return landmarkerPromise;
}

async function createLandmarkerWithFallback() {
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
        runningMode: "VIDEO",
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
) {
  if (mode === "video" || !context) return video;
  const maxWidth = mode === "canvas-960" ? 960 : mode === "canvas-640" ? 640 : undefined;
  const size = calculateProcessingSize(video.videoWidth, video.videoHeight, maxWidth);
  if (canvas.width !== size.width) canvas.width = size.width;
  if (canvas.height !== size.height) canvas.height = size.height;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}
