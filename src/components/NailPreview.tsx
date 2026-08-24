"use client";

import { useRef, useState, type RefObject } from "react";
import type { SourceMode } from "@/lib/types";
import type { NailPose } from "@/lib/types";

type Props = {
  mode: SourceMode;
  photoUrl?: string;
  status: string;
  loading?: boolean;
  imageRef: RefObject<HTMLImageElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onImageError?: () => void;
  mirrored?: boolean;
  nails: NailPose[];
  onSelectNail: (index: number) => void;
  onMoveNail: (index: number, x: number, y: number) => void;
};

export function NailPreview({ mode, photoUrl, status, loading, imageRef, videoRef, canvasRef, onImageError, mirrored, nails, onSelectNail, onMoveNail }: Props) {
  const [aspectRatio, setAspectRatio] = useState("4 / 3");
  const dragRef = useRef<{ pointerId: number; index: number } | null>(null);

  function pointerPosition(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (mode === "empty") return;
    const point = pointerPosition(event);
    const nearest = nails.reduce((best, nail, nailIndex) => {
      const distance = Math.hypot(nail.x - point.x, nail.y - point.y);
      return distance < best.distance ? { index: nailIndex, distance } : best;
    }, { index: 0, distance: Number.POSITIVE_INFINITY });
    if (nearest.distance > 12) return;
    const index = nearest.index;
    dragRef.current = { pointerId: event.pointerId, index };
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectNail(index);
    onMoveNail(index, point.x, point.y);
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointerPosition(event);
    onMoveNail(drag.index, point.x, point.y);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }
  return (
    <section className="preview-card" aria-label="ネイル試着プレビュー">
      <div className="preview-header">
        <strong>プレビュー</strong>
        <span>{status}</span>
      </div>
      <div className="preview-stage" style={{ aspectRatio, touchAction: mode === "empty" ? "auto" : "none" }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
        {mode === "empty" && (
          <div className="empty-state">
            <span>✋</span>
            <p>写真を選ぶか、カメラを起動してください。</p>
          </div>
        )}
        {/* Blob/data URLs and a direct element ref are required for Canvas composition. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={photoUrl}
          alt="手の写真"
          className={mode === "photo" ? "media-source" : "media-source is-hidden"}
          onError={onImageError}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth && image.naturalHeight) setAspectRatio(`${image.naturalWidth} / ${image.naturalHeight}`);
          }}
        />
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`${mode === "camera" ? "media-source" : "media-source is-hidden"} ${mirrored ? "is-mirrored" : ""}`}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            if (video.videoWidth && video.videoHeight) setAspectRatio(`${video.videoWidth} / ${video.videoHeight}`);
          }}
        />
        <canvas ref={canvasRef} className="nail-canvas" />
        {loading && <div className="loading-badge">手を認識しています…</div>}
        {mode !== "empty" && <div className="drag-guide">爪をドラッグして微調整</div>}
      </div>
    </section>
  );
}
