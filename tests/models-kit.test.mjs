import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ModelBuilder, MAT, box, cyl, rbox, prism, lathe } from '../src/render/models/kit.js';
import { InstancedModel } from '../src/render/models/instancer.js';
import { getMaterial } from '../src/render/models/materials.js';

test('builder merges geometry per node and material, with vertex colours', () => {
  const b = new ModelBuilder('t');
  b.node('turret', { pivot: [0, 0.2, 0] });
  b.add(MAT.PAINT, box(1, 0.2, 0.5, { color: 0xff0000 }));
  b.add(MAT.PAINT, box(0.2, 0.2, 0.2, { p: [0.3, 0.2, 0] }));
  b.add(MAT.HOUSE, box(0.3, 0.1, 0.3), 'turret');
  const def = b.build({ radius: 0.5 });
  assert.equal(def.parts.length, 2);
  assert.equal(def.radius, 0.5);
  const paint = def.parts.find((p) => p.material === MAT.PAINT);
  assert.equal(paint.geometry.attributes.position.count, 72);
  assert.ok(paint.geometry.attributes.color && paint.geometry.attributes.uv && paint.geometry.attributes.normal);
});

test('mixed primitive types merge together', () => {
  const b = new ModelBuilder('mix');
  b.add(MAT.PAINT, rbox(0.3, 0.1, 0.2, 0.03));
  b.add(MAT.PAINT, cyl(0.05, 0.05, 0.2, 8, { r: [0, 0, Math.PI / 2] }));
  b.add(MAT.PAINT, prism([[0, 0], [0.2, 0], [0.1, 0.1]], 0.1));
  b.add(MAT.PAINT, lathe([[0.05, 0], [0.1, 0.1]], 10));
  assert.equal(b.build().parts.length, 1);
});

test('unknown nodes and undeclared parents are rejected', () => {
  const b = new ModelBuilder('bad');
  assert.throws(() => b.add(MAT.PAINT, box(1, 1, 1), 'nope'));
  assert.throws(() => b.node('child', { parent: 'missing' }));
});

test('instanced model grows, removes by swapping and poses nodes', () => {
  const scene = new THREE.Scene();
  const b = new ModelBuilder('t');
  b.node('turret', { pivot: [0, 1, 0], axis: 'y' });
  b.add(MAT.PAINT, box(1, 1, 1));
  b.add(MAT.HOUSE, box(0.5, 0.5, 0.5), 'turret');
  const model = new InstancedModel(b.build(), scene, { capacity: 2 });
  const handles = [];
  for (let i = 0; i < 5; i++) { const h = model.add(); h.matrix.makeTranslation(i, 0, 0); handles.push(h); }
  model.remove(handles[1]);
  handles[4].params.turret = Math.PI / 2;
  handles[4].color.set(0x00ff00);
  model.update();
  const [body, turret] = model.meshes;
  assert.equal(model.count, 4);
  assert.equal(turret.count, 4);
  assert.equal(handles[4].slot, 1);
  const m = new THREE.Matrix4();
  turret.getMatrixAt(1, m);
  const p = new THREE.Vector3().setFromMatrixPosition(m);
  assert.deepEqual([p.x, p.y, p.z].map((v) => +v.toFixed(3)), [4, 1, 0]);
  const c = new THREE.Color();
  turret.getColorAt(1, c);
  assert.equal(c.getHex(), 0x00ff00);
  assert.equal(body.instanceColor, null);
  assert.equal(scene.children.length, 2);
});

test('hidden handles collapse to zero scale', () => {
  const scene = new THREE.Scene();
  const b = new ModelBuilder('h');
  b.add(MAT.PAINT, box(1, 1, 1));
  const model = new InstancedModel(b.build(), scene);
  const h = model.add();
  h.visible = false;
  model.update();
  const m = new THREE.Matrix4();
  model.meshes[0].getMatrixAt(0, m);
  assert.equal(m.determinant(), 0);
});

test('every material key resolves outside the browser', () => {
  for (const key of Object.values(MAT)) assert.ok(getMaterial(key));
});
