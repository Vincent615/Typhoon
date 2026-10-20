import test from 'node:test';
import assert from 'node:assert/strict';
import { safeNewsUrl, newsViewModel, renderNews, mountNews } from '../src/news.js';

const NOW = Date.parse('2026-10-21T04:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const iso = (time) => new Date(time).toISOString();

function article(id, changes = {}) {
  return {
    id: `cna-${id}`,
    title: `颱風消息 ${id}`,
    url: `https://www.cna.com.tw/news/ahel/20261021${String(id).padStart(4, '0')}.aspx`,
    sourceId: 'cna',
    sourceName: '中央通訊社',
    publishedAt: iso(NOW - HOUR),
    ...changes
  };
}

function dataset(articles = [], changes = {}) {
  return {
    schemaVersion: 1,
    status: articles.length ? 'ok' : 'empty',
    lastCheckedAt: iso(NOW),
    lastSuccessfulAt: iso(NOW),
    sources: [
      { id: 'cna', name: '中央通訊社', status: 'ok' },
      { id: 'pts', name: '公視新聞網', status: 'ok' }
    ],
    articles,
    ...changes
  };
}

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.replaceCount = 0;
  }
  set innerHTML(_) { throw new Error('News must render untrusted content as text'); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) {
    this.replaceCount++;
    this.children = [...children];
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  async click() { await this.listeners.get('click')?.(); }
}

function createRoot(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.document = { createElement: (tagName) => new Element(tagName) };
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  });
  const root = new Element('section');
  const nodes = new Map(
    ['list', 'status', 'empty', 'more', 'refresh']
      .map((name) => [`[data-news-${name}]`, new Element(name === 'more' || name === 'refresh' ? 'button' : 'div')])
  );
  root.querySelector = (selector) => {
    assert.ok(nodes.has(selector), `Unexpected news selector: ${selector}`);
    return nodes.get(selector);
  };
  const node = (name) => nodes.get(`[data-news-${name}]`);
  return { root, node };
}

function scheduler() {
  let nextId = 0;
  const active = new Map();
  const cleared = [];
  return {
    active,
    cleared,
    setInterval(callback, delay) {
      const id = ++nextId;
      active.set(id, { callback, delay });
      return id;
    },
    clearInterval(id) {
      cleared.push(id);
      active.delete(id);
    },
    async fire(delay) {
      for (const timer of [...active.values()]) {
        if (timer.delay === delay) await timer.callback();
      }
      // Fetch and response.json each resume on a microtask, without real timers.
      await Promise.resolve();
    }
  };
}

test('news URLs require an approved publisher with HTTPS and no credentials or custom port', () => {
  assert.equal(safeNewsUrl('https://www.cna.com.tw/news/ahel/1.aspx', 'cna'),
    'https://www.cna.com.tw/news/ahel/1.aspx');
  assert.equal(safeNewsUrl('https://news.pts.org.tw/article/123', 'pts'),
    'https://news.pts.org.tw/article/123');
  for (const [url, sourceId] of [
    ['javascript:alert(1)', 'cna'],
    ['data:text/html,<h1>news</h1>', 'cna'],
    ['http://www.cna.com.tw/news/ahel/1.aspx', 'cna'],
    ['//www.cna.com.tw/news/ahel/1.aspx', 'cna'],
    ['https://attacker.example/article', 'cna'],
    ['https://www.cna.com.tw.attacker.example/article', 'cna'],
    ['https://attacker.example@www.cna.com.tw/article', 'cna'],
    ['https://www.cna.com.tw@attacker.example/article', 'cna'],
    ['https://www.cna.com.tw:8443/article', 'cna'],
    ['https://news.pts.org.tw/article/123', 'cna'],
    ['https://www.cna.com.tw/article', 'pts'],
    ['https://www.cna.com.tw/article', 'unknown'],
    ['https://www.cna.com.tw/article', '__proto__'],
    ['not a URL', 'cna']
  ]) assert.equal(safeNewsUrl(url, sourceId), null, `${sourceId}: ${url}`);
});

test('publisher labels come from verified source IDs rather than payload names', () => {
  const model = newsViewModel(dataset([
    article(1, { sourceName: '攻擊者新聞', title: '  中央社颱風報導  ' }),
    article(2, {
      sourceId: 'pts', sourceName: '假冒中央社', url: 'https://news.pts.org.tw/article/123'
    }),
    article(3, { sourceId: 'pts' }),
    article(4, { sourceId: 'unknown' })
  ], {
    sources: [
      { id: 'cna', name: '假冒政府緊急警報', status: 'error' },
      { id: 'pts', name: '攻擊者', status: 'ok' }
    ]
  }), NOW);
  assert.deepEqual(model.articles.map((item) => item.sourceName), ['中央通訊社', '公視新聞網']);
  assert.equal(model.articles[0].title, '中央社颱風報導');
  assert.equal(model.articles[0].cached, true);
  assert.match(model.status, /中央通訊社暫時無法更新/);
  assert.doesNotMatch(model.status, /攻擊者|假冒/);
});

test('news is deduplicated, sorted newest first, and capped at twelve articles', () => {
  const items = Array.from({ length: 15 }, (_, index) =>
    article(index, { publishedAt: iso(NOW - (15 - index) * HOUR) }));
  const model = newsViewModel(dataset([...items, { ...items[12] }]), NOW);
  assert.equal(model.articles.length, 12);
  assert.equal(new Set(model.articles.map((item) => item.url)).size, 12);
  assert.deepEqual(model.articles.map((item) => item.id),
    items.slice(3).reverse().map((item) => item.id));
});

test('duplicate news URLs preserve the newest publication rather than input order', () => {
  const older = article(1, { title: '較舊標題', publishedAt: iso(NOW - 2 * HOUR) });
  const newer = { ...older, title: '更新標題', publishedAt: iso(NOW - HOUR) };
  const model = newsViewModel(dataset([older, newer]), NOW);
  assert.equal(model.articles.length, 1);
  assert.equal(model.articles[0].title, '更新標題');
  assert.equal(model.articles[0].publishedAt, newer.publishedAt);
});

test('news excludes expired, invalid, empty-title, unsafe and implausibly future entries', () => {
  const model = newsViewModel(dataset([
    article(1, { publishedAt: iso(NOW - 7 * DAY) }),
    article(2, { publishedAt: iso(NOW - 7 * DAY - 1) }),
    article(3, { publishedAt: iso(NOW + 5 * 60 * 1000) }),
    article(4, { publishedAt: iso(NOW + 5 * 60 * 1000 + 1) }),
    article(5, { publishedAt: 'not a timestamp' }),
    article(6, { title: '  ' }),
    article(7, { title: null }),
    article(8, { url: 'javascript:alert(1)' })
  ]), NOW);
  assert.deepEqual(model.articles.map((item) => item.id), ['cna-3', 'cna-1']);
});

test('stale checks include old, missing, invalid and implausibly future check timestamps', () => {
  for (const changes of [
    { status: 'stale' },
    { lastCheckedAt: iso(NOW - 6 * HOUR - 1) },
    { lastCheckedAt: null },
    { lastCheckedAt: 'invalid' },
    { lastCheckedAt: iso(NOW + 5 * 60 * 1000 + 1) }
  ]) {
    const model = newsViewModel(dataset([article(1)], changes), NOW);
    assert.equal(model.stale, true, JSON.stringify(changes));
    assert.match(model.status, /新聞暫未更新/);
    assert.doesNotMatch(model.status, /依(?:發布|新聞)時間排序/);
  }
  assert.equal(newsViewModel(dataset([article(1)], {
    lastCheckedAt: iso(NOW - 6 * HOUR)
  }), NOW).stale, false);
});

test('partial updates and source failures remain visibly degraded even with fresh timestamps', () => {
  for (const changes of [
    { status: 'partial' },
    { sources: [{ id: 'pts', status: 'error' }, { id: 'cna', status: 'ok' }] }
  ]) {
    const model = newsViewModel(dataset([article(1)], changes), NOW);
    assert.match(model.status, /暫時無法更新/);
    assert.doesNotMatch(model.status, /依(?:發布|新聞)時間排序/);
  }
});

test('empty feeds remain empty after filtering and invalid schemas are rejected', () => {
  const empty = newsViewModel(dataset(), NOW);
  assert.equal(empty.empty, true);
  assert.deepEqual(empty.articles, []);
  const expired = newsViewModel(dataset([article(1, { publishedAt: iso(NOW - 8 * DAY) })]), NOW);
  assert.equal(expired.empty, true);
  for (const payload of [null, {}, dataset([], { schemaVersion: 2 }),
    dataset([], { status: 'unknown' }), dataset([], { articles: {} }),
    dataset([], { sources: null })]) {
    assert.throws(() => newsViewModel(payload, NOW), /Invalid news dataset/);
  }
});

test('rendering keeps article titles as text and opens publisher links safely', (t) => {
  const { root, node } = createRoot(t);
  const title = '<img src=x onerror=alert(1)> & <script>alert(2)</script>';
  renderNews(root, newsViewModel(dataset([article(1, { title, cached: true })]), NOW));
  const link = node('list').children[0].children[0];
  assert.equal(link.tagName, 'a');
  assert.equal(link.href, article(1).url);
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  const heading = link.children.find((child) => child.tagName === 'h3');
  assert.equal(heading.textContent, title);
  assert.equal(heading.children.length, 0);
  const metadata = link.children[0];
  assert.equal(metadata.children[0].textContent, '中央通訊社');
  assert.equal(metadata.children[1].dateTime, article(1).publishedAt);
  assert.equal(metadata.children[2].textContent, '上次取得');
  assert.equal(node('empty').hidden, true);
  assert.equal(node('more').hidden, true);
});

test('rendering limits the initial list and exposes accessible expand/collapse state', (t) => {
  const { root, node } = createRoot(t);
  const model = newsViewModel(dataset(Array.from({ length: 8 }, (_, id) => article(id))), NOW);
  renderNews(root, model);
  assert.equal(node('list').children.filter((item) => !item.hidden).length, 6);
  assert.equal(node('more').hidden, false);
  assert.equal(node('more').textContent, '顯示其餘 2 則消息');
  assert.equal(node('more').attributes.get('aria-expanded'), 'false');
  renderNews(root, model, true);
  assert.equal(node('list').children.length, 8, 'rerender must replace rather than duplicate links');
  assert.equal(node('list').children.every((item) => !item.hidden), true);
  assert.equal(node('more').attributes.get('aria-expanded'), 'true');
  assert.equal(node('more').textContent, '收合消息');
  renderNews(root, newsViewModel(dataset(), NOW));
  assert.equal(node('list').children.length, 0);
  assert.equal(node('empty').hidden, false);
  assert.equal(node('more').hidden, true);
});

test('mounting allows expansion and retains previous articles as stale after refresh failure', async (t) => {
  const { root, node } = createRoot(t);
  const payload = dataset(Array.from({ length: 8 }, (_, id) => article(id)));
  let calls = 0;
  await mountNews(root, {
    now: () => NOW,
    fetchImpl: async () => {
      calls++;
      if (calls > 1) throw new Error('Network unavailable');
      return { ok: true, json: async () => payload };
    }
  });
  assert.equal(calls, 1);
  assert.equal(root.attributes.get('aria-busy'), 'false');
  assert.equal(node('refresh').disabled, false);
  await node('more').click();
  assert.equal(node('list').children.filter((item) => !item.hidden).length, 8);
  await node('more').click();
  assert.equal(node('list').children.filter((item) => !item.hidden).length, 6);
  await node('refresh').click();
  assert.equal(calls, 2);
  assert.match(node('status').textContent, /新聞暫未更新/);
  assert.equal(node('list').children.length, 8);
  assert.equal(root.attributes.get('aria-busy'), 'false');
  assert.equal(node('refresh').disabled, false);
  await node('more').click();
  assert.equal(node('list').children.filter((item) => !item.hidden).length, 8);
  assert.match(node('status').textContent, /新聞暫未更新/,
    'expanding after a failed refresh must not restore a misleading fresh status');
});

test('initial fetch failure displays an error, clears busy state and allows a successful retry', async (t) => {
  const { root, node } = createRoot(t);
  let succeed = false;
  await mountNews(root, {
    now: () => NOW,
    fetchImpl: async () => succeed
      ? { ok: true, json: async () => dataset([article(1)]) }
      : { ok: false, json: async () => { throw new Error('Must not parse an HTTP failure'); } }
  });
  assert.match(node('status').textContent, /暫時無法載入新聞/);
  assert.equal(node('empty').hidden, true, 'request errors must not claim an empty news feed');
  assert.equal(node('refresh').disabled, false);
  assert.equal(root.attributes.get('aria-busy'), 'false');
  succeed = true;
  await node('refresh').click();
  assert.equal(node('list').children.length, 1);
  assert.match(node('status').textContent, /最近檢查/);
  assert.equal(node('refresh').disabled, false);
});

test('empty messages distinguish complete checks from stale or incomplete source coverage', (t) => {
  const { root, node } = createRoot(t);
  const complete = newsViewModel(dataset(), NOW);
  assert.match(complete.emptyMessage, /近 7 天暫無/);
  for (const changes of [
    { status: 'stale' },
    { status: 'partial' },
    { lastCheckedAt: iso(NOW - 6 * HOUR - 1) },
    { sources: [{ id: 'cna', status: 'error' }, { id: 'pts', status: 'ok' }] }
  ]) {
    const model = newsViewModel(dataset([], changes), NOW);
    assert.equal(model.empty, true);
    assert.doesNotMatch(model.emptyMessage, /近\s*7\s*天暫無/,
      'an incomplete check cannot establish that no relevant articles exist');
    assert.match(model.emptyMessage, /目前沒有可顯示|尚未能完成更新/);
    renderNews(root, model);
    assert.equal(node('empty').hidden, false);
    assert.equal(node('empty').textContent, model.emptyMessage);
  }
});

test('minute checks remove articles after seven days without requiring another fetch', async (t) => {
  const { root, node } = createRoot(t);
  const timers = scheduler();
  let time = NOW;
  let calls = 0;
  const payload = dataset([article(1, { publishedAt: iso(NOW - 7 * DAY + 30000) })]);
  const cleanup = await mountNews(root, {
    now: () => time,
    autoRefresh: true,
    setIntervalImpl: timers.setInterval,
    clearIntervalImpl: timers.clearInterval,
    fetchImpl: async () => {
      calls++;
      return { ok: true, json: async () => payload };
    }
  });
  t.after(cleanup);
  assert.equal(node('list').children.length, 1);
  assert.deepEqual([...timers.active.values()].map((timer) => timer.delay), [60000, 300000]);
  time += 60000;
  await timers.fire(60000);
  assert.equal(calls, 1);
  assert.equal(node('list').children.length, 0);
  assert.equal(node('empty').hidden, false);
  assert.match(node('empty').textContent, /近 7 天暫無/);
});

test('minute checks expose stale sources after six hours without rebuilding unchanged news', async (t) => {
  const { root, node } = createRoot(t);
  const timers = scheduler();
  let time = NOW;
  const payload = dataset([article(1)], { lastCheckedAt: iso(NOW - 6 * HOUR + 90000) });
  const cleanup = await mountNews(root, {
    now: () => time,
    autoRefresh: true,
    setIntervalImpl: timers.setInterval,
    clearIntervalImpl: timers.clearInterval,
    fetchImpl: async () => ({ ok: true, json: async () => payload })
  });
  t.after(cleanup);
  const initialItem = node('list').children[0];
  const initialRenderCount = node('list').replaceCount;
  time += 60000;
  await timers.fire(60000);
  assert.equal(node('list').children[0], initialItem);
  assert.equal(node('list').replaceCount, initialRenderCount,
    'unchanged data must preserve link elements and any browser focus');
  assert.doesNotMatch(node('status').textContent, /新聞暫未更新/);
  time += 60000;
  await timers.fire(60000);
  assert.match(node('status').textContent, /新聞暫未更新/);
  assert.equal(node('list').children.length, 1);
  assert.equal(node('list').replaceCount, initialRenderCount + 1);
  const staleItem = node('list').children[0];
  time += 60000;
  await timers.fire(60000);
  assert.equal(node('list').children[0], staleItem);
  assert.equal(node('list').replaceCount, initialRenderCount + 1);
});

test('five-minute polling fetches visible pages only and cleanup cancels both timers', async (t) => {
  const { root, node } = createRoot(t);
  const timers = scheduler();
  let time = NOW;
  let calls = 0;
  const cleanup = await mountNews(root, {
    now: () => time,
    autoRefresh: true,
    setIntervalImpl: timers.setInterval,
    clearIntervalImpl: timers.clearInterval,
    fetchImpl: async () => {
      calls++;
      return {
        ok: true,
        json: async () => dataset([article(calls)], { lastCheckedAt: iso(time) })
      };
    }
  });
  assert.equal(calls, 1);
  globalThis.document.hidden = true;
  time += 300000;
  await timers.fire(300000);
  assert.equal(calls, 1);
  globalThis.document.hidden = false;
  time += 300000;
  await timers.fire(300000);
  assert.equal(calls, 2);
  assert.equal(node('list').children[0].children[0].href, article(2).url);
  assert.equal(node('refresh').disabled, false);
  assert.equal(root.attributes.get('aria-busy'), 'false');
  const timerIds = [...timers.active.keys()];
  cleanup();
  assert.deepEqual(timers.cleared, timerIds);
  assert.equal(timers.active.size, 0);
  await timers.fire(60000);
  await timers.fire(300000);
  assert.equal(calls, 2);
});
