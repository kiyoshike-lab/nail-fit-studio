export type CameraInput = {
  deviceId: string;
  label: string;
};

export function listVideoInputs(devices: MediaDeviceInfo[]): CameraInput[] {
  return devices
    .filter((device) => device.kind === "videoinput" && Boolean(device.deviceId))
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label.trim() || `カメラ ${index + 1}`,
    }));
}

export function buildVideoConstraints(
  selectedDeviceId: string,
  facingMode: "user" | "environment",
): MediaTrackConstraints {
  if (selectedDeviceId) {
    return {
      deviceId: { exact: selectedDeviceId },
      width: { ideal: 1280 },
      height: { ideal: 960 },
    };
  }

  return {
    facingMode: { ideal: facingMode },
    width: { ideal: 1280 },
    height: { ideal: 960 },
  };
}

export function cameraErrorMessage(error: unknown, selectedCamera = false) {
  const name = error instanceof DOMException
    ? error.name
    : typeof error === "object" && error && "name" in error
      ? String(error.name)
      : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "カメラの利用が許可されませんでした。ブラウザの設定でカメラを許可するか、写真をアップロードしてお試しください。";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return selectedCamera
      ? "選択したカメラが見つかりません。接続を確認して、別のカメラを選択してください。"
      : "利用できるカメラが見つかりません。カメラを接続するか、写真をアップロードしてお試しください。";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "カメラを開始できませんでした。別のアプリがカメラを使用していないか確認してください。";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "選択したカメラをこの設定で開けませんでした。別のカメラを選択してください。";
  }
  if (name === "AbortError") {
    return "カメラの開始が中断されました。接続を確認して、もう一度お試しください。";
  }
  return selectedCamera
    ? "選択したカメラを開けませんでした。接続を確認して、別のカメラをお試しください。"
    : "カメラを利用できませんでした。写真をアップロードして試すこともできます。";
}

export function includesCamera(devices: CameraInput[], deviceId: string) {
  return Boolean(deviceId) && devices.some((device) => device.deviceId === deviceId);
}

export function shouldFallbackFromSelectedCamera(error: unknown) {
  const name = error instanceof DOMException
    ? error.name
    : typeof error === "object" && error && "name" in error
      ? String(error.name)
      : "";
  return ["NotFoundError", "DevicesNotFoundError", "OverconstrainedError", "ConstraintNotSatisfiedError"].includes(name);
}

export function shouldMirrorCamera(
  label: string,
  explicitDevice: boolean,
  facingMode: "user" | "environment",
  detectedFacingMode?: string,
) {
  if (detectedFacingMode === "user") return true;
  if (detectedFacingMode === "environment") return false;
  if (!explicitDevice) return facingMode === "user";
  return /front|facetime|user|前面|内側|インカメラ/i.test(label);
}
