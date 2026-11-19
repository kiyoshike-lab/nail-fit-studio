import type { NailFitDiagnostic } from "./nailImageRefinement";
import type { NailPose } from "./types";

// Opt-in for static photos, never a permission to reveal another finger.
// Full-nail masks are only used when a closed, supported colour boundary
// encloses the fitted plate near its centre and spans most of its length.
export function withPhotoContourFit(nails: NailPose[], fits: NailFitDiagnostic[], width: number, height: number): NailPose[] {
  if (!(width > 0 && height > 0)) return nails;
  return nails.map((nail, index) => {
    const fit = fits[index], contour = fit?.contour, holes = fit?.contourHoles ?? [];
    if (nail.visibilityState !== "visible" || !nail.visibility || !fit?.accepted
      || fit.reason !== "color-boundary" || fit.contourStatus !== "closed"
      || !(fit.confidence >= .85) || (fit.supportThresholds ?? 0) < 3 || !contour) return nail;
    const rings = [contour, ...holes], w = nail.width * width / 100, h = nail.height * height / 100;
    if (Math.min(w, h) < 6 || rings.length > 17 || rings.reduce((n, r) => n + r.length, 0) > 128
      || rings.some(r => r.length < 3 || r.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100))) return nail;
    const angle = nail.rotation * Math.PI / 180, sin = Math.sin(angle), cos = Math.cos(angle);
    const toLocal = (p: { x: number; y: number }) => {
      const x = (p.x - nail.x) * width / 100, y = (p.y - nail.y) * height / 100;
      return { x: (x * cos + y * sin) / w, y: (x * sin - y * cos) / h };
    };
    const local = contour.map(toLocal);
    const xs = local.map(p => p.x), ys = local.map(p => p.y);
    if (Math.min(...xs) < -.78 || Math.max(...xs) > .78 || Math.min(...ys) < -.24 || Math.max(...ys) > 1.24
      || Math.max(...xs) - Math.min(...xs) < .68 || Math.min(...ys) > .19 || Math.max(...ys) < .81) return nail;
    const area = Math.abs(local.reduce((sum, p, i) => {
      const next = local[(i + 1) % local.length];
      return sum + p.x * next.y - p.y * next.x;
    }, 0)) / 2;
    if (area < .50 || area > 1.3 || !coversCentre(local) || holes.some(r => coversCentre(r.map(toLocal)))) return nail;
    return { ...nail, clipContour: contour, clipHoles: holes };
  });
}

export function clearPhotoContourFit(nails: NailPose[]): NailPose[] {
  if (!nails.some(nail => nail.visibilityState === "visible" && nail.clipContour)) return nails;
  return nails.map(nail => nail.visibilityState === "visible" && nail.clipContour
    ? { ...nail, clipContour: undefined, clipHoles: undefined } : nail);
}

function coversCentre(ring: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > .5) !== (b.y > .5) && a.x + (b.x - a.x) * (.5 - a.y) / (b.y - a.y) > 0) inside = !inside;
  }
  return inside;
}
