import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, runUntil } from './helpers.mjs';

test('unreachable goals are retargeted to the reachable area without an exhaustive search', () => {
  const world = flatWorld(64, 64, G.ROCK);
  const m = world.map;
  for (let y = 37; y <= 43; y++) for (let x = 37; x <= 43; x++) if (x === 37 || x === 43 || y === 37 || y === 43) m.ground[m.idx(x, y)] = G.MOUNTAIN;
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5);
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 40, y: 40 });
  world.step();
  assert.ok(world.pathfinder.expanded < 800, `expanded ${world.pathfinder.expanded} nodes`);
  assert.ok(runUntil(world, () => tank.order.type === 'idle', 90) > 0);
  assert.ok(Math.max(Math.abs(tank.tx - 40), Math.abs(tank.ty - 40)) === 4, `ended at ${tank.tx},${tank.ty}`);
});

test('a big group order never spends much more than the per-tick search budget', () => {
  const world = flatWorld(128, 128, G.SAND);
  const ids = [];
  for (let k = 0; k < 60; k++) ids.push(world.spawnUnit('combatTank', 'atreides', 2 + (k % 6), 30 + Math.floor(k / 6)).id);
  const pf = world.pathfinder, find = pf.find.bind(pf);
  let spent = 0, worst = 0;
  pf.find = (...args) => { const r = find(...args); spent += pf.expanded; return r; };
  world.issue('atreides', { type: 'move', ids, x: 120, y: 64 });
  for (let i = 0; i < 20 * 10; i++) { spent = 0; world.step(); worst = Math.max(worst, spent); }
  assert.ok(worst <= world.pathNodeBudget + world.pathSearchCap, `worst tick expanded ${worst}`);
  assert.ok(ids.every((id) => world.units.get(id).pathState !== 'waiting'), 'every unit got a path within 10 s');
});
