import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { ShroudSync } from '../src/render/shroud.js';
import { flatWorld } from './helpers.mjs';

test('the shroud follows the fog layer and refreshes only when the fog changed', () => {
  const world = flatWorld(20, 10, G.ROCK);
  world.spawnUnit('combatTank', 'atreides', 3, 3);
  const sync = new ShroudSync(200);
  assert.equal(sync.update(world.houses.get('atreides').fog), false, 'no fog yet');
  world.step();
  const fog = world.houses.get('atreides').fog;
  assert.equal(sync.update(fog), true);
  assert.equal(sync.explored[world.map.idx(3, 3)], 255);
  assert.equal(sync.visible[world.map.idx(3, 3)], 255);
  assert.equal(sync.explored[world.map.idx(15, 8)], 0);
  assert.equal(sync.update(fog), false, 'unchanged');
  for (let i = 0; i < 5; i++) world.step();
  assert.equal(sync.update(fog), true);
});
