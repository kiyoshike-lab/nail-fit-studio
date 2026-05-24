import {
  FilesetResolver,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
import { NailMaskEngine } from "./nail-mask-engine.js";

const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const wasmUrl =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

let landmarker = null;
let animationFrameId = null;
let lastVideoTime = -1;
let activeVideo = null;
let onUpdate = null;
let nailMaskEngine = null;

const tipIndexes = [4, 8, 12, 16, 20];
const dipIndexes = [3, 7, 11, 15, 19];
const pipIndexes = [2, 6, 10, 14, 18];
const fingerWidthMultipliers = [1.18, 1, 1.04, 0.96, 0.82];
const nailAspectMultipliers = [
  { width: 1.08, height: 0.82 },
  { width: 0.92, height: 0.96 },
  { width: 0.96, height: 1 },
  { width: 0.92, height: 0.96 },
  { width: 0.78, height: 0.84 },
];

window.startHandTracking = async function startHandTracking(video, update) {
  activeVideo = video;
  onUpdate = update;

  try {
    if (!landmarker) {
      const vision = await FilesetResolver.forVisionTasks(wasmUrl);
      landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelUrl },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
    }
    if (!nailMaskEngine) {
      nailMaskEngine = await new NailMaskEngine().initialize();
    }

    await waitForVideo(video);
    lastVideoTime = -1;
    renderLoop();
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

window.stopHandTracking = function stopHandTracking() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  activeVideo = null;
  onUpdate = null;
  lastVideoTime = -1;
};

async function renderLoop() {
  if (!activeVideo || !onUpdate) return;

  if (
    activeVideo.readyState >= 2 &&
    activeVideo.currentTime !== lastVideoTime &&
    landmarker
  ) {
    const result = landmarker.detectForVideo(activeVideo, performance.now());
    const landmarks = result.landmarks?.[0];

    if (landmarks) {
      const fallbackNails = buildNailsFromLandmarks(landmarks);
      const nailMasks = await nailMaskEngine.estimate({
        video: activeVideo,
        landmarks,
        fallbackNails,
      });
      onUpdate(nailMasks, true);
    } else {
      onUpdate([], false);
    }

    lastVideoTime = activeVideo.currentTime;
  }

  animationFrameId = requestAnimationFrame(renderLoop);
}

function buildNailsFromLandmarks(landmarks) {
  return tipIndexes.map((tipIndex, index) => {
    const tip = mirror(landmarks[tipIndex]);
    const dip = mirror(landmarks[dipIndexes[index]]);
    const pip = mirror(landmarks[pipIndexes[index]]);

    const distalDx = tip.x - dip.x;
    const distalDy = tip.y - dip.y;
    const proximalDx = dip.x - pip.x;
    const proximalDy = dip.y - pip.y;

    const blendedDx = distalDx * 0.72 + proximalDx * 0.28;
    const blendedDy = distalDy * 0.72 + proximalDy * 0.28;
    const fingerLength = Math.hypot(tip.x - pip.x, tip.y - pip.y);
    const rotation = (Math.atan2(blendedDy, blendedDx) * 180) / Math.PI + 90;
    const nailCenterX = tip.x - blendedDx * 0.2;
    const nailCenterY = tip.y - blendedDy * 0.2;
    const aspect = nailAspectMultipliers[index];
    const widthEstimate = estimateFingerWidth(landmarks, index) * fingerWidthMultipliers[index];
    const nailWidthPct = clamp(widthEstimate * 100 * 0.68 * aspect.width, 2.2, 8.2);
    const nailHeightPct = clamp(fingerLength * 100 * 0.34 * aspect.height, 3.2, 11.5);

    return {
      x: nailCenterX * 100,
      y: nailCenterY * 100,
      scale: 1,
      rotation,
      widthScale: 1,
      heightScale: 1,
      widthPct: nailWidthPct,
      heightPct: nailHeightPct,
    };
  });
}

function estimateFingerWidth(landmarks, index) {
  const mirrored = landmarks.map(mirror);
  const dip = mirrored[dipIndexes[index]];
  const pip = mirrored[pipIndexes[index]];
  const ownBone = Math.hypot(dip.x - pip.x, dip.y - pip.y);

  const sameJointNeighbors = [];
  if (index > 1) sameJointNeighbors.push(mirrored[dipIndexes[index - 1]]);
  if (index < 4) sameJointNeighbors.push(mirrored[dipIndexes[index + 1]]);
  const neighborGap =
    sameJointNeighbors.length > 0
      ? sameJointNeighbors.reduce((sum, point) => sum + Math.hypot(dip.x - point.x, dip.y - point.y), 0) /
        sameJointNeighbors.length
      : ownBone * 0.72;

  const fromBone = ownBone * 0.52;
  const fromNeighborGap = neighborGap * 0.48;
  return clamp(fromBone * 0.58 + fromNeighborGap * 0.42, 0.022, 0.085);
}

function mirror(point) {
  return { x: 1 - point.x, y: point.y };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function waitForVideo(video) {
  if (video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    video.addEventListener("loadeddata", resolve, { once: true });
  });
}
