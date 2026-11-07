"use client";

import Image from "next/image";
import { assetPath } from "@/lib/presets";
import type { DesignPreset, NailDesign } from "@/lib/types";
import { resolveNailTextureUrl } from "@/lib/presetTexture";

type Props = {
  presets: DesignPreset[];
  activePresetId?: string;
  onSelectPreset: (preset: DesignPreset) => void;
  design: NailDesign;
  onDesign: (patch: Partial<NailDesign>) => void;
};

export function DesignSelector({ presets, activePresetId, onSelectPreset, design, onDesign }: Props) {
  const activePreset = presets.find(preset => preset.id === activePresetId)
    ?? presets.find(preset => design.textureUrl && assetPath(preset.textureImage) === resolveNailTextureUrl(design.textureUrl));
  return (
    <section className="panel-card" aria-labelledby="design-title">
      <details>
        <summary id="design-title">デザイン</summary>
        <div className="field-grid">
          <label>
            カラー
            <input type="color" value={design.color} onChange={(event) => onDesign({ color: event.target.value })} />
          </label>
          <label>
            形
            <select value={design.shape} onChange={(event) => onDesign({ shape: event.target.value as NailDesign["shape"] })}>
              <option value="natural">ナチュラル</option>
              <option value="round">ラウンド</option>
              <option value="oval">オーバル</option>
              <option value="squoval">スクオバル</option>
              <option value="almond">アーモンド</option>
              <option value="coffin">バレリーナ</option>
              <option value="square">スクエア</option>
              <option value="stiletto">スティレット</option>
            </select>
          </label>
          <label>
            仕上げ
            <select value={design.finish} onChange={(event) => onDesign({ finish: event.target.value as NailDesign["finish"] })}>
              <option value="gloss">つや</option>
              <option value="sheer">透明感</option>
              <option value="pearl">パール</option>
              <option value="chrome">ミラー</option>
              <option value="sparkle">ラメ</option>
            </select>
          </label>
          <label>
            素材感
            <select value={design.material} onChange={(event) => onDesign({ material: event.target.value as NailDesign["material"] })}>
              <option value="cream">クリーム</option>
              <option value="sheer">シアー</option>
              <option value="jelly">ちゅるん</option>
              <option value="glitter">ラメ</option>
              <option value="shimmer">微粒子ラメ</option>
              <option value="metallic">メタリック</option>
            </select>
          </label>
          <label>
            模様
            <select value={design.pattern} onChange={(event) => onDesign({ pattern: event.target.value as NailDesign["pattern"] })}>
              <option value="solid">ワンカラー</option>
              <option value="gradient">グラデーション</option>
              <option value="french">爪先カラー</option>
              <option value="floral">小さな模様</option>
              <option value="patterned">実写柄</option>
            </select>
          </label>
          <label>
            爪先カラー
            <input type="color" value={design.tipColor} onChange={(event) => onDesign({ tipColor: event.target.value, pattern: "french" })} />
          </label>
          <label>
            模様の色
            <input type="color" value={design.motifColor} onChange={(event) => onDesign({ motifColor: event.target.value })} />
          </label>
        </div>

        <div className="preset-header">
          <strong>実写プリセット</strong>
          <span>{presets.length}設定</span>
        </div>
        <p className="hint">写真の爪1本から作った素材です。形・長さを変えられます。色・模様・仕上げを変更すると写真素材を外して編集します。</p>
        {activePreset?.author && <p className="hint" aria-live="polite">
          選択中：{activePreset.name}。写真：{activePreset.author} / {" "}
          <a href={activePreset.sourceUrl} target="_blank" rel="noopener noreferrer">元画像</a> / {" "}
          <a href={activePreset.licenseUrl} target="_blank" rel="noopener noreferrer">{activePreset.license}</a>。
          爪の切り抜き・回転・表面変形を行っています。画像を公開・再配布するときは出典と変更内容を明示し、素材のライセンス条件を確認してください。
        </p>}
        <p className="hint"><a href="/assets/preset-materials-v2.json" target="_blank" rel="noopener noreferrer">実写素材の全出典・作者・ライセンス</a></p>
        <div className="preset-grid">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className={`preset-card ${activePresetId === preset.id ? "is-selected" : ""}`}
              onClick={() => onSelectPreset(preset)}
              aria-label={`${preset.name}を選ぶ`}
              aria-pressed={activePresetId === preset.id}
            >
              {preset.previewImage ? <Image src={assetPath(preset.previewImage)!} alt={`${preset.name}の見本`} width={180} height={220} loading="lazy" /> : <span />}
              <small>{preset.genre ?? preset.pattern}</small>
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}
