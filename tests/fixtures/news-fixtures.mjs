// Synthetic content, shaped after the official feeds verified 2026-10-21.
// CNA RSS documentation/attribution terms: https://www.cna.com.tw/about/rss.aspx
// PTS's public /xml/newsfeed.xml endpoint currently supplies Atom, not RSS.
export const NEWS_NOW = '2026-10-20T16:00:00.000Z';
export const RSS_DATE = 'Tue, 20 Oct 2026 23:00:00 +0800';
export const ATOM_DATE = '2026-10-20T22:00:00+08:00';
export function rssItem({
  title = '測試颱風逼近台灣 氣象署提醒防雨',
  url = 'https://www.cna.com.tw/news/ahel/202610200001.aspx',
  date = RSS_DATE,
  description = '氣象署提醒台灣民眾留意最新颱風資訊。'
} = {}) {
  return `<item><title><![CDATA[${title}]]></title><link>${url}</link><pubDate>${date}</pubDate><description><![CDATA[${description}]]></description></item>`;
}
export function rssFeed(items = [rssItem()]) {
  return `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>測試 RSS</title><link>https://www.cna.com.tw/</link><description>測試用新聞</description>${items.join('')}</channel></rss>`;
}
export function atomEntry({
  title = '測試颱風接近 氣象署發布海警',
  url = 'https://news.pts.org.tw/article/800001',
  date = ATOM_DATE,
  published = '',
  summary = '測試新聞：颱風接近台灣。'
} = {}) {
  return `<entry><title><![CDATA[${title}]]></title><link rel="alternate" href="${url}" /><id>${url}</id><summary><![CDATA[${summary}]]></summary>${published ? `<published>${published}</published>` : ''}<updated>${date}</updated></entry>`;
}
export function atomFeed(entries = [atomEntry()]) {
  return `<feed xmlns="http://www.w3.org/2005/Atom"><id>https://news.pts.org.tw/xml/newsfeed.xml</id><title>測試 Atom</title><updated>${ATOM_DATE}</updated>${entries.join('')}</feed>`;
}
export function newsFetch({ cna = rssFeed(), pts = atomFeed(), failures = [] } = {}) {
  return async (url) => {
    const id = url.includes('feedburner') ? 'cna' : 'pts';
    if (failures.includes(id)) throw new Error(`${id} unavailable`);
    return new Response(id === 'cna' ? cna : pts, { headers: { 'Content-Type': 'application/xml' } });
  };
}
