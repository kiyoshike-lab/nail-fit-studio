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
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can fail in private mode; the app should still work.
  }
}

export const STORAGE_KEYS = {
  favorites: "nail-fit-studio-next.favorites.v1",
  history: "nail-fit-studio-next.history.v1",
  diagnosis: "nail-fit-studio-next.diagnosis.v1",
  cameraDevice: "nail-fit-studio-next.camera-device.v1",
} as const;

export function createLocalId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now()}-${random}`;
}
