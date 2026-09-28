import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { G } from '../src/data/terrain.js';
import { Heightfield } from '../src/render/heightfield.js';
import { UnitViews } from '../src/render/views/unit-views.js';
import { StructureViews } from '../src/render/views/structure-views.js';
import { flatWorld } from './helpers.mjs';

const pos = (m) => new THREE.Vector3().setFromMatrixPosition(m);

test('unit views follow the simulation: create, pose, hide squad members, remove', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new UnitViews(new THREE.Scene(), hf);
  const tank = world.spawnUnit('combatTank', 'atreides', 3, 3, { heading: 0 });
  const squad = world.spawnUnit('troopers', 'harkonnen', 6, 6);
  views.sync(world, 1, 0.016);
  const p = pos(views.views.get(tank.id).handles[0].matrix);
  assert.deepEqual([+p.x.toFixed(2), +p.z.toFixed(2)], [3.5, 3.5]);
  assert.ok(Math.abs(p.y - hf.heightAt(3.5, 3.5)) < 0.01);
  assert.equal(views.views.get(squad.id).handles.length, 3);
  squad.hp = 40;
  views.sync(world, 1, 0.016);
  assert.deepEqual(views.views.get(squad.id).handles.map((h) => h.visible), [true, false, false]);
  world.removeUnit(tank);
  views.sync(world, 1, 0.016);
  assert.equal(views.views.has(tank.id), false);
  assert.equal(views.model('combatTank').count, 0);
});

test('interpolation and the turret sign convention', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new UnitViews(new THREE.Scene(), hf);
  const tank = world.spawnUnit('combatTank', 'atreides', 3, 3, { heading: 0 });
  tank.px = 3.5; tank.x = 4.5;              // moved one tile east during the last tick
  tank.turret = tank.pturret = Math.PI / 2; // turret faces south, hull faces east
  views.sync(world, 0.5, 0.016);
  assert.ok(Math.abs(views.renderPos(tank).x - 4.0) < 1e-9);
  assert.ok(Math.abs(views.views.get(tank.id).handles[0].params.turret + Math.PI / 2) < 1e-9);
});

test('house changes recolour the view', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const views = new UnitViews(new THREE.Scene(), new Heightfield(world.map, { sub: 2, seed: 1 }));
  const tank = world.spawnUnit('combatTank', 'atreides', 3, 3);
  views.sync(world, 1, 0.016);
  tank.house = 'ordos';
  views.sync(world, 1, 0.016);
  assert.equal(views.views.get(tank.id).handles[0].color.getHex(), new THREE.Color(0x2e9e3e).getHex());
});

test('structure views sit on the footprint centre and rise over 0.9 s', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new StructureViews(new THREE.Scene(), hf);
  const cy = world.spawnStructure('constructionYard', 'ordos', 4, 6);
  views.sync(world, 1000);
  const v = views.views.get(cy.id);
  const p = pos(v.handle.matrix);
  assert.deepEqual([p.x, p.z], [5, 7]);
  const s0 = new THREE.Vector3().setFromMatrixScale(v.handle.matrix).y;
  views.sync(world, 1450);
  const s1 = new THREE.Vector3().setFromMatrixScale(v.handle.matrix).y;
  views.sync(world, 2000);
  const s2 = new THREE.Vector3().setFromMatrixScale(v.handle.matrix).y;
  assert.ok(s0 < s1 && s1 < s2 && Math.abs(s2 - 1) < 1e-9);
  world.removeStructure(cy);
  views.sync(world, 2100);
  assert.equal(views.views.size, 0);
});
