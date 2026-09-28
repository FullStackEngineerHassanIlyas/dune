import test from 'node:test';
import assert from 'node:assert/strict';
import { HOUSES, PLAYABLE_HOUSES, LIGHT_VEHICLE, INFANTRY } from '../src/data/houses.js';
import { SURFACE, moveFactor } from '../src/data/terrain.js';
import { UNITS, MOVE } from '../src/data/units.js';
import { STRUCTURES } from '../src/data/structures.js';
import { groundSpeed, fireDelaySeconds, buildSeconds, TURN_RATE, DRIVE_ANGLE } from '../src/data/tuning.js';

const canBuild = (house, unit) => UNITS[unit].houses.includes(house);

test('every reference in the tables points at something that exists', () => {
  for (const [id, u] of Object.entries(UNITS)) {
    if (u.builtAt) assert.ok(STRUCTURES[u.builtAt], `${id}.builtAt`);
    for (const r of u.requires ?? []) assert.ok(STRUCTURES[r], `${id}.requires ${r}`);
    for (const h of u.houses) assert.ok(HOUSES[h], `${id}.houses ${h}`);
    assert.ok(Object.values(MOVE).includes(u.move), `${id}.move`);
    assert.ok(u.turn >= 1 && u.turn <= 3, `${id}.turn`);
    if (u.deploysTo) assert.ok(STRUCTURES[u.deploysTo]);
  }
  for (const [id, s] of Object.entries(STRUCTURES)) {
    for (const r of s.requires ?? []) assert.ok(STRUCTURES[r], `${id}.requires ${r}`);
    for (const k of Object.keys(s.requiresUpgrade ?? {})) assert.ok(STRUCTURES[k], `${id}.requiresUpgrade ${k}`);
    assert.ok(s.w >= 1 && s.w <= 3 && s.h >= 1 && s.h <= 3, `${id} footprint`);
  }
});

test('structure prerequisites contain no cycles', () => {
  const state = {};
  const visit = (id) => {
    if (state[id] === 'done') return;
    assert.notEqual(state[id], 'visiting', `cycle through ${id}`);
    state[id] = 'visiting';
    for (const r of STRUCTURES[id].requires ?? []) visit(r);
    state[id] = 'done';
  };
  Object.keys(STRUCTURES).forEach(visit);
});

test('house rosters follow the original game', () => {
  assert.ok(!canBuild('harkonnen', 'trike') && !canBuild('harkonnen', 'soldier') && !canBuild('harkonnen', 'ornithopter'));
  assert.ok(!canBuild('atreides', 'trooper') && !canBuild('atreides', 'devastator') && !canBuild('atreides', 'deviator'));
  assert.ok(!canBuild('ordos', 'missileTank') && canBuild('ordos', 'raider') && canBuild('ordos', 'trooper') && canBuild('ordos', 'soldier'));
  const specials = { atreides: 'sonicTank', harkonnen: 'devastator', ordos: 'deviator' };
  for (const h of PLAYABLE_HOUSES) {
    const own = ['sonicTank', 'devastator', 'deviator'].filter((u) => canBuild(h, u));
    assert.deepEqual(own, [specials[h]]);
    assert.ok(canBuild(h, LIGHT_VEHICLE[h]) && canBuild(h, INFANTRY[h]));
  }
});

test('key numbers match the original tables', () => {
  assert.deepEqual([UNITS.combatTank.cost, UNITS.combatTank.hp, UNITS.combatTank.range, UNITS.combatTank.fireDelay], [300, 200, 4, 80]);
  assert.deepEqual([UNITS.devastator.hp, UNITS.devastator.speed], [400, 10]);
  assert.equal(STRUCTURES.windtrap.power, -100);
  assert.equal(STRUCTURES.refinery.storage, 1005);
  assert.deepEqual([STRUCTURES.palace.w, STRUCTURES.palace.h, STRUCTURES.palace.cost], [3, 3, 999]);
  assert.equal(STRUCTURES.constructionYard.requires, null);
  assert.equal(HOUSES.harkonnen.color, 0xc8261e);
});

test('terrain movement table: mountains, concrete and worms', () => {
  assert.equal(moveFactor(SURFACE.MOUNTAIN, 'tracked'), 0);
  assert.equal(moveFactor(SURFACE.MOUNTAIN, 'foot'), 64);
  assert.equal(moveFactor(SURFACE.CONCRETE, 'wheeled'), 255);
  assert.equal(moveFactor(SURFACE.CONCRETE, 'worm'), 0);
  assert.equal(moveFactor(SURFACE.SAND, 'worm'), 192);
  assert.equal(moveFactor(SURFACE.BLOCKED, 'air'), 255);
  assert.equal(moveFactor(SURFACE.BLOCKED, 'foot'), 0);
});

test('conversions follow spec §4.1', () => {
  assert.ok(Math.abs(groundSpeed(25, 160) - 1.0764) < 1e-3);   // Combat Tank on rock
  assert.ok(groundSpeed(45, 160) > groundSpeed(25, 160));        // Trike outruns the tank
  assert.equal(groundSpeed(25, 0), 0);
  assert.equal(fireDelaySeconds(80), 2);
  assert.ok(Math.abs(buildSeconds(48) - 21.6) < 1e-9);
  assert.ok(TURN_RATE[1] < TURN_RATE[2] && TURN_RATE[2] < TURN_RATE[3]);
  assert.ok(DRIVE_ANGLE.tracked < DRIVE_ANGLE.wheeled);
});
