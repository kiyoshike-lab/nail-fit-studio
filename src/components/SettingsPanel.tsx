"use client";

import type { NailDesign, NailPose } from "@/lib/types";

type Props = {
  design: NailDesign;
  selectedFinger: number;
  nail?: NailPose;
  onDesign: (patch: Partial<NailDesign>) => void;
  onSelectFinger: (index: number) => void;
  onNail: (patch: Partial<NailPose>) => void;
};

const fingers = ["親指", "人差し指", "中指", "薬指", "小指"];

export function SettingsPanel({ design, selectedFinger, nail, onDesign, onSelectFinger, onNail }: Props) {
  return (
    <section className="panel-card settings-panel" id="settings-panel" aria-labelledby="settings-title">
      <h2 id="settings-title">設定</h2>

      <details className="setting-block">
        <summary>基本</summary>
        <div className="field-grid">
          <label>
            長さ
            <input type="range" min="0.75" max="2.5" step="0.01" value={design.length} onChange={(e) => onDesign({ length: Number(e.target.value) })} />
          </label>
          <label>
            爪先カラー幅
            <input
              type="range"
              min="0.08"
              max="0.55"
              step="0.01"
              value={design.tipAmount}
              onChange={(e) => onDesign({ tipAmount: Number(e.target.value), pattern: "french" })}
            />
          </label>
        </div>
      </details>

      <details className="setting-block">
        <summary>リアル調整</summary>
        <div className="field-grid">
          <label>
            厚み
            <input type="range" min="0" max="1" step="0.01" value={design.thickness} onChange={(e) => onDesign({ thickness: Number(e.target.value) })} />
          </label>
          <label>
            リアル感
            <input type="range" min="0" max="1" step="0.01" value={design.realism} onChange={(e) => onDesign({ realism: Number(e.target.value) })} />
          </label>
        </div>
        <p className="hint">透明感・艶・サイド影・根元なじみをまとめて調整します。</p>
      </details>

      <details className="setting-block">
        <summary>詳細調整</summary>
        <div className="finger-tabs" role="tablist" aria-label="指を選択">
          {fingers.map((name, index) => (
            <button type="button" key={name} className={selectedFinger === index ? "is-selected" : ""} onClick={() => onSelectFinger(index)}>
              {name}
            </button>
          ))}
        </div>

        {nail && (
          <div className="field-grid">
            <label>
              横位置
              <input type="range" min="0" max="100" step="0.1" value={nail.x} onChange={(e) => onNail({ x: Number(e.target.value) })} />
            </label>
            <label>
              縦位置
              <input type="range" min="0" max="100" step="0.1" value={nail.y} onChange={(e) => onNail({ y: Number(e.target.value) })} />
            </label>
            <label>
              大きさ
              <input
                type="range"
                min="1"
                max="9"
                step="0.1"
                value={nail.width}
                onChange={(e) => onNail({ width: Number(e.target.value), height: Number(e.target.value) * 2.1 })}
              />
            </label>
            <label>
              角度
              <input type="range" min="-45" max="45" step="1" value={nail.rotation} onChange={(e) => onNail({ rotation: Number(e.target.value) })} />
            </label>
          </div>
        )}
      </details>
    </section>
  );
}
