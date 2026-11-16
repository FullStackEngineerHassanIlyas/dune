import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { flatWorld, runUntil } from './helpers.mjs';
import { destroyStructure } from '../src/sim/combat.js';

const context = () => new Proxy({}, { get(t, k) {
  if (k in t) return t[k];
  if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
  return typeof k === 'string' && k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {};
} });
globalThis.document ??= { createElement: () => ({ getContext() { return this.ctx ??= context(); } }) };
const { BattleStage } = await import('../src/game/battle-stage.js');

test('a harvester ejected from a destroyed refinery snaps on every frame of that tick', () => {
  const world = flatWorld(32, 32);
  const ref = world.spawnStructure('refinery', 'atreides', 10, 10);
  const harv = [...world.units.values()].find(u => u.typeId === 'harvester');
  harv.harvest.load = 100;
  world.issue('atreides', { type: 'return', ids: [harv.id] });
  assert.ok(runUntil(world, () => ref.slot?.state === 'unloading', 30) > 0);
  const s = new BattleStage({ world, scene: new THREE.Scene(), quality: { particles: 1500, flashLights: 0 }, rig: { target: new THREE.Vector3(12, 0, 12), distance: 16 } });
  s.prime(world.time * 1000);
  world.events.drain();
  destroyStructure(world, ref);
  world.step(); // the refinery releases its survivor after previous poses were saved
  assert.equal(harv.docked, 0);
  assert.ok(Math.hypot(harv.x - harv.px, harv.y - harv.py) > 0.01, 'an actual ejection');
  for (const e of world.events.drain()) s.onEvent(e, world.time * 1000);
  for (const alpha of [0, 0.25, 0.5, 0.9]) {
    s.sync(alpha, 0, world.time * 1000);
    assert.deepEqual(s.positionOf(harv), { x: harv.x, z: harv.y }, 'no glide out of the vanished pad');
  }
  world.step();
  s.sync(0.5, 0, world.time * 1000);
  assert.deepEqual(s.positionOf(harv), { x: (harv.x + harv.px) / 2, z: (harv.y + harv.py) / 2 }, 'normal interpolation resumes next tick');
  s.dispose();
});
