import { canvasPixelRatio, streamlineCount, advanceStreamlines, drawStreamlineBatches } from './render-quality.js';
import { interpolateNullable, roundNullable, probabilityText } from './ui-state.js';
/**
 * ULTRA EDITION — Hyper-Visual Atmospheric Command OS Renderer (HTML5 Canvas)
 *
 * Visual Pipeline:
 * 1. Abyssal Bathymetric Grid + Taiwan Polar Radar Range Rings & Rotating Sweep Beam
 * 2. HDR Additive-Blended Multi-Octave Cyclone Cloud Vortex (Cyan / Violet / Crimson layers)
 * 3. Procedural Eyewall Lightning Bolts & Convective Flash Blooms
 * 4. Adaptive Pre-Warmed Bioluminescent Wind Streamline Ribbons (Rankine Vortex Physics)
 * 5. 3D-Extruded Neon Taiwan 22 Counties Choropleth + Tactical Target Reticle
 * 6. 360° Rotating Compass Storm Radii (7級 / 10級暴風圈) + Holographic 70% Forecast Cone
 */

import {
  TAIWAN_MAIN_COASTLINE,
  CENTRAL_MOUNTAIN_SPINE,
  COUNTY_POLYGONS,
  COUNTY_RINGS,
  COUNTY_LABEL_OFFSETS
} from './taiwan-geo.js';

const COS_LAT = Math.cos((23.5 * Math.PI) / 180);
const ISLANDS = new Set(['PEN', 'KIN', 'LIE']);
const BASE_BOUNDS = { minLon: 117.9, maxLon: 123.2, minLat: 21.4, maxLat: 26.7 };
const FONT = '"JetBrains Mono", "Inter", "Noto Sans TC", system-ui, sans-serif';

const ULTRA_STOPS = [
  [0, [16, 185, 129]],    // Cyber Emerald
  [38, [0, 242, 254]],    // Electric Cyan
  [62, [251, 191, 36]],   // Solar Amber
  [82, [249, 115, 22]],   // Plasma Orange
  [100, [255, 42, 95]]    // Supernova Crimson
];

export function getUltraProbColor(prob, alpha = 1) {
  if (!Number.isFinite(prob)) return `rgba(148, 163, 184, ${alpha})`;
  const p = Math.max(0, Math.min(100, prob || 0));
  for (let i = 0; i < ULTRA_STOPS.length - 1; i++) {
    const [t0, c0] = ULTRA_STOPS[i];
    const [t1, c1] = ULTRA_STOPS[i + 1];
    if (p <= t1) {
      const f = (p - t0) / (t1 - t0);
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
      return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
    }
  }
  const c = ULTRA_STOPS[ULTRA_STOPS.length - 1][1];
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Pre-render glowing HDR spiral cloud texture for additive blending
 */
function buildGlowVortexTexture(size, rgbInner, rgbOuter, seed, arms, density) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const R = size / 2;
  const rnd = mulberry32(seed);
  g.translate(R, R);

  const puff = (x, y, r, rgb, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb}, ${a})`);
    gr.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };

  // Intense eyewall ring
  for (let i = 0; i < 180; i++) {
    const a = rnd() * Math.PI * 2;
    const r = R * (0.1 + Math.pow(rnd(), 0.75) * 0.22);
    puff(Math.cos(a) * r, Math.sin(a) * r, R * (0.045 + rnd() * 0.06), rgbInner, 0.09);
  }

  // Spiral rainbands
  for (let arm = 0; arm < arms; arm++) {
    const base = (arm * Math.PI * 2) / arms + rnd() * 0.3;
    for (let i = 0; i < density; i++) {
      const f = Math.pow(rnd(), 0.85);
      const r = R * (0.14 + 0.82 * f) + (rnd() - 0.5) * R * 0.045;
      const theta = base + f * 3.8 + (rnd() - 0.5) * (0.22 + 0.22 * f);
      const rgb = f < 0.38 ? rgbInner : rgbOuter;
      puff(
        Math.cos(theta) * r,
        Math.sin(theta) * r,
        R * (0.025 + rnd() * 0.05) * (1 - 0.4 * f),
        rgb,
        0.075 * (1 - 0.7 * f)
      );
    }
  }

  // Carve out clear typhoon eye
  g.globalCompositeOperation = 'destination-out';
  const eye = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.085);
  eye.addColorStop(0, 'rgba(0,0,0,1)');
  eye.addColorStop(0.6, 'rgba(0,0,0,0.85)');
  eye.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = eye;
  g.beginPath();
  g.arc(0, 0, R * 0.085, 0, Math.PI * 2);
  g.fill();

  return c;
}

export class UltraTyphoonRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelectCounty = options.onSelectCounty || (() => {});
    this.onSelectStep = options.onSelectStep || (() => {});
    this.onInvalidate = options.onInvalidate;
    this.needsRender = true;

    this.scenario = null;
    this.floatStep = 0;
    this.selectedCountyId = 'ILA';
    this.hoveredCountyId = null;
    this.hoveredTrackIdx = -1;
    this.mouse = null;
    this.layers = { wind: true, cloud: true, radius: true, radar: true };

    this.bounds = { ...BASE_BOUNDS };
    this.boundsInitialized = false;
    this.time = 0;
    this.dpr = window.devicePixelRatio || 1;
    this.width = 0;
    this.height = 0;

    this.vortexCore = buildGlowVortexTexture(512, '255, 42, 95', '168, 85, 247', 17, 4, 560);
    this.vortexOuter = buildGlowVortexTexture(512, '0, 242, 254', '56, 189, 248', 31, 5, 520);

    this.countyHit = [];
    this.trackHit = [];
    this.streamlines = [];
    this.lightningBolts = [];

    this._bindEvents();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(300, Math.round(rect.height));
    const dpr = canvasPixelRatio(w, h, window.devicePixelRatio || 1);
    if (w === this.width && h === this.height && dpr === this.dpr) return;
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this._backgroundGradient = null;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this._recompute();
    this._initStreamlines(streamlineCount(w, h, true));
    this.invalidate();
  }

  _recompute() {
    const b = this.bounds;
    const pad = this.width < 520 ? 14 : 38;
    const latSpan = b.maxLat - b.minLat;
    const lonSpan = (b.maxLon - b.minLon) * COS_LAT;
    this.pxPerDeg = Math.min((this.width - pad * 2) / lonSpan, (this.height - pad * 2) / latSpan);
    this.pxPerKm = this.pxPerDeg / 111.2;
    this.cLat = (b.minLat + b.maxLat) / 2;
    this.cLon = (b.minLon + b.maxLon) / 2;
    const key = `${this.width}:${this.height}:${this.pxPerDeg}:${this.cLat}:${this.cLon}`;
    if (key !== this._projectionKey) {
      this._projectionKey = key;
      this._coastCache = null;
      this._countyPaths = new Map();
    }
  }

  latLonToXY(lat, lon) {
    return {
      x: this.width / 2 + (lon - this.cLon) * COS_LAT * this.pxPerDeg,
      y: this.height / 2 - (lat - this.cLat) * this.pxPerDeg
    };
  }

  xyToLatLon(x, y) {
    return {
      lat: this.cLat - (y - this.height / 2) / this.pxPerDeg,
      lon: this.cLon + (x - this.width / 2) / (COS_LAT * this.pxPerDeg)
    };
  }

  _computeTargetBounds(state) {
    const t = { ...BASE_BOUNDS };
    if (this.scenario?.hasTyphoon && state) {
      const ext = ((state.radius7km || 200) + (state.probRadius70km || 0) * 0.45) / 111.2 + 0.45;
      t.maxLon = Math.min(140, Math.max(t.maxLon, state.lon + ext / COS_LAT));
      t.minLon = Math.min(t.minLon, state.lon - ext / COS_LAT);
      t.minLat = Math.max(10, Math.min(t.minLat, state.lat - ext));
      t.maxLat = Math.min(34, Math.max(t.maxLat, state.lat + ext));
    }
    return t;
  }

  _updateBounds(state, dt) {
    const t = this._computeTargetBounds(state);
    if (!this.boundsInitialized || dt === 0) {
      this.bounds = { ...t };
      this.boundsInitialized = true;
    } else {
      const k = 1 - Math.exp(-dt * 5);
      for (const key of Object.keys(t)) {
        const delta = t[key] - this.bounds[key];
        this.bounds[key] = Math.abs(delta) < 0.0001 ? t[key] : this.bounds[key] + delta * k;
      }
    }
    this._recompute();
  }

  setScenario(scenario, stepIndex = 0) {
    this.scenario = scenario;
    this.setFloatStep(stepIndex);
    this.trackHit = [];
    this.countyHit = [];
    this.hoveredTrackIdx = -1;
    this.hoveredCountyId = null;
    this.mouse = null;
    this.boundsInitialized = false;
    const state = this.getInterpolatedState();
    this._updateBounds(state, 1);
    this._initStreamlines(streamlineCount(this.width || 800, this.height || 600, true), state);
    this._windRemainder = 0;
    this.invalidate();
  }

  setFloatStep(v) {
    if (!this.scenario) return;
    const next = Number.isFinite(v) ? Math.max(0, Math.min(this.scenario.timeline.length - 1, v)) : 0;
    if (next === this.floatStep) return;
    this.floatStep = next;
    this.invalidate();
  }

  invalidate() {
    this.needsRender = true;
    this.onInvalidate?.();
  }

  setSelectedCounty(id) {
    if (id === this.selectedCountyId) return;
    this.selectedCountyId = id;
    this.invalidate();
  }

  setLayerVisibility(key, visible) {
    if (this.layers[key] === visible) return;
    this.layers[key] = visible;
    this.invalidate();
  }

  getInterpolatedState() {
    if (!this.scenario || !this.scenario.timeline.length) return null;
    const tl = this.scenario.timeline;
    const i0 = Math.floor(this.floatStep);
    const i1 = Math.min(tl.length - 1, i0 + 1);
    const t = this.floatStep - i0;
    const s0 = tl[i0];
    const s1 = tl[i1];
    const lerp = (a, b) => interpolateNullable(a, b, t);
    const near = t < 0.5 ? s0 : s1;

    const counties = s0.counties.map((c0, i) => {
      const c1 = s1.counties.find((c) => c.id === c0.id) || c0;
      return {
        ...(t < 0.5 ? c0 : c1),
        probability: roundNullable(lerp(c0.probability, c1.probability)),
        distanceKm: roundNullable(lerp(c0.distanceKm, c1.distanceKm)),
        wind: {
          ...c0.wind,
          avgBeaufort: roundNullable(lerp(c0.wind.avgBeaufort, c1.wind.avgBeaufort)),
          gustBeaufort: roundNullable(lerp(c0.wind.gustBeaufort, c1.wind.gustBeaufort))
        },
        rain: {
          ...c0.rain,
          flatland24h: roundNullable(lerp(c0.rain.flatland24h, c1.rain.flatland24h)),
          mountain24h: roundNullable(lerp(c0.rain.mountain24h, c1.rain.mountain24h))
        }
      };
    });

    return {
      lat: lerp(s0.lat, s1.lat),
      lon: lerp(s0.lon, s1.lon),
      pressureHpa: roundNullable(lerp(s0.pressureHpa, s1.pressureHpa)),
      maxWindMs: roundNullable(lerp(s0.maxWindMs, s1.maxWindMs)),
      maxGustMs: roundNullable(lerp(s0.maxGustMs, s1.maxGustMs)),
      radius7km: roundNullable(lerp(s0.radius7km, s1.radius7km)),
      radius10km: roundNullable(lerp(s0.radius10km, s1.radius10km)),
      probRadius70km: roundNullable(lerp(s0.probRadius70km || 0, s1.probRadius70km || 0)),
      moveSpeedKmh: roundNullable(lerp(s0.moveSpeedKmh, s1.moveSpeedKmh)),
      moveDir: near.moveDir,
      offsetLabel: near.offsetLabel,
      timeDisplay: near.timeDisplay,
      phaseNote: near.phaseNote,
      counties
    };
  }

  _bindEvents() {
    const pos = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    this.canvas.addEventListener('mousemove', (e) => {
      const { x, y } = pos(e);
      this.mouse = { x, y };
      this.hoveredTrackIdx = -1;
      for (const n of this.trackHit) {
        if ((x - n.x) ** 2 + (y - n.y) ** 2 <= 120) {
          this.hoveredTrackIdx = n.index;
          break;
        }
      }
      this.hoveredCountyId = this.hoveredTrackIdx >= 0 ? null : this._countyAt(x, y);
      this.canvas.style.cursor = this.hoveredCountyId || this.hoveredTrackIdx >= 0 ? 'pointer' : 'crosshair';
      this.invalidate();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mouse = null;
      this.hoveredCountyId = null;
      this.hoveredTrackIdx = -1;
      this.invalidate();
    });

    this.canvas.addEventListener('click', (e) => {
      const { x, y } = pos(e);
      for (const n of this.trackHit) {
        if ((x - n.x) ** 2 + (y - n.y) ** 2 <= 120) {
          this.onSelectStep(n.index);
          return;
        }
      }
      const id = this._countyAt(x, y);
      if (id) {
        this.setSelectedCounty(id);
        this.onSelectCounty(id);
      }
    });
  }

  _countyAt(x, y) {
    for (const h of this.countyHit) {
      if (h.circle && (x - h.x) ** 2 + (y - h.y) ** 2 <= h.r * h.r) return h.id;
    }
    for (const h of this.countyHit) {
      if (h.rings) {
        let inside = false;
        for (const pts of h.rings) {
          if (pointInPoly(x, y, pts)) inside = !inside;
        }
        if (inside) return h.id;
      }
    }
    return null;
  }

  /* ----- Wind Streamlines ----- */

  _velocityAt(lat, lon, state) {
    const hasTy = Boolean(this.scenario?.hasTyphoon && state);
    const mx = -0.78, my = -0.62;
    if (!hasTy) {
      return { dLon: -0.025, dLat: -0.018, mag: 0.28 };
    }

    const dx = (lon - state.lon) * 111.2 * COS_LAT;
    const dy = (lat - state.lat) * 111.2;
    const d = Math.hypot(dx, dy) + 0.01;
    const r7 = state.radius7km || 250;
    const rmax = Math.max(28, (state.radius10km ?? 0) * 0.48);

    const a = 0.34;
    const vx = (-dy / d) * Math.cos(a) + (-dx / d) * Math.sin(a);
    const vy = (dx / d) * Math.cos(a) + (-dy / d) * Math.sin(a);
    const s = d < rmax ? d / rmax : Math.pow(rmax / d, 0.48);
    const w = Math.exp(-d / (r7 * 2.6));
    const ex = vx * s * w + mx * 0.25 * (1 - w);
    const ey = vy * s * w + my * 0.25 * (1 - w);
    const mag = Math.hypot(ex, ey);
    const ux = ex / (mag || 1);
    const uy = ey / (mag || 1);

    const spanScale = Math.max(0.75, (this.bounds.maxLon - this.bounds.minLon) / 8.2);
    const stepDeg = (0.016 + mag * 0.042) * spanScale;
    return {
      dLon: (ux * stepDeg) / COS_LAT,
      dLat: uy * stepDeg,
      mag
    };
  }

  _spawnStreamline(state, prewarm = false) {
    const padLon = (this.bounds.maxLon - this.bounds.minLon) * 0.06;
    const padLat = (this.bounds.maxLat - this.bounds.minLat) * 0.06;
    let lon = this.bounds.minLon - padLon + Math.random() * (this.bounds.maxLon - this.bounds.minLon + padLon * 2);
    let lat = this.bounds.minLat - padLat + Math.random() * (this.bounds.maxLat - this.bounds.minLat + padLat * 2);

    if (this.scenario?.hasTyphoon && state && Math.random() < 0.42) {
      const rDeg = 0.35 + Math.random() * 3.6;
      const theta = Math.random() * Math.PI * 2;
      lat = state.lat + Math.sin(theta) * rDeg;
      lon = state.lon + (Math.cos(theta) * rDeg) / COS_LAT;
    }

    const pts = [{ lat, lon }];
    let mag = 0.3;
    const steps = prewarm ? 11 : 3;
    for (let k = 0; k < steps; k++) {
      const v = this._velocityAt(lat, lon, state);
      lon += v.dLon;
      lat += v.dLat;
      mag = v.mag;
      pts.push({ lat, lon });
    }

    return {
      pts,
      mag,
      age: prewarm ? Math.floor(Math.random() * 75) : 0,
      maxAge: 70 + Math.floor(Math.random() * 55)
    };
  }

  _initStreamlines(count, state = null) {
    const st = state || this.getInterpolatedState();
    this.streamlines = Array.from({ length: count }, () => this._spawnStreamline(st, true));
  }

  /* ----- Render Loop ----- */

  render(dt = 1 / 60) {
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
    this._frameDt = dt;
    this.time += dt;
    const state = this.getInterpolatedState();
    this._updateBounds(state, dt);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const hasTy = Boolean(this.scenario?.hasTyphoon && state);

    this._drawAbyssalBase(ctx);
    if (this.layers.radar) this._drawTacticalRadarGrid(ctx);
    if (hasTy) this._drawHolographicCone(ctx);
    if (hasTy && this.layers.cloud) this._drawHDRCycloneVortex(ctx, state);
    this._drawNeonTaiwan(ctx, state);
    if (this.layers.wind) this._drawBioluminescentStreamlines(ctx, state);
    if (hasTy && this.layers.radius) this._drawTacticalStormRadii(ctx, state);
    if (hasTy) this._drawTrackAndVortexEye(ctx, state);
    this._drawHolographicCallouts(ctx, state);
    this._drawTooltipHUD(ctx, state);
    this.needsRender = false;
    return state;
  }

  _drawAbyssalBase(ctx) {
    if (!this._backgroundGradient) {
      const g = ctx.createRadialGradient(
        this.width * 0.45,
        this.height * 0.48,
        20,
        this.width * 0.5,
        this.height * 0.5,
        Math.max(this.width, this.height) * 0.85
      );
      g.addColorStop(0, '#07162c');
      g.addColorStop(0.55, '#040b18');
      g.addColorStop(1, '#02050b');
      this._backgroundGradient = g;
    }
    ctx.fillStyle = this._backgroundGradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  _drawTacticalRadarGrid(ctx) {
    ctx.save();
    const tl = this.xyToLatLon(0, 0);
    const br = this.xyToLatLon(this.width, this.height);
    const step = [1, 2, 5].find((s) => s * this.pxPerDeg >= 80) || 10;

    ctx.strokeStyle = 'rgba(0, 242, 254, 0.065)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let lon = Math.ceil(tl.lon / step) * step; lon <= br.lon; lon += step) {
      const { x } = this.latLonToXY(0, lon);
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, this.height);
    }
    for (let lat = Math.ceil(br.lat / step) * step; lat <= tl.lat; lat += step) {
      const { y } = this.latLonToXY(lat, 0);
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(this.width, Math.round(y) + 0.5);
    }
    ctx.stroke();

    // Polar radar range rings centered on Taiwan (23.7N, 121.0E)
    const twCenter = this.latLonToXY(23.75, 121.0);
    ctx.save();
    [150, 300, 450].forEach((km) => {
      const r = km * this.pxPerKm;
      ctx.beginPath();
      ctx.arc(twCenter.x, twCenter.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.07)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Rotating radar sweep beam
    const sweepAngle = (this.time * 0.65) % (Math.PI * 2);
    const sweepRadius = 450 * this.pxPerKm;
    ctx.translate(twCenter.x, twCenter.y);
    ctx.rotate(sweepAngle);
    const beamGrad = ctx.createLinearGradient(0, 0, sweepRadius, 0);
    beamGrad.addColorStop(0, 'rgba(0, 242, 254, 0.14)');
    beamGrad.addColorStop(1, 'rgba(0, 242, 254, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, sweepRadius, -0.22, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Coordinate labels
    ctx.font = `500 10px ${FONT}`;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.42)';
    ctx.textAlign = 'left';
    for (let lon = Math.ceil(tl.lon / step) * step; lon <= br.lon; lon += step) {
      const { x } = this.latLonToXY(0, lon);
      ctx.fillText(`${lon}°E`, x + 5, this.height - 9);
    }
    ctx.textAlign = 'right';
    for (let lat = Math.ceil(br.lat / step) * step; lat <= tl.lat; lat += step) {
      const { y } = this.latLonToXY(lat, 0);
      ctx.fillText(`${lat}°N`, this.width - 9, y - 5);
    }
    ctx.restore();
  }

  _drawHolographicCone(ctx) {
    const tl = this.scenario.timeline;
    if (tl.length < 2) return;

    ctx.save();
    const pts = tl.map((s) => {
      const p = this.latLonToXY(s.lat, s.lon);
      return { x: p.x, y: p.y, r: Math.max(6, (s.probRadius70km || 20) * this.pxPerKm) };
    });

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      ctx.beginPath();
      ctx.moveTo(a.x + nx * a.r, a.y + ny * a.r);
      ctx.lineTo(b.x + nx * b.r, b.y + ny * b.r);
      ctx.lineTo(b.x - nx * b.r, b.y - ny * b.r);
      ctx.lineTo(a.x - nx * a.r, a.y - ny * a.r);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 242, 254, 0.045)';
      ctx.fill();
    }

    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.14)';
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawHDRCycloneVortex(ctx, s) {
    const { x, y } = this.latLonToXY(s.lat, s.lon);
    const r7Px = (s.radius7km || 220) * this.pxPerKm;
    const r10Px = (s.radius10km ?? 0) * this.pxPerKm;
    const D = Math.max(100, r7Px * 2.55);
    const k = Math.max(0.5, Math.min(1.0, (s.maxWindMs || 35) / 52));
    const rot = -this.time * 0.35;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Outer cyan spiral cloud canopy
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * 0.55);
    ctx.globalAlpha = 0.68 * k;
    ctx.drawImage(this.vortexOuter, -D * 0.68, -D * 0.68, D * 1.36, D * 1.36);
    ctx.restore();

    // Inner violet-crimson convective core
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * 1.15);
    ctx.globalAlpha = 0.85 * k;
    ctx.drawImage(this.vortexCore, -D * 0.48, -D * 0.48, D * 0.96, D * 0.96);
    ctx.restore();

    // Dynamic multi-arm glowing plasma rainbands
    if (r7Px > 12) {
      ctx.save();
      ctx.translate(x, y);
      const arms = 4;
      for (let arm = 0; arm < arms; arm++) {
        const base = (arm * Math.PI * 2) / arms + rot * 1.35;
        ctx.beginPath();
        for (let step = 0; step <= 52; step++) {
          const f = step / 52;
          const r = Math.max(8, r10Px * 0.2) + f * (r7Px * 0.95);
          const theta = base + f * 3.25;
          const px = Math.cos(theta) * r;
          const py = Math.sin(theta) * r;
          if (step === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle =
          arm % 2 === 0
            ? 'rgba(255, 42, 95, 0.24)'
            : 'rgba(0, 242, 254, 0.22)';
        ctx.lineWidth = Math.max(6, r7Px * 0.09);
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();
    }

    // Procedural eyewall lightning flashes
    if (Math.random() < 1 - Math.pow(0.84, this._frameDt * 60) && r10Px > 12) {
      const a = Math.random() * Math.PI * 2;
      const r = r10Px * (0.25 + Math.random() * 0.65);
      this.lightningBolts.push({
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r,
        angle: a + (Math.random() - 0.5),
        len: Math.max(12, r10Px * 0.35),
        life: 1.0
      });
    }

    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const b = this.lightningBolts[i];
      b.life -= 0.14 * this._frameDt * 60;
      if (b.life <= 0) {
        this.lightningBolts.splice(i, 1);
        continue;
      }
      ctx.save();
      const flash = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.len * 1.2);
      flash.addColorStop(0, `rgba(224, 242, 254, ${b.life * 0.75})`);
      flash.addColorStop(0.4, `rgba(56, 189, 248, ${b.life * 0.35})`);
      flash.addColorStop(1, 'rgba(0, 242, 254, 0)');
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.len * 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 255, 255, ${b.life})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let cx = b.x, cy = b.y;
      ctx.moveTo(cx, cy);
      for (let seg = 0; seg < 4; seg++) {
        cx += Math.cos(b.angle + (seg % 2 === 0 ? 0.35 : -0.35)) * (b.len * 0.25);
        cy += Math.sin(b.angle + (seg % 2 === 0 ? 0.35 : -0.35)) * (b.len * 0.25);
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  _drawBioluminescentStreamlines(ctx, state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    advanceStreamlines(this, state, this._frameDt ?? 1 / 60);
    drawStreamlineBatches(ctx, this, [
      { min: 0.65, color: 'rgba(255, 42, 95, 0.68)', width: 1.65 },
      { min: 0.42, color: 'rgba(251, 191, 36, 0.56)', width: 1.3 },
      { min: -Infinity, color: 'rgba(0, 242, 254, 0.42)', width: 1.05 }
    ]);
    ctx.restore();
  }

  _coastPath() {
    if (this._coastCache) return this._coastCache;
    const p = new Path2D();
    TAIWAN_MAIN_COASTLINE.forEach(([la, lo], i) => {
      const { x, y } = this.latLonToXY(la, lo);
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    });
    p.closePath();
    this._coastCache = p;
    return p;
  }

  _buildCountyPath(id) {
    this._countyPaths ||= new Map();
    if (this._countyPaths.has(id)) return this._countyPaths.get(id);
    const rawRings = COUNTY_RINGS?.[id] || (COUNTY_POLYGONS[id] ? [COUNTY_POLYGONS[id]] : []);
    const path = new Path2D();
    const screenRings = [];
    for (const ring of rawRings) {
      const pts = ring.map(([la, lo]) => this.latLonToXY(la, lo));
      screenRings.push(pts);
      pts.forEach((pt, i) => (i === 0 ? path.moveTo(pt.x, pt.y) : path.lineTo(pt.x, pt.y)));
      path.closePath();
    }
    const geometry = { path, screenRings };
    this._countyPaths.set(id, geometry);
    return geometry;
  }

  _drawNeonTaiwan(ctx, state) {
    const byId = {};
    for (const c of state?.counties || []) byId[c.id] = c;
    const coast = this._coastPath();
    this.countyHit = [];

    // 3D Extruded Dark-Cyan Base Deck
    ctx.save();
    ctx.translate(0, 4.5);
    ctx.fillStyle = 'rgba(0, 242, 254, 0.16)';
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.fill(coast);
    ctx.stroke(coast);
    ctx.restore();

    // Outer Neon Rim Glow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 242, 254, 0.45)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#071529';
    ctx.fill(coast);
    ctx.restore();

    // Official NLSC 22-County Choropleth (with exact holes & offshore islands)
    let selectedPath = null;
    for (const id of Object.keys(COUNTY_POLYGONS)) {
      const { path, screenRings } = this._buildCountyPath(id);
      this.countyHit.push({ id, rings: screenRings });
      const prob = byId[id]?.probability;
      const isSel = id === this.selectedCountyId;
      const isHov = id === this.hoveredCountyId;
      if (isSel) selectedPath = path;

      ctx.fillStyle = getUltraProbColor(prob, isSel || isHov ? 0.82 : 0.52);
      ctx.fill(path, 'evenodd');
      ctx.strokeStyle = isSel ? '#ffffff' : 'rgba(226, 232, 240, 0.32)';
      ctx.lineWidth = isSel ? 1.8 : 0.85;
      ctx.stroke(path);
    }

    // Crisp Coastline Rim
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.85)';
    ctx.lineWidth = 1.25;
    ctx.stroke(coast);

    // Central Mountain Spine Laser Line
    ctx.beginPath();
    CENTRAL_MOUNTAIN_SPINE.forEach(([la, lo], i) => {
      const p = this.latLonToXY(la, lo);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    });
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.setLineDash([]);

    // Highlight selected county border on top
    if (selectedPath) {
      ctx.save();
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.0;
      ctx.stroke(selectedPath);
      ctx.restore();
    }

    // Outlying Archipelagos Tactical Radar Beacon Rings (around real island shapes)
    for (const id of ISLANDS) {
      const c = byId[id];
      const poly = COUNTY_POLYGONS[id];
      if (!poly) continue;
      const la = c?.lat ?? poly.reduce((s, p) => s + p[0], 0) / poly.length;
      const lo = c?.lon ?? poly.reduce((s, p) => s + p[1], 0) / poly.length;
      const { x, y } = this.latLonToXY(la, lo);
      const r = Math.max(9, Math.min(15, 16 * this.pxPerKm));
      this.countyHit.push({ id, circle: true, x, y, r: r + 4 });
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = id === this.selectedCountyId ? '#ffffff' : getUltraProbColor(c?.probability, 0.75);
      ctx.lineWidth = id === this.selectedCountyId ? 1.8 : 1.1;
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawTacticalStormRadii(ctx, s) {
    const { x, y } = this.latLonToXY(s.lat, s.lon);
    const r7 = (s.radius7km || 0) * this.pxPerKm;
    const r10 = (s.radius10km || 0) * this.pxPerKm;

    if (r7 > 5) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.045)';
      ctx.fill();
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Rotating 360° tactical compass ticks
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-this.time * 0.08);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.48)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 48; i++) {
        const a = (i * Math.PI * 2) / 48;
        const len = i % 4 === 0 ? 6 : 3;
        ctx.moveTo(Math.cos(a) * (r7 - len), Math.sin(a) * (r7 - len));
        ctx.lineTo(Math.cos(a) * r7, Math.sin(a) * r7);
      }
      ctx.stroke();
      ctx.restore();

      const a = -Math.PI / 4;
      ctx.font = `600 10.5px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(`7級暴風圈 · ${s.radius7km} KM`, x + Math.cos(a) * r7 + 7, y + Math.sin(a) * r7 - 6);
      ctx.restore();
    }

    if (r10 > 5) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 42, 95, 0.1)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 42, 95, 0.92)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      const a = (-3 * Math.PI) / 4;
      ctx.font = `600 10.5px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fda4af';
      ctx.fillText(`10級暴風圈 · ${s.radius10km} KM`, x + Math.cos(a) * r10 - 7, y + Math.sin(a) * r10 - 6);
      ctx.restore();
    }
  }

  _drawTrackAndVortexEye(ctx, s) {
    const tl = this.scenario.timeline;
    const pts = tl.map((st) => this.latLonToXY(st.lat, st.lon));
    this.trackHit = [];

    if (pts.length > 1) {
      ctx.save();
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Travelled segment with neon cyan glow
      const i0 = Math.floor(this.floatStep);
      const f = this.floatStep - i0;
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i <= i0; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (i0 < pts.length - 1) {
        ctx.lineTo(pts[i0].x + (pts[i0 + 1].x - pts[i0].x) * f, pts[i0].y + (pts[i0 + 1].y - pts[i0].y) * f);
      }
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    }

    const current = Math.round(this.floatStep);
    pts.forEach((p, i) => {
      this.trackHit.push({ index: i, x: p.x, y: p.y });
      const active = i === current;
      const hover = i === this.hoveredTrackIdx;
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, active || hover ? 5 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#ff2a5f' : '#00f2fe';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      const label = (tl[i].offsetLabel || '').replace(/\s*\(.*?\)\s*/g, '').trim();
      ctx.font = `${active ? 700 : 500} 10.5px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = active ? '#ffffff' : 'rgba(203, 213, 225, 0.8)';
      ctx.fillText(label, p.x + 9, p.y + 3.5);
      ctx.restore();
    });

    // Spinning Vortex Eye & Sonar Pulse
    const { x, y } = this.latLonToXY(s.lat, s.lon);
    const ph = (this.time % 1.8) / 1.8;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 7 + ph * 28, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 42, 95, ${0.65 * (1 - ph)})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.translate(x, y);
    ctx.rotate(-this.time * 2.2);
    ctx.shadowColor = '#ff2a5f';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      ctx.arc(0, 0, 10, k * Math.PI - Math.PI / 2, k * Math.PI + 0.15);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff2a5f';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  _drawHolographicCallouts(ctx, state) {
    if (!state?.counties) return;

    const isMobile = this.width < 520;
    const keyIds = new Set(
      isMobile
        ? ['KEE', 'TPE', 'TXG', 'TNN', 'KHH', 'PIF', 'ILA', 'HUA', 'TTT', 'PEN', 'KIN', 'LIE']
        : ['KEE', 'TPE', 'TYN', 'TXG', 'TNN', 'KHH', 'PIF', 'ILA', 'HUA', 'TTT', 'PEN', 'KIN', 'LIE']
    );

    const candidates = state.counties
      .filter((c) => c.id === this.selectedCountyId || c.id === this.hoveredCountyId || keyIds.has(c.id))
      .sort((a, b) => {
        const pa = a.id === this.selectedCountyId ? 2 : a.id === this.hoveredCountyId ? 1 : 0;
        const pb = b.id === this.selectedCountyId ? 2 : b.id === this.hoveredCountyId ? 1 : 0;
        if (pa !== pb) return pb - pa;
        const ia = ISLANDS.has(a.id) ? 0 : 1;
        const ib = ISLANDS.has(b.id) ? 0 : 1;
        if (ia !== ib) return ib - ia;
        return (b.probability ?? -1) - (a.probability ?? -1);
      });

    const placedBoxes = [];

    for (const c of candidates) {
      const isSel = c.id === this.selectedCountyId;
      const isHov = c.id === this.hoveredCountyId;

      const { x, y } = this.latLonToXY(c.lat, c.lon);
      const off = COUNTY_LABEL_OFFSETS[c.id] || { dx: 22, dy: 0 };
      const scale = isMobile ? 0.78 : 1;
      const lx = x + off.dx * scale;
      const ly = y + off.dy * scale;

      const text = `${c.name.slice(0, 2)} ${probabilityText(c.probability)}`;
      const fontSize = isSel ? (isMobile ? 10.5 : 11.5) : (isMobile ? 9.5 : 10.5);
      ctx.font = `${isSel ? 700 : 600} ${fontSize}px ${FONT}`;
      const tw = ctx.measureText(text).width;
      const padX = isMobile ? 4.5 : 6;
      const bw = tw + padX * 2;
      const bh = isMobile ? 16 : 18;
      let bx = off.dx === 0 ? lx - bw / 2 : off.dx > 0 ? lx : lx - bw;
      let by = ly - bh / 2;

      // Clamp inside canvas bounds
      bx = Math.max(4, Math.min(this.width - bw - 4, bx));
      by = Math.max(4, Math.min(this.height - bh - 4, by));

      if (!isSel && !isHov) {
        const margin = 3;
        const overlaps = placedBoxes.some(
          (b) =>
            bx < b.x + b.w + margin &&
            bx + bw + margin > b.x &&
            by < b.y + b.h + margin &&
            by + bh + margin > b.y
        );
        if (overlaps) continue;
      }
      placedBoxes.push({ x: bx, y: by, w: bw, h: bh });

      const col = getUltraProbColor(c.probability, 1);

      // Selected county rotating target reticle
      if (isSel) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.time * 1.2);
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 1.4;
        const r = 8;
        for (let k = 0; k < 4; k++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.arc(0, 0, r, -0.3, 0.3);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Leader line
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(off.dx === 0 ? bx + bw / 2 : off.dx > 0 ? bx : bx + bw, by + bh / 2);
      ctx.strokeStyle = isSel ? '#00f2fe' : 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = isSel ? 1.4 : 0.9;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, isSel ? 3 : 1.8, 0, Math.PI * 2);
      ctx.fillStyle = isSel ? '#ffffff' : col;
      ctx.fill();

      ctx.save();
      ctx.fillStyle = isSel ? 'rgba(6, 18, 38, 0.95)' : 'rgba(6, 15, 30, 0.84)';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 4);
      ctx.fill();
      ctx.strokeStyle = isSel ? '#00f2fe' : col;
      ctx.lineWidth = isSel ? 1.5 : 0.9;
      ctx.stroke();

      ctx.fillStyle = isSel ? '#ffffff' : '#e2e8f0';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + padX, by + bh / 2 + 0.5);
      ctx.restore();
    }
  }

  _drawTooltipHUD(ctx, state) {
    if (!this.mouse || !state) return;
    let text = null;
    if (this.hoveredCountyId) {
      const c = state.counties.find((d) => d.id === this.hoveredCountyId);
      if (c) text = `[TARGET] ${c.name} · 機率 ${probabilityText(c.probability)} · 陣風 ${c.wind.gustBeaufort ?? '—'}級`;
    } else if (this.hoveredTrackIdx >= 0) {
      const s = this.scenario.timeline[this.hoveredTrackIdx];
      if (!s) return;
      text = `${(s.offsetLabel || '').replace(/\s*\(.*?\)\s*/g, '')} · ${s.pressureHpa} hPa · ${s.maxWindMs} m/s`;
    }
    if (!text) return;

    ctx.font = `600 12px ${FONT}`;
    const w = ctx.measureText(text).width + 22;
    const h = 28;
    let x = this.mouse.x + 14;
    let y = this.mouse.y - h - 8;
    if (x + w > this.width - 8) x = this.mouse.x - w - 14;
    if (y < 8) y = this.mouse.y + 16;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 242, 254, 0.25)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(5, 14, 28, 0.94)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 11, y + h / 2 + 0.5);
    ctx.restore();
  }
}
