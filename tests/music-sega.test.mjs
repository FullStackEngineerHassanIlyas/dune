// A battle's music in the Sega mode (settings musicMode 'sega', the default; research §9): the in-game tunes one
// after another in random order, never the same twice running, no switching between peace and battle, a new
// tune when the game menu closes; 'adaptive' is the director's peace and battle, and the mode switches live.
// The end: the battle house's own victory or defeat, once through, else the plain one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld } from './helpers.mjs';
import { BattleMusic } from '../src/audio/music/music.js';
import { fakeWindow, fakeEngine, fakeStore, settle, sent, plays, userVgm, songTable } from './music-fakes.mjs';

/** A fixed song table (whatever the score has written): the phase-2 tracks. */
const TABLE = songTable(), { pools: POOLS, tracks: TRACKS } = TABLE;
const INGAME = [...POOLS.peace, ...POOLS.battle];

async function battle({ settings = {}, store = fakeStore(), table = TABLE, rng = Math.random } = {}) {
  const world = flatWorld(48, 48, G.ROCK);
  world.fogOfWar = false;
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  const win = fakeWindow(), engine = fakeEngine(win);
  const music = new BattleMusic({ world, house: 'atreides', engine, settings, win, rng, importer: store.importer, ...table });
  await music.conductor.ready;
  music.frame();
  await settle();
  return { world, win, music, engine };
}
/** The synth says the queued tune has started (as the worklet does on its first sample). */
const startQueued = (win, music) => win.nodes[0].port.onmessage({ data: { type: 'started', id: music.conductor.queued, queued: true } });

test('the Sega mode (the default) plays every in-game tune in random order, never the same twice running, and does not switch on a fight', async () => {
  let seed = 7;
  const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const { win, music, world } = await battle({ rng });
  assert.equal(music.debug().mode, 'sega');
  assert.equal(music.debug().mood, 'ingame');
  const first = plays(win)[0];
  assert.ok(INGAME.includes(first.id));
  assert.equal(first.passes, TRACKS[first.id].passes, 'each tune its own number of times through, then the next');
  const heard = [first.id];
  for (let i = 0; i < 40; i++) { startQueued(win, music); heard.push(music.debug().track); }
  for (let i = 1; i < heard.length; i++) assert.notEqual(heard[i], heard[i - 1], `never twice running (${i})`);
  assert.deepEqual([...new Set(heard)].sort(), [...INGAME].sort(), 'all six of the game\'s peace and battle tunes take turns');
  const n = plays(win).length;
  music.onEvent({ type: 'damaged', house: 'atreides', by: 'harkonnen' });
  world.time += 1;
  music.frame();
  assert.equal(plays(win).length, n, 'fighting changes nothing: the Sega game had no battle music of its own');
  assert.equal(music.debug().mood, 'ingame');
});

test('the game menu closing rolls another tune (the Sega game did so leaving its Options); not in the adaptive mode', async () => {
  const { win, music } = await battle({ rng: () => 0.5 });
  const playing = music.debug().track;
  music.reroll();
  const p = plays(win).at(-1);
  assert.notEqual(p.id, playing, 'another one');
  assert.ok(INGAME.includes(p.id));
  assert.ok(sent(win).at(-1).cmd === 'next', 'with the one after it queued');
  const a = await battle({ settings: { musicMode: 'adaptive' } });
  const n = plays(a.win).length;
  a.music.reroll();
  assert.equal(plays(a.win).length, n);
});

test('the mode switches live: adaptive follows the fighting, Sega carries on with the tune already playing', async () => {
  const settings = { musicMode: 'sega' };
  const { win, music, world } = await battle({ settings, rng: () => 0 });
  const first = music.debug().track;
  settings.musicMode = 'adaptive';
  music.frame();
  assert.equal(music.debug().mood, 'peace');
  if (POOLS.peace.includes(first)) assert.equal(plays(win).length, 1, 'a peace tune was playing: it plays on');
  else assert.ok(POOLS.peace.includes(plays(win).at(-1).id));
  music.onEvent({ type: 'damaged', house: 'atreides', by: 'harkonnen' });
  world.time += 1;
  music.frame();
  assert.ok(POOLS.battle.includes(plays(win).at(-1).id), 'adaptive: the battle pool on contact');
  const n = plays(win).length;
  settings.musicMode = 'sega';
  music.frame();
  assert.equal(music.debug().mood, 'ingame');
  assert.equal(plays(win).length, n, 'back to Sega: the battle tune is one of the in-game tunes, so it plays on');
});

test('the player\'s in-game files come first; without them their peace and battle files; the game\'s own last', async () => {
  const sega = [1, 2, 3, 4, 5].map((id, i) => userVgm(id, { track: ['The Lego Tune', 'Turbulence', 'Spice Trip', 'Command Post', 'Trenching'][i], loop: 0 }));
  const { win, music } = await battle({ store: fakeStore({ ingame: sega, peace: [userVgm(9, { track: 'Mine' })] }), rng: () => 0 });
  await settle(); await settle();
  const p = plays(win)[0];
  assert.deepEqual([p.id, p.passes], ['vgm:1', 1], 'the Sega tunes have no loop: once through each, then the next');
  assert.equal(sent(win).find((m) => m.cmd === 'next').id, 'vgm:2');
  assert.equal(music.debug().source, 'vgm');
  const b = await battle({ store: fakeStore({ battle: [userVgm(8, { track: 'Mine' })] }) });
  await settle(); await settle();
  assert.equal(plays(b.win)[0].id, 'vgm:8');
});

test('the end: the battle house\'s own victory or defeat once through, else the plain one; a draw is silent', async () => {
  const { win, music } = await battle({ table: songTable({ add: ['victory-atreides'] }) });
  music.onEvent({ type: 'gameOver', winner: 'atreides' });
  music.frame();
  assert.equal(sent(win).at(-1).cmd, 'stop', 'decided: the music stops');
  music.end(true);
  assert.deepEqual([plays(win).at(-1).id, plays(win).at(-1).passes], ['victory-atreides', 1]);
  assert.equal(music.debug().mood, 'victory:atreides');
  music.end(false);
  assert.deepEqual([plays(win).at(-1).id, plays(win).at(-1).passes], ['defeat', 1], 'no Atreides dirge: the plain defeat');
  music.end(false, true);
  assert.equal(sent(win).at(-1).cmd, 'stop');
  const files = await battle({ store: fakeStore({ 'victory-atreides': [userVgm(13, { track: 'Conquest' })] }) });
  files.music.onEvent({ type: 'gameOver', winner: 'atreides' });
  files.music.end(true);
  await settle(); await settle();
  assert.deepEqual([plays(files.win).at(-1).id, plays(files.win).at(-1).passes], ['vgm:13', 1], 'the player\'s Conquest, once through');
});
