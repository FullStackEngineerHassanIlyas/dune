// The original's House_EnsureHarvesterAvailable (src/sim/harvest.js ensureHarvesters): a house with a Refinery and no
// Harvester anywhere gets one flown in free within the check's 15 s, so a worm cannot leave a base without one for good.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HARVESTER_CHECK } from '../src/sim/harvest.js';
import { flatWorld, run } from './helpers.mjs';

function base({ air = true } = {}) {
  const world = flatWorld(40, 40);
  world.rules.airDelivery = air;
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  world.spawnStructure('windtrap', 'atreides', 8, 4);
  world.spawnStructure('refinery', 'atreides', 4, 8);
  run(world, 30);   // the Refinery's own free Harvester arrives
  return world;
}
const harvesters = (world, house = 'atreides') => [...world.units.values()].filter((u) => u.house === house && u.typeId === 'harvester');

test('a worm\'s meal is replaced: a new Harvester comes by Carryall to a base that has a Refinery', () => {
  const world = base();
  assert.equal(harvesters(world).length, 1);
  world.removeUnit(harvesters(world)[0], 'eaten');
  run(world, HARVESTER_CHECK + 30);
  assert.equal(harvesters(world).length, 1, 'one replacement, flown in');
  run(world, HARVESTER_CHECK * 2);
  assert.equal(harvesters(world).length, 1, 'and only one');
});

test('no replacement while one is being built, without a Refinery, or in a bare world', () => {
  const world = base();
  world.spawnStructure('heavyFactory', 'atreides', 12, 8);
  world.removeUnit(harvesters(world)[0], 'eaten');
  const h = world.houses.get('atreides');
  h.credits = 0;   // the order waits for money: it is still the house's Harvester to come
  world.issue('atreides', { type: 'build', typeId: 'harvester' });
  run(world, HARVESTER_CHECK + 30);
  assert.equal(h.lines.heavy.current?.typeId, 'harvester');
  assert.equal(harvesters(world).length, 0, 'the one on order will do');
  const noRefinery = base();
  noRefinery.removeUnit(harvesters(noRefinery)[0], 'eaten');
  for (const s of [...noRefinery.structures.values()]) if (s.typeId === 'refinery') noRefinery.removeStructure(s, 'destroyed');
  run(noRefinery, HARVESTER_CHECK + 30);
  assert.equal(harvesters(noRefinery).length, 0);
  const bare = base({ air: false });
  bare.removeUnit(harvesters(bare)[0], 'eaten');
  run(bare, HARVESTER_CHECK + 30);
  assert.equal(harvesters(bare).length, 0, 'tests and showcases without air delivery are left alone');
});
