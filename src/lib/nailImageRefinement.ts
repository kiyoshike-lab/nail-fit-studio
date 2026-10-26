import type { NailPose } from "./types";

type PixelImage = { width: number; height: number; data: Uint8ClampedArray };
export type NailFitDiagnostic = {
  accepted: boolean; confidence: number; reason: string;
  rejected?: Record<string, number>; candidates?: number; supportThresholds?: number;
  outline?: { x: number; y: number }[];
};
export type NailRefinementResult = { nails: NailPose[]; diagnostics: NailFitDiagnostic[] };
const patchWidth = 48;

// An image-based proposal, not a trained nail segmentation model. Only a compact,
// contrasting region supported by the finger prior is eligible to replace it.
export function refineNailsFromPixels(image: PixelImage, nails: NailPose[], mirrored: boolean): NailRefinementResult {
  const diagnostics: NailFitDiagnostic[] = [];
  const refined = nails.map((nail, index) => {
    // Preserve the validated standard fit. Search further toward the free edge
    // only when it failed, and accept only clearly longer regions in that pass.
    const standard = refineFinger(image, nail, mirrored, index, false);
    const result = standard.diagnostic.accepted ? standard : refineFinger(image, nail, mirrored, index, true);
    const rejected = { ...standard.diagnostic.rejected };
    if (result !== standard) for (const [gate, count] of Object.entries(result.diagnostic.rejected ?? {})) rejected[gate] = (rejected[gate] ?? 0) + count;
    diagnostics.push({ ...result.diagnostic, rejected, candidates: (standard.diagnostic.candidates ?? 0) + (result === standard ? 0 : result.diagnostic.candidates ?? 0) });
    return result.nail;
  });
  return { nails: refined, diagnostics };
}

type Candidate = { nail: NailPose; score: number; contrast: number; threshold: number; outline: { x: number; y: number }[] };

function refineFinger(image: PixelImage, nail: NailPose, mirrored: boolean, finger: number, extended: boolean) {
  const patchHeight = extended ? 96 : 64;
  const alongSpan = extended ? 4.5 : 3;
  const rejected: Record<string, number> = {};
  const reject = (gate: string) => { rejected[gate] = (rejected[gate] ?? 0) + 1; };
  let candidateCount = 0, supportThresholds = 0;
  const fallback = (reason: string) => ({ nail, diagnostic: { accepted: false, confidence: 0, reason, rejected, candidates: candidateCount, supportThresholds } as NailFitDiagnostic });
  const width = nail.width / 100 * image.width;
  const height = nail.height / 100 * image.height;
  if (width < 5 || height < 7) return fallback("insufficient-pixels");
  const angle = (nail.rotation - 90) * Math.PI / 180;
  const ax = Math.cos(angle), ay = Math.sin(angle);
  const rootX = nail.x / 100 * image.width, rootY = nail.y / 100 * image.height;
  const rgb = new Float32Array(patchWidth * patchHeight * 3);
  const valid = new Uint8Array(patchWidth * patchHeight);
  const point = (px: number, py: number) => {
    const side = (px / (patchWidth - 1) - 0.5) * width * 3;
    const along = (py / (patchHeight - 1) * alongSpan - 1) * height;
    return { x: rootX + ax * along - ay * side, y: rootY + ay * along + ax * side };
  };
  for (let y = 0; y < patchHeight; y++) for (let x = 0; x < patchWidth; x++) {
    const position = point(x, y);
    const sx = Math.floor(mirrored ? image.width - position.x : position.x), sy = Math.floor(position.y);
    const index = y * patchWidth + x;
    if (sx < 0 || sx >= image.width || sy < 0 || sy >= image.height) continue;
    valid[index] = 1;
    const offset = (sy * image.width + sx) * 4;
    for (let channel = 0; channel < 3; channel++) rgb[index * 3 + channel] = image.data[offset + channel];
  }
  const candidates: Candidate[] = [];
  const expectedArea = patchWidth * patchHeight / (3 * alongSpan);
  const sideSeeds = finger === 0 ? [-0.4, 0, 0.4] : [-0.15, 0, 0.15];
  for (const along of extended ? [0.5, 1.8, 2.5] : [0.1, 0.5, 0.9, 1.25]) for (const side of sideSeeds) {
    const seedX = Math.round((side / 3 + 0.5) * (patchWidth - 1));
    const seedY = Math.round((along + 1) / alongSpan * (patchHeight - 1));
    const seed = seedY * patchWidth + seedX;
    if (!valid[seed]) continue;
    const color = [0, 0, 0];
    let samples = 0;
    for (let y = seedY - 1; y <= seedY + 1; y++) for (let x = seedX - 1; x <= seedX + 1; x++) {
      const index = y * patchWidth + x;
      if (!valid[index]) continue;
      for (let channel = 0; channel < 3; channel++) color[channel] += rgb[index * 3 + channel];
      samples++;
    }
    for (let channel = 0; channel < 3; channel++) color[channel] /= samples;
    for (const threshold of [12, 20, 30, 42]) {
      const visited = new Uint8Array(valid.length);
      const queue = new Int32Array(valid.length);
      let head = 0, tail = 1;
      queue[0] = seed; visited[seed] = 1;
      while (head < tail) {
        const index = queue[head++], x = index % patchWidth, y = Math.floor(index / patchWidth);
        for (const neighbor of [x > 0 ? index - 1 : -1, x < patchWidth - 1 ? index + 1 : -1, y > 0 ? index - patchWidth : -1, y < patchHeight - 1 ? index + patchWidth : -1]) {
          if (neighbor < 0 || visited[neighbor]) continue;
          visited[neighbor] = 1;
          if (!valid[neighbor]) continue;
          const red = color[0] - rgb[neighbor * 3], green = color[1] - rgb[neighbor * 3 + 1], blue = color[2] - rgb[neighbor * 3 + 2];
          if (red * red + green * green + blue * blue <= threshold * threshold * 3) queue[tail++] = neighbor;
        }
      }
      if (tail < expectedArea * 0.3 || tail > expectedArea * (extended ? 4.5 : 3.4)) { reject("area"); continue; }
      const members = queue.subarray(0, tail);
      let minX = patchWidth, maxX = 0, minY = patchHeight, maxY = 0, xSum = 0, ySum = 0;
      const inside = new Uint8Array(valid.length);
      for (const index of members) {
        const x = index % patchWidth, y = Math.floor(index / patchWidth);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        xSum += x; ySum += y; inside[index] = 1;
      }
      if (minX < 2 || maxX >= patchWidth - 2 || minY < 2 || maxY >= patchHeight - 2) { reject("patch-edge"); continue; }
      const fill = tail / ((maxX - minX + 1) * (maxY - minY + 1));
      if (fill < 0.48) { reject("fill"); continue; }
      // A square free edge can fill more than 96% of its box. Accept that
      // geometry only with a rounded/narrower cuticle and stronger contrast,
      // never a uniform rectangular patch of background or finger skin.
      const squarePlate = fill > 0.96;
      if (squarePlate) {
        const rootRows = Math.max(2, Math.ceil((maxY - minY + 1) * 0.15));
        let rootArea = 0;
        for (const index of members) if (Math.floor(index / patchWidth) < minY + rootRows) rootArea++;
        if (rootArea / rootRows > (maxX - minX + 1) * 0.9) { reject("unshaped-region"); continue; }
      }
      const centerSide = (xSum / tail / (patchWidth - 1) - 0.5) * 3;
      const centerAlong = ySum / tail / (patchHeight - 1) * alongSpan - 1;
      const candidateWidth = (maxX - minX + 1) / (patchWidth - 1) * width * 3;
      const candidateHeight = (maxY - minY + 1) / (patchHeight - 1) * height * alongSpan;
      const longNail = candidateHeight / height > 1.7;
      if (extended && !longNail) { reject("not-long"); continue; }
      const rootAlong = minY / (patchHeight - 1) * alongSpan - 1;
      // A long free edge must still begin near the predicted cuticle. Extending
      // the ROI must not turn the finger shaft or neighbouring skin into a nail.
      if (extended && (rootAlong < -0.45 || rootAlong > 0.65 || Math.abs(centerSide) > 0.45)) { reject("cuticle-prior"); continue; }
      if (Math.abs(centerSide) > (finger === 0 ? 0.8 : 0.6) || centerAlong < -0.35 || centerAlong > (extended ? 1.95 : 1.35)) { reject("position"); continue; }
      if (candidateWidth / width < 0.55 || candidateWidth / width > 2 || candidateHeight / height < 0.5 || candidateHeight / height > (extended ? 3.25 : 2)) { reject("size"); continue; }
      if (candidateHeight / candidateWidth < 0.55 || candidateHeight / candidateWidth > (extended ? 6 : 3.8)) { reject("aspect"); continue; }
      const innerMean = [0, 0, 0], outerMean = [0, 0, 0];
      const border = new Set<number>();
      for (const index of members) {
        for (let channel = 0; channel < 3; channel++) innerMean[channel] += rgb[index * 3 + channel] / tail;
        for (const neighbor of [index - 1, index + 1, index - patchWidth, index + patchWidth]) {
          if (valid[neighbor] && !inside[neighbor]) border.add(neighbor);
        }
      }
      if (!border.size) { reject("no-border"); continue; }
      for (const index of border) for (let channel = 0; channel < 3; channel++) outerMean[channel] += rgb[index * 3 + channel] / border.size;
      const contrast = Math.sqrt(innerMean.reduce((sum, value, channel) => sum + (value - outerMean[channel]) ** 2, 0) / 3);
      if (contrast < (squarePlate ? 20 : extended ? 18 : 13)) { reject("contrast"); continue; }
      // Pixel PCA rotation was evaluated, but worsened mean angle error on the
      // local real-image set. Preserve the distal-axis rotation until validated.
      const root = point((minX + maxX) / 2, minY - 0.5);
      const fitted: NailPose = { ...nail, x: root.x / image.width * 100, y: root.y / image.height * 100,
        width: candidateWidth / image.width * 100, height: candidateHeight / image.height * 100 };
      const score = Math.min(1, contrast / 45) * 0.45 + Math.max(0, 1 - Math.abs(fill - 0.75)) * 0.25
        + Math.max(0, 1 - Math.abs(centerSide) - Math.abs(centerAlong - 0.4) * 0.5) * 0.3;
      const outline = Array.from(border).filter((_, index) => index % Math.max(1, Math.floor(border.size / 40)) === 0)
        .map((index) => { const position = point(index % patchWidth, Math.floor(index / patchWidth)); return { x: position.x / image.width * 100, y: position.y / image.height * 100 }; });
      candidates.push({ nail: fitted, score, contrast, threshold, outline });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  candidateCount = candidates.length;
  const best = candidates[0];
  if (!best) return fallback("no-reliable-boundary");
  const support = candidates.filter((candidate) =>
    Math.abs(candidate.nail.width / best.nail.width - 1) < 0.2 && Math.abs(candidate.nail.height / best.nail.height - 1) < 0.2
    && Math.hypot(candidate.nail.x - best.nail.x, candidate.nail.y - best.nail.y) < nail.height * 0.25);
  supportThresholds = new Set(support.map((candidate) => candidate.threshold)).size;
  if (supportThresholds < 2 || best.score < 0.65) return fallback("unstable-boundary");
  return { nail: best.nail, diagnostic: { accepted: true, confidence: best.score, reason: "color-boundary", rejected, candidates: candidateCount, supportThresholds, outline: best.outline } };
}
