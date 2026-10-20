const INTERACTIVE_SELECTOR = [
  'button', 'a[href]', 'input', 'select', 'textarea', 'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]', '[role="link"]', '[role="slider"]', '[role="textbox"]'
].join(', ');

export function ownsKeyboardInput(event) {
  return event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey ||
    Boolean(event.target?.isContentEditable || event.target?.closest?.(INTERACTIVE_SELECTOR));
}

export function interpolateNullable(a, b, t) {
  if (t === 0) return a;
  if (t === 1) return b;
  return Number.isFinite(a) && Number.isFinite(b) ? a + (b - a) * t : null;
}

export function roundNullable(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

export function probabilityText(value) {
  return Number.isFinite(value) ? `${value}%` : '—';
}

export function compareCounties(a, b, rows, sort) {
  const geo = rows.get(a.id).geo - rows.get(b.id).geo;
  if (sort !== 'prob') return geo;
  const aProb = Number.isFinite(a.probability) ? a.probability : -1;
  const bProb = Number.isFinite(b.probability) ? b.probability : -1;
  return bProb - aProb || geo;
}

function displayTime(value) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '未提供';
  return new Date(time).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

export function sourcePresentation(data, scenario, now = Date.now()) {
  const generatedAt = Date.parse(data.updatedAt);
  const observedAt = scenario?.observedAt || data.officialSync?.observedAt;
  const observedTime = Date.parse(observedAt);
  const interval = Number(data.updateIntervalHours);
  const maxAgeMs = (Number.isFinite(interval) && interval > 0 ? interval * 2 : 6) * 3600000;
  const maxClockSkewMs = 5 * 60000;
  const confirmedCalm = data.officialSync?.cwaStatus === 'no_active' && scenario?.hasTyphoon === false;
  const generatedStale = !Number.isFinite(generatedAt) || now - generatedAt > maxAgeMs ||
    generatedAt - now > maxClockSkewMs;
  const observedStale = !Number.isFinite(observedTime) || now - observedTime > maxAgeMs ||
    observedTime - now > maxClockSkewMs;
  const stale = generatedStale || (!confirmedCalm && observedStale);
  const warning = stale ? ' · 資料過期或時刻未確認，請查官方最新消息' : '';
  const observation = confirmedCalm ? '官方來源確認無活躍颱風' : `官方觀測 ${displayTime(observedAt)}`;
  return {
    stale,
    live: Boolean(scenario?.isLiveOfficial && !stale),
    text: `資料產生 ${displayTime(data.updatedAt)} · ${observation}${warning}`
  };
}
