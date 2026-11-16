import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { flatWorld } from './helpers.mjs';
import { HOUSES } from '../src/data/houses.js';

const context = () => new Proxy({}, { get(t, k) {
  if (k in t) return t[k];
  if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
  return typeof k === 'string' && k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {};
} });
globalThis.document ??= { createElement: () => ({ getContext() { return this.ctx ??= context(); } }) };
const { BattleStage } = await import('../src/game/battle-stage.js');

function fixture() {
  const world = flatWorld(24, 24), scene = new THREE.Scene();
  const s = new BattleStage({ world, scene, quality: { particles: 1500, flashLights: 0 }, rig: { target: new THREE.Vector3(12, 0, 12), distance: 16 } });
  s.catchingUp = false;
  const events = () => { for (const e of world.events.drain()) s.onEvent(e, world.time * 1000); };
  return { world, scene, s, events };
}

test('removed structures release their roof emitters even after a sale', () => {
  const { world, s, events } = fixture();
  for (let i = 0; i < 12; i++) {
    const b = world.spawnStructure('windtrap', 'atreides', 6, 6);
    b.hp = b.maxHp / 5;
    s.destruction.wounded(world, 0.1, s.positionOf);
    assert.ok(s.destruction.roofs.has(b.id));
    world.issue('atreides', { type: 'sell', structureId: b.id }); world.step(); events();
    assert.ok(!world.structures.has(b.id), 'sold');
    assert.equal(s.destruction.roofs.size, 0, 'no emitter keyed by a removed building');
    s.effects.update(10);
  }
  s.dispose();
});

test('a removed twin-barrel unit releases its volley counter without a death event', () => {
  const { world, s, events } = fixture();
  const u = world.spawnUnit('siegeTank', 'atreides', 8, 8);
  s.prime(0);
  s.onEvent({ type: 'fired', id: u.id, kind: 'unit', house: u.house, weapon: 'heavyCannon', projectile: 'shell', x: u.x, y: u.y, tx: u.x + 4, ty: u.y }, 0);
  assert.ok(s.volley.has(u.id));
  world.removeUnit(u); events();
  s.sync(1, 0.1, 100);
  assert.equal(s.volley.size, 0);
  assert.equal(s.unitViews.views.size, 0);
  s.dispose();
});

test('repair stops new roof emissions and capture keeps damage while recolouring the same view', () => {
  const { world, s } = fixture();
  const b = world.spawnStructure('windtrap', 'atreides', 6, 6);
  b.hp = b.maxHp / 5;
  s.prime(0);
  const v = s.structureViews.views.get(b.id), points = s.destruction.roofPoints(b);
  s.destruction.wounded(world, 0.1, s.positionOf);
  assert.ok(s.effects.glow.n > 0, 'critical building emits fire');
  b.house = 'harkonnen'; // capture preserves id, footprint and hit points
  s.structureViews.sync(world, 1000);
  assert.equal(s.structureViews.views.get(b.id), v);
  assert.equal(v.handles[0].color.getHex(), new THREE.Color(HOUSES.harkonnen.color).getHex());
  assert.equal(s.destruction.roofPoints(b), points);
  b.hp = b.maxHp;
  const before = [s.effects.glow.n, s.effects.smoke.n];
  for (let k = 0; k < 20; k++) s.destruction.wounded(world, 0.1, s.positionOf);
  assert.deepEqual([s.effects.glow.n, s.effects.smoke.n], before, 'no new fire or smoke after repair');
  for (let k = 0; k < 100; k++) s.effects.update(0.1);
  assert.equal(s.effects.glow.n + s.effects.smoke.n, 0, 'old particles finish naturally');
  s.dispose();
});

test('battle disposal empties per-entity emitter and firing maps', () => {
  const { world, scene, s } = fixture();
  const b = world.spawnStructure('windtrap', 'atreides', 6, 6);
  const u = world.spawnUnit('siegeTank', 'atreides', 8, 8);
  s.destruction.roofPoints(b);
  s.prime(0);
  s.onEvent({ type: 'fired', id: u.id, kind: 'unit', house: u.house, projectile: 'shell', x: u.x, y: u.y, tx: u.x + 4, ty: u.y }, 0);
  world.projectiles.set(9999, { id: 9999, projectile: 'rocket', house: 'atreides', px: 5, py: 5, x: 5.1, y: 5, sx: 5, sy: 5, tx: 10, ty: 5, speed: 12.5 });
  s.sync(1, 0.05, 50);
  assert.equal(s.shotFx.trails.size, 1);
  s.dispose();
  assert.equal(s.destruction.roofs.size, 0);
  assert.equal(s.volley.size, 0);
  assert.equal(s.trackFrom.size, 0);
  assert.equal(s.shotFx.trails.size, 0);
  assert.equal(scene.children.length, 0);
});
