import { isStandbyDataset, sourcePresentation } from './ui-state.js';

export function renderStandby(data, scenario, documentImpl = document) {
  const standby = isStandbyDataset(data, scenario);
  documentImpl.documentElement?.setAttribute('data-monitoring', standby ? 'standby' : 'active');
  for (const id of ['forecast-dashboard', 'page-navigation', 'latest-news', 'storm-picker']) {
    const element = documentImpl.getElementById(id);
    if (element) element.hidden = standby;
  }
  const panel = documentImpl.getElementById('standby-panel');
  if (panel) panel.hidden = !standby;
  if (standby) {
    const since = documentImpl.getElementById('standby-since');
    if (since) since.textContent = sourcePresentation(data, scenario).standbySinceText;
    const interval = Number(data.monitoring.discoveryIntervalHours);
    const cadence = documentImpl.getElementById('standby-cadence');
    if (cadence) cadence.textContent = `系統約每 ${Number.isFinite(interval) && interval > 0 ? interval : 3} 小時檢查官方來源；有新的颱風系統時，會自動恢復預報與新聞更新。`;
    for (const id of ['scenario-select', 'btn-play', 'timeline-slider']) {
      const control = documentImpl.getElementById(id);
      if (control) control.disabled = true;
    }
  }
  return standby;
}

export function canResumeTracking(data, previousUpdatedAt, now = Date.now()) {
  const updated = Date.parse(data?.updatedAt);
  const previous = Date.parse(previousUpdatedAt);
  const observed = Date.parse(data?.officialSync?.observedAt);
  const interval = Number(data?.updateIntervalHours);
  const maxAgeMs = (Number.isFinite(interval) && interval > 0 ? interval * 2 : 6) * 3600000;
  return data?.monitoring?.mode === 'active' && data?.officialSync?.cwaStatus === 'active' &&
    data.officialSync.liveCycloneDetected === true && Number.isFinite(previous) &&
    Number.isFinite(updated) && updated > previous && updated <= now + 300000 && now - updated <= maxAgeMs &&
    Number.isFinite(observed) && observed <= now + 300000 && now - observed <= maxAgeMs &&
    Array.isArray(data.scenarios) && data.scenarios.length > 0 &&
    data.scenarios.some((scenario) => scenario?.id === data.defaultScenarioId) &&
    data.scenarios.every((scenario) => typeof scenario?.id === 'string' && scenario.id &&
      scenario.hasTyphoon === true && Array.isArray(scenario.timeline) && scenario.timeline.length > 0 &&
      scenario.timeline.every((point) => Array.isArray(point?.counties) && point.counties.length === 22));
}

export function canEnterStandby(data, previousUpdatedAt, now = Date.now()) {
  const updated = Date.parse(data?.updatedAt);
  const previous = Date.parse(previousUpdatedAt);
  const since = Date.parse(data?.monitoring?.standbySince);
  return isStandbyDataset(data) && data.officialSync.liveCycloneDetected === false &&
    Number.isFinite(previous) && updated > previous &&
    updated <= now + 300000 && since <= updated &&
    data.scenarios.some((scenario) => scenario?.id === data.defaultScenarioId) &&
    data.scenarios.every((scenario) => typeof scenario?.id === 'string' && scenario.id &&
      Array.isArray(scenario.timeline) && scenario.timeline.length === 1 &&
      scenario.timeline.every((point) => Array.isArray(point?.counties) && point.counties.length === 22 &&
        point.counties.every((county) => typeof county?.id === 'string' && county.id && county.probability === null) &&
        new Set(point.counties.map((county) => county.id)).size === 22));
}

// This checks the already-published JSON, never calls CWA from the browser.
// Only a tracking-mode transition reloads; ordinary active updates preserve controls.
export function startMonitoringRefresh(data, {
  fetchImpl = globalThis.fetch, now = () => Date.now(),
  documentImpl = globalThis.document, windowImpl = globalThis.window,
  reload = () => windowImpl.location.reload(),
  setIntervalImpl = globalThis.setInterval, clearIntervalImpl = globalThis.clearInterval,
  setTimeoutImpl = globalThis.setTimeout, clearTimeoutImpl = globalThis.clearTimeout
} = {}) {
  const wasStandby = isStandbyDataset(data);
  const wasActive = data?.officialSync?.cwaStatus === 'active' &&
    (data.monitoring === undefined || data.monitoring?.mode === 'active') &&
    Array.isArray(data.scenarios) && data.scenarios.some((scenario) => scenario?.hasTyphoon === true);
  if ((!wasStandby && !wasActive) || !Number.isFinite(Date.parse(data.updatedAt))) return () => {};
  let latestUpdatedAt = data.updatedAt;
  let timer = null;
  let pending = null;
  let disposed = false;
  let pageHidden = false;
  function cancelWork() {
    if (timer !== null) clearIntervalImpl(timer);
    timer = null;
    if (pending) {
      clearTimeoutImpl(pending.timeout);
      pending.controller.abort();
      pending = null;
    }
  }
  async function check() {
    if (disposed || pageHidden || documentImpl.hidden || pending) return;
    const ticket = { controller: new AbortController(), timeout: null };
    pending = ticket;
    ticket.timeout = setTimeoutImpl(() => {
      ticket.controller.abort();
      if (pending === ticket) pending = null;
    }, 10000);
    try {
      const response = await fetchImpl(`./data/typhoon-data.json?t=${now()}`, {
        signal: ticket.controller.signal, cache: 'no-store'
      });
      if (!response.ok) throw new Error('Published forecast unavailable');
      const next = await response.json();
      if (pending !== ticket || ticket.controller.signal.aborted || disposed ||
          pageHidden || documentImpl.hidden) return;
      const nextActive = canResumeTracking(next, latestUpdatedAt, now());
      const nextStandby = canEnterStandby(next, latestUpdatedAt, now());
      if ((wasStandby && nextActive) || (wasActive && nextStandby)) {
        dispose();
        reload();
      } else if (nextActive || nextStandby) {
        // Remember a newer same-mode publication so a later stale cache cannot
        // incorrectly switch this tab back to an older monitoring state.
        latestUpdatedAt = next.updatedAt;
      }
    } catch {
      // A failed check does not change the last published monitoring state.
    } finally {
      clearTimeoutImpl(ticket.timeout);
      if (pending === ticket) pending = null;
    }
  }
  function schedule(checkNow = false) {
    if (disposed || pageHidden || documentImpl.hidden) return;
    if (timer === null) timer = setIntervalImpl(check, 300000);
    if (checkNow) void check();
  }
  function visibilityChanged() {
    if (documentImpl.hidden) cancelWork();
    else schedule(true);
  }
  function pageHide() { pageHidden = true; cancelWork(); }
  function pageShow(event) {
    if (!pageHidden && !event?.persisted) return;
    pageHidden = false;
    schedule(true);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelWork();
    documentImpl.removeEventListener?.('visibilitychange', visibilityChanged);
    windowImpl?.removeEventListener?.('pagehide', pageHide);
    windowImpl?.removeEventListener?.('pageshow', pageShow);
  }
  documentImpl.addEventListener('visibilitychange', visibilityChanged);
  windowImpl?.addEventListener?.('pagehide', pageHide);
  windowImpl?.addEventListener?.('pageshow', pageShow);
  schedule();
  return dispose;
}
