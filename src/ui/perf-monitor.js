// Frame-time monitor (spec §8): when a battle stays under 40 fps for a sustained stretch of play, a small
// prompt in the menus' bronze offers the next lower graphics preset — Switch, Not now, Don't ask again.
// Switching saves the preset and applies it at once where the renderer can (shadows, anti-aliasing, bloom,
// pixel ratio); particle budgets follow in the next battle. Paused, hidden and loading time is not judged.
// main.js starts it for the battle scenes. Headless browsers (the smoke and end-to-end runs) skip it unless
// the address sets perfCheck; perfFps and perfSeconds change the threshold and the stretch, for testing.
import { h } from './dom.js';
import { changeSetting } from './options.js';
import { lowerQuality } from '../render/quality.js';

/** fps: the threshold. seconds: the stretch judged, in one-second samples, of which `share` must be under the
 *  threshold, and their mean too. startup: seconds of play not judged at the start; settle: after a pause. */
export const WATCH = { fps: 40, seconds: 15, share: 0.8, startup: 8, settle: 3 };
const NAMES = { low: 'Low', medium: 'Medium', high: 'High' };

/** The decision alone: fed every frame interval, it says when play has been slow for long enough. */
export class FrameWatch {
  constructor(opts = {}) {
    const o = { ...WATCH };
    for (const [k, v] of Object.entries(opts)) if (v !== undefined) o[k] = v;
    Object.assign(this, { fps: o.fps, share: o.share, startup: o.startup, settleTime: o.settle });
    this.samples = new Float32Array(Math.max(1, Math.round(o.seconds)));
    this.reset();
  }

  reset(settle = this.startup) { this.n = 0; this.head = 0; this.time = 0; this.frames = 0; this.settle = settle; }

  /** One frame, `dt` seconds after the last; active: false while paused, hidden or loading. True: slow for long enough. */
  frame(dt, active = true) {
    if (!active || !(dt > 0) || dt > 1) {   // not play, or a stall no game runs at (a tab switch, a breakpoint): this second starts over once play settles
      this.time = 0; this.frames = 0;
      this.settle = Math.max(this.settle, this.settleTime);
      return false;
    }
    if (this.settle > 0) { this.settle -= dt; return false; }
    this.time += dt;
    this.frames++;
    if (this.time < 1) return false;
    this.samples[this.head] = this.frames / this.time;
    this.head = (this.head + 1) % this.samples.length;
    this.n = Math.min(this.n + 1, this.samples.length);
    this.time = 0; this.frames = 0;
    return this.slow();
  }

  slow() {
    const s = this.samples, len = s.length;
    if (this.n < len) return false;
    let low = 0, sum = 0;
    for (let i = 0; i < len; i++) { sum += s[i]; if (s[i] < this.fps) low++; }
    return low >= this.share * len && sum / len < this.fps;
  }
}

/**
 * The monitor: watches, offers, and carries out the answer. running(): the preset in use. active(): the battle is
 * being played. apply(name): switches the renderer live, true when it did (null: next battle only). prompt:
 * { show({ from, to }, choose), hide() }; choose('switch' | 'later' | 'never'). state: watching, asking or done.
 */
export class PerfMonitor {
  constructor({ settings, running, active = () => true, apply = null, prompt, notify = () => {}, storage, watch = {} }) {
    Object.assign(this, { settings, running, active, apply, prompt, notify, storage });
    this.watch = new FrameWatch(watch);
    this.state = 'watching';
  }

  frame(dt) {
    if (this.state !== 'watching' || !this.settings.perfCheck) return;
    if (this.watch.frame(dt, this.active())) this.offer();
  }

  offer() {
    const from = this.running(), to = lowerQuality(from);
    if (!to) { this.state = 'done'; return; }
    this.state = 'asking';
    this.prompt.show({ from: NAMES[from], to: NAMES[to] }, (choice) => this.choose(choice, to));
  }

  choose(choice, to) {
    if (this.state !== 'asking') return;
    this.prompt.hide();
    this.state = 'done';
    if (choice === 'never') changeSetting(this.settings, 'perfCheck', false, this.storage);
    if (choice !== 'switch') return;
    changeSetting(this.settings, 'quality', to, this.storage);
    let live = false;
    try { live = !!this.apply?.(to); } catch (err) { console.warn('frame-time monitor: switching live failed:', err); }
    this.notify(live ? `Graphics set to ${NAMES[to]}. Particle detail follows in the next battle.` : `Graphics set to ${NAMES[to]}: it takes effect in the next battle.`);
    if (live) { this.state = 'watching'; this.watch.reset(); }   // still slow? the next preset down is offered later
  }
}

const PROMPT_STYLE = 'position: absolute; right: calc(var(--sidebar-w, 0px) + 16px); bottom: 20px; z-index: 25; pointer-events: auto;'
  + ' width: min(400px, calc(100% - var(--sidebar-w, 0px) - 32px)); min-width: 0; padding: 14px 16px 12px;';

/** The prompt: a small bronze card at the battlefield's lower right. It never takes the keyboard, so play goes on. */
export function domPrompt(root) {
  let el = null;
  return {
    show({ from, to }, choose) {
      const button = (text, choice, primary = false) => h('button', { type: 'button', class: primary ? 'dm-btn small primary' : 'dm-btn small', dataset: { perf: choice },
        onclick: () => choose(choice) }, text);
      el = h('div', { class: 'dm-panel perf-prompt', role: 'status', style: PROMPT_STYLE },
        h('p', { style: 'margin: 4px 0 0;' }, `The battle has been running below 40 frames a second. Switch graphics from ${from} to ${to}?`),
        h('div', { class: 'dm-actions', style: 'margin-top: 12px; flex-wrap: wrap; gap: 8px;' },
          button('Not now', 'later'), button('Don\'t ask again', 'never'), button('Switch', 'switch', true)));
      root.appendChild(el);
    },
    hide() { el?.remove(); el = null; },
  };
}

/** Starts the monitor for a battle's GameView; null when it does not run. */
export function startPerfMonitor(view, { search = location.search, root = document.getElementById('ui') } = {}) {
  const params = new URLSearchParams(search);
  const headless = navigator.webdriver || /HeadlessChrome/.test(navigator.userAgent);
  if (!view?.settings?.perfCheck || (headless && !params.has('perfCheck'))) return null;
  const num = (key) => { const v = Number(params.get(key)); return params.has(key) && v > 0 ? v : undefined; };
  const r3d = view.r3d;
  const monitor = new PerfMonitor({
    settings: view.settings,
    running: () => r3d?.qualityName ?? view.settings.quality,
    active: () => !view.paused && !document.hidden && !view.world?.outcome,
    apply: typeof r3d?.setQuality === 'function' ? (name) => { r3d.setQuality(name); return true; } : null,
    prompt: domPrompt(root),
    notify: (text) => view.hud?.message(text, 6),
    watch: { fps: num('perfFps'), seconds: num('perfSeconds') },
  });
  let last = -1;
  const loop = (now) => {
    if (last >= 0) monitor.frame((now - last) / 1000);
    last = now;
    if (monitor.state !== 'done') requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return monitor;
}
