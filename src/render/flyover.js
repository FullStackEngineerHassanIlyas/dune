// The end of a won mission (research §5, from the Sega release): seven Carryalls in the winner's colour fly
// over the battlefield in a V before the result. Visual only — no simulation units — and about four seconds:
// the V comes in past the bottom of the view, crosses the point the camera looks at and climbs away beyond the
// top. One instanced Carryall model (render/models), posed every frame with no allocation.
import { HOUSES } from '../data/houses.js';
import { InstancedModel } from './models/instancer.js';
import { modelDef } from './models/index.js';
import { poseMatrix } from './views/pose.js';

export const FLYOVER = { count: 7, seconds: 4.2, height: 3.4, spacing: 2, climb: 1.2 };

/** The V: the leader, then pairs further back on either side ({ back, side } in tiles). */
export function vFormation(n = FLYOVER.count, spacing = FLYOVER.spacing) {
  const out = [{ back: 0, side: 0 }];
  for (let k = 1; out.length < n; k++) {
    out.push({ back: k * spacing, side: -k * spacing });
    if (out.length < n) out.push({ back: k * spacing, side: k * spacing });
  }
  return out;
}

/**
 * The flight across the view: from `behind` tiles short of the point looked at, along `dir` (a unit vector on the
 * ground, screen-up), to `ahead` tiles past it, with the whole V out of sight at both ends. Returns
 * { x0, z0, dx, dz, speed, length } — the leader is at (x0 + dx·s, z0 + dz·s) after s = speed·t tiles.
 */
export function flightPlan(target, dir, { behind, ahead, seconds = FLYOVER.seconds, tail = 0 }) {
  const length = behind + ahead + tail;
  return { x0: target.x - dir.x * behind, z0: target.z - dir.z * behind, dx: dir.x, dz: dir.z, length, speed: length / seconds };
}

export class Flyover {
  constructor(scene, { house, heightAt = () => 0, count = FLYOVER.count, seconds = FLYOVER.seconds }) {
    this.model = new InstancedModel(modelDef('carryall'), scene, { capacity: count });
    this.formation = vFormation(count);
    this.handles = this.formation.map(() => this.model.add());
    const color = HOUSES[house]?.color ?? 0xd9a52e;
    for (const h of this.handles) { h.color.setHex(color); h.visible = false; }
    this.heightAt = heightAt;
    this.seconds = seconds;
    this.t = 0;
    this.plan = null;
    this.done = false;
    this.model.update();
  }

  /** Off they go across the camera's view (render/camera-rig.js: yaw 0 looks north, screen up). */
  start(rig) {
    const dir = { x: -Math.sin(rig.yaw), z: -Math.cos(rig.yaw) };
    const tail = this.formation[this.formation.length - 1].back;
    this.plan = flightPlan(rig.target, dir, { behind: rig.distance * 0.9 + 2, ahead: rig.distance * 1.5, seconds: this.seconds, tail });
    this.ground = this.heightAt(rig.target.x, rig.target.z);
    this.heading = Math.atan2(dir.z, dir.x);
    this.t = 0;
    this.done = false;
    for (const h of this.handles) h.visible = true;
    this.pose();
  }

  /** Advance by dt seconds (the battle's own clock: a paused game holds them in the air). True once they are gone. */
  update(dt) {
    if (!this.plan || this.done) return this.done;
    this.t = Math.min(this.seconds, this.t + dt);
    this.pose();
    if (this.t >= this.seconds) {
      this.done = true;
      for (const h of this.handles) h.visible = false;
      this.model.update();
    }
    return this.done;
  }

  pose() {
    const p = this.plan, s = p.speed * this.t, k = this.t / this.seconds;
    for (let i = 0; i < this.handles.length; i++) {
      const f = this.formation[i];
      const x = p.x0 + p.dx * (s - f.back) - p.dz * f.side, z = p.z0 + p.dz * (s - f.back) + p.dx * f.side;
      const y = Math.max(this.ground, this.heightAt(x, z)) + FLYOVER.height + FLYOVER.climb * k * k + 0.06 * Math.sin(this.t * 3 + i);
      poseMatrix(this.handles[i].matrix, x, y, z, this.heading);
    }
    this.model.update();
  }

  debug() {
    const e = this.handles[0].matrix.elements, r = (v) => Math.round(v * 10) / 10;
    return { t: r(this.t), done: this.done, count: this.handles.length, seconds: this.seconds, lead: { x: r(e[12]), y: r(e[13]), z: r(e[14]) } };
  }

  dispose() { this.model.dispose(); this.plan = null; }
}
