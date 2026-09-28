import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { isVisible, unitVisibleTo, structureVisibleTo } from '../src/sim/fog.js';
import { flatWorld, run } from './helpers.mjs';

test('units reveal their sight radius; explored ground stays revealed', () => {
  const world = flatWorld(40, 20, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 10, { heading: 0 });
  world.step();
  const fog = world.houses.get('atreides').fog;
  assert.equal(isVisible(world, 'atreides', 9, 10), true, 'sight 3 + 1 reaches four tiles');
  assert.equal(isVisible(world, 'atreides', 10, 10), false);
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 30, y: 10 });
  run(world, 30);
  assert.equal(isVisible(world, 'atreides', 5, 10), false, 'no longer seen');
  assert.equal(fog.explored[world.map.idx(5, 10)], 1, 'but still explored');
});

test('enemy units are visible only in current sight; own units always', () => {
  const world = flatWorld(40, 20, G.ROCK);
  world.spawnUnit('combatTank', 'atreides', 5, 10);
  const near = world.spawnUnit('quad', 'harkonnen', 8, 10);
  const far = world.spawnUnit('quad', 'harkonnen', 30, 10);
  world.step();
  assert.equal(unitVisibleTo(world, 'atreides', near), true);
  assert.equal(unitVisibleTo(world, 'atreides', far), false);
  assert.equal(unitVisibleTo(world, 'harkonnen', far), true);
});

test('enemy structures stay visible after they were seen once', () => {
  const world = flatWorld(40, 20, G.ROCK);
  const scout = world.spawnUnit('trike', 'atreides', 22, 10, { heading: 0 });
  const yard = world.spawnStructure('constructionYard', 'harkonnen', 24, 9);
  assert.equal(structureVisibleTo(world, 'atreides', yard), false);
  world.step();
  assert.equal(structureVisibleTo(world, 'atreides', yard), true);
  world.issue('atreides', { type: 'move', ids: [scout.id], x: 2, y: 10 });
  run(world, 15);
  assert.equal(isVisible(world, 'atreides', 24, 9), false);
  assert.equal(structureVisibleTo(world, 'atreides', yard), true);
});

test('with fog of war switched off everything is visible', () => {
  const world = flatWorld(40, 20, G.ROCK);
  world.fogOfWar = false;
  world.spawnUnit('combatTank', 'atreides', 5, 10);
  const far = world.spawnUnit('quad', 'harkonnen', 30, 10);
  const yard = world.spawnStructure('constructionYard', 'harkonnen', 34, 4);
  world.step();
  assert.equal(world.houses.get('atreides').fog, undefined);
  assert.equal(isVisible(world, 'atreides', 30, 10), true);
  assert.equal(unitVisibleTo(world, 'atreides', far), true);
  assert.equal(structureVisibleTo(world, 'atreides', yard), true);
});

test('structures reveal around their footprint', () => {
  const world = flatWorld(40, 20, G.ROCK);
  world.spawnStructure('outpost', 'atreides', 10, 10);
  world.step();
  assert.equal(isVisible(world, 'atreides', 20, 10), true, 'the outpost sees ten tiles');
  assert.equal(isVisible(world, 'atreides', 24, 10), false);
});
