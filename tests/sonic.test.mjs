import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, shotFor } from '../src/data/weapons.js';
import { buildOptions } from '../src/sim/tech.js';
import { flatWorld, run } from './helpers.mjs';

const lost = (e) => e.maxHp - e.hp;

test('the sonic wave hurts everything on its line once, less the further it goes, and stops after 8 tiles', () => {
  assert.ok(WEAPONS.sonic.wave && shotFor('sonic', 3).wave);
  const world = flatWorld(24, 12);
  world.spawnUnit('sonicTank', 'atreides', 2, 6);
  const near = world.spawnUnit('mcv', 'harkonnen', 4, 6), mid = world.spawnUnit('mcv', 'harkonnen', 8, 6), far = world.spawnUnit('mcv', 'harkonnen', 12, 6);
  run(world, 1.2);   // one wave: the next comes two seconds after the first
  assert.ok(lost(near) >= 50 && lost(near) <= 60, `near ${lost(near)}`);
  assert.ok(lost(mid) >= 32 && lost(mid) < lost(near), `mid ${lost(mid)}`);
  assert.equal(lost(far), 0, 'beyond its 8 tiles');
});

test('friendly fire is real, but Sonic Tanks and walls are spared', () => {
  const world = flatWorld(24, 12);
  const tank = world.spawnUnit('sonicTank', 'atreides', 2, 6);
  const friend = world.spawnUnit('combatTank', 'atreides', 5, 6);
  const brother = world.spawnUnit('sonicTank', 'atreides', 7, 6);
  const wall = world.spawnStructure('wall', 'harkonnen', 9, 6);
  const mcv = world.spawnUnit('mcv', 'harkonnen', 10, 6);
  world.issue('atreides', { type: 'attack', ids: [tank.id], targetKind: 'unit', targetId: mcv.id });
  run(world, 1.2);
  assert.ok(lost(friend) > 0, 'the wave hurt its own side');
  assert.equal(lost(brother), 0, 'Sonic Tanks shrug it off');
  assert.equal(lost(wall), 0, 'walls too');
  assert.equal(lost(tank), 0);
});

test('a building on the wave\'s path takes one hit, however many of its tiles it crosses', () => {
  const world = flatWorld(24, 12);
  world.spawnUnit('sonicTank', 'atreides', 2, 6);
  const trap = world.spawnStructure('windtrap', 'harkonnen', 6, 5);
  run(world, 1.2);
  assert.ok(lost(trap) >= 40 && lost(trap) <= 55, `lost ${lost(trap)}`);
});

test('the Sonic Tank joins the Atreides roster once a House of IX stands', () => {
  const world = flatWorld(20, 20);
  world.spawnStructure('heavyFactory', 'atreides', 1, 1);
  assert.ok(!buildOptions(world, 'atreides').heavy.includes('sonicTank'));
  world.spawnStructure('ix', 'atreides', 6, 1);
  assert.ok(buildOptions(world, 'atreides').heavy.includes('sonicTank'));
});
