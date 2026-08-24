import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const [studio, handTracking, preview, fallbackSource] = await Promise.all([
  readFile("src/components/NailStudio.tsx", "utf8"),
  readFile("src/lib/handTracking.ts", "utf8"),
  readFile("src/components/NailPreview.tsx", "utf8"),
  readFile("src/lib/trackingFallback.ts", "utf8"),
]);

const openCameraBlock = studio.slice(studio.indexOf("const openCamera"), studio.indexOf("useEffect(() =>", studio.indexOf("const openCamera")));
const trackingBlock = studio.slice(studio.indexOf("const startTrackingForCamera"), studio.indexOf("const openCamera"));
assert.ok(openCameraBlock.indexOf('setMode("camera")') < openCameraBlock.indexOf("await startTrackingForCamera"));
assert.ok(openCameraBlock.indexOf("} catch (error) {") < openCameraBlock.indexOf("await startTrackingForCamera"));
assert.equal(trackingBlock.includes("releaseCamera"), false, "tracker失敗処理がカメラを停止する構造に戻っています");
assert.ok(trackingBlock.includes("爪を手動で調整できます"));
assert.ok(studio.includes("resetHandTrackingEngine();") && studio.includes("retryHandTracking"));
assert.ok(preview.includes("自動認識を再試行"));
assert.ok(handTracking.includes("maxConsecutiveDetectionErrors"));
assert.ok(handTracking.includes("detectForVideo error"));
assert.ok(handTracking.includes("landmarkerPromise = null"));
assert.ok(handTracking.includes("resetHandTrackingEngine"));
assert.ok(studio.includes("detectHandNails(detectionImage)"), "写真アップロードの手認識が失われています");

const compiledFallback = ts.transpileModule(fallbackSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const tracking = await import(`data:text/javascript;base64,${Buffer.from(compiledFallback).toString("base64")}`);

const gpuOnlyCalls = [];
const gpuInstance = await tracking.initializeWithDelegateFallback(async (delegate) => {
  gpuOnlyCalls.push(delegate);
  return { delegate };
});
assert.deepEqual(gpuOnlyCalls, ["GPU"]);
assert.equal(gpuInstance.delegate, "GPU");

const fallbackCalls = [];
const cpuInstance = await tracking.initializeWithDelegateFallback(async (delegate) => {
  fallbackCalls.push(delegate);
  if (delegate === "GPU") throw new Error("gpu unavailable");
  return { delegate };
});
assert.deepEqual(fallbackCalls, ["GPU", "CPU"]);
assert.equal(cpuInstance.delegate, "CPU");

await assert.rejects(
  () => tracking.initializeWithDelegateFallback(async () => { throw new Error("no delegate"); }),
  /no delegate/,
);

const stream = { active: true };
const activeTracker = { stopped: false, stop() { this.stopped = true; } };
const activeResult = await tracking.initializeTrackerSafely(async () => activeTracker, () => stream.active);
assert.equal(activeResult.status, "active");
assert.equal(stream.active, true);

const failedResult = await tracking.initializeTrackerSafely(async () => { throw new Error("tracker failed"); }, () => stream.active);
assert.equal(failedResult.status, "failed");
assert.equal(stream.active, true, "tracker初期化失敗でカメラstreamが停止しました");

const staleTracker = { stopped: false, stop() { this.stopped = true; } };
const staleResult = await tracking.initializeTrackerSafely(async () => staleTracker, () => false);
assert.equal(staleResult.status, "stale");
assert.equal(staleTracker.stopped, true);

console.log("tracking-resilience scenarios=9 passed");
