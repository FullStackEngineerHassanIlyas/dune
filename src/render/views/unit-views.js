// One instanced-model handle per sim unit (three for squads), posed every frame from interpolated
// sim state: position, heading, terrain tilt for vehicles, turret yaw, recoil, wheels, treads, legs;
// vehicles in a repair bay or a refinery's slot stand on its pad. Infantry that die fall where they
// stood (Dune II's death frames), or lie flattened when crushed, then sink away after a few seconds;
// so do the men a squad loses when it drops to one figure.
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
const SLOT_LIFT = 0.106;  // a harvester in a refinery's slot stands on the raised docking pad (foundation and deck)
const WALL_TOP = 0.36;    // a Saboteur crossing a wall walks on top of it
const FALL_S = 0.42, LIE_S = 3.2, GONE_S = 1.4, MAX_FALLEN = 48;
const tipped = new THREE.Matrix4(), squash = new THREE.Matrix4().makeScale(1.35, 0.14, 1.35);
const tint = (u) => HOUSES[u.type.colour ?? u.house]?.color ?? 0xffffff;   // Fremen keep their sand colour

/** Height over the ground of a harvester in a refinery's slot at (x, z): up the pad's edge on the way in, down it on the way out. */
function slotLift(world, u, x, z) {
  const slot = world?.structures.get(u.docked)?.slot;
  if (!slot) return SLOT_LIFT;
  const span = Math.hypot(slot.outX - slot.padX, slot.outY - slot.padY);
  return span > 0 ? SLOT_LIFT * Math.max(0, 1 - Math.hypot(x - slot.padX, z - slot.padY) / span) : SLOT_LIFT;
}

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
    this.fallen = [];   // dead infantry figures: { model, h, x, y, z, heading, dir, delay, age, crushed }
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
    this.poseFallen(dt);
    for (const m of this.models.values()) m.update();
  }

  create(u) {
    const model = this.model(unitModelId(u.typeId));
    const color = new THREE.Color(tint(u));
    const handles = [];
    for (let k = 0; k < (u.type.figures ?? 1); k++) { const h = model.add(); h.color.copy(color); handles.push(h); }
    this.views.set(u.id, { model, handles, color, house: u.house, x: u.x, z: u.y, recoil: 0, visible: true, foot: onFoot(u.move) });
  }

  destroy(id, v) {
    for (let k = 0; k < v.handles.length; k++) {
      const h = v.handles[k];
      if (v.foot && v.death && v.death !== 'detonated' && h.visible) this.fall(v.model, h, v.heading, k, v.death === 'crushed');
      else v.model.remove(h);
    }
    this.views.delete(id);
  }

  /**
   * A unit died (its 'unitDestroyed' event, before the view goes): infantry figures will fall instead
   * of vanishing. Returns the view's last drawn state, for the wreck and the blast, or null.
   */
  notifyDeath(e) {
    const v = this.views.get(e.id);
    if (!v) return null;
    v.death = e.cause ?? 'destroyed';
    return { x: v.x, z: v.z, heading: v.heading ?? 0, turret: v.turret ?? 0, alt: v.alt ?? 0, visible: v.visible, inside: !!v.inside };
  }

  /** Hands figure `h` (already posed) to the fallen: it tips over (or lies squashed) and later sinks away. */
  fall(model, h, heading, k, crushed) {
    const e = h.matrix.elements;
    this.fallen.push({ model, h, x: e[12], y: e[13], z: e[14], heading: heading ?? 0, dir: Math.random() < 0.75 ? 1 : -1, delay: k * 0.1 + Math.random() * 0.08, age: 0, crushed });
    h.params.legL = 0.35;
    h.params.legR = -0.15;
    if (this.fallen.length > MAX_FALLEN) { const old = this.fallen.shift(); old.model.remove(old.h); }
  }

  poseFallen(dt) {
    for (let i = 0; i < this.fallen.length; i++) {
      const f = this.fallen[i];
      const t = (f.age += dt) - f.delay;
      if (t >= FALL_S + LIE_S + GONE_S) { f.model.remove(f.h); this.fallen.splice(i--, 1); continue; }
      const sink = Math.max(0, t - FALL_S - LIE_S) / GONE_S;
      poseMatrix(f.h.matrix, f.x, f.y - sink * (f.crushed ? 0.04 : 0.12), f.z, f.heading, UP);
      if (f.crushed) { f.h.matrix.multiply(squash); continue; }
      const a = Math.min(1, Math.max(0, t) / FALL_S);
      f.h.matrix.multiply(tipped.makeRotationZ(a * a * (Math.PI / 2 - 0.1) * f.dir));   // about the side axis, from the feet
    }
  }

  renderPos(u) {
    const v = this.views.get(u.id);
    return v ? { x: v.x, z: v.z } : { x: u.x, z: u.y };
  }

  /** Frees the instanced meshes; the shared model geometry and materials stay for the next battle. */
  dispose() {
    for (const m of this.models.values()) m.dispose();
    this.models.clear();
    this.views.clear();
    this.fallen = [];
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
    v.heading = heading;
    v.turret = turret;
    v.alt = u.alt ?? 0;
    v.inside = !!u.inside;
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
    if (shown < v.shown && v.visible && !u.inside) {   // a squad down to one man: the others fall where they stood
      for (let k = shown; k < v.shown; k++) {
        const h = v.model.add();
        h.color.copy(v.color);
        h.matrix.copy(v.handles[k].matrix);
        this.fall(v.model, h, heading, k - shown, false);
      }
    }
    v.shown = shown;
    const cos = Math.cos(heading), sin = Math.sin(heading);
    let lift = u.alt ?? (u.docked ? slotLift(world, u, x, z) : u.inside ? PAD_LIFT : 0);   // flying, hanging under a Carryall, in a refinery's slot or on a repair pad
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
