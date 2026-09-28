import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { checkPlacement, placeStructure, findPlacement } from '../src/sim/placement.js';
import { flatWorld } from './helpers.mjs';

function base() {
  const world = flatWorld(20, 20, G.ROCK);
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  return world;
}

test('a structure needs free rock inside the map', () => {
  const world = base();
  assert.equal(checkPlacement(world, 'atreides', 'windtrap', 6, 4).ok, true);
  world.map.ground[world.map.idx(7, 5)] = G.SAND;
  const c = checkPlacement(world, 'atreides', 'windtrap', 6, 4);
  assert.equal(c.ok, false);
  assert.equal(c.reason, 'blocked');
  assert.equal(c.tiles.find((t) => t.x === 7 && t.y === 5).state, 'blocked');
  assert.equal(checkPlacement(world, 'atreides', 'windtrap', 19, 4).ok, false, 'off the east edge');
  assert.equal(checkPlacement(world, 'atreides', 'nonsense', 6, 4).reason, 'unknown');
});

test('units standing in the footprint block placement', () => {
  const world = base();
  world.spawnUnit('soldier', 'atreides', 7, 4);
  assert.equal(checkPlacement(world, 'atreides', 'windtrap', 6, 4).ok, false);
});

test('placement must touch the house\'s own base', () => {
  const world = base();
  assert.equal(checkPlacement(world, 'atreides', 'windtrap', 12, 12).reason, 'notAdjacent');
  world.spawnStructure('constructionYard', 'harkonnen', 12, 4);
  assert.equal(checkPlacement(world, 'atreides', 'windtrap', 14, 4).reason, 'notAdjacent', 'next to an enemy yard does not count');
  assert.equal(checkPlacement(world, 'atreides', 'windtrap', 6, 6).ok, true, 'diagonal contact counts');
  assert.equal(checkPlacement(world, 'atreides', 'windtrap', 7, 7).reason, 'notAdjacent', 'one tile gap is too far');
});

test('bare rock costs up to half the hit points; own concrete prevents it', () => {
  const world = base();
  placeStructure(world, 'atreides', 'concrete', 6, 4);
  placeStructure(world, 'atreides', 'concrete', 6, 5);
  const trap = placeStructure(world, 'atreides', 'windtrap', 6, 4);
  assert.equal(trap.hp, 150);   // two of four tiles on concrete: 75 %
  const bare = placeStructure(world, 'atreides', 'windtrap', 4, 6);
  assert.equal(bare.hp, 100);   // all bare: 50 %
});

test('concrete slabs go on bare rock only and mark their tiles', () => {
  const world = base();
  const rev = world.map.concreteRevision;
  assert.deepEqual(placeStructure(world, 'atreides', 'concrete4', 6, 4), { concrete: true });
  const slot = world.houses.get('atreides').slot + 1;
  for (const [x, y] of [[6, 4], [7, 4], [6, 5], [7, 5]]) assert.equal(world.map.concrete[world.map.idx(x, y)], slot);
  assert.equal(world.map.concreteRevision, rev + 1);
  assert.equal(checkPlacement(world, 'atreides', 'concrete', 6, 4).ok, false, 'no slab on a slab');
  assert.ok(world.events.drain().some((e) => e.type === 'concretePlaced'));
});

test('findPlacement returns the nearest valid spot next to the base, or null', () => {
  const world = flatWorld(24, 24, G.ROCK);
  world.spawnStructure('constructionYard', 'atreides', 10, 10);
  const spot = findPlacement(world, 'atreides', 'windtrap', 10, 10);
  assert.ok(spot && checkPlacement(world, 'atreides', 'windtrap', spot.x, spot.y).ok);
  assert.ok(Math.max(Math.abs(spot.x - 10), Math.abs(spot.y - 10)) <= 2);
  assert.equal(findPlacement(flatWorld(24, 24, G.SAND), 'atreides', 'windtrap', 10, 10), null);
});
