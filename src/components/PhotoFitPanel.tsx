"use client";

import Link from "next/link";
import { useState } from "react";
import { designFromText } from "@/lib/designSuggestion";
import { readSavedLooks } from "@/lib/storage";
import { readWorkshopDraft, readWorkshopLibrary } from "@/lib/workshopData";
import type { DesignDocument } from "@/lib/workshopTypes";
import type { DesignPreset, NailDesign, SavedNailLook, SourceMode } from "@/lib/types";

type Props = {
  mode: SourceMode; enabled: boolean; busy: boolean; fitted: number;
  presets: DesignPreset[]; activePresetId?: string; artworkName?: string;
  onFit: (next: boolean) => void;
  onPreset: (preset: DesignPreset) => void;
  onText: (patch: Partial<NailDesign>) => void;
  onSaved: (selection: { document: DesignDocument } | { look: SavedNailLook }) => void;
};

type Entry = { label: string; document: DesignDocument } | { label: string; look: SavedNailLook };

function localChoices(): Entry[] {
  const library = readWorkshopLibrary(), draft = readWorkshopDraft().document;
  return [
    ...(draft ? [{ label: `制作中：${draft.name}`, document: draft }] : []),
    ...library.entries.map(({ document }) => ({ label: `作品：${document.name}`, document })),
    ...(["favorites","history"] as const).flatMap(kind => readSavedLooks(kind).map(look => ({
      label: `${kind === "favorites" ? "お気に入り" : "試着履歴"}：${look.artwork?.name && typeof look.artwork.name === "string" ? look.artwork.name.slice(0,80) : look.design.color}・${new Date(look.savedAt).toLocaleDateString("ja-JP")}`, look,
    }))),
  ];
}

export function PhotoFitPanel({ mode, enabled, busy, fitted, presets, activePresetId, artworkName, onFit, onPreset, onText, onSaved }: Props) {
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [choices, setChoices] = useState<Entry[]>([]);
  return <section className="panel-card photo-fit-panel" aria-labelledby="photo-fit-title">
    <h2 id="photo-fit-title">手写真でネイルを合わせる</h2>
    {mode === "empty" && <p className="hint">上の「写真を撮る / 選ぶ」で自分の手写真を選ぶと、デザインが反映されます。</p>}
    <details>
      <summary>はみ出しが気になるとき</summary>
      <label className="photo-fit-toggle"><input type="checkbox" checked={enabled} disabled={busy} onChange={event => onFit(event.target.checked)} />自爪の輪郭内に収める</label>
      <p className="hint">明瞭な輪郭だけを使います。はみ出しを抑える代わりに、爪先や一部の模様が欠ける場合があります。オフで通常の試着に戻ります。切り替えると爪位置を再推定します。</p>
      {mode === "photo" && enabled && !busy && <p className="hint">追加の輪郭マスク：{fitted}本。必要に応じて設定の「詳細調整」で1本ずつ微調整できます。</p>}
    </details>
    <details className="photo-design-picker" onToggle={event => { if (event.currentTarget.open) setChoices(localChoices()); }}>
      <summary>試すデザインを選ぶ</summary>
      <div className="field-grid">
        <label>テンプレートから選ぶ<select aria-label="テンプレートから選ぶ" value={activePresetId ?? ""} onChange={event => {
          const preset = presets.find(v=>v.id===event.target.value);
          if (preset) { onPreset(preset); setFeedback(`${preset.name}を反映しました。`); }
        }}><option value="" disabled>{presets.length ? "テンプレートを選択" : "利用できるテンプレートがありません"}</option>
          {presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select></label>
        <label>保存済み・制作中から選ぶ<select aria-label="保存済み・制作中から選ぶ" value="" onChange={event => {
          if (event.target.value === "") return;
          const choice = choices[Number(event.target.value)];
          if (choice) { onSaved(choice); setFeedback(""); }
        }}><option value="" disabled>{choices.length ? "この端末のデザインを選択" : "選べるデザインがまだありません"}</option>
          {choices.map((choice,index)=><option key={index} value={index}>{choice.label}</option>)}
        </select></label>
      </div>
      {artworkName && <p className="hint">編集中：{artworkName}。テンプレート・テキストで土台を変えても手描きとパーツは残ります。</p>}
      <form onSubmit={event => {
        event.preventDefault();
        const suggestion = designFromText(text);
        if (!suggestion) { setFeedback("色や質感を短く指定してください。例：ピンクのちゅるん、黒フレンチにラメ。デザインは変更していません。"); return; }
        onText(suggestion.patch);
        setFeedback(`反映した要素：${suggestion.matched.join("、")}。認識できる語だけを使った近似です。`);
      }}>
        <label>テキストで指定<input maxLength={160} value={text} placeholder="例：黒フレンチにシルバーラメ" onChange={event=>setText(event.target.value)} /></label>
        <button type="submit" className="secondary">テキスト指定を反映</button>
      </form>
      {feedback && <p role="status">{feedback}</p>}
      <p className="hint">自作ネイルはこの画面のエディターで編集できます。<Link href="/create" prefetch={false}>制作画面を開く</Link>と、今の写真は引き継ぎません。</p>
    </details>
  </section>;
}
