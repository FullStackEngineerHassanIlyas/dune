// Sandworms on screen (spec §4.8; docs/research/raw/visual-units.md §2.22, units.md "Sandworm"). Under the
// sand a worm is a travelling ridge: a swell of churned sand over its head and a trail of smaller swells
// behind that sink back as it passes, a bow wave of sand peeling off its flanks and a faint furrow left
// behind; lying still it is one low mound (the Genesis sprite's first frame). Up, its head
// (models/units/sandworm.js) rises out of a burst of sand, lunges as it swallows, and sinks back in another;
// a worm that dies goes down for good. Only what the viewer can see is drawn (the battle stage's `seen`).
// One instanced mesh draws every swell and one instanced model every head; nothing is allocated per frame.
import * as THREE from 'three';
import { InstancedModel } from './models/instancer.js';
import { modelDef } from './models/index.js';
import { poseMatrix } from './views/pose.js';
import { lerpAngle } from '../sim/geometry.js';
import { collarBurst, wake, gulp, wormDeath } from './sand-fx.js';

const TRAIL = 14;          // swells behind the head
const STEP = 0.14;         // tiles between two of them
const SINK_S = 1.4;        // seconds a swell takes to settle once the worm has passed
const DEPTH = 1.05;        // how far under the sand the head lies
const LUNGE_S = 0.35, DIE_S = 1.1;
const RIDGE = { len: 0.85, wide: 0.72, high: 0.21 };   // the swell over the head, in tiles
const UP = { x: 0, y: 1, z: 0 };
const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), m = new THREE.Matrix4(), Y = new THREE.Vector3(0, 1, 0);
const lean = { x: 0, y: 1, z: 0 };

/**
 * A lump of churned sand, unit size, standing on y = 0: a dome pushed out of round into lobes and clods, its
 * crest pale where the sand is freshly turned, its flanks and the grooves between the clods darker.
 */
function swellGeometry() {
  const g = new THREE.SphereGeometry(1, 22, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = g.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x);
    const lobe = 0.09 * Math.sin(5 * a + 1.3) + 0.06 * Math.sin(9 * a + 0.4) + 0.04 * Math.sin(14 * a + 2.1);
    const clod = 0.12 * Math.sin(x * 9.1 + z * 6.3) * Math.sin(z * 8.7 - x * 4.1) * y;
    const k = 1 + lobe * (1 - 0.5 * y);
    pos.setXYZ(i, x * k, y * (1 + clod + 0.4 * lobe), z * k);
    const groove = Math.max(0, -Math.sin(5 * a + 1.3)) * (1 - y) * 0.12, grain = Math.sin(x * 37 + z * 23) * 0.025;
    const t = 0.78 + 0.24 * y - groove + grain;
    c.setRGB(0.88 * t, 0.7 * t, 0.45 * t, THREE.SRGBColorSpace);   // the terrain's sand, authored in sRGB (terrain-shader.js)
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

let swell = null;   // geometry and material shared by every battle

export class WormViews {
  /** hooks: effects (render/effects.js), decals (the terrain's), near(x, z) (close to the camera), onShake(amount), onRumble(x, z). */
  constructor(scene, hf, { effects = null, decals = null, near = () => true, onShake = () => {}, onRumble = () => {} } = {}) {
    Object.assign(this, { scene, hf, effects, decals, near, onShake, onRumble });
    swell ??= { geometry: swellGeometry(), material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }) };
    this.capacity = 48;
    this.ridge = this.makeRidge(this.capacity);
    this.heads = new InstancedModel(modelDef('sandworm'), scene, { capacity: 2 });
    this.views = new Map();
    this.clock = 0;
  }

  makeRidge(capacity) {
    const mesh = new THREE.InstancedMesh(swell.geometry, swell.material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  create(u) {
    const trail = new Float32Array(TRAIL * 3).fill(-1e9);
    this.views.set(u.id, { id: u.id, head: this.heads.add(), x: u.x, z: u.y, heading: u.heading, rise: 0, fade: 1, visible: false, moving: false,
      trail, at: 0, tx: u.x, tz: u.y, wakeClock: 0, furrowX: u.x, furrowZ: u.y, rumbleAt: 0, lunge: -1, dying: -1, risen: 0 });
  }

  remove(id, v) {
    this.heads.remove(v.head);
    this.views.delete(id);
  }

  /** Where a worm is drawn (its interpolated place), for picking and sounds. */
  renderPos(u) {
    const v = this.views.get(u.id);
    return v ? { x: v.x, z: v.z } : { x: u.x, z: u.y };
  }

  /** The head bursting out of the sand ('wormSurfaced'): sand thrown up all round and a scar of churned sand. */
  surfaced(e, live) {
    this.decals?.crater?.(e.x, e.y, 0.75, 0.3);
    if (!live || !this.effects) return;
    collarBurst(this.effects, e.x, this.hf.heightAt(e.x, e.y), e.y, 1);
    if (this.near(e.x, e.y)) this.onShake(0.15);
  }

  /** A swallow ('wormAte'): the head lunges and the sand pours in over its prey. */
  ate(e, live) {
    const v = this.views.get(e.id);
    if (v) v.lunge = 0;
    if (live && this.effects) gulp(this.effects, e.x, this.hf.heightAt(e.x, e.y), e.y);
  }

  /** A worm killed ('unitDestroyed'): it goes down in a great burst of sand. */
  died(e, live) {
    const v = this.views.get(e.id);
    if (!v) return;
    v.dying = 0;
    v.fade = 0;   // no ridge: it is going down for good
    if (live && v.visible && this.effects) { wormDeath(this.effects, v.x, this.hf.heightAt(v.x, v.z), v.z); this.onShake(0.3); }
  }

  /** seen(x, z): whether the viewer can see there; live: effects and sounds (false while the battle is simulated ahead). */
  sync(world, alpha, dt, seen, live = true) {
    this.clock += dt;
    for (const u of world.units.values()) if (u.move === 'worm' && !this.views.has(u.id)) this.create(u);
    let n = 0;
    for (const [id, v] of this.views) {
      const u = world.units.get(id);
      if (!u && v.dying < 0) { this.remove(id, v); continue; }
      if (u) this.follow(v, u, alpha, dt, seen, live);
      else if ((v.dying += dt) >= DIE_S) { this.remove(id, v); continue; }
      else v.rise = Math.min(v.rise, 1 - v.dying / DIE_S);
      this.poseHead(v, dt);
      if (v.visible) n = this.drawRidge(v, n);
    }
    this.ridge.count = n;
    this.ridge.instanceMatrix.needsUpdate = true;
    this.heads.update();
  }

  follow(v, u, alpha, dt, seen, live) {
    const x = u.px + (u.x - u.px) * alpha, z = u.py + (u.y - u.py) * alpha;
    const moved = Math.hypot(x - v.x, z - v.z);
    v.x = x;
    v.z = z;
    v.heading = lerpAngle(u.pheading, u.heading, alpha);
    const rise = (u.prise ?? 0) + ((u.rise ?? 0) - (u.prise ?? 0)) * alpha;
    if (live && v.visible && this.effects && v.rise > 0.3 && rise <= 0.3 && rise < v.rise) collarBurst(this.effects, x, this.hf.heightAt(x, z), z, 0.7);   // sinking back
    v.rise = rise;
    v.fade = u.fade ?? 1;
    v.visible = seen(x, z);
    v.moving = dt > 0 && moved / dt > 0.3;
    if (rise < 0.05 && Math.hypot(x - v.tx, z - v.tz) >= STEP) {   // lay a new swell
      v.at = (v.at + 1) % TRAIL;
      v.trail[v.at * 3] = v.tx = x;
      v.trail[v.at * 3 + 1] = v.tz = z;
      v.trail[v.at * 3 + 2] = this.clock;
    }
    if (!live || !v.visible || rise > 0.05 || !v.moving || !this.near(x, z)) return;
    const y = this.hf.heightAt(x, z);
    if ((v.wakeClock -= dt) <= 0) {
      v.wakeClock = 0.07;
      if (this.effects) wake(this.effects, x, y, z, v.heading, Math.random() < 0.35);
    }
    if (Math.hypot(x - v.furrowX, z - v.furrowZ) > 0.3) {   // the furrow it leaves in the sand
      this.decals?.blob?.(x, z, 0.4 * v.fade, 'rgba(104,78,50,0.16)', 'rgba(136,106,70,0.07)');
      v.furrowX = x;
      v.furrowZ = z;
    }
    if (this.clock >= v.rumbleAt) { v.rumbleAt = this.clock + 1.4; this.onRumble(x, z); }
  }

  poseHead(v, dt) {
    const h = v.head, r = v.rise;
    let lift = 0, tilt = 0;
    if (v.lunge >= 0) {
      const t = (v.lunge += dt) / LUNGE_S;
      if (t >= 1) v.lunge = -1;
      else { lift = 0.2 * Math.sin(Math.PI * t); tilt = 0.45 * Math.sin(Math.PI * t); }
    }
    h.visible = v.visible && r > 0.02;
    if (!h.visible) return;
    const e = 1 - (1 - r) * (1 - r), c = Math.cos(v.heading), sn = Math.sin(v.heading);
    const len = Math.hypot(c * tilt, 1, sn * tilt);
    lean.x = (c * tilt) / len; lean.y = 1 / len; lean.z = (sn * tilt) / len;
    poseMatrix(h.matrix, v.x, this.hf.heightAt(v.x, v.z) - (1 - e) * DEPTH + lift, v.z, v.heading, tilt ? lean : UP);
  }

  /** The swell over the head and the trail settling behind it; returns the next free instance. */
  drawRidge(v, n) {
    const under = (1 - Math.min(1, v.rise * 1.6)) * v.fade;
    if (under <= 0.01) return n;
    n = this.swell(n, v.x, v.z, v.heading, RIDGE.len, RIDGE.wide, RIDGE.high * under);
    let nx = v.x, nz = v.z;
    for (let k = 0; k < TRAIL; k++) {
      const i = ((v.at - k + TRAIL) % TRAIL) * 3, age = this.clock - v.trail[i + 2], f = 1 - age / SINK_S;
      if (f <= 0) break;
      const x = v.trail[i], z = v.trail[i + 1], along = 1 - k / TRAIL;
      const twist = Math.sin((v.at - k) * 2.3) * 0.5;   // each swell turned its own way, so the clods never line up
      n = this.swell(n, x, z, Math.atan2(nz - z, nx - x) + twist, 0.5, RIDGE.wide * (0.55 + 0.45 * f), RIDGE.high * 0.6 * f * along * v.fade);
      nx = x;
      nz = z;
    }
    return n;
  }

  swell(n, x, z, heading, len, wide, high) {
    if (n >= this.capacity) this.grow();
    p.set(x, this.hf.heightAt(x, z) - 0.03, z);
    q.setFromAxisAngle(Y, -heading);
    s.set(len / 2, high + 0.03, wide / 2);
    this.ridge.setMatrixAt(n, m.compose(p, q, s));
    return n + 1;
  }

  grow() {
    const old = this.ridge;
    this.capacity *= 2;
    this.ridge = this.makeRidge(this.capacity);
    this.ridge.instanceMatrix.array.set(old.instanceMatrix.array);
    old.removeFromParent();
    old.dispose();
  }

  /** Frees the instanced meshes; the shared geometry and material stay for the next battle. */
  dispose() {
    this.ridge.removeFromParent();
    this.ridge.dispose();
    this.heads.dispose();
    this.views.clear();
  }
}
