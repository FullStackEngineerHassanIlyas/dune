// Fog of war (spec §4.9): explored terrain stays revealed; enemy units need current sight; enemy
// structures stay visible once seen. One layer per house, rebuilt every five ticks.
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

export function updateFog(world) {
  const { map } = world;
  for (const house of world.houses.values()) {
    const fog = (house.fog ??= new FogLayer(map.w, map.h));
    fog.visible.fill(0);
    fog.revision++;
    for (const u of world.units.values()) if (u.house === house.id) fog.reveal(u.tx, u.ty, unitSight(u.type.sight));
    for (const s of world.structures.values()) if (s.house === house.id) fog.reveal(s.x + (s.w - 1) / 2, s.y + (s.h - 1) / 2, s.type.sight + Math.max(s.w, s.h) / 2);
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
