import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { modelBounds, iconFraming, flipRows, ICON_W, ICON_H, UNIT_ICON_YAW } from '../src/render/icons.js';
import { modelDef } from '../src/render/models/index.js';
import { nodeMatricesAtRest } from '../src/render/models/instancer.js';

const corners = (b) => {
  const out = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new THREE.Vector3(x, y, z));
  return out;
};

test('model bounds enclose every part, also when the model is turned', () => {
  const def = modelDef('windtrap');
  const box = modelBounds(def);
  for (const p of def.parts) { p.geometry.computeBoundingBox(); assert.ok(box.containsBox(p.geometry.boundingBox)); }
  assert.ok(box.max.y > 0.4 && box.min.y < 0.01);
  const turned = modelBounds(modelDef('combatTank'), new THREE.Matrix4().makeRotationY(UNIT_ICON_YAW));
  assert.ok(turned.max.z - turned.min.z > 0.3);
});

test('icon framing fills the view without cutting the model off', () => {
  for (const id of ['heavyFactory', 'soldier', 'mcv', 'turret']) {
    const box = modelBounds(modelDef(id));
    const f = iconFraming(box);
    const cam = new THREE.PerspectiveCamera(30, ICON_W / ICON_H, 0.01, 100);
    cam.position.copy(f.position);
    cam.lookAt(f.target);
    cam.updateMatrixWorld();
    let extent = 0;
    for (const c of corners(box)) {
      const v = c.project(cam);
      assert.ok(Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1, `${id} corner outside the view`);
      extent = Math.max(extent, Math.abs(v.x), Math.abs(v.y));
    }
    assert.ok(extent > 0.8, `${id} fills the icon (${extent.toFixed(2)})`);
    assert.ok(f.position.y > f.target.y && f.position.z > f.target.z, 'seen from above and the south');
  }
});

test('flipRows turns WebGL bottom-up rows top-down', () => {
  const src = new Uint8Array([1, 1, 1, 1, 2, 2, 2, 2]);
  assert.deepEqual([...flipRows(src, 1, 2)], [2, 2, 2, 2, 1, 1, 1, 1]);
});

test('bounds and icons use every node\'s rest pose, pivots included', () => {
  const box = modelBounds(modelDef('turret'));
  assert.ok(box.max.x > 0.55, `the barrel reaches past the bunker (${box.max.x.toFixed(2)})`);
  const rest = nodeMatricesAtRest(modelDef('turret'));
  const p = new THREE.Vector3().setFromMatrixPosition(rest.barrel);
  assert.deepEqual([+p.x.toFixed(2), +p.y.toFixed(2)], [0.14, 0.44]);
});

import { upgradeIconKey } from '../src/render/icons.js';

test('upgrade icon keys name the building and the level it reaches', () => {
  assert.deepEqual(upgradeIconKey('upgrade:heavyFactory:2'), { structureType: 'heavyFactory', level: 2 });
  assert.equal(upgradeIconKey('heavyFactory'), null);
  assert.equal(upgradeIconKey('upgrade:windtrap:1'), null, 'wind traps have no upgrades');
});

import { starportIconKey } from '../src/render/icons.js';

test('Starport icon keys name the unit on sale', () => {
  assert.deepEqual(starportIconKey('starport:quad'), { unitType: 'quad' });
  assert.equal(starportIconKey('quad'), null);
  assert.equal(starportIconKey('starport:windtrap'), null);
});
