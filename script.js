const photoInput = document.querySelector("#photoInput");
const APP_ASSET_VERSION = "20260525-1135";
const sampleButton = document.querySelector("#sampleButton");
const cameraButton = document.querySelector("#cameraButton");
const switchCameraButton = document.querySelector("#switchCameraButton");
const capturePhotoButton = document.querySelector("#capturePhotoButton");
const captureAiFinishButton = document.querySelector("#captureAiFinishButton");
const stopCameraButton = document.querySelector("#stopCameraButton");
const trackingStatus = document.querySelector("#trackingStatus");
const qualityStatus = document.querySelector("#qualityStatus");
const proModeInput = document.querySelector("#proModeInput");
const realismBoostInput = document.querySelector("#realismBoostInput");
const colorInput = document.querySelector("#colorInput");
const shapeInput = document.querySelector("#shapeInput");
const finishInput = document.querySelector("#finishInput");
const designInput = document.querySelector("#designInput");
const materialInput = document.querySelector("#materialInput");
const motifInput = document.querySelector("#motifInput");
const motifColorInput = document.querySelector("#motifColorInput");
const tipColorInput = document.querySelector("#tipColorInput");
const tipAmountInput = document.querySelector("#tipAmountInput");
const referenceNailInput = document.querySelector("#referenceNailInput");
const referenceNailStatus = document.querySelector("#referenceNailStatus");
const referenceTexturePreview = document.querySelector("#referenceTexturePreview");
const photoFidelityInput = document.querySelector("#photoFidelityInput");
const motifDensityInput = document.querySelector("#motifDensityInput");
const nailTypeInput = document.querySelector("#nailTypeInput");
const lengthInput = document.querySelector("#lengthInput");
const thicknessInput = document.querySelector("#thicknessInput");
const rootBlendInput = document.querySelector("#rootBlendInput");
const glossStrengthInput = document.querySelector("#glossStrengthInput");
const shadowStrengthInput = document.querySelector("#shadowStrengthInput");
const textureClarityInput = document.querySelector("#textureClarityInput");
const salonCheckButton = document.querySelector("#salonCheckButton");
const fitCheckButton = document.querySelector("#fitCheckButton");
const fitAdviceResult = document.querySelector("#fitAdviceResult");
const customDesignInput = document.querySelector("#customDesignInput");
const applyCustomDesignButton = document.querySelector("#applyCustomDesignButton");
const xInput = document.querySelector("#xInput");
const yInput = document.querySelector("#yInput");
const scaleInput = document.querySelector("#scaleInput");
const rotationInput = document.querySelector("#rotationInput");
const resetButton = document.querySelector("#resetButton");
const downloadButton = document.querySelector("#downloadButton");
const saveCandidateButton = document.querySelector("#saveCandidateButton");
const clearCandidatesButton = document.querySelector("#clearCandidatesButton");
const downloadSalonSheetButton = document.querySelector("#downloadSalonSheetButton");
const comparisonList = document.querySelector("#comparisonList");
const aiFinishButton = document.querySelector("#aiFinishButton");
const aiFinishStatus = document.querySelector("#aiFinishStatus");
const aiFinishResult = document.querySelector("#aiFinishResult");
const aiFinishImage = document.querySelector("#aiFinishImage");
const downloadAiFinishButton = document.querySelector("#downloadAiFinishButton");
const fingerTabs = document.querySelector("#fingerTabs");
const handImage = document.querySelector("#handImage");
const cameraFeed = document.querySelector("#cameraFeed");
const liveCanvas = document.querySelector("#liveCanvas");
const imageStage = document.querySelector("#imageStage");
const nailLayer = document.querySelector("#nailLayer");
const emptyState = document.querySelector("#emptyState");
const exportCanvas = document.querySelector("#exportCanvas");

const patternToDesign = {
  chrome: "chrome",
  floral: "floral",
  french: "french",
  marble: "marble",
  patterned: "patterned",
  solid: "solid",
};
const finishToInput = {
  chrome: "pearl",
  gloss: "glossy",
  pearl: "pearl",
  sheer: "glossy",
  shimmer: "pearl",
  sparkle: "glossy",
  translucent: "glossy",
};
const nailTypeDefaults = {
  natural: { length: 0.96, thickness: 0.18, shape: null },
  presson: { length: 1.55, thickness: 0.58, shape: "coffin" },
  acrylic: { length: 2.05, thickness: 0.76, shape: "coffin" },
  gelx: { length: 1.75, thickness: 0.48, shape: "almond" },
};
const texturePlacements = [
  { position: "18% 22%", size: "260%" },
  { position: "72% 18%", size: "245%" },
  { position: "48% 58%", size: "255%" },
  { position: "82% 72%", size: "250%" },
  { position: "24% 78%", size: "270%" },
];

function presetTextureStyle(preset) {
  if (!preset) return "clean";
  if (preset.mood === "korean" || preset.material === "jelly" || preset.material === "sheer") {
    return "korean";
  }
  if (preset.genre === "sparkle" || ["glitter", "shimmer", "pearl"].includes(preset.material)) {
    return "sparkle";
  }
  if (preset.genre === "flashy" || ["floral", "patterned", "marble"].includes(preset.pattern)) {
    return "art";
  }
  return "clean";
}

function versionedAssetUrl(url) {
  if (!url || url.startsWith("data:") || /^https?:\/\//.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${APP_ASSET_VERSION}`;
}

function assetFallbackUrls(url) {
  if (!url) return [];
  const urls = [url];
  if (!url.startsWith("data:") && !/^https?:\/\//.test(url)) {
    const fileName = url.split("/").pop();
    if (fileName && fileName !== url) urls.push(`./${fileName}`);
    if (fileName && url.includes("preset-previews")) urls.push(`./assets/${fileName}`);
  }
  return [...new Set(urls)].map(versionedAssetUrl);
}

function tryImageFallback(img, urls, onFail) {
  let index = 0;
  img.addEventListener("error", () => {
    index += 1;
    if (index < urls.length) {
      img.src = urls[index];
      return;
    }
    onFail?.();
  });
  img.src = urls[0];
}

const fingerNames = ["親指", "人差し指", "中指", "薬指", "小指"];
const defaultNails = [
  { x: 32, y: 47, scale: 0.88, rotation: -18, widthScale: 1, heightScale: 1 },
  { x: 42, y: 35, scale: 1, rotation: -7, widthScale: 1, heightScale: 1 },
  { x: 52, y: 31, scale: 1.08, rotation: 0, widthScale: 1, heightScale: 1 },
  { x: 62, y: 35, scale: 1, rotation: 8, widthScale: 1, heightScale: 1 },
  { x: 71, y: 44, scale: 0.82, rotation: 18, widthScale: 1, heightScale: 1 },
];

let nails = structuredClone(defaultNails);
let selectedIndex = 2;
let currentImageUrl = "";
let cameraStream = null;
let cameraFacingMode = "user";
let currentMode = "empty";
let autoTracking = false;
let designPresets = [];
let activePreset = null;
let activePresetTextureImage = null;
let activePresetTextureUrl = null;
let activeReferenceTextures = [];
let activeReferenceTextureImages = [];
let activeReferenceAverageColor = null;
let selectedReferenceTextureIndex = 0;
let referenceExtractorSession = null;
let referenceExtractorTried = false;
let savedCandidates = [];
let lastGoodNails = structuredClone(defaultNails);
let lostHandFrames = 0;
let lightingProbe = { brightness: 0.62, contrast: 0.18, warmth: 0.5, updatedAt: 0 };
const probeCanvas = document.createElement("canvas");
const probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });
const localLightCanvas = document.createElement("canvas");
const localLightCtx = localLightCanvas.getContext("2d", { willReadFrequently: true });
let presetInput = null;
let presetGallery = null;
let presetGenreInput = null;

function ensureOption(select, value, label) {
  if ([...select.options].some((option) => option.value === value)) return;
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function setupPresetControl() {
  ensureOption(materialInput, "glitter", "Glitter");
  ensureOption(materialInput, "pearl", "Pearl");
  ensureOption(designInput, "patterned", "Patterned");
  ensureOption(designInput, "floral", "Floral");
  ensureOption(designInput, "chrome", "Chrome");

  const label = document.createElement("label");
  label.className = "preset-picker";
  label.textContent = "実写プリセット";
  presetInput = document.createElement("select");
  presetInput.id = "presetInput";
  presetInput.innerHTML = '<option value="">手動で選ぶ</option>';
  label.append(presetInput);
  materialInput.closest("label").insertAdjacentElement("afterend", label);

  const genreLabel = document.createElement("label");
  genreLabel.className = "preset-genre-picker";
  genreLabel.textContent = "ジャンル";
  presetGenreInput = document.createElement("select");
  presetGenreInput.id = "presetGenreInput";
  presetGenreInput.innerHTML = `
    <option value="all">全部</option>
    <option value="natural">自然・オフィス</option>
    <option value="korean">韓国/ワンホン系</option>
    <option value="flashy">派手・模様多め</option>
    <option value="sparkle">ラメ・キラキラ</option>
    <option value="simple">シンプル</option>
  `;
  genreLabel.append(presetGenreInput);
  label.insertAdjacentElement("afterend", genreLabel);

  presetGallery = document.createElement("div");
  presetGallery.className = "preset-gallery";
  genreLabel.insertAdjacentElement("afterend", presetGallery);

  presetInput.addEventListener("input", () => {
    const preset = designPresets.find((item) => item.id === presetInput.value);
    if (preset) {
      applyDesignPreset(preset);
    } else {
      activePreset = null;
      renderNails();
    }
  });

  presetGenreInput.addEventListener("input", renderPresetGallery);
}

async function loadDesignPresets() {
  setupPresetControl();
  try {
    const response = await fetch(`./assets/design-presets.json?v=${APP_ASSET_VERSION}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`preset load failed: ${response.status}`);
    const data = await response.json();
    designPresets = data.presets ?? [];
    designPresets.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = `${preset.name} (${preset.count})`;
      presetInput.append(option);
    });
    renderPresetGallery();
    const firstStrongPreset =
      designPresets.find((preset) => preset.material === "jelly") ??
      designPresets.find((preset) => preset.material === "sheer") ??
      designPresets[0];
    if (firstStrongPreset) {
      presetInput.value = firstStrongPreset.id;
      applyDesignPreset(firstStrongPreset);
    }
  } catch (error) {
    console.warn("Real design presets could not be loaded.", error);
  }
}

function applyDesignPreset(preset) {
  activePreset = preset;
  activePresetTextureImage = null;
  activePresetTextureUrl = null;
  activeReferenceTextures = [];
  activeReferenceTextureImages = [];
  activeReferenceAverageColor = null;
    if (referenceNailInput) referenceNailInput.value = "";
    if (referenceNailStatus) referenceNailStatus.textContent = "実写プリセットを使用中です。参考写真を入れると上書きできます。";
  if (referenceTexturePreview) referenceTexturePreview.innerHTML = "";
  const presetTextureUrls = assetFallbackUrls(preset.textureImage ?? preset.previewImage ?? preset.exampleImage);
  if (presetTextureUrls.length) {
    activePresetTextureImage = new Image();
    activePresetTextureImage.onload = () => {
      activePresetTextureUrl = activePresetTextureImage.src;
      renderNails();
      drawLiveNails();
    };
    tryImageFallback(activePresetTextureImage, presetTextureUrls, () => {
      activePresetTextureImage = null;
      activePresetTextureUrl = null;
      if (referenceNailStatus) {
        referenceNailStatus.textContent = "実写プリセットの写真が読み込めませんでした。色と質感のプリセットで表示します。";
      }
      renderNails();
      drawLiveNails();
    });
  }
  colorInput.value = proModeInput.checked
    ? softenPresetColor(preset.colorHint ?? colorInput.value, preset.material)
    : preset.colorHint ?? colorInput.value;
  materialInput.value = preset.material;
  designInput.value = patternToDesign[preset.pattern] ?? "solid";
  finishInput.value = finishToInput[preset.finish] ?? "glossy";
  motifInput.value = preset.textureImage || preset.previewImage ? "none" : preset.motif ?? inferPresetMotif(preset);
  motifColorInput.value = preset.motifColor ?? inferPresetMotifColor(preset);
  tipColorInput.value = preset.tipColor ?? inferPresetTipColor(preset);
  tipAmountInput.value = preset.tipAmount ?? inferPresetTipAmount(preset);
  motifDensityInput.value = preset.motifDensity ?? inferPresetMotifDensity(preset);
  if (proModeInput.checked) {
    motifDensityInput.value = Math.min(Number(motifDensityInput.value), activePresetTextureImage ? 0.35 : 0.9);
    thicknessInput.value = Math.min(Number(thicknessInput.value), nailTypeInput.value === "natural" ? 0.24 : 0.62);
  }
  renderNails();
  updatePresetGallerySelection();
}

async function handleReferenceNailPhoto(event) {
  const [file] = event.target.files;
  if (!file) return;

  referenceNailStatus.textContent = "写真からネイルっぽい部分だけを探しています...";
  try {
    const url = URL.createObjectURL(file);
    const image = await loadImageElement(url);
    const aiResult = await extractReferenceNailTexturesWithAi(image);
    const result = aiResult ?? extractReferenceNailTextures(image);
    URL.revokeObjectURL(url);

    activePreset = null;
    if (presetInput) presetInput.value = "";
    activeReferenceTextures = result.textures;
    activeReferenceAverageColor = result.averageColor;
    selectedReferenceTextureIndex = 0;
    activeReferenceTextureImages = activeReferenceTextures.map((texture) => {
      const img = new Image();
      img.onload = () => {
        renderNails();
        drawLiveNails();
      };
      img.src = texture;
      return img;
    });
    renderReferenceTexturePreview();

    colorInput.value = activeReferenceAverageColor;
    materialInput.value = result.sparkleScore > 0.42 ? "shimmer" : "cream";
    finishInput.value = "glossy";
    designInput.value = "solid";
    motifInput.value = "none";
    motifColorInput.value = result.lightAccent;
    tipColorInput.value = result.tipColor;
    tipAmountInput.value = "0.28";
    motifDensityInput.value = "0.4";
    photoFidelityInput.value = "1";
    proModeInput.checked = true;

    referenceNailStatus.textContent = aiResult
      ? `AIで参考写真の爪だけを検出し、${activeReferenceTextures.length} 個の実写ネイル素材を作りました。`
      : `参考写真から ${activeReferenceTextures.length} 個の実写ネイル素材を作りました。`;
    updateQualityStatus({
      level: result.componentCount >= 4 ? "high" : "medium",
      text:
        result.componentCount >= 4
          ? "参考写真の爪候補を複数検出。実写素材モードで再現度を優先しています。"
          : "参考写真から素材を作成。写真によっては爪だけの切り抜き精度に差があります。",
    });
    renderNails();
  } catch (error) {
    console.error(error);
    referenceNailStatus.textContent = "写真の読み取りに失敗しました。別のネイル写真で試してください。";
    updateQualityStatus({ level: "low", text: "参考写真の読み取りに失敗。別の写真で再試行してください。" });
  }
}

function renderReferenceTexturePreview() {
  if (!referenceTexturePreview) return;
  referenceTexturePreview.innerHTML = "";
  if (!activeReferenceTextures.length) return;

  const title = document.createElement("div");
  title.className = "reference-texture-title";
  title.textContent = "切り出した実写ネイル素材（クリックで全爪に強く反映）";
  referenceTexturePreview.append(title);

  activeReferenceTextures.forEach((texture, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `reference-texture-chip${index === selectedReferenceTextureIndex ? " active" : ""}`;
    button.innerHTML = `<img src="${texture}" alt="実写ネイル素材 ${index + 1}" />`;
    button.addEventListener("click", () => {
      selectedReferenceTextureIndex = index;
      activeReferenceTextures = [
        texture,
        ...activeReferenceTextures.filter((_, textureIndex) => textureIndex !== index),
      ];
      activeReferenceTextureImages = activeReferenceTextures.map((src) => {
        const img = new Image();
        img.onload = () => {
          renderNails();
          drawLiveNails();
        };
        img.src = src;
        return img;
      });
      selectedReferenceTextureIndex = 0;
      renderReferenceTexturePreview();
      renderNails();
      drawLiveNails();
    });
    referenceTexturePreview.append(button);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function loadReferenceExtractorSession() {
  if (referenceExtractorSession || referenceExtractorTried) return referenceExtractorSession;
  referenceExtractorTried = true;
  if (!window.ort) return null;
  try {
    referenceExtractorSession = await window.ort.InferenceSession.create(
      "./assets/models/reference_nail_extractor.onnx",
      { executionProviders: ["webgpu", "wasm"] },
    );
    return referenceExtractorSession;
  } catch (error) {
    console.info("Reference nail extractor AI is not available yet. Using image heuristic.", error);
    return null;
  }
}

async function extractReferenceNailTexturesWithAi(image) {
  const session = await loadReferenceExtractorSession();
  if (!session || !window.ort) return null;

  const size = 192;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const values = new Float32Array(1 * 3 * size * size);
  const plane = size * size;
  for (let i = 0; i < plane; i += 1) {
    values[i] = data[i * 4] / 255;
    values[plane + i] = data[i * 4 + 1] / 255;
    values[plane * 2 + i] = data[i * 4 + 2] / 255;
  }

  try {
    const outputs = await session.run({
      image: new window.ort.Tensor("float32", values, [1, 3, size, size]),
    });
    const output = outputs.mask;
    const mask = new Uint8Array(size * size);
    for (let i = 0; i < mask.length; i += 1) {
      mask[i] = sigmoid(output.data[i]) > 0.52 ? 1 : 0;
    }

    const components = findMaskComponents(mask, size, size)
      .filter((component) => component.area > 24)
      .slice(0, 5);
    if (!components.length) return null;

    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = image.naturalWidth;
    fullCanvas.height = image.naturalHeight;
    const fullCtx = fullCanvas.getContext("2d");
    fullCtx.drawImage(image, 0, 0);

    const textures = components.map((component) =>
      cropAiReferenceTexture(fullCanvas, component, size, size),
    );
    const color = estimateTextureAverageColor(textures[0]) ?? { r: 218, g: 145, b: 168 };

    return {
      textures,
      averageColor: rgbToHex(color.r, color.g, color.b),
      tipColor: rgbToHex(
        Math.min(255, Math.round(color.r + 34)),
        Math.min(255, Math.round(color.g + 34)),
        Math.min(255, Math.round(color.b + 34)),
      ),
      lightAccent: "#ffffff",
      sparkleScore: 0.34,
      patternScore: components.length >= 3 ? 0.46 : 0.25,
      componentCount: components.length,
    };
  } catch (error) {
    console.warn("Reference extractor inference failed.", error);
    return null;
  }
}

function findMaskComponents(mask, width, height) {
  const visited = new Uint8Array(width * height);
  const components = [];
  const stack = [];

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    stack.length = 0;
    stack.push(start);
    visited[start] = 1;

    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    while (stack.length) {
      const index = stack.pop();
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      for (const next of [index - 1, index + 1, index - width, index + width]) {
        if (next < 0 || next >= mask.length || visited[next] || !mask[next]) continue;
        if ((next === index - 1 && x === 0) || (next === index + 1 && x === width - 1)) continue;
        visited[next] = 1;
        stack.push(next);
      }
    }

    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const aspect = boxH / Math.max(1, boxW);
    if (aspect < 0.45 || aspect > 5.8) continue;
    components.push({ area, minX, minY, maxX, maxY });
  }

  return components.sort((a, b) => b.area - a.area);
}

function cropAiReferenceTexture(sourceCanvas, component, maskWidth, maskHeight) {
  const scaleX = sourceCanvas.width / maskWidth;
  const scaleY = sourceCanvas.height / maskHeight;
  const padX = Math.max(4, (component.maxX - component.minX + 1) * 0.12);
  const padY = Math.max(5, (component.maxY - component.minY + 1) * 0.14);
  const sx = Math.max(0, Math.round((component.minX - padX) * scaleX));
  const sy = Math.max(0, Math.round((component.minY - padY) * scaleY));
  const sw = Math.min(sourceCanvas.width - sx, Math.round((component.maxX - component.minX + 1 + padX * 2) * scaleX));
  const sh = Math.min(sourceCanvas.height - sy, Math.round((component.maxY - component.minY + 1 + padY * 2) * scaleY));

  const out = document.createElement("canvas");
  out.width = 96;
  out.height = 156;
  const ctx = out.getContext("2d");
  ctx.clearRect(0, 0, out.width, out.height);
  ctx.save();
  buildNailPath(ctx, out.width * 0.82, out.height * 0.92);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.restore();
  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ctx.ellipse(out.width / 2, out.height / 2, out.width * 0.42, out.height * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  return out.toDataURL("image/png");
}

function estimateTextureAverageColor(textureDataUrl) {
  if (!textureDataUrl) return null;
  const image = new Image();
  image.src = textureDataUrl;
  if (!image.complete) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, 24, 24);
  const { data } = ctx.getImageData(0, 0, 24, 24);
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count += 1;
  }
  return count ? { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) } : null;
}

function extractReferenceNailTextures(image) {
  const maxSide = 560;
  const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height);

  const rawComponents = findNailTextureComponents(data);
  const componentCandidates = rawComponents
    .map((component) => ({
      x: Math.max(0, Math.round(component.x - component.width * 0.08)),
      y: Math.max(0, Math.round(component.y - component.height * 0.12)),
      width: Math.min(width, Math.round(component.width * 1.16)),
      height: Math.min(height, Math.round(component.height * 1.24)),
      score: component.score,
      sparkle: component.sparkle,
      pattern: component.pattern,
      nailSignal: component.nailSignal,
      skinSignal: component.skinSignal,
      avg: component.avg,
    }))
    .map((candidate) => ({
      ...candidate,
      x: Math.min(candidate.x, width - Math.max(1, candidate.width)),
      y: Math.min(candidate.y, height - Math.max(1, candidate.height)),
    }))
    .map((candidate) => ({
      ...candidate,
      width: Math.max(1, Math.min(candidate.width, width - candidate.x)),
      height: Math.max(1, Math.min(candidate.height, height - candidate.y)),
    }));

  const patchW = Math.max(34, Math.round(width * 0.18));
  const patchH = Math.max(54, Math.round(height * 0.28));
  const stepX = Math.max(12, Math.round(patchW * 0.32));
  const stepY = Math.max(12, Math.round(patchH * 0.28));
  const candidates = [];

  for (let y = 0; y <= height - patchH; y += stepY) {
    for (let x = 0; x <= width - patchW; x += stepX) {
      candidates.push({
        x,
        y,
        width: patchW,
        height: patchH,
        ...scoreTextureWindow(data, x, y, patchW, patchH),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const candidate of [...componentCandidates, ...candidates]) {
    const tooClose = picked.some((item) => {
      const dx = item.x + item.width / 2 - (candidate.x + candidate.width / 2);
      const dy = item.y + item.height / 2 - (candidate.y + candidate.height / 2);
      return Math.hypot(dx / patchW, dy / patchH) < 0.82;
    });
    if (!tooClose) picked.push(candidate);
    if (picked.length >= 5) break;
  }

  while (picked.length < 5) {
    picked.push({
      x: Math.round((width - patchW) * (0.18 + picked.length * 0.16)),
      y: Math.round((height - patchH) * 0.42),
      width: patchW,
      height: patchH,
      score: 0,
      avg: { r: 218, g: 145, b: 168 },
      sparkle: 0,
      pattern: 0,
    });
  }

  const textures = picked.map((candidate) => cropReferenceTexture(canvas, candidate));
  const color = picked[0]?.avg ?? { r: 218, g: 145, b: 168 };
  const sparkleScore = picked.reduce((sum, item) => sum + item.sparkle, 0) / picked.length;
  const patternScore = picked.reduce((sum, item) => sum + item.pattern, 0) / picked.length;

  return {
    textures,
    averageColor: rgbToHex(color.r, color.g, color.b),
    tipColor: rgbToHex(
      Math.min(255, Math.round(color.r + 34)),
      Math.min(255, Math.round(color.g + 34)),
      Math.min(255, Math.round(color.b + 34)),
    ),
    lightAccent: sparkleScore > 0.42 ? "#fff3bf" : "#ffffff",
    sparkleScore,
    patternScore,
    componentCount: rawComponents.length,
  };
}

function findNailTextureComponents(imageData) {
  const { data, width, height } = imageData;
  const total = width * height;
  const mask = new Uint8Array(total);
  const visited = new Uint8Array(total);

  for (let i = 0; i < total; i += 1) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const hsl = rgbToHsl(r, g, b);
    const nail = nailPixelScore(r, g, b);
    const skin = skinPixelScore(hsl.h, hsl.s, hsl.l);
    mask[i] = nail > 0.34 && skin < 0.58 ? 1 : 0;
  }

  const components = [];
  const stack = [];
  const minArea = Math.max(60, Math.round(total * 0.0012));
  const maxArea = Math.round(total * 0.12);

  for (let start = 0; start < total; start += 1) {
    if (!mask[start] || visited[start]) continue;
    stack.length = 0;
    stack.push(start);
    visited[start] = 1;

    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let sparkle = 0;
    let nailSignal = 0;
    let skinSignal = 0;
    let contrast = 0;
    let previousLightness = null;

    while (stack.length) {
      const index = stack.pop();
      const x = index % width;
      const y = Math.floor(index / width);
      const offset = index * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lightness = (max + min) / 510;
      const hsl = rgbToHsl(r, g, b);
      const nail = nailPixelScore(r, g, b);
      const skin = skinPixelScore(hsl.h, hsl.s, hsl.l);

      area += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      rSum += r;
      gSum += g;
      bSum += b;
      nailSignal += nail;
      skinSignal += skin;
      if (lightness > 0.76 && hsl.s < 0.36) sparkle += 1;
      if (previousLightness !== null) contrast += Math.abs(lightness - previousLightness);
      previousLightness = lightness;

      const neighbors = [index - 1, index + 1, index - width, index + width];
      for (const next of neighbors) {
        if (next < 0 || next >= total || visited[next] || !mask[next]) continue;
        if ((next === index - 1 && x === 0) || (next === index + 1 && x === width - 1)) continue;
        visited[next] = 1;
        stack.push(next);
      }
    }

    if (area < minArea || area > maxArea) continue;
    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const aspect = boxH / Math.max(1, boxW);
    if (aspect < 0.72 || aspect > 5.2) continue;
    const fill = area / (boxW * boxH);
    if (fill < 0.12) continue;

    const avgNailSignal = nailSignal / area;
    const avgSkinSignal = skinSignal / area;
    const pattern = Math.min(1, (contrast / Math.max(1, area - 1)) * 8 + avgNailSignal * 0.24);
    const sparkleRatio = sparkle / area;
    const shapeScore = 1 - Math.min(1, Math.abs(aspect - 1.85) / 3.2);
    const score =
      avgNailSignal * 2.2 +
      pattern * 0.72 +
      sparkleRatio * 0.5 +
      fill * 0.38 +
      shapeScore * 0.52 -
      avgSkinSignal * 0.72;

    components.push({
      x: minX,
      y: minY,
      width: boxW,
      height: boxH,
      score,
      sparkle: sparkleRatio,
      pattern,
      nailSignal: avgNailSignal,
      skinSignal: avgSkinSignal,
      avg: {
        r: Math.round(rSum / area),
        g: Math.round(gSum / area),
        b: Math.round(bSum / area),
      },
    });
  }

  return components.sort((a, b) => b.score - a.score).slice(0, 12);
}

function scoreTextureWindow(imageData, x, y, width, height) {
  const { data, width: imageWidth } = imageData;
  let sat = 0;
  let bright = 0;
  let contrast = 0;
  let sparkle = 0;
  let nailSignal = 0;
  let skinSignal = 0;
  let count = 0;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let previousLightness = null;

  const sampleStep = 4;
  for (let yy = y; yy < y + height; yy += sampleStep) {
    for (let xx = x; xx < x + width; xx += sampleStep) {
      const index = (yy * imageWidth + xx) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lightness = (max + min) / 510;
      const saturation = max === 0 ? 0 : (max - min) / max;
      const hsl = rgbToHsl(r, g, b);
      const nailLike = nailPixelScore(r, g, b);
      const skinLike = skinPixelScore(hsl.h, hsl.s, hsl.l);
      sat += saturation;
      bright += 1 - Math.abs(lightness - 0.58);
      if (previousLightness !== null) contrast += Math.abs(lightness - previousLightness);
      if (lightness > 0.76 && saturation < 0.36) sparkle += 1;
      nailSignal += nailLike;
      skinSignal += skinLike;
      previousLightness = lightness;
      rSum += r;
      gSum += g;
      bSum += b;
      count += 1;
    }
  }

  const avgSat = sat / count;
  const avgBright = bright / count;
  const avgContrast = contrast / Math.max(1, count - 1);
  const sparkleRatio = sparkle / count;
  const avgNailSignal = nailSignal / count;
  const avgSkinSignal = skinSignal / count;
  const pattern = Math.min(1, avgContrast * 5 + avgSat * 0.35);
  const score =
    avgNailSignal * 1.8 +
    avgSat * 0.72 +
    avgBright * 0.18 +
    pattern * 0.82 +
    sparkleRatio * 0.62 -
    avgSkinSignal * 0.78;

  return {
    score,
    sparkle: sparkleRatio,
    pattern,
    nailSignal: avgNailSignal,
    skinSignal: avgSkinSignal,
    avg: {
      r: Math.round(rSum / count),
      g: Math.round(gSum / count),
      b: Math.round(bSum / count),
    },
  };
}

function cropReferenceTexture(sourceCanvas, candidate) {
  const out = document.createElement("canvas");
  out.width = 260;
  out.height = 420;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  const avg = candidate.avg ?? { r: 218, g: 145, b: 168 };
  const fidelity = Number(photoFidelityInput?.value ?? 1);

  const temp = document.createElement("canvas");
  temp.width = out.width;
  temp.height = out.height;
  const tempCtx = temp.getContext("2d", { willReadFrequently: true });
  tempCtx.drawImage(
    sourceCanvas,
    candidate.x,
    candidate.y,
    candidate.width,
    candidate.height,
    0,
    0,
    out.width,
    out.height,
  );

  const imageData = tempCtx.getImageData(0, 0, out.width, out.height);
  const output = ctx.createImageData(out.width, out.height);
  const selectedColors = [];

  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const index = (y * out.width + x) * 4;
      const r = imageData.data[index];
      const g = imageData.data[index + 1];
      const b = imageData.data[index + 2];
      const nailScore = nailPixelScore(r, g, b);
      const hsl = rgbToHsl(r, g, b);
      const skinScore = skinPixelScore(hsl.h, hsl.s, hsl.l);
      const nx = (x / out.width - 0.5) / 0.48;
      const ny = (y / out.height - 0.52) / 0.54;
      const nailShapeMask = nx * nx + ny * ny < 1.04;
      const centerWeight = Math.max(0, 1 - Math.hypot(nx * 0.72, ny * 0.48));
      const keep =
        fidelity > 0.92
          ? nailShapeMask
          : nailShapeMask &&
            (nailScore > 0.34 || (nailScore > 0.18 && skinScore < 0.42) || centerWeight > 0.72);
      const vignette = 1 - Math.min(0.35, Math.hypot((x / out.width - 0.5) * 0.9, (y / out.height - 0.5) * 0.55));

      if (keep) {
        const preserve = fidelity > 0.92 ? 1 : 0.86 + centerWeight * 0.12;
        output.data[index] = Math.round(r * preserve + avg.r * (1 - preserve));
        output.data[index + 1] = Math.round(g * preserve + avg.g * (1 - preserve));
        output.data[index + 2] = Math.round(b * preserve + avg.b * (1 - preserve));
        selectedColors.push([r, g, b]);
      } else {
        const noise = ((x * 17 + y * 31) % 23) - 11;
        output.data[index] = Math.max(0, Math.min(255, avg.r + noise));
        output.data[index + 1] = Math.max(0, Math.min(255, avg.g + noise));
        output.data[index + 2] = Math.max(0, Math.min(255, avg.b + noise));
      }
      output.data[index + 3] = 255;
    }
  }

  if (selectedColors.length > 18) {
    const refined = selectedColors.reduce(
      (acc, color) => {
        acc.r += color[0];
        acc.g += color[1];
        acc.b += color[2];
        return acc;
      },
      { r: 0, g: 0, b: 0 },
    );
    candidate.avg = {
      r: Math.round(refined.r / selectedColors.length),
      g: Math.round(refined.g / selectedColors.length),
      b: Math.round(refined.b / selectedColors.length),
    };
  }

  ctx.putImageData(output, 0, 0);

  const gloss = ctx.createLinearGradient(0, 0, out.width, out.height);
  gloss.addColorStop(0, "rgba(255,255,255,0)");
  gloss.addColorStop(0.38, "rgba(255,255,255,0.12)");
  gloss.addColorStop(0.47, "rgba(255,255,255,0.02)");
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, out.width, out.height);

  return out.toDataURL("image/png");
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

function skinPixelScore(h, s, l) {
  const hueSkin = h >= 8 && h <= 52;
  const satSkin = s >= 0.12 && s <= 0.62;
  const lightSkin = l >= 0.32 && l <= 0.88;
  if (!hueSkin || !satSkin || !lightSkin) return 0;
  const hueCenter = 28;
  const hueScore = 1 - Math.min(1, Math.abs(h - hueCenter) / 34);
  const satScore = 1 - Math.min(1, Math.abs(s - 0.34) / 0.34);
  const lightScore = 1 - Math.min(1, Math.abs(l - 0.62) / 0.36);
  return Math.max(0, hueScore * 0.48 + satScore * 0.28 + lightScore * 0.24);
}

function nailPixelScore(r, g, b) {
  const hsl = rgbToHsl(r, g, b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = (max - min) / 255;
  const darkPolish = hsl.l < 0.24 && chroma > 0.03;
  const vividPolish = hsl.s > 0.34 && hsl.l > 0.16;
  const whiteOrPearl = hsl.l > 0.76 && hsl.s < 0.3;
  const redPinkBluePurple =
    hsl.h < 8 || hsl.h > 285 || (hsl.h >= 190 && hsl.h <= 280) || (hsl.h >= 320 && hsl.h <= 360);
  const goldSilver = (hsl.h >= 42 && hsl.h <= 75 && hsl.s > 0.18) || whiteOrPearl;
  const skinPenalty = skinPixelScore(hsl.h, hsl.s, hsl.l) * 0.55;
  let score = 0;
  if (vividPolish) score += 0.46;
  if (redPinkBluePurple || goldSilver) score += 0.32;
  if (darkPolish || whiteOrPearl) score += 0.28;
  score += Math.min(0.32, chroma * 0.78);
  return Math.max(0, Math.min(1, score - skinPenalty));
}

function inferPresetTipColor(preset) {
  if (preset.pattern === "french" || preset.name?.toLowerCase().includes("french")) return "#fff7ef";
  if (preset.genre === "sparkle") return "#fff4c7";
  if (preset.mood === "korean") return tint(preset.colorHint ?? "#f1b6c5", 0.52);
  return preset.motifColor ?? "#fff4ee";
}

function inferPresetTipAmount(preset) {
  if (preset.pattern === "french") return 0.28;
  if (preset.genre === "sparkle") return 0.36;
  if (preset.mood === "korean") return 0.42;
  return 0.3;
}

function inferPresetMotif(preset) {
  const text = `${preset.name ?? ""} ${preset.pattern ?? ""} ${preset.material ?? ""}`.toLowerCase();
  if (text.includes("floral") || text.includes("flower")) return "flowers";
  if (text.includes("star")) return "stars";
  if (text.includes("heart")) return "hearts";
  if (text.includes("glitter") || text.includes("shimmer") || preset.genre === "sparkle") return "dots";
  if (preset.genre === "flashy" || preset.pattern === "patterned") return "dots";
  return "none";
}

function inferPresetMotifColor(preset) {
  if (preset.genre === "sparkle") return "#fff4c7";
  if (preset.baseColorFamily === "white") return "#d7b7a8";
  return "#ffffff";
}

function inferPresetMotifDensity(preset) {
  if (preset.genre === "flashy") return 1.35;
  if (preset.mood === "korean") return 0.72;
  if (preset.genre === "sparkle") return 1.1;
  return 0.95;
}

function softenPresetColor(color, material) {
  const amount = material === "metallic" ? 0.08 : material === "glitter" ? 0.14 : 0.2;
  return rgbStringToHex(mixColor(color, "#f4ddd7", amount));
}

function rgbStringToHex(value) {
  const match = value.match(/\d+/g);
  if (!match || match.length < 3) return value;
  return `#${match
    .slice(0, 3)
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

function renderPresetGallery() {
  if (!presetGallery) return;
  presetGallery.innerHTML = "";
  const genre = presetGenreInput?.value ?? "all";
  const filtered = designPresets.filter((preset) => {
    if (genre === "all") return true;
    if (genre === "korean") return preset.mood === "korean";
    return preset.genre === genre;
  });
  filtered.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-card";
    button.dataset.presetId = preset.id;
    button.style.setProperty("--preset-card-color", preset.colorHint ?? "#d9829b");
    const previewUrls = assetFallbackUrls(preset.previewImage ?? preset.textureImage ?? preset.exampleImage);
    button.innerHTML = `
      <span class="preset-card-fallback"></span>
      ${previewUrls.length ? `<img alt="${preset.name}" loading="lazy" />` : ""}
      <span>${preset.name}</span>
    `;
    const img = button.querySelector("img");
    if (img) {
      button.dataset.imageState = "loading";
      img.addEventListener("load", () => {
        button.dataset.imageState = "loaded";
      });
      tryImageFallback(img, previewUrls, () => {
        img.remove();
        button.dataset.imageFailed = "true";
        button.dataset.imageState = "failed";
      });
    }
    button.addEventListener("click", () => {
      presetInput.value = preset.id;
      applyDesignPreset(preset);
    });
    presetGallery.append(button);
  });
  updatePresetGallerySelection();
}

function updatePresetGallerySelection() {
  if (!presetGallery) return;
  presetGallery.querySelectorAll(".preset-card").forEach((button) => {
    button.classList.toggle("active", button.dataset.presetId === activePreset?.id);
  });
}

function applyNailTypeDefaults() {
  const defaults = nailTypeDefaults[nailTypeInput.value] ?? nailTypeDefaults.natural;
  lengthInput.value = defaults.length;
  thicknessInput.value = defaults.thickness;
  if (defaults.shape) {
    shapeInput.value = defaults.shape;
  }
  renderNails();
}

function applyCustomDesign() {
  const text = (customDesignInput.value || "").trim();
  if (!text) {
    alert("作りたいネイルを書いてね。例：爪先だけ白グラデ、透明ピンク、細かいラメ");
    return;
  }

  activePreset = null;
  if (presetInput) presetInput.value = "";

  const normalized = text.toLowerCase();
  proModeInput.checked = true;
  finishInput.value = "glossy";

  const colorMap = [
    [/ピンク|桃|pink/, "#e9a0b8"],
    [/白|ホワイト|white/, "#fff3ec"],
    [/赤|レッド|red/, "#b92a37"],
    [/青|ブルー|blue/, "#355fc9"],
    [/紫|パープル|purple/, "#9b72c8"],
    [/黒|ブラック|black/, "#201820"],
    [/ゴールド|金|gold/, "#d5aa45"],
    [/シルバー|銀|silver/, "#c8ccd4"],
    [/ベージュ|肌|ヌード|nude|beige/, "#d7ad9d"],
    [/透明|クリア|clear/, "#f0b8c5"],
  ];

  const pickedColor = colorMap.find(([pattern]) => pattern.test(normalized))?.[1];
  if (pickedColor) colorInput.value = pickedColor;

  if (/韓国|ワンホン|ちゅるん|透明|クリア|シアー|sheer|jelly/.test(normalized)) {
    materialInput.value = /透明|クリア|シアー/.test(normalized) ? "sheer" : "jelly";
    finishInput.value = "glossy";
    thicknessInput.value = "0.2";
    motifDensityInput.value = "0.72";
  }

  if (/マット|matte/.test(normalized)) finishInput.value = "matte";
  if (/パール|真珠|pearl/.test(normalized)) {
    finishInput.value = "pearl";
    materialInput.value = "pearl";
  }
  if (/ミラー|クロム|chrome|メタリック/.test(normalized)) {
    designInput.value = "chrome";
    materialInput.value = "metallic";
  }

  if (/爪先|先端|フレンチ|french|グラデ|グラデーション/.test(normalized)) {
    motifInput.value = /ラメ|キラ|glitter/.test(normalized) ? "tip_glitter" : "tip_gradient";
    designInput.value = /フレンチ|french/.test(normalized) ? "french" : "gradient";
    tipColorInput.value = /白|ホワイト|フレンチ/.test(normalized)
      ? "#fff8ef"
      : pickedColor
        ? tint(pickedColor, 0.42)
        : "#fff4ee";
    motifColorInput.value = tipColorInput.value;
    tipAmountInput.value = /細|少し|浅/.test(normalized) ? "0.22" : /深|大き|多/.test(normalized) ? "0.46" : "0.33";
  }

  if (/ラメ|キラ|グリッター|glitter|sparkle/.test(normalized)) {
    materialInput.value = "glitter";
    motifInput.value = /爪先|先端/.test(normalized) ? "tip_glitter" : "dots";
    motifColorInput.value = /金|ゴールド/.test(normalized) ? "#fff0a8" : "#ffffff";
    tipColorInput.value = motifColorInput.value;
    motifDensityInput.value = /細か|上品|少し/.test(normalized) ? "0.75" : "1.18";
  }

  if (/花|フラワー|flower/.test(normalized)) {
    motifInput.value = "flowers";
    designInput.value = "floral";
    motifDensityInput.value = "0.78";
  } else if (/ハート|heart/.test(normalized)) {
    motifInput.value = "hearts";
    motifDensityInput.value = "0.86";
  } else if (/星|スター|star/.test(normalized)) {
    motifInput.value = "stars";
    motifDensityInput.value = "0.86";
  } else if (/チェック|checker/.test(normalized)) {
    motifInput.value = "checker";
    motifDensityInput.value = "1.1";
  } else if (/線|ストライプ|stripe/.test(normalized)) {
    motifInput.value = "stripes";
    motifDensityInput.value = "0.9";
  }

  if (/派手|多め|ごてごて|y2k/.test(normalized)) {
    motifDensityInput.value = "1.35";
    thicknessInput.value = "0.52";
    materialInput.value = materialInput.value === "cream" ? "shimmer" : materialInput.value;
  }

  if (/長い|ロング|つけ爪|付け爪|スカルプ|アクリル/.test(normalized)) {
    nailTypeInput.value = /つけ爪|付け爪/.test(normalized) ? "presson" : "acrylic";
    shapeInput.value = /丸|オーバル/.test(normalized) ? "oval" : "coffin";
    lengthInput.value = /少し|短め/.test(normalized) ? "1.45" : "2.15";
    thicknessInput.value = Math.max(Number(thicknessInput.value), 0.58);
  }

  renderNails();
}

function buildTabs() {
  fingerTabs.innerHTML = "";
  fingerNames.forEach((name, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name;
    button.className = index === selectedIndex ? "active" : "";
    button.addEventListener("click", () => {
      selectedIndex = index;
      syncControls();
      renderNails();
    });
    fingerTabs.append(button);
  });
}

function renderNails() {
  nailLayer.innerHTML = "";
  lastGoodNails = nails.length === 5 ? structuredClone(nails) : lastGoodNails;
  nails.forEach((nail, index) => {
    const el = document.createElement("div");
    el.className = `nail${index === selectedIndex ? " selected" : ""}`;
    el.dataset.index = index;
    el.dataset.shape = shapeInput.value;
    el.dataset.finish = finishInput.value;
    el.dataset.design = designInput.value;
    el.dataset.material = materialInput.value;
    el.dataset.motif = motifInput.value;
    el.dataset.nailType = nailTypeInput.value;
    el.dataset.proMode = proModeInput.checked ? "true" : "false";
    el.dataset.realismBoost = realismBoostInput.checked ? "true" : "false";
    const referenceTexture =
      activeReferenceTextures.length && Number(photoFidelityInput.value) > 0.94
        ? activeReferenceTextures[0]
        : activeReferenceTextures[index % activeReferenceTextures.length];
    el.dataset.textureStyle = activeReferenceTextures.length ? "photo" : activePreset ? presetTextureStyle(activePreset) : "clean";
    const presetTexture = activePresetTextureUrl ?? assetFallbackUrls(activePreset?.textureImage ?? activePreset?.previewImage ?? activePreset?.exampleImage)[0];
    el.dataset.hasTexture = presetTexture || referenceTexture ? "true" : "false";
    el.dataset.referenceTexture = referenceTexture ? "true" : "false";
    el.style.setProperty("--x", nail.x);
    el.style.setProperty("--y", nail.y);
    el.style.setProperty("--scale", nail.scale);
    el.style.setProperty("--rotation", nail.rotation);
    el.style.setProperty("--width-scale", nail.widthScale ?? 1);
    el.style.setProperty("--height-scale", nail.heightScale ?? 1);
    if (nail.widthPct && nail.heightPct) {
      const length = Number(lengthInput.value);
      el.style.setProperty("--nail-width", `calc(${nail.widthPct} * 1%)`);
      el.style.setProperty("--nail-height", `calc(${nail.heightPct * length} * 1%)`);
      el.style.setProperty("--length-offset", `calc(-1 * ${Math.max(0, length - 1)} * ${nail.heightPct * 0.52} * 1%)`);
    } else {
      el.style.removeProperty("--nail-width");
      el.style.removeProperty("--nail-height");
      const manualLength = Number(lengthInput.value);
      el.style.setProperty("--length-offset", `calc(-1 * ${Math.max(0, manualLength - 1)} * 24px)`);
    }
    el.style.setProperty("--nail-color", colorInput.value);
    el.style.setProperty("--motif-color", motifColorInput.value);
    el.style.setProperty("--tip-color", tipColorInput.value);
    el.style.setProperty("--tip-amount", tipAmountInput.value);
    el.style.setProperty("--photo-fidelity", photoFidelityInput.value);
    el.style.setProperty("--motif-density", motifDensityInput.value);
    el.style.setProperty("--root-blend", rootBlendInput?.value ?? 0.72);
    el.style.setProperty("--gloss-strength", glossStrengthInput?.value ?? 0.92);
    el.style.setProperty("--render-shadow", shadowStrengthInput?.value ?? 0.88);
    el.style.setProperty("--texture-clarity", textureClarityInput?.value ?? 1.04);
    el.style.setProperty(
      "--preset-strength",
      proModeInput.checked ? Math.min(activePreset?.strength ?? 0.86, 0.9) : Math.max(activePreset?.strength ?? 0.98, 0.98),
    );
    el.style.setProperty("--nail-thickness", proModeInput.checked ? Number(thicknessInput.value) * 0.82 : thicknessInput.value);
    el.style.setProperty("--finger-index", index);
    if (referenceTexture) {
      const textureBase = activeReferenceAverageColor ?? colorInput.value;
      el.style.setProperty("--reference-texture", `url("${referenceTexture}")`);
      el.style.setProperty("--texture-color-a", tint(textureBase, 0.36));
      el.style.setProperty("--texture-color-b", textureBase);
      el.style.setProperty("--texture-color-c", shade(textureBase, 0.12));
      el.style.setProperty("--texture-accent", motifColorInput.value);
      el.style.setProperty("--texture-opacity", "1");
      el.style.setProperty("--photo-layer-opacity", `${0.82 + Number(photoFidelityInput.value) * 0.18}`);
      el.style.setProperty(
        "--surface-opacity",
        `${realismBoostInput.checked ? 0.18 : Math.max(0.03, 0.18 - Number(photoFidelityInput.value) * 0.14)}`,
      );
      el.style.setProperty("--texture-position", "50% 50%");
      el.style.setProperty("--texture-size", "cover");
    } else if (presetTexture) {
      const textureBase = activePreset.colorHint ?? colorInput.value;
      el.style.setProperty("--texture-image", `url("${presetTexture}")`);
      el.style.setProperty("--texture-color-a", tint(textureBase, proModeInput.checked ? 0.42 : 0.28));
      el.style.setProperty("--texture-color-b", textureBase);
      el.style.setProperty("--texture-color-c", shade(textureBase, proModeInput.checked ? 0.06 : 0.14));
      el.style.setProperty("--texture-accent", activePreset.material === "glitter" ? "#fff4c7" : motifColorInput.value);
      el.style.setProperty("--texture-opacity", proModeInput.checked ? 0.76 : 0.92);
      const placement = texturePlacements[index % texturePlacements.length];
      el.style.setProperty("--texture-position", placement.position);
      el.style.setProperty("--texture-size", placement.size);
    }

    el.addEventListener("pointerdown", startDrag);
    el.addEventListener("click", () => {
      selectedIndex = index;
      syncControls();
      renderNails();
    });

    const motif = document.createElement("div");
    motif.className = "nail-motif";
    const cuticle = document.createElement("div");
    cuticle.className = "nail-cuticle";
    const freeEdge = document.createElement("div");
    freeEdge.className = "nail-free-edge";
    const surface = document.createElement("div");
    surface.className = "nail-surface";
    const photoTexture = document.createElement("div");
    photoTexture.className = "nail-photo-texture";
    const tipEffect = document.createElement("div");
    tipEffect.className = "nail-tip-effect";
    const rim = document.createElement("div");
    rim.className = "nail-rim";
    el.append(cuticle, freeEdge, photoTexture, tipEffect, surface, rim);
    el.append(motif);
    nailLayer.append(el);
  });
  buildTabs();
}

function syncControls() {
  const nail = nails[selectedIndex];
  xInput.value = nail.x;
  yInput.value = nail.y;
  scaleInput.value = nail.scale;
  rotationInput.value = nail.rotation;
}

function updateSelectedNail() {
  nails[selectedIndex] = {
    x: Number(xInput.value),
    y: Number(yInput.value),
    scale: Number(scaleInput.value),
    rotation: Number(rotationInput.value),
    widthScale: nails[selectedIndex].widthScale ?? 1,
    heightScale: nails[selectedIndex].heightScale ?? 1,
  };
  renderNails();
}

function getCurrentHandColorSample() {
  if (currentMode === "empty") return { r: 224, g: 174, b: 154, brightness: 0.65, warmth: 0.55 };
  const source = currentMode === "camera" ? cameraFeed : handImage;
  const w = 48;
  const h = 48;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  try {
    ctx.drawImage(source, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 24) {
      const rr = data[i];
      const gg = data[i + 1];
      const bb = data[i + 2];
      const hsl = rgbToHsl(rr, gg, bb);
      if (hsl.lightness < 0.18 || hsl.lightness > 0.96) continue;
      r += rr;
      g += gg;
      b += bb;
      count += 1;
    }
    if (!count) throw new Error("no hand color sample");
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    return {
      r,
      g,
      b,
      brightness: (Math.max(r, g, b) + Math.min(r, g, b)) / 510,
      warmth: (r - b + 255) / 510,
    };
  } catch {
    return { r: 224, g: 174, b: 154, brightness: 0.65, warmth: 0.55 };
  }
}

function buildFitAdvice() {
  if (currentMode === "empty") {
    return {
      level: "medium",
      title: "まず手の写真かカメラを入れてね",
      lines: ["自分の手の色と指の長さを見てから、似合いチェックできます。"],
    };
  }

  const skin = getCurrentHandColorSample();
  const nailColor = hexToRgb(colorInput.value);
  const nailHsl = rgbToHsl(nailColor.r, nailColor.g, nailColor.b);
  const colorDistance = Math.hypot(nailColor.r - skin.r, nailColor.g - skin.g, nailColor.b - skin.b) / 441;
  const length = Number(lengthInput.value);
  const density = Number(motifDensityInput.value);
  const hasArt = motifInput.value !== "none" || activeReferenceTextures.length > 0 || designInput.value !== "solid";
  let score = 72;
  const lines = [];

  if (colorDistance < 0.18 && nailHsl.saturation < 0.45) {
    score += 12;
    lines.push("肌になじむ自然系。普段使い・仕事用に見せやすいです。");
  } else if (colorDistance > 0.55 || nailHsl.saturation > 0.72) {
    score += 4;
    lines.push("色の存在感が強め。写真映えやイベント向きです。");
  } else {
    score += 8;
    lines.push("肌から浮きすぎず、ちゃんとネイル感も出るバランスです。");
  }

  if (skin.warmth > 0.55 && nailColor.b > nailColor.r + 20) {
    score -= 5;
    lines.push("手が暖色寄りなので、青みが強い色は少しクールに見えます。");
  } else if (skin.warmth < 0.48 && nailColor.r > nailColor.b + 35) {
    score -= 4;
    lines.push("手がクール寄りなので、赤みが強い色は少し華やかに出ます。");
  }

  if (length <= 1.25) {
    score += 8;
    lines.push("長さは生活しやすい範囲。初めてでも試しやすいです。");
  } else if (length <= 1.9) {
    score += 5;
    lines.push("少し長めで指がきれいに見えやすい長さです。");
  } else {
    score -= 3;
    lines.push("かなり長め。写真映えはしますが、日常使いなら少し短くしても良さそうです。");
  }

  if (hasArt && density > 1.25) {
    score -= 2;
    lines.push("模様は多め。サロンに見せる時はこの画像を保存すると伝わりやすいです。");
  } else if (hasArt) {
    score += 4;
    lines.push("デザイン入りでも主張が強すぎず、選びやすい雰囲気です。");
  }

  if (nailTypeInput.value !== "natural" && Number(thicknessInput.value) > 0.5) {
    lines.push("付け爪・チップ感を出す設定なので、厚みと横幅の見え方を確認すると安心です。");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 82 ? "high" : score >= 66 ? "medium" : "low";
  const title = score >= 82 ? `似合い度 ${score}：かなり良い` : score >= 66 ? `似合い度 ${score}：調整すれば良い` : `似合い度 ${score}：少し見直し`;
  return { level, title, lines };
}

function renderFitAdvice() {
  const advice = buildFitAdvice();
  if (fitAdviceResult) {
    fitAdviceResult.innerHTML = `<strong>${advice.title}</strong><br>${advice.lines.map((line) => `・${line}`).join("<br>")}`;
  }
  updateQualityStatus({
    level: advice.level,
    text: `${advice.title}。${advice.lines[0] ?? ""}`,
  });
}

function candidateSummary() {
  const typeLabel = nailTypeInput.options[nailTypeInput.selectedIndex]?.textContent ?? "";
  const shapeLabel = shapeInput.options[shapeInput.selectedIndex]?.textContent ?? "";
  const lengthLabel = Number(lengthInput.value) <= 1.25 ? "短め" : Number(lengthInput.value) <= 1.9 ? "中〜長め" : "ロング";
  const designLabel = activeReferenceTextures.length
    ? "参考写真ネイル"
    : designInput.options[designInput.selectedIndex]?.textContent ?? "";
  return `${designLabel} / ${shapeLabel} / ${typeLabel} / ${lengthLabel}`;
}

async function saveCandidate() {
  if (currentMode === "empty") {
    alert("先に写真かカメラを入れてください。");
    return;
  }
  await renderCompositeToCanvas(exportCanvas);
  const imageDataUrl = exportCanvas.toDataURL("image/jpeg", 0.88);
  const advice = buildFitAdvice();
  savedCandidates.unshift({
    imageDataUrl,
    title: advice.title,
    summary: candidateSummary(),
    memo: buildSalonMemo(advice),
  });
  savedCandidates = savedCandidates.slice(0, 4);
  renderComparisonList();
}

function buildSalonMemo(advice = buildFitAdvice()) {
  const color = activeReferenceAverageColor ?? colorInput.value;
  const shapeLabel = shapeInput.options[shapeInput.selectedIndex]?.textContent ?? "";
  const typeLabel = nailTypeInput.options[nailTypeInput.selectedIndex]?.textContent ?? "";
  const designLabel = activeReferenceTextures.length
    ? "参考写真の雰囲気を再現"
    : designInput.options[designInput.selectedIndex]?.textContent ?? "";
  const lengthLabel = Number(lengthInput.value) <= 1.25 ? "短め・生活しやすい" : Number(lengthInput.value) <= 1.9 ? "少し長め" : "ロング";
  return [
    `色: ${color}`,
    `形: ${shapeLabel}`,
    `タイプ: ${typeLabel}`,
    `長さ: ${lengthLabel}`,
    `デザイン: ${designLabel}`,
    `似合いメモ: ${advice.title}`,
  ].join(" / ");
}

function renderComparisonList() {
  if (!comparisonList) return;
  comparisonList.innerHTML = "";
  if (!savedCandidates.length) {
    comparisonList.innerHTML = "<p>気になるネイルを保存すると、ここで比べられます。</p>";
    return;
  }
  savedCandidates.forEach((candidate, index) => {
    const card = document.createElement("div");
    card.className = "candidate-card";
    card.innerHTML = `
      <img src="${candidate.imageDataUrl}" alt="候補 ${index + 1}" />
      <div>
        <strong>候補 ${index + 1}</strong>
        <span>${candidate.summary}</span>
        <span>${candidate.title}</span>
        <span>${candidate.memo}</span>
      </div>
    `;
    comparisonList.append(card);
  });
}

async function downloadSalonSheet() {
  if (!savedCandidates.length) {
    alert("まず候補として保存してください。");
    return;
  }

  const sheet = document.createElement("canvas");
  sheet.width = 1400;
  sheet.height = 1900;
  const ctx = sheet.getContext("2d");
  ctx.fillStyle = "#fffaf8";
  ctx.fillRect(0, 0, sheet.width, sheet.height);

  ctx.fillStyle = "#2f2725";
  ctx.font = "bold 54px sans-serif";
  ctx.fillText("Nail Fit Studio 比較シート", 80, 100);
  ctx.font = "28px sans-serif";
  ctx.fillStyle = "#756965";
  ctx.fillText("サロンで相談するときに、この画像を見せてください。", 82, 148);

  const now = new Date();
  ctx.font = "22px sans-serif";
  ctx.fillText(`作成日: ${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`, 82, 188);

  const slots = savedCandidates.slice(0, 4);
  const cardW = 600;
  const cardH = 720;
  const positions = [
    [80, 250],
    [720, 250],
    [80, 1010],
    [720, 1010],
  ];

  for (let i = 0; i < slots.length; i += 1) {
    const candidate = slots[i];
    const [x, y] = positions[i];
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, x, y, cardW, cardH, 26);
    ctx.fill();
    ctx.strokeStyle = "rgba(47,39,37,0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();

    const image = await loadImageElement(candidate.imageDataUrl);
    const imageW = cardW - 60;
    const imageH = 420;
    ctx.save();
    roundRect(ctx, x + 30, y + 30, imageW, imageH, 20);
    ctx.clip();
    drawCoverImage(ctx, image, x + 30, y + 30, imageW, imageH);
    ctx.restore();

    ctx.fillStyle = "#9a5368";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText(`候補 ${i + 1}`, x + 30, y + 505);

    ctx.fillStyle = "#2f2725";
    ctx.font = "bold 24px sans-serif";
    wrapText(ctx, candidate.summary, x + 30, y + 545, cardW - 60, 32, 2);

    ctx.fillStyle = "#756965";
    ctx.font = "22px sans-serif";
    wrapText(ctx, candidate.memo, x + 30, y + 625, cardW - 60, 30, 3);
  }

  ctx.fillStyle = "#9a5368";
  ctx.font = "24px sans-serif";
  ctx.fillText("お願いメモ: 実際の爪の状態・生活スタイルに合わせて、長さと厚みはサロンで調整してください。", 80, 1830);

  downloadCanvas(sheet, "nail-salon-comparison-sheet.png");
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sw = width / scale;
  const sh = height / scale;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = (image.naturalHeight - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const chars = String(text).split("");
  let line = "";
  let lines = 0;
  for (const char of chars) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lines += 1;
      line = char;
      if (lines >= maxLines) return;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y);
}

function loadImage(src) {
  stopCamera();
  currentMode = "image";
  currentImageUrl = src;
  handImage.src = src;
  handImage.style.display = "block";
  cameraFeed.style.display = "none";
  liveCanvas.style.display = "none";
  imageStage.style.display = "block";
  emptyState.style.display = "none";
  updateQualityStatus({
    level: activeReferenceTextures.length ? "medium" : "low",
    text: activeReferenceTextures.length
      ? "写真素材モードです。参考ネイルの質感を優先して表示します。"
      : "手の写真を読み込みました。参考ネイル写真を追加すると再現度が上がります。",
  });
}

photoInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) return;
  const url = URL.createObjectURL(file);
  loadImage(url);
});

referenceNailInput.addEventListener("change", handleReferenceNailPhoto);

sampleButton.addEventListener("click", () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100" viewBox="0 0 900 1100">
      <defs>
        <linearGradient id="bg" x1="0" x2="1">
          <stop stop-color="#ead7d0"/>
          <stop offset="1" stop-color="#f7ede8"/>
        </linearGradient>
        <linearGradient id="skin" x1="0" x2="1">
          <stop stop-color="#d69f84"/>
          <stop offset="1" stop-color="#efc1a6"/>
        </linearGradient>
      </defs>
      <rect width="900" height="1100" fill="url(#bg)"/>
      <path fill="url(#skin)" d="M255 1010c-22-140-20-260 5-356 20-77 47-172 72-273 8-34 22-53 44-53 25 0 39 18 39 52V190c0-32 16-48 39-48 24 0 40 16 40 48v174-211c0-31 17-48 40-48 25 0 41 18 41 48v225-176c0-31 17-47 39-47 24 0 40 17 40 47v216-130c0-31 16-48 39-48 24 0 40 18 40 48v241c0 85-22 161-60 243-36 77-79 155-101 238H255Z"/>
    </svg>
  `;
  loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
});

cameraButton.addEventListener("click", async () => {
  await startCamera(cameraFacingMode);
});

switchCameraButton?.addEventListener("click", async () => {
  cameraFacingMode = cameraFacingMode === "user" ? "environment" : "user";
  await startCamera(cameraFacingMode);
});

capturePhotoButton?.addEventListener("click", async () => {
  await captureCameraPhoto();
});

captureAiFinishButton?.addEventListener("click", async () => {
  const captured = await captureCameraPhoto();
  if (!captured) return;
  setTimeout(() => aiFinishButton?.click(), 160);
});

async function captureCameraPhoto() {
  if (currentMode !== "camera" || !cameraFeed.videoWidth || !cameraFeed.videoHeight) {
    alert("先にカメラを起動してください。");
    return false;
  }

  const captureCanvas = document.createElement("canvas");
  captureCanvas.width = cameraFeed.videoWidth;
  captureCanvas.height = cameraFeed.videoHeight;
  const ctx = captureCanvas.getContext("2d");
  if (cameraFacingMode === "user") {
    ctx.translate(captureCanvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(cameraFeed, 0, 0, captureCanvas.width, captureCanvas.height);
  const imageUrl = captureCanvas.toDataURL("image/jpeg", 0.94);
  loadImage(imageUrl);
  trackingStatus.textContent = "写真を撮りました。この静止画で位置調整やAI写真仕上げができます。";
  updateQualityStatus({
    level: "high",
    text: "カメラ写真を固定しました。必要なら位置を微調整して、AI写真仕上げを試せます。",
  });
  return true;
}

async function startCamera(facingMode = "user") {
  try {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode } },
      audio: false,
    });
    cameraFacingMode = facingMode;
    currentMode = "camera";
    currentImageUrl = "";
    cameraFeed.srcObject = cameraStream;
    cameraFeed.dataset.facing = cameraFacingMode;
    window.nailCameraMirrored = cameraFacingMode === "user";
    handImage.style.display = "none";
    cameraFeed.style.display = "block";
    liveCanvas.style.display = "block";
    imageStage.style.display = "block";
    emptyState.style.display = "none";
    cameraButton.classList.add("is-hidden");
    switchCameraButton?.classList.remove("is-hidden");
    capturePhotoButton?.classList.remove("is-hidden");
    captureAiFinishButton?.classList.remove("is-hidden");
    if (switchCameraButton) {
      switchCameraButton.textContent = cameraFacingMode === "user" ? "外カメラに切り替え" : "内カメラに切り替え";
    }
    stopCameraButton.classList.remove("is-hidden");
    trackingStatus.textContent =
      cameraFacingMode === "user"
        ? "内カメラです。手を映してください。指先と爪らしい領域を見てネイルを追従します。"
        : "外カメラです。手を映してください。指先と爪らしい領域を見てネイルを追従します。";
    if (window.startHandTracking) {
      autoTracking = await window.startHandTracking(cameraFeed, updateTrackedNails);
      if (!autoTracking) {
        trackingStatus.textContent =
          "自動追従を起動できませんでした。通信状態を確認して再読み込みしてください。";
      }
    }
  } catch (error) {
    if (facingMode === "environment") {
      cameraFacingMode = "user";
      trackingStatus.textContent = "外カメラに切り替えられませんでした。内カメラに戻します。";
      await startCamera("user");
      return;
    }
    alert("カメラを使えませんでした。ブラウザのカメラ許可を確認してください。");
  }
}

stopCameraButton.addEventListener("click", () => {
  stopCamera();
  if (currentMode === "camera") {
    currentMode = "empty";
    imageStage.style.display = "none";
    emptyState.style.display = "grid";
  }
});

[xInput, yInput, scaleInput, rotationInput].forEach((input) =>
  input.addEventListener("input", updateSelectedNail),
);

[proModeInput, realismBoostInput, colorInput, shapeInput, finishInput, designInput, materialInput, motifInput, motifColorInput, tipColorInput, tipAmountInput, photoFidelityInput, motifDensityInput, lengthInput, thicknessInput, rootBlendInput, glossStrengthInput, shadowStrengthInput, textureClarityInput].forEach((input) =>
  input.addEventListener("input", () => {
    if (presetInput && document.activeElement !== presetInput) {
      activePreset = null;
      presetInput.value = "";
    }
    renderNails();
    drawLiveNails();
  }),
);

salonCheckButton?.addEventListener("click", () => {
  const checks = [];
  if (currentMode === "empty") checks.push("手の写真かカメラを入れてください。");
  if (!proModeInput.checked) checks.push("プロモードをオンにすると自然に見えます。");
  if (!realismBoostInput.checked) checks.push("リアル強化をオンにすると根元と艶がなじみます。");
  if (activeReferenceTextures.length && !referenceExtractorSession && referenceExtractorTried) {
    checks.push("参考写真AIモデルが未読込です。モデルを書き出すと柄の切り抜きが安定します。");
  }
  if (Number(lengthInput.value) > 2.25 && nailTypeInput.value === "natural") {
    checks.push("長めの爪は「付け爪/チップ」か「アクリル長め」にすると自然です。");
  }
  if (Number(photoFidelityInput.value) < 0.82 && activeReferenceTextures.length) {
    checks.push("参考写真を強く似せたい時は、写真への似せ具合を上げてください。");
  }
  if (Number(rootBlendInput?.value ?? 0.72) < 0.42) {
    checks.push("根元のなじみが弱いので、少し上げると浮きにくいです。");
  }

  if (!checks.length) {
    updateQualityStatus({
      level: "high",
      text: "サロン確認OK。根元・艶・影・写真素材の状態は仕事用として見せやすい設定です。",
    });
    return;
  }

  updateQualityStatus({
    level: checks.length <= 2 ? "medium" : "low",
    text: `サロン確認: ${checks.join(" ")}`,
  });
});

fitCheckButton?.addEventListener("click", renderFitAdvice);
saveCandidateButton?.addEventListener("click", saveCandidate);
clearCandidatesButton?.addEventListener("click", () => {
  savedCandidates = [];
  renderComparisonList();
});
downloadSalonSheetButton?.addEventListener("click", downloadSalonSheet);

applyCustomDesignButton.addEventListener("click", applyCustomDesign);
customDesignInput.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    applyCustomDesign();
  }
});

nailTypeInput.addEventListener("input", () => {
  activePreset = null;
  if (presetInput) presetInput.value = "";
  applyNailTypeDefaults();
});

resetButton.addEventListener("click", () => {
  nails = structuredClone(defaultNails);
  syncControls();
  renderNails();
});

function startDrag(event) {
  if (currentMode === "empty" || autoTracking) return;
  const index = Number(event.currentTarget.dataset.index);
  selectedIndex = index;
  const rect = nailLayer.getBoundingClientRect();

  const move = (moveEvent) => {
    nails[index].x = ((moveEvent.clientX - rect.left) / rect.width) * 100;
    nails[index].y = ((moveEvent.clientY - rect.top) / rect.height) * 100;
    syncControls();
    renderNails();
  };

  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop);
}

downloadButton.addEventListener("click", async () => {
  if (currentMode === "empty") {
    alert("先に写真を選んでください。");
    return;
  }

  await renderCompositeToCanvas(exportCanvas);
  downloadCanvas(exportCanvas, "nail-fit.png");
});

aiFinishButton?.addEventListener("click", async () => {
  if (currentMode === "empty") {
    alert("先に写真かカメラを入れて、ネイルを合わせてください。");
    return;
  }

  aiFinishButton.disabled = true;
  aiFinishStatus.textContent = "写真仕上げを作っています。APIキーがある場合は画像生成AI、ない場合はローカル補正で仕上げます...";

  try {
    await renderCompositeToCanvas(exportCanvas);
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = exportCanvas.width;
    maskCanvas.height = exportCanvas.height;
    drawAiFinishMask(maskCanvas);
    const openAiMaskCanvas = document.createElement("canvas");
    openAiMaskCanvas.width = exportCanvas.width;
    openAiMaskCanvas.height = exportCanvas.height;
    drawOpenAiEditMask(openAiMaskCanvas);

    const prompt = buildAiFinishPrompt();
    const response = await fetch("/api/ai-finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        composite: exportCanvas.toDataURL("image/png"),
        mask: openAiMaskCanvas.toDataURL("image/png"),
        prompt,
      }),
    });

    const result = response.ok ? await response.json() : { fallback: true };
    const imageDataUrl =
      result.imageDataUrl ??
      (await createLocalPhotoFinish(exportCanvas, maskCanvas));

    showAiFinishResult(imageDataUrl);
    aiFinishStatus.textContent = result.provider === "openai"
      ? "画像生成AIで写真仕上げしました。手や背景はなるべく保持し、ネイル部分を自然に補正しています。"
      : "APIキーがない/使えないため、サイト内のローカル写真風補正で仕上げました。APIキーを入れると生成AI補正まで進めます。";
  } catch (error) {
    console.error(error);
    try {
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = exportCanvas.width;
      maskCanvas.height = exportCanvas.height;
      drawAiFinishMask(maskCanvas);
      const imageDataUrl = await createLocalPhotoFinish(exportCanvas, maskCanvas);
      showAiFinishResult(imageDataUrl);
      aiFinishStatus.textContent = "画像生成AIには接続できませんでしたが、ローカル写真風補正で仕上げました。";
    } catch {
      aiFinishStatus.textContent = "写真仕上げに失敗しました。写真かカメラを入れ直してもう一度試してください。";
    }
  } finally {
    aiFinishButton.disabled = false;
  }
});

downloadAiFinishButton?.addEventListener("click", () => {
  if (!aiFinishImage?.src) return;
  const link = document.createElement("a");
  link.download = "nail-ai-finish-result.png";
  link.href = aiFinishImage.src;
  link.click();
});

async function renderCompositeToCanvas(canvas) {
  const source = currentMode === "camera" ? cameraFeed : handImage;
  if (currentMode === "image") {
    await handImage.decode();
  }
  const width = currentMode === "camera" ? cameraFeed.videoWidth : handImage.naturalWidth;
  const height = currentMode === "camera" ? cameraFeed.videoHeight : handImage.naturalHeight;
  const ctx = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (currentMode === "camera" && cameraFacingMode === "user") {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, width, height);
  if (currentMode === "camera" && cameraFacingMode === "user") {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  nails.forEach((nail, index) => {
    drawNail(ctx, nail, width, height, index);
  });
}

function drawAiFinishMask(canvas) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "white";
  nails.forEach((nail) => {
    drawNailMaskShape(ctx, nail, width, height);
  });
}

function drawOpenAiEditMask(canvas) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "destination-out";
  nails.forEach((nail) => {
    drawNailMaskShape(ctx, nail, width, height);
  });
  ctx.globalCompositeOperation = "source-over";
}

function drawNailMaskShape(ctx, nail, width, height) {
  const x = (nail.x / 100) * width;
  const y = (nail.y / 100) * height;
  const nailWidth =
    (nail.widthPct ? (nail.widthPct / 100) * width : 54 * (width / nailLayer.clientWidth)) *
    nail.scale;
  const nailHeightBase =
    (nail.heightPct ? (nail.heightPct / 100) * height : 94 * (height / nailLayer.clientHeight)) *
    nail.scale;
  const length = Number(lengthInput.value);
  const nailHeight = nailHeightBase * length;
  const rootLockOffset = Math.max(0, nailHeight * (1 - 1 / Math.max(1, length)) * 0.52);
  const widthScale = nail.widthScale ?? 1;
  const heightScale = nail.heightScale ?? 1;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((nail.rotation * Math.PI) / 180);
  ctx.translate(0, -rootLockOffset);
  ctx.beginPath();

  if (shapeInput.value === "square") {
    roundRect(
      ctx,
      (-nailWidth * widthScale) / 2,
      (-nailHeight * heightScale) / 2,
      nailWidth * widthScale,
      nailHeight * heightScale,
      nailWidth * widthScale * 0.22,
    );
  } else if (shapeInput.value === "coffin") {
    ctx.moveTo(-nailWidth * widthScale * 0.28, (-nailHeight * heightScale) / 2);
    ctx.lineTo(nailWidth * widthScale * 0.28, (-nailHeight * heightScale) / 2);
    ctx.lineTo(nailWidth * widthScale * 0.46, -nailHeight * heightScale * 0.28);
    ctx.lineTo(nailWidth * widthScale * 0.38, (nailHeight * heightScale) / 2);
    ctx.lineTo(-nailWidth * widthScale * 0.38, (nailHeight * heightScale) / 2);
    ctx.lineTo(-nailWidth * widthScale * 0.46, -nailHeight * heightScale * 0.28);
    ctx.closePath();
  } else {
    ctx.ellipse(
      0,
      0,
      (nailWidth * widthScale) / 2,
      (nailHeight * heightScale) / 2,
      0,
      0,
      Math.PI * 2,
    );
  }

  ctx.fill();
  ctx.restore();
}

function buildAiFinishPrompt() {
  const referenceMode = activeReferenceTextureImages.length
    ? "参考写真から切り出したネイル柄を使っています。"
    : "サイト上で作ったネイル色と模様を使っています。";
  const designNote = customDesignInput.value.trim()
    ? `ユーザー指定デザイン: ${customDesignInput.value.trim()}`
    : `デザイン: ${designInput.value}, 素材感: ${materialInput.value}, 模様: ${motifInput.value}`;

  return [
    "目的: バーチャルネイル試着画像を、実写写真のように自然に補正してください。",
    "",
    "重要ルール:",
    "1. 手、指、肌、背景、構図、指の太さ、指輪や小物は変えない。",
    "2. マスク画像の白い部分だけを編集し、黒い部分はできるだけ保持する。",
    "3. ネイルの位置、根元、長さ、形は大きく変えない。",
    "4. ネイルだけを本物のジェル/チップのように、光沢・厚み・側面の影・根元のなじみを自然にする。",
    "5. 参考写真の柄がある場合は、爪の中だけに柄を入れ、手や背景の写真成分を混ぜない。",
    "6. 爪先だけ色が違うデザインやグラデーションは、境目を柔らかくして実写っぽくする。",
    "7. 安っぽいCG感、強すぎる白ハイライト、浮いた輪郭、肌へのはみ出しを避ける。",
    "",
    referenceMode,
    designNote,
    "",
    "出力: 元写真と同じ比率・同じ構図で、ネイルだけを高品質な実写風に補正した画像。",
  ].join("\n");
}

function downloadCanvas(canvas, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function showAiFinishResult(imageDataUrl) {
  if (!aiFinishResult || !aiFinishImage) return;
  aiFinishImage.src = imageDataUrl;
  aiFinishResult.classList.remove("is-hidden");
}

async function createLocalPhotoFinish(compositeCanvas, maskCanvas) {
  const canvas = document.createElement("canvas");
  canvas.width = compositeCanvas.width;
  canvas.height = compositeCanvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(compositeCanvas, 0, 0);

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mask = maskCanvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const maskData = mask.data;

  for (let i = 0; i < data.length; i += 4) {
    const m = maskData[i] / 255;
    if (m < 0.08) continue;

    const x = (i / 4) % canvas.width;
    const y = Math.floor(i / 4 / canvas.width);
    const grain = (((x * 17 + y * 31) % 19) - 9) * 0.55;
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const avg = (r + g + b) / 3;
    const contrast = 1.08;
    const sat = 1.08;
    r = avg + (r - avg) * sat;
    g = avg + (g - avg) * sat;
    b = avg + (b - avg) * sat;
    r = (r - 128) * contrast + 128 + grain;
    g = (g - 128) * contrast + 128 + grain;
    b = (b - 128) * contrast + 128 + grain;

    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
  }

  ctx.putImageData(image, 0, 0);

  const softened = document.createElement("canvas");
  softened.width = canvas.width;
  softened.height = canvas.height;
  const softenedCtx = softened.getContext("2d");
  softenedCtx.filter = "blur(0.45px) saturate(1.05) contrast(1.04)";
  softenedCtx.drawImage(compositeCanvas, 0, 0);
  softenedCtx.globalCompositeOperation = "destination-in";
  softenedCtx.drawImage(createAlphaMaskCanvas(maskCanvas), 0, 0);
  ctx.drawImage(softened, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.16;
  nails.forEach((nail) => drawAiGlossStroke(ctx, nail, canvas.width, canvas.height));
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.08;
  nails.forEach((nail) => drawAiEdgeDepth(ctx, nail, canvas.width, canvas.height));
  ctx.restore();

  return canvas.toDataURL("image/png");
}

function drawAiGlossStroke(ctx, nail, width, height) {
  const x = (nail.x / 100) * width;
  const y = (nail.y / 100) * height;
  const nailWidth = 54 * nail.scale * (width / nailLayer.clientWidth) * (nail.widthScale ?? 1);
  const nailHeight = 94 * nail.scale * (height / nailLayer.clientHeight) * (nail.heightScale ?? 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((nail.rotation * Math.PI) / 180);
  const gloss = ctx.createLinearGradient(-nailWidth * 0.35, -nailHeight * 0.45, nailWidth * 0.22, nailHeight * 0.35);
  gloss.addColorStop(0, "rgba(255,255,255,0)");
  gloss.addColorStop(0.42, "rgba(255,255,255,0.7)");
  gloss.addColorStop(0.5, "rgba(255,255,255,0.12)");
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(-nailWidth * 0.08, -nailHeight * 0.08, nailWidth * 0.18, nailHeight * 0.42, 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAiEdgeDepth(ctx, nail, width, height) {
  const x = (nail.x / 100) * width;
  const y = (nail.y / 100) * height;
  const nailWidth = 54 * nail.scale * (width / nailLayer.clientWidth) * (nail.widthScale ?? 1);
  const nailHeight = 94 * nail.scale * (height / nailLayer.clientHeight) * (nail.heightScale ?? 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((nail.rotation * Math.PI) / 180);
  ctx.fillStyle = "rgba(40,12,22,0.8)";
  ctx.beginPath();
  ctx.ellipse(0, nailHeight * 0.34, nailWidth * 0.34, nailHeight * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function createAlphaMaskCanvas(maskCanvas) {
  const alphaCanvas = document.createElement("canvas");
  alphaCanvas.width = maskCanvas.width;
  alphaCanvas.height = maskCanvas.height;
  const sourceCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  const alphaCtx = alphaCanvas.getContext("2d");
  const image = sourceCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i];
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = alpha;
  }
  alphaCtx.putImageData(image, 0, 0);
  return alphaCanvas;
}

function drawNail(ctx, nail, width, height, index = 0) {
  const x = (nail.x / 100) * width;
  const y = (nail.y / 100) * height;
  const nailWidth =
    (nail.widthPct ? (nail.widthPct / 100) * width : 54 * (width / nailLayer.clientWidth)) *
    nail.scale;
  const nailHeightBase =
    (nail.heightPct ? (nail.heightPct / 100) * height : 94 * (height / nailLayer.clientHeight)) *
    nail.scale;
  const length = Number(lengthInput.value);
  const nailHeight = nailHeightBase * length;
  const rootLockOffset = Math.max(0, nailHeight * (1 - 1 / Math.max(1, length)) * 0.52);
  const widthScale = nail.widthScale ?? 1;
  const heightScale = nail.heightScale ?? 1;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((nail.rotation * Math.PI) / 180);
  ctx.translate(0, -rootLockOffset);
  const gradient = ctx.createLinearGradient(
    0,
    (-nailHeight * heightScale) / 2,
    0,
    (nailHeight * heightScale) / 2,
  );
  gradient.addColorStop(0, tint(colorInput.value, 0.28));
  gradient.addColorStop(0.55, colorInput.value);
  gradient.addColorStop(1, shade(colorInput.value, 0.12));
  ctx.fillStyle = gradient;
  ctx.beginPath();

  if (shapeInput.value === "square") {
    roundRect(
      ctx,
      (-nailWidth * widthScale) / 2,
      (-nailHeight * heightScale) / 2,
      nailWidth * widthScale,
      nailHeight * heightScale,
      nailWidth * widthScale * 0.22,
    );
  } else if (shapeInput.value === "coffin") {
    ctx.moveTo(-nailWidth * widthScale * 0.28, (-nailHeight * heightScale) / 2);
    ctx.lineTo(nailWidth * widthScale * 0.28, (-nailHeight * heightScale) / 2);
    ctx.lineTo(nailWidth * widthScale * 0.46, -nailHeight * heightScale * 0.28);
    ctx.lineTo(nailWidth * widthScale * 0.38, (nailHeight * heightScale) / 2);
    ctx.lineTo(-nailWidth * widthScale * 0.38, (nailHeight * heightScale) / 2);
    ctx.lineTo(-nailWidth * widthScale * 0.46, -nailHeight * heightScale * 0.28);
    ctx.closePath();
  } else {
    ctx.ellipse(
      0,
      0,
      (nailWidth * widthScale) / 2,
      (nailHeight * heightScale) / 2,
      0,
      0,
      Math.PI * 2,
    );
  }

  ctx.fill();

  if (activeReferenceTextureImages.length) {
    ctx.save();
    ctx.clip();
    drawReferenceTexture(ctx, nailWidth * widthScale, nailHeight * heightScale, index, 1);
    drawReferenceRealismLayers(ctx, nailWidth * widthScale, nailHeight * heightScale, Number(thicknessInput.value), 0.62);
    ctx.restore();
  } else if (activePresetTextureImage?.complete && activePresetTextureImage.naturalWidth) {
    ctx.save();
    ctx.clip();
    drawPresetTextureOnCanvas(ctx, nailWidth * widthScale, nailHeight * heightScale, index, 0.62);
    drawReferenceRealismLayers(ctx, nailWidth * widthScale, nailHeight * heightScale, Number(thicknessInput.value) * 0.75, 0.62);
    ctx.restore();
  }

  if (
    (!activeReferenceTextureImages.length || Number(photoFidelityInput.value) < 0.75) &&
    (["tip_gradient", "tip_glitter", "tip_pattern"].includes(motifInput.value) || designInput.value === "french")
  ) {
    ctx.save();
    ctx.clip();
    const tipGradient = ctx.createLinearGradient(0, -nailHeight * heightScale * 0.5, 0, -nailHeight * heightScale * 0.12);
    tipGradient.addColorStop(0, withAlpha(tipColorInput.value, 0.82));
    tipGradient.addColorStop(1, withAlpha(tipColorInput.value, 0));
    ctx.fillStyle = tipGradient;
    ctx.fillRect(
      (-nailWidth * widthScale) / 2,
      (-nailHeight * heightScale) / 2,
      nailWidth * widthScale,
      nailHeight * heightScale * Number(tipAmountInput.value),
    );
    ctx.restore();
  }

  ctx.globalAlpha = 0.72;
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.beginPath();
  ctx.ellipse(
    -nailWidth * widthScale * 0.12,
    -nailHeight * heightScale * 0.18,
    nailWidth * widthScale * 0.16,
    nailHeight * heightScale * 0.24,
    0.24,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawReferenceRealismLayers(ctx, nailWidth, nailHeight, thickness, sceneLight) {
  const boost = realismBoostInput.checked ? 1.55 : 1;
  ctx.save();

  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = (0.15 + thickness * 0.08) * boost;
  const edgeDepth = ctx.createLinearGradient(-nailWidth * 0.52, 0, nailWidth * 0.52, 0);
  edgeDepth.addColorStop(0, "rgba(28,8,18,0.55)");
  edgeDepth.addColorStop(0.17, "rgba(28,8,18,0.05)");
  edgeDepth.addColorStop(0.83, "rgba(28,8,18,0.04)");
  edgeDepth.addColorStop(1, "rgba(28,8,18,0.46)");
  ctx.fillStyle = edgeDepth;
  ctx.fillRect(-nailWidth * 0.52, -nailHeight * 0.52, nailWidth * 1.04, nailHeight * 1.04);

  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = (0.16 + sceneLight * 0.1) * boost;
  const glass = ctx.createLinearGradient(
    -nailWidth * 0.36,
    -nailHeight * 0.46,
    nailWidth * 0.28,
    nailHeight * 0.38,
  );
  glass.addColorStop(0, "rgba(255,255,255,0)");
  glass.addColorStop(0.34, "rgba(255,255,255,0.14)");
  glass.addColorStop(0.42, "rgba(255,255,255,0.62)");
  glass.addColorStop(0.5, "rgba(255,255,255,0.06)");
  glass.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glass;
  ctx.fillRect(-nailWidth * 0.52, -nailHeight * 0.52, nailWidth * 1.04, nailHeight * 1.04);

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.18 * boost;
  const cuticleBlend = ctx.createLinearGradient(0, -nailHeight * 0.5, 0, -nailHeight * 0.18);
  cuticleBlend.addColorStop(0, "rgba(255,238,230,0.42)");
  cuticleBlend.addColorStop(1, "rgba(255,238,230,0)");
  ctx.fillStyle = cuticleBlend;
  ctx.fillRect(-nailWidth * 0.42, -nailHeight * 0.52, nailWidth * 0.84, nailHeight * 0.34);

  ctx.globalAlpha = (0.12 + thickness * 0.08) * boost;
  const freeEdge = ctx.createLinearGradient(0, nailHeight * 0.32, 0, nailHeight * 0.5);
  freeEdge.addColorStop(0, "rgba(255,255,255,0)");
  freeEdge.addColorStop(1, "rgba(28,9,16,0.42)");
  ctx.fillStyle = freeEdge;
  ctx.fillRect(-nailWidth * 0.42, nailHeight * 0.32, nailWidth * 0.84, nailHeight * 0.18);

  ctx.restore();
}

function drawPresetTextureOnCanvas(ctx, nailWidth, nailHeight, index, alpha = 0.58) {
  if (!activePresetTextureImage?.complete || !activePresetTextureImage.naturalWidth) return;
  const clarity = Number(textureClarityInput?.value ?? 1.04);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "source-atop";
  ctx.filter = `saturate(${0.98 + clarity * 0.18}) contrast(${0.98 + clarity * 0.12}) brightness(1.02)`;
  ctx.drawImage(activePresetTextureImage, -nailWidth * 0.5, -nailHeight * 0.5, nailWidth, nailHeight);
  ctx.filter = "none";
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.12;
  const contour = ctx.createLinearGradient(-nailWidth * 0.5, 0, nailWidth * 0.5, 0);
  contour.addColorStop(0, "rgba(0,0,0,0.34)");
  contour.addColorStop(0.22, "rgba(255,255,255,0.04)");
  contour.addColorStop(0.78, "rgba(255,255,255,0.03)");
  contour.addColorStop(1, "rgba(255,255,255,0.28)");
  ctx.fillStyle = contour;
  ctx.fillRect(-nailWidth * 0.5, -nailHeight * 0.5, nailWidth, nailHeight);
  ctx.restore();
}

function tint(hex, amount) {
  return mixColor(hex, "#ffffff", amount);
}

function shade(hex, amount) {
  return mixColor(hex, "#000000", amount);
}

function mixColor(hexA, hexB, amount) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const mixed = {
    r: Math.round(a.r + (b.r - a.r) * amount),
    g: Math.round(a.g + (b.g - a.g) * amount),
    b: Math.round(a.b + (b.b - a.b) * amount),
  };
  return `rgb(${mixed.r}, ${mixed.g}, ${mixed.b})`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function stopCamera() {
  if (!cameraStream) return;
  cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  cameraFeed.srcObject = null;
  cameraFeed.dataset.facing = "user";
  window.nailCameraMirrored = true;
  cameraFeed.style.display = "none";
  liveCanvas.style.display = "none";
  cameraButton.classList.remove("is-hidden");
  switchCameraButton?.classList.add("is-hidden");
  capturePhotoButton?.classList.add("is-hidden");
  captureAiFinishButton?.classList.add("is-hidden");
  stopCameraButton.classList.add("is-hidden");
  trackingStatus.textContent = "カメラを起動すると、指先の自動追従を準備します。";
  autoTracking = false;
  if (window.stopHandTracking) {
    window.stopHandTracking();
  }
}

function updateTrackedNails(nextNails, handDetected) {
  if (currentMode !== "camera") return;

  if (!handDetected) {
    lostHandFrames += 1;
    trackingStatus.textContent =
      lostHandFrames < 12
        ? "一瞬手を見失いました。最後の位置を保ちながら復帰を待っています。"
        : "手が見えません。手をカメラ中央に戻してください。";
    updateQualityStatus({
      level: lostHandFrames < 12 ? "medium" : "low",
      text: lostHandFrames < 12 ? "追従を一時保持中。大きく動かすとズレる可能性があります。" : "手を再検出するまで品質は下がります。",
    });
    if (lastGoodNails.length === 5) {
      nails = structuredClone(lastGoodNails);
      drawLiveNails();
    }
    return;
  }

  lostHandFrames = 0;
  trackingStatus.textContent =
    "指先と爪らしい領域を認識中。ネイルが自動で追従しています。";
  updateLightingProbe();
  const avgConfidence =
    nextNails.reduce((sum, nail) => sum + (nail.aiConfidence ?? 0), 0) / Math.max(1, nextNails.length);
  const hasAi = window.nailAiStatus === "ready";
  nails = nextNails.map((nextNail, index) => ({
    x: smooth(nails[index]?.x ?? nextNail.x, nextNail.x, 0.44),
    y: smooth(nails[index]?.y ?? nextNail.y, nextNail.y, 0.44),
    scale: smooth(nails[index]?.scale ?? nextNail.scale, nextNail.scale, 0.18),
    rotation: smoothAngle(nails[index]?.rotation ?? nextNail.rotation, nextNail.rotation, 0.26),
    widthScale: smooth(nails[index]?.widthScale ?? 1, nextNail.widthScale ?? 1, 0.22),
    heightScale: smooth(nails[index]?.heightScale ?? 1, nextNail.heightScale ?? 1, 0.22),
    widthPct: smooth(nails[index]?.widthPct ?? nextNail.widthPct, nextNail.widthPct, hasAi ? 0.42 : 0.28),
    heightPct: smooth(nails[index]?.heightPct ?? nextNail.heightPct, nextNail.heightPct, hasAi ? 0.42 : 0.28),
    aiConfidence: nextNail.aiConfidence ?? 0,
  }));
  lastGoodNails = structuredClone(nails);
  updateQualityStatus({
    level: hasAi && avgConfidence > 0.01 ? "high" : hasAi ? "medium" : "low",
    text: hasAi
      ? `AI爪輪郭で追従中。安定度 ${Math.round(Math.min(1, avgConfidence * 42) * 100)}%。`
      : "指先推定で追従中。AI爪モデルが読み込めると精度が上がります。",
  });
  syncControls();
  renderNails();
  drawLiveNails();
}

function updateQualityStatus({ level, text }) {
  if (!qualityStatus) return;
  qualityStatus.dataset.level = level;
  qualityStatus.innerHTML = `<strong>Salon quality</strong><span>${text}</span>`;
}

function updateLightingProbe() {
  if (currentMode !== "camera" || !cameraFeed.videoWidth || performance.now() - lightingProbe.updatedAt < 180) return;
  const w = 96;
  const h = 96;
  probeCanvas.width = w;
  probeCanvas.height = h;
  probeCtx.drawImage(cameraFeed, 0, 0, w, h);
  const { data } = probeCtx.getImageData(0, 0, w, h);
  let light = 0;
  let warmth = 0;
  let contrast = 0;
  let prev = null;
  const samples = w * h;
  for (let i = 0; i < samples; i += 8) {
    const index = i * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
    light += l;
    warmth += (r - b + 255) / 510;
    if (prev !== null) contrast += Math.abs(l - prev);
    prev = l;
  }
  const count = Math.ceil(samples / 8);
  lightingProbe = {
    brightness: light / count,
    warmth: warmth / count,
    contrast: Math.min(1, (contrast / Math.max(1, count - 1)) * 8),
    updatedAt: performance.now(),
  };
}

function sampleLocalNailLighting(x, y, width, height, nailWidth, nailHeight) {
  if (currentMode !== "camera" || !cameraFeed.videoWidth || !cameraFeed.videoHeight) {
    return { ...lightingProbe, skin: { r: 224, g: 174, b: 154 } };
  }

  const sampleSize = 18;
  const mirrored = window.nailCameraMirrored !== false;
  const rawX = mirrored ? width - x : x;
  const sourceX = Math.max(0, Math.min(width - 1, rawX - nailWidth * 0.38));
  const sourceY = Math.max(0, Math.min(height - 1, y + nailHeight * 0.18));
  const box = Math.max(10, Math.min(44, nailWidth * 0.82));
  localLightCanvas.width = sampleSize;
  localLightCanvas.height = sampleSize;
  localLightCtx.clearRect(0, 0, sampleSize, sampleSize);
  localLightCtx.drawImage(
    cameraFeed,
    Math.max(0, sourceX - box / 2),
    Math.max(0, sourceY - box / 2),
    Math.min(width, box),
    Math.min(height, box),
    0,
    0,
    sampleSize,
    sampleSize,
  );

  const { data } = localLightCtx.getImageData(0, 0, sampleSize, sampleSize);
  let light = 0;
  let warmth = 0;
  let contrast = 0;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let prev = null;
  let count = 0;

  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
    light += l;
    warmth += (r - b + 255) / 510;
    rSum += r;
    gSum += g;
    bSum += b;
    if (prev !== null) contrast += Math.abs(l - prev);
    prev = l;
    count += 1;
  }

  return {
    brightness: count ? light / count : lightingProbe.brightness,
    warmth: count ? warmth / count : lightingProbe.warmth,
    contrast: count > 1 ? Math.min(1, (contrast / (count - 1)) * 7) : lightingProbe.contrast,
    skin: {
      r: count ? Math.round(rSum / count) : 224,
      g: count ? Math.round(gSum / count) : 174,
      b: count ? Math.round(bSum / count) : 154,
    },
  };
}

function smooth(current, target, amount) {
  return current + (target - current) * amount;
}

function smoothAngle(current, target, amount) {
  let delta = target - current;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return current + delta * amount;
}

function drawLiveNails() {
  if (currentMode !== "camera" || !cameraFeed.videoWidth || !cameraFeed.videoHeight) {
    return;
  }

  liveCanvas.width = cameraFeed.videoWidth;
  liveCanvas.height = cameraFeed.videoHeight;
  const ctx = liveCanvas.getContext("2d");
  ctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);

  nails.forEach((nail, index) => {
    drawRealisticLiveNail(ctx, nail, liveCanvas.width, liveCanvas.height, index);
  });
}

function drawRealisticLiveNail(ctx, nail, width, height, index = 0) {
  const x = (nail.x / 100) * width;
  const y = (nail.y / 100) * height;
  const nailWidth =
    (nail.widthPct ? (nail.widthPct / 100) * width : 54 * (width / nailLayer.clientWidth)) *
    nail.scale *
    (nail.widthScale ?? 1);
  const nailHeight =
    (nail.heightPct ? (nail.heightPct / 100) * height : 94 * (height / nailLayer.clientHeight)) *
    nail.scale *
    (nail.heightScale ?? 1) *
    Number(lengthInput.value);
  const thickness = Number(thicknessInput.value) * (proModeInput.checked ? 0.82 : 1);
  const length = Number(lengthInput.value);
  const rootLockOffset = Math.max(0, nailHeight * (1 - 1 / Math.max(1, length)) * 0.52);
  const localLight = sampleLocalNailLighting(x, y, width, height, nailWidth, nailHeight);
  const proSoftness = proModeInput.checked ? 0.72 : 1;
  const sceneLight = currentMode === "camera" ? localLight.brightness : 0.62;
  const sceneContrast = currentMode === "camera" ? Math.max(lightingProbe.contrast * 0.7, localLight.contrast) : 0.18;
  const sceneWarmth = currentMode === "camera" ? localLight.warmth : 0.5;
  const skin = localLight.skin ?? { r: 224, g: 174, b: 154 };
  const rootBlend = Number(rootBlendInput?.value ?? 0.72);
  const glossStrength = Number(glossStrengthInput?.value ?? 0.92);
  const renderShadow = Number(shadowStrengthInput?.value ?? 0.88);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((nail.rotation * Math.PI) / 180);
  ctx.translate(0, -rootLockOffset);

  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = (realismBoostInput.checked ? 0.22 : 0.15) * (0.55 + rootBlend * 0.72);
  const contact = ctx.createRadialGradient(0, -nailHeight * 0.46, nailWidth * 0.08, 0, -nailHeight * 0.36, nailWidth * 0.62);
  contact.addColorStop(0, `rgba(${Math.max(0, skin.r - 78)}, ${Math.max(0, skin.g - 58)}, ${Math.max(0, skin.b - 50)}, 0.34)`);
  contact.addColorStop(0.58, `rgba(${Math.max(0, skin.r - 72)}, ${Math.max(0, skin.g - 54)}, ${Math.max(0, skin.b - 48)}, 0.12)`);
  contact.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = contact;
  ctx.beginPath();
  ctx.ellipse(0, -nailHeight * 0.36, nailWidth * 0.58, nailHeight * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();

  const shadowStrength = (0.1 + thickness * 0.14) * proSoftness * (1.18 - sceneLight * 0.42) * renderShadow;
  ctx.shadowColor = `rgba(35, 14, 22, ${shadowStrength})`;
  ctx.shadowBlur = nailWidth * (0.055 + thickness * 0.075 + sceneContrast * 0.025) * proSoftness;
  ctx.shadowOffsetY = nailHeight * (0.016 + thickness * 0.035) * proSoftness;

  const body = ctx.createLinearGradient(0, -nailHeight / 2, 0, nailHeight / 2);
  body.addColorStop(0, tint(colorInput.value, 0.28));
  body.addColorStop(0.52, colorInput.value);
  body.addColorStop(1, shade(colorInput.value, 0.1));
  ctx.fillStyle = body;

  ctx.beginPath();
  buildNailPath(ctx, nailWidth, nailHeight);
  ctx.globalAlpha =
    materialInput.value === "sheer" ? 0.64 : materialInput.value === "jelly" ? 0.78 : 0.88 + thickness * 0.08;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.clip();

  const hasReferenceTexture = activeReferenceTextureImages.length > 0;
  const sideShade = ctx.createLinearGradient(-nailWidth * 0.5, 0, nailWidth * 0.5, 0);
  sideShade.addColorStop(0, "rgba(35,10,20,0.2)");
  sideShade.addColorStop(0.22, "rgba(255,255,255,0)");
  sideShade.addColorStop(0.78, "rgba(255,255,255,0)");
  sideShade.addColorStop(1, "rgba(255,255,255,0.2)");
  ctx.fillStyle = sideShade;
  ctx.fillRect(-nailWidth * 0.55, -nailHeight * 0.55, nailWidth * 1.1, nailHeight * 1.1);

  const dome = ctx.createRadialGradient(
    0,
    -nailHeight * 0.1,
    nailWidth * 0.08,
    0,
    -nailHeight * 0.02,
    nailHeight * 0.62,
  );
  dome.addColorStop(0, hasReferenceTexture ? "rgba(255,255,255,0.04)" : proModeInput.checked ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.18)");
  dome.addColorStop(0.42, "rgba(255,255,255,0.05)");
  dome.addColorStop(0.78, "rgba(38,12,22,0.12)");
  dome.addColorStop(1, "rgba(38,12,22,0.22)");
  ctx.fillStyle = dome;
  ctx.fillRect(-nailWidth * 0.55, -nailHeight * 0.55, nailWidth * 1.1, nailHeight * 1.1);

  drawLiveNailMicroTexture(ctx, nailWidth, nailHeight, index, sceneLight);

  if (hasReferenceTexture) {
    drawReferenceTexture(ctx, nailWidth, nailHeight, index, proModeInput.checked ? 0.96 : 1);
    drawReferenceRealismLayers(ctx, nailWidth, nailHeight, thickness, sceneLight);
  }

  if (!hasReferenceTexture || Number(photoFidelityInput.value) < 0.75) {
    drawTipColor(ctx, nailWidth, nailHeight);
    drawMotifPattern(ctx, nailWidth, nailHeight);
  }

  const rootFade = ctx.createLinearGradient(0, -nailHeight * 0.5, 0, -nailHeight * 0.18);
  rootFade.addColorStop(0, hasReferenceTexture ? `rgba(255,245,240,${0.04 + rootBlend * 0.14})` : `rgba(255,245,240,${0.18 + rootBlend * 0.3})`);
  rootFade.addColorStop(1, "rgba(255,245,240,0)");
  ctx.fillStyle = rootFade;
  ctx.fillRect(-nailWidth * 0.5, -nailHeight * 0.5, nailWidth, nailHeight * 0.34);

  const skinBlend = ctx.createLinearGradient(0, -nailHeight * 0.5, 0, -nailHeight * 0.26);
  skinBlend.addColorStop(0, `rgba(${skin.r}, ${skin.g}, ${skin.b}, ${(hasReferenceTexture ? 0.08 : 0.12) + rootBlend * 0.1})`);
  skinBlend.addColorStop(0.58, `rgba(${skin.r}, ${skin.g}, ${skin.b}, ${(hasReferenceTexture ? 0.02 : 0.04) + rootBlend * 0.05})`);
  skinBlend.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = skinBlend;
  ctx.fillRect(-nailWidth * 0.48, -nailHeight * 0.52, nailWidth * 0.96, nailHeight * 0.3);
  ctx.globalCompositeOperation = "source-over";

  ctx.fillStyle = "rgba(255,250,246,0.34)";
  ctx.beginPath();
  ctx.ellipse(0, -nailHeight * 0.41, nailWidth * 0.24, nailHeight * 0.075, 0, 0, Math.PI * 2);
  ctx.fill();

  const edgeShade = ctx.createLinearGradient(0, nailHeight * 0.32, 0, nailHeight * 0.5);
  edgeShade.addColorStop(0, "rgba(255,255,255,0.02)");
  edgeShade.addColorStop(1, `rgba(42,14,24,${0.08 + thickness * 0.18})`);
  ctx.fillStyle = edgeShade;
  ctx.fillRect(-nailWidth * 0.46, nailHeight * 0.32, nailWidth * 0.92, nailHeight * 0.18);

  const fineGloss = ctx.createLinearGradient(
    -nailWidth * 0.42,
    -nailHeight * 0.44,
    nailWidth * 0.35,
    nailHeight * 0.42,
  );
  fineGloss.addColorStop(0, "rgba(255,255,255,0)");
  fineGloss.addColorStop(0.36, `rgba(255,${Math.round(248 - sceneWarmth * 10)},${Math.round(242 - sceneWarmth * 18)},0.12)`);
  fineGloss.addColorStop(0.43, hasReferenceTexture ? `rgba(255,255,255,${Math.min(0.92, (0.16 + sceneLight * 0.1) * glossStrength)})` : proModeInput.checked ? `rgba(255,255,255,${Math.min(0.92, (0.28 + sceneLight * 0.18) * glossStrength)})` : `rgba(255,255,255,${Math.min(0.96, (0.42 + sceneLight * 0.18) * glossStrength)})`);
  fineGloss.addColorStop(0.5, "rgba(255,255,255,0.1)");
  fineGloss.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = fineGloss;
  ctx.fillRect(-nailWidth * 0.55, -nailHeight * 0.55, nailWidth * 1.1, nailHeight * 1.1);

  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((nail.rotation * Math.PI) / 180);
  ctx.translate(0, -rootLockOffset);
  ctx.beginPath();
  buildNailPath(ctx, nailWidth, nailHeight);

  if (nailTypeInput.value !== "natural" && thickness > 0.25) {
    ctx.strokeStyle = `rgba(255,255,255,${0.16 + thickness * 0.22})`;
    ctx.lineWidth = Math.max(1, nailWidth * 0.045);
    ctx.stroke();

    ctx.strokeStyle = `rgba(60,22,35,${0.08 + thickness * 0.12})`;
    ctx.lineWidth = Math.max(1, nailWidth * 0.035);
    ctx.beginPath();
    ctx.moveTo(-nailWidth * 0.4, nailHeight * 0.42);
    ctx.bezierCurveTo(-nailWidth * 0.46, nailHeight * 0.1, -nailWidth * 0.34, -nailHeight * 0.38, 0, -nailHeight * 0.48);
    ctx.stroke();
  }

  ctx.shadowColor = "transparent";
  const gloss = ctx.createLinearGradient(
    -nailWidth * 0.25,
    -nailHeight * 0.45,
    nailWidth * 0.14,
    nailHeight * 0.26,
  );
  gloss.addColorStop(0, proModeInput.checked ? `rgba(255,255,255,${Math.min(0.96, 0.58 * glossStrength)})` : `rgba(255,255,255,${Math.min(0.98, 0.82 * glossStrength)})`);
  gloss.addColorStop(0.26, proModeInput.checked ? `rgba(255,255,255,${Math.min(0.58, 0.22 * glossStrength)})` : `rgba(255,255,255,${Math.min(0.72, 0.32 * glossStrength)})`);
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(
    -nailWidth * 0.14,
    -nailHeight * 0.1,
    nailWidth * 0.13,
    nailHeight * 0.36,
    0.18,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  const rimLight = ctx.createLinearGradient(-nailWidth * 0.5, 0, nailWidth * 0.5, 0);
  rimLight.addColorStop(0, "rgba(20,8,16,0.18)");
  rimLight.addColorStop(0.18, "rgba(255,255,255,0)");
  rimLight.addColorStop(0.86, "rgba(255,255,255,0)");
  rimLight.addColorStop(1, "rgba(255,255,255,0.22)");
  ctx.fillStyle = rimLight;
  ctx.globalCompositeOperation = "soft-light";
  ctx.beginPath();
  buildNailPath(ctx, nailWidth, nailHeight);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.restore();
}

function drawLiveNailMicroTexture(ctx, nailWidth, nailHeight, index, sceneLight) {
  if (!realismBoostInput.checked) return;
  const density = Math.max(8, Math.round(nailWidth * nailHeight * 0.0018));
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.08 + sceneLight * 0.035;
  for (let i = 0; i < density; i += 1) {
    const seed = (index + 1) * 9187 + i * 52711;
    const rx = ((((seed * 37) % 1000) / 1000) - 0.5) * nailWidth * 0.86;
    const ry = ((((seed * 73) % 1000) / 1000) - 0.5) * nailHeight * 0.88;
    const bright = (seed % 2) === 0;
    ctx.fillStyle = bright ? "rgba(255,255,255,0.7)" : "rgba(30,10,18,0.45)";
    ctx.beginPath();
    ctx.arc(rx, ry, Math.max(0.35, nailWidth * 0.006), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function buildNailPath(ctx, nailWidth, nailHeight) {
  ctx.moveTo(-nailWidth * 0.42, nailHeight * 0.43);
  ctx.bezierCurveTo(
    -nailWidth * 0.5,
    nailHeight * 0.08,
    -nailWidth * 0.37,
    -nailHeight * 0.42,
    0,
    -nailHeight * 0.5,
  );
  ctx.bezierCurveTo(
    nailWidth * 0.37,
    -nailHeight * 0.42,
    nailWidth * 0.5,
    nailHeight * 0.08,
    nailWidth * 0.42,
    nailHeight * 0.44,
  );
  ctx.bezierCurveTo(
    nailWidth * 0.22,
    nailHeight * 0.51,
    -nailWidth * 0.22,
    nailHeight * 0.51,
    -nailWidth * 0.42,
    nailHeight * 0.44,
  );
  ctx.closePath();
}

function drawTipColor(ctx, nailWidth, nailHeight) {
  const motif = motifInput.value;
  const usesTip =
    motif === "tip_gradient" ||
    motif === "tip_glitter" ||
    motif === "tip_pattern" ||
    designInput.value === "french";
  if (!usesTip) return;

  const amount = Number(tipAmountInput.value);
  const yTop = -nailHeight * 0.5;
  const yEnd = -nailHeight * (0.5 - amount * 0.86);
  const tipColor = tipColorInput.value || motifColorInput.value;

  ctx.save();
  ctx.globalCompositeOperation = proModeInput.checked ? "screen" : "source-over";
  ctx.globalAlpha = proModeInput.checked ? 0.72 : 0.88;
  const tipGradient = ctx.createLinearGradient(0, yTop, 0, yEnd);
  tipGradient.addColorStop(0, withAlpha(tipColor, 0.9));
  tipGradient.addColorStop(0.48, withAlpha(tipColor, 0.46));
  tipGradient.addColorStop(1, withAlpha(tipColor, 0));
  ctx.fillStyle = tipGradient;
  ctx.fillRect(-nailWidth * 0.5, yTop, nailWidth, Math.max(1, yEnd - yTop + nailHeight * 0.08));

  const softEdge = ctx.createRadialGradient(0, yTop, nailWidth * 0.04, 0, yTop + nailHeight * 0.1, nailWidth * 0.62);
  softEdge.addColorStop(0, "rgba(255,255,255,0.42)");
  softEdge.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = softEdge;
  ctx.fillRect(-nailWidth * 0.52, yTop, nailWidth * 1.04, nailHeight * 0.28);

  if (motif === "tip_glitter") {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = proModeInput.checked ? 0.74 : 0.95;
    const sparkleCount = Math.round(10 + amount * 34 * Number(motifDensityInput.value));
    for (let i = 0; i < sparkleCount; i += 1) {
      const seed = (i * 9301 + 49297) % 233280;
      const rx = ((seed / 233280) - 0.5) * nailWidth * 0.78;
      const ry = yTop + (((seed * 37) % 233280) / 233280) * Math.max(2, yEnd - yTop);
      const r = Math.max(0.8, nailWidth * (0.018 + (((seed * 13) % 100) / 100) * 0.018));
      ctx.fillStyle = i % 3 === 0 ? "rgba(255,244,198,0.95)" : "rgba(255,255,255,0.88)";
      ctx.beginPath();
      ctx.arc(rx, ry, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawReferenceTexture(ctx, nailWidth, nailHeight, index, alpha = 0.58) {
  const fidelity = Number(photoFidelityInput.value);
  const image =
    fidelity > 0.94
      ? activeReferenceTextureImages[0]
      : activeReferenceTextureImages[index % activeReferenceTextureImages.length];
  if (!image || !image.complete || !image.naturalWidth) return;

  const light = currentMode === "camera" ? lightingProbe.brightness : 0.62;
  const contrast = currentMode === "camera" ? lightingProbe.contrast : 0.18;
  const clarity = Number(textureClarityInput?.value ?? 1.04);
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha * (0.9 + fidelity * 0.16) + light * 0.02);
  ctx.globalCompositeOperation = fidelity > 0.9 ? "source-over" : "source-atop";
  ctx.filter = proModeInput.checked
    ? `saturate(${0.96 + fidelity * 0.22 + contrast * 0.1 + clarity * 0.08}) contrast(${0.98 + fidelity * 0.14 + contrast * 0.1 + clarity * 0.08}) brightness(${0.96 + light * 0.1})`
    : `saturate(${1.02 + fidelity * 0.24 + contrast * 0.14 + clarity * 0.1}) contrast(${1.02 + fidelity * 0.16 + contrast * 0.12 + clarity * 0.1}) brightness(${0.94 + light * 0.14})`;
  ctx.drawImage(image, -nailWidth * 0.5, -nailHeight * 0.5, nailWidth, nailHeight);
  ctx.filter = "none";

  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = fidelity > 0.92 ? 0.04 : 0.1 + (1 - fidelity) * 0.18;
  const contour = ctx.createLinearGradient(-nailWidth * 0.5, 0, nailWidth * 0.5, 0);
  contour.addColorStop(0, "rgba(0,0,0,0.3)");
  contour.addColorStop(0.22, "rgba(255,255,255,0.04)");
  contour.addColorStop(0.78, "rgba(255,255,255,0.02)");
  contour.addColorStop(1, "rgba(255,255,255,0.28)");
  ctx.fillStyle = contour;
  ctx.fillRect(-nailWidth * 0.5, -nailHeight * 0.5, nailWidth, nailHeight);

  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = fidelity > 0.92 ? 0.08 : 0.12 + (1 - fidelity) * 0.26;
  const glaze = ctx.createLinearGradient(0, -nailHeight * 0.5, 0, nailHeight * 0.5);
  glaze.addColorStop(0, "rgba(255,255,255,0.36)");
  glaze.addColorStop(0.5, "rgba(255,255,255,0.04)");
  glaze.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glaze;
  ctx.fillRect(-nailWidth * 0.5, -nailHeight * 0.5, nailWidth, nailHeight);
  ctx.restore();
}

function drawMotifPattern(ctx, nailWidth, nailHeight) {
  const motif = motifInput.value;
  if (motif === "none") return;

  const density = Number(motifDensityInput.value);
  const spacing = Math.max(8, 24 / density);
  const color = motifColorInput.value;
  ctx.save();
  const motifAlpha = motif === "stripes" || motif === "checker" ? 0.56 : 0.82;
  ctx.globalAlpha = proModeInput.checked ? motifAlpha * 0.62 : motifAlpha;
  ctx.transform(1, 0.025, -0.08, 1, 0, 0);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, nailWidth * 0.035);

  if (motif === "stripes") {
    for (let x = -nailWidth; x < nailWidth * 1.2; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, -nailHeight * 0.48);
      ctx.lineTo(x + nailHeight * 0.8, nailHeight * 0.48);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (motif === "tip_glitter" || motif === "tip_pattern") {
    const tipTop = -nailHeight * 0.48;
    const tipBottom = -nailHeight * (0.48 - Number(tipAmountInput.value) * 0.72);
    const tipSpacing = motif === "tip_glitter" ? spacing * 0.72 : spacing;
    for (let y = tipTop; y <= tipBottom; y += tipSpacing) {
      for (let x = -nailWidth * 0.32; x <= nailWidth * 0.32; x += tipSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.4, tipSpacing * 0.13), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }

  if (motif === "vertical_gradient" || motif === "tip_gradient" || motif === "base_gradient") {
    const gradient =
      motif === "vertical_gradient"
        ? ctx.createLinearGradient(-nailWidth * 0.42, 0, nailWidth * 0.42, 0)
        : ctx.createLinearGradient(0, -nailHeight * 0.5, 0, nailHeight * 0.5);
    if (motif === "vertical_gradient") {
      gradient.addColorStop(0, withAlpha(color, 0.55));
      gradient.addColorStop(0.5, withAlpha(color, 0.08));
      gradient.addColorStop(1, withAlpha(color, 0.28));
    } else if (motif === "tip_gradient") {
      gradient.addColorStop(0, withAlpha(color, 0.68));
      gradient.addColorStop(0.28, withAlpha(color, 0.18));
      gradient.addColorStop(0.62, withAlpha(color, 0));
    } else {
      gradient.addColorStop(0, withAlpha(color, 0.55));
      gradient.addColorStop(0.34, withAlpha(color, 0.18));
      gradient.addColorStop(0.72, withAlpha(color, 0));
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(-nailWidth * 0.5, -nailHeight * 0.5, nailWidth, nailHeight);
    ctx.restore();
    return;
  }

  if (motif === "checker") {
    const size = spacing * 0.58;
    for (let y = -nailHeight * 0.42, row = 0; y < nailHeight * 0.42; y += size) {
      for (let x = -nailWidth * 0.38, col = 0; x < nailWidth * 0.38; x += size) {
        if ((row + col) % 2 === 0) ctx.fillRect(x, y, size, size);
        col += 1;
      }
      row += 1;
    }
    ctx.restore();
    return;
  }

  for (let y = -nailHeight * 0.34; y <= nailHeight * 0.34; y += spacing) {
    for (let x = -nailWidth * 0.28; x <= nailWidth * 0.28; x += spacing) {
      if (motif === "dots") {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.6, spacing * 0.14), 0, Math.PI * 2);
        ctx.fill();
      } else if (motif === "flowers") {
        drawFlower(ctx, x, y, Math.max(2.4, spacing * 0.18), color);
      } else if (motif === "hearts") {
        drawHeart(ctx, x, y, Math.max(3, spacing * 0.22), color);
      } else if (motif === "stars") {
        drawStar(ctx, x, y, Math.max(3, spacing * 0.24), color);
      }
    }
  }
  ctx.restore();
}

function withAlpha(hex, alpha) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function drawFlower(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, radius * 0.72, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ffe76b";
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.48, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeart(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.7);
  ctx.bezierCurveTo(x - size * 1.2, y, x - size * 0.8, y - size * 0.9, x, y - size * 0.35);
  ctx.bezierCurveTo(x + size * 0.8, y - size * 0.9, x + size * 1.2, y, x, y + size * 0.7);
  ctx.fill();
}

function drawStar(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? size : size * 0.42;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

syncControls();
renderNails();
loadDesignPresets();
