import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { G } from '../src/data/terrain.js';
import { flatWorld } from './helpers.mjs';
import { spawnWorm } from '../src/sim/worm.js';
import { eruptBloom } from '../src/sim/bloom.js';
import { killUnit } from '../src/sim/combat.js';
import { updateFog } from '../src/sim/fog.js';

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

/** A desert battle seen by the Atreides, its decals and sounds recorded. */
function stage({ viewer = null, visibility = 'revealed' } = {}) {
  const world = flatWorld(32, 24, G.SAND);
  world.visibility = visibility;
  world.fogOfWar = visibility !== 'revealed';
  const marks = [], sounds = [];
  const s = new BattleStage({ world, scene: new THREE.Scene(), quality: { particles: 4000, flashLights: 0 }, viewer, sound: { play: (id, o) => sounds.push({ id, ...o }) }, rig: { target: new THREE.Vector3(10, 0, 12), distance: 16 } });
  s.terrain.decals = { crater: (x, y, r) => marks.push({ what: 'crater', x, y, r }), blob: (x, y) => marks.push({ what: 'blob', x, y }), mark() {}, pock() {}, blast() {}, stamp() {}, track() {}, flush() {} };
  s.worms.decals = s.terrain.decals;
  s.catchingUp = false;
  const frame = (n = 1) => { for (let k = 0; k < n; k++) { world.step(); for (const e of world.events.drain()) s.onEvent(e); s.sync(1, 0.05, 1000 + world.tick * 50); } };
  return { world, s, marks, sounds, frame, particles: () => s.effects.glow.n + s.effects.smoke.n };
}

test('under the sand a worm is a ridge with a trail and a bow wave, and rumbles near the camera; no head shows', () => {
  const { world, s, marks, sounds, frame, particles } = stage();
  const worm = spawnWorm(world, 4, 12, { heading: 0 });
  world.spawnUnit('trike', 'atreides', 20, 12);   // something to hunt
  frame(40);
  const v = s.worms.views.get(worm.id);
  assert.ok(worm.submerged && v.moving, 'on its way under the sand');
  assert.ok(s.worms.ridge.count > 4, `a head swell and a trail: ${s.worms.ridge.count}`);
  assert.equal(v.head.visible, false);
  assert.ok(particles() > 0, 'a bow wave of sand');
  assert.ok(marks.some((m) => m.what === 'blob'), 'a furrow');
  assert.ok(sounds.some((x) => x.id === 'wormRumble'), 'a rumble');
  assert.deepEqual(s.positionOf(worm), { x: v.x, z: v.z }, 'picked and heard where it is drawn');
});

test('up, the head shows out of a burst of sand and the ridge sinks; it roars, lunges and gulps as it swallows', () => {
  const { world, s, marks, sounds, frame } = stage();
  const worm = spawnWorm(world, 8, 12, { heading: 0 });
  const trike = world.spawnUnit('trike', 'atreides', 10, 12);
  for (let k = 0; k < 200 && !worm.worm.meals; k++) frame();
  assert.equal(worm.worm.meals, 1);
  const v = s.worms.views.get(worm.id);
  assert.ok(v.head.visible && v.rise > 0.9, 'the head is up');
  assert.ok(marks.some((m) => m.what === 'crater'), 'churned sand where it broke through');
  assert.ok(!world.units.has(trike.id));
  assert.ok(v.lunge >= 0, 'lunging');
  assert.equal(s.destruction.wrecks.count, 0, 'swallowed whole: no wreck');
  assert.ok(!s.unitViews.views.has(trike.id));
  frame(3);
  assert.ok(s.worms.ridge.count <= 15, 'no ridge over a risen head beyond the settling trail');
  assert.ok(sounds.some((x) => x.id === 'wormRoar') && sounds.some((x) => x.id === 'wormGulp'));
  assert.ok(!sounds.some((x) => x.id === 'debris'));
});

test('a worm out of the viewer\'s sight draws nothing; in sight it does', () => {
  const { world, s, frame } = stage({ viewer: 'atreides', visibility: 'fog' });
  world.spawnUnit('combatTank', 'atreides', 3, 3);   // sees only its corner
  const worm = spawnWorm(world, 24, 18);
  worm.worm.rest = 1e9;
  updateFog(world);
  frame(5);
  assert.equal(s.worms.ridge.count, 0);
  assert.equal(s.worms.views.get(worm.id).head.visible, false);
  world.spawnUnit('combatTank', 'atreides', 22, 18);
  frame(6);
  assert.ok(s.worms.ridge.count >= 1, 'a low mound where it lies');
});

test('a worm killed goes down for good; one that dives away simply goes', () => {
  const { world, s, frame } = stage();
  const worm = spawnWorm(world, 8, 12);
  worm.worm.state = 'up'; worm.submerged = false; worm.rise = worm.prise = 1;
  worm.worm.timer = -1e6;
  frame();
  killUnit(world, worm, { house: 'atreides', id: 0, kind: 'unit' });
  frame();
  const v = s.worms.views.get(worm.id);
  assert.ok(v && v.dying >= 0, 'still sinking');
  assert.equal(s.destruction.wrecks.count, 0);
  frame(30);
  assert.ok(!s.worms.views.has(worm.id), 'then gone');
  const other = spawnWorm(world, 20, 12);
  frame();
  world.removeUnit(other, 'dived');
  frame();
  assert.ok(!s.worms.views.has(other.id));
});

test('bloom mounds show where the viewer has explored; one that bursts leaves a crater, a geyser and a spice field', () => {
  const { world, s, marks, sounds, frame, particles } = stage({ viewer: 'atreides', visibility: 'shroud' });
  const map = world.map;
  map.bloom[map.idx(6, 12)] = 1;
  map.bloom[map.idx(28, 4)] = 1;
  world.spawnUnit('combatTank', 'atreides', 4, 12);
  updateFog(world);
  frame();
  assert.equal(s.blooms.mesh.count, 2);
  const shown = (k) => { const e = new THREE.Matrix4(); s.blooms.mesh.getMatrixAt(k, e); return e.elements[0] !== 0; };
  const near = s.blooms.tiles.indexOf(map.idx(6, 12)), far = s.blooms.tiles.indexOf(map.idx(28, 4));
  assert.ok(shown(near), 'the explored one');
  assert.ok(!shown(far), 'the one under the shroud');
  const before = particles();
  eruptBloom(world, map.idx(6, 12));
  frame();
  assert.equal(s.blooms.tiles.length, 1, 'gone');
  assert.ok(marks.some((m) => m.what === 'crater' && m.x === 6.5));
  assert.ok(particles() > before + 40, 'a geyser of spice and sand');
  assert.ok(sounds.some((x) => x.id === 'bloom'));
  assert.ok(s.terrain.spiceTex.image.data[map.idx(6, 12)] > 0, 'the field shows in the terrain');
});
