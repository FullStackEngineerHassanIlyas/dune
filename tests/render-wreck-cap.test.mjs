import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Wrecks } from '../src/render/wrecks.js';
const flat = { heightAt: () => 0, normalAt: (x, z, out) => Object.assign(out, { x: 0, y: 1, z: 0 }) };

test('wreck death bursts retain only a bounded standing and fading reserve', () => {
  for (const alt of [0, 1.6]) {
    const w = new Wrecks(new THREE.Scene(), flat, { cap: 4 });
    for (let i = 0; i < 200; i++) w.add({ modelId: alt ? 'ornithopter' : 'combatTank', x: i, z: 1, alt });
    assert.ok(w.count <= 2 * w.cap, `${w.count} retained for cap ${w.cap}`);
    assert.ok(w.list.every(o => o.x >= 192), 'only newest wrecks remain');
    assert.ok(w.list.some(o => o.x === 199), 'latest death is represented');
    for (const m of w.models.values()) assert.ok(m.count <= 2 * w.cap);
    for (let k = 0; k < 80; k++) w.update(0.1, null);
    assert.equal(w.count, w.cap, 'old falling wrecks keep their early-sink age after landing');
    for (let k = 0; k < 320; k++) w.update(0.1, null);
    assert.equal(w.count, 0);
    w.dispose();
  }
});
