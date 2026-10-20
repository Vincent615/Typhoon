import test from 'node:test';
import assert from 'node:assert/strict';
import { TyphoonMapRenderer } from '../src/map-renderer.js';
import { UltraTyphoonRenderer } from '../src/ultra-renderer.js';
import { MAX_CANVAS_PIXELS, canvasPixelRatio, canvasTooltipLayout, streamlineCount,
  advanceStreamlines, drawStreamlineBatches } from '../src/render-quality.js';

function context() {
  const counts = { strokes: 0, paths: 0 };
  return new Proxy({
    counts,
    stroke() { counts.strokes++; },
    beginPath() { counts.paths++; },
    measureText(text) { return { width: text.length * 6 }; },
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; }
  }, { get: (target, key) => target[key] ?? (() => {}) });
}

function environment(width = 390, height = 500, ratio = 3, coarsePointer = false) {
  const rect = { width, height };
  const mediaQueries = [];
  const fontEvents = new Map();
  let resolveFonts;
  const fontsReady = new Promise((resolve) => { resolveFonts = resolve; });
  const canvas = () => ({
    style: {}, listeners: new Map(), ctx: context(),
    parentElement: { getBoundingClientRect: () => rect },
    getContext() { return this.ctx; },
    getBoundingClientRect: () => ({ left: 0, top: 0, ...rect }),
    addEventListener(name, callback) { this.listeners.set(name, callback); }
  });
  globalThis.window = {
    devicePixelRatio: ratio,
    matchMedia(query) {
      const listeners = new Map();
      const media = {
        media: query, matches: query === '(pointer: coarse)' && coarsePointer, listeners,
        addEventListener: (name, callback) => listeners.set(name, callback),
        removeEventListener: (name, callback) => {
          if (listeners.get(name) === callback) listeners.delete(name);
        }
      };
      mediaQueries.push(media);
      return media;
    }
  };
  globalThis.document = {
    createElement: canvas,
    fonts: {
      ready: fontsReady,
      addEventListener: (name, callback) => fontEvents.set(name, callback)
    }
  };
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.Path2D = class {
    moveTo() {}
    lineTo() {}
    closePath() {}
  };
  return { canvas: canvas(), rect, mediaQueries, fontEvents, resolveFonts };
}

test('canvas buffers cap high-DPR phones, desktops and very large displays', () => {
  assert.equal(canvasPixelRatio(390, 600, 3), 3);
  assert.equal(canvasPixelRatio(430, 600, 4), 3);
  assert.equal(canvasPixelRatio(844, 300, 3, true), 3);
  assert.equal(canvasPixelRatio(844, 300, 3, false), 2);
  assert.equal(canvasPixelRatio(599, 1199, 3), Math.sqrt(MAX_CANVAS_PIXELS / (599 * 1199)));
  assert.equal(canvasPixelRatio(1200, 700, 4), Math.sqrt(MAX_CANVAS_PIXELS / 840000));
  assert.equal(canvasPixelRatio(800, 600, 2), 2);
  assert.equal(canvasPixelRatio(390, 600, 1), 1);
  const dpr = canvasPixelRatio(3840, 2160, 3);
  assert.ok(3840 * 2160 * dpr ** 2 <= MAX_CANVAS_PIXELS + 1);
  assert.ok(streamlineCount(390, 500, true) < streamlineCount(1200, 800, true));
});

test('wind positions, trails and lifetimes are equivalent at 60 Hz and 30 Hz', () => {
  const make = () => ({
    bounds: { minLat: -100, maxLat: 100, minLon: -100, maxLon: 100 },
    streamlines: [{ pts: [{ lat: 0, lon: 0 }], age: 0, maxAge: 1000 }],
    _velocityAt: (lat, lon) => ({ dLat: 0.01 + lon / 1000, dLon: 0.02, mag: 0.5 })
  });
  const fast = make();
  const slow = make();
  for (let i = 0; i < 60; i++) advanceStreamlines(fast, null, 1 / 60);
  for (let i = 0; i < 30; i++) advanceStreamlines(slow, null, 1 / 30);
  assert.deepEqual(slow.streamlines, fast.streamlines);
  assert.equal(slow.streamlines[0].age, 60);
  assert.equal(slow.streamlines[0].pts.length, 12);
  const paused = structuredClone(slow.streamlines);
  advanceStreamlines(slow, null, 0);
  assert.deepEqual(slow.streamlines, paused);
});

test('hundreds of wind trails use at most 12 strokes and remain separate paths', () => {
  const ctx = context();
  let starts = 0;
  ctx.moveTo = () => { starts++; };
  const renderer = {
    latLonToXY: (lat, lon) => ({ x: lon, y: lat }),
    streamlines: Array.from({ length: 320 }, (_, i) => ({
      age: i % 99 + 1, maxAge: 100, mag: i % 3,
      pts: [{ lat: 0, lon: i }, { lat: 1, lon: i }, { lat: 2, lon: i }]
    }))
  };
  drawStreamlineBatches(ctx, renderer, [
    { min: 1.5, color: 'red', width: 1 },
    { min: 0.5, color: 'orange', width: 1 },
    { min: -Infinity, color: 'cyan', width: 1 }
  ]);
  assert.ok(ctx.counts.strokes > 0 && ctx.counts.strokes <= 12);
  assert.ok(starts > 300, 'every visible trail starts a disconnected subpath');
});

test('tooltips wrap long forecast labels and remain visible at all phone map corners', () => {
  const ctx = context();
  const title = '預報時間與颱風狀態'.repeat(8);
  for (const x of [0, 160, 320]) {
    for (const y of [0, 250, 500]) {
      const box = canvasTooltipLayout(ctx, [title, '基隆市 · 機率 100%', '陣風 12 級'],
        { x, y }, 320, 500);
      assert.ok(box.x >= 8 && box.x + box.w <= 312);
      assert.ok(box.y >= 8 && box.y + box.h <= 492);
      assert.equal(box.lines.join(''), `${title}基隆市 · 機率 100%陣風 12 級`,
        'wrapping preserves the full county and forecast information');
      assert.ok(box.lines.every((line) => ctx.measureText(line).width <= box.w - box.padding * 2));
    }
  }
});

for (const Renderer of [TyphoonMapRenderer, UltraTyphoonRenderer]) {
  test(`${Renderer.name}: unchanged geometry is reused; resize and moving camera invalidate it`, () => {
    const { canvas, rect } = environment();
    const renderer = new Renderer(canvas);
    renderer.scenario = { hasTyphoon: false, timeline: [] };
    renderer._updateBounds(null, 0);
    const original = renderer._buildCountyPath('TPE');
    const coast = renderer._coastPath();
    renderer._updateBounds(null, 1 / 30);
    assert.equal(renderer._buildCountyPath('TPE'), original);
    assert.equal(renderer._coastPath(), coast);
    renderer.countyHit = [{ id: 'TPE', rings: original.screenRings }];
    const initialPoint = renderer.latLonToXY(25.03, 121.54);
    assert.equal(renderer._countyAt(initialPoint.x, initialPoint.y), 'TPE');

    rect.width = 800;
    renderer.resize();
    const resized = renderer._buildCountyPath('TPE');
    assert.notEqual(resized, original);
    assert.notEqual(resized.screenRings[0][0].x, original.screenRings[0][0].x);
    renderer.countyHit = [{ id: 'TPE', rings: resized.screenRings }];
    const resizedPoint = renderer.latLonToXY(25.03, 121.54);
    assert.equal(renderer._countyAt(resizedPoint.x, resizedPoint.y), 'TPE');

    renderer.scenario.hasTyphoon = true;
    renderer._updateBounds({ lat: 22, lon: 135, radius7km: 200 }, 1 / 30);
    assert.notEqual(renderer._buildCountyPath('TPE'), resized);
    const storm = { lat: 23, lon: 127, radius7km: 200 };
    renderer._updateBounds(storm, 0);
    assert.deepEqual(renderer.bounds, renderer._computeTargetBounds(storm));
  });

  test(`${Renderer.name}: pause redraws do not advance effects; controls and DPR changes invalidate`, () => {
    const { canvas } = environment();
    let invalidations = 0;
    const renderer = new Renderer(canvas, { onInvalidate: () => invalidations++ });
    renderer.scenario = { hasTyphoon: false, timeline: [{ counties: [] }, { counties: [] }] };
    renderer.render(0);
    assert.equal(renderer.needsRender, false);
    const particles = structuredClone(renderer.streamlines);
    const time = renderer.time;
    renderer.setSelectedCounty('TPE');
    assert.equal(renderer.needsRender, true);
    renderer.render(0);
    assert.deepEqual(renderer.streamlines, particles);
    assert.equal(renderer.time, time);
    renderer.setLayerVisibility('wind', false);
    assert.equal(renderer.needsRender, true);
    renderer.render(0);
    canvas.listeners.get('mousemove')({ clientX: 20, clientY: 20 });
    assert.equal(renderer.needsRender, true);
    renderer.render(0);
    canvas.listeners.get('mouseleave')();
    assert.equal(renderer.needsRender, true);
    renderer.render(0);
    renderer.setFloatStep(0.5);
    assert.equal(renderer.needsRender, true);
    renderer.render(0);
    window.devicePixelRatio = 1;
    renderer.resize();
    assert.equal(canvas.width, 390);
    assert.equal(renderer.needsRender, true);
    assert.ok(invalidations >= 7);
  });

  test(`${Renderer.name}: Retina resolution changes preserve CSS hit targets and cached paths`, () => {
    const { canvas, mediaQueries, rect } = environment(390, 500, 2);
    const renderer = new Renderer(canvas);
    const original = renderer._buildCountyPath('TPE');
    const originalParticles = renderer.streamlines;
    renderer.countyHit = [{ id: 'TPE', rings: original.screenRings }];
    const point = renderer.latLonToXY(25.03, 121.54);

    window.devicePixelRatio = 3;
    const initialResolution = mediaQueries.find((entry) => entry.media.startsWith('(resolution:'));
    initialResolution.listeners.get('change')();
    assert.equal(canvas.width, 1170);
    assert.equal(canvas.height, 1500);
    assert.equal(canvas.style.width, '390px');
    assert.equal(canvas.style.height, '500px');
    assert.equal(renderer._countyAt(point.x, point.y), 'TPE');
    assert.equal(renderer._buildCountyPath('TPE'), original);
    assert.equal(renderer.streamlines, originalParticles);
    assert.equal(mediaQueries.at(-1).media, '(resolution: 3dppx)');
    assert.equal(initialResolution.listeners.size, 0);
    assert.equal(renderer.needsRender, true);

    rect.width = 599;
    rect.height = 1199;
    renderer.resize();
    assert.ok(canvas.width * canvas.height <= MAX_CANVAS_PIXELS,
      'rounding backing-buffer dimensions must not exceed the raster budget');
  });

  test(`${Renderer.name}: landscape phones retain Retina detail after orientation change`, () => {
    const { canvas, rect } = environment(390, 500, 3, true);
    const renderer = new Renderer(canvas);
    rect.width = 844;
    rect.height = 300;
    renderer.resize();
    assert.equal(renderer.dpr, 3);
    assert.equal(canvas.width, 2532);
    assert.equal(canvas.height, 900);
    assert.ok(canvas.width * canvas.height <= MAX_CANVAS_PIXELS);
  });

  test(`${Renderer.name}: loaded fonts invalidate a paused map without rebuilding geometry`, async () => {
    const { canvas, resolveFonts, fontEvents } = environment();
    const renderer = new Renderer(canvas);
    renderer.scenario = { hasTyphoon: false, timeline: [{ counties: [] }] };
    renderer.render(0);
    const original = renderer._buildCountyPath('TPE');
    assert.equal(renderer.needsRender, false);
    resolveFonts();
    await Promise.resolve();
    assert.equal(renderer.needsRender, true);
    assert.equal(renderer._buildCountyPath('TPE'), original);
    renderer.render(0);
    fontEvents.get('loadingdone')();
    assert.equal(renderer.needsRender, true);
    assert.equal(renderer.time, 0);
  });

  test(`${Renderer.name}: narrow map storm and forecast labels remain inside the visible canvas`, () => {
    const { canvas } = environment(320, 500);
    const renderer = new Renderer(canvas);
    const labels = [];
    const ctx = canvas.ctx;
    ctx.fillText = (text, x, y) => labels.push({
      text, x, y, align: ctx.textAlign, width: ctx.measureText(text).width
    });
    renderer.pxPerKm = 0.4;
    const state = { lat: 22, lon: 130, radius7km: 300, radius10km: 120 };
    for (const x of [12, 308]) {
      renderer.latLonToXY = () => ({ x, y: 22 });
      if (Renderer === UltraTyphoonRenderer) renderer._drawTacticalStormRadii(ctx, state);
      else renderer._drawRadii(ctx, state);
    }
    renderer.scenario = { timeline: [{ ...state, offsetLabel: '+120h' }] };
    if (Renderer === UltraTyphoonRenderer) renderer._drawTrackAndVortexEye(ctx, state);
    else renderer._drawTrack(ctx);
    assert.equal(labels.length, 5);
    for (const label of labels) {
      const left = label.align === 'right' ? label.x - label.width : label.x;
      assert.ok(left >= 8, `${label.text} must not be clipped on the left`);
      assert.ok(left + label.width <= 312, `${label.text} must not be clipped on the right`);
      assert.ok(label.y >= 13 && label.y <= 487, `${label.text} must not be clipped vertically`);
    }
  });
}
