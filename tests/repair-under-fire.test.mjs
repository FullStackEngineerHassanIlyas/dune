import test from 'node:test';
import assert from 'node:assert/strict';
import { damage } from '../src/sim/combat.js';
import { orderRepair, updateRepairs } from '../src/sim/structure-actions.js';
import { flatWorld, run } from './helpers.mjs';

function repairingBase(isAI = false) {
  const world = flatWorld();
  const house = world.houses.get('atreides');
  house.isAI = isAI; house.credits = 1000; house.startBuffer = 1000;
  const s = world.spawnStructure('windtrap', house.id, 4, 4);
  s.hp = 100;
  orderRepair(world, house.id, s.id, true);
  return { world, house, s };
}

test('player and AI repairs heal at quarter speed under fire and charge only for restored HP', () => {
  for (const isAI of [false, true]) {
    const { world, house, s } = repairingBase(isAI);
    damage(world, s, 20, { house: 'harkonnen' });
    updateRepairs(world);
    const healed = s.hp - 80;
    assert.ok(Math.abs(healed - 200 / 12 * 0.05 * 0.25) < 1e-8, `under-fire healing: ${healed}`);
    assert.ok(Math.abs(1000 - house.credits - healed * 0.4 * 300 / 200) < 1e-8);
    assert.equal(s.repairing, true);
    assert.equal(s.repairStalled, false, 'slower healing is not a lack-of-credits stall');
  }
});

test('repairs recover their normal rate three seconds after the last real hit', () => {
  const { world, s } = repairingBase();
  damage(world, s, 10);
  world.time = 3;
  updateRepairs(world);
  assert.ok(Math.abs(s.hp - 90 - 200 / 12 * 0.05) < 1e-8);
});

test('a fresh hit extends the under-fire period and zero damage does not', () => {
  const { world, s } = repairingBase();
  damage(world, s, 10);
  world.time = 2.9; damage(world, s, 10);
  world.time = 4; updateRepairs(world);
  assert.ok(Math.abs(s.hp - 80 - 200 / 12 * 0.05 * 0.25) < 1e-8);
  world.time = 6; damage(world, s, 0);
  const before = s.hp;
  updateRepairs(world);
  assert.ok(Math.abs(s.hp - before - 200 / 12 * 0.05) < 1e-8);
});

test('a real Combat Tank overcomes a fully funded Construction Yard repair', () => {
  const world = flatWorld();
  const h = world.houses.get('atreides'); h.credits = 10000; h.startBuffer = 10000;
  const yard = world.spawnStructure('constructionYard', h.id, 14, 10);
  const tank = world.spawnUnit('combatTank', 'harkonnen', 10, 10);
  world.issue('harkonnen', { type: 'attack', ids: [tank.id], targetKind: 'structure', targetId: yard.id });
  for (let n = 0; n < 180 && world.structures.has(yard.id); n++) {
    orderRepair(world, h.id, yard.id, true);
    run(world, 1);
  }
  assert.equal(world.structures.has(yard.id), false, 'real weapon cadence beats sustained healing');
  assert.ok(h.credits > 0, 'the siege beats healing, not an empty wallet');
});
