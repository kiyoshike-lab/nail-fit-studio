import type { NailDesign } from "./types";

export const palettes = {
  pink: { name: "ローズピンク", color: "#d88fa3", light: "#f0b8c6" },
  warm: { name: "ミルクティーベージュ", color: "#bd927d", light: "#dfbba9" },
  cool: { name: "くすみラベンダー", color: "#a88bb7", light: "#cbb7db" },
  dark: { name: "深いワイン", color: "#6f3442", light: "#b77786" },
} as const;

const colors = [
  [/黒|ブラック/, "黒", "#201c24"], [/白|ホワイト/, "白", "#fff2ea"],
  [/赤|ワイン|ボルドー/, "ボルドー", "#9a304c"], [/ピンク|ローズ/, "ピンク", palettes.pink.color],
  [/ベージュ|ブラウン/, "ベージュ", palettes.warm.color],
  [/青|ブルー/, "ブルー", "#7995be"], [/紫|ラベンダー/, "ラベンダー", palettes.cool.color],
  [/緑|グリーン/, "グリーン", "#729582"],
] as const;

export type TextDesignSuggestion = { patch: Partial<NailDesign>; matched: string[] };

// Bounded local rules. The prompt never goes to a server, URL or saved document.
// This output contract can also accept a future local reference-image adapter.
export function designFromText(input: string): TextDesignSuggestion | null {
  const text = input.slice(0, 160).normalize("NFKC").trim();
  if (!text || /(?:ラメ|フレンチ|黒|パール)(?:は|を)?(?:なし|無し|抜き)/.test(text)) return null;
  const patch: Partial<NailDesign> = { textureUrl: undefined, motif: "none" }, matched: string[] = [];
  const color = colors.map(([rule, name, value]) => ({ index: text.search(rule), name, value })).filter(v => v.index >= 0).sort((a,b) => a.index-b.index)[0];
  const french = /フレンチ/.test(text), gradient = /グラデ/.test(text);
  const jelly = /ちゅるん|透明感|シアー|韓国|ワンホン/.test(text), glitter = /ラメ|グリッター/.test(text);
  if (color) { patch.color = color.value; matched.push(color.name); }
  if (jelly) {
    patch.material = "jelly"; patch.finish = "sheer"; patch.realism = 1;
    patch.thickness = .46; patch.color ??= palettes.pink.light; matched.push("透け感のあるジェル");
  }
  if (french) {
    patch.pattern = "french"; patch.tipColor = color?.value ?? "#fff2ea";
    patch.color = palettes.warm.light; patch.tipAmount = .24; matched.push("フレンチ（指定色は爪先）");
  } else if (gradient) { patch.pattern = "gradient"; patch.tipColor = patch.color ?? palettes.pink.color; matched.push("グラデーション"); }
  else patch.pattern = "solid";
  if (glitter) {
    // Keep the French tip colour separate. The existing glitter renderer
    // draws pale particles; do not promise an exact metal colour.
    patch.material = "glitter"; patch.finish = "sparkle";
    matched.push("明るいラメ");
  } else if (/パール/.test(text)) { patch.material = "shimmer"; patch.finish = "pearl"; matched.push("パール質感"); }
  else if (/ツヤ|つや|光沢/.test(text)) { patch.finish = "gloss"; matched.push("ツヤ"); }
  return matched.length ? { patch, matched } : null;
}
