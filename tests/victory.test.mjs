import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { destroyStructure, damage } from '../src/sim/combat.js';
import { endStats } from '../src/sim/victory.js';
import { flatWorld, run } from './helpers.mjs';

function duel() {
  const world = flatWorld(32, 16, G.ROCK);
  world.rules.victory = true;
  const a = world.spawnStructure('constructionYard', 'atreides', 2, 2);
  const h = world.spawnStructure('constructionYard', 'harkonnen', 26, 2);
  return { world, a, h };
}
const events = (world, type) => world.events.drain().filter((e) => e.type === type);

test('a house with no buildings and no MCV is defeated; the last one standing wins', () => {
  const { world, h } = duel();
  run(world, 2);
  assert.equal(world.outcome, null);
  destroyStructure(world, h, { house: 'atreides', id: 0, kind: 'unit' });
  run(world, 2);
  assert.equal(world.houses.get('harkonnen').defeated, true);
  assert.deepEqual([world.outcome.winner], ['atreides']);
  const all = world.events.drain();
  assert.equal(all.filter((e) => e.type === 'gameOver').length, 1);
  assert.ok(all.some((e) => e.type === 'eva' && e.house === 'atreides' && e.key === 'missionAccomplished'));
  assert.ok(all.some((e) => e.type === 'eva' && e.house === 'harkonnen' && e.key === 'missionFailed'));
  run(world, 5);
  assert.equal(events(world, 'gameOver').length, 0, 'announced once');
});

test('an MCV keeps a house in the game', () => {
  const { world, h } = duel();
  world.spawnUnit('mcv', 'harkonnen', 20, 10);
  destroyStructure(world, h, null);
  run(world, 3);
  assert.equal(world.houses.get('harkonnen').defeated, undefined);
  assert.equal(world.outcome, null);
});

test('both sides falling in one tick is a single draw', () => {
  const { world, a, h } = duel();
  run(world, 1.05);
  destroyStructure(world, a, null);
  destroyStructure(world, h, null);
  run(world, 2);
  assert.equal(world.outcome.winner, null);
  assert.equal(events(world, 'gameOver').length, 1);
});

test('base alerts are throttled; losses are announced', () => {
  const { world, a } = duel();
  const attacker = { house: 'harkonnen', id: 0, kind: 'unit' };
  damage(world, a, 10, attacker);
  damage(world, a, 10, attacker);
  run(world, 5);
  damage(world, a, 10, attacker);
  assert.equal(events(world, 'eva').filter((e) => e.key === 'baseAttack').length, 1);
  run(world, 20);
  damage(world, a, 10, attacker);
  assert.equal(events(world, 'eva').filter((e) => e.key === 'baseAttack').length, 1, 'again after 20 s');
  const u = world.spawnUnit('trike', 'atreides', 8, 8);
  damage(world, u, 1000, attacker);
  const said = events(world, 'eva');
  assert.ok(said.some((e) => e.house === 'atreides' && e.key === 'unitLost'));
  assert.ok(said.some((e) => e.house === 'harkonnen' && e.key === 'enemyUnitDestroyed'));
});

test('end statistics compare the player with everyone else', () => {
  const { world, h } = duel();
  world.houses.get('atreides').stats.spiceHarvested = 1400;
  world.houses.get('harkonnen').stats.spiceHarvested = 700;
  destroyStructure(world, h, { house: 'atreides', id: 0, kind: 'unit' });
  run(world, 2);
  const s = endStats(world, 'atreides');
  assert.equal(s.won, true);
  assert.equal(s.draw, false);
  assert.deepEqual(s.rows[0], { label: 'Spice harvested', you: 1400, enemy: 700 });
  assert.deepEqual(s.rows.find((r) => r.label === 'Buildings destroyed'), { label: 'Buildings destroyed', you: 1, enemy: 0 });
});

test('walls alone do not keep a house in the game', () => {
  const { world, h } = duel();
  world.spawnStructure('wall', 'harkonnen', 20, 10);
  world.spawnStructure('wall', 'harkonnen', 21, 10);
  destroyStructure(world, h, null);
  run(world, 2);
  assert.equal(world.houses.get('harkonnen').defeated, true);
  assert.equal(world.outcome.winner, 'atreides');
});
