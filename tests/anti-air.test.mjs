import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { killUnit } from '../src/sim/combat.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

function sky(type = 'ornithopter') {
  const world = flatWorld(40, 30, G.ROCK);
  world.fogOfWar = false;
  const o = world.spawnUnit(type, 'harkonnen', 20, 15);
  o.hp = o.maxHp = 100000;   // a target that lasts
  if (type === 'ornithopter') o.order = { type: 'guard', x: 20, y: 15 };   // circling over one spot; a lone Carryall just hovers
  return { world, o };
}
const shotsBy = (world, id) => world.events.drain().filter((e) => e.type === 'fired' && e.id === id).length;

test('only anti-air weapons engage aircraft', () => {
  const { world, o } = sky();
  const tank = world.spawnUnit('combatTank', 'atreides', 20, 17);
  const troopers = world.spawnUnit('troopers', 'atreides', 18, 16);
  const turret = world.spawnStructure('rocketTurret', 'atreides', 23, 16);
  world.spawnStructure('windtrap', 'atreides', 1, 1);
  run(world, 10);
  const events = world.events.drain();
  const by = (id) => events.filter((e) => e.type === 'fired' && e.id === id).length;
  assert.equal(by(tank.id), 0, 'a combat tank cannot shoot upwards');
  assert.ok(by(troopers.id) > 0 && by(turret.id) > 0, 'troopers and the rocket turret can');
  assert.ok(o.hp < o.maxHp);
});

test('shots at aircraft home in; inaccurate rockets hit about half the time and never hurt the ground below', () => {
  const { world, o } = sky('carryall');
  const launcher = world.spawnUnit('missileTank', 'atreides', 16, 15);
  const below = world.spawnUnit('combatTank', 'atreides', 20, 15);   // right under the target
  below.hp = below.maxHp = 100000;
  let hits = 0, misses = 0;
  for (let k = 0; k < 20 * 90; k++) {
    world.step();
    for (const e of world.events.drain()) if (e.type === 'impact' && e.projectile === 'rocket') { if (e.hit) hits++; else misses++; }
  }
  assert.ok(hits + misses >= 40, `${hits + misses} rockets`);
  assert.ok(hits / (hits + misses) > 0.3 && hits / (hits + misses) < 0.7, `${hits} of ${hits + misses} hit`);
  assert.equal(below.hp, below.maxHp, 'missed rockets burst in the air');
  assert.ok(launcher.order.type !== 'attack' || launcher.order.target.id === o.id);
});

test('units without anti-air ignore attack orders on aircraft and do not answer their fire', () => {
  const { world, o } = sky();
  const tank = world.spawnUnit('combatTank', 'atreides', 20, 17);
  world.issue('atreides', { type: 'attack', ids: [tank.id], targetKind: 'unit', targetId: o.id });
  world.step();
  assert.equal(tank.order.type, 'idle');
  world.onDamaged(tank, { house: 'harkonnen', id: o.id, kind: 'unit' });
  assert.equal(tank.order.type, 'idle', 'no retaliation against an aircraft');
});

test('a downed Carryall takes its load with it; aircraft blow up in the air', () => {
  const world = flatWorld(30, 30, G.ROCK);
  const c = world.spawnUnit('carryall', 'atreides', 10, 10);
  const h = world.spawnUnit('harvester', 'atreides', 10, 10, { inside: c.id });
  c.cargo = h.id;
  killUnit(world, c, { house: 'harkonnen', id: 0, kind: 'unit' });
  assert.equal(world.units.has(h.id), false);
  const events = world.events.drain();
  assert.ok(events.some((e) => e.type === 'unitDestroyed' && e.id === h.id && e.by === 'harkonnen'));
  assert.ok(events.some((e) => e.type === 'explosion' && e.alt > 1));
});

test('a shot at a vehicle that drives into a repair bay hits the building instead', () => {
  const world = flatWorld(32, 32, G.ROCK);
  const at = world.houses.get('atreides');
  at.credits = 1000;
  at.startBuffer = 5000;
  world.spawnStructure('windtrap', 'atreides', 2, 2);
  const bay = world.spawnStructure('repair', 'atreides', 10, 10);
  const t = world.spawnUnit('combatTank', 'atreides', 11, 13);
  t.hp = 100;
  world.issue('atreides', { type: 'repairAt', ids: [t.id], structureId: bay.id });
  assert.ok(runUntil(world, () => bay.bay?.state === 'repairing', 10) > 0);
  world.projectiles.set(999, { id: 999, weapon: 'cannon', projectile: 'shell', house: 'harkonnen', sourceId: 0, sourceKind: 'unit', x: t.x + 0.1, y: t.y, px: t.x, py: t.y, sx: t.x, sy: t.y, tx: t.x, ty: t.y, speed: 12, damage: 25, accurate: true, homing: false, target: { kind: 'unit', id: t.id } });
  const hp = t.hp, bayHp = bay.hp;
  world.step();
  assert.ok(t.hp >= hp, 'the vehicle in the bay is safe');
  assert.ok(bay.hp < bayHp, 'the building took the shell');
});

test('a shot at an aircraft that is gone before it lands bursts in the air', () => {
  const world = flatWorld(30, 30, G.ROCK);
  const silo = world.spawnStructure('silo', 'atreides', 10, 10);
  const c = world.spawnUnit('carryall', 'harkonnen', 10, 10);   // hovering over the silo
  world.projectiles.set(1, { id: 1, weapon: 'turretGun', projectile: 'shell', house: 'atreides', sourceId: 0, sourceKind: 'structure', x: 10.4, y: 10.5, px: 10.4, py: 10.5, sx: 10.4, sy: 10.5, tx: 10.5, ty: 10.5, speed: 12, damage: 20, accurate: true, homing: true, target: { kind: 'unit', id: c.id }, airburst: false, fromAlt: 0, toAlt: c.alt });
  world.removeUnit(c);   // brought down by another shot first
  const hp = silo.hp;
  world.step();
  assert.equal(silo.hp, hp, 'the silo below is not hit');
});

test('a homing rocket stops following a unit that is lifted away and lands where it was aimed', () => {
  const world = flatWorld(30, 30, G.ROCK);
  const t = world.spawnUnit('combatTank', 'harkonnen', 10, 10);
  world.projectiles.set(1, { id: 1, weapon: 'turretRocket', projectile: 'rocket', house: 'atreides', sourceId: 0, sourceKind: 'structure', x: 4.5, y: 10.5, px: 4.5, py: 10.5, sx: 4.5, sy: 10.5, tx: 10.5, ty: 10.5, speed: 1, damage: 30, accurate: true, homing: true, target: { kind: 'unit', id: t.id }, airburst: false, fromAlt: 0, toAlt: 0 });
  const c = world.spawnUnit('carryall', 'harkonnen', 20, 10);   // lifted away and carried off to 20,10
  world.map.unit[world.map.idx(10, 10)] = 0;
  t.inside = c.id;
  c.cargo = t.id;
  world.step();
  const p = world.projectiles.get(1);
  assert.deepEqual([p.tx, p.ty], [10.5, 10.5], 'it keeps to where it was aimed');
});
