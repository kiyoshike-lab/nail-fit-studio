"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { diagnosisTryOnUrl, photoComparison, shapeNames } from "@/lib/nailDiagnosis";
import type { HandPhotoObservations } from "@/lib/handPhotoObservations";
import type { DiagnosisResult } from "@/lib/types";

export function DiagnosisPhotoReview({ result }: { result: DiagnosisResult }) {
  const [status, setStatus] = useState("");
  const [photo, setPhoto] = useState<HandPhotoObservations | null>(null);
  const [allowAnalysis, setAllowAnalysis] = useState(false);
  const ticket = useRef(0);
  useEffect(() => () => { ticket.current++; }, []);
  const variant = photo && photoComparison(result, photo);
  return <details className="panel-card diagnosis-photo-review">
    <summary>手の写真から別候補も見る（任意）</summary>
    <p className="hint">手の甲・手首・指先が入る明るい写真を選んでください。写真と分析結果は送信・保存せず、試着画面では写真を選び直します。</p>
    <p className="hint">写真は端末内で処理します。手認識に使うMediaPipeは、写真とは別に利用状況や処理性能の計測データをGoogleに送信する場合があります。<Link href="/privacy">取り扱いを見る</Link></p>
    <label className="photo-fit-toggle"><input type="checkbox" checked={allowAnalysis} onChange={event => {
      setAllowAnalysis(event.target.checked);
      if (!event.target.checked) { ticket.current++; setPhoto(null); setStatus(""); }
    }} />計測データの送信を了承して写真を分析する</label>
    {allowAnalysis && <label className="upload-button">比較用の手写真を選ぶ
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={async event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        const id = ++ticket.current;
        setPhoto(null);
        if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
          setStatus("10MB以下のJPEG・PNG・WebPを選んでください。"); return;
        }
        setStatus("写真の写り方を確認しています…");
        let url: string | undefined;
        try {
          const { preparePhoto } = await import("@/lib/photoPreparation");
          url = await preparePhoto(file);
          if (id !== ticket.current) return;
          const image = new Image();
          image.src = url;
          await image.decode();
          if (id !== ticket.current) return;
          const { inspectHandPhoto } = await import("@/lib/handTracking");
          if (id !== ticket.current) return;
          const observations = await inspectHandPhoto(image);
          if (id !== ticket.current) return;
          setPhoto(observations);
          setStatus(!observations ? "手を確認できませんでした。診断結果は写真なしで試せます。"
            : observations.view !== "back" ? "手の甲が正面から見える写真だと比較しやすくなります。" : "写真で確認できた項目だけを表示します。");
        } catch {
          if (id === ticket.current) setStatus("写真を分析できませんでした。別の写真を選ぶか、そのまま試着できます。");
        } finally {
          if (url) URL.revokeObjectURL(url);
        }
      }} />
    </label>}
    {status && <p role="status">{status}</p>}
    {photo?.view === "back" && <ul>
      <li>写真上の色の傾向：{photo.tone === "warm" ? "黄み寄り" : photo.tone === "cool" ? "青み寄り" : photo.tone === "neutral" ? "中間的" : "判定保留"}（照明で変わります）</li>
      <li>中指の見かけの長さ：{photo.fingerToPalm ? `手首から付け根までの約${photo.fingerToPalm.toFixed(1)}倍` : "判定保留"}</li>
      <li>爪の縦横比の目安：{photo.nailRatio ? `約${photo.nailRatio.toFixed(1)} : 1（境界が比較的明瞭な${photo.measuredNails}本）` : "判定保留"}</li>
    </ul>}
    {variant && <p>比較候補：{shapeNames[variant.shape]}・<span className="diagnosis-swatch" style={{ backgroundColor: variant.color }} /> {variant.color.toUpperCase()}。診断結果や写真を上書きしません。<br /><Link className="button ghost" href={diagnosisTryOnUrl(variant)}>写真を参考にした候補で試着</Link></p>}
  </details>;
}
