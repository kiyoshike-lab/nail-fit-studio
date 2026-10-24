import type { NailPose } from "./types";

export type NailCalibration = { side: number; along: number; width: number; height: number; rotation: number };
export const defaultCalibration = (): NailCalibration[] => Array.from({ length: 5 }, () => ({ side: 0, along: 0, width: 1, height: 1, rotation: 0 }));

export function sanitizeCalibration(value: unknown): NailCalibration[] {
  if (!Array.isArray(value) || value.length !== 5) return defaultCalibration();
  return value.map((item) => ({
    side: finiteClamp(item?.side, -2, 2, 0),
    along: finiteClamp(item?.along, -2, 2, 0),
    width: finiteClamp(item?.width, 0.4, 2, 1),
    height: finiteClamp(item?.height, 0.4, 2, 1),
    rotation: finiteClamp(item?.rotation, -180, 180, 0),
  }));
}

// Offsets are relative to the finger's own axes and scale, not screen pixels.
// A user's adjustment therefore follows the hand when it rotates or moves closer.
export function applyCalibration(nail: NailPose, calibration: NailCalibration, aspect: number): NailPose {
  const angle = (nail.rotation - 90) * Math.PI / 180;
  const side = calibration.side * nail.width * aspect;
  const along = calibration.along * nail.height;
  return {
    ...nail,
    x: nail.x + (Math.cos(angle) * along - Math.sin(angle) * side) / aspect,
    y: nail.y + Math.sin(angle) * along + Math.cos(angle) * side,
    width: nail.width * calibration.width,
    height: nail.height * calibration.height,
    rotation: ((nail.rotation + calibration.rotation + 540) % 360) - 180,
  };
}

export function calibrateNail(base: NailPose, target: NailPose, aspect: number): NailCalibration {
  const angle = (base.rotation - 90) * Math.PI / 180;
  const dx = (target.x - base.x) * aspect;
  const dy = target.y - base.y;
  return sanitizeCalibration([{
    side: (-Math.sin(angle) * dx + Math.cos(angle) * dy) / (base.width * aspect),
    along: (Math.cos(angle) * dx + Math.sin(angle) * dy) / base.height,
    width: target.width / base.width,
    height: target.height / base.height,
    rotation: ((target.rotation - base.rotation + 540) % 360) - 180,
  }, ...defaultCalibration().slice(1)])[0];
}

function finiteClamp(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
