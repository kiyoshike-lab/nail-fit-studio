import type { NailDesign } from "./types";
import { presetTextureUrls } from "./presetTextureMap";
const photoUrls = new Set(Object.values(presetTextureUrls));

// Keep saved schema 1–4 URLs usable, but bypass stale quilt bytes in browser caches.
// Only the 47 audited legacy files are aliases; arbitrary/custom textures are intact.
const legacy = /^\/?assets\/preset-textures\/(?:texture_(\d{3})|nail_texture_(\d{3})_v2(?:_[a-f0-9]{12})?)\.png$/;
export function resolveNailTextureUrl(url: string): string {
  const match = legacy.exec(url);
  const id = match?.[1] ?? match?.[2];
  if (!id || +id < 1 || +id > 50 || [12, 19, 22].includes(+id)) return url;
  return presetTextureUrls[id] ?? url;
}

export function isPhotoNailTexture(url?: string): boolean {
  return !!url && photoUrls.has(resolveNailTextureUrl(url));
}

// Photograph pixels already contain their color/art/shine. Explicitly changing
// those controls switches back to procedural editing, instead of silently hiding
// the user's change under an opaque photograph. Shape/length/parts remain editable.
export function patchNailDesign(base: NailDesign, patch: Partial<NailDesign>): NailDesign {
  const next = { ...base, ...patch };
  const visualKeys: (keyof NailDesign)[] = ["color", "finish", "material", "pattern", "motif", "motifColor", "tipColor", "tipAmount"];
  if (!("textureUrl" in patch) && isPhotoNailTexture(base.textureUrl) && visualKeys.some(key => key in patch)) delete next.textureUrl;
  return next;
}
