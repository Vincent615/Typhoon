import test from 'node:test';
import assert from 'node:assert/strict';
import { canResumeTracking, startStandbyRefresh } from '../src/standby.js';
import { isStandbyDataset, sourcePresentation } from '../src/ui-state.js';

const NOW = Date.parse('2026-10-24T08:00:00Z');
const iso = (n) => new Date(n).toISOString();
const standby = () => ({
  updatedAt: iso(NOW - 3600000), monitoring: { mode: 'standby', standbySince: iso(NOW - 3600000), discoveryIntervalHours: 3 },
  officialSync: { cwaStatus: 'no_active' }, scenarios: [{ id: 'no_active_typhoon', hasTyphoon: false }]
});
const active = () => ({
  updatedAt: iso(NOW), monitoring: { mode: 'active' },
  officialSync: { cwaStatus: 'active', liveCycloneDetected: true, observedAt: iso(NOW - 60000) },
  defaultScenarioId: 'new_storm', scenarios: [{ id: 'new_storm', hasTyphoon: true,
    timeline: [{ counties: Array.from({ length: 22 }, (_, index) => ({ id: String(index) })) }] }]
});

class Target {
  constructor() { this.listeners = new Map(); this.hidden = false; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  removeEventListener(name, callback) { if (this.listeners.get(name) === callback) this.listeners.delete(name); }
  emit(name) { this.listeners.get(name)?.(); }
}
function clock() {
  let next = 0;
  const intervals = new Map(), timeouts = new Map();
  return {
    intervals, timeouts,
    setIntervalImpl: (callback, delay) => { const id = ++next; intervals.set(id, { callback, delay }); return id; },
    clearIntervalImpl: (id) => intervals.delete(id),
    setTimeoutImpl: (callback, delay) => { const id = ++next; timeouts.set(id, { callback, delay }); return id; },
    clearTimeoutImpl: (id) => timeouts.delete(id),
    fire: () => Promise.all([...intervals.values()].map((item) => item.callback())),
    timeout: () => { for (const [id, item] of [...timeouts]) { timeouts.delete(id); item.callback(); } }
  };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function setup(fetchImpl, { hidden = false } = {}) {
  const doc = new Target(), win = new Target(), timers = clock();
  doc.hidden = hidden;
  let reloads = 0;
  const stop = startStandbyRefresh(standby(), {
    documentImpl: doc, windowImpl: win, fetchImpl, now: () => NOW,
    reload: () => { reloads++; }, ...timers
  });
  return { doc, win, timers, stop, reloads: () => reloads };
}

test('standby requires explicit monitoring mode and a consistently inactive source', () => {
  const data = standby();
  assert.equal(isStandbyDataset(data), true);
  assert.equal(isStandbyDataset({ ...data, monitoring: undefined }), false);
  assert.equal(isStandbyDataset({ ...data, officialSync: { cwaStatus: 'active' } }), false);
  assert.equal(isStandbyDataset({ ...data, scenarios: [...data.scenarios, { hasTyphoon: true }] }), false);
  assert.equal(isStandbyDataset({ ...data, monitoring: { ...data.monitoring, standbySince: 'invalid' } }), false);
  assert.equal(isStandbyDataset({ ...data, updatedAt: 'invalid' }), false);
  const presentation = sourcePresentation(data, data.scenarios[0], NOW + 30 * 86400000);
  assert.equal(presentation.live, false);
  assert.equal(presentation.stale, false);
  assert.match(presentation.text, /待命開始.*等待下一個颱風/);
  assert.doesNotMatch(presentation.text, /目前無|資料過期|官方觀測/);
});

test('resuming requires a newer complete active publication rather than a malformed or stale response', () => {
  assert.equal(canResumeTracking(active(), standby().updatedAt, NOW), true);
  for (const payload of [null, standby(), { ...active(), monitoring: undefined },
    { ...active(), updatedAt: standby().updatedAt }, { ...active(), updatedAt: iso(NOW + 3600000) },
    { ...active(), defaultScenarioId: 'missing' }, { ...active(), scenarios: [] },
    { ...active(), scenarios: [null] }, { ...active(), scenarios: [{ id: 'new_storm', hasTyphoon: true, timeline: [null] }] },
    { ...active(), officialSync: { cwaStatus: 'active', liveCycloneDetected: true } }
  ]) assert.equal(canResumeTracking(payload, standby().updatedAt, NOW), false);
});

test('resuming rejects expired generation and observation times even when newer than an old standby page', () => {
  const previous = iso(NOW - 30 * 86400000);
  const tooOld = iso(NOW - 6 * 3600000 - 1);
  assert.equal(canResumeTracking({ ...active(), updatedAt: tooOld }, previous, NOW), false);
  assert.equal(canResumeTracking({ ...active(), officialSync: {
    ...active().officialSync, observedAt: tooOld
  } }, previous, NOW), false);
  const boundary = iso(NOW - 6 * 3600000);
  assert.equal(canResumeTracking({ ...active(), updatedAt: boundary, officialSync: {
    ...active().officialSync, observedAt: boundary
  } }, previous, NOW), true);
});

test('resuming applies the declared update interval and falls back to six hours for invalid intervals', () => {
  const previous = iso(NOW - 30 * 86400000);
  const sevenHours = iso(NOW - 7 * 3600000);
  const payload = { ...active(), updatedAt: sevenHours, officialSync: {
    ...active().officialSync, observedAt: sevenHours
  } };
  assert.equal(canResumeTracking({ ...payload, updateIntervalHours: 4 }, previous, NOW), true);
  assert.equal(canResumeTracking({ ...payload, updateIntervalHours: 3 }, previous, NOW), false);
  for (const interval of [undefined, 0, -1, 'invalid']) {
    assert.equal(canResumeTracking({ ...payload, updateIntervalHours: interval }, previous, NOW), false);
  }
  assert.equal(canResumeTracking({ ...active(), updateIntervalHours: 0.5, officialSync: {
    ...active().officialSync, observedAt: iso(NOW - 2 * 3600000)
  } }, previous, NOW), false);
});

test('standby polls only after five minutes and reloads once on a valid new active publication', async () => {
  let calls = 0;
  const s = setup(async (url, options) => {
    calls++;
    assert.match(url, /typhoon-data\.json\?t=/);
    assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => active() };
  });
  assert.equal(calls, 0);
  assert.deepEqual([...s.timers.intervals.values()].map((v) => v.delay), [300000]);
  await s.timers.fire();
  assert.equal(calls, 1);
  assert.equal(s.reloads(), 1);
  assert.equal(s.timers.intervals.size, 0);
  assert.equal(s.timers.timeouts.size, 0);
  assert.equal(s.doc.listeners.size, 0);
  assert.equal(s.win.listeners.size, 0);
  await s.timers.fire();
  assert.equal(s.reloads(), 1);
});

test('hidden pages make no requests and resuming visibility checks once', async () => {
  let calls = 0;
  const s = setup(async () => { calls++; return { ok: true, json: async () => standby() }; }, { hidden: true });
  assert.equal(s.timers.intervals.size, 0);
  await s.timers.fire();assert.equal(calls, 0);
  s.doc.hidden = false;s.doc.emit('visibilitychange');await flush();
  assert.equal(calls, 1);
  assert.equal(s.timers.intervals.size, 1);
  s.doc.hidden = true;s.doc.emit('visibilitychange');
  assert.equal(s.timers.intervals.size, 0);
  s.stop();
});

test('failed requests and invalid payloads retain standby and can retry later', async () => {
  const responses = [new Error('offline'), { ok: false }, { ok: true, json: async () => ({}) }, { ok: true, json: async () => active() }];
  const s = setup(async () => { const result = responses.shift(); if (result instanceof Error) throw result; return result; });
  for (let i = 0; i < 3; i++) { await s.timers.fire(); assert.equal(s.reloads(), 0); assert.equal(s.timers.timeouts.size, 0); }
  await s.timers.fire();assert.equal(s.reloads(), 1);
});

test('polling does not overlap; ten-second timeout aborts a stalled request and permits retry', async () => {
  let calls = 0, signal;
  const s = setup(async (_url, options) => {
    calls++;signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
  });
  const first = s.timers.fire();
  assert.equal(calls, 1);
  await s.timers.fire();assert.equal(calls, 1);
  assert.deepEqual([...s.timers.timeouts.values()].map((v) => v.delay), [10000]);
  s.timers.timeout();await first;
  assert.equal(signal.aborted, true);
  assert.equal(s.reloads(), 0);
  const second = s.timers.fire();assert.equal(calls, 2);
  s.stop();await second;
  assert.equal(signal.aborted, true);
  assert.equal(s.timers.intervals.size, 0);
  assert.equal(s.timers.timeouts.size, 0);
});

test('hide and cleanup discard in-flight results even when a fetch ignores cancellation', async () => {
  let resolve, signal;
  const s = setup((_url, options) => {
    signal = options.signal;
    return new Promise((done) => { resolve = done; });
  });
  const checking = s.timers.fire();
  s.doc.hidden = true;s.doc.emit('visibilitychange');
  assert.equal(signal.aborted, true);
  resolve({ ok: true, json: async () => active() });await checking;
  assert.equal(s.reloads(), 0);
  assert.equal(s.timers.timeouts.size, 0);
  s.stop();assert.equal(s.doc.listeners.size, 0);
});

test('back-forward cache suspension cancels work and restoration resumes checking', async () => {
  let calls = 0;
  const s = setup(async () => { calls++; return { ok: true, json: async () => standby() }; });
  s.win.emit('pagehide');assert.equal(s.timers.intervals.size, 0);
  s.doc.emit('visibilitychange');assert.equal(calls, 0);
  s.win.emit('pageshow');await flush();
  assert.equal(calls, 1);assert.equal(s.timers.intervals.size, 1);
  s.stop();
});
