import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WINDOW_DAYS = 7;
const MAX_ARTICLES = 12;
const MAX_FEED_BYTES = 2 * 1024 * 1024;
const DAY_MS = 86_400_000;
const ATOM_NAMESPACE = 'http://www.w3.org/2005/Atom';

// Publisher-operated feeds, verified 2026-10-21. CNA's RSS terms require
// attribution as 中央通訊社 and non-commercial use: https://www.cna.com.tw/about/rss.aspx
// Only headlines, dates and links are published; feed excerpts are used for filtering only.
export const NEWS_SOURCES = Object.freeze([
  Object.freeze({
    id: 'cna', name: '中央通訊社',
    url: 'https://feeds.feedburner.com/rsscna/lifehealth',
    siteUrl: 'https://www.cna.com.tw/',
    articleHost: 'www.cna.com.tw',
    articlePath: /^\/news\/[a-z]+\/\d{12}\.aspx$/
  }),
  Object.freeze({
    id: 'pts', name: '公視新聞網',
    url: 'https://news.pts.org.tw/xml/newsfeed.xml',
    siteUrl: 'https://news.pts.org.tw/',
    articleHost: 'news.pts.org.tw',
    articlePath: /^\/article\/\d+$/
  })
]);

function decodeXml(value) {
  return value.replace(/&([^;\s<>&]+);|&/g, (match, entity) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (Object.hasOwn(named, entity)) return named[entity];
    if (/^#(?:[0-9]+|x[0-9a-f]+)$/i.test(entity || '')) {
      const point = entity[1].toLowerCase() === 'x'
        ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      if ((point === 9 || point === 10 || point === 13 || point >= 32)
        && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)) {
        return String.fromCodePoint(point);
      }
    }
    throw new Error('Unrecognized XML entity');
  });
}

// A deliberately limited XML reader: balanced elements, quoted attributes and
// CDATA only; no DTD, external entity resolution, script execution or HTML repair.
function parseXml(xml) {
  if (typeof xml !== 'string' || !xml.trim() || Buffer.byteLength(xml) > MAX_FEED_BYTES) {
    throw new Error('Empty or oversized news feed');
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML declarations are not allowed');
  const document = { name: '#document', children: [], text: '' };
  const stack = [document];
  const tokens = /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/g;
  let cursor = 0;
  let nodes = 0;
  for (const match of xml.matchAll(tokens)) {
    if (match.index !== cursor) throw new Error('Malformed XML');
    const token = match[0];
    cursor += token.length;
    const current = stack.at(-1);
    if (token.startsWith('<!--') || token.startsWith('<?')) continue;
    if (token.startsWith('<![CDATA[')) {
      if (stack.length === 1) throw new Error('CDATA outside root');
      current.text += token.slice(9, -3);
    } else if (token.startsWith('</')) {
      const close = /^<\/([A-Za-z_][\w.:-]*)\s*>$/.exec(token);
      if (!close || stack.length === 1 || current.name !== close[1]) throw new Error('Unbalanced XML');
      stack.pop();
    } else if (token.startsWith('<')) {
      const opening = /^<([A-Za-z_][\w.:-]*)([\s\S]*?)(\/?)>$/.exec(token);
      if (!opening || ++nodes > 15_000 || stack.length > 32) throw new Error('Unsupported XML');
      const attributes = Object.create(null);
      let remaining = opening[2];
      while (remaining.trim()) {
        const attribute = /^\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(remaining);
        if (!attribute || Object.hasOwn(attributes, attribute[1])) throw new Error('Malformed XML attribute');
        attributes[attribute[1]] = decodeXml(attribute[2] ?? attribute[3]);
        remaining = remaining.slice(attribute[0].length);
      }
      const node = { name: opening[1], attributes, children: [], text: '' };
      current.children.push(node);
      if (!opening[3]) stack.push(node);
    } else {
      current.text += decodeXml(token);
    }
  }
  if (cursor !== xml.length || stack.length !== 1 || document.children.length !== 1 || document.text.trim()) {
    throw new Error('Incomplete XML document');
  }
  return document.children[0];
}

const children = (node, name) => node.children.filter((child) => child.name === name);
const child = (node, name) => children(node, name)[0];
const textContent = (node) => node ? `${node.text}${node.children.map(textContent).join(' ')}` : '';
function plainText(value) {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#(?:[0-9]+|x[0-9a-f]+));/gi, (entity) => decodeXml(entity))
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function publicationTime(value) {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.exec(text);
  const rfc = /^(?:[A-Za-z]{3},\s*)?(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+(GMT|[+-]\d{4})$/.exec(text);
  if (!iso && !rfc) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month, day, hour, minute, second] = iso
    ? iso.slice(1, 7).map((part) => Number(part || 0))
    : [Number(rfc[3]), months.indexOf(rfc[2]) + 1, Number(rfc[1]), Number(rfc[4]), Number(rfc[5]), Number(rfc[6] || 0)];
  const calendar = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (year < 2000 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59
    || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() + 1 !== month || calendar.getUTCDate() !== day) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? time : null;
}

function safeArticleUrl(raw, source) {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || url.hostname !== source.articleHost || url.username || url.password
      || (url.port && url.port !== '443') || !source.articlePath.test(url.pathname)) return null;
    // These publishers identify articles entirely by path. Remove tracking queries
    // and fragments so the same story cannot occupy multiple slots.
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

const TYPHOON_TOPIC = /颱風|台風|熱帶低壓|熱帶性低氣壓|暴風圈/;
const WEATHER_ALERT = /海上警報|陸上警報|海警|陸警/;
const TAIWAN_CONTEXT = /台灣|臺灣|氣象署|中央氣象局|台北|臺北|新北|基隆|桃園|新竹|苗栗|台中|臺中|彰化|南投|雲林|嘉義|台南|臺南|高雄|屏東|宜蘭|花蓮|台東|臺東|澎湖|金門|馬祖|蘭嶼|綠島/;

function normalizeArticle({ title: rawTitle, url: rawUrl, date, dateKind, context = '' }, source, nowMs, cached = false) {
  const title = plainText(rawTitle);
  const url = safeArticleUrl(rawUrl, source);
  const time = publicationTime(date);
  if (!title || title.length > 300 || !url || time === null || time > nowMs || time < nowMs - WINDOW_DAYS * DAY_MS) return null;
  const plainContext = plainText(context);
  // 海警 can mean coast guard in unrelated political news. An abbreviated
  // weather-alert headline therefore also needs cyclone context in its excerpt.
  if (!(TYPHOON_TOPIC.test(title) || (WEATHER_ALERT.test(title) && TYPHOON_TOPIC.test(plainContext)))
    || !TAIWAN_CONTEXT.test(`${title} ${plainContext}`)) return null;
  return {
    id: createHash('sha256').update(url).digest('hex').slice(0, 20),
    title, url, sourceId: source.id, sourceName: source.name,
    publishedAt: new Date(time).toISOString(),
    // Earlier snapshots did not record the timestamp's kind. PTS's verified
    // feed supplies updated only, so keep its old cache labelled as an update.
    dateKind: dateKind === 'published' || dateKind === 'updated' ? dateKind : source.id === 'pts' ? 'updated' : 'published',
    cached
  };
}

export function parseNewsFeed(xml, source, { now = new Date() } = {}) {
  const root = parseXml(xml);
  const nowMs = new Date(typeof now === 'function' ? now() : now).getTime();
  if (!Number.isFinite(nowMs)) throw new Error('Invalid news check time');
  let entries;
  let atom = false;
  if (root.name === 'rss' && root.attributes.version === '2.0') {
    const channels = children(root, 'channel');
    if (channels.length !== 1) throw new Error('RSS channel missing');
    const channel = channels[0];
    if (!textContent(child(channel, 'title')).trim()
      || !textContent(child(channel, 'link')).trim()
      || !textContent(child(channel, 'description')).trim()) throw new Error('RSS metadata missing');
    entries = children(channel, 'item');
  } else if (root.name === 'feed' && root.attributes.xmlns === ATOM_NAMESPACE) {
    atom = true;
    if (!textContent(child(root, 'title')).trim() || !textContent(child(root, 'id')).trim()
      || publicationTime(textContent(child(root, 'updated'))) === null) throw new Error('Atom metadata missing');
    entries = children(root, 'entry');
  } else {
    throw new Error('Unsupported news feed format');
  }
  if (entries.length > 1000) throw new Error('Too many news entries');
  const articles = [];
  for (const entry of entries) {
    if (children(entry, 'title').length !== 1
      || !children(entry, 'link').length
      || (atom ? !child(entry, 'published') && !child(entry, 'updated') : !child(entry, 'pubDate'))) {
      throw new Error('News entry metadata missing');
    }
    const url = atom
      ? children(entry, 'link').find((link) => !link.attributes.rel || link.attributes.rel === 'alternate')?.attributes.href || ''
      : textContent(child(entry, 'link'));
    // PTS supplies Atom updated but no published. It is the publisher-supplied
    // article timestamp; do not replace it with the fetch or feed update time.
    const date = textContent(atom ? child(entry, 'published') || child(entry, 'updated') : child(entry, 'pubDate'));
    const title = textContent(child(entry, 'title'));
    // Malformed required values mean the source could not be read reliably.
    // Do this before age/topic filtering so a damaged feed cannot look like a
    // successful empty result and erase the last known good articles.
    if (!plainText(title) || !url.trim()) throw new Error('News entry metadata invalid');
    if (publicationTime(date) === null) throw new Error('News entry date invalid');
    const article = normalizeArticle({
      title, url, date,
      dateKind: atom && !child(entry, 'published') ? 'updated' : 'published',
      context: textContent(child(entry, atom ? 'summary' : 'description'))
    }, source, nowMs);
    if (article) articles.push(article);
  }
  return articles;
}

async function readFeed(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > MAX_FEED_BYTES) throw new Error('Oversized news feed');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty news response');
  const parts = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FEED_BYTES) throw new Error('Oversized news feed');
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(parts));
}

function validPreviousTime(value, nowMs) {
  const parsed = typeof value === 'string' ? publicationTime(value) : null;
  return parsed !== null && parsed <= nowMs ? new Date(parsed).toISOString() : null;
}

export async function buildNewsDataset({ fetchImpl = fetch, now = () => new Date(), previousData = null } = {}) {
  const nowMs = new Date(typeof now === 'function' ? now() : now).getTime();
  if (!Number.isFinite(nowMs)) throw new Error('Invalid news check time');
  const checkedAt = new Date(nowMs).toISOString();
  const results = await Promise.all(NEWS_SOURCES.map(async (source) => {
    const previousSource = (Array.isArray(previousData?.sources) ? previousData.sources : [])
      .find((item) => item?.id === source.id);
    try {
      const response = await fetchImpl(source.url, {
        signal: AbortSignal.timeout(15_000),
        headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }
      });
      const articles = parseNewsFeed(await readFeed(response), source, { now: checkedAt });
      return {
        source: { id: source.id, name: source.name, url: source.url, siteUrl: source.siteUrl,
          status: articles.length ? 'ok' : 'empty', lastCheckedAt: checkedAt, lastSuccessfulAt: checkedAt },
        articles
      };
    } catch (error) {
      const articles = (Array.isArray(previousData?.articles) ? previousData.articles : [])
        .filter((article) => article?.sourceId === source.id)
        .map((article) => normalizeArticle({
          title: typeof article.title === 'string' ? article.title : '',
          url: typeof article.url === 'string' ? article.url : '',
          date: typeof article.publishedAt === 'string' ? article.publishedAt : '',
          dateKind: article.dateKind,
          context: '台灣颱風' // It already passed the source-context filter on its successful fetch.
        }, source, nowMs, true)).filter(Boolean);
      return {
        source: { id: source.id, name: source.name, url: source.url, siteUrl: source.siteUrl,
          status: 'error', lastCheckedAt: checkedAt,
          lastSuccessfulAt: validPreviousTime(previousSource?.lastSuccessfulAt, nowMs),
          error: error instanceof Error ? error.message.slice(0, 160) : 'News source unavailable' },
        articles
      };
    }
  }));
  const failures = results.filter((result) => result.source.status === 'error').length;
  const seen = new Set();
  const articles = results.flatMap((result) => result.articles)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.url.localeCompare(b.url))
    .filter((article) => {
      const key = article.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, MAX_ARTICLES);
  return {
    schemaVersion: 1,
    status: failures === NEWS_SOURCES.length ? 'stale' : failures ? 'partial' : articles.length ? 'ok' : 'empty',
    lastCheckedAt: checkedAt,
    // This is the last complete successful refresh; partial success is visible
    // through each source's own lastSuccessfulAt.
    lastSuccessfulAt: failures ? validPreviousTime(previousData?.lastSuccessfulAt, nowMs) : checkedAt,
    windowDays: WINDOW_DAYS,
    articles,
    sources: results.map(({ source }) => ({
      ...source, articleCount: articles.filter((article) => article.sourceId === source.id).length
    }))
  };
}

export async function writeNewsDatasetAtomic(dataset, outputPath = path.join(ROOT_DIR, 'data/news.json')) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(dataset, null, 2)}\n`, { flag: 'wx' });
    await fs.rename(temporaryPath, outputPath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

async function main() {
  const outputPath = path.join(ROOT_DIR, 'data/news.json');
  let previousData = null;
  try {
    previousData = JSON.parse(await fs.readFile(outputPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Previous news data unreadable; checking sources without cache.');
  }
  const dataset = await buildNewsDataset({ previousData });
  await writeNewsDatasetAtomic(dataset, outputPath);
  console.log(`News ${dataset.status}: ${dataset.articles.length} articles; checked ${dataset.lastCheckedAt}`);
  if (dataset.status === 'stale') process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(`News update failed: ${error.message}`);
    process.exitCode = 1;
  });
}
