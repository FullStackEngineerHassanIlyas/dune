import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../src/data/units.js';
import { isArmed, deviatable } from '../src/sim/combat.js';
import { deviate } from '../src/sim/specials.js';
import { buildOptions } from '../src/sim/tech.js';
import { flatWorld, run } from './helpers.mjs';

const gas = (world, house, x, y) => deviate(world, { house, x: x + 0.5, y: y + 0.5 });

test('gas turns enemy ground units close to the burst to the gasser\'s side; some are immune', () => {
  const world = flatWorld(16, 12);
  const near = world.spawnUnit('combatTank', 'atreides', 5, 5);
  const edge = world.spawnUnit('quad', 'atreides', 6, 5);
  const far = world.spawnUnit('combatTank', 'atreides', 8, 5);
  const immune = ['harvester', 'mcv', 'deviator'].map((t, k) => world.spawnUnit(t, 'atreides', 4 + k, 6));
  const orni = world.spawnUnit('ornithopter', 'atreides', 5, 4);
  const own = world.spawnUnit('combatTank', 'ordos', 4, 5);
  gas(world, 'ordos', 5, 5);
  assert.equal(near.house, 'ordos');
  assert.equal(edge.house, 'ordos');
  assert.equal(near.deviated.from, 'atreides');
  assert.equal(far.house, 'atreides');
  for (const u of [...immune, orni]) assert.equal(u.house, 'atreides', u.typeId);
  assert.equal(own.house, 'ordos');
  assert.equal(own.deviated, undefined);
  assert.ok(!deviatable({ kind: 'unit', typeId: 'combatTank', isGround: true, inside: 9 }), 'nor anything held in a bay or a Carryall');
});

test('a deviated unit takes its new side\'s orders and goes home after 40 s', () => {
  const world = flatWorld(16, 12);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5);
  gas(world, 'ordos', 5, 5);
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 1, y: 5 });
  world.issue('ordos', { type: 'move', ids: [tank.id], x: 10, y: 5 });
  run(world, 1);
  assert.equal(tank.order.type, 'move');
  assert.equal(tank.order.x, 10);
  run(world, 37);
  assert.equal(tank.house, 'ordos', 'still under the gas at 38 s');
  run(world, 2.5);
  assert.equal(tank.house, 'atreides');
  assert.equal(tank.deviated, null);
  assert.equal(tank.order.type, 'idle');
  assert.ok(world.events.drain().some((e) => e.type === 'unitReverted' && e.id === tank.id));
});

test('gas from the side a unit was taken from brings it straight home; a third side keeps the first owner on record', () => {
  const world = flatWorld(16, 12);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5);
  gas(world, 'ordos', 5, 5);
  gas(world, 'harkonnen', 5, 5);
  assert.equal(tank.house, 'harkonnen');
  assert.equal(tank.deviated.from, 'atreides');
  gas(world, 'atreides', 5, 5);
  assert.equal(tank.house, 'atreides');
  assert.equal(tank.deviated, null);
});

test('a deviated unit held in a bay or a Carryall goes home only once it is out', () => {
  const world = flatWorld(16, 12);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5);
  gas(world, 'ordos', 5, 5);
  tank.inside = 999;   // held (the flag is all the revert looks at)
  run(world, 41);
  assert.equal(tank.house, 'ordos');
  tank.inside = 0;
  run(world, 1);
  assert.equal(tank.house, 'atreides');
});

test('the Deviator fires gas only at units it can turn, never at buildings', () => {
  const world = flatWorld(20, 12);
  const dev = world.spawnUnit('deviator', 'ordos', 2, 6);
  assert.ok(isArmed(UNITS.deviator));
  world.spawnUnit('harvester', 'atreides', 5, 6);
  world.spawnStructure('windtrap', 'atreides', 5, 2);
  run(world, 3);
  assert.ok(!world.events.drain().some((e) => e.type === 'fired' && e.id === dev.id), 'nothing worth gassing');
  world.spawnUnit('combatTank', 'atreides', 7, 6);
  run(world, 3);
  const shots = world.events.drain().filter((e) => e.type === 'fired' && e.id === dev.id);
  assert.ok(shots.length >= 1 && shots.every((e) => e.projectile === 'gas'), JSON.stringify(shots));
});

test('an attack order at a Harvester or a building leaves a Deviator be', () => {
  const world = flatWorld(20, 12);
  const dev = world.spawnUnit('deviator', 'ordos', 2, 6);
  const harv = world.spawnUnit('harvester', 'atreides', 5, 6);
  const trap = world.spawnStructure('windtrap', 'atreides', 5, 2);
  const tank = world.spawnUnit('combatTank', 'atreides', 9, 6);
  world.issue('ordos', { type: 'attack', ids: [dev.id], targetKind: 'unit', targetId: harv.id });
  world.issue('ordos', { type: 'attack', ids: [dev.id], targetKind: 'structure', targetId: trap.id });
  world.step();
  assert.notEqual(dev.order.type, 'attack');
  world.issue('ordos', { type: 'attack', ids: [dev.id], targetKind: 'unit', targetId: tank.id });
  world.step();
  assert.equal(dev.order.type, 'attack');
});

test('the Deviator joins the Ordos roster once a House of IX stands', () => {
  const world = flatWorld(20, 20);
  world.spawnStructure('heavyFactory', 'ordos', 1, 1);
  world.spawnStructure('ix', 'ordos', 6, 1);
  assert.ok(buildOptions(world, 'ordos').heavy.includes('deviator'));
});
