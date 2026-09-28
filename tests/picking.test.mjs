import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { screenToGround, worldToScreen } from '../src/render/picking.js';
import { CameraRig } from '../src/render/camera-rig.js';

function camera() {
  const c = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 600);
  c.position.set(10, 20, 30);
  c.lookAt(10, 0, 10);
  c.updateMatrixWorld();
  return c;
}

test('the screen centre hits the look-at point on flat ground', () => {
  const p = screenToGround(camera(), 0, 0, () => 0);
  assert.ok(Math.abs(p.x - 10) < 0.02 && Math.abs(p.z - 10) < 0.02, JSON.stringify(p));
});

test('rays into the sky return null', () => {
  const c = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 600);
  c.position.set(0, 2, 0);
  c.lookAt(0, 2.5, -10);
  c.updateMatrixWorld();
  assert.equal(screenToGround(c, 0, 0.9, () => 0), null);
});

test('a hill in front of the look-at point is hit first', () => {
  const hill = (x, z) => (Math.abs(x - 10) < 2 && z > 13 && z < 17 ? 5 : 0);
  const p = screenToGround(camera(), 0, 0, hill, 6);
  assert.ok(p.z > 14 && p.z < 17, JSON.stringify(p));
});

test('worldToScreen and screenToGround agree', () => {
  const c = camera();
  const s = worldToScreen(c, 12, 0, 8, 1600, 900);
  assert.ok(s.visible);
  const p = screenToGround(c, (s.x / 1600) * 2 - 1, 1 - (s.y / 900) * 2, () => 0);
  assert.ok(Math.abs(p.x - 12) < 0.05 && Math.abs(p.z - 8) < 0.05);
});

test('camera rig clamps to the map and zoom limits, and looks north at yaw 0', () => {
  const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 600);
  const rig = new CameraRig(cam, 64, 64);
  rig.lookAt(-50, 500, true);
  assert.deepEqual([rig.target.x, rig.target.z], [0, 64]);
  rig.zoom(100);
  rig.update(10, () => 0);
  assert.equal(rig.distance, rig.maxDistance);
  assert.ok(cam.position.z > rig.target.z, 'camera sits south of its target');
  rig.lookAt(30, 30, true);
  rig.pan(0, 5);
  assert.ok(rig.goal.z < 30, 'panning forward moves north');
});

import { screenToPlane } from '../src/render/picking.js';

test('screenToPlane meets a flat plane; the top of the view lies farther north', () => {
  const cam = camera();
  const c = screenToPlane(cam, 0, 0, 0);
  assert.ok(Math.abs(c.x - 10) < 1e-6 && Math.abs(c.z - 10) < 1e-6);
  assert.ok(screenToPlane(cam, 0, 1, 0).z < screenToPlane(cam, 0, -1, 0).z);
});
