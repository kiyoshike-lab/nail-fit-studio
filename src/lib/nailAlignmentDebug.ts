import type { NailLandmark } from "./nailGeometry";
import type { NailFitDiagnostic } from "./nailImageRefinement";
import type { NailPose } from "./types";
import type { HandPose } from "./handPose";
import type { NailVisibilityEvidence } from "./nailVisibility";

export type NailAlignmentFrame = {
  landmarks: NailLandmark[];
  coarse: NailPose[];
  refined: NailPose[];
  stable: NailPose[];
  fits: NailFitDiagnostic[];
  sourceWidth: number;
  sourceHeight: number;
  mirrored: boolean;
  timestamp: number;
  sourceMode: "photo" | "camera";
  pose?: HandPose;
  visibility?: NailVisibilityEvidence[];
};

let listener: ((frame: NailAlignmentFrame) => void) | null = null;
let lastFrame: NailAlignmentFrame | null = null;

export function subscribeNailAlignmentDebug(callback: (frame: NailAlignmentFrame) => void) {
  if (process.env.NODE_ENV === "production") return () => undefined;
  listener = callback;
  if (lastFrame) callback(lastFrame);
  return () => { if (listener === callback) listener = null; };
}

export function publishNailAlignmentDebug(frame: NailAlignmentFrame) {
  if (process.env.NODE_ENV !== "production") {
    lastFrame = frame;
    listener?.(frame);
  }
}
