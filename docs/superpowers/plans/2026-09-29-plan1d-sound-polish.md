# Plan 1d — Sound and polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the skirmish its sound — weapons, explosions, construction, the interface — synthesized in code and placed in stereo around the camera, add the ambient effects (vehicle dust, tread marks, harvest and construction dust), and close the minor issues carried from plans 1a–1c, completing phase 1.

**Architecture:** `src/audio/synth.js` renders every effect as a pure, seeded Float32Array (Node-testable DSP: noise, one-pole filters, sweeps, envelopes); `src/audio/engine.js` turns them into AudioBuffers after the first user gesture and plays them with pan and distance attenuation relative to the camera under per-sound and global voice limits; `src/audio/cues.js` maps simulation events to sounds. GameView wires cues, the M mute key, interface clicks and radar static. Minor fixes land in their owning modules with tests.

**Tech Stack:** as before — ES modules, vendored Three.js 0.186.1, Web Audio API, Node 24 `node:test`, headless Chrome over CDP.

**Spec:** `docs/superpowers/specs/2026-09-28-dune2-3d-design.md` — §6 (effects list, positional playback, voice limits), §5.4 (dust, harvest dust, construction dust, tracks), §4.3 (loaded harvesters slower), §4.5 (Wind Trap implied for all), §9 (context loss: offer a reload; audio blocked until a click), §11 phase 1 ("basic effects and sounds"). Carried items: `docs/superpowers/notes/2026-09-29-plan1b-execution-notes.md` and `…plan1c-execution-notes.md` (deferred minors), plan-1a minor #14.

## Global Constraints

- Everything from plans 1a–1c holds (pure deterministic sim, `world.rng` only in `src/sim`, UI issues commands, instanced rendering, particle budget, English text, no original assets, Co-Authored-By commits).
- No audio file is shipped: every sound is synthesized at start-up. Nothing plays before the first click or key press (browser autoplay rules); without Web Audio the game runs silently and never throws.
- Sounds are panned and attenuated relative to the camera and limited per sound type (spec §6); at most 24 voices at once.
- Announcer voices, music and the original-file loader stay in plan 2; announcer lines keep showing as text, now with a short radio beep.

## Review Focus

1. **No Web Audio, blocked audio, or an AudioContext that fails to start** must leave the game fully playable and silent — no exception reaches the frame loop. → Task 2 test "an engine without Web Audio is silent and safe".
2. **A big battle** (dozens of shots per second) must not pile up voices or clip: per-sound limits and the global cap hold and ended voices free their slots. → Task 2 test "voice limits hold and free up".
3. **Sounds far off-screen or under fog** must not play (you cannot hear what you cannot see). → Task 3 test "cues respect fog and distance".
4. **Selling a silo gives the same credits whatever happened just before** (the lazy start-buffer revocation). → Task 5 test "the starting allowance ends as soon as built storage passes it".
5. **The AI losing its Construction Yard** buys an MCV and redeploys instead of freezing its base. → Task 6 test "an AI that lost its yard builds and deploys a new MCV".

## File map (new and changed)

```
src/audio/synth.js        pure seeded DSP: recipes for every sound effect
src/audio/engine.js       AudioContext, buffers, spatial(), VoiceLimiter, SoundEngine
src/audio/cues.js         simulation events → sound cues
src/core/settings.js      sound on/off, volume
src/render/effects.js     dust(); pools skip uploads when idle
src/game/game-view.js     sound wiring, M mute, ambient dust and tracks, sticky pause notice, context-loss reload
src/ui/hud.js             sticky message
src/ui/radar.js           size cached
src/render/placement-ghost.js  only blocked cells turn red when the footprint touches the base
src/sim/economy.js        eager start-buffer revocation
src/sim/tech.js           Wind Trap implied for every structure
src/sim/harvest.js        loaded harvesters slow down; statistics count banked credits
src/sim/production.js     integer placement coordinates
src/sim/movement.js       no crossing on mirrored diagonal steps
src/sim/ai.js             silo cap, MCV rebuild
src/sim/victory.js        draw announcement, statistics frozen at the end, checked four times a second
src/ui/end-screen.js      (unchanged API) reads the frozen statistics
src/game/setup.js         fog computed before the first frame
```

---
### Task 1: Synthesized sound effects

**Files:**
- Create: `src/audio/synth.js`
- Test: `tests/synth.test.mjs`

**Interfaces:**
- Produces: `RATE = 22050`; building blocks `noise(seconds, seed)`, `lowpass(a, fromHz, toHz?)` (one-pole, optional linear sweep), `highpass(a, hz)`, `tone(seconds, f0, f1?, wave)` (`'sine'|'square'|'saw'|'triangle'`, exponential sweep), `envelope(a, attack, curve)`, `mix([[samples, gain, atSeconds?], …])`, `normalize(a, peak)`; `RECIPES` with ids `rifle, mg, cannon, heavyCannon, rocket, hit, explosionSmall, explosionMedium, explosionLarge, crush, clunk, ratchet, ready, sell, click, error, beep, static`; `render(id)` → `Float32Array` (throws on an unknown id). Deterministic (seeded noise).

- [ ] **Step 1: Write the failing test**

**File: `tests/synth.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { RATE, RECIPES, render, noise, lowpass, envelope, tone } from '../src/audio/synth.js';

test('every sound renders short, finite and loud enough without clipping', () => {
  for (const id of Object.keys(RECIPES)) {
    const a = render(id);
    let peak = 0;
    for (const v of a) { assert.ok(Number.isFinite(v), id); peak = Math.max(peak, Math.abs(v)); }
    assert.ok(a.length > RATE * 0.02 && a.length < RATE * 2.5, `${id} lasts ${(a.length / RATE).toFixed(2)} s`);
    assert.ok(peak > 0.2 && peak <= 1, `${id} peaks at ${peak.toFixed(2)}`);
  }
  assert.throws(() => render('nope'));
});

test('rendering is deterministic', () => {
  assert.deepEqual(render('cannon'), render('cannon'));
  assert.deepEqual(render('explosionLarge'), render('explosionLarge'));
});

test('bigger explosions last longer', () => {
  assert.ok(render('explosionLarge').length > 2 * render('explosionSmall').length);
  assert.ok(render('explosionMedium').length > render('explosionSmall').length);
});

test('the building blocks behave', () => {
  const roughness = (a) => a.reduce((n, v, i) => n + (i ? Math.abs(v - a[i - 1]) : 0), 0) / a.length;
  assert.ok(roughness(lowpass(noise(0.5, 1), 200)) < roughness(noise(0.5, 1)) / 4, 'a low-pass smooths noise');
  const e = envelope(new Float32Array(100).fill(1), 0, 3);
  assert.ok(e[1] > 0.9 && e[99] < 0.01);
  assert.equal(tone(1, 440).length, RATE);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/synth.test.mjs`
Expected: FAIL — cannot find `../src/audio/synth.js`.

- [ ] **Step 3: Implement**

**File: `src/audio/synth.js`**
```js
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
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/synth.test.mjs && npm test`
Expected: PASS (4 new tests); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/audio/synth.js tests/synth.test.mjs
git commit -m "feat(audio): sound effects synthesized in code — guns, cannons, rockets, explosions, construction and interface

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The sound engine

**Files:**
- Create: `src/audio/engine.js`
- Test: `tests/sound-engine.test.mjs`

**Interfaces:**
- Consumes: `RECIPES`, `RATE`, `render` (Task 1).
- Produces: `MAX_VOICES = 24`, `VOICE_LIMITS` (per id; default 2); `spatial(listener, x, z)` → `{pan (−1…1), gain (0…1)}` for `listener = {x, z, rightX, rightZ, range}` (full volume within 0.6 × range, silent beyond 2 × range, pan across ±0.8 × range to the camera's right); `class VoiceLimiter(limits, max)` with `tryStart(id)` → boolean, `end(id)`; `class SoundEngine({enabled, volume, win})` with `available`, `muted`, `unlock()` (on the first `pointerdown` or `keydown` of `win`), `setListener(x, z, rightX, rightZ, range)`, `play(id, {x?, z?, volume?, rate?})` → boolean, `setMuted(m)`, `toggleMute()` → new muted state. Never throws; without Web Audio every call is a silent no-op.

- [ ] **Step 1: Write the failing tests**

**File: `tests/sound-engine.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES } from '../src/audio/synth.js';
import { SoundEngine, VoiceLimiter, spatial, MAX_VOICES } from '../src/audio/engine.js';

// Web Audio does not exist under Node: a minimal stand-in records what the engine does with it.
function fakeWindow() {
  const listeners = {};
  class Node { connect() {} }
  class FakeContext {
    constructor() { this.destination = {}; this.started = []; }
    createGain() { return Object.assign(new Node(), { gain: { value: 1 } }); }
    createStereoPanner() { return Object.assign(new Node(), { pan: { value: 0 } }); }
    createBuffer(channels, length, sampleRate) { return { length, sampleRate, copyToChannel() {} }; }
    createBufferSource() { const s = Object.assign(new Node(), { playbackRate: { value: 1 }, start: () => this.started.push(s) }); return s; }
    resume() {}
  }
  return { AudioContext: FakeContext, addEventListener: (type, fn) => { listeners[type] = fn; }, listeners };
}

test('an engine without Web Audio is silent and safe', () => {
  const e = new SoundEngine({ win: {} });
  assert.equal(e.available, false);
  e.unlock();
  assert.equal(e.play('cannon', { x: 1, z: 1 }), false);
  e.setListener(0, 0, 1, 0, 16);
  e.toggleMute();
});

test('nothing plays before the first gesture; afterwards every effect is ready', () => {
  const win = fakeWindow();
  const e = new SoundEngine({ win });
  assert.equal(e.play('cannon'), false, 'no context yet');
  win.listeners.pointerdown();
  assert.equal(e.buffers.size, Object.keys(RECIPES).length);
  assert.equal(e.play('cannon'), true);
  assert.equal(e.ctx.started.length, 1);
  e.toggleMute();
  assert.equal(e.play('cannon'), false, 'muted');
});

test('voice limits hold and free up', () => {
  const v = new VoiceLimiter({ cannon: 2 }, 3);
  assert.equal(v.tryStart('cannon'), true);
  assert.equal(v.tryStart('cannon'), true);
  assert.equal(v.tryStart('cannon'), false, 'per-sound limit');
  assert.equal(v.tryStart('mg'), true);
  assert.equal(v.tryStart('rifle'), false, 'global cap');
  v.end('cannon');
  assert.equal(v.tryStart('rifle'), true);
  const win = fakeWindow();
  const e = new SoundEngine({ win });
  win.listeners.keydown();
  let played = 0;
  for (let k = 0; k < 60; k++) played += e.play(['cannon', 'mg', 'rifle', 'explosionSmall', 'rocket', 'hit'][k % 6]) ? 1 : 0;
  assert.ok(played <= MAX_VOICES, `${played} voices`);
  for (const s of e.ctx.started) s.onended();
  assert.equal(e.limiter.total, 0, 'ended voices free their slots');
});

test('sounds are panned and fade with distance from the camera', () => {
  const l = { x: 10, z: 10, rightX: 1, rightZ: 0, range: 16 };
  assert.deepEqual(spatial(l, 10, 10), { pan: 0, gain: 1 });
  assert.ok(spatial(l, 18, 10).pan > 0.5, 'to the right');
  assert.ok(spatial(l, 2, 10).pan < -0.5, 'to the left');
  assert.equal(spatial(l, 60, 10).gain, 0, 'far away is silent');
  const mid = spatial(l, 10, 30).gain;
  assert.ok(mid > 0 && mid < 1);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/sound-engine.test.mjs`
Expected: FAIL — cannot find `../src/audio/engine.js`.

- [ ] **Step 3: Implement**

**File: `src/audio/engine.js`**
```js
// Web Audio sound engine (spec §6, §9): one AudioContext opened by the first click or key press (browser
// autoplay rules), every synthesized effect turned into an AudioBuffer once, and play(id, {x, z}) with
// stereo pan and distance attenuation relative to the camera, a per-sound voice limit and a global cap.
// Without Web Audio — or if it fails to start — the engine stays silent and never throws.
import { RECIPES, RATE, render } from './synth.js';

export const MAX_VOICES = 24;
export const VOICE_LIMITS = { rifle: 5, mg: 5, cannon: 4, heavyCannon: 3, rocket: 4, hit: 4, explosionSmall: 4, explosionMedium: 3, explosionLarge: 2, crush: 2, click: 3 };
const DEFAULT_LIMIT = 2;

/** Pan and gain for a sound at (x, z) heard from a camera looking at (listener.x, listener.z). */
export function spatial(listener, x, z) {
  const dx = x - listener.x, dz = z - listener.z;
  const d = Math.hypot(dx, dz), near = listener.range * 0.6, far = listener.range * 2;
  const gain = d <= near ? 1 : d >= far ? 0 : 1 - (d - near) / (far - near);
  const side = dx * listener.rightX + dz * listener.rightZ;
  return { pan: Math.max(-1, Math.min(1, side / (listener.range * 0.8))) || 0, gain };
}

export class VoiceLimiter {
  constructor(limits = VOICE_LIMITS, max = MAX_VOICES) {
    this.limits = limits;
    this.max = max;
    this.counts = new Map();
    this.total = 0;
  }

  tryStart(id) {
    const n = this.counts.get(id) ?? 0;
    if (this.total >= this.max || n >= (this.limits[id] ?? DEFAULT_LIMIT)) return false;
    this.counts.set(id, n + 1);
    this.total++;
    return true;
  }

  end(id) {
    const n = this.counts.get(id) ?? 0;
    if (n <= 0) return;
    this.counts.set(id, n - 1);
    this.total--;
  }
}

export class SoundEngine {
  constructor({ enabled = true, volume = 0.8, win = globalThis.window } = {}) {
    this.win = win ?? {};
    this.available = typeof (this.win.AudioContext ?? this.win.webkitAudioContext) === 'function';
    this.enabled = enabled && this.available;
    this.volume = volume;
    this.muted = !enabled;
    this.ctx = null;
    this.master = null;
    this.buffers = new Map();
    this.limiter = new VoiceLimiter();
    this.listener = { x: 0, z: 0, rightX: 1, rightZ: 0, range: 16 };
    if (this.enabled) {
      const unlock = () => this.unlock();
      this.win.addEventListener('pointerdown', unlock, { once: true });
      this.win.addEventListener('keydown', unlock, { once: true });
    }
  }

  unlock() {
    if (this.ctx || !this.enabled) return;
    try {
      const Context = this.win.AudioContext ?? this.win.webkitAudioContext;
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      for (const id of Object.keys(RECIPES)) {
        const data = render(id);
        const buffer = this.ctx.createBuffer(1, data.length, RATE);
        buffer.copyToChannel(data, 0);
        this.buffers.set(id, buffer);
      }
      this.ctx.resume?.();
    } catch (err) {
      console.warn('sound disabled:', err);
      this.enabled = false;
      this.ctx = null;
    }
  }

  setListener(x, z, rightX, rightZ, range) {
    const l = this.listener, n = Math.hypot(rightX, rightZ) || 1;
    l.x = x;
    l.z = z;
    l.rightX = rightX / n;
    l.rightZ = rightZ / n;
    l.range = Math.max(4, range);
  }

  play(id, { x = null, z = null, volume = 1, rate = 1 } = {}) {
    if (!this.ctx || this.muted) return false;
    const buffer = this.buffers.get(id);
    if (!buffer) return false;
    let pan = 0, gain = volume;
    if (x !== null && z !== null) {
      const s = spatial(this.listener, x, z);
      if (s.gain < 0.03) return false;
      pan = s.pan;
      gain *= s.gain;
    }
    if (!this.limiter.tryStart(id)) return false;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      if (this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = pan;
        g.connect(p);
        p.connect(this.master);
      } else g.connect(this.master);
      src.onended = () => this.limiter.end(id);
      src.start();
      return true;
    } catch {
      this.limiter.end(id);
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/sound-engine.test.mjs && npm test`
Expected: PASS (4 new tests); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/audio/engine.js tests/sound-engine.test.mjs
git commit -m "feat(audio): Web Audio engine with gesture unlock, positional pan and fade, voice limits and silent fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sound cues and wiring

**Files:**
- Create: `src/audio/cues.js`
- Modify: `src/game/game-view.js`, `src/core/settings.js`
- Test: `tests/cues.test.mjs`, `tests/core.test.mjs` (addition)

**Interfaces:**
- Consumes: `SoundEngine` (Task 2); the event stream (plans 1a–1c); `GameView.seen(x, z)` (plan 1c).
- Produces: `cueFor(event, playerHouse, seen)` → `{id, x?, z?}` or `null` — weapons by weapon (rockets whoosh), rocket impacts and deaths explode by size, shell impacts `hit`, crushes `crush`, the player's own placements and deployments `clunk`, sales `sell`, repairs switched on `ratchet`, a finished structure `ready`, the player's error announcements (`insufficientFunds`, `cannotPlace`, `busy`, `cannotDeploy`) `error` and every other announcement `beep`; positional cues only where the player can see. Settings `sound` (default `true`) and `volume` (default `0.8`). GameView: `sound` engine; cues for every event (not for the catch-up backlog), ±6 % random pitch; the listener follows the camera target, right vector and distance; `M` toggles sound (message "Sound off" / "Sound on"); interface clicks on the sidebar and the selection panel; radar static when the radar switches on or off.

- [ ] **Step 1: Write the failing tests**

**File: `tests/cues.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { cueFor } from '../src/audio/cues.js';

const all = () => true;

test('weapons sound like their weapon; rockets whoosh', () => {
  assert.deepEqual(cueFor({ type: 'fired', weapon: 'cannon', projectile: 'shell', x: 3, y: 4 }, 'atreides', all), { id: 'cannon', x: 3, z: 4 });
  assert.equal(cueFor({ type: 'fired', weapon: 'mg', projectile: 'bullet', x: 0, y: 0 }, 'atreides', all).id, 'mg');
  assert.equal(cueFor({ type: 'fired', weapon: 'trooperRocket', projectile: 'rocket', x: 0, y: 0 }, 'atreides', all).id, 'rocket');
  assert.equal(cueFor({ type: 'impact', projectile: 'rocket', x: 0, y: 0 }, 'atreides', all).id, 'explosionSmall');
  assert.equal(cueFor({ type: 'impact', projectile: 'shell', x: 0, y: 0 }, 'atreides', all).id, 'hit');
  assert.equal(cueFor({ type: 'impact', projectile: 'bullet', x: 0, y: 0 }, 'atreides', all), null);
  assert.equal(cueFor({ type: 'explosion', size: 'large', x: 0, y: 0 }, 'atreides', all).id, 'explosionLarge');
  assert.equal(cueFor({ type: 'unitDestroyed', cause: 'crushed', x: 1, y: 1 }, 'atreides', all).id, 'crush');
});

test('cues respect fog: what the player cannot see is not heard', () => {
  const none = () => false;
  assert.equal(cueFor({ type: 'fired', weapon: 'cannon', projectile: 'shell', x: 3, y: 4 }, 'atreides', none), null);
  assert.equal(cueFor({ type: 'explosion', size: 'medium', x: 0, y: 0 }, 'atreides', none), null);
  assert.equal(cueFor({ type: 'sold', house: 'atreides' }, 'atreides', none).id, 'sell', 'interface sounds are not positional');
});

test('the player hears their own interface, not the enemy\'s', () => {
  assert.equal(cueFor({ type: 'structurePlaced', house: 'atreides', x: 4, y: 4 }, 'atreides', all).id, 'clunk');
  assert.equal(cueFor({ type: 'structurePlaced', house: 'harkonnen', x: 4, y: 4 }, 'atreides', all), null);
  assert.equal(cueFor({ type: 'eva', house: 'atreides', key: 'insufficientFunds' }, 'atreides', all).id, 'error');
  assert.equal(cueFor({ type: 'eva', house: 'atreides', key: 'constructionComplete' }, 'atreides', all).id, 'beep');
  assert.equal(cueFor({ type: 'eva', house: 'harkonnen', key: 'unitLost' }, 'atreides', all), null);
  assert.equal(cueFor({ type: 'productionReady', house: 'atreides' }, 'atreides', all).id, 'ready');
  assert.equal(cueFor({ type: 'repairToggled', house: 'atreides', on: false }, 'atreides', all), null);
  assert.equal(cueFor({ type: 'moveOrdered' }, 'atreides', all), null);
});
```

Append to `tests/core.test.mjs`:
```js
import { sanitize as sanitizeSettings } from '../src/core/settings.js';

test('sound settings: on by default, volume kept in range', () => {
  const s = sanitizeSettings({});
  assert.deepEqual([s.sound, s.volume], [true, 0.8]);
  assert.deepEqual([sanitizeSettings({ sound: 'false' }).sound, sanitizeSettings({ volume: '0.5' }).volume, sanitizeSettings({ volume: '9' }).volume], [false, 0.5, 0.8]);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/cues.test.mjs tests/core.test.mjs`
Expected: FAIL — cannot find `../src/audio/cues.js`; `sound` and `volume` are not settings.

- [ ] **Step 3: Implement**

**File: `src/audio/cues.js`**
```js
// What the player hears (spec §6): simulation events become sound cues placed where they happen. Only
// what the player can see is heard; interface sounds (placements, errors, sales) belong to the player.
const WEAPON = { rifle: 'rifle', pistol: 'rifle', trooperRocket: 'rifle', mg: 'mg', cannon: 'cannon', turretGun: 'cannon', heavyCannon: 'heavyCannon', plasma: 'heavyCannon', sonic: 'heavyCannon' };
const EXPLOSION = { small: 'explosionSmall', medium: 'explosionMedium', large: 'explosionLarge' };
const ERRORS = new Set(['insufficientFunds', 'cannotPlace', 'busy', 'cannotDeploy']);

export function cueFor(e, me, seen) {
  const at = (id, x, z) => (seen(x, z) ? { id, x, z } : null);
  const mine = e.house === me;
  switch (e.type) {
    case 'fired': return at(e.projectile === 'rocket' ? 'rocket' : WEAPON[e.weapon] ?? 'rifle', e.x, e.y);
    case 'impact': return e.projectile === 'rocket' ? at('explosionSmall', e.x, e.y) : e.projectile === 'shell' ? at('hit', e.x, e.y) : null;
    case 'explosion': return at(EXPLOSION[e.size] ?? 'explosionSmall', e.x, e.y);
    case 'unitDestroyed': return e.cause === 'crushed' ? at('crush', e.x, e.y) : null;
    case 'structurePlaced': case 'deployed': return mine ? at('clunk', e.x + 1, e.y + 1) : null;
    case 'sold': return mine ? { id: 'sell' } : null;
    case 'repairToggled': return mine && e.on ? { id: 'ratchet' } : null;
    case 'productionReady': return mine ? { id: 'ready' } : null;
    case 'eva': return mine ? { id: ERRORS.has(e.key) ? 'error' : 'beep' } : null;
    default: return null;
  }
}
```

Modify `src/core/settings.js` — change `DEFAULTS` to:
```js
export const DEFAULTS = { quality: 'medium', scheme: 'classic', edgeScroll: true, scrollSpeed: 1, healthBars: 'selected', gameSpeed: 'normal', sound: true, volume: 0.8 };
```

Modify `src/game/game-view.js`:
- add imports:
```js
import { SoundEngine } from '../audio/engine.js';
import { cueFor } from '../audio/cues.js';
```
- directly before `this.icons = new IconFactory(…);` add:
```js
    this.sound = new SoundEngine({ enabled: settings.sound, volume: settings.volume });
    const click = (fn) => (...args) => { this.sound.play('click'); return fn(...args); };
```
- in the `new Sidebar(…)` options wrap the callbacks: `onCommand: click((cmd) => world.issue(house, cmd)),`, `onPlace: click((typeId) => this.controller.startPlacement(typeId)),`, `onTool: click((tool) => this.controller.setMode(this.controller.mode?.kind === tool ? null : { kind: tool })),`
- in the `new SelectionPanel(…)` options change `onButton: (id) => this.panelAction(id),` to `onButton: click((id) => this.panelAction(id)),`
- at the very start of `onEvent(e)` add:
```js
    if (!this.catchingUp) {
      const cue = cueFor(e, this.house, (x, z) => this.seen(x, z));
      if (cue) this.sound.play(cue.id, { x: cue.x ?? null, z: cue.z ?? null, rate: 0.94 + Math.random() * 0.12 });
    }
```
- in `onKey(key, code, mods)`, directly after the `P` branch add:
```js
    if (key === 'm' && !mods.ctrl) {
      if (!mods.repeat) this.hud.message(this.sound.toggleMute() ? 'Sound off' : 'Sound on', 1.5);
      return true;
    }
```
- in `frame(now)`, directly after `r3d.follow(…);` add:
```js
    const e = r3d.camera.matrixWorld.elements;
    this.sound.setListener(this.rig.target.x, this.rig.target.z, e[0], e[2], this.rig.distance);
```
- in `frame(now)`, directly after `this.radar.update(…);` add:
```js
    if (this.radarWas !== undefined && sidebar.radar !== this.radarWas) this.sound.play('static');
    this.radarWas = sidebar.radar;
```

- [ ] **Step 4: Run the tests and listen**

Run: `node --test tests/cues.test.mjs tests/core.test.mjs && npm test && npm run smoke battle-fight skirmish-sidebar && npm run e2e`
Expected: PASS (4 new tests); suite green; screenshots write without console errors; e2e 18/18 (its clicks unlock audio in headless Chrome without errors). Then open `http://localhost:8080/?scene=battle` in a browser, click once, and listen: cannons thump, machine guns rattle, rockets whoosh and explosions boom from the side they happen on; M mutes.

- [ ] **Step 5: Commit**

```bash
git add src/audio/cues.js src/core/settings.js src/game/game-view.js tests/cues.test.mjs tests/core.test.mjs
git commit -m "feat(audio): sound cues for combat, construction and the interface; positional listener; M mutes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Dust, tread marks and construction dust

**Files:**
- Modify: `src/render/effects.js` (`dust`), `src/game/game-view.js`
- Test: `tests/effects.test.mjs` (addition)

**Interfaces:**
- Consumes: `Effects` (plan 1c), `TerrainView.decals.track(x, y, heading, width, alpha)` (plan 1a), `G` ground types.
- Produces: `Effects.dust(x, y, z, strength = 1)` (sand-coloured, alpha pool); GameView `ambient(dt)` — dust behind moving vehicles on sand and dunes, tread marks every 0.3 tiles (narrower and fainter for wheels) where the player can see, harvest dust at the intake of harvesting harvesters; `constructionDust(structure)` — a ring of dust when a structure is placed.

- [ ] **Step 1: Write the failing test**

Append to `tests/effects.test.mjs`:
```js
test('dust is sand-coloured smoke that rises and fades', () => {
  const fx = new Effects(new THREE.Scene(), { particles: 400, flashLights: 0 });
  fx.dust(1, 0, 2, 1);
  assert.equal(fx.smoke.n, 1);
  assert.equal(fx.glow.n, 0);
  const y0 = fx.smoke.pos[1];
  fx.update(0.5);
  assert.ok(fx.smoke.pos[1] > y0, 'rises');
  fx.update(2);
  assert.equal(fx.smoke.n, 0, 'fades away');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/effects.test.mjs`
Expected: FAIL — `fx.dust is not a function`.

- [ ] **Step 3: Implement**

Modify `src/render/effects.js` — add this method after `flame(x, y, z) { … }`:
```js
  dust(x, y, z, strength = 1) {
    this.smoke.emit({ x: x + rnd(-0.1, 0.1), y, z: z + rnd(-0.1, 0.1), vx: rnd(-0.15, 0.15), vy: rnd(0.15, 0.35), vz: rnd(-0.15, 0.15), life: rnd(0.9, 1.5), size: [0.2, 0.9 * strength], color: [0.78, 0.64, 0.45], color2: [0.86, 0.75, 0.6], alpha: [0.32 * strength, 0], drag: 1.2 });
  }
```

Modify `src/game/game-view.js`:
- add `import { G } from '../data/terrain.js';`
- after `this.smokeClock = 0;` add:
```js
    this.dustClock = 0;
    this.trackFrom = new Map();
```
- in `onEvent(e)`, inside the existing `if (e.type === 'structurePlaced') { … }` block, after the `flattenFootprint` line add:
```js
      if (s && !this.catchingUp && this.seen(s.x + s.w / 2, s.y + s.h / 2)) this.constructionDust(s);
```
- add these methods after `combatEffects(dt, alpha) { … }`:
```js
  /** Dust behind vehicles on sand, tread marks and harvest dust (spec §5.4). */
  ambient(dt) {
    const w = this.world, map = w.map;
    this.dustClock += dt;
    const puff = this.dustClock >= 0.09;
    if (puff) this.dustClock = 0;
    for (const u of w.units.values()) {
      if (u.move === 'foot') continue;
      const i = map.idx(u.tx, u.ty);
      const soft = (map.ground[i] === G.SAND || map.ground[i] === G.DUNE) && !map.concrete[i];
      const p = this.unitViews.renderPos(u);
      const visible = this.seen(p.x, p.z);
      if (u.step && soft) {
        const last = this.trackFrom.get(u.id);
        if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 0.3) {
          if (last && visible) this.terrain.decals?.track(p.x, p.z, u.heading, u.move === 'wheeled' ? 0.2 : 0.28, u.move === 'wheeled' ? 0.035 : 0.05);
          this.trackFrom.set(u.id, { x: p.x, z: p.z });
        }
        if (puff && visible) this.effects.dust(p.x - Math.cos(u.heading) * 0.35, this.heightAt(p.x, p.z) + 0.08, p.z - Math.sin(u.heading) * 0.35, u.move === 'wheeled' ? 0.9 : 0.7);
      } else if (!u.step) this.trackFrom.delete(u.id);
      if (puff && visible && u.harvest?.state === 'harvesting') {
        this.effects.dust(p.x + Math.cos(u.heading) * 0.45, this.heightAt(p.x, p.z) + 0.1, p.z + Math.sin(u.heading) * 0.45, 1.2);
      }
    }
    for (const id of this.trackFrom.keys()) if (!w.units.has(id)) this.trackFrom.delete(id);
  }

  constructionDust(s) {
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      const x = s.x + s.w / 2 + Math.cos(a) * s.w * 0.55, z = s.y + s.h / 2 + Math.sin(a) * s.h * 0.55;
      this.effects.dust(x, this.heightAt(x, z) + 0.05, z, 1.4);
    }
  }
```
- in `frame(now)`, directly after `this.combatEffects(dt, alpha);` add `    this.ambient(dt);`

- [ ] **Step 4: Run the tests and look**

Run: `node --test tests/effects.test.mjs && npm test && npm run smoke base-atreides skirmish-atreides`
Expected: PASS (1 new test); suite green; screenshots without errors. In `base-atreides` the working harvesters raise sand-coloured dust on the spice field and trails of tread marks lead across the sand to it.

- [ ] **Step 5: Commit**

```bash
git add src/render/effects.js src/game/game-view.js tests/effects.test.mjs
git commit -m "feat(render): dust behind vehicles, tread marks on sand, harvest and construction dust

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Simulation minors

**Files:**
- Modify: `src/sim/economy.js`, `src/sim/world.js`, `src/sim/tech.js`, `src/sim/harvest.js`, `src/sim/production.js`, `src/sim/movement.js`, `src/game/setup.js`
- Test: `tests/minors-sim.test.mjs`

**Interfaces:**
- Consumes: plans 1a–1c.
- Produces: `revokeStartBuffer(world, house)` (called when a structure with storage is placed: the starting allowance ends the moment built storage passes it); Wind Trap implied for every structure except the Wind Trap itself and slabs (spec §4.5); harvesters move at `(255 − 100 × load/700) / 256` of their speed (research: units.md "Harvesters additionally slow down as they fill"); `stats.spiceHarvested` counts credits actually banked; `orderPlace` accepts integer coordinates only; `setupSkirmish` computes fog before the first frame; movement never starts a diagonal step while another unit is crossing the mirrored diagonal of the same 2 × 2 square (plan-1a minor #14).

- [ ] **Step 1: Write the failing tests**

**File: `tests/minors-sim.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { buildOptions } from '../src/sim/tech.js';
import { setupSkirmish } from '../src/game/setup.js';
import { isVisible } from '../src/sim/fog.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

test('the starting allowance ends as soon as built storage passes it', () => {
  const world = flatWorld(32, 32, G.ROCK);
  const h = world.houses.get('atreides');
  h.startBuffer = 3000;
  h.credits = 2900;
  world.spawnStructure('refinery', 'atreides', 2, 2);
  world.spawnStructure('silo', 'atreides', 8, 2);
  assert.equal(h.startBuffer, 3000, '2005 stored: the allowance still holds');
  const last = world.spawnStructure('silo', 'atreides', 12, 2);
  assert.equal(h.startBuffer, 0, '3005 stored: it ends now, not at the next payment');
  world.issue('atreides', { type: 'sell', structureId: last.id });
  world.step();
  assert.equal(h.credits, 2005);
});

test('every structure but the Wind Trap and slabs needs a Wind Trap', () => {
  const world = flatWorld(32, 32, G.ROCK);
  for (const [t, x, y] of [['constructionYard', 2, 2], ['refinery', 6, 2], ['outpost', 10, 2]]) world.spawnStructure(t, 'atreides', x, y);
  const offered = buildOptions(world, 'atreides').structure;
  assert.ok(offered.includes('windtrap') && offered.includes('concrete'));
  for (const t of ['silo', 'barracks', 'lightFactory', 'wall', 'turret']) assert.ok(!offered.includes(t), `${t} without a Wind Trap`);
  world.spawnStructure('windtrap', 'atreides', 14, 2);
  assert.ok(buildOptions(world, 'atreides').structure.includes('silo'));
});

test('a full harvester drives noticeably slower than an empty one', () => {
  const trip = (load) => {
    const world = flatWorld(32, 12, G.SAND);
    const u = world.spawnUnit('harvester', 'atreides', 2, 6, { heading: 0 });
    u.harvest.load = load;
    world.issue('atreides', { type: 'move', ids: [u.id], x: 22, y: 6 });
    world.step();
    return runUntil(world, () => u.tx === 22, 120);
  };
  const empty = trip(0), full = trip(700);
  assert.ok(empty > 0 && full / empty > 1.4, `empty ${empty}s, full ${full}s`);
});

test('spice statistics count only the credits that were banked', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.houses.get('atreides');
  h.startBuffer = 0;
  world.spawnStructure('refinery', 'atreides', 8, 8);
  h.credits = 1005;
  const u = [...world.units.values()].find((x) => x.typeId === 'harvester');
  u.harvest.load = 700;
  u.harvest.state = 'toRefinery';
  run(world, 20);
  assert.equal(u.harvest.load, 0, 'it unloaded');
  assert.equal(h.stats.spiceHarvested, 0, 'nothing fitted in the full refinery');
});

test('structures are placed on whole tiles only', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 5000;
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  h.lines.structure.current = { typeId: 'windtrap', cost: 300, total: 21.6, progress: 1, paid: 300, state: 'ready', starved: false };
  world.issue('atreides', { type: 'place', typeId: 'windtrap', x: 6.5, y: 4 });
  world.step();
  assert.equal(h.lines.structure.current?.state, 'ready');
  assert.equal([...world.structures.values()].filter((s) => s.typeId === 'windtrap').length, 0);
});

test('a skirmish starts with fog already drawn', () => {
  const { world, house, starts } = setupSkirmish({ seed: 2 });
  assert.ok(world.houses.get(house).fog, 'fog exists before the first frame');
  assert.equal(isVisible(world, house, starts[1].x, starts[1].y), false, 'the rival base is hidden');
});

test('units on mirrored diagonal steps never pass through each other', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const a = world.spawnUnit('combatTank', 'atreides', 5, 5, { heading: Math.PI / 4 });
  const b = world.spawnUnit('combatTank', 'atreides', 6, 5, { heading: (3 * Math.PI) / 4 });
  world.issue('atreides', { type: 'move', ids: [a.id], x: 6, y: 6 });
  world.issue('atreides', { type: 'move', ids: [b.id], x: 5, y: 6 });
  let closest = Infinity;
  for (let i = 0; i < 200; i++) { world.step(); closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y)); }
  assert.ok(closest > 0.6, `they came within ${closest.toFixed(2)} tiles`);
  assert.deepEqual([a.tx, a.ty, b.tx, b.ty], [6, 6, 5, 6]);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/minors-sim.test.mjs`
Expected: FAIL — the allowance lingers, silos are offered without a Wind Trap, loaded and empty harvesters take the same time, the statistic counts lost spice, the fractional placement is accepted, fog is missing before the first step, and the two tanks meet in the middle.

- [ ] **Step 3: Implement**

Modify `src/sim/economy.js` — add after `storageCapacity`:
```js
/** The starting allowance ends for good the moment built storage passes it (not lazily at the next payment). */
export function revokeStartBuffer(world, house) {
  if (house?.startBuffer && builtStorage(world, house.id) > house.startBuffer) house.startBuffer = 0;
}
```

Modify `src/sim/world.js`:
- change the economy import to `import { updatePower, revokeStartBuffer } from './economy.js';`
- replace the `this.onStructurePlaced = …` line with:
```js
    this.onStructurePlaced = (s) => {
      if (s.type.storage) revokeStartBuffer(this, this.houses.get(s.house));
      if (s.typeId === 'refinery') spawnFreeHarvester(this, s);
    };
```

Modify `src/sim/tech.js` — in `canBuildStructure`, before the final `return`, add:
```js
  if (typeId !== 'windtrap' && !t.isConcrete && !owned.has('windtrap')) return false;   // a Wind Trap is implied for everything (spec §4.5)
```

Modify `src/sim/harvest.js`:
- in `updateHarvester`, directly after `const here = map.idx(u.tx, u.ty);` add:
```js
  u.speedMul = (255 - (100 * h.load) / HARVEST_CAPACITY) / 256;   // the original: a full load is noticeably slower
```
- in the `unloading` case replace
```js
      addCredits(world, house, amount * (house.incomeRate ?? 1));   // Hard AIs earn half again as much (spec §4.10)
      house.stats.spiceHarvested += amount;
```
with
```js
      house.stats.spiceHarvested += addCredits(world, house, amount * (house.incomeRate ?? 1));   // banked credits; Hard AIs earn half again
```

Modify `src/sim/production.js` — in `orderPlace`, directly after `const l = house?.lines.structure;` add:
```js
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
```

Modify `src/game/setup.js`:
- add `import { updateFog } from '../sim/fog.js';`
- directly before `  return { world, starts, house, rival };` add `  if (fog) updateFog(world);   // shroud from the very first frame`

Modify `src/sim/movement.js`:
- in `updateMovement`, directly after `  if (occupant && occupant !== u.id) { blocked(world, u, occupant); return; }` add:
```js
  if (nx !== u.tx && ny !== u.ty && crossing(world, u, nx, ny)) return;   // wait: someone is crossing the other diagonal
```
- append:
```js
/** Another unit mid-step along the other diagonal of the same 2 × 2 square would pass through this one. */
function crossing(world, u, nx, ny) {
  const map = world.map, a = map.idx(nx, u.ty), b = map.idx(u.tx, ny);
  for (const i of [a, b]) {
    const o = world.units.get(map.unit[i]);
    if (o && o !== u && o.step && ((o.step.from === a && o.step.to === b) || (o.step.from === b && o.step.to === a))) return true;
  }
  return false;
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/minors-sim.test.mjs && npm test`
Expected: PASS (7 new tests); suite green (the soaks included).

- [ ] **Step 5: Commit**

```bash
git add src/sim src/game/setup.js tests/minors-sim.test.mjs
git commit -m "fix(sim): eager end of the starting allowance, implied Wind Trap, loaded harvesters slower, banked spice statistics, whole-tile placement, fog from the first frame, no diagonal crossing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Computer opponent and end-of-game minors

**Files:**
- Modify: `src/sim/ai.js`, `src/sim/victory.js`, `src/sim/world.js`
- Test: `tests/ai.test.mjs` (addition), `tests/victory.test.mjs` (additions)

**Interfaces:**
- Consumes: plan 1c's brain and victory.
- Produces: the AI keeps at most four silos; an AI without a yard and without an MCV buys an MCV at its Heavy Factory (900 credits) and deploys it; a draw is announced as `draw` "The battle is a draw." to everyone; `world.outcome = {winner, tick, seconds, stats: {houseId: {…stats}}}` freezes the statistics at the end and `endStats` reads them; victory is checked every 5 ticks.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ai.test.mjs`:
```js
test('an AI that lost its yard builds and deploys a new MCV', () => {
  const world = flatWorld(40, 30, G.ROCK);
  for (const [t, x, y] of [['windtrap', 2, 2], ['windtrap', 5, 2], ['refinery', 2, 6], ['heavyFactory', 8, 6]]) world.spawnStructure(t, 'harkonnen', x, y);
  const h = world.houses.get('harkonnen');
  h.credits = 3000;
  h.startBuffer = 5000;
  createBrain(world, 'harkonnen', 'normal');
  const hasYard = () => [...world.structures.values()].some((s) => s.house === 'harkonnen' && s.typeId === 'constructionYard');
  assert.ok(runUntil(world, hasYard, 150) > 0, 'a new yard stands');
});

import { builtStorage } from '../src/sim/economy.js';

test('the AI stops building silos at four', () => {
  const world = flatWorld(48, 32, G.ROCK);
  for (const [t, x, y] of [['constructionYard', 2, 2], ['windtrap', 5, 2], ['windtrap', 8, 2], ['windtrap', 11, 2], ['refinery', 2, 6]]) world.spawnStructure(t, 'harkonnen', x, y);
  const h = world.houses.get('harkonnen');
  const brain = createBrain(world, 'harkonnen', 'hard');
  brain.nextAttack = 1e9;
  for (let k = 0; k < 20 * 900; k++) {   // fifteen minutes with the stores always nearly full
    h.credits = Math.max(h.credits, 0.95 * Math.max(builtStorage(world, 'harkonnen'), h.startBuffer ?? 0));
    world.step();
  }
  const silos = [...world.structures.values()].filter((s) => s.house === 'harkonnen' && s.typeId === 'silo').length;
  assert.ok(silos <= 4, `${silos} silos`);
});
```

Append to `tests/victory.test.mjs`:
```js
test('a draw is announced as a draw', () => {
  const { world, a, h } = duel();
  run(world, 1.05);
  destroyStructure(world, a, null);
  destroyStructure(world, h, null);
  run(world, 1);
  const said = events(world, 'eva').map((e) => e.key);
  assert.ok(said.includes('draw') && !said.includes('missionFailed'), said.join());
});

test('end statistics are frozen at the end and the end comes quickly', () => {
  const { world, h } = duel();
  destroyStructure(world, h, { house: 'atreides', id: 0, kind: 'unit' });
  run(world, 0.3);
  assert.ok(world.outcome, 'decided within a third of a second');
  const before = endStats(world, 'atreides');
  world.houses.get('atreides').stats.unitsKilled += 5;
  run(world, 3);
  assert.deepEqual(endStats(world, 'atreides'), before);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/ai.test.mjs tests/victory.test.mjs`
Expected: FAIL — no new yard, more than four silos, a draw says "Mission failed.", the outcome takes up to a second and the statistics keep moving.

- [ ] **Step 3: Implement**

Modify `src/sim/ai.js`:
- in `nextStructure`, replace `  if (house.credits > Math.max(builtStorage(world, id), house.startBuffer ?? 0) * 0.8 && can('silo')) return 'silo';` with:
```js
  if (house.credits > Math.max(builtStorage(world, id), house.startBuffer ?? 0) * 0.8 && has('silo') < 4 && can('silo')) return 'silo';
```
- in `think(world, house)`, replace `  if (!view.yard) deployMcv(world, house, view);` with:
```js
  if (!view.yard) {
    if (view.units.some((u) => u.type.deploysTo)) deployMcv(world, house, view);
    else rebuildMcv(world, house, view);
  }
```
- append:
```js
/** Without a Construction Yard or an MCV the base cannot grow: buy an MCV and deploy it. */
function rebuildMcv(world, house, view) {
  const heavy = house.lines.heavy;
  if (!view.count.heavyFactory || heavy.current || heavy.queue.includes('mcv') || house.credits < 900 || !canBuild(world, house.id, 'mcv')) return;
  issue(world, house, { type: 'build', typeId: 'mcv' });
}
```

Modify `src/sim/victory.js`:
- replace the end of `updateVictory` (from `  const winner = standing[0] ?? null;` to the end of the function) with:
```js
  const winner = standing[0] ?? null;
  const stats = Object.fromEntries([...world.houses.values()].map((h) => [h.id, { ...h.stats }]));
  world.outcome = { winner, tick: world.tick, seconds: world.time, stats };
  world.events.push('gameOver', { winner });
  for (const house of world.houses.values()) {
    if (winner === null) announce(world, house.id, 'draw', 'The battle is a draw.');
    else if (house.id === winner) announce(world, house.id, 'missionAccomplished', 'Mission accomplished.');
    else announce(world, house.id, 'missionFailed', 'Mission failed.');
  }
}
```
- in `endStats`, replace
```js
  const me = world.houses.get(houseId);
  const others = [...world.houses.values()].filter((h) => h.id !== houseId);
  const sum = (k) => others.reduce((n, h) => n + h.stats[k], 0);
  const row = (label, k) => ({ label, you: Math.round(me.stats[k]), enemy: Math.round(sum(k)) });
```
with
```js
  const statsOf = (h) => world.outcome?.stats?.[h.id] ?? h.stats;   // frozen at the end
  const me = statsOf(world.houses.get(houseId));
  const others = [...world.houses.values()].filter((h) => h.id !== houseId).map(statsOf);
  const sum = (k) => others.reduce((n, s) => n + s[k], 0);
  const row = (label, k) => ({ label, you: Math.round(me[k]), enemy: Math.round(sum(k)) });
```
and `    seconds: Math.round(world.time),` with `    seconds: Math.round(world.outcome?.seconds ?? world.time),`

Modify `src/sim/world.js` — replace `    if (this.tick % 20 === 0) updateVictory(this);` with `    if (this.tick % 5 === 0) updateVictory(this);`

- [ ] **Step 4: Run the tests**

Run: `node --test tests/ai.test.mjs tests/victory.test.mjs && npm test`
Expected: PASS (4 new tests); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/sim/ai.js src/sim/victory.js src/sim/world.js tests/ai.test.mjs tests/victory.test.mjs
git commit -m "fix(sim): AI rebuilds its yard and caps silos; draws announced as draws; end statistics frozen; faster victory check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Interface minors

**Files:**
- Modify: `src/render/placement-ghost.js`, `src/ui/hud.js`, `src/ui/radar.js`, `src/render/effects.js`, `src/game/game-view.js`
- Test: `tests/placement-ghost.test.mjs` (addition), `tests/hud.test.mjs`, `tests/effects.test.mjs` (addition)

**Interfaces:**
- Consumes: plans 1b–1c UI.
- Produces: the placement ghost turns every cell red only when the footprint does not touch the base — otherwise just the blocked cells; `Hud(root, doc = document)` gains `hold(text)` / `release()` (a held message stays under transient ones: the pause notice survives other messages); the radar measures its canvas only at start and on window resize; after a WebGL context loss that is not restored within 5 s the crash screen offers a reload; particle pools skip GPU uploads while empty.

- [ ] **Step 1: Write the failing tests**

Append to `tests/placement-ghost.test.mjs`:
```js
test('next to the base only the blocked cells turn red', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const ghost = new PlacementGhost(new THREE.Scene(), hf);
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  world.spawnUnit('soldier', 'atreides', 7, 5);
  ghost.show({ typeId: 'windtrap', x: 6, y: 4, check: checkPlacement(world, 'atreides', 'windtrap', 6, 4) });
  assert.equal(colours(ghost), 'yyyr');
});
```

**File: `tests/hud.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hud } from '../src/ui/hud.js';

function fakeDoc() {
  return {
    createElement: () => {
      const classes = new Set();
      return { className: '', textContent: '', classes, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } };
    },
  };
}
const root = { appendChild() {} };

test('a held message outlasts passing ones', () => {
  const doc = fakeDoc();
  const hud = new Hud(root, doc);
  hud.hold('Paused');
  assert.equal(hud.el.textContent, 'Paused');
  hud.message('Unit lost.', 1);
  assert.equal(hud.el.textContent, 'Unit lost.');
  hud.update(1.1);
  assert.equal(hud.el.textContent, 'Paused');
  assert.ok(hud.el.classes.has('show'));
  hud.release();
  hud.update(0.1);
  assert.ok(!hud.el.classes.has('show'));
});
```

Append to `tests/effects.test.mjs`:
```js
test('empty pools do not re-upload their buffers', () => {
  const pool = new ParticlePool(new THREE.Scene(), 16, { additive: true });
  pool.update(0.1);
  const v = pool.alphaAttr.version;
  pool.update(0.1);
  pool.update(0.1);
  assert.equal(pool.alphaAttr.version, v);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/placement-ghost.test.mjs tests/hud.test.mjs tests/effects.test.mjs`
Expected: FAIL — the ghost shows `rrrr`, `hud.hold` is not a function, idle pools upload every frame.

- [ ] **Step 3: Implement**

Modify `src/render/placement-ghost.js` — in `show()`, replace `      cell.material = this.cellMaterials[check.ok ? state : 'blocked'];` with:
```js
      cell.material = this.cellMaterials[check.adjacent ? state : 'blocked'];   // away from the base everything is red
```

Replace `src/ui/hud.js` with:
```js
// Message bar at the top of the battlefield (Dune II style) for announcer and status text. A held
// message (the pause notice) stays underneath passing ones and returns when they fade.
export class Hud {
  constructor(root, doc = document) {
    this.el = doc.createElement('div');
    this.el.className = 'message-bar';
    root.appendChild(this.el);
    this.timer = 0;
    this.held = null;
  }

  message(text, seconds = 4) {
    this.el.textContent = text;
    this.el.classList.add('show');
    this.timer = seconds;
  }

  hold(text) {
    this.held = text;
    if (this.timer <= 0) { this.el.textContent = text; this.el.classList.add('show'); }
  }

  release() { this.held = null; }

  update(dt) {
    if (this.timer > 0 && (this.timer -= dt) > 0) return;
    this.timer = 0;
    if (this.held) { if (this.el.textContent !== this.held) this.el.textContent = this.held; this.el.classList.add('show'); }
    else this.el.classList.remove('show');
  }
}
```

Modify `src/ui/radar.js`:
- in the constructor, after `this.size = 0;` add `    addEventListener('resize', () => { this.size = 0; });`
- replace `resize() { … }` with:
```js
  resize() {
    if (this.size) return;   // measured at start and after window resizes, not every frame
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.size = this.canvas.clientWidth || 220;
    this.canvas.width = this.canvas.height = Math.round(this.size * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
```

Modify `src/render/effects.js` — at the top of `ParticlePool.update(dt)` add:
```js
    if (this.n === 0 && this.mesh.count === 0) return;   // nothing alive and nothing left on screen: no upload
```

Modify `src/game/game-view.js`:
- replace the `togglePause()` body with:
```js
    this.userPaused = !this.userPaused;
    this.paused = document.hidden || this.lost || this.userPaused;
    if (this.userPaused) this.hud.hold('Paused — press P to continue');
    else { this.hud.release(); this.hud.message('Resumed', 1.5); }
```
- replace the `r3d.onContextLost = …` line with:
```js
    r3d.onContextLost = () => {
      this.lost = true;
      this.paused = true;
      this.hud.message('The graphics device was reset — restoring…', 3600);
      setTimeout(() => { if (this.lost) showCrash(new Error('The graphics device was lost and did not come back.')); }, 5000);
    };
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/placement-ghost.test.mjs tests/hud.test.mjs tests/effects.test.mjs && npm test`
Expected: PASS (3 new tests); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/render/placement-ghost.js src/ui/hud.js src/ui/radar.js src/render/effects.js src/game/game-view.js tests/placement-ghost.test.mjs tests/hud.test.mjs tests/effects.test.mjs
git commit -m "fix(ui): ghost marks only blocked cells, pause notice stays, radar measured once, reload after a lost device, idle particles skip uploads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: README and phase-1 verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the finished phase-1 game.
- Produces: README sections for sound (M, `sound=0`, `volume=`), the updated status (phase 1 complete) and verification.

- [ ] **Step 1: Update the README**

Modify `README.md`:
- in the Status section, replace its paragraph with:
```markdown
Phase 1 is complete: a full skirmish against a computer opponent on Easy, Normal or Hard — build a
base, harvest spice, raise an army, fight with the original weapons and win or lose — with sound
effects synthesized in code, placed in stereo around the camera. Phase 2 adds the House of IX
specials, aircraft, sandworms, the Starport and Palace, music and announcer voices; phase 3 the
campaign and menus.
```
- in the controls table add a row `| M | Sound on and off |`
- in the URL flags add `sound=0` (start muted) · `volume=0.5`
- add a section:
```markdown
## Sound

Every sound — rifles, machine guns, cannons, rockets, explosions, construction and the interface — is
synthesized in the browser at start-up; nothing is loaded from files. Browsers only allow sound after
a click or key press, so the game is silent until then. Sounds are panned towards where they happen
and fade with distance from the camera; what fog hides is not heard.
```

- [ ] **Step 2: Full verification**

Run: `npm test && npm run smoke && npm run e2e`
Expected: everything green.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README for sound and the end of phase 1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Deferred to phase 2

- Announcer voices, FM music, the original-file loader (spec §6).
- Options screen (volume slider, quality presets, control scheme) — phase 2 per spec §11.
