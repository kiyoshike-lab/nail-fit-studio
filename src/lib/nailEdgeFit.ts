import type { NailPose } from "./types";
type Image = { width: number; height: number; data: Uint8ClampedArray };
const probes = Array.from({ length: 24 }, (_, k) => {
  const t = k / 24 * Math.PI * 2, u = Math.cos(t), v = Math.sin(t);
  return { u, v, group: v < -0.45 ? 0 : u < -0.5 ? 1 : u > 0.5 ? 2 : 3 };
});

// A bounded image-edge proposal, not a learned nail detector. It must have
// independent support at the estimated cuticle and BOTH sides, rather than
// just the free edge. This is not semantic proof of a nail: a similarly shaped
// finger/background region can still pass. Distances are relative to the nail.
export function fitNailFromEdges(image: Image, nail: NailPose, mirrored: boolean) {
  const w = nail.width / 100 * image.width, h = nail.height / 100 * image.height;
  if (w < 8 || h < 10) return;
  const a = (nail.rotation - 90) * Math.PI / 180, ax = Math.cos(a), ay = Math.sin(a);
  const rx = nail.x / 100 * image.width, ry = nail.y / 100 * image.height;
  const sample = (x: number, y: number) => {
    const px = Math.round(mirrored ? image.width - x : x), py = Math.round(y);
    if (px < 0 || px >= image.width || py < 0 || py >= image.height) return;
    const k = (py * image.width + px) * 4;
    return [image.data[k], image.data[k + 1], image.data[k + 2]];
  };
  const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / Math.sqrt(3);
  let best: { nail: NailPose; score: number; support: number[] } | undefined;
  for (const along of [0.3, 0.5, 0.7, 0.9, 1.1]) for (const side of [-0.3, 0, 0.3])
    for (const wf of [0.9, 1.25, 1.65]) for (const hf of [0.9, 1.3, 1.75]) {
      const cx = rx + ax * along * h - ay * side * w, cy = ry + ay * along * h + ax * side * w;
      const nw = w * wf, nh = h * hf;
      const inner: number[][] = [], outer: number[][] = [], groups: number[] = [], mean = [0, 0, 0];
      let valid = true;
      for (const probe of probes) {
        const u = probe.u * nw / 2, v = probe.v * nh / 2;
        const inside = sample(cx - ay * u * 0.78 + ax * v * 0.78, cy + ax * u * 0.78 + ay * v * 0.78);
        const outside = sample(cx - ay * u * 1.2 + ax * v * 1.2, cy + ax * u * 1.2 + ay * v * 1.2);
        if (!inside || !outside) { valid = false; break; }
        inner.push(inside); outer.push(outside);
        groups.push(probe.group);
        inside.forEach((value, channel) => { mean[channel] += value / 24; });
      }
      if (!valid) continue;
      const support = [0, 0, 0, 0], counts = [0, 0, 0, 0];
      let supported = 0, noise = 0;
      inner.forEach((rgb, k) => {
        const gain = distance(outer[k], mean) - distance(rgb, mean);
        support[groups[k]] += Math.max(-10, Math.min(35, gain)); counts[groups[k]]++;
        if (gain > 5) supported++;
        noise += distance(rgb, mean) / 24;
      });
      for (let g = 0; g < 4; g++) support[g] /= counts[g] || 1;
      if (support[0] < 7 || support[1] < 7 || support[2] < 7 || supported < 16 || noise > 28) continue;
      // The root and lateral exterior should agree photometrically. This rejects
      // many mixed skin/background candidates, but does not prove skin identity.
      const exterior = [0, 1, 2].map(group => [0, 1, 2].map(channel =>
        outer.reduce((sum, rgb, k) => sum + (groups[k] === group ? rgb[channel] : 0), 0) / (counts[group] || 1)));
      if (distance(exterior[0], exterior[1]) > 24 || distance(exterior[0], exterior[2]) > 24) continue;
      const score = Math.min(...support.slice(0, 3)) + support.reduce((s, v) => s + v, 0) / 8
        - noise * 0.25 - Math.abs(side) * 5 - Math.abs(along - 0.5) * 3 - Math.abs(wf - 1) - Math.abs(hf - 1);
      if (!best || score > best.score) best = { score, support, nail: { ...nail,
        x: (cx - ax * nh / 2) / image.width * 100, y: (cy - ay * nh / 2) / image.height * 100,
        width: nw / image.width * 100, height: nh / image.height * 100 } };
    }
  return best && best.score > 15 ? best : undefined;
}
