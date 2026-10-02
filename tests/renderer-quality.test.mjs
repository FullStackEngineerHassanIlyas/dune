// Renderer3D.setQuality (spec §8) on a stand-in WebGL renderer: the composer's passes, shadows, MSAA and the bloom's
// size for each preset, switched live back and forth, with a pass from outside (the menu's dust) kept ahead of the grade.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { QUALITY } from '../src/render/quality.js';

globalThis.devicePixelRatio = 1; globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
const { Renderer3D } = await import('../src/render/renderer.js');

const W = 1328, H = 900;
const pass = (name) => ({ name, setSize() {} });
function make(name) {
  const r = Object.create(Renderer3D.prototype);
  r.canvas = { clientWidth: W, clientHeight: H };
  r.renderer = { shadowMap: { enabled: false, type: 0 }, getPixelRatio: () => 1, getSize: (v) => v.set(W, H), setPixelRatio() {}, setSize() {}, getRenderTarget: () => null, setRenderTarget() {} };
  r.camera = new THREE.PerspectiveCamera();
  r.sun = new THREE.DirectionalLight();
  r.renderPass = pass('render');
  r.grade = pass('grade');
  r.output = pass('output');
  r.setQuality(name);
  r.resize();
  return r;
}
const names = (r) => r.composer.passes.map((p) => p.name ?? p.constructor.name);

test('each preset builds its own chain: Low no bloom and FXAA, Medium half-size bloom and FXAA, High full bloom and MSAA 4x', () => {
  const low = make('low'), medium = make('medium'), high = make('high');
  assert.deepEqual(names(low), ['render', 'grade', 'output', 'FXAAPass']);
  assert.deepEqual(names(medium), ['render', 'UnrealBloomPass', 'grade', 'output', 'FXAAPass']);
  assert.deepEqual(names(high), ['render', 'UnrealBloomPass', 'grade', 'output']);
  assert.equal(medium.bloom.renderTargetBright.width, W / 2, 'Medium blooms at half resolution');
  assert.equal(high.bloom.renderTargetBright.width, W, 'High at full resolution');
  assert.equal(low.composer.renderTarget1.samples, 0);
  assert.equal(medium.composer.renderTarget1.samples, 0);
  assert.equal(high.composer.renderTarget1.samples, QUALITY.high.msaa);
  assert.ok(!low.renderer.shadowMap.enabled && !low.sun.castShadow, 'Low: shadows off');
  assert.ok(medium.renderer.shadowMap.enabled && medium.sun.castShadow);
  assert.equal(medium.sun.shadow.mapSize.x, 1024);
  assert.equal(high.sun.shadow.mapSize.x, 2048);
  assert.ok(high.sun.shadow.radius > medium.sun.shadow.radius, 'High: soft shadows');
});

test('switched live: Medium -> Low -> High -> Medium keeps an outside pass ahead of the grade and leaves nothing behind', () => {
  const r = make('medium');
  r.composer.insertPass(pass('dust'), r.composer.passes.indexOf(r.grade));
  assert.deepEqual(names(r), ['render', 'UnrealBloomPass', 'dust', 'grade', 'output', 'FXAAPass']);
  r.setQuality('low');
  assert.deepEqual(names(r), ['render', 'dust', 'grade', 'output', 'FXAAPass'], 'bloom off, the dust kept');
  assert.equal(r.bloom, null, 'the bloom pass is let go');
  assert.ok(!r.renderer.shadowMap.enabled && !r.sun.castShadow);
  r.setQuality('high');
  assert.deepEqual(names(r), ['render', 'UnrealBloomPass', 'dust', 'grade', 'output'], 'MSAA instead of FXAA');
  assert.equal(r.composer.renderTarget1.samples, 4);
  assert.equal(r.bloom.renderTargetBright.width, W);
  assert.equal(r.sun.shadow.mapSize.x, 2048);
  r.setQuality('medium');
  assert.deepEqual(names(r), ['render', 'UnrealBloomPass', 'dust', 'grade', 'output', 'FXAAPass']);
  assert.equal(r.composer.renderTarget1.samples, 0, 'no MSAA left from High');
  assert.equal(r.bloom.renderTargetBright.width, W / 2);
  assert.equal(r.sun.shadow.mapSize.x, 1024);
  assert.equal(r.qualityName, 'medium');
});
