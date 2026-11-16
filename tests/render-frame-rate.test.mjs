import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { flatWorld } from './helpers.mjs';
import { UnitViews } from '../src/render/views/unit-views.js';
import { StructureViews } from '../src/render/views/structure-views.js';
import { MissileViews, shotPoint } from '../src/render/views/missile-views.js';
import { WormViews } from '../src/render/worm-views.js';
import { spawnWorm } from '../src/sim/worm.js';
import { G } from '../src/data/terrain.js';
import { angleDiff } from '../src/sim/geometry.js';

const flat = { heightAt: () => 0, normalAt: (x, z, out) => Object.assign(out, { x: 0, y: 1, z: 0 }) };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('refinery spin-up and coast-down have the same pose at 5, 20, 60 and 144 fps', () => {
  const atRate = fps => {
    const world = flatWorld(24, 24), ref = world.spawnStructure('refinery', 'atreides', 10, 10);
    const views = new StructureViews(new THREE.Scene(), flat), out = [];
    views.sync(world, 0);
    for (const [part, state] of ['unloading', 'leaving'].entries()) {
      ref.slot = { state };
      for (let k = 1; k <= fps * 2; k++) views.sync(world, part * 2000 + k * 1000 / fps);
      const v = views.views.get(ref.id);
      out.push(v.rotor, v.handles[0].params.spin);
    }
    views.dispose();
    return out;
  };
  const expected = atRate(60);
  for (const fps of [5, 20, 144]) atRate(fps).forEach((v, i) => close(v, expected[i]));
});

test('ground, squad and aircraft poses use alpha and the short turn across pi, independent of frame subdivision', () => {
  const world = flatWorld(24, 24);
  const units = ['combatTank', 'infantry', 'ornithopter'].map((type, i) => world.spawnUnit(type, 'atreides', 4 + i * 4, 4));
  for (const u of units) Object.assign(u, { px: u.x - 0.1, py: u.y - 0.1, pheading: Math.PI - 0.1, heading: -Math.PI + 0.1, pturret: -Math.PI + 0.1, turret: Math.PI - 0.1, pdistance: 2, distance: 2.1 });
  const pose = n => {
    const views = new UnitViews(new THREE.Scene(), flat);
    for (let i = 1; i <= n; i++) views.sync(world, i / n * 0.5, 0.025 / n);
    const result = units.map(u => {
      const v = views.views.get(u.id);
      close(v.x, u.x - 0.05); close(v.z, u.y - 0.05);
      close(angleDiff(v.heading, Math.PI), 0);
      close(angleDiff(v.turret, Math.PI), 0);
      return v.handles.map(h => [h.matrix.toArray(), { ...h.params }]);
    });
    views.dispose(); return result;
  };
  assert.deepEqual(pose(1), pose(6));
});

test('fresh units have finite poses at alpha zero before their first tick', () => {
  const world = flatWorld(24, 24), views = new UnitViews(new THREE.Scene(), flat);
  for (const [i, type] of ['combatTank', 'infantry', 'carryall', 'ornithopter'].entries()) world.spawnUnit(type, 'atreides', 2 + i * 4, 4);
  views.sync(world, 0, 0);
  for (const u of world.units.values()) {
    const v = views.views.get(u.id);
    assert.deepEqual([v.x, v.z], [u.x, u.y]);
    assert.ok(v.handles.every(h => h.matrix.elements.every(Number.isFinite)));
  }
  views.dispose();
});

test('projectile paths and missile body poses do not accumulate per-frame movement', () => {
  const p = { id: 1, house: 'atreides', projectile: 'rocket', px: 4, py: 5, x: 4.5, y: 5.1, sx: 2, sy: 5, tx: 10, ty: 7, speed: 12.5 };
  const world = { projectiles: new Map([[p.id, p]]) }, views = new MissileViews(new THREE.Scene());
  views.sync(world, 0.5, flat.heightAt);
  const expected = views.handles.get(1).matrix.toArray();
  for (let k = 0; k <= 10; k++) views.sync(world, k / 20, flat.heightAt);
  assert.deepEqual(views.handles.get(1).matrix.toArray(), expected);
  for (const projectile of ['rocket', 'gas', 'deathHand', 'shell', 'bullet']) {
    const at = shotPoint({ ...p, projectile }, 0.5, flat.heightAt, {});
    close(at.x, 4.25); close(at.z, 5.05);
    assert.ok(Object.values(at).every(Number.isFinite));
  }
  views.dispose();
});

test('worm head position, rise and heading interpolate at the same sim time', () => {
  const world = flatWorld(24, 24, G.SAND), u = spawnWorm(world, 10, 10);
  Object.assign(u, { px: 10, py: 10, x: 10.1, y: 10, pheading: Math.PI - 0.1, heading: -Math.PI + 0.1, prise: 0.3, rise: 0.5 });
  const pose = n => {
    const views = new WormViews(new THREE.Scene(), flat);
    for (let k = 1; k <= n; k++) views.sync(world, k / n * 0.5, 0.025 / n, () => true, false);
    const v = views.views.get(u.id), matrix = v.head.matrix.toArray();
    close(v.x, 10.05); close(v.rise, 0.4); close(angleDiff(v.heading, Math.PI), 0);
    views.dispose(); return matrix;
  };
  assert.deepEqual(pose(1), pose(6));
});
