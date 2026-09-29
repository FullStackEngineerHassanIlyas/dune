import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { GUARD_LEASH } from '../src/data/tuning.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

const tough = (u) => { u.hp = u.maxHp = 100000; return u; };

test('an attack order chases the target and destroys it', () => {
  const world = flatWorld(24, 16, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 8, { heading: 0 });
  const mcv = world.spawnUnit('mcv', 'harkonnen', 16, 8);
  world.issue('atreides', { type: 'attack', ids: [tank.id], targetKind: 'unit', targetId: mcv.id });
  assert.ok(runUntil(world, () => !world.units.has(mcv.id), 45) > 0);
  world.step();   // the order notices its target is gone on the next tick
  assert.equal(tank.order.type, 'idle');
  assert.ok(tank.tx >= 11, 'drove into range');
});

test('attack-move stops to fight on the way, then carries on', () => {
  const world = flatWorld(32, 16, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 8, { heading: 0 });
  const quad = world.spawnUnit('quad', 'harkonnen', 12, 6);
  world.issue('atreides', { type: 'attackMove', ids: [tank.id], x: 24, y: 8 });
  assert.ok(runUntil(world, () => !world.units.has(quad.id), 40) > 0, 'the quad fell on the way');
  assert.ok(runUntil(world, () => tank.order.type === 'idle', 40) >= 0);
  assert.ok(Math.max(Math.abs(tank.tx - 24), Math.abs(tank.ty - 8)) <= 1, `arrived at ${tank.tx},${tank.ty}`);
});

test('a guard chases intruders no further than its leash, then walks back', () => {
  const world = flatWorld(40, 16, G.ROCK);
  world.fogOfWar = false;   // a guard only sees what its side sees: here, everything
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 8, { heading: 0 });
  world.issue('atreides', { type: 'guard', ids: [tank.id] });
  const mcv = tough(world.spawnUnit('mcv', 'harkonnen', 11, 8));
  world.step();
  world.issue('harkonnen', { type: 'move', ids: [mcv.id], x: 36, y: 8 });
  let furthest = 0;
  for (let i = 0; i < 40 * 20; i++) { world.step(); furthest = Math.max(furthest, tank.tx); }
  assert.ok(furthest > 6, 'it went after the intruder');
  assert.ok(furthest <= 5 + GUARD_LEASH + 4, `stayed on its leash (x ≤ ${furthest})`);
  assert.ok(Math.max(Math.abs(tank.tx - 5), Math.abs(tank.ty - 8)) <= 1, `back at its post, at ${tank.tx},${tank.ty}`);
});

test('an idle unit answers fire from beyond its own range', () => {
  const world = flatWorld(32, 16, G.ROCK);
  world.houses.get('harkonnen').isAI = true;
  const tank = world.spawnUnit('combatTank', 'atreides', 4, 8, { heading: 0 });
  const launcher = world.spawnUnit('missileTank', 'harkonnen', 11, 8, { heading: Math.PI });
  assert.ok(runUntil(world, () => tank.order.type === 'attack', 20) > 0, 'it took the hit personally');
  assert.equal(tank.order.target.id, launcher.id);
});

test('attacking an unreachable target gives up', () => {
  const world = flatWorld(32, 20, G.ROCK);
  const m = world.map;
  for (let y = 4; y <= 14; y++) for (let x = 16; x <= 26; x++) if (Math.max(Math.abs(x - 21), Math.abs(y - 9)) >= 4) m.ground[m.idx(x, y)] = G.MOUNTAIN;
  m.revision++;
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 9, { heading: 0 });
  const island = tough(world.spawnUnit('mcv', 'harkonnen', 21, 9));
  world.issue('atreides', { type: 'attack', ids: [tank.id], targetKind: 'unit', targetId: island.id });
  world.step();
  assert.equal(tank.order.type, 'attack');
  assert.ok(runUntil(world, () => tank.order.type === 'idle', 60) > 0, 'gave up');
  assert.ok(world.events.drain().some((e) => e.type === 'attackAbandoned' && e.id === tank.id));
});

test('own units and the ground are attacked only when forced; foreign commands are ignored', () => {
  const world = flatWorld(24, 16, G.ROCK);
  const a = world.spawnUnit('combatTank', 'atreides', 4, 8, { heading: 0 });
  const b = world.spawnUnit('combatTank', 'atreides', 6, 8);
  world.issue('atreides', { type: 'attack', ids: [a.id], targetKind: 'unit', targetId: b.id });
  world.issue('atreides', { type: 'attack', ids: [a.id], x: 9, y: 8 });
  world.issue('harkonnen', { type: 'attack', ids: [a.id], targetKind: 'unit', targetId: b.id, force: true });
  world.step();
  assert.equal(a.order.type, 'idle');
  world.issue('atreides', { type: 'attack', ids: [a.id], x: 9, y: 8, force: true });
  world.step();
  assert.deepEqual(a.order.target, { kind: 'tile', x: 9, y: 8 });
  run(world, 4);
  assert.ok(world.events.drain().some((e) => e.type === 'fired' && e.id === a.id));
  assert.equal(b.hp, b.maxHp, 'nothing hit the friend');
});
