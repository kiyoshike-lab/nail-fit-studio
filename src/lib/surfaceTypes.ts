/** Versioned, procedural Canvas finishes. No external images or shader code. */
export const surfaceKinds = ["color", "sheer", "clear", "milky", "gradient", "french", "reverse-french", "diagonal-french", "half-french", "magnet", "cat-eye", "mirror", "chrome", "aurora", "unicorn", "hologram", "glitter", "flash", "matte"] as const;
export type SurfaceKind = typeof surfaceKinds[number];
export type NailSurface = { kind: SurfaceKind; pigment: number; roughness: number; gloss: number; angle: number; intensity: number; grain: number; curve: number };

export function parseSurface(value: unknown): NailSurface | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const keys = ["kind", "pigment", "roughness", "gloss", "angle", "intensity", "grain", "curve"];
  if (Object.keys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))
    || typeof v.kind !== "string" || !(surfaceKinds as readonly string[]).includes(v.kind)) return null;
  for (const k of keys.slice(1)) {
    const n = v[k], low = k === "angle" ? -180 : 0, high = k === "angle" ? 180 : 1;
    if (typeof n !== "number" || !Number.isFinite(n) || n < low || n > high) return null;
  }
  return Object.fromEntries(keys.map(k => [k, v[k]])) as NailSurface;
}
