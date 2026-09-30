// Shots with a body (spec §5.4): the Death Hand rides its ballistic arc as a missile model, nose along its
// path. arcHeight is the one arc the trails and the model share.
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

export class MissileViews {
  constructor(scene) {
    this.scene = scene;
    this.model = null;
    this.handles = new Map();
  }

  sync(world, alpha, heightAt, seen = () => true) {
    for (const p of world.projectiles.values()) {
      if (p.projectile !== 'deathHand') continue;
      let h = this.handles.get(p.id);
      if (!h) {
        this.model ??= new InstancedModel(modelDef('deathHandMissile'), this.scene);
        h = this.model.add();
        h.color.set(HOUSES[p.house]?.color ?? 0xffffff);
        this.handles.set(p.id, h);
      }
      const x = p.px + (p.x - p.px) * alpha, z = p.py + (p.y - p.py) * alpha;
      const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1, t = Math.min(1, Math.hypot(x - p.sx, z - p.sy) / total);
      const rise = (arcHeight('deathHand', Math.min(1, t + 0.01), total) - arcHeight('deathHand', Math.max(0, t - 0.01), total)) / (0.02 * total);
      const pitch = Math.atan(rise), heading = Math.atan2(p.ty - p.sy, p.tx - p.sx);
      poseMatrix(h.matrix, x, heightAt(x, z) + 0.5 + arcHeight('deathHand', t, total), z, heading,
        { x: -Math.cos(heading) * Math.sin(pitch), y: Math.cos(pitch), z: -Math.sin(heading) * Math.sin(pitch) });   // nose up the climb, down the fall
      h.visible = seen(x, z);
    }
    for (const [id, h] of this.handles) if (!world.projectiles.has(id)) { this.model.remove(h); this.handles.delete(id); }
    this.model?.update();
  }

  /** Frees the missile meshes (the model's shared geometry and materials stay). */
  dispose() {
    this.model?.dispose();
    this.model = null;
    this.handles.clear();
  }
}
