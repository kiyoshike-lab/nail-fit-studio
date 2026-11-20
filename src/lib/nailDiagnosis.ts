import { palettes } from "./designSuggestion";
import type { HandPhotoObservations } from "./handPhotoObservations";
import type { DiagnosisResult, NailShape } from "./types";

export const diagnosisQuestions = [
  { title: "どんな雰囲気が好きですか？", options: [["上品・きれいめ","elegant"],["シンプル・自然体","natural"],["かわいい・やわらかい","cute"],["個性的・モード","mode"],["韓国風・ちゅるん","korean"],["大人っぽい","mature"]] },
  { title: "惹かれる色は？", options: [["ピンク・ローズ","pink"],["ベージュ・ブラウン","warm"],["ブルー・ラベンダー","cool"],["黒・深い色","dark"],["おまかせ","auto"]] },
  { title: "ネイルを使う場面は？", options: [["仕事・学校","office"],["日常・休日","daily"],["デート・お出かけ","date"],["結婚式・イベント","event"],["成人式・卒業式","ceremony"],["推し活・ライブ","fan"]] },
  { title: "好みの華やかさは？", options: [["ごく自然","soft"],["さりげなく華やか","medium"],["しっかり目立たせたい","bold"]] },
  { title: "使いやすい長さは？", options: [["短め","short"],["ほどよい長さ","medium"],["長め","long"]] },
  { title: "気になる形は？", options: [["丸みのある形","round"],["すっきり縦長","oval"],["先細りで華やか","almond"],["直線的でシャープ","square"],["おまかせ","auto"]] },
  { title: "服装や場面での制限は？", options: [["かなりある","restricted"],["少しある","some"],["ほとんどない","free"]] },
  { title: "肌になじみやすいと感じる色は？", options: [["黄みのある色","warm-tone"],["青みのある色","cool-tone"],["どちらも好き","neutral-tone"],["分からない","unknown-tone"]] },
] as const;

export const shapeNames: Record<NailShape,string> = { natural:"ナチュラル", round:"ラウンド", oval:"オーバル", squoval:"スクオバル", almond:"アーモンド", coffin:"バレリーナ", square:"スクエア", stiletto:"スティレット" };
export const finishNames = { gloss:"ツヤ仕上げ", sheer:"透け感のあるジェル", pearl:"パール仕上げ", sparkle:"ラメ仕上げ", chrome:"メタリック仕上げ" } as const;
export const patternNames = { solid:"ワンカラー", gradient:"グラデーション", french:"フレンチ", patterned:"アート", floral:"フラワー", marble:"マーブル" } as const;
const lightMix = (hex: string, part: number) => "#" + [1,3,5].map(i =>
  Math.round(parseInt(hex.slice(i,i+2),16)*(1-part)+255*part).toString(16).padStart(2,"0")).join("");

export function recommendNails(answers: readonly string[]): DiagnosisResult {
  const [style, preferred, scene, intensity, desiredLength, desiredShape, limits, undertone] = answers;
  const quiet = limits === "restricted" || scene === "office";
  const occasion = ["event","ceremony","fan"].includes(scene);
  const chosen = Object.hasOwn(palettes, preferred) ? preferred as keyof typeof palettes
    : undertone === "warm-tone" ? "warm" : undertone === "cool-tone" ? "cool"
      : style === "mode" || style === "mature" ? "dark" : style === "natural" || style === "elegant" ? "warm" : "pink";
  const palette = palettes[chosen];
  const shape: NailShape = quiet ? desiredShape === "square" ? "squoval" : desiredShape === "oval" || desiredShape === "almond" ? "oval" : "round"
    : desiredShape === "square" ? "square" : desiredShape === "round" || desiredShape === "oval" || desiredShape === "almond" ? desiredShape
      : style === "mode" ? "squoval" : style === "cute" ? "round" : "oval";
  const length = quiet || desiredLength === "short" ? "short" : desiredLength === "long" ? "long" : "medium";
  const pattern = quiet ? "gradient" : style === "korean" || intensity === "soft" ? "solid" : style === "mode" || occasion ? "french" : "gradient";
  const shade = quiet || pattern === "french" ? palette.light : palette.color;
  const finish = quiet || style === "korean" ? "sheer" : intensity === "bold" && limits === "free" ? "sparkle"
    : occasion && intensity !== "soft" ? "pearl" : "gloss";
  const material = finish === "sheer" ? "jelly" : finish === "sparkle" ? "glitter" : finish === "pearl" ? "shimmer" : "cream";
  const useScene = diagnosisQuestions[2].options.find(([,v])=>v===scene)?.[0] ?? "選んだ場面";
  const colorReason = preferred === "auto"
    ? undertone === "warm-tone" || undertone === "cool-tone" ? "色はおまかせなので、ご自身がなじむと感じる色味を参考にしました。" : "色はおまかせなので、選んだ雰囲気から提案しました。"
    : "選んだ色の系統を優先しました。";
  const reason = quiet ? `${useScene}で使いやすいよう、同系色でも淡めにし、短め・控えめな光にまとめました。実際の校則や職場のルールも確認してください。`
    : `${useScene}に向け、${style === "korean" ? "韓国風の透け感を優先し" : finish === "sparkle" ? "目立たせたい好みに合わせ" : "光り方を抑えながら"}、${finishNames[finish]}を合わせました。`;
  const tipColor = pattern === "gradient" ? quiet ? lightMix(shade, .35) : palette.light
    : pattern === "french" ? palette.color : shade;
  return { title: `${palette.name} × ${patternNames[pattern]}`, description: `${colorReason}${reason}`,
    shape, color: shade, length, pattern, finish, material, tipColor,
    tags: [shapeNames[shape], length === "short" ? "短め" : length === "long" ? "長め" : "標準", finishNames[finish]],
    completedAt: new Date().toISOString() };
}

export function photoComparison(result: DiagnosisResult, photo: HandPhotoObservations): DiagnosisResult | null {
  if (photo.view !== "back" || photo.nailRatio === undefined || photo.measuredNails < 2) return null;
  const shape = photo.nailRatio >= 1.45 ? "oval" : "squoval";
  // Exposure-dependent color is descriptive, not evidence to change the palette.
  return shape === result.shape ? null : { ...result, shape };
}

export function differentDiagnosisPattern(result: DiagnosisResult): DiagnosisResult {
  const pattern = result.pattern === "solid" ? "gradient" : "solid";
  return { ...result, pattern, tipColor: pattern === "gradient" ? lightMix(result.color, .35) : result.color };
}

export function diagnosisTryOnUrl(result: DiagnosisResult): string {
  const params = new URLSearchParams({ photoFit: "1", recommendation: "1", shape: result.shape, color: result.color, length: result.length, pattern: result.pattern });
  if (result.finish) params.set("finish", result.finish);
  if (result.material) params.set("material", result.material);
  if (result.tipColor) params.set("tipColor", result.tipColor);
  return `/try-on?${params}`;
}
