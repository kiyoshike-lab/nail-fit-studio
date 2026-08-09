import type { NailDesign, NailPose } from "./types";

const textureCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string) {
  if (!textureCache.has(url)) {
    textureCache.set(
      url,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      }),
    );
  }
  return textureCache.get(url)!;
}

export async function drawNails(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  nails: NailPose[],
  design: NailDesign,
) {
  for (let index = 0; index < nails.length; index += 1) {
    await drawNail(ctx, canvasWidth, canvasHeight, nails[index], design, index);
  }
}

export async function drawNail(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  nail: NailPose,
  design: NailDesign,
  index = 0,
) {
  const baseWidth = (nail.width / 100) * canvasWidth;
  const baseHeight = (nail.height / 100) * canvasHeight;
  const width = baseWidth * (design.shape === "square" ? 1.05 : design.shape === "coffin" ? 1.1 : 1);
  const height = baseHeight * design.length;

  // Keep the cuticle/root visually locked and grow toward the fingertip.
  const angle = ((nail.rotation - 90) * Math.PI) / 180;
  const rootX = (nail.x / 100) * canvasWidth;
  const rootY = (nail.y / 100) * canvasHeight;
  const centerX = rootX + Math.cos(angle) * height * 0.5;
  const centerY = rootY + Math.sin(angle) * height * 0.5;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((nail.rotation * Math.PI) / 180);
  buildNailPath(ctx, width, height, design.shape);
  ctx.clip();

  const rootBlend = ctx.createLinearGradient(0, -height / 2, 0, height / 2);
  rootBlend.addColorStop(0, withAlpha(design.color, design.material === "sheer" ? 0.32 : 0.66));
  rootBlend.addColorStop(0.22, withAlpha(design.color, design.material === "sheer" ? 0.62 : 0.9));
  rootBlend.addColorStop(1, design.color);
  ctx.fillStyle = rootBlend;
  ctx.fillRect(-width / 2, -height / 2, width, height);

  if (design.textureUrl) {
    try {
      const texture = await loadImage(design.textureUrl);
      const scale = Math.max(width / texture.width, height / texture.height) * 1.25;
      const tw = texture.width * scale;
      const th = texture.height * scale;
      const drift = ((index % 5) - 2) * width * 0.09;
      ctx.globalAlpha = design.realism * 0.52;
      ctx.drawImage(texture, -tw / 2 + drift, -th / 2, tw, th);
      ctx.globalAlpha = 1;
    } catch {
      // Missing texture should not break try-on.
    }
  }

  drawPattern(ctx, width, height, design);
  drawMaterial(ctx, width, height, design);
  drawDepth(ctx, width, height, design);
  ctx.restore();

  drawRootShadow(ctx, rootX, rootY, nail.rotation, width, design);
}

function buildNailPath(ctx: CanvasRenderingContext2D, width: number, height: number, shape: NailDesign["shape"]) {
  const topRound = shape === "square" ? width * 0.16 : shape === "coffin" ? width * 0.24 : width * 0.48;
  const waist = shape === "coffin" ? 0.84 : shape === "almond" ? 0.72 : 0.92;
  const rootRound = width * 0.42;
  ctx.beginPath();
  ctx.moveTo(-width * waist * 0.5, -height * 0.36);
  ctx.quadraticCurveTo(-width * 0.5, -height * 0.15, -width * 0.47, height * 0.24);
  ctx.quadraticCurveTo(-width * 0.43, height * 0.49, 0, height * 0.5);
  ctx.quadraticCurveTo(width * 0.43, height * 0.49, width * 0.47, height * 0.24);
  ctx.quadraticCurveTo(width * 0.5, -height * 0.15, width * waist * 0.5, -height * 0.36);
  ctx.quadraticCurveTo(width * 0.32, -height * 0.53, topRound * 0.18, -height * 0.5);
  ctx.quadraticCurveTo(0, -height * 0.55, -topRound * 0.18, -height * 0.5);
  ctx.quadraticCurveTo(-width * 0.32, -height * 0.53, -width * waist * 0.5, -height * 0.36);
  ctx.closePath();

  if (shape === "square") {
    ctx.beginPath();
    roundRect(ctx, -width * 0.47, -height * 0.5, width * 0.94, height, width * 0.16);
  }
}

function drawPattern(ctx: CanvasRenderingContext2D, width: number, height: number, design: NailDesign) {
  if (design.pattern === "gradient") {
    const gradient = ctx.createLinearGradient(0, -height / 2, 0, height / 2);
    gradient.addColorStop(0, withAlpha("#ffffff", 0.5));
    gradient.addColorStop(0.45, withAlpha(design.color, 0.2));
    gradient.addColorStop(1, withAlpha(design.tipColor, 0.7));
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

function drawDepth(ctx: CanvasRenderingContext2D, width: number, height: number, design: NailDesign) {
  const alpha = 0.18 + design.thickness * 0.2 + design.realism * 0.08;
  const side = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
  side.addColorStop(0, `rgba(0,0,0,${alpha})`);
  side.addColorStop(0.28, "rgba(255,255,255,0.1)");
  side.addColorStop(0.5, "rgba(255,255,255,0.22)");
  side.addColorStop(0.74, "rgba(255,255,255,0.08)");
  side.addColorStop(1, `rgba(0,0,0,${alpha * 0.7})`);
  ctx.fillStyle = side;
  ctx.fillRect(-width / 2, -height / 2, width, height);

  ctx.strokeStyle = `rgba(255,255,255,${0.38 + design.realism * 0.26})`;
  ctx.lineWidth = Math.max(1, width * 0.05);
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
  ctx.fillStyle = `rgba(95, 42, 51, ${0.08 + design.realism * 0.08})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, width * 0.52, width * 0.18, 0, 0, Math.PI * 2);
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
