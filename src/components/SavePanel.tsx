"use client";

type Props = {
  canSave: boolean;
  onSave: () => void;
  onCapture: () => void;
  onAutoFit: () => void;
  onFavorite: () => void;
  isCamera: boolean;
};

export function SavePanel({ canSave, onSave, onCapture, onAutoFit, onFavorite, isCamera }: Props) {
  return (
    <section className="panel-card" aria-labelledby="save-title">
      <details>
        <summary id="save-title">保存・仕上げ</summary>
        <div className="button-row">
          <button type="button" onClick={onAutoFit} disabled={!canSave}>
            自動で爪に合わせる
          </button>
          <button type="button" onClick={onCapture} disabled={!isCamera}>
            写真として固定
          </button>
          <button type="button" onClick={onSave} disabled={!canSave}>
            画像を保存
          </button>
          <button type="button" className="secondary" onClick={onFavorite} disabled={!canSave}>
            お気に入りに追加
          </button>
        </div>
        <p className="hint">画像は端末へ保存します。お気に入りにはデザイン設定だけを保存し、手の写真は残しません。</p>
      </details>
    </section>
  );
}
