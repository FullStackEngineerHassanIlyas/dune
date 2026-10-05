// Base layouts for the campaign missions (phase 3, C1): every base stands on the sure square of its site's rock
// plateau (sim/mapgen.js plateauHalf), so its buildings are on rock whatever the seed makes of the rest. A small
// deterministic packer puts each building on the free spot nearest its anchor — the Construction Yard in the
// middle, the Refinery and Silos towards the spice (which mapgen lays towards the map centre), the factories
// towards the foe, Wind Traps behind — with a lane of at least one tile round every building, and turrets
// spread along the front edge. Units muster on the free tiles in front. Runs once when campaign.js loads.
import { STRUCTURES } from '../structures.js';
import { plateauHalf } from '../../sim/mapgen.js';

/** Anchors in halves of the square (1 reaches its edge, in any direction): f along the front (towards the foe or,
 *  `spice`, towards the site's spice field), s across it. */
const ANCHOR = {
  constructionYard: { f: 0, s: 0 },
  refinery: { f: 0.85, s: 0, spice: true },
  silo: { f: 0.5, s: 0.55, spice: true },
  heavyFactory: { f: 0.5, s: -0.45 },
  barracks: { f: 0.55, s: 0.45 },
  wor: { f: 0.55, s: 0.45 },
  outpost: { f: 0.1, s: 0.8 },
  windtrap: { f: -0.75, s: 0 },
  hiTech: { f: -0.35, s: -0.8 },
  repair: { f: 0.15, s: -0.8 },
  starport: { f: -0.55, s: 0.65 },
  palace: { f: -0.8, s: -0.35 },
};

const unit = (dx, dy) => { const d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d }; };

/** At least one free tile between two rectangles, across or along. */
const apart = (a, b) => a.x >= b.x + b.w + 1 || b.x >= a.x + a.w + 1 || a.y >= b.y + b.h + 1 || b.y >= a.y + a.h + 1;

/**
 * Lays `types` out on `site` ({ x, y, r }). `front` and `spice` are directions (any length) from the site centre.
 * Returns { structures: [{ type, x, y }], concrete: [{ x, y, w, h }], rects, half } or throws when a building finds no room.
 */
export function layoutBase(site, types, { front, spice = front, turrets = [] } = {}) {
  const half = plateauHalf(site.r);
  const f = unit(front.x, front.y), sp = unit(spice.x, spice.y);
  const rects = [], structures = [], guns = [];
  const lo = { x: site.x - half, y: site.y - half }, hi = { x: site.x + half, y: site.y + half };
  // turrets first: on the front edge of the square, as far from each other as the edge allows
  const ring = [];
  for (let y = lo.y; y <= hi.y; y++) for (let x = lo.x; x <= hi.x; x++) {
    if (Math.max(Math.abs(x - site.x), Math.abs(y - site.y)) < half) continue;
    const d = unit(x - site.x, y - site.y), dot = d.x * f.x + d.y * f.y;
    if (dot >= 0.1) ring.push({ x, y, dot });
  }
  const placed = [];
  for (const type of turrets) {
    let best = null, bestScore = -Infinity;
    for (const c of ring) {
      if (!rects.every((r) => apart({ x: c.x, y: c.y, w: 1, h: 1 }, r))) continue;
      const spread = placed.length ? Math.min(...placed.map((p) => Math.hypot(p.x - c.x, p.y - c.y))) : 0;
      const score = spread * 10 + c.dot;
      if (score > bestScore + 1e-9) { best = c; bestScore = score; }
    }
    if (!best) throw new Error(`no room for ${type} on site ${site.id ?? `${site.x},${site.y}`}`);
    rects.push({ x: best.x, y: best.y, w: 1, h: 1 });
    placed.push(best);
    guns.push({ type, x: best.x, y: best.y });
  }
  for (const type of types) {
    const t = STRUCTURES[type], a = ANCHOR[type] ?? { f: 0, s: 0 };
    const dir = a.spice ? sp : f, side = { x: -dir.y, y: dir.x }, k = half / Math.max(Math.abs(dir.x), Math.abs(dir.y));
    const ax = site.x + 0.5 + Math.max(-half, Math.min(half, k * (a.f * dir.x + a.s * side.x)));
    const ay = site.y + 0.5 + Math.max(-half, Math.min(half, k * (a.f * dir.y + a.s * side.y)));
    let best = null, bestScore = Infinity;
    for (let y = lo.y; y + t.h - 1 <= hi.y; y++) for (let x = lo.x; x + t.w - 1 <= hi.x; x++) {
      const rect = { x, y, w: t.w, h: t.h };
      if (!rects.every((r) => apart(rect, r))) continue;
      const score = (x + t.w / 2 - ax) ** 2 + (y + t.h / 2 - ay) ** 2;
      if (score < bestScore - 1e-9) { best = rect; bestScore = score; }
    }
    if (!best) throw new Error(`no room for ${type} on site ${site.id ?? `${site.x},${site.y}`} (r ${site.r})`);
    rects.push(best);
    structures.push({ type, x: best.x, y: best.y });
  }
  structures.push(...guns);
  const concrete = rects.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h }));
  return { structures, concrete, rects, half };
}

/**
 * Free tiles of the site's square for `count` units, nearest first to the muster point (in front of the yard),
 * never on a building, the lane in front of its door (the row below it) or another unit. `taken` is a Set of 'x,y'.
 */
export function musterTiles(site, rects, count, { front, taken = new Set(), reach = 0.55 } = {}) {
  const half = plateauHalf(site.r), f = unit(front.x, front.y);
  const mx = site.x + f.x * half * reach, my = site.y + f.y * half * reach;
  const blocked = (x, y) => rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y <= r.y + r.h);   // footprint and the row below
  const tiles = [];
  for (let y = site.y - half; y <= site.y + half; y++) for (let x = site.x - half; x <= site.x + half; x++) {
    if (!blocked(x, y) && !taken.has(`${x},${y}`)) tiles.push({ x, y, d: (x - mx) ** 2 + (y - my) ** 2 + ((x + y) % 2 ? 6 : 0) });   // a loose chequer, not a car park
  }
  tiles.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  if (tiles.length < count) throw new Error(`no room for ${count} units on site ${site.id ?? `${site.x},${site.y}`}`);
  const out = tiles.slice(0, count).map(({ x, y }) => ({ x, y }));
  for (const t of out) taken.add(`${t.x},${t.y}`);
  return out;
}

/** The eight symmetries of a square map of side `size`: index → (x, y) → (x', y'). */
export function symmetry(index, size) {
  const W = size - 1;
  const maps = [
    (x, y) => [x, y], (x, y) => [W - x, y], (x, y) => [x, W - y], (x, y) => [W - x, W - y],
    (x, y) => [y, x], (x, y) => [W - y, x], (x, y) => [y, W - x], (x, y) => [W - y, W - x],
  ];
  const m = maps[((index % 8) + 8) % 8];
  return (p) => { const [x, y] = m(p.x, p.y); return { ...p, x, y }; };
}

/** The map edge nearest a point: 'north' | 'east' | 'south' | 'west'. */
export function nearestSide(p, w, h) {
  const d = { north: p.y, south: h - 1 - p.y, west: p.x, east: w - 1 - p.x };
  return Object.keys(d).reduce((a, b) => (d[b] < d[a] ? b : a));
}

/** Heading (radians, the sim's convention: 0 east, π/2 south) of a direction, rounded for plain data. */
export const headingOf = (dir) => Math.round(Math.atan2(dir.y, dir.x) * 100) / 100;
