"use client";

import { assetPath } from "@/lib/presets";
import type { DesignPreset, NailDesign } from "@/lib/types";

type Props = {
  presets: DesignPreset[];
  activePresetId?: string;
  onSelectPreset: (preset: DesignPreset) => void;
  design: NailDesign;
  onDesign: (patch: Partial<NailDesign>) => void;
};

export function DesignSelector({ presets, activePresetId, onSelectPreset, design, onDesign }: Props) {
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
              <option value="oval">オーバル</option>
              <option value="almond">アーモンド</option>
              <option value="coffin">バレリーナ</option>
              <option value="square">スクエア</option>
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
          <span>{presets.length}種類</span>
        </div>
        <div className="preset-grid">
          {presets.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className={`preset-card ${activePresetId === preset.id ? "is-selected" : ""}`}
              onClick={() => onSelectPreset(preset)}
            >
              {preset.previewImage ? <img src={assetPath(preset.previewImage)} alt="" loading="lazy" /> : <span />}
              <small>{preset.genre ?? preset.pattern}</small>
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}
