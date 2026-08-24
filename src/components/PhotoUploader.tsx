"use client";

type Props = {
  onPhoto: (url: string) => void;
  onSample: () => void;
  onCamera: () => void;
  onError: (message: string) => void;
};

const supportedTypes = ["image/jpeg", "image/png", "image/webp"];

export function PhotoUploader({ onPhoto, onSample, onCamera, onError }: Props) {
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
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            if (!supportedTypes.includes(file.type)) {
              onError("画像を読み込めませんでした。JPEG、PNG、WebP画像をもう一度選択してください。");
              return;
            }
            if (file.size > 10 * 1024 * 1024) {
              onError("画像が10MBを超えています。少し小さい画像を選択してください。");
              return;
            }
            try {
              onPhoto(await resizePhoto(file));
            } catch {
              onError("画像を準備できませんでした。別の画像でもう一度お試しください。");
            }
          }}
        />
      </label>
      <button type="button" onClick={onSample}>
        サンプル写真で試す
      </button>
      <button type="button" className="secondary" onClick={onCamera}>
        カメラで試す
      </button>
      <p className="hint">きれいに試すコツ：手全体を写し、指を少し開いて、明るい場所で真上から撮影。</p>
    </section>
  );
}

async function resizePhoto(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const maxSide = 2200;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Image conversion failed")), "image/jpeg", .9));
  return URL.createObjectURL(blob);
}
