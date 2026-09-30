// The battle behind the main menu (menu backdrop spec): a fresh 64 × 40 map, two random houses with
// armies, scenery at their backs, reinforcements whenever a side runs low, one house special per loop
// and a hotspot where the shooting is, for the camera. Simulation only: it runs under Node, and the
// menu draws it through a BattleStage.
import { Rng } from '../core/rng.js';
import { GameMap } from '../sim/map.js';
import { World } from '../sim/world.js';
import { G } from '../data/terrain.js';
import { UNITS, MOVE } from '../data/units.js';
import { STRUCTURES } from '../data/structures.js';
import { DT } from '../data/tuning.js';
import { palaceOf } from '../sim/palace.js';

export const SHOWCASE = {
  w: 64, h: 40,
  lead: 8,                  // seconds simulated before the battle is shown
  army: [10, 14],           // fighters per side at the start
  reinforceEvery: 8,        // seconds between reinforcement checks …
  reinforceBelow: 10,       // … for a side with fewer fighters than this …
  reinforceCount: [3, 4],   // … which gets this many more
  reorderEvery: 4,          // idle fighters are sent at the enemy this often (seconds)
  hotspotWindow: 3,         // seconds of shooting the hotspot averages …
  hotspotLag: 2,            // … and the seconds it takes to follow
};
export const PLAYABLE = ['atreides', 'harkonnen', 'ordos'];
/** The army mix, [unit type, weight]; each house draws from what it can build. */
const ARMY = [['combatTank', 4], ['quad', 2], ['trike', 2], ['raider', 2], ['infantry', 2], ['troopers', 2], ['missileTank', 1], ['siegeTank', 1]];
/** What each house can bring as the loop's special. */
const SPECIALS = { atreides: ['sonic', 'ornithopters'], harkonnen: ['devastator', 'deathHand'], ordos: ['deviator', 'ornithopters'] };
// The west side's layout; the east side mirrors it.
const BASE = [['constructionYard', 2, 18], ['windtrap', 2, 14], ['turret', 9, 19], ['wall', 9, 17], ['wall', 9, 18], ['wall', 9, 20], ['wall', 9, 21]];
const PALACE_AT = [2, 23];
const ARMY_BOX = { x: 16, w: 7, y: 12, h: 17 };   // where the west army stands at the start
const ARRIVE_X = 12;                               // reinforcements appear in this column
const HOME = { x: 3, y: 19 };                      // the heart of the west base

const W = SHOWCASE.w, H = SHOWCASE.h;
/** Column `x` of the west layout (for a thing `w` tiles wide) on side `s` (0 west, 1 east). */
const mirror = (s, x, w = 1) => (s === 0 ? x : W - x - w);

/** Smooth noise 0..1: a random grid every `cell` tiles, eased between the knots. */
function grid(rng, cell) {
  const cols = Math.ceil(W / cell) + 2, rows = Math.ceil(H / cell) + 2;
  const v = Array.from({ length: cols * rows }, () => rng.next());
  const ease = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / cell, gy = y / cell, ix = Math.floor(gx), iy = Math.floor(gy), fx = ease(gx - ix), fy = ease(gy - iy);
    const at = (i, j) => v[j * cols + i];
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx;
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
    return a + (b - a) * fy;
  };
}

/** Rock plateaus for the two bases, sand and dunes between with a few outcrops, peaks only off the middle lane, two spice fields. */
export function showcaseMap(rng) {
  const map = new GameMap(W, H);
  const wobble = grid(rng, 6), dunes = grid(rng, 5), rocks = grid(rng, 7);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = 11 + Math.round(wobble(x, y) * 2);
    const r = rocks(x, y);
    let g = G.SAND;
    if (x <= edge || x >= W - 1 - edge) g = G.ROCK;
    else if (r > 0.72) g = (y < 8 || y > H - 9) && r > 0.82 ? G.MOUNTAIN : G.ROCK;
    else if (dunes(x, y) > 0.58) g = G.DUNE;
    map.ground[map.idx(x, y)] = g;
  }
  for (const cy of [5, H - 6]) {
    const cx = 22 + rng.int(21);
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 4; x <= cx + 4; x++) {
      if (!map.inBounds(x, y) || Math.hypot((x - cx) / 4, (y - cy) / 3) > 1) continue;
      const i = map.idx(x, y);
      if (map.ground[i] === G.SAND || map.ground[i] === G.DUNE) map.setSpice(i, 250 + rng.int(400));
    }
  }
  return map;
}

export class ShowcaseDirector {
  constructor({ seed = 1 } = {}) {
    this.seed = seed;
    const rng = (this.rng = new Rng(seed));
    this.houses = rng.shuffle([...PLAYABLE]).slice(0, 2);   // [west, east]
    const map = showcaseMap(rng);
    map.seed = seed;
    const world = (this.world = new World({ map, seed }));
    world.fogOfWar = false;
    for (const h of this.houses) world.addHouse(h, { credits: 0 });
    this.special = rng.pick([...new Set(this.houses.flatMap((h) => SPECIALS[h]))]);
    this.specialSide = this.houses.findIndex((h) => SPECIALS[h].includes(this.special));
    this.specialSeen = false;
    this.pending = null;            // the special's timed step: { at, when?, run }
    this.center = { x: W / 2, z: H / 2 };
    this.hotspot = { ...this.center };
    this.shots = [];
    this.reinforced = 0;
    this.nextReinforce = SHOWCASE.reinforceEvery;
    this.nextReorder = SHOWCASE.reorderEvery;
    for (const s of [0, 1]) this.buildBase(s);
    const n = SHOWCASE.army[0] + rng.int(SHOWCASE.army[1] - SHOWCASE.army[0] + 1);
    for (const s of [0, 1]) for (let k = 0; k < n; k++) {
      this.spawn(this.pickUnit(this.houses[s]), s, mirror(s, ARMY_BOX.x + rng.int(ARMY_BOX.w)), ARMY_BOX.y + rng.int(ARMY_BOX.h));
    }
    this.prepareSpecial();
    for (const s of [0, 1]) this.charge(s, this.fighters(s), this.enemyHome(s));
  }

  buildBase(s) {
    const house = this.houses[s];
    for (const [id, x, y] of BASE) {
      const typeId = id === 'turret' && house === 'harkonnen' ? 'rocketTurret' : id;
      this.world.spawnStructure(typeId, house, mirror(s, x, STRUCTURES[typeId].w), y);
    }
    if (this.special === 'deathHand' && s === this.specialSide) this.world.spawnStructure('palace', house, mirror(s, PALACE_AT[0], 3), PALACE_AT[1]);
  }

  pickUnit(house) {
    const pool = ARMY.filter(([t]) => UNITS[t].houses.includes(house));
    let r = this.rng.next() * pool.reduce((sum, [, w]) => sum + w, 0);
    for (const [t, w] of pool) if ((r -= w) < 0) return t;
    return pool[0][0];
  }

  /** A unit of side `s` on the nearest free tile it can stand on near x, y (aircraft right there). */
  spawn(typeId, s, x, y) {
    const opts = { heading: s === 0 ? 0 : Math.PI };
    if (UNITS[typeId].move === MOVE.AIR) return this.world.spawnUnit(typeId, this.houses[s], x, y, opts);
    const at = this.freeTile(x, y, UNITS[typeId].move);
    return at ? this.world.spawnUnit(typeId, this.houses[s], at.x, at.y, opts) : null;
  }

  freeTile(x, y, move) {
    const map = this.world.map;
    for (let r = 0; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !map.inBounds(x + dx, y + dy)) continue;
      const i = map.idx(x + dx, y + dy);
      if (!map.unit[i] && !map.structure[i] && map.moveFactor(i, move) > 0) return { x: x + dx, y: y + dy };
    }
    return null;
  }

  /** Side s's armed ground units. */
  fighters(s) {
    const house = this.houses[s];
    return [...this.world.units.values()].filter((u) => u.house === house && u.isGround && !u.inside && u.type.weapon);
  }

  enemyHome(s) { return { x: mirror(1 - s, HOME.x), y: HOME.y }; }

  /** Where side s's enemies are: the middle of their army, or their base once the army is gone. */
  enemyFocus(s) {
    const foes = this.fighters(1 - s);
    if (!foes.length) return this.enemyHome(s);
    return { x: Math.round(foes.reduce((a, u) => a + u.x, 0) / foes.length), y: Math.round(foes.reduce((a, u) => a + u.y, 0) / foes.length) };
  }

  charge(s, units, goal) {
    if (units.length) this.world.issue(this.houses[s], { type: 'attackMove', ids: units.map((u) => u.id), x: goal.x, y: goal.y });
  }

  /** The loop's special: units that join the army now, or a step timed into the battle. */
  prepareSpecial() {
    const s = this.specialSide, house = this.houses[s], w = this.world, lead = SHOWCASE.lead;
    const col = (x) => mirror(s, x);
    switch (this.special) {
      case 'sonic':
        this.spawn('sonicTank', s, col(15), 16);
        this.spawn('sonicTank', s, col(15), 24);
        break;
      case 'deviator':
        this.spawn('deviator', s, col(15), 20);
        break;
      case 'devastator': {
        const dev = this.spawn('devastator', s, col(16), 20);
        // it goes off once badly hurt in view, or when the battle is well under way
        this.pending = dev && {
          at: lead + 20,
          when: () => w.time >= lead && w.units.has(dev.id) && dev.hp < dev.maxHp / 2,
          run: () => { if (w.units.has(dev.id)) w.issue(house, { type: 'destruct', ids: [dev.id] }); },
        };
        break;
      }
      case 'deathHand':
        this.pending = {
          at: lead + 14,
          run: () => {
            const palace = palaceOf(w, house);
            if (!palace) return;
            palace.readyAt = w.time;   // charged for the show
            const f = this.enemyFocus(s);
            w.issue(house, { type: 'palace', x: f.x, y: f.y });
          },
        };
        break;
      case 'ornithopters':
        this.pending = { at: lead + 6, run: () => { for (const y of [15, 20, 25]) this.spawn('ornithopter', s, col(1), y); } };
        break;
    }
  }

  /** One simulation tick plus the director's own timing. */
  step() {
    const w = this.world;
    w.step();
    if (w.time >= this.nextReinforce) { this.nextReinforce += SHOWCASE.reinforceEvery; for (const s of [0, 1]) this.reinforce(s); }
    if (w.time >= this.nextReorder) { this.nextReorder += SHOWCASE.reorderEvery; for (const s of [0, 1]) this.reorder(s); }
    const p = this.pending;
    if (p && (w.time >= p.at || p.when?.())) { this.pending = null; p.run(); }
    this.updateHotspot();
  }

  reinforce(s) {
    if (this.fighters(s).length >= SHOWCASE.reinforceBelow) return;
    const [a, b] = SHOWCASE.reinforceCount, n = a + this.rng.int(b - a + 1), fresh = [];
    for (let k = 0; k < n; k++) {
      const u = this.spawn(this.pickUnit(this.houses[s]), s, mirror(s, ARRIVE_X), 13 + this.rng.int(15));
      if (u) fresh.push(u);
    }
    this.reinforced += fresh.length;
    this.charge(s, fresh, this.enemyFocus(s));
  }

  reorder(s) {
    this.charge(s, this.fighters(s).filter((u) => u.order.type === 'idle'), this.enemyFocus(s));
  }

  /** Every drained event passes through here: shots for the hotspot, and whether the special has happened. */
  onEvent(e) {
    if (e.type === 'fired') this.shots.push({ x: e.x, z: e.y, t: this.world.time });
    if (!this.specialSeen) this.specialSeen = this.isSpecial(e);
  }

  isSpecial(e) {
    switch (this.special) {
      case 'sonic': return e.type === 'fired' && e.projectile === 'sonic';
      case 'deviator': return e.type === 'fired' && e.projectile === 'gas';
      case 'devastator': return e.type === 'unitDestroyed' && e.cause === 'destructed';
      case 'deathHand': return e.type === 'palaceFired';
      case 'ornithopters': return e.type === 'fired' && this.world.units.get(e.id)?.typeId === 'ornithopter';
      default: return false;
    }
  }

  updateHotspot() {
    const now = this.world.time;
    while (this.shots.length && this.shots[0].t < now - SHOWCASE.hotspotWindow) this.shots.shift();
    let goal = this.center;
    if (this.shots.length) {
      let x = 0, z = 0;
      for (const s of this.shots) { x += s.x; z += s.z; }
      goal = { x: x / this.shots.length, z: z / this.shots.length };
    }
    const k = 1 - Math.exp(-DT / SHOWCASE.hotspotLag);
    this.hotspot.x += (goal.x - this.hotspot.x) * k;
    this.hotspot.z += (goal.z - this.hotspot.z) * k;
  }

  /** Runs `seconds` of battle, handing every event to the director and then to `onEvent` (the stage). */
  run(seconds, onEvent = null) {
    for (let i = 0, n = Math.round(seconds / DT); i < n; i++) {
      this.step();
      for (const e of this.world.events.drain()) { this.onEvent(e); onEvent?.(e); }
    }
  }
}
