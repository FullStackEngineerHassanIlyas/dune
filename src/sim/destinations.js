// Spread a group order over nearby free tiles so twenty units do not fight over one tile. The spread
// only walks ground the group can use, avoids mountains unless the order targets one, and gives each
// unit a slot in the area it can actually reach.
import { G } from '../data/terrain.js';

const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const isStationary = (u) => u && !u.step && u.pathState !== 'ready' && u.pathState !== 'waiting';

function nearestTile(map, goal, accept) {
  const gx = map.xOf(goal), gy = map.yOf(goal);
  for (let r = 1; r <= Math.max(map.w, map.h); r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = gx + dx, y = gy + dy;
      if (map.inBounds(x, y) && accept(map.idx(x, y))) return map.idx(x, y);
    }
  }
  return goal;
}

/** @returns {Map<number, number>} unit id → destination tile index */
export function findDestinations(world, goal, units) {
  const map = world.map;
  const result = new Map();
  if (units.length === 1) { result.set(units[0].id, goal); return result; }
  const group = new Set(units.map((u) => u.id));
  const classes = [...new Set(units.map((u) => u.move))];
  const passable = (i) => classes.some((c) => map.moveFactor(i, c) > 0);
  const onMountain = map.ground[goal] === G.MOUNTAIN;
  const standable = (i) => passable(i) && (onMountain || map.ground[i] !== G.MOUNTAIN);
  const seed = standable(goal) ? goal : nearestTile(map, goal, standable);
  const seen = new Uint8Array(map.w * map.h);
  const queue = [seed];
  seen[seed] = 1;
  const slots = [];
  const want = units.length * 3;
  const maxVisit = Math.min(map.w * map.h, 64 + units.length * 24);
  for (let k = 0; k < queue.length && slots.length < want && k < maxVisit; k++) {
    const i = queue[k];
    const occupant = map.unit[i];
    const taken = occupant && !group.has(occupant) && isStationary(world.units.get(occupant));
    if (!map.structure[i] && !taken && standable(i)) slots.push(i);
    const x = map.xOf(i), y = map.yOf(i);
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const ni = map.idx(nx, ny);
      if (!seen[ni] && standable(ni)) { seen[ni] = 1; queue.push(ni); }
    }
  }
  const gx = map.xOf(goal), gy = map.yOf(goal);
  const ordered = [...units].sort((a, b) => Math.hypot(a.tx - gx, a.ty - gy) - Math.hypot(b.tx - gx, b.ty - gy) || a.id - b.id);
  const taken = new Set();
  for (const u of ordered) {
    const from = map.idx(u.tx, u.ty);
    const slot = slots.find((i) => !taken.has(i) && map.moveFactor(i, u.move) > 0 && (!world.reach || world.reach.connected(from, i, u.move))) ?? goal;
    taken.add(slot);
    result.set(u.id, slot);
  }
  return result;
}
