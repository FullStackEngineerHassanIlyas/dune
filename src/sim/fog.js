// Map visibility (spec §4.9), one layer per house, rebuilt every five ticks. 'shroud' (Dune II, the
// default): black until explored, and ground once seen stays in view, enemies on it included. 'fog'
// (C&C-style option): explored ground goes dim out of sight and hides enemy units there; then every
// armed unit and building sees at least as far as it shoots, so nothing fires from where its target's
// side cannot see. Enemy structures stay visible once seen. 'revealed' (world.fogOfWar false): all of it.
import { unitSight } from '../data/tuning.js';

export class FogLayer {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.explored = new Uint8Array(w * h);
    this.visible = new Uint8Array(w * h);
    this.revision = 0;   // bumps on every update so views know when to refresh
  }

  reveal(cx, cy, r) {
    const r2 = r * r + r * 0.5;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
      const i = y * this.w + x;
      this.visible[i] = 1;
      this.explored[i] = 1;
    }
  }
}

/** Tiles a unit type reveals; in a fog-of-war game never fewer than its weapon reaches. */
export function unitReach(type, fogged) {
  const sight = unitSight(type.sight);
  return fogged && type.range ? Math.max(sight, type.range + 1) : sight;
}

/** Tiles a structure type reveals from its centre. */
export function structureReach(type, fogged) {
  const half = Math.max(type.w, type.h) / 2;
  return fogged && type.range ? Math.max(type.sight, type.range + 1) + half : type.sight + half;
}

export function updateFog(world) {
  const { map } = world;
  const fogged = world.visibility === 'fog';
  for (const house of world.houses.values()) {
    const fog = (house.fog ??= new FogLayer(map.w, map.h));
    if (fogged) fog.visible.fill(0);   // in the Dune II shroud, what was once seen stays in view
    fog.revision++;
    for (const u of world.units.values()) if (u.house === house.id) fog.reveal(u.tx, u.ty, unitReach(u.type, fogged));
    for (const s of world.structures.values()) if (s.house === house.id) fog.reveal(s.x + (s.w - 1) / 2, s.y + (s.h - 1) / 2, structureReach(s.type, fogged));
    const bit = 1 << house.slot;
    for (const s of world.structures.values()) {
      if (s.house === house.id || (s.seenBy ?? 0) & bit) continue;
      for (let dy = 0; dy < s.h && !((s.seenBy ?? 0) & bit); dy++) for (let dx = 0; dx < s.w; dx++) {
        if (fog.visible[(s.y + dy) * map.w + s.x + dx]) { s.seenBy = (s.seenBy ?? 0) | bit; break; }
      }
    }
  }
}

export function isVisible(world, houseId, x, y) {
  if (!world.fogOfWar) return true;
  const fog = world.houses.get(houseId)?.fog;
  if (!fog) return true;
  return fog.visible[y * fog.w + x] === 1;
}

export function unitVisibleTo(world, houseId, u) {
  return u.house === houseId || isVisible(world, houseId, u.tx, u.ty);
}

export function structureVisibleTo(world, houseId, s) {
  if (s.house === houseId || !world.fogOfWar) return true;
  const house = world.houses.get(houseId);
  return !!house && ((s.seenBy ?? 0) & (1 << house.slot)) !== 0;
}
