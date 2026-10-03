import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, plateauHalf, siteSpiceSpot } from '../src/sim/mapgen.js';
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

// ---- campaign sites (phase 3, C10): plateaus where a mission puts its bases ----

function fnv(bytes, h = 2166136261) {
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

test('skirmish maps (no sites) stay byte-identical to the phase 2 generator', () => {
  // hashes of ground, spice, blooms and starts taken from the generator before sites existed
  const pinned = [
    [{ w: 64, h: 64, seed: 1 }, 'dfa3748c'], [{ w: 64, h: 64, seed: 7, players: 3 }, '2022e60e'], [{ w: 32, h: 32, seed: 2, players: 1 }, '12a623d8'],
    [{ w: 96, h: 96, seed: 42, players: 4 }, '6383fd3'], [{ w: 128, h: 128, seed: 3, players: 4, spiceFields: 20, blooms: 6 }, '6aa9b975'], [{ w: 48, h: 40, seed: 99, players: 2 }, '50189033'],
  ];
  for (const [opts, hash] of pinned) {
    for (const extra of [{}, { sites: null }, { sites: [] }]) {
      const { map, starts } = generateMap({ ...opts, ...extra });
      let h = fnv(map.ground);
      h = fnv(new Uint8Array(map.spice.buffer), h);
      h = fnv(map.bloom, h);
      h = fnv(new TextEncoder().encode(JSON.stringify(starts)), h);
      assert.equal(h.toString(16), hash, JSON.stringify({ ...opts, ...extra }));
    }
  }
});

const SITES = [{ id: 'player', x: 12, y: 50, r: 8 }, { id: 'base1', x: 50, y: 13, r: 11 }, { id: 'base2', x: 50, y: 48, r: 9 }];

test('sites get rock plateaus of their own radius and are the starts, in order', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const { map, starts } = generateMap({ w: 64, h: 64, seed, sites: SITES });
    assert.deepEqual(starts, SITES.map((s) => ({ x: s.x, y: s.y })));
    for (const s of SITES) {
      const half = plateauHalf(s.r);
      for (let dy = -half; dy <= half; dy++) for (let dx = -half; dx <= half; dx++) {
        assert.equal(map.ground[map.idx(s.x + dx, s.y + dy)], G.ROCK, `seed ${seed} site ${s.id} offset ${dx},${dy}`);
      }
    }
  }
});

test('the guaranteed square of a plateau: 13x13 for the skirmish radius, larger for larger sites', () => {
  assert.equal(plateauHalf(8), 6);
  assert.ok(plateauHalf(11) >= 9);
  assert.ok(plateauHalf(4) >= 3);
});

test('sites are connected for tracked vehicles', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const { map } = generateMap({ w: 64, h: 64, seed, sites: SITES });
    for (const s of SITES.slice(1)) assert.ok(reachableTracked(map, map.idx(SITES[0].x, SITES[0].y), map.idx(s.x, s.y)), `seed ${seed} ${s.id}`);
  }
});

test('every site has spice within reach, off its plateau', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const { map } = generateMap({ w: 64, h: 64, seed, sites: SITES });
    for (const s of SITES) {   // within nine tiles of the plateau's sure square
      const reach = plateauHalf(s.r) + 9;
      let near = 0;
      for (let i = 0; i < map.spice.length; i++) if (map.spice[i] && Math.max(Math.abs(map.xOf(i) - s.x), Math.abs(map.yOf(i) - s.y)) <= reach) near++;
      assert.ok(near >= 20, `seed ${seed} site ${s.id}: ${near} spice tiles within ${reach}`);
    }
    for (let i = 0; i < map.spice.length; i++) {
      if (!map.spice[i] && !map.bloom[i]) continue;
      for (const s of SITES) {
        const half = plateauHalf(s.r);
        assert.ok(Math.max(Math.abs(map.xOf(i) - s.x), Math.abs(map.yOf(i) - s.y)) > half, `seed ${seed} spice or bloom on the plateau of ${s.id}`);
      }
    }
  }
});

test('a site\'s spice field lies at its spot, towards the centre unless another site is in the way', () => {
  const two = [{ x: 8, y: 8, r: 6 }, { x: 23, y: 23, r: 7 }];
  const spot = siteSpiceSpot(two[0], 32, 32, two);
  for (const o of two.slice(1)) assert.ok(Math.max(Math.abs(o.x - spot.x), Math.abs(o.y - spot.y)) > plateauHalf(o.r) + 3, JSON.stringify(spot));
  const open = siteSpiceSpot({ x: 12, y: 50, r: 8 }, 64, 64);
  assert.ok(open.x > 12 && open.y < 50, 'towards the map centre on an open map');
  for (let seed = 1; seed <= 6; seed++) {
    const { map } = generateMap({ w: 32, h: 32, seed, sites: two });
    for (const s of two) {
      const p = siteSpiceSpot(s, 32, 32, two);
      let near = 0;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (map.inBounds(p.x + dx, p.y + dy) && map.spice[map.idx(p.x + dx, p.y + dy)]) near++;
      assert.ok(near >= 15, `seed ${seed}: ${near} spice tiles round the spot of ${s.x},${s.y}`);
    }
  }
});

test('sites work on a 32 map and on small outposts, and are deterministic', () => {
  const sites = [{ id: 'player', x: 8, y: 23, r: 6 }, { id: 'base1', x: 23, y: 8, r: 7 }, { id: 'post', x: 22, y: 24, r: 3 }];
  const a = generateMap({ w: 32, h: 32, seed: 4, sites }), b = generateMap({ w: 32, h: 32, seed: 4, sites });
  assert.deepEqual(a.map.ground, b.map.ground);
  assert.deepEqual(a.map.spice, b.map.spice);
  assert.deepEqual(a.map.bloom, b.map.bloom);
  assert.equal(a.starts.length, 3);
  for (const s of sites) {
    const half = plateauHalf(s.r);
    for (let dy = -half; dy <= half; dy++) for (let dx = -half; dx <= half; dx++) assert.equal(a.map.ground[a.map.idx(s.x + dx, s.y + dy)], G.ROCK);
  }
  let spice = 0;
  for (let i = 0; i < a.map.spice.length; i++) if (a.map.spice[i] && Math.hypot(a.map.xOf(i) - 8, a.map.yOf(i) - 23) <= 14) spice++;
  assert.ok(spice >= 12, `spice near the player: ${spice}`);
});
