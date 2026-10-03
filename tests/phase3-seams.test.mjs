// The seams phase 3's streams build on: finishGame ends a game once, a world calls its mission every five
// ticks, a battle on its own does not post to a shell, and the new settings keep to their values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { finishGame, standing } from '../src/sim/victory.js';
import { postToShell } from '../src/core/shell.js';
import { DEFAULTS, sanitize } from '../src/core/settings.js';
import { OPTION_ROWS } from '../src/ui/options.js';
import { flatWorld } from './helpers.mjs';

test('finishGame ends the game once and tells the named losers', () => {
  const world = flatWorld(24, 24);
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  assert.equal(standing(world, 'atreides'), true);
  assert.equal(standing(world, 'harkonnen'), false);
  const outcome = finishGame(world, { winner: null, lost: ['atreides'] });
  assert.equal(outcome.winner, null);
  assert.equal(finishGame(world, { winner: 'atreides' }), outcome, 'a second call changes nothing');
  const events = world.events.drain();
  const said = events.filter((e) => e.type === 'eva').map((e) => `${e.house}:${e.key}`);
  assert.ok(said.includes('atreides:missionFailed'), said.join(' '));
  assert.equal(events.filter((e) => e.type === 'gameOver').length, 1);
});

test('a world calls its mission every five ticks, and nothing without one', () => {
  const world = flatWorld(16, 16);
  for (let i = 0; i < 20; i++) world.step();
  const ticks = [];
  world.mission = { update: (w) => ticks.push(w.tick) };
  for (let i = 0; i < 20; i++) world.step();
  assert.deepEqual(ticks, [20, 25, 30, 35]);
});

test('a battle on its own does not post to a shell', () => {
  const win = { parent: null, location: { origin: 'http://x' } };
  win.parent = win;
  assert.equal(postToShell({ dune: 'missionEnd' }, win), false);
  const sent = [];
  const parent = { __duneShell: {}, postMessage: (m, origin) => sent.push([m, origin]) };
  assert.equal(postToShell({ dune: 'missionEnd', won: true }, { parent, location: { origin: 'http://x' } }), true);
  assert.deepEqual(sent, [[{ dune: 'missionEnd', won: true }, 'http://x']]);
});

test('battle music mode and intro settings keep to their values and have Options rows', () => {
  assert.equal(DEFAULTS.musicMode, 'sega');
  assert.equal(DEFAULTS.intro, true);
  assert.equal(sanitize({ musicMode: 'adaptive' }).musicMode, 'adaptive');
  assert.equal(sanitize({ musicMode: 'loud' }).musicMode, 'sega');
  assert.equal(sanitize({ intro: '0' }).intro, false);
  const keys = OPTION_ROWS.map((r) => r.key);
  assert.ok(keys.includes('musicMode') && keys.includes('intro'));
});
