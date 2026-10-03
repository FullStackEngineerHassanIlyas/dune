// Where the soundtrack meets Web Audio (spec §6 Music): the music's own gain into the game's master (so M and the
// master volume act on it, and suspending the context — the game paused, a hidden tab — holds it), fed by the FM
// mixer on the audio thread (worklet.js) or, where there is no AudioWorklet, by a worker rendering ahead in small
// blocks (worker.js) that the page queues a fraction of a second ahead. The player's own MP3/OGG/WAV files play
// through a media element into the same gain, crossfaded the same way; their Mega Drive VGM files (contract C8) go
// to the mixer as data and play there like a track — the VGM player's code is added to the worklet only when the
// first one is to play, and the commands behind it wait in order. `audio` is anything with an AudioContext `ctx`
// (null until a gesture opens it, or made suspended at page load) and a `master` node: the battle's SoundEngine,
// or the menu's own.
import { BLOCK } from './mixer.js';

export const VGM_TYPE = 'audio/x-vgm';
const vgmIds = new WeakMap();
let vgmCount = 0;
/** The mixer's id for one of the player's VGM files: its key in the store, else one given here once. */
export function vgmId(file) {
  if (file?.id !== undefined && file.id !== null) return `vgm:${file.id}`;
  if (!vgmIds.has(file)) vgmIds.set(file, `vgm:t${++vgmCount}`);
  return vgmIds.get(file);
}
/** A one-line module that puts the VGM player where the worklet's mixer looks for it. */
const vgmShim = (url) => `import { VgmDeck } from ${JSON.stringify(url)};\nglobalThis.duneVgmDeck = VgmDeck;\n`;

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
    this.vgmModules = new WeakMap();   // context → the VGM player loading or loaded into its worklet scope
    this.gated = false;      // the VGM player is loading: commands wait behind it
    this.vgmSent = new Set();   // the VGM ids this synth has the data of (a new synth starts empty)
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
        this.flush();
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

  /** A command for the mixer (mixer.js): play, next, stop, hold, vgm — in order, queued until the synth can take it. */
  send(cmd) {
    this.pending.push(cmd);
    this.flush();
  }

  /** What waits goes out, in order — until a VGM's data needs the player loaded into the worklet first. */
  flush() {
    while (this.pending.length && this.synthUp && !this.gated) {
      const c = this.pending[0];
      if (c.cmd === 'vgm' && c.data && this.node) {
        const player = this.vgmPlayer();
        if (!player.done) { this.gate(player.loaded); return; }
      }
      this.pending.shift();
      // the VGM player may be warmed up (about 0.1 s of the audio thread) only where no one hears it
      if (c.cmd === 'vgm' && c.data) c.warm = !this.node || this.ctx?.state !== 'running';
      if (this.node) this.node.port.postMessage(c);
      else this.worker.postMessage(c);
    }
  }

  /** The VGM player added to the worklet's scope, once per context; a missing one only means each VGM reports an error. */
  vgmPlayer() {
    const ctx = this.ctx, win = this.win;
    let p = this.vgmModules.get(ctx);
    if (p) return p;
    p = { done: false };
    p.loaded = (async () => {
      const url = win.URL.createObjectURL(new win.Blob([vgmShim(new URL('./vgm-deck.js', import.meta.url).href)], { type: 'text/javascript' }));
      try { await ctx.audioWorklet.addModule(url); } finally { win.URL.revokeObjectURL?.(url); }
      p.ok = true;
    })().catch((err) => { console.warn('music: the VGM player did not load:', err); p.ok = false; }).finally(() => { p.done = true; });
    this.vgmModules.set(ctx, p);
    return p;
  }

  /** Commands wait until `promise` settles (for this synth: a release in between drops them anyway). */
  gate(promise) {
    if (this.gated) return;
    this.gated = true;
    const gen = this.gen;
    promise.then(() => {
      if (gen !== this.gen) return;
      this.gated = false;
      this.flush();
    });
  }

  /** One of the player's VGM files ({ id?, name, data }) started like a track: its data first, once per synth. */
  playVgm(file, { fade = 0, fadeIn = 0, wait = 0, passes = 0 } = {}) {
    const id = this.registerVgm(file);
    this.send({ cmd: 'play', id, fade, fadeIn, wait, passes });
    return id;
  }

  /** A VGM queued to start on the very sample the playing track ends. */
  queueVgm(file, passes = 0) {
    const id = this.registerVgm(file);
    this.send({ cmd: 'next', id, passes });
    return id;
  }

  registerVgm(file) {
    const id = vgmId(file);
    if (!this.vgmSent.has(id)) {
      this.vgmSent.add(id);
      this.send({ cmd: 'vgm', id, data: file.data });
    }
    return id;
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
      const f = (this.file = { el, url, src, gain, done: false, paused });
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
    this.file.paused = paused;
    if (paused) el.pause();
    else el.play()?.catch?.(() => {});
  }

  /** A file that should be playing but was stopped before any gesture let it (the browser's autoplay rule): now. */
  kick() {
    const f = this.file;
    if (f && !f.done && !f.paused && f.el.paused) f.el.play()?.catch?.(() => {});
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
    this.gated = false;
    this.vgmSent.clear();   // the next synth is sent every VGM again
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
