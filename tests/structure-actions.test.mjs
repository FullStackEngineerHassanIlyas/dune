import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, run } from './helpers.mjs';

function world1(credits = 1000) {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = credits;
  h.startBuffer = 100000;
  return { world, h };
}

test('selling refunds half the price scaled by health', () => {
  const { world, h } = world1(0);
  const trap = world.spawnStructure('windtrap', 'atreides', 2, 2);
  trap.hp = 100;
  world.issue('atreides', { type: 'sell', structureId: trap.id });
  world.step();
  assert.equal(world.structures.has(trap.id), false);
  assert.equal(h.credits, 75);
  assert.ok(world.events.drain().some((e) => e.type === 'sold' && e.refund === 75 && e.typeId === 'windtrap'));
});

test('only the owner can sell or repair', () => {
  const { world, h } = world1(0);
  const trap = world.spawnStructure('windtrap', 'harkonnen', 2, 2);
  world.issue('atreides', { type: 'sell', structureId: trap.id });
  world.issue('atreides', { type: 'repair', structureId: trap.id });
  world.step();
  assert.ok(world.structures.has(trap.id));
  assert.ok(!trap.repairing);
  assert.equal(h.credits, 0);
});

test('selling a store clamps credits to the remaining capacity', () => {
  const { world, h } = world1();
  h.startBuffer = 0;
  world.spawnStructure('refinery', 'atreides', 2, 2);
  const silo = world.spawnStructure('silo', 'atreides', 6, 2);
  h.credits = 2000;
  world.issue('atreides', { type: 'sell', structureId: silo.id });
  world.step();
  assert.equal(h.credits, 1005);
});

test('repair heals in about twelve seconds for 40 % of the price from zero', () => {
  const { world, h } = world1(1000);
  const trap = world.spawnStructure('windtrap', 'atreides', 2, 2);
  trap.hp = 1;
  world.issue('atreides', { type: 'repair', structureId: trap.id });
  run(world, 12.1);
  assert.equal(trap.hp, trap.maxHp);
  assert.equal(trap.repairing, false);
  const spent = 1000 - h.credits;
  assert.ok(Math.abs(spent - 0.4 * 300 * (199 / 200)) < 1, `spent ${spent}`);
  assert.ok(world.events.drain().some((e) => e.type === 'repaired' && e.id === trap.id));
});

test('repair pauses without credits and resumes when they arrive', () => {
  const { world, h } = world1(10);
  const trap = world.spawnStructure('windtrap', 'atreides', 2, 2);
  trap.hp = 50;
  world.issue('atreides', { type: 'repair', structureId: trap.id });
  run(world, 6);
  assert.ok(trap.repairStalled && trap.repairing);
  const stuck = trap.hp;
  run(world, 2);
  assert.equal(trap.hp, stuck);
  h.credits += 500;
  run(world, 10);
  assert.equal(trap.hp, trap.maxHp);
});

test('a second repair command switches repair off', () => {
  const { world } = world1();
  const trap = world.spawnStructure('windtrap', 'atreides', 2, 2);
  trap.hp = 50;
  world.issue('atreides', { type: 'repair', structureId: trap.id });
  world.step();
  world.issue('atreides', { type: 'repair', structureId: trap.id });
  world.step();
  assert.equal(trap.repairing, false);
});

test('selling at full storage warns that the refund could not be stored', () => {
  const { world, h } = world1(1005);
  h.startBuffer = 0;
  world.spawnStructure('refinery', 'atreides', 4, 4);
  const trap = world.spawnStructure('windtrap', 'atreides', 10, 4);
  world.issue('atreides', { type: 'sell', structureId: trap.id });
  world.step();
  assert.equal(h.credits, 1005);
  assert.ok(world.events.drain().some((e) => e.type === 'eva' && e.key === 'storageFull'));
});
