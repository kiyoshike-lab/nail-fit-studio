import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const [studio, cameraDevices, selector, storage] = await Promise.all([
  readFile("src/components/NailStudio.tsx", "utf8"),
  readFile("src/lib/cameraDevices.ts", "utf8"),
  readFile("src/components/CameraDeviceSelector.tsx", "utf8"),
  readFile("src/lib/storage.ts", "utf8"),
]);

const contracts = [
  [studio, "enumerateDevices", "カメラ一覧を取得する"],
  [cameraDevices, 'device.kind === "videoinput"', "映像入力だけを一覧化する"],
  [cameraDevices, "device.label", "ブラウザのカメラ名を表示する"],
  [cameraDevices, "deviceId: { exact: selectedDeviceId }", "選択したdeviceIdをexact指定する"],
  [cameraDevices, "facingMode: { ideal: facingMode }", "未選択時はfacingModeを優先する"],
  [studio, 'addEventListener("devicechange"', "カメラ接続変更を監視する"],
  [studio, 'addEventListener("ended"', "カメラ切断を監視する"],
  [studio, "track.stop()", "MediaStreamのtrackを停止する"],
  [studio, "video.srcObject = stream", "選択したstreamをvideoへ設定する"],
  [cameraDevices, 'name === "NotAllowedError"', "権限拒否を案内する"],
  [cameraDevices, 'name === "NotReadableError"', "他アプリ利用中を案内する"],
  [cameraDevices, 'name === "NotFoundError"', "カメラ未検出を案内する"],
  [cameraDevices, 'name === "OverconstrainedError"', "選択カメラ起動失敗を案内する"],
  [selector, "使用するカメラ", "複数カメラ選択UIを表示する"],
  [selector, "devices.length < 2", "カメラが複数ある場合だけUIを表示する"],
  [storage, "cameraDevice", "選択カメラをlocalStorageへ保存する"],
];

for (const [source, expected, description] of contracts) {
  assert.ok(source.includes(expected), `camera contract missing: ${description}`);
}

assert.ok(
  studio.includes("shouldMirrorCamera") && studio.includes("cameraMirrored"),
  "選択カメラに応じた左右反転が撮影・保存・プレビューで共有されていません",
);

const compiledCameraHelpers = ts.transpileModule(cameraDevices, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const camera = await import(`data:text/javascript;base64,${Buffer.from(compiledCameraHelpers).toString("base64")}`);

const fakeDevice = (kind, deviceId, label) => ({ kind, deviceId, label });
assert.deepEqual(
  camera.listVideoInputs([
    fakeDevice("audioinput", "mic", "Microphone"),
    fakeDevice("videoinput", "built-in", "Integrated Camera"),
    fakeDevice("videoinput", "usb", "Logitech Webcam"),
  ]),
  [
    { deviceId: "built-in", label: "Integrated Camera" },
    { deviceId: "usb", label: "Logitech Webcam" },
  ],
  "複数のvideoinputを名称付きで取得できません",
);
assert.equal(camera.listVideoInputs([fakeDevice("videoinput", "only", "USB Camera")]).length, 1);
assert.deepEqual(camera.buildVideoConstraints("usb", "environment").deviceId, { exact: "usb" });
assert.deepEqual(camera.buildVideoConstraints("", "environment").facingMode, { ideal: "environment" });
assert.match(camera.cameraErrorMessage({ name: "NotAllowedError" }), /許可/);
assert.match(camera.cameraErrorMessage({ name: "NotReadableError" }), /別のアプリ/);
assert.match(camera.cameraErrorMessage({ name: "NotFoundError" }), /見つかりません/);
assert.equal(camera.shouldFallbackFromSelectedCamera({ name: "OverconstrainedError" }), true);
assert.equal(camera.shouldMirrorCamera("External Camera", true, "environment", "user"), true);
assert.equal(camera.shouldMirrorCamera("Logitech Webcam", true, "user", "environment"), false);

console.log(`camera-support contracts=${contracts.length + 1} scenarios=10 passed`);
