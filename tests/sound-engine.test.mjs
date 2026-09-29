import test from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES, RATE, render } from '../src/audio/synth.js';
import { SoundEngine, VoiceLimiter, spatial, MAX_VOICES, VOICE_GAIN } from '../src/audio/engine.js';

// Web Audio does not exist under Node: a minimal stand-in records what the engine does with it.
function fakeWindow({ suspended = false } = {}) {
  const listeners = {};
  const win = { addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener: (type) => { delete listeners[type]; }, listeners, userActivation: false };
  class Node { connect() {} }
  class FakeContext {
    constructor() { this.destination = {}; this.started = []; this.state = suspended && !win.userActivation ? 'suspended' : 'running'; this.compressors = 0; }
    createGain() { return Object.assign(new Node(), { gain: { value: 1 } }); }
    createDynamicsCompressor() { this.compressors++; return Object.assign(new Node(), { threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 1 }, attack: { value: 0 }, release: { value: 0 } }); }
    createStereoPanner() { return Object.assign(new Node(), { pan: { value: 0 } }); }
    createBuffer(channels, length, sampleRate) { return { length, sampleRate, copyToChannel() {} }; }
    createBufferSource() { const s = Object.assign(new Node(), { playbackRate: { value: 1 }, start: () => this.started.push(s) }); return s; }
    resume() { if (win.userActivation) this.state = 'running'; return Promise.resolve(); }
  }
  win.AudioContext = FakeContext;
  return win;
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

test('starting muted still lets M turn sound on', () => {
  const win = fakeWindow();
  const e = new SoundEngine({ enabled: false, win });
  assert.equal(e.muted, true);
  win.listeners.pointerdown();
  assert.ok(e.ctx, 'the context opens on the first gesture anyway');
  assert.equal(e.play('cannon'), false, 'muted');
  assert.equal(e.toggleMute(), false);
  assert.equal(e.play('cannon'), true);
});

test('a context that starts suspended resumes on a later real gesture and holds no voices meanwhile', () => {
  const win = fakeWindow({ suspended: true });
  const e = new SoundEngine({ win });
  win.listeners.keydown();   // e.g. Escape: not a user activation, the context stays suspended
  assert.equal(e.ctx.state, 'suspended');
  for (let k = 0; k < 40; k++) e.play('cannon');
  assert.equal(e.limiter.total, 0, 'no voices taken while suspended');
  win.userActivation = true;
  win.listeners.pointerdown();   // a real click
  assert.equal(e.ctx.state, 'running');
  assert.equal(e.play('cannon'), true);
});

test('the mix runs through a limiter and a battle keeps headroom before it', () => {
  const win = fakeWindow();
  const e = new SoundEngine({ win });
  win.listeners.pointerdown();
  assert.equal(e.ctx.compressors, 1, 'a limiter sits before the output');
  const ids = ['cannon', 'mg', 'rifle', 'explosionSmall', 'rocket', 'hit', 'explosionMedium', 'explosionLarge'];
  const buffers = Object.fromEntries(ids.map((id) => [id, render(id)]));
  const out = new Float32Array(RATE * 6);
  const limiter = new VoiceLimiter();
  const ends = [];
  let seed = 7;
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 50; k++) {   // ten on-screen cues a second for five seconds
    const at = Math.floor((k * RATE) / 10);
    for (let i = ends.length - 1; i >= 0; i--) if (ends[i][0] <= at) { limiter.end(ends[i][1]); ends.splice(i, 1); }
    const id = ids[Math.floor(next() * ids.length)];
    if (!limiter.tryStart(id)) continue;
    const b = buffers[id];
    for (let i = 0; i < b.length && at + i < out.length; i++) out[at + i] += b[i] * VOICE_GAIN * 0.8;
    ends.push([at + b.length, id]);
  }
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(peak <= 1, `peak ${peak.toFixed(2)} before the limiter`);
});
