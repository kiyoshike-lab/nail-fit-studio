import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import ts from "typescript";

const [trackingSource, inputSource, studio, preview, css] = await Promise.all([
  readFile("src/lib/handTracking.ts", "utf8"),
  readFile("src/lib/handDetectionInput.ts", "utf8"),
  readFile("src/components/NailStudio.tsx", "utf8"),
  readFile("src/components/NailPreview.tsx", "utf8"),
  readFile("app/globals.css", "utf8"),
]);

assert.ok(trackingSource.includes("minHandDetectionConfidence: 0.35"));
assert.ok(trackingSource.includes("minHandPresenceConfidence: 0.35"));
assert.ok(trackingSource.includes("minTrackingConfidence: 0.35"));
assert.ok(trackingSource.includes("detectionIntervalMs = 50"));
assert.ok(trackingSource.includes("result.landmarks?.length"));
assert.ok(trackingSource.includes("result.handedness"));
assert.ok(trackingSource.includes("successfulDetections"));
assert.ok(trackingSource.includes("failedDetections"));
assert.ok(trackingSource.includes("context.drawImage(video"));
assert.ok(trackingSource.includes("landmarker.detectForVideo(input"));
assert.ok(trackingSource.includes("landmarker.detect(image)"));
assert.ok(trackingSource.includes('FilesetResolver.forVisionTasks(\n    "/mediapipe"'));
assert.ok(trackingSource.includes('"/mediapipe/hand_landmarker.task"'));
assert.ok(studio.includes("detectHandNails(detectionImage)"));
assert.ok(studio.includes("smoothTrackedNails(current, tracked)"));
assert.ok(preview.includes("手を探しています…"));
assert.ok(preview.includes("手を検出しました"));
assert.ok(preview.includes("手を見失いました"));
assert.ok(preview.includes("camera-guide-frame"));

const containRule = css.lastIndexOf(".media-source{object-fit:contain}");
const coverRule = css.lastIndexOf(".media-source{object-fit:cover}");
assert.ok(containRule > coverRule, "試着映像がCSS cropされ、座標系がずれる可能性があります");

const compiledInput = ts.transpileModule(inputSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const input = await import(`data:text/javascript;base64,${Buffer.from(compiledInput).toString("base64")}`);

assert.equal(input.nextHandDetectionState(false, 0, true), "detected", "landmarksありを検出状態にできません");
assert.equal(input.nextHandDetectionState(false, 20, false), "searching", "初回landmarksなしの状態が不正です");
assert.equal(input.nextHandDetectionState(true, 2, false), "detected", "一時的な欠落で追跡が不安定になります");
assert.equal(input.nextHandDetectionState(true, 3, false), "lost", "連続欠落を見失い状態にできません");

let mode = "video";
mode = input.selectDetectionInputMode(mode, 2500);
assert.equal(mode, "canvas-native");
mode = input.selectDetectionInputMode(mode, 5000);
assert.equal(mode, "canvas-960");
mode = input.selectDetectionInputMode(mode, 8000);
assert.equal(mode, "canvas-640");
assert.equal(input.selectDetectionInputMode(mode, 10000), "canvas-640", "10秒未検出でtrackerを停止する設計になっています");

assert.deepEqual(input.calculateProcessingSize(1280, 720, 960), { width: 960, height: 540 });
assert.deepEqual(input.calculateProcessingSize(640, 480, 640), { width: 640, height: 480 });
assert.deepEqual(input.calculateProcessingSize(1280, 720), { width: 1280, height: 720 });
assert.deepEqual(input.mapLandmarkToPreview({ x: 0.2, y: 0.4 }, false), { x: 0.2, y: 0.4 });
assert.deepEqual(input.mapLandmarkToPreview({ x: 0.2, y: 0.4 }, true), { x: 0.8, y: 0.4, z: undefined });

for (const asset of [
  "public/mediapipe/vision_wasm_internal.js",
  "public/mediapipe/vision_wasm_internal.wasm",
  "public/mediapipe/vision_wasm_nosimd_internal.js",
  "public/mediapipe/vision_wasm_nosimd_internal.wasm",
  "public/mediapipe/hand_landmarker.task",
]) {
  assert.ok((await stat(asset)).size > 1000, `MediaPipe self-host asset is missing: ${asset}`);
}

console.log("hand-detection scenarios=landmarks/no-landmarks/10s/mirror/sizes/image/video passed");
