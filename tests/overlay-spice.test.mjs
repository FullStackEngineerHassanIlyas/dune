import test from 'node:test';
import assert from 'node:assert/strict';
import { flatWorld } from './helpers.mjs';
import { storageLevel } from '../src/render/overlay.js';

test('a Refinery and a Silo show how full the house\'s shared spice storage is', () => {
  const world = flatWorld();
  const h = world.houses.get('atreides');
  h.startBuffer = 0;
  world.spawnStructure('refinery', 'atreides', 2, 2);
  world.spawnStructure('silo', 'atreides', 8, 2);
  h.credits = 1005;
  assert.ok(Math.abs(storageLevel(world, h) - 1005 / 2005) < 1e-9);
  h.credits = 5000;   // a refund can bank more than storage holds: the bar stays full
  assert.equal(storageLevel(world, h), 1);
});

test('the starting allowance counts as storage, and reading it does not end it', () => {
  const world = flatWorld();
  const h = world.houses.get('atreides');
  h.startBuffer = 4000;
  world.spawnStructure('refinery', 'atreides', 2, 2);
  h.credits = 2000;
  assert.equal(storageLevel(world, h), 0.5);
  assert.equal(h.startBuffer, 4000);
  assert.equal(storageLevel(world, null), 0);
});
