import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const [geometrySource, smoothingSource, studio, tracking] = await Promise.all([
  readFile("src/lib/nailGeometry.ts", "utf8"),
  readFile("src/lib/nailSmoothing.ts", "utf8"),
  readFile("src/components/NailStudio.tsx", "utf8"),
  readFile("src/lib/handTracking.ts", "utf8"),
]);

const geometry = await importModule(geometrySource);
const smoothing = await importModule(smoothingSource);

const hand = createHand();
const nails = geometry.buildNailsFromLandmarks(hand, false, 4 / 3);
assert.equal(nails.length, 5);

for (const [finger, tipIndex, dipIndex] of [
  [0, 4, 3], [1, 8, 7], [2, 12, 11], [3, 16, 15], [4, 20, 19],
]) {
  const nail = nails[finger];
  const tip = hand[tipIndex];
  const dip = hand[dipIndex];
  const rootToTip = Math.hypot(nail.x / 100 - tip.x, nail.y / 100 - tip.y);
  const jointToTip = Math.hypot(dip.x - tip.x, dip.y - tip.y);
  assert.ok(rootToTip > jointToTip * 0.32, `finger ${finger} root is too close to the fingertip`);
  assert.ok(rootToTip < jointToTip * 1.05, `finger ${finger} root fell behind the nail bed`);
}

assert.ok(nails[4].width < nails[3].width, "pinky width must be smaller than ring finger");
assert.ok(nails[4].height < nails[3].height, "pinky height must be smaller than ring finger");
assert.ok(nails[0].width > nails[1].width, "thumb needs its own wider geometry");

const small = geometry.buildNailsFromLandmarks(scaleHand(hand, 0.72), false, 4 / 3);
const large = geometry.buildNailsFromLandmarks(scaleHand(hand, 1.25), false, 4 / 3);
assert.ok(large[2].width > small[2].width * 1.45, "nail width does not scale with hand distance");
assert.ok(large[2].height > small[2].height * 1.45, "nail height does not scale with hand distance");

const angledHand = createHand();
angledHand[8] = { x: 0.45, y: 0.25 };
angledHand[7] = { x: 0.42, y: 0.33 };
const angledNails = geometry.buildNailsFromLandmarks(angledHand, false, 4 / 3);
assert.ok(Math.abs(angledNails[1].rotation) > 12, "rotation is not following the distal finger angle");

const foreshortened = createHand();
foreshortened[20] = { x: 0.715, y: 0.41, z: -0.12 };
const obliqueNails = geometry.buildNailsFromLandmarks(foreshortened, false, 4 / 3);
assert.ok(obliqueNails[4].height > nails[4].height * 0.48, "oblique pinky nail collapsed too far");

const base = { x: 50, y: 40, width: 4.5, height: 7, rotation: 179 };
const still = smoothing.calculateSmoothingAlphas(base, { ...base, x: 50.05, y: 40.04 }, 0.06);
const moving = smoothing.calculateSmoothingAlphas(base, { ...base, x: 54, y: 43 }, 4.5);
assert.ok(still.position < 0.25, "stationary position smoothing is too loose");
assert.ok(moving.position > 0.72, "sudden movement is not followed quickly enough");

const resizing = smoothing.calculateSmoothingAlphas(base, { ...base, width: 6, height: 9 }, 0.05);
assert.ok(resizing.size > resizing.position, "size EMA is not independent from position EMA");
const rotating = smoothing.calculateSmoothingAlphas(base, { ...base, rotation: 150 }, 0.05);
assert.ok(rotating.rotation > rotating.position, "rotation EMA is not independent from position EMA");

const wrapped = smoothing.smoothAngle(179, -179, 0.5);
assert.ok(Math.abs(Math.abs(wrapped) - 180) < 1.1, "rotation smoothing crossed the long way around 180 degrees");

const next = nails.map((nail) => ({ ...nail, x: nail.x + 0.06, y: nail.y - 0.04 }));
const smoothed = smoothing.smoothTrackedNails(nails, next);
assert.ok(smoothed[2].x > nails[2].x && smoothed[2].x < next[2].x, "EMA did not damp a small position jitter");

assert.ok(studio.includes("hasTrackingPoseRef.current = true"), "first tracking pose is not applied immediately");
assert.ok(studio.includes("smoothTrackedNails(current, tracked)"), "adaptive nail smoothing is not wired to realtime tracking");
assert.ok(tracking.includes("video.videoWidth / video.videoHeight"), "video aspect ratio is not used by nail geometry");
assert.ok(tracking.includes("image.naturalWidth / image.naturalHeight"), "photo aspect ratio is not used by nail geometry");

console.log("nail-fit scenarios=bed-centres/thumb/pinky/scale/rotation/oblique/adaptive-ema passed");

async function importModule(source) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

function createHand() {
  return [
    { x: 0.5, y: 0.88 },
    { x: 0.4, y: 0.72 }, { x: 0.32, y: 0.63 }, { x: 0.24, y: 0.55 }, { x: 0.17, y: 0.48 },
    { x: 0.4, y: 0.62 }, { x: 0.39, y: 0.45 }, { x: 0.39, y: 0.33 }, { x: 0.39, y: 0.24 },
    { x: 0.49, y: 0.59 }, { x: 0.49, y: 0.4 }, { x: 0.49, y: 0.28 }, { x: 0.49, y: 0.18 },
    { x: 0.58, y: 0.62 }, { x: 0.59, y: 0.45 }, { x: 0.6, y: 0.33 }, { x: 0.61, y: 0.24 },
    { x: 0.67, y: 0.67 }, { x: 0.69, y: 0.52 }, { x: 0.71, y: 0.43 }, { x: 0.73, y: 0.36 },
  ];
}

function scaleHand(hand, scale) {
  const origin = hand[0];
  return hand.map((point) => ({
    ...point,
    x: origin.x + (point.x - origin.x) * scale,
    y: origin.y + (point.y - origin.y) * scale,
  }));
}
