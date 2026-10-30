import type { NailPose } from "./types";
import { traceNailRegion } from "./nailContour";

type Pixels = { width: number; height: number; data: Uint8ClampedArray };
const rays = Array.from({ length: 24 }, (_, i) => {
  const t = i / 24 * Math.PI * 2, u = Math.cos(t), v = Math.sin(t);
  return { u, v, group: v < -0.45 ? 0 : u < -0.5 ? 1 : u > 0.5 ? 2 : 3 };
});
type Proposal = { cx: number; cy: number; width: number; height: number; score: number; gains: number[]; supported: number; cutoffs: number[] };

// Natural/pink plate cue relative to its OWN surrounding skin, not a skin-colour
// lookup table. Brightness-normalized chroma is less sensitive to a highlight
// joining the skin than the RGB flood fill. It is NOT semantic segmentation.
export function fitChromaticNail(image: Pixels, prior: NailPose, mirrored: boolean, options: { allowFragment?: boolean } = {}) {
  const w = prior.width / 100 * image.width, h = prior.height / 100 * image.height;
  if (w < 6 || h < 7) return;
  const a = (prior.rotation - 90) * Math.PI / 180, ax = Math.cos(a), ay = Math.sin(a);
  const rootX = prior.x / 100 * image.width, rootY = prior.y / 100 * image.height;
  const sample = (x: number, y: number, cue: "edge" | "pink" | "red" = "edge") => {
    const px = mirrored ? image.width - x : x, py = y;
    if (px < 0 || px >= image.width - 1 || py < 0 || py >= image.height - 1) return;
    // Sampling a rotated, small plate with nearest neighbours changes the mask
    // abruptly with subpixel motion. Interpolate source RGB, not displayed CSS.
    const ix = Math.floor(px), iy = Math.floor(py), dx = px - ix, dy = py - iy, i = (iy * image.width + ix) * 4;
    const value = (c: number) => (image.data[i + c] * (1 - dx) + image.data[i + 4 + c] * dx) * (1 - dy)
      + (image.data[i + image.width * 4 + c] * (1 - dx) + image.data[i + image.width * 4 + 4 + c] * dx) * dy;
    if (value(3) < 250) return;
    const r = value(0), g = value(1), b = value(2);
    if (r + g + b < 90 || Math.min(r, g, b) > 248) return;
    return (cue === "pink" ? r + b - 2 * g : cue === "red" ? r - g : b - g) / (r + g + b) * 255;
  };
  const proposals: Proposal[] = [];
  for (const along of [0.3, 0.5, 0.7, 0.9]) for (const side of [-0.4, 0, 0.4])
    for (const wf of [0.9, 1.3, 1.7, 2.1]) for (const hf of [0.7, 1, 1.4, 1.8]) {
      const cx = rootX + ax * along * h - ay * side * w, cy = rootY + ay * along * h + ax * side * w;
      const width = w * wf, height = h * hf, gains = [0, 0, 0, 0], counts = [0, 0, 0, 0], cutoffs: number[] = [];
      let supported = 0;
      for (const ray of rays) {
        const u = ray.u * width / 2, v = ray.v * height / 2;
        let inner = 0, outer = 0, valid = true;
        for (const scale of [0.4, 0.7, 0.85, 1.15, 1.35]) {
          const value = sample(cx - ay * u * scale + ax * v * scale, cy + ax * u * scale + ay * v * scale);
          if (value === undefined) { valid = false; break; }
          if (scale < 1) inner += value / 3; else outer += value / 2;
        }
        // Saturated/dark rays do not veto other independently supported parts,
        // but their sectors MUST be excluded from the eventual pixel mask.
        if (!valid) { cutoffs.push(NaN); continue; }
        const gain = inner - outer;
        gains[ray.group] += gain; counts[ray.group]++;
        if (gain > 0.6) supported++;
        cutoffs.push((inner + outer) / 2);
      }
      if (counts.some(count => count < 3)) continue;
      for (let i = 0; i < 4; i++) gains[i] /= counts[i];
      if (Math.min(...gains) < 0.6 || supported < 20) continue;
      // A neutral highlight on a finger is not a natural pink nail plate.
      // Require a green-deficit/pink cue in the centre as well as an exterior
      // chroma change. Tinted lighting can still fool a heuristic; no certainty.
      let pink = 0, red = 0;
      for (const [u, v] of [[0, 0], [-0.15, 0], [0.15, 0], [0, -0.15], [0, 0.15]]) {
        const x = cx - ay * u * width + ax * v * height, y = cy + ax * u * width + ay * v * height;
        pink += (sample(x, y, "pink") ?? -Infinity) / 5;
        red += (sample(x, y, "red") ?? -Infinity) / 5;
      }
      if (!(pink >= 4 && red >= 2)) continue;
      const score = Math.min(...gains.slice(0, 3)) + gains.reduce((s, x) => s + x, 0) / 4
        - Math.abs(side) * 1.5 - Math.abs(along - 0.5) * 1.2 - Math.abs(wf - 1) * 0.2 - Math.abs(hf - 1) * 0.2;
      if (score >= 4) proposals.push({ cx, cy, width, height, score, gains, supported, cutoffs });
    }
  proposals.sort((a, b) => b.score - a.score);
  for (const best of proposals.slice(0, 4)) {
    const pw = 32, ph = 48;
    const point = (x: number, y: number) => {
      const u = (x / (pw - 1) - 0.5) * best.width, v = (y / (ph - 1) - 0.5) * best.height;
      return { x: best.cx - ay * u + ax * v, y: best.cy + ax * u + ay * v };
    };
    // Source coverage is identical for all three threshold probes. Compute it
    // once, without thousands of corner-array allocations per candidate.
    const clearances = new Float64Array(pw * ph).fill(-Infinity);
    const halfX = (Math.abs(ay) * best.width / (pw - 1) + Math.abs(ax) * best.height / (ph - 1)) / 2;
    const halfY = (Math.abs(ax) * best.width / (pw - 1) + Math.abs(ay) * best.height / (ph - 1)) / 2;
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const u = (x / (pw - 1) - 0.5) * 2, v = (y / (ph - 1) - 0.5) * 2;
      // Window is an upper bound, NOT evidence. Pixels still have to satisfy
      // the measured chroma cue. Never fill the ellipse or convex hull.
      if (u * u + v * v > 0.96) continue;
      const t = ((Math.atan2(v, u) / (2 * Math.PI) + 1) % 1) * rays.length, index = Math.floor(t), fraction = t - index;
      const threshold = best.cutoffs[index] * (1 - fraction) + best.cutoffs[(index + 1) % rays.length] * fraction;
      const p = point(x, y), value = sample(p.x, p.y);
      if (value === undefined || !Number.isFinite(threshold)) continue;
      // A coarse cell covers MORE than its sample centre. Check every native
      // pixel in its source-space bounding box, including thin occluders and
      // alpha gaps. Supersampling alone could silently bridge a 1px stripe.
      const sourceX = mirrored ? image.width - p.x : p.x;
      let minimum = value;
      for (let sy = Math.floor(p.y - halfY); sy <= Math.floor(p.y + halfY); sy++)
        for (let sx = Math.floor(sourceX - halfX); sx <= Math.floor(sourceX + halfX); sx++) {
          if (sx < 0 || sx >= image.width || sy < 0 || sy >= image.height) { minimum = -Infinity; break; }
          const i = (sy * image.width + sx) * 4, r = image.data[i], g = image.data[i + 1], b = image.data[i + 2], alpha = image.data[i + 3];
          if (alpha < 250 || r + g + b < 90 || Math.min(r, g, b) > 248) { minimum = -Infinity; break; }
          minimum = Math.min(minimum, (b - g) / (r + g + b) * 255);
        }
      clearances[y * pw + x] = minimum - threshold;
    }
    const masks = [-0.35, 0, 0.35].map(margin => {
      const eligible = Uint8Array.from(clearances, clearance => clearance > margin ? 1 : 0);
      // Keep only the central connected component. Other fingers/highlights
      // cannot be joined to it by filling gaps or dilating the candidate.
      let seed = -1, closest = Infinity;
      for (let i = 0; i < eligible.length; i++) if (eligible[i]) {
        const distance = Math.hypot((i % pw - pw / 2) / pw, (Math.floor(i / pw) - ph / 2) / ph);
        if (distance < closest) { seed = i; closest = distance; }
      }
      const mask = new Uint8Array(eligible.length), queue: number[] = seed >= 0 && closest < 0.2 ? [seed] : [];
      if (queue.length) mask[queue[0]] = 1;
      for (let head = 0; head < queue.length; head++) {
        const i = queue[head], x = i % pw, y = Math.floor(i / pw);
        for (const j of [x ? i - 1 : -1, x < pw - 1 ? i + 1 : -1, y ? i - pw : -1, y < ph - 1 ? i + pw : -1])
          if (j >= 0 && eligible[j] && !mask[j]) { mask[j] = 1; queue.push(j); }
      }
      return mask;
    });
    const area = masks[1].reduce((s, x) => s + x, 0);
    let intersection = 0, union = 0;
    for (let i = 0; i < masks[0].length; i++) { if (masks[0][i] && masks[2][i]) intersection++; if (masks[0][i] || masks[2][i]) union++; }
    const minimumArea = pw * ph * (options.allowFragment ? 0.35 : 0.55);
    if (area < minimumArea || intersection / Math.max(1, union) < 0.75) continue;
    const mapPoint = (x: number, y: number) => {
      const p = point(x, y); return { x: p.x / image.width * 100, y: p.y / image.height * 100 };
    };
    let region = traceNailRegion(masks[1], pw, ph, mapPoint);
    let observedArea = area;
    // A diagonal touch/noisy boundary must not be bridged with a convex hull.
    // One inward erosion may produce a safe visible core; it only removes pixels.
    if (!region) {
      const core = new Uint8Array(masks[1].length);
      for (let y = 1; y < ph - 1; y++) for (let x = 1; x < pw - 1; x++) {
        const i = y * pw + x;
        if ([-pw - 1, -pw, -pw + 1, -1, 0, 1, pw - 1, pw, pw + 1].every(offset => masks[1][i + offset])) core[i] = 1;
      }
      const coreArea = core.reduce((s, x) => s + x, 0);
      if (coreArea >= Math.max(minimumArea, area * 0.65)) {
        region = traceNailRegion(core, pw, ph, mapPoint);
        observedArea = coreArea;
      }
    }
    if (!region) continue;
    const nail: NailPose = { ...prior, x: (best.cx - ax * best.height / 2) / image.width * 100,
      y: (best.cy - ay * best.height / 2) / image.height * 100, width: best.width / image.width * 100, height: best.height / image.height * 100 };
    return { nail, ...region, gains: best.gains, score: best.score, supported: best.supported,
      stability: intersection / Math.max(1, union), observedFraction: observedArea / (pw * ph),
      confidence: Math.min(0.95, 0.8 + Math.min(...best.gains) * 0.025), supportThresholds: 3 };
  }
}
