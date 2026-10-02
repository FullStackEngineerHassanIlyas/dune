import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { SPICE_PER_TILE } from '../src/data/tuning.js';
import { BLOOM, countBlooms, eruptBloom } from '../src/sim/bloom.js';
import { spawnWorm } from '../src/sim/worm.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

const desert = (w = 32, h = 24, seed = 1) => flatWorld(w, h, G.SAND, seed);
const spiced = (map, x, y) => map.spice[map.idx(x, y)] >= SPICE_PER_TILE;

test('a vehicle driving onto a bloom sets it off: 100 damage around it and a spice field about five tiles across', () => {
  const world = desert();
  const map = world.map;
  map.bloom[map.idx(12, 12)] = 1;
  for (let y = 9; y <= 15; y++) map.ground[map.idx(16, y)] = G.ROCK;   // rock inside the radius never turns to spice
  map.revision++;
  const tank = world.spawnUnit('combatTank', 'atreides', 6, 12, { heading: 0 });
  const beside = world.spawnUnit('quad', 'atreides', 13, 13);   // one side only: nobody shoots
  const away = world.spawnUnit('quad', 'atreides', 12, 16);
  const rev = map.spiceRevision;
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 12, y: 12 });
  const seen = [];
  assert.ok(runUntil(world, () => { seen.push(...world.events.drain()); return !map.bloom[map.idx(12, 12)]; }, 30) > 0, 'it went off');
  const burst = seen.find((e) => e.type === 'bloomErupted');
  assert.deepEqual([burst.x, burst.y, burst.by], [12.5, 12.5, 'atreides']);
  assert.equal(tank.hp, 200 - BLOOM.damage);
  assert.equal(beside.hp, 130 - BLOOM.damage);
  assert.equal(away.hp, 130, 'four tiles off: unhurt');
  assert.ok(map.spiceRevision > rev);
  for (const [x, y] of [[12, 12], [14, 12], [12, 9], [9, 14], [14, 14]]) assert.ok(spiced(map, x, y), `spice at ${x},${y}`);
  for (const [x, y] of [[18, 12], [12, 18], [5, 5], [16, 12]]) assert.ok(!spiced(map, x, y), `none at ${x},${y}`);
  let field = 0;
  for (let i = 0; i < map.spice.length; i++) if (map.spice[i]) field++;
  assert.ok(field >= 45 && field <= 73, `${field} tiles of spice`);   // 49 within four tiles, up to 24 more on the ragged rim
  assert.equal(countBlooms(map), 0);
});

test('a shot landing on a bloom sets it off; aircraft and worms pass over it', () => {
  const world = desert();
  const map = world.map;
  map.bloom[map.idx(14, 12)] = 1;
  const worm = spawnWorm(world, 10, 12);
  worm.worm.rest = worm.worm.scanAt = 1e9;   // lying still, hunting nothing
  world.spawnUnit('ornithopter', 'atreides', 14, 12);
  worm.x = worm.px = 14.5; worm.tx = 14;   // lying right under it
  run(world, 1);
  assert.equal(map.bloom[map.idx(14, 12)], 1, 'still there');
  const tank = world.spawnUnit('siegeTank', 'atreides', 10, 6, { heading: 0 });
  world.issue('atreides', { type: 'attack', ids: [tank.id], x: 14, y: 12, force: true });
  assert.ok(runUntil(world, () => !map.bloom[map.idx(14, 12)], 20) > 0, 'shot off');
  assert.ok(spiced(map, 14, 12));
  assert.equal(eruptBloom(world, map.idx(14, 12)), false, 'nothing left to burst');
});

test('new mounds grow on open sand, away from bases, units and spice, back up to the number the map began with', () => {
  const world = desert(64, 64, 5);
  const map = world.map;
  const yard = world.spawnStructure('constructionYard', 'atreides', 30, 30);
  for (const [x, y] of [[8, 8], [50, 50]]) map.bloom[map.idx(x, y)] = 1;
  run(world, 2);
  for (const [x, y] of [[8, 8], [50, 50]]) eruptBloom(world, map.idx(x, y));
  assert.equal(countBlooms(map), 0);
  assert.ok(runUntil(world, () => countBlooms(map) === 2, BLOOM.every[1] * 2 + 5) > 0, 'both came back');
  run(world, BLOOM.every[1] * 2);
  assert.equal(countBlooms(map), 2, 'never more than at the start');
  for (let i = 0; i < map.bloom.length; i++) {
    if (!map.bloom[i]) continue;
    const x = map.xOf(i), y = map.yOf(i);
    assert.ok(map.isSand(i) && !map.spice[i], 'open sand');
    assert.ok(Math.hypot(x + 0.5 - yard.x - 1, y + 0.5 - yard.y - 1) >= BLOOM.clear.base, 'away from the base');
  }
  const bare = desert(64, 64);
  run(bare, 400);
  assert.equal(countBlooms(bare.map), 0, 'a map that began without blooms grows none');
});

test('blooms are deterministic: the same seed bursts into the same field and regrows in the same places', () => {
  const play = (seed) => {
    const world = desert(48, 48, seed);
    const map = world.map;
    map.bloom[map.idx(20, 20)] = 1;
    run(world, 1);
    eruptBloom(world, map.idx(20, 20));
    run(world, 400);
    return `${[...map.spice].join('')}|${[...map.bloom].join('')}`;
  };
  assert.equal(play(3), play(3));
  assert.notEqual(play(3), play(4));
});
