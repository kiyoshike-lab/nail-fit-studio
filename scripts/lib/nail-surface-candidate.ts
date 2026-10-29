import type { NailPose, NailShape } from "../../src/lib/types";

// REJECTED EXPERIMENT: the two eligible IMAGE masks worsened actual Canvas IoU.
// QA only. Do not import this module into the app until independently validated.

export type NailSurface = { rows: { v: number; left: number; right: number }[]; confidence: number };

// Local nail units, NOT image coordinates. The surface therefore follows manual
// calibration, smoothing, mirror, distance and rotation without a stale mask.
export function surfaceFromContour(nail: NailPose, contour: { x: number; y: number }[], aspect: number, confidence: number): NailSurface | undefined {
  const angle = (nail.rotation - 90) * Math.PI / 180, ax = Math.cos(angle), ay = Math.sin(angle);
  const points = contour.map(p => {
    const x = (p.x - nail.x) * aspect, y = p.y - nail.y;
    return { u: (-ay * x + ax * y) / (nail.width * aspect), v: (ax * x + ay * y) / nail.height };
  });
  const rows: NailSurface["rows"] = [];
  for (const v of [0.005, 0.04, 0.09, 0.16, 0.26, 0.4, 0.55, 0.7, 0.82, 0.91, 0.96, 0.995]) {
    const cuts: number[] = [];
    points.forEach((a, index) => {
      const b = points[(index + 1) % points.length];
      if ((a.v <= v && b.v > v) || (b.v <= v && a.v > v)) cuts.push(a.u + (b.u - a.u) * (v - a.v) / (b.v - a.v));
    });
    cuts.sort((a, b) => a - b);
    // Do not bridge an occluder or disconnected colour fragments.
    if (cuts.length !== 2 || cuts[1] <= cuts[0]) return;
    rows.push({ v, left: cuts[0], right: cuts[1] });
  }
  const surface = { rows, confidence };
  return validNailSurface(surface) ? surface : undefined;
}

export function validNailSurface(surface?: NailSurface): surface is NailSurface {
  return Boolean(surface && Number.isFinite(surface.confidence) && surface.confidence >= 0.8 && Array.isArray(surface.rows) && surface.rows.length >= 6 && surface.rows.length <= 24
    && surface.rows.every((r, i, all) => r && Number.isFinite(r.v) && Number.isFinite(r.left) && Number.isFinite(r.right)
      && r.v >= 0 && r.v <= 1 && r.left >= -0.6 && r.right <= 0.6 && r.left < r.right
      && (!i || r.v > all[i - 1].v)
      && (r.v < 0.2 || r.v > 0.8 || r.right - r.left >= 0.3))
    && surface.rows[0].v < 0.1 && surface.rows.at(-1)!.v > 0.9);
}

export function buildSurfacePath(ctx: CanvasRenderingContext2D, width: number, height: number, length: number, shape: NailShape, surface?: NailSurface) {
  if (!validNailSurface(surface) || !(length > 0)) return false;
  const rows = surface.rows.map(row => {
    // Root and lower nail bed remain at their observed positions. Only the
    // distal part is extended; decorative length never moves the cuticle.
    const v = length >= 1 ? row.v <= 0.65 ? row.v : 0.65 + (row.v - 0.65) * (length - 0.65) / 0.35 : row.v * length;
    const mix = shape === "natural" ? 0 : Math.max(0, (row.v - 0.65) / 0.35);
    const t = Math.max(0, (row.v - 0.5) / 0.5);
    const tipWidth = shape === "square" || shape === "squoval" ? 0.47 : shape === "coffin" ? 0.47 - t * 0.15
      : shape === "stiletto" ? 0.5 * (1 - t) : shape === "almond" ? 0.5 * Math.pow(1 - t, 0.65) : 0.5 * Math.sqrt(Math.max(0, 1 - t * t));
    return { y: height / 2 - v * height / length,
      left: (row.left * (1 - mix) - tipWidth * mix) * width,
      right: (row.right * (1 - mix) + tipWidth * mix) * width };
  });
  ctx.beginPath(); ctx.moveTo(rows[0].left, rows[0].y);
  for (const row of rows.slice(1)) ctx.lineTo(row.left, row.y);
  for (const row of [...rows].reverse()) ctx.lineTo(row.right, row.y);
  ctx.closePath();
  return true;
}
