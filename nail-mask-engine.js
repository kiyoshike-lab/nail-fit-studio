export class NailMaskEngine {
  constructor() {
    this.mode = "pixel-roi-estimate";
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.roiCanvas = document.createElement("canvas");
    this.roiCanvas.width = 192;
    this.roiCanvas.height = 192;
    this.roiCtx = this.roiCanvas.getContext("2d", { willReadFrequently: true });
    this.session = null;
    this.aiReady = false;
    this.aiFailed = false;
  }

  async initialize() {
    await this.tryLoadAiModel();
    return this;
  }

  async estimate({ video, landmarks, fallbackNails }) {
    if (!video || !landmarks || video.videoWidth === 0 || video.videoHeight === 0) {
      return fallbackNails;
    }

    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;
    this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);

    const pixelRefined = fallbackNails.map((fallback, index) =>
      this.refineFingerEstimate(landmarks, fallback, index),
    );

    if (!this.aiReady) return pixelRefined;

    const aiRefined = [];
    for (let index = 0; index < pixelRefined.length; index += 1) {
      aiRefined.push(await this.refineWithAiMask(video, pixelRefined[index]));
    }
    return aiRefined;
  }

  async tryLoadAiModel() {
    if (this.aiReady || this.aiFailed) return;
    if (!window.ort) {
      this.aiFailed = true;
      return;
    }
    try {
      this.session = await window.ort.InferenceSession.create(
        "./assets/models/nail_instance_roi.onnx",
        { executionProviders: ["webgpu", "wasm"] },
      );
      this.aiReady = true;
      this.mode = "ai-instance-roi";
      window.nailAiStatus = "ready";
    } catch (error) {
      this.aiFailed = true;
      window.nailAiStatus = "fallback";
      console.info("Nail AI model is not available yet. Using landmark fallback.", error);
    }
  }

  async refineWithAiMask(video, fallback) {
    if (!this.session || !window.ort) return fallback;

    const crop = this.cropAroundFallback(video, fallback);
    if (!crop) return fallback;

    this.roiCtx.clearRect(0, 0, 192, 192);
    this.roiCtx.drawImage(
      video,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      192,
      192,
    );

    const input = this.tensorFromRoi();
    try {
      const outputs = await this.session.run({ image: input });
      const mask = outputs.mask;
      const box = maskBoundingBox(mask.data, mask.dims.at(-1), mask.dims.at(-2), 0.58) ?? maskBoundingBox(mask.data, mask.dims.at(-1), mask.dims.at(-2), 0.5);
      if (!box) return fallback;

      const centerX = crop.sx + ((box.minX + box.maxX) / 2 / 192) * crop.sw;
      const centerY = crop.sy + ((box.minY + box.maxY) / 2 / 192) * crop.sh;
      const maskWidth = ((box.maxX - box.minX + 1) / 192) * crop.sw;
      const maskHeight = ((box.maxY - box.minY + 1) / 192) * crop.sh;
      const confidence = box.count / (192 * 192);
      let displayCenterX = window.nailCameraMirrored !== false ? 1 - centerX / video.videoWidth : centerX / video.videoWidth;
      let displayCenterY = centerY / video.videoHeight;
      const widthPct = clamp((maskWidth / video.videoWidth) * 100 * 1.02, 1.6, 8.4);
      const heightPct = clamp((maskHeight / video.videoHeight) * 100 * 1.06, 2.4, 12.0);
      const axisLength = Math.hypot(fallback.axisX ?? 0, fallback.axisY ?? -1) || 1;
      const axisX = (fallback.axisX ?? 0) / axisLength;
      const axisY = (fallback.axisY ?? -1) / axisLength;
      const mobileAttachNudge = window.matchMedia?.("(max-width: 900px)")?.matches ? 0.038 : 0.03;
      displayCenterX -= axisX * mobileAttachNudge;
      displayCenterY -= axisY * mobileAttachNudge;

      if (confidence < 0.003 || confidence > 0.42) return fallback;

      return {
        ...fallback,
        x: displayCenterX * 100,
        y: displayCenterY * 100,
        rootX: (displayCenterX - axisX * (heightPct / 100) * 0.48) * 100,
        rootY: (displayCenterY - axisY * (heightPct / 100) * 0.48) * 100,
        axisX,
        axisY,
        widthPct,
        heightPct,
        aiConfidence: confidence,
      };
    } catch (error) {
      console.warn("Nail AI inference failed; using fallback.", error);
      return fallback;
    }
  }

  cropAroundFallback(video, fallback) {
    const mirrored = window.nailCameraMirrored !== false;
    const rawCenterX = (mirrored ? 1 - fallback.x / 100 : fallback.x / 100) * video.videoWidth;
    const rawCenterY = (fallback.y / 100) * video.videoHeight;
    const baseW = ((fallback.widthPct ?? 5) / 100) * video.videoWidth;
    const baseH = ((fallback.heightPct ?? 8) / 100) * video.videoHeight;
    const cropSize = clamp(Math.max(baseW * 3.1, baseH * 2.35, 72), 72, Math.min(video.videoWidth, video.videoHeight) * 0.5);
    const sx = clamp(rawCenterX - cropSize / 2, 0, video.videoWidth - cropSize);
    const sy = clamp(rawCenterY - cropSize / 2, 0, video.videoHeight - cropSize);
    if (!Number.isFinite(sx) || !Number.isFinite(sy) || cropSize <= 0) return null;
    return { sx, sy, sw: cropSize, sh: cropSize };
  }

  tensorFromRoi() {
    const { data } = this.roiCtx.getImageData(0, 0, 192, 192);
    const values = new Float32Array(1 * 3 * 192 * 192);
    const plane = 192 * 192;
    for (let i = 0; i < plane; i += 1) {
      values[i] = data[i * 4] / 255;
      values[plane + i] = data[i * 4 + 1] / 255;
      values[plane * 2 + i] = data[i * 4 + 2] / 255;
    }
    return new window.ort.Tensor("float32", values, [1, 3, 192, 192]);
  }

  refineFingerEstimate(landmarks, fallback, index) {
    const tipIndexes = [4, 8, 12, 16, 20];
    const dipIndexes = [3, 7, 11, 15, 19];
    const pipIndexes = [2, 6, 10, 14, 18];

    const tip = landmarks[tipIndexes[index]];
    const dip = landmarks[dipIndexes[index]];
    const pip = landmarks[pipIndexes[index]];

    const axis = normalize({
      x: tip.x - dip.x,
      y: tip.y - dip.y,
    });
    const normal = { x: -axis.y, y: axis.x };
    const fingerLength = distance(tip, pip);

    const samples = [];
    for (let along = -0.08; along <= 0.32; along += 0.02) {
      for (let across = -0.18; across <= 0.18; across += 0.02) {
        const point = {
          x: tip.x - axis.x * fingerLength * along + normal.x * fingerLength * across,
          y: tip.y - axis.y * fingerLength * along + normal.y * fingerLength * across,
        };
        const pixel = this.sample(point);
        if (!pixel) continue;
        samples.push({
          along,
          across,
          ...pixel,
        });
      }
    }

    if (samples.length < 20) return fallback;

    const avgLightness =
      samples.reduce((sum, sample) => sum + sample.lightness, 0) / samples.length;
    const avgSaturation =
      samples.reduce((sum, sample) => sum + sample.saturation, 0) / samples.length;

    const candidates = samples.filter((sample) => {
      const brighterThanLocal = sample.lightness > avgLightness + 0.035;
      const lowerSaturation = sample.saturation < avgSaturation + 0.08;
      const inLikelyNailBand = sample.along >= -0.02 && sample.along <= 0.26;
      return brighterThanLocal && lowerSaturation && inLikelyNailBand;
    });

    if (candidates.length < 8) return fallback;

    const minAcross = Math.min(...candidates.map((sample) => sample.across));
    const maxAcross = Math.max(...candidates.map((sample) => sample.across));
    const minAlong = Math.min(...candidates.map((sample) => sample.along));
    const maxAlong = Math.max(...candidates.map((sample) => sample.along));
    const centerAcross = (minAcross + maxAcross) / 2;
    const centerAlong = (minAlong + maxAlong) / 2;

    const refinedCenter = {
      x:
        tip.x -
        axis.x * fingerLength * centerAlong +
        normal.x * fingerLength * centerAcross,
      y:
        tip.y -
        axis.y * fingerLength * centerAlong +
        normal.y * fingerLength * centerAcross,
    };
    let displayCenterX = window.nailCameraMirrored !== false ? 1 - refinedCenter.x : refinedCenter.x;
    let displayCenterY = refinedCenter.y;
    const displayAxisX = window.nailCameraMirrored !== false ? -axis.x : axis.x;
    const displayAxisY = axis.y;
    const widthPct = clamp((maxAcross - minAcross) * fingerLength * 100 * 0.88, 2.0, 8.4);
    const heightPct = clamp((maxAlong - minAlong) * fingerLength * 100 * 1.18, 3.0, 11.2);
    const mobileAttachNudge = window.matchMedia?.("(max-width: 900px)")?.matches ? 0.038 : 0.03;
    displayCenterX -= displayAxisX * mobileAttachNudge;
    displayCenterY -= displayAxisY * mobileAttachNudge;

    return {
      ...fallback,
      x: displayCenterX * 100,
      y: displayCenterY * 100,
      rootX: (displayCenterX - displayAxisX * (heightPct / 100) * 0.48) * 100,
      rootY: (displayCenterY - displayAxisY * (heightPct / 100) * 0.48) * 100,
      axisX: displayAxisX,
      axisY: displayAxisY,
      widthPct,
      heightPct,
      widthScale: 1,
      heightScale: 1,
    };
  }

  sample(point) {
    const x = Math.round(point.x * this.canvas.width);
    const y = Math.round(point.y * this.canvas.height);
    if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) {
      return null;
    }
    const { data } = this.ctx.getImageData(x, y, 1, 1);
    const [r, g, b] = data;
    const { saturation, lightness } = rgbToHsl(r, g, b);
    return { saturation, lightness };
  }
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function maskBoundingBox(data, width, height, threshold) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = sigmoid(data[y * width + x]);
      if (value < threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      count += 1;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY, count };
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function rgbToHsl(r, g, b) {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { saturation, lightness };
}

