"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readJson, STORAGE_KEYS, writeJson } from "@/lib/storage";
import type { SavedNailLook, TryOnHistory } from "@/lib/types";

type Props = { kind: "favorites" | "history" };

export function SavedLooks({ kind }: Props) {
  const key = kind === "favorites" ? STORAGE_KEYS.favorites : STORAGE_KEYS.history;
  const [items, setItems] = useState<(SavedNailLook | TryOnHistory)[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setItems(readJson(key, [])), 0);
    return () => window.clearTimeout(timer);
  }, [key]);

  function remove(id: string) {
    const next = items.filter((item) => item.id !== id);
    setItems(next); writeJson(key, next); setNotice("削除しました");
    window.setTimeout(() => setNotice(""), 2200);
  }

  if (!items.length) return <div className="empty-panel"><span aria-hidden>{kind === "favorites" ? "♡" : "◇"}</span><h2>{kind === "favorites" ? "まだお気に入りはありません" : "まだ試したネイルはありません"}</h2><p>{kind === "favorites" ? "気になるネイルを保存すると、ここからすぐ試せます。" : "試着した設定は、画像を保存したときにここへ残ります。"}</p><Link className="button primary" href="/try-on">{kind === "favorites" ? "ネイルを探す" : "最初のネイルを試す"}</Link></div>;

  return <><div className="saved-grid">{items.map((item) => { const params = new URLSearchParams({ shape:item.design.shape,color:item.design.color,pattern:item.design.pattern,length:item.design.length < .95 ? "short" : item.design.length > 1.35 ? "long" : "medium" }); return <article className="saved-card" key={item.id}><div className="saved-swatch" style={{background:`linear-gradient(145deg,#fff 0%,${item.design.color} 38%,${item.design.tipColor} 100%)`}}/><h2>{shapeName(item.design.shape)} × {patternName(item.design.pattern)}</h2><p>{new Date("createdAt" in item ? item.createdAt : item.savedAt).toLocaleDateString("ja-JP")}・{item.design.finish}</p><div className="saved-card-actions"><Link className="button primary" href={`/try-on?${params}`}>試す</Link><button type="button" className="secondary" onClick={() => remove(item.id)}>削除</button></div></article>; })}</div>{notice && <div className="toast" role="status">{notice}</div>}</>;
}

function shapeName(value:string){return ({natural:"ナチュラル",round:"ラウンド",oval:"オーバル",squoval:"スクオバル",almond:"アーモンド",coffin:"バレリーナ",square:"スクエア",stiletto:"スティレット"} as Record<string,string>)[value]??value}
function patternName(value:string){return ({solid:"ワンカラー",gradient:"グラデーション",french:"フレンチ",floral:"フラワー",marble:"マーブル",patterned:"アート"} as Record<string,string>)[value]??value}
