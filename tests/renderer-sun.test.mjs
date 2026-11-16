// The sun's direction (spec: docs/research/raw/visual-structures.md §1.1, visual-units.md §1.1): the Genesis
// sprites are lit from the north-west, high up, so the renderer's sun sits there too, and casts the units' and
// buildings' shadows south-east — towards the camera, which stands south of what it looks at and looks north
// (src/render/camera-rig.js), instead of behind them where the old south-west sun used to hide them.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SUN_DIRECTION, Renderer3D } from '../src/render/renderer.js';

test('the sun is towards the north-west and high, as the Genesis sprites are lit', () => {
  assert.ok(SUN_DIRECTION.x < 0, `west (x=${SUN_DIRECTION.x})`);
  assert.ok(SUN_DIRECTION.z < 0, `north (z=${SUN_DIRECTION.z})`);
  const elevation = Math.asin(SUN_DIRECTION.y) * 180 / Math.PI;
  assert.ok(elevation > 45 && elevation < 65, `high elevation, about 50-60° per the research doc (got ${elevation.toFixed(1)}°)`);
});

// follow() places the sun 70 units out along SUN_DIRECTION from the point the camera looks at; a shadow is cast
// the opposite way, away from the sun.
test('follow() casts shadows south-east, toward the camera, not behind the units and buildings that throw them', () => {
  const r = Object.create(Renderer3D.prototype);
  r.sun = new THREE.DirectionalLight();
  r.sky = { position: new THREE.Vector3() };
  r.follow(100, 60);

  assert.ok(r.sun.position.x < r.sun.target.position.x, 'the sun sits west of what it lights');
  assert.ok(r.sun.position.z < r.sun.target.position.z, 'the sun sits north of what it lights');

  const awayFromSun = new THREE.Vector3().subVectors(r.sun.target.position, r.sun.position).setY(0).normalize();
  assert.ok(awayFromSun.x > 0 && awayFromSun.z > 0, 'a cast shadow points south-east, into the camera\'s half of the view, not away from it');
});
