import test from 'node:test';
import assert from 'node:assert/strict';
import { GameMap } from '../src/sim/map.js';
import { G } from '../src/data/terrain.js';
import { Heightfield, ROCK_HEIGHT } from '../src/render/heightfield.js';
import { buildTerrainGeometry } from '../src/render/terrain.js';

function testMap() {
  const m = new GameMap(40, 40);
  m.ground.fill(G.SAND);
  for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) m.ground[m.idx(x, y)] = G.ROCK;
  for (let y = 18; y < 22; y++) for (let x = 18; x < 22; x++) m.ground[m.idx(x, y)] = G.MOUNTAIN;
  return m;
}

test('rock plateaus stand at ROCK_HEIGHT, sand stays low, mountains rise, edges fade', () => {
  const hf = new Heightfield(testMap(), { sub: 4, seed: 3 });
  assert.ok(Math.abs(hf.heightAt(13.5, 13.5) - ROCK_HEIGHT) < 0.05, `rock ${hf.heightAt(13.5, 13.5)}`);
  assert.ok(Math.abs(hf.heightAt(4.5, 4.5)) < 0.08, `sand ${hf.heightAt(4.5, 4.5)}`);
  assert.ok(hf.heightAt(20, 20) > 0.7, `mountain ${hf.heightAt(20, 20)}`);
  assert.ok(Math.abs(hf.heightAt(0, 0)) < 1e-6);
  assert.ok(Math.abs(hf.heightAt(40, 17)) < 1e-6);
});

test('heights are continuous and deterministic', () => {
  const a = new Heightfield(testMap(), { sub: 4, seed: 3 }), b = new Heightfield(testMap(), { sub: 4, seed: 3 });
  assert.deepEqual(a.data, b.data);
  let prev = a.heightAt(0, 20);
  for (let x = 0.05; x < 40; x += 0.05) {
    const h = a.heightAt(x, 20);
    assert.ok(Math.abs(h - prev) < 0.35, `jump at x=${x.toFixed(2)}`);
    prev = h;
  }
});

test('normals point up on flat ground and lean on slopes', () => {
  const m = new GameMap(20, 20);
  m.ground.fill(G.ROCK);
  const hf = new Heightfield(m, { sub: 2, seed: 1 });
  const n = hf.normalAt(10, 10);
  assert.ok(n.y > 0.99);
  const hf2 = new Heightfield(testMap(), { sub: 4, seed: 3 });
  let steepest = 1;
  for (let x = 9; x <= 11; x += 0.05) steepest = Math.min(steepest, hf2.normalAt(x, 14).y);
  assert.ok(steepest < 0.9, `plateau edge slopes (steepest normal.y ${steepest})`);
});

test('flatten levels a footprint to its average height', () => {
  const hf = new Heightfield(testMap(), { sub: 4, seed: 3 });
  hf.flatten(12, 12, 2, 2);
  const h = hf.heightAt(12.2, 12.2);
  assert.ok(Math.abs(hf.heightAt(13.8, 13.8) - h) < 1e-6);
});

test('terrain geometry has one vertex per heightfield sample and upward normals', () => {
  const hf = new Heightfield(testMap(), { sub: 2, seed: 3 });
  const g = buildTerrainGeometry(hf);
  assert.equal(g.attributes.position.count, hf.vw * hf.vh);
  assert.equal(g.index.count, (hf.vw - 1) * (hf.vh - 1) * 6);
  assert.ok(g.attributes.aTerrain);
  const ny = g.attributes.normal.array;
  for (let i = 1; i < ny.length; i += 3) assert.ok(ny[i] > 0);
});
