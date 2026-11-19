import type { NailLandmark } from "./nailGeometry";
import type { HandPose } from "./handPose";
import type { NailPose } from "./types";

export type HandPhotoObservations = {
  view: HandPose["view"];
  tone?: "warm" | "cool" | "neutral";
  fingerToPalm?: number;
  nailRatio?: number;
  measuredNails: number;
};

export function summarizeHandPhoto(image: HTMLImageElement, points: NailLandmark[], pose: HandPose, nails: NailPose[]): HandPhotoObservations | null {
  if (points.length !== 21) return null;
  const result: HandPhotoObservations = { view: pose.view, measuredNails: 0 };
  if (pose.view !== "back" || pose.tiltDegrees > 45 || pose.confidence < .7) return result;
  const w = image.naturalWidth, h = image.naturalHeight;
  const distance = (a: NailLandmark, b: NailLandmark) => Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
  const palm = distance(points[0], points[9]);
  if (palm < 20) return result;
  const middle = pose.fingers[2];
  const finger = distance(points[9], points[12]);
  if (middle && middle.bendDegrees < 30 && finger > 0) result.fingerToPalm = finger / palm;
  const ratios = nails.filter(n => n.visibilityState === "visible" && n.clipContour).map(n => n.height * h / (n.width * w)).sort((a,b) => a-b);
  result.measuredNails = ratios.length;
  if (ratios.length >= 2) result.nailRatio = ratios[Math.floor(ratios.length / 2)];

  // Sample three small interior patches, not the background, nails or highlights.
  // These are colour casts in this photo, not skin undertone classification.
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx) return result;
  const side = palm * .11;
  const casts: number[] = [];
  for (const i of [5, 9, 17]) {
    const x = (points[i].x * .63 + points[0].x * .37) * w - side / 2;
    const y = (points[i].y * .63 + points[0].y * .37) * h - side / 2;
    if (x < 0 || y < 0 || x + side > w || y + side > h) return result;
    ctx.drawImage(image, x, y, side, side, 0, 0, 8, 8);
    const pixels = ctx.getImageData(0, 0, 8, 8).data, cast: number[] = [];
    for (let j = 0; j < pixels.length; j += 4) {
      const [r,g,b] = [pixels[j], pixels[j+1], pixels[j+2]];
      if (Math.min(r,g,b) > 35 && Math.max(r,g,b) < 247) cast.push((g-b) / (r+g+b));
    }
    if (cast.length < 40) return result;
    casts.push(cast.sort((a,b) => a-b)[Math.floor(cast.length / 2)]);
  }
  if (Math.max(...casts) - Math.min(...casts) <= .035) {
    const value = casts.sort((a,b) => a-b)[1];
    result.tone = value > .055 ? "warm" : value < .008 ? "cool" : "neutral";
  }
  return result;
}
