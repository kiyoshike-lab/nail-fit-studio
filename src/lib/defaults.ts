import type { NailDesign, NailPose } from "./types";

export const defaultDesign: NailDesign = {
  color: "#d9829b",
  shape: "oval",
  finish: "gloss",
  pattern: "solid",
  material: "cream",
  motif: "none",
  motifColor: "#ffffff",
  tipColor: "#fff8fb",
  tipAmount: 0.28,
  length: 1,
  thickness: 0.28,
  realism: 0.78,
};

export const defaultPhotoNails: NailPose[] = [
  { x: 34, y: 62, width: 5.6, height: 11.5, rotation: -9, confidence: 0.55 },
  { x: 43, y: 44, width: 5.1, height: 12.3, rotation: -3, confidence: 0.55 },
  { x: 52, y: 39, width: 5.2, height: 12.8, rotation: 1, confidence: 0.55 },
  { x: 61, y: 46, width: 4.8, height: 11.5, rotation: 5, confidence: 0.55 },
  { x: 69, y: 58, width: 4.3, height: 9.7, rotation: 10, confidence: 0.55 },
];
