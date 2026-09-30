import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { UNITS } from '../src/data/units.js';
import { killUnit } from '../src/sim/combat.js';
import { beside } from '../src/sim/capture.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

const units = (world, typeId) => [...world.units.values()].filter((u) => u.typeId === typeId);
function charged(house) {
  const world = flatWorld(40, 30, G.ROCK);
  const s = world.spawnStructure('palace', house, 2, 2);
  s.readyAt = 0;
  return { world, s };
}

test('five Fremen squads rise from the sand near the chosen spot and fight for the caller on their own', () => {
  const { world, s } = charged('atreides');
  const m = world.map;
  for (let y = 12; y <= 18; y++) for (let x = 0; x < m.w; x++) m.ground[m.idx(x, y)] = G.SAND;
  m.revision++;
  world.issue('atreides', { type: 'palace', x: 20, y: 10 });   // on rock: the nearest sand is two tiles south
  world.step();
  const fremen = units(world, 'fremen');
  assert.equal(fremen.length, 5);
  for (const u of fremen) {
    assert.equal(u.house, 'atreides');
    assert.ok(m.isSand(m.idx(u.tx, u.ty)) && Math.max(Math.abs(u.tx - 20), Math.abs(u.ty - 10)) <= 8, `${u.tx},${u.ty}`);
  }
  assert.ok(UNITS.fremen.autonomous && s.readyAt > world.time + 239);
  world.issue('atreides', { type: 'move', ids: fremen.map((u) => u.id), x: 1, y: 20 });
  run(world, 0.5);
  assert.ok(fremen.every((u) => u.order.type === 'idle'), 'they take no orders');
});

test('Fremen hunt the nearest enemy wherever it is', () => {
  const { world } = charged('atreides');
  const prey = world.spawnUnit('quad', 'harkonnen', 36, 26);
  world.spawnUnit('combatTank', 'harkonnen', 38, 2);
  world.issue('atreides', { type: 'palace', x: 30, y: 20 });
  run(world, 2);
  const fremen = units(world, 'fremen');
  assert.ok(fremen.length > 0 && fremen.every((u) => u.order.type === 'attack' && u.order.target.id === prey.id), JSON.stringify(fremen.map((u) => u.order)));
});

test('the Saboteur walks out beside the Palace and takes orders', () => {
  const { world, s } = charged('ordos');
  world.issue('ordos', { type: 'palace' });
  world.step();
  const [sab] = units(world, 'saboteur');
  assert.ok(sab && sab.house === 'ordos' && beside(sab, s));
  assert.ok(s.readyAt > world.time + 239);
  world.issue('ordos', { type: 'move', ids: [sab.id], x: 20, y: 20 });
  world.step();
  assert.equal(sab.order.type, 'move');
});

test('a Saboteur sent into an enemy building crosses the walls round it and blows it up', () => {
  const world = flatWorld(30, 20);
  for (let x = 18; x <= 24; x++) for (const y of [6, 11]) world.spawnStructure('wall', 'harkonnen', x, y);
  for (let y = 7; y <= 10; y++) for (const x of [18, 24]) world.spawnStructure('wall', 'harkonnen', x, y);
  const factory = world.spawnStructure('heavyFactory', 'harkonnen', 20, 8);
  const sab = world.spawnUnit('saboteur', 'ordos', 5, 9);
  world.issue('ordos', { type: 'sabotage', ids: [sab.id], structureId: factory.id });
  assert.ok(runUntil(world, () => !world.units.has(sab.id), 40) > 0, 'it got there');
  assert.ok(!world.structures.has(factory.id), 'and the factory is gone');
  assert.ok(world.events.drain().some((e) => e.type === 'unitDestroyed' && e.id === sab.id && e.cause === 'detonated'));
  assert.equal(world.houses.get('ordos').stats.unitsLost, 0, 'a Saboteur that did its job is not a loss');
});

test('a Saboteur shot down still goes off: 300 round where it fell', () => {
  const world = flatWorld(20, 12);
  const sab = world.spawnUnit('saboteur', 'ordos', 5, 5);
  const near = world.spawnUnit('combatTank', 'harkonnen', 6, 5);
  killUnit(world, sab, { house: 'harkonnen', id: near.id, kind: 'unit' });
  assert.equal(near.hp, near.maxHp - 150);
});

test('walls and own buildings are no work for a Saboteur', () => {
  const world = flatWorld(20, 12);
  const sab = world.spawnUnit('saboteur', 'ordos', 5, 5);
  const wall = world.spawnStructure('wall', 'harkonnen', 9, 5);
  const own = world.spawnStructure('windtrap', 'ordos', 12, 5);
  for (const s of [wall, own]) world.issue('ordos', { type: 'sabotage', ids: [sab.id], structureId: s.id });
  world.step();
  assert.equal(sab.order.type, 'idle');
});
