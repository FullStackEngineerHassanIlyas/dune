import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { AIR } from '../src/data/tuning.js';
import { hoverTo, flyAt } from '../src/sim/air.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

test('a Carryall flies at five tiles a second and stops dead where it is sent', () => {
  const world = flatWorld(40, 20, G.ROCK);
  const c = world.spawnUnit('carryall', 'atreides', 5, 10);
  let ticks = 0;
  while (!hoverTo(world, c, 25.5, 10.5)) ticks++;
  assert.ok(Math.abs(ticks - 80) <= 1, `${ticks} ticks for 20 tiles`);
  assert.deepEqual([c.x, c.y, c.tx, c.ty], [25.5, 10.5, 25, 10]);
});

test('an Ornithopter flies at 3.75 tiles a second, never turns tighter than its orbit, and circles over a spot', () => {
  const world = flatWorld(40, 40, G.ROCK);
  const o = world.spawnUnit('ornithopter', 'atreides', 5, 20, { heading: 0 });
  const x0 = o.x;
  for (let k = 0; k < 20; k++) flyAt(world, o, 35.5, 20.5);
  assert.ok(Math.abs(o.x - x0 - 3.75) < 1e-6, `${o.x - x0} tiles in a second`);
  let far = 0;
  for (let k = 0; k < 400; k++) {
    const before = o.heading;
    flyAt(world, o, 20.5, 20.5);
    assert.ok(Math.abs(o.heading - before) <= (3.75 / AIR.orbit) * 0.05 + 1e-9 || Math.abs(Math.abs(o.heading - before) - 2 * Math.PI) < 0.2);
    if (k > 200) far = Math.max(far, Math.hypot(o.x - 20.5, o.y - 20.5));
  }
  assert.ok(far < 2 * AIR.orbit + 0.5, `circles within ${far} tiles of the spot`);
});

test('aircraft hold no tiles, keep their tile indices and stay over the map', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const o = world.spawnUnit('ornithopter', 'atreides', 2, 2, { heading: Math.PI });
  assert.equal(o.alt, AIR.cruise);
  assert.equal(world.map.unit[world.map.idx(2, 2)], 0);
  world.issue('atreides', { type: 'move', ids: [o.id], x: -5, y: -5 });
  run(world, 3);
  assert.ok(o.x >= 0.5 && o.y >= 0.5 && o.tx === Math.floor(o.x) && o.ty === Math.floor(o.y));
  assert.deepEqual(checkInvariants(world), []);
});

test('a move order sends an Ornithopter to the spot, where it circles on guard', () => {
  const world = flatWorld(40, 40, G.ROCK);
  const o = world.spawnUnit('ornithopter', 'atreides', 5, 5);
  world.issue('atreides', { type: 'move', ids: [o.id], x: 30, y: 30 });
  assert.ok(runUntil(world, () => o.order.type === 'guard', 15) > 0);
  assert.deepEqual([o.order.x, o.order.y], [30, 30]);
  run(world, 5);
  assert.ok(Math.hypot(o.x - 30.5, o.y - 30.5) < 2 * AIR.orbit + 0.5, 'still over the spot');
});

test('a new Carryall waits over its Hi-Tech Factory (no Refinery or Repair Facility yet) until the player sends it off', () => {
  const world = flatWorld(40, 40, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 5000;
  h.startBuffer = 100000;
  world.spawnStructure('windtrap', 'atreides', 1, 1);
  const hq = world.spawnStructure('hiTech', 'atreides', 10, 10);
  world.issue('atreides', { type: 'build', typeId: 'carryall' });
  assert.ok(runUntil(world, () => [...world.units.values()].some((u) => u.typeId === 'carryall'), 40) > 0, 'built');
  const c = [...world.units.values()].find((u) => u.typeId === 'carryall');
  assert.ok(c.alt < AIR.cruise && Math.hypot(c.x - 11.5, c.y - 11) < 1.5, 'lifts off the factory');
  assert.equal(c.home, hq.id);
  run(world, 3);
  assert.equal(c.alt, AIR.cruise);
  assert.ok(Math.hypot(c.x - 11.5, c.y - 10.8) < 1, `hovering over the factory at ${c.x},${c.y}`);
  world.issue('atreides', { type: 'move', ids: [c.id], x: 35, y: 35 });
  run(world, 7);
  assert.equal(c.order.type, 'idle', 'no ordinary order: its own');
  assert.ok(Math.hypot(c.x - 35.5, c.y - 35.5) < 0.1, `sent off to 35,35: at ${c.x},${c.y}`);
});
