// What a destroyed building leaves (visual-structures.md "Destroyed"; mechanics-campaign.md: the
// original turns the footprint into rubble ground): broken foundation slabs, grey and white chunks
// with dark soil lumps, and twisted metal sticking up, low enough to drive over. One static
// InstancedMesh used as a ring: when it is full the oldest pieces make way. A building placed on
// the spot clears the rubble under it.
import * as THREE from 'three';
import { shardGeometry, debrisMaterial } from './debris.js';

const SLAB = [0x8e8a84, 0x7a756e, 0x9c958b, 0x6e6a66];
const CHUNK = [0x9492b4, 0xc9c5c0, 0x5c3c24, 0x6c4a24, 0x2c2622, 0x8a8480];
const METAL = [0x33363d, 0x46403a, 0x24262b];
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), pv = new THREE.Vector3(), sv = new THREE.Vector3(), col = new THREE.Color();
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const rnd = (a, b) => a + Math.random() * (b - a);

export class Rubble {
  constructor(scene, { capacity = 480, castShadow = false } = {}) {
    const N = (this.capacity = Math.max(16, Math.floor(capacity)));
    this.next = 0;
    this.used = 0;
    this.at = new Float32Array(N * 2);   // each piece's centre, for clear()
    this.mesh = new THREE.InstancedMesh(shardGeometry(), debrisMaterial(), N);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = castShadow;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  piece(x, y, z, sx, sy, sz, yaw, tilt, color) {
    const i = this.next;
    this.next = (i + 1) % this.capacity;
    this.used = Math.min(this.capacity, this.used + 1);
    q.setFromEuler(eu.set(rnd(-tilt, tilt), yaw, rnd(-tilt, tilt)));
    m4.compose(pv.set(x, y, z), q, sv.set(sx, sy, sz));
    this.mesh.setMatrixAt(i, m4);
    this.mesh.setColorAt(i, col.set(color));
    this.at[i * 2] = x;
    this.at[i * 2 + 1] = z;
    this.mesh.count = this.used;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  /**
   * Rubble over the footprint (x, y, w, h in tiles). house: a colour for a few scorched panels among
   * the ruins. density scales the piece count (the quality preset); a wall leaves only a little.
   */
  site(x, y, w, h, heightAt, { house = 0x888888, wall = false, density = 1 } = {}) {
    const tiles = w * h, spill = wall ? 0.05 : 0.2;
    const at = () => { const px = x - spill + Math.random() * (w + spill * 2), pz = y - spill + Math.random() * (h + spill * 2); return [px, pz, heightAt(px, pz)]; };
    const n = (k) => Math.max(1, Math.round(k * tiles * density));
    const burnt = col.set(house).multiplyScalar(0.45).getHex();
    for (let k = 0, m = wall ? 1 : n(1.2); k < m; k++) {   // broken foundation slabs lying almost flat
      const [px, pz, gy] = at(), sx = rnd(0.28, 0.5), sz = rnd(0.24, 0.45), sy = rnd(0.03, 0.05);
      this.piece(px, gy + sy * 0.2, pz, sx, sy, sz, rnd(0, Math.PI), 0.12, pick(SLAB));
    }
    for (let k = 0, m = wall ? 4 : n(3.2); k < m; k++) {   // chunks and lumps of soil
      const [px, pz, gy] = at(), s = rnd(0.06, wall ? 0.14 : 0.2);
      this.piece(px, gy + s * 0.2, pz, s * rnd(0.8, 1.3), s * rnd(0.5, 0.9), s * rnd(0.8, 1.3), rnd(0, Math.PI * 2), 0.5, pick(CHUNK));
    }
    if (wall) return;
    for (let k = 0, m = n(0.7); k < m; k++) {   // twisted plates and spars jutting up, a few still in house paint
      const [px, pz, gy] = at();
      this.piece(px, gy + 0.04, pz, rnd(0.22, 0.4), rnd(0.02, 0.035), rnd(0.05, 0.1), rnd(0, Math.PI * 2), 0.8, Math.random() < 0.3 ? burnt : pick(METAL));
    }
  }

  /** Hides every piece inside the rect (a new building going up on old rubble). */
  clear(x, y, w, h) {
    let changed = false;
    for (let i = 0; i < this.used; i++) {
      const px = this.at[i * 2], pz = this.at[i * 2 + 1];
      if (px >= x - 0.25 && px <= x + w + 0.25 && pz >= y - 0.25 && pz <= y + h + 0.25) { this.mesh.setMatrixAt(i, hidden); this.at[i * 2] = -1e6; changed = true; }
    }
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
