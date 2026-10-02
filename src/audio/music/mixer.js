// The music synthesizer as the audio thread runs it (spec §6 Music): tracks by id, each started as a Deck (deck.js),
// crossfaded on a change, a next track queued to start on the very sample the current one finishes its passes, and
// a soft ceiling on the sum so nothing clips. Commands and events are plain objects, so the same mixer runs in the
// AudioWorklet (worklet.js), in the render-ahead worker (worker.js) and under Node for tests and measurements.
import { Deck } from './deck.js';
import { compile } from './score.js';
import { TRACKS } from './songs/index.js';
import { PATCHES } from './patches.js';

export const BLOCK = 2048;  // samples per block the render-ahead worker sends (worker.js)
export const KNEE = 0.8;   // the sum is untouched below this, then rounds off smoothly towards full scale
const MIN_FADE = 0.03;     // seconds: even a cut is a short fade, never a click
const HP_HZ = 40;          // the high-pass under the music

export class MusicMixer {
  /** onEvent({ type: 'started'|'pass'|'ended', id, ... }): what the director hears back. */
  constructor({ rate, tracks = TRACKS, patches = PATCHES, onEvent = () => {} } = {}) {
    this.rate = rate;
    this.tracks = tracks;
    this.patches = patches;
    this.onEvent = onEvent;
    this.compiled = new Map();
    this.prepared = new Map();   // patches prepared once, shared by every deck
    this.decks = [];
    this.current = null;
    this.queued = null;
    this.frames = 0;
    this.hp = highpass(HP_HZ, rate);
    this.hpState = new Float64Array(8);
  }

  get active() { return this.decks.length > 0; }

  get time() { return this.frames / this.rate; }

  deck(id, passes) {
    const track = this.tracks[id];
    if (!track) return null;
    if (!this.compiled.has(id)) this.compiled.set(id, compile(track));
    const c = this.compiled.get(id);
    return new Deck(c, this.patches, this.rate, { passes: passes ?? c.passes, prepared: this.prepared });
  }

  command(m) {
    if (m.cmd === 'play') this.play(m.id, m);
    else if (m.cmd === 'next') this.queued = { id: m.id, passes: m.passes };
    else if (m.cmd === 'stop') this.stop(m.fade ?? 0.5);
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

  /** Everything playing fades out; a track still waiting to come in is simply dropped (unheard, it has nothing to fade). */
  fadeAll(fade) {
    this.decks = this.decks.filter((d) => !(d.delay > 0));
    for (const d of this.decks) d.fade(0, Math.max(MIN_FADE, fade));
  }

  stop(fade = 0.5) {
    this.fadeAll(fade);
    this.current = null;
    this.queued = null;
  }

  /** Fills n samples of left and right. */
  render(L, R, n) {
    L.fill(0, 0, n);
    R.fill(0, 0, n);
    for (let k = 0; k < this.decks.length; k++) {
      const d = this.decks[k];
      let from = 0;
      if (d.delay > 0) { from = Math.min(n, d.delay); d.delay -= from; }
      if (from < n) d.render(L, R, from, n - from);
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
            this.onEvent({ type: 'started', id: q.id, time: this.time + next.delay / this.rate });
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
