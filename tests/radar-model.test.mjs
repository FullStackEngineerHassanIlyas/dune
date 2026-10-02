import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { radarImage, radarColours, RADAR_GROUND, RADAR_SPICE, RADAR_THICK_SPICE, RADAR_CONCRETE } from '../src/ui/radar-model.js';
import { SKIRMISH_HOUSES } from '../src/data/houses.js';
import { flatWorld, run } from './helpers.mjs';

const pixel = (img, w, x, y) => [...img.slice((y * w + x) * 4, (y * w + x) * 4 + 3)];

test('the radar shows explored terrain and own forces, and black where unexplored', () => {
  const world = flatWorld(20, 10, G.SAND);
  world.map.ground[world.map.idx(3, 3)] = G.ROCK;
  world.map.spice[world.map.idx(4, 3)] = 250;
  world.map.spice[world.map.idx(5, 3)] = 700;
  world.spawnUnit('combatTank', 'atreides', 4, 4);
  world.spawnStructure('constructionYard', 'atreides', 1, 1);
  world.spawnUnit('quad', 'harkonnen', 17, 5);
  world.step();
  const img = radarImage(world, 'atreides');
  assert.equal(img.length, 20 * 10 * 4);
  assert.deepEqual(pixel(img, 20, 3, 3), RADAR_GROUND[G.ROCK]);
  assert.deepEqual(pixel(img, 20, 4, 3), RADAR_SPICE);
  assert.deepEqual(pixel(img, 20, 5, 3), RADAR_THICK_SPICE);
  assert.deepEqual(pixel(img, 20, 1, 1), [0x2f, 0x6f, 0xe0], 'own structure in house colour');
  assert.notDeepEqual(pixel(img, 20, 4, 4), RADAR_GROUND[G.SAND], 'own unit shows');
  assert.deepEqual(pixel(img, 20, 17, 5), [0, 0, 0], 'unexplored stays black; the enemy is hidden');
});

test('every skirmish house is told apart on the radar, from the others and from the ground under it', () => {
  const far = (a, b, min, what) => assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) >= min, `${what}: ${a} vs ${b}`);
  const paint = Object.fromEntries(SKIRMISH_HOUSES.map((id) => [id, radarColours(id)]));
  for (const a of SKIRMISH_HOUSES) for (const b of SKIRMISH_HOUSES) if (a < b) for (const ca of paint[a]) for (const cb of paint[b]) far(ca, cb, 90, `${a}/${b}`);
  for (const id of SKIRMISH_HOUSES) {
    const [structure, unit] = paint[id];
    for (const ground of [RADAR_GROUND[G.ROCK], RADAR_CONCRETE]) far(structure, ground, 60, `${id} building on rock or concrete`);
    for (const ground of [RADAR_GROUND[G.SAND], RADAR_GROUND[G.DUNE], RADAR_SPICE, RADAR_THICK_SPICE]) far(unit, ground, 60, `${id} unit on sand or spice`);
  }
  const world = flatWorld(12, 6, G.SAND);
  world.fogOfWar = false;
  SKIRMISH_HOUSES.forEach((id, k) => {
    if (!world.houses.has(id)) world.addHouse(id);
    world.spawnStructure('windtrap', id, k * 2, 0);
    world.spawnUnit('quad', id, k * 2, 4);
  });
  const img = radarImage(world, 'atreides');
  const seen = SKIRMISH_HOUSES.flatMap((id, k) => [pixel(img, 12, k * 2, 0), pixel(img, 12, k * 2, 4)].map(String));
  assert.equal(new Set(seen).size, SKIRMISH_HOUSES.length * 2, seen.join(' | '));
});

test('enemy structures stay on the radar once seen; fog off shows everything', () => {
  const world = flatWorld(30, 10, G.ROCK);
  const scout = world.spawnUnit('trike', 'atreides', 20, 5);
  world.spawnStructure('constructionYard', 'harkonnen', 22, 4);
  const quad = world.spawnUnit('quad', 'harkonnen', 27, 8);
  world.step();
  world.issue('atreides', { type: 'move', ids: [scout.id], x: 2, y: 5 });
  run(world, 15);
  let img = radarImage(world, 'atreides');
  assert.deepEqual(pixel(img, 30, 22, 4), [0xc8, 0x26, 0x1e]);
  world.fogOfWar = false;
  img = radarImage(world, 'atreides');
  assert.notDeepEqual(pixel(img, 30, quad.tx, quad.ty), RADAR_GROUND[G.ROCK], 'no fog: the quad shows');
});
