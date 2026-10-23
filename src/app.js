import { initializeAnimation, observeAnimation, requestFrame, runAnimationFrame, updateTimeline, setText, setHTML, setStyle, setAttribute, setProperty, setClass } from './animation-clock.js';
import { ownsKeyboardInput, compareCounties, sourcePresentation, probabilityText } from './ui-state.js';
import { TyphoonMapRenderer, getProbabilityColor } from './map-renderer.js';

const $ = (id) => document.getElementById(id);
const RING_C = 2 * Math.PI * 38;
const PLAY_RATE = 0.32; // timeline steps per second

const DIR = {
  N: '北', NNE: '北北東', NE: '東北', ENE: '東北東', E: '東', ESE: '東南東', SE: '東南', SSE: '南南東',
  S: '南', SSW: '南南西', SW: '西南', WSW: '西南西', W: '西', WNW: '西北西', NW: '西北', NNW: '北北西',
  stationary: '滯留'
};

const shortOffset = (s = '') => s.replace(/\s*\(.*?\)\s*/g, '').trim() || s;

function fmtTime(str = '') {
  const m = str.match(/(\d{1,2})月(\d{1,2})日\s*(\d{1,2})(?::(\d{2}))?/);
  if (m) return `${m[1]}/${m[2]} ${m[3].padStart(2, '0')}:${m[4] || '00'}`;
  return str.replace(/\s*\(.*?\)\s*/g, '');
}

export function statusOf(p) {
  if (!Number.isFinite(p)) return '無颱風機率估算';
  if (p >= 85) return '極可能停班停課';
  if (p >= 65) return '可能停班停課';
  if (p >= 40) return '持續觀察';
  return '停班停課機率較低';
}

function cleanBrief(t = '') {
  return t
    .replace(/\*\*[^*]+\*\*[:：]?/g, '')
    .replace(/^\s*【[^】]*】/, '')
    .replace(/^\s*(AI\s*)?決策總結(摘要)?[:：]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class App {
  constructor() {
    this.data = null;
    this.scenario = null;
    this.floatStep = 0;
    this.targetStep = null;
    this.playing = false;
    this.holdUntil = 0;
    this.selectedId = 'KEE';
    this.region = 'ALL';
    this.sort = 'prob';
    this.rows = new Map();
    this.displayProb = 0;
    this.targetProb = 0;
    this.lastTs = performance.now();
    this.lastSyncStep = null;
    this.lastMetaCheck = 0;
    this.lastOrderKey = null;
    initializeAnimation(this);
  }

  async init() {
    const res = await fetch(`./data/typhoon-data.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`資料載入失敗 (${res.status})`);
    this.data = await res.json();

    this.map = new TyphoonMapRenderer($('typhoon-canvas'), {
      onSelectCounty: (id) => this.selectCounty(id),
      onSelectStep: (i) => this.goToStep(i),
      onInvalidate: () => this.requestFrame()
    });

    observeAnimation(this);

    this.renderMeta();
    this.bindControls();
    this.selectScenario(this.data.defaultScenarioId || this.data.scenarios[0].id);
    this.animationStarted = true;
    this.requestFrame();
  }

  renderMeta() {
    const select = $('scenario-select');
    select.innerHTML = '';
    for (const s of this.data.scenarios) {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.name.replace(/\s*\(.*?\)\s*$/, '');
      select.appendChild(o);
    }
    select.disabled = this.data.scenarios.length <= 1;
  }

  renderSourceMeta() {
    const status = sourcePresentation(this.data, this.scenario);
    $('updated-at').textContent = status.text;
    $('live-dot').hidden = !status.live;
    $('live-dot').title = status.live ? '中央氣象署資料，觀測時刻見右側' : '';
    const coverageNote = [this.scenario?.forecastCoverage?.note, this.scenario?.modelAvailabilityNote]
      .filter(Boolean).join(' ');
    $('forecast-coverage').textContent = coverageNote;
    $('forecast-coverage').hidden = !coverageNote;
    const brief = cleanBrief(this.scenario?.aiMetadata?.executiveBrief || this.scenario?.summary || '');
    $('brief-text').textContent = brief;
    $('brief').hidden = !brief;
  }

  bindControls() {
    $('scenario-select').addEventListener('change', (e) => this.selectScenario(e.target.value));
    $('county-select')?.addEventListener('change', (e) => this.selectCounty(e.target.value));
    $('map-county-select')?.addEventListener('change', (e) => this.selectCounty(e.target.value));

    document.querySelectorAll('.tool').forEach((btn) => {
      btn.addEventListener('click', () => {
        const on = btn.classList.toggle('on');
        btn.setAttribute('aria-pressed', String(on));
        this.map.setLayerVisibility(btn.dataset.layer, on);
      });
    });

    $('btn-play').addEventListener('click', () => this.setPlaying(!this.playing));

    $('timeline-slider').addEventListener('input', (e) => {
      const nextStep = Number(e.target.value);
      this.setPlaying(false);
      this.targetStep = null;
      this.floatStep = Math.max(0, Math.min(this.scenario.timeline.length - 1, nextStep));
      this.syncPosition(true);
    });

    document.querySelectorAll('#region-tabs button').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.region === this.region));
      btn.addEventListener('click', () => {
        document.querySelectorAll('#region-tabs button').forEach((b) => {
          b.classList.toggle('on', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
        this.region = btn.dataset.region;
        this.applyFilter();
      });
    });

    $('btn-sort').addEventListener('click', () => {
      this.sort = this.sort === 'prob' ? 'geo' : 'prob';
      $('btn-sort').textContent = this.sort === 'prob' ? '依機率' : '依地理';
      this.reorder(true);
    });

    $('brief-toggle').addEventListener('click', () => {
      const open = $('brief').classList.toggle('open');
      $('brief-toggle').textContent = open ? '收合' : '展開';
      $('brief-toggle').setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('keydown', (e) => {
      if (ownsKeyboardInput(e)) return;
      const n = this.scenario?.timeline.length || 1;
      if (e.key === 'ArrowRight') this.goToStep(Math.min(n - 1, Math.round(this.floatStep) + 1));
      else if (e.key === 'ArrowLeft') this.goToStep(Math.max(0, Math.round(this.floatStep) - 1));
      else if (e.key === ' ') this.setPlaying(!this.playing);
      else return;
      e.preventDefault();
    });
  }

  selectScenario(id) {
    const sc = this.data.scenarios.find((s) => s.id === id) || this.data.scenarios[0];
    this.scenario = sc;
    $('scenario-select').value = sc.id;
    this.renderSourceMeta();

    const n = sc.timeline.length;
    this.floatStep = Math.max(0, Math.min(n - 1, sc.defaultStepIndex ?? 0));
    this.targetStep = null;
    this.setPlaying(false);

    const slider = $('timeline-slider');
    slider.max = String(Math.max(1, n - 1));
    slider.disabled = n < 2;
    $('btn-play').disabled = n < 2;
    document.querySelector('.timeline').style.opacity = n < 2 ? 0.45 : 1;

    this.buildTicks();
    this.map.setScenario(sc, this.floatStep);
    this.map.setSelectedCounty(this.selectedId);
    this.buildRows();
    this.lastOrderKey = null;
    this.syncPosition(true);
  }

  buildTicks() {
    const box = $('timeline-ticks');
    box.innerHTML = '';
    const tl = this.scenario.timeline;
    if (tl.length < 2) return;
    tl.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tick';
      b.textContent = shortOffset(s.offsetLabel);
      b.setAttribute('aria-label', `${shortOffset(s.offsetLabel)}，${fmtTime(s.timeDisplay)}`);
      b.addEventListener('click', () => this.goToStep(i));
      box.appendChild(b);
    });
  }

  buildRows() {
    const list = $('county-list');
    const cSelect = $('county-select');
    const mapSelect = $('map-county-select');
    list.innerHTML = '';
    if (cSelect) cSelect.innerHTML = '';
    if (mapSelect) mapSelect.innerHTML = '';
    this.rows.clear();
    this.scenario.timeline[0].counties.forEach((c, geo) => {
      if (cSelect) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        cSelect.appendChild(opt);
      }
      if (mapSelect) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        mapSelect.appendChild(opt);
      }
      const li = document.createElement('li');
      li.innerHTML = `<button type="button" class="row"><span class="n">${c.name}</span><span class="b"><i></i></span><span class="p">0</span></button>`;
      li.querySelector('button').addEventListener('click', () => this.selectCounty(c.id));
      list.appendChild(li);
      this.rows.set(c.id, {
        el: li, geo, region: c.region, bar: li.querySelector('i'), pct: li.querySelector('.p')
      });
    });
    if (cSelect) {
      cSelect.value = this.selectedId;
      cSelect.disabled = this.rows.size === 0;
    }
    if (mapSelect) {
      mapSelect.value = this.selectedId;
      mapSelect.disabled = this.rows.size === 0;
    }
    this.applyFilter();
  }

  applyFilter() {
    this.rows.forEach((r) => {
      r.el.hidden = this.region !== 'ALL' && r.region !== this.region;
    });
  }

  selectCounty(id) {
    this.selectedId = id;
    if ($('county-select')) $('county-select').value = id;
    if ($('map-county-select')) $('map-county-select').value = id;
    this.map.setSelectedCounty(id);
    this.syncPosition(true);
    const row = this.rows.get(id);
    // Mobile uses the page scroll; selecting a county must not pull readers down to its ranking.
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 681px) and (hover: hover) and (pointer: fine)').matches && row && !row.el.hidden) {
      row.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  goToStep(i) {
    this.setPlaying(false);
    this.targetStep = Math.max(0, Math.min(this.scenario.timeline.length - 1, i));
    if (this.animationStarted) this.lastTs = performance.now();
    this.requestFrame();
  }

  setPlaying(on) {
    const n = this.scenario?.timeline.length || 0;
    const wasPlaying = this.playing;
    if (this.animationStarted) this.lastTs = performance.now();
    this.playing = Boolean(on && n > 1);
    if (wasPlaying !== this.playing) this.frameBudget.reset();
    if (this.playing) {
      this.targetStep = null;
      if (this.floatStep >= n - 1 - 1e-3) this.floatStep = 0;
      this.holdUntil = 0;
    }
    if (wasPlaying && !this.playing && this.map?.scenario === this.scenario) this.syncPosition(true);
    $('icon-play').toggleAttribute('hidden', this.playing);
    $('icon-pause').toggleAttribute('hidden', !this.playing);
    $('btn-play').setAttribute('aria-label', this.playing ? '暫停' : '播放');
    $('btn-play').setAttribute('aria-pressed', String(this.playing));
    if ($('play-label')) $('play-label').textContent = this.playing ? '暫停' : '播放';
    this.requestFrame();
  }

  requestFrame() {
    requestFrame(this);
  }

  loop(ts) {
    runAnimationFrame(this, ts, { rate: PLAY_RATE, easing: 5.5, startHold: 500, endHold: 1600 });
  }

  syncPosition(force = false) {
    this.map.setFloatStep(this.floatStep);
    this.lastSyncStep = this.floatStep;
    updateTimeline(this);
    this.sync(force);
    this.displayProb = Number.isFinite(this.targetProb) ? this.targetProb : 0;
    this.renderGauge();
    this.positionDirty = false;
    this.requestFrame();
  }

  renderGauge() {
    const known = Number.isFinite(this.targetProb);
    setText($('d-prob'), known ? String(Math.round(this.displayProb)) : '—');
    const ring = $('d-ring');
    setStyle(ring, 'strokeDashoffset', String(RING_C * (1 - (known ? this.displayProb : 0) / 100)));
    setStyle(ring, 'stroke', getProbabilityColor(known ? this.displayProb : null));
  }

  sync(force) {
    const s = this.map.getInterpolatedState();
    if (!s) return;
    const hasTy = this.scenario.hasTyphoon;

    setHTML($('s-pressure'), hasTy && Number.isFinite(s.pressureHpa) ? `${s.pressureHpa}<small>hPa</small>` : '—');
    setHTML($('s-wind'), hasTy && Number.isFinite(s.maxWindMs) ? `${s.maxWindMs}<small>m/s</small>` : '—');
    setHTML($('s-radius'), hasTy && s.radius7km ? `${s.radius7km}<small>km</small>` : '—');
    const movement = Number.isFinite(s.moveSpeedKmh) ? `${s.moveSpeedKmh} km/h` : (s.moveSpeedText || '未提供');
    setHTML($('s-move'), hasTy ? `${DIR[s.moveDir] || s.moveDir}<small>${movement}</small>` : '—');

    setText($('time-offset'), shortOffset(s.offsetLabel));
    setText($('time-display'), fmtTime(s.timeDisplay));
    const cur = Math.round(this.floatStep);
    document.querySelectorAll('#timeline-ticks .tick').forEach((b, i) => {
      setClass(b, 'on', i === cur);
      setAttribute(b, 'aria-pressed', String(i === cur));
    });
    setAttribute($('timeline-slider'), 'aria-valuetext', `${shortOffset(s.offsetLabel)}，${fmtTime(s.timeDisplay)}`);

    const c = s.counties.find((x) => x.id === this.selectedId) || s.counties[0];
    this.renderDetail(c, hasTy);

    s.counties.forEach((d) => {
      const r = this.rows.get(d.id);
      if (!r) return;
      setText(r.pct, Number.isFinite(d.probability) ? d.probability : '—');
      setStyle(r.bar, 'width', `${d.probability ?? 0}%`);
      setStyle(r.bar, 'backgroundColor', getProbabilityColor(d.probability));
      setClass(r.el, 'on', d.id === this.selectedId);
    });

    this.reorder(false, s.counties);
    if (this.targetStep === null && (!this.playing || Number.isInteger(this.floatStep))) {
      this.displayProb = this.targetProb ?? 0;
    }
  }

  renderDetail(c, hasTy) {
    this.targetProb = c.probability;
    setText($('d-name'), c.name);
    setText($('d-zone'), hasTy ? `${c.commuterZone} · 距中心 ${c.distanceKm} km` : c.commuterZone);
    setText($('d-status'), statusOf(c.probability));
    setStyle($('d-dot'), 'backgroundColor', getProbabilityColor(c.probability));

    if (!Number.isFinite(c.probability)) {
      setText($('m-wind'), '—');
      setText($('m-rain'), '—');
      setStyle($('m-wind-bar'), 'width', '0%');
      setStyle($('m-rain-bar'), 'width', '0%');
      setText($('m-rain-foot'), '此資料未提供縣市風雨估算');
      setText($('d-note'), (c.riskLevel === 'unknown' && c.aiReasoning) || '目前無颱風機率估算；天氣及停班停課情形請查官方公告。');
      setProperty($('d-note'), 'hidden', false);
      return;
    }

    // Wind: scale 0–12 級, threshold at gust 10
    const windPass = c.wind.avgBeaufort >= 7 || c.wind.gustBeaufort >= 10;
    setText($('m-wind'), `平均 ${c.wind.avgBeaufort} 級 · 陣風 ${c.wind.gustBeaufort} 級`);
    const wBar = $('m-wind-bar');
    setStyle(wBar, 'width', `${Math.min(100, (c.wind.gustBeaufort / 12) * 100)}%`);
    setStyle(wBar, 'backgroundColor', windPass ? getProbabilityColor(88) : '#9AA8AC');
    setStyle($('m-wind-mark'), 'left', `${(10 / 12) * 100}%`);

    // Rain: scale to 1.5× threshold
    const hasMtn = c.rain.mountain24h !== c.rain.flatland24h;
    const ratio = Math.max(
      c.rain.flatland24h / c.rain.flatlandThreshold,
      hasMtn ? c.rain.mountain24h / c.rain.mountainThreshold : 0
    );
    const rainPass = ratio >= 1;
    setText($('m-rain'), hasMtn
      ? `平地 ${c.rain.flatland24h} · 山區 ${c.rain.mountain24h} mm`
      : `${c.rain.flatland24h} mm`);
    const rBar = $('m-rain-bar');
    setStyle(rBar, 'width', `${Math.min(100, (ratio / 1.5) * 100)}%`);
    setStyle(rBar, 'backgroundColor', rainPass ? getProbabilityColor(88) : '#9AA8AC');
    setStyle($('m-rain-mark'), 'left', `${(1 / 1.5) * 100}%`);
    setText($('m-rain-foot'), hasMtn
      ? `標準：平地 ${c.rain.flatlandThreshold} · 山區 ${c.rain.mountainThreshold} mm`
      : `標準：${c.rain.flatlandThreshold} mm`);

    const note = $('d-note');
    if (c.mountainAlert) {
      const areas = c.mountainAlert.split('預估')[0].trim();
      setText(note, `${areas} 山區雨量可能先達標，留意獨立停班課公告。`);
      setProperty(note, 'hidden', false);
    } else {
      setProperty(note, 'hidden', true);
    }
  }

  /** Reorder rows; animate with FLIP so ranks glide instead of jumping. */
  reorder(animate, counties = this.map.getInterpolatedState()?.counties) {
    if (!counties) return;
    const sorted = [...counties].sort((a, b) => compareCounties(a, b, this.rows, this.sort));
    const orderKey = sorted.map((county) => county.id).join(',');
    if (orderKey === this.lastOrderKey) return;
    this.lastOrderKey = orderKey;
    const list = $('county-list');
    const before = new Map();
    if (animate) this.rows.forEach((r, id) => !r.el.hidden && before.set(id, r.el.getBoundingClientRect().top));

    sorted.forEach((c) => list.appendChild(this.rows.get(c.id).el));

    if (!animate) return;
    before.forEach((top, id) => {
      const el = this.rows.get(id).el;
      const dy = top - el.getBoundingClientRect().top;
      if (!dy) return;
      setStyle(el, 'transition', 'none');
      setStyle(el, 'transform', `translateY(${dy}px)`);
      requestAnimationFrame(() => {
        setStyle(el, 'transition', 'transform 0.5s cubic-bezier(0.2, 0.7, 0.2, 1)');
        setStyle(el, 'transform', '');
      });
    });
  }
}

if (typeof window !== 'undefined') window.addEventListener('DOMContentLoaded', () => {
  new App().init().catch((err) => {
    console.error(err);
    document.querySelector('.map-wrap').insertAdjacentHTML(
      'beforeend',
      `<p style="position:absolute;inset:0;display:grid;place-items:center;color:#6B665F;font-size:14px">資料載入失敗，請稍後重新整理</p>`
    );
  });
});
