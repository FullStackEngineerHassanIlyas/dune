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

import { screenToStructure } from '../src/render/picking.js';

test('a click on a building\'s roof or back wall is a click on the building, not on the ground behind it', () => {
  // seen from the south at 55 degrees a body 0.9 high covers 0.6 of a tile of the ground behind it: the ray to the ground lands a row north of the footprint
  const cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 700);
  const rig = new CameraRig(cam, 64, 64);
  rig.lookAt(21, 21, true);
  rig.update(1, () => 0);
  const yard = { id: 1, x: 20, y: 20, w: 2, h: 2 }, far = { id: 2, x: 20, y: 17, w: 2, h: 2 }, front = { id: 3, x: 20, y: 22, w: 2, h: 2 };
  const top = () => 0.9, base = () => 0;
  const at = (x, y, z, list = [yard]) => {
    const s = worldToScreen(cam, x, y, z, 1600, 900), nx = (s.x / 1600) * 2 - 1, ny = 1 - (s.y / 900) * 2;
    const ground = screenToGround(cam, nx, ny, () => 0, 4);
    return { hit: screenToStructure(cam, nx, ny, list, top, base, ground), ground };
  };
  const roof = at(21.3, 0.85, 20.05);   // the back of the roof
  assert.equal(Math.floor(roof.ground.z), 19, 'the ground under the pointer is the row behind the building');
  assert.equal(roof.hit.structure, yard);
  assert.deepEqual([roof.hit.tx, roof.hit.ty], [21, 20], 'and the tile is the one of the footprint the ray comes in over');
  assert.equal(at(21, 0, 21).hit.structure, yard, 'a click on its floor is the building too');
  assert.equal(at(21, 0, 19.2).hit, null, 'the ground seen behind it, past the roof line, is ground');
  assert.equal(at(21, 0, 22.5).hit, null, 'so is the ground in front of it');
  assert.equal(at(19.5, 0, 21).hit, null, 'and beside it');
  assert.equal(at(21, 0.5, 18.5, [far, yard]).hit.structure, far, 'a ray that passes over one building meets the one behind');
  assert.equal(at(21, 0.3, 22, [yard, front]).hit.structure, front, 'of two bodies in the way the nearer one is meant: its roof hides the foot of the wall behind');
  assert.equal(at(21, 0.3, 22, [front, yard]).hit.structure, front);
  const hill = (x, z) => (z > 23 ? 5 : 0), s = worldToScreen(cam, 21, 0.5, 21, 1600, 900), nx = (s.x / 1600) * 2 - 1, ny = 1 - (s.y / 900) * 2;
  assert.equal(screenToStructure(cam, nx, ny, [yard], top, base, screenToGround(cam, nx, ny, hill, 6)), null, 'a building behind a rise the ray meets first is not under the pointer');
  assert.equal(screenToStructure(cam, 0, 0.99, [yard], top, base), null, 'a ray that meets nothing meets no building');
});
