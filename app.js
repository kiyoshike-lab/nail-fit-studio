const styles = [
  { id: "pearl", name: "Pearl Drop" },
  { id: "hoop", name: "Soft Hoop" },
  { id: "stud", name: "Gem Stud" },
  { id: "chain", name: "Chain" },
  { id: "star", name: "Star" },
  { id: "bar", name: "Line Bar" },
  { id: "captive", name: "Captive Ring" },
  { id: "curved", name: "Curved Barbell" },
  { id: "spike", name: "Spike Stud" },
  { id: "tongue", name: "Tongue Barbell" },
  { id: "surface", name: "Surface Bar" },
  { id: "dermal", name: "Dermal Gem" },
  { id: "septum", name: "Septum Clicker" },
  { id: "horseshoe", name: "Horseshoe Ring" },
  { id: "labret", name: "Labret Stud" },
  { id: "industrial", name: "Industrial Bar" },
  { id: "plug", name: "Plug Tunnel" },
  { id: "banana", name: "Banana Barbell" },
  { id: "micro", name: "Micro Dermal" },
  { id: "cluster", name: "Gem Cluster" },
];

const placements = [
  { id: "ears", name: "耳", label: "Earrings", x: 50, y: 45, size: 92 },
  { id: "lobe", name: "耳たぶ", label: "Lobe", x: 31, y: 48, size: 70 },
  { id: "upperLobe", name: "上耳たぶ", label: "Upper Lobe", x: 33, y: 43, size: 58 },
  { id: "helix", name: "ヘリックス", label: "Helix", x: 29, y: 34, size: 58 },
  { id: "forwardHelix", name: "前ヘリ", label: "Forward Helix", x: 39, y: 32, size: 52 },
  { id: "tragus", name: "トラガス", label: "Tragus", x: 39, y: 43, size: 52 },
  { id: "conch", name: "コンク", label: "Conch", x: 34, y: 42, size: 66 },
  { id: "rook", name: "ルーク", label: "Rook", x: 36, y: 35, size: 54 },
  { id: "daith", name: "ダイス", label: "Daith", x: 37, y: 39, size: 58 },
  { id: "snug", name: "スナッグ", label: "Snug", x: 34, y: 39, size: 58 },
  { id: "industrialPlace", name: "インダス", label: "Industrial", x: 34, y: 34, size: 98 },
  { id: "orbital", name: "オービタル", label: "Orbital", x: 34, y: 46, size: 72 },
  { id: "nose", name: "鼻", label: "Nose", x: 56, y: 42, size: 58 },
  { id: "septumPlace", name: "セプタム", label: "Septum", x: 50, y: 45, size: 62 },
  { id: "bridge", name: "ブリッジ", label: "Bridge", x: 50, y: 34, size: 74 },
  { id: "brow", name: "眉", label: "Eyebrow", x: 61, y: 30, size: 64 },
  { id: "antiBrow", name: "アンチ眉", label: "Anti Eyebrow", x: 62, y: 45, size: 60 },
  { id: "lip", name: "リップ", label: "Lip", x: 55, y: 56, size: 60 },
  { id: "monroe", name: "モンロー", label: "Monroe", x: 58, y: 52, size: 48 },
  { id: "medusa", name: "メデューサ", label: "Medusa", x: 50, y: 52, size: 50 },
  { id: "verticalLabret", name: "縦ラブレット", label: "Vertical Labret", x: 50, y: 58, size: 58 },
  { id: "smiley", name: "スマイリー", label: "Smiley", x: 50, y: 54, size: 54 },
  { id: "tonguePlace", name: "舌", label: "Tongue", x: 50, y: 62, size: 70 },
  { id: "collarbone", name: "鎖骨", label: "Collarbone", x: 42, y: 68, size: 72 },
  { id: "sternum", name: "胸骨", label: "Sternum", x: 50, y: 76, size: 76 },
  { id: "navel", name: "へそ", label: "Navel", x: 50, y: 76, size: 82 },
  { id: "pelvis", name: "骨盤", label: "Pelvis", x: 54, y: 84, size: 78 },
  { id: "cheek", name: "頬", label: "Cheek", x: 63, y: 48, size: 56 },
  { id: "chest", name: "胸元", label: "Chest", x: 50, y: 71, size: 74 },
  { id: "surfaceHip", name: "ヒップ", label: "Hip Surface", x: 38, y: 84, size: 76 },
  { id: "wrist", name: "手首", label: "Wrist", x: 62, y: 83, size: 62 },
  { id: "finger", name: "指", label: "Finger", x: 67, y: 84, size: 48 },
];

const colors = [
  { name: "Gold", value: "#d6a94a" },
  { name: "Rose", value: "#c97d70" },
  { name: "Silver", value: "#c9ced4" },
  { name: "Emerald", value: "#167467" },
  { name: "Onyx", value: "#242424" },
];

const looks = [
  { title: "耳たぶ 定番", placement: "lobe", style: "pearl", color: "#d6a94a", size: 68, x: 30, y: 57 },
  { title: "軟骨リング", placement: "helix", style: "hoop", color: "#c9ced4", size: 58, x: 23, y: 34 },
  { title: "トラガス", placement: "tragus", style: "stud", color: "#167467", size: 50, x: 36, y: 46 },
  { title: "セプタム", placement: "septumPlace", style: "septum", color: "#c9ced4", size: 62, x: 50, y: 50 },
  { title: "リップ", placement: "verticalLabret", style: "labret", color: "#242424", size: 58, x: 50, y: 69 },
  { title: "鎖骨", placement: "collarbone", style: "dermal", color: "#c97d70", size: 64, x: 36, y: 82 },
  { title: "へそ", placement: "navel", style: "banana", color: "#d6a94a", size: 78, x: 50, y: 83 },
  { title: "インダス", placement: "industrialPlace", style: "industrial", color: "#c9ced4", size: 92, x: 28, y: 33 },
];

const defaultState = {
  style: "pearl",
  placement: "ears",
  color: colors[0].value,
  size: 92,
  leftX: 31,
  rightX: 69,
  leftY: 45,
  rightY: 45,
  bodyX: 56,
  bodyY: 42,
  activeEar: "both",
  photo: "",
};

const state = { ...defaultState };
let favorites = JSON.parse(localStorage.getItem("earlineFavorites") || "[]");

const stage = document.querySelector("#stage");
const cameraVideo = document.querySelector("#cameraVideo");
const facePhoto = document.querySelector("#facePhoto");
const dropHint = document.querySelector("#dropHint");
const leftEar = document.querySelector("#leftEar");
const rightEar = document.querySelector("#rightEar");
const bodyPiercing = document.querySelector("#bodyPiercing");
const leftEarring = document.querySelector("#leftEarring");
const rightEarring = document.querySelector("#rightEarring");
const bodyEarring = document.querySelector("#bodyEarring");
const placementGrid = document.querySelector("#placementGrid");
const styleGrid = document.querySelector("#styleGrid");
const lookbook = document.querySelector("#lookbook");
const swatches = document.querySelector("#swatches");
const fitMode = document.querySelector("#fitMode");
const favoritesList = document.querySelector("#favorites");
const sizeControl = document.querySelector("#sizeControl");
const spreadControl = document.querySelector("#spreadControl");
const heightControl = document.querySelector("#heightControl");
const cameraButton = document.querySelector("#cameraButton");
const trackingButton = document.querySelector("#trackingButton");
let cameraStream = null;
let lightSampleFrame = 0;
let trackingEnabled = false;
let trackingDetector = null;
let trackingBusy = false;
let trackingFrame = 0;
const lightCanvas = document.createElement("canvas");
const lightCtx = lightCanvas.getContext("2d", { willReadFrequently: true });

function earringSvg(type, color) {
  const shine = "#fff8df";
  const dark = "rgba(0,0,0,.22)";
  const id = `${type}-${color.replace(/[^a-z0-9]/gi, "")}`;
  const metal = `url(#metal-${id})`;
  const gemFill = `url(#gem-${id})`;
  const common = `stroke="${metal}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const fine = `stroke="rgba(255,255,255,.72)" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".72"`;
  const gem = `fill="${gemFill}" stroke="rgba(0,0,0,.34)" stroke-width="1.5"`;
  const defs = `
    <defs>
      <linearGradient id="metal-${id}" x1="18" y1="8" x2="82" y2="110" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#fff6cf"/>
        <stop offset=".16" stop-color="${color}"/>
        <stop offset=".34" stop-color="#7b5b24"/>
        <stop offset=".52" stop-color="#ffe9a6"/>
        <stop offset=".72" stop-color="${color}"/>
        <stop offset="1" stop-color="#5f4520"/>
      </linearGradient>
      <radialGradient id="gem-${id}" cx="34%" cy="25%" r="72%">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset=".2" stop-color="#fff2be"/>
        <stop offset=".55" stop-color="${color}"/>
        <stop offset="1" stop-color="#45311c"/>
      </radialGradient>
      <radialGradient id="pearl-${id}" cx="34%" cy="24%" r="70%">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset=".42" stop-color="#fff8df"/>
        <stop offset=".78" stop-color="#d7c7a3"/>
        <stop offset="1" stop-color="#9f8d72"/>
      </radialGradient>
      <filter id="soft-shadow-${id}" x="-35%" y="-25%" width="170%" height="160%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#1b120c" flood-opacity=".28"/>
      </filter>
    </defs>
  `;
  const paths = {
    pearl: `<g filter="url(#soft-shadow-${id})"><circle cx="50" cy="14" r="8" ${gem}/><path d="M50 22 C50 37 50 50 50 64" ${common}/><path d="M53 24 C53 38 53 50 53 62" ${fine}/><circle cx="50" cy="83" r="18" fill="url(#pearl-${id})" stroke="${metal}" stroke-width="5"/><circle cx="43" cy="75" r="5" fill="#fff" opacity=".82"/></g>`,
    hoop: `<g filter="url(#soft-shadow-${id})"><circle cx="50" cy="46" r="31" ${common}/><path d="M31 66 C42 78 60 78 70 66" ${fine}/><circle cx="50" cy="14" r="7" ${gem}/><circle cx="47" cy="11" r="2.5" fill="#fff" opacity=".82"/></g>`,
    stud: `<g filter="url(#soft-shadow-${id})"><circle cx="50" cy="34" r="23" fill="${metal}" stroke="rgba(0,0,0,.25)" stroke-width="2"/><circle cx="50" cy="34" r="15" ${gem}/><path d="M37 29 C43 20 57 20 64 29" ${fine}/><circle cx="42" cy="26" r="5" fill="#fff" opacity=".86"/></g>`,
    chain: `<g filter="url(#soft-shadow-${id})"><circle cx="50" cy="12" r="7" ${gem}/><path d="M50 22 L50 42 M50 48 L50 68 M50 74 L50 94" ${common}/><path d="M53 25 L53 40 M53 51 L53 65 M53 77 L53 91" ${fine}/><circle cx="50" cy="106" r="8" ${gem}/><circle cx="47" cy="103" r="2.3" fill="#fff" opacity=".8"/></g>`,
    star: `<g filter="url(#soft-shadow-${id})"><circle cx="50" cy="14" r="6" ${gem}/><path d="M50 31 L58 49 L78 51 L62 64 L67 84 L50 73 L33 84 L38 64 L22 51 L42 49 Z" fill="${metal}" stroke="rgba(0,0,0,.32)" stroke-width="2"/><path d="M43 51 L50 34 L57 52" ${fine}/><circle cx="43" cy="51" r="4" fill="${shine}" opacity=".82"/></g>`,
    bar: `<g filter="url(#soft-shadow-${id})"><circle cx="50" cy="13" r="7" ${gem}/><path d="M50 25 L50 100" ${common}/><path d="M54 28 L54 96" ${fine}/><path d="M37 44 L63 44 M35 66 L65 66 M39 88 L61 88" stroke="rgba(255,255,255,.64)" stroke-width="3" stroke-linecap="round"/></g>`,
    captive: `<g filter="url(#soft-shadow-${id})"><circle cx="50" cy="56" r="28" ${common}/><path d="M31 74 C43 87 60 87 70 74" ${fine}/><circle cx="50" cy="86" r="8" fill="url(#pearl-${id})" stroke="${metal}" stroke-width="5"/><circle cx="46" cy="82" r="2.8" fill="#fff" opacity=".86"/></g>`,
    curved: `<g filter="url(#soft-shadow-${id})"><path d="M28 34 C42 78 58 78 72 34" ${common}/><path d="M35 45 C45 68 56 68 65 45" ${fine}/><circle cx="27" cy="32" r="9" ${gem}/><circle cx="73" cy="32" r="9" ${gem}/><circle cx="24" cy="29" r="2.6" fill="#fff" opacity=".78"/><circle cx="70" cy="29" r="2.6" fill="#fff" opacity=".78"/></g>`,
    spike: `<g filter="url(#soft-shadow-${id})"><circle cx="50" cy="30" r="16" ${gem}/><path d="M50 44 L70 86 L30 86 Z" fill="${metal}" stroke="rgba(0,0,0,.34)" stroke-width="2"/><path d="M50 50 L58 82" ${fine}/><circle cx="43" cy="23" r="5" fill="#fff" opacity=".78"/></g>`,
    tongue: `<g filter="url(#soft-shadow-${id})"><path d="M25 60 C38 52 62 52 75 60" ${common}/><path d="M32 59 C43 55 57 55 68 59" ${fine}/><circle cx="24" cy="60" r="11" ${gem}/><circle cx="76" cy="60" r="11" ${gem}/><circle cx="20" cy="56" r="3" fill="#fff" opacity=".82"/><circle cx="72" cy="56" r="3" fill="#fff" opacity=".82"/></g>`,
    surface: `<g filter="url(#soft-shadow-${id})"><path d="M25 62 L75 62" ${common}/><path d="M31 58 L69 58" ${fine}/><rect x="17" y="51" width="20" height="20" rx="5" fill="${metal}" stroke="rgba(0,0,0,.30)" stroke-width="2"/><rect x="63" y="51" width="20" height="20" rx="5" fill="${metal}" stroke="rgba(0,0,0,.30)" stroke-width="2"/><circle cx="27" cy="61" r="7" ${gem}/><circle cx="73" cy="61" r="7" ${gem}/></g>`,
    dermal: `<g filter="url(#soft-shadow-${id})"><circle cx="50" cy="60" r="25" fill="${metal}" stroke="rgba(0,0,0,.30)" stroke-width="2"/><circle cx="50" cy="60" r="15" ${gem}/><path d="M36 53 C43 42 58 42 65 53" ${fine}/><circle cx="43" cy="51" r="5" fill="#fff" opacity=".86"/></g>`,
    septum: `<g filter="url(#soft-shadow-${id})"><path d="M26 46 C30 85 70 85 74 46" ${common}/><path d="M34 61 C41 77 59 77 66 61" ${fine}/><circle cx="26" cy="46" r="7" ${gem}/><circle cx="74" cy="46" r="7" ${gem}/><path d="M36 44 L64 44" stroke="${metal}" stroke-width="4" stroke-linecap="round"/></g>`,
    horseshoe: `<g filter="url(#soft-shadow-${id})"><path d="M23 43 C25 89 75 89 77 43" ${common}/><path d="M33 63 C42 79 58 79 67 63" ${fine}/><circle cx="23" cy="43" r="9" ${gem}/><circle cx="77" cy="43" r="9" ${gem}/></g>`,
    labret: `<g filter="url(#soft-shadow-${id})"><circle cx="50" cy="52" r="19" ${gem}/><circle cx="50" cy="83" r="10" fill="${metal}" stroke="rgba(0,0,0,.3)" stroke-width="2"/><path d="M50 64 L50 75" ${common}/><circle cx="43" cy="45" r="5" fill="#fff" opacity=".84"/></g>`,
    industrial: `<g filter="url(#soft-shadow-${id})"><path d="M18 85 L82 28" ${common}/><path d="M27 76 L73 35" ${fine}/><circle cx="18" cy="85" r="9" ${gem}/><circle cx="82" cy="28" r="9" ${gem}/></g>`,
    plug: `<g filter="url(#soft-shadow-${id})"><circle cx="50" cy="60" r="28" fill="${metal}" stroke="rgba(0,0,0,.35)" stroke-width="3"/><circle cx="50" cy="60" r="16" fill="rgba(20,17,15,.78)" stroke="rgba(255,255,255,.45)" stroke-width="3"/><path d="M34 47 C43 37 61 39 68 50" ${fine}/></g>`,
    banana: `<g filter="url(#soft-shadow-${id})"><path d="M28 32 C38 86 62 86 72 32" ${common}/><path d="M36 43 C44 74 56 74 64 43" ${fine}/><circle cx="28" cy="32" r="10" ${gem}/><circle cx="72" cy="32" r="10" ${gem}/></g>`,
    micro: `<g filter="url(#soft-shadow-${id})"><circle cx="50" cy="60" r="18" fill="${metal}" stroke="rgba(0,0,0,.3)" stroke-width="2"/><path d="M39 60 L61 60 M50 49 L50 71" stroke="rgba(255,255,255,.5)" stroke-width="2"/><circle cx="50" cy="60" r="10" ${gem}/><circle cx="45" cy="55" r="3" fill="#fff" opacity=".85"/></g>`,
    cluster: `<g filter="url(#soft-shadow-${id})"><circle cx="50" cy="60" r="13" ${gem}/><circle cx="34" cy="60" r="10" ${gem}/><circle cx="66" cy="60" r="10" ${gem}/><circle cx="42" cy="45" r="9" ${gem}/><circle cx="58" cy="45" r="9" ${gem}/><path d="M38 50 C45 39 58 39 65 50" ${fine}/></g>`,
  };
  return `<svg viewBox="0 0 100 120" aria-hidden="true">${defs}${paths[type]}</svg>`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function currentSpread() {
  return Math.round((state.rightX - state.leftX) / 2);
}

function currentHeight() {
  return state.placement === "ears" ? Math.round((state.leftY + state.rightY) / 2) : Math.round(state.bodyY);
}

function syncControls() {
  sizeControl.value = state.size;
  spreadControl.value = clamp(currentSpread(), 8, 30);
  spreadControl.disabled = state.placement !== "ears";
  heightControl.value = clamp(currentHeight(), 18, 86);
}

function styleName(id) {
  return styles.find((item) => item.id === id)?.name || id;
}

function colorName(value) {
  return colors.find((item) => item.value === value)?.name || value;
}

function placementName(id) {
  return placements.find((item) => item.id === id)?.label || id;
}

function renderChoices() {
  placementGrid.innerHTML = placements.map((item) => `
    <button class="placement-option" type="button" data-placement="${item.id}" aria-pressed="${item.id === state.placement}">
      <span class="mini">${item.name}</span>
      <span>${item.label}</span>
    </button>
  `).join("");

  styleGrid.innerHTML = styles.map((item) => `
    <button class="style-option" type="button" data-style="${item.id}" aria-pressed="${item.id === state.style}">
      <span class="mini">${earringSvg(item.id, state.color)}</span>
      <span>${item.name}</span>
    </button>
  `).join("");

  swatches.innerHTML = colors.map((item) => `
    <button class="swatch" type="button" data-color="${item.value}" aria-label="${item.name}" aria-pressed="${item.value === state.color}" style="background:${item.value}"></button>
  `).join("");

  fitMode.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.ear === state.activeEar));
  });
  trackingButton.setAttribute("aria-pressed", String(trackingEnabled));
}

function renderTryon() {
  stage.classList.toggle("body-mode", state.placement !== "ears");
  leftEarring.innerHTML = earringSvg(state.style, state.color);
  rightEarring.innerHTML = earringSvg(state.style, state.color);
  bodyEarring.innerHTML = earringSvg(state.style, state.color);

  leftEar.style.width = `${state.size}px`;
  leftEar.style.height = `${state.size * 1.24}px`;
  rightEar.style.width = `${state.size}px`;
  rightEar.style.height = `${state.size * 1.24}px`;
  bodyPiercing.style.width = `${state.size}px`;
  bodyPiercing.style.height = `${state.size * 1.24}px`;

  leftEar.style.left = `${state.leftX}%`;
  rightEar.style.left = `${state.rightX}%`;
  bodyPiercing.style.left = `${state.bodyX}%`;
  leftEar.style.top = `${state.leftY}%`;
  rightEar.style.top = `${state.rightY}%`;
  bodyPiercing.style.top = `${state.bodyY}%`;
  syncControls();
  updateAdaptiveLighting();
}

function mediaSourceElement() {
  if (cameraStream && cameraVideo.readyState >= 2) return cameraVideo;
  if (state.photo && facePhoto.complete) return facePhoto;
  return null;
}

function samplePoint(source, xPercent, yPercent) {
  const width = source.videoWidth || source.naturalWidth;
  const height = source.videoHeight || source.naturalHeight;
  if (!width || !height) return null;

  lightCanvas.width = 48;
  lightCanvas.height = 48;
  lightCtx.clearRect(0, 0, 48, 48);

  const sampleSize = Math.max(24, Math.min(width, height) * .18);
  const sx = clamp(width * xPercent / 100 - sampleSize / 2, 0, width - sampleSize);
  const sy = clamp(height * yPercent / 100 - sampleSize / 2, 0, height - sampleSize);
  lightCtx.drawImage(source, sx, sy, sampleSize, sampleSize, 0, 0, 48, 48);

  const data = lightCtx.getImageData(0, 0, 48, 48).data;
  let r = 0;
  let g = 0;
  let b = 0;
  const count = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  r /= count;
  g /= count;
  b /= count;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const warmth = clamp((r + 18) / Math.max(b, 1), .82, 1.28);
  return { luminance, warmth };
}

function updateAdaptiveLighting() {
  const source = mediaSourceElement();
  if (!source) {
    stage.style.setProperty("--piercing-shadow", ".32");
    stage.style.setProperty("--piercing-highlight", ".64");
    stage.style.setProperty("--piercing-warmth", "1");
    return;
  }

  const points = state.placement === "ears"
    ? [[state.leftX, state.leftY], [state.rightX, state.rightY]]
    : [[state.bodyX, state.bodyY]];
  const samples = points.map(([x, y]) => samplePoint(source, x, y)).filter(Boolean);
  if (!samples.length) return;

  const avgLight = samples.reduce((sum, item) => sum + item.luminance, 0) / samples.length;
  const avgWarmth = samples.reduce((sum, item) => sum + item.warmth, 0) / samples.length;
  const shadow = clamp(.50 - avgLight * .28, .18, .42);
  const highlight = clamp(.38 + avgLight * .62, .42, .92);

  stage.style.setProperty("--piercing-shadow", shadow.toFixed(2));
  stage.style.setProperty("--piercing-highlight", highlight.toFixed(2));
  stage.style.setProperty("--piercing-warmth", avgWarmth.toFixed(2));
}

function watchCameraLighting() {
  if (!cameraStream) return;
  lightSampleFrame += 1;
  if (lightSampleFrame % 12 === 0) updateAdaptiveLighting();
  requestAnimationFrame(watchCameraLighting);
}

function facePoint(face, xRatio, yRatio) {
  const box = face.boundingBox;
  return {
    x: clamp(((box.x + box.width * xRatio) / cameraVideo.videoWidth) * 100, 8, 92),
    y: clamp(((box.y + box.height * yRatio) / cameraVideo.videoHeight) * 100, 12, 90),
  };
}

function placementTrackPoint(face, placementId) {
  const leftEar = facePoint(face, .06, .52);
  const rightEar = facePoint(face, .94, .52);
  const leftHighEar = facePoint(face, .08, .32);
  const rightHighEar = facePoint(face, .92, .32);
  const leftInnerEar = facePoint(face, .18, .48);
  const rightInnerEar = facePoint(face, .82, .48);
  const points = {
    lobe: leftEar,
    upperLobe: facePoint(face, .08, .44),
    helix: leftHighEar,
    forwardHelix: facePoint(face, .19, .31),
    tragus: leftInnerEar,
    conch: facePoint(face, .12, .46),
    rook: facePoint(face, .16, .36),
    daith: facePoint(face, .17, .42),
    snug: facePoint(face, .12, .40),
    industrialPlace: facePoint(face, .11, .34),
    orbital: facePoint(face, .10, .52),
    nose: facePoint(face, .57, .54),
    septumPlace: facePoint(face, .50, .59),
    bridge: facePoint(face, .50, .33),
    brow: facePoint(face, .70, .28),
    antiBrow: facePoint(face, .70, .47),
    lip: facePoint(face, .58, .73),
    monroe: facePoint(face, .63, .66),
    medusa: facePoint(face, .50, .67),
    verticalLabret: facePoint(face, .50, .77),
    smiley: facePoint(face, .50, .71),
    tonguePlace: facePoint(face, .50, .82),
    cheek: facePoint(face, .74, .55),
  };

  if (state.activeEar === "right") {
    points.lobe = rightEar;
    points.upperLobe = facePoint(face, .92, .44);
    points.helix = rightHighEar;
    points.forwardHelix = facePoint(face, .81, .31);
    points.tragus = rightInnerEar;
    points.conch = facePoint(face, .88, .46);
    points.rook = facePoint(face, .84, .36);
    points.daith = facePoint(face, .83, .42);
    points.snug = facePoint(face, .88, .40);
    points.industrialPlace = facePoint(face, .89, .34);
    points.orbital = facePoint(face, .90, .52);
  }

  return points[placementId] || null;
}

function trackFaceToPiercing(face) {
  if (state.placement === "ears") {
    const left = facePoint(face, .06, .52);
    const right = facePoint(face, .94, .52);
    state.leftX = state.leftX * .72 + left.x * .28;
    state.leftY = state.leftY * .72 + left.y * .28;
    state.rightX = state.rightX * .72 + right.x * .28;
    state.rightY = state.rightY * .72 + right.y * .28;
  } else {
    const point = placementTrackPoint(face, state.placement);
    if (!point) return;
    state.bodyX = state.bodyX * .72 + point.x * .28;
    state.bodyY = state.bodyY * .72 + point.y * .28;
  }
  renderTryon();
}

async function trackingLoop() {
  if (!trackingEnabled || !cameraStream) return;
  trackingFrame += 1;
  if (!trackingBusy && cameraVideo.readyState >= 2 && trackingFrame % 5 === 0) {
    trackingBusy = true;
    try {
      const faces = await trackingDetector.detect(cameraVideo);
      if (faces.length) trackFaceToPiercing(faces[0]);
    } catch (error) {
      stopTracking();
    } finally {
      trackingBusy = false;
    }
  }
  requestAnimationFrame(trackingLoop);
}

async function startTracking() {
  if (!cameraStream) {
    await startCamera();
    if (!cameraStream) return;
  }
  if (!("FaceDetector" in window)) {
    alert("このブラウザでは自動追尾を使えません。カメラを見ながら手動で位置調整してください。");
    return;
  }
  trackingDetector = trackingDetector || new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
  trackingEnabled = true;
  trackingButton.textContent = "◉ 追尾中";
  renderChoices();
  trackingLoop();
}

function stopTracking() {
  trackingEnabled = false;
  trackingButton.textContent = "◎ 追尾";
  renderChoices();
}

function renderFavorites() {
  favoritesList.innerHTML = favorites.map((item, index) => `
    <article class="favorite-item">
      <span class="favorite-preview">${earringSvg(item.style, item.color)}</span>
      <span class="favorite-meta">
        <strong>${styleName(item.style)}</strong>
        <span>${placementName(item.placement)} / ${colorName(item.color)} / ${item.size}px</span>
      </span>
      <span class="favorite-actions">
        <button type="button" data-apply-favorite="${index}" aria-label="候補を反映">↺</button>
        <button type="button" data-remove-favorite="${index}" aria-label="候補を削除">×</button>
      </span>
    </article>
  `).join("");
}

function renderLookbook() {
  lookbook.innerHTML = looks.map((look, index) => `
    <button class="look-card" type="button" data-look="${index}">
      <span class="look-face">
        <span class="earring" style="--look-x:${look.x}%; --look-y:${look.y}%; --look-size:${Math.max(32, look.size * .62)}px">${earringSvg(look.style, look.color)}</span>
      </span>
      <span class="look-title">
        <strong>${look.title}</strong>
        <span>${placementName(look.placement)} / ${styleName(look.style)}</span>
      </span>
    </button>
  `).join("");
}

function render() {
  renderChoices();
  renderTryon();
  renderLookbook();
  renderFavorites();
}

function updateFromControls() {
  state.size = Number(sizeControl.value);
  if (state.placement !== "ears") {
    state.bodyY = Number(heightControl.value);
    renderTryon();
    return;
  }

  const center = (state.leftX + state.rightX) / 2;
  const heightDelta = Number(heightControl.value) - currentHeight();
  const spread = Number(spreadControl.value);
  state.leftX = clamp(center - spread, 12, 48);
  state.rightX = clamp(center + spread, 52, 88);
  state.leftY = clamp(state.leftY + heightDelta, 31, 62);
  state.rightY = clamp(state.rightY + heightDelta, 31, 62);
  renderTryon();
}

function movePiercing(dx, dy) {
  if (state.placement !== "ears") {
    state.bodyX = clamp(state.bodyX + dx, 12, 88);
    state.bodyY = clamp(state.bodyY + dy, 18, 86);
    renderTryon();
    return;
  }

  if (state.activeEar === "left" || state.activeEar === "both") {
    state.leftX = clamp(state.leftX + dx, 12, 48);
    state.leftY = clamp(state.leftY + dy, 31, 62);
  }
  if (state.activeEar === "right" || state.activeEar === "both") {
    state.rightX = clamp(state.rightX + dx, 52, 88);
    state.rightY = clamp(state.rightY + dy, 31, 62);
  }
  renderTryon();
}

function stagePercent(clientX, clientY) {
  const rect = stage.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * 100,
    y: ((clientY - rect.top) / rect.height) * 100,
  };
}

function startDrag(event) {
  const target = event.currentTarget;
  target.setPointerCapture(event.pointerId);
  state.activeEar = target === leftEar ? "left" : target === rightEar ? "right" : "body";
  renderChoices();

  function onMove(moveEvent) {
    const point = stagePercent(moveEvent.clientX, moveEvent.clientY);
    if (target === bodyPiercing) {
      state.bodyX = clamp(point.x, 12, 88);
      state.bodyY = clamp(point.y, 18, 86);
    } else if (target === leftEar) {
      state.leftX = clamp(point.x, 12, 48);
      state.leftY = clamp(point.y, 31, 62);
    } else {
      state.rightX = clamp(point.x, 52, 88);
      state.rightY = clamp(point.y, 31, 62);
    }
    renderTryon();
  }

  function onUp(upEvent) {
    target.releasePointerCapture(upEvent.pointerId);
    target.removeEventListener("pointermove", onMove);
    target.removeEventListener("pointerup", onUp);
  }

  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerup", onUp);
}

function handlePhoto(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    stopTracking();
    stopCamera();
    state.photo = reader.result;
    facePhoto.src = state.photo;
    facePhoto.classList.add("has-photo");
    dropHint.classList.add("hidden");
  });
  reader.readAsDataURL(file);
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert("このブラウザではカメラを使えません。");
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    cameraVideo.srcObject = cameraStream;
    cameraVideo.classList.add("is-live");
    cameraButton.textContent = "■ 停止";
    facePhoto.classList.remove("has-photo");
    dropHint.classList.add("hidden");
    state.photo = "";
    watchCameraLighting();
  } catch (error) {
    alert("カメラを開始できませんでした。ブラウザのカメラ許可を確認してください。");
  }
}

function stopCamera() {
  if (!cameraStream) return;
  stopTracking();
  cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  cameraVideo.srcObject = null;
  cameraVideo.classList.remove("is-live");
  cameraButton.textContent = "● カメラ";
  updateAdaptiveLighting();
}

function earringImage(type, color) {
  return new Promise((resolve) => {
    const img = new Image();
    const innerSvg = earringSvg(type, color)
      .replace('<svg viewBox="0 0 100 120" aria-hidden="true">', "")
      .replace("</svg>", "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120">${innerSvg}</svg>`;
    img.onload = () => resolve(img);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function drawPhoto(ctx, rect) {
  return new Promise((resolve) => {
    if (cameraStream && cameraVideo.readyState >= 2) {
      const videoRatio = cameraVideo.videoWidth / cameraVideo.videoHeight;
      const stageRatio = rect.width / rect.height;
      let sourceWidth = cameraVideo.videoWidth;
      let sourceHeight = cameraVideo.videoHeight;
      let sourceX = 0;
      let sourceY = 0;

      if (videoRatio > stageRatio) {
        sourceWidth = cameraVideo.videoHeight * stageRatio;
        sourceX = (cameraVideo.videoWidth - sourceWidth) / 2;
      } else {
        sourceHeight = cameraVideo.videoWidth / stageRatio;
        sourceY = (cameraVideo.videoHeight - sourceHeight) / 2;
      }

      ctx.save();
      ctx.translate(rect.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(cameraVideo, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, rect.width, rect.height);
      ctx.restore();
      resolve();
      return;
    }

    if (!state.photo) {
      const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
      gradient.addColorStop(0, "#ebe4da");
      gradient.addColorStop(1, "#cbd7d4");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "#edc7af";
      ctx.beginPath();
      ctx.ellipse(rect.width / 2, rect.height * .48, rect.width * .24, rect.height * .26, 0, 0, Math.PI * 2);
      ctx.fill();
      resolve();
      return;
    }

    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(rect.width / img.width, rect.height / img.height);
      const width = img.width * ratio;
      const height = img.height * ratio;
      ctx.drawImage(img, (rect.width - width) / 2, (rect.height - height) / 2, width, height);
      resolve();
    };
    img.src = state.photo;
  });
}

async function downloadTryon() {
  const rect = stage.getBoundingClientRect();
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ece7de";
  ctx.fillRect(0, 0, rect.width, rect.height);

  await drawPhoto(ctx, rect);
  const earring = await earringImage(state.style, state.color);
  const width = state.size;
  const height = state.size * 1.24;
  const drawRealisticPiercing = (xPercent, yPercent) => {
    const x = rect.width * xPercent / 100;
    const y = rect.height * yPercent / 100;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.filter = "blur(3px)";
    ctx.fillStyle = "rgba(28, 18, 12, .22)";
    ctx.beginPath();
    ctx.ellipse(x, y + height * .05, width * .22, height * .08, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.filter = "drop-shadow(0 8px 7px rgba(18,13,9,.32)) drop-shadow(0 2px 1px rgba(255,255,255,.36))";
    ctx.drawImage(earring, x - width / 2, y - height * .18, width, height);
    ctx.restore();
  };

  if (state.placement === "ears") {
    drawRealisticPiercing(state.leftX, state.leftY);
    drawRealisticPiercing(state.rightX, state.rightY);
  } else {
    drawRealisticPiercing(state.bodyX, state.bodyY);
  }

  const link = document.createElement("a");
  link.download = "earline-tryon.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function saveFavorites() {
  localStorage.setItem("earlineFavorites", JSON.stringify(favorites));
}

function addFavorite() {
  const snapshot = {
    style: state.style,
    placement: state.placement,
    color: state.color,
    size: state.size,
    leftX: state.leftX,
    rightX: state.rightX,
    leftY: state.leftY,
    rightY: state.rightY,
    bodyX: state.bodyX,
    bodyY: state.bodyY,
  };
  favorites = [snapshot, ...favorites].slice(0, 6);
  saveFavorites();
  renderFavorites();
}

function applyFavorite(item) {
  Object.assign(state, item);
  render();
}

function applyLook(look) {
  state.placement = look.placement;
  state.style = look.style;
  state.color = look.color;
  state.size = look.size;
  if (look.placement === "ears") {
    state.leftX = 50 - currentSpread();
    state.rightX = 50 + currentSpread();
  } else {
    state.bodyX = look.x;
    state.bodyY = look.y;
    state.activeEar = "both";
  }
  render();
}

function setPlacement(id) {
  const placement = placements.find((item) => item.id === id);
  if (!placement) return;
  state.placement = id;
  if (id !== "ears") {
    state.bodyX = placement.x;
    state.bodyY = placement.y;
    state.size = placement.size;
    state.activeEar = "both";
  } else {
    state.size = placement.size;
  }
  render();
}

placementGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-placement]");
  if (!button) return;
  setPlacement(button.dataset.placement);
});

styleGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-style]");
  if (!button) return;
  state.style = button.dataset.style;
  render();
});

swatches.addEventListener("click", (event) => {
  const button = event.target.closest("[data-color]");
  if (!button) return;
  state.color = button.dataset.color;
  render();
});

lookbook.addEventListener("click", (event) => {
  const button = event.target.closest("[data-look]");
  if (!button) return;
  applyLook(looks[Number(button.dataset.look)]);
});

fitMode.addEventListener("click", (event) => {
  const button = event.target.closest("[data-ear]");
  if (!button) return;
  state.activeEar = button.dataset.ear;
  renderChoices();
});

document.querySelector("#photoInput").addEventListener("change", (event) => {
  handlePhoto(event.target.files[0]);
});

cameraButton.addEventListener("click", () => {
  if (cameraStream) {
    stopCamera();
  } else {
    startCamera();
  }
});

trackingButton.addEventListener("click", () => {
  if (trackingEnabled) {
    stopTracking();
  } else {
    startTracking();
  }
});

stage.addEventListener("dragover", (event) => event.preventDefault());
stage.addEventListener("drop", (event) => {
  event.preventDefault();
  handlePhoto(event.dataTransfer.files[0]);
});

sizeControl.addEventListener("input", updateFromControls);
spreadControl.addEventListener("input", updateFromControls);
heightControl.addEventListener("input", updateFromControls);
leftEar.addEventListener("pointerdown", startDrag);
rightEar.addEventListener("pointerdown", startDrag);
bodyPiercing.addEventListener("pointerdown", startDrag);

document.querySelector("#resetButton").addEventListener("click", () => {
  const photo = state.photo;
  Object.assign(state, defaultState, { photo });
  render();
});

document.querySelector("#downloadButton").addEventListener("click", downloadTryon);
document.querySelector("#favoriteButton").addEventListener("click", addFavorite);
document.querySelector("#clearFavoritesButton").addEventListener("click", () => {
  favorites = [];
  saveFavorites();
  renderFavorites();
});

favoritesList.addEventListener("click", (event) => {
  const applyButton = event.target.closest("[data-apply-favorite]");
  const removeButton = event.target.closest("[data-remove-favorite]");
  if (applyButton) {
    applyFavorite(favorites[Number(applyButton.dataset.applyFavorite)]);
  }
  if (removeButton) {
    favorites.splice(Number(removeButton.dataset.removeFavorite), 1);
    saveFavorites();
    renderFavorites();
  }
});

document.querySelector(".fit-tools").addEventListener("click", (event) => {
  const direction = event.target.dataset.nudge;
  if (direction === "up") movePiercing(0, -1);
  if (direction === "down") movePiercing(0, 1);
  if (direction === "left") movePiercing(-1, 0);
  if (direction === "right") movePiercing(1, 0);
});

render();
