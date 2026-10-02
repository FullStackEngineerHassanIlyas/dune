// What the soundtrack should be playing in a battle (spec §6 Music; research audio-ui-controls.md §A.2, from
// OpenDUNE's game loop): peace tracks while the player builds; a battle track when fighting starts near the player's
// forces — as in the original, an enemy unit (or a sandworm) coming into the player's sight close to their base or
// their units counts, once per unit (the original's "seen by" flag), and so does any shot the player's forces fire
// or take — and peace again after a calm spell; silence when the battle is decided (the original stops the music
// there), then victory or defeat on the result screen (silence after a draw). Times are the battle's own seconds
// (world.time), so a paused game holds every timer. Pure: no Web Audio.
import { unitVisibleTo } from '../../sim/fog.js';

export const CALM = 25;          // seconds without fighting near the player before the music goes back to peace
export const MIN_BATTLE = 30;    // a battle track keeps going at least this long
export const LOOK_EVERY = 1;     // seconds between two looks for enemies near the player's forces
export const NEAR_BASE = 12;     // tiles from one of the player's buildings (the announcer's "approaching" distance)
export const NEAR_UNIT = 8;      // tiles from one of the player's units
const HARMLESS = new Set(['carryall', 'frigate']);   // flying freight is not an attack

/** The enemies (and sandworms) the player can see near one of their buildings or units, into `out`. */
export function threatsNear(world, house, out = []) {
  out.length = 0;
  const bases = [], units = [];
  for (const s of world.structures.values()) if (s.house === house) bases.push(s);
  for (const u of world.units.values()) if (u.house === house && !u.inside) units.push(u);
  if (!bases.length && !units.length) return out;
  for (const e of world.units.values()) {
    if (e.house === house || e.inside || HARMLESS.has(e.typeId) || !unitVisibleTo(world, house, e)) continue;
    if (near(e, bases, units)) out.push(e);
  }
  return out;
}

function near(e, bases, units) {
  for (const s of bases) {
    const dx = Math.max(s.x - e.x, 0, e.x - (s.x + s.w)), dy = Math.max(s.y - e.y, 0, e.y - (s.y + s.h));
    if (dx * dx + dy * dy <= NEAR_BASE * NEAR_BASE) return true;
  }
  for (const u of units) if ((u.x - e.x) ** 2 + (u.y - e.y) ** 2 <= NEAR_UNIT * NEAR_UNIT) return true;
  return false;
}

/** Is any enemy (or sandworm) in the player's sight near one of their buildings or units? */
export const threatNear = (world, house) => threatsNear(world, house).length > 0;

/** The mood a battle's music is in: 'peace', 'battle', 'over' (decided, silent), 'victory' or 'defeat'. */
export class MusicDirector {
  constructor({ house, calm = CALM, minBattle = MIN_BATTLE } = {}) {
    this.house = house;
    this.calm = calm;
    this.minBattle = minBattle;
    this.mood = 'peace';
    this.lastFight = -Infinity;
    this.battleSince = 0;
    this.seen = new Set();   // ids of the enemies that have come near already (unit ids are never reused)
  }

  /** Fighting near the player's forces, now. */
  fight(now) {
    this.lastFight = now;
    if (this.mood === 'peace') { this.mood = 'battle'; this.battleSince = now; }
  }

  /**
   * The enemies near the player's forces at one look: each starts a fight the first time it comes near, and only
   * then — one that just stays there (a harvester at work, a parked squad) keeps nothing going; shots do that.
   */
  sight(enemies, now) {
    for (const e of enemies) if (!this.seen.has(e.id)) { this.seen.add(e.id); this.fight(now); }
  }

  onEvent(e, now) {
    const h = this.house;
    if (e.type === 'gameOver') { if (this.mood === 'peace' || this.mood === 'battle') this.mood = 'over'; return; }
    if (e.type === 'fired') { if (e.house === h) this.fight(now); }
    else if (e.type === 'damaged' || e.type === 'unitDestroyed' || e.type === 'structureDestroyed') {
      if (e.house === h && e.by && e.by !== h) this.fight(now);
    }
  }

  update(now) {
    if (this.mood === 'battle' && now - this.lastFight >= this.calm && now - this.battleSince >= this.minBattle) this.mood = 'peace';
    return this.mood;
  }

  /** The result screen: the battle won or lost; a draw stays silent. */
  end(won, draw = false) { this.mood = draw ? 'over' : won ? 'victory' : 'defeat'; }
}

/** Random picks from a pool that never play the same track twice running while there is another. */
export class Shuffle {
  constructor(rng = Math.random) { this.rng = rng; this.last = new Map(); }

  pick(name, pool) {
    if (!pool.length) return null;
    const last = this.last.get(name), choices = pool.length > 1 ? pool.filter((x) => x !== last) : pool;
    const p = choices[Math.min(choices.length - 1, Math.floor(this.rng() * choices.length))];
    this.last.set(name, p);
    return p;
  }
}
