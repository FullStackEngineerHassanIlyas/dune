// The player's Mega Drive files on the music's synth (spec §6 Music, contract C8): the mixer registers VGM data and
// plays it like a track, to the sample; a VGM that will not play says so and the conductor moves on; the page
// loads the VGM player into the worklet only once one is to play, and sends the data again to a new synth.
// The VGM player itself is the vgm stream's (src/audio/music/vgm-deck.js): a stand-in with its shape plays here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicMixer } from '../src/audio/music/mixer.js';
import { MusicOutput, vgmId } from '../src/audio/music/output.js';
import { Conductor } from '../src/audio/music/music.js';
import { fakeWindow, fakeEngine, fakeVgmDeck, fakeStore, vgmFile, userVgm, userOgg, settle, sent, plays } from './music-fakes.mjs';

test('the mixer plays a registered VGM like a track: crossfades, passes, and the next one queued to the sample', () => {
  const made = [], events = [];
  const m = new MusicMixer({ rate: 1000, VgmDeck: fakeVgmDeck({ samples: 300, made }), onEvent: (e) => events.push(e) });
  m.command({ cmd: 'vgm', id: 'vgm:1', data: vgmFile().buffer });
  m.command({ cmd: 'vgm', id: 'vgm:2', data: vgmFile({ track: 'Credit Roll' }) });   // a Uint8Array does as well
  assert.deepEqual(made.map((d) => [d.id, d.pos]), [['vgm:1:warm', 64 * 128]], 'the first one registered while nothing plays warms the player up');
  made.length = 0;
  m.command({ cmd: 'play', id: 'vgm:1', passes: 2 });
  m.command({ cmd: 'next', id: 'vgm:2', passes: 1 });
  assert.equal(made.length, 1);
  assert.ok(made[0].id === 'vgm:1' && made[0].rate === 1000 && made[0].passes === 2);
  const L = new Float32Array(128), R = new Float32Array(128);
  let rendered = 0;
  while (made.length < 2 && rendered < 2000) { m.render(L, R, 128); rendered += 128; }
  assert.equal(made.length, 2, 'the queued VGM started');
  const ended = events.find((e) => e.type === 'ended'), started = events.filter((e) => e.type === 'started');
  assert.deepEqual(started.map((e) => e.id), ['vgm:1', 'vgm:2']);
  assert.ok(Math.abs(ended.time - 0.6) < 1e-9 && Math.abs(started[1].time - 0.6) < 1e-9, 'on the very sample the first one finished its two passes');
  assert.deepEqual(events.filter((e) => e.type === 'pass').map((e) => [e.id, e.n]), [['vgm:1', 1], ['vgm:1', 2]]);
  m.command({ cmd: 'play', id: 'title', fade: 0.5 });
  assert.equal(made[1].fadeTo, 0, 'a new track fades the VGM out like any deck');
  m.command({ cmd: 'vgm', id: 'vgm:1' });
  assert.equal(m.vgms.has('vgm:1'), false, 'no data forgets it');
});

test('a VGM that will not read, or breaks while playing, is reported and dropped; the audio thread never throws', () => {
  const events = [];
  const m = new MusicMixer({ rate: 1000, VgmDeck: fakeVgmDeck(), onEvent: (e) => events.push(e) });
  m.command({ cmd: 'vgm', id: 'vgm:bad', data: vgmFile({ bad: true }).buffer });
  m.command({ cmd: 'play', id: 'vgm:bad' });
  assert.deepEqual(events.map((e) => [e.type, e.id]), [['error', 'vgm:bad']]);
  assert.equal(m.active, false, 'nothing plays');
  const m2 = new MusicMixer({ rate: 1000, VgmDeck: fakeVgmDeck({ renderThrows: true }), onEvent: (e) => events.push(e) });
  m2.command({ cmd: 'vgm', id: 'vgm:3', data: vgmFile().buffer });
  m2.command({ cmd: 'play', id: 'vgm:3' });
  assert.doesNotThrow(() => m2.render(new Float32Array(128), new Float32Array(128), 128));
  assert.deepEqual(events.at(-1), { type: 'error', id: 'vgm:3', message: 'broken' });
  assert.equal(m2.active, false);
  const m4 = new MusicMixer({ rate: 1000, VgmDeck: fakeVgmDeck({ breaks: true }), onEvent: (e) => events.push(e) });
  m4.command({ cmd: 'vgm', id: 'vgm:5', data: vgmFile().buffer });
  m4.command({ cmd: 'play', id: 'vgm:5' });
  m4.command({ cmd: 'next', id: 'title' });
  m4.render(new Float32Array(128), new Float32Array(128), 128);
  assert.deepEqual(events.slice(-1), [{ type: 'error', id: 'vgm:5', message: 'broken' }], 'stopped with its error set: an error, not an end');
  assert.equal(m4.active, false, 'and nothing queued behind it starts');
  const m3 = new MusicMixer({ rate: 1000, onEvent: (e) => events.push(e) });
  m3.command({ cmd: 'vgm', id: 'vgm:4', data: vgmFile().buffer });
  m3.command({ cmd: 'play', id: 'vgm:4' });
  assert.equal(events.at(-1).message, 'no VGM player', 'no player loaded: an error, not a crash');
  globalThis.duneVgmDeck = fakeVgmDeck();
  try {
    m3.command({ cmd: 'play', id: 'vgm:4' });
    assert.equal(m3.active, true, 'the player put on the global scope (the worklet\'s, by output.js) is found there');
  } finally { delete globalThis.duneVgmDeck; }
});

test('the page sends a VGM\'s data once per synth, after the VGM player is loaded into the worklet; a new synth gets it again', async () => {
  const win = fakeWindow(), audio = fakeEngine(win), out = new MusicOutput({ audio, win });
  out.open();
  await settle();
  const file = userVgm(7);
  assert.equal(vgmId(file), 'vgm:7', 'the store\'s key names it');
  out.send({ cmd: 'play', id: 'title' });
  out.playVgm(file, { fade: 1, passes: 0 });
  out.queueVgm(file, 2);
  out.send({ cmd: 'stop', fade: 1 });
  const node = win.nodes[0], modules = audio.ctx.audioWorklet.modules;
  assert.deepEqual(node.sent.map((m) => m.cmd), ['play'], 'held back while the VGM player loads');
  assert.equal(modules.length, 2);
  assert.match(modules[1], /^blob:/);
  assert.match(win.blobs.at(-1).parts[0], /import \{ VgmDeck \} from "[^"]*\/src\/audio\/music\/vgm-deck\.js";\nglobalThis\.duneVgmDeck = VgmDeck;/);
  await settle();
  await settle();
  assert.deepEqual(node.sent.map((m) => m.cmd), ['play', 'vgm', 'play', 'next', 'stop'], 'then all of it, in order, the data once');
  assert.ok(node.sent[1].data instanceof ArrayBuffer && node.sent[1].id === 'vgm:7');
  out.playVgm(file);
  assert.equal(node.sent.filter((m) => m.cmd === 'vgm').length, 1, 'the synth has it already');
  assert.equal(modules.length, 2, 'the player is loaded once per context');
  out.release();
  out.open();
  await settle();
  out.playVgm(file);
  await settle();
  assert.deepEqual(win.nodes[1].sent.map((m) => m.cmd), ['vgm', 'play'], 'a new synth (after volume 0) is sent the data again');
  const anon = { name: 'x.vgm', type: 'audio/x-vgm', data: new ArrayBuffer(4) };
  assert.equal(vgmId(anon), vgmId(anon), 'a file without a key gets one id, kept');
});

test('a VGM player that does not load only means each VGM reports an error: the FM music carries on', async () => {
  const win = fakeWindow({ addModule: async (url) => { if (url.startsWith('blob:')) throw new Error('404'); } }), audio = fakeEngine(win);
  const warn = console.warn;
  console.warn = () => {};
  try {
    const out = new MusicOutput({ audio, win });
    out.open();
    await settle();
    out.playVgm(userVgm(1));
    out.send({ cmd: 'play', id: 'title' });
    await settle(); await settle();
    assert.deepEqual(win.nodes[0].sent.map((m) => m.cmd), ['vgm', 'play', 'play']);
  } finally { console.warn = warn; }
});

test('the conductor plays the player\'s VGMs on the synth, queues them to the sample, and skips one that will not play', async () => {
  const win = fakeWindow({ mixer: true, VgmDeck: fakeVgmDeck({ samples: 500 }) }), audio = fakeEngine(win);
  const a = userVgm(1, { track: 'Turbulence', loop: 0 }), b = userVgm(2, { track: 'Trenching', loop: 0 }), bad = userVgm(3, { track: 'Spice Trip', bad: true, loop: 0 });
  const store = fakeStore({ battle: [a, b] });
  const warn = console.warn;
  console.warn = () => {};
  try {
    const c = new Conductor({ audio, settings: {}, win, rng: () => 0, importer: store.importer });
    c.want('battle');
    await c.ready;
    c.update();
    await settle(); await settle();
    const node = win.nodes[0], cmds = () => node.sent.map((m) => (m.id ? `${m.cmd} ${m.id}` : m.cmd));
    assert.deepEqual(cmds().filter((s) => !s.startsWith('hold')), ['vgm vgm:1', 'play vgm:1', 'vgm vgm:2', 'next vgm:2']);
    assert.equal(node.sent.find((m) => m.cmd === 'play').passes, 1, 'a tune without a loop, one of many: once through');
    assert.equal(c.debug().source, 'vgm');
    for (let i = 0; i < 6; i++) win.render(128);
    assert.equal(c.debug().track, 'Trenching.vgm', 'the second one started on the sample the first ended');
    assert.ok(cmds().includes('next vgm:1'), 'and the one after it is queued');
    // a file that will not play: the next one, or the game's own music when none is left
    store.slots = { battle: [bad] };
    await c.reloadPlaylists();
    win.render(128);
    assert.equal(c.debug().source, 'fm', 'the bad one reported an error: the FM battle music instead');
    assert.ok(c.failed.has('#3'));
  } finally { console.warn = warn; }
});

test('a list of the player\'s files may mix VGMs and media files: one hands over to the other when it ends', async () => {
  const win = fakeWindow({ mixer: true, VgmDeck: fakeVgmDeck({ samples: 300 }) }), audio = fakeEngine(win);
  const v = userVgm(1, { track: 'Command Post', loop: 0 }), o = userOgg(2);
  let i = 0;
  const c = new Conductor({ audio, settings: {}, win, rng: () => [0, 0.99, 0][i++ % 3], importer: fakeStore({ battle: [v, o] }).importer });
  c.want('battle');
  await c.ready;
  c.update();
  await settle(); await settle();
  assert.equal(c.debug().track, 'Command Post.vgm');
  assert.equal(c.debug().queued, 'mine.ogg', 'a media file cannot be queued on the synth: it starts when the VGM ends');
  for (let k = 0; k < 4; k++) win.render(128);
  assert.equal(win.elements.length, 1);
  assert.equal(c.debug().track, 'mine.ogg');
  win.elements[0].onended();
  assert.equal(c.debug().track, 'Command Post.vgm', 'and back');
  assert.equal(plays(win).at(-1).id, 'vgm:1');
  assert.ok(sent(win).length > 0);
});
