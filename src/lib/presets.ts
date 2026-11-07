import type { DesignPreset } from "./types";
import { presetManifestUrl } from "./presetTextureMap";

type PresetPayload = {
  presets?: DesignPreset[];
};

export async function loadDesignPresets(): Promise<DesignPreset[]> {
  const response = await fetch(presetManifestUrl, { cache: "force-cache" });
  if (!response.ok) return [];
  const payload = (await response.json()) as PresetPayload;
  return payload.presets ?? [];
}

export function assetPath(path?: string) {
  if (!path) return undefined;
  return path.startsWith("/") ? path : `/${path}`;
}
