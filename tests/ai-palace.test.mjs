import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { createBrain, ARMY_WEIGHTS, richestTarget } from '../src/sim/ai.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

function aiPalace(house) {
  const world = flatWorld(48, 32, G.ROCK);
  const s = world.spawnStructure('palace', house, 2, 2);
  s.readyAt = 0;
  const brain = createBrain(world, house, 'normal');
  return { world, s, brain };
}

test('the richest spot to hit is where enemy value crowds together', () => {
  const world = flatWorld(48, 32, G.ROCK);
  for (const x of [30, 32, 34]) world.spawnStructure('windtrap', 'atreides', x, 20);
  world.spawnUnit('combatTank', 'atreides', 10, 25);
  world.spawnStructure('windtrap', 'harkonnen', 12, 12);
  assert.deepEqual(richestTarget(world, 'harkonnen'), { x: 33, y: 21 });
  assert.equal(richestTarget(flatWorld(8, 8), 'harkonnen'), null);
});

test('a charged AI Palace fires the Death Hand at the richest enemy spot', () => {
  const { world, s } = aiPalace('harkonnen');
  for (const x of [30, 32, 34]) world.spawnStructure('windtrap', 'atreides', x, 20);
  world.spawnUnit('combatTank', 'atreides', 10, 25);
  let fired = null;
  runUntil(world, () => (fired ??= world.events.drain().find((e) => e.type === 'palaceFired')), 3);
  assert.deepEqual(fired && [fired.house, fired.weapon, fired.x, fired.y], ['harkonnen', 'deathHand', 33, 21]);
  assert.ok(s.readyAt > world.time + 400);
});

test('an Ordos AI sends its Saboteur into the most valuable enemy building', () => {
  const { world } = aiPalace('ordos');
  world.spawnStructure('windtrap', 'atreides', 20, 5);
  const factory = world.spawnStructure('heavyFactory', 'atreides', 30, 20);
  world.spawnStructure('silo', 'atreides', 10, 10);
  assert.ok(runUntil(world, () => [...world.units.values()].some((u) => u.typeId === 'saboteur' && u.order.type === 'sabotage'), 5) > 0);
  assert.equal([...world.units.values()].find((u) => u.typeId === 'saboteur').order.structureId, factory.id);
});

test('a Palace that cannot fire is not asked again every second', () => {
  const world = flatWorld(48, 32, G.ROCK);
  const s = world.spawnStructure('palace', 'ordos', 0, 0);
  for (let y = 0; y <= 8; y++) for (let x = 0; x <= 6; x++) if (!world.map.structure[world.map.idx(x, y)]) world.spawnStructure('wall', 'ordos', x, y);   // no room for a Saboteur
  s.readyAt = 0;
  createBrain(world, 'ordos', 'normal');
  const tries = [];
  const issue = world.issue.bind(world);
  world.issue = (h, cmd) => { if (cmd.type === 'palace') tries.push(world.time); issue(h, cmd); };
  run(world, 30);
  assert.ok(tries.length >= 1 && tries.length <= 4, `${tries.length} tries in 30 s`);
});

test('Fremen are never drafted into an AI wave', () => {
  const world = flatWorld(48, 32, G.ROCK);
  world.spawnStructure('constructionYard', 'atreides', 2, 2);
  world.spawnStructure('silo', 'harkonnen', 40, 24);
  const fremen = world.spawnUnit('fremen', 'atreides', 10, 10);
  for (let k = 0; k < 4; k++) world.spawnUnit('combatTank', 'atreides', 6 + k, 8);
  const brain = createBrain(world, 'atreides', 'normal');
  brain.nextAttack = 0;
  run(world, 1);
  assert.ok(brain.wave.length === 4 && !brain.wave.includes(fremen.id), JSON.stringify(brain.wave));
});

test('the computer builds a Palace once its House of IX stands, and fields its House special', () => {
  assert.ok(ARMY_WEIGHTS.sonicTank > 0 && ARMY_WEIGHTS.devastator > 0 && ARMY_WEIGHTS.deviator > 0);
  const world = flatWorld(56, 44, G.ROCK);
  const layout = [['constructionYard', 2, 2], ['windtrap', 5, 2], ['windtrap', 8, 2], ['windtrap', 11, 2], ['windtrap', 14, 2], ['windtrap', 17, 2], ['refinery', 2, 6], ['refinery', 6, 6], ['outpost', 10, 6], ['wor', 13, 6], ['heavyFactory', 2, 10], ['silo', 6, 10], ['repair', 9, 10], ['hiTech', 13, 10], ['turret', 17, 10], ['turret', 18, 10], ['starport', 2, 14], ['ix', 6, 14]];
  for (const [t, x, y] of layout) world.spawnStructure(t, 'harkonnen', x, y);
  const h = world.houses.get('harkonnen');
  h.credits = 20000;
  h.startBuffer = 40000;
  createBrain(world, 'harkonnen', 'normal');
  assert.ok(runUntil(world, () => [...world.structures.values()].some((s) => s.house === 'harkonnen' && s.typeId === 'palace'), 150) > 0);
});
