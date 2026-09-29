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
