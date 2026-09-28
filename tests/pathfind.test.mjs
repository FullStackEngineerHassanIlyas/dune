import test from 'node:test';
import assert from 'node:assert/strict';
import { GameMap } from '../src/sim/map.js';
import { PathFinder } from '../src/sim/pathfind.js';
import { G } from '../src/data/terrain.js';

function mapFrom(rows) {
  // '.' sand, 'r' rock, 'M' mountain
  const h = rows.length, w = rows[0].length, m = new GameMap(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m.ground[m.idx(x, y)] = { '.': G.SAND, r: G.ROCK, M: G.MOUNTAIN }[rows[y][x]];
  return m;
}

test('straight path on open ground', () => {
  const m = mapFrom(Array(5).fill('r'.repeat(20)));
  const { path, reached } = new PathFinder(m).find(m.idx(2, 2), m.idx(12, 2), 'tracked');
  assert.ok(reached);
  assert.equal(path.length, 10);
  assert.ok(path.every((i) => m.yOf(i) === 2));
  assert.equal(path.at(-1), m.idx(12, 2));
});

test('goes through the gap in a mountain wall', () => {
  const m = mapFrom([
    'rrrrrMrrrr',
    'rrrrrMrrrr',
    'rrrrrrrrrr',
    'rrrrrMrrrr',
    'rrrrrMrrrr',
  ]);
  const { path, reached } = new PathFinder(m).find(m.idx(1, 0), m.idx(8, 0), 'tracked');
  assert.ok(reached);
  assert.ok(path.includes(m.idx(5, 2)));
});

test('no diagonal squeeze between two mountains', () => {
  const m = mapFrom([
    'rrr',
    'rMr',
    'rrM',
  ]);
  // from (1,2)... a diagonal step (1,0)->(2,1) would cut the corner between (1,1)M and (2,0) — allowed only if both orthogonals are passable
  const pf = new PathFinder(m);
  const { path } = pf.find(m.idx(0, 2), m.idx(2, 0), 'tracked');
  for (let k = 0, prev = m.idx(0, 2); k < path.length; prev = path[k], k++) {
    const dx = m.xOf(path[k]) - m.xOf(prev), dy = m.yOf(path[k]) - m.yOf(prev);
    if (dx && dy) {
      assert.ok(m.moveFactor(m.idx(m.xOf(prev) + dx, m.yOf(prev)), 'tracked') > 0);
      assert.ok(m.moveFactor(m.idx(m.xOf(prev), m.yOf(prev) + dy), 'tracked') > 0);
    }
  }
});

test('tracked units cannot cross a mountain band but infantry can', () => {
  const m = mapFrom([
    'rrrMMrrr',
    'rrrMMrrr',
    'rrrMMrrr',
  ]);
  const pf = new PathFinder(m);
  const tank = pf.find(m.idx(0, 1), m.idx(7, 1), 'tracked');
  assert.equal(tank.reached, false);
  assert.equal(tank.path.at(-1), m.idx(2, 1));   // stops at the foot of the mountains, nearest the goal
  const foot = pf.find(m.idx(0, 1), m.idx(7, 1), 'foot');
  assert.ok(foot.reached);
});

test('wheeled units prefer sand over rock', () => {
  const m = mapFrom([
    '...........',
    '...........',
    'rrrrrrrrrrr',
    '...........',
    '...........',
  ]);
  const { path } = new PathFinder(m).find(m.idx(0, 2), m.idx(10, 2), 'wheeled');
  const onRock = path.filter((i) => m.ground[i] === G.ROCK).length;
  assert.ok(onRock <= 2, `rock tiles on path: ${onRock}`);
});

test('budget exhaustion returns a partial path toward the goal', () => {
  const m = mapFrom(Array(40).fill('r'.repeat(40)));
  const pf = new PathFinder(m);
  const { path, reached } = pf.find(m.idx(0, 0), m.idx(39, 39), 'tracked', { maxNodes: 50 });
  assert.equal(reached, false);
  assert.ok(path.length > 0);
  const end = path.at(-1);
  assert.ok(Math.hypot(m.xOf(end) - 39, m.yOf(end) - 39) < Math.hypot(39, 39));
});

test('blocked callback is respected except at the goal', () => {
  const m = mapFrom(Array(3).fill('rrrrr'));
  const pf = new PathFinder(m);
  const wall = new Set([m.idx(2, 0), m.idx(2, 1)]);
  const { path, reached } = pf.find(m.idx(0, 0), m.idx(4, 0), 'tracked', { blocked: (i) => wall.has(i) });
  assert.ok(reached);
  assert.ok(path.includes(m.idx(2, 2)));
});
