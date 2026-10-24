export type SceneLighting = { brightness: number; warmth: number };
export const neutralLighting: SceneLighting = { brightness: 0.65, warmth: 0 };

// Read only a tiny hand-region thumbnail, at most four times per second.
export function sampleSceneLighting(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  region: { x: number; y: number; width: number; height: number },
  previous: SceneLighting,
): SceneLighting {
  try {
    context.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, 24, 24);
    const pixels = context.getImageData(0, 0, 24, 24).data;
    let red = 0, green = 0, blue = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      red += pixels[offset]; green += pixels[offset + 1]; blue += pixels[offset + 2];
    }
    const count = pixels.length / 4 * 255;
    const brightness = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / count;
    const warmth = Math.max(-1, Math.min(1, (red - blue) / count));
    return {
      brightness: previous.brightness * 0.8 + brightness * 0.2,
      warmth: previous.warmth * 0.8 + warmth * 0.2,
    };
  } catch {
    // Cross-origin photos must still render even if their pixels cannot be read.
    return previous;
  }
}
