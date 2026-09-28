import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { generateMap } from '../src/sim/mapgen.js';
import { World } from '../src/sim/world.js';
import { findFreeTile } from '../src/game/setup.js';
import { findDestinations } from '../src/sim/destinations.js';
import { flatWorld, runUntil } from './helpers.mjs';

const idle = (world, ids) => ids.every((id) => world.units.get(id).order.type === 'idle');
const cheb = (u, x, y) => Math.max(Math.abs(u.tx - x), Math.abs(u.ty - y));

// tile reachable from `from` for `cls` that is closest to (x, y)
function reachableNear(map, from, cls, x, y) {
  const seen = new Uint8Array(map.w * map.h), q = [from];
  seen[from] = 1;
  let best = from, bestD = Infinity;
  for (let k = 0; k < q.length; k++) {
    const i = q[k], ix = map.xOf(i), iy = map.yOf(i), d = Math.hypot(ix - x, iy - y);
    if (d < bestD) { bestD = d; best = i; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = ix + dx, ny = iy + dy;
      if (!map.inBounds(nx, ny)) continue;
      const j = map.idx(nx, ny);
      if (!seen[j] && map.moveFactor(j, cls) > 0) { seen[j] = 1; q.push(j); }
    }
  }
  return { x: map.xOf(best), y: map.yOf(best) };
}

test('thirty tanks on open sand all reach the target area', () => {
  const world = flatWorld(48, 48, G.SAND, 5);
  const ids = [];
  for (let k = 0; k < 30; k++) ids.push(world.spawnUnit('combatTank', 'atreides', 2 + (k % 6), 2 + Math.floor(k / 6)).id);
  world.issue('atreides', { type: 'move', ids, x: 38, y: 38 });
  world.step();
  assert.ok(runUntil(world, () => idle(world, ids), 150) > 0, 'all settled');
  const far = ids.map((id) => world.units.get(id)).filter((u) => cheb(u, 38, 38) > 5);
  assert.equal(far.length, 0, `stopped short: ${far.map((u) => `${u.tx},${u.ty}`).join(' ')}`);
});

test('twenty tanks squeeze through a two-tile gap in a mountain wall', () => {
  const world = flatWorld(40, 30, G.ROCK, 2);
  const m = world.map;
  for (let y = 0; y < 30; y++) if (y !== 14 && y !== 15) m.ground[m.idx(20, y)] = G.MOUNTAIN;
  const ids = [];
  for (let k = 0; k < 20; k++) ids.push(world.spawnUnit('combatTank', 'atreides', 3 + (k % 5), 10 + Math.floor(k / 5)).id);
  world.issue('atreides', { type: 'move', ids, x: 32, y: 15 });
  world.step();
  assert.ok(runUntil(world, () => idle(world, ids), 180) > 0, 'all settled');
  const behind = ids.map((id) => world.units.get(id)).filter((u) => u.tx <= 20);
  assert.equal(behind.length, 0, `${behind.length} left on the wrong side`);
});

test('group orders on generated maps leave nobody far behind', () => {
  for (const seed of [1, 3, 4, 12]) {
    const { map, starts } = generateMap({ w: 64, h: 64, seed, players: 2 });
    const world = new World({ map, seed });
    world.addHouse('atreides');
    const ids = [];
    for (let k = 0; k < 20; k++) {
      const t = findFreeTile(world, starts[0].x, starts[0].y, 'wheeled', 8);
      ids.push(world.spawnUnit('quad', 'atreides', t.x, t.y).id);
    }
    const goal = reachableNear(map, map.idx(starts[0].x, starts[0].y), 'wheeled', 32, 32);
    world.issue('atreides', { type: 'move', ids, x: goal.x, y: goal.y });
    world.step();
    runUntil(world, () => idle(world, ids), 120);
    const far = ids.map((id) => world.units.get(id)).filter((u) => cheb(u, goal.x, goal.y) > 6);
    assert.equal(far.length, 0, `seed ${seed}: ${far.length} far from ${goal.x},${goal.y}`);
  }
});

test('head-on tanks in a corridor settle within five seconds of meeting', () => {
  const world = flatWorld(20, 7, G.MOUNTAIN);
  const m = world.map;
  for (let x = 0; x < 20; x++) m.ground[m.idx(x, 3)] = G.ROCK;
  const a = world.spawnUnit('combatTank', 'atreides', 2, 3, { heading: 0 });
  const b = world.spawnUnit('combatTank', 'atreides', 17, 3, { heading: Math.PI });
  world.issue('atreides', { type: 'move', ids: [a.id], x: 17, y: 3 });
  world.issue('atreides', { type: 'move', ids: [b.id], x: 2, y: 3 });
  let met = -1, settled = -1;
  for (let i = 0; i < 20 * 20 && settled < 0; i++) {
    world.step();
    if (met < 0 && Math.hypot(a.x - b.x, a.y - b.y) <= 1.05) met = world.time;
    if (met >= 0 && a.order.type === 'idle' && b.order.type === 'idle') settled = world.time;
  }
  assert.ok(met > 0 && settled > 0);
  assert.ok(settled - met <= 5, `settled ${(settled - met).toFixed(2)}s after meeting`);
});

test('group destinations stay on the group\'s side of a ridge and off mountains', () => {
  const world = flatWorld(40, 30, G.ROCK);
  const m = world.map;
  for (let y = 0; y < 30; y++) m.ground[m.idx(20, y)] = G.MOUNTAIN;
  for (let y = 12; y <= 16; y++) m.ground[m.idx(17, y)] = G.MOUNTAIN;
  const units = [];
  for (let k = 0; k < 16; k++) units.push(world.spawnUnit(k % 2 ? 'combatTank' : 'trooper', 'atreides', 3 + (k % 4), 10 + Math.floor(k / 4)));
  const slots = findDestinations(world, m.idx(18, 14), units);
  for (const i of slots.values()) {
    assert.ok(m.xOf(i) < 20, `slot ${m.xOf(i)},${m.yOf(i)} across the ridge`);
    assert.notEqual(m.ground[i], G.MOUNTAIN, `slot ${m.xOf(i)},${m.yOf(i)} on a mountain`);
  }
});

test('turrets swing back in line with the hull', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5, { heading: 0 });
  tank.turret = Math.PI;
  for (let i = 0; i < 20; i++) world.step();
  assert.ok(Math.abs(tank.turret - tank.heading) < 0.05, `turret ${tank.turret}`);
});
