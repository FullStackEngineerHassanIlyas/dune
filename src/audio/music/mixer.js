// The music synthesizer as the audio thread runs it (spec §6 Music): tracks by id, each started as a Deck (deck.js),
// crossfaded on a change, a next track queued to start on the very sample the current one finishes its passes, and
// a soft ceiling on the sum so nothing clips. Commands and events are plain objects, so the same mixer runs in the
// AudioWorklet (worklet.js), in the render-ahead worker (worker.js) and under Node for tests and measurements.
// The player's own Mega Drive files (VGM, contract C8) are registered by id ({ cmd: 'vgm', id, data }) and then
// played like any track, each by a VgmDeck (vgm-deck.js) with the Deck's shape; that player is handed in, or found
// on the global scope where the page loaded it (output.js), so the FM music never waits for its code. A VGM that
// cannot be played says so ({ type: 'error', id }) and goes quiet; the conductor moves on.
import { Deck } from './deck.js';
import { compile } from './score.js';
import { TRACKS } from './songs/index.js';
import { PATCHES } from './patches.js';

export const BLOCK = 2048;  // samples per block the render-ahead worker sends (worker.js)
export const KNEE = 0.8;   // the sum is untouched below this, then rounds off smoothly towards full scale
const MIN_FADE = 0.03;     // seconds: even a cut is a short fade, never a click
const HP_HZ = 40;          // the high-pass under the music
const WARM_BLOCKS = 64;    // blocks of 128 a VGM player is run through before its first real track (about 0.17 s of audio)
// The player's Sega tracks against this game's FM tracks: from vgm-deck.js at its native scale the rip measures
// -34 to -37 dB RMS (peaks 0.05-0.15) where ours sit at -19 to -21 dB; +14 dB brings them alongside, below the
// ceiling's knee. Its own balance left some far under the FM tracks they replace (Radnor's Scheme 7 dB, Chosen
// Destiny 5.6 dB), so each Sega track also has a gain of its own (vgmLevel), sent with its data.
export const VGM_GAIN = 5;
export const VGM_LOUDNESS = -19;   // LUFS each Sega track is brought to (the FM tracks sit at about -18)
/**
 * The Sega rip's tracks by their Music Test names (sega-tracks.js) as measured through vgm-deck.js at VGM_GAIN,
 * 48 kHz, over their first pass (at most 150 s): [integrated EBU R128 loudness in LUFS, sample peak]. A rip is the
 * game's own register writes, so any rip of these tracks measures the same.
 */
export const SEGA_LEVELS = {
  'Opening': [-21.1, 0.593], 'Cyril\'s Council': [-19.9, 0.536], 'Ammon\'s Advice': [-20.7, 0.489], 'Radnor\'s Scheme': [-25.3, 0.195],
  'The Lego Tune': [-16.3, 1.286], 'Turbulence': [-20.1, 0.826], 'Spice Trip': [-17.3, 1.222], 'Command Post': [-18.9, 0.845],
  'Trenching': [-18.2, 0.52], 'Starport': [-23.2, 0.421], 'Evasive Action': [-20.2, 0.45], 'Chosen Destiny': [-23.7, 0.616],
  'Conquest': [-18.5, 0.408], 'Slitherin': [-19, 0.828], 'Harkonnen Rules': [-19.1, 0.492], 'Atreides Dirge': [-21.1, 0.308],
  'Ordos Dirge': [-21.2, 0.3], 'Harkonnen Dirge': [-20.4, 0.518], 'Finale': [-19, 0.432], 'Credit Roll': [-17.3, 0.81],
};

/**
 * The gain on top of VGM_GAIN that brings a Sega track (by title) to VGM_LOUDNESS, 1 for any other. A lift stops
 * where the track's loudest sample would pass full scale: the ceiling rounds it by 0.4 dB at most (Chosen Destiny's
 * one transient, in a single 10 ms of its minute; the loudest in-game tunes went 2 dB into it before).
 */
export function vgmLevel(title) {
  const m = SEGA_LEVELS[title];
  if (!m) return 1;
  const [lufs, peak] = m, g = 10 ** ((VGM_LOUDNESS - lufs) / 20);
  return g > 1 ? Math.min(g, Math.max(1, 1 / peak)) : g;
}

export class MusicMixer {
  /**
   * onEvent({ type: 'started'|'pass'|'ended'|'error', id, ... }): what the director hears back ('started' with
   * `queued` when it is the queued track taking over, not a play command's own). VgmDeck: the class
   * that plays a VGM (else globalThis.duneVgmDeck, put there when the page loads it).
   */
  constructor({ rate, tracks = TRACKS, patches = PATCHES, onEvent = () => {}, VgmDeck = null } = {}) {
    this.rate = rate;
    this.tracks = tracks;
    this.patches = patches;
    this.onEvent = onEvent;
    this.VgmDeck = VgmDeck;
    this.vgms = new Map();       // id → the player's VGM file (plain bytes), as registered
    this.vgmGains = new Map();   // id → its own gain on top of VGM_GAIN (vgmLevel), as registered
    this.warm = false;           // the VGM player's code has been run through once (warmUp)
    this.compiled = new Map();
    this.prepared = new Map();   // patches prepared once, shared by every deck
    this.decks = [];
    this.current = null;
    this.queued = null;
    this.held = false;   // the game is muted: nothing is rendered, and the music carries on from here when it is not
    this.frames = 0;
    this.hp = highpass(HP_HZ, rate);
    this.hpState = new Float64Array(8);
  }

  /** Anything to render: false when nothing plays, and while held. */
  get active() { return this.decks.length > 0 && !this.held; }

  get time() { return this.frames / this.rate; }

  deck(id, passes) {
    if (this.vgms.has(id)) return this.vgmDeck(id, passes);
    const track = this.tracks[id];
    if (!track) return null;
    if (!this.compiled.has(id)) this.compiled.set(id, compile(track));
    const c = this.compiled.get(id);
    return new Deck(c, this.patches, this.rate, { passes: passes ?? c.passes, prepared: this.prepared });
  }

  /** A registered VGM as a deck, or null (and an error event) when there is no player for it or it will not read. */
  vgmDeck(id, passes = 0) {
    const Player = this.VgmDeck ?? globalThis.duneVgmDeck;
    try {
      if (typeof Player !== 'function') throw new Error('no VGM player');
      const d = new Player(id, this.vgms.get(id), { sampleRate: this.rate, passes: passes ?? 0, gain: VGM_GAIN * (this.vgmGains.get(id) ?? 1) });
      d.vgm = true;
      return d;
    } catch (err) {
      this.onEvent({ type: 'error', id, message: String(err?.message ?? err) });
      return null;
    }
  }

  command(m) {
    if (m.cmd === 'play') this.play(m.id, m);
    else if (m.cmd === 'next') this.queued = m.id ? { id: m.id, passes: m.passes } : null;   // no id: nothing to follow
    else if (m.cmd === 'stop') this.stop(m.fade ?? 0.5);
    else if (m.cmd === 'hold') this.held = !!m.on;
    else if (m.cmd === 'vgm') {
      // a VGM's plain bytes under an id (sent again after a synth restart), and its own `gain`; no data forgets it.
      // `warm`: the page says no one is listening (the context not yet running), so the player may be warmed up now
      if (m.data) {
        this.vgms.set(m.id, m.data instanceof Uint8Array ? m.data : new Uint8Array(m.data));
        this.vgmGains.set(m.id, m.gain > 0 ? m.gain : 1);
        if (m.warm && !this.warm && !this.decks.length) this.warmUp(m.id);
      } else { this.vgms.delete(m.id); this.vgmGains.delete(m.id); }
    }
  }

  /**
   * The VGM player's code run through once, while nothing plays and no one listens (the intro's cue is queued before
   * the gesture lets the context run): a throwaway deck renders a moment of the file, so the real one's first blocks
   * are not slowed by the engine compiling the chips' code (measured: 24 ms for the first block cold, inside the
   * 2.7 ms budget after). It takes about 0.1 s, so a running context never asks for it: there the first VGM's first
   * block runs cold instead.
   */
  warmUp(id) {
    const Player = this.VgmDeck ?? globalThis.duneVgmDeck;
    if (typeof Player !== 'function') return;
    this.warm = true;
    try {
      const d = new Player(`${id}:warm`, this.vgms.get(id), { sampleRate: this.rate, passes: 0 }), L = new Float32Array(128), R = new Float32Array(128);
      for (let i = 0; i < WARM_BLOCKS && !d.error; i++) d.render(L, R, 0, 128);
    } catch { /* the real deck will say what is wrong with it */ }
  }

  /** Starts `id` (after `wait` seconds, fading in over `fadeIn`) while whatever plays fades out over `fade`. */
  play(id, { fade = 0, fadeIn = 0, wait = 0, passes } = {}) {
    this.fadeAll(fade);
    this.queued = null;
    this.current = null;
    const deck = this.deck(id, passes);
    if (!deck) return;
    deck.delay = Math.round(wait * this.rate);
    if (fadeIn > 0) { deck.gain = 0; deck.fade(1, fadeIn); }
    this.decks.push(deck);
    this.current = deck;
    this.onEvent({ type: 'started', id, time: this.time + wait });
  }

  /**
   * Everything playing fades out; a track not heard yet — still waiting to come in, or queued on a context that has
   * not run (the intro's primed cue) — is simply dropped: it has nothing to fade.
   */
  fadeAll(fade) {
    this.decks = this.decks.filter((d) => !(d.delay > 0) && d.pos > 0);
    for (const d of this.decks) d.fade(0, Math.max(MIN_FADE, fade));
  }

  stop(fade = 0.5) {
    this.fadeAll(fade);
    this.current = null;
    this.queued = null;
  }

  /** A VGM deck that broke while playing: dropped, and the conductor told (it moves on to the next track). */
  fail(d, message) {
    d.done = true;
    if (d === this.current) this.current = null;
    this.onEvent({ type: 'error', id: d.id, message });
  }

  /** Fills n samples of left and right. */
  render(L, R, n) {
    L.fill(0, 0, n);
    R.fill(0, 0, n);
    for (let k = 0; k < this.decks.length; k++) {
      const d = this.decks[k];
      let from = 0;
      if (d.delay > 0) { from = Math.min(n, d.delay); d.delay -= from; }
      if (from < n) {
        if (!d.vgm) d.render(L, R, from, n - from);
        else {
          // a VGM that breaks says so (its `error`) and stops; this never throws on the audio thread either way
          try { d.render(L, R, from, n - from); } catch (err) { d.error = String(err?.message ?? err); }
          if (d.error) { this.fail(d, d.error); continue; }
        }
      }
      if (d.pass !== d.reported) { d.reported = d.pass; if (d.pass) this.onEvent({ type: 'pass', id: d.id, n: d.pass }); }
      if (d === this.current && d.ending) {
        // its passes are over: it rings out, and the queued track starts on the sample it stopped
        this.current = null;
        this.onEvent({ type: 'ended', id: d.id, time: this.time + (n - (d.pos - d.endedAt)) / this.rate });
        if (this.queued) {
          const q = this.queued, next = this.deck(q.id, q.passes);
          this.queued = null;
          if (next) {
            next.delay = Math.max(0, n - (d.pos - d.endedAt));
            this.decks.push(next);   // rendered later in this same loop, from that sample
            this.current = next;
            this.onEvent({ type: 'started', id: q.id, time: this.time + next.delay / this.rate, queued: true });
          }
        }
      }
    }
    for (let k = this.decks.length - 1; k >= 0; k--) if (this.decks[k].done) this.decks.splice(k, 1);
    // a high-pass under the music: clears the DC that 1:1 FM leaves, and the sub-bass no laptop speaker plays,
    // which would only eat the headroom (the Mega Drive's own output capacitor did the first half of this)
    const { b0, b1, a1, a2 } = this.hp, z = this.hpState;
    for (let c = 0; c < 2; c++) {
      const x = c ? R : L;
      let x1 = z[4 * c], x2 = z[4 * c + 1], y1 = z[4 * c + 2], y2 = z[4 * c + 3];
      for (let i = 0; i < n; i++) {
        const x0 = x[i], y = b0 * x0 + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x0; y2 = y1; y1 = y;
        x[i] = ceiling(y);
      }
      z[4 * c] = x1; z[4 * c + 1] = x2; z[4 * c + 2] = y1; z[4 * c + 3] = y2;
    }
    this.frames += n;
  }
}

/** A second-order Butterworth high-pass (RBJ cookbook), normalised: { b0, b1, a1, a2 } (b2 equals b0). */
export function highpass(hz, rate) {
  const w = (2 * Math.PI * hz) / rate, cos = Math.cos(w), alpha = Math.sin(w) / (2 * Math.SQRT1_2), a0 = 1 + alpha;
  return { b0: (1 + cos) / 2 / a0, b1: -(1 + cos) / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

/** Unity up to KNEE, then a smooth bend that never reaches full scale. */
export function ceiling(x) {
  if (x <= KNEE && x >= -KNEE) return x;
  const m = Math.abs(x), y = KNEE + (1 - KNEE) * Math.tanh((m - KNEE) / (1 - KNEE));
  return x < 0 ? -y : y;
}
