import type { NailLandmark } from "./nailGeometry";

type Vector = { x: number; y: number; z: number };
export type HandView = "back" | "palm" | "side" | "unknown";
export type ModelHandedness = { categoryName: string; score: number } | undefined;
export type FingerPose = { facing: number; bendDegrees: number; outOfPlaneDegrees: number; confidence: number; normal: Vector };
export type HandPose = {
  view: HandView; modelHand: string; confidence: number; facing: number;
  tiltDegrees: number; normal: Vector; source: "world" | "normalized" | "none";
  fingers: FingerPose[];
};
const chains = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];

// Always use the UNMIRRORED model input. Display mirroring is not handedness.
// This bundled model's selfie-label convention gives +cross.z for a Right-labelled
// dorsal input (verified separately on the supplied back/palm reference frames).
// These normals are pose estimates, not proof of nail visibility or nail roll.
export function estimateHandPose(landmarks: NailLandmark[], world: NailLandmark[] | undefined, identity: ModelHandedness, aspect: number): HandPose {
  const unknown: HandPose = { view: "unknown", modelHand: identity?.categoryName ?? "unknown", confidence: 0,
    facing: 0, tiltDegrees: 90, normal: { x: 0, y: 0, z: 0 }, source: "none", fingers: [] };
  if (!valid(landmarks) || !Number.isFinite(aspect) || aspect <= 0
    || !identity || !Number.isFinite(identity.score) || identity.score < 0.75 || !["Left", "Right"].includes(identity.categoryName)) return unknown;
  const imagePoints = landmarks.map(p => ({ x: p.x * aspect, y: p.y, z: (p.z ?? 0) * aspect }));
  const imagePlane = plane(imagePoints);
  const worldPoints = world && valid(world) ? world.map(p => ({ x: p.x, y: p.y, z: p.z ?? 0 })) : undefined;
  const worldPlane = worldPoints ? plane(worldPoints) : undefined;
  if (!imagePlane) return unknown;
  // Metric reconstruction and normalized depth can disagree at occlusion / edge-on
  // poses. Do not let a guessed world plane reverse the observed winding.
  const agreement = worldPlane ? dot(imagePlane.normal, worldPlane.normal) : 1;
  if (agreement < 0.35) return unknown;
  const points = worldPlane && worldPoints ? worldPoints : imagePoints;
  const chosen = worldPlane ?? imagePlane;
  const sign = identity.categoryName === "Right" ? 1 : -1;
  const normal = mul(chosen.normal, sign);
  const confidence = identity.score * Math.min(imagePlane.quality, chosen.quality) * Math.min(1, agreement + 0.2);
  const facing = normal.z;
  const view: HandView = confidence < 0.6 ? "unknown" : facing > 0.35 ? "back" : facing < -0.35 ? "palm" : "side";
  const fingers = chains.map(chain => {
    let n = normal;
    let previous = unit(sub(points[chain[0]], points[0]));
    let bendDegrees = 0;
    let outOfPlaneDegrees = 0;
    for (let index = 1; index < chain.length; index++) {
      const direction = unit(sub(points[chain[index]], points[chain[index - 1]]));
      outOfPlaneDegrees = Math.max(outOfPlaneDegrees, Math.asin(Math.min(1, Math.abs(dot(normal, direction)))) * 180 / Math.PI);
      bendDegrees += Math.acos(clamp(dot(previous, direction), -1, 1)) * 180 / Math.PI;
      n = transport(n, previous, direction);
      previous = direction;
    }
    return { facing: n.z, bendDegrees, outOfPlaneDegrees, confidence, normal: n };
  });
  return { view, modelHand: identity.categoryName, confidence, facing, normal,
    tiltDegrees: Math.acos(Math.min(1, Math.abs(facing))) * 180 / Math.PI,
    source: worldPlane ? "world" : "normalized", fingers };
}

function plane(points: Vector[]) {
  const a = sub(points[5], points[0]), b = sub(points[17], points[0]);
  const c = cross(a, b), area = length(c), denominator = length(a) * length(b);
  if (denominator < 1e-10 || area / denominator < 0.08) return;
  return { normal: mul(c, 1 / area), quality: Math.min(1, area / denominator / 0.35) };
}
function transport(normal: Vector, from: Vector, to: Vector) {
  const axis = cross(from, to), sine = length(axis), cosine = clamp(dot(from, to), -1, 1);
  // An antiparallel segment has no unique bend axis: lower visibility instead of
  // inventing a 180-degree nail surface rotation.
  if (sine < 1e-6) return cosine < 0 ? { x: 0, y: 0, z: 0 } : normal;
  const k = mul(axis, 1 / sine), tangent = cross(k, normal), projection = dot(k, normal) * (1 - cosine);
  return { x: normal.x * cosine + tangent.x * sine + k.x * projection,
    y: normal.y * cosine + tangent.y * sine + k.y * projection,
    z: normal.z * cosine + tangent.z * sine + k.z * projection };
}
function valid(points: NailLandmark[]) { return points.length === 21 && points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && (p.z === undefined || Number.isFinite(p.z))); }
function sub(a: Vector, b: Vector): Vector { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function mul(a: Vector, n: number): Vector { return { x: a.x * n, y: a.y * n, z: a.z * n }; }
function dot(a: Vector, b: Vector) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a: Vector, b: Vector): Vector { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
function length(a: Vector) { return Math.hypot(a.x, a.y, a.z); }
function unit(a: Vector) { return mul(a, 1 / (length(a) || 1)); }
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
