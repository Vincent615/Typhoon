import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildTyphoonDataset, updateTyphoonDataset, parseCwaTyNewsJs, parseDgpaAnnouncements } from '../scripts/update_typhoon_data.mjs';
import { makeFetch, makeCwaFeed, EMPTY_CWA, FIXED_NOW } from './fixtures/pipeline-fixtures.mjs';

async function outputFor(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'typhoon-cycle-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return path.join(directory, 'forecast.json');
}

test('active to standby publishes once; repeated standby is CWA-only with identical bytes and mtime; a new storm resumes', async (t) => {
  const outputPath = await outputFor(t);
  const active = await updateTyphoonDataset({ outputPath, apiKey: '', now: () => FIXED_NOW, fetchImpl: makeFetch() });
  assert.equal(active.mode, 'active');
  assert.equal(active.changed, true);
  const requests = [];
  const standbyFetch = makeFetch({ cwa: EMPTY_CWA, onRequest: (url) => requests.push(url) });
  const standby = await updateTyphoonDataset({ outputPath, apiKey: 'test-only', now: () => '2026-06-08T06:00:00Z', fetchImpl: standbyFetch });
  assert.equal(standby.mode, 'standby');
  assert.equal(standby.changed, true);
  assert.deepEqual(standby.data.monitoring, { mode: 'standby', discoveryIntervalHours: 3, standbySince: '2026-06-08T06:00:00.000Z' });
  assert.equal(standby.data.officialSync.dgpaStatus, 'not_checked');
  assert.equal(standby.data.officialSync.dgpaChecked, false);
  assert.deepEqual(standby.data.officialSync.dgpaAnnouncements, []);
  assert.equal(standby.data.scenarios[0].hasTyphoon, false);
  assert.ok(standby.data.scenarios[0].timeline[0].counties.every((c) => c.probability === null && c.officialAnnouncement === null));
  assert.equal(requests.length, 1);
  assert.match(requests[0], /TY_NEWS-Data.js/);
  const before = await fs.readFile(outputPath);
  const stat = await fs.stat(outputPath);
  const again = await updateTyphoonDataset({ outputPath, apiKey: 'test-only', now: () => '2026-06-09T06:00:00Z', fetchImpl: standbyFetch });
  assert.equal(again.mode, 'standby');
  assert.equal(again.changed, false);
  assert.deepEqual(again.data, standby.data);
  assert.deepEqual(await fs.readFile(outputPath), before);
  assert.equal((await fs.stat(outputPath)).mtimeMs, stat.mtimeMs);
  assert.equal((await fs.stat(outputPath)).ino, stat.ino);
  assert.equal(requests.length, 2);

  const resumeRequests = [];
  const resumed = await updateTyphoonDataset({ outputPath, apiKey: '', now: () => '2026-06-09T09:00:00Z', fetchImpl: makeFetch({
    cwa: makeCwaFeed([{ key: 'BETA', chineseName: '乙颱', lat: 20, lon: 130 }]), onRequest: (url) => resumeRequests.push(url)
  }) });
  assert.equal(resumed.mode, 'active');
  assert.equal(resumed.changed, true);
  assert.equal(resumed.data.monitoring.standbySince, undefined);
  assert.equal(resumed.data.scenarios[0].id, 'live_beta');
  assert.equal(resumed.data.scenarios[0].hasTyphoon, true);
  assert.ok(resumeRequests.some((url) => url.includes('dgpa.gov.tw')));
  assert.equal(resumeRequests.filter((url) => url.includes('TY_NEWS-Data.js')).length, 1);
});

for (const mode of ['active', 'standby']) {
  test(`${mode}: failed discovery preserves the prior state and never pretends the round ended`, async (t) => {
    const outputPath = await outputFor(t);
    await updateTyphoonDataset({ outputPath, apiKey: '', now: () => FIXED_NOW,
      fetchImpl: makeFetch(mode === 'standby' ? { cwa: EMPTY_CWA } : {}) });
    const before = await fs.readFile(outputPath);
    const stat = await fs.stat(outputPath);
    for (const network of [{ cwaFailure: true }, { cwa: '<html>unavailable</html>' }, { cwa: makeCwaFeed().replace('近中心最大風速每秒 38', '近中心最大風速每秒 不明') }]) {
      const requests = [];
      await assert.rejects(updateTyphoonDataset({ outputPath, apiKey: '', fetchImpl: makeFetch({ ...network, onRequest: (url) => requests.push(url) }) }), /CWA/);
      assert.equal(requests.length, 1);
      assert.deepEqual(await fs.readFile(outputPath), before);
      assert.equal((await fs.stat(outputPath)).mtimeMs, stat.mtimeMs);
    }
  });
}

test('an old calm dataset without a standby contract is migrated once instead of silently retained', async (t) => {
  const outputPath = await outputFor(t);
  const old = await buildTyphoonDataset({ apiKey: '', now: () => FIXED_NOW, fetchImpl: makeFetch({ cwa: EMPTY_CWA }) });
  delete old.monitoring;
  await fs.writeFile(outputPath, JSON.stringify(old, null, 2) + '\n');
  const next = await updateTyphoonDataset({ outputPath, apiKey: '', now: () => '2026-06-08T06:00:00Z', fetchImpl: makeFetch({ cwa: EMPTY_CWA }) });
  assert.equal(next.changed, true);
  assert.equal(next.mode, 'standby');
  assert.equal(next.data.monitoring.standbySince, '2026-06-08T06:00:00.000Z');
});

test('current CHAMPI and IN-FA source accepts only the documented below-force-10 radius placeholder', async () => {
  const raw = await fs.readFile(new URL('./fixtures/cwa-official-20261024-infa.js', import.meta.url), 'utf8');
  const data = await buildTyphoonDataset({ apiKey: '', now: () => '2026-10-24T08:00:00Z', fetchImpl: makeFetch({ cwa: raw }) });
  assert.equal(data.monitoring.mode, 'active');
  assert.deepEqual(data.scenarios.map((s) => s.id), ['live_champi', 'live_in-fa']);
  assert.equal(data.scenarios[1].timeline[0].maxWindMs, 20);
  assert.equal(data.scenarios[1].timeline[0].radius10km, 0);
  assert.equal(data.scenarios[1].timeline[0].radius7km, 80);
  assert.ok(data.scenarios[1].timeline.at(-1).radius10km > 0);
  assert.throws(() => parseCwaTyNewsJs(raw.replaceAll('十級風平均暴風半徑 - 公里', '十級風平均暴風半徑 不明 公里')), /radius10/);
  assert.throws(() => parseCwaTyNewsJs(raw.replaceAll('近中心最大風速每秒 20 公尺', '近中心最大風速每秒 25 公尺')), /IN-FA \+0h:.*radius10/);
});

test('meeting or not meeting a suspension criterion is not itself a suspension announcement', () => {
  const counties = [{ id: 'TPE', name: '臺北市' }, { id: 'KHH', name: '高雄市' }];
  const table = (text) => `<table id="Table"><tr><td>臺北市</td><td>${text}</td></tr><tr><td>高雄市</td><td>今天未達停止上班及上課標準。</td></tr></table>`;
  for (const phrase of ['今天已達停止上班及上課標準。', '今天未達停止上班及上課標準。']) {
    const parsed = parseDgpaAnnouncements(table(phrase), counties);
    assert.equal(parsed.status, 'unknown');
    assert.ok(parsed.announcements.every((a) => a.status === 'unknown'));
  }
  const explicit = parseDgpaAnnouncements(table('今天已達停止上班及上課標準。明天停止上班、停止上課。'), counties);
  assert.equal(explicit.status, 'announced');
  assert.equal(explicit.announcements[0].status, 'suspended');
  assert.equal(explicit.announcements[1].status, 'unknown');
});
