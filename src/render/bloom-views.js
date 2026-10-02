// Spice bloom mounds on screen (spec §4.8, §5.2 "bloom mounds"): every mound in map.bloom the viewer has
// explored, drawn as a low swollen blister of rust-red sand with a few smaller bulbs round it, breathing
// very slightly as if something stirred under it. When one bursts (erupt) the mound goes in a fountain of
// spice and sand, and the dust it leaves hangs over the new field a moment later (render/sand-fx.js); the
// field itself is the terrain's. One instanced mesh draws the mounds; the list is rebuilt only when
// world.bloomRevision changes, and nothing is allocated per frame.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bloomBurst, bloomCloud } from './sand-fx.js';

const CLOUD_AFTER = 0.9;   // seconds from the fountain to its dust cloud: as the spice comes back down

const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), m = new THREE.Matrix4(), Y = new THREE.Vector3(0, 1, 0);
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * A lumpy dome on y = 0 squashed to (rx, h, rz) at (x, z): a crust of rust-brown sand swollen over the
 * spice, split by dark cracks running down from the crown, bright spice showing through near the top.
 */
function blister(rx, h, rz, x, z, seg, cracks) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(3, seg / 2), 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = g.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i), a = Math.atan2(pz, px);
    const k = 1 + 0.08 * Math.sin(4 * a + x * 7) + 0.05 * Math.sin(7 * a + 1);
    pos.setXYZ(i, px * k * rx + x, py * h * (1 + 0.1 * Math.sin(5 * a)), pz * k * rz + z);
    const crack = cracks && py > 0.25 && Math.abs(Math.sin(cracks * a + py * 3)) < 0.16 ? 1 : 0;
    const t = py, glint = Math.sin(px * 41 + pz * 29) > 0.86 ? 1 : 0;
    if (crack) c.setRGB(0.22, 0.07, 0.03, THREE.SRGBColorSpace);
    else c.setRGB(0.42 + 0.34 * t + 0.15 * glint, 0.2 + 0.16 * t + 0.1 * glint, 0.1 + 0.07 * t + 0.05 * glint, THREE.SRGBColorSpace);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function moundGeometry() {
  const parts = [blister(0.4, 0.24, 0.36, 0, 0, 24, 5)];
  for (const [a, r, k] of [[0.4, 0.34, 1], [2.1, 0.36, 0.8], [3.5, 0.32, 0.9], [5, 0.38, 0.7]]) parts.push(blister(0.13 * k, 0.11 * k, 0.13 * k, Math.cos(a) * r, Math.sin(a) * r, 10, 0));
  return mergeGeometries(parts.map((g) => g.toNonIndexed()), false);
}

let mound = null;   // shared by every battle

export class BloomViews {
  constructor(scene, hf) {
    this.scene = scene;
    this.hf = hf;
    mound ??= { geometry: moundGeometry(), material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }) };
    this.capacity = 0;
    this.mesh = null;
    this.tiles = [];      // tile index of every mound
    this.rev = -1;
    this.clock = 0;
    this.clouds = [];     // [x, y, z, at] of dust clouds still to rise
  }

  /** A bloom bursting at (x, z), y the ground there: the fountain now, its cloud in a moment. */
  erupt(fx, x, y, z) {
    bloomBurst(fx, x, y, z);
    this.fx = fx;
    this.clouds.push([x, y, z, this.clock + CLOUD_AFTER]);
  }

  /** explored(x, z): whether the viewer has uncovered that ground. */
  sync(world, dt, explored) {
    const map = world.map;
    this.clock += dt;
    for (let k = this.clouds.length - 1; k >= 0; k--) {
      const c = this.clouds[k];
      if (this.clock < c[3]) continue;
      bloomCloud(this.fx, c[0], c[1], c[2]);
      this.clouds.splice(k, 1);
    }
    if (world.bloomRevision !== this.rev) {
      this.rev = world.bloomRevision;
      this.tiles.length = 0;
      for (let i = 0; i < map.bloom.length; i++) if (map.bloom[i]) this.tiles.push(i);
      if (this.tiles.length > this.capacity) this.grow(this.tiles.length);
    }
    if (!this.mesh) return;
    for (let k = 0; k < this.tiles.length; k++) {
      const i = this.tiles[k], x = map.xOf(i) + 0.5, z = map.yOf(i) + 0.5;
      if (!explored(x, z)) { this.mesh.setMatrixAt(k, hidden); continue; }
      const phase = i * 0.73, breath = 1 + 0.05 * Math.sin(this.clock * 1.3 + phase);
      p.set(x, this.hf.heightAt(x, z) - 0.02, z);
      q.setFromAxisAngle(Y, phase);
      s.set(1, breath, 1);
      this.mesh.setMatrixAt(k, m.compose(p, q, s));
    }
    this.mesh.count = this.tiles.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  grow(n) {
    this.dispose();
    this.capacity = Math.max(8, n * 2);
    this.mesh = new THREE.InstancedMesh(mound.geometry, mound.material, this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
  }

  /** Frees the instanced mesh; the shared geometry and material stay. */
  dispose() {
    if (!this.mesh) return;
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.mesh = null;
  }
}
