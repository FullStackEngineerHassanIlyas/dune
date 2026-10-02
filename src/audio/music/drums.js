// The soundtrack's percussion (spec §6 Music: "noise drums"; research audio-ui-controls.md §A.2: frame drums under
// the peace cues, war drums and electronic toms in battle): every hit is synthesized, as the Mega Drive's FM channel
// and noise generator made theirs — a sine body with a falling pitch, a burst of filtered noise, for the metal a
// clangorous FM pair, and soft saturation so a laptop speaker still hears a war drum's weight in its overtones.
// Deterministic (a seeded noise source), cheap (a few multiplies per sample per hit) and capped at POLYPHONY hits.
import { SINE, SINE_SIZE, SINE_MASK } from './fm.js';

export const POLYPHONY = 10;
const FLOOR = 1e-3;   // a hit's part ends 60 dB down

/**
 * The kit, one letter per piece as the drum lanes write it. tone: [from Hz, to Hz, sweep s, decay s, level];
 * noise: [filter 'bp'|'hp'|'lp', Hz, Q, decay s, level]; metal: [Hz, ratio, index, decay s, level]; drive: saturation;
 * bursts: a clap's quick repeats; pan: where it sits.
 */
export const KIT = {
  K: { name: 'kick', tone: [170, 56, 0.04, 0.26, 0.7], noise: ['bp', 3200, 0.8, 0.006, 0.6], drive: 2, pan: 0 },
  D: { name: 'war drum', tone: [112, 64, 0.1, 0.6, 0.65], noise: ['bp', 620, 0.9, 0.08, 0.75], drive: 2.6, pan: -0.1 },
  B: { name: 'boom', tone: [84, 46, 0.18, 1.1, 0.8], noise: ['lp', 400, 0.7, 0.25, 0.5], drive: 2.6, pan: 0 },
  T: { name: 'low tom', tone: [160, 96, 0.07, 0.4, 0.9], noise: ['bp', 800, 1, 0.035, 0.3], drive: 1.4, pan: -0.35 },
  t: { name: 'high tom', tone: [240, 155, 0.06, 0.3, 0.85], noise: ['bp', 1200, 1, 0.03, 0.3], drive: 1.3, pan: 0.35 },
  S: { name: 'snare', tone: [210, 175, 0.03, 0.09, 0.55], noise: ['hp', 1400, 0.7, 0.16, 0.9], drive: 1.2, pan: 0.05 },
  C: { name: 'clap', noise: ['bp', 1300, 1.1, 0.11, 1], bursts: 3, drive: 1, pan: 0.1 },
  h: { name: 'closed hat', noise: ['hp', 7200, 0.7, 0.04, 0.6], metal: [520, 1.47, 2.2, 0.03, 0.35], pan: 0.3 },
  o: { name: 'open hat', noise: ['hp', 6500, 0.7, 0.28, 0.55], metal: [520, 1.47, 2.2, 0.22, 0.3], pan: 0.3 },
  s: { name: 'tambourine', noise: ['hp', 5200, 0.7, 0.085, 0.55], metal: [2900, 1.3, 1.4, 0.07, 0.4], pan: -0.3 },
  F: { name: 'frame drum', tone: [118, 88, 0.05, 0.42, 0.9], noise: ['bp', 260, 1, 0.06, 0.45], drive: 1.5, pan: -0.15 },
  k: { name: 'tek', tone: [540, 500, 0.01, 0.045, 0.45], noise: ['bp', 3000, 1.8, 0.04, 0.8], pan: 0.2 },
  X: { name: 'crash', noise: ['hp', 4200, 0.7, 1.4, 0.5], metal: [430, 2.41, 3, 1.1, 0.35], pan: 0.2 },
  R: { name: 'anvil', tone: [880, 860, 0.02, 0.5, 0.35], metal: [610, 2.76, 1.6, 0.55, 0.6], pan: -0.2 },
};

/** tanh, near enough for saturation and far cheaper: exact at 0, within 2% to ±3, then flat at ±1. */
export const softTanh = (x) => (x > 3 ? 1 : x < -3 ? -1 : (x * (27 + x * x)) / (27 + 9 * x * x));

/** One hit sounding. */
class Hit {
  constructor() { this.active = false; this.age = 0; }

  start(piece, vel, rate, panOffset, seed) {
    const p = KIT[piece];
    this.active = true;
    this.age = 0;
    this.piece = piece;
    this.level = vel;
    const pan = Math.max(-1, Math.min(1, p.pan + panOffset)), a = ((pan + 1) * Math.PI) / 4;
    this.gl = Math.cos(a); this.gr = Math.sin(a);
    this.drive = p.drive ?? 0;
    this.driveNorm = this.drive ? 1 / softTanh(this.drive) : 1;
    // tone: pitch falls from `from` to `to` (exponentially over `sweep`), level decays over `decay`
    if (p.tone) {
      const [f0, f1, sweep, decay, lvl] = p.tone;
      this.ph = 0; this.f1 = f1 / rate; this.fd = (f0 - f1) / rate; this.fk = Math.exp(-1 / (sweep * rate));
      this.ta = lvl; this.tk = Math.exp(-6.9 / (decay * rate));   // -60 dB at `decay`
    } else this.ta = 0;
    if (p.noise) {
      const [type, hz, q, decay, lvl] = p.noise, g = Math.tan((Math.PI * Math.min(hz, rate * 0.45)) / rate), k = 1 / q;
      this.ntype = type === 'lp' ? 0 : type === 'bp' ? 1 : 2;
      this.a1 = 1 / (1 + g * (g + k)); this.a2 = g * this.a1; this.a3 = g * this.a2; this.k = k;
      this.ic1 = 0; this.ic2 = 0;
      this.na = lvl * (this.ntype === 1 ? 1 + q : 1); this.nk = Math.exp(-6.9 / (decay * rate));
      this.na0 = this.na; this.bursts = p.bursts ?? 1; this.burstLen = Math.round(0.011 * rate);
    } else this.na = 0;
    if (p.metal) {
      const [hz, ratio, index, decay, lvl] = p.metal;
      this.mc = 0; this.mm = 0; this.mci = hz / rate; this.mmi = (hz * ratio) / rate; this.mi = index;
      this.ma = lvl; this.mk = Math.exp(-6.9 / (decay * rate));
    } else this.ma = 0;
    this.seed = seed >>> 0 || 1;
  }

  /** Adds n samples into left/right from `at`; ends the hit once all of it has died away. */
  render(L, R, at, n, gain) {
    let ph = this.ph, fd = this.fd, ta = this.ta, na = this.na, ma = this.ma, s = this.seed;
    let ic1 = this.ic1, ic2 = this.ic2, mc = this.mc, mm = this.mm, age = this.age;
    const { f1, fk, tk, nk, mk, a1, a2, a3, k, ntype, mci, mmi, mi, drive, driveNorm, bursts, burstLen } = this;
    const gl = this.gl * gain * this.level, gr = this.gr * gain * this.level;
    for (let i = at, end = at + n; i < end; i++, age++) {
      let x = 0;
      if (ta > FLOOR) {
        x += SINE[(ph * SINE_SIZE) & SINE_MASK] * ta;
        ph += f1 + fd; if (ph >= 1) ph -= 1;
        fd *= fk; ta *= tk;
      }
      if (na > FLOOR) {
        s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
        const w = (s >>> 0) / 2147483648 - 1;
        const v3 = w - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
        ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
        const y = ntype === 0 ? v2 : ntype === 1 ? v1 : w - k * v1 - v2;
        // a clap: the first bursts each restart the noise's level, then it tails off
        if (bursts > 1 && age > 0 && age < bursts * burstLen && age % burstLen === 0) na = this.na0;
        x += y * na;
        na *= nk;
      }
      if (ma > FLOOR) {
        x += SINE[((mc + mi * SINE[(mm * SINE_SIZE) & SINE_MASK]) * SINE_SIZE) & SINE_MASK] * ma;
        mc += mci; if (mc >= 1) mc -= 1;
        mm += mmi; if (mm >= 1) mm -= 1;
        ma *= mk;
      }
      if (drive) x = softTanh(x * drive) * driveNorm;
      L[i] += x * gl; R[i] += x * gr;
    }
    this.ph = ph; this.fd = fd; this.ta = ta; this.na = na; this.ma = ma; this.seed = s;   // no object per block: this runs on the audio thread
    this.ic1 = ic1; this.ic2 = ic2; this.mc = mc; this.mm = mm; this.age = age;
    if (ta <= FLOOR && na <= FLOOR && ma <= FLOOR) this.active = false;
  }
}

/** The percussion of one track: hits started by the sequencer, each rendered until it dies away. */
export class DrumKit {
  constructor(rate, seed = 0x5eed) {
    this.rate = rate;
    this.hits = Array.from({ length: POLYPHONY }, () => new Hit());
    this.seed = seed >>> 0;
    this.count = 0;
  }

  hit(piece, vel = 0.8, pan = 0) {
    if (!KIT[piece]) return;
    let h = null;
    for (const x of this.hits) if (!x.active) { h = x; break; }
    if (!h) { h = this.hits[0]; for (const x of this.hits) if (x.age > h.age) h = x; }   // the oldest gives way
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    h.start(piece, vel, this.rate, pan, this.seed);
    this.count++;
  }

  get busy() {
    for (const h of this.hits) if (h.active) return true;
    return false;
  }

  render(L, R, at, n, gain) {
    for (const h of this.hits) if (h.active) h.render(L, R, at, n, gain);
  }
}
