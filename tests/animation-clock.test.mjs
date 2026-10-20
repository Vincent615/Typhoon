import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameBudget, initializeAnimation, observeAnimation, requestFrame, runAnimationFrame } from '../src/animation-clock.js';

test('a forced final update bypasses the frame budget and resets its next interval', () => {
  const budget = new FrameBudget(8);
  assert.equal(budget.take(0), 0);
  assert.equal(budget.take(20), null);
  assert.equal(budget.take(30, true), 0.03);
  assert.equal(budget.take(125), null);
  assert.equal(budget.take(155), 0.125);
  budget.reset();
  assert.equal(budget.take(1000), 0);
});

test('only one animation frame is requested, and hidden tabs request none', () => {
  const previous = { document: globalThis.document, raf: globalThis.requestAnimationFrame };
  let requested = 0;
  let callback;
  globalThis.document = { hidden: false };
  globalThis.requestAnimationFrame = (fn) => { callback = fn; return ++requested; };
  try {
    const app = { loop: () => {} };
    initializeAnimation(app);
    app.animationStarted = true;
    requestFrame(app);
    requestFrame(app);
    assert.equal(requested, 1);
    callback(100);
    assert.equal(app.frameRequest, null);
    globalThis.document.hidden = true;
    requestFrame(app);
    assert.equal(requested, 1);
  } finally {
    globalThis.document = previous.document;
    globalThis.requestAnimationFrame = previous.raf;
  }
});

test('visibility changes cancel scheduled work and preserve the user playback state', () => {
  const previous = {
    document: globalThis.document, raf: globalThis.requestAnimationFrame,
    cancel: globalThis.cancelAnimationFrame, observer: globalThis.IntersectionObserver
  };
  const listeners = new Map();
  let cancelled = 0;
  let requested = 0;
  globalThis.document = { hidden: false, addEventListener: (name, handler) => listeners.set(name, handler) };
  globalThis.requestAnimationFrame = () => ++requested;
  globalThis.cancelAnimationFrame = () => cancelled++;
  globalThis.IntersectionObserver = undefined;
  try {
    const app = { playing: true, lastTs: 120, holdUntil: 0 };
    initializeAnimation(app);
    app.animationStarted = true;
    observeAnimation(app);
    requestFrame(app);
    globalThis.document.hidden = true;
    listeners.get('visibilitychange')();
    assert.equal(cancelled, 1);
    assert.equal(app.frameRequest, null);
    assert.equal(app.lastTs, null);
    assert.equal(app.playing, true);
    globalThis.document.hidden = false;
    listeners.get('visibilitychange')();
    assert.equal(requested, 2);
    assert.equal(app.playing, true);
    assert.equal(app.positionDirty, true);
  } finally {
    globalThis.document = previous.document;
    globalThis.requestAnimationFrame = previous.raf;
    globalThis.cancelAnimationFrame = previous.cancel;
    globalThis.IntersectionObserver = previous.observer;
  }
});

test('a visible static brief does not keep live statistics running; detail and ranking cards still do', () => {
  const previous = { document: globalThis.document, observer: globalThis.IntersectionObserver };
  const nodes = new Map(['typhoon-canvas', 'storm-map', 'county-weather', 'ranking', 'aside', 'brief', 'timeline-slider']
    .map((id) => [id, { id, style: { setProperty() {} } }]));
  const observed = [];
  let notify;
  globalThis.IntersectionObserver = class {
    constructor(callback) { notify = callback; }
    observe(element) { observed.push(element); }
  };
  globalThis.document = {
    hidden: false,
    getElementById: (id) => nodes.get(id),
    querySelector: (selector) => selector === '.matrix-card, .list-card' ? nodes.get('ranking') : nodes.get('aside'),
    addEventListener() {}
  };
  try {
    let synchronized = 0;
    let canvasWork = 0;
    let stateUpdates = 0;
    const app = {
      playing: true, lastTs: 0, lastSyncStep: 0, lastMetaCheck: 0,
      holdUntil: 0, floatStep: 0, targetStep: null, targetProb: 0,
      scenario: { timeline: [{}, {}] },
      map: { setFloatStep() { stateUpdates++; }, render() { canvasWork++; } },
      sync() { synchronized++; }, renderGauge() {}
    };
    initializeAnimation(app);
    observeAnimation(app);
    assert.deepEqual(observed.map((element) => element.id).sort(),
      ['county-weather', 'ranking', 'storm-map', 'typhoon-canvas']);
    assert.ok(!observed.includes(nodes.get('aside')), 'the static brief must not extend the live viewport');
    notify(observed.map((target) => ({ target, isIntersecting: false })));
    const frame = (ts) => runAnimationFrame(app, ts, { rate: 0.34, easing: 6, startHold: 450, endHold: 1400 });
    frame(1000);
    assert.equal(app.dashboardVisible, false);
    assert.equal(stateUpdates, 0);
    assert.equal(synchronized, 0);
    assert.equal(canvasWork, 0);
    assert.ok(app.floatStep > 0, 'autoplay time still advances while reading the brief or news');

    notify([{ target: nodes.get('county-weather'), isIntersecting: true }]);
    frame(1250);
    assert.equal(app.dashboardVisible, true);
    assert.equal(synchronized, 1);
    assert.equal(canvasWork, 0);
    notify([
      { target: nodes.get('county-weather'), isIntersecting: false },
      { target: nodes.get('ranking'), isIntersecting: true }
    ]);
    frame(1500);
    assert.equal(app.dashboardVisible, true);
    assert.equal(synchronized, 2);
    notify([{ target: nodes.get('ranking'), isIntersecting: false }]);
    frame(1750);
    assert.equal(synchronized, 2);
    assert.equal(canvasWork, 0);
  } finally {
    globalThis.document = previous.document;
    globalThis.IntersectionObserver = previous.observer;
  }
});
