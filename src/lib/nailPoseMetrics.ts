import type { NailPose } from "./types";

export function nailCanvasGeometry(nail: NailPose, canvasWidth: number, canvasHeight: number, length = 1, widthScale = 1) {
  const width = nail.width / 100 * canvasWidth * widthScale;
  const height = nail.height / 100 * canvasHeight * length;
  const angle = (nail.rotation - 90) * Math.PI / 180;
  const root = { x: nail.x / 100 * canvasWidth, y: nail.y / 100 * canvasHeight };
  const tip = { x: root.x + Math.cos(angle) * height, y: root.y + Math.sin(angle) * height };
  return { root, tip, center: { x: (root.x + tip.x) / 2, y: (root.y + tip.y) / 2 }, width, height };
}
