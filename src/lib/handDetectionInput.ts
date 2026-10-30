export type NormalizedLandmark = { x: number; y: number; z?: number };
export type HandDetectionState = "searching" | "detected" | "lost";
export type DetectionInputMode = "video" | "canvas-native" | "canvas-960" | "canvas-640";

export function selectDetectionInputMode(current: DetectionInputMode, missingForMs: number): DetectionInputMode {
  if (missingForMs >= 8000) return "canvas-640";
  if (missingForMs >= 5000) return "canvas-native";
  if (missingForMs >= 2500) return "video";
  return current;
}

export function calculateProcessingSize(sourceWidth: number, sourceHeight: number, maxWidth?: number) {
  if (!maxWidth || sourceWidth <= maxWidth) return { width: sourceWidth, height: sourceHeight };
  const scale = maxWidth / sourceWidth;
  return { width: maxWidth, height: Math.max(1, Math.round(sourceHeight * scale)) };
}

export function nextHandDetectionState(
  everDetected: boolean,
  consecutiveMisses: number,
  detected: boolean,
): HandDetectionState {
  if (detected) return "detected";
  if (!everDetected) return "searching";
  return consecutiveMisses >= 3 ? "lost" : "detected";
}

export function mapLandmarkToPreview(point: NormalizedLandmark, mirrored: boolean) {
  return mirrored ? { x: 1 - point.x, y: point.y, z: point.z } : { ...point };
}
