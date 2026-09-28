// One view per structure (spec §5.3): standing on its flattened footprint, rising out of the ground
// when placed, sinking away when sold or destroyed, hidden until the viewer has seen it, with its
// animated parts (turbines, radar dishes, pad lights, factory doors, flags, cranes, turret heads).
// Walls get a post plus an arm towards each walled neighbour.
import { HOUSES } from '../../data/houses.js';
import { structureVisibleTo } from '../../sim/fog.js';
import { InstancedModel } from '../models/instancer.js';
import { modelDef, structureModelId } from '../models/index.js';

const ARMS = [[1, 0, 0], [0, 1, -Math.PI / 2], [-1, 0, Math.PI], [0, -1, Math.PI / 2]];   // E, S, W, N and their yaw
const RISE_MS = 900, SINK_MS = 700, DOOR_MS = 2000;

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
  }

  sync(world, now) {
    for (const s of world.structures.values()) if (!this.views.has(s.id)) this.create(s, now);
    for (const [id, v] of this.views) {
      if (world.structures.has(id)) continue;
      v.dying ??= now;
      if (now - v.dying >= SINK_MS) { for (const h of v.handles) v.model(h).remove(h); this.views.delete(id); }
    }
    for (const [id, v] of this.views) this.pose(world, world.structures.get(id) ?? v.last, v, now);
    for (const m of this.models.values()) m.update();
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
    const visible = !this.viewer || structureVisibleTo(world, this.viewer, s);
    let scale = 1 - Math.pow(1 - Math.min(1, (now - v.born) / RISE_MS), 3);
    if (v.dying !== undefined) scale = Math.max(0.02, 1 - (now - v.dying) / SINK_MS);
    if (v.house !== s.house) { v.house = s.house; for (const h of v.handles) h.color.set(HOUSES[s.house]?.color ?? 0xffffff); }
    const [main, ...arms] = v.handles;
    main.visible = visible;
    main.matrix.makeScale(1, Math.max(0.02, scale), 1).setPosition(v.cx, v.y, v.cz);
    const p = main.params;
    p.crane = now * 0.00025;
    p.fan = now * 0.004;
    p.dish = now * 0.0012;
    p.flag = Math.sin(now * 0.002) * 0.3;
    p.padLights = s.dockedBy ? 1 + 0.25 * Math.sin(now * 0.012) : 1;
    p.door = now < v.doorUntil ? 0.4 : 0;
    p.turret = s.turret === undefined ? Math.PI / 2 : -s.turret;
    if (!arms.length) return;
    const map = world.map;
    arms.forEach((h, k) => {
      const [dx, dy, yaw] = ARMS[k];
      const nx = s.x + dx, ny = s.y + dy;
      const other = map.inBounds(nx, ny) ? world.structures.get(map.structure[map.idx(nx, ny)]) : null;
      h.visible = visible && !!other?.type.isWall;
      h.matrix.makeRotationY(yaw).scale({ x: 1, y: Math.max(0.02, scale), z: 1 }).setPosition(v.cx, v.y, v.cz);
    });
  }
}
