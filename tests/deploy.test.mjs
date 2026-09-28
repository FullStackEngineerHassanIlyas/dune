import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, run } from './helpers.mjs';
import { deploySpot } from '../src/sim/deploy.js';

const deploy = (world, house, mcv) => { world.issue(house, { type: 'deploy', ids: [mcv.id] }); world.step(); };
const yard = (world) => [...world.structures.values()].find((s) => s.typeId === 'constructionYard');

test('MCV deploys into a Construction Yard covering its own tile', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const mcv = world.spawnUnit('mcv', 'atreides', 5, 5);
  deploy(world, 'atreides', mcv);
  assert.equal(world.units.has(mcv.id), false);
  const cy = yard(world);
  assert.deepEqual([cy.x, cy.y, cy.house, cy.hp], [5, 5, 'atreides', 400]);
  for (const [x, y] of [[5, 5], [6, 5], [5, 6], [6, 6]]) assert.equal(world.map.structure[world.map.idx(x, y)], cy.id);
  assert.equal(world.map.unit[world.map.idx(5, 5)], 0);
  assert.ok(world.events.drain().some((e) => e.type === 'deployed' && e.id === cy.id));
});

test('MCV on sand refuses with a message and stays', () => {
  const world = flatWorld(12, 12, G.SAND);
  const mcv = world.spawnUnit('mcv', 'atreides', 5, 5);
  deploy(world, 'atreides', mcv);
  assert.ok(world.units.has(mcv.id));
  assert.equal(world.structures.size, 0);
  assert.equal(mcv.order.type, 'idle');
  assert.ok(world.events.drain().some((e) => e.type === 'eva' && e.key === 'cannotDeploy' && e.text === 'Unable to deploy here.'));
});

test('MCV in the bottom-right corner deploys to the north-west', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const mcv = world.spawnUnit('mcv', 'ordos', 11, 11);
  deploy(world, 'ordos', mcv);
  assert.deepEqual([yard(world).x, yard(world).y], [10, 10]);
});

test('MCV in the top-left corner uses its own tile as the corner', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const mcv = world.spawnUnit('mcv', 'ordos', 0, 0);
  deploy(world, 'ordos', mcv);
  assert.deepEqual([yard(world).x, yard(world).y], [0, 0]);
});

test('units in every candidate footprint block deployment', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const mcv = world.spawnUnit('mcv', 'ordos', 5, 5);
  world.spawnUnit('soldier', 'ordos', 5, 6);
  world.spawnUnit('soldier', 'ordos', 5, 4);
  assert.equal(deploySpot(world, mcv), null);
  deploy(world, 'ordos', mcv);
  assert.ok(world.units.has(mcv.id));
  assert.equal(world.structures.size, 0);
});

test('a moving MCV deploys after finishing its current tile', () => {
  const world = flatWorld(16, 8, G.ROCK);
  const mcv = world.spawnUnit('mcv', 'harkonnen', 2, 3, { heading: 0 });
  world.issue('harkonnen', { type: 'move', ids: [mcv.id], x: 12, y: 3 });
  run(world, 1.5);
  assert.ok(mcv.step, 'the MCV is between tiles');
  world.issue('harkonnen', { type: 'deploy', ids: [mcv.id] });
  run(world, 3);
  assert.equal(world.units.has(mcv.id), false);
  assert.equal(yard(world).house, 'harkonnen');
});

test('deploy on a unit that cannot deploy does nothing', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5);
  deploy(world, 'atreides', tank);
  assert.ok(world.units.has(tank.id));
  assert.equal(world.structures.size, 0);
});
