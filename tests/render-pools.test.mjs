import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Debris } from '../src/render/debris.js';
import { Rubble } from '../src/render/rubble.js';
import { Destruction } from '../src/render/destruction.js';
import { Effects } from '../src/render/effects.js';

const flat = { heightAt: () => 0, normalAt: (x, z, out) => Object.assign(out, { x: 0, y: 1, z: 0 }) };

test('fresh deaths still throw debris when the destruction pool is full', () => {
  const scene = new THREE.Scene(), effects = new Effects(scene, { particles: 1500, flashLights: 0 });
  const d = new Destruction(scene, { particles: 1500 }, { effects, hf: flat });
  const size = [0.1, 0.1, 0.1];
  for (let i = 0; i < d.debris.capacity; i++) d.debris.emit({ x: -10, y: 1, z: -10, size });
  d.unitDestroyed({ typeId: 'combatTank', house: 'atreides', x: 8, y: 8 });
  assert.ok([...d.debris.pos].some((x, i) => i % 3 === 0 && x > 7), 'new death must appear in the saturated pool');
  assert.equal(d.debris.n, d.debris.capacity);
  d.dispose(); effects.dispose();
});

test('explicit debris recycling evicts the oldest survivor after packed-slot removal', () => {
  const d = new Debris(new THREE.Scene(), { capacity: 8 }), size = [0.1, 0.1, 0.1];
  for (let i = 0; i < 8; i++) d.emit({ x: i, y: 1, z: 0, size });
  d.kill(2); // newest moves into slot 2; age is no longer array order
  d.emit({ x: 8, y: 1, z: 0, size });
  d.emit({ x: 9, y: 1, z: 0, size, recycle: true });
  const xs = () => Array.from({ length: d.n }, (_, i) => d.pos[i * 3]).sort((a,b) => a-b);
  assert.deepEqual(xs(), [1, 3, 4, 5, 6, 7, 8, 9]);
  d.emit({ x: 10, y: 1, z: 0, size, recycle: true });
  assert.deepEqual(xs(), [3, 4, 5, 6, 7, 8, 9, 10]);
  d.update(0, flat.heightAt);
  assert.equal(d.mesh.count, 8);
  d.dispose();
});

test('rubble saturation replaces the oldest piece and never grows its buffers', () => {
  const r = new Rubble(new THREE.Scene(), { capacity: 16 }), matrix = r.mesh.instanceMatrix.array;
  for (let i = 0; i < 100; i++) r.piece(i, 0, 0, 0.1, 0.1, 0.1, 0, 0, 0x888888);
  assert.equal(r.mesh.instanceMatrix.array, matrix);
  assert.equal(r.mesh.count, 16);
  assert.deepEqual(Array.from({ length: 16 }, (_, i) => r.at[i * 2]).sort((a,b) => a-b), Array.from({ length: 16 }, (_, i) => 84 + i));
  r.dispose();
});
