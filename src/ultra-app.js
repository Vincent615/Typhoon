import { ownsKeyboardInput, compareCounties, sourcePresentation, probabilityText } from './ui-state.js';
import { UltraTyphoonRenderer, getUltraProbColor } from './ultra-renderer.js';

const $ = (id) => document.getElementById(id);
const RING_C = 2 * Math.PI * 41; // r = 41 in SVG plasma gauge
const BASE_PLAY_RATE = 0.34;
const SPEED_OPTIONS = [1, 2, 4];

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
  if (p >= 40) return '持續觀察警戒';
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

export class UltraApp {
  constructor() {
    this.data = null;
    this.scenario = null;
    this.floatStep = 0;
    this.targetStep = null;
    this.playing = false;
    this.speedIdx = 0;
    this.holdUntil = 0;
    this.selectedId = 'ILA';
    this.region = 'ALL';
    this.sort = 'prob';
    this.rows = new Map();
    this.displayProb = 0;
    this.targetProb = 0;
    this.lastTs = performance.now();
    this.lastSyncStep = null;
    this.lastMetaCheck = 0;
    this.lastOrderKey = null;
  }

  async init() {
    const res = await fetch(`./data/typhoon-data.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`資料載入失敗 (${res.status})`);
    this.data = await res.json();

    this.map = new UltraTyphoonRenderer($('typhoon-canvas'), {
      onSelectCounty: (id) => this.selectCounty(id),
      onSelectStep: (i) => this.goToStep(i)
    });

    this.renderMeta();
    this.bindControls();
    this.bindHoloEffects();
    this.selectScenario(this.data.defaultScenarioId || this.data.scenarios[0].id);
    this.setPlaying(true);
    requestAnimationFrame((ts) => this.loop(ts));
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
    const brief = cleanBrief(this.scenario?.aiMetadata?.executiveBrief || this.scenario?.summary || '');
    $('brief-text').textContent = brief;
    $('brief').hidden = !brief;
  }

  bindControls() {
    $('scenario-select').addEventListener('change', (e) => this.selectScenario(e.target.value));
    $('county-select')?.addEventListener('change', (e) => this.selectCounty(e.target.value));

    document.querySelectorAll('.q-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const on = btn.classList.toggle('on');
        this.map.setLayerVisibility(btn.dataset.layer, on);
      });
    });

    $('btn-play').addEventListener('click', () => this.setPlaying(!this.playing));

    $('btn-speed').addEventListener('click', () => {
      this.speedIdx = (this.speedIdx + 1) % SPEED_OPTIONS.length;
      $('btn-speed').textContent = `${SPEED_OPTIONS[this.speedIdx]}×`;
    });

    $('timeline-slider').addEventListener('input', (e) => {
      const nextStep = Number(e.target.value);
      this.setPlaying(false);
      this.targetStep = null;
      this.floatStep = Math.max(0, Math.min(this.scenario.timeline.length - 1, nextStep));
      this.syncPosition(true);
    });

    document.querySelectorAll('#region-tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#region-tabs button').forEach((b) => b.classList.toggle('on', b === btn));
        this.region = btn.dataset.region;
        this.applyFilter();
      });
    });

    $('btn-sort').addEventListener('click', () => {
      this.sort = this.sort === 'prob' ? 'geo' : 'prob';
      $('btn-sort').textContent = this.sort === 'prob' ? '⚡ 依機率' : '🧭 依地理';
      this.reorder(true);
    });

    $('brief-toggle').addEventListener('click', () => {
      const open = $('brief').classList.toggle('open');
      $('brief-toggle').textContent = open ? '收合' : '展開';
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

  /** Cursor-tracking specular spotlight & 3D perspective card tilt */
  bindHoloEffects() {
    document.querySelectorAll('[data-spotlight]').forEach((card) => {
      const hasTilt = card.hasAttribute('data-tilt');
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        card.style.setProperty('--mx', `${x}px`);
        card.style.setProperty('--my', `${y}px`);
        if (hasTilt) {
          const nx = (x / r.width - 0.5) * 2;
          const ny = (y / r.height - 0.5) * 2;
          card.style.setProperty('--rx', `${(-ny * 3.8).toFixed(2)}deg`);
          card.style.setProperty('--ry', `${(nx * 4.5).toFixed(2)}deg`);
        }
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--mx', '-999px');
        card.style.setProperty('--my', '-999px');
        if (hasTilt) {
          card.style.setProperty('--rx', '0deg');
          card.style.setProperty('--ry', '0deg');
        }
      });
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
    document.querySelector('.warp-timeline').style.opacity = n < 2 ? 0.45 : 1;

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
      const pct = (i / (tl.length - 1)) * 100;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tick';
      b.textContent = shortOffset(s.offsetLabel);
      b.style.left = `calc(${pct}% + ${8 - (16 * pct) / 100}px)`;
      b.addEventListener('click', () => this.goToStep(i));
      box.appendChild(b);
    });
  }

  buildRows() {
    const list = $('county-list');
    const cSelect = $('county-select');
    list.innerHTML = '';
    if (cSelect) cSelect.innerHTML = '';
    this.rows.clear();
    this.scenario.timeline[0].counties.forEach((c, geo) => {
      if (cSelect) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        cSelect.appendChild(opt);
      }
      const li = document.createElement('li');
      li.innerHTML = `
        <button type="button" class="m-row">
          <span class="m-rank">${String(geo + 1).padStart(2, '0')}</span>
          <span class="m-name">${c.name}</span>
          <span class="m-bar"><i></i></span>
          <span class="m-pct">0%</span>
        </button>`;
      li.querySelector('button').addEventListener('click', () => this.selectCounty(c.id));
      list.appendChild(li);
      this.rows.set(c.id, {
        el: li,
        geo,
        region: c.region,
        rank: li.querySelector('.m-rank'),
        bar: li.querySelector('i'),
        pct: li.querySelector('.m-pct')
      });
    });
    if (cSelect) cSelect.value = this.selectedId;
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
    this.map.setSelectedCounty(id);
    this.sync(true);
    this.renderGauge();
    const row = this.rows.get(id);
    if (row && !row.el.hidden) row.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  goToStep(i) {
    this.setPlaying(false);
    this.targetStep = Math.max(0, Math.min(this.scenario.timeline.length - 1, i));
  }

  setPlaying(on) {
    const n = this.scenario?.timeline.length || 0;
    const wasPlaying = this.playing;
    this.playing = Boolean(on && n > 1);
    if (this.playing) {
      this.targetStep = null;
      if (this.floatStep >= n - 1 - 1e-3) this.floatStep = 0;
      this.holdUntil = 0;
    }
    if (wasPlaying && !this.playing && this.map?.scenario === this.scenario) this.syncPosition(true);
    $('icon-play').hidden = this.playing;
    $('icon-pause').hidden = !this.playing;
    $('btn-play').setAttribute('aria-label', this.playing ? '暫停時間軸' : '播放時間軸');
  }

  loop(ts) {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    const n = this.scenario.timeline.length;
    const speed = SPEED_OPTIONS[this.speedIdx];

    if (this.targetStep !== null) {
      const d = this.targetStep - this.floatStep;
      if (Math.abs(d) < 0.002) {
        this.floatStep = this.targetStep;
        this.targetStep = null;
      } else {
        this.floatStep += d * Math.min(1, dt * 6);
      }
    } else if (this.playing && ts >= this.holdUntil) {
      if (this.floatStep >= n - 1) {
        this.floatStep = 0;
        this.holdUntil = ts + 450;
      } else {
        this.floatStep = Math.min(n - 1, this.floatStep + dt * BASE_PLAY_RATE * speed);
        if (this.floatStep >= n - 1) this.holdUntil = ts + 1400;
      }
    }

    this.map.setFloatStep(this.floatStep);
    const slider = $('timeline-slider');
    slider.value = String(this.floatStep);
    slider.style.setProperty('--fill', `${(this.floatStep / Math.max(1, n - 1)) * 100}%`);

    this.map.render(dt);

    if (this.floatStep !== this.lastSyncStep) {
      this.lastSyncStep = this.floatStep;
      this.sync(false);
    }
    if (ts - this.lastMetaCheck >= 60000) {
      this.lastMetaCheck = ts;
      this.renderSourceMeta();
    }

    // Damped spring interpolation for plasma gauge
    this.displayProb += (this.targetProb - this.displayProb) * Math.min(1, dt * 8);
    this.renderGauge();

    requestAnimationFrame((t) => this.loop(t));
  }

  syncPosition(force = false) {
    this.map.setFloatStep(this.floatStep);
    this.lastSyncStep = this.floatStep;
    $('timeline-slider').value = String(this.floatStep);
    this.sync(force);
    this.renderGauge();
  }

  renderGauge() {
    const known = Number.isFinite(this.targetProb);
    $('d-prob').textContent = known ? String(Math.round(this.displayProb)) : '—';
    const ring = $('d-ring');
    ring.style.strokeDashoffset = String(RING_C * (1 - (known ? this.displayProb : 0) / 100));
    ring.style.stroke = getUltraProbColor(known ? this.displayProb : null, 1);
  }

  sync(force) {
    const s = this.map.getInterpolatedState();
    if (!s) return;
    const hasTy = this.scenario.hasTyphoon;

    $('s-pressure').innerHTML = hasTy && Number.isFinite(s.pressureHpa) ? `${s.pressureHpa}<small>hPa</small>` : '—';
    $('s-wind').innerHTML = hasTy && Number.isFinite(s.maxWindMs) ? `${s.maxWindMs}<small>m/s</small>` : '—';
    $('s-radius').innerHTML = hasTy && s.radius7km ? `${s.radius7km}<small>km</small>` : '—';
    $('s-move').innerHTML = hasTy ? `${DIR[s.moveDir] || s.moveDir}<small>${s.moveSpeedKmh} km/h</small>` : '—';

    $('time-offset').textContent = shortOffset(s.offsetLabel);
    $('time-display').textContent = fmtTime(s.timeDisplay);
    const cur = Math.round(this.floatStep);
    document.querySelectorAll('#timeline-ticks .tick').forEach((b, i) => b.classList.toggle('on', i === cur));

    const knownProbabilities = s.counties.map((x) => x.probability).filter(Number.isFinite);
    const maxProb = knownProbabilities.length ? Math.max(...knownProbabilities) : null;
    $('peak-alert').textContent = `MAX ${probabilityText(maxProb)}`;
    $('peak-alert').style.color = getUltraProbColor(maxProb, 1);

    const c = s.counties.find((x) => x.id === this.selectedId) || s.counties[0];
    this.renderDetail(c, hasTy);

    s.counties.forEach((d) => {
      const r = this.rows.get(d.id);
      if (!r) return;
      const col = getUltraProbColor(d.probability, 1);
      r.pct.textContent = probabilityText(d.probability);
      r.pct.style.color = col;
      r.bar.style.width = `${d.probability ?? 0}%`;
      r.bar.style.backgroundColor = col;
      r.bar.style.boxShadow = `0 0 8px ${col}`;
      r.el.classList.toggle('on', d.id === this.selectedId);
    });

    const orderKey = [...s.counties]
      .sort((a, b) => compareCounties(a, b, this.rows, this.sort))
      .map((county) => county.id).join(',');
    if (force || orderKey !== this.lastOrderKey) this.reorder(!force);
    if (this.targetStep === null && (!this.playing || Number.isInteger(this.floatStep))) {
      this.displayProb = this.targetProb ?? 0;
    }
  }

  renderDetail(c, hasTy) {
    this.targetProb = c.probability;
    const col = getUltraProbColor(c.probability, 1);

    $('d-name').textContent = c.name;
    $('d-zone').textContent = hasTy ? `${c.commuterZone} · 距颱風眼 ${c.distanceKm} KM` : c.commuterZone;
    $('d-status').textContent = statusOf(c.probability);
    $('d-dot').style.backgroundColor = col;
    $('d-dot').style.color = col;

    if (!Number.isFinite(c.probability)) {
      $('m-wind').textContent = '—';
      $('m-rain').textContent = '—';
      $('m-wind-bar').style.width = '0%';
      $('m-rain-bar').style.width = '0%';
      $('m-rain-foot').textContent = '此資料未提供縣市風雨估算';
      $('d-note').textContent = '目前無颱風機率估算；天氣及停班停課情形請查官方公告。';
      $('d-note').hidden = false;
      $('m-wind-tag').textContent = '未估算';
      $('m-rain-tag').textContent = '未估算';
      $('m-wind-tag').className = 'tag-safe';
      $('m-rain-tag').className = 'tag-safe';
      return;
    }

    // Wind meter: 0–12 Beaufort, threshold at gust 10
    const windPass = c.wind.avgBeaufort >= 7 || c.wind.gustBeaufort >= 10;
    $('m-wind').textContent = `平均 ${c.wind.avgBeaufort} 級 · 陣風 ${c.wind.gustBeaufort} 級`;
    const wBar = $('m-wind-bar');
    const wCol = windPass ? '#ff2a5f' : '#00f2fe';
    wBar.style.width = `${Math.min(100, (c.wind.gustBeaufort / 12) * 100)}%`;
    wBar.style.backgroundColor = wCol;
    wBar.style.color = wCol;
    $('m-wind-mark').style.left = `${(10 / 12) * 100}%`;

    const wTag = $('m-wind-tag');
    wTag.textContent = windPass ? '已達標' : '未達標';
    wTag.className = windPass ? 'tag-pass' : 'tag-safe';

    // Rain meter: 0–1.5× threshold
    const hasMtn = c.rain.mountain24h !== c.rain.flatland24h;
    const ratio = Math.max(
      c.rain.flatland24h / c.rain.flatlandThreshold,
      hasMtn ? c.rain.mountain24h / c.rain.mountainThreshold : 0
    );
    const rainPass = ratio >= 1;
    $('m-rain').textContent = hasMtn
      ? `平地 ${c.rain.flatland24h} · 山區 ${c.rain.mountain24h} mm`
      : `${c.rain.flatland24h} mm`;
    const rBar = $('m-rain-bar');
    const rCol = rainPass ? '#ff2a5f' : '#00f2fe';
    rBar.style.width = `${Math.min(100, (ratio / 1.5) * 100)}%`;
    rBar.style.backgroundColor = rCol;
    rBar.style.color = rCol;
    $('m-rain-mark').style.left = `${(1 / 1.5) * 100}%`;
    $('m-rain-foot').textContent = hasMtn
      ? `門檻：平地 ${c.rain.flatlandThreshold} / 山區 ${c.rain.mountainThreshold} mm`
      : `門檻：${c.rain.flatlandThreshold} mm`;

    const rTag = $('m-rain-tag');
    rTag.textContent = rainPass ? '已達標' : '未達標';
    rTag.className = rainPass ? 'tag-pass' : 'tag-safe';

    const note = $('d-note');
    if (c.mountainAlert) {
      const areas = c.mountainAlert.split('預估')[0].trim();
      note.textContent = `⚠ 山區致災預警：${areas} 山區雨量可能優先達標，留意鄉鎮區獨立停班課公告。`;
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  }

  /** FLIP animated rank reordering */
  reorder(animate) {
    const s = this.map.getInterpolatedState();
    if (!s) return;
    const list = $('county-list');
    const before = new Map();
    if (animate) this.rows.forEach((r, id) => !r.el.hidden && before.set(id, r.el.getBoundingClientRect().top));

    const sorted = [...s.counties].sort((a, b) => compareCounties(a, b, this.rows, this.sort));
    this.lastOrderKey = sorted.map((county) => county.id).join(',');
    sorted.forEach((c, idx) => {
      const r = this.rows.get(c.id);
      r.rank.textContent = String(idx + 1).padStart(2, '0');
      list.appendChild(r.el);
    });

    if (!animate) return;
    before.forEach((top, id) => {
      const el = this.rows.get(id).el;
      const dy = top - el.getBoundingClientRect().top;
      if (!dy) return;
      el.style.transition = 'none';
      el.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.52s cubic-bezier(0.2, 0.7, 0.2, 1)';
        el.style.transform = '';
      });
    });
  }
}

if (typeof window !== 'undefined') window.addEventListener('DOMContentLoaded', () => {
  new UltraApp().init().catch((err) => {
    console.error(err);
    document.querySelector('.map-wrap').insertAdjacentHTML(
      'beforeend',
      `<p style="position:absolute;inset:0;display:grid;place-items:center;color:#94a3b8;font-size:14px">資料載入失敗，請稍後重新整理</p>`
    );
  });
});
