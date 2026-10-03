// The territory map behind the Mentat and on the region zoom (contract C5: src/render/atlas/index.js createAtlas).
// One atlas for the whole campaign visit: its container moves from screen to screen, and it is disposed when the
// player leaves the campaign or a mission starts, so the battle gets the laptop's shared graphics memory back.
// When the atlas module is missing or cannot start (no WebGL), a flat coloured map (art.js) takes its place and
// the zoom and conquest become short timed pauses.
import { h } from '../dom.js';
import { flatMapSvg, flatTarget } from './art.js';

export class CampaignMap {
  constructor({ quality = 'medium', load = () => import('../../render/atlas/index.js'), later = (fn, ms) => setTimeout(fn, ms) } = {}) {
    Object.assign(this, { quality, load, later });
    this.el = h('div', { class: 'cp-map' });
    this.atlas = null;
    this.failed = false;
    this.pending = null;
    this.generation = 0;
    this.view = null;
  }

  /** The atlas, created on first use; null when it cannot be had (the flat map then). */
  ensure() {
    if (this.atlas || this.failed) return Promise.resolve(this.atlas);
    const generation = this.generation;
    this.pending ??= (async () => {
      try {
        const mod = await this.load();
        if (typeof mod?.createAtlas !== 'function') throw new Error('createAtlas missing');
        if (generation !== this.generation) return null;   // disposed while it loaded
        this.atlas = mod.createAtlas(this.el, { quality: this.quality });
      } catch (err) {
        console.warn('campaign map: the flat map instead of the atlas:', err?.message ?? err);
        this.failed = true;
      } finally { this.pending = null; }
      return this.atlas;
    })();
    return this.pending;
  }

  /** Into a screen's map box. */
  mount(parent) {
    parent.appendChild(this.el);
    this.resize();
  }

  /** The territories after `step` missions won by `house`. */
  async show({ house, step }) {
    const view = (this.view = { house, step });
    const atlas = await this.ensure();
    if (this.view !== view) return;
    if (!this.run(() => atlas?.show({ house, step }))) this.flat(house, step);
  }

  /** The region zoom before a mission: resolves when it is over (about `seconds`). */
  async zoomTo({ house, mission, seconds = 7 }) {
    const view = (this.view = { house, step: mission - 1 });
    const atlas = await this.ensure();
    if (this.view !== view) return;
    let zoom = null;
    if (this.run(() => { zoom = atlas?.zoomTo({ house, mission, seconds }); })) { await Promise.resolve(zoom).catch(() => {}); return; }
    this.flat(house, mission - 1, flatTarget(house, mission), 'zoom');
    await this.pause(seconds);
  }

  /** The player's new territory taken after mission `step`: resolves when the map has changed. */
  async conquer({ house, step }) {
    const view = (this.view = { house, step });
    const atlas = await this.ensure();
    if (this.view !== view) return;
    let done = null;
    if (this.run(() => { done = atlas?.conquer({ house, step }); })) { await Promise.resolve(done).catch(() => {}); return; }
    await this.pause(0.9);
    if (this.view === view) this.flat(house, step, null, 'conquer');
  }

  pause(seconds) { return new Promise((resolve) => this.later(resolve, seconds * 1000)); }

  /** Calls the atlas; false (and the flat map from then on) when there is none or it throws. */
  run(call) {
    if (!this.atlas) return false;
    try { call(); return true; } catch (err) {
      console.warn('campaign map: the atlas failed, the flat map instead:', err?.message ?? err);
      this.drop();
      this.failed = true;
      return false;
    }
  }

  flat(house, step, target = null, mode = '') {
    const box = h('div', { class: `cp-flat${mode ? ` ${mode}` : ''}` });
    box.innerHTML = flatMapSvg(house, step, { target });
    this.el.replaceChildren(box);
  }

  resize() { try { this.atlas?.resize?.(); } catch { /* the next frame sizes it */ } }

  drop() {
    try { this.atlas?.dispose?.(); } catch (err) { console.warn('campaign map: dispose:', err?.message ?? err); }
    this.atlas = null;
  }

  /** Gives everything back (a mission starts, the player leaves the campaign); the next show starts afresh. */
  dispose() {
    this.generation++;
    this.view = null;
    this.drop();
    this.failed = false;
    this.el.replaceChildren();
    this.el.remove?.();
  }
}
