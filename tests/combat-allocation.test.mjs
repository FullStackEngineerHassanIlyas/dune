import test from 'node:test';
import assert from 'node:assert/strict';
import { flatWorld } from './helpers.mjs';
import { findTarget } from '../src/sim/combat.js';

test('target scanning does not create per-candidate Map iterator results', (t) => {
  const world = flatWorld(32, 32); world.fogOfWar = false;
  world.spawnUnit('combatTank', 'harkonnen', 20, 10);
  const nearest = world.spawnUnit('combatTank', 'harkonnen', 5, 10);
  world.spawnStructure('windtrap', 'harkonnen', 8, 10);
  let iterators = 0;
  for (const map of [world.units, world.structures]) {
    const values = map.values.bind(map);
    t.mock.method(map, 'values', () => { iterators++; return values(); });
  }
  const first = findTarget(world, 'atreides', 1.5, 10.5, Infinity);
  const second = findTarget(world, 'atreides', 1.5, 10.5, Infinity);
  assert.deepEqual(first, { kind: 'unit', id: nearest.id });
  assert.notEqual(first, second, 'a returned target belongs to its caller');
  assert.equal(iterators, 0, 'Map iterators allocate a result for each candidate');
});

test('target predicate sees live map additions and radius/filter rules still apply', () => {
  const world = flatWorld(32, 32); world.fogOfWar = false;
  const far = world.spawnUnit('combatTank', 'harkonnen', 20, 10);
  let near;
  const target = findTarget(world, 'atreides', 1.5, 10.5, Infinity, { structures: false, only(u) {
    if (u === far) near = world.spawnUnit('combatTank', 'harkonnen', 4, 10);
    return true;
  }});
  assert.deepEqual(target, {kind: 'unit', id: near.id});
  assert.equal(findTarget(world, 'atreides', 1.5, 10.5, 2, {structures:false}), null);
  assert.deepEqual(findTarget(world, 'atreides', 1.5, 10.5, Infinity, {structures:false,exclude:near.id}), {kind:'unit',id:far.id});
});
