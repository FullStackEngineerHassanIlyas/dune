// Stand-ins for the music tests (not a test file itself): a browser window with Web Audio that records what the
// music does with it, a VGM player with the VgmDeck's shape (contract C8) and a VGM reader for the import. The
// "VGM files" here are made up: 'Vgm ' and a JSON tag, nothing of any game.
import { MusicMixer, BLOCK } from '../src/audio/music/mixer.js';

class Node {
  constructor() { this.outputs = []; this.disconnected = false; }
  connect(n) { this.outputs.push(n); return n; }
  disconnect() { this.disconnected = true; }
}
const param = (v) => ({ value: v, setTargetAtTime(to) { this.value = to; } });

/**
 * A window: AudioContext (made 'suspended' when `suspended`, as a browser does before any gesture), AudioWorkletNode
 * whose port records the commands (or, with `mixer`, runs them in a real MusicMixer that renders on `win.render(n)`),
 * Audio elements, timers run by flush(), and a clock (performance.now) moved by tick(ms).
 */
export function fakeWindow({ worklet = true, suspended = false, mixer = false, VgmDeck = null, addModule = null } = {}) {
  const win = { listeners: {}, timers: [], nodes: [], workers: [], elements: [], urls: 0, blobs: [], clock: 0 };
  win.addEventListener = (t, fn) => { (win.listeners[t] ??= []).push(fn); };
  win.removeEventListener = (t, fn) => { win.listeners[t] = (win.listeners[t] ?? []).filter((f) => f !== fn); };
  win.timeouts = [];
  win.setTimeout = (fn, ms = 0) => { win.timeouts.push({ fn, at: win.clock + (Number(ms) || 0) }); return win.timeouts.length; };
  /** Every timer set so far, due or not. */
  win.flush = () => { for (const t of win.timeouts.splice(0)) t.fn(); };
  /** The clock moves on `ms`, and the timers due meanwhile run in their order. */
  win.tick = (ms) => {
    const end = win.clock + ms;
    for (;;) {
      const due = win.timeouts.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      win.timeouts.splice(win.timeouts.indexOf(due), 1);
      win.clock = Math.max(win.clock, due.at);
      due.fn();
    }
    win.clock = end;
  };
  win.setInterval = (fn) => { win.timers.push(fn); return win.timers.length; };
  win.clearInterval = () => {};
  win.performance = { now: () => win.clock };
  win.URL = { createObjectURL: (b) => { win.blobs.push(b); return `blob:${++win.urls}`; }, revokeObjectURL() {} };
  win.Blob = class { constructor(parts, opts) { this.parts = parts; this.type = opts?.type; } };
  win.Audio = class {
    constructor() { this.paused = true; this.src = ''; this.plays = 0; win.elements.push(this); }
    play() { this.plays++; if (win.blockAutoplay) return Promise.reject(new Error('NotAllowedError')); this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute(a) { if (a === 'src') this.src = ''; }
  };
  class Ctx {
    constructor() {
      this.state = suspended ? 'suspended' : 'running'; this.currentTime = 0; this.sampleRate = 48000; this.destination = new Node(); this.started = []; this.resumes = 0;
      if (worklet) this.audioWorklet = { modules: [], addModule: async (url) => { this.audioWorklet.modules.push(String(url)); if (addModule) await addModule(String(url)); } };
      win.contexts = [...(win.contexts ?? []), this];
    }
    createGain() { return Object.assign(new Node(), { gain: param(1) }); }
    createDynamicsCompressor() { return Object.assign(new Node(), { threshold: param(0), knee: param(0), ratio: param(1), attack: param(0), release: param(0) }); }
    createMediaElementSource(el) { return Object.assign(new Node(), { el }); }
    createBuffer(ch, length, rate) { return { length, rate, data: [], copyToChannel(d, c) { this.data[c] = d; } }; }
    createBufferSource() { const s = Object.assign(new Node(), { start: (t) => { s.at = t; this.started.push(s); } }); return s; }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    resume() { this.resumes++; if (!win.noActivation) this.state = 'running'; return Promise.resolve(); }
  }
  win.AudioContext = Ctx;
  if (worklet) {
    win.AudioWorkletNode = class extends Node {
      constructor(ctx, name, opts) {
        super();
        Object.assign(this, { ctx, name, opts, sent: [] });
        const node = this;
        this.port = { postMessage: (m) => { node.sent.push(structuredClone(m)); node.mixer?.command(structuredClone(m)); }, onmessage: null };
        if (mixer) this.mixer = new MusicMixer({ rate: 48000, VgmDeck, onEvent: (e) => node.events.push(e) });
        this.events = [];
        win.nodes.push(this);
      }
    };
    /** Renders n samples on the last node's mixer and hands its events to the page, as the audio thread would. */
    win.render = (n = 128) => {
      const node = win.nodes.at(-1), L = new Float32Array(n), R = new Float32Array(n);
      if (node.mixer.active) node.mixer.render(L, R, n);
      for (const e of node.events.splice(0)) node.port.onmessage?.({ data: e });
      return { L, R };
    };
  }
  return win;
}

/** The battle's SoundEngine as the music sees it: a context, a master, and whether a line is being spoken. */
export function fakeEngine(win) {
  const ctx = new win.AudioContext();
  return { ctx, master: ctx.createGain(), ducked: false };
}

export const settle = () => new Promise((r) => setImmediate(r));
export const sent = (win) => win.nodes.flatMap((n) => n.sent);
export const plays = (win) => sent(win).filter((c) => c.cmd === 'play');

// ——— made-up VGM files ———

const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
/** A made-up VGM: 'Vgm ' and a JSON tag { track, game, total, loop, ym, sn } (samples at 44.1 kHz). */
export function vgmFile({ track = 'Opening', game = 'Dune: The Battle for Arrakis', total = 44100 * 73.5, loop = 44100 * 16.1, ym = 7670453, sn = 3579545, bad = false } = {}) {
  return new Uint8Array([...ascii('Vgm '), ...ascii(JSON.stringify({ track, game, total, loop, ym, sn, bad }))]);
}
export const vgz = (plain) => new Uint8Array([0x1f, 0x8b, ...plain]);
export const zip = (entries) => new Uint8Array([...ascii('PK\x03\x04'), ...ascii(JSON.stringify(entries.map(([name, bytes]) => [name, [...bytes]])))]);
const tag = (bytes) => JSON.parse(String.fromCharCode(...bytes.subarray(4)));

/** The VGM reader's shape (src/formats/vgm.js, contract C8) for the made-up files above. */
export const fakeVgmFormat = {
  isGzip: (b) => b[0] === 0x1f && b[1] === 0x8b,
  inflateVgm: async (b) => b.slice(2),
  parseVgm(b) {
    if (String.fromCharCode(...b.subarray(0, 4)) !== 'Vgm ') throw new Error('not a VGM file');
    const t = tag(b);
    return { version: 0x150, clocks: { ym2612: t.ym, sn76489: t.sn }, totalSamples: t.total, loopOffset: t.loop ? 0x1234 : 0, loopSamples: t.loop, gain: 1,
      gd3: { track: t.track, game: t.game, system: 'Sega Mega Drive', author: '', date: '', notes: '' }, unsupported: [] };
  },
  readVgmZip: async (b) => JSON.parse(String.fromCharCode(...b.subarray(4))).map(([name, bytes]) => ({ name, bytes: new Uint8Array(bytes) })),
};

/**
 * A VGM player with the VgmDeck's shape: it plays a steady square wave, `samples` long a pass (the first pass and
 * each loop pass alike), and stops after `passes` passes (0: for ever). A file whose tag says bad: true will not
 * read; `renderThrows` makes it break while playing.
 */
export function fakeVgmDeck({ samples = 1000, renderThrows = false, made = [] } = {}) {
  return class FakeVgmDeck {
    constructor(id, bytes, { sampleRate, passes = 0, gain = 1 } = {}) {
      if (!(bytes instanceof Uint8Array)) throw new Error('bytes must be a Uint8Array');
      if (tag(bytes).bad) throw new Error('not a VGM file');
      Object.assign(this, { id, rate: sampleRate, passes, gain, delay: 0, pass: 0, ending: false, pos: 0, endedAt: 0, done: false, fadeTo: gain, step: 0 });
      made.push(this);
    }
    fade(to, seconds) { this.fadeTo = to; this.step = seconds > 0 ? (to - this.gain) / (seconds * this.rate) : 0; if (!(seconds > 0)) this.gain = to; }
    finish() { if (!this.ending) { this.ending = true; this.endedAt = this.pos; } }
    render(L, R, at, n) {
      if (renderThrows) throw new Error('broken');
      for (let i = 0; i < n; i++) {
        const playing = !this.ending;
        if (playing) { const v = (Math.floor(this.pos / 24) & 1 ? 0.1 : -0.1) * this.gain; L[at + i] += v; R[at + i] += v; }
        if (this.step) { this.gain += this.step; if ((this.step < 0 && this.gain <= this.fadeTo) || (this.step > 0 && this.gain >= this.fadeTo)) { this.gain = this.fadeTo; this.step = 0; } }
        this.pos++;
        if (playing && this.pos % samples === 0) { this.pass++; if (this.passes && this.pass >= this.passes) this.finish(); }
      }
      if (this.ending && this.pos - this.endedAt > 0) this.done = true;
      if (this.gain <= 0 && this.fadeTo <= 0) this.done = true;
    }
  };
}

/** One of the player's files as the store gives them to the music. */
export const userVgm = (id, opts = {}) => ({ id, name: `${opts.track ?? 'Opening'}.vgm`, type: 'audio/x-vgm', data: vgmFile(opts).buffer, meta: { title: opts.track ?? 'Opening', loopSeconds: opts.loop === 0 ? 0 : 16.1 } });
export const userOgg = (id, name = 'mine.ogg') => ({ id, name, type: 'audio/ogg', data: new ArrayBuffer(8), meta: { title: name } });

/** A store module as the music imports it: slot → tracks (the same objects for a track in two slots). */
export function fakeStore(slots = {}) {
  const store = { slots, follower: null, reads: 0 };
  store.importer = async () => ({
    playlists: async () => { store.reads++; return store.slots; },
    playlistTracks: async (n) => store.slots[n] ?? [],
    follow: (t) => { store.follower = t; },
  });
  return store;
}

export { BLOCK };
