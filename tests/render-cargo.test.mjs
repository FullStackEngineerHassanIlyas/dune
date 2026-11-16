import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { flatWorld, runUntil } from './helpers.mjs';
import { deliverByAir } from '../src/sim/carryall.js';
import { UnitViews } from '../src/render/views/unit-views.js';
import { angleDiff } from '../src/sim/geometry.js';

const flat = { heightAt: () => 0, normalAt: (x, z, out) => Object.assign(out, { x: 0, y: 1, z: 0 }) };
const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-9, `${label}: ${a} != ${b}`);

test('a newly delivered load uses its carrier pose even before the first tick', () => {
  const world = flatWorld(32, 32);
  const load = deliverByAir(world, 'atreides', 'combatTank', { x: 20, y: 20 }, null, { x: 0, y: 10 });
  const carrier = world.units.get(load.inside);
  const views = new UnitViews(new THREE.Scene(), flat);
  for (const alpha of [0, 0.25, 0.5, 1]) {
    views.sync(world, alpha, 0);
    const v = views.views.get(load.id), c = views.views.get(carrier.id);
    close(angleDiff(v.heading, c.heading), 0, 'load heading');
    close(angleDiff(v.turret, c.heading), 0, 'load turret');
    close(v.x, c.x, 'x'); close(v.z, c.z, 'z');
  }
  views.dispose();
});

test('a picked-up tank stays under the Carryall throughout the pickup tick', () => {
  const world = flatWorld(32, 32);
  const carrier = world.spawnUnit('carryall', 'atreides', 10, 10, { heading: Math.PI });
  const load = world.spawnUnit('combatTank', 'atreides', 12, 12, { heading: -Math.PI / 2 });
  world.issue('atreides', { type: 'lift', ids: [carrier.id], targetId: load.id });
  assert.ok(runUntil(world, () => carrier.cargo === load.id, 20) > 0, 'picked up');
  const views = new UnitViews(new THREE.Scene(), flat);
  for (const alpha of [0, 0.5, 1]) {
    views.sync(world, alpha, 0);
    const v = views.views.get(load.id), c = views.views.get(carrier.id);
    close(v.x, c.x, 'x'); close(v.z, c.z, 'z');
    close(angleDiff(v.heading, c.heading), 0, 'load heading');
  }
  views.dispose();
});

test('the drop tick interpolates the last cargo altitude down to the ground', () => {
  const world = flatWorld(32, 32);
  const load = deliverByAir(world, 'atreides', 'combatTank', { x: 20, y: 20 });
  assert.ok(runUntil(world, () => !load.inside, 30) > 0, 'set down');
  assert.ok(load.palt > 0, 'was hanging above ground');
  const views = new UnitViews(new THREE.Scene(), flat);
  for (const alpha of [0, 0.5, 1]) {
    views.sync(world, alpha, 0);
    close(views.views.get(load.id).alt, load.palt * (1 - alpha), 'landing altitude');
  }
  world.step(); views.sync(world, 0, 0);
  close(views.views.get(load.id).alt, 0, 'next tick stays grounded');
  views.dispose();
});
