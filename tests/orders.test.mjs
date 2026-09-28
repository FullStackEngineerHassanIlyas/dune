import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, run } from './helpers.mjs';

test('commands for another house\'s units are ignored', () => {
  const world = flatWorld();
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 2);
  world.issue('harkonnen', { type: 'move', ids: [tank.id], x: 10, y: 10 });
  run(world, 2);
  assert.deepEqual([tank.tx, tank.ty, tank.order.type], [2, 2, 'idle']);
});

test('stop halts a moving unit on the next tile centre', () => {
  const world = flatWorld(24, 12, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 1, 5, { heading: 0 });
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 20, y: 5 });
  run(world, 1);
  world.issue('atreides', { type: 'stop', ids: [tank.id] });
  run(world, 2);
  assert.equal(tank.order.type, 'idle');
  assert.equal(tank.x, tank.tx + 0.5);
  assert.ok(tank.tx <= 4);
});

test('guard gives a guard order in place', () => {
  const world = flatWorld();
  const tank = world.spawnUnit('combatTank', 'atreides', 4, 4);
  world.issue('atreides', { type: 'guard', ids: [tank.id] });
  world.step();
  assert.deepEqual(tank.order, { type: 'guard', x: 4, y: 4 });
});

test('scatter moves every unit off its tile', () => {
  const world = flatWorld(16, 16, G.SAND);
  const units = [[6, 6], [7, 6], [6, 7], [7, 7]].map(([x, y]) => world.spawnUnit('quad', 'ordos', x, y));
  const before = units.map((u) => `${u.tx},${u.ty}`);
  world.issue('ordos', { type: 'scatter', ids: units.map((u) => u.id) });
  run(world, 6);
  const moved = units.filter((u, k) => `${u.tx},${u.ty}` !== before[k]).length;
  assert.ok(moved >= 3, `moved ${moved}`);
  assert.ok(units.every((u) => u.order.type === 'idle'));
});

test('invalid move coordinates are ignored, out-of-map ones are clamped', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 2, { heading: 0 });
  world.issue('atreides', { type: 'move', ids: [tank.id], x: NaN, y: 3 });
  run(world, 1);
  assert.deepEqual([tank.tx, tank.ty, tank.order.type], [2, 2, 'idle']);
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 500, y: 2 });
  run(world, 15);
  assert.deepEqual([tank.tx, tank.ty], [11, 2]);
});
