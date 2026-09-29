import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ParticlePool, Effects } from '../src/render/effects.js';

test('particles move, age and die; a pool never grows past its capacity', () => {
  const pool = new ParticlePool(new THREE.Scene(), 16, { additive: true });
  let accepted = 0;
  for (let k = 0; k < 20; k++) accepted += pool.emit({ x: 0, y: 0, z: 0, vx: 2, life: k < 10 ? 0.1 : 1, size: [1, 1], color: [1, 1, 1], alpha: [1, 0] }) ? 1 : 0;
  assert.equal(accepted, 16);
  pool.update(0.05);
  assert.equal(pool.mesh.count, 16);
  assert.ok(pool.pos[0] > 0.05, 'moved');
  pool.update(0.1);
  assert.equal(pool.n, 6, 'the ten short-lived ones are gone');
});

test('bigger explosions throw more particles, never beyond the budget', () => {
  const fx = new Effects(new THREE.Scene(), { particles: 400, flashLights: 0 });
  fx.explosion(0, 0, 0, 'small');
  const small = fx.glow.n + fx.smoke.n;
  fx.explosion(0, 0, 0, 'large');
  assert.ok(fx.glow.n + fx.smoke.n - small > small);
  for (let k = 0; k < 100; k++) fx.explosion(0, 0, 0, 'large');
  assert.ok(fx.glow.n <= fx.glow.capacity && fx.smoke.n <= fx.smoke.capacity);
  assert.ok(fx.glow.capacity + fx.smoke.capacity <= 400);
});

test('muzzle flashes borrow a fixed set of point lights that fade out', () => {
  const scene = new THREE.Scene();
  const fx = new Effects(scene, { particles: 400, flashLights: 2 });
  const count = () => scene.children.filter((o) => o.isPointLight).length;
  assert.equal(count(), 2);
  for (let k = 0; k < 5; k++) fx.muzzle(k, 0.3, 0, true);
  assert.equal(count(), 2);
  assert.ok(fx.lights.some((l) => l.light.intensity > 0));
  fx.update(0.2);
  assert.ok(fx.lights.every((l) => l.light.intensity === 0));
});

test('short-lived flashes are drawn at least once even at low frame rates', () => {
  const pool = new ParticlePool(new THREE.Scene(), 16, { additive: true });
  pool.emit({ x: 0, y: 0, z: 0, life: 0.04, size: [1, 1], color: [1, 1, 1], alpha: [1, 0] });
  pool.update(1 / 15);
  assert.equal(pool.mesh.count, 1, 'drawn in the frame it was born');
  pool.update(1 / 15);
  assert.equal(pool.n, 0);
});

test('dust is sand-coloured smoke that rises and fades', () => {
  const fx = new Effects(new THREE.Scene(), { particles: 400, flashLights: 0 });
  fx.dust(1, 0, 2, 1);
  assert.equal(fx.smoke.n, 1);
  assert.equal(fx.glow.n, 0);
  const y0 = fx.smoke.pos[1];
  fx.update(0.5);
  assert.ok(fx.smoke.pos[1] > y0, 'rises');
  fx.update(2);
  assert.equal(fx.smoke.n, 0, 'fades away');
});
