"use client";

type Props = {
  onPhoto: (url: string) => void;
  onSample: () => void;
  onCamera: () => void;
};

export function PhotoUploader({ onPhoto, onSample, onCamera }: Props) {
  return (
    <section className="panel-card intro-actions" aria-labelledby="start-title">
      <div>
        <p className="eyebrow">3 STEP</p>
        <h2 id="start-title">まず手の写真かカメラを入れてください</h2>
      </div>
      <label className="upload-button">
        写真を撮る / 選ぶ
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onPhoto(URL.createObjectURL(file));
          }}
        />
      </label>
      <button type="button" onClick={onSample}>
        サンプル写真で試す
      </button>
      <button type="button" className="secondary" onClick={onCamera}>
        カメラで試す
      </button>
    </section>
  );
}
