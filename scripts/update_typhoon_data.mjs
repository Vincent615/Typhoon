#!/usr/bin/env node
/** Fetch CWA public typhoon data, calculate labeled model estimates, and read DGPA rows.
 * The builder is read-only. Only the CLI explicitly replaces the output after a successful build.
 */

import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const THRESHOLDS_PATH = path.join(ROOT_DIR, 'data', 'thresholds.json');
const OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'typhoon-data.json');

/**
 * Calculate Haversine distance in kilometers between two lat/lon coordinates
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Convert wind speed (m/s) to approximate Beaufort scale (蒲福風級)
 */
export function msToBeaufort(ms) {
  if (ms < 0.3) return 0;
  if (ms < 1.6) return 1;
  if (ms < 3.4) return 2;
  if (ms < 5.5) return 3;
  if (ms < 8.0) return 4;
  if (ms < 10.8) return 5;
  if (ms < 13.9) return 6;
  if (ms < 17.2) return 7;
  if (ms < 20.8) return 8;
  if (ms < 24.5) return 9;
  if (ms < 28.5) return 10;
  if (ms < 32.7) return 11;
  if (ms < 37.0) return 12;
  if (ms < 41.5) return 13;
  if (ms < 46.2) return 14;
  if (ms < 51.0) return 15;
  if (ms < 56.1) return 16;
  return 17;
}

/** Parse data literals, never execute JavaScript received from the public feed. */
function readLiteral(source, start = 0) {
  let i = start;
  const whitespace = () => { while (/\s/.test(source[i] || '') && i < source.length) i++; };
  function value() {
    whitespace();
    const quote = source[i];
    if (quote === "'" || quote === '"') {
      i++;
      let result = '';
      while (i < source.length) {
        const c = source[i++];
        if (c === quote) return result;
        if (c !== '\\') { result += c; continue; }
        const escaped = source[i++];
        const simple = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' };
        if (escaped === 'u' || escaped === 'x') {
          const length = escaped === 'u' ? 4 : 2;
          const hex = source.slice(i, i + length);
          if (!new RegExp(`^[a-fA-F0-9]{${length}}$`).test(hex)) throw new Error('Invalid CWA string escape');
          result += String.fromCharCode(parseInt(hex, 16));
          i += length;
        } else if (escaped === '\n') {
          // JavaScript line continuation inside a string literal.
        } else if (escaped === '\r') {
          if (source[i] === '\n') i++;
        } else if (escaped !== undefined) result += simple[escaped] ?? escaped;
        else throw new Error('Unterminated CWA string');
      }
      throw new Error('Unterminated CWA string');
    }
    if (quote === '{') {
      i++;
      const result = Object.create(null);
      whitespace();
      while (source[i] !== '}') {
        if (source[i] !== "'" && source[i] !== '"') throw new Error('Invalid CWA object key');
        const key = value();
        if (Object.hasOwn(result, key)) throw new Error('Duplicate CWA object key');
        whitespace();
        if (source[i++] !== ':') throw new Error('Invalid CWA object');
        result[key] = value();
        whitespace();
        if (source[i] === '}') break;
        if (source[i++] !== ',') throw new Error('Invalid CWA object separator');
        whitespace();
      }
      i++;
      return result;
    }
    throw new Error('Unsupported CWA data expression');
  }
  const result = value();
  whitespace();
  return { value: result, end: i };
}

function assignedLiteral(source, assignment, concatenate = false) {
  const match = assignment.exec(source);
  if (!match) throw new Error('Missing CWA data assignment');
  let parsed = readLiteral(source, match.index + match[0].length);
  let result = parsed.value;
  while (concatenate && source[parsed.end] === '+') {
    const next = readLiteral(source, parsed.end + 1);
    if (typeof result !== 'string' || typeof next.value !== 'string') throw new Error('Invalid CWA string concatenation');
    result += next.value;
    parsed = next;
  }
  if (source[parsed.end] !== ';') throw new Error('Invalid CWA assignment terminator');
  return result;
}

function plainText(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ').trim();
}

function requiredNumber(text, pattern, label, min, max) {
  const matched = text.match(pattern);
  const number = matched ? Number(matched[1]) : NaN;
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`Invalid or missing CWA ${label}`);
  return number;
}

function parsePoint(html, offsetHours, nameC, observedAt) {
  const text = plainText(html);
  const latMatch = text.match(/([南北])緯\s*([\d.]+)\s*度/);
  const lonMatch = text.match(/([東西])經\s*([\d.]+)\s*度/);
  const lat = requiredNumber(text, /[南北]緯\s*([\d.]+)\s*度/, 'latitude', 0, 90) * (latMatch?.[1] === '南' ? -1 : 1);
  const lon = requiredNumber(text, /[東西]經\s*([\d.]+)\s*度/, 'longitude', 0, 180) * (lonMatch?.[1] === '西' ? -1 : 1);
  const pressureHpa = requiredNumber(text, /中心氣壓\s*(\d+)\s*百帕/, 'pressure', 800, 1100);
  const maxWindMs = requiredNumber(text, /近中心最大風速每秒\s*([\d.]+)\s*公尺/, 'wind', 0, 150);
  const maxGustMs = requiredNumber(text, /瞬間最大陣風每秒\s*([\d.]+)\s*公尺/, 'gust', maxWindMs, 200);
  const radius7km = requiredNumber(text, /七級風(?:平均)?暴風半徑\s*(\d+)\s*公里/, 'radius7', 0, 1500);
  const radius10km = /十級風/.test(text)
    ? requiredNumber(text, /十級風(?:平均)?暴風半徑\s*(\d+)\s*公里/, 'radius10', 0, radius7km) : 0;
  const probRadius70km = offsetHours === 0 ? 0
    : requiredNumber(text, /70%\s*機率半徑\s*(\d+)\s*公里/, 'probability radius', 0, 3000);
  const date = offsetHours === 0
    ? text.match(/(\d{4}年\d{1,2}月\d{1,2}日\d{1,2}時)/)?.[1]
    : text.match(/預測\s*(\d{1,2}月\d{1,2}日\d{1,2}時)/)?.[1];
  if (!date) throw new Error('Invalid or missing CWA point time');
  // CWA's panel times are Taiwan local time; TY_DataTime is UTC. Comparing the
  // actual calendar components also handles month/year rollover without guessing a year.
  const expectedAt = new Date(Date.parse(observedAt) + offsetHours * 3600000);
  const taiwanTime = new Date(expectedAt.getTime() + 8 * 3600000);
  const parts = date.match(/^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日(\d{1,2})時$/);
  if (!parts || (offsetHours === 0 && Number(parts[1]) !== taiwanTime.getUTCFullYear()) ||
      Number(parts[2]) !== taiwanTime.getUTCMonth() + 1 ||
      Number(parts[3]) !== taiwanTime.getUTCDate() || Number(parts[4]) !== taiwanTime.getUTCHours() ||
      taiwanTime.getUTCMinutes() !== 0) throw new Error('CWA point time does not match observation time and forecast offset');
  const movement = text.match(offsetHours === 0 ? /過去移動方向\s*([^\s]+)/ : /([^\s]+)\s*時速\s*[\d.]+\s*公里/);
  const moveSpeedKmh = requiredNumber(text, offsetHours === 0 ? /過去移動時速\s*([\d.]+)\s*公里/ : /時速\s*([\d.]+)\s*公里/, 'movement speed', 0, 300);
  if (!movement) throw new Error('Invalid or missing CWA movement direction');
  const timeDisplay = date.replace(/^\d{4}年/, '').replace(/(\d+月\d+日)(\d+)時/, '$1 $2:00');
  const offsetLabel = offsetHours === 0 ? '現況 (+0h)' : `+${offsetHours}h`;
  return {
    offsetLabel, offsetHours, timeDisplay, lat, lon, pressureHpa, maxWindMs, maxGustMs,
    radius7km, radius10km, probRadius70km, moveSpeedKmh, moveDir: movement[1],
    // Rain is a model estimate, not an observed CWA rainfall field.
    baseRainPotential: Math.round(maxWindMs * 6), intensityScale: 1,
    phaseNote: `${nameC} ${offsetLabel}（${timeDisplay}）：中心位於 ${lat}°、${lon}°，中心氣壓 ${pressureHpa} hPa，近中心最大風速 ${maxWindMs} m/s，七級風暴風半徑 ${radius7km} 公里${radius10km ? `、十級風暴風半徑 ${radius10km} 公里` : '；來源未列十級風暴風圈'}。`
  };
}

/** Returns active scenarios, or an explicit no_active result; malformed sources throw. */
export function parseCwaTyNewsJs(rawJsText) {
  if (typeof rawJsText !== 'string') throw new Error('Invalid CWA source');
  const typhoons = assignedLiteral(rawJsText, /\bvar\s+TYPHOON\s*=\s*/);
  if (!typhoons || typeof typhoons !== 'object') throw new Error('Invalid CWA typhoon collection');
  const keys = Object.keys(typhoons);
  const hasTimestamp = /\bvar\s+TY_DataTime\s*=/.test(rawJsText);
  const timestamp = hasTimestamp ? assignedLiteral(rawJsText, /\bvar\s+TY_DataTime\s*=\s*/) : null;
  if (timestamp === null && keys.length > 0) throw new Error('Missing CWA observation time');
  if (timestamp !== null && (typeof timestamp !== 'string' || !/^\d{12}$/.test(timestamp))) throw new Error('Invalid CWA observation time');
  const observedAt = timestamp === null ? null : `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:00.000Z`;
  if (observedAt !== null && (!Number.isFinite(Date.parse(observedAt)) || new Date(observedAt).toISOString() !== observedAt)) throw new Error('Invalid CWA observation time');
  if (keys.length === 0) {
    if (/\bTY_LIST_2\s*\[\s*['"]C['"]\s*\]\s*=/.test(rawJsText)) {
      const emptyHtml = assignedLiteral(rawJsText, /\bTY_LIST_2\s*\[\s*['"]C['"]\s*\]\s*=\s*/, true);
      if (typeof emptyHtml !== 'string' || /class\s*=\s*["'][^"']*\btyp-path\b|國際命名/.test(emptyHtml)) throw new Error('Contradictory empty CWA collection');
    }
    return { status: 'no_active', observedAt, scenarios: [] };
  }
  const html = assignedLiteral(rawJsText, /\bTY_LIST_2\s*\[\s*['"]C['"]\s*\]\s*=\s*/, true);
  if (typeof html !== 'string') throw new Error('Invalid CWA forecast HTML');
  const starts = [...html.matchAll(/<div\b[^>]*class=["'][^"']*\bpanel\s+panel-default\b[^"']*["'][^>]*>/gi)];
  if (starts.length !== keys.length) throw new Error('Incomplete CWA typhoon panels');
  const seen = new Set();
  const scenarios = starts.map((start, index) => {
    const panel = html.slice(start.index, starts[index + 1]?.index ?? html.length);
    const header = panel.split(/<div\b[^>]*class=["']panel-body["']/i)[0];
    const headerText = plainText(header);
    const intlKey = headerText.match(/國際命名\s*([A-Z0-9_-]+)/)?.[1];
    if (!intlKey || !Object.hasOwn(typhoons, intlKey) || seen.has(intlKey)) throw new Error('Invalid or duplicate CWA panel identity');
    seen.add(intlKey);
    const names = typhoons[intlKey]?.Name;
    if (!names || typeof names.C !== 'string' || !names.C.trim() || typeof names.E !== 'string' || !names.E.trim()) throw new Error('Invalid CWA typhoon name');
    const nameC = names.C.trim();
    const nameE = names.E.trim();
    const cwaClass = plainText(header.match(/<span\b[^>]*class=["']fa-red["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    const tyNum = headerText.match(/編號第\s*(\d+)\s*號/)?.[1];
    if (!cwaClass || !tyNum) throw new Error('Invalid CWA typhoon heading');
    const current = panel.match(/<span\b[^>]*class=["']now["'][^>]*>現況<\/span>([\s\S]*?)<\/ul>/i);
    if (!current) throw new Error('Missing CWA current observation');
    const timeline = [parsePoint(current[1], 0, nameC, observedAt)];
    const forecasts = [...panel.matchAll(/<p[^>]*>預測\s*([\d-]+)\s*小時平均移向移速為<\/p>\s*<ul[^>]*>([\s\S]*?)<\/ul>/g)];
    if (forecasts.length !== (panel.match(/<p[^>]*>預測/g) || []).length) throw new Error('Incomplete CWA forecast blocks');
    for (const forecast of forecasts) {
      const endHour = Number(forecast[1].split('-').at(-1));
      if (!Number.isInteger(endHour) || endHour <= 0 || endHour > 240) throw new Error('Invalid CWA forecast offset');
      const point = parsePoint(forecast[2], endHour, nameC, observedAt);
      if (endHour <= 96) timeline.push(point);
    }
    for (let i = 1; i < timeline.length; i++) {
      if (timeline[i].offsetHours <= timeline[i - 1].offsetHours) throw new Error('Non-increasing CWA forecast times');
    }
    let defaultStepIndex = 0;
    timeline.forEach((pt, i) => {
      if (haversineKm(24.2, 121.6, pt.lat, pt.lon) < haversineKm(24.2, 121.6, timeline[defaultStepIndex].lat, timeline[defaultStepIndex].lon)) defaultStepIndex = i;
    });
    const now = timeline[0];
    return {
      id: `live_${intlKey.toLowerCase()}`, name: `${cwaClass} ${nameC} (${nameE})`,
      badge: `CWA 預報・編號第 ${tyNum} 號`, cwaClassification: `${cwaClass} (編號第 ${tyNum} 號)`,
      typhoonNumber: `編號第 ${tyNum} 號 (國際命名 ${nameE})`, observedAt,
      warningStatus: '中央氣象署颱風消息；海陸警報狀態請查閱氣象署警報頁面',
      hasTyphoon: true, isLiveOfficial: true,
      summary: `中央氣象署 ${now.timeDisplay} 資料：第 ${tyNum} 號${cwaClass}「${nameC}」(${nameE}) 中心位於 ${now.lat}°、${now.lon}°，中心氣壓 ${now.pressureHpa} 百帕，近中心最大風速每秒 ${now.maxWindMs} 公尺，七級風平均暴風半徑 ${now.radius7km} 公里。以下縣市風雨與機率為本站模型估算，並非官方停班課預報。`,
      defaultStepIndex, timeline
    };
  });
  return { status: 'active', observedAt, scenarios };
}

/**
 * Terrain & Orographic factor based on typhoon eye position relative to Central Mountain Range (中央山脈)
 * including Northeast Monsoon co-effect (東北季風共伴效應) for autumn typhoons east of Taiwan
 */
function getTerrainFactor(county, eyeLat, eyeLon, circulationStrength = 1.0) {
  const isEastOfSpine = eyeLon >= 121.25;
  const isSouthWestFlow = eyeLat >= 23.2 && eyeLon <= 121.0;
  // Autumn Northeast Monsoon + Typhoon outer circulation convergence zone (基隆北海岸、宜蘭、大台北、花蓮、桃園)
  const isNortheastCoEffect = eyeLon >= 122.0 && eyeLat >= 19.5 && eyeLat <= 26.5;

  let windMultiplier = 1.0;
  let rainMultiplier = 1.0;
  let terrainNote = '';

  if (isEastOfSpine) {
    if (isNortheastCoEffect && (county.id === 'KEE' || county.id === 'ILA')) {
      windMultiplier = 1.28;
      rainMultiplier = 1.52;
      terrainNote = '模型依中心方位考量東北部迎風面與地形放大效應；實際共伴效應仍須參照官方天氣預報';
    } else if (isNortheastCoEffect && ['TPE', 'NTP', 'TYN', 'HUA'].includes(county.id)) {
      windMultiplier = 1.18;
      rainMultiplier = 1.38;
      terrainNote = '模型依中心方位考量北部及東部迎風面的地形放大效應';
    } else if (county.region === '東部') {
      windMultiplier = 1.12;
      rainMultiplier = 1.25;
      terrainNote =
        county.id === 'TTT' && eyeLat >= 23.0
          ? '位於背風側沉降區，需留意局部焚風及東半部沿海長浪與強陣風'
          : '位於東部迎風面，受中央山脈地形阻擋抬升，降雨與沿海長浪強陣風明顯增強';
    } else if (county.region === '北部') {
      windMultiplier = 1.08;
      rainMultiplier = 1.20;
      terrainNote = '受東北季風增強與外圍環流角隅效應影響，沿海及山區陣風雨勢偏強';
    } else if (county.region === '中部' || county.region === '南部') {
      windMultiplier = 0.78;
      rainMultiplier = 0.68;
      terrainNote = '受中央山脈高聳地形屏障影響，平地風雨相對緩和，惟山區及沿海仍須留意陣風與長浪';
    }
  } else {
    if (county.region === '南部' || county.region === '中部') {
      windMultiplier = 1.15;
      rainMultiplier = isSouthWestFlow ? 1.45 : 1.25;
      terrainNote = '無中央山脈屏障，受颱風眼牆與強西南／偏南氣流直襲，平地強陣風與山區致災豪雨風險極高';
    } else if (county.region === '東部') {
      windMultiplier = 0.88;
      rainMultiplier = 0.95;
      terrainNote = '颱風中心移至西側，風雨漸由迎風面峰值轉為外圍環流影響';
    } else if (county.region === '北部') {
      windMultiplier = 1.02;
      rainMultiplier = 1.1;
      terrainNote = '受外圍環流與海峽狹管效應影響，沿海及盆地仍有間歇性強陣風';
    }
  }

  if (county.region === '外島') {
    windMultiplier = 1.16;
    rainMultiplier = 0.80;
    terrainNote = '受颱風外圍環流與東北季風疊加引發之海峽狹管效應影響，沿海及海面風浪極大';
  }

  return {
    windMultiplier: windMultiplier * circulationStrength,
    rainMultiplier: rainMultiplier * circulationStrength,
    terrainNote
  };
}

/**
 * Evaluate all 22 counties for a given typhoon track point (time slice)
 */
export function evaluateCountiesAtPoint(counties, point, scenarioMeta) {
  if (!scenarioMeta.hasTyphoon) {
    return counties.map((c) => ({
      id: c.id, name: c.name, region: c.region, commuterZone: c.commuterZone,
      lat: c.lat, lon: c.lon, distanceKm: null, inRadius7: false, inRadius10: false,
      probability: null, riskLevel: 'unknown', dgpaStatus: '尚未查得公告狀態',
      wind: { avgBeaufort: null, gustBeaufort: null, thresholdAvg: 7, thresholdGust: 10, meetsCriteria: null },
      rain: { flatland24h: null, mountain24h: null, flatlandThreshold: c.rainThreshold.flatland, mountainThreshold: c.rainThreshold.mountain, meetsCriteria: null },
      mountainAlert: null,
      aiReasoning: '中央氣象署此份颱風消息未列活躍颱風；本站不據此推估一般天氣或停班課機率。請查閱各縣市官方公告。'
    }));
  }
  for (const field of ['lat', 'lon', 'maxWindMs', 'maxGustMs', 'radius7km', 'radius10km', 'probRadius70km']) {
    if (!Number.isFinite(point[field])) throw new Error(`Missing model input: ${field}`);
  }
  if (point.radius7km < 0 || point.radius10km < 0 || point.radius10km > point.radius7km) throw new Error('Invalid model wind radii');

  // First pass: physical wind & rain estimation per county
  const rawEvaluations = counties.map((county) => {
    const distKm = Math.round(haversineKm(county.lat, county.lon, point.lat, point.lon));
    const r7 = point.radius7km;
    const r10 = point.radius10km;
    const prob70 = point.probRadius70km;

    // Account for 70% probability cone westward shift risk when evaluating potential impact
    const westwardShiftAllowance = Math.round(prob70 * 0.25);
    const coneDistance = Math.max(0, distKm - westwardShiftAllowance);
    // A slice describes this forecast position; the next position must not arrive early.
    const effectiveDist = Math.max(20, distKm);
    const inRadius7 = r7 > 0 && distKm <= r7;
    const inRadius10 = r10 > 0 && distKm <= r10;
    const inCone7 = r7 > 0 && coneDistance <= r7;

    const { windMultiplier, rainMultiplier, terrainNote } = getTerrainFactor(
      county,
      point.lat,
      point.lon,
      point.intensityScale || 1.0
    );

    // Holland-like radial wind decay profile
    let radialFactor;
    if (r10 > 0 && effectiveDist <= r10) {
      radialFactor = 0.84 + 0.16 * (1 - effectiveDist / Math.max(r10, 30));
    } else if (effectiveDist <= r7) {
      const ratio = (effectiveDist - r10) / Math.max(r7 - r10, 40);
      radialFactor = 0.38 + 0.42 * (1 - ratio);
    } else {
      const decay = Math.exp(-(effectiveDist - r7) / 185);
      radialFactor = 0.14 + 0.24 * decay;
    }

    const estSustainedMs = point.maxWindMs * radialFactor * windMultiplier * 0.65;
    const estGustMs = point.maxGustMs * radialFactor * windMultiplier * 0.69;

    const avgBeaufort = Math.min(17, Math.max(3, msToBeaufort(estSustainedMs)));
    const gustBeaufort = Math.min(17, Math.max(avgBeaufort + 2, msToBeaufort(estGustMs)));

    // Estimate 24h accumulated rainfall (mm)
    const baseRain = point.baseRainPotential || 360;
    const rainDecay = Math.exp(-effectiveDist / Math.max(1, r7 * 1.05));
    const flatland24h = Math.round(
      Math.max(15, baseRain * rainDecay * rainMultiplier * (county.coastal ? 0.85 : 0.72))
    );
    const hasMountains = county.mountainDistricts.length > 0;
    const mountain24h = Math.round(
      hasMountains
        ? Math.max(flatland24h * 1.45, baseRain * Math.pow(rainDecay, 0.82) * rainMultiplier * 1.18)
        : flatland24h
    );

    const windMeets = avgBeaufort >= 7 || gustBeaufort >= 10;
    const rainMeets =
      flatland24h >= county.rainThreshold.flatland ||
      (hasMountains && mountain24h >= county.rainThreshold.mountain);

    // Compute raw probability (0 - 99%)
    const windScore = Math.min(
      100,
      Math.max((avgBeaufort / 7) * 64, (gustBeaufort / 10) * 68) +
        (avgBeaufort >= 7 ? 10 : 0) +
        (gustBeaufort >= 10 ? 12 : 0)
    );
    const flatRainRatio = flatland24h / county.rainThreshold.flatland;
    const mtnRainRatio = hasMountains ? mountain24h / county.rainThreshold.mountain : 0;
    const rainScore = Math.min(
      100,
      Math.max(flatRainRatio * 68, mtnRainRatio * 64) + (rainMeets ? 12 : 0)
    );

    let combinedProb = Math.round(Math.max(windScore, rainScore) * 0.72 + Math.min(windScore, rainScore) * 0.22);
    if (inRadius10) combinedProb = Math.max(combinedProb, 94);
    else if (inRadius7 && (windMeets || rainMeets)) combinedProb = Math.max(combinedProb, 82);
    else if (inCone7 && (windMeets || rainMeets)) combinedProb = Math.min(78, Math.max(combinedProb, 62));

    // Scale down when typhoon center is still offshore or far away
    if (distKm > 950) {
      combinedProb = Math.min(combinedProb, Math.round(12 * windMultiplier));
    } else if (distKm > 650) {
      combinedProb = Math.min(combinedProb, Math.round(28 * windMultiplier));
    } else if (!inRadius7 && distKm > r7 + 25) {
      // Center is offshore and county is outside direct 7級 radius (only in 70% cone / outer band)
      combinedProb = Math.min(combinedProb, 76);
    }

    combinedProb = Math.max(5, Math.min(99, combinedProb));

    return {
      county,
      distKm,
      effectiveDist,
      inRadius7,
      inRadius10,
      avgBeaufort,
      gustBeaufort,
      windMeets,
      flatland24h,
      mountain24h,
      rainMeets,
      rawProb: combinedProb,
      terrainNote
    };
  });

  // Second pass: Apply "共同生活圈" (Shared Commuter Zone) decision correlation
  const zoneGroups = {};
  for (const item of rawEvaluations) {
    const z = item.county.commuterZone;
    if (!zoneGroups[z]) zoneGroups[z] = [];
    zoneGroups[z].push(item);
  }

  return rawEvaluations.map((item) => {
    const { county } = item;
    const peers = zoneGroups[county.commuterZone] || [item];
    const maxPeerProb = Math.max(...peers.map((p) => p.rawProb));
    const avgPeerProb = peers.reduce((acc, p) => acc + p.rawProb, 0) / peers.length;

    let finalProb = item.rawProb;
    let commuterSyncApplied = false;

    if (
      county.commuterZone !== '離島地區' &&
      county.commuterZone !== '宜花東' &&
      maxPeerProb >= 68 &&
      avgPeerProb >= 55 &&
      item.rawProb >= 45 &&
      item.rawProb < avgPeerProb
    ) {
      finalProb = Math.min(96, Math.round(item.rawProb * 0.65 + avgPeerProb * 0.35 + 5));
      commuterSyncApplied = true;
    }

    let riskLevel = 'low';
    if (finalProb >= 85) riskLevel = 'very_high';
    else if (finalProb >= 65) riskLevel = 'high';
    else if (finalProb >= 40) riskLevel = 'moderate';

    let dgpaStatus = '尚未達停班課標準';
    if (finalProb >= 85) dgpaStatus = '極高機率停班停課（達風雨基準）';
    else if (finalProb >= 65) dgpaStatus = '高機率停班停課（暴風侵襲警戒區）';
    else if (finalProb >= 40) dgpaStatus = '模型估算中等風險（請留意官方風雨預報）';

    let mountainAlert = null;
    if (
      county.mountainDistricts.length > 0 &&
      item.mountain24h >= county.rainThreshold.mountain * 0.82
    ) {
      const mtnList = county.mountainDistricts.slice(0, 3).join('、');
      mountainAlert = `${mtnList}${county.mountainDistricts.length > 3 ? '等山區' : ''}預估24h雨量達 ${item.mountain24h}mm（標準 ${county.rainThreshold.mountain}mm），即使平地未達標，原民區／山區極可能優先獨立宣布停班停課。`;
    }

    const statusTags = [];
    if (item.inRadius10) statusTags.push('位於本時次十級暴風圈內');
    else if (item.inRadius7) statusTags.push('位於本時次七級暴風圈內');
    else statusTags.push(`距颱風中心約 ${item.distKm} 公里`);

    if (item.windMeets) {
      statusTags.push(`預估平均風 ${item.avgBeaufort} 級、陣風 ${item.gustBeaufort} 級（已達風力基準）`);
    } else {
      statusTags.push(`預估平均風 ${item.avgBeaufort} 級、陣風 ${item.gustBeaufort} 級（未達 7/10 級基準）`);
    }

    if (item.rainMeets) {
      statusTags.push(`24h 累積雨量預估平地 ${item.flatland24h}mm／山區 ${item.mountain24h}mm（已達雨量基準）`);
    } else {
      statusTags.push(`24h 累積雨量預估平地 ${item.flatland24h}mm／山區 ${item.mountain24h}mm`);
    }

    const syncText = commuterSyncApplied
      ? `考量「${county.commuterZone}」共同生活圈鄰近縣市風雨達標，同步決策連動機率上調。`
      : `屬「${county.commuterZone}」生活圈，${item.terrainNote}。`;

    const aiReasoning = `${statusTags.join('；')}。${syncText}`;

    return {
      id: county.id,
      name: county.name,
      region: county.region,
      commuterZone: county.commuterZone,
      lat: county.lat,
      lon: county.lon,
      distanceKm: item.distKm,
      inRadius7: item.inRadius7,
      inRadius10: item.inRadius10,
      probability: finalProb,
      riskLevel,
      dgpaStatus,
      commuterSyncApplied,
      wind: {
        avgBeaufort: item.avgBeaufort,
        gustBeaufort: item.gustBeaufort,
        thresholdAvg: 7,
        thresholdGust: 10,
        meetsCriteria: item.windMeets
      },
      rain: {
        flatland24h: item.flatland24h,
        mountain24h: item.mountain24h,
        flatlandThreshold: county.rainThreshold.flatland,
        mountainThreshold: county.rainThreshold.mountain,
        meetsCriteria: item.rainMeets
      },
      mountainAlert,
      aiReasoning
    };
  });
}

/** An empty, successfully parsed source is different from a failed source. */
export function getScenarioDefinitions(parsed) {
  if (parsed?.status === 'active' && parsed.scenarios?.length) return parsed.scenarios;
  if (parsed?.status !== 'no_active') throw new Error('CWA status is not confirmed');
  const summary = '中央氣象署此份颱風消息未列活躍颱風。這不代表沒有其他天氣風險；停班停課仍以各縣市政府公告為準。';
  return [{
    id: 'no_active_typhoon', name: '目前無活躍颱風資料', badge: 'CWA 未列活躍颱風',
    cwaClassification: '無活躍颱風資料', typhoonNumber: '—', warningStatus: '此資料源未列活躍颱風',
    hasTyphoon: false, isLiveOfficial: false, observedAt: parsed.observedAt, summary,
    defaultStepIndex: 0,
    timeline: [{
      offsetLabel: '現況', offsetHours: 0,
      timeDisplay: parsed.observedAt ? new Date(parsed.observedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '來源未提供觀測時間',
      lat: null, lon: null, pressureHpa: null, maxWindMs: null, maxGustMs: null,
      radius7km: 0, radius10km: 0, probRadius70km: 0,
      moveSpeedKmh: null, moveDir: '—', phaseNote: summary
    }]
  }];
}

/** Read only announcement-table rows; navigation, titles and explanatory notes are not announcements. */
export function parseDgpaAnnouncements(html, counties) {
  const normalize = (text) => text.replaceAll('台', '臺').replace(/\s+/g, '');
  const names = new Map(counties.map((county) => [normalize(county.name), county]));
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)];
  const table = tables.find(([value]) => /<table\b[^>]*\bid\s*=\s*['"]?Table(?:['"\s>])/i.test(value))?.[0]
    ?? tables.find(([value]) => /縣市名稱/.test(plainText(value)) && /是否停止上班上課情形/.test(plainText(value)))?.[0];
  if (!table) return { status: 'unknown', announcements: [], text: '人事行政總處公告資料無法辨識，請直接查閱官方網站。' };
  const announcements = [];
  let explicitEmpty = false;
  let lastCounty = null;
  for (const [row] of table.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
    const cells = [...row.matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi)]
      .map((match) => ({ text: plainText(match[3]), attrs: match[2] }));
    if (cells.length === 1 && /^無停班停課訊息[。.]?$/.test(cells[0].text)) {
      explicitEmpty = true;
      continue;
    }
    const countyIndex = cells.findIndex((cell) => names.has(normalize(cell.text)));
    let county;
    let text;
    if (countyIndex >= 0) {
      county = names.get(normalize(cells[countyIndex].text));
      text = cells.slice(countyIndex + 1).map((cell) => cell.text).join(' ').trim();
      const rowspan = Number(cells[countyIndex].attrs.match(/rowspan\s*=\s*['"]?(\d+)/i)?.[1] || 1);
      lastCounty = rowspan > 1 ? { county, remaining: rowspan - 1 } : null;
    } else if (lastCounty && cells.length === 1 && !/colspan\s*=/.test(cells[0].attrs)) {
      county = lastCounty.county;
      text = cells[0].text;
      if (--lastCounty.remaining === 0) lastCounty = null;
    } else continue;
    if (!text) continue;
    let status = 'unknown';
    if (/停止上班|停止上課/.test(text)) status = 'suspended';
    else if (/照常上班|照常上課|正常上班|正常上課/.test(text)) status = 'normal';
    else if (/尚未列入警戒區|尚未宣布|無停班停課訊息/.test(text)) status = 'not_announced';
    announcements.push({ countyId: county.id, countyName: county.name, status, text });
  }
  const suspended = announcements.filter((item) => item.status === 'suspended');
  if (suspended.length) {
    return { status: 'announced', announcements, text: `人事行政總處：${[...new Set(suspended.map((item) => item.countyName))].join('、')}有停止上班或上課公告，適用日期及區域請查閱公告全文。` };
  }
  if (announcements.length) {
    const allNormal = announcements.every((item) => item.status === 'normal');
    return {
      status: allNormal ? 'normal' : 'unknown', announcements,
      text: allNormal ? '人事行政總處：已列出的縣市公告為照常上班上課；其餘地區請查閱官方網站。' : '人事行政總處：已讀取部分縣市公告，尚無可確認的停止上班上課公告；未列或未明確公告的縣市狀態仍未知。'
    };
  }
  if (explicitEmpty) return { status: 'no_announcements', announcements: [], text: '人事行政總處公告表：無停班停課訊息。' };
  return { status: 'unknown', announcements: [], text: '人事行政總處公告資料無法辨識，請直接查閱官方網站。' };
}

async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`Source request failed (HTTP ${response.status})`);
    // Keep the timeout active until the body has been read, not just until headers arrive.
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOfficialSources({ fetchImpl = globalThis.fetch, now = () => new Date(), counties = [] } = {}) {
  const cwaCheckedAt = new Date(now()).toISOString();
  const raw = await fetchWithTimeout(fetchImpl, 'https://www.cwa.gov.tw/Data/js/typhoon/TY_NEWS-Data.js');
  const parsed = parseCwaTyNewsJs(raw);
  let dgpa = { status: 'unknown', announcements: [], text: '人事行政總處公告暫時無法取得，請直接查閱官方網站。' };
  let dgpaChecked = false;
  try {
    const html = await fetchWithTimeout(fetchImpl, 'https://www.dgpa.gov.tw/typh/daily/nds.html', {}, 5000);
    dgpa = parseDgpaAnnouncements(html, counties);
    dgpaChecked = dgpa.status !== 'unknown' || dgpa.announcements.length > 0;
  } catch {
    // CWA failure aborts publication. DGPA failure is explicitly unknown, never "no announcement".
  }
  return {
    cwaCheckedAt, cwaSourceMode: '中央氣象署公開颱風消息 (TY_NEWS-Data.js)',
    cwaStatus: parsed.status, observedAt: parsed.observedAt,
    liveCycloneDetected: parsed.status === 'active', parsed,
    dgpaChecked, dgpaStatus: dgpa.status, dgpaAnnouncements: dgpa.announcements,
    dgpaAnnouncementText: dgpa.text
  };
}

function deterministicBrief(scenario, slice, officialStatus) {
  if (!scenario.hasTyphoon) return `${scenario.summary} ${officialStatus.dgpaAnnouncementText}`;
  const highest = [...slice.counties].sort((a, b) => b.probability - a.probability).slice(0, 3);
  const ranked = highest.map((county) => `${county.name} ${county.probability}%`).join('、');
  return `${scenario.name}：${slice.offsetLabel}（${slice.timeDisplay}）本站模型估算較高的縣市為${ranked}。風雨與機率是模型估算，未經實測校準，不代表官方停班課決定。${officialStatus.dgpaAnnouncementText}`;
}

export async function enrichWithGeminiAI(scenario, slice, officialStatus, { fetchImpl = globalThis.fetch, apiKey = '' } = {}) {
  const fallback = {
    aiProvider: 'CWA 公開資料 + 本站規則模型', providerStatus: apiKey ? 'fallback' : 'not_configured',
    executiveBrief: deterministicBrief(scenario, slice, officialStatus)
  };
  if (!apiKey || !scenario.hasTyphoon) return fallback;
  const topCounties = [...slice.counties].sort((a, b) => b.probability - a.probability).slice(0, 8)
    .map((c) => `${c.name}(${c.probability}%, 模型陣風${c.wind.gustBeaufort}級, 模型山區雨${c.rain.mountain24h}mm)`).join('、');
  const prompt = `請依下列提供的資料，用繁體中文寫約90至130字的風險摘要。必須明確寫出風雨與機率是本站模型估算，並非官方停班課決定。不得推測或新增海上警報、陸上警報、停班課公告、發布時間、日期、路徑轉向或天氣現象。公告未知時應保留未知。\n颱風資料：${scenario.summary}\n本時次：${slice.offsetLabel} ${slice.timeDisplay}\n模型縣市資料：${topCounties}\n官方公告讀取結果：${officialStatus.dgpaAnnouncementText}`;
  try {
    const raw = await fetchWithTimeout(fetchImpl,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } } })
      }, 10000);
    const data = JSON.parse(raw);
    const text = data?.candidates?.[0]?.content?.parts?.find((part) => !part.thought && typeof part.text === 'string')?.text?.trim();
    if (text?.length >= 50) return { aiProvider: 'Google Gemini 2.5 Flash + CWA 公開資料', providerStatus: 'generated', executiveBrief: text };
  } catch {
    // Optional narrative generation never replaces the deterministic data-derived fallback.
  }
  return fallback;
}

/** Read-only builder: inject networking, time and thresholds for deterministic offline tests. */
export async function buildTyphoonDataset({ fetchImpl = globalThis.fetch, now = () => new Date(), apiKey = process.env.GEMINI_API_KEY || '', thresholdsData } = {}) {
  const thresholds = thresholdsData ?? JSON.parse(await fs.readFile(THRESHOLDS_PATH, 'utf8'));
  const counties = thresholds.counties;
  if (!Array.isArray(counties) || counties.length === 0) throw new Error('Missing county thresholds');
  const officialStatus = await fetchOfficialSources({ fetchImpl, now, counties });
  const builtScenarios = [];
  for (const scenario of getScenarioDefinitions(officialStatus.parsed)) {
    const timeline = scenario.timeline.map((step) => {
      const countyResults = evaluateCountiesAtPoint(counties, step, scenario).map((county) => {
        const announcements = officialStatus.dgpaAnnouncements.filter((announcement) => announcement.countyId === county.id);
        const announcement = announcements.length ? {
          status: announcements.some((item) => item.status === 'suspended') ? 'suspended' : announcements[0].status,
          text: announcements.map((item) => item.text).join('；')
        } : null;
        return {
          ...county, modelDecisionNote: county.dgpaStatus, officialAnnouncement: announcement,
          dgpaStatus: announcement?.text ?? (officialStatus.dgpaStatus === 'no_announcements' ? '官方公告表目前無停班停課訊息' : '尚未查得本縣市明確公告')
        };
      });
      return {
        ...step, counties: countyResults,
        stats: scenario.hasTyphoon ? {
          highRiskCount: countyResults.filter((county) => county.probability >= 65).length,
          maxProb: Math.max(...countyResults.map((county) => county.probability)),
          islandAvgProb: Math.round(countyResults.reduce((sum, county) => sum + county.probability, 0) / countyResults.length)
        } : { highRiskCount: null, maxProb: null, islandAvgProb: null }
      };
    });
    const built = { ...scenario, timeline };
    built.aiMetadata = await enrichWithGeminiAI(built, timeline[built.defaultStepIndex], officialStatus, { fetchImpl, apiKey });
    builtScenarios.push(built);
  }
  const { parsed, ...officialSync } = officialStatus;
  return {
    updatedAt: new Date(now()).toISOString(), updateIntervalHours: 3, officialSync,
    aiMetadata: builtScenarios[0].aiMetadata, regulationReference: thresholds.metadata,
    defaultScenarioId: builtScenarios[0].id, scenarios: builtScenarios
  };
}

/** Replace only after serialization and a complete write in the destination directory. */
export async function writeTyphoonDatasetAtomic(payload, outputPath = OUTPUT_PATH) {
  const content = JSON.stringify(payload, null, 2) + '\n';
  const temporary = `${outputPath}.${process.pid}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await fs.open(temporary, 'wx');
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(temporary, outputPath);
  } finally {
    if (handle) await handle.close();
    await fs.unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  buildTyphoonDataset()
    .then(async (data) => {
      await writeTyphoonDatasetAtomic(data);
      console.log(`[OK] Generated data/typhoon-data.json at ${data.updatedAt} (Primary: ${data.scenarios[0].name}, ${data.scenarios[0].timeline.length} steps)`);
    })
    .catch((error) => {
      // Do not include request URLs or API keys in CI logs.
      console.error('[ERROR] Failed to update typhoon dataset:', error.message);
      process.exitCode = 1;
    });
}
