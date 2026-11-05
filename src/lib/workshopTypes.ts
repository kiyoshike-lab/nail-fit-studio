import type { NailDesign } from "./types";

export const partNames = {
  "silver-holo": "シルバーホログラム", "gold-holo": "ゴールドホログラム",
  "chunky-glitter": "大粒ラメ", "fine-glitter": "細かいラメ", rhinestone: "ラインストーン",
  crystal: "クリスタル", pearl: "パール", heart: "ハート", star: "星", ribbon: "リボン",
  shell: "シェル風", gel: "ぷっくりジェル風", flower: "3Dフラワー風",
} as const;
export type PartKind = keyof typeof partNames;
export type NailPart = { id: string; kind: PartKind; color: string; x: number; y: number; size: number; rotation: number };
export type FingerArt = { base: NailDesign; opacity: number; effect: "none" | "dots" | "lines" | "magnetic"; parts: NailPart[] };
export type DesignDocument = { schema: 1; id: string; name: string; createdAt: string; updatedAt: string; fingers: FingerArt[]; detail: "standard" | "light" };
export const collectionNames = { created: "自分で作ったデザイン", favorite: "お気に入り", next: "次にやりたい", salon: "サロン持ち込み候補" } as const;
export type CollectionKind = keyof typeof collectionNames;
export type CollectionEntry = { folder: CollectionKind; document: DesignDocument };
