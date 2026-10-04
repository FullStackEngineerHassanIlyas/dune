// Who beats whom (the tooltips' "Strong against" / "Weak against"), worked out from the game's own numbers rather
// than written by hand. Each pair fights an equal-money battle on paper:
//  - a shot does its damage in full and no more: a 75-point rocket on a 20-point soldier wastes 55 (overkill), so
//    a target takes ceil(hp / damage) hits; a unit that fires twice does so only above half health (sim/combat.js),
//    counted as one and a half shots a volley;
//  - guns and shells always hit; rockets scatter as combat.js throws them (SCATTER) and hit what is on the tile they
//    land on — a building's whole footprint, a unit's one tile; at aircraft they hit half the time (AIR.hitChance);
//    the Sonic Tank's wave fades along its range and never hurts another Sonic Tank; Deviator gas does no harm but
//    takes the unit it lands on (and none of DEVIATOR.immune, nor aircraft) off the other side;
//  - only anti-air weapons reach aircraft, and the Ornithopter never goes after aircraft;
//  - the side with the longer range fires alone while the other closes the gap at its own speed (the mean of sand
//    and rock); a turret cannot close it, so whatever outranges a turret destroys it unanswered;
//  - tracked vehicles run infantry down (sim/movement.js): one every CRUSH_TILES of driving, on top of their gun.
// The fight itself follows Lanchester's square law (every unit in range fires at once), so the score is how much of
// the winner's money is still standing: +1 a walkover, 0 an even trade, -1 a rout. Per target class the scores are
// averaged; a class at or above STRONG is listed as strong, at or below -STRONG as weak.
import { UNITS, MOVE, onFoot } from './units.js';
import { STRUCTURES } from './structures.js';
import { shotFor } from './weapons.js';
import { SURFACE, moveFactor } from './terrain.js';
import { groundSpeed, airSpeed, fireDelaySeconds, SCATTER, AIR, SONIC, DEVIATOR } from './tuning.js';

/** What the tooltips group targets into; turrets stand for buildings, the only ones that shoot back. */
export const TARGET_CLASSES = [
  { id: 'infantry', name: 'Infantry', types: ['soldier', 'infantry', 'trooper', 'troopers'] },
  { id: 'light', name: 'Light vehicles', types: ['trike', 'raider', 'quad'] },
  { id: 'tanks', name: 'Tanks', types: ['combatTank', 'siegeTank', 'missileTank', 'sonicTank', 'devastator', 'deviator'] },
  { id: 'aircraft', name: 'Aircraft', types: ['ornithopter'] },
  { id: 'defences', name: 'Turrets', types: ['turret', 'rocketTurret'] },
];

export const STRONG = 0.3;
export const SPECIFIC = 0.6;     // a single type this one-sided is named on its own when its class is not listed
export const CRUSH_TILES = 2;    // a tank reaches and runs over one soldier for every two tiles it drives
const SHOTS_FIRE_TWICE = 1.5;   // the second shot only above half health
const COST_AS = { fremen: 'troopers' };   // the Palace's Fremen fight as a Trooper Squad: priced like one
const GAS_IMMUNE = new Set(DEVIATOR.immune);

const speedOf = (t) => {
  if (t.move === MOVE.AIR) return airSpeed(t.speed);
  const on = (s) => groundSpeed(t.speed, moveFactor(s, t.move), t.move);
  return (on(SURFACE.SAND) + on(SURFACE.ROCK)) / 2;
};

const cache = new Map();
/** A unit's or turret's fighting numbers, or null for what cannot fight or be fought here. */
export function combatant(typeId) {
  if (cache.has(typeId)) return cache.get(typeId);
  const u = UNITS[typeId], s = !u && STRUCTURES[typeId];
  let c = null;
  if (u && u.move !== MOVE.WORM && !u.untargetable) {
    c = {
      typeId, hp: u.hp, cost: u.cost || UNITS[COST_AS[typeId]]?.cost || 0, air: u.move === MOVE.AIR, foot: onFoot(u.move), tracked: u.move === MOVE.TRACKED,
      mobile: true, speed: speedOf(u), w: 1, h: 1, weapon: u.weapon, damage: u.damage ?? 0, range: u.range ?? 0, fireDelay: u.fireDelay ?? 0,
      firesTwice: !!u.firesTwice, antiAir: !!u.targetAir, near: null, deviatable: u.move !== MOVE.AIR && !GAS_IMMUNE.has(typeId),
    };
  } else if (s) {
    c = {
      typeId, hp: s.hp, cost: s.cost, air: false, foot: false, tracked: false, mobile: false, speed: 0, w: s.w, h: s.h, weapon: s.weapon ?? null,
      damage: s.damage ?? 0, range: s.range ?? 0, fireDelay: s.fireDelay ?? 0, firesTwice: false, antiAir: !!s.targetAir, near: s.near ?? null, deviatable: false,
    };
  }
  if (c) c.armed = !!c.weapon && c.weapon !== 'swallow' && (c.damage > 0 || shotFor(c.weapon, 1)?.gas);
  cache.set(typeId, c);
  return c;
}

/** Chance that a shot thrown up to R tiles off (uniform distance, any direction) lands inside a w x h footprint. */
function landsWithin(R, w, h) {
  if (R <= Math.min(w, h) / 2) return 1;
  const N = 64, M = 64;
  let inside = 0;
  for (let i = 0; i < N; i++) {
    const r = (R * (i + 0.5)) / N;
    for (let j = 0; j < M; j++) {
      const a = (Math.PI / 2) * ((j + 0.5) / M);   // one quadrant: the footprint is symmetric
      if (r * Math.cos(a) <= w / 2 && r * Math.sin(a) <= h / 2) inside++;
    }
  }
  return inside / (N * M);
}

/** combat.js: a rocket at `dist` tiles lands base + perTile x dist off (1 in 16 wildly further). */
export function rocketHitChance(dist, w = 1, h = 1) {
  const near = landsWithin(SCATTER.base + dist * SCATTER.perTile, w, h), wild = landsWithin(SCATTER.wildBase + dist * SCATTER.wildPerTile, w, h);
  return (1 - SCATTER.wildChance) * near + SCATTER.wildChance * wild;
}

/** specials.js: gas takes what stands within DEVIATOR.radius of where it bursts. */
function gasHitChance(dist) {
  const reach = (R) => Math.min(1, DEVIATOR.radius / R);
  return (1 - SCATTER.wildChance) * reach(SCATTER.base + dist * SCATTER.perTile) + SCATTER.wildChance * reach(SCATTER.wildBase + dist * SCATTER.wildPerTile);
}

/** Can `a` shoot at `t` at all? */
export function canHit(a, t) {
  if (!a?.armed || !t) return false;
  if (t.air) return a.antiAir;
  const gas = shotFor(a.weapon, 1)?.gas;
  if (gas) return t.deviatable;   // gas is never thrown at buildings or the immune (combat.js)
  if (a.weapon === 'sonic' && t.typeId === 'sonicTank') return false;
  return true;
}

/** Hit points per second `a` takes off `t` from `dist` tiles, after overkill and misses (gas: hit points turned). */
export function dpsAgainst(a, t, dist) {
  if (!canHit(a, t)) return 0;
  const stats = a.near && dist <= a.near.range ? a.near : a;
  const shot = shotFor(stats.weapon, dist), delay = fireDelaySeconds(stats.fireDelay);
  if (shot.gas) return (gasHitChance(dist) * t.hp) / delay;
  const dmg = shot.wave ? Math.round(stats.damage * (1 - (SONIC.fade * Math.min(dist, stats.range)) / stats.range)) : Math.round(stats.damage * shot.damageScale);
  if (!(dmg > 0)) return 0;
  const p = t.air ? (shot.accurate ? 1 : AIR.hitChance) : shot.accurate ? 1 : rocketHitChance(dist, t.w, t.h);
  const k = Math.ceil(t.hp / dmg), shots = stats.firesTwice ? SHOTS_FIRE_TWICE : 1;
  return (p * t.hp * shots) / (k * delay);
}

const crushes = (a, t) => a.tracked && t.foot;

/**
 * An equal-money fight of `aId` against `tId`: +1 a walkover for `a`, -1 for `t`, between them the share of the
 * winner's money left standing (signed). 0 when neither can touch the other.
 */
export function fightScore(aId, tId) {
  const a = combatant(aId), t = combatant(tId);
  if (!a || !t || !(a.cost > 0) || !(t.cost > 0) || (!a.mobile && !t.mobile)) return 0;   // two turrets never meet
  const aCan = canHit(a, t) || (crushes(a, t) && a.armed), tCan = canHit(t, a) || (crushes(t, a) && t.armed);
  if (!aCan && !tCan) return 0;
  if (!tCan) return 1;
  if (!aCan) return -1;
  const rA = canHit(a, t) ? a.range : 1, rT = canHit(t, a) ? t.range : 1;   // a tank with nothing to shoot still runs soldiers down
  let nA = 1 / a.cost, nT = 1 / t.cost;
  const nA0 = nA, nT0 = nT;
  if (rA !== rT) {   // the shorter reach closes the gap under fire
    const aLong = rA > rT, closer = aLong ? t : a;
    if (!closer.mobile) return aLong ? 1 : -1;
    const seconds = Math.abs(rA - rT) / closer.speed;
    if (aLong) nT -= (dpsAgainst(a, t, rA) * nA * seconds) / t.hp;
    else nA -= (dpsAgainst(t, a, rT) * nT * seconds) / a.hp;
    if (nT <= 0) return 1;
    if (nA <= 0) return -1;
  }
  const d = Math.min(rA, rT);
  const alpha = (dpsAgainst(a, t, d) + (crushes(a, t) ? (t.hp * a.speed) / CRUSH_TILES : 0)) / t.hp;   // t units lost per a unit per second
  const beta = (dpsAgainst(t, a, d) + (crushes(t, a) ? (a.hp * t.speed) / CRUSH_TILES : 0)) / a.hp;
  const aSide = alpha * nA * nA, tSide = beta * nT * nT;   // Lanchester's square law
  if (aSide === tSide) return 0;
  return aSide > tSide ? Math.sqrt(1 - tSide / aSide) * (nA / nA0) : -Math.sqrt(1 - aSide / tSide) * (nT / nT0);
}

const fightsBack = (id) => { const c = combatant(id); return !!c && c.armed && c.cost > 0; };

const matchupCache = new Map();
/**
 * `typeId`'s standing against each target class: { scores: { classId: mean score }, strong: [names], weak: [names] },
 * or null for what does not fight (unarmed units, buildings without a gun, the Saboteur). The lists hold the classes
 * that reach STRONG and then, by name, up to two single types that reach SPECIFIC in a class not listed (the
 * Ornithopter is weak against Troopers though not against infantry as a whole).
 */
export function matchups(typeId) {
  if (matchupCache.has(typeId)) return matchupCache.get(typeId);
  let out = null;
  if (fightsBack(typeId) && typeId !== 'saboteur') {
    const scores = {}, strong = [], weak = [], loners = [];
    for (const k of TARGET_CLASSES) {
      const each = k.types.filter((id) => id !== typeId).map((id) => [id, fightScore(typeId, id)]).filter(([, v]) => v !== 0);
      if (!each.length) continue;   // turrets against turrets
      const s = each.reduce((n, [, v]) => n + v, 0) / each.length;
      scores[k.id] = s;
      if (s >= STRONG) strong.push(k.name);
      else if (s <= -STRONG) weak.push(k.name);
      else loners.push(...each);
    }
    const named = (sign) => loners.filter(([, v]) => v * sign >= SPECIFIC).sort((x, y) => (y[1] - x[1]) * sign).slice(0, 2).map(([id]) => (UNITS[id] ?? STRUCTURES[id]).name);
    out = { scores, strong: [...strong, ...named(1)], weak: [...weak, ...named(-1)] };
  }
  matchupCache.set(typeId, out);
  return out;
}

/** The whole table, attacker by target (tests, notes). */
export function effectivenessTable() {
  const ids = [...new Set(TARGET_CLASSES.flatMap((k) => k.types))];
  return Object.fromEntries(ids.map((a) => [a, Object.fromEntries(ids.map((t) => [t, fightScore(a, t)]))]));
}
