// One handle per structure, standing on its footprint centre; new structures rise out of the ground
// over 0.9 s (spec §5.3). Animated parts (crane) run from wall-clock time.
import { HOUSES } from '../../data/houses.js';
import { InstancedModel } from '../models/instancer.js';
import { modelDef, structureModelId } from '../models/index.js';

export class StructureViews {
  constructor(scene, hf) {
    this.scene = scene;
    this.hf = hf;
    this.models = new Map();
    this.views = new Map();
  }

  model(id) {
    let m = this.models.get(id);
    if (!m) { m = new InstancedModel(modelDef(id), this.scene); this.models.set(id, m); }
    return m;
  }

  sync(world, now) {
    for (const s of world.structures.values()) if (!this.views.has(s.id)) this.create(s, now);
    for (const [id, v] of this.views) if (!world.structures.has(id)) { v.model.remove(v.handle); this.views.delete(id); }
    for (const s of world.structures.values()) this.pose(s, this.views.get(s.id), now);
    for (const m of this.models.values()) m.update();
  }

  create(s, now) {
    const model = this.model(structureModelId(s.typeId, s.w, s.h));
    const handle = model.add();
    handle.color.set(HOUSES[s.house]?.color ?? 0xffffff);
    let sum = 0, n = 0;
    for (let dy = 0; dy <= s.h; dy++) for (let dx = 0; dx <= s.w; dx++) { sum += this.hf.heightAt(s.x + dx, s.y + dy); n++; }
    this.views.set(s.id, { model, handle, born: now, cx: s.x + s.w / 2, cz: s.y + s.h / 2, y: sum / n, house: s.house });
  }

  pose(s, v, now) {
    const t = Math.min(1, (now - v.born) / 900);
    const rise = 1 - Math.pow(1 - t, 3);
    v.handle.matrix.makeScale(1, Math.max(0.02, rise), 1).setPosition(v.cx, v.y, v.cz);
    v.handle.params.crane = (now / 1000) * 0.25;
    if (v.house !== s.house) { v.house = s.house; v.handle.color.set(HOUSES[s.house]?.color ?? 0xffffff); }
  }
}
