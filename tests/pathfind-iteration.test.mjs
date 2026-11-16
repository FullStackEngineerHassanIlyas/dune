import test from 'node:test';
import assert from 'node:assert/strict';
import { GameMap } from '../src/sim/map.js';
import { PathFinder } from '../src/sim/pathfind.js';
import { G } from '../src/data/terrain.js';

test('path expansion does not allocate a direction iterator for every neighbour', () => {
  const map = new GameMap(24, 24); map.ground.fill(G.ROCK);
  const pf = new PathFinder(map), original = Array.prototype[Symbol.iterator];
  let directions = 0, result;
  Array.prototype[Symbol.iterator] = function () {
    if (this.length === 3 && typeof this[0] === 'number' && typeof this[1] === 'number') directions++;
    return original.call(this);
  };
  try { result = pf.find(0, 575, 'tracked'); }
  finally { Array.prototype[Symbol.iterator] = original; }
  assert.equal(result.reached, true);
  assert.equal(result.path.at(-1), 575);
  assert.equal(directions, 0, 'direction tuple iterators are allocated in the A* inner loop');
});
