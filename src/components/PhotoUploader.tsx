"use client";

import { useEffect, useRef, useState } from "react";
import { preparePhoto } from "@/lib/photoPreparation";
import type { SourceMode } from "@/lib/types";

type Props = {
  sourceMode?: SourceMode;
  onPhoto: (url: string) => void;
  onSample: () => void;
  onCamera: () => void;
  onError: (message: string) => void;
  getSourceRevision: () => number;
};

const supportedTypes = ["image/jpeg", "image/png", "image/webp"];

export function PhotoUploader({ sourceMode, onPhoto, onSample, onCamera, onError, getSourceRevision }: Props) {
  const request = useRef(0);
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState("");
  useEffect(() => () => { request.current += 1; }, []);
  const cancelPreparation = () => { request.current += 1; setPreparing(false); setPhotoError(""); };
  const reportError = (message: string) => { setPhotoError(message); onError(message); };
  return (
    <section className="panel-card intro-actions" aria-labelledby="start-title">
      <div>
        <p className="eyebrow">使い方・3ステップ</p>
        <h2 id="start-title">{sourceMode === "photo" ? "別の写真でも試せます" : "手の写真かカメラで試してみましょう"}</h2>
      </div>
      <label className="upload-button">
        {sourceMode === "photo" ? "別の写真を撮る / 選ぶ" : "写真を撮る / 選ぶ"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            setPhotoError("");
            const id = ++request.current;
            const sourceRevision = getSourceRevision();
            const isCurrent = () => id === request.current && sourceRevision === getSourceRevision();
            setPreparing(false);
            if (!supportedTypes.includes(file.type)) {
              reportError("画像を読み込めませんでした。JPEG、PNG、WebP画像をもう一度選択してください。");
              return;
            }
            if (file.size > 10 * 1024 * 1024) {
              reportError("画像が10MBを超えています。少し小さい画像を選択してください。");
              return;
            }
            setPreparing(true);
            try {
              const url = await preparePhoto(file);
              if (!isCurrent()) { URL.revokeObjectURL(url); return; }
              onPhoto(url);
            } catch {
              if (isCurrent()) reportError("画像を準備できませんでした。別の画像でもう一度お試しください。");
            } finally {
              if (id === request.current) setPreparing(false);
            }
          }}
        />
      </label>
      {preparing && <p className="hint" role="status">画像を準備しています…</p>}
      {photoError && <p className="field-error photo-error" role="alert">{photoError}{sourceMode === "photo" ? "現在の写真はそのままです。" : "写真は送信されていません。"}</p>}
      <button type="button" onClick={() => { cancelPreparation(); onSample(); }}>
        サンプル写真で試す
      </button>
      <button type="button" className="secondary" onClick={() => { cancelPreparation(); onCamera(); }}>
        カメラで試す
      </button>
      <p className="hint">きれいに試すコツ：手全体を写し、指を少し開いて、明るい場所で真上から撮影。</p>
      <p className="hint">写真はJPEG・PNG・WebP、10MBまで。カメラはブラウザの許可が必要です。使えないときも写真から試せます。</p>
    </section>
  );
}
