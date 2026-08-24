import type { NailPose } from "./types";

export type NailLandmark = {
  x: number;
  y: number;
  z?: number;
};

type Point = { x: number; y: number };

type FingerGeometry = {
  distalWeight: number;
  bedLength: number;
  bedWidth: number;
  palmLength: number;
  palmWidth: number;
  tipExtension: number;
  lateralBias: number;
};

const tipIndexes = [4, 8, 12, 16, 20];
const dipIndexes = [3, 7, 11, 15, 19];
const pipIndexes = [2, 6, 10, 14, 18];

// Values are tuned per finger from the distal phalanx rather than applying one
// generic oval to all five fingers. Pinky is intentionally the smallest.
const fingerGeometry: FingerGeometry[] = [
  { distalWeight: 0.9, bedLength: 0.7, bedWidth: 0.68, palmLength: 0.165, palmWidth: 0.115, tipExtension: 0.035, lateralBias: 0.12 },
  { distalWeight: 0.8, bedLength: 0.66, bedWidth: 0.52, palmLength: 0.16, palmWidth: 0.09, tipExtension: 0.025, lateralBias: 0 },
  { distalWeight: 0.78, bedLength: 0.68, bedWidth: 0.54, palmLength: 0.17, palmWidth: 0.094, tipExtension: 0.025, lateralBias: 0 },
  { distalWeight: 0.8, bedLength: 0.64, bedWidth: 0.5, palmLength: 0.155, palmWidth: 0.086, tipExtension: 0.023, lateralBias: -0.01 },
  { distalWeight: 0.84, bedLength: 0.57, bedWidth: 0.41, palmLength: 0.125, palmWidth: 0.069, tipExtension: 0.018, lateralBias: -0.025 },
];

export function buildNailsFromLandmarks(
  landmarks: NailLandmark[],
  mirrored: boolean,
  frameAspect = 1,
): NailPose[] {
  if (landmarks.length < 21) return [];
  const aspect = clamp(frameAspect, 0.5, 2.5);
  const points = landmarks.map((point) => ({
    x: mirrored ? 1 - point.x : point.x,
    y: point.y,
  }));
  const palmScale = estimatePalmScale(points, aspect);

  return tipIndexes.map((tipIndex, fingerIndex) => {
    const tip = points[tipIndex];
    const dip = points[dipIndexes[fingerIndex]];
    const pip = points[pipIndexes[fingerIndex]];
    const config = fingerGeometry[fingerIndex];
    const distalVector = toPhysicalVector(dip, tip, aspect);
    const proximalVector = toPhysicalVector(pip, dip, aspect);
    const distalLength = vectorLength(distalVector);
    const proximalLength = vectorLength(proximalVector);
    const distalAxis = normalize(distalVector);
    const proximalAxis = normalize(proximalVector);
    const bend = clamp(dot(distalAxis, proximalAxis), -1, 1);
    // A bent or oblique finger should follow its distal segment more strongly.
    const distalWeight = clamp(config.distalWeight + (1 - bend) * 0.13, config.distalWeight, 0.96);
    const axis = normalize({
      x: distalAxis.x * distalWeight + proximalAxis.x * (1 - distalWeight),
      y: distalAxis.y * distalWeight + proximalAxis.y * (1 - distalWeight),
    });
    const sideAxis = { x: -axis.y, y: axis.x };

    // Blend local finger scale with palm scale. The palm term prevents a nail
    // collapsing when a distal phalanx is foreshortened by an oblique view.
    const localScale = distalLength * 0.84 + proximalLength * 0.16 * 0.72;
    const bedLength = clamp(
      localScale * config.bedLength + palmScale * config.palmLength * 0.14,
      palmScale * config.palmLength * 0.72,
      palmScale * config.palmLength * 1.48,
    );
    const bedWidthPhysical = clamp(
      localScale * config.bedWidth + palmScale * config.palmWidth * 0.16,
      palmScale * config.palmWidth * 0.72,
      palmScale * config.palmWidth * 1.42,
    );

    let lateralOffset = bedWidthPhysical * config.lateralBias;
    if (fingerIndex === 0) {
      // Thumb landmarks are often slightly off-centre. Move toward the index
      // finger in the thumb's perpendicular axis instead of using handedness
      // alone, which remains reliable for mirrored and external cameras.
      const towardIndex = toPhysicalVector(dip, points[dipIndexes[1]], aspect);
      const towardIndexSign = Math.sign(dot(towardIndex, sideAxis)) || 1;
      lateralOffset = bedWidthPhysical * config.lateralBias * towardIndexSign;
    }

    const tipExtension = bedLength * config.tipExtension;
    const rootPhysicalOffset = bedLength - tipExtension;
    const root = offsetNormalizedPoint(
      tip,
      {
        x: -axis.x * rootPhysicalOffset + sideAxis.x * lateralOffset,
        y: -axis.y * rootPhysicalOffset + sideAxis.y * lateralOffset,
      },
      aspect,
    );

    return {
      x: clamp(root.x * 100, -3, 103),
      y: clamp(root.y * 100, -3, 103),
      width: clamp((bedWidthPhysical / aspect) * 100, 0.8, fingerIndex === 0 ? 8 : 6.3),
      height: clamp(bedLength * 100, 1.5, fingerIndex === 0 ? 10 : 11),
      rotation: normalizeDegrees((Math.atan2(axis.y, axis.x) * 180) / Math.PI + 90),
      confidence: 0.78,
    };
  });
}

function estimatePalmScale(points: Point[], aspect: number) {
  const wristToMiddle = physicalDistance(points[0], points[9], aspect);
  const palmWidth = physicalDistance(points[5], points[17], aspect);
  return clamp(wristToMiddle * 0.68 + palmWidth * 0.32, 0.06, 0.75);
}

function toPhysicalVector(from: Point, to: Point, aspect: number): Point {
  return { x: (to.x - from.x) * aspect, y: to.y - from.y };
}

function offsetNormalizedPoint(point: Point, physicalOffset: Point, aspect: number): Point {
  return { x: point.x + physicalOffset.x / aspect, y: point.y + physicalOffset.y };
}

function physicalDistance(a: Point, b: Point, aspect: number) {
  return vectorLength(toPhysicalVector(a, b, aspect));
}

function vectorLength(vector: Point) {
  return Math.hypot(vector.x, vector.y);
}

function normalize(vector: Point): Point {
  const length = vectorLength(vector) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function dot(a: Point, b: Point) {
  return a.x * b.x + a.y * b.y;
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
