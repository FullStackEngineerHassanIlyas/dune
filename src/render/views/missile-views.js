// Shots with a body (spec §5.4): rockets, mini-rockets and Deviator gas rockets fly as a small rocket model
// (docs/research/raw/visual-units.md: slim orange rockets with white noses and small fins), the Death Hand
// as its missile; each rides its arc nose along its path — up the climb, down the fall — spinning about
// its axis as it goes. shotPoint and arcHeight are the one path the bodies and the trails (shot-fx.js) share.
import * as THREE from 'three';
import { HOUSES } from '../../data/houses.js';
import { InstancedModel } from '../models/instancer.js';
import { modelDef } from '../models/index.js';
import { poseMatrix } from './pose.js';

/** Height above the straight line at fraction t of a flight `total` tiles long: rockets arc a little, the Death Hand climbs high. */
export function arcHeight(kind, t, total) {
  if (kind === 'deathHand') return 4 * t * (1 - t) * Math.max(3, total * 0.4);
  if (kind === 'rocket' || kind === 'gas') return 4 * t * (1 - t) * Math.min(1.2, 0.15 + total * 0.06);
  return 0;
}

/** How high above the ground under it shot `p` leaves its gun: 0.35 (the Death Hand 0.5) plus the gun's altitude. */
export const launchLift = (p) => (p.projectile === 'deathHand' ? 0.5 : 0.35) + (p.fromAlt ?? 0);

/**
 * Where shot `p` is at `alpha` between ticks, written into `out`: its position (x, y, z), the unit vector
 * of its flight (dx, dy, dz) and its speed along that path. A shot leaves 0.35 above the ground (the Death
 * Hand 0.5) plus its gun's altitude and comes down 0.2 above its target plus the target's altitude, over its arc.
 */
export function shotPoint(p, alpha, heightAt, out) {
  const x = p.px + (p.x - p.px) * alpha, z = p.py + (p.y - p.py) * alpha;
  const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1;
  const t = Math.min(1, Math.hypot(x - p.sx, z - p.sy) / total);
  const from = launchLift(p), to = (p.projectile === 'deathHand' ? 0.5 : 0.2) + (p.toAlt ?? 0);
  out.x = x;
  out.z = z;
  out.y = heightAt(x, z) + from + (to - from) * t + arcHeight(p.projectile, t, total);
  let gx = p.x - p.px, gz = p.y - p.py;   // this tick's step, which follows a homing shot's turns
  if (gx === 0 && gz === 0) { gx = p.tx - p.sx; gz = p.ty - p.sy; }
  const g = Math.hypot(gx, gz) || 1;
  const rise = (to - from) / total + (arcHeight(p.projectile, Math.min(1, t + 0.01), total) - arcHeight(p.projectile, Math.max(0, t - 0.01), total)) / (0.02 * total);
  const n = Math.hypot(1, rise);
  out.dx = gx / g / n;
  out.dz = gz / g / n;
  out.dy = rise / n;
  out.speed = (p.speed ?? 0) * n;
  out.travelled = t * total;
  return out;
}

/** Shots that fly as a model, and how big: Troopers' and Ornithopters' mini-rockets are smaller. */
const BODIES = new Set(['rocket', 'gas', 'deathHand']);
const SCALE = { miniRocket: 0.72, trooperRocket: 0.72, turretRocket: 1.1 };
const scale = new THREE.Vector3(), roll = new THREE.Matrix4(), up = { x: 0, y: 1, z: 0 };

export class MissileViews {
  constructor(scene) {
    this.scene = scene;
    this.model = null;     // the Death Hand
    this.rockets = null;   // every other rocket
    this.handles = new Map();
    this.pt = { x: 0, y: 0, z: 0, dx: 1, dy: 0, dz: 0, speed: 0, travelled: 0 };
  }

  sync(world, alpha, heightAt, seen = () => true) {
    for (const p of world.projectiles.values()) {
      if (!BODIES.has(p.projectile)) continue;
      const dh = p.projectile === 'deathHand';
      let h = this.handles.get(p.id);
      if (!h) {
        const model = dh ? (this.model ??= new InstancedModel(modelDef('deathHandMissile'), this.scene))
          : (this.rockets ??= new InstancedModel(modelDef('rocket'), this.scene, { capacity: 16 }));
        h = model.add();
        h.model = model;
        h.size = dh ? 1 : SCALE[p.weapon] ?? 1;
        h.spin = Math.random() * Math.PI * 2;
        h.color.set(HOUSES[p.house]?.color ?? 0xffffff);
        this.handles.set(p.id, h);
      }
      const s = shotPoint(p, alpha, heightAt, this.pt);
      const heading = Math.atan2(s.dz, s.dx), pitch = Math.atan2(s.dy, Math.hypot(s.dx, s.dz));
      up.x = -Math.cos(heading) * Math.sin(pitch);
      up.y = Math.cos(pitch);
      up.z = -Math.sin(heading) * Math.sin(pitch);
      poseMatrix(h.matrix, s.x, s.y, s.z, heading, up);   // nose up the climb, down the fall
      h.matrix.multiply(roll.makeRotationX(h.spin + s.travelled * (dh ? 0.8 : 3)));
      if (h.size !== 1) h.matrix.scale(scale.setScalar(h.size));
      h.visible = seen(s.x, s.z);
    }
    for (const [id, h] of this.handles) if (!world.projectiles.has(id)) { h.model.remove(h); this.handles.delete(id); }
    this.model?.update();
    this.rockets?.update();
  }

  /** Frees the missile and rocket meshes (the models' shared geometry and materials stay). */
  dispose() {
    this.model?.dispose();
    this.rockets?.dispose();
    this.model = this.rockets = null;
    this.handles.clear();
  }
}
