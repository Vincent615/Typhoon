// Bound the backing buffer independently from CSS dimensions and hit testing.
export const MAX_CANVAS_PIXELS = 3_000_000;

export function canvasPixelRatio(width, height, deviceRatio = 1) {
  const cap = width < 600 ? 1.5 : 2;
  const requested = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  return Math.min(requested, cap, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height)));
}

export function streamlineCount(width, height, ultra = false) {
  const min = ultra ? 100 : 80;
  const max = ultra ? 220 : 180;
  return Math.round(Math.max(min, Math.min(max, width * height / 2400)));
}

// Keep physics at the original 60 Hz even when presentation runs at 30 Hz.
// This also preserves trail length and lifetime when frames arrive unevenly.
export function advanceStreamlines(renderer, state, dt, trailLength = 12) {
  renderer._windRemainder = (renderer._windRemainder || 0) + Math.max(0, Math.min(dt, 0.1)) * 60;
  const steps = Math.floor(renderer._windRemainder + 1e-9);
  renderer._windRemainder -= steps;
  for (let tick = 0; tick < steps; tick++) {
    for (let i = 0; i < renderer.streamlines.length; i++) {
      const s = renderer.streamlines[i];
      const head = s.pts[s.pts.length - 1];
      const v = renderer._velocityAt(head.lat, head.lon, state);
      const lat = head.lat + v.dLat;
      const lon = head.lon + v.dLon;
      s.pts.push({ lat, lon });
      if (s.pts.length > trailLength) s.pts.shift();
      s.mag = v.mag;
      s.age++;
      if (s.age > s.maxAge ||
          lon < renderer.bounds.minLon - 1.5 || lon > renderer.bounds.maxLon + 1.5 ||
          lat < renderer.bounds.minLat - 1.5 || lat > renderer.bounds.maxLat + 1.5) {
        renderer.streamlines[i] = renderer._spawnStreamline(state, false);
      }
    }
  }
}

// Quantized opacity retains the fade-in/out while using at most 12 strokes.
export function drawStreamlineBatches(ctx, renderer, styles) {
  const buckets = Array.from({ length: styles.length * 4 }, () => []);
  for (const s of renderer.streamlines) {
    if (s.pts.length < 3) continue;
    const alpha = Math.sin(Math.min(1, s.age / s.maxAge) * Math.PI);
    if (alpha < 0.04) continue;
    const style = styles.findIndex((entry) => s.mag > entry.min);
    const fade = Math.min(3, Math.floor(alpha * 4));
    buckets[style * 4 + fade].push(s);
  }
  buckets.forEach((lines, index) => {
    if (!lines.length) return;
    const style = styles[Math.floor(index / 4)];
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.globalAlpha = ((index % 4) + 0.5) / 4;
    ctx.beginPath();
    for (const line of lines) {
      line.pts.forEach((point, k) => {
        const p = renderer.latLonToXY(point.lat, point.lon);
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
    }
    ctx.stroke();
  });
}
