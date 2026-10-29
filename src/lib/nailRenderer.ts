import type { NailDesign, NailPose } from "./types";
import { neutralLighting, type SceneLighting } from "./sceneLighting";
import { nailCanvasGeometry } from "./nailPoseMetrics";

const textureCache = new Map<string, Promise<HTMLImageElement>>();
const readyTextures = new Map<string, HTMLImageElement>();

function loadImage(url: string) {
  if (!textureCache.has(url)) {
    textureCache.set(
      url,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        const timer = window.setTimeout(() => reject(new Error("Texture timed out")), 8000);
        image.onload = () => {
          window.clearTimeout(timer);
          readyTextures.set(url, image);
          if (readyTextures.size > 16) readyTextures.delete(readyTextures.keys().next().value!);
          resolve(image);
        };
        image.onerror = (error) => { window.clearTimeout(timer); reject(error); };
        image.src = url;
      }),
    );
    // Keep the cache bounded when users browse many designs.
    if (textureCache.size > 16) textureCache.delete(textureCache.keys().next().value!);
  }
  return textureCache.get(url)!;
}

export async function drawNails(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  nails: NailPose[],
  design: NailDesign,
  options: { isCurrent?: () => boolean; clear?: boolean; opacity?: number; lighting?: SceneLighting; waitForTexture?: boolean; viewport?: { x: number; y: number; width: number; height: number } } = {},
) {
  // Resolve I/O before touching the shared Canvas state. No await is allowed
  // between save/clip/restore: an older texture frame must never overpaint a new one.
  let texture: HTMLImageElement | undefined;
  if (design.textureUrl) {
    const pending = loadImage(design.textureUrl).catch(() => undefined);
    texture = options.waitForTexture === false ? readyTextures.get(design.textureUrl) : await pending;
  }
  if (options.isCurrent && !options.isCurrent()) return false;
  if (options.clear) ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.save();
  ctx.globalAlpha *= options.opacity ?? 1;
  try {
    const viewport = options.viewport ?? { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
    ctx.beginPath();
    ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
    ctx.clip();
    ctx.translate(viewport.x, viewport.y);
    for (let index = 0; index < nails.length; index += 1) {
      const nail = nails[index];
      const visibility = nail.visibility === undefined ? 1 : Number.isFinite(nail.visibility) ? Math.max(0, Math.min(1, nail.visibility)) : 0;
      if (visibility === 0) continue;
      const contour = nail.clipContour;
      if (nail.visibilityState === "partial" && (!contour || contour.length < 3)) continue;
      ctx.save();
      try {
        ctx.globalAlpha *= visibility;
        if (contour) {
          const rings = [contour, ...(nail.clipHoles ?? [])];
          if (rings.length > 17 || rings.reduce((sum, ring) => sum + ring.length, 0) > 128
            || !rings.every(ring => ring.length >= 3 && ring.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)))) continue;
          ctx.beginPath();
          for (const ring of rings) {
            ctx.moveTo(ring[0].x / 100 * viewport.width, ring[0].y / 100 * viewport.height);
            for (const point of ring.slice(1)) ctx.lineTo(point.x / 100 * viewport.width, point.y / 100 * viewport.height);
            ctx.closePath();
          }
          ctx.clip("evenodd");
        }
        drawNail(ctx, viewport.width, viewport.height, nail, design, index, texture, options.lighting);
      } finally { ctx.restore(); }
    }
  } finally {
    ctx.restore();
  }
  return true;
}

function drawNail(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  nail: NailPose,
  design: NailDesign,
  index = 0,
  texture?: HTMLImageElement,
  lighting: SceneLighting = neutralLighting,
) {
  const widthScale = design.shape === "square" || design.shape === "squoval" ? 1.05 : design.shape === "coffin" ? 1.1 : 1;
  const geometry = nailCanvasGeometry(nail, canvasWidth, canvasHeight, design.length, widthScale);
  const { width, height } = geometry;
  const { x: rootX, y: rootY } = geometry.root;
  const { x: centerX, y: centerY } = geometry.center;

  drawRootShadow(ctx, rootX, rootY, nail.rotation, width, design);
  ctx.save();
  try {
    ctx.translate(centerX, centerY);
    ctx.rotate((nail.rotation * Math.PI) / 180);
    buildNailPath(ctx, width, height, design.shape);
    ctx.clip();

    const rootBlend = ctx.createLinearGradient(0, -height / 2, 0, height / 2);
    const sheer = design.material === "sheer" || design.material === "jelly" || design.finish === "sheer";
    rootBlend.addColorStop(0, withAlpha(design.color, sheer ? 0.5 : 0.94));
    rootBlend.addColorStop(0.7, withAlpha(design.color, sheer ? 0.42 : 0.87));
    rootBlend.addColorStop(1, withAlpha(design.color, sheer ? 0.16 : 0.4));
    ctx.fillStyle = rootBlend;
    ctx.fillRect(-width / 2, -height / 2, width, height);

    if (texture) {
      const scale = Math.max(width / texture.width, height / texture.height) * 1.25;
      const tw = texture.width * scale;
      const th = texture.height * scale;
      const drift = ((index % 5) - 2) * width * 0.09;
      const opacity = ctx.globalAlpha;
      ctx.globalAlpha *= design.realism * 0.72;
      ctx.drawImage(texture, -tw / 2 + drift, -th / 2, tw, th);
      ctx.globalAlpha = opacity;
    }

    drawPattern(ctx, width, height, design);
    drawMaterial(ctx, width, height, design);
    drawDepth(ctx, width, height, design, lighting);
  } finally {
    ctx.restore();
  }
}

export function buildNailPath(ctx: CanvasRenderingContext2D, width: number, height: number, shape: NailDesign["shape"]) {
  if (shape === "square" || shape === "squoval") {
    ctx.beginPath();
    roundRect(ctx, -width * .47, -height * .5, width * .94, height, shape === "squoval" ? width * .28 : width * .1);
    return;
  }

  if (shape === "stiletto") {
    ctx.beginPath();
    ctx.moveTo(0, -height * .54);
    ctx.bezierCurveTo(-width * .18, -height * .4, -width * .46, height * .08, -width * .44, height * .3);
    ctx.quadraticCurveTo(-width * .4, height * .5, 0, height * .5);
    ctx.quadraticCurveTo(width * .4, height * .5, width * .44, height * .3);
    ctx.bezierCurveTo(width * .46, height * .08, width * .18, -height * .4, 0, -height * .54);
    ctx.closePath();
    return;
  }

  const isRound = shape === "round" || shape === "natural";
  const waist = shape === "coffin" ? .76 : shape === "almond" ? .62 : isRound ? .88 : .76;
  const tipY = shape === "almond" ? -.54 : -.5;
  ctx.beginPath();
  ctx.moveTo(-width * waist * 0.5, -height * 0.36);
  ctx.quadraticCurveTo(-width * 0.5, -height * 0.15, -width * 0.47, height * 0.24);
  ctx.quadraticCurveTo(-width * 0.43, height * 0.49, 0, height * 0.5);
  ctx.quadraticCurveTo(width * 0.43, height * 0.49, width * 0.47, height * 0.24);
  ctx.quadraticCurveTo(width * 0.5, -height * 0.15, width * waist * 0.5, -height * 0.36);
  ctx.quadraticCurveTo(width * (isRound ? .4 : .27), tipY * height, 0, tipY * height);
  ctx.quadraticCurveTo(-width * (isRound ? .4 : .27), tipY * height, -width * waist * .5, -height * .36);
  ctx.closePath();
}

function drawPattern(ctx: CanvasRenderingContext2D, width: number, height: number, design: NailDesign) {
  if (design.pattern === "gradient") {
    const gradient = ctx.createLinearGradient(0, -height / 2, 0, height / 2);
    gradient.addColorStop(0, withAlpha(design.tipColor, 0.7));
    gradient.addColorStop(0.45, withAlpha(design.color, 0.2));
    gradient.addColorStop(1, withAlpha(design.color, 0.1));
    ctx.fillStyle = gradient;
    ctx.fillRect(-width / 2, -height / 2, width, height);
  }

  if (design.pattern === "french") {
    ctx.fillStyle = withAlpha(design.tipColor, 0.92);
    ctx.beginPath();
    roundRect(ctx, -width * 0.44, -height * 0.5, width * 0.88, height * design.tipAmount, width * 0.2);
    ctx.fill();
  }

  if (design.motif !== "none" && design.pattern !== "solid") {
    ctx.fillStyle = withAlpha(design.motifColor, 0.72);
    const gap = Math.max(8, width * 0.28);
    for (let y = -height * 0.25; y < height * 0.34; y += gap) {
      for (let x = -width * 0.28; x < width * 0.29; x += gap) {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.4, width * 0.035), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawMaterial(ctx: CanvasRenderingContext2D, width: number, height: number, design: NailDesign) {
  if (design.finish === "chrome" || design.material === "metallic") {
    const chrome = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
    chrome.addColorStop(0, "rgba(255,255,255,0.05)");
    chrome.addColorStop(0.28, "rgba(255,255,255,0.65)");
    chrome.addColorStop(0.5, "rgba(40,40,60,0.14)");
    chrome.addColorStop(0.72, "rgba(255,255,255,0.55)");
    chrome.addColorStop(1, "rgba(0,0,0,0.1)");
    ctx.fillStyle = chrome;
    ctx.fillRect(-width / 2, -height / 2, width, height);
  }

  if (design.finish === "sparkle" || design.material === "glitter" || design.material === "shimmer") {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i < 22; i += 1) {
      const x = Math.sin(i * 12.9898) * 10000;
      const y = Math.cos(i * 78.233) * 10000;
      ctx.beginPath();
      ctx.arc(((x - Math.floor(x)) - 0.5) * width, ((y - Math.floor(y)) - 0.5) * height, Math.max(0.6, width * 0.018), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawDepth(ctx: CanvasRenderingContext2D, width: number, height: number, design: NailDesign, lighting: SceneLighting) {
  const alpha = 0.07 + design.thickness * 0.1 + design.realism * 0.04;
  const side = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
  side.addColorStop(0, `rgba(0,0,0,${alpha})`);
  side.addColorStop(0.28, "rgba(255,255,255,0.1)");
  side.addColorStop(0.5, "rgba(255,255,255,0.1)");
  side.addColorStop(0.74, "rgba(255,255,255,0.08)");
  side.addColorStop(1, `rgba(0,0,0,${alpha * 0.7})`);
  ctx.fillStyle = side;
  ctx.fillRect(-width / 2, -height / 2, width, height);

  const gloss = (0.15 + design.realism * 0.35) * (0.45 + lighting.brightness * 0.55);
  // A broad, soft reflection follows the nail's local curve, with a narrow
  // highlight on top. Both rotate with the finger instead of the screen.
  ctx.save();
  ctx.scale(width, height);
  const reflection = ctx.createRadialGradient(-0.14, -0.12, 0.01, -0.08, 0, 0.42);
  reflection.addColorStop(0, `rgba(255,${Math.round(253 - lighting.warmth * 8)},${Math.round(250 - lighting.warmth * 15)},${gloss})`);
  reflection.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = reflection;
  ctx.fillRect(-0.5, -0.5, 1, 1);
  ctx.restore();
  ctx.strokeStyle = `rgba(255,255,255,${gloss * 0.75})`;
  ctx.lineWidth = Math.max(0.5, width * 0.035);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-width * 0.14, -height * 0.36);
  ctx.bezierCurveTo(width * 0.05, -height * 0.18, width * 0.12, height * 0.1, width * 0.02, height * 0.38);
  ctx.stroke();
}

function drawRootShadow(
  ctx: CanvasRenderingContext2D,
  rootX: number,
  rootY: number,
  rotation: number,
  width: number,
  design: NailDesign,
) {
  ctx.save();
  ctx.translate(rootX, rootY);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.fillStyle = `rgba(65, 40, 34, ${0.04 + design.realism * 0.05})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, width * 0.43, width * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "").padEnd(6, "0");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
