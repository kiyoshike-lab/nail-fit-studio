// Optional local QA helper. Playwright is loaded from a separate QA installation;
// it is deliberately not an application dependency or part of npm test.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
if (!option('--input') || !option('--output-prefix') || !option('--playwright-module')) {
  throw Error('--input, --output-prefix and --playwright-module are required; run a local Next.js server first');
}
const { chromium } = await import(pathToFileURL(path.resolve(option('--playwright-module'))).href);
const data = JSON.parse(await readFile(option('--input'), 'utf8'));
const baseUrl = option('--base-url', 'http://localhost:4190');
if (!['localhost', '127.0.0.1'].includes(new URL(baseUrl).hostname)) throw Error('Only a local QA server may be used');
const browser = await chromium.launch({ channel: option('--browser-channel', 'chrome'), headless: true });
try {
  const page = await browser.newPage();
  await page.route(/googlesyndication|googletagmanager|google-analytics/, route => route.abort());
  await page.route('**/__alignment_qa__/vision.mjs', route => route.fulfill({
    contentType: 'application/javascript', path: path.resolve('node_modules/@mediapipe/tasks-vision/vision_bundle.mjs'),
  }));
  await page.goto(`${baseUrl}/try-on`);
  await page.evaluate(async () => {
    const { FilesetResolver, HandLandmarker } = await import('/__alignment_qa__/vision.mjs');
    const vision = await FilesetResolver.forVisionTasks('/mediapipe');
    const options = { baseOptions: { modelAssetPath: '/mediapipe/hand_landmarker.task', delegate: 'CPU' },
      numHands: 1, minHandDetectionConfidence: .35, minHandPresenceConfidence: .35, minTrackingConfidence: .35 };
    globalThis.__alignmentImageModel = await HandLandmarker.createFromOptions(vision, { ...options, runningMode: 'IMAGE' });
    globalThis.__alignmentVideoModel = await HandLandmarker.createFromOptions(vision, { ...options, runningMode: 'VIDEO' });
    globalThis.__alignmentTimestamp = 0;
  });
  const imageCases = [], videoCases = [];
  for (const item of data.cases) {
    const result = await page.evaluate(({ width, height, pixels }) => {
      const rgba = Uint8ClampedArray.from(atob(pixels), char => char.charCodeAt(0));
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      canvas.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
      const image = globalThis.__alignmentImageModel.detect(canvas).landmarks[0];
      let video;
      for (let sample = 0; sample < 3; sample++) {
        video = globalThis.__alignmentVideoModel.detectForVideo(canvas, globalThis.__alignmentTimestamp += 66).landmarks[0];
      }
      return { image, video };
    }, item);
    if (result.image) imageCases.push({ ...item, landmarks: result.image });
    if (result.video) videoCases.push({ ...item, landmarks: result.video });
  }
  for (const [mode, cases] of [['image', imageCases], ['video', videoCases]]) {
    await writeFile(`${option('--output-prefix')}-${mode}.json`, JSON.stringify({ ...data,
      inputImages: data.cases.length,
      undetectedFiles: data.cases.filter(item=>!cases.some(detected=>detected.file===item.file)).map(item=>item.file),
      landmarks: `current self-hosted MediaPipe CPU, ${mode.toUpperCase()} mode, longest input side 640px; VIDEO repeats each still 3 times`, cases }));
    console.log(`${mode}: ${cases.length}/${data.cases.length} images detected`);
  }
  await page.evaluate(() => { globalThis.__alignmentImageModel.close(); globalThis.__alignmentVideoModel.close(); });
} finally {
  await browser.close();
}
