// Sandworms (spec §4.8; docs/research/raw/units.md "Sandworm", mechanics-campaign.md §6). A worm is a unit
// of no house (WORM_HOUSE) that lives under the sand: it travels only where the original's SLITHER column
// lets it (sand, dunes, spice), holds no tile, and cannot be seen or shot while under — the player sees its
// ridge (render/worm-views.js). Once a second it picks its prey with the original priority (OpenDUNE
// Unit_Sandworm_GetTargetPriority): wheeled 5000, tracked and Harvesters 1000, infantry 100, aircraft and
// anything not standing on sand or dunes 0; ×4 while the prey moves or has just fired, divided by the
// distance in tiles (rounded up, the original's max + min / 2), ×2 within two tiles. Close enough, it
// surfaces under its prey and swallows it whole (cause 'eaten': no wreck, no blast, no spilled spice), and
// takes anything else that wanders into its maw while it is up. After three meals it dives and leaves for
// good. It can be shot on the move as well as up, as in the original: 600 HP, and after 300 damage it flees. The director keeps world.rules.worms
// worms on the map ('off' none, 'few' one, 'many' three; a missing setting reads 'few'), each born on a
// large stretch of sand away from every base, the next one some time after one goes. It never sets a
// tile's worth of body on rock: every step is checked and slides along the edge instead, and a worm that
// finds itself off its ground anyway goes straight back to the nearest sand. Every die is cast by
// world.wildRng, a stream seeded from the world's seed: the same seed gives the same worms, and worms
// never reshuffle the dice of the rest of the simulation.
import { MOVE } from '../data/units.js';
import { DT, SIM_HZ, TURN_RATE, TERRAIN_REF, groundSpeed } from '../data/tuning.js';
import { turnToward } from './geometry.js';
import { killUnit, onTheMove } from './combat.js';

export const WORM_HOUSE = 'worm';
const T = (seconds) => Math.round(seconds * SIM_HZ);

export const WORM = {
  meals: 3,                    // OpenDUNE pool/unit.c: amount = 3, the worm goes once it reaches 0
  flee: 300,                   // damage taken before it dives and flees (spec §4.8); half its 600 HP
  prey: { [MOVE.FOOT]: 100, [MOVE.SABOTEUR]: 100, [MOVE.TRACKED]: 1000, [MOVE.HARVESTER]: 1000, [MOVE.WHEELED]: 5000 },
  busy: 4, near: 2, nearTiles: 2,   // ×4 moving or firing; ×2 within two tiles
  scan: T(1),                  // looks for prey once a second
  strike: 0.9,                 // tiles from its prey at which it comes up
  bite: 1.05,                  // how far from the centre of its maw a unit is taken
  chase: 3,                    // tiles: closer than this over open sand it heads straight for its prey
  rise: T(0.6), hold: T(1.6), sink: T(0.7), cool: T(0.6), digest: T(2.5), leave: T(5),
  rest: [T(4), T(9)],          // a pause when it reaches a wandering goal with nothing to hunt
  wander: 12,                  // tiles: how far a roaming worm wanders at a time
  count: { off: 0, few: 1, many: 3 },
  first: { few: [90, 150], many: [25, 50] },     // seconds into the game before the first worm
  again: { few: [90, 180], many: [30, 70] },     // seconds after one goes before the next
  minSand: 150,                // tiles in one stretch of sand for a worm to be born in it
  clear: { base: 14, unit: 7, worm: 12 },        // tiles a newborn worm keeps from buildings (and MCVs), units and other worms
  ashore: 6,                   // tiles: how far a worm off its ground looks for sand before it gives up and dives away
};

/** The skirmish setting in force: 'off', 'few' or 'many' (anything else, or nothing, reads 'few'). */
export function wormSetting(world) {
  const s = world.rules?.worms;
  return s === 'off' || s === 'many' ? s : 'few';
}

export const isWorm = (u) => !!u && u.move === MOVE.WORM;

/** Called by World.spawnUnit for every new worm. */
export function initWorm(u) {
  u.worm = { state: 'roam', timer: 0, prey: 0, meals: 0, cool: 0, rest: 0, scanAt: 0, pathAt: -1e9, fled: false, why: null };
  u.rise = u.prise = 0;
  u.fade = 1;
  u.submerged = true;
}

/** A wild worm born at tile (x, y). */
export function spawnWorm(world, x, y, opts = {}) {
  return world.spawnUnit('sandworm', WORM_HOUSE, x, y, { heading: opts.heading ?? world.wildRng.range(-Math.PI, Math.PI) });
}

const tileDist = (dx, dy) => { dx = Math.abs(dx); dy = Math.abs(dy); return Math.ceil(Math.max(dx, dy) + Math.min(dx, dy) / 2 - 1e-9); };

/** How much the worm wants `u` (0: not at all). The original's formula; see the header. */
export function preyPriority(world, worm, u) {
  if (!u || u === worm || !u.isGround || u.inside || u.hp <= 0) return 0;
  let p = WORM.prey[u.move] ?? 0;
  if (!p) return 0;
  const map = world.map;
  if (!map.inBounds(u.tx, u.ty) || !map.isSand(map.idx(u.tx, u.ty))) return 0;
  if (onTheMove(u) || u.cooldown > 0) p *= WORM.busy;
  const d = tileDist(u.x - worm.x, u.y - worm.y);
  if (d > 0) p = Math.floor(p / d);
  if (d <= WORM.nearTiles) p *= WORM.near;
  return p;
}

/** The unit the worm wants most among those it can reach under the sand, or null. */
export function findPrey(world, worm) {
  const map = world.map, lab = world.reach.labelsFor(MOVE.WORM), home = lab[map.idx(worm.tx, worm.ty)];
  if (!home) return null;
  let best = null, bestP = 0;
  for (const u of world.units.values()) {
    const p = preyPriority(world, worm, u);
    if (p > bestP && lab[map.idx(u.tx, u.ty)] === home) { best = u; bestP = p; }
  }
  return best;
}

const passable = (map, x, y) => map.inBounds(Math.floor(x), Math.floor(y)) && map.moveFactor(map.idx(Math.floor(x), Math.floor(y)), MOVE.WORM) > 0;

const ground = (map, x, y) => map.inBounds(x, y) && map.moveFactor(map.idx(x, y), MOVE.WORM) > 0;

/** Whether the straight line between two points runs over worm ground all the way: every tile it
 *  crosses is checked (a grid walk), so not even a sliver of a rock corner slips through; a line through
 *  a corner point needs both tiles beside it open (the pathfinder's own no-corner-cutting rule). */
export function sandLine(map, x0, y0, x1, y1) {
  let x = Math.floor(x0), y = Math.floor(y0);
  const dx = x1 - x0, dy = y1 - y0, sx = Math.sign(dx), sy = Math.sign(dy);
  const ddx = sx ? Math.abs(1 / dx) : Infinity, ddy = sy ? Math.abs(1 / dy) : Infinity;
  let nx = sx > 0 ? (x + 1 - x0) * ddx : sx < 0 ? (x0 - x) * ddx : Infinity;   // line fraction at the next column / row edge
  let ny = sy > 0 ? (y + 1 - y0) * ddy : sy < 0 ? (y0 - y) * ddy : Infinity;
  for (let n = Math.abs(Math.floor(x1) - x) + Math.abs(Math.floor(y1) - y); ;) {
    if (!ground(map, x, y)) return false;
    if (n <= 0) return true;
    if (Math.abs(nx - ny) < 1e-9) {
      if (!ground(map, x + sx, y) || !ground(map, x, y + sy)) return false;
      x += sx; y += sy; nx += ddx; ny += ddy; n -= 2;
    } else if (nx < ny) { x += sx; nx += ddx; n--; } else { y += sy; ny += ddy; n--; }
  }
}

const speedOf = (world, u) => groundSpeed(u.type.speed, world.map.moveFactor(world.map.idx(u.tx, u.ty), MOVE.WORM) || TERRAIN_REF, MOVE.WORM);

/** Moves the worm up to `step` tiles toward (x, y); true once it is there. A step that would leave its
 *  ground slides along the edge (one axis only) or waits; off its ground already, it goes freely. */
function moveToward(world, u, x, y, step) {
  const map = world.map, dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy);
  if (d > 1e-6) u.heading = turnToward(u.heading, Math.atan2(dy, dx), TURN_RATE[u.type.turn] * DT);
  let blocked = false;
  if (d > 1e-6) {
    const go = Math.min(step, d);
    let nx = u.x + (dx / d) * go, ny = u.y + (dy / d) * go;
    if (!passable(map, nx, ny) && passable(map, u.x, u.y)) {
      blocked = true;
      if (passable(map, nx, u.y)) ny = u.y;
      else if (passable(map, u.x, ny)) nx = u.x;
      else { nx = u.x; ny = u.y; }
    }
    u.distance += Math.hypot(nx - u.x, ny - u.y);
    u.x = nx; u.y = ny;
  }
  u.tx = Math.max(0, Math.min(map.w - 1, Math.floor(u.x)));
  u.ty = Math.max(0, Math.min(map.h - 1, Math.floor(u.y)));
  return !blocked && d <= step;
}

/** Follows the path the world found, cutting corners where the sand runs straight. False without one. */
function follow(world, u, step) {
  if (u.pathState !== 'ready' || u.pathIndex >= u.path.length) return false;
  const map = world.map, at = (i) => [map.xOf(i) + 0.5, map.yOf(i) + 0.5];
  for (let j = Math.min(u.path.length - 1, u.pathIndex + 5); j > u.pathIndex; j--) {
    const [x, y] = at(u.path[j]);
    if (sandLine(map, u.x, u.y, x, y)) { u.pathIndex = j; break; }
  }
  const [x, y] = at(u.path[u.pathIndex]);
  if (!sandLine(map, u.x, u.y, x, y)) {   // off the path's line (after a dash at prey): back to the middle of its own tile first
    const cx = u.tx + 0.5, cy = u.ty + 0.5;
    if (Math.hypot(cx - u.x, cy - u.y) > 1e-3) moveToward(world, u, cx, cy, step);
    else world.requestPath(u, u.goal);   // the way is shut even from there: the path is stale, ask again from here
    return true;
  }
  if (moveToward(world, u, x, y, step)) u.pathIndex++;
  return true;
}

function headFor(world, u, tx, ty) {
  const w = u.worm, goal = world.map.idx(tx, ty);
  if (u.pathState === 'waiting' || (goal === u.goal && u.pathState === 'ready' && u.pathIndex < u.path.length)) return;
  if (world.tick - w.pathAt < WORM.scan) return;
  w.pathAt = world.tick;
  world.requestPath(u, goal);
}

function setState(u, state) {
  u.worm.state = state;
  u.worm.timer = 0;
  u.submerged = !(state === 'rise' || state === 'up' || state === 'sink');
}

export function updateWorm(world, u) {
  const w = u.worm ?? (initWorm(u), u.worm);
  u.prise = u.rise;
  w.timer++;
  if (w.cool > 0) w.cool--;
  if (!w.fled && u.maxHp - u.hp >= WORM.flee) {   // hurt enough: it goes under and away
    w.fled = true;
    w.why = 'fled';
    world.events.push('wormFled', { id: u.id, x: u.x, y: u.y });
    if (w.state === 'rise' || w.state === 'up') setState(u, 'sink');
    else if (w.state !== 'sink' && w.state !== 'leave') leave(world, u);
  }
  switch (w.state) {
    case 'roam': case 'hunt': if (passable(world.map, u.x, u.y)) stalk(world, u); else ashore(world, u); break;
    case 'rise': rise(world, u); break;
    case 'up': up(world, u); break;
    case 'sink': sink(world, u); break;
    case 'leave': away(world, u); break;
  }
}

/** Under the sand: close in on the best prey, or wander and lie still a while (prey wakes it; digesting, it does not look). */
function stalk(world, u) {
  const w = u.worm, map = world.map;
  if (w.rest > 0) w.rest--;
  if (world.tick >= w.scanAt) {
    w.scanAt = world.tick + WORM.scan;
    const p = findPrey(world, u);
    w.prey = p ? p.id : 0;
    if ((w.state === 'hunt') !== !!p) setState(u, p ? 'hunt' : 'roam');
    if (p) w.rest = 0;
  }
  const prey = w.prey ? world.units.get(w.prey) : null;
  if (w.state === 'hunt' && (!prey || !preyPriority(world, u, prey))) { w.prey = 0; setState(u, 'roam'); }
  const step = speedOf(world, u) * DT;
  if (w.state === 'hunt' && prey) {
    const d = Math.hypot(prey.x - u.x, prey.y - u.y);
    if (d <= WORM.strike) { surface(world, u); return; }
    if (d <= WORM.chase && sandLine(map, u.x, u.y, prey.x, prey.y)) { moveToward(world, u, prey.x, prey.y, step); return; }
    const gx = map.xOf(u.goal), gy = map.yOf(u.goal);
    if (u.goal < 0 || Math.max(Math.abs(gx - prey.tx), Math.abs(gy - prey.ty)) > 1) headFor(world, u, prey.tx, prey.ty);
    if (!follow(world, u, step)) headFor(world, u, prey.tx, prey.ty);
    return;
  }
  if (w.rest > 0) return;
  if (follow(world, u, step)) return;
  if (u.pathState === 'waiting') return;
  if (u.goal >= 0) { u.goal = -1; w.rest = Math.round(world.wildRng.range(...WORM.rest)); return; }   // got there, or found no way: lie still a while
  const spot = wanderSpot(world, u);
  if (spot >= 0) { w.pathAt = -1e9; headFor(world, u, map.xOf(spot), map.yOf(spot)); }
  else w.rest = WORM.rest[0];
}

/** Off its ground (the sand changed under it, or it was set down on rock): straight to the nearest worm
 *  tile within WORM.ashore tiles — or, with none, it dives and leaves, so the world can send another. */
function ashore(world, u) {
  const map = world.map, cx = Math.floor(u.x), cy = Math.floor(u.y), r = WORM.ashore;
  let bx = 0, by = 0, best = Infinity;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    const d = Math.hypot(x + 0.5 - u.x, y + 0.5 - u.y);
    if (d < best && ground(map, x, y)) { best = d; bx = x; by = y; }
  }
  if (best === Infinity) { u.worm.why = 'stranded'; leave(world, u); return; }
  u.path = []; u.pathIndex = 0; u.pathState = 'none'; u.goal = -1;
  moveToward(world, u, bx + 0.5, by + 0.5, speedOf(world, u) * DT);
}

/** A random tile of the worm's own sand within WORM.wander tiles, or -1. */
function wanderSpot(world, u) {
  const map = world.map, lab = world.reach.labelsFor(MOVE.WORM), home = lab[map.idx(u.tx, u.ty)], r = WORM.wander;
  for (let k = 0; k < 12; k++) {
    const x = u.tx + world.wildRng.int(2 * r + 1) - r, y = u.ty + world.wildRng.int(2 * r + 1) - r;
    if (!map.inBounds(x, y) || Math.hypot(x - u.tx, y - u.ty) < 4) continue;
    if (home && lab[map.idx(x, y)] === home) return map.idx(x, y);
  }
  return -1;
}

function surface(world, u) {
  setState(u, 'rise');
  u.path = []; u.pathIndex = 0; u.pathState = 'none'; u.goal = -1;
  world.events.push('wormSurfaced', { id: u.id, x: u.x, y: u.y });
}

/** Coming up under its prey: the head follows it until the maw is open. */
function rise(world, u) {
  const w = u.worm, prey = world.units.get(w.prey);
  if (prey && preyPriority(world, u, prey)) {
    const step = 2.5 * DT;
    if (Math.hypot(prey.x - u.x, prey.y - u.y) > 0.05 && passable(world.map, prey.x, prey.y)) moveToward(world, u, prey.x, prey.y, step);
  }
  u.rise = Math.min(1, w.timer / WORM.rise);
  if (w.timer < WORM.rise) return;
  setState(u, 'up');
  if (prey && within(u, prey) && preyPriority(world, u, prey)) swallow(world, u, prey);
}

const within = (u, v) => Math.hypot(v.x - u.x, v.y - u.y) <= WORM.bite;

/** Up: anything else on the sand in its maw goes too, until it has had its three meals or its time is up. */
function up(world, u) {
  const w = u.worm;
  u.rise = 1;
  if (w.meals < WORM.meals && w.cool <= 0 && !w.fled) {
    let best = null, bestP = 0;
    for (const v of world.units.values()) {
      if (!within(u, v)) continue;
      const p = preyPriority(world, u, v);
      if (p > bestP) { best = v; bestP = p; }
    }
    if (best) swallow(world, u, best);
  }
  if (w.timer >= (w.meals >= WORM.meals ? Math.round(WORM.hold / 2) : WORM.hold)) setState(u, 'sink');
}

function swallow(world, u, prey) {
  const w = u.worm;
  w.meals++;
  w.cool = WORM.cool;
  w.timer = 0;
  world.events.push('wormAte', { id: u.id, prey: prey.id, typeId: prey.typeId, house: prey.house, x: prey.x, y: prey.y, meals: w.meals });
  killUnit(world, prey, { house: u.house, id: u.id, kind: 'unit' }, 'eaten');
  if (w.prey === prey.id) w.prey = 0;
}

function sink(world, u) {
  const w = u.worm;
  u.rise = Math.max(0, 1 - w.timer / WORM.sink);
  if (w.timer < WORM.sink) return;
  u.rise = 0;
  if (w.meals >= WORM.meals) { w.why ??= 'fed'; leave(world, u); return; }
  if (w.fled) { leave(world, u); return; }
  setState(u, 'roam');
  w.rest = WORM.digest;
  w.scanAt = world.tick + WORM.digest;
}

/** Dives for good: heads off under the sand along the longest open run, fading, then is gone. */
function leave(world, u) {
  setState(u, 'leave');
  u.submerged = true;
  u.path = []; u.pathIndex = 0; u.pathState = 'none'; u.goal = -1;
  u.worm.dir = openestHeading(world.map, u);
}

function openestHeading(map, u) {
  let best = u.heading, run = -1;
  for (let k = 0; k < 8; k++) {
    const a = u.heading + (k * Math.PI) / 4;
    let n = 0;
    while (n < 12 && passable(map, u.x + Math.cos(a) * (n + 1), u.y + Math.sin(a) * (n + 1))) n++;
    if (n > run) { run = n; best = a; }
  }
  return best;
}

function away(world, u) {
  const w = u.worm, step = speedOf(world, u) * DT, map = world.map;
  u.fade = Math.max(0, 1 - w.timer / WORM.leave);
  const x = u.x + Math.cos(w.dir) * step * 4, y = u.y + Math.sin(w.dir) * step * 4;
  if (passable(map, x, y)) moveToward(world, u, x, y, step);
  else w.dir = openestHeading(map, u);
  if (w.timer < WORM.leave) return;
  world.events.push('wormGone', { id: u.id, x: u.x, y: u.y, why: w.why ?? 'fed' });
  world.removeUnit(u, 'dived');
}

// ——— the director: worms come and go ———

const span = (world, [a, b]) => world.wildRng.range(a, b);

/** Every second: keeps the setting's number of worms on the map, one at a time. */
export function updateWorms(world) {
  const setting = wormSetting(world), want = WORM.count[setting];
  if (!want) return;
  const d = (world.wormDirector ??= { next: world.time + span(world, WORM.first[setting]), live: 0 });
  let live = 0;
  for (const u of world.units.values()) if (isWorm(u)) live++;
  if (live < d.live) d.next = Math.max(d.next, world.time + span(world, WORM.again[setting]));   // one went: the next comes later
  d.live = live;
  if (live >= want || world.time < d.next) return;
  const spot = wormSpawnSpot(world);
  if (!spot) { d.next = world.time + 15; return; }
  spawnWorm(world, spot.x, spot.y);
  d.live = live + 1;
  d.next = world.time + span(world, WORM.again[setting]);
}

/** A tile on a large stretch of sand, clear of every base, unit and worm; null if there is none. */
export function wormSpawnSpot(world) {
  const map = world.map, n = map.w * map.h, lab = world.reach.labelsFor(MOVE.WORM);
  const size = new Map();
  for (let i = 0; i < n; i++) if (lab[i]) size.set(lab[i], (size.get(lab[i]) ?? 0) + 1);
  const near = new Uint8Array(n);
  const stamp = (cx, cy, r) => {
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(map.h - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(map.w - 1, Math.ceil(cx + r)); x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) near[y * map.w + x] = 1;
    }
  };
  for (const s of world.structures.values()) if (!s.type.isWall) stamp(s.x + s.w / 2, s.y + s.h / 2, WORM.clear.base + Math.max(s.w, s.h) / 2);
  for (const u of world.units.values()) {
    if (!u.isGround || u.inside) continue;
    stamp(u.x, u.y, isWorm(u) ? WORM.clear.worm : u.type.deploysTo ? WORM.clear.base : WORM.clear.unit);
  }
  const spots = [];
  for (let i = 0; i < n; i++) if (lab[i] && !near[i] && size.get(lab[i]) >= WORM.minSand && map.isSand(i)) spots.push(i);
  if (!spots.length) return null;
  const i = spots[world.wildRng.int(spots.length)];
  return { x: map.xOf(i), y: map.yOf(i) };
}
