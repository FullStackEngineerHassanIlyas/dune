import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

const tough = (u) => { u.hp = u.maxHp = 100000; return u; };

test('an idle tank shoots an enemy in range until it dies, and the kill is counted', () => {
  const world = flatWorld(24, 16, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 8, { heading: 0 });
  const quad = world.spawnUnit('quad', 'harkonnen', 8, 8, { heading: Math.PI });
  assert.ok(runUntil(world, () => !world.units.has(quad.id), 30) > 0, 'the quad was destroyed');
  assert.ok(world.units.has(tank.id), 'the tank survived');
  assert.equal(world.houses.get('atreides').stats.unitsKilled, 1);
  assert.equal(world.houses.get('harkonnen').stats.unitsLost, 1);
  assert.ok(world.events.drain().some((e) => e.type === 'unitDestroyed' && e.id === quad.id && e.by === 'atreides'));
});

test('damage is flat: every tank shell takes exactly 25', () => {
  const world = flatWorld(24, 16, G.ROCK);
  world.spawnUnit('combatTank', 'atreides', 5, 8, { heading: 0 });
  const mcv = world.spawnUnit('mcv', 'harkonnen', 8, 8);
  run(world, 6);
  const hits = world.events.drain().filter((e) => e.type === 'damaged' && e.id === mcv.id);
  assert.ok(hits.length >= 2);
  assert.ok(hits.every((e) => e.amount === 25));
  assert.equal(mcv.hp, 150 - 25 * hits.length);
});

test('units that fire twice do so only above half health', () => {
  const shots = (hpFraction) => {
    const world = flatWorld(24, 16, G.ROCK);
    const quad = world.spawnUnit('quad', 'atreides', 5, 8, { heading: 0 });
    quad.hp = quad.maxHp * hpFraction;
    world.spawnUnit('mcv', 'harkonnen', 7, 8);
    run(world, 10);
    return world.events.drain().filter((e) => e.type === 'fired' && e.id === quad.id).length;
  };
  const healthy = shots(1), hurt = shots(0.4);
  assert.ok(hurt >= 4 && healthy >= 2 * hurt - 1, `healthy ${healthy}, hurt ${hurt}`);
});

test('cannons always hit; rockets scatter and sometimes miss', () => {
  const world = flatWorld(32, 16, G.ROCK);
  world.houses.get('harkonnen').isAI = true;
  world.spawnUnit('missileTank', 'harkonnen', 4, 8, { heading: 0 });
  tough(world.spawnUnit('mcv', 'atreides', 12, 8));
  run(world, 60);
  const rockets = world.events.drain().filter((e) => e.type === 'impact');
  assert.ok(rockets.length >= 20, `${rockets.length} rockets`);
  assert.ok(rockets.some((e) => !e.hit) && rockets.some((e) => e.hit));
  const w2 = flatWorld(24, 16, G.ROCK);
  w2.spawnUnit('combatTank', 'atreides', 5, 8, { heading: 0 });
  tough(w2.spawnUnit('mcv', 'harkonnen', 8, 8));
  run(w2, 20);
  const shells = w2.events.drain().filter((e) => e.type === 'impact');
  assert.ok(shells.length >= 8 && shells.every((e) => e.hit));
});

test('a projectile whose target died lands without error', () => {
  const world = flatWorld(24, 16, G.ROCK);
  world.spawnUnit('combatTank', 'atreides', 5, 8, { heading: 0 });
  const quad = world.spawnUnit('quad', 'harkonnen', 9, 8, { heading: Math.PI });
  assert.ok(runUntil(world, () => world.projectiles.size > 0, 10) >= 0);
  world.removeUnit(quad);
  run(world, 1);
  assert.equal(world.projectiles.size, 0);
  const impacts = world.events.drain().filter((e) => e.type === 'impact');
  assert.ok(impacts.length >= 1 && impacts.every((e) => !e.hit));
});

test('the player\'s units engage only what their fog shows; the AI sees everything', () => {
  const world = flatWorld(32, 16, G.ROCK);
  world.spawnUnit('missileTank', 'atreides', 4, 8, { heading: 0 });
  world.spawnUnit('mcv', 'harkonnen', 12, 8);
  run(world, 5);
  assert.equal(world.events.drain().filter((e) => e.type === 'fired').length, 0, 'eight tiles away is beyond its sight');
  world.houses.get('atreides').isAI = true;
  run(world, 5);
  assert.ok(world.events.drain().some((e) => e.type === 'fired'));
});

test('turreted tanks fire on the move; hull-mounted guns only when standing', () => {
  const shotsWhileDriving = (typeId) => {
    const world = flatWorld(32, 16, G.ROCK);
    const u = world.spawnUnit(typeId, 'atreides', 2, 6, { heading: 0 });
    tough(world.spawnUnit('mcv', 'harkonnen', 12, 8));
    world.issue('atreides', { type: 'move', ids: [u.id], x: 24, y: 6 });
    let fired = 0;
    for (let i = 0; i < 20 * 20; i++) {
      world.step();
      for (const e of world.events.drain()) if (e.type === 'fired' && e.id === u.id && u.order.type === 'move') fired++;
    }
    return fired;
  };
  assert.ok(shotsWhileDriving('combatTank') > 0);
  assert.equal(shotsWhileDriving('quad'), 0);
});
