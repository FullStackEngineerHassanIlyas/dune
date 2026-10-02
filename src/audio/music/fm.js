// FM synthesis in the manner of the Mega Drive's Yamaha YM2612 (spec §6 Music; research audio-ui-controls.md
// §A.2): four sine operators per voice wired by the chip's eight algorithms, operator 1 feeding back on itself,
// per-operator envelopes driven by rates (attack, first decay to a sustain level, second decay, release) on the
// chip's attenuation scale, total level and frequency multiple per operator, and a per-voice LFO for vibrato and
// tremolo. The numbers follow the chip (rates 0–31, release 0–15, total level 0–127 in 0.75 dB steps, sustain
// 0–15 in 3 dB steps, a full-scale modulator swinging its carrier ±4 cycles); detune is in cents. Pure and
// deterministic: the same code runs in an AudioWorklet, in a worker and under Node tests.
export const SINE_BITS = 13, SINE_SIZE = 1 << SINE_BITS, SINE_MASK = SINE_SIZE - 1;
export const SINE = new Float32Array(SINE_SIZE);
for (let i = 0; i < SINE_SIZE; i++) SINE[i] = Math.sin((2 * Math.PI * i) / SINE_SIZE);

export const DB_MAX = 96;   // the envelope's floor: silence
const DB_STEPS = 16;        // table entries per dB
const DB2LIN = new Float32Array(DB_MAX * 2 * DB_STEPS + 2);   // attenuation (dB) → amplitude, to 192 dB of stacked attenuation
for (let i = 0; i < DB2LIN.length - 1; i++) DB2LIN[i] = i / DB_STEPS >= DB_MAX ? 0 : Math.pow(10, -i / DB_STEPS / 20);
const DB_LAST = DB2LIN.length - 1;

export const MOD_CYCLES = 4;   // a full-scale modulator moves its carrier's phase ±4 cycles, as on the chip
export const TL_DB = 0.75, SL_DB = 3;

/**
 * The eight YM2612 algorithms as connections between operators 1–4 (indices 0–3): mods[k] lists the operators
 * feeding operator k, carriers the ones heard. Every connection runs from a lower operator to a higher one.
 */
export const ALGORITHMS = [
  { mods: [[], [0], [1], [2]], carriers: [3] },             // 0: 1→2→3→4
  { mods: [[], [], [0, 1], [2]], carriers: [3] },           // 1: (1+2)→3→4
  { mods: [[], [], [1], [0, 2]], carriers: [3] },           // 2: (1 + 2→3)→4
  { mods: [[], [0], [], [1, 2]], carriers: [3] },           // 3: (1→2 + 3)→4
  { mods: [[], [0], [], [2]], carriers: [1, 3] },           // 4: 1→2 + 3→4
  { mods: [[], [0], [0], [0]], carriers: [1, 2, 3] },       // 5: 1→(2, 3, 4)
  { mods: [[], [0], [], []], carriers: [1, 2, 3] },         // 6: 1→2 + 3 + 4
  { mods: [[], [], [], []], carriers: [0, 1, 2, 3] },       // 7: 1 + 2 + 3 + 4
];

/** Seconds an envelope at effective rate r (0–63, the chip's 2 × rate + key scaling) takes across the full 96 dB; rate 0 never moves. */
export function rateSeconds(r) {
  if (r <= 0) return Infinity;
  return Math.max(0.002, 0.0577 * Math.pow(2, 11 - Math.min(63, r) / 4));
}

/** Frequency multiple: 0 is a half, 1–15 the harmonic. */
export const multiple = (mul) => (mul === 0 ? 0.5 : mul);

export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** The chip's key code (0–31) for a note: what key scaling speeds the envelopes up by, higher notes faster. */
export const keyCode = (midi) => Math.max(0, Math.min(31, Math.floor((midi - 24) / 3)));

// envelope stages
export const OFF = 0, ATTACK = 1, DECAY = 2, SUSTAIN = 3, RELEASE = 4;

/**
 * A patch: { alg 0–7, fb 0–7, ops: four [mul, dt (cents), tl 0–127, ar 0–31, d1r 0–31, sl 0–15, d2r 0–31, rr 0–15, ks 0–3, am 0|1],
 * lfo: { rate Hz, pm cents, am dB, delay s } }. Normalised here once into what the voice needs.
 */
export function preparePatch(p) {
  const alg = ALGORITHMS[p.alg];
  if (!alg) throw new Error(`patch: no algorithm ${p.alg}`);
  if (!Array.isArray(p.ops) || p.ops.length !== 4) throw new Error('patch: four operators');
  const ops = p.ops.map(([mul = 1, dt = 0, tl = 0, ar = 31, d1r = 0, sl = 0, d2r = 0, rr = 15, ks = 0, am = 0]) => ({
    ratio: multiple(mul) * Math.pow(2, dt / 1200), tl: tl * TL_DB, ar, d1r, sl: sl === 15 ? DB_MAX : sl * SL_DB, d2r, rr, ks, am: !!am,
  }));
  const w = (k, j) => (alg.mods[k].includes(j) ? 1 : 0);
  return {
    ops, alg: p.alg, fb: p.fb ? Math.pow(2, p.fb - 6) : 0,
    w10: w(1, 0), w20: w(2, 0), w21: w(2, 1), w30: w(3, 0), w31: w(3, 1), w32: w(3, 2),
    c0: alg.carriers.includes(0) ? 1 : 0, c1: alg.carriers.includes(1) ? 1 : 0, c2: alg.carriers.includes(2) ? 1 : 0, c3: alg.carriers.includes(3) ? 1 : 0,
    lfo: { rate: p.lfo?.rate ?? 5.5, pm: p.lfo?.pm ?? 0, am: p.lfo?.am ?? 0, delay: p.lfo?.delay ?? 0 },
    gain: Math.pow(10, (p.gain ?? 0) / 20),
  };
}


const ATTACK_FLOOR = 0.05;   // dB: the attack's exponential approach aims this far past full level, so it arrives

/** One operator's running state. */
class Op {
  constructor() {
    this.phase = 0; this.inc = 0; this.att = DB_MAX; this.stage = OFF; this.amp = 0;
    this.lnA = 0; this.d1 = 0; this.d2 = 0; this.rr = 0; this.sl = DB_MAX; this.tl = 0; this.am = false;
  }
}

/**
 * Moves an operator's envelope n samples on (0 dB full, 96 silent): the attack an exponential approach in dB as on
 * the chip (each step a sixteenth closer), the decays and the release straight lines in dB, each stage handing the
 * rest of the samples to the next.
 */
export function advance(o, n) {
  let left = n;
  while (left > 0) {
    switch (o.stage) {
      case ATTACK: {
        if (o.lnA === 0) return o.att;   // attack rate 0: it never rises
        const k = Math.log(ATTACK_FLOOR / (o.att + ATTACK_FLOOR)) / o.lnA;
        if (k > left) { o.att = (o.att + ATTACK_FLOOR) * Math.exp(left * o.lnA) - ATTACK_FLOOR; return o.att; }
        o.att = 0; o.stage = DECAY; left -= Math.max(1, k);
        break;
      }
      case DECAY: {
        if (!o.d1) return o.att;
        const k = (o.sl - o.att) / o.d1;
        if (k > left) { o.att += o.d1 * left; return o.att; }
        o.att = o.sl; o.stage = o.sl >= DB_MAX ? OFF : SUSTAIN; left -= Math.max(1, k);
        break;
      }
      case SUSTAIN:
      case RELEASE: {
        const rate = o.stage === SUSTAIN ? o.d2 : o.rr;
        if (!rate) return o.att;
        o.att += rate * left;
        if (o.att >= DB_MAX) { o.att = DB_MAX; o.stage = OFF; }
        return o.att;
      }
      default:
        o.att = DB_MAX;
        return o.att;
    }
  }
  return o.att;
}

const level = (db) => DB2LIN[Math.min(DB_LAST, (db * DB_STEPS) | 0)];

/**
 * One FM voice (a chip channel): monophonic, as the chip's six were. noteOn retriggers the envelopes from where
 * they stand (no click), resetting the phases only when the voice had fallen silent, so every fresh note starts
 * with the same attack; slide moves the pitch without a new attack (portamento over `glide` seconds). The
 * envelopes move once a block and each operator's level runs in a straight line across it, so the sample loop is
 * only phases, table look-ups and the algorithm's sums.
 */
export class FmVoice {
  constructor(rate) {
    this.rate = rate;
    this.ops = [new Op(), new Op(), new Op(), new Op()];
    this.patch = null;
    this.fbA = 0; this.fbB = 0;
    this.pitch = 60; this.target = 60; this.glide = 0;
    this.vel = 0;          // dB of attenuation from the velocity, on the carriers
    this.lfoPhase = 0; this.lfoAge = 0;
    this.amDb = 0;         // tremolo this block
    this.gain = 1;
  }

  setPatch(patch) { this.patch = patch; this.gain = patch.gain; }

  /** Nothing to hear: every carrier's envelope has run out and its level has reached zero. */
  get silent() {
    const o = this.ops, p = this.patch;
    return !p || ((!p.c0 || (o[0].stage === OFF && !o[0].amp)) && (!p.c1 || (o[1].stage === OFF && !o[1].amp))
      && (!p.c2 || (o[2].stage === OFF && !o[2].amp)) && (!p.c3 || (o[3].stage === OFF && !o[3].amp)));
  }

  /** Velocity 0–1 to carrier attenuation: 1 is full, 0.5 about 9 dB down. */
  static velDb(v) { return (1 - Math.max(0, Math.min(1, v))) * 18; }

  noteOn(midi, vel = 0.8) {
    const p = this.patch;
    if (!p) return;
    const fresh = this.ops.every((o) => o.stage === OFF || o.att > 72);
    this.pitch = this.target = midi;
    this.vel = FmVoice.velDb(vel);
    this.lfoAge = 0;
    const kc = keyCode(midi), carriers = [p.c0, p.c1, p.c2, p.c3];
    for (let k = 0; k < 4; k++) {
      const o = this.ops[k], d = p.ops[k], ksr = kc >> (3 - d.ks);
      if (fresh) { o.phase = 0; o.att = DB_MAX; }
      o.tl = d.tl + (carriers[k] ? this.vel : 0);
      o.am = d.am;
      o.sl = d.sl;
      const ra = d.ar ? 2 * d.ar + ksr : 0;
      // attack: the chip's exponential approach (15/16 of the way per envelope step), ~1/10 of a decay at the same rate
      o.lnA = ra <= 0 ? 0 : (Math.log(15 / 16) * 1024) / rateSeconds(ra) / this.rate;
      o.d1 = d.d1r ? DB_MAX / (rateSeconds(2 * d.d1r + ksr) * this.rate) : 0;
      o.d2 = d.d2r ? DB_MAX / (rateSeconds(2 * d.d2r + ksr) * this.rate) : 0;
      o.rr = DB_MAX / (rateSeconds(4 * d.rr + 2 + ksr) * this.rate);
      o.stage = ATTACK;
      if (ra >= 62) { o.att = 0; o.stage = DECAY; }   // instant from rate 62 up
    }
    if (fresh) { this.fbA = this.fbB = 0; }
  }

  slide(midi, vel = null) {
    this.target = midi;
    if (vel !== null) {
      const db = FmVoice.velDb(vel), p = this.patch, carriers = [p.c0, p.c1, p.c2, p.c3];
      for (let k = 0; k < 4; k++) if (carriers[k]) this.ops[k].tl = p.ops[k].tl + db;
      this.vel = db;
    }
  }

  noteOff() {
    for (const o of this.ops) if (o.stage !== OFF) o.stage = RELEASE;
  }

  /** Per-block control: glide, vibrato and tremolo, and from them the operators' phase increments. */
  control(n) {
    const p = this.patch, dt = n / this.rate;
    if (this.pitch !== this.target) {
      const step = this.glide > 0 ? 1 - Math.exp(-dt / (this.glide / 3)) : 1;
      this.pitch += (this.target - this.pitch) * step;
      if (Math.abs(this.target - this.pitch) < 0.005) this.pitch = this.target;
    }
    const l = p.lfo;
    let cents = 0;
    this.amDb = 0;
    if (l.pm || l.am) {
      this.lfoAge += dt;
      const depth = l.delay > 0 ? Math.min(1, this.lfoAge / l.delay) : 1, s = SINE[(this.lfoPhase * SINE_SIZE) & SINE_MASK];
      this.lfoPhase += l.rate * dt;
      if (this.lfoPhase >= 1) this.lfoPhase -= Math.floor(this.lfoPhase);
      cents = l.pm * depth * s;
      this.amDb = l.am * depth * 0.5 * (1 + s);
    }
    const hz = midiHz(this.pitch + cents / 100) / this.rate;
    for (let k = 0; k < 4; k++) this.ops[k].inc = hz * p.ops[k].ratio;
  }

  /** Adds n samples (one control block) of this voice into `out` from `at`, times `gain`. Returns false while silent. */
  render(out, at, n, gain = 1) {
    if (this.silent) return false;
    const p = this.patch, [o0, o1, o2, o3] = this.ops, fb = p.fb * 0.5, g = gain * this.gain;
    this.control(n);
    const am = this.amDb;
    // each operator's level: from where the last block left it to where its envelope stands after this one
    let a0 = o0.amp, a1 = o1.amp, a2 = o2.amp, a3 = o3.amp;
    o0.amp = level(advance(o0, n) + o0.tl + (o0.am ? am : 0));
    o1.amp = level(advance(o1, n) + o1.tl + (o1.am ? am : 0));
    o2.amp = level(advance(o2, n) + o2.tl + (o2.am ? am : 0));
    o3.amp = level(advance(o3, n) + o3.tl + (o3.am ? am : 0));
    const d0 = (o0.amp - a0) / n, d1 = (o1.amp - a1) / n, d2 = (o2.amp - a2) / n, d3 = (o3.amp - a3) / n;
    const m10 = MOD_CYCLES * p.w10, m20 = MOD_CYCLES * p.w20, m21 = MOD_CYCLES * p.w21, m30 = MOD_CYCLES * p.w30, m31 = MOD_CYCLES * p.w31, m32 = MOD_CYCLES * p.w32;
    const c0 = p.c0 * g, c1 = p.c1 * g, c2 = p.c2 * g, c3 = p.c3 * g;
    let fbA = this.fbA, fbB = this.fbB;
    let ph0 = o0.phase, ph1 = o1.phase, ph2 = o2.phase, ph3 = o3.phase;
    const i0 = o0.inc, i1 = o1.inc, i2 = o2.inc, i3 = o3.inc;
    for (let i = at, end = at + n; i < end; i++) {
      a0 += d0; a1 += d1; a2 += d2; a3 += d3;
      const s0 = SINE[((ph0 + fb * (fbA + fbB)) * SINE_SIZE) & SINE_MASK] * a0;
      fbB = fbA; fbA = s0;
      const s1 = SINE[((ph1 + m10 * s0) * SINE_SIZE) & SINE_MASK] * a1;
      const s2 = SINE[((ph2 + m20 * s0 + m21 * s1) * SINE_SIZE) & SINE_MASK] * a2;
      const s3 = SINE[((ph3 + m30 * s0 + m31 * s1 + m32 * s2) * SINE_SIZE) & SINE_MASK] * a3;
      out[i] += c0 * s0 + c1 * s1 + c2 * s2 + c3 * s3;
      ph0 += i0; if (ph0 >= 1) ph0 -= 1;
      ph1 += i1; if (ph1 >= 1) ph1 -= 1;
      ph2 += i2; if (ph2 >= 1) ph2 -= 1;
      ph3 += i3; if (ph3 >= 1) ph3 -= 1;
    }
    o0.phase = ph0; o1.phase = ph1; o2.phase = ph2; o3.phase = ph3;
    this.fbA = fbA; this.fbB = fbB;
    return true;
  }
}
