import { interpolateNullable, roundNullable, probabilityText } from './ui-state.js';
/**
 * Typhoon Map Renderer (HTML5 Canvas — Editorial Morandi Cartography)
 *
 * - Auto-framing camera: smoothly frames Taiwan and the storm (including wind radii).
 * - Multi-layered cyclonic spiral rainbands + procedural cloud texture rotating counter-clockwise
 *   with differential angular velocity (inner eyewall faster, outer bands slower).
 * - Silky long-tail wind streamlines (pre-warmed 16-segment trails along a Rankine vortex
 *   blended with the background northeasterly monsoon flow).
 * - Forecast uncertainty cone rendered as a single union mask.
 * - Clean county choropleth clipped to Taiwan's coastline with non-overlapping callouts.
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
const FONT = '"Inter", "Noto Sans TC", system-ui, sans-serif';

const INK = '#3A3734';
const INK_2 = '#6B665F';
const HALO = 'rgba(250, 248, 245, 0.94)';

/* ---------- Morandi Colour Ramp ---------- */

const PROB_STOPS = [
  [0, [163, 179, 158]],   // sage green
  [40, [214, 193, 146]],  // warm sand
  [65, [203, 151, 124]],  // terracotta clay
  [85, [165, 104, 98]],   // dusty rose
  [100, [138, 82, 80]]    // deep rosewood
];

export function getProbabilityColor(prob, alpha = 1) {
  if (!Number.isFinite(prob)) return `rgba(148, 163, 184, ${alpha})`;
  const p = Math.max(0, Math.min(100, prob || 0));
  for (let i = 0; i < PROB_STOPS.length - 1; i++) {
    const [t0, c0] = PROB_STOPS[i];
    const [t1, c1] = PROB_STOPS[i + 1];
    if (p <= t1) {
      const f = (p - t0) / (t1 - t0);
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
      return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
    }
  }
  const c = PROB_STOPS[PROB_STOPS.length - 1][1];
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

/* ---------- Helpers ---------- */

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

function haloText(ctx, text, x, y, opts = {}) {
  const { size = 11, weight = 500, color = INK, align = 'left', halo = HALO } = opts;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = halo;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function buildCloudTexture(size, rgb, seed, arms, density) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const R = size / 2;
  const rnd = mulberry32(seed);
  g.translate(R, R);

  const puff = (x, y, r, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb}, ${a})`);
    gr.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };

  for (let i = 0; i < 220; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.pow(rnd(), 0.7) * R * 0.32;
    puff(Math.cos(a) * r, Math.sin(a) * r, R * (0.05 + rnd() * 0.07), 0.09);
  }

  for (let arm = 0; arm < arms; arm++) {
    const base = (arm * Math.PI * 2) / arms + rnd() * 0.4;
    for (let i = 0; i < density; i++) {
      const f = Math.pow(rnd(), 0.85);
      const r = R * (0.15 + 0.8 * f) + (rnd() - 0.5) * R * 0.05;
      const theta = base + f * 3.6 + (rnd() - 0.5) * (0.26 + 0.24 * f);
      puff(Math.cos(theta) * r, Math.sin(theta) * r, R * (0.025 + rnd() * 0.05) * (1 - 0.45 * f), 0.08 * (1 - 0.72 * f));
    }
  }

  g.globalCompositeOperation = 'destination-out';
  const eye = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.085);
  eye.addColorStop(0, 'rgba(0,0,0,1)');
  eye.addColorStop(0.55, 'rgba(0,0,0,0.85)');
  eye.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = eye;
  g.beginPath();
  g.arc(0, 0, R * 0.085, 0, Math.PI * 2);
  g.fill();

  const edge = g.createRadialGradient(0, 0, R * 0.62, 0, 0, R);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = edge;
  g.fillRect(-R, -R, size, size);
  return c;
}

/* ---------- Renderer ---------- */

export class TyphoonMapRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelectCounty = options.onSelectCounty || (() => {});
    this.onSelectStep = options.onSelectStep || (() => {});

    this.scenario = null;
    this.floatStep = 0;
    this.selectedCountyId = null;
    this.hoveredCountyId = null;
    this.hoveredTrackIdx = -1;
    this.mouse = null;
    this.layers = { wind: true, cloud: true, radius: true };

    this.bounds = { ...BASE_BOUNDS };
    this.boundsInitialized = false;
    this.time = 0;
    this.dpr = window.devicePixelRatio || 1;
    this.width = 0;
    this.height = 0;

    this.coneCanvas = document.createElement('canvas');
    this.cctx = this.coneCanvas.getContext('2d');

    this.cloudShadow = buildCloudTexture(512, '88, 104, 114', 11, 3, 620);
    this.cloudLight = buildCloudTexture(512, '252, 250, 246', 11, 3, 620);
    this.cloudOuter = buildCloudTexture(512, '114, 128, 134', 29, 4, 460);

    this.countyHit = [];
    this.trackHit = [];
    this.streamlines = [];

    this._bindEvents();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
  }

  /* ----- Sizing & projection ----- */

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(300, Math.round(rect.height));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.dpr = window.devicePixelRatio || 1;
    for (const cv of [this.canvas, this.coneCanvas]) {
      cv.width = Math.round(w * this.dpr);
      cv.height = Math.round(h * this.dpr);
    }
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this._recompute();
    this._initStreamlines(260);
  }

  _recompute() {
    const b = this.bounds;
    const pad = this.width < 520 ? 14 : 36;
    const latSpan = b.maxLat - b.minLat;
    const lonSpan = (b.maxLon - b.minLon) * COS_LAT;
    this.pxPerDeg = Math.min((this.width - pad * 2) / lonSpan, (this.height - pad * 2) / latSpan);
    this.pxPerKm = this.pxPerDeg / 111.2;
    this.cLat = (b.minLat + b.maxLat) / 2;
    this.cLon = (b.minLon + b.maxLon) / 2;
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
      const ext = ((state.radius7km || 200) + (state.probRadius70km || 0) * 0.45) / 111.2 + 0.4;
      t.maxLon = Math.min(140, Math.max(t.maxLon, state.lon + ext / COS_LAT));
      t.minLon = Math.min(t.minLon, state.lon - ext / COS_LAT);
      t.minLat = Math.max(10, Math.min(t.minLat, state.lat - ext));
      t.maxLat = Math.min(34, Math.max(t.maxLat, state.lat + ext));
    }
    return t;
  }

  _updateBounds(state, dt) {
    const t = this._computeTargetBounds(state);
    if (!this.boundsInitialized) {
      this.bounds = { ...t };
      this.boundsInitialized = true;
    } else {
      const k = 1 - Math.exp(-dt * 5);
      for (const key of Object.keys(t)) this.bounds[key] += (t[key] - this.bounds[key]) * k;
    }
    this._recompute();
  }

  /* ----- Public API ----- */

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
    this._initStreamlines(260, state);
  }

  setFloatStep(v) {
    if (!this.scenario) return;
    this.floatStep = Number.isFinite(v) ? Math.max(0, Math.min(this.scenario.timeline.length - 1, v)) : 0;
  }

  setSelectedCounty(id) {
    this.selectedCountyId = id;
  }

  setLayerVisibility(key, visible) {
    this.layers[key] = visible;
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

  /* ----- Interaction ----- */

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
        if ((x - n.x) ** 2 + (y - n.y) ** 2 <= 100) {
          this.hoveredTrackIdx = n.index;
          break;
        }
      }
      this.hoveredCountyId = this.hoveredTrackIdx >= 0 ? null : this._countyAt(x, y);
      this.canvas.style.cursor = this.hoveredCountyId || this.hoveredTrackIdx >= 0 ? 'pointer' : 'default';
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mouse = null;
      this.hoveredCountyId = null;
      this.hoveredTrackIdx = -1;
    });

    this.canvas.addEventListener('click', (e) => {
      const { x, y } = pos(e);
      for (const n of this.trackHit) {
        if ((x - n.x) ** 2 + (y - n.y) ** 2 <= 100) {
          this.onSelectStep(n.index);
          return;
        }
      }
      const id = this._countyAt(x, y);
      if (id) {
        this.selectedCountyId = id;
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

  /* ----- Wind Streamline System ----- */

  _velocityAt(lat, lon, state) {
    const hasTy = Boolean(this.scenario?.hasTyphoon && state);
    const mx = -0.78, my = -0.62; // background northeasterly monsoon
    if (!hasTy) {
      return { dLon: -0.024, dLat: -0.017, mag: 0.28 };
    }

    const dx = (lon - state.lon) * 111.2 * COS_LAT;
    const dy = (lat - state.lat) * 111.2;
    const d = Math.hypot(dx, dy) + 0.01;
    const r7 = state.radius7km || 250;
    const rmax = Math.max(28, (state.radius10km ?? 0) * 0.48);

    // Counter-clockwise cyclonic tangent + 20-degree inward spiral inflow
    const a = 0.35;
    const vx = (-dy / d) * Math.cos(a) + (-dx / d) * Math.sin(a);
    const vy = (dx / d) * Math.cos(a) + (-dy / d) * Math.sin(a);
    const s = d < rmax ? d / rmax : Math.pow(rmax / d, 0.48);
    const w = Math.exp(-d / (r7 * 2.5));
    const ex = vx * s * w + mx * 0.26 * (1 - w);
    const ey = vy * s * w + my * 0.26 * (1 - w);
    const mag = Math.hypot(ex, ey);
    const ux = ex / (mag || 1);
    const uy = ey / (mag || 1);

    const spanScale = Math.max(0.75, (this.bounds.maxLon - this.bounds.minLon) / 8.5);
    const stepDeg = (0.014 + mag * 0.036) * spanScale;
    return {
      dLon: (ux * stepDeg) / COS_LAT,
      dLat: uy * stepDeg,
      mag
    };
  }

  _spawnStreamline(state, prewarm = false) {
    const padLon = (this.bounds.maxLon - this.bounds.minLon) * 0.08;
    const padLat = (this.bounds.maxLat - this.bounds.minLat) * 0.08;
    let lon = this.bounds.minLon - padLon + Math.random() * (this.bounds.maxLon - this.bounds.minLon + padLon * 2);
    let lat = this.bounds.minLat - padLat + Math.random() * (this.bounds.maxLat - this.bounds.minLat + padLat * 2);

    // Bias 35% of particles near the cyclone circulation for rich vortex definition
    if (this.scenario?.hasTyphoon && state && Math.random() < 0.35) {
      const rDeg = (0.4 + Math.random() * 3.8);
      const theta = Math.random() * Math.PI * 2;
      lat = state.lat + Math.sin(theta) * rDeg;
      lon = state.lon + (Math.cos(theta) * rDeg) / COS_LAT;
    }

    const pts = [{ lat, lon }];
    let mag = 0.3;
    const steps = prewarm ? 14 : 2;
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
      maxAge: 75 + Math.floor(Math.random() * 55)
    };
  }

  _initStreamlines(count, state = null) {
    const st = state || this.getInterpolatedState();
    this.streamlines = Array.from({ length: count }, () => this._spawnStreamline(st, true));
  }

  _drawWindStreamlines(ctx, state) {
    if (!this.layers.wind) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < this.streamlines.length; i++) {
      const s = this.streamlines[i];
      const head = s.pts[s.pts.length - 1];
      const v = this._velocityAt(head.lat, head.lon, state);
      const nextLat = head.lat + v.dLat;
      const nextLon = head.lon + v.dLon;
      s.pts.push({ lat: nextLat, lon: nextLon });
      if (s.pts.length > 15) s.pts.shift();
      s.mag = v.mag;
      s.age++;

      if (
        s.age > s.maxAge ||
        nextLon < this.bounds.minLon - 1.5 ||
        nextLon > this.bounds.maxLon + 1.5 ||
        nextLat < this.bounds.minLat - 1.5 ||
        nextLat > this.bounds.maxLat + 1.5
      ) {
        this.streamlines[i] = this._spawnStreamline(state, false);
        continue;
      }

      if (s.pts.length < 3) continue;
      const lifeAlpha = Math.sin((s.age / s.maxAge) * Math.PI);

      ctx.beginPath();
      for (let k = 0; k < s.pts.length; k++) {
        const p = this.latLonToXY(s.pts[k].lat, s.pts[k].lon);
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }

      if (s.mag > 0.62) {
        ctx.strokeStyle = `rgba(148, 92, 88, ${0.46 * lifeAlpha})`;
        ctx.lineWidth = 1.45;
      } else if (s.mag > 0.36) {
        ctx.strokeStyle = `rgba(116, 128, 134, ${0.42 * lifeAlpha})`;
        ctx.lineWidth = 1.15;
      } else {
        ctx.strokeStyle = `rgba(124, 138, 142, ${0.30 * lifeAlpha})`;
        ctx.lineWidth = 0.9;
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ----- Rendering ----- */

  render(dt = 1 / 60) {
    this.time += dt;
    const state = this.getInterpolatedState();
    this._updateBounds(state, dt);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const hasTy = Boolean(this.scenario?.hasTyphoon && state);

    this._drawSea(ctx);
    this._drawGraticule(ctx);
    if (hasTy) this._drawCone(ctx);
    this._drawLand(ctx, state);
    if (hasTy && this.layers.cloud) this._drawClouds(ctx, state);
    this._drawWindStreamlines(ctx, state);
    if (hasTy && this.layers.radius) this._drawRadii(ctx, state);
    if (hasTy) this._drawTrack(ctx);
    if (hasTy) this._drawEye(ctx, state);
    this._drawLabels(ctx, state);
    this._drawScaleBar(ctx);
    this._drawTooltip(ctx, state);
    return state;
  }

  _drawSea(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, '#E7ECEB');
    g.addColorStop(1, '#DAE1E0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  _drawGraticule(ctx) {
    const tl = this.xyToLatLon(0, 0);
    const br = this.xyToLatLon(this.width, this.height);
    const step = [1, 2, 5].find((s) => s * this.pxPerDeg >= 80) || 10;

    ctx.strokeStyle = 'rgba(90, 100, 104, 0.08)';
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

    ctx.font = `400 10px ${FONT}`;
    ctx.fillStyle = 'rgba(100, 105, 108, 0.5)';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    for (let lon = Math.ceil(tl.lon / step) * step; lon <= br.lon; lon += step) {
      const { x } = this.latLonToXY(0, lon);
      ctx.fillText(`${lon}°E`, x + 4, this.height - 8);
    }
    ctx.textAlign = 'right';
    for (let lat = Math.ceil(br.lat / step) * step; lat <= tl.lat; lat += step) {
      const { y } = this.latLonToXY(lat, 0);
      ctx.fillText(`${lat}°N`, this.width - 8, y - 4);
    }
  }

  _coastPath() {
    const p = new Path2D();
    TAIWAN_MAIN_COASTLINE.forEach(([la, lo], i) => {
      const { x, y } = this.latLonToXY(la, lo);
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    });
    p.closePath();
    return p;
  }

  _buildCountyPath(id) {
    const rawRings = COUNTY_RINGS?.[id] || (COUNTY_POLYGONS[id] ? [COUNTY_POLYGONS[id]] : []);
    const path = new Path2D();
    const screenRings = [];
    for (const ring of rawRings) {
      const pts = ring.map(([la, lo]) => this.latLonToXY(la, lo));
      screenRings.push(pts);
      pts.forEach((pt, i) => (i === 0 ? path.moveTo(pt.x, pt.y) : path.lineTo(pt.x, pt.y)));
      path.closePath();
    }
    return { path, screenRings };
  }

  _drawLand(ctx, state) {
    const byId = {};
    for (const c of state?.counties || []) byId[c.id] = c;
    const coast = this._coastPath();
    this.countyHit = [];

    ctx.save();
    ctx.shadowColor = 'rgba(60, 55, 50, 0.14)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#EDE7DC';
    ctx.fill(coast);
    ctx.restore();

    let selectedPath = null;
    for (const id of Object.keys(COUNTY_POLYGONS)) {
      const { path, screenRings } = this._buildCountyPath(id);
      this.countyHit.push({ id, rings: screenRings });
      const prob = byId[id]?.probability;
      if (id === this.selectedCountyId) selectedPath = path;

      ctx.fillStyle = getProbabilityColor(prob, id === this.hoveredCountyId ? 1 : 0.9);
      ctx.fill(path, 'evenodd');
      ctx.strokeStyle = 'rgba(250, 248, 245, 0.85)';
      ctx.lineWidth = 0.85;
      ctx.stroke(path);
    }

    ctx.strokeStyle = 'rgba(70, 66, 60, 0.45)';
    ctx.lineWidth = 0.95;
    ctx.stroke(coast);

    ctx.beginPath();
    CENTRAL_MOUNTAIN_SPINE.forEach(([la, lo], i) => {
      const p = this.latLonToXY(la, lo);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    });
    ctx.setLineDash([1.5, 3.5]);
    ctx.strokeStyle = 'rgba(70, 62, 55, 0.24)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);

    if (selectedPath) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.stroke(selectedPath);
    }

    for (const id of ISLANDS) {
      const c = byId[id];
      const poly = COUNTY_POLYGONS[id];
      if (!poly) continue;
      const la = c?.lat ?? poly.reduce((s, p) => s + p[0], 0) / poly.length;
      const lo = c?.lon ?? poly.reduce((s, p) => s + p[1], 0) / poly.length;
      const { x, y } = this.latLonToXY(la, lo);
      const r = Math.max(8, Math.min(13, 14 * this.pxPerKm));
      this.countyHit.push({ id, circle: true, x, y, r: r + 4 });
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = id === this.selectedCountyId ? INK : 'rgba(70, 66, 60, 0.55)';
      ctx.lineWidth = id === this.selectedCountyId ? 1.6 : 1.0;
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawCone(ctx) {
    const tl = this.scenario.timeline;
    if (tl.length < 2) return;
    const c = this.cctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.coneCanvas.width, this.coneCanvas.height);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#000';

    const pts = tl.map((s) => {
      const p = this.latLonToXY(s.lat, s.lon);
      return { x: p.x, y: p.y, r: Math.max(3, (s.probRadius70km || 0) * this.pxPerKm) };
    });
    for (const p of pts) {
      c.beginPath();
      c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len;
      const ny = (b.x - a.x) / len;
      c.beginPath();
      c.moveTo(a.x + nx * a.r, a.y + ny * a.r);
      c.lineTo(b.x + nx * b.r, b.y + ny * b.r);
      c.lineTo(b.x - nx * b.r, b.y - ny * b.r);
      c.lineTo(a.x - nx * a.r, a.y - ny * a.r);
      c.closePath();
      c.fill();
    }
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = 'rgba(111, 130, 136, 0.14)';
    c.fillRect(0, 0, this.width, this.height);
    c.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.coneCanvas, 0, 0, this.width, this.height);
  }

  _drawClouds(ctx, s) {
    const { x, y } = this.latLonToXY(s.lat, s.lon);
    const r7Px = (s.radius7km || 200) * this.pxPerKm;
    const r10Px = (s.radius10km ?? 0) * this.pxPerKm;
    const D = Math.max(80, r7Px * 2.45);
    const k = Math.max(0.45, Math.min(1, (s.maxWindMs || 30) / 52));
    const rot = -this.time * 0.28;

    // 1. Soft atmospheric cloud textures
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * 0.55);
    ctx.globalAlpha = 0.25 * k;
    ctx.drawImage(this.cloudOuter, -D * 0.7, -D * 0.7, D * 1.4, D * 1.4);
    ctx.restore();

    ctx.save();
    ctx.translate(x + 1.5, y + 2.5);
    ctx.rotate(rot);
    ctx.globalAlpha = 0.45 * k;
    ctx.drawImage(this.cloudShadow, -D / 2, -D / 2, D, D);
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = 0.88 * k;
    ctx.drawImage(this.cloudLight, -D / 2, -D / 2, D, D);
    ctx.restore();

    // 2. Sculpted Morandi Spiral Rainband Ribbons (differential rotation)
    if (r7Px > 12) {
      ctx.save();
      ctx.translate(x, y);
      const arms = 4;
      for (let arm = 0; arm < arms; arm++) {
        const base = (arm * Math.PI * 2) / arms + rot * 1.25;
        ctx.beginPath();
        for (let step = 0; step <= 50; step++) {
          const f = step / 50;
          const r = Math.max(8, r10Px * 0.22) + f * (r7Px * 0.92);
          const theta = base + f * 3.1;
          const px = Math.cos(theta) * r;
          const py = Math.sin(theta) * r;
          if (step === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle =
          arm % 2 === 0
            ? 'rgba(165, 104, 98, 0.16)'
            : 'rgba(110, 132, 138, 0.15)';
        ctx.lineWidth = Math.max(5, r7Px * 0.085);
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Eyewall convection ring
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(9, r10Px * 0.28), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(150, 92, 86, 0.28)';
      ctx.lineWidth = Math.max(3, r10Px * 0.09);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawRadii(ctx, s) {
    const { x, y } = this.latLonToXY(s.lat, s.lon);
    const r7 = (s.radius7km || 0) * this.pxPerKm;
    const r10 = (s.radius10km || 0) * this.pxPerKm;

    if (r7 > 3) {
      ctx.beginPath();
      ctx.arc(x, y, r7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(190, 160, 110, 0.055)';
      ctx.fill();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(150, 120, 74, 0.75)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.setLineDash([]);

      // Subtle compass degree ticks along 7級 storm circle
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-this.time * 0.06);
      ctx.strokeStyle = 'rgba(150, 120, 74, 0.38)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 36; i++) {
        const a = (i * Math.PI * 2) / 36;
        const len = i % 3 === 0 ? 5 : 2.5;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (r7 - len), Math.sin(a) * (r7 - len));
        ctx.lineTo(Math.cos(a) * r7, Math.sin(a) * r7);
        ctx.stroke();
      }
      ctx.restore();

      const a = -Math.PI / 4;
      haloText(ctx, `七級風 ${s.radius7km} km`, x + Math.cos(a) * r7 + 6, y + Math.sin(a) * r7 - 6, {
        size: 10.5, color: 'rgb(128, 100, 60)'
      });
    }
    if (r10 > 3) {
      ctx.beginPath();
      ctx.arc(x, y, r10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(165, 104, 98, 0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(150, 92, 86, 0.82)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      const a = (-3 * Math.PI) / 4;
      haloText(ctx, `十級風 ${s.radius10km} km`, x + Math.cos(a) * r10 - 6, y + Math.sin(a) * r10 - 6, {
        size: 10.5, color: 'rgb(130, 78, 74)', align: 'right'
      });
    }
  }

  _drawTrack(ctx) {
    const tl = this.scenario.timeline;
    const pts = tl.map((s) => this.latLonToXY(s.lat, s.lon));
    this.trackHit = [];
    if (pts.length > 1) {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(58, 55, 52, 0.42)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);

      const i0 = Math.floor(this.floatStep);
      const f = this.floatStep - i0;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i <= i0; i++) ctx.lineTo(pts[i].x, pts[i].y);
      if (i0 < pts.length - 1) {
        ctx.lineTo(pts[i0].x + (pts[i0 + 1].x - pts[i0].x) * f, pts[i0].y + (pts[i0 + 1].y - pts[i0].y) * f);
      }
      ctx.strokeStyle = 'rgba(58, 55, 52, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    const current = Math.round(this.floatStep);
    pts.forEach((p, i) => {
      this.trackHit.push({ index: i, x: p.x, y: p.y });
      const active = i === current;
      const hover = i === this.hoveredTrackIdx;
      ctx.beginPath();
      ctx.arc(p.x, p.y, active || hover ? 4 : 2.8, 0, Math.PI * 2);
      ctx.fillStyle = active ? INK : '#FAF8F5';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      const label = (tl[i].offsetLabel || '').replace(/\s*\(.*?\)\s*/g, '').trim();
      haloText(ctx, label, p.x + 8, p.y, {
        size: 10.5,
        weight: active ? 600 : 400,
        color: active ? INK : INK_2
      });
    });
  }

  _drawEye(ctx, s) {
    const { x, y } = this.latLonToXY(s.lat, s.lon);
    const ph = (this.time % 2.4) / 2.4;

    ctx.beginPath();
    ctx.arc(x, y, 6 + ph * 24, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(140, 84, 82, ${0.48 * (1 - ph)})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-this.time * 1.4);
    ctx.strokeStyle = '#8A5250';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      ctx.arc(0, 0, 9, k * Math.PI - Math.PI / 2, k * Math.PI + 0.1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#8A5250';
    ctx.fill();
    ctx.strokeStyle = '#FAF8F5';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  _drawLabels(ctx, state) {
    if (!state?.counties) return;

    const isMobile = this.width < 520;
    const keyIds = new Set(['KEE', 'TPE', 'TYN', 'TXG', 'TNN', 'KHH', 'PIF', 'ILA', 'HUA', 'TTT', 'PEN', 'KIN', 'LIE']);

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
      const off = COUNTY_LABEL_OFFSETS[c.id] || { dx: 20, dy: 0 };
      const scale = isMobile ? 0.78 : 1;
      const lx = x + off.dx * scale;
      const ly = y + off.dy * scale;

      const labelText = `${c.name.slice(0, 2)} ${probabilityText(c.probability)}`;
      const size = isSel ? (isMobile ? 11 : 12) : (isMobile ? 10 : 11);
      ctx.font = `${isSel ? 600 : 500} ${size}px ${FONT}`;
      const tw = ctx.measureText(labelText).width + 8;
      const th = size + 6;
      const align = off.dx === 0 ? 'center' : off.dx > 0 ? 'left' : 'right';
      const gap = off.dx === 0 ? 0 : off.dx > 0 ? 4 : -4;
      let tx = lx + gap;
      let bx = align === 'center' ? tx - tw / 2 : align === 'left' ? tx - 2 : tx - tw + 2;
      let by = ly - th / 2;

      if (bx < 4) {
        tx += 4 - bx;
        bx = 4;
      } else if (bx + tw > this.width - 4) {
        tx -= bx + tw - (this.width - 4);
        bx = this.width - 4 - tw;
      }
      by = Math.max(4, Math.min(this.height - th - 4, by));

      if (!isSel && !isHov) {
        const margin = 3;
        const overlaps = placedBoxes.some(
          (b) =>
            bx < b.x + b.w + margin &&
            bx + tw + margin > b.x &&
            by < b.y + b.h + margin &&
            by + th + margin > b.y
        );
        if (overlaps) continue;
      }
      placedBoxes.push({ x: bx, y: by, w: tw, h: th });

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(lx, ly);
      ctx.strokeStyle = isSel ? 'rgba(58, 55, 52, 0.72)' : 'rgba(58, 55, 52, 0.28)';
      ctx.lineWidth = 0.85;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, isSel ? 2.5 : 1.6, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();

      haloText(ctx, labelText, tx, ly, {
        size,
        weight: isSel ? 600 : 500,
        color: isSel ? INK : INK_2,
        align
      });
    }
  }

  _drawScaleBar(ctx) {
    if (this.width < 520) return;
    const km = [50, 100, 200, 300, 500, 1000].find((k) => k * this.pxPerKm >= 70) || 1000;
    const w = km * this.pxPerKm;
    const x = 18;
    const y = this.height - 26;
    ctx.strokeStyle = 'rgba(58, 55, 52, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y - 4);
    ctx.stroke();
    haloText(ctx, `${km} km`, x + w / 2, y - 10, { size: 10, color: INK_2, align: 'center' });
  }

  _drawTooltip(ctx, state) {
    if (!this.mouse || !state) return;
    let text = null;
    if (this.hoveredCountyId) {
      const c = state.counties.find((d) => d.id === this.hoveredCountyId);
      if (c) text = `${c.name}  ${probabilityText(c.probability)}  ·  陣風 ${c.wind.gustBeaufort ?? '—'} 級`;
    } else if (this.hoveredTrackIdx >= 0) {
      const s = this.scenario.timeline[this.hoveredTrackIdx];
      if (!s) return;
      text = `${(s.offsetLabel || '').replace(/\s*\(.*?\)\s*/g, '')}  ·  ${s.pressureHpa} hPa`;
    }
    if (!text) return;

    ctx.font = `500 12px ${FONT}`;
    const w = ctx.measureText(text).width + 20;
    const h = 26;
    let x = this.mouse.x + 14;
    let y = this.mouse.y - h - 8;
    if (x + w > this.width - 8) x = this.mouse.x - w - 14;
    if (y < 8) y = this.mouse.y + 16;

    ctx.save();
    ctx.shadowColor = 'rgba(40, 36, 32, 0.12)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(250, 248, 245, 0.97)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(58, 55, 52, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 10, y + h / 2 + 0.5);
  }
}
