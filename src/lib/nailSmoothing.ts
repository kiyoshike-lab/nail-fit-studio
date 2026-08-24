import type { NailPose } from "./types";

export type NailSmoothingAlphas = {
  position: number;
  size: number;
  rotation: number;
};

export function smoothTrackedNails(current: NailPose[], next: NailPose[]): NailPose[] {
  if (current.length !== next.length || next.length === 0) return next;
  const globalMotion = median(
    current.map((nail, index) => Math.hypot(next[index].x - nail.x, next[index].y - nail.y)),
  );

  return current.map((nail, index) => {
    const target = next[index];
    const alphas = calculateSmoothingAlphas(nail, target, globalMotion);
    return {
      ...nail,
      x: ema(nail.x, target.x, alphas.position),
      y: ema(nail.y, target.y, alphas.position),
      width: ema(nail.width, target.width, alphas.size),
      height: ema(nail.height, target.height, alphas.size),
      rotation: smoothAngle(nail.rotation, target.rotation, alphas.rotation),
      confidence: target.confidence,
    };
  });
}

export function calculateSmoothingAlphas(
  current: NailPose,
  target: NailPose,
  globalMotion: number,
): NailSmoothingAlphas {
  const localMotion = Math.hypot(target.x - current.x, target.y - current.y);
  const effectiveMotion = Math.max(localMotion * 0.72, globalMotion);
  const motionFactor = smoothStep(0.12, 1.8, effectiveMotion);
  const sizeDelta = Math.max(
    Math.abs(target.width - current.width) / Math.max(current.width, 0.8),
    Math.abs(target.height - current.height) / Math.max(current.height, 1.5),
  );
  const sizeFactor = smoothStep(0.012, 0.2, sizeDelta);
  const angleFactor = smoothStep(0.8, 15, Math.abs(shortestAngleDelta(current.rotation, target.rotation)));

  return {
    // Stable hands get strong damping; deliberate movement catches up quickly.
    position: lerp(0.16, 0.82, motionFactor),
    size: clamp(lerp(0.1, 0.5, sizeFactor) + motionFactor * 0.08, 0.1, 0.58),
    rotation: clamp(lerp(0.13, 0.58, angleFactor) + motionFactor * 0.07, 0.13, 0.65),
  };
}

export function smoothAngle(current: number, target: number, amount: number) {
  return normalizeDegrees(current + shortestAngleDelta(current, target) * amount);
}

function shortestAngleDelta(current: number, target: number) {
  let delta = target - current;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

function ema(current: number, target: number, amount: number) {
  return current + (target - current) * amount;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function smoothStep(min: number, max: number, value: number) {
  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(min: number, max: number, amount: number) {
  return min + (max - min) * amount;
}

function normalizeDegrees(value: number) {
  let normalized = value;
  while (normalized > 180) normalized -= 360;
  while (normalized <= -180) normalized += 360;
  return normalized;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
