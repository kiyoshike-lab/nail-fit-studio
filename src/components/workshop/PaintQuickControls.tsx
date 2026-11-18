"use client";
import { memo } from "react";
import { drawingTools, type DrawingTool, type PaintStyle } from "@/lib/paintTypes";

const tools = Object.entries(drawingTools);
type Props = { fingerName: string; tool: DrawingTool | "pan"; brush: PaintStyle; onTool: (tool: DrawingTool | "pan") => void; onBrush: (patch: Partial<PaintStyle>) => void };

// Stable props keep this palette out of the per-stroke document update path.
export const PaintQuickControls = memo(function PaintQuickControls({ fingerName, tool, brush, onTool, onBrush }: Props) {
  const selecting = tool === "select" || tool === "pan";
  return <div className="paint-quick-controls" role="group" aria-label="描画のクイック設定">
    <span className="paint-current-finger">編集中：{fingerName}（この指だけ）</span>
    <label>ツール<select aria-label="すぐ使うツール" value={tool} onChange={event => onTool(event.target.value as DrawingTool | "pan")}>
      {tools.map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="pan">表示を移動（描かない）</option>
    </select></label>
    <label>描画色<input aria-label="新しく描く色" type="color" value={brush.color} disabled={selecting || tool === "eraser"} onChange={event => onBrush({ color: event.target.value })}/></label>
    <label>太さ<input aria-label="線の太さ" type="range" min=".003" max=".3" step=".001" value={brush.lineWidth} disabled={selecting} onChange={event => onBrush({ lineWidth: Number(event.target.value) })}/></label>
  </div>;
});
