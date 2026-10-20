// Bound the backing buffer independently from CSS dimensions and hit testing.
export const MAX_CANVAS_PIXELS = 3_000_000;

export function canvasPixelRatio(width, height, deviceRatio = 1, coarsePointer = false) {
  // Small Retina canvases can retain native detail without exceeding the same
  // total raster budget as the desktop map. CSS coordinates remain unchanged.
  const cap = width < 600 || coarsePointer ? 3 : 2;
  const requested = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  return Math.min(requested, cap, Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height)));
}

export function observeCanvasDisplay(renderer) {
  const resize = () => renderer.resize();
  new ResizeObserver(resize).observe(renderer.canvas.parentElement);
  window.addEventListener?.('resize', resize, { passive: true });

  // A monitor or browser zoom change may change DPR without changing the
  // parent element's CSS dimensions, so ResizeObserver alone is insufficient.
  let resolution;
  const onResolutionChange = () => {
    resize();
    watchResolution();
  };
  const watchResolution = () => {
    resolution?.removeEventListener?.('change', onResolutionChange);
    resolution = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    resolution?.addEventListener?.('change', onResolutionChange, { once: true });
  };
  watchResolution();

  // Paused maps have no recurring frame to replace fallback-font text.
  const redrawText = () => renderer.invalidate();
  document.fonts?.ready?.then(redrawText);
  document.fonts?.addEventListener?.('loadingdone', redrawText);
}

// Keep labels in CSS coordinates; backing-buffer resolution must not affect
// label placement or the clickable county/forecast geometry.
export function boundedTextPosition(ctx, text, x, y, width, height, {
  align = 'left', fontSize = 11, padding = 8
} = {}) {
  const textWidth = ctx.measureText(text).width;
  const leftWidth = align === 'right' ? textWidth : align === 'center' ? textWidth / 2 : 0;
  const rightWidth = textWidth - leftWidth;
  return {
    x: Math.max(padding + leftWidth, Math.min(width - padding - rightWidth, x)),
    y: Math.max(padding + fontSize / 2, Math.min(height - padding - fontSize / 2, y))
  };
}

export function canvasTooltipLayout(ctx, textLines, pointer, width, height) {
  const edge = 8;
  const padding = 11;
  const lineHeight = 17;
  const available = Math.max(1, width - (edge + padding) * 2);
  const lines = [];
  for (const text of textLines) {
    if (ctx.measureText(text).width <= available) {
      lines.push(text);
      continue;
    }
    // This path is only needed for an unusually long forecast label. Normal
    // county/tooltips stay on two lines and require only a few measurements.
    let line = '';
    for (const character of text) {
      if (line && ctx.measureText(line + character).width > available) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
    if (line) lines.push(line);
  }
  const w = Math.min(width - edge * 2, Math.max(...lines.map((line) => ctx.measureText(line).width), 0) + padding * 2);
  const h = lines.length * lineHeight + padding * 2;
  let x = pointer.x + 14;
  let y = pointer.y - h - 8;
  if (x + w > width - edge) x = pointer.x - w - 14;
  if (y < edge) y = pointer.y + 16;
  x = Math.max(edge, Math.min(width - edge - w, x));
  y = Math.max(edge, Math.min(height - edge - h, y));
  return { x, y, w, h, lines, padding, lineHeight };
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
