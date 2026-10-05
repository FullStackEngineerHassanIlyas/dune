import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { destroyStructure, damage } from '../src/sim/combat.js';
import { endStats } from '../src/sim/victory.js';
import { defeatText } from '../src/sim/announce.js';
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

test('a plain 1v1 loss: the winner is the winner, nobody "fights on"', () => {
  const { world, a } = duel();
  run(world, 1.05);
  destroyStructure(world, a, { house: 'harkonnen', id: 0, kind: 'unit' });
  run(world, 2);
  assert.deepEqual([world.outcome.winner, world.outcome.draw], ['harkonnen', false]);
  const s = endStats(world, 'atreides');
  assert.deepEqual([s.won, s.draw, s.standing], [false, false, []]);
  assert.deepEqual(s.houses.map((h) => [h.id, h.winner]), [['atreides', false], ['harkonnen', true], ['ordos', false]]);
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

test('end statistics compare the player with everyone else, house by house', () => {
  const { world, h } = duel();
  world.houses.get('atreides').stats.spiceHarvested = 1400;
  world.houses.get('harkonnen').stats.spiceHarvested = 700;
  destroyStructure(world, h, { house: 'atreides', id: 0, kind: 'unit' });
  run(world, 2);
  const s = endStats(world, 'atreides');
  assert.equal(s.won, true);
  assert.equal(s.draw, false);
  assert.deepEqual(s.houses.map((x) => [x.id, x.name, x.you, x.winner]), [['atreides', 'Atreides', true, true], ['harkonnen', 'Harkonnen', false, false], ['ordos', 'Ordos', false, false]]);
  assert.deepEqual(s.rows[0], { label: 'Spice harvested', you: 1400, enemy: 700, values: [1400, 700, 0] });
  assert.deepEqual(s.rows.find((r) => r.label === 'Buildings destroyed'), { label: 'Buildings destroyed', you: 1, enemy: 0, values: [1, 0, 0] });
  assert.ok(s.houses[1].out >= 0, 'when the Harkonnen fell');
});

// The player (Atreides) against two computer houses, three bases on a strip of rock.
function freeForAll() {
  const world = flatWorld(48, 16, G.ROCK);
  world.rules.victory = true;
  world.houses.get('harkonnen').isAI = true;
  world.houses.get('ordos').isAI = true;
  const yards = Object.fromEntries([['atreides', 2], ['harkonnen', 22], ['ordos', 42]].map(([id, x]) => [id, world.spawnStructure('constructionYard', id, x, 2)]));
  return { world, yards };
}

test('free-for-all: one rival down names the house and the battle goes on; the last house standing wins', () => {
  const { world, yards } = freeForAll();
  run(world, 1);
  world.events.drain();
  destroyStructure(world, yards.ordos, { house: 'harkonnen', id: 0, kind: 'unit' });
  run(world, 1);
  const out = events(world, 'houseDefeated');
  assert.deepEqual(out.map((e) => [e.house, e.name, e.text]), [['ordos', 'Ordos', 'House Ordos has been defeated.']]);
  assert.equal(world.outcome, null, 'two houses still stand');
  destroyStructure(world, yards.harkonnen, { house: 'atreides', id: 0, kind: 'unit' });
  run(world, 1);
  assert.equal(world.outcome.winner, 'atreides');
  assert.deepEqual(world.outcome.standing, ['atreides']);
  assert.equal(endStats(world, 'atreides').won, true);
});

test('free-for-all: the player out while computers fight on ends the battle as a loss, not a draw', () => {
  const { world, yards } = freeForAll();
  run(world, 1);
  world.events.drain();
  destroyStructure(world, yards.atreides, { house: 'ordos', id: 0, kind: 'unit' });
  run(world, 1);
  assert.deepEqual([world.outcome.winner, world.outcome.draw], [null, false]);
  assert.deepEqual(world.outcome.standing, ['harkonnen', 'ordos']);
  const all = world.events.drain();
  assert.equal(all.filter((e) => e.type === 'gameOver').length, 1);
  const said = all.filter((e) => e.type === 'eva').map((e) => `${e.house}:${e.key}`);
  assert.ok(said.includes('atreides:missionFailed') && !said.some((k) => k.endsWith('draw') || k.endsWith('missionAccomplished')), said.join());
  const s = endStats(world, 'atreides');
  assert.deepEqual([s.won, s.draw], [false, false]);
  assert.deepEqual(s.standing, ['Harkonnen', 'Ordos']);
  run(world, 5);
  assert.equal(events(world, 'gameOver').length, 0, 'decided once');
});

test('free-for-all among computers alone runs to the last house standing', () => {
  const { world, yards } = freeForAll();
  world.houses.get('atreides').isAI = true;
  destroyStructure(world, yards.atreides, null);
  run(world, 1);
  assert.equal(world.outcome, null);
  destroyStructure(world, yards.ordos, null);
  run(world, 1);
  assert.equal(world.outcome.winner, 'harkonnen');
});

test('free-for-all: everyone falling at once is a draw', () => {
  const { world, yards } = freeForAll();
  run(world, 1.05);
  for (const s of Object.values(yards)) destroyStructure(world, s, null);
  run(world, 1);
  assert.deepEqual([world.outcome.winner, world.outcome.draw], [null, true]);
  assert.equal(endStats(world, 'atreides').draw, true);
});

test('a defeated sub-house is named as a group', () => {
  assert.equal(defeatText('mercenary'), 'The Mercenaries have been defeated.');
  assert.equal(defeatText('sardaukar'), 'The Sardaukar have been defeated.');
  assert.equal(defeatText('harkonnen'), 'House Harkonnen has been defeated.');
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

test('a draw is announced as a draw', () => {
  const { world, a, h } = duel();
  run(world, 1.05);
  destroyStructure(world, a, null);
  destroyStructure(world, h, null);
  run(world, 1);
  const said = events(world, 'eva').map((e) => e.key);
  assert.ok(said.includes('draw') && !said.includes('missionFailed'), said.join());
});

test('end statistics are frozen at the end and the end comes quickly', () => {
  const { world, h } = duel();
  destroyStructure(world, h, { house: 'atreides', id: 0, kind: 'unit' });
  run(world, 0.3);
  assert.ok(world.outcome, 'decided within a third of a second');
  const before = endStats(world, 'atreides');
  world.houses.get('atreides').stats.unitsKilled += 5;
  run(world, 3);
  assert.deepEqual(endStats(world, 'atreides'), before);
});
