"use client";

type Props = {
  canSave: boolean;
  onSave: () => void;
  onCapture: () => void;
  onAutoFit: () => void;
  isCamera: boolean;
};

export function SavePanel({ canSave, onSave, onCapture, onAutoFit, isCamera }: Props) {
  return (
    <section className="panel-card" aria-labelledby="save-title">
      <details>
        <summary id="save-title">保存・仕上げ</summary>
        <div className="button-row">
          <button type="button" onClick={onAutoFit} disabled={!isCamera}>
            自動で爪に合わせる
          </button>
          <button type="button" onClick={onCapture} disabled={!isCamera}>
            写真として固定
          </button>
          <button type="button" onClick={onSave} disabled={!canSave}>
            画像を保存
          </button>
        </div>
        <p className="hint">生成AI仕上げは次の段階でAPI接続できます。今はVercelで動く基本試着を優先しています。</p>
      </details>
    </section>
  );
}
