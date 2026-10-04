// The Mentats' voices on the campaign screens (notes docs/superpowers/notes/2026-10-05-mentat-voice.md): every
// clip of src/audio/mentat-lines.js, rendered by scripts/voices/mentat.py into assets/voice/mentat/ (mono Ogg Opus,
// -19 LUFS) with a timing track each: the words, the mouth shapes (visemes), the voice's loudness at 30 Hz and an
// expression per sentence. MentatVoice plays one line at a time on an audio context of its own (made at the first
// line, after the player's clicks have brought them to the campaign), at the Options volume times the Voices level;
// a new line stops the old one, the music is asked to duck under it, and the line's handle answers at(t) for the
// words on screen and, in part 2, the face. Nothing here throws: without Web Audio, the manifest, a clip or with
// Options → Mentat voice Off, say() gives null and the screens type their words as before.
import { clipId } from './mentat-lines.js';

export const MENTAT_BASE = new URL('../../assets/voice/mentat/', import.meta.url).href;
/** The mouth shapes, as the track's letters (r m f a e o l) give them; a frame's `shape` is the index. */
export const VISEMES = ['rest', 'MBP', 'FV', 'A', 'E', 'O', 'L'];
const CODES = 'rmfaeol';
/** The expressions a sentence may carry. */
export const EXPRESSIONS = ['neutral', 'grave', 'pleased', 'warning', 'angry', 'sly', 'sad'];
const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
export const BLEND = 0.06;       // seconds a mouth takes to move from one shape to the next (frame.mix)
export const JOIN_GAP = 0.6;     // seconds of quiet between two clips said as one line (the last win and the ending)
export const FADE = 0.05;        // seconds: a stopped line fades out over this
export const UNDUCK_AFTER = 350; // ms the music waits after a line before it comes back up (a next line may follow)
const CACHE = 6;                 // decoded clips kept (a long one is about 6 MB of samples)

/** A frame of a line: what at(t) fills in. Make one per face and pass it to every at() / now(). */
export function restFrame() {
  return { t: 0, speaking: false, viseme: 'rest', shape: 0, from: 0, mix: 1, open: 0, expression: 'neutral', word: -1, sentence: -1 };
}

/** `out` at rest at time `t` (the mouth closed from where it was, the expression kept). */
function rest(out, t) {
  out.t = t; out.speaking = false; out.from = out.shape ?? 0; out.shape = 0; out.viseme = 'rest'; out.mix = 1; out.open = 0; out.word = -1; out.sentence = -1;
  out.expression ??= 'neutral';
  return out;
}

// the last index i with a[i] <= v, or -1
function floorIndex(a, v, n = a.length) {
  let lo = 0, hi = n - 1, at = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] <= v) { at = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return at;
}

/**
 * A clip's timing track, read once into typed arrays so at(t) allocates nothing. json: what mentat.py writes
 * ({ v: 1, id, ms, lines, words: [[startMs, endMs, line, c0, c1]], sentences: [[startMs, endMs, firstWord,
 * lastWord, expression]], visemes: { t: [ms], s: 'rmfaeol…' }, env: { hz, q: 'base64url, one letter a frame' } }).
 */
export class MentatTrack {
  constructor(json) {
    const words = json?.words ?? [], sentences = json?.sentences ?? [], vis = json?.visemes ?? { t: [], s: '' };
    this.id = json?.id ?? null;
    this.lines = Array.isArray(json?.lines) ? json.lines.slice() : [];
    this.duration = (json?.ms ?? 0) / 1000;
    this.words = words.map((w) => ({ start: w[0] / 1000, end: w[1] / 1000, line: w[2], c0: w[3], c1: w[4] }));
    this.wordStarts = Float64Array.from(this.words, (w) => w.start);
    this.sentences = sentences.map((s) => ({ start: s[0] / 1000, end: s[1] / 1000, first: s[2], last: s[3], expression: EXPRESSIONS.includes(s[4]) ? s[4] : 'neutral' }));
    this.sentenceStarts = Float64Array.from(this.sentences, (s) => s.start);
    this.visemeTimes = Float64Array.from(vis.t ?? [], (ms) => ms / 1000);
    this.visemeShapes = Uint8Array.from(vis.s ?? '', (c) => Math.max(0, CODES.indexOf(c)));
    const q = json?.env?.q ?? '';
    this.envHz = json?.env?.hz ?? 30;
    this.env = Float32Array.from(q, (c) => Math.max(0, B64.indexOf(c)) / 63);
  }

  /** Several clips said one after another, `gap` seconds apart, as one track (its lines follow one another). */
  static join(tracks, gap = JOIN_GAP) {
    if (tracks.length === 1) return tracks[0];
    const out = Object.create(MentatTrack.prototype);
    const hz = tracks[0].envHz;
    let at = 0, lineAt = 0, wordAt = 0;
    const words = [], sentences = [], vt = [], vs = [], env = [], lines = [];
    tracks.forEach((tr, k) => {
      for (const w of tr.words) words.push({ ...w, start: w.start + at, end: w.end + at, line: w.line + lineAt });
      for (const s of tr.sentences) sentences.push({ ...s, start: s.start + at, end: s.end + at, first: s.first + wordAt, last: s.last + wordAt });
      tr.visemeTimes.forEach((t, i) => { vt.push(t + at); vs.push(tr.visemeShapes[i]); });
      const frames = Math.round(at * hz);
      while (env.length < frames) env.push(0);
      env.push(...tr.env);
      lines.push(...tr.lines);
      at += tr.duration + (k < tracks.length - 1 ? gap : 0);
      lineAt += tr.lines.length;
      wordAt += tr.words.length;
    });
    Object.assign(out, { id: tracks.map((t) => t.id).join('+'), lines, duration: at, words, sentences, envHz: hz, env: Float32Array.from(env),
      wordStarts: Float64Array.from(words, (w) => w.start), sentenceStarts: Float64Array.from(sentences, (s) => s.start),
      visemeTimes: Float64Array.from(vt), visemeShapes: Uint8Array.from(vs) });
    return out;
  }

  /**
   * The line at `t` seconds, written into `out` (made once by the caller: restFrame()) and returned: the mouth
   * (`viseme` by name, `shape` its index, `from` the shape before it and `mix` 0..1 of the move between them), the
   * jaw (`open`, the voice's loudness 0..1), the face (`expression`: the sentence's, held between sentences and
   * shown from the start), the `word` and `sentence` being said or last said (-1 before the first) and `speaking`.
   */
  at(t, out = restFrame()) {
    out.t = t;
    const v = floorIndex(this.visemeTimes, t);
    out.shape = v < 0 ? 0 : this.visemeShapes[v];
    out.from = v < 1 ? 0 : this.visemeShapes[v - 1];
    out.mix = v < 0 ? 1 : Math.min(1, (t - this.visemeTimes[v]) / BLEND);
    out.viseme = VISEMES[out.shape];
    const e = this.env, n = e.length, x = t * this.envHz;
    if (!n || x < 0 || x >= n) out.open = 0;
    else { const i = Math.floor(x), a = e[i], b = i + 1 < n ? e[i + 1] : 0; out.open = a + (b - a) * (x - i); }
    out.word = floorIndex(this.wordStarts, t);
    const s = floorIndex(this.sentenceStarts, t);
    out.sentence = s;
    const sentence = this.sentences[Math.max(0, s)];
    out.expression = sentence?.expression ?? 'neutral';
    out.speaking = s >= 0 && t <= this.sentences[s].end;
    if (t < 0 || t > this.duration) { out.from = out.shape = 0; out.viseme = 'rest'; out.mix = 1; out.speaking = false; }
    return out;
  }

  /** The index of the first word on `line` (or -1). */
  firstWordOn(line) { return this.words.findIndex((w) => w.line === line); }
}

/**
 * One line being said: made by MentatVoice.say(). `duration` (seconds) is known at once from the manifest; `track`
 * once loaded. `state`: 'loading', 'playing', 'ended', 'stopped' or 'failed'. `started` resolves true when the
 * sound starts, false when it never will (stopped first, a clip that cannot be had, a context that will not run).
 * `time` is the seconds heard so far (0 while loading, the duration once over), so `now()` gives the frame of what
 * is heard now; `frame` is the line's own frame object, which now() and at() fill when given none.
 */
export class MentatLine {
  constructor(voice, ids, duration) {
    this.voice = voice;
    this.ids = ids;
    this.id = ids.join('+');
    [this.house, this.key] = ids[0].split('/');   // 'atreides', 'm4-briefing'
    this.duration = duration;
    this.track = null;
    this.state = 'loading';
    this.frame = restFrame();
    this.t0 = 0;          // the context's time at which the line's start is (or would be) heard
    this.offset = 0;      // where in the line playback (re)started
    this.sources = [];
    this.gain = null;
    this.ends = new Set();
    this.started = new Promise((resolve) => { this.resolveStarted = resolve; });
  }

  get time() {
    if (this.state === 'ended') return this.duration;
    if (this.state !== 'playing') return this.state === 'stopped' ? this.stoppedAt ?? 0 : 0;
    return Math.min(this.duration, Math.max(0, this.voice.clock() - this.t0));
  }

  at(t, out = this.frame) { return this.track ? this.track.at(t, out) : rest(out, t); }
  now(out = this.frame) { return this.at(this.time, out); }

  /** fn(reason) once the line is over: 'ended', 'stopped' or 'failed'. Returns a function that unsubscribes. */
  onEnd(fn) {
    if (this.state === 'ended' || this.state === 'stopped' || this.state === 'failed') { fn(this.state); return () => {}; }
    this.ends.add(fn);
    return () => this.ends.delete(fn);
  }

  /** Jumps to `t` seconds (the text's "read on"); false when it cannot. */
  seek(t) { return this.voice.seek(this, t); }

  stop() { this.voice.finish(this, 'stopped'); }
}

/**
 * The Mentats' voice. settings: the live settings (sound, volume, voiceVolume, mentatVoice); duck(on): the music
 * ducks under a line; base, fetch, context (makes the AudioContext), later (setTimeout) are for tests.
 */
export class MentatVoice {
  constructor({ settings = {}, duck = null, base = MENTAT_BASE, fetch = globalThis.fetch?.bind(globalThis), context = null, later = null } = {}) {
    Object.assign(this, { settings, duck, base, fetchFn: fetch });
    const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    this.makeContext = context ?? (typeof Ctx === 'function' ? () => new Ctx({ latencyHint: 'interactive' }) : null);
    this.later = later ?? ((fn, ms) => { const t = setTimeout(fn, ms); t?.unref?.(); return t; });
    this.available = typeof this.makeContext === 'function' && typeof this.fetchFn === 'function';
    this.ctx = null;
    this.master = null;
    this.manifestData = undefined;   // undefined: not asked yet; null: not to be had
    this.manifestLoading = null;
    this.clips = new Map();          // id → Promise<{ buffer, track }>, the last CACHE used
    this.current = null;
    this.listeners = { line: new Set(), end: new Set() };
    this.ducked = false;
    this.unduck = 0;
    this.silent = restFrame();
  }

  /** Spoken at all: Options → Mentat voice On, Sound on, a volume and a Voices level above 0, Web Audio there. */
  get enabled() {
    const s = this.settings;
    return this.available && s.mentatVoice !== false && s.sound !== false && Number(s.volume ?? 0.8) > 0 && Number(s.voiceVolume ?? 0.8) > 0;
  }

  /** The level of the voice: the Options volume times the Voices level. */
  level() { const s = this.settings; return s.sound === false ? 0 : Number(s.volume ?? 0.8) * Number(s.voiceVolume ?? 0.8); }

  /** fn(line) when a line starts to sound ('line') or fn(line, reason) when it is over ('end'); returns off(). */
  on(type, fn) { this.listeners[type]?.add(fn); return () => this.listeners[type]?.delete(fn); }
  emit(type, ...args) { for (const fn of this.listeners[type] ?? []) try { fn(...args); } catch (err) { console.warn('mentat voice:', err); } }

  /** The manifest (assets/voice/mentat/manifest.json), fetched once; null when it cannot be had. */
  manifest() {
    if (this.manifestData !== undefined) return Promise.resolve(this.manifestData);
    if (!this.available) { this.manifestData = null; return Promise.resolve(null); }
    this.manifestLoading ??= this.fetchFn(new URL('manifest.json', this.base).href)
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((m) => (this.manifestData = m && typeof m.clips === 'object' ? m : null));
    return this.manifestLoading;
  }

  /** Fetches the manifest ahead of the first line (the campaign's words are loading). */
  prepare() { if (this.enabled) this.manifest(); }

  /** The clip's entry, or null (also while the manifest is still loading: undefined). */
  entry(id) { return this.manifestData === undefined ? undefined : this.manifestData?.clips?.[id] ?? null; }

  /**
   * The Mentat of `house` says his `kind` line ('page' n, 'question', 'briefing' / 'advice' / 'win' / 'lose' of
   * mission n, 'ending'). Same as say([id]). `lines`: the screen's lines, which must be the clip's words.
   */
  speak(house, n, kind, opts) { const id = clipId(house, kind, n); return id ? this.say([id], opts) : null; }

  /**
   * The clips `ids` said one after another as one line (the last win and the ending): a MentatLine, or null when
   * the voice is off or a clip is known to be missing or to say other words than `lines`. Stops the line before.
   */
  say(ids, { lines = null } = {}) {
    this.stop();
    if (!this.enabled || !ids?.length || ids.some((id) => !id)) return null;
    const entries = ids.map((id) => this.entry(id));
    if (entries.some((e) => e === null)) return null;
    if (lines && entries.every(Boolean) && entries.map((e) => e.text).join('\n') !== lines.join('\n')) {
      console.warn('mentat voice: the words on screen are not the clip\'s', ids.join(', '));
      return null;
    }
    const known = entries.every(Boolean) ? entries.reduce((s, e) => s + e.seconds, 0) + JOIN_GAP * (ids.length - 1) : 0;
    const line = new MentatLine(this, ids, known);
    this.current = line;
    this.load(line, lines).catch((err) => { console.warn('mentat voice:', err?.message ?? err); this.finish(line, 'failed'); });
    return line;
  }

  /** Fetches and decodes the clips ahead (the advice while the briefing plays). */
  preload(ids) {
    if (!this.enabled) return;
    this.manifest().then(() => { for (const id of ids) if (id && this.entry(id)) this.clip(id).catch(() => {}); });
  }

  context() {
    if (!this.ctx) {
      this.ctx = this.makeContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.level();
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /** What is heard now on the context's clock, its output latency taken off (seconds). */
  clock() {
    const c = this.ctx;
    if (!c) return 0;
    return c.currentTime - (Number(c.outputLatency) || Number(c.baseLatency) || 0);
  }

  clip(id) {
    let p = this.clips.get(id);
    if (p) { this.clips.delete(id); this.clips.set(id, p); return p; }   // the most recent last
    const entry = this.entry(id), ctx = this.context();
    const get = (file, how) => this.fetchFn(new URL(file, this.base).href).then((r) => { if (!r.ok) throw new Error(`${file}: ${r.status}`); return r[how](); });
    p = Promise.all([get(entry.file, 'arrayBuffer').then((data) => ctx.decodeAudioData(data)), get(entry.track, 'json')])
      .then(([buffer, json]) => ({ buffer, track: new MentatTrack(json) }));
    p.catch(() => this.clips.get(id) === p && this.clips.delete(id));
    this.clips.set(id, p);
    while (this.clips.size > CACHE) this.clips.delete(this.clips.keys().next().value);
    return p;
  }

  async load(line, lines) {
    const m = await this.manifest();
    if (line !== this.current) return;
    const entries = line.ids.map((id) => m?.clips?.[id] ?? null);
    if (entries.some((e) => !e)) throw new Error(`no clip ${line.id}`);
    line.duration ||= entries.reduce((sum, e) => sum + e.seconds, 0) + JOIN_GAP * (entries.length - 1);
    if (lines && entries.map((e) => e.text).join('\n') !== lines.join('\n')) throw new Error(`the words on screen are not ${line.id}'s`);
    const ctx = this.context();
    if (ctx.state === 'suspended') ctx.resume?.()?.catch?.(() => {});
    const clips = await Promise.all(line.ids.map((id) => this.clip(id)));
    if (line !== this.current) return;
    line.parts = clips;
    line.track = MentatTrack.join(clips.map((c) => c.track));
    line.duration = line.track.duration;
    if (ctx.state !== 'running') await waitRunning(ctx);   // no gesture yet: the line waits (the screen falls back to typing meanwhile)
    if (line !== this.current) return;
    this.play(line, 0);
    line.state = 'playing';
    line.resolveStarted(true);
    this.setDuck(true);
    this.emit('line', line);
  }

  /** (Re)starts the line's sound at `offset` seconds: each part scheduled on the context's clock. */
  play(line, offset) {
    const ctx = this.ctx;
    this.silence(line, 0);
    this.master.gain.value = this.level();
    const gain = ctx.createGain();
    gain.connect(this.master);
    const now = ctx.currentTime + 0.02;
    let at = 0;
    line.sources = [];
    line.parts.forEach((part, k) => {
      const len = part.track.duration, from = Math.max(0, offset - at);
      if (from < len) {
        const src = ctx.createBufferSource();
        src.buffer = part.buffer;
        src.connect(gain);
        src.start(now + Math.max(0, at - offset), from);
        line.sources.push(src);
      }
      at += len + (k < line.parts.length - 1 ? JOIN_GAP : 0);
    });
    const last = line.sources.at(-1);
    if (last) last.onended = () => { if (line.gain === gain && line.state === 'playing') this.finish(line, 'ended'); };
    else this.later(() => { if (line.gain === gain && line.state === 'playing') this.finish(line, 'ended'); }, 0);
    line.gain = gain;
    line.offset = offset;
    line.t0 = now - offset;   // heard at now + the output latency, which clock() takes off
  }

  /** Fades the line's sound out over `fade` seconds and lets its nodes go. */
  silence(line, fade = FADE) {
    const gain = line.gain, sources = line.sources;
    line.gain = null;
    line.sources = [];
    if (!gain) return;
    const ctx = this.ctx, t = ctx.currentTime;
    try {
      if (fade > 0 && gain.gain.setTargetAtTime) { gain.gain.setTargetAtTime(0, t, fade / 3); }
      for (const s of sources) { s.onended = null; s.stop?.(t + fade); }
    } catch { /* already stopped */ }
    this.later(() => { try { gain.disconnect(); for (const s of sources) s.disconnect?.(); } catch { /* gone */ } }, fade * 1000 + 50);
  }

  seek(line, t) {
    if (line !== this.current || line.state !== 'playing' || !line.parts) return false;
    const to = Math.max(0, Math.min(line.duration, t));
    if (to >= line.duration) { this.finish(line, 'ended'); return true; }
    this.play(line, to);
    return true;
  }

  /** The line is over (`reason`): its sound stops, its promises and listeners are told, the music comes back up. */
  finish(line, reason) {
    if (!line || line.state === 'ended' || line.state === 'stopped' || line.state === 'failed') return;
    if (reason === 'stopped') line.stoppedAt = line.time;
    const was = line.state;
    line.state = reason;
    this.silence(line);
    line.resolveStarted(false);
    if (this.current === line) { this.current = null; this.setDuck(false); }
    for (const fn of line.ends) try { fn(reason); } catch (err) { console.warn('mentat voice:', err); }
    line.ends.clear();
    if (was === 'playing') this.emit('end', line, reason);
  }

  /** Stops the line being said (leaving a screen, a new line). */
  stop() { if (this.current) this.finish(this.current, 'stopped'); }

  /** The music ducks at once under a line and comes back a moment after the last one. */
  setDuck(on) {
    const token = ++this.unduck;
    if (on) { if (!this.ducked) { this.ducked = true; try { this.duck?.(true); } catch (err) { console.warn('mentat voice: duck:', err); } } return; }
    this.later(() => {
      if (token !== this.unduck || !this.ducked) return;
      this.ducked = false;
      try { this.duck?.(false); } catch (err) { console.warn('mentat voice: duck:', err); }
    }, UNDUCK_AFTER);
  }

  /** The face's frame now: the line playing, else at rest (its last expression kept). Allocates nothing. */
  now(out = this.silent) {
    const line = this.current;
    return line?.state === 'playing' ? line.now(out) : rest(out, 0);
  }

  /** For tests and the browser check: what is being said and where. */
  debug() {
    const line = this.current;
    return { enabled: this.enabled, context: this.ctx?.state ?? null, manifest: this.manifestData === undefined ? 'not loaded' : !!this.manifestData,
      ducked: this.ducked, line: line && { id: line.id, state: line.state, time: +line.time.toFixed(3), duration: +line.duration.toFixed(3), frame: { ...line.now(restFrame()) } } };
  }
}

/** Resolves once the context runs (the player's first gesture), or never. */
function waitRunning(ctx) {
  return new Promise((resolve) => {
    if (ctx.state === 'running') { resolve(); return; }
    const look = () => { if (ctx.state === 'running') { ctx.removeEventListener?.('statechange', look); resolve(); } };
    ctx.addEventListener?.('statechange', look);
  });
}
