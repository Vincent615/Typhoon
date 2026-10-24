const PUBLISHERS = {
  cna: { name: '中央通訊社', host: 'www.cna.com.tw', url: 'https://www.cna.com.tw/list/ahel.aspx' },
  pts: { name: '公視新聞網', host: 'news.pts.org.tw', url: 'https://news.pts.org.tw/' }
};
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_MS = 6 * 60 * 60 * 1000;

export function safeNewsUrl(value, sourceId) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password ||
        url.port || url.hostname !== PUBLISHERS[sourceId]?.host) return null;
    return url.href;
  } catch {
    return null;
  }
}

function formatTime(value) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '時間未提供';
  return new Date(time).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

export function newsViewModel(payload, now = Date.now()) {
  if (!payload || payload.schemaVersion !== 1 || !['ok', 'empty', 'partial', 'stale'].includes(payload.status) || !Array.isArray(payload.articles) ||
      !Array.isArray(payload.sources)) throw new Error('Invalid news dataset');
  const sources = new Map(payload.sources.map(source => [source.id, source]));
  const seen = new Set();
  const articles = payload.articles.filter(article => {
    const time = Date.parse(article.publishedAt);
    const url = safeNewsUrl(article.url, article.sourceId);
    if (!url || typeof article.title !== 'string' || !article.title.trim() ||
        !Number.isFinite(time) || time < now - WINDOW_MS || time > now + 300000) return false;
    return true;
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter(article => {
      const url = safeNewsUrl(article.url, article.sourceId);
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    }).slice(0, 12)
    .map(article => ({
      ...article,
      url: safeNewsUrl(article.url, article.sourceId),
      title: article.title.trim(),
      sourceName: PUBLISHERS[article.sourceId].name,
      cached: article.cached === true || sources.get(article.sourceId)?.status === 'error'
    }));
  const checked = Date.parse(payload.lastCheckedAt);
  const stale = payload.status === 'stale' || !Number.isFinite(checked) ||
    now - checked > STALE_MS || checked > now + 300000;
  const failed = payload.sources.filter(source => source.status === 'error')
    .map(source => PUBLISHERS[source.id]?.name).filter(Boolean);
  let status;
  if (stale) {
    const previous = payload.lastSuccessfulAt ? `上次成功取得 ${formatTime(payload.lastSuccessfulAt)}。` : '';
    status = `新聞暫未更新。${previous}${articles.length ? '以下保留近 7 天已取得的報導。' : '請前往媒體網站查看最新報導。'}`;
  } else if (payload.status === 'partial' || failed.length) {
    status = `${failed.join('、') || '部分來源'}暫時無法更新，仍顯示可取得的報導。最近檢查 ${formatTime(payload.lastCheckedAt)}。`;
  } else {
    status = `最近檢查 ${formatTime(payload.lastCheckedAt)}，依新聞時間排序。`;
  }
  const emptyMessage = stale
    ? '目前沒有可顯示的已取得新聞，請前往下方媒體網站查看。'
    : payload.status === 'partial' || failed.length
      ? '可用來源暫無符合條件的報導，其餘來源尚未能完成更新。'
      : '近 7 天暫無符合條件的颱風新聞，可前往下方媒體網站查看。';
  return { articles, stale, status, empty: articles.length === 0, emptyMessage };
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function renderNews(root, model, expanded = false) {
  const list = root.querySelector('[data-news-list]');
  list.replaceChildren();
  root.querySelector('[data-news-status]').textContent = model.status;
  root.querySelector('[data-news-empty]').hidden = !model.empty;
  root.querySelector('[data-news-empty]').textContent = model.emptyMessage;
  for (const [index, article] of model.articles.entries()) {
    const item = node('li', 'news-item');
    item.hidden = !expanded && index >= 6;
    const link = node('a', 'news-link');
    link.href = article.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const metadata = node('div', 'news-meta');
    metadata.append(node('span', 'news-source', article.sourceName));
    const dateLabel = article.dateKind === 'updated' ? '更新 ' : article.dateKind === 'published' ? '發布 ' : '';
    const time = node('time', '', `${dateLabel}${formatTime(article.publishedAt)}`);
    time.dateTime = article.publishedAt;
    metadata.append(time);
    if (article.cached) metadata.append(node('span', 'news-cached', '上次取得'));
    link.append(metadata, node('h3', 'news-title', article.title));
    link.append(node('span', 'news-read', '閱讀原文 ↗'));
    item.append(link);
    list.append(item);
  }
  const more = root.querySelector('[data-news-more]');
  more.hidden = model.articles.length <= 6;
  more.textContent = expanded ? '收合消息' : `顯示其餘 ${model.articles.length - 6} 則消息`;
  more.setAttribute('aria-expanded', String(expanded));
}

export async function mountNews(root, {
  fetchImpl = globalThis.fetch, now = () => Date.now(),
  autoRefresh = typeof window !== 'undefined',
  setIntervalImpl = globalThis.setInterval, clearIntervalImpl = globalThis.clearInterval
} = {}) {
  if (!root) return;
  let payload = null;
  let expanded = false;
  let renderedState = '';
  const refresh = root.querySelector('[data-news-refresh]');
  const more = root.querySelector('[data-news-more]');
  function paint() {
    if (!payload) return;
    const model = newsViewModel(payload, now());
    const nextState = JSON.stringify([model, expanded]);
    if (nextState === renderedState) return;
    renderNews(root, model, expanded);
    renderedState = nextState;
  }
  async function load() {
    if (refresh.disabled) return;
    refresh.disabled = true;
    root.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetchImpl(`./data/news.json?t=${now()}`, { signal: controller.signal });
      if (!response.ok) throw new Error('News request failed');
      const next = await response.json();
      newsViewModel(next, now());
      payload = next;
      paint();
    } catch {
      if (payload) {
        payload = { ...payload, status: 'stale' };
        paint();
      }
      else {
        root.querySelector('[data-news-status]').textContent = '暫時無法載入新聞，請稍後重新載入，或前往下方媒體網站查看。';
        root.querySelector('[data-news-empty]').hidden = true;
      }
    } finally {
      clearTimeout(timeout);
      refresh.disabled = false;
      root.setAttribute('aria-busy', 'false');
    }
  }
  refresh.addEventListener('click', load);
  more.addEventListener('click', () => {
    expanded = !expanded;
    paint();
  });
  await load();
  const timers = autoRefresh ? [
    setIntervalImpl(paint, 60000),
    setIntervalImpl(() => { if (!document.hidden) load(); }, 300000)
  ] : [];
  return () => timers.forEach(timer => clearIntervalImpl(timer));
}
