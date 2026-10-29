import { applyCalibration, calibrateNail, type NailCalibration } from "./nailCalibration";
import { refineNailsFromPixels, type NailRefinementResult } from "./nailImageRefinement";
import type { NailPose } from "./types";

export class NailFrameRefiner {
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private lastAt = -Infinity;
  private previous: NailPose[] = [];
  private corrections: NailCalibration[] = [];
  private result: NailRefinementResult | null = null;
  private sourceAspect = 0;
  private mirrored = false;

  refine(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, nails: NailPose[], mirrored: boolean, now: number, requireFreshContour = false): NailRefinementResult {
    const fallback = (): NailRefinementResult => ({ nails, diagnostics: nails.map(() => ({ accepted: false, confidence: 0, reason: "pixels-unavailable" })) });
    if (nails.length !== 5 || sourceWidth <= 0 || sourceHeight <= 0) {
      this.result = null;
      return fallback();
    }
    const aspect = sourceWidth / sourceHeight;
    const reusable = !requireFreshContour && this.result && now >= this.lastAt && now - this.lastAt < 150
      && Math.abs(aspect / this.sourceAspect - 1) < 0.005 && mirrored === this.mirrored
      && this.previous.every((previous, index) => {
        const current = nails[index];
        const angle = ((current.rotation - previous.rotation + 540) % 360) - 180;
        return Math.abs(angle) < 15 && Math.abs(current.width / previous.width - 1) < 0.2
          && Math.abs(current.height / previous.height - 1) < 0.15
          && Math.hypot((current.x - previous.x) * aspect, current.y - previous.y) < previous.height;
      });
    if (reusable) return {
      nails: nails.map((nail, index) => applyCalibration(nail, this.corrections[index], aspect)),
      diagnostics: this.result!.diagnostics.map((diagnostic) => ({ ...diagnostic, outline: undefined, contour: undefined, contourHoles: undefined,
        contourStatus: diagnostic.accepted ? "stale" : undefined, reason: diagnostic.accepted ? "recent-relative-fit" : diagnostic.reason })),
    };
    try {
      this.canvas ??= document.createElement("canvas");
      this.context ??= this.canvas.getContext("2d", { willReadFrequently: true });
      if (!this.context) return fallback();
      const scale = Math.min(1, 640 / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale)), height = Math.max(1, Math.round(sourceHeight * scale));
      if (this.canvas.width !== width) this.canvas.width = width;
      if (this.canvas.height !== height) this.canvas.height = height;
      this.context.drawImage(source, 0, 0, width, height);
      const pixels = this.context.getImageData(0, 0, width, height);
      const result = refineNailsFromPixels(pixels, nails, mirrored);
      this.result = result;
      this.previous = nails;
      this.corrections = result.nails.map((nail, index) => calibrateNail(nails[index], nail, aspect));
      this.lastAt = now;
      this.sourceAspect = aspect;
      this.mirrored = mirrored;
      return result;
    } catch {
      // Tainted, unavailable or unsupported Canvas pixel reads cannot break tracking.
      this.result = null;
      return fallback();
    }
  }

  dispose() {
    if (this.canvas) this.canvas.width = this.canvas.height = 1;
    this.canvas = null;
    this.context = null;
    this.result = null;
    this.previous = [];
    this.corrections = [];
  }
}
