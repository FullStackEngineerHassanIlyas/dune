import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { flatWorld } from './helpers.mjs';
import { UnitViews } from '../src/render/views/unit-views.js';

const flat = { heightAt: () => 0, normalAt: (x, z, out) => Object.assign(out, { x: 0, y: 1, z: 0 }) };
for (const leaving of [false, true]) for (const finished of [false, true]) {
  test(`saboteur wall lift interpolates ${leaving ? 'down' : 'up'} on ${finished ? 'the final' : 'an intermediate'} movement tick`, () => {
    const world = flatWorld(16, 16);
    world.spawnStructure('wall', 'atreides', leaving ? 5 : 6, 5);
    const u = world.spawnUnit('saboteur', 'ordos', 4, 5);
    Object.assign(u, { px: finished ? 6.4 : 5.9, x: finished ? 6.5 : 6, py: 5.5, y: 5.5, tx: finished ? 6 : 5, ty: 5, pdistance: 0, distance: 0.1,
      step: finished ? null : { from: world.map.idx(5,5), to: world.map.idx(6,5), progress: 0.5 } });
    const views = new UnitViews(new THREE.Scene(), flat);
    for (const alpha of [0, 0.5, 1]) {
      views.sync(world, alpha, 0);
      const along = u.px + (u.x - u.px) * alpha - 5.5;
      const expected = 0.004 + 0.36 * (leaving ? 1 - along : along);
      const y = views.views.get(u.id).handles[0].matrix.elements[13];
      assert.ok(Math.abs(y - expected) < 1e-9, `${y} != ${expected} at alpha ${alpha}`);
    }
    views.dispose();
  });
}
