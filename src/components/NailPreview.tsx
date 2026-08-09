"use client";

import type { RefObject } from "react";
import type { SourceMode } from "@/lib/types";

type Props = {
  mode: SourceMode;
  photoUrl?: string;
  status: string;
  loading?: boolean;
  imageRef: RefObject<HTMLImageElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onImageError?: () => void;
};

export function NailPreview({ mode, photoUrl, status, loading, imageRef, videoRef, canvasRef, onImageError }: Props) {
  return (
    <section className="preview-card" aria-label="ネイル試着プレビュー">
      <div className="preview-header">
        <strong>プレビュー</strong>
        <span>{status}</span>
      </div>
      <div className="preview-stage">
        {mode === "empty" && (
          <div className="empty-state">
            <span>✋</span>
            <p>写真を選ぶか、カメラを起動してください。</p>
          </div>
        )}
        <img
          ref={imageRef}
          src={photoUrl}
          alt="手の写真"
          className={mode === "photo" ? "media-source" : "media-source is-hidden"}
          onError={onImageError}
        />
        <video ref={videoRef} autoPlay playsInline muted className={mode === "camera" ? "media-source" : "media-source is-hidden"} />
        <canvas ref={canvasRef} className="nail-canvas" />
        {loading && <div className="loading-badge">手を認識しています…</div>}
      </div>
    </section>
  );
}
