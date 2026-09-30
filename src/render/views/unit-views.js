// One instanced-model handle per sim unit (three for squads), posed every frame from interpolated
// sim state: position, heading, terrain tilt for vehicles, turret yaw, recoil, wheels, treads, legs.
import * as THREE from 'three';
import { HOUSES } from '../../data/houses.js';
import { onFoot } from '../../data/units.js';
import { lerpAngle, wrapAngle, angleDiff } from '../../sim/geometry.js';
import { unitVisibleTo } from '../../sim/fog.js';
import { InstancedModel } from '../models/instancer.js';
import { modelDef, unitModelId } from '../models/index.js';
import { poseMatrix } from './pose.js';

const SQUAD = [[0.1, 0], [-0.08, 0.11], [-0.08, -0.11]];
const UP = { x: 0, y: 1, z: 0 };
const MAX_TILT = Math.tan((25 * Math.PI) / 180);
const PAD_LIFT = 0.066;   // vehicles in a repair bay stand on the pad plate
const WALL_TOP = 0.36;    // a Saboteur crossing a wall walks on top of it
const tint = (u) => HOUSES[u.type.colour ?? u.house]?.color ?? 0xffffff;   // Fremen keep their sand colour

// Vehicles follow the ground but never lean past 25° (steep ground next to cliffs looked like climbing).
function clampTilt(n) {
  const h = Math.hypot(n.x, n.z);
  if (h <= n.y * MAX_TILT) return n;
  const k = (n.y * MAX_TILT) / h;
  n.x *= k; n.z *= k;
  const len = Math.hypot(n.x, n.y, n.z);
  n.x /= len; n.y /= len; n.z /= len;
  return n;
}

export class UnitViews {
  constructor(scene, hf, { viewer = null } = {}) {
    this.scene = scene;
    this.hf = hf;
    this.viewer = viewer;
    this.models = new Map();
    this.views = new Map();
    this.normal = { x: 0, y: 1, z: 0 };
  }

  model(id) {
    let m = this.models.get(id);
    if (!m) { m = new InstancedModel(modelDef(id), this.scene); this.models.set(id, m); }
    return m;
  }

  sync(world, alpha, dt) {
    this.clock = (this.clock ?? 0) + dt;
    for (const u of world.units.values()) if (!this.views.has(u.id)) this.create(u);
    for (const [id, v] of this.views) if (!world.units.has(id)) this.destroy(id, v);
    for (const u of world.units.values()) this.pose(u, this.views.get(u.id), alpha, dt, world);
    for (const m of this.models.values()) m.update();
  }

  create(u) {
    const model = this.model(unitModelId(u.typeId));
    const color = new THREE.Color(tint(u));
    const handles = [];
    for (let k = 0; k < (u.type.figures ?? 1); k++) { const h = model.add(); h.color.copy(color); handles.push(h); }
    this.views.set(u.id, { model, handles, color, house: u.house, x: u.x, z: u.y, recoil: 0, visible: true });
  }

  destroy(id, v) {
    for (const h of v.handles) v.model.remove(h);
    this.views.delete(id);
  }

  renderPos(u) {
    const v = this.views.get(u.id);
    return v ? { x: v.x, z: v.z } : { x: u.x, z: u.y };
  }

  recoil(id) {
    const v = this.views.get(id);
    if (v) v.recoil = 0.08;
  }

  pose(u, v, alpha, dt, world = null) {
    const x = u.px + (u.x - u.px) * alpha, z = u.py + (u.y - u.py) * alpha;
    const heading = lerpAngle(u.pheading, u.heading, alpha);
    const turret = lerpAngle(u.pturret, u.turret, alpha);
    const dist = u.pdistance + (u.distance - u.pdistance) * alpha;
    v.x = x;
    v.z = z;
    v.visible = !this.viewer || !world || unitVisibleTo(world, this.viewer, u);
    v.recoil = Math.max(0, v.recoil - dt * 0.3);
    if (v.house !== u.house) {
      v.house = u.house;
      v.color.set(tint(u));
      for (const h of v.handles) h.color.copy(v.color);
    }
    const foot = onFoot(u.move), air = !u.isGround;
    const walking = u.distance !== u.pdistance;
    const shown = v.handles.length > 1 && u.hp <= u.maxHp / 2 ? 1 : v.handles.length;
    const cos = Math.cos(heading), sin = Math.sin(heading);
    let lift = u.alt ?? (u.inside ? PAD_LIFT : 0);   // flying, hanging under a Carryall, or on a repair pad
    if (u.move === 'saboteur' && world) {   // up and over walls
      const top = (i) => (world.map.wall[i] ? WALL_TOP : 0), s = u.step;
      lift = s ? top(s.from) + (top(s.to) - top(s.from)) * Math.min(1, s.progress) : top(world.map.idx(u.tx, u.ty));
    }
    const bank = air ? Math.max(-0.5, Math.min(0.5, angleDiff(u.pheading, u.heading) * 2.5)) : 0;   // lean into turns
    const banked = { x: -sin * Math.sin(bank), y: Math.cos(bank), z: cos * Math.sin(bank) };
    for (let k = 0; k < v.handles.length; k++) {
      const h = v.handles[k];
      h.visible = v.visible && k < shown;
      let fx = x, fz = z;
      if (v.handles.length > 1) { const [a, b] = SQUAD[k]; fx += cos * a - sin * b; fz += sin * a + cos * b; }
      const n = air ? banked : foot || u.alt !== undefined ? UP : clampTilt(this.hf.normalAt(fx, fz, this.normal));
      poseMatrix(h.matrix, fx, this.hf.heightAt(fx, fz) + 0.004 + lift, fz, heading, n);
      const p = h.params;
      p.turret = -wrapAngle(turret - heading);
      p.barrel = -v.recoil;
      p.wheel = -dist / (v.model.def.wheelRadius ?? 0.09);   // wheels roll without slipping
      p.tread = dist * 3.2;
      p.drum = dist * 6;
      const swing = walking ? Math.sin(dist * 26 + k * 1.7) * 0.6 : 0;
      p.legL = swing;
      p.legR = -swing;
      p.flap = Math.sin(dist * 9) * 0.55;
      p.flapR = -p.flap;
      p.claws = u.cargo ? 0 : 0.6;
      p.clawsB = -p.claws;
      p.warn = u.destructAt !== undefined ? 1.2 + 0.4 * Math.sin(this.clock * 18) : 0;   // Destruct: red lights pulse
    }
  }
}
