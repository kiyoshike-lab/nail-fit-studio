import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { NailPose } from "./types";
import { initializeWithDelegateFallback } from "./trackingFallback";
import {
  calculateProcessingSize,
  mapLandmarkToPreview,
  nextHandDetectionState,
  selectDetectionInputMode,
  type DetectionInputMode,
  type HandDetectionState,
  type NormalizedLandmark,
} from "./handDetectionInput";

export type { HandDetectionState, NormalizedLandmark } from "./handDetectionInput";

type HandLandmarkerInstance = Awaited<ReturnType<typeof HandLandmarker.createFromOptions>>;

const tipIndexes = [4, 8, 12, 16, 20];
const dipIndexes = [3, 7, 11, 15, 19];
const pipIndexes = [2, 6, 10, 14, 18];
const fingerWidthMultipliers = [0.72, 0.62, 0.66, 0.62, 0.58];
const nailAspectMultipliers = [
  { width: 1.18, height: 0.86 },
  { width: 1, height: 1 },
  { width: 1.03, height: 1.04 },
  { width: 0.96, height: 0.98 },
  { width: 0.9, height: 0.86 },
];
const nailPlacementTuning = [
  { along: 0.2, side: 0.08, height: 0.74 },
  { along: 0.2, side: 0.0, height: 0.72 },
  { along: 0.2, side: 0.0, height: 0.72 },
  { along: 0.2, side: 0.0, height: 0.7 },
  { along: 0.22, side: -0.02, height: 0.66 },
];

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
          onUpdate(buildNailsFromLandmarks(landmarks, mirrored), true);
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
    return landmarks?.length ? buildNailsFromLandmarks(landmarks, false) : [];
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

function buildNailsFromLandmarks(landmarks: NormalizedLandmark[], mirrored: boolean): NailPose[] {
  return tipIndexes.map((tipIndex, index) => {
    const tip = mapLandmarkToPreview(landmarks[tipIndex], mirrored);
    const dip = mapLandmarkToPreview(landmarks[dipIndexes[index]], mirrored);
    const pip = mapLandmarkToPreview(landmarks[pipIndexes[index]], mirrored);
    const distalDx = tip.x - dip.x;
    const distalDy = tip.y - dip.y;
    const proximalDx = dip.x - pip.x;
    const proximalDy = dip.y - pip.y;
    const blendedDx = index === 0 ? distalDx * 0.84 + proximalDx * 0.16 : distalDx * 0.62 + proximalDx * 0.38;
    const blendedDy = index === 0 ? distalDy * 0.84 + proximalDy * 0.16 : distalDy * 0.62 + proximalDy * 0.38;
    const fingerLength = Math.hypot(blendedDx, blendedDy);
    const axis = normalize({ x: blendedDx, y: blendedDy });
    const sideAxis = { x: -axis.y, y: axis.x };
    const tuning = nailPlacementTuning[index];
    const thumbSideSign = index === 0 && landmarks[4].x < landmarks[8].x ? -1 : 1;
    const sideOffset = (tuning.side ?? 0) * thumbSideSign * fingerLength;
    const root = {
      x: tip.x - axis.x * fingerLength * tuning.along + sideAxis.x * sideOffset,
      y: tip.y - axis.y * fingerLength * tuning.along + sideAxis.y * sideOffset,
    };
    const aspect = nailAspectMultipliers[index];
    const widthEstimate = estimateFingerWidth(landmarks, index, mirrored) * fingerWidthMultipliers[index];
    const width = clamp(widthEstimate * 100 * aspect.width, 1.5, index === 0 ? 7.8 : 6.2);
    const height = clamp(fingerLength * 100 * tuning.height * aspect.height, 2.4, index === 0 ? 9.8 : 11.5);
    const rotation = (Math.atan2(axis.y, axis.x) * 180) / Math.PI + 90;
    return {
      x: clamp(root.x * 100, 0, 100),
      y: clamp(root.y * 100, 0, 100),
      width,
      height,
      rotation,
      confidence: 0.74,
    };
  });
}

function estimateFingerWidth(landmarks: NormalizedLandmark[], index: number, mirrored: boolean) {
  const mirroredPoints = landmarks.map((point) => mapLandmarkToPreview(point, mirrored));
  const dip = mirroredPoints[dipIndexes[index]];
  const pip = mirroredPoints[pipIndexes[index]];
  const length = Math.hypot(dip.x - pip.x, dip.y - pip.y);
  const neighbors: NormalizedLandmark[] = [];
  if (index > 1) neighbors.push(mirroredPoints[dipIndexes[index - 1]]);
  if (index < 4) neighbors.push(mirroredPoints[dipIndexes[index + 1]]);
  const neighborDistance = neighbors.length
    ? neighbors.reduce((sum, point) => sum + Math.hypot(point.x - dip.x, point.y - dip.y), 0) / neighbors.length
    : length * 0.58;
  return clamp(Math.min(length * 0.68, neighborDistance * 0.42), 0.012, 0.06);
}

function normalize(vector: { x: number; y: number }) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
