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

export function buildVideoConstraintCandidates(
  selectedDeviceId: string,
  facingMode: "user" | "environment",
): MediaTrackConstraints[] {
  const cameraConstraint = selectedDeviceId
    ? { deviceId: { exact: selectedDeviceId } }
    : { facingMode: { ideal: facingMode } };

  return [
    { ...cameraConstraint, width: { ideal: 1280 }, height: { ideal: 960 } },
    { ...cameraConstraint, width: { ideal: 1280 }, height: { ideal: 720 } },
    cameraConstraint,
  ];
}

export async function getCameraStreamWithFallback(
  mediaDevices: Pick<MediaDevices, "getUserMedia">,
  selectedDeviceId: string,
  facingMode: "user" | "environment",
) {
  const candidates = buildVideoConstraintCandidates(selectedDeviceId, facingMode);
  let lastError: unknown;

  for (let index = 0; index < candidates.length; index += 1) {
    try {
      return await mediaDevices.getUserMedia({ video: candidates[index], audio: false });
    } catch (error) {
      lastError = error;
      if (index === candidates.length - 1 || !shouldTryNextCameraConstraint(error)) throw error;
    }
  }

  throw lastError;
}

export function shouldTryNextCameraConstraint(error: unknown) {
  const name = getErrorName(error);
  return ["OverconstrainedError", "ConstraintNotSatisfiedError", "NotReadableError", "AbortError"].includes(name);
}

export function waitForVideoReady(video: HTMLVideoElement, timeoutMs = 5000) {
  if (video.readyState >= 1 && video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
    };
    const onReady = () => {
      if (!video.videoWidth || !video.videoHeight) return;
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new DOMException("Video metadata could not be loaded", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new DOMException("Video metadata timed out", "AbortError"));
    }, timeoutMs);

    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("canplay", onReady);
    video.addEventListener("error", onError, { once: true });
  });
}

export function cameraErrorMessage(error: unknown, selectedCamera = false) {
  const name = getErrorName(error);

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
  const name = getErrorName(error);
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

function getErrorName(error: unknown) {
  return error instanceof DOMException
    ? error.name
    : typeof error === "object" && error && "name" in error
      ? String(error.name)
      : "";
}
