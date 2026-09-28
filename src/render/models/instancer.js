// One InstancedMesh per model part (spec §5.1). Each instance has a root matrix, per-node parameters
// (turret yaw, recoil, wheel spin …), a house colour and a tread scroll value.
import * as THREE from 'three';
import { MAT } from './kit.js';
import { getMaterial, HOUSE_TINTED } from './materials.js';

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const local = new THREE.Matrix4(), tmp = new THREE.Matrix4(), hidden = new THREE.Matrix4().makeScale(0, 0, 0);

/** A node's own transform: move to its pivot, then turn, slide or scale by `v`. Part geometry lives in this space. */
export function nodeLocal(node, v, out) {
  out.makeTranslation(node.pivot[0], node.pivot[1], node.pivot[2]);
  if (node.kind === 'rot') out.multiply(tmp.makeRotationAxis(AXES[node.axis], v));
  else if (node.kind === 'trans') { const a = AXES[node.axis]; out.multiply(tmp.makeTranslation(a.x * v, a.y * v, a.z * v)); }
  else if (node.kind === 'scale') out.multiply(tmp.makeScale(v, v, v));
  return out;
}

/** Matrices of every node at rest (default parameters) under `root`; parents are declared before children. */
export function nodeMatricesAtRest(def, root = new THREE.Matrix4()) {
  const out = {};
  for (const [name, node] of Object.entries(def.nodes)) {
    out[name] = node.parent ? new THREE.Matrix4().multiplyMatrices(out[node.parent], nodeLocal(node, node.value, new THREE.Matrix4())) : root.clone();
  }
  return out;
}

export class InstancedModel {
  constructor(def, scene, { capacity = 8, castShadow = true } = {}) {
    this.def = def;
    this.scene = scene;
    this.castShadow = castShadow;
    this.capacity = capacity;
    this.count = 0;
    this.handles = [];
    this.nodeNames = Object.keys(def.nodes);
    this.nodeIndex = Object.fromEntries(this.nodeNames.map((n, i) => [n, i]));
    this.nodeMatrices = this.nodeNames.map(() => new THREE.Matrix4());
    this.partNode = def.parts.map((p) => this.nodeIndex[p.node]);
    this.meshes = def.parts.map((part) => this.createMesh(part, capacity));
  }

  createMesh(part, capacity) {
    const mesh = new THREE.InstancedMesh(part.geometry, getMaterial(part.material), capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = this.castShadow && part.material !== MAT.LIGHT && part.material !== MAT.HOUSE_LIGHT;
    mesh.receiveShadow = true;
    if (HOUSE_TINTED.has(part.material)) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    if (part.material === MAT.TREAD) {
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
      attr.setUsage(THREE.DynamicDrawUsage);
      part.geometry.setAttribute('aTread', attr);
    }
    this.scene.add(mesh);
    return mesh;
  }

  add() {
    if (this.count === this.capacity) this.grow();
    const handle = { slot: this.count, matrix: new THREE.Matrix4(), params: {}, color: new THREE.Color(1, 1, 1), visible: true };
    this.handles[this.count++] = handle;
    return handle;
  }

  remove(handle) {
    if (handle.slot < 0) return;
    const last = this.handles[this.count - 1];
    if (last !== handle) { last.slot = handle.slot; this.handles[handle.slot] = last; }
    this.handles[--this.count] = undefined;
    handle.slot = -1;
  }

  grow() {
    const capacity = this.capacity * 2;
    this.meshes = this.meshes.map((old, i) => {
      const part = this.def.parts[i];
      const oldTread = part.geometry.getAttribute('aTread')?.array ?? null;
      this.scene.remove(old);
      old.dispose();
      const mesh = this.createMesh(part, capacity);
      mesh.instanceMatrix.array.set(old.instanceMatrix.array);
      if (old.instanceColor) mesh.instanceColor.array.set(old.instanceColor.array);
      if (oldTread) part.geometry.getAttribute('aTread').array.set(oldTread);
      return mesh;
    });
    this.capacity = capacity;
  }

  update() {
    const nodes = this.def.nodes;
    for (let s = 0; s < this.count; s++) {
      const h = this.handles[s];
      if (!h.visible) { for (const mesh of this.meshes) mesh.setMatrixAt(s, hidden); continue; }
      for (let n = 0; n < this.nodeNames.length; n++) {
        const node = nodes[this.nodeNames[n]];
        const out = this.nodeMatrices[n];
        if (!node.parent) { out.copy(h.matrix); continue; }
        nodeLocal(node, h.params[node.param] ?? node.value, local);
        out.multiplyMatrices(this.nodeMatrices[this.nodeIndex[node.parent]], local);
      }
      for (let p = 0; p < this.meshes.length; p++) {
        const mesh = this.meshes[p];
        mesh.setMatrixAt(s, this.nodeMatrices[this.partNode[p]]);
        if (mesh.instanceColor) mesh.setColorAt(s, h.color);
      }
    }
    for (let p = 0; p < this.meshes.length; p++) {
      const mesh = this.meshes[p];
      mesh.count = this.count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      const tread = this.def.parts[p].geometry.getAttribute('aTread');
      if (tread) {
        for (let s = 0; s < this.count; s++) tread.array[s] = this.handles[s].params.tread ?? 0;
        tread.needsUpdate = true;
      }
    }
  }

  dispose() {
    for (const mesh of this.meshes) { this.scene.remove(mesh); mesh.dispose(); }
  }
}
