// The intro's music (contract C6): primed at page load while the browser holds the context, started by the player's
// gesture at once, heard (or said not to be within 1.5 s), handed over to the menu on the sample the cue ends —
// or carried on when the cue is the menu's music too — skipped with a short fade, and never played again by enter().
import test from 'node:test';
import assert from 'node:assert/strict';
import { MenuMusic } from '../src/audio/music/music.js';
import { TRACKS } from '../src/audio/music/songs/index.js';
import { fakeWindow, fakeStore, settle, sent, plays, userVgm, userOgg } from './music-fakes.mjs';

/** The FM tracks with an 'opening' cue, whatever the score has written so far. */
const TR = { ...TRACKS, opening: { ...TRACKS.victory, id: 'opening' } };
const cue = (win) => sent(win).filter((m) => m.cmd === 'play' || m.cmd === 'next').map((m) => [m.cmd, m.id, m.passes]);

function menuMusic({ settings = { sound: true, volume: 0.8 }, store = fakeStore(), tracks = TR, track = null, win = fakeWindow({ suspended: true }) } = {}) {
  win.document ??= { hidden: false, addEventListener() {} };
  const music = new MenuMusic({ settings, win, importer: store.importer, tracks, track, rng: () => 0 });
  return { win, music, settings, store };
}
const prime = async (music) => { music.prime(); await music.conductor.ready; await settle(); await settle(); };

test('primed at page load: the context waits for a gesture, the synth is loaded and the cue is queued in it', async () => {
  const { win, music } = menuMusic();
  await prime(music);
  const ctx = music.audio.ctx;
  assert.equal(ctx.state, 'suspended');
  assert.equal(ctx.resumes, 0, 'nothing asks the browser to start before the gesture');
  assert.equal(win.nodes.length, 1, 'the worklet is up already');
  assert.deepEqual(cue(win), [['play', 'opening', 1], ['next', 'title', 0]], 'the cue once, the title queued to follow it on its last sample');
  assert.equal(music.debug().mood, 'intro');
  assert.equal(music.debug().primed, true);
  assert.equal(win.listeners.pointerdown.length, 1, 'a first click anywhere still lets it play');
  music.prime();
  assert.equal(cue(win).length, 2, 'priming twice changes nothing');
});

test('intro() inside the gesture starts the queued cue at once and says it is heard; the menu follows it by itself', async () => {
  const { win, music } = menuMusic();
  await prime(music);
  const heard = music.intro();
  assert.equal(music.audio.ctx.resumes, 1, 'resumed inside the gesture');
  assert.equal(await heard, true);
  assert.equal(music.debug().introDelay, 0, 'heard on the first look: nothing was left to load');
  assert.deepEqual(cue(win), [['play', 'opening', 1], ['next', 'title', 0]], 'not started again: the queued cue simply runs');
  const port = win.nodes[0].port;
  port.onmessage({ data: { type: 'ended', id: 'opening' } });
  port.onmessage({ data: { type: 'started', id: 'title' } });
  assert.deepEqual([music.debug().mood, music.debug().playing, music.debug().track], ['menu', 'menu', 'title'], 'the menu\'s music now');
  music.leave();
  win.flush();
  music.enter();
  assert.deepEqual(plays(win).map((p) => p.id), ['opening', 'title'], 'back from a battle: the title, never the intro again');
});

test('without a prime, intro() opens the context itself and the cue plays once the synth is up', async () => {
  const { win, music } = menuMusic({ win: fakeWindow() });
  await music.conductor.ready;
  const heard = music.intro();
  await settle(); await settle();
  win.tick(20);
  assert.equal(await heard, true);
  assert.deepEqual(cue(win)[0], ['play', 'opening', 1]);
});

test('intro() says false at once when the music cannot be heard: Sound off, music volume 0, no Web Audio', async () => {
  for (const settings of [{ sound: false, volume: 0.8 }, { sound: true, volume: 0 }, { sound: true, volume: 0.8, musicVolume: 0 }]) {
    const { music } = menuMusic({ settings });
    await music.conductor.ready;
    let said = null;
    music.intro().then((v) => { said = v; });
    await settle();
    assert.equal(said, false, JSON.stringify(settings));
  }
  const win = fakeWindow();
  delete win.AudioContext;
  const { music } = menuMusic({ win });
  assert.equal(await music.intro(), false, 'a browser without Web Audio');
});

test('intro() says false within 1.5 s when the browser keeps the context from running', async () => {
  const win = fakeWindow({ suspended: true });
  win.noActivation = true;
  const { music } = menuMusic({ win });
  await prime(music);
  let said = null;
  music.intro().then((v) => { said = v; });
  for (let t = 0; t < 1460; t += 20) win.tick(20);
  await settle();
  assert.equal(said, null, 'still listening at 1.46 s');
  win.tick(60);
  await settle();
  assert.equal(said, false);
});

test('skipIntro() fades the cue in 0.4 s under the menu\'s music; skipping the menu does nothing', async () => {
  const { win, music } = menuMusic();
  await prime(music);
  await music.intro();
  music.skipIntro();
  const p = plays(win).at(-1);
  assert.deepEqual([p.id, p.fade, p.fadeIn, p.wait, p.passes], ['title', 0.4, 0, 0, 0]);
  assert.equal(music.debug().mood, 'menu');
  const n = sent(win).length;
  music.skipIntro();
  assert.equal(sent(win).length, n, 'no intro playing: nothing to skip');
});

test('the Sega Opening in both the intro and the menu slots plays once from the top and simply carries on as the menu\'s music', async () => {
  const opening = userVgm(1);
  // the store reads each slot apart: two objects, one record
  for (const store of [fakeStore({ intro: [opening], menu: [opening] }), fakeStore({ intro: [opening], menu: [{ ...opening }] })]) {
    const { win, music } = menuMusic({ store });
    await prime(music);
    assert.deepEqual(cue(win), [['play', 'vgm:1', 0]], 'from its start, for good: the file loops on under the title');
    assert.equal(music.debug().mood, 'menu', 'one music for both: it is the menu\'s already');
    assert.equal(await music.intro(), true);
    music.skipIntro();
    music.mood('menu');
    assert.equal(plays(win).length, 1, 'never restarted');
    assert.equal(music.debug().source, 'vgm');
  }
});

test('the player\'s own intro comes first, then the game\'s cue, then the menu\'s music; a file intro hands over when it ends', async () => {
  const mine = userOgg(5, 'opening.ogg');
  const { win, music } = menuMusic({ store: fakeStore({ intro: [mine] }) });
  win.blockAutoplay = true;   // the browser will not start a media element before a gesture
  await prime(music);
  assert.equal(plays(win).length, 0, 'not the FM cue');
  assert.equal(win.elements.length, 1);
  assert.equal(win.elements[0].paused, true, 'held back by the browser until the gesture');
  win.blockAutoplay = false;
  const heard = music.intro();
  assert.equal(win.elements[0].paused, false, 'started inside the gesture');
  assert.equal(await heard, true);
  assert.equal(music.debug().queued, 'title');
  win.elements[0].onended();
  assert.deepEqual([plays(win).at(-1).id, music.debug().mood], ['title', 'menu']);
  // no intro of theirs: the game's cue before the menu file they gave
  const menuFile = userVgm(9, { track: 'Chosen Destiny' });
  const two = menuMusic({ store: fakeStore({ menu: [menuFile] }) });
  await prime(two.music);
  assert.deepEqual(cue(two.win).filter(([c]) => c !== 'vgm'), [['play', 'opening', 1], ['next', 'vgm:9', 0]]);
  // and without any cue (the score has not written one), the menu's music is the intro's too
  const three = menuMusic({ tracks: TRACKS });
  await prime(three.music);
  assert.deepEqual(cue(three.win), [['play', 'title', 0]]);
  assert.equal(three.music.debug().mood, 'menu');
});

test('?music=<id> wins over the intro and every mood', async () => {
  const { win, music } = menuMusic({ track: 'iron' });
  await prime(music);
  assert.equal(await music.intro(), true);
  music.mood('houseSelect');
  assert.deepEqual(plays(win).map((p) => p.id), ['iron']);
});

test('the player\'s files read late: the game\'s cue goes ahead after a moment, and the late menu file still follows it', async () => {
  let answer;
  const late = new Promise((resolve) => { answer = resolve; });
  const store = { importer: async () => ({ playlists: () => late }) };
  const win = fakeWindow({ suspended: true });
  win.document = { hidden: false, addEventListener() {} };
  const music = new MenuMusic({ settings: { sound: true, volume: 0.8 }, win, importer: store.importer, tracks: TR, rng: () => 0 });
  music.prime();
  await settle(); await settle();
  assert.equal(plays(win).length, 0, 'waiting for the store');
  const heard = music.intro();
  win.tick(400);
  await settle();
  assert.deepEqual(cue(win), [['play', 'opening', 1], ['next', 'title', 0]]);
  assert.equal(await heard, true);
  answer({ menu: [userVgm(4, { track: 'Chosen Destiny' })] });
  await settle(); await settle();
  assert.equal(plays(win).length, 1, 'the cue is not started again');
  assert.deepEqual(cue(win).at(-1), ['next', 'vgm:4', 0], 'the menu file now follows it');
});
