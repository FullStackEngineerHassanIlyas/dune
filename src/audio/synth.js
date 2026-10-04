// Sound effects synthesized in code (spec §6; the original's effect list in docs/research/raw/
// audio-ui-controls.md §A.1): every recipe renders one mono Float32Array at RATE, built the way sound
// designers layer a modern RTS effect — a transient (the crack), a body (the thump, the blast) and a
// tail (rumble, grit, ringing metal) — from seeded noise, resonant filters with swept cutoffs, pitch-
// dropping thumps, modal resonators for struck metal, crackle and soft saturation. Every sound is set to
// a designed loudness (LUFS, measured as EBU R128 does) under a soft ceiling, so explosions sit above
// guns and guns above the interface however their spectra differ. Each sound has a few seeded
// variations (VARIANTS) the engine picks between, so repeats never machine-gun. Pure and deterministic,
// so it runs under Node tests; the engine copies the samples into AudioBuffers once.
export const RATE = 32000;   // 16 kHz of bandwidth: all a laptop speaker or a game mix needs, at 73% of the cost of 44.1 kHz
const TAU = 2 * Math.PI;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A recipe's dice: u(a, b) a uniform number, s() a fresh seed, n the variation being rendered. */
class Dice {
  constructor(seed, n) { this.r = rng(seed); this.n = n; }
  u(a = 0, b = 1) { return a + (b - a) * this.r(); }
  s() { return (this.r() * 4294967296) >>> 0; }
}

const len = (seconds) => Math.max(1, Math.round(seconds * RATE));

// ——— sources ———

/** White noise in [-1, 1): rng()'s generator written out in the loop, since every sound draws hundreds of thousands of these. */
export function noise(seconds, seed) {
  const a = new Float32Array(len(seconds));
  let s = seed >>> 0;
  for (let i = 0; i < a.length; i++) {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    a[i] = ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1;
  }
  return a;
}

/** Brown noise: white noise integrated (with a leak, so it never drifts) — the stuff of rumbles. */
function brown(seconds, seed) {
  const a = noise(seconds, seed);
  let y = 0;
  for (let i = 0; i < a.length; i++) { y = y * 0.996 + a[i] * 0.06; a[i] = y; }
  return a;
}

/** Sparse random clicks, perSecond of them at first, thinning with time constant tau: grit, sand, sparks. */
function crackle(seconds, seed, perSecond, tau = 1e6) {
  const r = rng(seed), a = new Float32Array(len(seconds)), k = Math.exp(-1 / (tau * RATE));
  let p = perSecond / RATE;
  for (let i = 0; i < a.length; i++, p *= k) if (r() < p) { const v = 0.3 + 0.7 * r(); a[i] = r() < 0.5 ? -v : v; }
  return a;
}

const SIN = Float32Array.from({ length: 4097 }, (_, i) => Math.sin((TAU * i) / 4096));
/** sin(2π·p) for a phase p in [0, 1), from a table: oscillators run a few times faster than with Math.sin. */
const sin01 = (p) => { const x = p * 4096, i = x | 0; return SIN[i] + (SIN[i + 1] - SIN[i]) * (x - i); };
const wave = (p, shape) => shape === 'square' ? (p < 0.5 ? 1 : -1) : shape === 'saw' ? 2 * p - 1 : shape === 'triangle' ? 1 - 4 * Math.abs(p - 0.5) : sin01(p);

/** Oscillator sweeping exponentially from f0 to f1 Hz over the whole sound. */
export function tone(seconds, f0, f1 = f0, shape = 'sine') {
  const a = new Float32Array(len(seconds)), k = Math.pow(f1 / f0, 1 / a.length);
  let phase = 0, f = f0;
  for (let i = 0; i < a.length; i++, f *= k) { phase += f / RATE; if (phase >= 1) phase -= 1; a[i] = wave(phase, shape); }
  return a;
}

/** Oscillator whose pitch is a function of time in seconds (evaluated every 16 samples): Doppler, sirens, groans. */
function glide(seconds, hz, shape = 'sine') {
  const a = new Float32Array(len(seconds));
  let phase = 0, f = 0;
  for (let i = 0; i < a.length; i++) {
    if ((i & 15) === 0) f = hz(i / RATE) / RATE;
    phase += f;
    if (phase >= 1) phase -= 1;
    a[i] = wave(phase, shape);
  }
  return a;
}

/** A sine whose pitch falls from f0 toward f1 with time constant tau: every thump and kick. */
function drop(seconds, f0, f1, tau) {
  const a = new Float32Array(len(seconds)), k = Math.exp(-1 / (tau * RATE));
  let phase = 0, df = f0 - f1;
  for (let i = 0; i < a.length; i++, df *= k) { phase += (f1 + df) / RATE; if (phase >= 1) phase -= 1; a[i] = sin01(phase); }
  return a;
}

/** Struck metal: decaying sines at [hz, tau, gain] modes, each from a random phase (two-multiply resonators). */
function modes(seconds, list, seed) {
  const r = rng(seed), a = new Float32Array(len(seconds));
  for (const [hz, tau, g] of list) {
    if (hz >= RATE * 0.45) continue;
    const w = (TAU * hz) / RATE, c = 2 * Math.cos(w), k = Math.exp(-1 / (tau * RATE)), ph = r() * TAU;
    const n = Math.min(a.length, Math.ceil(tau * RATE * 5.5));   // to -48 dB
    let y1 = Math.sin(ph - w), y2 = Math.sin(ph - 2 * w), e = g;
    for (let i = 0; i < n; i++, e *= k) { const y = c * y1 - y2; y2 = y1; y1 = y; a[i] += y * e; }
  }
  const at = Math.round(0.0004 * RATE);
  for (let i = 0; i < at && i < a.length; i++) a[i] *= i / at;
  return a;
}

// ——— filters and shapers ———

/** One-pole low-pass; the cutoff may sweep linearly from `from` to `to` Hz over the sound. */
export function lowpass(a, from, to = from) {
  let y = 0;
  for (let i = 0; i < a.length; i++) {
    const f = from + (to - from) * (i / a.length);
    y += (1 - Math.exp((-TAU * f) / RATE)) * (a[i] - y);
    a[i] = y;
  }
  return a;
}

export function highpass(a, hz) {
  const k = 1 - Math.exp((-TAU * hz) / RATE);
  let y = 0;
  for (let i = 0; i < a.length; i++) { y += k * (a[i] - y); a[i] -= y; }
  return a;
}

/**
 * A two-pole filter (RBJ cookbook): 'lp', 'hp', 'bp' (peak 0 dB) with resonance q, or 'hs' (a high
 * shelf of `db`). `hz` is a number or a function of time in seconds — a sweep, updated every 32 samples.
 */
export function biquad(a, type, hz, q = 0.707, db = 0) {
  const sweep = typeof hz === 'function', mode = ['lp', 'hp', 'bp', 'hs'].indexOf(type), A = Math.pow(10, db / 40);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  for (let at = 0; at < a.length; at += 32) {
    if (at === 0 || sweep) {
      const w = (TAU * Math.min(Math.max(sweep ? hz(at / RATE) : hz, 10), RATE * 0.45)) / RATE, cw = Math.cos(w), al = Math.sin(w) / (2 * q);
      if (mode === 3) {
        const s = 2 * Math.sqrt(A) * al, n = A + 1 - (A - 1) * cw + s;
        b0 = (A * (A + 1 + (A - 1) * cw + s)) / n;
        b1 = (-2 * A * (A - 1 + (A + 1) * cw)) / n;
        b2 = (A * (A + 1 + (A - 1) * cw - s)) / n;
        a1 = (2 * (A - 1 - (A + 1) * cw)) / n;
        a2 = (A + 1 - (A - 1) * cw - s) / n;
      } else {
        const n = 1 + al;
        a1 = (-2 * cw) / n;
        a2 = (1 - al) / n;
        b0 = mode === 0 ? (1 - cw) / (2 * n) : mode === 1 ? (1 + cw) / (2 * n) : al / n;
        b1 = mode === 0 ? 2 * b0 : mode === 1 ? -2 * b0 : 0;
        b2 = mode === 2 ? -b0 : b0;
      }
    }
    for (let i = at, end = Math.min(a.length, at + 32); i < end; i++) {
      const x = a[i], y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      a[i] = y;
    }
  }
  return a;
}

/** tanh, near enough (a rational approximation, exact at ±3 and flat beyond): soft clipping without Math.tanh's cost. */
const soft = (x) => (x <= -3 ? -1 : x >= 3 ? 1 : (x * (27 + x * x)) / (27 + 9 * x * x));

/** Soft saturation: grit and loudness, and harmonics that let a laptop speaker hint at a sub-bass thump. */
function drive(a, k) {
  normalize(a, 1);
  const n = soft(k);
  for (let i = 0; i < a.length; i++) a[i] = soft(k * a[i]) / n;
  return a;
}

/** A feedback comb whose delay sweeps from d0 to d1 seconds: tube resonance and the Sonic Tank's phasing. */
function comb(a, d0, d1, feedback) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const back = i - (d0 + ((d1 - d0) * i) / a.length) * RATE, j = Math.floor(back), f = back - j;
    const y = j >= 1 ? out[j] * (1 - f) + out[j + 1] * f : 0;
    out[i] = a[i] + feedback * y;
  }
  return out;
}

// ——— envelopes ———

/** Linear attack (seconds), then a decay to silence shaped by `curve` (higher is snappier). */
export function envelope(a, attack = 0.002, curve = 3) {
  const at = Math.max(1, Math.round(attack * RATE)), n = a.length;
  for (let i = 0; i < n; i++) a[i] *= i < at ? i / at : Math.pow(1 - (i - at) / Math.max(1, n - at), curve);
  return a;
}

/** Linear attack, then an exponential decay with time constant tau (seconds); the last 3 ms fade out, so a layer cut short never clicks. */
function decay(a, attack, tau) {
  const at = Math.max(1, Math.round(attack * RATE)), k = Math.exp(-1 / (tau * RATE)), fade = Math.min(a.length, len(0.003));
  let e = 1;
  for (let i = 0; i < a.length; i++) {
    if (i < at) a[i] *= i / at;
    else { a[i] *= e; e *= k; }
  }
  for (let i = 0; i < fade; i++) a[a.length - 1 - i] *= i / fade;
  return a;
}

/** Amplitude drawn through [seconds, level] points, straight lines between them. */
function shape(a, points) {
  let i = 0;
  for (; i < Math.min(a.length, Math.round(points[0][0] * RATE)); i++) a[i] *= points[0][1];
  for (let j = 0; j + 1 < points.length; j++) {
    const [, v0] = points[j], [t1, v1] = points[j + 1], end = Math.min(a.length, Math.round(t1 * RATE)), step = (v1 - v0) / Math.max(1, end - i);
    for (let v = v0; i < end; i++, v += step) a[i] *= v;
  }
  for (const v = points[points.length - 1][1]; i < a.length; i++) a[i] *= v;
  return a;
}

/** Random, smooth movement of the level about `hz` times a second (depth 1 dips to silence): sputter, grind. */
function wobble(a, seed, hz, depth) {
  const r = rng(seed), step = Math.max(2, Math.round(RATE / hz));
  let from = r(), to = r();
  for (let i = 0; i < a.length; i++) {
    const k = i % step;
    if (k === 0 && i) { from = to; to = r(); }
    const x = k / step, s = from + (to - from) * x * x * (3 - 2 * x);
    a[i] *= 1 - depth + depth * s;
  }
  return a;
}

/** A regular pulse in the level, `hz` times a second, sharper as `sharp` grows: rotor beats, throbbing. */
function pulse(a, hz, depth, sharp = 1) {
  for (let i = 0; i < a.length; i++) a[i] *= 1 - depth + depth * Math.pow(0.5 - 0.5 * Math.cos((TAU * hz * i) / RATE), sharp);
  return a;
}

// ——— mixing and loudness ———

/** Sum parts, each scaled by its gain and starting at an optional offset in seconds. */
export function mix(parts) {
  const n = Math.max(...parts.map(([a, , at = 0]) => a.length + Math.round(at * RATE)));
  const out = new Float32Array(n);
  for (const [a, gain, at = 0] of parts) {
    const o = Math.round(at * RATE);
    for (let i = 0; i < a.length; i++) out[o + i] += a[i] * gain;
  }
  return out;
}

export function normalize(a, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  if (m > 0) for (let i = 0; i < a.length; i++) a[i] *= peak / m;
  return a;
}

/** Layers summed, each first brought to peak 1 so that its gain reads as its level. */
function stack(parts) {
  return mix(parts.map(([a, gain, at]) => {
    let m = 0;
    for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
    return [a, m > 0 ? gain / m : 0, at];
  }));
}

/**
 * Loudness in LUFS as EBU R128 hears a short sound: the loudest 400 ms of the K-weighted signal (a +4 dB
 * shelf above 1.5 kHz, a high-pass at 38 Hz — the ear's weighting), a shorter sound counted over 400 ms.
 */
export function loudness(a) {
  const k = biquad(biquad(Float32Array.from(a), 'hs', 1500, Math.SQRT1_2, 4), 'hp', 38, 0.5), w = len(0.4);
  let s = 0, best = 0;
  for (let i = 0; i < k.length; i++) {
    s += k[i] * k[i];
    if (i >= w) s -= k[i - w] * k[i - w];
    if (s > best) best = s;
  }
  return -0.691 + 10 * Math.log10(Math.max(best / w, 1e-12));
}

const KNEE = 0.5, CEILING = 0.97;
/** Unity below KNEE, then rounding smoothly into CEILING: the loudest transients lose a little edge, nothing clips. */
const ceiling = (x) => { const m = Math.abs(x); return m <= KNEE ? x : Math.sign(x) * (KNEE + (CEILING - KNEE) * soft((m - KNEE) / (CEILING - KNEE))); };

/**
 * The finished sound: its layers stacked, cleared of DC and rumble below hearing, cut where the tail falls
 * under -48 dB (or at `most` seconds, fading over the last tenth), then set to `lufs` under the ceiling.
 */
function out(parts, lufs, most = 8) {
  const a = highpass(stack(parts), 22);
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  let end = Math.min(a.length, len(most));
  while (end > 1 && Math.abs(a[end - 1]) < m * 0.004) end--;
  const b = a.slice(0, end), fade = Math.min(end, end === len(most) ? len(most / 10) : len(0.012));
  for (let i = 0; i < fade; i++) b[end - 1 - i] *= i / fade;
  const g = Math.pow(10, (lufs - loudness(b)) / 20);
  for (let i = 0; i < b.length; i++) b[i] = ceiling(b[i] * g);
  return b;
}

// ——— layers the recipes are made of ———

/** The crack at the front of a shot or blast: high-passed noise, a few milliseconds long, saturated. */
const crack = (d, hz, tau, grit = 2) => drive(decay(biquad(noise(tau * 6, d.s()), 'hp', hz, 0.8), 0.0002, tau), grit);
/** A thump: a sine falling from f0 toward f1 (time constant ptau) and fading with tau, saturated for harmonics. */
const thump = (f0, f1, ptau, tau, grit = 1.8) => drive(decay(drop(tau * 5.5, f0, f1, ptau), 0.0015, tau), grit);
/** Noise through a low-pass whose cutoff falls from f0 to f1 with time constant ftau: a blast's fireball. */
const blast = (d, f0, f1, ftau, tau, q = 0.8) => decay(biquad(noise(tau * 5.5, d.s()), 'lp', (t) => f1 + (f0 - f1) * Math.exp(-t / ftau), q), 0.0008, tau);
/** Band-passed noise sinking from f0 to f1: the chest of a blast, the midrange a small speaker can play. */
const chest = (d, f0, f1, ftau, tau, grit = 2) => drive(decay(biquad(noise(tau * 5.5, d.s()), 'bp', (t) => f1 + (f0 - f1) * Math.exp(-t / ftau), 0.9), 0.002, tau), grit);
/** Brown noise under a low-pass: the air rumbling after something big. */
const rumble = (d, hz, tau, attack = 0.02) => decay(biquad(brown(tau * 5 + attack, d.s()), 'lp', hz, 0.6), attack, tau);
/** Band-passed crackle: sand, grit or sparks raining down and thinning out. */
const grit = (d, perSecond, tau, hz, q = 1.2) => decay(biquad(crackle(tau * 5, d.s(), perSecond, tau), 'bp', hz, q), 0.004, tau * 1.6);
/** Mode sets [ratio, decay share, gain]: a struck plate (hulls, walls) and a struck bar (brackets, bolts, shell cases). */
const PLATE = [[1, 1, 1], [1.59, 0.8, 0.7], [2.14, 0.65, 0.55], [2.65, 0.5, 0.45], [3.16, 0.4, 0.35], [4.1, 0.3, 0.25]];
const BAR = [[1, 1, 1], [2.76, 0.6, 0.6], [5.4, 0.35, 0.35], [8.93, 0.2, 0.2]];
const metal = (d, hz, tau, set = PLATE) => modes(tau * 5.5, set.map(([m, t, g]) => [hz * m * d.u(0.985, 1.015), tau * t, g]), d.s());
/** A small secondary blast: fuel, ammunition, a second tank going up. */
const pop = (d) => stack([[crack(d, 1100, 0.004, 3), 0.6], [blast(d, 3000, 400, 0.04, 0.09), 1], [chest(d, 700, 300, 0.05, 0.06), 0.6], [thump(130, 60, 0.02, 0.05), 0.5]]);
/** A heavy lump landing in sand. */
const thud = (d) => stack([[thump(d.u(90, 150), 55, 0.012, 0.035), 0.8], [blast(d, 1300, 250, 0.012, 0.03), 0.7], [chest(d, 600, 350, 0.02, 0.03, 1.5), 0.5]]);
/** 1 while something approaches, easing to 0 once it has passed at `mid` seconds: drives Doppler sweeps. */
const passing = (mid, width) => (t) => 1 / (1 + Math.exp((t - mid) / width));
/** A bell tone (the partials of a small chime, the lowest ringing longest), for the interface's pleasant sounds. */
const chime = (hz, tau) => mix([[1, 1, 1, 0.003], [1.004, 1.2, 0.5, 0.003], [2, 0.45, 0.35, 0.002], [3.01, 0.22, 0.16, 0.001]].map(([m, t, g, at]) => [decay(tone(tau * t * 5.5, hz * m), at, tau * t), g]));

// Each recipe ends in out(layers, loudness in LUFS, longest duration in seconds).
export const RECIPES = {
  // ——— guns ———
  rifle: (d) => {   // a light rifle: a supersonic crack, a short muzzle bark and a little echoing report
    const p = d.u(0.9, 1.12);
    return out([
      [crack(d, 2400 * p, 0.003, 3), 1],
      [decay(biquad(noise(0.12, d.s()), 'bp', 1100 * p, 1.1), 0.0004, 0.022), 0.9],
      [thump(260 * p, 110, 0.008, 0.02), 0.25],
      [decay(biquad(noise(0.45, d.s()), 'lp', (t) => 500 + 2800 * Math.exp(-t / 0.05), 0.7), 0.003, 0.08), 0.35, 0.004],
    ], -20);
  },
  mg: (d) => {   // a vehicle machine gun: a three-round burst, heavier than a rifle, the action clacking
    const gap = d.u(0.058, 0.07), parts = [];
    for (let k = 0; k < 3; k++) {
      const at = k * gap + d.u(0, 0.004), g = k ? d.u(0.8, 0.95) : 1, p = d.u(0.94, 1.06);
      parts.push([crack(d, 1900 * p, 0.0025, 3), g, at],
        [decay(biquad(noise(0.1, d.s()), 'bp', 760 * p, 1.3), 0.0004, 0.022), 0.9 * g, at],
        [thump(220 * p, 85, 0.01, 0.024), 0.55 * g, at],
        [metal(d, d.u(3000, 3600), 0.012, BAR), 0.1 * g, at + 0.018]);
    }
    parts.push([decay(biquad(noise(0.7, d.s()), 'lp', (t) => 350 + 2400 * Math.exp(-t / 0.08), 0.7), 0.004, 0.11), 0.3]);
    return out(parts, -18);
  },
  cannon: (d) => {   // a tank gun: a sharp crack, a punch in the chest, a muzzle blast rolling off into rumble
    const p = d.u(0.9, 1.1);
    return out([
      [crack(d, 1300, 0.005, 4), 0.8],
      [thump(150 * p, 50 * p, 0.025, 0.1, 2.4), 0.85],
      [chest(d, 800 * p, 300 * p, 0.06, 0.09), 0.8],
      [drive(blast(d, 6000, 500, 0.06, 0.14), 1.6), 0.9],
      [rumble(d, 280, 0.3, 0.03), 0.4, 0.015],
      [metal(d, d.u(380, 440) * p, 0.16, BAR), 0.08, 0.003],   // the barrel ringing faintly
    ], -15, 1.3);
  },
  heavyCannon: (d) => {   // the Siege Tank and the Devastator: deeper and longer, and the recoil slamming home
    const p = d.u(0.9, 1.1);
    return out([
      [crack(d, 1000, 0.006, 4), 0.8],
      [thump(120 * p, 40 * p, 0.035, 0.15, 2.6), 0.85],
      [chest(d, 650 * p, 250 * p, 0.08, 0.13, 2.4), 0.85],
      [drive(blast(d, 4800, 400, 0.08, 0.2), 2), 0.9],
      [rumble(d, 210, 0.45, 0.04), 0.5, 0.02],
      [metal(d, d.u(210, 250) * p, 0.2, PLATE), 0.14, 0.03],
      [thump(90, 55, 0.03, 0.06), 0.3, 0.03],
    ], -14, 1.7);
  },
  rocket: (d) => {   // a rocket leaving its tube: an ignition pop, then the motor's roar and crackle rushing away
    const s = 1.1, p = d.u(0.9, 1.1);
    const roar = shape(biquad(noise(s, d.s()), 'bp', (t) => 500 + 2800 * p * (1 - Math.exp(-t / 0.05)) * Math.exp(-t / 0.5), 0.8), [[0, 0], [0.015, 1], [0.1, 0.75], [0.4, 0.3], [s, 0]]);
    const motor = shape(biquad(crackle(s, d.s(), 2500), 'bp', 2200 * p, 0.9), [[0, 0], [0.02, 1], [0.25, 0.4], [s, 0]]);
    return out([
      [crack(d, 900, 0.005, 2.5), 0.7],
      [thump(130, 60, 0.02, 0.045), 0.7],
      [roar, 1],
      [motor, 0.45],
      [decay(biquad(noise(0.6, d.s()), 'hp', 5000), 0.005, 0.07), 0.35],   // the first hiss of exhaust
    ], -15);
  },
  rocketFly: (d) => {   // a rocket passing overhead: its roar swells, falls in pitch as it goes by, and fades
    const s = 1.3, mid = d.u(0.5, 0.65), p = d.u(0.9, 1.1), by = passing(mid, 0.07);
    const bell = [[0, 0], [mid * 0.6, 0.35], [mid, 1], [mid + 0.15, 0.55], [s, 0]];
    return out([
      [shape(biquad(noise(s, d.s()), 'bp', (t) => (650 + 1500 * by(t)) * p, 1.1), bell), 1],
      [shape(biquad(glide(s, (t) => (120 + 70 * by(t)) * p, 'saw'), 'lp', 900), bell), 0.35],
      [shape(biquad(crackle(s, d.s(), 1800), 'bp', 2400, 1), bell), 0.4],
    ], -18);
  },
  launchHeavy: (d) => {   // the Death Hand leaving its silo: a deep ignition boom, then a long rising, crackling roar
    const s = 2.4;
    return out([
      [crack(d, 700, 0.008, 3), 0.7],
      [thump(80, 35, 0.05, 0.25, 2.2), 0.9],
      [chest(d, 500, 250, 0.2, 0.3, 2), 0.6],
      [shape(biquad(noise(s, d.s()), 'bp', (t) => 300 + 1500 * (1 - Math.exp(-t / 0.4)) * Math.exp(-t / 1.4), 0.7), [[0, 0], [0.05, 0.8], [0.5, 1], [1.4, 0.5], [s, 0]]), 0.9],
      [shape(biquad(brown(s, d.s()), 'lp', 500), [[0, 0], [0.03, 1], [0.8, 0.7], [s, 0]]), 0.7],
      [shape(biquad(crackle(s, d.s(), 2200), 'bp', 1800, 0.8), [[0, 0], [0.1, 1], [1.2, 0.6], [s, 0]]), 0.45],
    ], -13);
  },
  sonic: (d) => {   // the Sonic Tank's wave: a deep throbbing hum under a phasing roar that swells and fades
    const s = 1.2, env = [[0, 0], [0.08, 1], [0.8, 0.8], [s, 0]];
    return out([
      [shape(pulse(drive(glide(s, (t) => 62 + 10 * t), 1.8), 15, 0.7), env), 0.75],
      [shape(comb(biquad(noise(s, d.s()), 'bp', 700, 0.6), 0.008, 0.0015, 0.75), env), 1],
      [shape(glide(s, (t) => d.u(0.97, 1.03) * (280 + 500 * t), 'triangle'), env), 0.12],
    ], -16);
  },
  gas: (d) => {   // Deviator gas: a soft pop, then a hissing, bubbling cloud
    const s = 1.2;
    return out([
      [thump(100, 50, 0.02, 0.04), 0.5],
      [shape(wobble(biquad(noise(s, d.s()), 'bp', 4200, 0.9), d.s(), 16, 0.6), [[0, 0], [0.04, 1], [0.35, 0.65], [s, 0]]), 1],
      [shape(biquad(noise(s, d.s()), 'hp', 7000), [[0, 0], [0.02, 1], [0.2, 0.3], [s, 0]]), 0.3],
    ], -19);
  },

  // ——— impacts ———
  hit: (d) => {   // a shell striking armour: a hard crack, a heavy punch into thick steel and a short, deep, damped clang; sparks
    const p = d.u(0.88, 1.12);
    return out([
      [crack(d, 1200, 0.0025, 3), 0.7],
      [thump(150 * p, 60, 0.012, 0.06, 2.4), 0.85],
      [chest(d, 900 * p, 320, 0.03, 0.05, 2), 0.7],
      [blast(d, 2600, 400, 0.025, 0.06), 0.55],
      [metal(d, 190 * p, 0.035, PLATE), 0.35],   // thick steel: a low clang, gone almost at once (a thin plate rang like tin)
      [grit(d, 2500, 0.04, 3800, 1), 0.15],
    ], -18);
  },
  hitStructure: (d) => {   // a shell bursting on a building: a crack, a heavy concussion and concrete raining down
    const p = d.u(0.9, 1.1);
    return out([
      [crack(d, 1100, 0.003, 3), 0.7],
      [thump(120 * p, 50, 0.015, 0.07, 2.4), 0.85],
      [chest(d, 800 * p, 300, 0.03, 0.06, 2), 0.75],
      [blast(d, 3000, 400, 0.03, 0.07), 0.6],
      [grit(d, 3200, 0.12, 2400, 0.9), 0.5, 0.02],
    ], -18);
  },
  sandHit: (d) => out([   // a shell burying itself in sand: a dull whump and a spray of sand pattering down
    [thump(d.u(105, 135), 55, 0.015, 0.06), 0.6],
    [blast(d, 2400, 350, 0.03, 0.08), 0.8],
    [chest(d, 700, 350, 0.03, 0.05, 1.5), 0.8],
    [grit(d, 4000, 0.12, 3200, 0.8), 0.6, 0.02],
  ], -19),
  bulletHit: (d) => out([   // a bullet on armour: a dull, hard knock, and in one variation in three a ricochet whining off
    [crack(d, 1400, 0.001, 2), 0.35],
    [thump(d.u(260, 340), 140, 0.004, 0.012, 2), 0.7],
    [decay(biquad(noise(0.06, d.s()), 'bp', d.u(700, 1000), 1.1), 0.0005, 0.01), 0.7],
    d.n === 2
      ? [shape(biquad(glide(0.22, (t) => 2600 - 5200 * t, 'saw'), 'bp', 2000, 1.2), [[0, 0], [0.01, 1], [0.08, 0.5], [0.22, 0]]), 0.22, 0.004]
      : [metal(d, d.u(700, 900), 0.008, PLATE), 0.12, 0.001],   // a short low knock of steel, not a ping
  ], -25),
  bulletSoft: (d) => out([   // a bullet finding a man: a soft, dull thwack with no ring at all
    [thump(d.u(150, 190), 90, 0.004, 0.018, 1.4), 0.8],
    [decay(biquad(noise(0.05, d.s()), 'lp', d.u(900, 1300), 0.7), 0.0008, 0.012), 0.8],
  ], -27),
  bulletChip: (d) => out([   // a bullet chipping concrete: a sharp tick, a puff of grit and a few crumbs falling
    [crack(d, 1300, 0.0012, 2), 0.4],
    [thump(d.u(220, 280), 120, 0.003, 0.01, 1.6), 0.5],
    [decay(biquad(noise(0.06, d.s()), 'bp', d.u(850, 1200), 1), 0.0005, 0.012), 0.7],
    [grit(d, 2000, 0.04, 1800, 1), 0.3, 0.004],
  ], -26),
  explosionSmall: (d) => {   // a vehicle or rocket going up: crack, fireball, a deep thump, rumble and grit falling
    const p = d.u(0.9, 1.1);
    return out([
      [crack(d, 900, 0.008, 4), 0.75],
      [thump(110 * p, 45, 0.04, 0.12, 2.6), 0.8],
      [chest(d, 1050 * p, 350, 0.1, 0.16, 2.4), 0.85],
      [drive(blast(d, 5000 * p, 600, 0.1, 0.18), 2.2), 0.9],
      [rumble(d, 230, 0.35, 0.03), 0.45, 0.015],
      [grit(d, 1600, 0.22, 2600, 0.9), 0.35, 0.05],
    ], -14, 1.4);
  },
  explosionMedium: (d) => {   // a bigger blast: two fireballs a beat apart, a longer rumble, and a secondary pop
    const p = d.u(0.9, 1.1);
    return out([
      [crack(d, 800, 0.009, 4), 0.75],
      [thump(95 * p, 38, 0.05, 0.18, 2.8), 0.85],
      [chest(d, 900 * p, 300, 0.12, 0.24, 2.6), 0.9],
      [drive(blast(d, 4500 * p, 450, 0.14, 0.26), 2.5), 0.9],
      [drive(blast(d, 2600, 300, 0.1, 0.2), 2), 0.6, d.u(0.035, 0.07)],
      [rumble(d, 190, 0.5, 0.04), 0.55, 0.02],
      [grit(d, 1800, 0.35, 2200, 0.8), 0.35, 0.08],
      [pop(d), 0.35, d.u(0.25, 0.5)],
    ], -13, 2);
  },
  explosionLarge: (d) => {   // a structure going up: a huge thump, a long rolling fireball, secondary blasts, a rain of grit
    const parts = [
      [crack(d, 700, 0.012, 4), 0.7],
      [thump(80, 32, 0.07, 0.28, 3), 0.85],
      [chest(d, 750, 250, 0.25, 0.4, 2.8), 0.95],
      [drive(blast(d, 3600, 300, 0.25, 0.42), 2.8), 0.9],
      [rumble(d, 150, 0.6, 0.06), 0.65, 0.02],
      [grit(d, 1400, 0.6, 1800, 0.7), 0.4, 0.1],
    ];
    for (let k = 2 + Math.floor(d.u(0, 2)); k > 0; k--) parts.push([pop(d), d.u(0.3, 0.5), d.u(0.25, 1.3)]);
    return out(parts, -12, 2.8);
  },
  explosionHuge: (d) => {   // the Death Hand landing: a shattering crack, a blast wave rolling on and on, the ground shaking
    const parts = [
      [crack(d, 500, 0.02, 5), 0.7],
      [thump(65, 28, 0.12, 0.45, 3.2), 0.85],
      [chest(d, 600, 180, 0.4, 0.7, 3), 0.95],
      [drive(blast(d, 2800, 200, 0.35, 0.8), 3), 0.9],
      [shape(biquad(brown(3.6, d.s()), 'lp', 140, 0.7), [[0, 0], [0.1, 1], [1.2, 0.6], [3.6, 0]]), 0.8],
      [grit(d, 1200, 0.9, 1500, 0.7), 0.4, 0.2],
    ];
    for (let k = 0; k < 4; k++) parts.push([pop(d), d.u(0.25, 0.45), d.u(0.3, 2)]);
    return out(parts, -11, 3.6);
  },
  debris: (d) => {   // metal chunks landing after a blast: clanks of every size, some bouncing, thuds in the sand
    const parts = [];
    for (let k = 7 + Math.floor(d.u(0, 5)); k > 0; k--) {
      const at = 0.14 + 0.28 * -Math.log(1 - d.u(0, 0.93)), g = Math.exp(-at / 0.9) * d.u(0.45, 1);
      const chunk = d.u() < 0.62 ? stack([[metal(d, d.u(520, 2400), d.u(0.03, 0.09), d.u() < 0.5 ? PLATE : BAR), 0.8], [crack(d, 2500, 0.0015, 2), 0.5]]) : thud(d);
      parts.push([chunk, g, at]);
      if (d.u() < 0.45) parts.push([chunk, g * d.u(0.3, 0.5), at + d.u(0.08, 0.15)]);   // a bounce
    }
    parts.push([grit(d, 900, 0.4, 2000, 0.7), 0.2, 0.15]);
    return out(parts, -20, 1.8);
  },
  collapse: (d) => {   // a building coming down: a deep rolling rumble, grinding, crumbling concrete, groaning steel
    const s = 3.2, env = [[0, 0], [0.12, 0.7], [0.45, 1], [1.4, 0.55], [s, 0]], groan = d.u(125, 165);
    const parts = [
      [shape(biquad(brown(s, d.s()), 'lp', 220, 0.7), env), 0.55],
      [shape(wobble(biquad(noise(s, d.s()), 'bp', 520, 1.4), d.s(), 9, 0.85), env), 0.8],
      [shape(biquad(crackle(s, d.s(), 600, 1.4), 'bp', 1100, 0.7), env), 0.8],
      [decay(biquad(glide(1.6, (t) => groan - 28 * t + 5 * Math.sin(t * 31), 'saw'), 'bp', 320, 3), 0.25, 0.45), 0.25, d.u(0.2, 0.6)],
      [thump(70, 32, 0.06, 0.25, 2.5), 0.5, 0.02],
    ];
    const n = 5 + Math.floor(d.u(0, 4));
    for (let k = 0; k < n; k++) parts.push([thud(d), d.u(0.4, 0.8) * (1 - k / (n + 2)), d.u(0.15, 2.2)]);
    return out(parts, -15);
  },
  crush: (d) => {   // a soldier under the tracks: a quick crunching series over a dull, wet thump
    const parts = [[thump(130, 60, 0.02, 0.05), 0.7, 0.01], [decay(biquad(noise(0.3, d.s()), 'lp', 500), 0.01, 0.07), 0.6, 0.02]];
    for (let k = 0, at = 0; k < 5; k++, at += d.u(0.03, 0.06)) parts.push([decay(biquad(noise(0.06, d.s()), 'bp', d.u(500, 2200), 1.6), 0.0005, 0.012), d.u(0.5, 1), at]);
    return out(parts, -19);
  },

  // ——— the desert ———
  wormRumble: (d) => {   // a worm passing under the sand: a deep grinding rumble with the sand hissing over it, swelling and fading
    const s = 1.6, env = [[0, 0], [0.4, 1], [1.1, 1], [s, 0]];
    return out([
      [shape(wobble(biquad(brown(s, d.s()), 'lp', 110, 0.8), d.s(), 6, 0.5), env), 1],
      [shape(drive(wobble(biquad(noise(s, d.s()), 'bp', 260, 1.2), d.s(), 11, 0.7), 1.6), env), 0.55],   // the grind a small speaker can play
      [shape(wobble(biquad(crackle(s, d.s(), 2600), 'bp', 2200, 0.8), d.s(), 8, 0.6), env), 0.3],
    ], -22, s);
  },
  wormRoar: (d) => {   // a worm breaking the sand: a burst of sand, then a deep guttural roar that rattles and falls away
    const s = 1.8, env = [[0, 0], [0.12, 1], [0.9, 0.85], [s, 0]];
    const growl = glide(s, (t) => 92 - 30 * t + 6 * Math.sin(t * 37), 'saw');
    return out([
      [thump(90, 40, 0.05, 0.18, 2.2), 0.6],
      [decay(biquad(noise(0.9, d.s()), 'lp', (t) => 300 + 2600 * Math.exp(-t / 0.08), 0.7), 0.004, 0.18), 0.7],   // the sand bursting up
      [shape(wobble(drive(stack([[biquad(Float32Array.from(growl), 'bp', 420, 2.2), 1], [biquad(Float32Array.from(growl), 'bp', 950, 3), 0.5]]), 2), d.s(), 18, 0.45), env), 0.9],
      [shape(wobble(biquad(noise(s, d.s()), 'bp', 650, 0.9), d.s(), 9, 0.5), env), 0.45],   // its breath
      [shape(biquad(brown(s, d.s()), 'lp', 140, 0.7), env), 0.5],
      [grit(d, 1500, 0.5, 2400, 0.8), 0.25, 0.1],   // sand raining back
    ], -14, s);
  },
  wormGulp: (d) => {   // a worm swallowing its prey: the maw slams shut, metal crumples and sand pours, a deep gulp and a growl
    const growl = glide(1, (t) => 78 - 22 * t + 5 * Math.sin(t * 41), 'saw');
    const parts = [[thump(110, 45, 0.03, 0.12, 2.6), 0.55], [metal(d, 260, 0.12, PLATE), 0.45, 0.02], [crack(d, 900, 0.006, 3), 0.6], [chest(d, 700, 300, 0.08, 0.14, 2.2), 0.6]];
    for (let k = 0, at = 0.03; k < 5; k++, at += d.u(0.03, 0.07)) parts.push([decay(biquad(noise(0.08, d.s()), 'bp', d.u(400, 1600), 1.4), 0.0005, 0.02), d.u(0.6, 1), at]);
    parts.push([decay(drive(biquad(glide(0.5, (t) => 160 * Math.exp(-t * 3) + 45, 'saw'), 'lp', 700), 1.8), 0.03, 0.15), 0.55, 0.25]);
    parts.push([grit(d, 1800, 0.35, 2000, 0.8), 0.3, 0.1]);
    parts.push([shape(drive(stack([[biquad(Float32Array.from(growl), 'bp', 380, 2.2), 1], [biquad(Float32Array.from(growl), 'bp', 880, 3), 0.4]]), 2), [[0, 0], [0.12, 1], [0.6, 0.6], [1, 0]]), 0.5, 0.3]);
    return out(parts, -15, 1.5);
  },
  bloom: (d) => {   // a spice bloom bursting: a deep whump under the ground, a geyser of sand hissing up, grains pattering down
    const s = 2;
    return out([
      [thump(70, 30, 0.08, 0.3, 2.6), 0.6],
      [chest(d, 600, 220, 0.25, 0.35, 2.2), 0.85],
      [shape(biquad(noise(s, d.s()), 'bp', (t) => 900 + 1400 * Math.exp(-t / 0.5), 0.6), [[0, 0], [0.06, 1], [0.5, 0.6], [1.4, 0.15], [s, 0]]), 1],
      [shape(biquad(brown(s, d.s()), 'lp', 160, 0.7), [[0, 0], [0.1, 1], [s, 0]]), 0.35],
      [grit(d, 2200, 0.7, 2600, 0.7), 0.4, 0.3],
    ], -14, s);
  },

  // ——— the base at work ———
  clunk: (d) => {   // something heavy set down: a deep metal thunk, the frame ringing, a latch clanking home
    const p = d.u(0.92, 1.08);
    return out([
      [thump(170 * p, 80, 0.02, 0.07, 2.4), 0.7],
      [metal(d, 190 * p, 0.12, PLATE), 0.8],
      [crack(d, 1500, 0.002, 2), 0.5],
      [chest(d, 600, 320, 0.03, 0.05, 1.5), 0.7],
      [metal(d, 1300 * p, 0.035, BAR), 0.25, d.u(0.08, 0.11)],
    ], -18);
  },
  slab: (d) => out([   // a concrete slab laid: a soft thud and a scrape of sand
    [thump(d.u(95, 110), 60, 0.012, 0.04), 0.6],
    [decay(biquad(noise(0.3, d.s()), 'lp', 1600), 0.002, 0.05), 0.7],
    [shape(biquad(noise(0.3, d.s()), 'bp', 2600, 0.7), [[0, 0], [0.03, 1], [0.25, 0]]), 0.45],
  ], -21),
  ratchet: (d) => {   // a repair or construction ratchet: quick metallic ticks, every fourth heavier, over a motor whirr
    const parts = [];
    let at = 0;
    for (let k = 0; k < 7; k++, at += d.u(0.045, 0.06)) {
      parts.push([metal(d, d.u(2100, 2400), 0.012, BAR), k % 4 === 3 ? 1 : 0.7, at], [crack(d, 2000, 0.001, 1.5), 0.5, at]);
      if (k % 4 === 3) parts.push([thump(220, 120, 0.01, 0.015), 0.5, at]);
    }
    parts.push([shape(biquad(tone(at + 0.05, 95, 110, 'saw'), 'lp', 700), [[0, 0], [0.03, 1], [at, 1], [at + 0.05, 0]]), 0.15]);
    return out(parts, -22);
  },
  weld: (d) => {   // repair work: an electric arc buzzing and spitting sparks
    const s = 0.8, env = [[0, 0], [0.015, 1], [s - 0.12, 0.8], [s, 0]];
    const arc = wobble(stack([[biquad(tone(s, 100, 100, 'saw'), 'bp', 1600, 0.8), 0.5], [biquad(noise(s, d.s()), 'hp', 3000), 1]]), d.s(), 22, 0.85);
    return out([[shape(arc, env), 1], [shape(biquad(crackle(s, d.s(), 900), 'bp', 5000, 1), env), 0.4]], -23);
  },
  harvesterUnload: (d) => {   // a Harvester docking: the hatch clanks open, hydraulics hiss, a motor hums as the spice pours
    const s = 2.4;
    return out([
      [metal(d, 240, 0.1, PLATE), 0.35],
      [thump(110, 60, 0.015, 0.04), 0.5],
      [shape(biquad(noise(0.5, d.s()), 'hp', 2500), [[0, 0], [0.08, 1], [0.45, 0]]), 0.35, 0.05],
      [shape(wobble(biquad(mix([[tone(s, 55, 55, 'saw'), 1], [tone(s, 82.5, 82.5, 'saw'), 0.6]]), 'lp', 380), d.s(), 5, 0.25), [[0, 0], [0.25, 1], [2, 1], [s, 0]]), 0.5],
      [shape(wobble(stack([[biquad(crackle(s, d.s(), 5000), 'bp', 1600, 0.6), 1], [biquad(noise(s, d.s()), 'bp', 900, 0.5), 0.5]]), d.s(), 7, 0.5), [[0, 0], [0.4, 0], [0.7, 1], [1.9, 0.9], [s, 0]]), 0.6],
    ], -21);
  },
  rotor: (d) => {   // an Ornithopter passing: beating wings, a turbine whine and rushing air, falling in pitch as it goes
    const s = 2, by = passing(0.9, 0.12), bell = [[0, 0], [0.5, 0.45], [0.9, 1], [1.2, 0.6], [s, 0]];
    return out([
      [shape(pulse(biquad(noise(s, d.s()), 'lp', 380), 12, 0.9, 3), bell), 1],
      [shape(biquad(glide(s, (t) => 800 + 300 * by(t), 'triangle'), 'lp', 2000), bell), 0.12],
      [shape(biquad(noise(s, d.s()), 'bp', (t) => 600 + 800 * by(t), 1), bell), 0.45],
    ], -18);
  },
  jet: (d) => {   // a Carryall or a Frigate passing: an engine roar and whine sweeping down as it goes by
    const s = 2.4, by = passing(1.1, 0.15), bell = [[0, 0], [0.6, 0.4], [1.1, 1], [1.4, 0.6], [s, 0]];
    return out([
      [shape(biquad(brown(s, d.s()), 'lp', 600), bell), 1],
      [shape(biquad(noise(s, d.s()), 'bp', (t) => 650 + 1350 * by(t), 0.7), bell), 0.7],
      [shape(glide(s, (t) => 2000 + 1000 * by(t)), bell), 0.05],
    ], -17);
  },
  shipPass: (d) => {   // a house ship of the opening sweeping past on its way to Arrakis: a beating drive hum and a whine falling as it goes by
    const s = 1.9, mid = d.u(0.6, 0.72), by = passing(mid, 0.13), bell = [[0, 0], [mid * 0.45, 0.4], [mid, 1], [mid + 0.4, 0.45], [s, 0]];
    return out([
      [shape(biquad(glide(s, (t) => 66 + 30 * by(t), 'saw'), 'lp', 380), bell), 0.9],
      [shape(biquad(glide(s, (t) => 69.5 + 31 * by(t), 'saw'), 'lp', 380), bell), 0.6],   // a little apart: the drive beats
      [shape(biquad(noise(s, d.s()), 'bp', (t) => 480 + 1600 * by(t), 0.9), bell), 0.65],   // the rush of its passing
      [shape(glide(s, (t) => 820 + 640 * by(t)), bell), 0.05],
    ], -16);
  },
  shipEntry: (d) => {   // the ship meeting the atmosphere far off: a hiss of fire swelling, then a soft distant boom rolling away
    const s = 2.2;
    return out([
      [shape(biquad(crackle(s, d.s(), 1500), 'bp', 1400, 0.8), [[0, 0], [0.45, 0.7], [0.8, 1], [1.5, 0.2], [s, 0]]), 0.45],
      [shape(biquad(noise(s, d.s()), 'bp', (t) => 280 + 900 * Math.exp(-t / 0.9), 0.7), [[0, 0], [0.35, 0.6], [0.8, 1], [s, 0]]), 0.7],
      [thump(68, 36, 0.05, 0.4, 2.2), 0.8, 0.8],
      [rumble(d, 150, 0.45, 0.08), 0.55, 0.85],
    ], -19);
  },

  // ——— interface ———
  ready: () => out([[chime(659.3, 0.22), 0.8], [chime(987.8, 0.3), 0.9, 0.11]], -18),   // construction complete: a clean two-note chime
  sell: (d) => {   // a sale: three coins' bright pings falling, then the till's soft clunk
    const parts = [[chime(1568, 0.08), 0.8], [chime(1319, 0.08), 0.8, 0.07], [chime(1047, 0.12), 0.9, 0.14]];
    for (let k = 0; k < 4; k++) parts.push([metal(d, d.u(2400, 3200), 0.04, BAR), 0.2, 0.18 + k * d.u(0.03, 0.06)]);
    parts.push([thump(140, 80, 0.01, 0.03), 0.4, 0.2]);
    return out(parts, -19);
  },
  click: (d) => out([   // a button: a short crisp tick
    [decay(biquad(noise(0.03, d.s()), 'bp', 3200, 1.5), 0.0002, 0.003), 1],
    [decay(tone(0.04, 1750 * d.u(0.98, 1.02)), 0.0005, 0.006), 0.6],
  ], -27),
  error: () => {   // refused: a low, slightly sour double buzz
    const buzz = () => decay(biquad(mix([[tone(0.14, 146, 146, 'square'), 1], [tone(0.14, 155, 155, 'square'), 0.7]]), 'lp', 1400), 0.004, 0.09);
    return out([[buzz(), 1], [buzz(), 0.9, 0.17]], -18);
  },
  beep: (d) => out([   // an announcement: a two-tone radio blip with a breath of static
    [biquad(decay(tone(0.07, 1320), 0.002, 0.035), 'bp', 1800, 0.7), 1],
    [biquad(decay(tone(0.09, 990), 0.002, 0.045), 'bp', 1800, 0.7), 1, 0.075],
    [decay(biquad(noise(0.15, d.s()), 'bp', 2500, 0.8), 0.002, 0.03), 0.12],
  ], -23),
  alarm: () => {   // a Devastator about to go: a klaxon whooping three times
    const whoop = () => shape(biquad(glide(0.28, (t) => 520 + 900 * t + 12 * Math.sin(t * 150), 'saw'), 'lp', 2500), [[0, 0], [0.02, 1], [0.24, 0.9], [0.28, 0]]);
    return out([0, 1, 2].map((k) => [whoop(), 1, k * 0.32]), -17);
  },
  static: (d) => out([   // the radar coming on or going off: a burst of radio static and a tuning whistle
    [shape(wobble(biquad(noise(0.5, d.s()), 'hp', 1500), d.s(), 30, 0.7), [[0, 0], [0.02, 1], [0.35, 0.6], [0.5, 0]]), 1],
    [shape(biquad(crackle(0.5, d.s(), 600), 'bp', 3000, 0.8), [[0, 1], [0.5, 0.3]]), 0.5],
    [shape(glide(0.5, (t) => 2400 * Math.exp(-t * 3.2) + 500), [[0, 0], [0.05, 1], [0.5, 0]]), 0.08],
  ], -23),

  // ——— ambience ———
  wind: (d) => {   // the desert breathing under everything: a soft gusting wind, a whistle over the dune crests, sand hissing
    const s = WIND_LOOP + 2, a = d.u(0, 6), b = d.u(0, 6);
    return loop(stack([
      [wobble(biquad(brown(s, d.s()), 'bp', (t) => 320 + 140 * Math.sin(t * 0.7 + a), 0.7), d.s(), 0.35, 0.75), 1],
      [wobble(biquad(noise(s, d.s()), 'bp', (t) => 1400 + 500 * Math.sin(t * 0.43 + b), 1.2), d.s(), 0.5, 0.9), 0.3],
      [wobble(biquad(noise(s, d.s()), 'hp', 4000), d.s(), 0.25, 0.95), 0.1],
    ]), WIND_LOOP, -30);
  },
};

/** The wind is a seamless loop this long (seconds); its two variations are its left and right channels. */
export const WIND_LOOP = 10;

/** A seamless loop of `seconds` cut from a sound rendered longer: the extra tail crossfades (equal power) into the head. */
function loop(a, seconds, lufs) {
  const n = len(seconds), f = a.length - n, b = highpass(a, 22).slice(0, n);
  for (let i = 0; i < f; i++) {
    const x = (i / f) * (Math.PI / 2);
    b[i] = a[i] * Math.sin(x) + a[n + i] * Math.cos(x);
  }
  const g = Math.pow(10, (lufs - loudness(b)) / 20);
  for (let i = 0; i < n; i++) b[i] *= g;
  return b;
}

/** How many seeded variations each sound has; the engine picks one at random per play. */
export const VARIANTS = { wind: 2, rifle: 4, mg: 4, cannon: 3, heavyCannon: 3, rocket: 3, rocketFly: 2, sonic: 2, gas: 2, hit: 3, hitStructure: 2, sandHit: 3, bulletHit: 3, bulletSoft: 2, bulletChip: 2, explosionSmall: 3, explosionMedium: 2, explosionLarge: 2, debris: 3, collapse: 2, crush: 3, clunk: 3, slab: 2, ratchet: 2, weld: 3, click: 2 };
export const variants = (id) => VARIANTS[id] ?? 1;

/** Variation v of sound `id`: the same samples every time. */
export function render(id, v = 0) {
  const recipe = RECIPES[id];
  if (!recipe) throw new Error(`unknown sound ${id}`);
  return recipe(new Dice((hash(id) + Math.imul(v, 0x9e3779b1)) >>> 0, v));
}

/**
 * The engine's shared reverb (a subtle open-desert space): stereo, at the audio context's own rate —
 * a few soft early reflections off nearby dunes, one dark slap from a far rock face, and a short diffuse
 * tail that darkens as it decays (RT60 about 1.3 s).
 */
export function reverbImpulse(rate, seconds = 1.5, seed = 99) {
  const n = Math.max(1, Math.round(seconds * rate)), pre = Math.round(0.012 * rate), channels = [];
  for (let c = 0; c < 2; c++) {
    const r = rng(seed + c * 7919), a = new Float32Array(n);
    const fall = Math.exp(-6.91 / (1.3 * rate)), bloom = Math.round(0.03 * rate);
    let y = 0, k = 0, e = 1;
    for (let i = pre; i < n; i++, e *= fall) {
      if (((i - pre) & 63) === 0) k = 1 - Math.exp((-TAU * (900 + 7000 * Math.exp(-(i - pre) / (0.35 * rate)))) / rate);
      y += k * (r() * 2 - 1 - y);
      a[i] = y * e * Math.min(1, (i - pre) / bloom);
    }
    const tap = (ms, g, width) => {   // a reflection: a short raised-sine pulse, its sign at random
      const at = Math.round(((ms + (r() - 0.5) * 6) * rate) / 1000), w = Math.max(1, Math.round((width * rate) / 1000)), sign = r() < 0.5 ? -1 : 1;
      for (let i = 0; i < w && at + i < n; i++) a[at + i] += ((sign * g * Math.sin((Math.PI * (i + 0.5)) / w)) / w) * 2;
    };
    for (const [ms, g] of [[19, 0.5], [31, 0.35], [47, 0.3], [68, 0.22], [97, 0.16], [141, 0.12]]) tap(ms, g, 0.25);
    tap(230, 0.12, 1.5);   // the far rock face
    channels.push(a);
  }
  return channels;
}
