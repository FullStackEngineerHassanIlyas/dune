// The image-based light (src/render/sky.js createEnvironment): a sky-over-sand sphere is baked into an environment
// map once, and the sphere's geometry and material serve only that bake. They are let go as soon as the map is made
// (the engine audit of 2026-11 found them kept for good, once for every battle, results screen and lost context).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnvironment } from '../src/render/sky.js';

/** A stand-in for THREE.PMREMGenerator: records what is let go, or fails the bake when told to. */
function fakePmrem({ fail = false } = {}) {
  const seen = { gone: [], pmrem: false };
  class Pmrem {
    fromScene(scene) {
      for (const o of scene.children) {
        o.geometry.addEventListener('dispose', () => seen.gone.push('geometry'));
        o.material.addEventListener('dispose', () => seen.gone.push('material'));
      }
      if (fail) throw new Error('context lost');
      return { texture: { baked: true } };
    }
    dispose() { seen.pmrem = true; }
  }
  return { Pmrem, seen };
}

test('the environment bake lets its sphere and material go once the map is made', () => {
  const { Pmrem, seen } = fakePmrem();
  const env = createEnvironment({}, { Pmrem });
  assert.deepEqual(env, { baked: true }, 'the baked map is what comes back');
  assert.deepEqual(seen.gone.sort(), ['geometry', 'material']);
  assert.ok(seen.pmrem, 'the generator is let go too');
});

test('a bake that fails still lets them go, and the failure reaches the caller (it keeps its old map)', () => {
  const { Pmrem, seen } = fakePmrem({ fail: true });
  assert.throws(() => createEnvironment({}, { Pmrem }), /context lost/);
  assert.deepEqual(seen.gone.sort(), ['geometry', 'material']);
  assert.ok(seen.pmrem);
});
