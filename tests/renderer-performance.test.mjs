import test from 'node:test';
import assert from 'node:assert/strict';
import { TyphoonMapRenderer } from '../src/map-renderer.js';
import { UltraTyphoonRenderer } from '../src/ultra-renderer.js';
import { MAX_CANVAS_PIXELS, canvasPixelRatio, streamlineCount,
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

function environment(width = 390, height = 500, ratio = 3) {
  const rect = { width, height };
  const canvas = () => ({
    style: {}, listeners: new Map(), ctx: context(),
    parentElement: { getBoundingClientRect: () => rect },
    getContext() { return this.ctx; },
    getBoundingClientRect: () => ({ left: 0, top: 0, ...rect }),
    addEventListener(name, callback) { this.listeners.set(name, callback); }
  });
  globalThis.window = { devicePixelRatio: ratio };
  globalThis.document = { createElement: canvas };
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.Path2D = class {
    moveTo() {}
    lineTo() {}
    closePath() {}
  };
  return { canvas: canvas(), rect };
}

test('canvas buffers cap high-DPR phones, desktops and very large displays', () => {
  assert.equal(canvasPixelRatio(390, 600, 3), 1.5);
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
}
