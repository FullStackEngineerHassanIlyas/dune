// The territory map of Arrakis between missions (spec §5.8; contract C5; research.md §3 and §6). 27 regions on a
// 200 × 100 map (x east, y south; the polar caps along the top and bottom edges). The shapes are our own: a Voronoi
// partition of hand-placed centres whose shared borders meander (generated here, deterministic, no DOM). Who holds
// which region after each mission comes from the PC's REGION[AHO].INI groups (numbers only): [GROUPm] lists the
// regions taken by each house after mission m, and its REG lines the regions the next mission may be fought in.
// The Sega campaign is fixed and linear, so a mission's region is the first of those choices (the PC scenario the
// scenarios stream builds that mission from).
//
// Steps count missions won: step 0 is the opening map (the houses' first claims, GROUP1), step s has GROUP1..s
// applied. Mission 1 is fought at home and takes no land (step 1 = step 0), and the data has no group after the
// last mission (step 9 = step 8: only the Emperor's region stands against the player; the ending takes it).
import { Rng } from '../core/rng.js';

export const MAP = { w: 200, h: 100 };
export const STEPS = 9;
const HOUSE_OF = { A: 'atreides', H: 'harkonnen', O: 'ordos', S: 'sardaukar' };
export const OWNERS = ['atreides', 'harkonnen', 'ordos', 'sardaukar'];
const CAMPAIGNS = ['atreides', 'harkonnen', 'ordos'];

// [GROUP1..8] per campaign: A/H/O/S = regions that house takes (repeats kept as in the data), to = the REG choices.
const GROUPS = {
  atreides: [
    { A: [13, 7, 20, 14, 21, 22], O: [19, 27, 26, 25, 24, 23], H: [6, 5, 4, 10, 3, 9], to: [8, 15, 23] },
    { A: [8, 15, 23, 15], O: [12, 18, 16, 17], H: [1, 2, 11], to: [1, 2, 3] },
    { A: [1, 2, 3], O: [11], H: [16, 6], to: [4, 9, 16] },
    { A: [4, 9, 16], H: [11, 6], to: [17, 25, 24] },
    { A: [17, 25, 24], H: [18], to: [10, 11, 18] },
    { A: [10, 11, 18], to: [19, 27, 26] },
    { A: [26, 27, 19], to: [5, 12] },
    { A: [5, 12], S: [6], to: [6, 6] },
  ],
  harkonnen: [
    { H: [6, 5, 4, 10, 3, 9], A: [13, 7, 20, 14, 21, 22], O: [19, 27, 26, 25, 24, 23], to: [1, 2, 8] },
    { H: [2, 1, 8], A: [15, 16, 23], O: [17, 11, 18, 12], to: [17, 11, 12] },
    { H: [17, 11, 12], A: [24], O: [16], to: [25, 18, 19] },
    { H: [25, 18, 19], O: [24, 27], to: [13, 7, 14] },
    { H: [7, 14, 13], O: [23], to: [24, 26, 27] },
    { H: [24, 26, 27], A: [23, 20], to: [20, 21, 22] },
    { H: [20, 21, 22], to: [16, 23, 16] },
    { H: [16, 23], S: [15], to: [15, 15, 15, 15] },
  ],
  ordos: [
    { A: [13, 7, 20, 14, 21, 22], O: [19, 27, 26, 25, 24, 23], H: [6, 5, 4, 10, 3, 9], to: [15, 16, 17] },
    { O: [15, 16, 17], A: [1, 2, 8], H: [11, 12, 18], to: [14, 22, 8] },
    { O: [8, 14, 22], H: [2], to: [13, 20, 21] },
    { O: [21, 20, 13], A: [2, 3], to: [11, 18, 12] },
    { O: [18, 11, 12], to: [1, 7, 2] },
    { O: [7, 1, 2], to: [10, 5, 6] },
    { O: [6, 5, 10], to: [3, 9] },
    { O: [3, 9], S: [4], to: [4, 4, 4] },
  ],
};

/** Where each house's first mission is fought: the first region of its opening claim. */
export const HOME = { atreides: 13, harkonnen: 6, ordos: 19 };

// Owner tables per campaign and step: owners[house][step][id] = owner or null.
const owners = {};
for (const house of CAMPAIGNS) {
  owners[house] = [];
  const now = new Array(28).fill(null);
  for (let step = 0; step <= STEPS; step++) {
    const g = step === 0 ? GROUPS[house][0] : step >= 2 ? GROUPS[house][step - 1] : null;   // [GROUP9] does not exist
    if (g) for (const k of 'AHOS') for (const id of g[k] ?? []) now[id] = HOUSE_OF[k];
    if (step === STEPS) for (let id = 1; id <= 27; id++) if (now[id] === 'sardaukar') now[id] = house;   // the last win takes the Emperor's land too
    owners[house].push(now.slice());
  }
}

const campaign = (house) => (CAMPAIGNS.includes(house) ? house : 'atreides');
const clampStep = (step) => Math.min(STEPS, Math.max(0, Math.round(Number(step) || 0)));

/** The house holding region `id` at `step` of `house`'s campaign, or null (unclaimed sand). */
export function ownerOf(house, step, id) { return owners[campaign(house)][clampStep(step)][id] ?? null; }

/** Who holds what after `step` missions of `house`'s campaign: { atreides: [ids], harkonnen, ordos, sardaukar }. */
export function ownership(house, step) {
  const table = owners[campaign(house)][clampStep(step)], out = { atreides: [], harkonnen: [], ordos: [], sardaukar: [] };
  for (let id = 1; id <= 27; id++) if (table[id]) out[table[id]].push(id);
  return out;
}

/** The regions that change hands at `step` (from step - 1): [{ id, from, to }], owners as in ownerOf. */
export function changes(house, step) {
  const s = clampStep(step);
  if (s === 0) return [];
  const list = [];
  for (let id = 1; id <= 27; id++) {
    const from = ownerOf(house, s - 1, id), to = ownerOf(house, s, id);
    if (from !== to) list.push({ id, from, to });
  }
  return list;
}

/** The region mission `mission` (1–9) of `house`'s campaign is fought in, or null: mission 1 at home, then the
 *  first REG choice of the previous step's group (mission 2's is still unclaimed land); mission 9 the Emperor's. */
export function targetRegion(house, mission) {
  const h = campaign(house), n = Math.round(Number(mission));
  if (!(n >= 1 && n <= STEPS)) return null;
  if (n === 1) return HOME[h];
  return GROUPS[h][n - 2].to[0];
}

// ---- Shapes ----------------------------------------------------------------------------------------------------
// Hand-placed centres (our own layout; the order of the land follows the PC map's: Harkonnen north, Atreides west,
// Ordos east, regions 1–6 along the north pole, 20–24 and 26 along the south pole).
const SEEDS = [
  [17, 9], [50, 10], [82, 9], [117, 8], [150, 10], [182, 9],
  [20, 30], [62, 38], [99, 33], [130, 27], [158, 32], [186, 26],
  [7, 52], [32, 53], [72, 63], [107, 52], [136, 49], [168, 54], [191, 54],
  [10, 84], [30, 91], [55, 85], [97, 87], [124, 90], [142, 72], [158, 91], [179, 79],
];
const AMP = 0.12;    // a border meanders by at most this share of its length, tapering to its ends (no crossings at corners)
const STEP = 2.2;    // map units between a border's points
const round = (v) => Math.round(v * 1e6) / 1e6;

/** Clips a convex polygon (points with the label of the edge each starts) to n·p <= c; the cut edge gets `label`. */
function clip(pts, labels, nx, ny, c, label) {
  const outP = [], outL = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length];
    const fa = nx * a[0] + ny * a[1] - c, fb = nx * b[0] + ny * b[1] - c;
    if (fa <= 0) { outP.push(a); outL.push(labels[k]); }
    if ((fa <= 0) !== (fb <= 0)) {
      const t = fa / (fa - fb);
      outP.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      outL.push(fa <= 0 ? label : labels[k]);
    }
  }
  return [outP, outL];
}

/** The inner points of the meandering border from p to q (seen from the lower-numbered region). */
function border(p, q, key) {
  const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy), n = Math.max(2, Math.ceil(len / STEP));
  const rng = new Rng(key * 7919 + 13), f1 = rng.next() * 6.283, f2 = rng.next() * 6.283, f3 = rng.next() * 6.283;
  const out = [];
  for (let k = 1; k < n; k++) {
    const t = k / n;
    const w = 0.62 * Math.sin(6.283 * 1.1 * t + f1) + 0.28 * Math.sin(6.283 * 2.7 * t + f2) + 0.1 * Math.sin(6.283 * 6.3 * t + f3);
    const off = AMP * Math.sin(Math.PI * t) * w;   // in units of the length: the perpendicular is (-dy, dx) / len
    out.push([round(p[0] + dx * t - dy * off), round(p[1] + dy * t + dx * off)]);
  }
  return out;
}

function area(poly) {
  let a = 0;
  for (let k = 0; k < poly.length; k++) { const p = poly[k], q = poly[(k + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}

function centroid(poly) {
  let cx = 0, cy = 0, a = 0;
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k], q = poly[(k + 1) % poly.length], cross = p[0] * q[1] - q[0] * p[1];
    a += cross; cx += (p[0] + q[0]) * cross; cy += (p[1] + q[1]) * cross;
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Whether (x, y) lies inside `poly` (even–odd rule). */
export function insidePolygon(poly, x, y) {
  let inside = false;
  for (let k = 0, j = poly.length - 1; k < poly.length; j = k++) {
    const [xk, yk] = poly[k], [xj, yj] = poly[j];
    if ((yk > y) !== (yj > y) && x < ((xj - xk) * (y - yk)) / (yj - yk) + xk) inside = !inside;
  }
  return inside;
}

function buildRegions() {
  const { w, h } = MAP;
  const cells = SEEDS.map(([xi, yi], i) => {
    let pts = [[0, 0], [w, 0], [w, h], [0, h]], labels = [-1, -1, -1, -1];
    SEEDS.forEach(([xj, yj], j) => {
      if (j !== i) [pts, labels] = clip(pts, labels, xj - xi, yj - yi, (xj * xj + yj * yj - xi * xi - yi * yi) / 2, j);
    });
    pts = pts.map(([x, y]) => [round(x), round(y)]);
    // drop corners that rounding (or a cut through a corner) made coincide with the next one
    for (let k = pts.length - 1; k >= 0 && pts.length > 3; k--) {
      const q = pts[(k + 1) % pts.length];
      if (pts[k][0] === q[0] && pts[k][1] === q[1]) { pts.splice(k, 1); labels.splice(k, 1); }
    }
    return { pts, labels };
  });
  return cells.map(({ pts, labels }, i) => {
    const polygon = [], neighbours = new Set();
    pts.forEach((a, k) => {
      const b = pts[(k + 1) % pts.length], j = labels[k];
      polygon.push(a);
      if (j < 0) return;
      neighbours.add(j + 1);
      const key = Math.min(i, j) * 32 + Math.max(i, j);
      polygon.push(...(i < j ? border(a, b, key) : border(b, a, key).reverse()));
    });
    const ys = polygon.map((p) => p[1]);
    const pole = Math.min(...ys) === 0 ? 'north' : Math.max(...ys) === h ? 'south' : null;
    return { id: i + 1, polygon, centre: centroid(polygon), area: Math.abs(area(polygon)), neighbours: [...neighbours].sort((a, b) => a - b), pole };
  });
}

/** The 27 regions: { id, polygon: [[x, y]…] (map units, closed implicitly), centre, area, neighbours: [ids], pole }. */
export const REGIONS = buildRegions();

/** The region at map point (x, y), or 0 off the map. */
export function regionAt(x, y) {
  if (!(x >= 0 && x <= MAP.w && y >= 0 && y <= MAP.h)) return 0;
  for (const r of REGIONS) if (insidePolygon(r.polygon, x, y)) return r.id;
  return 0;
}
