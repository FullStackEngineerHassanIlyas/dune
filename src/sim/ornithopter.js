// Ornithopter (spec §4.6; research: units.md "Ornithopter"): a fast, fragile air striker. A move order
// sends it to a spot, where it circles on guard. Hunting and attack runs follow.
import { flyAt, climb } from './air.js';
import { AIR } from '../data/tuning.js';

export function updateOrnithopter(world, u) {
  climb(u, AIR.cruise);
  const o = u.order;
  if (o.type === 'move' || o.type === 'attackMove') {
    if (flyAt(world, u, o.x + 0.5, o.y + 0.5) < AIR.orbit + 0.5) u.order = { type: 'guard', x: o.x, y: o.y };   // arrived: guard the spot
    return;
  }
  if (o.type === 'guard') { flyAt(world, u, o.x + 0.5, o.y + 0.5); return; }
  u.loiter ??= { x: u.x, y: u.y };
  flyAt(world, u, u.loiter.x, u.loiter.y);
}
