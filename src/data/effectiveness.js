// Who beats whom (the tooltips' "Strong against" / "Weak against"), measured in the game itself rather than
// written by hand or worked out on paper. tests/effectiveness-fights.test.mjs plays every pair of fighting types
// against each other in the real World: equal money at two budgets (about 1000 and 2000 credits), four seeds, on
// rock and on sand, each house on either flank. The groups attack-move at each other, and whoever stands idle
// (arrived, or back from Deviator gas) is sent to just inside its range of the nearest enemy; turrets stand,
// powered, while the units come at them. A battle ends when one side is dead or after four minutes, and scores
// the share of its hit points the winner still has (a unit still turned by gas at the end is not its side's):
// +1 a walkover, 0 an even trade, -1 a rout. FOUGHT below is the mean of those battles, written by
//   UPDATE_EFFECTIVENESS=1 node --test tests/effectiveness-fights.test.mjs
// which the plain test run asks for once the numbers it was played with (FOUGHT_WITH) are no longer the game's.
// So everything the game does counts: overkill and scatter, range and speed, the Sonic wave hitting several at
// once, gassed units fighting their friends, death blasts in a packed group, turrets' power.
// Per target class the scores are averaged; a class at or above STRONG is listed as strong, at or below -STRONG as
// weak; single types at SPECIFIC or beyond are named on their own (up to three a side) when their class is not
// listed that way (the Rocket Turret is strong against tanks, and weak against the Missile Tank).
import { UNITS } from './units.js';
import { STRUCTURES } from './structures.js';

/** What the tooltips group targets into; turrets stand for buildings, the only ones that shoot back. */
export const TARGET_CLASSES = [
  { id: 'infantry', name: 'Infantry', types: ['soldier', 'infantry', 'trooper', 'troopers'] },
  { id: 'light', name: 'Light vehicles', types: ['trike', 'raider', 'quad'] },
  { id: 'tanks', name: 'Tanks', types: ['combatTank', 'siegeTank', 'missileTank', 'sonicTank', 'devastator', 'deviator'] },
  { id: 'aircraft', name: 'Aircraft', types: ['ornithopter'] },
  { id: 'defences', name: 'Turrets', types: ['turret', 'rocketTurret'] },
];

/** Every type that fights, in the table's order. */
export const ROSTER = TARGET_CLASSES.flatMap((k) => k.types);

export const STRONG = 0.3;
export const SPECIFIC = 0.6;     // a single type this one-sided is named on its own when its class is not listed, or listed the other way
const NAMED = 3;                 // at most this many named on each side
const SAME_AS = { fremen: 'troopers' };   // the Palace's Fremen fight as a Trooper Squad

// ---- FOUGHT: written by tests/effectiveness-fights.test.mjs (UPDATE_EFFECTIVENESS=1); do not edit by hand ----
export const FOUGHT_WITH = '7bd78bac';
export const FOUGHT = {
  soldier: { infantry: -0.58, trooper: -0.75, troopers: -0.79, trike: -0.91, raider: -0.9, quad: -0.92, combatTank: -0.95, siegeTank: -0.92, missileTank: -0.61, sonicTank: -0.99, devastator: -0.52, deviator: -0.92, ornithopter: -1, turret: -1, rocketTurret: -1 },
  infantry: { trooper: -0.45, troopers: -0.63, trike: -0.83, raider: -0.76, quad: -0.77, combatTank: -0.91, siegeTank: -0.93, missileTank: -0.99, sonicTank: -1, devastator: -0.63, deviator: -0.98, ornithopter: -1, turret: -1, rocketTurret: -1 },
  trooper: { troopers: -0.32, trike: -0.69, raider: -0.64, quad: -0.72, combatTank: -0.81, siegeTank: -0.78, missileTank: -0.77, sonicTank: -0.8, devastator: -0.64, deviator: -0.85, ornithopter: 0.78, turret: -0.86, rocketTurret: -0.89 },
  troopers: { trike: -0.52, raider: -0.42, quad: -0.66, combatTank: -0.7, siegeTank: -0.8, missileTank: -0.77, sonicTank: -0.76, devastator: -0.69, deviator: -0.89, ornithopter: 0.73, turret: -0.85, rocketTurret: -0.88 },
  trike: { raider: 0.26, quad: -0.2, combatTank: -0.41, siegeTank: -0.28, missileTank: 0.14, sonicTank: -0.3, devastator: 0.18, deviator: -0.78, ornithopter: -1, turret: -0.84, rocketTurret: -0.71 },
  raider: { quad: -0.36, combatTank: -0.48, siegeTank: -0.37, missileTank: -0.14, sonicTank: -0.31, devastator: -0.26, deviator: -0.73, ornithopter: -1, turret: -0.88, rocketTurret: -0.72 },
  quad: { combatTank: -0.16, siegeTank: 0.3, missileTank: -0.11, sonicTank: 0.05, devastator: 0.27, deviator: -0.7, ornithopter: -1, turret: -0.76, rocketTurret: -0.62 },
  combatTank: { siegeTank: 0.31, missileTank: 0.2, sonicTank: 0.48, devastator: 0.41, deviator: -0.41, ornithopter: -1, turret: -0.57, rocketTurret: -0.51 },
  siegeTank: { missileTank: -0.36, sonicTank: 0.54, devastator: 0.47, deviator: -0.25, ornithopter: -1, turret: -0.53, rocketTurret: -0.54 },
  missileTank: { sonicTank: 0.44, devastator: 0.86, deviator: 0.31, ornithopter: 0.78, turret: 0.9, rocketTurret: 0.74 },
  sonicTank: { devastator: 0.31, deviator: 0.29, ornithopter: -1, turret: 0.89, rocketTurret: -0.63 },
  devastator: { deviator: -0.24, ornithopter: -1, turret: -0.35, rocketTurret: -0.74 },
  deviator: { ornithopter: -1, turret: -1, rocketTurret: -1 },
  ornithopter: { turret: -0.93, rocketTurret: -0.91 },
};
// ---- end of FOUGHT ----

/** `aId` against `tId` at equal money, as the battles came out: +1 a walkover for `aId`, -1 for `tId`. */
export function fightScore(aId, tId) {
  const a = SAME_AS[aId] ?? aId, t = SAME_AS[tId] ?? tId;
  if (a === t) return 0;
  return FOUGHT[a]?.[t] ?? (FOUGHT[t]?.[a] !== undefined ? -FOUGHT[t][a] : 0);
}

const matchupCache = new Map();
/**
 * `typeId`'s standing against each target class: { scores: { classId: mean score }, strong: [names], weak: [names] },
 * or null for what does not fight (unarmed units, buildings without a gun, the Saboteur). The lists hold the classes
 * that reach STRONG and then, by name, up to three single types that reach SPECIFIC where their class is not listed
 * that way (the Sonic Tank is strong against the Gun Turret though not against turrets as a whole).
 */
export function matchups(typeId) {
  if (matchupCache.has(typeId)) return matchupCache.get(typeId);
  const id = SAME_AS[typeId] ?? typeId;
  let out = null;
  if (ROSTER.includes(id)) {
    const scores = {}, strong = [], weak = [], loners = [];
    for (const k of TARGET_CLASSES) {
      const each = k.types.filter((t) => t !== id && !(STRUCTURES[id] && STRUCTURES[t])).map((t) => [t, fightScore(id, t)]);   // two turrets never meet
      if (!each.length) continue;
      const s = each.reduce((n, [, v]) => n + v, 0) / each.length;
      scores[k.id] = s;
      if (s >= STRONG) strong.push(k.name);
      else if (s <= -STRONG) weak.push(k.name);
      loners.push(...each.filter(([, v]) => !(s >= STRONG && v > 0) && !(s <= -STRONG && v < 0)));   // the exceptions to a listed class too
    }
    const named = (sign) => loners.filter(([, v]) => v * sign >= SPECIFIC).sort((x, y) => (y[1] - x[1]) * sign).slice(0, NAMED).map(([t]) => (UNITS[t] ?? STRUCTURES[t]).name);
    out = { scores, strong: [...strong, ...named(1)], weak: [...weak, ...named(-1)] };
  }
  matchupCache.set(typeId, out);
  return out;
}

/** The whole table, attacker by target (tests, notes). */
export function effectivenessTable() {
  return Object.fromEntries(ROSTER.map((a) => [a, Object.fromEntries(ROSTER.map((t) => [t, fightScore(a, t)]))]));
}
