import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parseCwaTyNewsJs, buildTyphoonDataset, enrichWithGeminiAI } from '../scripts/update_typhoon_data.mjs';
import { makeFetch } from './fixtures/pipeline-fixtures.mjs';

// Exact public snapshot fetched 2026-10-23T04:07Z, source update 09:52 Taiwan.
const raw = await fs.readFile(new URL('./fixtures/cwa-official-20261023-td34.js', import.meta.url), 'utf8');
const build = (cwa = raw, extra = {}) => buildTyphoonDataset({
  fetchImpl: makeFetch({ cwa }), now: () => '2026-10-23T04:07:00.000Z', apiKey: '', ...extra
});
const modifyPanels = (edit) => raw.replace(/TY_LIST_2\['C'\] = [\s\S]*?(?=TY_LIST_1\['E'\])/, edit);
const tdStart = (panels) => panels.indexOf('    \'<div class="panel panel-default">\'', panels.indexOf('    \'<div class="panel panel-default">\'') + 1);
const modifyTd = (edit) => modifyPanels((panels) => panels.slice(0, tdStart(panels)) + edit(panels.slice(tdStart(panels))));
const namedOnly = modifyPanels((panels) => panels.slice(0, tdStart(panels)).trimEnd().replace(/\+$/, ';\n'))
  .replace(",\n\t'TD34':{'Name':{'C':'TD34','E':'TD34'}}", '');
const tdOnly = modifyPanels((panels) => "TY_LIST_2['C'] = ''+\n" + panels.slice(tdStart(panels)))
  .replace("\t'CHAMPI':{'Name':{'C':'薔琵','E':'CHAMPI'}},\n", '');

test('actual CHAMPI + TD34 feed preserves independent identities, tropical development and transition', async () => {
  const payload = await build();
  assert.equal(payload.officialSync.cwaStatus, 'active');
  assert.equal(payload.officialSync.observedAt, '2026-10-23T00:00:00.000Z');
  assert.equal(payload.defaultScenarioId, 'live_champi');
  const [named, td] = payload.scenarios;
  assert.equal(named.id, 'live_champi');
  assert.equal(td.id, 'live_td34');
  assert.equal(td.name, '熱帶性低氣壓 TD34');
  assert.equal(td.cycloneKind, 'tropical_depression');
  assert.equal(td.hasTyphoon, true); // Legacy active-cyclone rendering gate.
  assert.equal(td.isLiveOfficial, true);
  assert.doesNotMatch(td.summary + td.badge + td.typhoonNumber, /第 undefined|國際命名|\(TD34\)|null/);
  assert.deepEqual(named.timeline, (await build(namedOnly)).scenarios[0].timeline);
  assert.deepEqual(td.timeline, (await build(tdOnly)).scenarios[0].timeline);
  assert.deepEqual(named.timeline.map((p) => p.offsetHours), [0, 6, 12, 18, 24, 36, 48, 72]);
  assert.equal(named.forecastCoverage.termination.offsetHours, 96);
  assert.deepEqual(td.timeline.map((p) => p.offsetHours), [0, 6, 12, 18, 24, 36, 48, 72, 96]);
  assert.equal(td.forecastCoverage, undefined);
  assert.match(td.modelAvailabilityNote, /未知/);
  assert.equal(td.timeline[0].lat, 11);
  assert.equal(td.timeline[0].lon, 166.5);
  assert.equal(td.timeline[0].pressureHpa, 1004);
  assert.equal(td.timeline[0].maxWindMs, 15);
  assert.equal(td.timeline.at(-1).radius10km, 60);
});

test('TD missing radii stay unknown and do not create zero-risk estimates, stats or AI percentages', async () => {
  let geminiCalls = 0;
  const payload = await build(tdOnly);
  const td = payload.scenarios[0];
  assert.equal(payload.officialSync.liveCycloneDetected, true);
  assert.equal(payload.defaultScenarioId, 'live_td34');
  for (const point of td.timeline.slice(0, 4)) {
    assert.equal(point.radius7km, null);
    assert.equal(point.radius10km, null);
    assert.equal(point.modelAvailable, false);
    assert.deepEqual(point.stats, { highRiskCount: null, maxProb: null, islandAvgProb: null });
    assert.equal(point.counties.length, 22);
    for (const county of point.counties) {
      assert.equal(county.probability, null);
      assert.equal(county.riskLevel, 'unknown');
      assert.equal(county.wind.avgBeaufort, null);
      assert.equal(county.rain.flatland24h, null);
      assert.ok(Number.isFinite(county.distanceKm));
      assert.match(county.aiReasoning, /未提供七級風暴風半徑/);
    }
  }
  for (const point of td.timeline.slice(4)) {
    assert.ok(point.radius7km > 0);
    assert.ok(Number.isFinite(point.stats.maxProb));
    assert.ok(point.counties.every((county) => Number.isFinite(county.probability)));
  }
  const brief = await enrichWithGeminiAI(td, td.timeline[0], payload.officialSync, {
    apiKey: 'test', fetchImpl: makeFetch({ onRequest: () => { geminiCalls++; } })
  });
  assert.equal(geminiCalls, 0);
  assert.match(brief.executiveBrief, /不估算/);
  assert.doesNotMatch(brief.executiveBrief, /null|\d+%|無活躍颱風/);
});

test('TD source movement placeholders and qualitative movement never invent a speed', () => {
  const points = parseCwaTyNewsJs(raw).scenarios[1].timeline;
  assert.equal(points[0].moveDir, '—');
  for (const [index, text] of [[0, '未提供'], [1, '緩慢移動'], [3, '緩慢移動'], [4, '近似滯留'], [5, '緩慢移動']]) {
    assert.equal(points[index].moveSpeedKmh, null);
    assert.equal(points[index].moveSpeedText, text);
  }
  assert.equal(points[2].moveSpeedKmh, 8);
  assert.equal(points[6].moveSpeedKmh, 11);
});

const mutations = [
  ['unknown TD identity', () => modifyTd((p) => p.replace('>TD34</span>', '>TD35</span>'))],
  ['duplicate TD identity', () => modifyPanels((p) => p.replace('<span class="fa-red">中度颱風</span><span class="fa-blue">薔琵</span><br>編號第 29 號<br>國際命名 CHAMPI', '<span class="fa-red">熱帶性低氣壓</span><span class="fa-blue">TD34</span>'))],
  ['unrecognized class', () => modifyTd((p) => p.replace('熱帶性低氣壓', '其他低氣壓'))],
  ['contradictory numbered TD heading', () => modifyTd((p) => p.replace('>TD34</span>', '>TD34</span><br>編號第 34 號'))],
  ['contradictory internationally named TD heading', () => modifyTd((p) => p.replace('>TD34</span>', '>TD34</span><br>國際命名 CHAMPI'))],
  ['mismatched metadata name', () => raw.replace("'TD34':{'Name':{'C':'TD34','E':'TD34'}}", "'TD34':{'Name':{'C':'TD34','E':'WRONG'}}")],
  ['named storm missing international name', () => modifyPanels((p) => p.replace('國際命名 CHAMPI', ''))],
  ['named storm missing radius', () => modifyPanels((p) => p.replace('七級風平均暴風半徑 320 公里', ''))],
  ['TD malformed present radius', () => modifyTd((p) => p.replace('<li>中心氣壓 1004百帕', '<li>七級風暴風半徑 不明 公里</li><li>中心氣壓 1004百帕'))],
  ['TD high-wind forecast missing radius', () => modifyTd((p) => p.replace('<li>七級風暴風半徑 80 公里</li>', ''))],
  ['TD orphan ten-force radius', () => modifyTd((p) => p.replace('<li>中心氣壓 1004百帕', '<li>十級風暴風半徑 0 公里</li><li>中心氣壓 1004百帕'))],
  ['TD missing wind', () => modifyTd((p) => p.replace('近中心最大風速每秒 15 公尺', ''))],
  ['TD missing gust', () => modifyTd((p) => p.replace('瞬間最大陣風每秒 23 公尺', ''))],
  ['TD missing pressure', () => modifyTd((p) => p.replace('中心氣壓 1004百帕', ''))],
  ['TD mismatched time', () => modifyTd((p) => p.replace('2026年10月23日08時', '2026年10月23日09時'))],
  ['TD invalid coordinates', () => modifyTd((p) => p.replace('北緯 11.0 度', '北緯 111.0 度'))],
  ['TD missing observation marker', () => modifyTd((p) => p.replace('>現況</span>', '>缺值</span>'))],
  ['TD missing movement', () => modifyTd((p) => p.replace('過去移動時速 -公里', ''))],
  ['TD contradictory placeholder direction', () => modifyTd((p) => p.replace('過去移動方向 -', '過去移動方向 東'))],
  ['TD unrecognized qualitative movement', () => modifyTd((p) => p.replace('西南 緩慢移動', '西南 大概移動'))],
  ['TD invalid numeric movement', () => modifyTd((p) => p.replace('東南 時速 8 公里', '東南 時速 800 公里'))],
  ['TD malformed forecast heading', () => modifyTd((p) => p.replace('預測 6-12 小時', '預測 未知 小時'))],
  ['TD duplicate forecast offset', () => modifyTd((p) => p.replace('預測 6-12 小時', '預測 6 小時'))],
  ['TD missing probability radius', () => modifyTd((p) => p.replace('70%機率半徑 50 公里', ''))],
];
for (const [description, mutate] of mutations) {
  test(`${description} still aborts the complete update`, async () => {
    const changed = mutate();
    assert.notEqual(changed, raw);
    await assert.rejects(build(changed), /CWA/);
  });
}
