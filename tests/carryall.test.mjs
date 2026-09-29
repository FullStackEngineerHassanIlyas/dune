import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { callCarryall } from '../src/sim/carryall.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

function airfield(w = 48, h = 32) {
  const world = flatWorld(w, h, G.ROCK);
  const at = world.houses.get('atreides');
  at.credits = 5000;
  at.startBuffer = 100000;
  world.spawnStructure('windtrap', 'atreides', 1, 1);
  const hq = world.spawnStructure('hiTech', 'atreides', 4, 4);
  const c = world.spawnUnit('carryall', 'atreides', 5, 5);
  c.home = hq.id;
  return { world, at, hq, c };
}

test('the free Harvester of a new Refinery is flown in from the map edge', () => {
  const world = flatWorld(40, 30, G.ROCK);
  world.rules.airDelivery = true;
  const ref = world.spawnStructure('refinery', 'atreides', 20, 12);   // dock 22,14
  const c = [...world.units.values()].find((u) => u.typeId === 'carryall');
  const h = [...world.units.values()].find((u) => u.typeId === 'harvester');
  assert.ok(c && h && c.visitor && h.inside === c.id && c.cargo === h.id, 'a visiting Carryall brings it');
  assert.ok(c.tx === 0 || c.ty === 0 || c.tx === 39 || c.ty === 29, 'from the map edge');
  assert.deepEqual(checkInvariants(world), []);
  assert.ok(runUntil(world, () => !h.inside, 30) > 0, 'set down');
  assert.deepEqual([h.tx, h.ty], [22, 14]);
  assert.equal(world.map.unit[world.map.idx(22, 14)], h.id);
  assert.ok(world.events.drain().some((e) => e.type === 'eva' && e.key === 'harvesterDeployed'));
  assert.ok(runUntil(world, () => !world.units.has(c.id), 30) > 0, 'the visitor flies off again');
  assert.equal(ref.dockedBy || 0, 0);
});

test('an idle Carryall ferries a harvester on a long trip to its spice field', () => {
  const { world, c } = airfield(64, 32);
  const map = world.map;
  for (let y = 12; y < 20; y++) for (let x = 36; x < 44; x++) { map.ground[map.idx(x, y)] = G.SAND; map.setSpice(map.idx(x, y), 500); }
  world.spawnStructure('refinery', 'atreides', 8, 12);
  const h = [...world.units.values()].find((u) => u.typeId === 'harvester');
  assert.ok(runUntil(world, () => h.inside === c.id, 30) > 0, 'picked up');
  assert.ok(runUntil(world, () => !h.inside, 30) > 0, 'set down');
  assert.ok(h.tx >= 33, `near the field at ${h.tx},${h.ty}`);
  assert.ok(runUntil(world, () => h.harvest.state === 'harvesting', 20) >= 0, 'harvesting right where it was set down');
  assert.ok(runUntil(world, () => !c.job && Math.hypot(c.x - 5.5, c.y - 5) < 2, 30) > 0, 'back home');
});

test('a Carryall flies a damaged vehicle to a distant Repair Facility', () => {
  const { world, c } = airfield(64, 32);
  const bay = world.spawnStructure('repair', 'atreides', 8, 20);
  const t = world.spawnUnit('combatTank', 'atreides', 58, 26);
  t.hp = 60;
  world.issue('atreides', { type: 'repairAt', ids: [t.id], structureId: bay.id });
  assert.ok(runUntil(world, () => t.inside === c.id, 20) > 0, 'picked up');
  assert.ok(runUntil(world, () => t.inside === bay.id, 40) > 0, 'set down by the bay and in');
});

test('a Carryall gives a pickup up when the unit no longer needs it', () => {
  const { world, c } = airfield(64, 32);
  const t = world.spawnUnit('combatTank', 'atreides', 58, 26);
  t.hp = 60;
  const bay = world.spawnStructure('repair', 'atreides', 8, 20);
  world.issue('atreides', { type: 'repairAt', ids: [t.id], structureId: bay.id });
  world.step();
  assert.equal(c.job?.unit, t.id);
  world.issue('atreides', { type: 'move', ids: [t.id], x: 60, y: 28 });
  run(world, 1);
  assert.equal(c.job, null, 'a new order: no pickup');
  assert.equal(t.ferry, 0);
  world.issue('atreides', { type: 'repairAt', ids: [t.id], structureId: bay.id });
  world.step();
  world.removeUnit(t);
  run(world, 1);
  assert.equal(c.job, null, 'gone: no pickup');
});

test('a Carryall sets down only on a free tile', () => {
  const { world, c } = airfield(64, 32);
  const t = world.spawnUnit('combatTank', 'atreides', 50, 20);
  const blocker = world.spawnUnit('combatTank', 'atreides', 20, 20);
  assert.ok(callCarryall(world, t, { x: 20, y: 20 }));
  assert.ok(runUntil(world, () => t.inside === c.id, 20) > 0);
  assert.ok(runUntil(world, () => !t.inside, 20) > 0);
  assert.notDeepEqual([t.tx, t.ty], [blocker.tx, blocker.ty]);
  assert.ok(Math.max(Math.abs(t.tx - 20), Math.abs(t.ty - 20)) <= 2, 'right beside it');
  assert.deepEqual(checkInvariants(world), []);
});

test('short trips, busy Carryalls and infantry get no ferry', () => {
  const { world, c } = airfield(64, 32);
  const near = world.spawnUnit('combatTank', 'atreides', 12, 12);
  assert.equal(callCarryall(world, near, { x: 20, y: 12 }), false, 'eight tiles: drive');
  const soldier = world.spawnUnit('soldier', 'atreides', 50, 20);
  assert.equal(callCarryall(world, soldier, { x: 8, y: 20 }), false);
  const a = world.spawnUnit('combatTank', 'atreides', 50, 22), b = world.spawnUnit('combatTank', 'atreides', 50, 24);
  assert.equal(callCarryall(world, a, { x: 8, y: 20 }), true);
  assert.equal(callCarryall(world, b, { x: 8, y: 20 }), false, 'the only Carryall is taken');
  assert.equal(c.job.unit, a.id);
});
