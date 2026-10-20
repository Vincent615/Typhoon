import test from 'node:test';
import assert from 'node:assert/strict';
import { App, statusOf as standardStatus } from '../src/app.js';
import { UltraApp, statusOf as ultraStatus } from '../src/ultra-app.js';
import { TyphoonMapRenderer, getProbabilityColor } from '../src/map-renderer.js';
import { UltraTyphoonRenderer, getUltraProbColor } from '../src/ultra-renderer.js';
import { sourcePresentation, ownsKeyboardInput } from '../src/ui-state.js';

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.style = { setProperty(key, value) { this[key] = value; } };
    this.classes = new Set();
    this.classList = { toggle: (name, on = !this.classes.has(name)) => {
      if (on) this.classes.add(name);
      else this.classes.delete(name);
      return on;
    } };
    this.parts = new Map();
    this.textContent = '';
  }
  set innerHTML(value) { this.html = value; this.children = []; this.parts.clear(); }
  get innerHTML() { return this.html; }
  appendChild(child) {
    if (child.parent) child.parent.children = child.parent.children.filter((node) => node !== child);
    child.parent = this;
    this.children.push(child);
  }
  querySelector(selector) {
    if (!this.parts.has(selector)) this.parts.set(selector, new Element(selector));
    return this.parts.get(selector);
  }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  setAttribute(name, value) { this[name] = value; }
  getBoundingClientRect() { return { top: (this.parent?.children.indexOf(this) ?? 0) * 20 }; }
  scrollIntoView() {}
  closest(selector) {
    return selector.split(',').map((item) => item.trim()).includes(this.tagName) ? this : null;
  }
}

function documentStub() {
  const nodes = new Map();
  const doc = new Element();
  doc.getElementById = (id) => {
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id);
  };
  doc.createElement = (tag) => new Element(tag);
  doc.querySelector = (selector) => doc.getElementById(selector);
  doc.querySelectorAll = (selector) => selector === '#timeline-ticks .tick'
    ? doc.getElementById('timeline-ticks').children : [];
  return doc;
}

function county(id, probability, rain = 17) {
  return {
    id, name: id, region: '北部', commuterZone: '北北基桃', lat: 25, lon: 121,
    probability, distanceKm: probability === null ? null : 120,
    wind: { avgBeaufort: probability === null ? null : 3, gustBeaufort: probability === null ? null : 6 },
    rain: {
      flatland24h: probability === null ? null : rain,
      mountain24h: probability === null ? null : rain,
      flatlandThreshold: 350, mountainThreshold: 200
    }
  };
}

function step(counties, radius10km = 80) {
  return {
    lat: 20, lon: 125, pressureHpa: 960, maxWindMs: 35, maxGustMs: 45,
    radius7km: 200, radius10km, probRadius70km: 0, moveSpeedKmh: 10,
    moveDir: 'N', offsetLabel: '+24h', timeDisplay: '10月20日 20:00', counties
  };
}

function scenario(id = 'first', unknown = false) {
  return {
    id, name: id, hasTyphoon: !unknown, isLiveOfficial: !unknown, defaultStepIndex: 0,
    observedAt: new Date().toISOString(), summary: `${id}摘要`,
    aiMetadata: { executiveBrief: `${id}專屬摘要` },
    timeline: unknown
      ? [{ ...step([county('KEE', null), county('ILA', null)], 0), lat: null, lon: null,
        pressureHpa: null, maxWindMs: null, maxGustMs: null, radius7km: 0, moveSpeedKmh: null }]
      : [step([county('KEE', 95, 350), county('ILA', 10, 0)]),
        step([county('KEE', 25, 17), county('ILA', 75, 300)], null)]
  };
}

function rendererStub(Renderer) {
  const renderer = Object.create(Renderer.prototype);
  renderer._updateBounds = () => {};
  renderer._initStreamlines = () => {};
  renderer.render = () => {};
  renderer.layers = {};
  return renderer;
}

function setup(AppClass, Renderer) {
  const doc = documentStub();
  globalThis.document = doc;
  globalThis.requestAnimationFrame = () => {};
  const app = new AppClass();
  app.data = {
    updatedAt: new Date().toISOString(), updateIntervalHours: 3,
    aiMetadata: { executiveBrief: '錯誤的共用摘要' },
    scenarios: [scenario(), scenario('second'), scenario('calm', true)]
  };
  app.map = rendererStub(Renderer);
  app.selectedId = 'KEE';
  app.renderMeta();
  app.bindControls();
  app.selectScenario('first');
  app.lastTs = 0;
  return { app, doc, node: (id) => doc.getElementById(id) };
}

for (const [name, AppClass, Renderer] of [
  ['standard', App, TyphoonMapRenderer], ['ultra', UltraApp, UltraTyphoonRenderer]
]) {
  test(`${name}: reaching a target synchronizes exact final values and ranking`, () => {
    const { app, node } = setup(AppClass, Renderer);
    app.floatStep = 0.96;
    app.syncPosition();
    app.targetStep = 1;
    for (let frame = 1; frame <= 80; frame++) app.loop(frame * 50);
    assert.equal(app.floatStep, 1);
    assert.equal(app.targetStep, null);
    assert.equal(node('d-prob').textContent, '25');
    assert.equal(node('m-rain').textContent, '17 mm');
    assert.equal(node('county-list').children[0], app.rows.get('ILA').el);
    assert.equal(parseInt(app.rows.get('KEE').pct.textContent), 25);
  });

  test(`${name}: slider and pause settle on exact values even within the old rounding bucket`, () => {
    const { app, node } = setup(AppClass, Renderer);
    app.setPlaying(true);
    const slider = node('timeline-slider');
    slider.value = '0.951';
    slider.listeners.get('input')({ target: slider });
    assert.equal(app.floatStep, 0.951, 'pausing must not overwrite the new slider input');
    assert.equal(app.playing, false);
    assert.equal(node('d-prob').textContent, String(app.map.getInterpolatedState().counties[0].probability));
    slider.value = '1';
    slider.listeners.get('input')({ target: slider });
    assert.equal(node('d-prob').textContent, '25');
    assert.equal(node('m-rain').textContent, '17 mm');
    assert.equal(node('county-list').children[0], app.rows.get('ILA').el);
  });

  test(`${name}: playback endpoint and mid-step rank changes match rendered county values`, () => {
    const { app, node } = setup(AppClass, Renderer);
    app.floatStep = 0.6;
    app.syncPosition();
    assert.equal(node('county-list').children[0], app.rows.get('KEE').el);
    app.floatStep = 0.8;
    app.syncPosition();
    assert.equal(node('county-list').children[0], app.rows.get('ILA').el);
    app.setPlaying(true);
    app.floatStep = 0.999;
    app.loop(50);
    assert.equal(app.floatStep, 1);
    assert.equal(node('d-prob').textContent, '25');
    app.setPlaying(false);
    assert.equal(node('m-rain').textContent, '17 mm');
  });

  test(`${name}: focused controls retain their native keyboard actions`, () => {
    const { app, doc } = setup(AppClass, Renderer);
    const keydown = doc.listeners.get('keydown');
    for (const target of [new Element('button'), new Element('a[href]'),
      new Element('summary'), new Element('input'), { isContentEditable: true }]) {
      let prevented = false;
      keydown({ key: ' ', target, preventDefault() { prevented = true; } });
      assert.equal(app.playing, false);
      assert.equal(prevented, false);
    }
    let prevented = false;
    keydown({ key: ' ', target: new Element('div'), preventDefault() { prevented = true; } });
    assert.equal(app.playing, true);
    assert.equal(prevented, true);
  });

  test(`${name}: switching scenarios clears hit data, refreshes its brief and supports a single unknown step`, () => {
    const { app, node } = setup(AppClass, Renderer);
    app.map.trackHit = [{ index: 99 }];
    app.map.hoveredTrackIdx = 99;
    app.map.hoveredCountyId = 'KEE';
    app.map.mouse = { x: 0, y: 0 };
    app.selectScenario('second');
    assert.equal(node('brief-text').textContent, 'second專屬摘要');
    app.selectScenario('calm');
    assert.equal(node('brief-text').textContent, 'calm專屬摘要');
    assert.deepEqual(app.map.trackHit, []);
    assert.equal(app.map.hoveredTrackIdx, -1);
    assert.equal(app.map.mouse, null);
    assert.equal(app.map.getInterpolatedState().counties[0].probability, null);
    assert.equal(app.map.getInterpolatedState().pressureHpa, null);
    assert.equal(node('d-prob').textContent, '—');
    assert.equal(node('m-wind').textContent, '—');
    assert.equal(node('m-rain').textContent, '—');
    assert.equal(node('d-status').textContent, '無颱風機率估算');
    assert.equal(node('btn-play').disabled, true);
    app.setPlaying(true);
    app.goToStep(99);
    app.loop(50);
    assert.equal(app.playing, false);
    assert.equal(app.floatStep, 0);
    assert.equal(app.map.floatStep, 0);
  });

  test(`${name}: renderer keeps missing radii unknown and matches counties by ID`, () => {
    const renderer = rendererStub(Renderer);
    const sc = scenario();
    sc.timeline[1].counties.reverse();
    renderer.setScenario(sc);
    renderer.setFloatStep(0.5);
    const mid = renderer.getInterpolatedState();
    assert.equal(mid.radius10km, null);
    assert.equal(mid.counties.find((c) => c.id === 'KEE').probability, 60);
    renderer.setFloatStep(1);
    assert.equal(renderer.getInterpolatedState().radius10km, null);
    sc.timeline[1].radius10km = 0;
    assert.equal(renderer.getInterpolatedState().radius10km, 0);
  });

  test(`${name}: a one-point typhoon track draws without relying on another forecast point`, () => {
    const renderer = rendererStub(Renderer);
    const sc = scenario();
    sc.timeline = sc.timeline.slice(0, 1);
    renderer.setScenario(sc, 99);
    renderer.latLonToXY = () => ({ x: 100, y: 100 });
    renderer.time = 0;
    const ctx = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
    const draw = name === 'standard' ? '_drawTrack' : '_drawTrackAndVortexEye';
    renderer[draw](ctx, renderer.getInterpolatedState());
    assert.equal(renderer.floatStep, 0);
    assert.equal(renderer.trackHit.length, 1);
    assert.equal(renderer.trackHit[0].index, 0);
  });
}

test('freshness checks observation age separately from generation time', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  const data = { updatedAt: '2026-10-20T11:59:00Z', updateIntervalHours: 3 };
  const sc = { isLiveOfficial: true, observedAt: '2026-10-20T03:00:00Z' };
  const stale = sourcePresentation(data, sc, now);
  assert.equal(stale.live, false);
  assert.match(stale.text, /資料產生/);
  assert.match(stale.text, /官方觀測/);
  assert.match(stale.text, /資料過期/);
  sc.observedAt = '2026-10-20T11:00:00Z';
  assert.equal(sourcePresentation(data, sc, now).live, true);
  data.updatedAt = '2026-10-19T11:00:00Z';
  assert.equal(sourcePresentation(data, sc, now).live, false);
});

test('unknown probability uses a neutral color and never claims an official work decision', () => {
  for (const color of [getProbabilityColor, getUltraProbColor]) {
    assert.notEqual(color(null), color(0));
  }
  for (const status of [standardStatus, ultraStatus]) {
    assert.equal(status(null), '無颱風機率估算');
    assert.equal(status(0), '停班停課機率較低');
  }
  assert.equal(ownsKeyboardInput({ ctrlKey: true }), true);
  assert.equal(ownsKeyboardInput({ defaultPrevented: true }), true);
});

test('future source timestamps cannot remain live beyond five minutes of clock skew', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  const data = { updatedAt: '2026-10-20T12:00:00Z', updateIntervalHours: 3 };
  const sc = { isLiveOfficial: true, observedAt: '2026-10-20T12:05:00Z' };
  assert.equal(sourcePresentation(data, sc, now).live, true);
  sc.observedAt = '2026-10-20T12:05:01Z';
  assert.equal(sourcePresentation(data, sc, now).live, false);
  sc.observedAt = '2026-10-20T12:00:00Z';
  data.updatedAt = '2026-10-21T12:00:00Z';
  assert.equal(sourcePresentation(data, sc, now).live, false);
});

test('confirmed no-active feed needs a fresh check, not a fabricated storm observation time', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  const data = {
    updatedAt: '2026-10-20T11:59:00Z', updateIntervalHours: 3,
    officialSync: { cwaStatus: 'no_active', observedAt: null }
  };
  const sc = { hasTyphoon: false, isLiveOfficial: false, observedAt: null };
  const fresh = sourcePresentation(data, sc, now);
  assert.equal(fresh.stale, false);
  assert.equal(fresh.live, false);
  assert.match(fresh.text, /官方來源確認無活躍颱風/);
  assert.doesNotMatch(fresh.text, /官方觀測|過期/);
  data.updatedAt = '2026-10-20T03:00:00Z';
  assert.equal(sourcePresentation(data, sc, now).stale, true);
});

test('Ultra radar coordinate text alignment is scoped to the radar drawing pass', () => {
  const renderer = rendererStub(UltraTyphoonRenderer);
  renderer.width = 500;
  renderer.height = 500;
  renderer.pxPerDeg = 100;
  renderer.pxPerKm = 1;
  renderer.time = 0;
  renderer.xyToLatLon = (x) => x === 0 ? { lat: 26, lon: 120 } : { lat: 20, lon: 125 };
  renderer.latLonToXY = () => ({ x: 100, y: 100 });
  const stack = [];
  const state = {
    textAlign: 'center',
    save() { stack.push(this.textAlign); },
    restore() { this.textAlign = stack.pop(); },
    createLinearGradient() { return { addColorStop() {} }; }
  };
  const ctx = new Proxy(state, { get: (target, key) => target[key] ?? (() => {}) });
  renderer._drawTacticalRadarGrid(ctx);
  assert.equal(ctx.textAlign, 'center');
  assert.equal(stack.length, 0);
});
