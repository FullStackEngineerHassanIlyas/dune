// The original sounds in play (spec §6 Original files): with the player's own clips switched on, the
// announcer strings the original's word clips into its lines and the engine plays the original effects;
// whatever they lack keeps this game's voice and synthesized sound. Made-up clips only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WebVoiceOutput, VoicePlayer, LEAD } from '../src/audio/voice.js';
import { SoundEngine } from '../src/audio/engine.js';
import { RATE } from '../src/audio/synth.js';
import { LINE_WORDS } from '../src/formats/dune2-sounds.js';
import { unitLineIds } from '../src/data/unit-voices.js';

const manifest = JSON.parse(readFileSync(new URL('../assets/voice/manifest.json', import.meta.url)));
const settle = () => new Promise((r) => setTimeout(r, 0));

/** Clips by name, each a different length so a line's length tells which words made it. */
function clips(names, rate = 11025) {
  return new Map(names.map((n, i) => [n, { rate, pcm: Uint8Array.from({ length: 1000 + 10 * i }, (_, k) => 128 + Math.round(40 * Math.sin(k / 4))) }]));
}
const len = (m, names) => names.reduce((s, n) => s + Math.round(m.get(n).pcm.length * RATE / m.get(n).rate), 0);

function fakeBrowser({ manifestOk = true } = {}) {
  const fetched = [];
  const fetchFn = async (url) => {
    fetched.push(url);
    if (url.endsWith('manifest.json')) return manifestOk ? { ok: true, json: async () => manifest } : { ok: false, status: 404 };
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  };
  class Node { constructor() { this.to = []; } connect(n) { this.to.push(n); return n; } }
  const started = [], made = [];
  const ctx = {
    createGain: () => Object.assign(new Node(), { gain: { value: 1 } }),
    createBufferSource: () => { const s = Object.assign(new Node(), { start: () => started.push(s), stop: () => {} }); return s; },
    decodeAudioData: (bytes, ok) => { const b = { duration: 1.2, kokoro: true }; ok?.(b); return Promise.resolve(b); },
    createBuffer: (channels, length, sampleRate) => { const b = { channels, length, sampleRate, duration: length / sampleRate, data: null, copyToChannel(d) { this.data = d.slice(); } }; made.push(b); return b; },
  };
  const sound = { ctx, master: new Node(), running: true, muted: false };
  return { fetchFn, fetched, sound, started, made };
}

const ATREIDES = ['ACONST', 'AATRE', 'AUNIT', 'ADEPLOY', 'AWARNING', 'AWORMY', 'ZAFFIRM', 'REPORT1'];

test('with the originals on, the announcer strings the house\'s word clips into its line, and the replies are the shared ones', async () => {
  const b = fakeBrowser(), m = clips(ATREIDES);
  const out = new WebVoiceOutput(b.sound, 'atreides', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: async () => m });
  await out.ready;
  assert.ok(out.live);
  assert.deepEqual(out.original.unitReady, ['AATRE', 'AUNIT', 'ADEPLOY']);
  assert.equal(out.status('unitReady'), 'loading');
  await out.load('unitReady');
  assert.equal(out.status('unitReady'), 'ready');
  const line = b.made.at(-1);
  assert.equal(line.sampleRate, RATE);
  assert.equal(line.length, len(m, ['AATRE', 'AUNIT', 'ADEPLOY']), '"Atreides" "unit" "deployed", back to back');
  assert.ok(Math.max(...line.data.map(Math.abs)) <= 0.97 + 1e-6);
  await out.load('affirmative');
  assert.equal(b.made.at(-1).length, len(m, ['ZAFFIRM']));
  assert.equal(b.fetched.length, 1, 'only the manifest was fetched: no pre-rendered line was needed');
  const p = new VoicePlayer({ output: out });
  p.say('wormsign', 0);
  p.update(0);
  p.update(LEAD);
  assert.equal(p.current, 'wormsign');
  assert.ok(Math.abs(b.started[0].buffer.duration - len(m, ['AWARNING', 'AWORMY']) / RATE) < 1e-9, '"Warning" "wormsign"');
});

test('a line the clips cannot make keeps the pre-rendered voice; so does a house whose announcer was not found', async () => {
  const b = fakeBrowser(), m = clips(ATREIDES);
  const out = new WebVoiceOutput(b.sound, 'atreides', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: async () => m });
  await out.ready;
  await out.load('radarOn');   // no RADAR, no ON among the clips
  assert.equal(out.buffers.get('radarOn').kokoro, true);
  await out.load('building');   // the original never said it
  assert.equal(out.buffers.get('building').kokoro, true);
  const h = new WebVoiceOutput(b.sound, 'harkonnen', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: async () => m });
  await h.ready;
  await h.load('constructionComplete');
  assert.equal(h.buffers.get('constructionComplete').kokoro, true, 'the Harkonnen keep their own voice');
  await h.load('reporting');
  assert.equal(h.buffers.get('reporting').kokoro, undefined, 'but answer with the shared original replies');
});

test('the originals alone are enough when the pre-rendered lines cannot be had', async () => {
  const b = fakeBrowser({ manifestOk: false }), m = clips(ATREIDES);
  const out = new WebVoiceOutput(b.sound, 'atreides', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: async () => m });
  await out.ready;
  assert.equal(out.live, true);
  assert.equal(out.has('constructionComplete'), true);
  assert.equal(out.has('building'), false);
  const check = await out.check();
  assert.equal(check.original, Object.keys(out.original).length);
  assert.equal(check.decoded, check.original);
});

test('switching the originals off or on applies at once: lines already made are let go', async () => {
  const b = fakeBrowser();
  let current = clips(ATREIDES);
  const out = new WebVoiceOutput(b.sound, 'atreides', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: async () => current });
  await out.ready;
  await out.load('constructionComplete');
  assert.equal(out.buffers.get('constructionComplete').kokoro, undefined);
  current = null;   // Options → Original Game Files → Off
  await out.originalsChanged();
  assert.equal(out.original, null);
  assert.equal(out.status('constructionComplete'), 'loading');
  await out.load('constructionComplete');
  assert.equal(out.buffers.get('constructionComplete').kokoro, true);
  current = clips(ATREIDES);
  await out.originalsChanged();
  await out.load('constructionComplete');
  assert.equal(out.buffers.get('constructionComplete').kokoro, undefined);
});

test('a slow answer for the clips loses to a later one, and a pre-rendered decode for an old source is dropped', async () => {
  const b = fakeBrowser();
  const answers = [];
  const out = new WebVoiceOutput(b.sound, 'atreides', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: () => new Promise((r) => answers.push(r)) });
  await settle();
  const first = out.originalsChanged();
  await settle();
  answers[1](clips(ATREIDES));
  answers[0](null);   // the very first request, answered last: stale
  await first;
  await out.ready;
  assert.ok(out.original?.constructionComplete, 'the newer answer stands');
  const kokoro = out.load('radarOn');
  out.useOriginals(null);
  await kokoro;
  assert.equal(out.buffers.has('radarOn'), false, 'decoded for the old source: not kept');
});

test('no originals asked for: the voice is what it was', async () => {
  const b = fakeBrowser();
  const out = new WebVoiceOutput(b.sound, 'ordos', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: null });
  await out.ready;
  assert.equal(out.original, null);
  await out.loadOriginals();
  assert.equal(out.original, null);
  const broken = new WebVoiceOutput(b.sound, 'ordos', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: async () => { throw new Error('storage gone'); } });
  await broken.ready;
  assert.equal(broken.live, true, 'a failing store leaves the pre-rendered voice working');
});

test('every mapped line is spoken once all its words are there, for each playable house', async () => {
  for (const [house, letter, own] of [['atreides', 'A', 'ATRE'], ['harkonnen', 'H', 'HARK'], ['ordos', 'O', 'ORDOS']]) {
    const words = new Set(Object.values(LINE_WORDS).flat().map((w) => (w === '*' ? own : w)));
    const b = fakeBrowser(), m = clips([...words].map((w) => letter + w));
    const out = new WebVoiceOutput(b.sound, house, { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: async () => m });
    await out.ready;
    assert.deepEqual(Object.keys(out.original).sort(), Object.keys(LINE_WORDS).sort(), house);
  }
});

test('with the original replies there, every kind of unit answers with them: no line of ours is mixed in, and one clip is made once', async () => {
  const b = fakeBrowser(), m = clips(['ZREPORT1', 'ZREPORT2', 'ZREPORT3', 'ZAFFIRM', 'ZOVEROUT', 'ZMOVEOUT']);
  const out = new WebVoiceOutput(b.sound, 'harkonnen', { base: 'http://x/assets/voice/', fetchFn: b.fetchFn, originals: async () => m });
  await out.ready;
  for (const id of unitLineIds()) assert.ok(out.original[id], `${id} is the original's`);
  await out.load('unit.tanker.select.1');
  await out.load('unit.harvester.select.2');
  await out.load('unit.grunt.select.1');
  assert.equal(out.buffers.get('unit.tanker.select.1'), out.buffers.get('unit.harvester.select.2'), 'both REPORT2: one buffer');
  assert.notEqual(out.buffers.get('unit.tanker.select.1'), out.buffers.get('unit.grunt.select.1'), 'a man on foot: REPORT1');
  assert.equal(b.made.length, 2);
  assert.equal(b.fetched.length, 1, 'only the manifest');
});

// ——— the effects ———

function fakeWindow() {
  const win = { addEventListener() {}, removeEventListener() {} };
  class Node { constructor() { this.outputs = []; } connect(n) { this.outputs.push(n); return n; } disconnect() {} }
  win.AudioContext = class {
    constructor() { this.destination = new Node(); this.started = []; this.state = 'running'; }
    createGain() { return Object.assign(new Node(), { gain: { value: 1 } }); }
    createStereoPanner() { return Object.assign(new Node(), { pan: { value: 0 } }); }
    createBuffer(channels, length, sampleRate) { return { numberOfChannels: channels, length, sampleRate, copyToChannel(d) { this.data = d; } }; }
    createBufferSource() { const s = Object.assign(new Node(), { playbackRate: { value: 1 }, start: () => this.started.push(s) }); return s; }
    resume() { return Promise.resolve(); }
  };
  return win;
}

test('with the originals on, the engine plays the original effect for a mapped sound and its own for the rest', async () => {
  const cannon = Float32Array.from({ length: 900 }, (_, i) => Math.sin(i) * 0.5);
  const e = new SoundEngine({ win: fakeWindow(), random: () => 0.5, originals: async () => ({ cannon: [cannon] }) });
  await settle();
  e.unlock();
  assert.equal(e.override.get('cannon')[0].length, 900, 'made into a buffer as the context opens');
  assert.equal(e.override.get('cannon')[0].sampleRate, RATE);
  assert.ok(e.play('cannon'));
  assert.equal(e.ctx.started.at(-1).buffer.data, cannon);
  assert.ok(e.play('rifle'));
  assert.notEqual(e.ctx.started.at(-1).buffer.data, cannon);
  assert.ok(e.buffers.get('rifle').includes(e.ctx.started.at(-1).buffer), 'the synthesized rifle');
});

test('the originals switched on or off mid-battle swap the effects at once', async () => {
  let current = null;
  const e = new SoundEngine({ win: fakeWindow(), originals: async () => current });
  await settle();
  e.unlock();
  assert.equal(e.override.size, 0);
  current = { explosionSmall: [new Float32Array(300)], rifle: [new Float32Array(100), new Float32Array(120)] };
  await e.originalsChanged();
  assert.equal(e.override.get('rifle').length, 2, 'variations, when the files hold several');
  e.play('explosionSmall');
  assert.equal(e.ctx.started.at(-1).buffer.length, 300);
  current = null;
  await e.originalsChanged();
  assert.equal(e.override.size, 0);
  e.play('explosionSmall');
  assert.ok(e.buffers.get('explosionSmall').includes(e.ctx.started.at(-1).buffer));
});

test('an engine without Web Audio, or told not to, never asks for the originals', async () => {
  let asked = 0;
  new SoundEngine({ win: {}, originals: async () => { asked++; return null; } });
  const off = new SoundEngine({ win: fakeWindow(), originals: null });
  await settle();
  assert.equal(asked, 0);
  assert.equal(await off.loadOriginals(), null);
  const failing = new SoundEngine({ win: fakeWindow(), originals: async () => { throw new Error('gone'); } });
  await settle();
  assert.equal(failing.originalSamples, null, 'a failing store leaves the synthesized effects');
});
