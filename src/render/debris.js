// Flying debris (spec §5.4 "explosions with debris"; visual-structures.md "Destroyed"): shards,
// plates and chunks thrown by dying vehicles and collapsing buildings. One InstancedMesh of a
// flat-shaded chunk, scaled per piece into plates or lumps and tinted per piece. Pieces tumble,
// bounce once on the heightfield, settle, lie a while and sink away. Burning pieces trail smoke and
// flame through the effect pools while they fly. The capacity is fixed by the quality preset: a
// full pool refuses new pieces rather than growing, and nothing is allocated per frame.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

const GRAVITY = 9, FADE = 1.4;
const FLYING = 0, BOUNCED = 1, RESTING = 2, SINKING = 3;
let shard = null;

/** A lumpy, flat-shaded unit chunk (about 1 × 1 × 1), the same every run. */
export function shardGeometry() {
  if (shard) return shard;
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const pts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) pts.push(new THREE.Vector3(sx * (0.5 + r() * 0.12), sy * (0.5 + r() * 0.1), sz * (0.5 + r() * 0.12)));
  for (let k = 0; k < 4; k++) pts.push(new THREE.Vector3(r() * 0.6, r() * 0.55, r() * 0.6));
  shard = new ConvexGeometry(pts);
  shard.computeBoundingSphere();
  return shard;
}

/** Shared by the flying debris and the rubble: rough, a little metallic, flat facets. */
export function debrisMaterial() {
  return new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.28, flatShading: true });
}

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), dq = new THREE.Quaternion(), eu = new THREE.Euler();
const pv = new THREE.Vector3(), sv = new THREE.Vector3(), col = new THREE.Color();

export class Debris {
  constructor(scene, { capacity = 160, castShadow = false } = {}) {
    const N = (this.capacity = Math.max(8, Math.floor(capacity)));
    this.n = 0;
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.rot = new Float32Array(N * 4);
    this.spin = new Float32Array(N * 3);
    this.scale = new Float32Array(N * 3);
    this.state = new Uint8Array(N);
    this.timer = new Float32Array(N);
    this.rest = new Float32Array(N);
    this.burn = new Float32Array(N);
    this.mesh = new THREE.InstancedMesh(shardGeometry(), debrisMaterial(), N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = castShadow;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  /**
   * One piece at (x, y, z) flying at v, sized s = [x, y, z], tinted `color` (hex or THREE.Color).
   * rest: seconds it lies before sinking away; burn: seconds it trails fire. Returns false when full.
   */
  emit({ x, y, z, vx = 0, vy = 0, vz = 0, size, color = 0x333333, rest = 5, burn = 0, spin = 12 }) {
    if (this.n >= this.capacity) return false;
    const i = this.n++, p = i * 3;
    this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
    this.vel[p] = vx; this.vel[p + 1] = vy; this.vel[p + 2] = vz;
    this.scale[p] = size[0]; this.scale[p + 1] = size[1]; this.scale[p + 2] = size[2];
    this.spin[p] = (Math.random() - 0.5) * spin; this.spin[p + 1] = (Math.random() - 0.5) * spin; this.spin[p + 2] = (Math.random() - 0.5) * spin;
    q.setFromEuler(eu.set(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3)).toArray(this.rot, i * 4);
    this.state[i] = FLYING;
    this.timer[i] = 0;
    this.rest[i] = rest;
    this.burn[i] = burn;
    col.set(color).toArray(this.mesh.instanceColor.array, p);
    return true;
  }

  kill(i) {
    const last = --this.n;
    if (i === last) return;
    for (const a of [this.pos, this.vel, this.spin, this.scale, this.mesh.instanceColor.array]) a.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.rot.copyWithin(i * 4, last * 4, last * 4 + 4);
    this.state[i] = this.state[last];
    this.timer[i] = this.timer[last];
    this.rest[i] = this.rest[last];
    this.burn[i] = this.burn[last];
  }

  /** heightAt(x, z): the ground. fx: the Effects pools, for the trails of burning pieces and dust where big ones land (optional). */
  update(dt, heightAt, fx = null) {
    if (this.n === 0 && this.mesh.count === 0) return;
    const P = this.pos, V = this.vel, S = this.scale;
    let i = 0;
    while (i < this.n) {
      const p = i * 3, st = this.state[i];
      let fade = 1;
      if (st <= BOUNCED) {
        V[p + 1] -= GRAVITY * dt;
        P[p] += V[p] * dt; P[p + 1] += V[p + 1] * dt; P[p + 2] += V[p + 2] * dt;
        q.fromArray(this.rot, i * 4).multiply(dq.setFromEuler(eu.set(this.spin[p] * dt, this.spin[p + 1] * dt, this.spin[p + 2] * dt))).toArray(this.rot, i * 4);
        const ground = heightAt(P[p], P[p + 2]) + S[p + 1] * 0.3;
        if (P[p + 1] <= ground && V[p + 1] < 0) {
          if (st === FLYING && V[p + 1] < -1.2) {   // one bounce, losing most of its speed
            V[p + 1] *= -0.3; V[p] *= 0.45; V[p + 2] *= 0.45;
            for (let k = 0; k < 3; k++) this.spin[p + k] *= 0.45;
            P[p + 1] = ground;
            this.state[i] = BOUNCED;
            if (fx && S[p] > 0.14) fx.dust(P[p], ground, P[p + 2], 0.6);
          } else {
            P[p + 1] = ground - S[p + 1] * 0.35;   // half settled into the sand
            this.state[i] = RESTING;
            this.timer[i] = this.rest[i];
          }
        }
        if (fx && this.burn[i] > 0) {
          this.burn[i] -= dt;
          if (Math.random() < dt * 40) {
            fx.smoke.emit({ x: P[p], y: P[p + 1], z: P[p + 2], vy: 0.25, life: 0.7 + Math.random() * 0.5, size: [0.08, 0.38], color: [0.1, 0.09, 0.08], color2: [0.38, 0.36, 0.33], alpha: [0.6, 0], drag: 1.2 });
            fx.glow.emit({ x: P[p], y: P[p + 1], z: P[p + 2], life: 0.12, size: [0.16, 0.05], color: [7, 3, 0.7], alpha: [1, 0] });
          }
        }
      } else if (st === RESTING) {
        if ((this.timer[i] -= dt) <= 0) { this.state[i] = SINKING; this.timer[i] = FADE; }
      } else {
        if ((this.timer[i] -= dt) <= 0) { this.kill(i); continue; }
        fade = this.timer[i] / FADE;
        P[p + 1] -= dt * 0.08;
      }
      m4.compose(pv.set(P[p], P[p + 1], P[p + 2]), q.fromArray(this.rot, i * 4), sv.set(S[p] * fade, S[p + 1] * fade, S[p + 2] * fade));
      m4.toArray(this.mesh.instanceMatrix.array, i * 16);
      i++;
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
