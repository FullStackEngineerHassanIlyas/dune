import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { damage, killUnit, destroyStructure } from '../src/sim/combat.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

const tough = (u) => { u.hp = u.maxHp = 100000; return u; };
const fired = (world, id) => world.events.drain().filter((e) => e.type === 'fired' && e.id === id);

test('a gun turret rests facing north and shoots enemy ground units in range', () => {
  const world = flatWorld(24, 16, G.ROCK);
  world.spawnStructure('windtrap', 'atreides', 2, 2);
  const gun = world.spawnStructure('turret', 'atreides', 10, 8);
  world.step();
  assert.ok(Math.abs(gun.turret + Math.PI / 2) < 1e-9);
  const quad = world.spawnUnit('quad', 'harkonnen', 13, 8);
  run(world, 6);
  assert.ok(quad.hp < quad.maxHp, 'hit');
  assert.ok(Math.abs(gun.turret) < 0.2, 'turned east towards it');
});

test('turrets fire at half rate on low power', () => {
  const shots = (powered) => {
    const world = flatWorld(24, 16, G.ROCK);
    if (powered) world.spawnStructure('windtrap', 'atreides', 2, 2);
    const gun = world.spawnStructure('turret', 'atreides', 10, 8);
    tough(world.spawnUnit('mcv', 'harkonnen', 13, 8));
    run(world, 20);
    return fired(world, gun.id).length;
  };
  const full = shots(true), low = shots(false);
  assert.ok(full >= 9 && Math.abs(low - full / 2) <= 1.5, `full ${full}, low ${low}`);
});

test('the rocket turret uses its gun up close and rockets further out', () => {
  const weaponAt = (dx) => {
    const world = flatWorld(24, 16, G.ROCK);
    world.spawnStructure('windtrap', 'atreides', 2, 2);
    const rt = world.spawnStructure('rocketTurret', 'atreides', 10, 8);
    tough(world.spawnUnit('mcv', 'harkonnen', 10 + dx, 8));
    run(world, 5);
    return fired(world, rt.id)[0]?.weapon;
  };
  assert.equal(weaponAt(2), 'turretGun');
  assert.equal(weaponAt(6), 'turretRocket');
});

test('destroying a refinery burns its share of the owner\'s credits', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.houses.get('atreides');
  h.startBuffer = 0;
  const a = world.spawnStructure('refinery', 'atreides', 2, 2);
  world.spawnStructure('refinery', 'atreides', 10, 2);
  h.credits = 2000;
  destroyStructure(world, a, { house: 'harkonnen', id: 0, kind: 'unit' });
  assert.ok(Math.abs(h.credits - 1000) < 1, `credits ${h.credits}`);
  assert.equal(world.houses.get('harkonnen').stats.structuresKilled, 1);
  assert.equal(h.stats.structuresLost, 1);
});

test('a destroyed harvester spills its load as spice', () => {
  const world = flatWorld(24, 24, G.SAND);
  const u = world.spawnUnit('harvester', 'atreides', 12, 12);
  u.harvest.load = 700;
  killUnit(world, u, null);
  let tiles = 0;
  for (let i = 0; i < world.map.spice.length; i++) if (world.map.spice[i] > 0) tiles++;
  assert.ok(tiles >= 25 && tiles <= 45, `${tiles} spice tiles`);
});

test('exploding vehicles hurt their neighbours; friendly fire hurts but never scores', () => {
  const world = flatWorld(24, 16, G.ROCK);
  const trike = world.spawnUnit('trike', 'atreides', 8, 8);
  const tank = world.spawnUnit('combatTank', 'atreides', 9, 8);
  damage(world, trike, 1000, { house: 'harkonnen', id: 0, kind: 'unit' });
  assert.ok(tank.hp < tank.maxHp, 'the blast reached the tank');
  assert.ok(world.events.drain().some((e) => e.type === 'explosion'));
  assert.equal(world.houses.get('harkonnen').stats.unitsKilled, 1);
  const own = world.spawnUnit('trike', 'atreides', 4, 4);
  damage(world, own, 1000, { house: 'atreides', id: tank.id, kind: 'unit' });
  const a = world.houses.get('atreides').stats;
  assert.equal(a.unitsKilled, 0, 'no credit for killing your own');
  assert.equal(a.unitsLost, 2);
});

function corridor() {   // a one-tile pass: the only way east runs over the soldier
  const world = flatWorld(24, 16, G.ROCK);
  const m = world.map;
  for (let x = 4; x <= 8; x++) for (let y = 0; y < 16; y++) if (y !== 8) m.ground[m.idx(x, y)] = G.MOUNTAIN;
  m.revision++;
  return world;
}

test('tanks crush enemy infantry, never their own', () => {
  const world = corridor();
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 8, { heading: 0 });
  const enemy = tough(world.spawnUnit('soldier', 'harkonnen', 6, 8));
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 12, y: 8 });
  assert.ok(runUntil(world, () => !world.units.has(enemy.id), 20) > 0, 'crushed');
  assert.ok(world.events.drain().some((e) => e.type === 'unitDestroyed' && e.cause === 'crushed'));
  const w2 = corridor();
  const t2 = w2.spawnUnit('combatTank', 'atreides', 2, 8, { heading: 0 });
  const friend = w2.spawnUnit('soldier', 'atreides', 6, 8);
  w2.issue('atreides', { type: 'move', ids: [t2.id], x: 12, y: 8 });
  run(w2, 20);
  assert.ok(w2.units.has(friend.id), 'own infantry survives');
});
