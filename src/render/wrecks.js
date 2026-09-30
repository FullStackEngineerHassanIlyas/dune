// Burnt-out wrecks (spec §5.4, visual-units.md §1.1 damage fire): a dead vehicle's own model,
// charred black with rust-brown and ash patches, knocked askew and a little sunk, left where it died.
// It burns, then smoulders, then sinks into the sand after about 20–40 s. A wreck that dies in the
// air (an aircraft, or a load under its Carryall) falls, spinning and trailing fire, and crashes
// (onCrash) before it lies burning. One InstancedModel per wrecked model type; the charred model
// copies are built once and kept for the next battle, as the live models are.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from './models/kit.js';
import { modelDef } from './models/index.js';
import { InstancedModel } from './models/instancer.js';
import { poseMatrix } from './views/pose.js';
import { fire, blackSmoke, greySmoke } from './burn-fx.js';

const SINK_S = 4.5, FALL_G = 5.5;
const charred = new Map();
const frac = (v) => v - Math.floor(v);

/**
 * The model `id` burnt out: the same nodes and shapes, every part in the dark material (no house
 * tint, no lights, no tread scroll), vertex colours charred per face into soot, rust and ash, and
 * parts merged per node so a wreck costs a draw call per moving part.
 */
export function wreckDef(id) {
  if (charred.has(id)) return charred.get(id);
  const def = modelDef(id), byNode = new Map();
  for (const part of def.parts) {
    const src = part.geometry, pos = src.getAttribute('position'), c = src.getAttribute('color');
    const g = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) g.setAttribute(name, src.getAttribute(name));
    const out = new Float32Array(pos.count * 3);
    for (let t = 0; t + 2 < pos.count; t += 3) {   // one tone per face: panels burn unevenly
      const cx = pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2), cy = pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2), cz = pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2);
      const h = frac(Math.sin(cx * 41.3 + cy * 17.9 + cz * 29.7) * 43758.5);
      for (let v = t; v < t + 3; v++) {
        const lum = Math.min(1, 0.3 * c.getX(v) + 0.55 * c.getY(v) + 0.15 * c.getZ(v));
        const k = 0.007 + 0.016 * lum;
        let r = k * 1.1, gg = k, b = k * 0.88;
        if (h < 0.2) { r += 0.032; gg += 0.01; b += 0.002; }           // rust
        else if (h > 0.88) { r += 0.028; gg += 0.027; b += 0.025; }    // pale ash
        out[v * 3] = r; out[v * 3 + 1] = gg; out[v * 3 + 2] = b;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(out, 3));
    if (!byNode.has(part.node)) byNode.set(part.node, []);
    byNode.get(part.node).push(g);
  }
  const parts = [...byNode].map(([node, geos]) => {
    const geometry = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    geometry.computeBoundingSphere();
    return { node, material: MAT.DARK, geometry };
  });
  const out = { ...def, name: `${def.name}Wreck`, parts, height: modelTop(def) };
  charred.set(id, out);
  return out;
}

const tops = new WeakMap();

/** How tall a model stands at rest (its parts' tops over the ground, node pivots included). */
export function modelTop(def) {
  if (tops.has(def)) return tops.get(def);
  let top = 0;
  for (const p of def.parts) {
    if (!p.geometry.boundingBox) p.geometry.computeBoundingBox();
    top = Math.max(top, p.geometry.boundingBox.max.y + pivotY(def, p.node));
  }
  tops.set(def, top);
  return top;
}

function pivotY(def, node) {
  let y = 0;
  for (let n = def.nodes[node]; n?.parent; n = def.nodes[n.parent]) y += n.pivot[1];
  return y;
}

const normal = { x: 0, y: 1, z: 0 };

export class Wrecks {
  /** hf: the Heightfield. cap: wrecks kept at once; past it the oldest sink early. */
  constructor(scene, hf, { cap = 24, castShadow = true } = {}) {
    Object.assign(this, { scene, hf, cap, castShadow });
    this.models = new Map();
    this.list = [];
  }

  model(id) {
    let m = this.models.get(id);
    if (!m) { m = new InstancedModel(wreckDef(id), this.scene, { castShadow: this.castShadow }); this.models.set(id, m); }
    return m;
  }

  /**
   * A wreck of model `modelId` at (x, z) facing `heading`, its turret at world angle `turret`. alt > 0:
   * it falls first, drifting at (vx, vz). size scales its fire; life is seconds until it has sunk; burn
   * is how long it stays alight.
   */
  add({ modelId, x, z, heading = 0, turret = heading, alt = 0, vx = 0, vz = 0, size = 1, life = 30, burn = 10 }) {
    const model = this.model(modelId), h = model.add();
    h.params.turret = -(turret - heading) + (Math.random() - 0.5) * 1.2;   // blown round on its ring
    h.params.barrel = -0.03;
    h.params.claws = 0.9;
    h.params.clawsB = -0.9;
    const w = {
      model, h, x, z, heading, size, life, burn, age: 0, clock: 0,
      tilt: [(Math.random() - 0.5) * 0.22, (Math.random() - 0.5) * 0.22],
      sink: 0.025 + 0.02 * size, depth: (model.def.height || 0.4) + 0.08,
      fall: alt > 0.12 ? { y: this.hf.heightAt(x, z) + alt, vy: 0, vx, vz, spin: (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 2), pitch: 0 } : null,
    };
    this.list.push(w);
    let standing = 0;
    for (const o of this.list) if (o.age < o.life - SINK_S) standing++;
    for (const o of this.list) {   // too many: the oldest start sinking now
      if (standing <= this.cap) break;
      if (o.age < o.life - SINK_S) { o.age = o.life - SINK_S; standing--; }
    }
    this.pose(w);
    return w;
  }

  get count() { return this.list.length; }

  pose(w) {
    const hf = this.hf;
    let y, n;
    if (w.fall) {
      y = w.fall.y;
      const p = w.fall.pitch;
      normal.x = Math.cos(w.heading) * p; normal.y = 1; normal.z = Math.sin(w.heading) * p;
      n = normal;
    } else {
      n = hf.normalAt(w.x, w.z, normal);
      n.x += w.tilt[0]; n.z += w.tilt[1];
      const sinking = Math.max(0, w.age - (w.life - SINK_S)) / SINK_S;
      y = hf.heightAt(w.x, w.z) - w.sink - sinking * sinking * w.depth;
    }
    const len = Math.hypot(n.x, n.y, n.z);
    n.x /= len; n.y /= len; n.z /= len;
    poseMatrix(w.h.matrix, w.x, y, w.z, w.heading, n);
  }

  /**
   * fx: the Effects pools. near(x, z): whether fire and smoke there are worth drawing (in sight and
   * near the camera). onCrash(w): a falling wreck has hit the ground. density: the quality preset's share.
   */
  update(dt, fx, near = () => true, onCrash = null, density = 1) {
    for (let i = 0; i < this.list.length; i++) {
      const w = this.list[i];
      if (w.fall) {
        const f = w.fall;
        f.vy -= FALL_G * dt;
        f.y += f.vy * dt;
        w.x += f.vx * dt; w.z += f.vz * dt;
        w.heading += f.spin * dt;
        f.pitch = Math.min(0.9, f.pitch + dt * 0.8);
        if (fx && near(w.x, w.z) && Math.random() < dt * 45) { blackSmoke(fx, w.x, f.y, w.z, 0.7 * w.size); fire(fx, w.x, f.y, w.z, 0.9 * w.size); }
        if (f.y <= this.hf.heightAt(w.x, w.z)) { w.fall = null; w.age = 0; onCrash?.(w); }
      } else {
        w.age += dt;
        if (w.age >= w.life) { w.model.remove(w.h); this.list.splice(i--, 1); continue; }
        w.clock -= dt;
        if (fx && w.clock <= 0) {
          w.clock = 0.07 / density;
          if (w.age < w.life - SINK_S && near(w.x, w.z)) this.smoulder(fx, w);
        }
      }
      this.pose(w);
    }
    for (const m of this.models.values()) m.update();
  }

  /** Flames over the hull while it burns, thick smoke thinning to grey wisps as it dies down. */
  smoulder(fx, w) {
    const r = 0.18 * w.size, gy = this.hf.heightAt(w.x, w.z) + 0.16 * w.size;
    const x = w.x + (Math.random() - 0.5) * r * 2, z = w.z + (Math.random() - 0.5) * r * 2;
    if (w.age < w.burn) {
      const flare = 1 - 0.5 * (w.age / w.burn);   // dying down
      fire(fx, x, gy, z, w.size * flare);
      if (Math.random() < 0.85) blackSmoke(fx, x, gy + 0.2, z, 0.95 * w.size);
    } else {
      const left = 1 - (w.age - w.burn) / Math.max(1, w.life - SINK_S - w.burn);
      if (Math.random() < 0.3 * left) greySmoke(fx, x, gy, z, 0.9 * w.size);
      if (Math.random() < 0.04 * left) fire(fx, x, gy - 0.05, z, 0.45 * w.size);   // embers flaring up
    }
  }

  /** Frees the instanced meshes; the charred model geometry stays for the next battle. */
  dispose() {
    for (const m of this.models.values()) m.dispose();
    this.models.clear();
    this.list = [];
  }
}
