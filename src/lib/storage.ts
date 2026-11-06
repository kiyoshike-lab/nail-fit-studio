import type { DiagnosisResult, SavedNailLook, TryOnHistory } from "./types";

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  tryWriteJson(key, value);
}

// Existing settings writes remain best-effort. Explicit user saves can inspect
// the outcome instead of claiming success after quota/private-mode failures.
export function tryWriteJson<T>(key: string, value: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const STORAGE_KEYS = {
  favorites: "nail-fit-studio-next.favorites.v1",
  history: "nail-fit-studio-next.history.v1",
  diagnosis: "nail-fit-studio-next.diagnosis.v1",
  cameraDevice: "nail-fit-studio-next.camera-device.v1",
} as const;

export function readDiagnosisResult(): DiagnosisResult | null {
  const v = readJson<unknown>(STORAGE_KEYS.diagnosis, null);
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const text = (s: unknown, max: number): s is string => typeof s === "string" && s.length > 0 && s.length <= max;
  if (!text(r.title, 200) || !text(r.description, 2000) || !validDate(r.completedAt)
    || typeof r.color !== "string" || !/^#[0-9a-f]{6}$/i.test(r.color)
    || !["natural","round","oval","squoval","almond","coffin","square","stiletto"].includes(r.shape as string)
    || !["solid","gradient","french","floral","marble","patterned"].includes(r.pattern as string)
    || !["short","medium","long"].includes(r.length as string)
    || !Array.isArray(r.tags) || r.tags.length > 20 || !r.tags.every(t => text(t,100))) return null;
  return { title:r.title, description:r.description, completedAt:r.completedAt as string,
    color:r.color, shape:r.shape as DiagnosisResult["shape"], pattern:r.pattern as DiagnosisResult["pattern"],
    length:r.length as DiagnosisResult["length"], tags:[...r.tags] };
}

export function readSavedLooks(kind: "favorites"): SavedNailLook[];
export function readSavedLooks(kind: "history"): TryOnHistory[];
export function readSavedLooks(kind: "favorites" | "history"): (SavedNailLook | TryOnHistory)[];
export function readSavedLooks(kind: "favorites" | "history"): (SavedNailLook | TryOnHistory)[] {
  const values = readJson<unknown>(STORAGE_KEYS[kind], []);
  if (!Array.isArray(values)) return [];
  // Do not rewrite or delete the source data on read; retain valid legacy items.
  return values.filter((item): item is SavedNailLook | TryOnHistory => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !validDate(item.savedAt)) return false;
    if (kind === "history" && !validDate(item.createdAt)) return false;
    const d = item.design;
    return d && typeof d === "object"
      && [d.color, d.tipColor, d.motifColor].every(c => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c))
      && ["natural", "round", "oval", "squoval", "almond", "coffin", "square", "stiletto"].includes(d.shape)
      && ["solid", "gradient", "french", "floral", "marble", "patterned"].includes(d.pattern)
      && ["gloss", "sheer", "pearl", "chrome", "sparkle"].includes(d.finish)
      && ["cream", "jelly", "glitter", "metallic", "shimmer", "sheer"].includes(d.material)
      && typeof d.motif === "string" && [d.length, d.thickness, d.realism, d.tipAmount].every(Number.isFinite)
      && d.length > 0 && Array.isArray(item.nails) && item.nails.length === 5
      && item.nails.every((n: Record<string, unknown> | null) => n && [n.x, n.y, n.width, n.height, n.rotation].every(Number.isFinite)
        && Number(n.width) > 0 && Number(n.height) > 0);
  });
}

function validDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function createLocalId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now()}-${random}`;
}
