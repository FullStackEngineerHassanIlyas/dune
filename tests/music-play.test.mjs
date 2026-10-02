import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld } from './helpers.mjs';
import { MusicDirector, Shuffle, threatNear, CALM, MIN_BATTLE, NEAR_BASE } from '../src/audio/music/director.js';
import { Conductor, BattleMusic, MenuMusic, musicVolume, loadPlaylist, DUCK, DEFAULT_VOLUME } from '../src/audio/music/music.js';
import { MusicOutput } from '../src/audio/music/output.js';
import { MusicMixer, BLOCK } from '../src/audio/music/mixer.js';
import { POOLS, TRACKS } from '../src/audio/music/songs/index.js';

// ——— Web Audio stand-ins: they record what the music does with them ———

class Node {
  constructor() { this.outputs = []; this.disconnected = false; }
  connect(n) { this.outputs.push(n); return n; }
  disconnect() { this.disconnected = true; }
}
const param = (v) => ({ value: v, setTargetAtTime(to) { this.value = to; } });

function fakeWindow({ worklet = true, worker = false } = {}) {
  const win = { listeners: {}, timers: [], nodes: [], workers: [], elements: [], urls: 0 };
  win.addEventListener = (t, fn) => { (win.listeners[t] ??= []).push(fn); };
  win.removeEventListener = (t, fn) => { win.listeners[t] = (win.listeners[t] ?? []).filter((f) => f !== fn); };
  win.timeouts = [];
  win.setTimeout = (fn) => { win.timeouts.push(fn); return win.timeouts.length; };
  win.flush = () => { for (const fn of win.timeouts.splice(0)) fn(); };
  win.setInterval = (fn) => { win.timers.push(fn); return win.timers.length; };
  win.clearInterval = () => {};
  win.URL = { createObjectURL: () => `blob:${++win.urls}`, revokeObjectURL() {} };
  win.Blob = class { constructor(parts, opts) { this.parts = parts; this.type = opts?.type; } };
  win.Audio = class {
    constructor() { this.paused = true; this.src = ''; win.elements.push(this); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute(a) { if (a === 'src') this.src = ''; }
  };
  class Ctx {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 48000; this.destination = new Node(); this.started = []; if (worklet) this.audioWorklet = { modules: [], addModule: async (url) => { this.audioWorklet.modules.push(String(url)); } }; }
    createGain() { return Object.assign(new Node(), { gain: param(1) }); }
    createDynamicsCompressor() { return Object.assign(new Node(), { threshold: param(0), knee: param(0), ratio: param(1), attack: param(0), release: param(0) }); }
    createMediaElementSource(el) { return Object.assign(new Node(), { el }); }
    createBuffer(ch, length, rate) { return { length, rate, data: [], copyToChannel(d, c) { this.data[c] = d; } }; }
    createBufferSource() { const s = Object.assign(new Node(), { start: (t) => { s.at = t; this.started.push(s); } }); return s; }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    resume() { this.state = 'running'; return Promise.resolve(); }
  }
  win.AudioContext = Ctx;
  if (worklet) {
    win.AudioWorkletNode = class extends Node {
      constructor(ctx, name, opts) { super(); Object.assign(this, { ctx, name, opts, sent: [] }); this.port = { postMessage: (m) => this.sent.push(structuredClone(m)), onmessage: null }; win.nodes.push(this); }
    };
  }
  if (worker) {
    // runs the real mixer, synchronously, as worker.js does
    win.Worker = class {
      constructor(url) { this.url = String(url); this.terminated = false; this.mixer = null; this.asks = []; win.workers.push(this); }
      postMessage(data) {
        if (data.init) { this.mixer = new MusicMixer({ rate: data.rate, onEvent: (e) => this.onmessage({ data: { event: e } }) }); return; }
        if (data.want) {
          this.asks.push(data.want);
          for (let i = 0; i < data.want && this.mixer.active; i++) { const L = new Float32Array(BLOCK), R = new Float32Array(BLOCK); this.mixer.render(L, R, BLOCK); this.onmessage({ data: { L, R } }); }
          this.onmessage({ data: { done: true } });
          return;
        }
        this.mixer.command(data);
      }
      terminate() { this.terminated = true; }
    };
  }
  return win;
}

/** The battle's SoundEngine as the music sees it: a context, a master, and whether a line is being spoken. */
function fakeEngine(win) {
  const ctx = new win.AudioContext();
  return { ctx, master: ctx.createGain(), ducked: false };
}

const settle = () => new Promise((r) => setImmediate(r));
const sent = (win) => win.nodes.flatMap((n) => n.sent);
const plays = (win) => sent(win).filter((c) => c.cmd === 'play');

// ——— the director ———

test('a battle turns to battle music when the player\'s forces fight, and back to peace after a calm spell', () => {
  const d = new MusicDirector({ house: 'atreides' });
  assert.equal(d.update(0), 'peace');
  d.onEvent({ type: 'fired', house: 'harkonnen' }, 1);
  d.onEvent({ type: 'damaged', house: 'harkonnen', by: 'ordos' }, 1);
  assert.equal(d.update(1), 'peace', 'other houses fighting each other is not the player\'s battle');
  d.onEvent({ type: 'damaged', house: 'atreides', by: 'harkonnen' }, 10);
  assert.equal(d.update(10), 'battle');
  d.onEvent({ type: 'fired', house: 'atreides' }, 20);
  assert.equal(d.update(20 + CALM - 1), 'battle', 'still fighting a moment ago');
  assert.equal(d.update(20 + CALM), 'peace', 'a calm spell after the last shot');
  d.onEvent({ type: 'fired', house: 'atreides' }, 100);
  assert.equal(d.update(100 + CALM), 'battle', 'a short skirmish keeps its battle track a while');
  assert.equal(d.update(100 + MIN_BATTLE), 'peace');
  d.onEvent({ type: 'unitDestroyed', house: 'atreides', by: 'ordos' }, 200);
  assert.equal(d.update(200), 'battle');
  d.onEvent({ type: 'gameOver', winner: 'atreides' }, 210);
  assert.equal(d.update(400), 'over', 'decided: the music stops');
  d.end(true);
  assert.equal(d.update(401), 'victory');
  d.end(false);
  assert.equal(d.mood, 'defeat');
});

test('an enemy or a worm in the player\'s sight near their base or units is a threat; far, hidden or freight is not', () => {
  const world = flatWorld(64, 64, G.ROCK);
  world.fogOfWar = false;
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  assert.equal(threatNear(world, 'atreides'), false);
  const far = world.spawnUnit('trike', 'harkonnen', 4 + 2 + NEAR_BASE + 4, 5);
  assert.equal(threatNear(world, 'atreides'), false, 'too far from the base');
  world.spawnUnit('carryall', 'harkonnen', 8, 8);
  assert.equal(threatNear(world, 'atreides'), false, 'flying freight is not an attack');
  world.spawnUnit('trike', 'atreides', far.x - 5, far.y);
  assert.equal(threatNear(world, 'atreides'), true, 'close to one of the player\'s units');
  world.fogOfWar = true;   // nothing in sight: the player cannot see it
  world.houses.get('atreides').fog = { w: 64, visible: new Uint8Array(64 * 64) };
  assert.equal(threatNear(world, 'atreides'), false);
  world.fogOfWar = false;
  const w2 = flatWorld(64, 64, G.SAND);
  w2.fogOfWar = false;
  w2.spawnUnit('harvester', 'ordos', 30, 30);
  w2.spawnUnit('sandworm', 'harkonnen', 33, 30);   // a worm counts whoever it belongs to in the tables
  assert.equal(threatNear(w2, 'ordos'), true);
});

test('shuffled picks never repeat a track twice running', () => {
  let i = 0;
  const seq = [0, 0, 0.5, 0.9, 0.1, 0.1, 0.6];
  const s = new Shuffle(() => seq[i++ % seq.length]);
  let last = null;
  for (let k = 0; k < 20; k++) { const p = s.pick('peace', POOLS.peace); assert.notEqual(p, last); last = p; }
  assert.equal(s.pick('menu', ['title']), 'title');
  assert.equal(s.pick('menu', ['title']), 'title', 'a pool of one plays its one track');
});

// ——— the conductor and the battle's music ———

test('music waits for the game\'s audio, then plays through the master at musicVolume (0.5 when unset), live', async () => {
  const win = fakeWindow(), settings = {}, audio = { ctx: null, master: null };
  const c = new Conductor({ audio, settings, win, importer: async () => { throw new Error('no module yet'); } });
  c.want('menu');
  await c.ready;
  c.update();
  assert.equal(win.nodes.length, 0, 'no context before the first gesture: nothing made');
  Object.assign(audio, fakeEngine(win));
  c.update();
  await settle();
  assert.equal(win.nodes.length, 1);
  assert.ok(audio.ctx.audioWorklet.modules[0].endsWith('/src/audio/music/worklet.js'));
  assert.equal(win.nodes[0].name, 'dune-music');
  assert.deepEqual(win.nodes[0].opts.outputChannelCount, [2]);
  assert.deepEqual(plays(win).map((p) => [p.id, p.passes]), [['title', 0]], 'the title, looping');
  const gain = c.output.gain;
  assert.equal(win.nodes[0].outputs[0], gain);
  assert.equal(gain.outputs[0], audio.master, 'through the game\'s master (M, master volume)');
  assert.equal(gain.gain.value, DEFAULT_VOLUME);
  settings.musicVolume = 0.2;
  c.update();
  assert.equal(gain.gain.value, 0.2, 'applied live');
  assert.equal(musicVolume({ musicVolume: 'x' }), DEFAULT_VOLUME);
  assert.equal(musicVolume({ musicVolume: 3 }), 1);
});

test('music volume 0 is silent and not running: the synth goes, and comes back with the mood when raised', async () => {
  const win = fakeWindow(), audio = fakeEngine(win), settings = { musicVolume: 0.6 };
  const c = new Conductor({ audio, settings, win, importer: async () => ({ playlistTracks: async () => [] }) });
  c.want('peace');
  await c.ready;
  c.update();
  await settle();
  const first = win.nodes[0];
  assert.ok(first && plays(win).length === 1 && POOLS.peace.includes(plays(win)[0].id));
  assert.ok(first.sent.some((m) => m.cmd === 'next'), 'the next peace track is queued behind it');
  settings.musicVolume = 0;
  c.update();
  assert.ok(first.sent.some((m) => m.cmd === 'dispose') && first.disconnected, 'the worklet is taken down');
  assert.equal(c.output.synthUp, false);
  c.update();
  assert.equal(win.nodes.length, 1, 'and stays down');
  settings.musicVolume = 0.4;
  c.update();
  await settle();
  assert.equal(win.nodes.length, 2);
  assert.ok(win.nodes[1].sent.some((m) => m.cmd === 'play' && POOLS.peace.includes(m.id)), 'the peace music is back');
});

test('a muted game (M, Sound off) holds the synth where it is, rendering nothing, and lets it go on unmuted', async () => {
  const win = fakeWindow(), audio = Object.assign(fakeEngine(win), { muted: true });
  const c = new Conductor({ audio, settings: {}, win, importer: async () => ({}) });
  c.want('peace');
  await c.ready;
  c.update();
  await settle();
  const holds = () => win.nodes[0].sent.filter((m) => m.cmd === 'hold').map((m) => m.on);
  assert.deepEqual(holds(), [true]);
  c.update();
  assert.deepEqual(holds(), [true], 'said once');
  audio.muted = false;
  c.update();
  assert.deepEqual(holds(), [true, false]);
  assert.equal(sent(win).filter((m) => m.cmd === 'play').length, 1, 'the same track carries on: no new start');
  const m = new MusicMixer({ rate: 16000 });
  m.play('title');
  m.command({ cmd: 'hold', on: true });
  assert.equal(m.active, false, 'the worklet skips a held mixer');
  m.command({ cmd: 'hold', on: false });
  assert.equal(m.active, true);
});

test('the player\'s own playlists take over their moods; empty or missing ones leave the FM music', async () => {
  const peaceFile = { name: 'my-peace.ogg', type: 'audio/ogg', data: new ArrayBuffer(8) };
  const asked = [];
  const importer = async () => ({ playlistTracks: async (name) => { asked.push(name); return name === 'peace' ? [peaceFile] : []; } });
  const win = fakeWindow(), audio = fakeEngine(win);
  const c = new Conductor({ audio, settings: {}, win, importer });
  await c.ready;
  assert.deepEqual(asked.sort(), ['battle', 'menu', 'peace']);
  assert.equal(await loadPlaylist('peace', async () => { throw new Error('missing'); }).then((l) => l.length), 0);
  assert.equal(await loadPlaylist('peace', async () => ({})).then((l) => l.length), 0, 'a module without the function');
  c.want('peace');
  c.update();
  await settle();
  assert.equal(win.elements.length, 1, 'the player\'s file plays');
  assert.equal(win.elements[0].paused, false);
  assert.equal(plays(win).length, 0, 'not the FM pool');
  c.setPaused(true);
  assert.equal(win.elements[0].paused, true, 'a file pauses with the game');
  c.setPaused(false);
  win.elements[0].onended();
  assert.equal(win.elements.length, 2, 'when it ends the next one plays (the same, in a list of one)');
  c.want('battle');
  c.update();
  assert.ok(POOLS.battle.includes(plays(win).at(-1).id), 'no battle playlist: the FM battle music');
  win.flush();
  assert.ok(win.elements[1].paused, 'the file faded out and stopped');
});

test('a queued FM track that starts queues the one after it; a mood change replaces the queue', async () => {
  const win = fakeWindow(), audio = fakeEngine(win);
  const c = new Conductor({ audio, settings: {}, win, rng: () => 0.3, importer: async () => ({}) });
  c.want('battle');
  await c.ready;
  c.update();
  await settle();
  const node = win.nodes[0], next = node.sent.find((m) => m.cmd === 'next');
  assert.ok(next && next.id !== plays(win)[0].id && next.passes === TRACKS[next.id].passes);
  node.port.onmessage({ data: { type: 'started', id: next.id } });
  const nexts = node.sent.filter((m) => m.cmd === 'next');
  assert.equal(nexts.length, 2);
  assert.notEqual(nexts[1].id, next.id);
  node.port.onmessage({ data: { type: 'load', share: 0.021 } });
  assert.equal(c.debug().load, 0.021);
  assert.equal(c.debug().track, next.id);
});

test('a battle: peace, battle on contact, silence when decided, then victory; ducked under the announcer', async () => {
  const world = flatWorld(48, 48, G.ROCK);
  world.fogOfWar = false;
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  const win = fakeWindow(), engine = fakeEngine(win), settings = { musicVolume: 0.5 };
  const m = new BattleMusic({ world, house: 'atreides', engine, settings, win, importer: async () => ({}) });
  await m.conductor.ready;
  m.frame();
  await settle();
  const last = () => sent(win).filter((c) => c.cmd === 'play' || c.cmd === 'stop').at(-1);
  assert.ok(POOLS.peace.includes(last().id));
  m.onEvent({ type: 'damaged', house: 'atreides', by: 'harkonnen' });
  m.frame();
  assert.ok(POOLS.battle.includes(last().id), 'the battle pool takes over');
  assert.equal(last().fade, 1.2);
  engine.ducked = true;
  m.frame();
  assert.ok(Math.abs(m.conductor.output.gain.gain.value - 0.5 * DUCK) < 1e-9, 'under an announcer line');
  engine.ducked = false;
  for (let i = 0; i < 20 * (CALM + MIN_BATTLE + 1); i++) world.time += 0.05;   // time passes without a shot
  m.frame();
  assert.ok(POOLS.peace.includes(last().id), 'peace again after the calm spell');
  assert.ok(last().wait > 0 && last().fadeIn > 0, 'and it comes in gently');
  world.spawnUnit('trike', 'harkonnen', 9, 9);
  world.time += 1;
  m.frame();
  assert.ok(POOLS.battle.includes(last().id), 'an enemy seen near the base is enough, as in the original');
  m.onEvent({ type: 'gameOver', winner: 'atreides' });
  m.frame();
  assert.equal(last().cmd, 'stop');
  m.end(true);
  assert.equal(last().id, 'victory');
  assert.equal(last().passes, 1, 'once through on the result screen, then it rings out');
});

test('without an AudioWorklet the mixer renders ahead in a worker, a fraction of a second queued, gapless', async () => {
  const win = fakeWindow({ worklet: false, worker: true }), audio = fakeEngine(win);
  const out = new MusicOutput({ audio, win });
  out.open();
  await settle();
  const w = win.workers[0];
  assert.ok(w && w.url.endsWith('/src/audio/music/worker.js'));
  out.send({ cmd: 'play', id: 'title' });
  win.timers[0]();   // the pump
  const started = audio.ctx.started;
  assert.ok(started.length >= 1);
  for (let i = 1; i < started.length; i++) assert.ok(Math.abs(started[i].at - (started[i - 1].at + BLOCK / 48000)) < 1e-9, 'each block right after the last');
  assert.ok(started.at(-1).at + BLOCK / 48000 >= 0.4, 'about 0.4 s queued');
  const n = started.length;
  win.timers[0]();
  assert.equal(started.length, n, 'nothing more while that much is queued');
  audio.ctx.currentTime = 0.3;
  audio.ctx.state = 'suspended';
  win.timers[0]();
  assert.equal(started.length, n, 'the game paused: nothing asked for');
  audio.ctx.state = 'running';
  win.timers[0]();
  assert.ok(started.length > n, 'topped up');
  out.release();
  assert.equal(w.terminated, true);
});

test('the menu plays the title after the first gesture, fades it out behind a battle and starts it again after', async () => {
  const win = fakeWindow();
  win.document = { hidden: false, addEventListener: (t, fn) => { win.onVisibility = fn; } };
  const settings = { sound: true, volume: 0.8 };
  const menu = new MenuMusic({ settings, win, importer: async () => ({}) });
  await menu.conductor.ready;
  menu.update();
  assert.equal(win.nodes.length, 0, 'silent until a click or key');
  win.listeners.pointerdown[0]();
  menu.update();
  await settle();
  assert.equal(plays(win)[0].id, 'title');
  assert.equal(menu.audio.master.gain.value, 0.8, 'the Options volume');
  settings.sound = false;
  menu.update();
  assert.equal(menu.audio.master.gain.value, 0, 'Sound off silences it');
  assert.equal(sent(win).at(-1).cmd, 'hold', 'and the synth rests');
  settings.sound = true;
  const before = sent(win).length;
  menu.leave();
  assert.ok(sent(win).slice(before).some((m) => m.cmd === 'stop'), 'the title fades out');
  win.flush();
  assert.equal(menu.audio.ctx.state, 'suspended', 'resting behind the battle once the title has faded');
  menu.enter();
  assert.equal(menu.audio.ctx.state, 'running');
  assert.deepEqual(plays(win).map((p) => p.id), ['title', 'title'], 'from its start again');
  menu.briefing('ordos');
  assert.equal(plays(win).at(-1).id, 'ordos');
  win.document.hidden = true;
  win.onVisibility();
  assert.equal(menu.audio.ctx.state, 'suspended', 'a hidden page is silent');
  const preview = new MenuMusic({ settings, win: fakeWindow(), track: 'iron' });
  assert.deepEqual(preview.conductor.pools.menu, ['iron'], '?music= picks the track the menu plays');
});

// ——— review fixes ———

test('an enemy that only stays in sight near the base starts one battle, not an endless one; a new one starts another', async () => {
  const world = flatWorld(48, 48, G.ROCK);
  world.fogOfWar = false;   // everything in view, as explored ground stays in shroud mode
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  const m = new BattleMusic({ world, house: 'atreides', engine: { ctx: null, master: null }, settings: {}, win: null, importer: async () => ({}) });
  world.spawnUnit('harvester', 'harkonnen', 12, 5);   // parked at work by the base for good, never firing
  const moods = [];
  for (let i = 0; i < 20 * 300; i++) { world.time += 0.05; m.frame(); if (world.time > 2 * (CALM + MIN_BATTLE)) moods.push(m.director.mood); }
  assert.equal(moods.length > 0 && moods.every((x) => x === 'peace'), true, 'peace again after the calm spell, though it is still there');
  world.spawnUnit('trike', 'harkonnen', 9, 9);
  world.time += 1;
  m.frame();
  assert.equal(m.director.mood, 'battle', 'another enemy coming near is a new battle');
});

test('playlists the player changes while the music plays are read again: on the way back to the menu, or when the store says so', async () => {
  const assigned = { menu: [] };
  let follower = null;
  const importer = async () => ({ playlistTracks: async (name) => assigned[name] ?? [], follow: (t) => { follower = t; } });
  const win = fakeWindow();
  win.document = { hidden: false, addEventListener() {} };
  const menu = new MenuMusic({ settings: { sound: true, volume: 0.8 }, win, importer });
  await menu.conductor.ready;
  win.listeners.pointerdown[0]();
  menu.update();
  await settle();
  assert.equal(menu.debug().track, 'title');
  assigned.menu = [{ name: 'my-menu.ogg', type: 'audio/ogg', data: new ArrayBuffer(8) }];
  menu.enter();
  await settle();
  assert.equal(win.elements.length, 1, 'back on the menu, the player\'s menu file takes over the title');
  assert.equal(win.elements[0].paused, false);
  assert.ok(follower === menu.conductor, 'the music follows the store');
  follower.originalsChanged();
  await settle();
  assert.equal(win.elements.length, 1, 'the same list again: the file plays on, not restarted');
  assigned.menu = [];
  follower.originalsChanged();
  await settle();
  assert.equal(menu.debug().track, 'title', 'the list emptied: the title again');
  win.flush();
  assert.equal(win.elements[0].paused, true);
});

test('a player\'s file rests with the music: on a hidden menu page, and a new one starting while muted', async () => {
  const file = (name) => ({ name, type: 'audio/ogg', data: new ArrayBuffer(8) });
  const win = fakeWindow();
  win.document = { hidden: false, addEventListener: (t, fn) => { win.onVisibility = fn; } };
  const menu = new MenuMusic({ settings: { sound: true, volume: 0.8 }, win, importer: async () => ({ playlistTracks: async (n) => (n === 'menu' ? [file('m.ogg')] : []) }) });
  await menu.conductor.ready;
  win.listeners.pointerdown[0]();
  menu.update();
  await settle();
  assert.equal(win.elements[0].paused, false);
  win.document.hidden = true;
  win.onVisibility();
  assert.equal(menu.audio.ctx.state, 'suspended');
  assert.equal(win.elements[0].paused, true, 'a suspended context does not stop a media element: it is paused too');
  win.document.hidden = false;
  win.onVisibility();
  assert.equal(win.elements[0].paused, false);
  const w2 = fakeWindow(), audio = Object.assign(fakeEngine(w2), { muted: false });
  const c = new Conductor({ audio, settings: {}, win: w2, importer: async () => ({ playlistTracks: async (n) => [file(`${n}.ogg`)] }) });
  await c.ready;
  c.want('peace'); c.update(); await settle();
  audio.muted = true; c.update();
  assert.equal(w2.elements[0].paused, true);
  c.want('battle'); c.update(); await settle();
  assert.equal(w2.elements.at(-1).paused, true, 'muted: the battle file waits too');
  audio.muted = false; c.update();
  assert.equal(w2.elements.at(-1).paused, false);
});

test('the result screen: victory or defeat play once through and ring out; a draw stays silent', async () => {
  const world = flatWorld(32, 32, G.ROCK);
  const win = fakeWindow(), engine = fakeEngine(win);
  const m = new BattleMusic({ world, house: 'atreides', engine, settings: {}, win, importer: async () => ({}) });
  await m.conductor.ready;
  m.frame();
  await settle();
  m.onEvent({ type: 'gameOver', winner: null });
  m.end(false, true);
  assert.equal(m.director.mood, 'over', 'a draw is not a defeat');
  assert.equal(sent(win).at(-1).cmd, 'stop');
  m.end(false);
  const p = plays(win).at(-1);
  assert.deepEqual([p.id, p.passes], ['defeat', 1], 'once through, so it does not loop on behind "Keep watching"');
  win.nodes[0].port.onmessage({ data: { type: 'ended', id: 'defeat' } });
  assert.equal(m.debug().track, null, 'rung out: nothing playing');
});

test('the debug meter reads the music on its first call (the analyser gets a moment to fill)', async () => {
  const win = fakeWindow(), audio = fakeEngine(win);
  let filled = false;
  audio.ctx.createAnalyser = () => Object.assign(new Node(), { fftSize: 0, getFloatTimeDomainData(a) { a.fill(filled ? 0.1 : 0); } });
  const out = new MusicOutput({ audio, win });
  assert.equal(await out.meter(), null, 'nothing to read before the gain exists');
  out.open();
  const level = out.meter();
  filled = true;   // the audio thread runs while the meter waits
  win.flush();
  assert.ok(Math.abs((await level) - -20) < 0.01, `first reading ${await level}`);
});

test('the menu\'s own context rests at music volume 0 and with Sound off, and wakes when the music comes back', async () => {
  const win = fakeWindow();
  win.document = { hidden: false, addEventListener() {} };
  const settings = { sound: true, volume: 0.8, musicVolume: 0.5 };
  const menu = new MenuMusic({ settings, win, importer: async () => ({}) });
  await menu.conductor.ready;
  win.listeners.pointerdown[0]();
  menu.update();
  await settle();
  assert.equal(menu.audio.ctx.state, 'running');
  settings.musicVolume = 0;
  menu.update();
  assert.equal(menu.audio.ctx.state, 'suspended', 'music volume 0: the compressor and gain stop too');
  settings.musicVolume = 0.5;
  menu.update();
  assert.equal(menu.audio.ctx.state, 'running');
  settings.sound = false;
  menu.update();
  assert.equal(menu.audio.ctx.state, 'suspended', 'Sound off');
  settings.sound = true;
  menu.update();
  assert.equal(menu.audio.ctx.state, 'running');
});
