import test from 'node:test';
import assert from 'node:assert/strict';
import { GameMap } from '../src/sim/map.js';
import { PathFinder } from '../src/sim/pathfind.js';
import { G } from '../src/data/terrain.js';

test('a path search evaluates each visited tile terrain cost only once', (t) => {
  const m = new GameMap(24, 24); m.ground.fill(G.ROCK);
  const counts = new Map(), moveFactor = m.moveFactor.bind(m);
  t.mock.method(m, 'moveFactor', (i, mode) => { counts.set(i, (counts.get(i) ?? 0) + 1); return moveFactor(i, mode); });
  const result = new PathFinder(m).find(0, 575, 'tracked');
  assert.equal(result.reached, true); assert.equal(result.path.at(-1), 575);
  assert.equal(Math.max(...counts.values()), 1, 'repeated terrain evaluations in one synchronous search');
});

test('subsequent paths see terrain, movement class and structure changes', () => {
  const m = new GameMap(5, 1); m.ground.fill(G.ROCK); const pf = new PathFinder(m);
  assert.deepEqual(pf.find(0, 4, 'tracked'), { path: [1, 2, 3, 4], reached: true });
  m.ground[2] = G.MOUNTAIN;
  assert.deepEqual(pf.find(0, 4, 'tracked'), { path: [1], reached: false });
  assert.deepEqual(pf.find(0, 4, 'foot'), { path: [1, 2, 3, 4], reached: true });
  m.ground[2] = G.ROCK; m.structure[3] = 99;
  assert.deepEqual(pf.find(0, 4, 'tracked'), { path: [1, 2], reached: false });
});
