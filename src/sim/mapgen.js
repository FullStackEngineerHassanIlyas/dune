// Map generator after the original Dune II algorithm (seeded noise → blur → thresholds →
// spice blobs, docs/research/raw/mechanics-campaign.md §1.4) plus the spec §4.2 guarantees:
// a 13x13 rock plateau under every start, tracked connectivity between starts, spice near each start.
// A campaign mission (phase 3, C10) passes `sites` instead: a plateau of radius r at each site (where its
// bases and outposts stand), the same connectivity, and a spice field just off every site's plateau on the
// side facing the map centre, the first (the player's) first. Without sites the output is unchanged.
import { Rng } from '../core/rng.js';
import { G } from '../data/terrain.js';
import { SPICE_PER_TILE, THICK_SPICE_PER_TILE } from '../data/tuning.js';
import { GameMap } from './map.js';

export const PLATEAU_RADIUS = 8;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function valueNoise(rng, size = 64) {
  const lattice = new Float32Array(size * size);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng.next();
  const at = (x, y) => lattice[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbm(noise, x, y, octaves) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) { sum += amp * noise(x * freq, y * freq); norm += amp; amp *= 0.5; freq *= 2; }
  return sum / norm;
}

function blur(src, w, h) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sum = 0, count = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      sum += src[ny * w + nx]; count++;
    }
    out[y * w + x] = sum / count;
  }
  return out;
}

function quantile(values, q) {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

export function startPositions(w, h, count, rng) {
  const m = Math.max(6, Math.min(10, Math.floor(Math.min(w, h) / 5)));
  const corners = [[m, m], [w - 1 - m, h - 1 - m], [w - 1 - m, m], [m, h - 1 - m]];
  const order = rng.chance(0.5) ? [0, 1, 2, 3] : [2, 3, 0, 1];
  return order.slice(0, count).map((k) => ({ x: corners[k][0], y: corners[k][1] }));
}

/** Half the side of the square a plateau of radius `r` is sure to cover with rock (6 for the skirmish radius 8: 13x13). */
export function plateauHalf(r) {
  let s = 0;
  while (2 * ((s + 1) / r) ** 4 <= 1) s++;
  return s;
}

function stampPlateau(map, cx, cy, r) {
  for (let dy = -r - 3; dy <= r + 3; dy++) for (let dx = -r - 3; dx <= r + 3; dx++) {
    const x = cx + dx, y = cy + dy;
    if (!map.inBounds(x, y)) continue;
    const d = (Math.abs(dx) / r) ** 4 + (Math.abs(dy) / r) ** 4;
    const i = map.idx(x, y);
    if (d <= 1) map.ground[i] = G.ROCK;
    else if (d <= 1.8 && map.ground[i] === G.MOUNTAIN) map.ground[i] = G.ROCK;
  }
}

function reachable(map, from, passable) {
  const seen = new Uint8Array(map.w * map.h);
  const queue = [from];
  seen[from] = 1;
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k], x = map.xOf(i), y = map.yOf(i);
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const ni = map.idx(nx, ny);
      if (seen[ni] || !passable(ni)) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return seen;
}

function carveLine(map, a, b) {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(a.x + ((b.x - a.x) * s) / steps), y = Math.round(a.y + ((b.y - a.y) * s) / steps);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (map.inBounds(nx, ny) && map.ground[map.idx(nx, ny)] === G.MOUNTAIN) map.ground[map.idx(nx, ny)] = G.ROCK;
    }
  }
}

function connectStarts(map, starts) {
  const passable = (i) => map.ground[i] !== G.MOUNTAIN;
  for (let k = 1; k < starts.length; k++) {
    const seen = reachable(map, map.idx(starts[0].x, starts[0].y), passable);
    if (!seen[map.idx(starts[k].x, starts[k].y)]) carveLine(map, starts[0], starts[k]);
  }
}

const isSandGround = (map, i) => map.ground[i] === G.SAND || map.ground[i] === G.DUNE;

function growField(map, rng, cx, cy, size) {
  const start = map.idx(cx, cy);
  if (!isSandGround(map, start)) return 0;
  const seen = new Set([start]);
  const frontier = [start];
  let placed = 0;
  while (frontier.length && placed < size) {
    const i = frontier.splice(rng.int(frontier.length), 1)[0];
    if (!isSandGround(map, i)) continue;
    map.spice[i] = placed < size * 0.3 ? THICK_SPICE_PER_TILE : SPICE_PER_TILE;
    placed++;
    const x = map.xOf(i), y = map.yOf(i);
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const ni = map.idx(nx, ny);
      if (!seen.has(ni) && rng.chance(0.75)) { seen.add(ni); frontier.push(ni); }
    }
  }
  return placed;
}

function spiceNear(map, rng, s, starts) {
  const candidates = [];
  for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
    const d = Math.hypot(dx, dy);
    if (d < 9 || d > 13) continue;
    const x = s.x + dx, y = s.y + dy;
    if (!map.inBounds(x, y)) continue;
    const i = map.idx(x, y);
    if (isSandGround(map, i) && starts.every((o) => Math.hypot(o.x - x, o.y - y) >= 9)) candidates.push(i);
  }
  if (!candidates.length) {
    // no sand nearby: open a patch of desert toward the map centre, never inside a start plateau core
    const ang = Math.atan2(map.h / 2 - s.y, map.w / 2 - s.x);
    const x = Math.max(3, Math.min(map.w - 4, Math.round(s.x + Math.cos(ang) * 13)));
    const y = Math.max(3, Math.min(map.h - 4, Math.round(s.y + Math.sin(ang) * 13)));
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const tx = x + dx, ty = y + dy;
      if (starts.some((o) => Math.max(Math.abs(o.x - tx), Math.abs(o.y - ty)) <= 7)) continue;
      map.ground[map.idx(tx, ty)] = G.SAND;
    }
    candidates.push(map.idx(x, y));
  }
  const i = rng.pick(candidates);
  growField(map, rng, map.xOf(i), map.yOf(i), 24 + rng.int(14));
}

function placeSpice(map, rng, starts, count) {
  for (const s of starts) spiceNear(map, rng, s, starts);
  let made = 0, attempts = 0;
  while (made < count && attempts++ < count * 40) {
    const x = rng.int(map.w), y = rng.int(map.h), i = map.idx(x, y);
    if (!isSandGround(map, i) || map.spice[i]) continue;
    if (starts.some((s) => Math.hypot(s.x - x, s.y - y) < 10)) continue;
    if (growField(map, rng, x, y, 18 + rng.int(30)) > 0) made++;
  }
}

function placeBlooms(map, rng, starts, count) {
  let made = 0, attempts = 0;
  while (made < count && attempts++ < count * 60) {
    const x = rng.int(map.w), y = rng.int(map.h), i = map.idx(x, y);
    if (!isSandGround(map, i) || map.spice[i] || map.bloom[i]) continue;
    if (starts.some((s) => Math.hypot(s.x - x, s.y - y) < 12)) continue;
    map.bloom[i] = 1;
    made++;
  }
}

// ---- campaign sites ----

/** Is tile (x, y) on, or within `margin` tiles of, the sure square of any site's plateau? */
const nearSite = (sites, x, y, margin = 0) => sites.some((o) => Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) <= plateauHalf(o.r) + margin);

/** A spice field just off the site's plateau, on the side facing the map centre (where its Refinery stands). */
function siteSpice(map, rng, s, sites) {
  const lo = s.r + 2, hi = s.r + 7;
  const ang = Math.atan2(map.h / 2 - s.y, map.w / 2 - s.x);
  const candidates = [];
  for (let dy = -hi; dy <= hi; dy++) for (let dx = -hi; dx <= hi; dx++) {
    const d = Math.hypot(dx, dy);
    if (d < lo || d > hi || Math.cos(Math.atan2(dy, dx) - ang) < 0.35) continue;
    const x = s.x + dx, y = s.y + dy;
    if (!map.inBounds(x, y) || !isSandGround(map, map.idx(x, y)) || nearSite(sites, x, y, 1)) continue;
    candidates.push(map.idx(x, y));
  }
  if (!candidates.length) {
    // rock all round: open a patch of desert toward the map centre, clear of every plateau
    const x = Math.max(3, Math.min(map.w - 4, Math.round(s.x + Math.cos(ang) * (s.r + 4))));
    const y = Math.max(3, Math.min(map.h - 4, Math.round(s.y + Math.sin(ang) * (s.r + 4))));
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const tx = x + dx, ty = y + dy;
      if (map.inBounds(tx, ty) && !nearSite(sites, tx, ty, 1)) map.ground[map.idx(tx, ty)] = G.SAND;
    }
    if (isSandGround(map, map.idx(x, y))) candidates.push(map.idx(x, y));
  }
  if (!candidates.length) return;
  const i = rng.pick(candidates);
  growField(map, rng, map.xOf(i), map.yOf(i), 28 + rng.int(14));
}

function siteMap(map, rng, given, spiceFields, blooms) {
  const sites = given.map((s) => ({ x: s.x, y: s.y, r: s.r ?? PLATEAU_RADIUS }));
  for (const s of sites) stampPlateau(map, s.x, s.y, s.r);
  connectStarts(map, sites);
  for (const s of sites) siteSpice(map, rng, s, sites);   // spice and blooms lie on sand only, so never on a plateau's sure square
  const count = spiceFields ?? Math.max(3, Math.round(map.w * map.h / 420));
  let made = 0, attempts = 0;
  while (made < count && attempts++ < count * 40) {
    const x = rng.int(map.w), y = rng.int(map.h), i = map.idx(x, y);
    if (!isSandGround(map, i) || map.spice[i] || nearSite(sites, x, y, 3)) continue;
    if (growField(map, rng, x, y, 18 + rng.int(30)) > 0) made++;
  }
  made = 0; attempts = 0;
  const wanted = blooms ?? Math.max(1, Math.round(map.w * map.h / 1400));
  while (made < wanted && attempts++ < wanted * 60) {
    const x = rng.int(map.w), y = rng.int(map.h), i = map.idx(x, y);
    if (!isSandGround(map, i) || map.spice[i] || map.bloom[i] || nearSite(sites, x, y, 4)) continue;
    map.bloom[i] = 1;
    made++;
  }
}

export function generateMap({ w = 64, h = 64, seed = 1, players = 2, sites = null, spiceFields = null, blooms = null } = {}) {
  const rng = new Rng(seed);
  const map = new GameMap(w, h);
  map.seed = seed;
  const n = w * h;
  const heightNoise = valueNoise(rng), duneNoise = valueNoise(rng);
  let height = new Float32Array(n);
  const dune = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    height[y * w + x] = fbm(heightNoise, x / 11, y / 11, 4);
    dune[y * w + x] = fbm(duneNoise, x / 5, y / 9, 2);
  }
  height = blur(height, w, h);
  const rockCut = quantile(height, 0.63), mountainCut = quantile(height, 0.93), duneCut = quantile(dune, 0.62);
  for (let i = 0; i < n; i++) {
    map.ground[i] = height[i] >= mountainCut ? G.MOUNTAIN : height[i] >= rockCut ? G.ROCK : dune[i] >= duneCut ? G.DUNE : G.SAND;
  }
  if (sites?.length) {
    siteMap(map, rng, sites, spiceFields, blooms);
    map.spiceRevision++;
    return { map, starts: sites.map((s) => ({ x: s.x, y: s.y })) };
  }
  const starts = startPositions(w, h, players, rng);
  for (const s of starts) stampPlateau(map, s.x, s.y, PLATEAU_RADIUS);
  connectStarts(map, starts);
  placeSpice(map, rng, starts, spiceFields ?? Math.max(3, Math.round(n / 420)));
  placeBlooms(map, rng, starts, blooms ?? Math.max(1, Math.round(n / 1400)));
  map.spiceRevision++;
  return { map, starts };
}
