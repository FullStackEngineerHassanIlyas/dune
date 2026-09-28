// Structure placement (spec §4.5): every footprint tile must be free rock inside the map, and the
// footprint must touch (8-neighbourhood) the house's own structure or concrete. Building on bare rock
// costs up to half the hit points; the house's own concrete prevents that. Slabs go on bare rock only.
import { STRUCTURES } from '../data/structures.js';
import { G } from '../data/terrain.js';

export function checkPlacement(world, houseId, typeId, x, y) {
  const t = STRUCTURES[typeId];
  const house = world.houses.get(houseId);
  if (!t || !house) return { ok: false, tiles: [], adjacent: false, reason: 'unknown' };
  const map = world.map, slot = house.slot + 1;
  const tiles = [];
  let blocked = false;
  for (let dy = 0; dy < t.h; dy++) for (let dx = 0; dx < t.w; dx++) {
    const tx = x + dx, ty = y + dy;
    let state = 'blocked';
    if (map.inBounds(tx, ty)) {
      const i = map.idx(tx, ty);
      if (map.ground[i] === G.ROCK && !map.structure[i] && !map.unit[i]) {
        if (t.isConcrete) state = map.concrete[i] ? 'blocked' : 'bare';
        else state = map.concrete[i] === slot ? 'concrete' : 'bare';
      }
    }
    if (state === 'blocked') blocked = true;
    tiles.push({ x: tx, y: ty, state });
  }
  const adjacent = touchesBase(world, houseId, slot, x, y, t.w, t.h);
  const ok = !blocked && adjacent;
  return { ok, tiles, adjacent, reason: ok ? null : blocked ? 'blocked' : 'notAdjacent' };
}

function touchesBase(world, houseId, slot, x, y, w, h) {
  const map = world.map;
  for (let ty = y - 1; ty <= y + h; ty++) for (let tx = x - 1; tx <= x + w; tx++) {
    if (tx >= x && tx < x + w && ty >= y && ty < y + h) continue;
    if (!map.inBounds(tx, ty)) continue;
    const i = map.idx(tx, ty);
    if (map.concrete[i] === slot) return true;
    const sid = map.structure[i];
    if (sid && world.structures.get(sid)?.house === houseId) return true;
  }
  return false;
}

/** Nearest valid origin for `typeId` around (cx, cy), searching square rings outwards; null if none. */
export function findPlacement(world, houseId, typeId, cx, cy, maxR = 10) {
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (checkPlacement(world, houseId, typeId, cx + dx, cy + dy).ok) return { x: cx + dx, y: cy + dy };
    }
  }
  return null;
}

export function placeStructure(world, houseId, typeId, x, y) {
  const check = checkPlacement(world, houseId, typeId, x, y);
  if (!check.ok) return null;
  const t = STRUCTURES[typeId];
  const map = world.map, slot = world.houses.get(houseId).slot + 1;
  if (t.isConcrete) {
    for (const tile of check.tiles) map.concrete[map.idx(tile.x, tile.y)] = slot;
    map.concreteRevision++;
    world.events.push('concretePlaced', { house: houseId, x, y, w: t.w, h: t.h });
    return { concrete: true };
  }
  const bare = check.tiles.filter((tile) => tile.state === 'bare').length;
  return world.spawnStructure(typeId, houseId, x, y, { hpFraction: 1 - 0.5 * (bare / check.tiles.length) });
}
