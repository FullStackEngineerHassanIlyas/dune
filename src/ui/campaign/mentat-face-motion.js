// The Mentat's face, its motion (notes docs/superpowers/notes/2026-10-05-mentat-face.md): the pure arithmetic the face
// engine (mentat-face.js) runs every animation frame, kept apart so the tests can drive it without a page. Nothing
// here allocates once made: state lives in typed arrays, results are written into arrays the caller owns. What the
// frame calls (springIn, swayIn, visemeTargets, normalizeWeights, stackAlphas, Blinker.step) takes no number as an
// argument and returns none: a number that crosses a call the optimiser did not inline is boxed (an allocation), and
// whether it inlines a call depends on the run (its budget for a large function is spent in the order it meets them).

/** Settling constant of a critically damped spring: (1 + wt)·e^(-wt) = 5 % at wt ≈ 4.744. */
const SETTLE = 4.7439;

/** The spring rate (rad/s) of a critically damped spring that settles within 5 % of a step in `seconds`. */
export function omegaFor(seconds) { return SETTLE / Math.max(1e-3, seconds); }

/**
 * One step of a critically damped spring, solved exactly (stable at any dt, never overshoots a step from rest):
 * x[i] and v[i] move towards `target` at rate `omega` over `dt` seconds.
 */
const SPRING = new Float64Array(3);
export function springStep(x, v, i, target, omega, dt) {
  SPRING[0] = target; SPRING[1] = omega; SPRING[2] = dt;
  springIn(x, v, i, SPRING);
}

/** springStep() with its numbers in `k`: [target, omega, dt] (the engine's frame: no number crosses the call). */
export function springIn(x, v, i, k) {
  const target = k[0], omega = k[1], dt = k[2];
  const d = x[i] - target, e = Math.exp(-omega * dt), kk = (v[i] + omega * d) * dt;
  v[i] = (v[i] - omega * kk) * e;
  x[i] = target + (d + kk) * e;
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The mouth shapes' weights a voice frame asks for, written into `out` (one per viseme, VISEMES order): the move
 * from `from` to `shape` (`mix` of the way). When he is not speaking the mouth goes to rest (index 0).
 */
export function visemeTargets(frame, speaking, out) {
  const n = out.length;
  for (let i = 0; i < n; i++) out[i] = 0;
  if (!speaking) { out[0] = 1; return out; }
  const a = frame.from | 0, b = frame.shape | 0;
  let m = +frame.mix || 0;
  m = m < 0 ? 0 : m > 1 ? 1 : m;
  out[a >= 0 && a < n ? a : 0] += 1 - m;
  out[b >= 0 && b < n ? b : 0] += m;
  return out;
}

/** Keeps weights in 0..1 and summing to 1 (a spring may wander a hair outside). An all-zero set becomes rest. */
export function normalizeWeights(w) {
  const n = w.length;
  let sum = 0;
  for (let i = 0; i < n; i++) { if (w[i] < 0) w[i] = 0; sum += w[i]; }
  if (sum < 1e-6) { for (let i = 0; i < n; i++) w[i] = 0; w[0] = 1; return w; }
  for (let i = 0; i < n; i++) w[i] /= sum;
  return w;
}

/**
 * Opacities that stack sprites drawn in order 0..n-1 into the weighted average of `w` (the "over" operator): sprite
 * k is drawn at w[k] / (w[0] + … + w[k]), so the first one present is opaque and each later one blends over the
 * ones before by its share. A sprite left out of the page (the painting itself, at rest) still counts in the sum.
 */
export function stackAlphas(w, alpha) {
  const n = w.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += w[i];
    const a = sum > 1e-6 ? w[i] / sum : 0;
    alpha[i] = a < 0 ? 0 : a > 1 ? 1 : a;
  }
  return alpha;
}

/** How far the jaw may open for these weights: the weighted openness of the shapes (0 for closed lips). */
export function openness(w, open) {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i] * open[i];
  return s;
}

// mulberry32, for the blinks' table of chances (made once per Blinker)
function mulberry32(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    let t = (a = (a + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const CHANCES = 256;

// Blinker state cells
const B_NEXT = 0, B_START = 1, B_LAST = 2, B_DOUBLE = 3;
const QUIET = 1.2;   // no nudged blink within this long of the last one

/**
 * Blinks on a seeded schedule: one every `min`..`max` seconds, now and then a second one at once (`double`, the
 * chance), and a nudge at a sentence's start (people blink at a phrase's edge) when the last one is a while ago.
 * A blink closes over `close` s, holds `hold` s and opens over `open` s; value(t) is the lids' closure 0..1.
 * `start`: where in the seed's table of chances the schedule begins (0..255): two faces of one Mentat with different
 * starts (two screens) do not blink in step.
 */
export class Blinker {
  constructor({ min = 2.4, max = 5.6, double = 0.15, close = 0.07, hold = 0.04, open = 0.13, seed = 1, start = 0 } = {}) {
    this.min = min; this.max = max; this.double = double; this.close = close; this.hold = hold; this.open = open;
    // the chances, drawn ahead from the seed: the frame reads them from an array, so no number is made then
    const r = mulberry32(seed);
    this.chances = Float64Array.from({ length: CHANCES }, r);
    this.ci = new Uint8Array(1);
    this.ci[0] = start;
    this.s = new Float64Array(4);
    this.t = new Float64Array(1);   // the time asked about
    this.c = new Float64Array(1);   // the closure then
    this.reset(0);
  }

  /** Starts the schedule again at time t (the first blink comes a little sooner than the rest). */
  reset(t) {
    const s = this.s;
    s[B_START] = -1e9; s[B_LAST] = t; s[B_DOUBLE] = 0;
    s[B_NEXT] = t + 0.6 + this.chances[this.ci[0]++] * (this.min - 0.6 > 0 ? this.min - 0.6 : 0.4);
  }

  /** The time of the next blink not yet begun. */
  get next() { return this.s[B_NEXT]; }

  /** A sentence starts at t: the next blink comes soon (true), unless he blinked within the last 1.2 s or is blinking. */
  nudge(t) { this.t[0] = t; const was = this.s[B_NEXT]; this.step(true); return this.s[B_NEXT] !== was; }

  /** The lids' closure at time t (call with rising t). */
  value(t) { this.t[0] = t; this.step(); return this.c[0]; }

  /**
   * value() at the time in this.t[0], written to this.c[0]; `sentence`: a sentence starts now, so the next blink
   * comes soon unless he blinked within the last 1.2 s or is blinking. (The engine's way: every frame runs this one
   * hot method with no number crossing a call, so none is boxed.)
   */
  step(sentence = false) {
    const s = this.s, t = this.t[0], len = this.close + this.hold + this.open;
    if (sentence && t - s[B_LAST] >= QUIET && t >= s[B_START] + len && s[B_NEXT] > t + 0.12) s[B_NEXT] = t + 0.06;
    if (t >= s[B_NEXT] && t >= s[B_START] + len) {
      s[B_START] = s[B_NEXT];
      s[B_LAST] = s[B_START] + len;
      const ch = this.chances, ci = this.ci;
      const twice = s[B_DOUBLE] === 0 && ch[ci[0]++] < this.double;
      s[B_DOUBLE] = twice ? 1 : 0;
      s[B_NEXT] = twice ? s[B_LAST] + 0.09 : s[B_LAST] + this.min + ch[ci[0]++] * (this.max - this.min);
    }
    const k = t - s[B_START];
    let c = 0;
    if (k < 0 || k >= len) c = 0;
    else if (k < this.close) { const u = k / this.close; c = u * u; }
    else if (k < this.close + this.hold) c = 1;
    else { const u = 1 - (k - this.close - this.hold) / this.open; c = u * u * (3 - 2 * u); }
    this.c[0] = c;
  }
}

const SWAY = new Float64Array(2);
/** Small slow sways for a head that speaks: a sum of two sines per axis, scaled by how much he is speaking. */
export function sway(t, phase, out, at) {
  SWAY[0] = t; SWAY[1] = phase;
  swayIn(SWAY, 0, 1, out, at);
  return out;
}

/** sway() at the time src[ti] and phase src[pi], into out[at] (roll) and out[at + 1] (nod): no number crosses the call. */
export function swayIn(src, ti, pi, out, at) {
  const t = src[ti], phase = src[pi];
  out[at] = 0.6 * Math.sin(6.2832 * 0.23 * t + phase) + 0.4 * Math.sin(6.2832 * 0.61 * t + 2.1 * phase);
  out[at + 1] = 0.55 * Math.sin(6.2832 * 0.37 * t + 1.7 * phase) + 0.45 * Math.sin(6.2832 * 0.83 * t + 0.4 * phase);
}
