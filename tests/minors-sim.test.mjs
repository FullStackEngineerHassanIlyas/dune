import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { buildOptions } from '../src/sim/tech.js';
import { setupSkirmish } from '../src/game/setup.js';
import { isVisible } from '../src/sim/fog.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

test('the starting allowance ends as soon as built storage passes it', () => {
  const world = flatWorld(32, 32, G.ROCK);
  const h = world.houses.get('atreides');
  h.startBuffer = 3000;
  h.credits = 2900;
  world.spawnStructure('refinery', 'atreides', 2, 2);
  world.spawnStructure('silo', 'atreides', 8, 2);
  assert.equal(h.startBuffer, 3000, '2005 stored: the allowance still holds');
  const last = world.spawnStructure('silo', 'atreides', 12, 2);
  assert.equal(h.startBuffer, 0, '3005 stored: it ends now, not at the next payment');
  world.issue('atreides', { type: 'sell', structureId: last.id });
  world.step();
  assert.equal(h.credits, 2005);
});

test('every structure but the Wind Trap and slabs needs a Wind Trap', () => {
  const world = flatWorld(32, 32, G.ROCK);
  for (const [t, x, y] of [['constructionYard', 2, 2], ['refinery', 6, 2], ['outpost', 10, 2]]) world.spawnStructure(t, 'atreides', x, y);
  const offered = buildOptions(world, 'atreides').structure;
  assert.ok(offered.includes('windtrap') && offered.includes('concrete'));
  for (const t of ['silo', 'barracks', 'heavyFactory', 'wall', 'turret']) assert.ok(!offered.includes(t), `${t} without a Wind Trap`);
  world.spawnStructure('windtrap', 'atreides', 14, 2);
  assert.ok(buildOptions(world, 'atreides').structure.includes('silo'));
});

test('a full harvester drives noticeably slower than an empty one', () => {
  const trip = (load) => {
    const world = flatWorld(32, 12, G.SAND);
    const u = world.spawnUnit('harvester', 'atreides', 2, 6, { heading: 0 });
    u.harvest.load = load;
    world.issue('atreides', { type: 'move', ids: [u.id], x: 22, y: 6 });
    world.step();
    return runUntil(world, () => u.tx === 22, 120);
  };
  const empty = trip(0), full = trip(700);
  assert.ok(empty > 0 && full / empty > 1.4, `empty ${empty}s, full ${full}s`);
});

test('spice statistics count only the credits that were banked', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.houses.get('atreides');
  h.startBuffer = 0;
  world.spawnStructure('refinery', 'atreides', 8, 8);
  h.credits = 1005;
  const u = [...world.units.values()].find((x) => x.typeId === 'harvester');
  u.harvest.load = 700;
  u.harvest.state = 'toRefinery';
  run(world, 20);
  assert.equal(u.harvest.load, 0, 'it unloaded');
  assert.equal(h.stats.spiceHarvested, 0, 'nothing fitted in the full refinery');
});

test('structures are placed on whole tiles only', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 5000;
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  h.lines.structure.current = { typeId: 'windtrap', cost: 300, total: 21.6, progress: 1, paid: 300, state: 'ready', starved: false };
  world.issue('atreides', { type: 'place', typeId: 'windtrap', x: 6.5, y: 4 });
  world.step();
  assert.equal(h.lines.structure.current?.state, 'ready');
  assert.equal([...world.structures.values()].filter((s) => s.typeId === 'windtrap').length, 0);
});

test('a skirmish starts with fog already drawn', () => {
  const { world, house, starts } = setupSkirmish({ seed: 2 });
  assert.ok(world.houses.get(house).fog, 'fog exists before the first frame');
  assert.equal(isVisible(world, house, starts[1].x, starts[1].y), false, 'the rival base is hidden');
});

test('units on mirrored diagonal steps never pass through each other', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const a = world.spawnUnit('combatTank', 'atreides', 5, 5, { heading: Math.PI / 4 });
  const b = world.spawnUnit('combatTank', 'atreides', 6, 5, { heading: (3 * Math.PI) / 4 });
  world.issue('atreides', { type: 'move', ids: [a.id], x: 6, y: 6 });
  world.issue('atreides', { type: 'move', ids: [b.id], x: 5, y: 6 });
  let closest = Infinity;
  for (let i = 0; i < 200; i++) { world.step(); closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y)); }
  assert.ok(closest > 0.6, `they came within ${closest.toFixed(2)} tiles`);
  assert.deepEqual([a.tx, a.ty, b.tx, b.ty], [6, 6, 5, 6]);
});

test('losing the last Wind Trap does not cancel a structure that is ready', () => {
  const world = flatWorld(32, 32, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 5000;
  h.startBuffer = 100000;
  world.spawnStructure('constructionYard', 'atreides', 2, 2);
  const trap = world.spawnStructure('windtrap', 'atreides', 6, 2);
  world.spawnStructure('refinery', 'atreides', 2, 6);
  h.lines.structure.current = { typeId: 'silo', cost: 150, total: 21.6, progress: 1, paid: 150, state: 'ready', starved: false };
  world.removeStructure(trap, 'destroyed');
  run(world, 2);
  assert.equal(h.lines.structure.current?.state, 'ready');
});
