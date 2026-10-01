// One view per structure (spec §5.3): standing on its flattened footprint, rising out of the ground
// when placed, sinking away when sold, hidden until the viewer has seen it, with its animated parts
// (turbines, radar dishes, pad lights, factory doors, flags, cranes, turret heads, the repair hoist,
// a working refinery's rotors, rams and spice chute). A destroyed one collapses (spec §5.3 "destroyed
// structures collapse into burning rubble"): it shudders, then slumps, leans and spreads as it sinks
// over 1.9 s while the blasts go off round it.
// Walls get a post plus an arm towards each walled neighbour.
import * as THREE from 'three';
import { HOUSES } from '../../data/houses.js';
import { structureVisibleTo } from '../../sim/fog.js';
import { InstancedModel } from '../models/instancer.js';
import { modelDef, structureModelId } from '../models/index.js';

const ARMS = [[1, 0, 0], [0, 1, -Math.PI / 2], [-1, 0, Math.PI], [0, -1, Math.PI / 2]];   // E, S, W, N and their yaw
const RISE_MS = 900, SINK_MS = 700, COLLAPSE_MS = 1900, DOOR_MS = 2000;
const lean = new THREE.Quaternion(), axis = new THREE.Vector3(), at = new THREE.Vector3(), size = new THREE.Vector3(), turn = new THREE.Matrix4();
const armOffset = (now) => Math.sin(now * 0.0015) * 0.3;   // the repair hoist runs up and down the gantry
const ROTOR_SPEED = 7, ROTOR_SPIN_UP = 1.2;   // a working refinery's centrifuges: radians per second, and how fast they get there

/** A refinery at work (research: structures.md, its busy animation): pad lights, rotors, rams, spice in the chute. */
function refineryParams(s, v, p, now, dt) {
  const state = s.slot?.state, working = state === 'unloading';
  if (s.incoming || state === 'entering') p.padLights = 1.3 - 0.5 * ((now * 0.0015) % 1);   // chevrons converge on the pad: a Harvester is due
  else p.padLights = working ? 1 + 0.25 * Math.sin(now * 0.012) : 1;
  v.rotor = (v.rotor ?? 0) + ((working ? ROTOR_SPEED : 0) - (v.rotor ?? 0)) * Math.min(1, dt * ROTOR_SPIN_UP);
  v.spin = ((v.spin ?? 0) + v.rotor * dt) % (Math.PI * 2);
  p.spin = v.spin;
  p.ram = working ? 0.035 * Math.max(0, Math.sin(now * 0.007)) : 0;
  p.flow = working ? 0.9 + 0.12 * Math.sin(now * 0.018) : 0.001;
}

export class StructureViews {
  constructor(scene, hf, { viewer = null } = {}) {
    this.scene = scene;
    this.hf = hf;
    this.viewer = viewer;
    this.models = new Map();
    this.views = new Map();
  }

  model(id) {
    let m = this.models.get(id);
    if (!m) { m = new InstancedModel(modelDef(id), this.scene); this.models.set(id, m); }
    return m;
  }

  notify(e, now) {
    if (e.type === 'unitBuilt') { const v = this.views.get(e.structureId); if (v) v.doorUntil = now + DOOR_MS; }
    if (e.type === 'structureDestroyed') {
      const v = this.views.get(e.id);
      if (v && v.dying === undefined) { const a = Math.random() * Math.PI * 2; v.dying = now; v.collapse = { ax: Math.cos(a), az: Math.sin(a), tilt: 0.1 + Math.random() * 0.12 }; }
    }
  }

  sync(world, now) {
    for (const s of world.structures.values()) if (!this.views.has(s.id)) this.create(s, now);
    for (const [id, v] of this.views) {
      if (world.structures.has(id)) continue;
      v.dying ??= now;
      if (now - v.dying >= (v.collapse ? COLLAPSE_MS : SINK_MS)) { for (const h of v.handles) v.model(h).remove(h); this.views.delete(id); }
    }
    for (const [id, v] of this.views) this.pose(world, world.structures.get(id) ?? v.last, v, now);
    for (const m of this.models.values()) m.update();
  }

  /** Frees the instanced meshes; the shared model geometry and materials stay for the next battle. */
  dispose() {
    for (const m of this.models.values()) m.dispose();
    this.models.clear();
    this.views.clear();
  }

  create(s, now) {
    const color = HOUSES[s.house]?.color ?? 0xffffff;
    const handles = [];
    const owners = new Map();
    const add = (modelId) => { const m = this.model(modelId); const h = m.add(); h.color.set(color); owners.set(h, m); handles.push(h); return h; };
    add(structureModelId(s.typeId, s.w, s.h));
    if (s.type.isWall) for (let k = 0; k < 4; k++) add('wallArm');
    let sum = 0, n = 0;
    for (let dy = 0; dy <= s.h; dy++) for (let dx = 0; dx <= s.w; dx++) { sum += this.hf.heightAt(s.x + dx, s.y + dy); n++; }
    this.views.set(s.id, { handles, model: (h) => owners.get(h), born: now, cx: s.x + s.w / 2, cz: s.y + s.h / 2, y: sum / n, house: s.house, doorUntil: 0, last: s });
  }

  pose(world, s, v, now) {
    v.last = s;
    const dt = Math.min(0.1, Math.max(0, (now - (v.now ?? now)) / 1000));
    v.now = now;
    const visible = !this.viewer || structureVisibleTo(world, this.viewer, s);
    let scale = 1 - Math.pow(1 - Math.min(1, (now - v.born) / RISE_MS), 3);
    if (v.dying !== undefined && !v.collapse) scale = Math.max(0.02, 1 - (now - v.dying) / SINK_MS);
    if (v.house !== s.house) { v.house = s.house; for (const h of v.handles) h.color.set(HOUSES[s.house]?.color ?? 0xffffff); }
    const [main, ...arms] = v.handles;
    main.visible = visible;
    if (v.collapse) this.collapse(main.matrix, v, now);
    else main.matrix.makeScale(1, Math.max(0.02, scale), 1).setPosition(v.cx, v.y, v.cz);
    const p = main.params;
    p.crane = now * 0.00025;
    p.fan = now * 0.004;
    p.dish = now * 0.0012;
    p.flag = Math.sin(now * 0.002) * 0.3;
    const due = s.typeId === 'starport' && world.houses.get(s.house)?.starport?.batch?.structureId === s.id;   // a Frigate is on its way
    p.padLights = s.occupant || due ? 1 + 0.25 * Math.sin(now * 0.012) : 1;
    if (s.typeId === 'refinery') refineryParams(s, v, p, now, dt);
    p.arm = s.bay?.state === 'repairing' && !s.bay.stalled ? armOffset(now) : 0;
    p.door = now < v.doorUntil ? 0.4 : 0;
    p.turret = s.turret === undefined ? Math.PI / 2 : -s.turret;
    if (!arms.length) return;
    const map = world.map;
    arms.forEach((h, k) => {
      const [dx, dy, yaw] = ARMS[k];
      const nx = s.x + dx, ny = s.y + dy;
      const other = map.inBounds(nx, ny) ? world.structures.get(map.structure[map.idx(nx, ny)]) : null;
      h.visible = visible && !!other?.type.isWall;
      if (v.collapse) h.matrix.multiplyMatrices(main.matrix, turn.makeRotationY(yaw));
      else h.matrix.makeRotationY(yaw).scale({ x: 1, y: Math.max(0.02, scale), z: 1 }).setPosition(v.cx, v.y, v.cz);
    });
  }

  /** The collapse pose at `now`: a shudder, then an accelerating slump that leans, spreads and sinks. */
  collapse(out, v, now) {
    const t = Math.min(1, (now - v.dying) / COLLAPSE_MS), c = v.collapse;
    const shake = t < 0.35 ? 0.035 * (1 - t / 0.35) : 0;
    const fall = Math.max(0, (t - 0.22) / 0.78), e = fall * fall;
    lean.setFromAxisAngle(axis.set(c.az, 0, -c.ax), c.tilt * e);
    at.set(v.cx + Math.sin(now * 0.083) * shake, v.y - 0.1 * e, v.cz + Math.cos(now * 0.071) * shake);
    out.compose(at, lean, size.set(1 + 0.08 * e, Math.max(0.03, 1 - 0.95 * e), 1 + 0.08 * e));
  }

  /** Whether structure `id` was drawn for the viewer last frame (seen once, it is drawn whole, shroud or not). */
  shows(id) { return !!this.views.get(id)?.handles[0]?.visible; }

  /** Where the welding head is over an occupied repair pad, in world units; null when nothing is being repaired. */
  weldPoint(id, now) {
    const v = this.views.get(id), s = v?.last;
    if (s?.bay?.state !== 'repairing' || s.bay.stalled) return null;
    return { x: v.cx, y: v.y + 0.37, z: v.cz + 0.1 + armOffset(now) };
  }
}
