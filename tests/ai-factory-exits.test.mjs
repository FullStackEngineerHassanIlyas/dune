import test from 'node:test';
import assert from 'node:assert/strict';
import { keepsWaysIn } from '../src/sim/ai.js';
import { exitTile } from '../src/sim/spawn.js';
import { flatWorld } from './helpers.mjs';

// Two south exits, with side walls. The north exits remain open even when
// a Wind Trap at (8,11) seals off the south pocket.
function factoryCourtyard({ factory = true, sealed = false } = {}) {
  const world = flatWorld(32, 32);
  for (const x of [7, 10]) for (const y of [9, 10, 11]) world.spawnStructure('wall', 'harkonnen', x, y);
  const barracks = factory ? world.spawnStructure('barracks', 'harkonnen', 8, 8) : null;
  if (sealed) world.spawnStructure('windtrap', 'harkonnen', 8, 11);
  return { world, barracks };
}

test('AI placement does not isolate a factory exit while another exit stays open', () => {
  const { world, barracks } = factoryCourtyard();
  const at = exitTile(world, barracks, 'foot');
  assert.deepEqual(at, { x: 8, y: 10 }, 'production uses the south exit first');
  assert.ok(world.reach.connected(world.map.idx(at.x, at.y), world.map.idx(8, 4), 'foot'));
  assert.equal(keepsWaysIn(world, 'harkonnen', 'windtrap')(8, 11), false,
    'north access alone does not keep troops born at the south exit from being trapped');
});

test('a new AI factory cannot put its preferred exit in a sealed pocket', () => {
  const { world } = factoryCourtyard({ factory: false, sealed: true });
  assert.equal(keepsWaysIn(world, 'harkonnen', 'barracks')(8, 8), false,
    'the footprint closes the south pocket although the north exits lead out');
});

test('AI may cover factory exits completely when the remaining exits lead out', () => {
  const { world } = factoryCourtyard();
  assert.equal(keepsWaysIn(world, 'harkonnen', 'windtrap')(8, 10), true,
    'a covered tile cannot spawn troops; other exits stay usable');
});

test('an already isolated factory exit does not block unrelated AI construction', () => {
  const { world, barracks } = factoryCourtyard({ sealed: true });
  const at = exitTile(world, barracks, 'foot');
  assert.equal(world.reach.connected(world.map.idx(at.x, at.y), world.map.idx(8, 4), 'foot'), false,
    'this existing pocket really traps the production exit');
  assert.equal(keepsWaysIn(world, 'harkonnen', 'windtrap')(20, 20), true);
});
