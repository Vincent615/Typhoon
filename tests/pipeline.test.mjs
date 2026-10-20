import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  haversineKm, msToBeaufort, evaluateCountiesAtPoint, parseCwaTyNewsJs,
  parseDgpaAnnouncements, buildTyphoonDataset, writeTyphoonDatasetAtomic
} from '../scripts/update_typhoon_data.mjs';
import { COUNTY_POLYGONS, COUNTY_LABEL_OFFSETS } from '../src/taiwan-geo.js';
import { FIXED_NOW, EMPTY_CWA, EMPTY_DGPA, makeCwaFeed, makeFetch } from './fixtures/pipeline-fixtures.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const thresholdsData = JSON.parse(await fs.readFile(path.join(ROOT_DIR, 'data/thresholds.json'), 'utf8'));
const build = (network = {}, extra = {}) => buildTyphoonDataset({
  fetchImpl: makeFetch(network), now: () => FIXED_NOW, apiKey: '', thresholdsData, ...extra
});
const countyTable = (rows) => `<title>天然災害停止上班及上課情形查詢</title><table id="Table"><tr><th>縣市名稱</th><th>是否停止上班上課情形</th></tr>${rows}</table><p>若決定停止上班應發布公告。</p>`;

test('thresholds and map geometry cover all 22 counties', () => {
  assert.equal(thresholdsData.counties.length, 22);
  for (const county of thresholdsData.counties) {
    assert.ok(county.id && county.name && county.region && county.commuterZone);
    assert.ok(county.rainThreshold.flatland >= 200 && county.rainThreshold.mountain >= 150);
    assert.ok(COUNTY_POLYGONS[county.id]?.length >= 4, county.id);
    assert.ok(COUNTY_LABEL_OFFSETS[county.id], county.id);
  }
});

test('distance and wind-scale utilities retain their expected units', () => {
  const distance = haversineKm(25.033, 121.565, 22.627, 120.301);
  assert.ok(distance > 280 && distance < 315);
  assert.equal(msToBeaufort(15), 7);
  assert.equal(msToBeaufort(26), 10);
  assert.equal(msToBeaufort(52), 16);
});

test('the actual CWA concatenated-script snapshot parses without executing code', async () => {
  const raw = await fs.readFile(path.join(ROOT_DIR, 'tests/fixtures/cwa-official-20261020.js'), 'utf8');
  const parsed = parseCwaTyNewsJs(raw);
  assert.equal(parsed.status, 'active');
  assert.equal(parsed.observedAt, '2026-10-20T12:00:00.000Z');
  assert.equal(parsed.scenarios[0].timeline.length, 9);
  assert.equal(parsed.scenarios[0].timeline[0].lat, 16.9);
  assert.equal(parsed.scenarios[0].timeline.at(-1).radius10km, 0);
});

test('CWA network, HTTP, malformed and incomplete responses fail instead of publishing fallback data', async () => {
  await assert.rejects(build({ cwaFailure: true }), /CWA unavailable/);
  await assert.rejects(build({}, { fetchImpl: async () => new Response('unavailable', { status: 503 }) }), /HTTP 503/);
  for (const cwa of ['', '<html>service unavailable</html>', 'var TYPHOON = null;', makeCwaFeed().replace('北緯 21 度', '北緯 缺值 度'), makeCwaFeed().replace('七級風平均暴風半徑 250', '七級風平均暴風半徑 缺值')]) {
    await assert.rejects(build({ cwa }), /CWA/);
  }
});

test('only a successfully parsed empty collection creates a calm scenario with unknown weather', async () => {
  const payload = await build({ cwa: EMPTY_CWA });
  assert.equal(payload.officialSync.cwaStatus, 'no_active');
  assert.equal(payload.officialSync.liveCycloneDetected, false);
  const calm = payload.scenarios[0];
  assert.equal(calm.hasTyphoon, false);
  assert.equal(calm.isLiveOfficial, false);
  assert.equal(calm.timeline.length, 1);
  assert.equal(calm.timeline[0].lat, null);
  assert.equal(calm.timeline[0].stats.maxProb, null);
  for (const county of calm.timeline[0].counties) {
    assert.equal(county.probability, null);
    assert.equal(county.wind.avgBeaufort, null);
    assert.equal(county.rain.flatland24h, null);
    assert.equal(county.riskLevel, 'unknown');
    assert.notEqual(county.dgpaStatus, '正常上班上課');
  }
  assert.equal(parseCwaTyNewsJs('var TYPHOON = {};').observedAt, null);
  assert.doesNotMatch(calm.aiMetadata.executiveBrief, /薔琵|29 號|週三|週四/);
});

test('separate cyclone panels retain their own names, current positions and forecast tracks', async () => {
  const cwa = makeCwaFeed([
    { key: 'ALPHA', chineseName: '甲颱', lat: 21, lon: 128 },
    { key: 'BETA', chineseName: '乙颱', lat: 10, lon: 145 }
  ]);
  const payload = await build({ cwa });
  assert.equal(payload.scenarios.length, 2);
  const [alpha, beta] = payload.scenarios;
  assert.equal(alpha.timeline.length, 5);
  assert.equal(beta.timeline.length, 5);
  assert.equal(alpha.timeline.at(-1).lat, 23);
  assert.equal(beta.timeline.at(-1).lat, 12);
  assert.match(alpha.aiMetadata.executiveBrief, /甲颱/);
  assert.doesNotMatch(alpha.aiMetadata.executiveBrief, /乙颱/);
  assert.match(beta.aiMetadata.executiveBrief, /乙颱/);
  assert.doesNotMatch(beta.aiMetadata.executiveBrief, /甲颱/);
  assert.deepEqual(payload.aiMetadata, alpha.aiMetadata);
  await assert.rejects(build({ cwa: cwa.replace('北緯 10 度', '北緯 無資料 度') }), /latitude/);
});

test('malformed metadata, injected expressions, duplicate panels and invalid point values are rejected', () => {
  globalThis.__cwaExecution = false;
  const feed = makeCwaFeed();
  const badSources = [
    feed.replace('var TYPHOON = ', 'var TYPHOON = (() => { globalThis.__cwaExecution = true; return '),
    feed.replace('TY_LIST_2[\'C\'] = ', "TY_LIST_2['C'] = '' + process.exit(0) + "),
    feed.replace('北緯 21 度', '北緯 91 度'),
    feed.replace('東經 128 度', '東經 181 度'),
    feed.replace('十級風平均暴風半徑 80', '十級風平均暴風半徑 300'),
    feed.replace('十級風平均暴風半徑 80', '十級風平均暴風半徑 unknown'),
    feed.replace('預測 48 小時', '預測 6 小時'),
    feed.replace('預測 48 小時', '預測 broken 小時'),
    feed.replace('202606080000', '202602300000'),
    feed.replace('國際命名 ALPHA', '國際命名 UNKNOWN'),
    feed.replace('var TY_DataTime = \'202606080000\';', '')
  ];
  for (const source of badSources) assert.throws(() => parseCwaTyNewsJs(source), /CWA/);
  assert.equal(globalThis.__cwaExecution, false);
  delete globalThis.__cwaExecution;
  const two = makeCwaFeed([{ key: 'ALPHA', chineseName: '甲颱', lat: 21, lon: 128 }, { key: 'BETA', chineseName: '乙颱', lat: 10, lon: 145 }]);
  assert.throws(() => parseCwaTyNewsJs(two.replace('國際命名 BETA', '國際命名 ALPHA')), /duplicate/);
});

test('observation and forecast calendar times must agree with UTC metadata, including year rollover', () => {
  const feed = makeCwaFeed();
  assert.throws(() => parseCwaTyNewsJs(feed.replace('202606080000', '202606090000')), /point time/);
  assert.throws(() => parseCwaTyNewsJs(feed.replace('預測 6月8日14時', '預測 6月9日14時')), /point time/);
  const yearEnd = feed.replace('202606080000', '202612311200')
    .replace('2026年6月8日08時', '2026年12月31日20時')
    .replace('預測 6月8日14時', '預測 1月1日02時')
    .replace('預測 6月10日08時', '預測 1月2日20時')
    .replace('預測 6月11日08時', '預測 1月3日20時')
    .replace('預測 6月12日08時', '預測 1月4日20時');
  const parsed = parseCwaTyNewsJs(yearEnd);
  assert.equal(parsed.observedAt, '2026-12-31T12:00:00.000Z');
  assert.equal(parsed.scenarios[0].timeline.at(-1).timeDisplay, '1月4日 20:00');
});

test('missing and explicit-zero ten-force radii stay zero in parsing and center-point evaluations', () => {
  const parsed = parseCwaTyNewsJs(makeCwaFeed([{ key: 'ALPHA', chineseName: '甲颱', lat: 21, lon: 128, omitRadius10: true }]));
  const scenario = parsed.scenarios[0];
  assert.ok(scenario.timeline.every((point) => point.radius10km === 0));
  const point = scenario.timeline[0];
  const countyAtEye = { ...thresholdsData.counties[0], lat: point.lat, lon: point.lon };
  const result = evaluateCountiesAtPoint([countyAtEye], point, scenario)[0];
  assert.equal(result.inRadius7, true);
  assert.equal(result.inRadius10, false);
  assert.throws(() => evaluateCountiesAtPoint([countyAtEye], { ...point, radius7km: null }, scenario), /Missing model input/);
  assert.equal(parseCwaTyNewsJs(makeCwaFeed().replaceAll('暴風半徑 80', '暴風半徑 0')).scenarios[0].timeline[0].radius10km, 0);
});

test('next-position proximity cannot change this slice wind, rainfall, radius flags or probability', () => {
  const scenario = parseCwaTyNewsJs(makeCwaFeed()).scenarios[0];
  const point = { ...scenario.timeline[0], lat: 21.2, lon: 126.3, radius7km: 300 };
  const county = thresholdsData.counties.find((item) => item.id === 'KEE');
  const withoutNext = evaluateCountiesAtPoint([county], point, scenario);
  const withNext = evaluateCountiesAtPoint([county], { ...point, nextLat: county.lat, nextLon: county.lon }, scenario);
  assert.deepEqual(withNext, withoutNext);
  assert.equal(withNext[0].inRadius7, false);
});

test('phase, warning and no-key summaries are derived from this storm rather than fixed dates', async () => {
  const payload = await build();
  const scenario = payload.scenarios[0];
  assert.match(scenario.summary, /甲颱/);
  assert.match(scenario.summary, /6月8日/);
  assert.match(scenario.timeline.at(-1).phaseNote, /23°、126°/);
  assert.doesNotMatch(JSON.stringify(payload), /薔琵|CHAMPI|週三|週四|北轉角度|第 29 號/);
  assert.equal(scenario.aiMetadata.providerStatus, 'not_configured');
  assert.equal(payload.updatedAt, FIXED_NOW);
  assert.equal(payload.officialSync.observedAt, '2026-06-08T00:00:00.000Z');
  assert.equal(payload.officialSync.cwaSourceMode.includes('OpenData API'), false);
  for (const county of scenario.timeline[0].counties) assert.ok(county.probability >= 0 && county.probability <= 100);
});

test('Gemini failure retains the same dynamic fallback and prompt forbids invented announcements', async () => {
  let prompt = '';
  const payload = await build({ geminiFailure: true, onRequest: (url, options) => {
    if (url.includes('generativelanguage.googleapis.com')) prompt = JSON.parse(options.body).contents[0].parts[0].text;
  } }, { apiKey: 'test-only' });
  const withoutKey = await build();
  assert.equal(payload.aiMetadata.executiveBrief, withoutKey.aiMetadata.executiveBrief);
  assert.equal(payload.aiMetadata.providerStatus, 'fallback');
  assert.match(prompt, /不得推測或新增海上警報/);
  assert.match(prompt, /官方公告讀取結果/);
  assert.match(prompt, /本站模型估算/);
});

test('Gemini success belongs to its scenario and building again cannot overwrite production output', async () => {
  const outputPath = path.join(ROOT_DIR, 'data/typhoon-data.json');
  const before = await fs.readFile(outputPath);
  const beforeStat = await fs.stat(outputPath);
  const generated = '甲颱本時次的縣市風雨與機率為本站模型估算，並非官方停班課決定。請以中央氣象署最新預報與各縣市政府公布的適用日期及地區為準。';
  const payload = await build({ geminiText: generated }, { apiKey: 'test-only' });
  assert.equal(payload.scenarios[0].aiMetadata.executiveBrief, generated);
  assert.equal(payload.aiMetadata.providerStatus, 'generated');
  await build();
  assert.deepEqual(await fs.readFile(outputPath), before);
  assert.equal((await fs.stat(outputPath)).mtimeMs, beforeStat.mtimeMs);
});

test('no-active-typhoon builds skip Gemini and never fabricate general weather forecasts', async () => {
  let geminiCalled = false;
  const payload = await build({ cwa: EMPTY_CWA, onRequest: (url) => { if (url.includes('generativelanguage')) geminiCalled = true; } }, { apiKey: 'test-only' });
  assert.equal(geminiCalled, false);
  assert.match(payload.aiMetadata.executiveBrief, /未列活躍颱風/);
});

test('DGPA page title and legal notes cannot turn normal county rows into suspension announcements', () => {
  const result = parseDgpaAnnouncements(countyTable('<tr><td>臺北市</td><td>今天照常上班、照常上課。</td></tr><tr><td>新北市</td><td>明天照常上班、照常上課。</td></tr><tr><td colspan="3">若停止上班應公告。</td></tr>'), thresholdsData.counties);
  assert.equal(result.status, 'normal');
  assert.equal(result.announcements.length, 2);
  assert.ok(result.announcements.every((item) => item.status === 'normal'));
});

test('DGPA mixed county notices preserve suspensions even when another county is outside a warning area', async () => {
  const dgpa = countyTable('<tr><td>臺北市</td><td>尚未列入警戒區。</td></tr><tr><td>高雄市</td><td>今天山區停止上班、停止上課。</td></tr>');
  const payload = await build({ dgpa });
  assert.equal(payload.officialSync.dgpaStatus, 'announced');
  assert.match(payload.officialSync.dgpaAnnouncementText, /高雄市/);
  const counties = payload.scenarios[0].timeline[0].counties;
  assert.equal(counties.find((county) => county.id === 'KHH').officialAnnouncement.status, 'suspended');
  assert.equal(counties.find((county) => county.id === 'TPE').officialAnnouncement.status, 'not_announced');
  assert.equal(counties.find((county) => county.id === 'ILA').officialAnnouncement, null);
});

test('DGPA explicit empty, unfamiliar markup and network failure have distinct outcomes', async () => {
  assert.equal(parseDgpaAnnouncements(EMPTY_DGPA, thresholdsData.counties).status, 'no_announcements');
  const unknown = parseDgpaAnnouncements('<title>無停班停課訊息</title><p>停止上班</p>', thresholdsData.counties);
  assert.equal(unknown.status, 'unknown');
  const failed = await build({ dgpaFailure: true });
  assert.equal(failed.officialSync.dgpaStatus, 'unknown');
  assert.equal(failed.officialSync.dgpaChecked, false);
  assert.doesNotMatch(failed.officialSync.dgpaAnnouncementText, /無停班停課訊息/);
});

test('DGPA district rows spanning a county keep their county association', () => {
  const result = parseDgpaAnnouncements(countyTable('<tr><td rowspan="2">新北市</td><td>平地照常上班上課。</td></tr><tr><td>山區停止上班、停止上課。</td></tr>'), thresholdsData.counties);
  assert.equal(result.status, 'announced');
  assert.equal(result.announcements.length, 2);
  assert.ok(result.announcements.every((item) => item.countyId === 'NTP'));
});

test('atomic writer replaces a completed temporary output and preserves old data on serialization failure', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'typhoon-atomic-'));
  const output = path.join(directory, 'data.json');
  try {
    await fs.writeFile(output, 'old-data');
    const invalid = {}; invalid.cycle = invalid;
    await assert.rejects(writeTyphoonDatasetAtomic(invalid, output), /circular/i);
    assert.equal(await fs.readFile(output, 'utf8'), 'old-data');
    const payload = await build();
    await writeTyphoonDatasetAtomic(payload, output);
    assert.deepEqual(JSON.parse(await fs.readFile(output, 'utf8')), payload);
    assert.deepEqual(await fs.readdir(directory), ['data.json']);
    await assert.rejects(writeTyphoonDatasetAtomic(payload, directory));
    assert.deepEqual(await fs.readdir(directory), ['data.json']);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('CLI exits nonzero on CWA failure and leaves the existing production file untouched', async () => {
  const outputPath = path.join(ROOT_DIR, 'data/typhoon-data.json');
  const before = await fs.readFile(outputPath);
  const beforeStat = await fs.stat(outputPath);
  const bootstrap = 'globalThis.fetch = async () => { throw new Error("offline CWA failure"); };';
  const processResult = spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(bootstrap)}`, path.join(ROOT_DIR, 'scripts/update_typhoon_data.mjs')], { cwd: ROOT_DIR, encoding: 'utf8', env: { ...process.env, GEMINI_API_KEY: '' }, timeout: 10000 });
  assert.equal(processResult.status, 1);
  assert.match(processResult.stderr, /offline CWA failure/);
  assert.equal(processResult.stdout, '');
  assert.deepEqual(await fs.readFile(outputPath), before);
  assert.equal((await fs.stat(outputPath)).mtimeMs, beforeStat.mtimeMs);
});
