// Where the soundtrack meets Web Audio (spec §6 Music): the music's own gain into the game's master (so M and the
// master volume act on it, and suspending the context — the game paused, a hidden tab — holds it), fed by the FM
// mixer on the audio thread (worklet.js) or, where there is no AudioWorklet, by a worker rendering ahead in small
// blocks (worker.js) that the page queues a fraction of a second ahead. The player's own MP3/OGG/WAV files play
// through a media element into the same gain, crossfaded the same way. `audio` is anything with an AudioContext
// `ctx` (null until a gesture opens it) and a `master` node: the battle's SoundEngine, or the menu's own.
import { BLOCK } from './mixer.js';

const AHEAD = 0.4;          // seconds the worker fallback keeps queued
const PUMP_MS = 100;        // how often it tops the queue up
const LEVEL_TIME = 0.05;    // seconds: the time constant of a level change
const METER_FILL_MS = 60;   // a new analyser's first 2048 samples (43 ms at 48 kHz) before it is read

export class MusicOutput {
  constructor({ audio, win = globalThis.window, onEvent = () => {} }) {
    this.audio = audio;
    this.win = win ?? {};
    this.onEvent = onEvent;
    this.gain = null;
    this.node = null;        // the AudioWorkletNode
    this.worker = null;      // or the render-ahead worker
    this.loading = null;
    this.pending = [];       // commands sent before the synth was up
    this.file = null;        // the player's file playing: { el, url, src, gain }
    this.level = 0;
    this.load = null;        // share of the audio thread the synth takes (worklet only)
    this.gen = 0;            // bumped by release(): a synth still loading from before is thrown away
    this.modules = new WeakMap();   // context → the worklet module loading or loaded into it
  }

  get ctx() { return this.audio?.ctx ?? null; }

  /** The synth is up (or going up) and the gain wired to the master: false until the game's context exists. */
  open() {
    const ctx = this.ctx;
    if (!ctx || !this.audio.master) return false;
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.value = this.level;
      this.gain.connect(this.audio.master);
    }
    if (!this.node && !this.worker && !this.loading) this.loading = this.startSynth(this.gen);
    return true;
  }

  get synthUp() { return !!(this.node || this.worker); }

  async startSynth(gen) {
    const ctx = this.ctx, win = this.win;
    try {
      if (ctx.audioWorklet && typeof win.AudioWorkletNode === 'function') {
        if (!this.modules.has(ctx)) this.modules.set(ctx, ctx.audioWorklet.addModule(new URL('./worklet.js', import.meta.url)));
        await this.modules.get(ctx);
        if (gen !== this.gen) return;
        const node = new win.AudioWorkletNode(ctx, 'dune-music', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
        node.port.onmessage = ({ data }) => this.event(data);
        node.connect(this.gain);
        this.node = node;
      } else this.startWorker();
    } catch (err) {
      console.warn('music: no AudioWorklet, rendering ahead in a worker instead:', err);
      if (gen === this.gen) { try { this.startWorker(); } catch (err2) { console.warn('music unavailable:', err2); } }
    } finally {
      if (gen === this.gen) {
        this.loading = null;
        for (const c of this.pending.splice(0)) this.send(c);
      }
    }
  }

  startWorker() {
    if (typeof this.win.Worker !== 'function') throw new Error('no worker either');
    const w = new this.win.Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    w.onmessage = ({ data }) => {
      if (data.event) this.event(data.event);
      else if (data.done) this.asked = 0;
      else this.queueBlock(data.L, data.R);
    };
    w.postMessage({ init: true, rate: this.ctx.sampleRate });
    this.worker = w;
    this.nextTime = 0;
    this.asked = 0;
    this.pumpTimer = this.win.setInterval?.(() => this.pump(), PUMP_MS);
  }

  /** Worker fallback: ask for enough blocks to keep AHEAD seconds queued — nothing while the context is held. */
  pump() {
    const ctx = this.ctx;
    if (!this.worker || !ctx || this.asked || ctx.state === 'suspended') return;
    const buffered = Math.max(0, this.nextTime - ctx.currentTime), want = Math.ceil(((AHEAD - buffered) * ctx.sampleRate) / BLOCK);
    if (want > 0) { this.asked = want; this.worker.postMessage({ want }); }
  }

  queueBlock(L, R) {
    const ctx = this.ctx;
    if (!ctx || !this.gain) return;
    const buffer = ctx.createBuffer(2, L.length, ctx.sampleRate), src = ctx.createBufferSource();
    buffer.copyToChannel(L, 0);
    buffer.copyToChannel(R, 1);
    src.buffer = buffer;
    src.connect(this.gain);
    if (this.nextTime < ctx.currentTime + 0.02) this.nextTime = ctx.currentTime + 0.05;   // nothing queued (a start, or after a stall): just ahead
    src.start(this.nextTime);
    this.nextTime += L.length / ctx.sampleRate;
  }

  event(e) {
    if (e.type === 'load') this.load = e.share;
    else this.onEvent(e);
  }

  /** A command for the FM mixer (mixer.js): play, next, stop. */
  send(cmd) {
    if (this.node) this.node.port.postMessage(cmd);
    else if (this.worker) this.worker.postMessage(cmd);
    else this.pending.push(cmd);
  }

  setLevel(v) {
    this.level = v;
    const g = this.gain?.gain;
    if (!g) return;
    if (g.setTargetAtTime && this.ctx.currentTime !== undefined) g.setTargetAtTime(v, this.ctx.currentTime, LEVEL_TIME);
    else g.value = v;
  }

  /** One of the player's files ({ name, type, data }), faded in (or waiting, paused); onEnded when it is over or cannot be played. */
  playFile(file, { fadeIn = 0.6, fade = 1, paused = false, onEnded = () => {} } = {}) {
    this.stopFile(fade);
    const ctx = this.ctx, win = this.win;
    if (!ctx || !this.gain || typeof win.Audio !== 'function') { onEnded(true); return false; }
    try {
      const el = new win.Audio(), url = win.URL.createObjectURL(new win.Blob([file.data], { type: file.type || '' }));
      el.src = url;
      const src = ctx.createMediaElementSource(el), gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      gain.connect(this.gain);
      ramp(gain.gain, 1, fadeIn, ctx);
      const f = (this.file = { el, url, src, gain, done: false });
      const over = (failed) => { if (f.done) return; f.done = true; if (this.file === f) onEnded(failed); };
      el.onended = () => over(false);
      el.onerror = () => over(true);
      if (!paused) el.play()?.catch?.(() => {});
      return true;
    } catch (err) {
      console.warn('music: cannot play', file?.name, err);
      onEnded(true);
      return false;
    }
  }

  stopFile(fade = 1) {
    const f = this.file;
    if (!f) return;
    this.file = null;
    f.done = true;
    ramp(f.gain.gain, 0, fade, this.ctx);
    const end = () => {
      try { f.el.pause(); f.el.removeAttribute?.('src'); f.src.disconnect(); f.gain.disconnect(); this.win.URL?.revokeObjectURL?.(f.url); } catch { /* already gone */ }
    };
    if (fade > 0 && this.win.setTimeout) this.win.setTimeout(end, fade * 1000 + 50); else end();
  }

  /** A file pauses with the game (a suspended context does not stop a media element); the synth needs nothing. */
  setPaused(paused) {
    const el = this.file?.el;
    if (!el) return;
    if (paused) el.pause();
    else el.play()?.catch?.(() => {});
  }

  /**
   * Debug (a promise): the music's level as it leaves its gain, in dB RMS over the last 2048 samples (null without
   * a context). The analyser is made on the first call, which waits for it to fill rather than read silence.
   */
  async meter() {
    const ctx = this.ctx;
    if (!ctx || !this.gain || !ctx.createAnalyser) return null;
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.gain.connect(this.analyser);
      this.tap = new Float32Array(2048);
      await new Promise((resolve) => (this.win.setTimeout ? this.win.setTimeout(resolve, METER_FILL_MS) : resolve()));
    }
    this.analyser.getFloatTimeDomainData(this.tap);
    let s = 0;
    for (const v of this.tap) s += v * v;
    return 10 * Math.log10(s / this.tap.length + 1e-12);
  }

  /** Nothing left running: the synth goes (its audio thread work with it), and any file. */
  release() {
    this.gen++;
    this.loading = null;
    this.pending = [];
    if (this.node) { this.node.port.postMessage({ cmd: 'dispose' }); this.node.disconnect(); this.node = null; }
    if (this.worker) { this.worker.terminate(); this.worker = null; this.win.clearInterval?.(this.pumpTimer); }
    this.stopFile(0);
    this.load = null;
  }
}

function ramp(param, to, seconds, ctx) {
  if (seconds > 0 && param.setTargetAtTime && ctx?.currentTime !== undefined) {
    param.setTargetAtTime(to, ctx.currentTime, seconds / 3);
  } else param.value = to;
}
