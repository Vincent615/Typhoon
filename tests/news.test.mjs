import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { NEWS_SOURCES, parseNewsFeed, buildNewsDataset, writeNewsDatasetAtomic } from '../scripts/update_news.mjs';
import { NEWS_NOW, RSS_DATE, rssItem, rssFeed, atomEntry, atomFeed, newsFetch } from './fixtures/news-fixtures.mjs';

const [CNA, PTS] = NEWS_SOURCES;
const build = (network = {}, extra = {}) => buildNewsDataset({ fetchImpl: newsFetch(network), now: () => NEWS_NOW, ...extra });
const parse = (xml, source = CNA) => parseNewsFeed(xml, source, { now: NEWS_NOW });

test('publisher RSS and Atom become dated, attributed HTTPS links without article bodies', async () => {
  const data = await build();
  assert.equal(data.status, 'ok');
  assert.equal(data.articles.length, 2);
  assert.equal(data.lastSuccessfulAt, NEWS_NOW);
  assert.equal(data.articles[0].sourceName, '中央通訊社');
  assert.equal(data.articles[1].sourceName, '公視新聞網');
  assert.equal(data.articles[0].publishedAt, '2026-10-20T15:00:00.000Z');
  assert.equal(data.articles[0].dateKind, 'published');
  assert.equal(data.articles[1].dateKind, 'updated');
  assert.ok(data.sources.every((source) => source.status === 'ok' && source.siteUrl.startsWith('https://')));
  assert.ok(data.articles.every((article) => article.cached === false && !('description' in article) && !('summary' in article)));
});

test('Atom uses published when present, without replacing article time with feed time', () => {
  const articles = parse(atomFeed([atomEntry({ published: '2026-10-20T10:00:00+08:00' })]), PTS);
  assert.equal(articles[0].publishedAt, '2026-10-20T02:00:00.000Z');
  assert.equal(articles[0].dateKind, 'published');
});

test('titles are plain text and tracking links deduplicate into canonical publisher URLs', async () => {
  const data = await build({
    cna: rssFeed([
      rssItem({ title: '<b>颱風</b>影響台灣 &amp; 海警', url: 'https://www.cna.com.tw/news/ahel/202610200001.aspx?utm_source=rss&amp;ref=feed#test' }),
      rssItem()
    ]),
    pts: atomFeed([])
  });
  assert.equal(data.articles.length, 1);
  assert.equal(data.articles[0].title, '颱風 影響台灣 & 海警');
  assert.equal(data.articles[0].url, 'https://www.cna.com.tw/news/ahel/202610200001.aspx');
});

test('javascript, HTTP, lookalike hosts, credentials, unexpected ports and nonarticle paths are excluded', () => {
  for (const url of [
    'javascript:alert(1)', 'http://www.cna.com.tw/news/ahel/202610200001.aspx',
    'https://www.cna.com.tw.evil.example/news/ahel/202610200001.aspx',
    'https://user:password@www.cna.com.tw/news/ahel/202610200001.aspx',
    'https://www.cna.com.tw:8443/news/ahel/202610200001.aspx',
    'https://www.cna.com.tw/about/rss.aspx', 'https://news.pts.org.tw/article/800001'
  ]) assert.deepEqual(parse(rssFeed([rssItem({ url })])), [], url);
});

test('valid old and future dates are excluded, while malformed dates fail source parsing', () => {
  for (const date of [
    'Tue, 13 Oct 2026 23:59:59 +0800',
    'Wed, 21 Oct 2026 00:00:01 +0800'
  ]) assert.deepEqual(parse(rssFeed([rssItem({ date })])), [], date);
  for (const date of [
    '2026-02-30T12:00:00+08:00',
    '2026-10-20T12:00:00',
    '20/10/2026', '', 'not-a-date'
  ]) {
    assert.throws(() => parse(rssFeed([rssItem({ date })])), /date invalid/, date);
    assert.throws(() => parse(atomFeed([atomEntry({ date })]), PTS), /date invalid/, date);
  }
  assert.equal(parse(rssFeed([rssItem({ date: 'Wed, 14 Oct 2026 00:00:00 +0800' })])).length, 1);
});

test('malformed required entry values retain cache instead of reporting a successful empty refresh', async () => {
  const previousData = await build();
  const later = '2026-10-20T17:00:00.000Z';
  const damagedCna = rssFeed([rssItem({ date: 'not-a-date' })]);
  const damagedPts = atomFeed([atomEntry({ date: 'not-a-date' })]);
  const stale = await build({ cna: damagedCna, pts: damagedPts }, { previousData, now: later });
  assert.equal(stale.status, 'stale');
  assert.equal(stale.lastCheckedAt, later);
  assert.equal(stale.lastSuccessfulAt, previousData.lastSuccessfulAt);
  assert.deepEqual(stale.articles, previousData.articles.map((article) => ({ ...article, cached: true })));
  for (const source of stale.sources) {
    assert.equal(source.status, 'error');
    assert.match(source.error, /date invalid/);
    assert.equal(source.lastSuccessfulAt, NEWS_NOW);
  }
  for (const [network, failedId] of [[{ cna: damagedCna }, 'cna'], [{ pts: damagedPts }, 'pts']]) {
    const partial = await build(network, { previousData, now: later });
    assert.equal(partial.status, 'partial');
    assert.equal(partial.lastSuccessfulAt, NEWS_NOW);
    assert.equal(partial.sources.find((source) => source.id === failedId).status, 'error');
    assert.ok(partial.articles.filter((article) => article.sourceId === failedId).every((article) => article.cached));
    assert.ok(partial.articles.filter((article) => article.sourceId !== failedId).every((article) => !article.cached));
  }
  for (const changes of [{ title: '' }, { url: '' }]) {
    assert.throws(() => parse(rssFeed([rssItem(changes)])), /metadata invalid/);
    assert.throws(() => parse(atomFeed([atomEntry(changes)]), PTS), /metadata invalid/);
  }
});

test('valid feeds with only old, future or unrelated articles still count as a successful empty refresh', async () => {
  const previousData = await build();
  const data = await build({
    cna: rssFeed([
      rssItem({ date: 'Tue, 13 Oct 2026 23:59:59 +0800' }),
      rssItem({ date: 'Wed, 21 Oct 2026 00:00:01 +0800' }),
      rssItem({ title: '台灣今天開獎結果', description: '開獎新聞。' })
    ]),
    pts: atomFeed([])
  }, { previousData });
  assert.equal(data.status, 'empty');
  assert.deepEqual(data.articles, []);
  assert.equal(data.lastSuccessfulAt, NEWS_NOW);
  assert.ok(data.sources.every((source) => source.status === 'empty'));
});

test('irrelevant news and foreign-only typhoon reports are excluded', () => {
  const articles = parse(rssFeed([
    rssItem({ title: '台灣今天開獎結果', description: '開獎新聞。' }),
    rssItem({ title: '中國海警船進入金門限制水域', description: '海巡署派艇應對。' }),
    rssItem({ title: '颱風侵襲墨西哥', description: '墨西哥沿海遭颱風吹襲。' }),
    rssItem({ title: '颱風接近日本 氣象局提醒防雨', description: '日本氣象局預報。' }),
    rssItem({ title: '颱風接近 氣象署提醒防雨', description: '測試。' })
  ]));
  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, '颱風接近 氣象署提醒防雨');
});

test('only structurally valid empty feeds count as successful empty results', async () => {
  const data = await build({ cna: rssFeed([]), pts: atomFeed([]) });
  assert.equal(data.status, 'empty');
  assert.equal(data.lastSuccessfulAt, NEWS_NOW);
  assert.ok(data.sources.every((source) => source.status === 'empty'));
  for (const xml of [
    '', '<html>error page</html>', '<rss version="2.0"><channel></channel></rss>',
    rssFeed().replace('</item>', ''), rssFeed().replace('</rss>', ''),
    `${rssFeed()}${rssFeed()}`, '<rss version="2.0"><channel/><channel/></rss>',
    '<feed xmlns="https://untrusted.example/"><title>fake</title></feed>',
    rssFeed().replace('<title>測試 RSS</title>', '<title>&unknown;</title>'),
    rssFeed().replace('<title>測試 RSS</title>', '<title>&toString;</title>'),
    rssFeed().replace(`<pubDate>${RSS_DATE}</pubDate>`, ''),
    `<!DOCTYPE rss [<!ENTITY secret SYSTEM "file:///etc/passwd">]>${rssFeed()}`,
    rssFeed().replace('<channel>', '<channel bad="yes" bad="no">')
  ]) assert.throws(() => parse(xml), /XML|feed|metadata|channel/, xml.slice(0, 80));
});

test('partial failure retains only failed-source recent articles and their success time', async () => {
  const previousData = await build();
  const later = '2026-10-20T17:00:00.000Z';
  const data = await build({ failures: ['cna'], pts: atomFeed([]) }, { previousData, now: later });
  assert.equal(data.status, 'partial');
  assert.equal(data.lastCheckedAt, later);
  assert.equal(data.lastSuccessfulAt, NEWS_NOW);
  assert.equal(data.articles.length, 1);
  assert.equal(data.articles[0].sourceId, 'cna');
  assert.equal(data.articles[0].cached, true);
  assert.equal(data.sources[0].lastSuccessfulAt, NEWS_NOW);
  assert.equal(data.sources[1].lastSuccessfulAt, later);
});

test('all-source failures preserve recent cache but never manufacture a successful refresh time', async () => {
  const previousData = await build();
  const later = '2026-10-20T17:00:00.000Z';
  const stale = await build({ failures: ['cna', 'pts'] }, { previousData, now: later });
  assert.equal(stale.status, 'stale');
  assert.equal(stale.lastSuccessfulAt, NEWS_NOW);
  assert.equal(stale.lastCheckedAt, later);
  assert.equal(stale.articles.length, 2);
  assert.ok(stale.articles.every((article) => article.cached));
  const noCache = await build({ failures: ['cna', 'pts'] });
  assert.equal(noCache.status, 'stale');
  assert.equal(noCache.lastSuccessfulAt, null);
  assert.deepEqual(noCache.articles, []);
  const expired = await build({ failures: ['cna', 'pts'] }, { previousData, now: '2026-10-29T16:00:00Z' });
  assert.deepEqual(expired.articles, []);
});

test('retained cache is revalidated instead of trusting unsafe links or future timestamps', async () => {
  const previousData = await build();
  previousData.articles[0].url = 'javascript:alert(1)';
  previousData.articles[1].publishedAt = '2030-01-01T00:00:00.000Z';
  previousData.lastSuccessfulAt = '2030-01-01T00:00:00.000Z';
  const data = await build({ failures: ['cna', 'pts'] }, { previousData });
  assert.deepEqual(data.articles, []);
  assert.equal(data.lastSuccessfulAt, null);
  const malformed = await build({ failures: ['cna', 'pts'] }, { previousData: { sources: {}, articles: [null] } });
  assert.equal(malformed.status, 'stale');
  assert.deepEqual(malformed.articles, []);
});

test('cached timestamp kinds persist and legacy PTS cache defaults to updated', async () => {
  const previousData = await build();
  const stale = await build({ failures: ['cna', 'pts'] }, { previousData });
  assert.equal(stale.articles[0].dateKind, 'published');
  assert.equal(stale.articles[1].dateKind, 'updated');
  previousData.articles.forEach((article) => { delete article.dateKind; });
  const legacy = await build({ failures: ['cna', 'pts'] }, { previousData });
  assert.equal(legacy.articles[0].dateKind, 'published');
  assert.equal(legacy.articles[1].dateKind, 'updated');
  previousData.articles[1].dateKind = 'published';
  const explicit = await build({ failures: ['cna', 'pts'] }, { previousData });
  assert.equal(explicit.articles[1].dateKind, 'published');
});

test('HTTP failures and HTML or oversized bodies fail the source and retain prior data', async () => {
  const previousData = await build();
  for (const fetchImpl of [
    async () => new Response('unavailable', { status: 503 }),
    async () => new Response('<html>service unavailable</html>'),
    async () => new Response(' '.repeat(2 * 1024 * 1024 + 1)),
    async () => new Response('', { headers: { 'Content-Length': String(3 * 1024 * 1024) } })
  ]) {
    const data = await build({}, { fetchImpl, previousData });
    assert.equal(data.status, 'stale');
    assert.equal(data.articles.length, 2);
  }
});

test('newest-first ordering caps the combined output at twelve articles', async () => {
  const items = Array.from({ length: 20 }, (_, index) => rssItem({
    title: `測試颱風台灣新聞 ${index}`,
    url: `https://www.cna.com.tw/news/ahel/20261020${String(index).padStart(4, '0')}.aspx`,
    date: RSS_DATE.replace('23:00:00', `${String(index).padStart(2, '0')}:00:00`)
  }));
  const data = await build({ cna: rssFeed(items), pts: atomFeed([]) });
  assert.equal(data.articles.length, 12);
  assert.equal(data.articles[0].title, '測試颱風台灣新聞 19');
  assert.equal(data.articles.at(-1).title, '測試颱風台灣新聞 8');
  assert.equal(data.sources[0].articleCount, 12);
});

test('atomic writer replaces only its requested output and removes temporary files', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'typhoon-news-test-'));
  try {
    const output = path.join(directory, 'news.json');
    await fs.writeFile(output, '{"old":true}');
    const data = await build();
    await writeNewsDatasetAtomic(data, output);
    assert.deepEqual(JSON.parse(await fs.readFile(output, 'utf8')), data);
    assert.deepEqual(await fs.readdir(directory), ['news.json']);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('CLI writes an explicit stale snapshot before exiting nonzero when every feed fails', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'typhoon-news-cli-'));
  try {
    const scriptDirectory = path.join(directory, 'scripts');
    await fs.mkdir(scriptDirectory);
    const scriptPath = path.join(scriptDirectory, 'update_news.mjs');
    await fs.copyFile(new URL('../scripts/update_news.mjs', import.meta.url), scriptPath);
    const result = spawnSync(process.execPath, [
      '--import', "data:text/javascript,globalThis.fetch=async()=>{throw new Error('offline fixture')};",
      await fs.realpath(scriptPath)
    ], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /News stale: 0 articles/);
    const output = JSON.parse(await fs.readFile(path.join(directory, 'data/news.json'), 'utf8'));
    assert.equal(output.status, 'stale');
    assert.equal(output.lastSuccessfulAt, null);
    assert.ok(output.sources.every((source) => source.status === 'error'));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
