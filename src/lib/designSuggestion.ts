import type { NailDesign } from "./types";
import type { PartKind } from "./workshopTypes";

export const palettes = {
  pink: { name: "ローズピンク", color: "#d88fa3", light: "#f0b8c6" },
  warm: { name: "ミルクティーベージュ", color: "#bd927d", light: "#dfbba9" },
  cool: { name: "くすみラベンダー", color: "#a88bb7", light: "#cbb7db" },
  dark: { name: "深いワイン", color: "#6f3442", light: "#b77786" },
} as const;

const colors = [
  [/ピンク[・\s-]?ベージュ/, "ピンクベージュ", "#ce9c9c"],
  [/黒|ブラック/, "黒", "#201c24"], [/白|ホワイト/, "白", "#fff2ea"],
  [/赤|ワイン|ボルドー/, "ボルドー", "#9a304c"], [/ピンク|ローズ/, "ピンク", palettes.pink.color],
  [/ベージュ|ブラウン/, "ベージュ", palettes.warm.color],
  [/青|ブルー/, "ブルー", "#7995be"], [/紫|ラベンダー/, "ラベンダー", palettes.cool.color],
  [/緑|グリーン/, "グリーン", "#729582"],
] as const;

export const textFingerNames = ["親指", "人差し指", "中指", "薬指", "小指"] as const;
type Accent = { kind: PartKind; size: number };
export type FingerSuggestion = { index: number; base: Partial<NailDesign>; magnet?: boolean; accent?: Accent };
export type TextDesignSuggestion = { patch: Partial<NailDesign>; matched: string[]; finger?: FingerSuggestion };

// Bounded local rules. The prompt never goes to a server, URL or saved document.
// This output contract can also accept a future local reference-image adapter.
export function designFromText(input: string): TextDesignSuggestion | null {
  const full = input.slice(0, 160).normalize("NFKC").trim();
  if (!full || /なし|無し|抜き|じゃない|以外|除く|右手|左手|本ずつ/.test(full)) return null;
  const fingerWords = textFingerNames.flatMap((name, i) => full.includes(name) ? [i] : []);
  const explicit = full.match(/(親指|人差し指|中指|薬指|小指)(?:だけ|に|は|を)(.*)$/);
  if (fingerWords.length > 1 || (fingerWords.length && !explicit)) return null;
  if (explicit && /だけ/.test(explicit[2])) return null;
  const oneAccent = /全体(?:は|を)?シンプルで(?:、|\s)*1本だけ派手/.test(full);
  if (!explicit && /だけ/.test(full) && !oneAccent) return null;
  const text = explicit ? full.slice(0, explicit.index).replace(/[、。と\s]+$/, "") : oneAccent ? "シンプル" : full;
  const global = baseFromText(text);
  if (global === null) return null;
  const accentText = explicit ? explicit[2] : full;
  const accentKinds: [RegExp, PartKind, string][] = [[/ハート/, "heart", "ハート"], [/ストーン|クリスタル/, "crystal", "ストーン"], [/パール(?:を|ひと粒|1粒|パーツ)/, "pearl", "パール"]];
  const requested = accentKinds.filter(([re]) => re.test(accentText));
  if (requested.length > 1) return null;
  const magnet = /マグネット|キャッツアイ/.test(accentText);
  // More than one independent finish on one finger is not silently merged.
  if (magnet && /ラメ|フレンチ|グラデ|ちゅるん/.test(accentText)) return null;
  const fingerBase = explicit ? baseFromText(accentText) : { patch: {}, matched: [] as string[] };
  if (fingerBase === null) return null;
  const index = explicit ? fingerWords[0] : 3;
  const matched = [...global.matched];
  if (explicit || requested.length || magnet || oneAccent) {
    const [, kind, partName] = requested[0] ?? [];
    const accent = kind ? { kind, size: /小さ|ひかえめ|控えめ/.test(accentText) ? .12 : /大き/.test(accentText) ? .28 : .19 } :
      oneAccent ? {kind: "crystal" as const, size: .23} : undefined;
    const labels = [...fingerBase.matched, ...(magnet ? ["マグネット風"] : []), ...(accent ? [oneAccent ? "アクセントのストーン" : partName] : [])];
    if (!labels.length) return null;
    matched.push(`${textFingerNames[index]}${explicit ? "だけ" : "（アクセント）"}：${labels.join("・")}`);
    return { patch: global.patch, matched, finger: { index, base: fingerBase.patch, ...(magnet ? {magnet} : {}), ...(accent ? {accent} : {}) } };
  }
  return matched.length ? global : null;
}

function baseFromText(text: string) {
  const patch: Partial<NailDesign> = {}, matched: string[] = [];
  const scan = text.replace(/ピンク[・\s-]?ベージュ/g,"複合色");
  const matches = colors.filter(([rule],i) => rule.test(i === 0 ? text : scan));
  if (matches.length > 1) return null;
  const color = matches[0] && {name:matches[0][1], value:matches[0][2]};
  const french = /フレンチ/.test(text), gradient = /グラデ/.test(text);
  if (french && gradient) return null;
  const jelly = /ちゅるん|透明感|シアー|韓国|ワンホン/.test(text), glitter = /ラメ|グリッター/.test(text);
  if (color) { patch.color = color.value; matched.push(color.name); }
  if (jelly) {
    patch.material = "jelly"; patch.finish = "sheer"; patch.realism = 1;
    patch.thickness = .46; patch.color ??= /上品/.test(text) ? palettes.warm.light : palettes.pink.light; matched.push("透け感のあるジェル");
  }
  if (french) {
    patch.pattern = "french"; patch.tipColor = color?.value ?? "#fff2ea";
    patch.color = palettes.warm.light; patch.tipAmount = .24; matched.push("フレンチ（指定色は爪先）");
  } else if (gradient) {
    patch.pattern = "gradient"; patch.tipColor = patch.color ?? palettes.pink.color;
    patch.color = palettes.warm.light; matched.push("グラデーション（指定色は爪先）");
  } else if (color || jelly) patch.pattern = "solid";
  if (glitter) {
    // Keep the French tip colour separate. The existing glitter renderer
    // draws pale particles; do not promise an exact metal colour.
    patch.material = "glitter"; patch.finish = "sparkle";
    matched.push("明るいラメ");
  } else if (/パール(?!を|ひと粒|1粒|パーツ)/.test(text)) { patch.material = "shimmer"; patch.finish = "pearl"; matched.push("パール質感"); }
  else if (/ツヤ|つや|光沢/.test(text)) { patch.finish = "gloss"; matched.push("ツヤ"); }
  else if (/シンプル/.test(text)) {
    Object.assign(patch,{ color:patch.color ?? palettes.warm.light, pattern:"solid",material:"cream", finish:"gloss" });
    matched.push("シンプルなワンカラー");
  }
  if (matched.length) Object.assign(patch, {textureUrl:undefined,motif:"none"});
  return {patch,matched};
}
