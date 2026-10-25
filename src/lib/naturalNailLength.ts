import type { NailPose } from "./types";

export type NaturalNailLength = "auto" | "short" | "standard" | "long";

export function naturalNailLength(value?: string): NaturalNailLength {
  return value === "short" || value === "standard" || value === "long" ? value : "auto";
}

export function applyNaturalNailLength(nail: NailPose, mode: NaturalNailLength): NailPose {
  const factor = mode === "short" ? 0.84 : mode === "long" ? 1.45 : 1;
  // A longer natural nail extends at the free edge. Never move the cuticle.
  return factor === 1 ? nail : { ...nail, anchorHeight: nail.anchorHeight ?? nail.height, height: nail.height * factor };
}
