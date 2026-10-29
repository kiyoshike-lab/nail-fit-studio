"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { subscribeNailAlignmentDebug, type NailAlignmentFrame } from "@/lib/nailAlignmentDebug";
import { containRect } from "@/lib/previewGeometry";
import { nailCanvasGeometry } from "@/lib/nailPoseMetrics";
import { buildNailPath } from "@/lib/nailRenderer";
import type { NailDesign, NailPose, SourceMode } from "@/lib/types";

type Props = { mode: SourceMode; design: NailDesign; nails: NailPose[]; loading?: boolean; liveNailsRef?: RefObject<NailPose[] | null> };

export function NailAlignmentDebug({ mode, design, nails, loading, liveNailsRef }: Props) {
  const [enabled, setEnabled] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<NailAlignmentFrame | null>(null);
  const [summary, setSummary] = useState<NailAlignmentFrame | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let lastSummaryAt = -Infinity;
    return subscribeNailAlignmentDebug((frame) => {
      frameRef.current = frame;
      if (frame.timestamp - lastSummaryAt >= 250) {
        lastSummaryAt = frame.timestamp;
        setSummary(frame);
      }
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let lastDraw = -Infinity;
    const paint = (now: number) => {
      const canvas = canvasRef.current;
      const frame = frameRef.current;
      if (canvas && now - lastDraw > 100) {
        lastDraw = now;
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          if (frame && frame.sourceMode === mode && !loading) {
            const viewport = containRect(frame.sourceWidth, frame.sourceHeight, width, height);
            ctx.save();
            ctx.translate(viewport.x, viewport.y);
            ctx.lineWidth = dpr;
            for (const index of [4, 8, 12, 16, 20]) {
              const tip = frame.landmarks[index];
              dot(ctx, (frame.mirrored ? 1 - tip.x : tip.x) * viewport.width, tip.y * viewport.height, "#ff28cc", dpr * 3);
            }
            frame.coarse.forEach((nail) => pose(ctx, nail, viewport.width, viewport.height, "#ff9a00", "oval", 1));
            frame.refined.forEach((nail, index) => {
              if (!frame.fits[index]?.accepted) return;
              pose(ctx, nail, viewport.width, viewport.height, "#00d5ef", "oval", 1);
              for (const point of frame.fits[index].outline ?? []) dot(ctx, point.x / 100 * viewport.width, point.y / 100 * viewport.height, "#00d5ef", dpr);
            });
            frame.stable.forEach((nail) => pose(ctx, nail, viewport.width, viewport.height, "#79ff41", "oval", 1));
            const rendered = mode === "camera" ? liveNailsRef?.current ?? nails : nails;
            rendered.forEach((nail) => pose(ctx, nail, viewport.width, viewport.height, "#ffffff", design.shape, design.length));
            ctx.restore();
          }
        }
      }
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [design, enabled, loading, mode, nails, liveNailsRef]);

  if (process.env.NODE_ENV === "production") return null;
  return (
    <>
      <label style={{ position: "absolute", bottom: 10, left: 10, zIndex: 6, background: "#ffffffed", padding: "4px 8px", borderRadius: 8, fontSize: 11 }}>
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> 爪位置デバッグ
      </label>
      {enabled && <>
        <canvas ref={canvasRef} aria-label="開発用の爪位置比較" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }} />
        <div style={{ position: "absolute", top: 48, left: 8, right: 8, zIndex: 6, pointerEvents: "none", background: "#000b", color: "white", fontSize: 10, padding: 5, borderRadius: 6 }}>
          <span style={{ color: "#ff28cc" }}>●指先</span> / <span style={{ color: "#ff9a00" }}>橙:幾何推定</span> / <span style={{ color: "#00d5ef" }}>水色:画像補正</span> / <span style={{ color: "#79ff41" }}>緑:追尾後</span> / 白:手動補正・描画<br />
          点:中心 / 線の根元・先端:描画基準。画像補正が不確かな爪は水色を表示しません。
          {summary?.sourceMode === mode && <div>
            姿勢: {summary.pose?.view ?? "unknown"} / モデル左右ラベル: {summary.pose?.modelHand ?? "unknown"} / 表示反転: {summary.mirrored ? "あり" : "なし"}<br />
            3D: {summary.pose?.source} / 傾斜: {summary.pose?.tiltDegrees.toFixed(0)}° / 信頼度: {summary.pose?.confidence.toFixed(2)}
            {summary.visibility?.map((value, index) => <div key={index}>
              {["親指", "人差指", "中指", "薬指", "小指"][index]}: {value.state} / α{summary.stable[index]?.visibility?.toFixed(2) ?? "?"} / 曲げ {summary.pose?.fingers[index]?.bendDegrees.toFixed(0) ?? "?"}° / {value.reason} / 輪郭 {summary.fits[index]?.contourStatus ?? summary.fits[index]?.reason}
            </div>)}
          </div>}
        </div>
      </>}
    </>
  );
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, radius: number) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
}

function pose(ctx: CanvasRenderingContext2D, nail: NailPose, width: number, height: number, color: string, shape: NailDesign["shape"], length: number) {
  const scale = shape === "square" || shape === "squoval" ? 1.05 : shape === "coffin" ? 1.1 : 1;
  const geometry = nailCanvasGeometry(nail, width, height, length, scale);
  ctx.strokeStyle = color;
  ctx.save();
  ctx.translate(geometry.center.x, geometry.center.y);
  ctx.rotate(nail.rotation * Math.PI / 180);
  buildNailPath(ctx, geometry.width, geometry.height, shape);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();ctx.moveTo(geometry.root.x, geometry.root.y);ctx.lineTo(geometry.tip.x, geometry.tip.y);ctx.stroke();
  dot(ctx, geometry.center.x, geometry.center.y, color, 2);
  dot(ctx, geometry.root.x, geometry.root.y, color, 1.5);
}
