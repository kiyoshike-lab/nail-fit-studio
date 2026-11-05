import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { importTypescript } from './lib/import-typescript.mjs';

// Run directly with node. No browser, network, production writes, or git writes.
// Canvas mocks verify draw commands/state, not rasterization or hardware accuracy.
const { drawNails } = await importTypescript('src/lib/nailRenderer.ts');
const { drawNailParts, drawSurfaceEffect } = await importTypescript('src/lib/workshopDrawing.ts');
const workshop = await importTypescript('src/lib/workshopData.ts');
const { partNames } = await importTypescript('src/lib/workshopTypes.ts');
const { defaultDesign } = await importTypescript('src/lib/defaults.ts');
const { nailCanvasGeometry } = await importTypescript('src/lib/nailPoseMetrics.ts');

const identity = [1, 0, 0, 1, 0, 0];
function multiply(a, b) {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}
const rotation = a => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
const translation = (x, y) => [1, 0, 0, 1, x, y];
function near(actual, expected, message = 'geometry differs') {
  assert.equal(actual.length, expected.length, message);
  actual.forEach((v, i) => assert.ok(Math.abs(v-expected[i]) < 1e-8, `${message}: [${i}] ${v} != ${expected[i]}`));
}

function mockContext(initial = {}) {
  const initialState = { globalAlpha: .8, fillStyle: '#102030', strokeStyle: '#405060', lineWidth: 2,
    lineCap: 'butt', matrix: [...identity], clips: [], ...initial };
  let state = { ...initialState };
  let currentPath = [];
  const stack = [], log = [];
  const snapshot = () => structuredClone(state);
  let fault;
  const record = (op, args = []) => {
    const event = { op, args: args.map(a => a instanceof MockImage ? { image: a.src } : structuredClone(a)),
      ...snapshot(), path: structuredClone(currentPath) };
    log.push(event);
    if (fault?.(event)) throw new Error('injected canvas failure');
    return event;
  };
  const pathMethods = new Set(['rect', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arcTo', 'arc', 'ellipse', 'closePath']);
  const ctx = new Proxy({}, {
    get(_target, key) {
      if (key in state) return state[key];
      if (key === 'save') return () => { record('save'); stack.push(snapshot()); };
      if (key === 'restore') return () => {
        assert.ok(stack.length, 'canvas restore underflow');
        state = stack.pop(); record('restore');
      };
      if (key === 'beginPath') return () => { currentPath = []; record('beginPath'); };
      if (pathMethods.has(key)) return (...args) => {
        args.filter(a => typeof a === 'number').forEach(a => assert.ok(Number.isFinite(a), `${key}: nonfinite geometry`));
        currentPath.push({ op: key, args, matrix: [...state.matrix] }); record(key, args);
      };
      if (key === 'clip') return (rule = 'nonzero') => {
        state.clips = [...state.clips, { rule, path: structuredClone(currentPath) }]; record('clip', [rule]);
      };
      if (key === 'translate' || key === 'rotate' || key === 'scale') return (...args) => {
        const transform = key === 'translate' ? translation(...args) : key === 'rotate' ? rotation(args[0]) : [args[0], 0, 0, args[1], 0, 0];
        state.matrix = multiply(state.matrix, transform); record(key, args);
      };
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return (...args) => {
        record(key, args);
        const value = { gradient: key, args, stops: [] };
        return { ...value, addColorStop(offset, color) { value.stops.push([offset, color]); }, toMockStyle: () => value };
      };
      if (['fill', 'stroke', 'fillRect', 'clearRect', 'drawImage'].includes(key)) return (...args) => record(key, args);
      throw new Error(`unexpected canvas API: ${String(key)}`);
    },
    set(_target, key, value) {
      state[key] = value?.toMockStyle ? structuredClone(value.toMockStyle()) : value;
      record('set', [key, state[key]]); return true;
    },
  });
  return { ctx, log, snapshot, get depth() { return stack.length; },
    inject(predicate) { fault = predicate; },
    balanced() { assert.equal(stack.length, 0, 'canvas save leaked'); assert.deepEqual(snapshot(), initialState, 'canvas state leaked'); },
  };
}
const paints = mock => mock.log.filter(e => ['fill', 'fillRect', 'stroke', 'drawImage'].includes(e.op));
const styleHas = (style, color) => style?.stops?.some(stop => stop[1] === color);
const part = (patch = {}) => ({ id: 'part-1', kind: 'pearl', color: '#ab89ef', x: .3, y: -.2, size: .4, rotation: 37, ...patch });
const art = (patch = {}) => ({ base: { ...defaultDesign }, opacity: 1, effect: 'none', parts: [], ...patch });
const nails = [16, 33, 50, 67, 84].map((x, i) => ({ x, y: 78-i*3, width: 9-i*.3, height: 19+i, rotation: -18+i*9 }));
const clone = v => structuredClone(v);

const images = [], timers = new Map(), values = new Map();
let timerId = 0;
class MockImage {
  width = 128;
  height = 256;
  constructor() { images.push(this); }
  set src(value) { this.url = value; }
  get src() { return this.url; }
  load() { assert.equal(this.crossOrigin, 'anonymous'); this.onload?.(); }
  fail() { this.onerror?.(new Error('mock unavailable image')); }
}
const originalGlobals = Object.fromEntries(['window', 'Image'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
globalThis.Image = MockImage;
globalThis.window = {
  setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
  clearTimeout(id) { timers.delete(id); },
  localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
};
let passed = 0, failed = 0;
async function check(name, run) {
  try { await run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}\n  ${error.message.slice(0, 900).replaceAll('\n', '\n  ')}`); }
}

try {
  await check('no custom art: unchanged paint commands for every shape and material', async () => {
    const shapes = ['natural', 'round', 'oval', 'squoval', 'almond', 'coffin', 'square', 'stiletto'];
    const materials = ['cream', 'jelly', 'glitter', 'metallic', 'shimmer', 'sheer'];
    const digest = createHash('sha256');
    for (const shape of shapes) for (const material of materials) {
      const base = { ...defaultDesign, shape, material, pattern: 'french', motif: 'dots' };
      const plain = mockContext(), noop = mockContext(), empty = mockContext();
      const options = { viewport: { x: 20, y: 15, width: 900, height: 650 }, opacity: .7 };
      await drawNails(plain.ctx, 1000, 800, nails, base, options);
      await drawNails(noop.ctx, 1000, 800, nails, base, { ...options, fingers: nails.map(() => art({ base })) });
      await drawNails(empty.ctx, 1000, 800, nails, base, { ...options, fingers: [] });
      assert.ok(paints(plain).length > 0);
      assert.deepEqual(paints(noop), paints(plain), `${shape}/${material}: no-op artwork changed rendering`);
      assert.deepEqual(paints(empty), paints(plain), 'empty artwork changed fallback rendering');
      digest.update(JSON.stringify(paints(plain)));
      [plain, noop, empty].forEach(mock => mock.balanced());
    }
    // Captured from the committed pre-workshop renderer, independently compared
    // against all 48 fixtures above. The test itself requires no git access.
    assert.equal(digest.digest('hex'), 'f5ed633a8b4b3cc447172e8402d4f2c57973938d1be394c1847187c3ae96849a', 'legacy no-art paint trace changed');
  });

  await check('default no-art paint contract: five roots, bases, depth layers and highlights', async () => {
    const mock = mockContext(); let count;
    await drawNails(mock.ctx, 800, 600, nails, defaultDesign, { onPainted: n => { count = n; } });
    assert.equal(count, 5);
    assert.equal(paints(mock).length, 25);
    assert.equal(paints(mock).filter(e => e.op === 'fillRect').length, 15);
    assert.equal(paints(mock).filter(e => e.op === 'fill').length, 5);
    assert.equal(paints(mock).filter(e => e.op === 'stroke').length, 5);
    mock.balanced();
  });

  await check('per-finger base, opacity, effect and part remain on their original index', async () => {
    const colors = ['#112233', '#334455', '#556677', '#778899', '#99aabb'];
    const partColors = ['#aa1111', '#aa2222', '#aa3333', '#aa4444', '#aa5555'];
    const fingers = colors.map((color, i) => art({ base: { ...defaultDesign, color }, opacity: .2+i*.15,
      effect: i%2 ? 'lines' : 'dots', parts: [part({ color: partColors[i] })] }));
    const mock = mockContext();
    await drawNails(mock.ctx, 900, 700, nails, defaultDesign, { fingers, opacity: .5 });
    colors.forEach((hex, i) => {
      const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset+2), 16));
      const basePaint = paints(mock).filter(e => e.op === 'fillRect' && styleHas(e.fillStyle, `rgba(${rgb.join(', ')}, 0.94)`));
      assert.equal(basePaint.length, 1, `wrong base on finger ${i}`);
      near([basePaint[0].globalAlpha], [.8*.5*fingers[i].opacity]);
      const partPaint = paints(mock).filter(e => styleHas(e.fillStyle, partColors[i]));
      assert.equal(partPaint.length, 1, `wrong part on finger ${i}`);
      near([partPaint[0].globalAlpha], [.8*.5], 'part should not inherit base-only opacity');
    });
    mock.balanced();
  });

  await check('normalized parts follow viewport, fitted length/shape and both rotations at different resolutions', async () => {
    for (const scale of [1, 2.5]) for (const shape of ['oval', 'square', 'coffin']) {
      const mock = mockContext();
      const viewport = { x: 31*scale, y: 17*scale, width: 800*scale, height: 600*scale };
      const p = part(), base = { ...defaultDesign, shape, length: 1.7 };
      await drawNails(mock.ctx, 1000*scale, 800*scale, [nails[0]], base, { viewport, fingers: [art({ base, parts: [p] })] });
      const paint = paints(mock).find(e => styleHas(e.fillStyle, p.color));
      const g = nailCanvasGeometry(nails[0], viewport.width, viewport.height, base.length, shape === 'square' ? 1.05 : shape === 'coffin' ? 1.1 : 1);
      const expected = multiply(multiply(multiply(multiply(translation(viewport.x, viewport.y), translation(g.center.x, g.center.y)), rotation(nails[0].rotation*Math.PI/180)), translation(p.x*g.width, p.y*g.height)), rotation(p.rotation*Math.PI/180));
      near(paint.matrix, expected);
      near(paint.path[0].args.slice(0, 4), [0, 0, p.size*g.width*.5, p.size*g.width*.5]);
      mock.balanced();
    }
  });

  await check('all procedural parts and effects use finite geometry and restore state in both detail modes', () => {
    for (const light of [false, true]) for (const kind of Object.keys(partNames)) {
      const mock = mockContext();
      drawNailParts(mock.ctx, 120, 220, [part({ kind, x: -.45, y: .45, rotation: -180, size: .6 })], light);
      assert.ok(paints(mock).length >= 3, kind);
      mock.balanced();
    }
    for (const effect of ['none', 'dots', 'lines', 'magnetic']) {
      const mock = mockContext(); drawSurfaceEffect(mock.ctx, 120, 220, art({ effect })); mock.balanced();
      assert.equal(paints(mock).length, { none: 0, dots: 15, lines: 3, magnetic: 1 }[effect]);
    }
  });

  await check('part array order is paint order; light mode removes facets/glitter, not placement', () => {
    const parts = [part({ kind: 'star', color: '#123456' }), part({ id: 'p2', kind: 'crystal', color: '#654321' })];
    const standard = mockContext(), light = mockContext();
    drawNailParts(standard.ctx, 100, 180, parts); drawNailParts(light.ctx, 100, 180, parts, true);
    const bodies = mock => paints(mock).filter(e => styleHas(e.fillStyle, '#123456') || styleHas(e.fillStyle, '#654321'));
    assert.deepEqual(bodies(standard).map(e => e.fillStyle.stops[1][1]), ['#123456', '#654321']);
    assert.deepEqual(bodies(light), bodies(standard));
    assert.ok(paints(light).length < paints(standard).length);
    [standard, light].forEach(mock => mock.balanced());
  });

  await check('partial visibility and holes clip base/effect/parts/shadows before local transforms', async () => {
    const mock = mockContext();
    const contour = [{ x: 10, y: 20 }, { x: 60, y: 20 }, { x: 60, y: 80 }, { x: 10, y: 80 }];
    const hole = [{ x: 30, y: 40 }, { x: 40, y: 40 }, { x: 35, y: 50 }];
    const viewport = { x: 30, y: 20, width: 800, height: 600 };
    const p = part({ x: .45, y: .45, size: .6 });
    const finger = art({ effect: 'lines', parts: [p], opacity: .3 });
    await drawNails(mock.ctx, 1000, 800, [{ ...nails[0], visibility: .4, visibilityState: 'partial', clipContour: contour, clipHoles: [hole] }], defaultDesign,
      { viewport, opacity: .5, fingers: [finger] });
    const all = paints(mock);
    assert.ok(all.length > 5);
    all.forEach(e => {
      assert.equal(e.clips[0].path[0].op, 'rect');
      const mask = e.clips[1]; assert.equal(mask.rule, 'evenodd');
      assert.equal(mask.path.filter(p => p.op === 'moveTo').length, 2, 'hole lost');
      near(mask.path[0].args, [80, 120]);
      near(mask.path[0].matrix, translation(30, 20), 'mask must be in viewport coordinates');
      assert.ok(e.globalAlpha <= .8*.5*.4+1e-10, 'effect/part/shadow escaped visibility alpha');
    });
    // The root contact shadow intentionally precedes the nail-shaped clip.
    assert.equal(all[0].clips.length, 2);
    all.slice(1).forEach(e => assert.equal(e.clips.length, 3, 'decoration escaped nail shape'));
    mock.balanced();
  });

  await check('hidden/nonfinite visibility and missing/invalid partial masks cannot paint custom art', async () => {
    const invalids = [
      { visibility: 0, visibilityState: 'hidden' }, { visibility: NaN }, { visibility: -1 },
      { visibility: 1, visibilityState: 'partial' },
      { visibility: 1, visibilityState: 'partial', clipContour: [{ x: 1, y: 1 }] },
      { visibility: 1, clipContour: [{ x: 1, y: 1 }, { x: NaN, y: 2 }, { x: 3, y: 3 }] },
      { visibility: 1, clipContour: Array.from({ length: 129 }, () => ({ x: 1, y: 1 })) },
    ];
    for (const patch of invalids) {
      const mock = mockContext(); let count;
      await drawNails(mock.ctx, 900, 700, [{ ...nails[0], ...patch }], defaultDesign,
        { fingers: [art({ effect: 'magnetic', parts: [part()] })], onPainted: n => { count = n; } });
      assert.equal(paints(mock).length, 0); assert.equal(count, 0); mock.balanced();
    }
  });

  await check('hidden earlier fingers do not shift later artwork', async () => {
    const mock = mockContext(), fingers = [art({ parts: [part({ color: '#123456' })] }), art({ parts: [part({ color: '#654321' })] })];
    await drawNails(mock.ctx, 900, 700, [{ ...nails[0], visibility: 0 }, nails[1]], defaultDesign, { fingers });
    assert.equal(paints(mock).filter(e => styleHas(e.fillStyle, '#123456')).length, 0);
    assert.equal(paints(mock).filter(e => styleHas(e.fillStyle, '#654321')).length, 1);
    mock.balanced();
  });

  await check('per-finger textures resolve independently and shared URLs are deduplicated', async () => {
    const before = images.length, mock = mockContext();
    const urls = ['one', 'two', 'one', 'four', 'five'].map(id => `/assets/preset-textures/review-${id}.png`);
    const fingers = urls.map(textureUrl => art({ base: { ...defaultDesign, textureUrl } }));
    const pending = drawNails(mock.ctx, 900, 700, nails, defaultDesign, { fingers });
    const batch = images.slice(before); assert.equal(batch.length, 4); assert.equal(mock.log.length, 0);
    batch.slice(0, -1).reverse().forEach(image => image.load());
    await Promise.resolve(); assert.equal(mock.log.length, 0, 'canvas was touched before all I/O completed');
    batch.at(-1).load(); assert.equal(await pending, true);
    assert.deepEqual(paints(mock).filter(e => e.op === 'drawImage').map(e => e.args[0].image), urls);
    const plain = mockContext(), noop = mockContext();
    await drawNails(plain.ctx, 900, 700, nails, fingers[0].base);
    await drawNails(noop.ctx, 900, 700, nails, fingers[0].base, { fingers: nails.map(() => fingers[0]) });
    assert.deepEqual(paints(noop), paints(plain), 'no-op textured artwork changed rendering');
    [mock, plain, noop].forEach(ctx => ctx.balanced());
  });

  await check('stale multi-texture render cannot clear/overpaint a newer frame or call onPainted', async () => {
    const mock = mockContext(), before = images.length;
    let current = true, staleCallback = 0;
    const fingers = [1, 2].map(i => art({ base: { ...defaultDesign, textureUrl: `/assets/preset-textures/review-stale-${i}.png` }, parts: [part()] }));
    const old = drawNails(mock.ctx, 900, 700, nails.slice(0, 2), defaultDesign,
      { fingers, clear: true, isCurrent: () => current, onPainted: () => { staleCallback++; } });
    assert.equal(mock.log.length, 0); mock.balanced(); current = false;
    await drawNails(mock.ctx, 900, 700, nails, { ...defaultDesign, color: '#00ff00' }, { clear: true });
    const fresh = clone(mock.log);
    images.slice(before).reverse().forEach(image => image.load());
    assert.equal(await old, false); assert.deepEqual(mock.log, fresh);
    assert.equal(staleCallback, 0); mock.balanced();
  });

  await check('waitForTexture:false paints synchronously, uses ready textures next frame, never repaints on load', async () => {
    const mock = mockContext(), before = images.length;
    const fingers = [art({ base: { ...defaultDesign, textureUrl: '/assets/preset-textures/review-live.png' }, parts: [part()] })];
    const pending = drawNails(mock.ctx, 900, 700, [nails[0]], defaultDesign, { fingers, waitForTexture: false });
    assert.ok(paints(mock).length > 0, 'live drawing yielded for texture');
    assert.equal(paints(mock).filter(e => e.op === 'drawImage').length, 0); mock.balanced();
    await pending; const painted = clone(mock.log);
    images[before].load(); await Promise.resolve(); await Promise.resolve();
    assert.deepEqual(mock.log, painted, 'image.onload overpainted a finished frame');
    const next = mockContext();
    await drawNails(next.ctx, 900, 700, [nails[0]], defaultDesign, { fingers, waitForTexture: false });
    assert.equal(paints(next).filter(e => e.op === 'drawImage').length, 1); next.balanced();
  });

  await check('failed and timed-out per-finger textures still paint fallback with balanced canvas', async () => {
    for (const timeout of [false, true]) {
      const mock = mockContext(), before = images.length;
      const fingers = [art({ base: { ...defaultDesign, textureUrl: `/assets/preset-textures/review-failure-${timeout}.png` }, parts: [part()] })];
      const pending = drawNails(mock.ctx, 900, 700, [nails[0]], defaultDesign, { fingers });
      if (timeout) [...timers.values()].forEach(callback => callback()); else images[before].fail();
      assert.equal(await pending, true); assert.ok(paints(mock).length > 0);
      assert.equal(paints(mock).filter(e => e.op === 'drawImage').length, 0); mock.balanced();
      const painted = clone(mock.log); images[before].load(); await Promise.resolve();
      assert.deepEqual(mock.log, painted, 'late texture completion overpainted fallback');
    }
  });

  await check('part/effect failures restore outer canvas state before propagating', async () => {
    for (const effect of ['none', 'magnetic']) {
      const mock = mockContext();
      mock.inject(e => effect === 'magnetic' ? e.op === 'createLinearGradient' && e.args[0] !== 0 : e.op === 'fill' && styleHas(e.fillStyle, '#ab89ef'));
      await assert.rejects(drawNails(mock.ctx, 900, 700, [nails[0]], defaultDesign, { fingers: [art({ effect, parts: [part()] })] }), /injected canvas failure/);
      mock.balanced();
    }
  });

  // Regression expectations are deliberately not marked TODO or swallowed.
  // A failing check below identifies a production issue; this script changes no production files.
  await check('flower petal failure restores every nested save and caller state', async () => {
    const mock = mockContext();
    mock.inject(e => e.op === 'ellipse' && mock.depth === 5);
    await assert.rejects(drawNails(mock.ctx, 900, 700, [nails[0]], defaultDesign, { fingers: [art({ parts: [part({ kind: 'flower' })] })] }), /injected canvas failure/);
    mock.balanced();
  });

  await check('schema removes photos/landmarks/arbitrary keys; only local preset textures persist', () => {
    const doc = workshop.createDocument();
    doc.photo = 'private-photo'; doc.landmarks = [{ x: 1, y: 2 }];
    doc.fingers[0].photo = 'private-photo'; doc.fingers[0].base.photo = 'private-photo';
    doc.fingers[0].parts = [{ ...part(), photo: 'private-photo', textureUrl: 'https://attacker.test/private' }];
    const parsed = workshop.parseDocument(doc); assert.ok(parsed);
    assert.ok(!JSON.stringify(parsed).includes('private-photo'));
    assert.ok(!JSON.stringify(parsed).includes('attacker.test'));
    for (const textureUrl of ['https://attacker.test/a.png', '//attacker.test/a.png', 'data:image/png;base64,private', 'blob:private', '/assets/preset-textures/../private.png', '/assets/preset-textures/a.png?photo=private', '/assets/preset-textures/%2e%2e.png', '/assets/preset-textures/a\\private.png']) {
      const candidate = clone(doc); candidate.fingers[0].base.textureUrl = textureUrl;
      assert.equal(workshop.parseDocument(candidate), null, `accepted unsafe texture ${textureUrl}`);
    }
    parsed.fingers[0].base.textureUrl = '/assets/preset-textures/local-test.webp';
    assert.equal(workshop.saveWorkshopDraft(parsed), true);
    assert.deepEqual(workshop.readWorkshopDraft().document, parsed);
    assert.equal(images.filter(image => /attacker|private/.test(image.src)).length, 0);
  });

  await check('schema rejects nonfinite/out-of-range normalized parts and duplicate IDs', () => {
    for (const patch of [{ x: -.451 }, { y: .451 }, { size: .601 }, { rotation: 181 }, { size: NaN }, { x: Infinity }]) {
      const doc = workshop.createDocument(); doc.fingers[0].parts = [part(patch)];
      assert.equal(workshop.parseDocument(doc), null);
    }
    const doc = workshop.createDocument(); doc.fingers[0].parts = [part(), part()];
    assert.equal(workshop.parseDocument(doc), null);
    doc.fingers[0].parts = Array.from({ length: 13 }, (_, i) => part({ id: `p${i}` }));
    assert.equal(workshop.parseDocument(doc), null);
  });

  await check('enum fields must be strings, never coercible arrays', () => {
    const make = () => { const doc = workshop.createDocument(); doc.fingers[0].parts = [part()]; return doc; };
    const candidates = [
      doc => { doc.detail = ['standard']; }, doc => { doc.fingers[0].effect = ['none']; },
      doc => { doc.fingers[0].base.shape = ['oval']; }, doc => { doc.fingers[0].base.finish = ['gloss']; },
      doc => { doc.fingers[0].base.material = ['cream']; }, doc => { doc.fingers[0].base.pattern = ['solid']; },
      doc => { doc.fingers[0].base.naturalNailLength = ['auto']; }, doc => { doc.fingers[0].parts[0].kind = ['pearl']; },
    ];
    const accepted = [];
    candidates.forEach((mutate, i) => { const doc = make(); mutate(doc); if (workshop.parseDocument(doc) !== null) accepted.push(i); });
    assert.deepEqual(accepted, [], 'non-string schema enums accepted (detail/effect/base/part)');
  });

  await check('corrupt JSON enum objects return ok:false instead of crashing draft/library readers', () => {
    const failures = [];
    for (const target of ['detail', 'shape', 'folder']) {
      values.clear(); const doc = workshop.createDocument();
      if (target === 'detail') doc.detail = { toString: null };
      if (target === 'shape') doc.fingers[0].base.shape = { toString: null };
      const entry = { folder: target === 'folder' ? { toString: null } : 'created', document: doc };
      const key = target === 'folder' ? workshop.WORKSHOP_LIBRARY : workshop.WORKSHOP_DRAFT;
      const raw = JSON.stringify(target === 'folder' ? { schema: 1, entries: [entry] } : doc);
      values.set(key, raw);
      try {
        const result = target === 'folder' ? workshop.readWorkshopLibrary() : workshop.readWorkshopDraft();
        if (result.ok !== false) failures.push(`${target}: accepted`);
      } catch (error) { failures.push(`${target}: threw ${error.message}`); }
      assert.equal(values.get(key), raw, 'corrupt data was rewritten');
    }
    assert.deepEqual(failures, [], 'corrupt enum objects escaped graceful storage handling');
  });

  await check('library save refuses a serialized payload its own reader would reject, preserving previous designs', () => {
    values.clear();
    const doc = workshop.createDocument();
    doc.fingers[0].base.textureUrl = `/assets/preset-textures/${'a'.repeat(355000)}.png`;
    assert.ok(workshop.parseDocument(doc), 'fixture must pass current schema');
    assert.equal(workshop.saveWorkshopDocument(doc), true); assert.equal(workshop.readWorkshopLibrary().ok, true);
    const previous = values.get(workshop.WORKSHOP_LIBRARY);
    const result = workshop.saveWorkshopDocument({ ...doc, id: `${doc.id}-second` });
    assert.equal(result, false, 'save reported success for library >700,000 characters');
    assert.equal(values.get(workshop.WORKSHOP_LIBRARY), previous);
    assert.equal(workshop.readWorkshopLibrary().entries.length, 1);
  });

  await check('draft save refuses a serialized payload its own reader would reject', () => {
    values.clear(); const doc = workshop.createDocument();
    doc.fingers[0].base.textureUrl = `/assets/preset-textures/${'a'.repeat(700000)}.png`;
    assert.equal(workshop.saveWorkshopDraft(doc), false, 'unreadable oversized draft was reported saved');
    assert.equal(values.has(workshop.WORKSHOP_DRAFT), false);
  });

  assert.equal(timers.size, 0, 'test left image timers pending');
} finally {
  for (const [key, descriptor] of Object.entries(originalGlobals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
}
console.log(`workshop-rendering: ${passed} passed, ${failed} failed (command/state mocks; not pixel or hardware verification)`);
if (failed) process.exitCode = 1;
