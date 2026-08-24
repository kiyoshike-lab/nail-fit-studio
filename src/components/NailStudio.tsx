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
import { assetPath, loadDesignPresets } from "@/lib/presets";
import { readJson, writeJson } from "@/lib/storage";
import { detectHandNails, resetHandTrackingEngine, startHandTracking, type HandTracker } from "@/lib/handTracking";
import { trackEvent } from "@/lib/analytics";
import { initializeTrackerSafely } from "@/lib/trackingFallback";
import { createLocalId, STORAGE_KEYS } from "@/lib/storage";
import {
  cameraErrorMessage,
  getCameraStreamWithFallback,
  includesCamera,
  listVideoInputs,
  shouldFallbackFromSelectedCamera,
  shouldMirrorCamera,
  waitForVideoReady,
  type CameraInput,
} from "@/lib/cameraDevices";
import type { DesignPreset, NailDesign, NailPose, SavedNailLook, SourceMode, TryOnHistory } from "@/lib/types";

const DESIGN_KEY = "nail-fit-studio-next.design.v1";
const NAILS_KEY = "nail-fit-studio-next.nails.v1";

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
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const drawIdRef = useRef(0);
  const lostFramesRef = useRef(0);
  const selectedDeviceIdRef = useRef(selectedDeviceId);
  const activeDeviceIdRef = useRef("");
  const cameraRequestRef = useRef(0);
  const trackingRequestRef = useRef(0);

  useEffect(() => {
    loadDesignPresets().then(setPresets).catch(() => setPresets([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shape = params.get("shape") as NailDesign["shape"] | null;
    const pattern = params.get("pattern") as NailDesign["pattern"] | null;
    const color = params.get("color");
    const length = params.get("length");
    if (!shape && !pattern && !color && !length) return;
    const timer = window.setTimeout(() => {
      setDesign((current) => ({
        ...current,
        ...(shape ? { shape } : {}),
        ...(pattern ? { pattern } : {}),
        ...(color && /^#[0-9a-f]{6}$/i.test(color) ? { color } : {}),
        ...(length ? { length: length === "short" ? .84 : length === "long" ? 1.55 : 1.08 } : {}),
      }));
      setStatus("診断・保存した条件を試着画面へ反映しました。写真を選んで確認してください。");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => writeJson(DESIGN_KEY, design), [design]);
  useEffect(() => writeJson(NAILS_KEY, nails), [nails]);
  useEffect(() => { selectedDeviceIdRef.current = selectedDeviceId; }, [selectedDeviceId]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? "" : current)), 2600);
  }, []);

  const drawPreview = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.round(rect.width * dpr));
    const height = Math.max(240, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const drawId = ++drawIdRef.current;
    ctx.clearRect(0, 0, width, height);
    if (!before && mode !== "empty") {
      await drawNails(ctx, width, height, nails, design);
      if (drawId !== drawIdRef.current) return;
    }
  }, [before, design, mode, nails]);

  useEffect(() => {
    void drawPreview();
  }, [drawPreview]);

  useEffect(() => {
    const onResize = () => void drawPreview();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [drawPreview]);

  const releaseCamera = useCallback(() => {
    trackingRequestRef.current += 1;
    trackerRef.current?.stop();
    trackerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    activeDeviceIdRef.current = "";
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopCamera = useCallback((message = "カメラを停止しました。") => {
    cameraRequestRef.current += 1;
    releaseCamera();
    setMode("empty");
    setCameraMirrored(false);
    setTrackingState("idle");
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
    setTrackingState("starting");
    setStatus("カメラを使用中。自動認識を準備しています…");
    debugCamera("MediaPipe initialization start");

    const trackingFailed = (error: unknown) => {
      if (trackingRequestId !== trackingRequestRef.current || streamRef.current !== stream) return;
      trackerRef.current = null;
      setTrackingState("failed");
      setStatus("自動認識を利用できませんでした。爪を手動で調整できます。");
      notify("自動認識を利用できませんでした。手動調整を利用できます");
      debugCamera("Hand tracking stopped after repeated errors", error);
    };

    const result = await initializeTrackerSafely(
      () => startHandTracking(
        video,
        (tracked, detected) => {
          if (detected && tracked.length) {
            lostFramesRef.current = 0;
            setNails((current) => blendNails(current, tracked, 0.42));
            setStatus("爪を追従中。ズレたら自動補正か指ごとの微調整を使えます。");
          } else {
            lostFramesRef.current += 1;
            setStatus(
              lostFramesRef.current > 18
                ? "手全体が写るようにして、指を少し開き、明るい場所で撮影してください。"
                : "手を認識しています…画面中央に手を入れてください。",
            );
          }
        },
        mirrored,
        trackingFailed,
      ),
      () => trackingRequestId === trackingRequestRef.current && streamRef.current === stream && stream.active,
    );

    if (result.status === "active") {
      trackerRef.current = result.tracker;
      setTrackingState("active");
      setStatus("自動認識を開始しました。手を画面中央に入れてください。");
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
    setLoading(true);
    releaseCamera();
    setTrackingState("idle");
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
        cameraRequestRef.current += 1;
        releaseCamera();
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
      releaseCamera();
      setMode("empty");
      setCameraMirrored(false);
      setTrackingState("idle");
      const message = cameraErrorMessage(error, Boolean(deviceId));
      setStatus(message);
      notify(message);
    } finally {
      if (requestId === cameraRequestRef.current) setLoading(false);
    }

    if (trackingVideo && trackingStream && requestId === cameraRequestRef.current) {
      await startTrackingForCamera(trackingVideo, trackingStream, trackingMirrored);
    }
  }, [facingMode, notify, refreshCameraDevices, releaseCamera, startTrackingForCamera]);

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices) return;

    const handleDeviceChange = async () => {
      const devices = await refreshCameraDevices();
      const hasKnownIds = devices.some((device) => Boolean(device.deviceId));
      if (!hasKnownIds) return;
      const selectedMissing = selectedDeviceIdRef.current && !includesCamera(devices, selectedDeviceIdRef.current);
      const activeMissing = activeDeviceIdRef.current && !includesCamera(devices, activeDeviceIdRef.current);
      if (!selectedMissing && !activeMissing) return;

      selectedDeviceIdRef.current = "";
      setSelectedDeviceId("");
      writeJson(STORAGE_KEYS.cameraDevice, "");
      if (streamRef.current || activeMissing) {
        stopCamera("カメラが切断されました。接続を確認して、別のカメラを選択してください。");
        notify("カメラが切断されました");
      } else {
        setStatus("前回選んだカメラが見つからないため、次回は標準カメラを使用します。");
      }
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
      cameraRequestRef.current += 1;
      releaseCamera();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [notify, refreshCameraDevices, releaseCamera, stopCamera]);

  const startCamera = useCallback(async () => {
    if (mode === "camera") {
      stopCamera();
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
    (url: string) => {
      stopCamera();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (url.startsWith("blob:")) objectUrlRef.current = url;
      setPhotoUrl(url);
      setMode("photo");
      setBefore(false);
      setNails(readJson(NAILS_KEY, defaultPhotoNails));
      setStatus("写真を読み込みました。必要なら指ごとに微調整してください。");
      notify("写真を準備しました");
      trackEvent("photo_uploaded");
      setLoading(true);
      setStatus("写真の手と爪位置を認識しています…");
      const detectionImage = new Image();
      detectionImage.onload = async () => {
        try {
          const detected = await detectHandNails(detectionImage);
          if (detected.length) {
            setNails(detected);
            setStatus("写真から手を認識し、爪位置を自動配置しました。必要なら細かく調整できます。");
            notify("爪の位置を自動調整しました");
          } else {
            setStatus("手を認識できませんでした。手全体が写り、指を少し開いた写真をお試しください。");
          }
        } catch {
          setStatus("自動認識を利用できませんでした。手動調整で試着できます。");
        } finally {
          setLoading(false);
        }
      };
      detectionImage.onerror = () => setLoading(false);
      detectionImage.src = url;
    },
    [notify, stopCamera],
  );

  const loadSample = useCallback(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100" viewBox="0 0 900 1100">
      <rect width="900" height="1100" fill="#f7ede8"/>
      <path fill="#efc1a6" d="M255 1010c-22-140-20-260 5-356 20-77 47-172 72-273 8-34 22-53 44-53 25 0 39 18 39 52V190c0-32 16-48 39-48 24 0 40 16 40 48v174-211c0-31 17-48 40-48 25 0 41 18 41 48v225-176c0-31 17-47 39-47 24 0 40 17 40 47v216-130c0-31 16-48 39-48 24 0 40 18 40 48v241c0 85-22 161-60 243-36 77-79 155-101 238H255Z"/>
    </svg>`;
    loadPhoto(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  }, [loadPhoto]);

  const updateDesign = useCallback((patch: Partial<NailDesign>) => {
    setActivePresetId(undefined);
    setDesign((current) => ({ ...current, ...patch }));
  }, []);

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
    const favorite: SavedNailLook = { id: createLocalId("favorite"), designId: activePresetId, design, nails, savedAt: new Date().toISOString() };
    const current = readJson<SavedNailLook[]>(STORAGE_KEYS.favorites, []);
    writeJson(STORAGE_KEYS.favorites, [favorite, ...current].slice(0, 50));
    notify("お気に入りに追加しました");
    trackEvent("favorite_added", { shape: design.shape, pattern: design.pattern });
  }, [activePresetId, design, mode, nails, notify]);

  const addHistory = useCallback(() => {
    const now = new Date().toISOString();
    const item: TryOnHistory = { id: createLocalId("history"), designId: activePresetId, design, nails, savedAt: now, createdAt: now };
    const current = readJson<TryOnHistory[]>(STORAGE_KEYS.history, []);
    writeJson(STORAGE_KEYS.history, [item, ...current].slice(0, 20));
  }, [activePresetId, design, nails]);

  const updateSelectedNail = useCallback(
    (patch: Partial<NailPose>) => {
      setNails((current) => current.map((nail, index) => (index === selectedFinger ? { ...nail, ...patch } : nail)));
    },
    [selectedFinger],
  );

  const autoFit = useCallback(() => {
    if (mode === "empty") {
      setStatus("先に写真かカメラを入れてください。");
      notify("写真かカメラが必要です");
      return;
    }
    setNails((current) =>
      current.map((nail, index) => ({
        ...nail,
        y: Math.max(0, nail.y - (index === 0 ? 1.6 : 1.1)),
        width: nail.width * (index === 0 ? 0.92 : 0.96),
        height: nail.height * (index === 0 ? 0.96 : 0.98),
      })),
    );
    setStatus("自動補正しました。長さを変えても根元が動かない描画にしています。");
    notify("爪の位置を自動調整しました");
  }, [mode, notify]);

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
    loadPhoto(canvas.toDataURL("image/jpeg", 0.94));
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
    await drawNails(ctx, canvas.width, canvas.height, nails, design);
    canvas.toBlob(async (blob) => {
      if (!blob) {
        notify("画像保存に失敗しました");
        return;
      }
      const file = new File([blob], "nail-fit-studio.png", { type: "image/png" });
      addHistory();
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
  }, [addHistory, cameraMirrored, design, mode, nails, notify]);

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
    return avg > 0.7 ? "追従安定" : "微調整推奨";
  }, [mode, nails]);

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
          onRetryTracking={() => { void retryHandTracking(); }}
          imageRef={imageRef}
          videoRef={videoRef}
          canvasRef={canvasRef}
          mirrored={mode === "camera" && cameraMirrored}
          nails={nails}
          onSelectNail={setSelectedFinger}
          onMoveNail={(index, x, y) => setNails((current) => current.map((nail, nailIndex) => nailIndex === index ? { ...nail, x, y } : nail))}
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

function blendNails(current: NailPose[], next: NailPose[], amount: number) {
  if (current.length !== next.length) return next;
  return current.map((nail, index) => ({
    ...nail,
    x: smooth(nail.x, next[index].x, amount),
    y: smooth(nail.y, next[index].y, amount),
    width: smooth(nail.width, next[index].width, amount),
    height: smooth(nail.height, next[index].height, amount),
    rotation: smoothAngle(nail.rotation, next[index].rotation, amount),
    confidence: next[index].confidence,
  }));
}

function smooth(current: number, target: number, amount: number) {
  return current + (target - current) * amount;
}

function smoothAngle(current: number, target: number, amount: number) {
  let delta = target - current;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return current + delta * amount;
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
