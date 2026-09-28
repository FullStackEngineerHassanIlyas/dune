// Structure records and footprint helpers.
import { STRUCTURES } from '../data/structures.js';

export function createStructure(id, typeId, house, x, y, { hpFraction = 1 } = {}) {
  const type = STRUCTURES[typeId];
  if (!type) throw new Error(`unknown structure type ${typeId}`);
  return {
    id, typeId, type, house, kind: 'structure',
    x, y, w: type.w, h: type.h,
    hp: Math.max(1, Math.round(type.hp * hpFraction)), maxHp: type.hp,
    level: 0, placedAt: 0,
  };
}

export function footprint(x, y, w, h) {
  const out = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push([x + dx, y + dy]);
  return out;
}
