// Public, lightweight catalogue. Do not import the renderer/editor here.
export const showcaseExamples = [
  { id: "office", name: "ミルクティーベージュ", category: "シンプル・オフィス", hand: "linen" },
  { id: "jelly", name: "透けるローズジェル", category: "ちゅるん・透明感", hand: "rose" },
  { id: "french", name: "ミルクホワイトフレンチ", category: "フレンチ", hand: "linen" },
  { id: "magnet", name: "モーヴベルベット", category: "マグネット風", hand: "rose" },
  { id: "gradient", name: "桃色グラデーション", category: "グラデーション", hand: "rose" },
  { id: "aurora", name: "オーロラとシルバー", category: "オーロラ・ミラー風", hand: "linen" },
  { id: "hologram", name: "星屑ライラック", category: "ラメ・ホログラム", hand: "rose" },
  { id: "korean", name: "ミルキーライラック", category: "韓国風", hand: "linen" },
  { id: "wonhong", name: "ワインフレンチとストーン", category: "ワンホン風", hand: "rose" },
  { id: "pearl", name: "シャンパンパール", category: "ストーン・パール", hand: "linen" },
  { id: "soft", name: "ローズとミルク", category: "大人かわいい", hand: "rose" },
  { id: "mode", name: "チャコールとミラー", category: "モード・クール", hand: "linen" },
] as const;

export type ShowcaseExample = (typeof showcaseExamples)[number];
export type ShowcaseId = ShowcaseExample["id"];
export type ShowcaseHand = ShowcaseExample["hand"];
export function findShowcase(id: string | null) {
  return showcaseExamples.find(example => example.id === id);
}
export function showcaseImage(example: ShowcaseExample) {
  return `/assets/showcase/${example.id}-v1.webp`;
}
export function showcaseUrl(example: ShowcaseExample) {
  return `/try-on?example=${example.id}`;
}
