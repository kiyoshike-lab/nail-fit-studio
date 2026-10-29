"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BeforeAfter } from "./BeforeAfter";
import { BottomNavigation } from "./BottomNavigation";
import { CameraDeviceSelector } from "./CameraDeviceSelector";
import { DesignSelector } from "./DesignSelector";
import { NailPreview } from "./NailPreview";
import { PhotoUploader } from "./PhotoUploader";
import { SavePanel } from "./SavePanel";
import { SettingsPanel } from "./SettingsPanel";
import { defaultDesign, defaultPhotoNails } from "@/lib/defaults";
import { drawNails } from "@/lib/nailRenderer";
import { trackingOpacity } from "@/lib/trackingQuality";
import { applyCalibration, calibrateNail, defaultCalibration, sanitizeCalibration } from "@/lib/nailCalibration";
import { neutralLighting, sampleSceneLighting } from "@/lib/sceneLighting";
import { containRect } from "@/lib/previewGeometry";
import { naturalNailLength } from "@/lib/naturalNailLength";
import { assetPath, loadDesignPresets } from "@/lib/presets";
import { readJson, writeJson } from "@/lib/storage";
import { detectHandNails, resetHandTrackingEngine, startHandTracking, type HandDetectionState, type HandTracker } from "@/lib/handTracking";
import { trackEvent } from "@/lib/analytics";
import { initializeTrackerSafely } from "@/lib/trackingFallback";
import { createLocalId, STORAGE_KEYS } from "@/lib/storage";
import {
  cameraErrorMessage,
  getCameraStreamWithFallback,
  includesCamera,
  isLiveCameraStream,
  listVideoInputs,
  shouldDeferDeviceChange,
  shouldFallbackFromSelectedCamera,
  shouldMirrorCamera,
  waitForVideoReady,
  type CameraInput,
} from "@/lib/cameraDevices";
import type { DesignPreset, NailDesign, NailPose, SavedNailLook, SourceMode, TryOnHistory } from "@/lib/types";

const DESIGN_KEY = "nail-fit-studio-next.design.v1";
const NAILS_KEY = "nail-fit-studio-next.nails.v1";
// Corrections tuned against the old geometry must not offset a newly fitted
// image boundary. Keep the v1 data intact; new manual adjustments use v2.
const CALIBRATION_KEY = "nail-fit-studio-next.calibration.v2";

export function NailStudio() {
  const [mode, setMode] = useState<SourceMode>("empty");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [status, setStatus] = useState("写真かカメラを入れると、ここに試着が表示されます。");
  const [design, setDesign] = useState<NailDesign>(() => readJson(DESIGN_KEY, defaultDesign));
  const [nails, setNails] = useState<NailPose[]>(() => readJson(NAILS_KEY, defaultPhotoNails));
  const [selectedFinger, setSelectedFinger] = useState(1);
  const [presets, setPresets] = useState<DesignPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | undefined>();
  const [before, setBefore] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [cameraMirrored, setCameraMirrored] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<CameraInput[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => readJson(STORAGE_KEYS.cameraDevice, ""));
  const [trackingState, setTrackingState] = useState<"idle" | "starting" | "active" | "failed">("idle");
  const [detectionState, setDetectionState] = useState<HandDetectionState>("searching");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const drawIdRef = useRef(0);
  const paintedFramesRef = useRef(0);
  const lostFramesRef = useRef(0);
  const hasTrackingPoseRef = useRef(false);
  const baseTrackedNailsRef = useRef<NailPose[]>([]);
  const liveNailsRef = useRef<NailPose[] | null>(null);
  const lastDetectedAtRef = useRef(-Infinity);
  const lastTrackingUiAtRef = useRef(0);
  const [initialCalibration] = useState(() => sanitizeCalibration(readJson(CALIBRATION_KEY, defaultCalibration())));
  const calibrationRef = useRef(initialCalibration);
  const photoRequestRef = useRef(0);
  const naturalLengthRef = useRef(naturalNailLength(design.naturalNailLength));
  const lightingRef = useRef(neutralLighting);
  const lightingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastLightingAtRef = useRef(0);
  const drawPreviewRef = useRef<() => Promise<boolean>>(async () => false);
  const selectedDeviceIdRef = useRef(selectedDeviceId);
  const activeDeviceIdRef = useRef("");
  const cameraRequestRef = useRef(0);
  const trackingRequestRef = useRef(0);
  const cameraStartingRef = useRef(false);
  const cameraProtectionUntilRef = useRef(0);
  const deviceChangeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    loadDesignPresets().then(setPresets).catch(() => setPresets([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shape = params.get("shape") as NailDesign["shape"] | null;
    const pattern = params.get("pattern") as NailDesign["pattern"] | null;
    const color = params.get("color");
    const length = params.get("length");
    const naturalLength = params.get("naturalNailLength");
    if (!shape && !pattern && !color && !length && !naturalLength) return;
    const timer = window.setTimeout(() => {
      setDesign((current) => ({
        ...current,
        ...(shape ? { shape } : {}),
        ...(pattern ? { pattern } : {}),
        ...(color && /^#[0-9a-f]{6}$/i.test(color) ? { color } : {}),
        ...(length ? { length: length === "short" ? .84 : length === "long" ? 1.55 : 1.08 } : {}),
        ...(naturalLength ? { naturalNailLength: naturalNailLength(naturalLength) } : {}),
      }));
      setStatus("診断・保存した条件を試着画面へ反映しました。写真を選んで確認してください。");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => writeJson(DESIGN_KEY, design), [design]);
  useEffect(() => { naturalLengthRef.current = naturalNailLength(design.naturalNailLength); }, [design.naturalNailLength]);
  useEffect(() => {
    if (mode !== "photo") return;
    const timer = window.setTimeout(() => writeJson(NAILS_KEY, nails), 400);
    return () => window.clearTimeout(timer);
  }, [mode, nails]);
  useEffect(() => { selectedDeviceIdRef.current = selectedDeviceId; }, [selectedDeviceId]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? "" : current)), 2600);
  }, []);

  const drawPreview = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(dpr, 1280 / Math.max(rect.width, rect.height, 1));
    const width = Math.max(1, Math.round(rect.width * scale));
    const height = Math.max(1, Math.round(rect.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const drawId = ++drawIdRef.current;
    const visibleNails = mode === "camera" ? liveNailsRef.current ?? nails : nails;
    const now = performance.now();
    if (now - lastLightingAtRef.current >= 250 && visibleNails.length) {
      lastLightingAtRef.current = now;
      const source = mode === "camera" ? videoRef.current : imageRef.current;
      const sourceWidth = mode === "camera" ? videoRef.current?.videoWidth : imageRef.current?.naturalWidth;
      const sourceHeight = mode === "camera" ? videoRef.current?.videoHeight : imageRef.current?.naturalHeight;
      if (source && sourceWidth && sourceHeight) {
        const lightingCanvas = lightingCanvasRef.current ?? document.createElement("canvas");
        lightingCanvasRef.current = lightingCanvas;
        lightingCanvas.width = lightingCanvas.height = 24;
        const lightingContext = lightingCanvas.getContext("2d", { willReadFrequently: true });
        const xs = visibleNails.map((nail) => mode === "camera" && cameraMirrored ? 100 - nail.x : nail.x);
        const ys = visibleNails.map((nail) => nail.y);
        const x = Math.max(0, Math.min(...xs) - 4) / 100 * sourceWidth;
        const y = Math.max(0, Math.min(...ys) - 4) / 100 * sourceHeight;
        if (lightingContext) lightingRef.current = sampleSceneLighting(lightingContext, source, {
          x, y,
          width: Math.max(1, Math.min(sourceWidth - x, (Math.max(...xs) - Math.min(...xs) + 8) / 100 * sourceWidth)),
          height: Math.max(1, Math.min(sourceHeight - y, (Math.max(...ys) - Math.min(...ys) + 8) / 100 * sourceHeight)),
        }, lightingRef.current);
      }
    }
    if (!before && mode !== "empty") {
      return drawNails(ctx, width, height, visibleNails, design, {
        clear: true,
        isCurrent: () => drawId === drawIdRef.current,
        opacity: mode === "camera" && trackingState !== "failed"
          ? (hasTrackingPoseRef.current ? trackingOpacity(now - lastDetectedAtRef.current) : 0) : 1,
        lighting: lightingRef.current,
        waitForTexture: mode !== "camera",
        viewport: mode === "camera"
          ? containRect(videoRef.current?.videoWidth ?? 0, videoRef.current?.videoHeight ?? 0, width, height)
          : containRect(imageRef.current?.naturalWidth ?? 0, imageRef.current?.naturalHeight ?? 0, width, height),
      }).then((didPaint) => {
        if (didPaint && mode === "camera") paintedFramesRef.current += 1;
        return didPaint;
      });
    } else {
      ctx.clearRect(0, 0, width, height);
      return true;
    }
  }, [before, cameraMirrored, design, mode, nails, trackingState]);

  useEffect(() => {
    drawPreviewRef.current = drawPreview;
    void drawPreview().catch((error) => debugCamera("Canvas drawing failed", error));
    return () => { drawIdRef.current += 1; };
  }, [drawPreview]);

  useEffect(() => {
    if (mode !== "camera") return;
    let frame = 0;
    let lastDraw = -Infinity;
    let pending = false;
    let stopped = false;
    let lastLog = performance.now();
    let lastPainted = paintedFramesRef.current;
    const paint = (now: number) => {
      if (stopped) return;
      if (!pending && now - lastDraw >= 1000 / 30) {
        pending = true;
        lastDraw = now;
        void drawPreviewRef.current()
          .catch((error) => debugCamera("Canvas drawing failed", error))
          .finally(() => { pending = false; });
      }
      if (now - lastLog >= 2000) {
        debugCamera("Canvas performance", { drawFps: (paintedFramesRef.current - lastPainted) * 1000 / (now - lastLog) });
        lastPainted = paintedFramesRef.current;
        lastLog = now;
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      drawIdRef.current += 1;
    };
  }, [mode]);

  useEffect(() => {
    const onResize = () => void drawPreviewRef.current().catch((error) => debugCamera("Canvas drawing failed", error));
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    if (canvasRef.current) observer?.observe(canvasRef.current);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const releaseCamera = useCallback((reason = "release-camera") => {
    const stream = streamRef.current;
    const currentTrack = stream?.getVideoTracks()[0];
    debugCamera("Releasing camera", {
      reason,
      streamActive: streamRef.current?.active ?? false,
      trackReadyState: currentTrack?.readyState ?? "none",
      activeDeviceId: activeDeviceIdRef.current,
    });
    trackingRequestRef.current += 1;
    photoRequestRef.current += 1;
    trackerRef.current?.stop();
    trackerRef.current = null;
    streamRef.current = null;
    activeDeviceIdRef.current = "";
    if (videoRef.current) videoRef.current.srcObject = null;
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const stopCamera = useCallback((message = "カメラを停止しました。", reason = "user-stop") => {
    cameraStartingRef.current = false;
    cameraProtectionUntilRef.current = 0;
    if (deviceChangeTimerRef.current !== null) {
      window.clearTimeout(deviceChangeTimerRef.current);
      deviceChangeTimerRef.current = null;
    }
    cameraRequestRef.current += 1;
    releaseCamera(reason);
    setMode("empty");
    setCameraMirrored(false);
    setTrackingState("idle");
    setDetectionState("searching");
    setStatus(message);
  }, [releaseCamera]);

  const refreshCameraDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const inputs = listVideoInputs(await navigator.mediaDevices.enumerateDevices());
      setCameraDevices(inputs);
      return inputs;
    } catch {
      setCameraDevices([]);
      return [];
    }
  }, []);

  const startTrackingForCamera = useCallback(async (
    video: HTMLVideoElement,
    stream: MediaStream,
    mirrored: boolean,
  ) => {
    if (streamRef.current !== stream || !stream.active) return false;
    trackerRef.current?.stop();
    trackerRef.current = null;
    const trackingRequestId = ++trackingRequestRef.current;
    lostFramesRef.current = 0;
    hasTrackingPoseRef.current = false;
    baseTrackedNailsRef.current = [];
    liveNailsRef.current = null;
    lastDetectedAtRef.current = -Infinity;
    setTrackingState("starting");
    setDetectionState("searching");
    setStatus("カメラを使用中。自動認識を準備しています…");
    debugCamera("MediaPipe initialization start");

    const trackingFailed = (error: unknown) => {
      if (trackingRequestId !== trackingRequestRef.current || streamRef.current !== stream) return;
      trackerRef.current = null;
      hasTrackingPoseRef.current = false;
      setTrackingState("failed");
      setDetectionState("lost");
      setStatus("自動認識を利用できませんでした。爪を手動で調整できます。");
      notify("自動認識を利用できませんでした。手動調整を利用できます");
      debugCamera("Hand tracking stopped after repeated errors", error);
    };

    const result = await initializeTrackerSafely(
      () => startHandTracking(
        video,
        (tracked, detected) => {
          if (trackingRequestId !== trackingRequestRef.current || streamRef.current !== stream) return;
          if (detected && tracked.length) {
            lostFramesRef.current = 0;
            baseTrackedNailsRef.current = tracked;
            const aspect = video.videoWidth / video.videoHeight || 1;
            const adjusted = tracked.map((nail, index) => applyCalibration(nail, calibrationRef.current[index], aspect));
            liveNailsRef.current = adjusted;
            const now = performance.now();
            lastDetectedAtRef.current = now;
            if (!hasTrackingPoseRef.current || now - lastTrackingUiAtRef.current >= 150) {
              hasTrackingPoseRef.current = true;
              lastTrackingUiAtRef.current = now;
              setNails(adjusted);
              setStatus(adjusted.some((nail) => (nail.visibility ?? 1) > 0.05)
                ? "手を検出しました。見えている爪を追従しています。"
                : "手は認識しています。爪が隠れているか向きを確認できないため非表示です。手の甲を向けてください。");
            }
          } else {
            lostFramesRef.current += 1;
            if (lostFramesRef.current > 140) {
              setStatus("手を検出できません。手の甲を向け、指を少し開いてください。");
            }
          }
        },
        mirrored,
        trackingFailed,
        (state) => {
          if (trackingRequestId !== trackingRequestRef.current || streamRef.current !== stream) return;
          setDetectionState(state);
          if (state === "detected") {
            setStatus("手を検出しました。爪を追従しています。");
          } else if (state === "lost") {
            setStatus("手を見失いました。手全体を枠の中へ戻してください。");
          } else {
            setStatus("手を探しています…手の甲を向けて、指を少し開いてください。");
          }
        },
        () => naturalLengthRef.current,
      ),
      () => trackingRequestId === trackingRequestRef.current && streamRef.current === stream && stream.active,
    );

    if (result.status === "active") {
      trackerRef.current = result.tracker;
      setTrackingState("active");
      setStatus("手を探しています…手の甲を向けて、指を少し開いてください。");
      return true;
    }

    if (result.status === "failed" && trackingRequestId === trackingRequestRef.current && streamRef.current === stream) {
      trackingFailed(result.error);
      debugCamera("Hand tracking initialization failed", result.error);
    }
    return false;
  }, [notify]);

  const openCamera = useCallback(async (
    requestedDeviceId = selectedDeviceIdRef.current,
    requestedFacingMode: "user" | "environment" = facingMode,
  ) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "このブラウザではカメラを利用できません。写真をアップロードしてお試しください。";
      setStatus(message);
      notify(message);
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      const message = "カメラはHTTPSのページで利用できます。写真をアップロードして試すこともできます。";
      setStatus(message);
      notify(message);
      return;
    }

    const requestId = ++cameraRequestRef.current;
    cameraStartingRef.current = true;
    cameraProtectionUntilRef.current = Number.POSITIVE_INFINITY;
    if (deviceChangeTimerRef.current !== null) {
      window.clearTimeout(deviceChangeTimerRef.current);
      deviceChangeTimerRef.current = null;
    }
    setLoading(true);
    releaseCamera("switching-camera");
    setTrackingState("idle");
    setDetectionState("searching");
    let deviceId = requestedDeviceId;
    let trackingVideo: HTMLVideoElement | null = null;
    let trackingStream: MediaStream | null = null;
    let trackingMirrored = false;

    try {
      const availableBeforePermission = await refreshCameraDevices();
      const hasKnownIds = availableBeforePermission.some((device) => Boolean(device.deviceId));
      if (deviceId && hasKnownIds && !includesCamera(availableBeforePermission, deviceId)) {
        deviceId = "";
        selectedDeviceIdRef.current = "";
        setSelectedDeviceId("");
        writeJson(STORAGE_KEYS.cameraDevice, "");
      }

      let stream: MediaStream;
      try {
        stream = await getCameraStreamWithFallback(navigator.mediaDevices, deviceId, requestedFacingMode);
      } catch (error) {
        if (!deviceId || !shouldFallbackFromSelectedCamera(error)) throw error;
        deviceId = "";
        selectedDeviceIdRef.current = "";
        setSelectedDeviceId("");
        writeJson(STORAGE_KEYS.cameraDevice, "");
        stream = await getCameraStreamWithFallback(navigator.mediaDevices, "", requestedFacingMode);
      }

      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) throw new DOMException("Video track not found", "NotFoundError");
      streamRef.current = stream;
      const activeDeviceId = videoTrack.getSettings().deviceId || deviceId;
      activeDeviceIdRef.current = activeDeviceId;

      const devicesAfterPermission = await refreshCameraDevices();
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) streamRef.current = null;
        return;
      }
      const activeCamera = devicesAfterPermission.find((device) => device.deviceId === activeDeviceId);
      const activeLabel = activeCamera?.label || videoTrack.label || "使用中のカメラ";
      const mirrored = shouldMirrorCamera(
        activeLabel,
        Boolean(deviceId),
        requestedFacingMode,
        videoTrack.getSettings().facingMode,
      );
      setCameraMirrored(mirrored);

      if (activeDeviceId) {
        selectedDeviceIdRef.current = activeDeviceId;
        setSelectedDeviceId(activeDeviceId);
        writeJson(STORAGE_KEYS.cameraDevice, activeDeviceId);
      }

      videoTrack.addEventListener("ended", () => {
        if (streamRef.current !== stream) return;
        cameraStartingRef.current = false;
        cameraProtectionUntilRef.current = 0;
        if (deviceChangeTimerRef.current !== null) {
          window.clearTimeout(deviceChangeTimerRef.current);
          deviceChangeTimerRef.current = null;
        }
        cameraRequestRef.current += 1;
        releaseCamera("track-ended");
        selectedDeviceIdRef.current = "";
        setSelectedDeviceId("");
        writeJson(STORAGE_KEYS.cameraDevice, "");
        setMode("empty");
        setCameraMirrored(false);
        setTrackingState("idle");
        setStatus("カメラが切断されました。接続を確認して、使用するカメラを選び直してください。");
        notify("カメラが切断されました");
        void refreshCameraDevices();
      }, { once: true });

      const video = videoRef.current;
      if (!video) throw new Error("Video element is unavailable");
      video.srcObject = stream;
      await waitForVideoReady(video);
      await video.play();
      if (!video.videoWidth || !video.videoHeight) {
        throw new DOMException("Video dimensions are unavailable", "AbortError");
      }
      if (requestId !== cameraRequestRef.current || streamRef.current !== stream) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      cameraStartingRef.current = false;
      cameraProtectionUntilRef.current = Date.now() + 2000;
      setMode("camera");
      setPhotoUrl(undefined);
      setBefore(false);
      setStatus(`${activeLabel}を使用中。手を画面中央に入れてください。`);
      notify("カメラを起動しました");
      trackEvent("tryon_started", { source: "camera" });
      debugCamera("Camera ready", {
        activeLabel,
        deviceId: activeDeviceId,
        width: video.videoWidth,
        height: video.videoHeight,
        readyState: video.readyState,
      });
      trackingVideo = video;
      trackingStream = stream;
      trackingMirrored = mirrored;
    } catch (error) {
      if (requestId !== cameraRequestRef.current) return;
      cameraStartingRef.current = false;
      cameraProtectionUntilRef.current = 0;
      releaseCamera("camera-start-failed");
      setMode("empty");
      setCameraMirrored(false);
      setTrackingState("idle");
      const message = cameraErrorMessage(error, Boolean(deviceId));
      setStatus(message);
      notify(message);
    } finally {
      if (requestId === cameraRequestRef.current) {
        if (cameraStartingRef.current) {
          cameraStartingRef.current = false;
          cameraProtectionUntilRef.current = 0;
        }
        setLoading(false);
      }
    }

    if (trackingVideo && trackingStream && requestId === cameraRequestRef.current) {
      await startTrackingForCamera(trackingVideo, trackingStream, trackingMirrored);
    }
  }, [facingMode, notify, refreshCameraDevices, releaseCamera, startTrackingForCamera]);

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices) return;

    const inspectDevicesAfterChange = async () => {
      const devices = await refreshCameraDevices();
      const hasKnownIds = devices.some((device) => Boolean(device.deviceId));
      const stream = streamRef.current;
      const track = stream?.getVideoTracks()[0];
      const streamIsLive = isLiveCameraStream(stream);
      const selectedMissing = selectedDeviceIdRef.current && !includesCamera(devices, selectedDeviceIdRef.current);
      const activeMissing = activeDeviceIdRef.current && !includesCamera(devices, activeDeviceIdRef.current);

      debugCamera("devicechange evaluated", {
        cameraStarting: cameraStartingRef.current,
        protectionUntil: cameraProtectionUntilRef.current,
        streamActive: stream?.active ?? false,
        trackReadyState: track?.readyState ?? "none",
        selectedDeviceId: selectedDeviceIdRef.current,
        activeDeviceId: activeDeviceIdRef.current,
        selectedMissing: Boolean(selectedMissing),
        activeMissing: Boolean(activeMissing),
        enumeratedDeviceIds: devices.map((device) => device.deviceId),
      });

      if (shouldDeferDeviceChange(cameraStartingRef.current, cameraProtectionUntilRef.current)) return;
      if (!hasKnownIds) return;

      if (selectedMissing) {
        selectedDeviceIdRef.current = "";
        setSelectedDeviceId("");
        writeJson(STORAGE_KEYS.cameraDevice, "");
      }

      if (streamIsLive) {
        debugCamera("devicechange ignored because active track is live");
        return;
      }

      if (selectedMissing && !stream) {
        setStatus("前回選んだカメラが見つからないため、次回は標準カメラを使用します。");
      }

      // Device IDs can change after permission or USB re-enumeration. The track's
      // ended event is the authoritative disconnect signal and owns stream cleanup.
      debugCamera("devicechange did not stop camera; waiting for track-ended", {
        streamActive: stream?.active ?? false,
        trackReadyState: track?.readyState ?? "none",
      });
    };

    const handleDeviceChange = () => {
      const stream = streamRef.current;
      const track = stream?.getVideoTracks()[0];
      debugCamera("devicechange fired", {
        cameraStarting: cameraStartingRef.current,
        streamActive: stream?.active ?? false,
        trackReadyState: track?.readyState ?? "none",
        selectedDeviceId: selectedDeviceIdRef.current,
        activeDeviceId: activeDeviceIdRef.current,
      });

      if (cameraStartingRef.current) {
        void refreshCameraDevices().then((devices) => {
          debugCamera("devicechange ignored while camera is starting", {
            enumeratedDeviceIds: devices.map((device) => device.deviceId),
          });
        });
        return;
      }

      if (deviceChangeTimerRef.current !== null) window.clearTimeout(deviceChangeTimerRef.current);
      deviceChangeTimerRef.current = window.setTimeout(() => {
        deviceChangeTimerRef.current = null;
        void inspectDevicesAfterChange();
      }, 500);
    };

    const supportsDeviceEvents = typeof mediaDevices.addEventListener === "function";
    if (supportsDeviceEvents) {
      mediaDevices.addEventListener("devicechange", handleDeviceChange);
    } else {
      mediaDevices.ondevicechange = handleDeviceChange;
    }
    return () => {
      if (supportsDeviceEvents) {
        mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      } else if (mediaDevices.ondevicechange === handleDeviceChange) {
        mediaDevices.ondevicechange = null;
      }
      if (deviceChangeTimerRef.current !== null) {
        window.clearTimeout(deviceChangeTimerRef.current);
        deviceChangeTimerRef.current = null;
      }
    };
  }, [refreshCameraDevices]);

  useEffect(() => {
    return () => {
      cameraStartingRef.current = false;
      cameraProtectionUntilRef.current = 0;
      cameraRequestRef.current += 1;
      releaseCamera("component-unmount");
      resetHandTrackingEngine();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [releaseCamera]);

  const startCamera = useCallback(async () => {
    if (mode === "camera") {
      stopCamera("カメラを停止しました。", "user-stop");
      return;
    }
    await openCamera(selectedDeviceIdRef.current, facingMode);
  }, [facingMode, mode, openCamera, stopCamera]);

  const retryHandTracking = useCallback(async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (mode !== "camera" || !video || !stream?.active) {
      setStatus("カメラを起動してから、自動認識を再試行してください。");
      notify("カメラが必要です");
      return;
    }

    notify("自動認識を再試行します");
    resetHandTrackingEngine();
    await startTrackingForCamera(video, stream, cameraMirrored);
  }, [cameraMirrored, mode, notify, startTrackingForCamera]);

  const loadPhoto = useCallback(
    (url: string, fixedNails?: NailPose[]) => {
      stopCamera("カメラを停止しました。", "photo-upload");
      const photoRequestId = ++photoRequestRef.current;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (url.startsWith("blob:")) objectUrlRef.current = url;
      setPhotoUrl(url);
      setMode("photo");
      setBefore(false);
      // A saved position is not evidence that a nail is visible in a NEW photo.
      setNails(readJson<NailPose[]>(NAILS_KEY, defaultPhotoNails).map((nail) => ({
        ...nail, visibility: 0, visibilityState: "uncertain", clipContour: undefined, clipHoles: undefined,
      })));
      setStatus("写真を読み込みました。必要なら指ごとに微調整してください。");
      notify("写真を準備しました");
      trackEvent("photo_uploaded");
      if (fixedNails?.length === 5) {
        setNails(fixedNails);
        setLoading(false);
        setStatus("撮影時の爪位置と指別調整を引き継ぎました。自動補正で認識し直すこともできます。");
        return;
      }
      setLoading(true);
      setStatus("写真の手と爪位置を認識しています…");
      const detectionImage = new Image();
      detectionImage.onload = async () => {
        try {
          if (photoRequestId !== photoRequestRef.current) return;
          const detected = await detectHandNails(detectionImage, naturalLengthRef.current);
          if (photoRequestId !== photoRequestRef.current) return;
          if (detected.length) {
            setNails(detected);
            const visible = detected.some((nail) => (nail.visibility ?? 1) > 0.05);
            setStatus(visible
              ? "写真から手を認識し、見えている爪位置を自動配置しました。必要なら細かく調整できます。"
              : "手を認識し爪位置を自動配置しましたが、爪の可視性を確認できず非表示です。手の甲の写真か手動調整をお試しください。");
            notify(visible ? "見えている爪の位置を自動調整しました" : "爪を確認できないため非表示にしました");
          } else {
            setStatus("手を認識できませんでした。手全体が写り、指を少し開いた写真をお試しください。");
          }
        } catch {
          if (photoRequestId === photoRequestRef.current) setStatus("自動認識を利用できませんでした。手動調整で試着できます。");
        } finally {
          if (photoRequestId === photoRequestRef.current) setLoading(false);
        }
      };
      detectionImage.onerror = () => { if (photoRequestId === photoRequestRef.current) setLoading(false); };
      detectionImage.src = url;
    },
    [notify, stopCamera],
  );

  const loadSample = useCallback(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100" viewBox="0 0 900 1100">
      <rect width="900" height="1100" fill="#f7ede8"/>
      <path fill="#efc1a6" d="M255 1010c-22-140-20-260 5-356 20-77 47-172 72-273 8-34 22-53 44-53 25 0 39 18 39 52V190c0-32 16-48 39-48 24 0 40 16 40 48v174-211c0-31 17-48 40-48 25 0 41 18 41 48v225-176c0-31 17-47 39-47 24 0 40 17 40 47v216-130c0-31 16-48 39-48 24 0 40 18 40 48v241c0 85-22 161-60 243-36 77-79 155-101 238H255Z"/>
    </svg>`;
    // The illustration has no real nail boundary: keep its explicit demo poses,
    // without treating a saved pose as evidence on an uploaded photograph.
    loadPhoto(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, defaultPhotoNails.map((nail) => ({
      ...nail, visibility: 1, visibilityState: "manual", clipContour: undefined, clipHoles: undefined,
    })));
    setStatus("サンプルの手に仮配置しています。実際の爪認識結果ではありません。指ごとに調整できます。");
  }, [loadPhoto]);

  const updateDesign = useCallback((patch: Partial<NailDesign>) => {
    setActivePresetId(undefined);
    setDesign((current) => ({ ...current, ...patch }));
    if (patch.naturalNailLength !== undefined) {
      naturalLengthRef.current = naturalNailLength(patch.naturalNailLength);
      const image = imageRef.current;
      if (mode === "photo" && image?.naturalWidth) {
        const requestId = ++photoRequestRef.current;
        setLoading(true);
        setStatus("自爪の長さの目安を使って合わせ直しています…");
        void detectHandNails(image, naturalLengthRef.current).then((detected) => {
          if (requestId !== photoRequestRef.current) return;
          if (detected.length) {
            setNails(detected);
            setStatus("自爪の長さを合わせ直しました。根元を動かさず爪先方向へ調整できます。");
            notify("自爪の長さの目安を反映しました");
          } else {
            setStatus("手を認識できませんでした。指ごとの長さ調整も利用できます。");
          }
        }).catch(() => {
          if (requestId === photoRequestRef.current) notify("自動認識を利用できません。指ごとに長さを調整できます。");
        }).finally(() => {
          if (requestId === photoRequestRef.current) setLoading(false);
        });
      }
    }
  }, [mode, notify]);

  const selectPreset = useCallback((preset: DesignPreset) => {
    setActivePresetId(preset.id);
    setDesign((current) => ({
      ...current,
      color: preset.colorHint ?? current.color,
      material: preset.material ?? current.material,
      pattern: preset.pattern ?? current.pattern,
      finish: normalizeFinish(preset.finish) ?? current.finish,
      motif: preset.motif ?? current.motif,
      motifColor: preset.motifColor ?? current.motifColor,
      textureUrl: assetPath(preset.textureImage),
      realism: Math.max(current.realism, 0.84),
    }));
    trackEvent("nail_design_selected", { design_id: preset.id });
  }, []);

  const saveFavorite = useCallback(() => {
    if (mode === "empty") { notify("先に写真かカメラを入れてください"); return; }
    const favorite: SavedNailLook = { id: createLocalId("favorite"), designId: activePresetId, design, nails: mode === "camera" ? liveNailsRef.current ?? nails : nails, savedAt: new Date().toISOString() };
    const current = readJson<SavedNailLook[]>(STORAGE_KEYS.favorites, []);
    writeJson(STORAGE_KEYS.favorites, [favorite, ...current].slice(0, 50));
    notify("お気に入りに追加しました");
    trackEvent("favorite_added", { shape: design.shape, pattern: design.pattern });
  }, [activePresetId, design, mode, nails, notify]);

  const addHistory = useCallback((savedNails: NailPose[]) => {
    const now = new Date().toISOString();
    const item: TryOnHistory = { id: createLocalId("history"), designId: activePresetId, design, nails: savedNails, savedAt: now, createdAt: now };
    const current = readJson<TryOnHistory[]>(STORAGE_KEYS.history, []);
    writeJson(STORAGE_KEYS.history, [item, ...current].slice(0, 20));
  }, [activePresetId, design]);

  const updateNail = useCallback((index: number, patch: Partial<NailPose>) => {
    if (mode === "camera" && baseTrackedNailsRef.current[index]) {
      const current = liveNailsRef.current ?? nails;
      const target = { ...current[index], ...patch };
      const aspect = (videoRef.current?.videoWidth ?? 1) / (videoRef.current?.videoHeight || 1);
      calibrationRef.current[index] = calibrateNail(baseTrackedNailsRef.current[index], target, aspect);
      writeJson(CALIBRATION_KEY, calibrationRef.current);
      const adjusted = baseTrackedNailsRef.current.map((nail, finger) => applyCalibration(nail, calibrationRef.current[finger], aspect));
      liveNailsRef.current = adjusted;
      setNails(adjusted);
    } else {
      // A deliberate manual adjustment also cancels a pending photo result.
      photoRequestRef.current += 1;
      setLoading(false);
      setNails((current) => current.map((nail, finger) => finger === index
        ? { ...nail, ...patch, visibility: 1, visibilityState: "manual", clipContour: undefined, clipHoles: undefined } : nail));
    }
  }, [mode, nails]);

  const updateSelectedNail = useCallback((patch: Partial<NailPose>) => {
    updateNail(selectedFinger, patch);
  }, [selectedFinger, updateNail]);

  const autoFit = useCallback(async () => {
    if (mode === "empty") {
      setStatus("先に写真かカメラを入れてください。");
      notify("写真かカメラが必要です");
      return;
    }
    if (mode === "camera") {
      if (!baseTrackedNailsRef.current.length || performance.now() - lastDetectedAtRef.current > 300) {
        notify("手を認識できません。手全体を写し、指を少し開いてください。");
        if (trackingState === "failed") await retryHandTracking();
        return;
      }
      calibrationRef.current = defaultCalibration();
      writeJson(CALIBRATION_KEY, calibrationRef.current);
      liveNailsRef.current = baseTrackedNailsRef.current;
      setNails(baseTrackedNailsRef.current);
      setStatus("最新の手認識から爪位置を合わせ直しました。輪郭は推定のため、必要なら指ごとに調整してください。");
      notify("爪の位置を自動調整しました");
      return;
    }
    const image = imageRef.current;
    if (!image?.naturalWidth) { notify("写真の読み込みをお待ちください"); return; }
    const requestId = ++photoRequestRef.current;
    setLoading(true);
    try {
      const detected = await detectHandNails(image, naturalLengthRef.current);
      if (requestId !== photoRequestRef.current) return;
      if (!detected.length) {
        notify("爪を認識できませんでした。手動調整をお試しください。");
        return;
      }
      setNails(detected);
      const visible = detected.some((nail) => (nail.visibility ?? 1) > 0.05);
      if (!visible) setStatus("手は認識していますが爪を確認できないため非表示です。手の甲の写真か手動調整をお試しください。");
      notify(visible ? "爪の位置を自動調整しました" : "爪の可視性を確認できませんでした");
    } catch {
      if (requestId === photoRequestRef.current) notify("自動認識を利用できません。手動で調整できます。");
    } finally {
      if (requestId === photoRequestRef.current) setLoading(false);
    }
  }, [mode, notify, retryHandTracking, trackingState]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (mode !== "camera" || !video?.videoWidth) {
      notify("先にカメラを起動してください");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      notify("写真を作れませんでした");
      return;
    }
    if (cameraMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const capturedNails = performance.now() - lastDetectedAtRef.current < 300
      ? liveNailsRef.current ?? undefined : undefined;
    loadPhoto(canvas.toDataURL("image/jpeg", 0.94), capturedNails);
    notify("写真として固定しました");
  }, [cameraMirrored, loadPhoto, mode, notify]);

  const saveImage = useCallback(async () => {
    if (mode === "empty") {
      notify("先に写真かカメラを入れてください");
      return;
    }
    const source = mode === "camera" ? videoRef.current : imageRef.current;
    if (!source) {
      notify("保存できる画像がありません");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = mode === "camera" ? (source as HTMLVideoElement).videoWidth || 1280 : (source as HTMLImageElement).naturalWidth || 1080;
    canvas.height = mode === "camera" ? (source as HTMLVideoElement).videoHeight || 960 : (source as HTMLImageElement).naturalHeight || 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      notify("Canvasを作成できませんでした");
      return;
    }
    if (mode === "camera" && cameraMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    if (mode === "camera" && cameraMirrored) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    const savedNails = mode === "camera" ? liveNailsRef.current ?? nails : nails;
    try {
      await drawNails(ctx, canvas.width, canvas.height, savedNails, design, {
        lighting: lightingRef.current,
        opacity: mode === "camera" && trackingState !== "failed"
          ? (hasTrackingPoseRef.current ? trackingOpacity(performance.now() - lastDetectedAtRef.current) : 0) : 1,
      });
    } catch {
      notify("ネイル画像を作れませんでした。別のデザインで再試行してください。");
      return;
    }
    canvas.toBlob(async (blob) => {
      if (!blob) {
        notify("画像保存に失敗しました");
        return;
      }
      const file = new File([blob], "nail-fit-studio.png", { type: "image/png" });
      addHistory(savedNails);
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Nail Fit Studio" });
          notify("画像を保存/共有しました");
          trackEvent("tryon_shared");
          return;
        } catch {
          // User may cancel sharing; fall back to download link.
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "nail-fit-studio.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
      notify("画像を保存しました");
      trackEvent("tryon_saved");
    }, "image/png");
  }, [addHistory, cameraMirrored, design, mode, nails, notify, trackingState]);

  const selectCamera = useCallback(async (deviceId: string) => {
    selectedDeviceIdRef.current = deviceId;
    setSelectedDeviceId(deviceId);
    writeJson(STORAGE_KEYS.cameraDevice, deviceId);
    const label = cameraDevices.find((device) => device.deviceId === deviceId)?.label ?? "選択したカメラ";

    if (mode === "camera") {
      setStatus(`${label}へ切り替えています…`);
      await openCamera(deviceId, facingMode);
      return;
    }

    setStatus(`${label}を選択しました。カメラを起動すると使用します。`);
    notify(`${label}を選択しました`);
  }, [cameraDevices, facingMode, mode, notify, openCamera]);

  const switchCamera = useCallback(() => {
    const nextFacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacingMode);
    selectedDeviceIdRef.current = "";
    setSelectedDeviceId("");
    writeJson(STORAGE_KEYS.cameraDevice, "");

    if (mode === "camera") {
      setStatus(`${nextFacingMode === "environment" ? "外" : "内"}カメラへ切り替えています…`);
      void openCamera("", nextFacingMode);
      return;
    }

    setStatus(`${nextFacingMode === "environment" ? "外" : "内"}カメラを優先する設定にしました。`);
    notify("カメラ向きを切り替えました");
  }, [facingMode, mode, notify, openCamera]);

  const quality = useMemo(() => {
    if (mode === "empty") return "準備中";
    const avg = nails.reduce((sum, nail) => sum + (nail.confidence ?? 0.5), 0) / nails.length;
    if (mode === "camera" && detectionState !== "detected") return "手全体を写してください";
    return avg > 0.7 ? "爪位置を推定中・微調整できます" : "微調整推奨";
  }, [detectionState, mode, nails]);

  return (
    <div className="studio-shell">
      <header className="hero">
        <p className="eyebrow">Nail Fit Studio</p>
        <h1>気になるネイル、自分の手で試してみよう。</h1>
        <p>サロンに行く前に、似合う色・形・デザインを自宅でチェック。</p>
        <div className="quality-pill">{quality}</div>
      </header>

      <main className="studio-layout">
        <div className="control-column">
          <PhotoUploader onPhoto={loadPhoto} onSample={loadSample} onCamera={startCamera} onError={(message) => { setStatus(message); notify(message); }} />
          <CameraDeviceSelector
            devices={cameraDevices}
            selectedDeviceId={selectedDeviceId}
            disabled={loading}
            onChange={(deviceId) => { void selectCamera(deviceId); }}
          />
          <DesignSelector presets={presets} activePresetId={activePresetId} onSelectPreset={selectPreset} design={design} onDesign={updateDesign} />
          <SettingsPanel
            design={design}
            selectedFinger={selectedFinger}
            nail={nails[selectedFinger]}
            onDesign={updateDesign}
            onSelectFinger={setSelectedFinger}
            onNail={updateSelectedNail}
            onReset={() => { void autoFit(); }}
          />
          <BeforeAfter
            enabled={!before}
            onToggle={() => setBefore((value) => !value)}
            onHoldStart={() => setBefore(true)}
            onHoldEnd={() => setBefore(false)}
          />
          <SavePanel canSave={mode !== "empty"} onSave={saveImage} onCapture={capturePhoto} onAutoFit={autoFit} onFavorite={saveFavorite} isCamera={mode === "camera"} />
          <button type="button" className="secondary wide" onClick={switchCamera}>
            {facingMode === "user" ? "外カメラ優先にする" : "内カメラ優先にする"}
          </button>
        </div>

        <NailPreview
          mode={mode}
          photoUrl={photoUrl}
          status={status}
          loading={loading || trackingState === "starting"}
          trackingFailed={trackingState === "failed"}
          detectionState={detectionState}
          onRetryTracking={() => { void retryHandTracking(); }}
          imageRef={imageRef}
          videoRef={videoRef}
          canvasRef={canvasRef}
          mirrored={mode === "camera" && cameraMirrored}
          nails={nails}
          design={design}
          liveNailsRef={liveNailsRef}
          onSelectNail={setSelectedFinger}
          onMoveNail={(index, x, y) => updateNail(index, { x, y })}
          onImageError={() => {
            setMode("empty");
            setStatus("画像を読み込めませんでした。別の写真を選んでください。");
            notify("画像を読み込めませんでした");
          }}
        />
      </main>

      <BottomNavigation mode={mode} onCamera={startCamera} onAutoFit={autoFit} onSave={saveImage} onSettings={() => document.getElementById("settings-panel")?.scrollIntoView({ behavior: "smooth" })} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function normalizeFinish(value?: string): NailDesign["finish"] | undefined {
  if (value === "chrome" || value === "pearl" || value === "sparkle" || value === "sheer" || value === "gloss") return value;
  if (value === "glossy") return "gloss";
  if (value === "shimmer") return "pearl";
  return undefined;
}

function debugCamera(message: string, detail?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    if (detail === undefined) console.debug(`[Nail Fit Studio] ${message}`);
    else console.debug(`[Nail Fit Studio] ${message}`, detail);
  }
}
