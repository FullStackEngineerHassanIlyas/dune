import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { destroyStructure } from '../src/sim/combat.js';
import { splash } from '../src/sim/aftermath.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

function bay(credits = 5000) {
  const world = flatWorld(32, 32, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = credits;
  h.startBuffer = 100000;
  world.spawnStructure('windtrap', 'atreides', 2, 2);
  const s = world.spawnStructure('repair', 'atreides', 10, 10);   // entrance 11,12; pad 11.5,11
  return { world, h, s };
}
const tank = (world, x, y, hp = 100) => { const u = world.spawnUnit('combatTank', 'atreides', x, y); u.hp = hp; return u; };
const sendIn = (world, units, s) => world.issue('atreides', { type: 'repairAt', ids: units.map((u) => u.id), structureId: s.id });

test('a damaged tank drives into the bay, is repaired for its damage and drives out', () => {
  const { world, h, s } = bay();
  const u = tank(world, 11, 20);
  sendIn(world, [u], s);
  assert.ok(runUntil(world, () => u.inside === s.id, 30) > 0, 'it went in');
  assert.equal(s.occupant, u.id);
  assert.equal(world.map.unit[world.map.idx(11, 12)], 0, 'the entrance is free for the next one');
  assert.deepEqual(checkInvariants(world), []);
  const before = h.credits;
  const t = runUntil(world, () => !u.inside, 40);
  assert.ok(t > 15 && t < 18, `half a repair takes half the build time (14.4 s) plus driving on and off: ${t}`);
  assert.equal(u.hp, 200);
  assert.ok(Math.abs(before - h.credits - 37.5) < 0.5, `paid ${before - h.credits}`);
  assert.equal(u.order.type, 'idle');
  assert.equal(world.map.unit[world.map.idx(u.tx, u.ty)], u.id);
  assert.deepEqual(checkInvariants(world), []);
});

test('a second vehicle waits by the entrance and goes in when the bay is free', () => {
  const { world, s } = bay();
  const a = tank(world, 11, 18), b = tank(world, 13, 18);
  sendIn(world, [a, b], s);
  assert.ok(runUntil(world, () => !!s.occupant, 30) > 0);
  const first = world.units.get(s.occupant), second = first === a ? b : a;
  run(world, 5);
  assert.ok(!second.inside && Math.max(Math.abs(second.tx - 11), Math.abs(second.ty - 12)) <= 3, `waits near the entrance at ${second.tx},${second.ty}`);
  assert.ok(runUntil(world, () => second.inside === s.id, 40) > 0, 'in after the first');
  assert.equal(first.hp, first.maxHp);
  assert.ok(runUntil(world, () => !second.inside, 40) > 0);
  assert.equal(second.hp, second.maxHp);
});

test('a unit parked on the entrance does not keep others out', () => {
  const { world, s } = bay();
  world.spawnUnit('combatTank', 'atreides', 11, 12);
  const u = tank(world, 11, 18);
  sendIn(world, [u], s);
  assert.ok(runUntil(world, () => u.inside === s.id, 40) > 0);
});

test('with the entrance walled in, vehicles go in and out by another side', () => {
  const { world, s } = bay();
  world.spawnStructure('silo', 'atreides', 9, 12);
  world.spawnStructure('silo', 'atreides', 12, 12);
  world.spawnStructure('wall', 'atreides', 11, 13);   // 11,12 is now a closed pocket
  const u = tank(world, 16, 11);
  sendIn(world, [u], s);
  assert.ok(runUntil(world, () => u.inside === s.id, 30) > 0, 'in from the side');
  assert.ok(runUntil(world, () => !u.inside, 40) > 0, 'out again');
  assert.notDeepEqual([u.tx, u.ty], [11, 12], 'not into the pocket');
  assert.equal(u.hp, u.maxHp);
});

test('only damaged vehicles of the owner go in', () => {
  const { world, s } = bay();
  const soldier = world.spawnUnit('soldier', 'atreides', 5, 20);
  soldier.hp = 5;
  const healthy = tank(world, 7, 20, 200);
  const foe = world.spawnUnit('combatTank', 'harkonnen', 9, 26);
  foe.hp = 50;
  const worn = tank(world, 3, 24);
  sendIn(world, [soldier, healthy, worn], s);
  world.issue('harkonnen', { type: 'repairAt', ids: [foe.id], structureId: s.id });
  world.step();
  assert.deepEqual([soldier.order.type, healthy.order.type, foe.order.type, worn.order.type], ['idle', 'idle', 'idle', 'repairAt']);
});

test('inside the bay a vehicle cannot be targeted, splashed or ordered about', () => {
  const { world, s } = bay();
  const u = tank(world, 11, 14);
  sendIn(world, [u], s);
  assert.ok(runUntil(world, () => u.inside === s.id, 20) > 0);
  const foe = world.spawnUnit('combatTank', 'harkonnen', 20, 11);
  world.issue('harkonnen', { type: 'attack', ids: [foe.id], targetKind: 'unit', targetId: u.id });
  world.issue('atreides', { type: 'move', ids: [u.id], x: 2, y: 20 });
  world.step();
  assert.equal(foe.order.type, 'idle', 'no valid target');
  assert.equal(u.order.type, 'repairAt');
  const hp = u.hp;
  splash(world, u.x, u.y, 100, 1.5, null);
  assert.equal(u.hp, hp);
  assert.ok(s.hp < s.maxHp, 'the building took the blast');
});

test('a destroyed bay takes the vehicle inside with it; a sold one pushes it out', () => {
  const one = bay();
  const u = tank(one.world, 11, 14);
  sendIn(one.world, [u], one.s);
  assert.ok(runUntil(one.world, () => u.inside === one.s.id, 20) > 0);
  one.world.events.drain();
  destroyStructure(one.world, one.s, { house: 'harkonnen', id: 0, kind: 'unit' });
  assert.equal(one.world.units.has(u.id), false);
  assert.equal(one.world.events.drain().find((e) => e.type === 'unitDestroyed' && e.id === u.id)?.by, 'harkonnen');
  assert.deepEqual(checkInvariants(one.world), []);

  const two = bay();
  const v = tank(two.world, 11, 14);
  sendIn(two.world, [v], two.s);
  assert.ok(runUntil(two.world, () => v.inside === two.s.id, 20) > 0);
  run(two.world, 3);
  two.world.issue('atreides', { type: 'sell', structureId: two.s.id });
  two.world.step();
  assert.ok(two.world.units.has(v.id) && !v.inside, 'out and alive');
  assert.equal(two.world.map.unit[two.world.map.idx(v.tx, v.ty)], v.id);
  assert.ok(v.hp < v.maxHp, 'the repair was cut short');
  assert.deepEqual(checkInvariants(two.world), []);
});

test('without credits the repair pauses and picks up again', () => {
  const { world, h, s } = bay(0);
  const u = tank(world, 11, 14);
  sendIn(world, [u], s);
  assert.ok(runUntil(world, () => u.inside === s.id, 20) > 0);
  run(world, 5);
  assert.equal(u.hp, 100);
  assert.ok(world.events.drain().some((e) => e.type === 'eva' && e.key === 'insufficientFunds'));
  h.credits = 1000;
  assert.ok(runUntil(world, () => u.hp === 200, 30) > 0);
});

test('a harvester goes back to its routine after the repair', () => {
  const { world, s } = bay();
  const hv = world.spawnUnit('harvester', 'atreides', 11, 16);
  hv.hp = 75;
  sendIn(world, [hv], s);
  assert.ok(runUntil(world, () => hv.inside === s.id, 20) > 0);
  assert.ok(runUntil(world, () => !hv.inside, 40) > 0);
  assert.equal(hv.order.type, 'harvest');
  assert.equal(hv.hp, hv.maxHp);
});

test('a repaired vehicle never drives out into a closed pocket', () => {
  const { world, s } = bay();
  world.spawnStructure('silo', 'atreides', 9, 12);
  world.spawnStructure('silo', 'atreides', 12, 12);
  world.spawnStructure('wall', 'atreides', 11, 13);   // 11,12 is a closed pocket
  const a = tank(world, 16, 11), b = tank(world, 17, 11);
  sendIn(world, [a], s);
  assert.ok(runUntil(world, () => a.inside === s.id, 30) > 0);
  sendIn(world, [b], s);   // b waits on the tile a came in by
  assert.ok(runUntil(world, () => !a.inside, 40) > 0, 'a is out');
  assert.notDeepEqual([a.tx, a.ty], [11, 12], 'not into the pocket');
  assert.ok(world.reach.connected(world.map.idx(a.tx, a.ty), world.map.idx(20, 20), 'tracked'), 'a can drive away');
});

test('a harvester sent for repairs goes back to harvesting however the trip ends', () => {
  const one = bay();
  const h1 = one.world.spawnUnit('harvester', 'atreides', 11, 20);
  h1.hp = 75;
  sendIn(one.world, [h1], one.s);
  run(one.world, 1);
  one.world.removeStructure(one.s);   // the bay is gone before it gets there
  run(one.world, 1);
  assert.equal(h1.order.type, 'harvest');
  const two = bay();
  const h2 = two.world.spawnUnit('harvester', 'atreides', 11, 14);
  h2.hp = 75;
  sendIn(two.world, [h2], two.s);
  assert.ok(runUntil(two.world, () => h2.inside === two.s.id, 20) > 0);
  two.world.issue('atreides', { type: 'sell', structureId: two.s.id });   // pushed out unfinished
  two.world.step();
  assert.equal(h2.order.type, 'harvest');
});

test('a vehicle driving out of the bay is not nudged off its way', () => {
  const { world, s } = bay();
  const hv = world.spawnUnit('harvester', 'atreides', 11, 13);
  hv.hp = 140;
  sendIn(world, [hv], s);
  assert.ok(runUntil(world, () => s.bay?.state === 'leaving', 30) > 0);
  const map = world.map;
  const t = world.spawnUnit('combatTank', 'atreides', 10, 12, { heading: 0 });   // about to drive through the tile it holds
  Object.assign(t, { path: [map.idx(11, 12), map.idx(12, 12)], pathIndex: 0, pathState: 'ready', goal: map.idx(12, 12), order: { type: 'move', x: 12, y: 12 } });
  assert.ok(runUntil(world, () => !hv.inside, 5) > 0);
  assert.equal(hv.order.type, 'harvest');
});
