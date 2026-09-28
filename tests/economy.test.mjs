import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { storageCapacity, addCredits, spend, clampToStorage, loseStorageShare, computePower, updatePower, radarOnline } from '../src/sim/economy.js';
import { flatWorld, run } from './helpers.mjs';

function world2() {
  const world = flatWorld(24, 24, G.ROCK);
  world.houses.get('atreides').credits = 1000;
  world.houses.get('atreides').startBuffer = 1000;
  return world;
}

test('starting credits act as storage until built storage exceeds them', () => {
  const world = world2();
  const h = world.houses.get('atreides');
  assert.equal(storageCapacity(world, h), 1000);
  world.spawnStructure('refinery', 'atreides', 2, 2);
  assert.equal(storageCapacity(world, h), 1005);
  assert.equal(h.startBuffer, 0, 'the buffer is revoked for good');
  world.removeStructure([...world.structures.values()][0]);
  assert.equal(storageCapacity(world, h), 0);
});

test('credits beyond storage are lost with one warning per 15 seconds', () => {
  const world = world2();
  const h = world.houses.get('atreides');
  assert.equal(addCredits(world, h, 300), 0, 'already at the 1000 buffer');
  assert.equal(addCredits(world, h, 300), 0);
  const warnings = world.events.drain().filter((e) => e.type === 'eva' && e.key === 'storageFull');
  assert.equal(warnings.length, 1);
  h.credits = 400;
  assert.equal(addCredits(world, h, 300), 300);
  assert.equal(h.credits, 700);
});

test('spend never goes negative', () => {
  const h = { credits: 50 };
  assert.equal(spend(h, 60), false);
  assert.equal(h.credits, 50);
  assert.equal(spend(h, 50), true);
  assert.equal(h.credits, 0);
});

test('losing a store burns its share; clamping trims to capacity', () => {
  const world = world2();
  const h = world.houses.get('atreides');
  world.spawnStructure('refinery', 'atreides', 2, 2);
  const silo = world.spawnStructure('silo', 'atreides', 6, 2);
  h.credits = 2005;
  world.removeStructure(silo);
  loseStorageShare(world, h, 1000);
  assert.ok(Math.abs(h.credits - 2005 * (1005 / 2005)) < 1e-6);
  h.credits = 5000;
  clampToStorage(world, h);
  assert.equal(h.credits, 1005);
});

test('wind traps power the base; damage lowers output but never below half', () => {
  const world = world2();
  const trap = world.spawnStructure('windtrap', 'atreides', 2, 2);
  world.spawnStructure('refinery', 'atreides', 6, 2);
  world.spawnStructure('outpost', 'atreides', 10, 2);
  assert.deepEqual(computePower(world, 'atreides'), { produced: 100, used: 60, ratio: 1 });
  trap.hp = trap.maxHp * 0.2;
  const p = computePower(world, 'atreides');
  assert.equal(p.produced, 50);
  assert.ok(Math.abs(p.ratio - 50 / 60) < 1e-9);
});

test('a new shortage is announced once and radar needs a powered outpost', () => {
  const world = world2();
  world.spawnStructure('windtrap', 'atreides', 2, 2);
  const outpost = world.spawnStructure('outpost', 'atreides', 6, 2);
  run(world, 1);
  assert.equal(radarOnline(world, 'atreides'), true);
  for (let k = 0; k < 3; k++) world.spawnStructure('refinery', 'atreides', 2 + k * 4, 8);
  run(world, 3);
  assert.equal(radarOnline(world, 'atreides'), false);
  assert.equal(world.events.drain().filter((e) => e.key === 'lowPower').length, 1);
  world.removeStructure(outpost);
  run(world, 1);
  assert.equal(radarOnline(world, 'atreides'), false);
});
