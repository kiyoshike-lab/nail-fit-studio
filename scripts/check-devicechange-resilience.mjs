import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const [studio, cameraSource] = await Promise.all([
  readFile("src/components/NailStudio.tsx", "utf8"),
  readFile("src/lib/cameraDevices.ts", "utf8"),
]);

const deviceChangeBlock = studio.slice(
  studio.indexOf("const inspectDevicesAfterChange"),
  studio.indexOf("const startCamera"),
);
assert.ok(deviceChangeBlock.includes("cameraStartingRef.current"));
assert.ok(deviceChangeBlock.includes("deviceChangeTimerRef.current"));
assert.ok(deviceChangeBlock.includes("}, 500)"));
assert.ok(deviceChangeBlock.includes("isLiveCameraStream(stream)"));
assert.equal(deviceChangeBlock.includes("stopCamera("), false, "devicechangeがカメラを停止する構造に戻っています");
assert.ok(deviceChangeBlock.includes("track-ended"));

const endedHandler = studio.slice(
  studio.indexOf('videoTrack.addEventListener("ended"'),
  studio.indexOf("const video = videoRef.current"),
);
assert.ok(endedHandler.includes('releaseCamera("track-ended")'));
assert.ok(endedHandler.includes('setMode("empty")'));

const openCameraBlock = studio.slice(studio.indexOf("const openCamera"), studio.indexOf("const inspectDevicesAfterChange"));
assert.ok(openCameraBlock.includes("cameraStartingRef.current = true"));
assert.ok(openCameraBlock.includes("cameraProtectionUntilRef.current = Date.now() + 2000"));
assert.ok(openCameraBlock.includes('releaseCamera("switching-camera")'));
assert.ok(openCameraBlock.indexOf('releaseCamera("switching-camera")') < openCameraBlock.indexOf("getCameraStreamWithFallback"));

const cleanupBlock = studio.slice(studio.indexOf('releaseCamera("component-unmount")') - 180, studio.indexOf('releaseCamera("component-unmount")') + 180);
assert.ok(cleanupBlock.includes("return () =>"));
assert.equal(deviceChangeBlock.includes('releaseCamera("component-unmount")'), true);

const compiledCamera = ts.transpileModule(cameraSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const camera = await import(`data:text/javascript;base64,${Buffer.from(compiledCamera).toString("base64")}`);

assert.equal(camera.shouldDeferDeviceChange(true, 0, 1000), true, "ケースA: 起動中devicechangeを保護できません");
assert.equal(camera.shouldDeferDeviceChange(false, 2500, 1000), true, "起動直後の保護期間が機能しません");
assert.equal(camera.shouldDeferDeviceChange(false, 500, 1000), false);

const liveTrack = { readyState: "live" };
const liveStream = { active: true, getVideoTracks: () => [liveTrack] };
assert.equal(camera.isLiveCameraStream(liveStream), true, "ケースB: live streamを継続判定できません");

const endedTrack = { readyState: "ended" };
const endedStream = { active: false, getVideoTracks: () => [endedTrack] };
assert.equal(camera.isLiveCameraStream(endedStream), false, "ケースC: ended trackをlive扱いしています");

assert.ok(studio.includes("startTrackingForCamera") && studio.includes("爪を手動で調整できます"), "ケースE: MediaPipe失敗時のカメラ継続が失われています");

console.log("devicechange-resilience cases=A-E passed");
