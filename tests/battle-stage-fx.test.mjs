import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { G } from '../src/data/terrain.js';
import { flatWorld } from './helpers.mjs';

// The terrain paints its textures on 2D canvases: under Node a stand-in context takes every call.
const fakeContext = () => new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    return typeof k === 'string' && k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {};
  },
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext() { return (this.ctx ??= fakeContext()); } }) };
const { BattleStage } = await import('../src/game/battle-stage.js');

/** A battle on rock with a strip of sand, its decal map swapped for one that records every mark. */
function stage() {
  const world = flatWorld(24, 24, G.ROCK);
  for (let x = 0; x < 24; x++) world.map.ground[world.map.idx(x, 20)] = G.SAND;
  const s = new BattleStage({ world, scene: new THREE.Scene(), quality: { particles: 4000, flashLights: 0 }, rig: { target: new THREE.Vector3(12, 0, 12), distance: 16 } });
  const marks = [];
  s.terrain.decals = {
    mark: (x, y, kind, surface, scale) => marks.push({ what: 'mark', x, y, kind, surface, scale }),
    pock: (x, y, surface) => marks.push({ what: 'pock', x, y, surface }),
    blast: (x, y, radius, surface) => marks.push({ what: 'blast', x, y, radius, surface }),
    stamp: (kind, x, y) => marks.push({ what: kind, x, y }),
    track() {}, flush() {},
  };
  s.catchingUp = false;
  return { world, s, marks, particles: () => s.effects.glow.n + s.effects.smoke.n };
}

test('every ground impact marks the terrain by weapon and surface; air bursts and gas leave nothing', () => {
  const { s, marks } = stage();
  s.onEvent({ type: 'impact', weapon: 'mg', projectile: 'bullet', x: 5.5, y: 5.5, hit: false, alt: 0 });
  s.onEvent({ type: 'impact', weapon: 'cannon', projectile: 'shell', x: 8.5, y: 20.5, hit: false, alt: 0 });
  s.onEvent({ type: 'impact', weapon: 'miniRocket', projectile: 'rocket', x: 10.5, y: 10.5, hit: false, alt: 0 });
  assert.deepEqual(marks.map((m) => [m.kind, m.surface]), [['bullet', 'rock'], ['shell', 'sand'], ['rocket', 'rock']]);
  assert.ok(marks[2].scale < 1, 'a mini-rocket marks smaller');
  assert.ok(Math.hypot(marks[0].x - 5.5, marks[0].y - 5.5) <= 0.3, 'a gun\'s mark lands close to its aim');
  marks.length = 0;
  s.onEvent({ type: 'impact', weapon: 'rocket', projectile: 'rocket', x: 3, y: 3, hit: true, alt: 1.2 });
  s.onEvent({ type: 'impact', weapon: 'gasRocket', projectile: 'gas', x: 3, y: 3, hit: false, alt: 0 });
  assert.equal(marks.length, 0);
});

test('explosions leave a blast crater sized by the explosion, none in the air', () => {
  const { s, marks, particles } = stage();
  s.onEvent({ type: 'explosion', x: 6, y: 6, size: 'large' });
  s.onEvent({ type: 'explosion', x: 9, y: 20.5, size: 'small' });
  s.onEvent({ type: 'explosion', x: 12, y: 12, size: 'small', alt: 1.6 });
  assert.deepEqual(marks.map((m) => [m.what, m.surface]), [['blast', 'rock'], ['blast', 'sand']]);
  assert.ok(marks[0].radius > marks[1].radius);
  assert.ok(particles() > 50, 'and fire, dirt and smoke');
});

test('a hit on a vehicle throws sparks and only sometimes marks the ground beside it', () => {
  const { world, s, marks, particles } = stage();
  const tank = world.spawnUnit('combatTank', 'atreides', 6, 6);
  for (let k = 0; k < 40; k++) s.onEvent({ type: 'impact', weapon: 'mg', projectile: 'bullet', x: tank.x, y: tank.y, hit: true, alt: 0 });
  assert.ok(particles() > 40, 'sparks');
  assert.ok(marks.length > 0 && marks.length < 30, `near misses now and then (${marks.length} of 40)`);
  for (const m of marks) assert.ok(m.what === 'pock' && Math.hypot(m.x - tank.x, m.y - tank.y) >= 0.29, 'beside the tank, not under it');
});

test('a rocket launch throws backblast behind its launcher; catching up draws no fireworks but keeps the marks', () => {
  const { world, s, marks, particles } = stage();
  const launcher = world.spawnUnit('missileTank', 'harkonnen', 10, 10);
  s.onEvent({ type: 'fired', id: launcher.id, kind: 'unit', house: 'harkonnen', weapon: 'rocket', projectile: 'rocket', x: launcher.x, y: launcher.y, tx: launcher.x + 6, ty: launcher.y });
  let behind = 0, n = s.effects.smoke.n;
  for (let i = 0; i < n; i++) if (s.effects.smoke.vel[i * 3] < 0) behind++;
  assert.ok(n >= 6 && behind / n > 0.7, 'smoke thrown back');
  const before = particles();
  s.catchingUp = true;
  s.onEvent({ type: 'impact', weapon: 'rocket', projectile: 'rocket', x: 4.5, y: 4.5, hit: false, alt: 0 });
  assert.equal(particles(), before, 'no fireworks');
  assert.equal(marks.length, 1, 'but the crater');
});
