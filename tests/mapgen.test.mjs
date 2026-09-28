import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap } from '../src/sim/mapgen.js';
import { GameMap } from '../src/sim/map.js';
import { G, SURFACE } from '../src/data/terrain.js';

function reachableTracked(map, from, to) {
  const seen = new Uint8Array(map.w * map.h);
  const q = [from]; seen[from] = 1;
  for (let k = 0; k < q.length; k++) {
    const i = q[k];
    if (i === to) return true;
    const x = map.xOf(i), y = map.yOf(i);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const ni = map.idx(nx, ny);
      if (!seen[ni] && map.moveFactor(ni, 'tracked') > 0) { seen[ni] = 1; q.push(ni); }
    }
  }
  return false;
}

test('generation is deterministic per seed', () => {
  const a = generateMap({ w: 64, h: 64, seed: 5 }), b = generateMap({ w: 64, h: 64, seed: 5 }), c = generateMap({ w: 64, h: 64, seed: 6 });
  assert.deepEqual(a.map.ground, b.map.ground);
  assert.deepEqual(a.map.spice, b.map.spice);
  assert.deepEqual(a.starts, b.starts);
  assert.notDeepEqual(a.map.ground, c.map.ground);
});

test('every start sits on a 13x13 rock plateau', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const { map, starts } = generateMap({ w: 64, h: 64, seed, players: 2 });
    for (const s of starts) {
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        assert.equal(map.ground[map.idx(s.x + dx, s.y + dy)], G.ROCK, `seed ${seed} start ${s.x},${s.y} offset ${dx},${dy}`);
      }
    }
  }
});

test('starts are connected for tracked vehicles and have spice within 15 tiles', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const { map, starts } = generateMap({ w: 64, h: 64, seed, players: 2 });
    assert.ok(reachableTracked(map, map.idx(starts[0].x, starts[0].y), map.idx(starts[1].x, starts[1].y)), `seed ${seed} connected`);
    for (const s of starts) {
      let near = false;
      for (let i = 0; i < map.spice.length && !near; i++) if (map.spice[i] && Math.hypot(map.xOf(i) - s.x, map.yOf(i) - s.y) <= 15) near = true;
      assert.ok(near, `seed ${seed} spice near ${s.x},${s.y}`);
    }
  }
});

test('spice and blooms only lie on sand', () => {
  const { map } = generateMap({ w: 64, h: 64, seed: 3 });
  let spice = 0, blooms = 0;
  for (let i = 0; i < map.spice.length; i++) {
    if (map.spice[i]) { spice++; assert.ok(map.ground[i] === G.SAND || map.ground[i] === G.DUNE); assert.equal(map.surface(i), SURFACE.SPICE); }
    if (map.bloom[i]) { blooms++; assert.ok(map.ground[i] === G.SAND || map.ground[i] === G.DUNE); assert.equal(map.spice[i], 0); }
  }
  assert.ok(spice > 60, `spice tiles ${spice}`);
  assert.ok(blooms >= 1);
});

test('small and large maps work', () => {
  const small = generateMap({ w: 32, h: 32, seed: 2, players: 1 });
  assert.equal(small.starts.length, 1);
  const t0 = Date.now();
  const big = generateMap({ w: 128, h: 128, seed: 2, players: 4 });
  assert.equal(big.starts.length, 4);
  assert.ok(Date.now() - t0 < 3000);
});

test('surface reflects structures, concrete, rubble and mountains', () => {
  const m = new GameMap(4, 4);
  m.ground.fill(G.ROCK);
  assert.equal(m.surface(0), SURFACE.ROCK);
  m.concrete[0] = 1; assert.equal(m.surface(0), SURFACE.CONCRETE);
  m.structure[0] = 7; assert.equal(m.surface(0), SURFACE.BLOCKED);
  m.rubble[1] = 1; assert.equal(m.surface(1), SURFACE.RUBBLE);
  m.ground[2] = G.MOUNTAIN; assert.equal(m.moveFactor(2, 'tracked'), 0);
  assert.ok(m.isBuildableGround(3));
  m.ground[3] = G.SAND; assert.ok(!m.isBuildableGround(3)); assert.ok(m.isSand(3));
});
