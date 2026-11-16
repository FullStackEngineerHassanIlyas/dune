import test from 'node:test';
import assert from 'node:assert/strict';
import { GameMap } from '../src/sim/map.js';
import { Reachability } from '../src/sim/reach.js';
import { G } from '../src/data/terrain.js';

test('reachability flood fill avoids per-tile direction tuple iterators', () => {
  const map = new GameMap(12, 12); map.ground.fill(G.ROCK);
  const reach = new Reachability(map), original = Array.prototype[Symbol.iterator];
  let directions = 0, labels;
  Array.prototype[Symbol.iterator] = function () {
    if (this.length === 2 && typeof this[0] === 'number' && typeof this[1] === 'number') directions++;
    return original.call(this);
  };
  try { labels = reach.compute('tracked'); }
  finally { Array.prototype[Symbol.iterator] = original; }
  assert.equal(labels.length, 144);
  assert.ok(labels.every(label => label === 1));
  assert.equal(directions, 0, 'the flood fill allocates a tuple iterator for every neighbour');
});

test('reachability keeps component numbering, movement classes and revision invalidation', () => {
  const map = new GameMap(5, 3); map.ground.fill(G.ROCK);
  for (let y = 0; y < 3; y++) map.ground[map.idx(2, y)] = G.MOUNTAIN;
  const reach = new Reachability(map);
  assert.deepEqual([...reach.labelsFor('tracked')], [1,1,0,2,2,1,1,0,2,2,1,1,0,2,2]);
  assert.equal(reach.connected(0, 4, 'tracked'), false);
  assert.equal(reach.connected(0, 4, 'foot'), true);
  map.ground[map.idx(2, 1)] = G.ROCK; map.revision++;
  assert.equal(reach.connected(0, 4, 'tracked'), true);
  map.structure[map.idx(2, 1)] = 42; map.revision++;
  assert.equal(reach.connected(0, 4, 'tracked'), false);
});
