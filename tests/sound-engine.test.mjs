import test from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES, RATE, render, variants } from '../src/audio/synth.js';
import { SoundEngine, VoiceLimiter, spatial, MAX_VOICES, PRIORITY_VOICES, VOICE_GAIN, AIR, WET, RENDER_ORDER } from '../src/audio/engine.js';

// Web Audio does not exist under Node: a minimal stand-in records what the engine does with it.
// `full` adds the filters, the convolver and a clock, as a browser has them.
function fakeWindow({ suspended = false, full = false, idle = false, worker = false } = {}) {
  const listeners = {};
  const win = { addEventListener: (type, fn) => { listeners[type] = fn; }, removeEventListener: (type) => { delete listeners[type]; }, listeners, userActivation: false };
  if (idle) {
    win.idleQueue = [];
    win.requestIdleCallback = (fn) => win.idleQueue.push(fn);
  }
  if (worker) {
    win.workers = [];
    win.Worker = class {
      constructor(url, options) { Object.assign(this, { url: String(url), options, sent: null, terminated: false }); win.workers.push(this); }
      postMessage(data) { this.sent = structuredClone(data); }   // as a real worker gets it: a copy
      terminate() { this.terminated = true; }
      /** What the real worker does for the next n items it was sent. */
      deliver(n = Infinity) {
        for (const [id, v] of this.sent.todo.splice(0, n)) this.onmessage({ data: { id, v, samples: render(id, v) } });
        if (!this.sent.todo.length) this.onmessage({ data: { done: true } });
      }
    };
  }
  class Node {
    constructor() { this.outputs = []; this.disconnected = false; }
    connect(n) { this.outputs.push(n); return n; }
    disconnect() { this.disconnected = true; }
  }
  class FakeContext {
    constructor() {
      this.destination = new Node();
      this.started = [];
      this.state = suspended && !win.userActivation ? 'suspended' : 'running';
      this.compressors = 0;
      this.convolvers = [];
      if (full) { this.sampleRate = 48000; this.currentTime = 0; }
    }
    createGain() { return Object.assign(new Node(), { gain: { value: 1 } }); }
    createDynamicsCompressor() { this.compressors++; return Object.assign(new Node(), { threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 1 }, attack: { value: 0 }, release: { value: 0 } }); }
    createStereoPanner() { return Object.assign(new Node(), { pan: { value: 0 } }); }
    createBuffer(channels, length, sampleRate) { return { numberOfChannels: channels, length, sampleRate, copyToChannel() {} }; }
    createBufferSource() { const s = Object.assign(new Node(), { playbackRate: { value: 1 }, start: () => this.started.push(s) }); return s; }
    resume() { if (win.userActivation) this.state = 'running'; return Promise.resolve(); }
  }
  if (full) {
    FakeContext.prototype.createBiquadFilter = function () { return Object.assign(new Node(), { type: 'lowpass', frequency: { value: 350 }, Q: { value: 1 } }); };
    FakeContext.prototype.createConvolver = function () { const c = Object.assign(new Node(), { buffer: null }); this.convolvers.push(c); return c; };
  }
  win.AudioContext = FakeContext;
  return win;
}

/** The chain a started source feeds, in order: its filter (if any), gain, panner, and what the panner feeds. */
function chain(src) {
  const nodes = [];
  for (let n = src.outputs[0]; n; n = n.outputs[0]) { nodes.push(n); if (n.pan) { nodes.push(...n.outputs.slice(1)); break; } }
  return { filter: nodes.find((n) => n.type === 'lowpass'), gain: nodes.find((n) => n.gain && !n.pan), panner: nodes.find((n) => n.pan), send: nodes.find((n) => n.pan)?.outputs[1] };
}

test('an engine without Web Audio is silent and safe', () => {
  const e = new SoundEngine({ win: {} });
  assert.equal(e.available, false);
  e.unlock();
  assert.equal(e.play('cannon', { x: 1, z: 1 }), false);
  e.setListener(0, 0, 1, 0, 16);
  e.toggleMute();
});

test('nothing plays before the first gesture; afterwards every effect and each of its variations is ready', () => {
  const win = fakeWindow();
  const e = new SoundEngine({ win });
  assert.equal(e.play('cannon'), false, 'no context yet');
  win.listeners.pointerdown();
  assert.equal(e.buffers.size, Object.keys(RECIPES).length);
  for (const [id, bank] of e.buffers) assert.equal(bank.length, variants(id), id);
  assert.equal(e.play('cannon'), true);
  assert.equal(e.ctx.started.length, 1);
  e.toggleMute();
  assert.equal(e.play('cannon'), false, 'muted');
});

test('sounds are rendered ahead in idle time, interface and gunfire first, and the first click only copies them', () => {
  assert.deepEqual(RENDER_ORDER.slice(0, 3), ['click', 'rifle', 'mg']);
  assert.equal(new Set(RENDER_ORDER).size, Object.keys(RECIPES).length);
  const win = fakeWindow({ idle: true });
  const e = new SoundEngine({ win });
  assert.equal(win.idleQueue.length, 1, 'one idle slice asked for');
  win.idleQueue.shift()({ timeRemaining: () => 0 });
  assert.equal(e.samples.get('click')?.length, 1, 'even a busy page renders one sound per slice');
  while (win.idleQueue.length) win.idleQueue.shift()({ timeRemaining: () => 50 });
  assert.equal(e.todo.length, 0);
  assert.deepEqual(e.samples.get('cannon')[2], render('cannon', 2));
  win.listeners.pointerdown();
  assert.equal(e.samples.size, 0, 'the samples went into buffers and were let go');
  assert.equal(e.buffers.get('cannon').length, variants('cannon'));
  const late = fakeWindow({ idle: true }), f = new SoundEngine({ win: late });
  late.listeners.pointerdown();   // a click before any idle time: everything is rendered there and then
  assert.equal(f.buffers.size, Object.keys(RECIPES).length);
  late.idleQueue.shift()({ timeRemaining: () => 50 });
  assert.equal(f.samples.size, 0, 'a slice after the context opened does nothing');
});

test('a worker renders the bank off the main thread; late sounds join as they arrive; a failed worker falls back', () => {
  const win = fakeWindow({ worker: true, idle: true });
  const e = new SoundEngine({ win });
  assert.equal(win.workers.length, 1);
  const w = win.workers[0];
  assert.match(w.url, /synth-worker\.js$/);
  assert.equal(w.options.type, 'module');
  assert.equal(w.sent.todo.length, RENDER_ORDER.reduce((n, id) => n + variants(id), 0), 'every variation asked for, in render order');
  assert.deepEqual(w.sent.todo[0], ['click', 0]);
  assert.equal(win.idleQueue.length, 0, 'no main-thread rendering while the worker works');
  w.deliver(5);
  win.listeners.pointerdown();
  assert.equal(e.buffers.get('click').length, variants('click'), 'what arrived before the click is ready');
  assert.equal(e.play('cannon'), false, 'a sound still on its way is skipped, not waited for');
  w.deliver();
  assert.equal(e.worker, null);
  assert.equal(e.todo.length, 0);
  for (const id of Object.keys(RECIPES)) assert.equal(e.buffers.get(id)?.length, variants(id), id);
  assert.equal(e.play('cannon'), true);
  const win2 = fakeWindow({ worker: true }), f = new SoundEngine({ win: win2 });
  win2.workers[0].deliver(3);
  win2.listeners.pointerdown();
  win2.workers[0].onerror({ preventDefault() {} });   // e.g. a browser without module workers
  assert.ok(win2.workers[0].terminated);
  assert.equal(f.todo.length, 0, 'the rest is rendered in the page instead');
  assert.equal(f.buffers.size, Object.keys(RECIPES).length);
});

test('each play picks a variation at random, never the same twice running, at a slightly random pitch', () => {
  const win = fakeWindow();
  let seed = 3;
  const e = new SoundEngine({ win, random: () => (seed = (seed * 16807) % 2147483647) / 2147483647 });
  win.listeners.pointerdown();
  const used = new Set(), rates = [];
  let last = null;
  for (let k = 0; k < 40; k++) {
    e.play('rifle', { rate: 1 });
    const src = e.ctx.started.at(-1);
    assert.notEqual(src.buffer, last, 'not the same variation twice in a row');
    last = src.buffer;
    used.add(src.buffer);
    rates.push(src.playbackRate.value);
    src.onended();
  }
  assert.equal(used.size, variants('rifle'), 'every variation is heard');
  assert.ok(Math.min(...rates) >= 0.97 - 1e-9 && Math.max(...rates) <= 1.03 + 1e-9 && Math.max(...rates) - Math.min(...rates) > 0.02, 'gunfire wanders in pitch by up to 3%');
  e.play('ready', { rate: 1.05 });
  assert.equal(e.ctx.started.at(-1).playbackRate.value, 1.05, 'interface chimes stay in tune');
});

test('voice limits hold and free up; priority sounds keep slots of their own', () => {
  const v = new VoiceLimiter({ cannon: 2 }, 3, { priority: new Set(['alarm']), reserve: 1 });
  assert.equal(v.tryStart('cannon'), true);
  assert.equal(v.tryStart('cannon'), true);
  assert.equal(v.tryStart('cannon'), false, 'per-sound limit');
  assert.equal(v.tryStart('mg'), true);
  assert.equal(v.tryStart('rifle'), false, 'global cap');
  assert.equal(v.tryStart('alarm'), true, 'a priority sound still gets through');
  assert.equal(v.tryStart('alarm'), false, 'but only into the reserve');
  v.end('cannon');
  assert.equal(v.tryStart('rifle'), false, 'the reserve is still in use');
  v.end('alarm');
  assert.equal(v.tryStart('rifle'), true);
  const win = fakeWindow();
  const e = new SoundEngine({ win });
  win.listeners.keydown();
  let played = 0;
  for (let k = 0; k < 60; k++) played += e.play(['cannon', 'mg', 'rifle', 'explosionSmall', 'rocket', 'hit', 'sandHit', 'bulletHit'][k % 8]) ? 1 : 0;
  assert.ok(played <= MAX_VOICES, `${played} voices`);
  assert.equal(e.play('explosionLarge'), true, 'a structure blowing up is heard over a full battle');
  assert.equal(e.play('alarm'), true, 'so is a Devastator\'s alarm');
  assert.ok(e.limiter.total <= MAX_VOICES + PRIORITY_VOICES);
  for (const s of e.ctx.started) s.onended();
  assert.equal(e.limiter.total, 0, 'ended voices free their slots');
});

test('sounds are panned, fade, dull and grow reverberant with distance from the camera', () => {
  const l = { x: 10, z: 10, rightX: 1, rightZ: 0, range: 16 };
  const here = spatial(l, 10, 10);
  assert.equal(here.pan, 0);
  assert.equal(here.gain, 1);
  assert.equal(here.cutoff, AIR.open);
  assert.equal(here.wet, WET.near);
  assert.ok(spatial(l, 18, 10).pan > 0.5, 'to the right');
  assert.ok(spatial(l, 2, 10).pan < -0.5, 'to the left');
  assert.ok(spatial(l, 40, 10).pan <= 0.85 && spatial(l, -20, 10).pan >= -0.85, 'never hard to one side');
  assert.equal(spatial(l, 60, 10).gain, 0, 'far away is silent');
  const mid = spatial(l, 10, 30);
  assert.ok(mid.gain > 0 && mid.gain < 1);
  assert.ok(mid.cutoff < AIR.open / 2 && mid.cutoff > AIR.far, `${mid.cutoff.toFixed(0)} Hz`);
  assert.ok(mid.wet > WET.near && mid.wet < WET.far);
});

test('placed sounds go through a distance low-pass and a send into the shared reverb; the interface stays dry', () => {
  const win = fakeWindow({ full: true });
  const e = new SoundEngine({ win });
  win.listeners.pointerdown();
  assert.equal(e.ctx.convolvers.length, 1, 'one convolver for every voice');
  const ir = e.ctx.convolvers[0].buffer;
  assert.equal(ir.numberOfChannels, 2);
  assert.equal(ir.sampleRate, 48000, 'the impulse matches the context rate, as a ConvolverNode requires');
  e.setListener(10, 10, 1, 0, 16);
  e.play('cannon', { x: 10, z: 30 });
  const far = chain(e.ctx.started.at(-1));
  assert.ok(far.filter && far.filter.frequency.value < 8000, 'a distant gun is dulled');
  assert.equal(far.filter.Q.value, 0);
  assert.ok(far.send && far.send.gain.value > WET.near, 'and wetter');
  assert.equal(far.send.outputs[0], e.reverb);
  e.play('cannon', { x: 10, z: 10 });
  const near = chain(e.ctx.started.at(-1));
  assert.equal(near.filter, undefined, 'one beside the camera is not filtered');
  e.play('click');
  const ui = chain(e.ctx.started.at(-1));
  assert.equal(ui.send, undefined, 'a button click has no reverb');
  assert.equal(ui.filter, undefined);
  const src = e.ctx.started.at(-1);
  src.onended();
  assert.ok(ui.gain.disconnected && ui.panner.disconnected, 'a finished voice lets go of its nodes');
});

test('the same sound started in the same instant stacks quieter, not louder and louder', () => {
  const win = fakeWindow({ full: true });
  const e = new SoundEngine({ win });
  win.listeners.pointerdown();
  const gains = [];
  for (let k = 0; k < 3; k++) { e.play('rifle'); gains.push(chain(e.ctx.started.at(-1)).gain.gain.value); }
  assert.equal(gains[0], VOICE_GAIN);
  assert.ok(gains[1] < gains[0] && gains[2] < gains[1], gains.join(' '));
  e.ctx.currentTime = 1;
  e.play('rifle');
  assert.equal(chain(e.ctx.started.at(-1)).gain.gain.value, VOICE_GAIN, 'a moment later it is back to full');
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
  const ids = ['cannon', 'mg', 'rifle', 'explosionSmall', 'rocket', 'hit', 'explosionMedium', 'explosionLarge', 'sandHit', 'debris', 'heavyCannon'];
  const buffers = Object.fromEntries(ids.map((id) => [id, Array.from({ length: variants(id) }, (_, v) => render(id, v))]));
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
    const bank = buffers[id], b = bank[Math.floor(next() * bank.length)];
    for (let i = 0; i < b.length && at + i < out.length; i++) out[at + i] += b[i] * VOICE_GAIN * 0.8;
    ends.push([at + b.length, id]);
  }
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(peak <= 1, `peak ${peak.toFixed(2)} before the limiter`);
});
