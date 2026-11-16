import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { modelDef } from '../src/render/models/index.js';
import { InstancedModel } from '../src/render/models/instancer.js';
import { Debris } from '../src/render/debris.js';
import { Rubble } from '../src/render/rubble.js';

// three.js draws every shadow caster with one shared depth material unless the mesh brings its own
// (customDepthMaterial), and it works that material's shader out again each time the next caster differs in
// instancing or instance colours. Casters of one kind must therefore never share a depth material with another kind.
const kind = (o) => `${o.isInstancedMesh ? 'instanced' : 'plain'}${o.isInstancedMesh && o.instanceColor ? '+colour' : ''}`;

test('shadow casters of different kinds never share a depth material', () => {
  const scene = new THREE.Scene();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial());
  ground.castShadow = true;
  scene.add(ground);
  new InstancedModel(modelDef('combatTank'), scene, { capacity: 4 });   // house-tinted parts with instance colours, plain parts without
  new InstancedModel(modelDef('quad'), scene, { capacity: 4 });
  new Debris(scene, { capacity: 32, castShadow: true });
  new Rubble(scene, { capacity: 32, castShadow: true });

  const shared = new THREE.MeshDepthMaterial();   // stands for three.js's own
  const kinds = new Map();
  scene.traverse((o) => {
    if (!o.isMesh || !o.castShadow) return;
    const m = o.customDepthMaterial ?? shared;
    if (!kinds.has(m)) kinds.set(m, new Set());
    kinds.get(m).add(kind(o));
  });
  const all = new Set([...kinds.values()].flatMap((s) => [...s]));
  assert.deepEqual([...all].sort(), ['instanced', 'instanced+colour', 'plain']);
  for (const [, s] of kinds) assert.equal(s.size, 1, `one depth material serves ${[...s].join(', ')}`);
});

test('a grown instanced model keeps its depth materials apart', () => {
  const scene = new THREE.Scene();
  const model = new InstancedModel(modelDef('combatTank'), scene, { capacity: 1 });
  model.add(); model.add();   // the second outgrows the first meshes
  const casters = model.meshes.filter((m) => m.castShadow);
  assert.ok(casters.length > 0);
  for (const m of casters) assert.ok(m.customDepthMaterial?.isMeshDepthMaterial, 'a depth material of its own kind');
});
