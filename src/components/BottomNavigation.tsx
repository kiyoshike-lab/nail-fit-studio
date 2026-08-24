"use client";

import type { SourceMode } from "@/lib/types";

type Props = {
  mode: SourceMode;
  onCamera: () => void;
  onAutoFit: () => void;
  onSave: () => void;
  onSettings: () => void;
};

export function BottomNavigation({ mode, onCamera, onAutoFit, onSave, onSettings }: Props) {
  const isCamera = mode === "camera";
  return (
    <nav className="bottom-nav" aria-label="スマホ用クイック操作">
      <button type="button" className={isCamera ? "is-active" : ""} onClick={onCamera}>
        {isCamera ? "止める" : "カメラ"}
      </button>
      <button type="button" onClick={onAutoFit} disabled={mode === "empty"}>
        自動補正
      </button>
      <button type="button" onClick={onSave} disabled={mode === "empty"}>
        保存
      </button>
      <button type="button" onClick={onSettings}>
        設定
      </button>
    </nav>
  );
}
