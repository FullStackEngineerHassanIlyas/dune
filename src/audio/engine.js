// Web Audio sound engine (spec §6, §9): one AudioContext opened by the first click or key press (browser
// autoplay rules), every synthesized effect and its variations turned into AudioBuffers once — rendered
// ahead by a worker thread from the moment the engine exists (or in the main thread's idle time, or at
// the first click, where there is no worker), so neither the frame rate nor the first click waits. A
// sound whose samples have not arrived yet is skipped rather than waited for. play(id, {x, z})
// picks a variation at random (never the same twice running) at a slightly random pitch, and places it
// relative to the camera: stereo pan, level and air absorption (a low-pass closing with distance), and a
// send into one shared convolution reverb (a subtle open-desert space; far sounds are wetter). Voices are
// capped per sound and overall, with a few slots kept for the sounds that matter; a limiter guards the
// output. Under it all, once the wind has been rendered, a soft stereo desert wind loops. Without Web
// Audio — or if it fails to start — the engine stays silent and never throws.
import { RECIPES, RATE, render, variants, reverbImpulse } from './synth.js';

export const MAX_VOICES = 24;
export const PRIORITY_VOICES = 6;   // beyond MAX_VOICES, only for PRIORITY sounds: a big blast or a warning is never lost in gunfire
export const VOICE_GAIN = 0.5;   // each voice at -6 dB, and a limiter before the output, so a battle never clips
export const VOICE_LIMITS = {
  rifle: 5, mg: 5, cannon: 4, heavyCannon: 3, rocket: 4, rocketFly: 3, hit: 4, sandHit: 4, bulletHit: 4,
  explosionSmall: 4, explosionMedium: 3, explosionLarge: 2, explosionHuge: 1, launchHeavy: 1, debris: 3, collapse: 2, crush: 2, click: 3,
};
const DEFAULT_LIMIT = 2;
const PRIORITY = new Set(['explosionLarge', 'explosionHuge', 'launchHeavy', 'collapse', 'alarm', 'ready', 'error', 'sell', 'click', 'beep', 'static']);
const DRY = new Set(['click', 'error', 'beep', 'sell', 'ready', 'static']);   // the interface stays out of the reverb
const JITTER = { click: 0.01, ready: 0, sell: 0, error: 0, beep: 0, alarm: 0, static: 0.02 };   // random pitch spread; 3% otherwise
const FLAM = 0.03;   // seconds: the same sound started again this soon (a squad firing at once) comes in quieter
export const AIR = { open: 16000, far: 2500 };   // Hz: the low-pass on a placed sound, from beside the camera to the edge of hearing
export const WET = { near: 0.35, far: 0.9, ui: 0.25 };   // reverb send: its tail about 17 dB under a sound beside the camera, 9 dB under one far off
const PAN = 0.85;   // never hard to one side: an off-screen sound still reaches both ears a little
const REVERB_CUT = 250;   // Hz: rumble stays out of the reverb, where it would only muddy the tail
const LIKELY_RATE = 48000;   // the rate most audio outputs, and so most contexts, run at: the worker makes the impulse for it
const AMBIENT = 'wind', AMBIENT_GAIN = 0.4;   // the wind bed: about 12 dB under a rifle beside the camera
const DUCK_GAIN = 0.63;   // about -4 dB on every effect while an announcer line plays
const HERALDS = new Set(['beep']);   // the chirp before an announcement: over a line already being spoken it heralds nothing

/** Interface sounds first, then the busiest battle sounds, then the rest: the order they are rendered ahead in. */
const FIRST = ['click', 'rifle', 'mg', 'cannon', 'explosionSmall', 'hit', 'sandHit', 'rocket', 'bulletHit', 'error', 'ready', 'clunk'];
export const RENDER_ORDER = [...FIRST, ...Object.keys(RECIPES).filter((id) => !FIRST.includes(id))];

/** What to render, in order: one variation of every sound first, so each is playable soonest, then the other variations, the wind last. */
function renderQueue() {
  const ids = RENDER_ORDER.filter((id) => id !== AMBIENT), more = (id, from) => Array.from({ length: Math.max(0, variants(id) - from) }, (_, v) => [id, v + from]);
  return [...ids.map((id) => [id, 0]), ...ids.flatMap((id) => more(id, 1)), ...more(AMBIENT, 0)];
}

/** Pan, level, low-pass cutoff and reverb send for a sound at (x, z) heard from a camera looking at (listener.x, listener.z). */
export function spatial(listener, x, z) {
  const dx = x - listener.x, dz = z - listener.z;
  const d = Math.hypot(dx, dz), near = listener.range * 0.6, far = listener.range * 2;
  const t = d <= near ? 0 : d >= far ? 1 : (d - near) / (far - near);
  const side = dx * listener.rightX + dz * listener.rightZ;
  return {
    pan: Math.max(-PAN, Math.min(PAN, side / (listener.range * 0.8))) || 0,
    gain: 1 - t,
    cutoff: AIR.open * Math.pow(AIR.far / AIR.open, t),
    wet: WET.near + (WET.far - WET.near) * t,
  };
}

export class VoiceLimiter {
  constructor(limits = VOICE_LIMITS, max = MAX_VOICES, { priority = PRIORITY, reserve = PRIORITY_VOICES } = {}) {
    this.limits = limits;
    this.max = max;
    this.priority = priority;
    this.reserve = reserve;
    this.counts = new Map();
    this.total = 0;
  }

  tryStart(id) {
    const n = this.counts.get(id) ?? 0, cap = this.max + (this.priority.has(id) ? this.reserve : 0);
    if (this.total >= cap || n >= (this.limits[id] ?? DEFAULT_LIMIT)) return false;
    this.counts.set(id, n + 1);
    this.total++;
    return true;
  }

  end(id) {
    const n = this.counts.get(id) ?? 0;
    if (n <= 0) return;
    this.counts.set(id, n - 1);
    this.total--;
  }
}

export class SoundEngine {
  constructor({ enabled = true, volume = 0.8, win = globalThis.window, random = Math.random } = {}) {
    this.win = win ?? {};
    this.available = typeof (this.win.AudioContext ?? this.win.webkitAudioContext) === 'function';
    this.enabled = this.available;   // `enabled: false` only starts muted: M can still turn sound on
    this.volume = volume;
    this.muted = !enabled;
    this.paused = false;   // the battle is paused: the context is held (setPaused)
    this.random = random;
    this.ctx = null;
    this.master = null;
    this.reverb = null;
    this.buffers = new Map();   // id → AudioBuffers of its variations, as they become ready
    this.samples = new Map();   // id → variations rendered ahead (indexed by variation), waiting for the context
    this.todo = renderQueue();   // not rendered yet
    this.worker = null;
    this.impulse = null;   // the reverb's impulse from the worker: { rate, channels }
    this.convolver = null;
    this.ambience = null;   // the looping wind, once it plays
    this.ambientParts = [];   // its left and right samples, until both are here and the context is open
    this.last = new Map();   // id → the variation played last
    this.recent = new Map();   // id → { at, n }: when it last started, and how many times within FLAM of that
    this.limiter = new VoiceLimiter();
    this.listener = { x: 0, z: 0, rightX: 1, rightZ: 0, range: 16 };
    this.ducked = false;   // an announcer line is being spoken
    this.asleep = false;   // off stage: the context is kept suspended (sleep)
    if (this.enabled) {
      // kept until the context really runs: a first key such as Escape or Shift is not a user activation
      this.onGesture = () => this.unlock();
      this.win.addEventListener('pointerdown', this.onGesture);
      this.win.addEventListener('keydown', this.onGesture);
      this.renderAhead();
    }
  }

  get running() { return !!this.ctx && !this.paused && (this.ctx.state === undefined || this.ctx.state === 'running'); }

  /** Start the bank rendering: in a worker thread where there is one, else in the main thread's idle time. */
  renderAhead() {
    if (typeof this.win.Worker === 'function') {
      try {
        const w = (this.worker = new this.win.Worker(new URL('./synth-worker.js', import.meta.url), { type: 'module' }));
        w.onmessage = ({ data }) => {
          if (data.reverb) this.receiveImpulse(data.rate, data.reverb);
          else if (data.done) { this.worker = null; this.fitImpulse(); }
          else this.receive(data.id, data.v, data.samples);
        };
        w.onerror = (e) => { e?.preventDefault?.(); this.workerFailed(); };
        // the reverb's impulse too, at the rate a context most likely runs at, once every sound has one variation
        w.postMessage({ todo: this.todo, reverb: { rate: LIKELY_RATE, after: this.todo.findIndex(([, v]) => v > 0) - 1 } });
        return;
      } catch {
        this.worker = null;
      }
    }
    this.idle((d) => this.prerender(d));
  }

  /** Samples of one variation, from the worker or the main thread: a buffer at once if the context is open, else kept for it. */
  receive(id, v, data) {
    const k = this.todo.findIndex(([i, n]) => i === id && n === v);
    if (k < 0) return;   // already there
    this.todo.splice(k, 1);
    if (this.ctx) return this.addBuffer(id, data);
    if (!this.samples.has(id)) this.samples.set(id, []);
    this.samples.get(id)[v] = data;
  }

  workerFailed() {
    this.worker?.terminate?.();
    this.worker = null;
    if (this.ctx) this.renderRest();
    else this.idle((d) => this.prerender(d));
    this.fitImpulse();
  }

  receiveImpulse(rate, channels) {
    this.impulse = { rate, channels };
    this.fitImpulse();
  }

  idle(fn) {
    if (typeof this.win.requestIdleCallback === 'function') this.win.requestIdleCallback((deadline) => fn(deadline), { timeout: 2000 });
  }

  /** One slice of rendering ahead in the main thread: at least one variation, then more while the browser stays idle. */
  prerender(deadline = { timeRemaining: () => 0 }) {
    if (this.ctx || this.worker || !this.todo.length) return;
    do {
      const [id, v] = this.todo[0];
      this.receive(id, v, render(id, v));
    } while (this.todo.length && deadline.timeRemaining() > 3);
    if (this.todo.length) this.idle((d) => this.prerender(d));
  }

  /** Everything not rendered yet, now (no worker, or it failed). */
  renderRest() {
    while (this.todo.length) {
      const [id, v] = this.todo[0];
      this.receive(id, v, render(id, v));
    }
  }

  addBuffer(id, data) {
    const buffer = this.ctx.createBuffer(1, data.length, RATE);
    buffer.copyToChannel(data, 0);
    if (!this.buffers.has(id)) this.buffers.set(id, []);
    this.buffers.get(id).push(buffer);
    if (id === AMBIENT) {
      this.ambientParts.push(data);
      this.startAmbience();
    }
  }

  /** The wind loop: its two variations as the left and right of one stereo buffer, looping quietly into the master. */
  startAmbience() {
    const [left, right] = this.ambientParts, ctx = this.ctx;
    if (!ctx || this.ambience || !right) return;
    try {
      const buffer = ctx.createBuffer(2, Math.min(left.length, right.length), RATE);
      buffer.copyToChannel(left, 0);
      buffer.copyToChannel(right, 1);
      const src = ctx.createBufferSource(), gain = ctx.createGain();
      src.buffer = buffer;
      src.loop = true;
      gain.gain.value = AMBIENT_GAIN;
      src.connect(gain);
      gain.connect(this.fx ?? this.master);
      src.start();
      this.ambience = { src, gain };
    } catch { /* no wind, then */ }
    this.ambientParts = [];
  }

  unlock() {
    if (!this.enabled) return;
    if (!this.ctx) this.open();
    if (this.ctx && (this.paused || this.asleep)) { this.hold(); return; }   // a click under the game menu or on a page off stage: held
    if (this.ctx && !this.running) this.ctx.resume?.()?.catch?.(() => {});
    if (this.running && this.onGesture) {
      this.win.removeEventListener?.('pointerdown', this.onGesture);
      this.win.removeEventListener?.('keydown', this.onGesture);
      this.onGesture = null;
    }
  }

  open() {
    try {
      const Context = this.win.AudioContext ?? this.win.webkitAudioContext;
      const ctx = (this.ctx = new Context());
      if (this.asleep || this.paused) ctx.suspend?.()?.catch?.(() => {});   // opened by a click on a page off stage or under the game menu: it waits
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      const limiter = ctx.createDynamicsCompressor?.();
      if (limiter) {
        limiter.threshold.value = -6;
        limiter.knee.value = 4;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.15;
        this.master.connect(limiter);
        limiter.connect(ctx.destination);
      } else this.master.connect(ctx.destination);
      this.fx = ctx.createGain();   // effects, reverb and wind: the bus an announcer line ducks; voices go straight to master
      this.fx.connect(this.master);
      this.reverb = this.openReverb();
      for (const id of RENDER_ORDER) for (const data of this.samples.get(id) ?? []) if (data) this.addBuffer(id, data);
      this.samples.clear();
      if (!this.worker) this.renderRest();   // a worker still at work delivers the rest as it goes
    } catch (err) {
      console.warn('sound disabled:', err);
      this.enabled = false;
      this.ctx = null;
    }
  }

  /** The shared reverb: a high-pass into a convolver with the synthesized desert impulse, returned into the master. */
  openReverb() {
    const ctx = this.ctx;
    if (!ctx.createConvolver || !ctx.createBiquadFilter) return null;
    const cut = ctx.createBiquadFilter(), conv = (this.convolver = ctx.createConvolver());
    cut.type = 'highpass';
    cut.frequency.value = REVERB_CUT;
    cut.connect(conv);
    conv.connect(this.fx ?? this.master);
    this.fitImpulse();
    return cut;
  }

  /**
   * Give the convolver its impulse (until then it is silent): the worker's if it matches the context's rate,
   * else one made here — unless the worker is still at work and may yet bring it.
   */
  fitImpulse() {
    const conv = this.convolver, rate = this.ctx?.sampleRate ?? RATE;
    if (!conv || conv.buffer) return;
    const mine = this.impulse?.rate === rate ? this.impulse.channels : null;
    if (!mine && this.worker && !this.impulse) return;
    const [left, right] = mine ?? reverbImpulse(rate), ir = this.ctx.createBuffer(2, left.length, rate);
    ir.copyToChannel(left, 0);
    ir.copyToChannel(right, 1);
    conv.buffer = ir;
    this.impulse = null;
  }

  setListener(x, z, rightX, rightZ, range) {
    const l = this.listener, n = Math.hypot(rightX, rightZ) || 1;
    l.x = x;
    l.z = z;
    l.rightX = rightX / n;
    l.rightZ = rightZ / n;
    l.range = Math.max(4, range);
  }

  /** A variation of `id` at random, never the one just played while there are others. */
  pick(id, bank) {
    if (bank.length === 1) return bank[0];
    let k = Math.floor(this.random() * bank.length) % bank.length;
    if (k === this.last.get(id)) k = (k + 1 + Math.floor(this.random() * (bank.length - 1))) % bank.length;
    this.last.set(id, k);
    return bank[k];
  }

  play(id, { x = null, z = null, volume = 1, rate = 1 } = {}) {
    if (!this.running || this.muted) return false;   // a suspended context would hold voices it cannot finish
    if (this.ducked && HERALDS.has(id)) return false;
    const bank = this.buffers.get(id);
    if (!bank?.length) return false;
    let pan = 0, gain = volume, cutoff = AIR.open, wet = DRY.has(id) ? 0 : WET.ui;
    if (x !== null && z !== null) {
      const s = spatial(this.listener, x, z);
      if (s.gain < 0.03) return false;
      ({ pan, cutoff, wet } = s);
      gain *= s.gain;
    }
    if (!this.limiter.tryStart(id)) return false;
    const ctx = this.ctx, now = ctx.currentTime;
    if (now !== undefined) {   // a squad firing in the same instant: each extra shot a little quieter, so the stack does not boom
      const r = this.recent.get(id);
      if (r && now - r.at < FLAM) gain /= Math.sqrt(++r.n);
      else if (r) { r.at = now; r.n = 1; }
      else this.recent.set(id, { at: now, n: 1 });
    }
    const nodes = [];
    try {
      const src = ctx.createBufferSource();
      src.buffer = this.pick(id, bank);
      src.playbackRate.value = rate * (1 + (JITTER[id] ?? 0.03) * (this.random() * 2 - 1));
      let head = src;
      if (cutoff < AIR.open * 0.99 && ctx.createBiquadFilter) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = cutoff;
        f.Q.value = 0;   // Web Audio's low-pass Q is a resonance in dB: none
        head.connect(f);
        nodes.push((head = f));
      }
      const g = ctx.createGain();
      g.gain.value = gain * VOICE_GAIN;
      head.connect(g);
      nodes.push((head = g));
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        head.connect(p);
        nodes.push((head = p));
      }
      head.connect(this.fx ?? this.master);
      if (this.reverb && wet > 0) {
        const send = ctx.createGain();
        send.gain.value = wet;
        head.connect(send);
        send.connect(this.reverb);
        nodes.push(send);
      }
      src.onended = () => {
        this.limiter.end(id);
        for (const n of nodes) n.disconnect?.();
      };
      src.start();
      return true;
    } catch {
      this.limiter.end(id);
      return false;
    }
  }

  /** Speech over the battle: the effects bus dips while an announcer line plays (src/audio/voice.js). */
  duck(on) {
    this.ducked = !!on;
    const g = this.fx?.gain;
    if (!g) return;
    if (g.setTargetAtTime) g.setTargetAtTime(on ? DUCK_GAIN : 1, this.ctx.currentTime, on ? 0.04 : 0.3);
    else g.value = on ? DUCK_GAIN : 1;
  }

  /**
   * Two reasons hold the whole graph where it is (suspended: nothing renders, nothing new starts) until
   * both are gone. Asleep: off stage — the menu's battle behind a skirmish, a paused backdrop, a hidden
   * page (a muted context would still run its wind, limiter and reverb on the audio thread). Paused: the
   * battle paused (the game menu, P, a hidden tab) — effects and their echoes, the wind, an announcer
   * line half said carry on from where they stood.
   */
  sleep(asleep) {
    this.asleep = !!asleep;
    this.hold();
  }

  setPaused(paused) {
    this.paused = !!paused;
    this.hold();
  }

  hold() {
    try { (this.paused || this.asleep ? this.ctx?.suspend?.() : this.ctx?.resume?.())?.catch?.(() => {}); } catch { /* a context that cannot: it simply plays on */ }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }
}
