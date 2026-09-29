// Sound effects synthesized in code (spec §6): every recipe renders one mono Float32Array at RATE from
// seeded noise, one-pole filters, pitch sweeps and envelopes. Pure and deterministic, so it runs under
// Node tests; the engine copies the samples into AudioBuffers once, after the first click.
export const RATE = 22050;

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

const len = (seconds) => Math.max(1, Math.round(seconds * RATE));

export function noise(seconds, seed) {
  const r = rng(seed), a = new Float32Array(len(seconds));
  for (let i = 0; i < a.length; i++) a[i] = r() * 2 - 1;
  return a;
}

/** One-pole low-pass; the cutoff may sweep linearly from `from` to `to` Hz over the sound. */
export function lowpass(a, from, to = from) {
  let y = 0;
  for (let i = 0; i < a.length; i++) {
    const f = from + (to - from) * (i / a.length);
    y += (1 - Math.exp((-2 * Math.PI * f) / RATE)) * (a[i] - y);
    a[i] = y;
  }
  return a;
}

export function highpass(a, hz) {
  const k = 1 - Math.exp((-2 * Math.PI * hz) / RATE);
  let y = 0;
  for (let i = 0; i < a.length; i++) { y += k * (a[i] - y); a[i] -= y; }
  return a;
}

/** Oscillator sweeping exponentially from f0 to f1 Hz. */
export function tone(seconds, f0, f1 = f0, wave = 'sine') {
  const a = new Float32Array(len(seconds));
  let phase = 0;
  for (let i = 0; i < a.length; i++) {
    phase += (f0 * Math.pow(f1 / f0, i / a.length)) / RATE;
    const p = phase % 1;
    a[i] = wave === 'square' ? (p < 0.5 ? 1 : -1) : wave === 'saw' ? 2 * p - 1 : wave === 'triangle' ? 1 - 4 * Math.abs(p - 0.5) : Math.sin(2 * Math.PI * p);
  }
  return a;
}

/** Linear attack (seconds), then a decay to silence shaped by `curve` (higher is snappier). */
export function envelope(a, attack = 0.002, curve = 3) {
  const at = Math.max(1, Math.round(attack * RATE)), n = a.length;
  for (let i = 0; i < n; i++) a[i] *= i < at ? i / at : Math.pow(1 - (i - at) / Math.max(1, n - at), curve);
  return a;
}

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
  for (const v of a) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < a.length; i++) a[i] *= peak / m;
  return a;
}

const thump = (s, f0, f1, curve = 3) => envelope(tone(s, f0, f1), 0.003, curve);
const burst = (s, seed, lowpassHz, highpassHz, curve = 4) => envelope(highpass(lowpass(noise(s, seed), lowpassHz), highpassHz), 0.001, curve);
const clicks = (count, spacing, seed) => mix(Array.from({ length: count }, (_, k) => [envelope(highpass(noise(0.02, seed + k), 1500), 0.0005, 6), 1, k * spacing]));

export const RECIPES = {
  rifle: () => normalize(mix([[burst(0.12, 1, 6000, 900, 5), 1], [envelope(tone(0.02, 1900, 900, 'square'), 0.0005, 4), 0.3]]), 0.7),
  mg: () => normalize(mix([[burst(0.09, 2, 5000, 600, 5), 1], [envelope(tone(0.03, 420, 300, 'square'), 0.0005, 5), 0.4]]), 0.6),
  cannon: () => normalize(mix([[thump(0.45, 95, 40), 1], [burst(0.5, 3, 1400, 60, 4), 0.8]]), 0.9),
  heavyCannon: () => normalize(mix([[thump(0.6, 75, 32), 1], [burst(0.7, 4, 1100, 40, 3.5), 0.9]]), 0.95),
  rocket: () => normalize(mix([[envelope(lowpass(noise(0.75, 5), 700, 3200), 0.06, 1.6), 0.8], [burst(0.1, 6, 3000, 300, 5), 0.6]]), 0.75),
  hit: () => normalize(mix([[burst(0.15, 11, 3000, 400, 5), 1], [thump(0.08, 180, 90), 0.5]]), 0.45),
  explosionSmall: () => normalize(mix([[burst(0.7, 7, 2400, 40, 3), 1], [thump(0.35, 70, 35), 0.8]]), 0.85),
  explosionMedium: () => normalize(mix([[envelope(lowpass(noise(1.2, 8), 2200, 250), 0.004, 2.6), 1], [thump(0.6, 60, 28), 1]]), 0.95),
  explosionLarge: () => normalize(mix([[envelope(lowpass(noise(2.2, 9), 1800, 120), 0.005, 2.2), 1], [thump(0.9, 50, 22), 1], [envelope(lowpass(noise(2.2, 10), 180), 0.2, 1.5), 0.8]]), 1),
  crush: () => normalize(mix(Array.from({ length: 5 }, (_, k) => [envelope(lowpass(noise(0.05, 20 + k), 1600), 0.001, 3), 1, k * 0.04])), 0.6),
  clunk: () => normalize(mix([[envelope(lowpass(tone(0.3, 130, 90, 'square'), 900), 0.002, 4), 1], [burst(0.05, 12, 4000, 500, 5), 0.5]]), 0.6),
  ratchet: () => normalize(clicks(6, 0.055, 30), 0.5),
  ready: () => normalize(mix([[envelope(tone(0.25, 660), 0.005, 2), 0.8], [envelope(tone(0.35, 990), 0.005, 2), 0.8, 0.12]]), 0.5),
  sell: () => normalize(mix([[envelope(tone(0.12, 880, 880, 'triangle'), 0.003, 2), 1], [envelope(tone(0.12, 660, 660, 'triangle'), 0.003, 2), 1, 0.1], [envelope(tone(0.2, 440, 440, 'triangle'), 0.003, 2), 1, 0.2]]), 0.5),
  click: () => normalize(envelope(tone(0.035, 1300, 900), 0.0005, 5), 0.35),
  error: () => normalize(envelope(lowpass(tone(0.28, 110, 104, 'square'), 1200), 0.004, 1.2), 0.45),
  beep: () => normalize(mix([[envelope(tone(0.07, 1250), 0.002, 1.5), 1], [envelope(tone(0.07, 950), 0.002, 1.5), 1, 0.08]]), 0.3),
  sonic: () => {   // the Sonic Tank: a deep warbling hum that swells and fades
    const a = mix([[tone(0.7, 110, 70), 1], [tone(0.7, 220, 150, 'triangle'), 0.5], [tone(0.7, 55, 50), 0.8]]);
    for (let i = 0; i < a.length; i++) a[i] *= 0.6 + 0.4 * Math.sin(i / 180);
    return normalize(envelope(a, 0.08, 1.4), 0.8);
  },
  gas: () => normalize(envelope(lowpass(highpass(noise(0.9, 40), 900), 5200, 2400), 0.05, 1.8), 0.5),   // Deviator gas hissing out
  alarm: () => normalize(mix([0, 1, 2].map((k) => [envelope(tone(0.22, 700, 1100, 'square'), 0.01, 1.2), 0.5, k * 0.3])), 0.4),   // a Devastator about to go
  static: () => {
    const a = highpass(noise(0.5, 13), 1800);
    for (let i = 0; i < a.length; i++) a[i] *= 0.5 + 0.5 * Math.sin(i / 90) * Math.sin(i / 530);
    return normalize(envelope(a, 0.02, 1), 0.35);
  },
};

export function render(id) {
  const recipe = RECIPES[id];
  if (!recipe) throw new Error(`unknown sound ${id}`);
  return recipe();
}
