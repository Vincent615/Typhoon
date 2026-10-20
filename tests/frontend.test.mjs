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
  toggleAttribute(name, force) {
    if (force) this[name] = '';
    else delete this[name];
  }
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

test('ultra: playback repeats across multiple cycles and respects a manual pause', () => {
  const { app, node } = setup(UltraApp, UltraTyphoonRenderer);
  app.setPlaying(true);
  let wraps = 0;
  let previous = app.floatStep;
  for (let frame = 1; frame <= 300; frame++) {
    app.loop(frame * 50);
    if (app.floatStep < previous) wraps++;
    previous = app.floatStep;
  }
  assert.ok(wraps >= 2, 'playback should repeat without another play action');
  assert.equal(app.playing, true);
  assert.equal(node('btn-play')['aria-label'], '暫停時間軸');
  assert.equal(node('play-label').textContent, '暫停');
  assert.ok(Object.hasOwn(node('icon-play'), 'hidden'));
  assert.equal(Object.hasOwn(node('icon-pause'), 'hidden'), false);
  app.setPlaying(false);
  const paused = app.floatStep;
  for (let frame = 301; frame <= 350; frame++) app.loop(frame * 50);
  assert.equal(app.floatStep, paused);
  assert.equal(node('btn-play')['aria-label'], '播放時間軸');
  assert.equal(node('play-label').textContent, '播放');
  assert.equal(Object.hasOwn(node('icon-play'), 'hidden'), false);
  assert.ok(Object.hasOwn(node('icon-pause'), 'hidden'));
});

for (const [name, AppClass, Renderer] of [
  ['standard', App, TyphoonMapRenderer], ['ultra', UltraApp, UltraTyphoonRenderer]
]) {
  test(`${name}: high-refresh displays cap map work at 30 fps and statistics at 8 Hz without slowing playback`, () => {
    for (const refreshRate of [60, 120, 144]) {
      const { app } = setup(AppClass, Renderer);
      let rendered = 0;
      let synchronized = 0;
      app.map.render = () => { rendered++; app.map.needsRender = false; };
      const originalSync = app.sync.bind(app);
      app.sync = (...args) => { synchronized++; originalSync(...args); };
      app.setPlaying(true);
      for (let frame = 1; frame <= refreshRate; frame++) app.loop(frame * 1000 / refreshRate);
      assert.ok(rendered >= 25 && rendered <= 31, `${refreshRate} Hz display rendered ${rendered} frames`);
      assert.ok(synchronized <= 9, `statistics synchronized ${synchronized} times`);
      const expectedStep = name === 'standard' ? 0.32 : 0.34;
      assert.ok(Math.abs(app.floatStep - expectedStep) < 1e-9, 'playback must follow elapsed seconds');
    }
  });

  test(`${name}: pausing stops repeated canvas and DOM work but invalidation still paints immediately`, () => {
    const { app } = setup(AppClass, Renderer);
    const paintedDeltas = [];
    let synchronized = 0;
    app.map.needsRender = true;
    app.map.render = (dt) => { paintedDeltas.push(dt); app.map.needsRender = false; };
    app.sync = () => synchronized++;
    app.loop(16);
    for (let frame = 2; frame <= 120; frame++) app.loop(frame * 16);
    assert.deepEqual(paintedDeltas, [0]);
    assert.equal(synchronized, 0);
    app.map.needsRender = true; // Hover, resize and layer controls invalidate the renderer.
    app.loop(1921);
    assert.deepEqual(paintedDeltas, [0, 0]);
  });

  test(`${name}: reading news does no interpolation or DOM work, while the timeline continues`, () => {
    const { app } = setup(AppClass, Renderer);
    app.mapVisible = false;
    app.dashboardVisible = false;
    app.setPlaying(true);
    let interpolations = 0;
    let rendered = 0;
    app.map.getInterpolatedState = () => { interpolations++; return null; };
    app.map.render = () => rendered++;
    for (let second = 1; second <= 3; second++) app.loop(second * 1000);
    assert.equal(interpolations, 0);
    assert.equal(rendered, 0);
    assert.ok(app.floatStep > 0);
  });

  test(`${name}: hidden tabs freeze work and resume without catching up the hidden interval`, () => {
    const { app, doc } = setup(AppClass, Renderer);
    app.setPlaying(true);
    app.loop(100);
    const before = app.floatStep;
    let rendered = 0;
    app.map.render = () => rendered++;
    doc.hidden = true;
    app.loop(10000);
    assert.equal(app.floatStep, before);
    assert.equal(rendered, 0);
    doc.hidden = false;
    app.loop(60100);
    assert.equal(app.floatStep, before);
    app.loop(60150);
    assert.ok(app.floatStep > before && app.floatStep < before + 0.02);
    assert.equal(app.playing, true);
    app.setPlaying(false);
    doc.hidden = true;
    app.loop(70000);
    doc.hidden = false;
    app.loop(90000);
    assert.equal(app.playing, false);
  });

  test(`${name}: repeated identical values do not rewrite statistics or county row text`, () => {
    const { app, node } = setup(AppClass, Renderer);
    let writes = 0;
    for (const [element, property] of [
      [node('s-pressure'), 'innerHTML'],
      [node('d-prob'), 'textContent'],
      [app.rows.get('KEE').pct, 'textContent']
    ]) {
      const value = element[property];
      Object.defineProperty(element, property, { get: () => value, set: () => writes++ });
    }
    app.syncPosition(true);
    app.syncPosition(true);
    assert.equal(writes, 0);
  });

  test(`${name}: map county selection updates the detail without scrolling the page`, () => {
    const { app, node } = setup(AppClass, Renderer);
    let scrolls = 0;
    app.rows.get('ILA').el.scrollIntoView = () => scrolls++;
    node('map-county-select').listeners.get('change')({ target: { value: 'ILA' } });
    assert.equal(app.selectedId, 'ILA');
    assert.equal(node('county-select').value, 'ILA');
    assert.equal(node('map-county-select').value, 'ILA');
    assert.equal(node('d-name').textContent, 'ILA');
    assert.equal(scrolls, 0);
  });

  test(`${name}: all forecast times remain selectable and expose their dates`, () => {
    const { app, node } = setup(AppClass, Renderer);
    const ticks = node('timeline-ticks').children;
    assert.equal(ticks.length, app.scenario.timeline.length);
    assert.match(ticks.at(-1)['aria-label'], /10\/20 20:00/);
    ticks.at(-1).listeners.get('click')();
    for (let frame = 1; frame <= 80; frame++) app.loop(frame * 50);
    assert.equal(app.floatStep, app.scenario.timeline.length - 1);
    assert.equal(ticks.at(-1)['aria-pressed'], 'true');
    assert.match(node('timeline-slider')['aria-valuetext'], /10\/20 20:00/);
  });

  test(`${name}: offscreen canvas work stops while timeline playback still loops`, () => {
    const { app } = setup(AppClass, Renderer);
    let rendered = 0;
    app.map.render = () => rendered++;
    app.mapVisible = false;
    app.setPlaying(true);
    let wraps = 0;
    let previous = app.floatStep;
    for (let frame = 1; frame <= 300; frame++) {
      app.loop(frame * 50);
      if (app.floatStep < previous) wraps++;
      previous = app.floatStep;
    }
    assert.equal(rendered, 0);
    assert.ok(wraps >= 2);
    app.mapVisible = true;
    app.loop(15050);
    assert.equal(rendered, 1);
  });

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
