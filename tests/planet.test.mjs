import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanetShot, planetFraming } from '../src/render/planet.js';

test('the planet sits right of centre on wide screens and in the middle on tall ones', () => {
  const wide = planetFraming(16 / 9), tall = planetFraming(9 / 16);
  assert.ok(wide.offsetX > 0.5);
  assert.equal(tall.offsetX, 0);
  assert.ok(wide.distance > 2 && tall.distance > wide.distance);
});

test('the dive pushes the camera into the planet, centred', () => {
  const p = new PlanetShot({ seed: 1 });
  p.update(0.016, { aspect: 16 / 9 });
  const far = p.camera.position.clone();
  p.update(0.016, { aspect: 16 / 9, dive: 1 });
  assert.ok(p.camera.position.z < far.z && p.camera.position.z > 1.05);
  assert.ok(Math.abs(p.camera.position.x) < 1e-9);
  p.dispose();
});

test('the planet turns, slower under reduced motion; the stars stay within the particle budget', () => {
  const a = new PlanetShot({ seed: 1 }), b = new PlanetShot({ seed: 1 });
  const a0 = a.spin.rotation.y, b0 = b.spin.rotation.y;
  a.update(1, {});
  b.update(1, { reduced: true });
  assert.ok(a.spin.rotation.y - a0 > b.spin.rotation.y - b0 && b.spin.rotation.y > b0);
  assert.ok(a.stars.geometry.attributes.position.count <= 3000);
});
