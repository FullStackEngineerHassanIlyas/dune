// Carryall duty and player orders (src/sim/carryall.js): harvester support, battlefield recovery to the
// Repair Facility, where idle Carryalls wait, and what the player can tell a Carryall to do.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { callCarryall, deliverByAir } from '../src/sim/carryall.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

function airfield(w = 64, h = 32, house = 'atreides') {
  const world = flatWorld(w, h, G.ROCK);
  const at = world.houses.get(house);
  at.credits = 5000;
  at.startBuffer = 100000;
  world.spawnStructure('windtrap', house, 1, 1);
  const hq = world.spawnStructure('hiTech', house, 4, 4);
  const c = world.spawnUnit('carryall', house, 5, 5);
  c.home = hq.id;
  return { world, at, hq, c };
}

function spiceField(world, x0, y0, w = 6, h = 6) {
  const map = world.map;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { map.ground[map.idx(x, y)] = G.SAND; map.setSpice(map.idx(x, y), 500); }
}

const harvesterOf = (world) => [...world.units.values()].find((u) => u.typeId === 'harvester');

// ── battlefield recovery ─────────────────────────────────────────────────────────────────────────────

test('on duty, a Carryall lifts a badly worn vehicle to the Repair Facility; repaired, it heads back', () => {
  const { world, c } = airfield();
  const bay = world.spawnStructure('repair', 'atreides', 8, 20);   // entrance 9,22
  const t = world.spawnUnit('combatTank', 'atreides', 50, 12);
  t.hp = 90;   // 45 %
  assert.ok(runUntil(world, () => c.job?.unit === t.id, 3) >= 0, 'called out');
  assert.equal(t.order.type, 'repairAt');
  assert.ok(runUntil(world, () => t.inside === c.id, 20) > 0, 'picked up');
  assert.ok(runUntil(world, () => t.inside === bay.id, 30) > 0, 'set down by the bay and in');
  assert.ok(runUntil(world, () => !t.inside && t.hp === t.maxHp, 120) > 0, 'repaired and out');
  assert.ok(runUntil(world, () => Math.hypot(t.x - 50.5, t.y - 12.5) < 3, 60) > 0, `back where it was lifted (${t.tx},${t.ty})`);
  assert.deepEqual(checkInvariants(world), []);
});

test('a lightly worn vehicle, one at close quarters and any without a Repair Facility stay where they are', () => {
  const { world, c } = airfield();
  const t = world.spawnUnit('combatTank', 'atreides', 50, 12);
  t.hp = 80;
  run(world, 3);
  assert.ok(!c.job, 'no Repair Facility: nowhere to take it');
  world.spawnStructure('repair', 'atreides', 8, 20);
  const fine = world.spawnUnit('combatTank', 'atreides', 50, 24);
  fine.hp = 150;   // 75 %
  const foe = world.spawnUnit('combatTank', 'harkonnen', 52, 12);
  foe.hp = 5000;
  run(world, 2);
  assert.ok(!c.job, 'fighting at point-blank range, or hardly scratched');
  world.removeUnit(foe);
  assert.ok(runUntil(world, () => c.job?.unit === t.id, 3) >= 0, 'the fight over, it is fetched');
});

test('a vehicle the player sends elsewhere is dropped from recovery and left alone for a while', () => {
  const { world, c } = airfield();
  world.spawnStructure('repair', 'atreides', 8, 20);
  const t = world.spawnUnit('combatTank', 'atreides', 50, 12);
  t.hp = 90;
  assert.ok(runUntil(world, () => c.job?.unit === t.id, 3) >= 0);
  world.issue('atreides', { type: 'move', ids: [t.id], x: 56, y: 12 });
  run(world, 1);
  assert.equal(c.job, null, 'called off');
  run(world, 10);
  assert.notEqual(c.job?.unit, t.id, 'not straight back for it');
  assert.ok(runUntil(world, () => c.job?.unit === t.id, 15) > 0, 'but later, if it is still worn');
});

test('an AI house\'s Carryall does the same duty', () => {
  const { world, c } = airfield(64, 32, 'harkonnen');
  const bay = world.spawnStructure('repair', 'harkonnen', 8, 20);
  const t = world.spawnUnit('siegeTank', 'harkonnen', 50, 12);
  t.hp = 100;
  assert.ok(runUntil(world, () => t.inside === c.id, 20) > 0, 'picked up');
  assert.ok(runUntil(world, () => t.inside === bay.id, 30) > 0, 'into the bay');
});

// ── harvester support ────────────────────────────────────────────────────────────────────────────────

test('a trip of ten tiles or more is worth a lift, unless the Carryall is too far off to save time', () => {
  const { world, c } = airfield(96, 32);
  const t = world.spawnUnit('combatTank', 'atreides', 8, 12);
  assert.equal(callCarryall(world, t, { x: 21, y: 12 }), true, 'thirteen tiles');
  c.job = null;
  t.ferry = 0;
  const trike = world.spawnUnit('trike', 'atreides', 90, 28);
  assert.equal(callCarryall(world, trike, { x: 90, y: 16 }), false, 'a Trike at the far end is quicker on its own');
});

test('a Harvester already on a long drive is picked up once a Carryall comes free', () => {
  const { world, c } = airfield();
  spiceField(world, 36, 12);   // 26 tiles from the dock: within the Harvester's own search
  world.issue('atreides', { type: 'stop', ids: [c.id] });   // off duty for now
  world.step();
  world.spawnStructure('refinery', 'atreides', 8, 12);
  const h = harvesterOf(world);
  run(world, 3);
  assert.equal(h.harvest.state, 'toField');
  assert.ok(!h.inside && !c.job, 'driving on its own');
  world.issue('atreides', { type: 'guard', ids: [c.id] });   // Duty
  assert.ok(runUntil(world, () => h.inside === c.id, 20) > 0, 'lifted');
  assert.ok(runUntil(world, () => h.harvest.state === 'harvesting', 30) > 0);
  assert.ok(h.tx >= 33, `at the field (${h.tx},${h.ty})`);
});

test('a Harvester with no spice within its search is flown to a distant field it can drive home from', () => {
  const { world, c } = airfield(100, 32);
  spiceField(world, 84, 12);
  world.spawnStructure('refinery', 'atreides', 8, 12);   // dock 10,14: the field is 74 tiles off
  const h = harvesterOf(world);
  assert.ok(runUntil(world, () => h.inside === c.id, 30) > 0, 'picked up');
  assert.ok(runUntil(world, () => h.harvest.state === 'harvesting', 40) > 0, 'harvesting');
  assert.ok(h.tx >= 82, `at the far field (${h.tx},${h.ty})`);
});

test('idle Carryalls wait over the Refineries and the Repair Facility, not all over their factory', () => {
  const { world, c } = airfield(64, 40);
  const ref = world.spawnStructure('refinery', 'atreides', 20, 4);
  const bay = world.spawnStructure('repair', 'atreides', 30, 4);
  const d = world.spawnUnit('carryall', 'atreides', 5, 5);
  run(world, 10);
  const over = (u, s) => u.x >= s.x - 0.5 && u.x <= s.x + s.w + 0.5 && u.y >= s.y - 0.5 && u.y <= s.y + s.h + 0.5;
  assert.ok((over(c, ref) && over(d, bay)) || (over(c, bay) && over(d, ref)), `at ${c.x.toFixed(1)},${c.y.toFixed(1)} and ${d.x.toFixed(1)},${d.y.toFixed(1)}`);
});

// ── player orders ────────────────────────────────────────────────────────────────────────────────────

test('the player sends a Carryall somewhere: it flies there and works on from that spot', () => {
  const { world, c } = airfield();
  world.issue('atreides', { type: 'move', ids: [c.id], x: 40, y: 20 });
  world.step();
  assert.equal(c.manual, true, 'off duty on the way');
  assert.ok(runUntil(world, () => Math.hypot(c.x - 40.5, c.y - 20.5) < 0.1, 15) > 0, 'there');
  world.step();
  assert.equal(c.manual, false, 'back on duty');
  run(world, 5);
  assert.ok(Math.hypot(c.x - 40.5, c.y - 20.5) < 0.1, 'waiting over its new station');
  world.spawnStructure('repair', 'atreides', 8, 20);
  const t = world.spawnUnit('combatTank', 'atreides', 50, 12);
  t.hp = 60;
  assert.ok(runUntil(world, () => c.job?.unit === t.id, 3) >= 0, 'and still on duty');
});

test('a Carryall lifts the vehicle the player picks, holds it, and sets it down where the next click says', () => {
  const { world, c } = airfield();
  const t = world.spawnUnit('combatTank', 'atreides', 30, 20);
  world.issue('atreides', { type: 'lift', ids: [c.id], targetId: t.id });
  assert.ok(runUntil(world, () => t.inside === c.id, 20) > 0, 'lifted');
  run(world, 3);
  assert.equal(c.job?.stage, 'hold', 'an unharmed vehicle is held');
  assert.ok(Math.hypot(c.x - 30.5, c.y - 20.5) < 0.5, 'where it was picked up');
  world.issue('atreides', { type: 'move', ids: [c.id], x: 50, y: 10 });
  assert.ok(runUntil(world, () => !t.inside, 20) > 0, 'set down');
  assert.deepEqual([t.tx, t.ty], [50, 10]);
  assert.equal(t.order.type, 'idle');
  assert.equal(c.manual, false, 'back on duty');
  assert.deepEqual(checkInvariants(world), []);
});

test('a damaged vehicle the player has lifted is taken to the Repair Facility unless told otherwise', () => {
  const { world, c } = airfield();
  const bay = world.spawnStructure('repair', 'atreides', 8, 20);
  const t = world.spawnUnit('combatTank', 'atreides', 40, 10);
  t.hp = 170;   // lightly worn: duty alone would leave it
  world.issue('atreides', { type: 'lift', ids: [c.id], targetId: t.id });
  world.issue('atreides', { type: 'move', ids: [t.id], x: 44, y: 10 });   // the vehicle's own orders do not call the lift off
  assert.ok(runUntil(world, () => t.inside === c.id, 20) > 0, 'lifted');
  assert.ok(runUntil(world, () => t.inside === bay.id, 30) > 0, 'into the bay');
});

test('Stop holds a Carryall where it is and off duty; Duty sends it back to work', () => {
  const { world, c } = airfield();
  world.spawnStructure('repair', 'atreides', 8, 20);
  run(world, 1);
  world.issue('atreides', { type: 'stop', ids: [c.id] });
  world.step();
  const x = c.x, y = c.y;
  const t = world.spawnUnit('combatTank', 'atreides', 50, 12);
  t.hp = 60;
  run(world, 4);
  assert.equal(c.job, null, 'off duty');
  assert.ok(Math.hypot(c.x - x, c.y - y) < 0.01, 'holding its position');
  world.issue('atreides', { type: 'guard', ids: [c.id] });
  assert.ok(runUntil(world, () => c.job?.unit === t.id, 3) > 0, 'on duty again: off to the worn tank');
});

test('Stop with a load holds it; Drop sets it down right below', () => {
  const { world, c } = airfield();
  const t = world.spawnUnit('combatTank', 'atreides', 30, 20);
  world.issue('atreides', { type: 'lift', ids: [c.id], targetId: t.id });
  assert.ok(runUntil(world, () => t.inside === c.id, 20) > 0);
  world.issue('atreides', { type: 'move', ids: [c.id], x: 55, y: 20 });
  run(world, 2);
  world.issue('atreides', { type: 'stop', ids: [c.id] });
  run(world, 1);
  assert.equal(c.job?.stage, 'hold');
  const x = c.tx;
  assert.ok(x > 31 && x < 54, 'stopped on the way');
  world.issue('atreides', { type: 'deploy', ids: [c.id] });   // D: Drop
  assert.ok(runUntil(world, () => !t.inside, 5) > 0, 'set down');
  assert.ok(Math.abs(t.tx - x) <= 1 && Math.abs(t.ty - 20) <= 1, `below it (${t.tx},${t.ty})`);
});

test('a Harvester the player sets down on spice gets to work there', () => {
  const { world, c } = airfield();
  spiceField(world, 44, 20, 4, 4);
  const h = world.spawnUnit('harvester', 'atreides', 20, 10);
  world.issue('atreides', { type: 'stop', ids: [h.id] });
  world.issue('atreides', { type: 'lift', ids: [c.id], targetId: h.id });
  assert.ok(runUntil(world, () => h.inside === c.id, 20) > 0);
  world.issue('atreides', { type: 'move', ids: [c.id], x: 45, y: 21 });
  assert.ok(runUntil(world, () => !h.inside, 20) > 0);
  assert.ok(runUntil(world, () => h.harvest.state === 'harvesting', 5) >= 0, `harvesting at ${h.tx},${h.ty}`);
});

test('a loaded Carryall sent to the Repair Facility takes its worn load there', () => {
  const { world, c } = airfield();
  world.issue('atreides', { type: 'stop', ids: [c.id] });
  const t = world.spawnUnit('combatTank', 'atreides', 30, 10);
  t.hp = 150;
  world.issue('atreides', { type: 'lift', ids: [c.id], targetId: t.id });
  assert.ok(runUntil(world, () => t.inside === c.id, 20) > 0);
  world.issue('atreides', { type: 'move', ids: [c.id], x: 40, y: 10 });   // carry it off somewhere else first …
  run(world, 1);
  const bay = world.spawnStructure('repair', 'atreides', 8, 20);
  world.issue('atreides', { type: 'repairAt', ids: [c.id], structureId: bay.id });   // … then change the plan
  assert.ok(runUntil(world, () => t.inside === bay.id, 30) > 0, 'into the bay');
});

test('only a house\'s own Carryalls take orders: never a visitor, nor another house\'s', () => {
  const world = flatWorld(40, 30, G.ROCK);
  deliverByAir(world, 'atreides', 'harvester', { x: 20, y: 14 });
  const visitor = [...world.units.values()].find((u) => u.visitor);
  const other = world.spawnUnit('carryall', 'harkonnen', 30, 20);
  world.issue('atreides', { type: 'move', ids: [visitor.id, other.id], x: 5, y: 5 });
  world.issue('harkonnen', { type: 'move', ids: [visitor.id], x: 5, y: 5 });
  world.step();
  assert.equal(visitor.job.stage, 'carry', 'the visitor keeps to its delivery');
  assert.ok(!other.job && !other.manual, 'another house\'s Carryall ignores the order');
});
