// Free tiles for new units: a spiral search, and factory exits (south side first — doors face south).
export function findFreeTile(world, x, y, moveClass, maxR = 8, minR = 0) {
  const map = world.map;
  for (let r = minR; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = x + dx, ty = y + dy;
      if (!map.inBounds(tx, ty)) continue;
      const i = map.idx(tx, ty);
      if (!map.unit[i] && !map.structure[i] && map.moveFactor(i, moveClass) > 0) return { x: tx, y: ty };
    }
  }
  return null;
}

export function exitTile(world, s, moveClass) {
  const map = world.map;
  const free = (x, y) => {
    if (!map.inBounds(x, y)) return false;
    const i = map.idx(x, y);
    return !map.unit[i] && !map.structure[i] && map.moveFactor(i, moveClass) > 0;
  };
  const ring = [];
  for (let x = s.x; x < s.x + s.w; x++) ring.push([x, s.y + s.h]);
  for (let y = s.y + s.h - 1; y >= s.y; y--) ring.push([s.x + s.w, y]);
  for (let y = s.y + s.h - 1; y >= s.y; y--) ring.push([s.x - 1, y]);
  for (let x = s.x; x < s.x + s.w; x++) ring.push([x, s.y - 1]);
  ring.push([s.x - 1, s.y + s.h], [s.x + s.w, s.y + s.h], [s.x - 1, s.y - 1], [s.x + s.w, s.y - 1]);
  for (const [x, y] of ring) if (free(x, y)) return { x, y };
  return findFreeTile(world, s.x + Math.floor(s.w / 2), s.y + s.h, moveClass, 4, 1);
}
