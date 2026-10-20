// Independent budgets keep display refresh rate from controlling timeline speed.
export class FrameBudget {
  constructor(fps) {
    this.interval = 1000 / fps;
    this.last = null;
  }

  take(ts, force = false) {
    if (!force && this.last !== null && ts - this.last < this.interval - 0.1) return null;
    const elapsed = this.last === null ? 0 : Math.min(1, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    return elapsed;
  }

  reset() { this.last = null; }
}

const previousValues = new WeakMap();

function changed(element, key, value) {
  let values = previousValues.get(element);
  if (!values) previousValues.set(element, values = new Map());
  if (values.get(key) === value) return false;
  values.set(key, value);
  return true;
}

export function setText(element, value) {
  const text = String(value);
  if (changed(element, 'text', text)) element.textContent = text;
}

export function setHTML(element, value) {
  if (changed(element, 'html', value)) element.innerHTML = value;
}

export function setStyle(element, name, value) {
  if (changed(element, `style:${name}`, value)) element.style[name] = value;
}

export function setAttribute(element, name, value) {
  if (changed(element, `attr:${name}`, value)) element.setAttribute(name, value);
}

export function setProperty(element, name, value) {
  if (changed(element, `prop:${name}`, value)) element[name] = value;
}

export function setClass(element, name, on) {
  if (changed(element, `class:${name}`, on)) element.classList.toggle(name, on);
}

export function initializeAnimation(app) {
  app.frameBudget = new FrameBudget(30);
  app.uiBudget = new FrameBudget(8);
  app.mapVisible = true;
  app.dashboardVisible = true;
  app.animationStarted = false;
  app.frameRequest = null;
  app.timerRequest = null;
  app.inAnimationFrame = false;
  app.positionDirty = true;
}

export function requestFrame(app, delay = 0) {
  if (!app.animationStarted || document.hidden || app.inAnimationFrame) return;
  if (delay > 0) {
    if (app.frameRequest !== null || app.timerRequest !== null) return;
    app.timerRequest = setTimeout(() => {
      app.timerRequest = null;
      requestFrame(app);
    }, delay);
    return;
  }
  if (app.timerRequest !== null) {
    clearTimeout(app.timerRequest);
    app.timerRequest = null;
  }
  if (app.frameRequest !== null) return;
  app.frameRequest = requestAnimationFrame((ts) => {
    app.frameRequest = null;
    app.loop(ts);
  });
}

export function observeAnimation(app) {
  if (typeof IntersectionObserver !== 'undefined') {
    const canvas = document.getElementById('typhoon-canvas');
    // The aside also contains a static brief; only visible live values need ticking.
    const dashboard = [
      document.getElementById('storm-map'),
      document.getElementById('county-weather'),
      document.querySelector('.matrix-card, .list-card')
    ].filter(Boolean);
    const visibility = new Map(dashboard.map((element) => [element, true]));
    app.mapObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === canvas) app.mapVisible = entry.isIntersecting;
        else if (visibility.has(entry.target)) visibility.set(entry.target, entry.isIntersecting);
      }
      app.dashboardVisible = [...visibility.values()].some(Boolean);
      app.frameBudget.reset();
      app.uiBudget.reset();
      app.positionDirty = true;
      requestFrame(app);
    });
    app.mapObserver.observe(canvas);
    dashboard.forEach((element) => app.mapObserver.observe(element));
  }
  document.addEventListener('visibilitychange', () => {
    app.lastTs = null;
    app.frameBudget.reset();
    app.uiBudget.reset();
    if (document.hidden) {
      app.hiddenHoldRemaining = Math.max(0, app.holdUntil - performance.now());
      if (app.frameRequest !== null) cancelAnimationFrame(app.frameRequest);
      if (app.timerRequest !== null) clearTimeout(app.timerRequest);
      app.frameRequest = app.timerRequest = null;
    } else {
      app.holdUntil = performance.now() + (app.hiddenHoldRemaining || 0);
      app.positionDirty = true;
      requestFrame(app);
    }
  });
}

export function updateTimeline(app) {
  const slider = document.getElementById('timeline-slider');
  setProperty(slider, 'value', String(app.floatStep));
  const fill = `${(app.floatStep / Math.max(1, app.scenario.timeline.length - 1)) * 100}%`;
  if (changed(slider, 'fill', fill)) slider.style.setProperty('--fill', fill);
}

export function runAnimationFrame(app, ts, { rate, easing, startHold, endHold }) {
  if (document.hidden) {
    app.lastTs = null;
    return;
  }
  app.inAnimationFrame = true;
  const dt = app.lastTs === null ? 0 : Math.min(1, Math.max(0, (ts - app.lastTs) / 1000));
  app.lastTs = ts;
  const n = app.scenario.timeline.length;
  let settled = false;

  if (app.targetStep !== null) {
    const delta = app.targetStep - app.floatStep;
    if (Math.abs(delta) < 0.002) {
      app.floatStep = app.targetStep;
      app.targetStep = null;
      settled = true;
    } else {
      app.floatStep += delta * (1 - Math.exp(-dt * easing));
    }
  } else if (app.playing && ts >= app.holdUntil) {
    if (app.floatStep >= n - 1) {
      app.floatStep = 0;
      app.holdUntil = ts + startHold;
      settled = true;
    } else {
      app.floatStep = Math.min(n - 1, app.floatStep + dt * rate);
      if (app.floatStep >= n - 1) {
        app.holdUntil = ts + endHold;
        settled = true;
      }
    }
  }

  const active = app.playing || app.targetStep !== null;
  const visible = app.mapVisible || app.dashboardVisible;
  if (settled) app.positionDirty = true;
  const force = app.positionDirty;
  const mapDt = app.mapVisible && (active || app.map.needsRender || force)
    ? app.frameBudget.take(ts, force || !active) : null;
  const uiDue = visible && (app.floatStep !== app.lastSyncStep || force)
    && app.uiBudget.take(ts, force) !== null;

  if (mapDt !== null || uiDue) app.map.setFloatStep(app.floatStep);
  if (mapDt !== null) {
    updateTimeline(app);
    app.map.render(active ? mapDt : 0);
  }
  if (uiDue) {
    app.lastSyncStep = app.floatStep;
    updateTimeline(app);
    app.sync(force);
    // The ring already has a CSS transition; avoid a second per-frame DOM tween.
    app.displayProb = Number.isFinite(app.targetProb) ? app.targetProb : 0;
    app.renderGauge();
    app.positionDirty = false;
  }
  if (ts - app.lastMetaCheck >= 60000) {
    app.lastMetaCheck = ts;
    app.renderSourceMeta();
  }
  app.inAnimationFrame = false;
  requestFrame(app, active ? (app.mapVisible ? 0 : app.dashboardVisible ? 250 : 1000) : 60000);
}
