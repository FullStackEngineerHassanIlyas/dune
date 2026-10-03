// A mission's computer house (spec §7: the AI gets harder with the mission number): its brain takes per-mission
// parameters over the difficulty it starts from, without adding presets to the skirmish's DIFFICULTY table, and
// the guards a mission posts stay at their posts instead of joining the attack waves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { createBrain, DIFFICULTY } from '../src/sim/ai.js';
import { flatWorld, run } from './helpers.mjs';

function base(world, house = 'harkonnen') {
  for (const [t, x, y] of [['constructionYard', 2, 2], ['windtrap', 5, 2], ['heavyFactory', 2, 6], ['windtrap', 8, 2]]) world.spawnStructure(t, house, x, y);
  const tanks = [];
  for (let k = 0; k < 6; k++) tanks.push(world.spawnUnit('combatTank', house, 3 + k, 12));
  return tanks;
}
const waves = (world, house) => world.events.drain().filter((e) => e.type === 'aiAttack' && e.house === house);

test('the skirmish difficulty table keeps its three presets', () => {
  assert.deepEqual(Object.keys(DIFFICULTY), ['easy', 'normal', 'hard']);
});

test('mission parameters override the difficulty: build speed, income, first wave and wave interval', () => {
  const world = flatWorld(48, 24, G.ROCK);
  world.spawnStructure('constructionYard', 'atreides', 40, 18);
  base(world);
  const brain = createBrain(world, 'harkonnen', 'easy', { firstAttack: 20, attackEvery: 30, buildSpeed: 0.5, incomeRate: 1.2 });
  const house = world.houses.get('harkonnen');
  assert.deepEqual([house.buildSpeed, house.incomeRate, brain.nextAttack], [0.5, 1.2, 20]);
  assert.equal(brain.difficulty, 'easy');
  assert.equal(brain.params.waveBase, DIFFICULTY.easy.waveBase, 'the rest comes from the difficulty');
  house.credits = 0;
  run(world, 21);
  const first = waves(world, 'harkonnen');
  assert.equal(first.length, 1, 'the first wave goes at 20 s, not at the easy 480 s');
  assert.ok(brain.nextAttack > 50 && brain.nextAttack <= 51, `the next one 30 s after (${brain.nextAttack})`);
});

test('a plain brain keeps the difficulty as it was', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const brain = createBrain(world, 'ordos', 'hard');
  assert.equal(brain.params, undefined);
  assert.equal(brain.nextAttack, DIFFICULTY.hard.firstAttack);
  assert.equal(world.houses.get('ordos').buildSpeed, DIFFICULTY.hard.buildSpeed);
});

test('a passive computer house never sends a wave but still defends its base', () => {
  const world = flatWorld(48, 24, G.ROCK);
  world.spawnStructure('constructionYard', 'atreides', 40, 18);
  const tanks = base(world);
  createBrain(world, 'harkonnen', 'hard', { firstAttack: 5, passive: true });
  world.houses.get('harkonnen').credits = 0;
  run(world, 60);
  assert.equal(waves(world, 'harkonnen').length, 0);
  const raider = world.spawnUnit('quad', 'atreides', 12, 4);
  raider.hp = raider.maxHp = 100000;
  run(world, 2);
  assert.ok(tanks.some((u) => u.order.type === 'attack' && u.order.target.id === raider.id), 'the base is defended');
});

test('garrison units are left out of attack waves', () => {
  const world = flatWorld(48, 24, G.ROCK);
  world.spawnStructure('constructionYard', 'atreides', 40, 18);
  const tanks = base(world);
  for (const u of tanks.slice(0, 4)) u.garrison = true;
  createBrain(world, 'harkonnen', 'easy', { firstAttack: 5 });
  world.houses.get('harkonnen').credits = 0;
  run(world, 30);
  assert.equal(waves(world, 'harkonnen').length, 0, 'two free tanks are no wave of three');
  for (const u of tanks.slice(4)) u.garrison = false;
  for (const u of tanks.slice(0, 2)) u.garrison = false;
  run(world, 16);
  const sent = waves(world, 'harkonnen');
  assert.equal(sent.length, 1);
  assert.ok(tanks.slice(2, 4).every((u) => u.order.type !== 'attackMove'), 'the garrison stayed');
});
