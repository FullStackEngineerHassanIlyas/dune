// The shape of the nine campaign missions, shared by the three houses (phase 3, C1). Objectives, worms, map
// sizes and the number of enemy bases follow the Mega Drive campaign (research.md §6); base sizes, enemy credits
// and the reinforcement timing follow the PC scenario of the same mission (research.md §2 and appendix A), on
// the Mega Drive's one vehicle factory and without the House of IX. Units are named by role here and turned into
// each house's own (ROLES); the house files (atreides.js, ordos.js, harkonnen.js) add seeds, enemies, the start.
import { ORDOS_TROOPERS_AT } from '../sega-tech.js';

/** A role in a house's own units: one soldier, a squad, its light vehicle, ... The Emperor's troops have no
 *  special tank on their roster (houses.js SUB_HOUSE_UNITS), so theirs is the Siege Tank. */
export const ROLES = {
  atreides:  { inf1: 'soldier', inf3: 'infantry', light: 'trike', quad: 'quad', tank: 'combatTank', missile: 'missileTank', siege: 'siegeTank', special: 'sonicTank' },
  ordos:     { inf1: 'soldier', inf3: 'infantry', light: 'raider', quad: 'quad', tank: 'combatTank', missile: 'combatTank', siege: 'siegeTank', special: 'deviator' },
  harkonnen: { inf1: 'trooper', inf3: 'troopers', light: 'quad', quad: 'quad', tank: 'combatTank', missile: 'missileTank', siege: 'siegeTank', special: 'devastator' },
  sardaukar: { inf1: 'trooper', inf3: 'troopers', light: 'trike', quad: 'quad', tank: 'combatTank', missile: 'missileTank', siege: 'siegeTank', special: 'siegeTank' },
};

/** The PC reinforcement lists' "Launcher" slot: the Ordos get Troopers, then the Deviator, then a Siege Tank. */
export function launcher(house, n) {
  if (house !== 'ordos') return ROLES[house].missile;
  return n <= 6 ? 'troopers' : n <= 8 ? 'deviator' : 'siegeTank';
}

/** The infantry buildings of a computer base: 'inf' is the first, 'inf2' the second (dropped when there is none). */
export function infantryBuildings(house, n) {
  if (house === 'harkonnen') return ['wor'];
  if (house === 'sardaukar') return ['wor', 'barracks'];
  if (house === 'ordos' && n >= 4 && ORDOS_TROOPERS_AT === 'wor') return ['barracks', 'wor'];
  return ['barracks'];
}

const CY = 'constructionYard', WT = 'windtrap', REF = 'refinery', OUT = 'outpost', HF = 'heavyFactory', SILO = 'silo';
const guns = (n) => Array(n).fill('turret');
const mixed = (n) => Array.from({ length: n }, (_, k) => (k % 2 ? 'turret' : 'rocketTurret'));

/** Site arrangements before the per-mission symmetry (layout.js symmetry): the player, the bases, the M1 patrol posts. */
export const ARRANGEMENTS = {
  patrols: { player: { x: 8, y: 23, r: 6 }, posts: [{ x: 24, y: 7, r: 3 }, { x: 25, y: 21, r: 3 }, { x: 11, y: 7, r: 3 }] },
  one32: { player: { x: 8, y: 23, r: 6 }, bases: [{ x: 23, y: 8 }] },
  one: { player: { x: 13, y: 50, r: 8 }, bases: [{ x: 50, y: 13 }] },
  two: { player: { x: 32, y: 52, r: 8 }, bases: [{ x: 13, y: 13 }, { x: 51, y: 14 }] },
};

const DESTROY = { kind: 'destroy' };

/**
 * Per mission: map, worms, objective, the computer's settings and credits, and the base(s) it holds — `single`
 * for one base, `double` for two bases of one house, `pair` for one base each of two houses (the first gets the
 * Palace). A base: plateau radius, buildings in the order they are laid out, turrets, units by role, how many of
 * its light vehicles hunt from the start. Every base starts on full power (Wind Traps >= power use) and with fewer
 * armed units than its difficulty's army cap (sim/ai.js DIFFICULTY), so the computer builds from the first minute.
 * Mission 1 has no base, only patrols on three rock outposts.
 */
export const PLAN = {
  1: {
    size: 32, worms: 'off', objective: { kind: 'quota', quota: 1000 }, spiceFields: 3, blooms: 1, arrangement: 'patrols',
    credits: 0, ai: { difficulty: 'easy', passive: true },
    patrols: [{ units: ['inf1', 'inf1', 'inf3'], order: 'ambush' }, { units: ['light', 'inf1', 'inf3'], order: 'areaGuard' }, { units: ['inf1', 'inf1'], order: 'hunt' }],
  },
  2: {
    size: 32, worms: 'off', objective: { kind: 'quotaOrDestroy', quota: 2700 }, spiceFields: 3, blooms: 1, arrangement: 'one32',
    credits: 200, ai: { difficulty: 'easy', firstAttack: 420, attackEvery: 240, buildSpeed: 0.6, incomeRate: 0.8 },
    single: { r: 7, buildings: [CY, WT, REF, OUT, 'inf', SILO], turrets: [], units: { quad: 1, light: 2, inf3: 3, inf1: 3 }, hunt: 1 },
  },
  3: {
    size: 64, worms: 'few', objective: DESTROY, spiceFields: 9, blooms: 3, arrangement: 'one',
    credits: 300, ai: { difficulty: 'easy', firstAttack: 390, attackEvery: 220, buildSpeed: 0.7, incomeRate: 0.9 },
    single: { r: 9, buildings: [CY, WT, REF, OUT, 'inf', HF, WT, SILO, SILO], turrets: [], units: { quad: 3, light: 3, inf3: 3, inf1: 1 }, hunt: 2 },   // no tanks before the factory's mission-4 level; the PC's 15 units would sit above the easy AI's cap of 12 and stop it building
  },
  4: {
    size: 64, worms: 'few', objective: DESTROY, spiceFields: 9, blooms: 3, arrangement: 'one',
    credits: 450, ai: { difficulty: 'normal', firstAttack: 360, attackEvery: 200, buildSpeed: 0.8, incomeRate: 1 },
    single: { r: 10, buildings: [CY, WT, REF, OUT, 'inf', HF, WT, SILO, REF, WT, 'inf2'], turrets: [], units: { tank: 4, quad: 3, light: 3, inf3: 4, inf1: 2 }, hunt: 2 },
  },
  5: {
    size: 64, worms: 'few', objective: DESTROY, spiceFields: 9, blooms: 3,
    credits: 700, ai: { difficulty: 'normal', firstAttack: 330, attackEvery: 185, buildSpeed: 0.9, incomeRate: 1 },
    single: { r: 11, buildings: [CY, WT, REF, OUT, 'inf', HF, WT, 'hiTech', 'repair', REF, WT, SILO, SILO, WT, 'inf2'], turrets: guns(8), units: { missile: 2, tank: 4, quad: 3, light: 2, inf3: 3 }, hunt: 2 },
    double: [
      { r: 10, buildings: [CY, WT, REF, OUT, 'inf', HF, WT, SILO, 'inf2'], turrets: guns(4), units: { missile: 1, tank: 2, quad: 2, light: 1, inf3: 2 }, hunt: 1 },
      { r: 10, buildings: [CY, WT, REF, OUT, 'hiTech', 'repair', WT, SILO], turrets: guns(4), units: { missile: 1, tank: 2, quad: 1, light: 1, inf3: 2 }, hunt: 1 },
    ],
  },
  6: {
    size: 64, worms: 'few', objective: DESTROY, spiceFields: 9, blooms: 3,
    credits: 800, ai: { difficulty: 'normal', firstAttack: 300, attackEvery: 170, buildSpeed: 1, incomeRate: 1.1 },
    single: { r: 12, buildings: [CY, WT, REF, OUT, 'inf', HF, WT, 'hiTech', 'repair', REF, WT, SILO, SILO, WT, 'starport', CY, WT, SILO, 'inf2'], turrets: mixed(8), units: { siege: 2, missile: 2, tank: 5, quad: 3, light: 2, inf3: 4 }, hunt: 2 },
    double: [
      { r: 10, buildings: [CY, WT, REF, OUT, 'inf', HF, WT, SILO, WT, 'starport'], turrets: mixed(5), units: { siege: 1, missile: 1, tank: 3, quad: 2, light: 1, inf3: 2 }, hunt: 1 },
      { r: 10, buildings: [CY, WT, REF, OUT, 'hiTech', 'repair', WT, SILO, 'inf2'], turrets: mixed(5), units: { siege: 1, missile: 1, tank: 2, quad: 1, light: 1, inf3: 2 }, hunt: 1 },
    ],
  },
  7: {
    size: 64, worms: 'few', objective: DESTROY, spiceFields: 9, blooms: 3,
    credits: 1000, ai: { difficulty: 'hard', firstAttack: 270, attackEvery: 155, buildSpeed: 1.1, incomeRate: 1.2 },
    double: [
      { r: 11, buildings: [CY, WT, REF, OUT, 'inf', HF, WT, SILO, WT, 'starport', REF, 'inf2'], turrets: mixed(5), units: { special: 1, siege: 1, missile: 1, tank: 3, quad: 2, inf3: 2 }, hunt: 1 },
      { r: 10, buildings: [CY, WT, REF, OUT, 'hiTech', 'repair', WT, SILO, HF, WT], turrets: mixed(5), units: { special: 1, siege: 1, missile: 1, tank: 3, quad: 2, inf3: 2 }, hunt: 1 },
    ],
  },
  8: {
    size: 64, worms: 'few', objective: DESTROY, spiceFields: 9, blooms: 3,
    credits: 1000, ai: { difficulty: 'hard', firstAttack: 240, attackEvery: 140, buildSpeed: 1.2, incomeRate: 1.3 },
    pair: [
      { r: 11, buildings: [CY, WT, REF, OUT, 'inf', HF, WT, 'hiTech', 'repair', SILO, WT, 'starport', 'palace', REF, WT, WT], turrets: mixed(7), units: { special: 1, siege: 1, missile: 1, tank: 3, quad: 2, inf3: 2 }, hunt: 1 },
      { r: 11, buildings: [CY, WT, REF, OUT, 'inf', HF, WT, 'hiTech', 'repair', SILO, WT, 'starport', REF, WT, WT], turrets: mixed(7), units: { special: 1, siege: 1, missile: 1, tank: 3, quad: 2, inf3: 2 }, hunt: 1 },
    ],
  },
  9: {
    size: 64, worms: 'few', objective: DESTROY, spiceFields: 9, blooms: 3,
    credits: 3000, ai: { difficulty: 'hard', firstAttack: 210, attackEvery: 125, buildSpeed: 1.3, incomeRate: 1.5 },
    double: [
      { r: 11, buildings: [CY, WT, REF, OUT, 'inf', HF, WT, 'starport', 'palace', SILO, WT, SILO, WT, WT], turrets: mixed(8), units: { siege: 1, missile: 1, tank: 2, inf3: 2 }, hunt: 0 },
      { r: 11, buildings: [CY, WT, REF, OUT, 'inf', 'inf2', HF, 'hiTech', 'repair', WT, SILO, WT, WT], turrets: mixed(8), units: { siege: 1, missile: 1, tank: 2, inf3: 2 }, hunt: 0 },
    ],
  },
};

/** The player's reinforcements by Carryall to the home base (PC timing, minutes x 60): [seconds, roles]. */
export const OWN_REINFORCEMENTS = {
  3: [[360, ['light', 'inf3']], [660, ['inf3', 'inf3']]],
  4: [[720, ['tank', 'quad']], [1260, ['tank', 'tank']]],
  5: [[720, ['tank', 'quad']], [1260, ['tank', 'tank']]],
  6: [[780, ['tank', 'launcher']], [1260, ['siege', 'siege']]],
  7: [[780, ['tank', 'launcher']], [1260, ['special', 'siege']]],
  8: [[780, ['siege', 'launcher']], [1320, ['inf3', 'siege', 'special']]],
  9: [[780, ['special', 'launcher']], [1320, ['inf3', 'siege', 'special']]],
};

/** The computer's reinforcements (PC timing). `foe` picks the mission's enemy by index; `house` names one outright
 *  (the Emperor's Troopers in missions 4 and 8). 'enemy' is the receiver's foe: these land in the player's base. */
export const FOE_REINFORCEMENTS = {
  3: [{ at: 300, units: ['inf3', 'inf3'], via: 'carryall', to: 'enemy' }, { at: 600, units: ['inf3', 'inf3'], via: 'carryall', to: 'enemy' }, { at: 1200, units: ['inf3', 'inf3'], via: 'carryall', to: 'enemy' }],
  4: [{ at: 660, units: ['inf3', 'inf3'], via: 'carryall', to: 'enemy' }, { house: 'sardaukar', at: 1200, units: ['inf3', 'inf3', 'inf3', 'inf3'], via: 'carryall', to: 'enemy' }],
  5: [{ at: 660, units: ['inf3', 'inf3'], via: 'carryall', to: 'enemy' }, { at: 1200, units: ['quad', 'tank'], via: 'edge', to: 'enemy' }],
  6: [{ at: 720, units: ['inf3', 'inf3'], via: 'carryall', to: 'enemy' }, { at: 720, units: ['quad'], via: 'edge', to: 'enemy' }, { at: 1200, units: ['siege', 'inf3'], via: 'edge', to: 'home' }],
  7: [{ at: 720, units: ['tank', 'quad'], via: 'edge', to: 'enemy' }, { at: 1200, units: ['siege', 'special'], via: 'edge', to: 'enemy' }],
  8: [{ foe: 0, at: 720, units: ['tank', 'quad'], via: 'edge', to: 'enemy' }, { foe: 1, at: 840, units: ['tank', 'inf3'], via: 'edge', to: 'enemy' }, { foe: 0, at: 1260, units: ['siege', 'special'], via: 'edge', to: 'enemy' }, { house: 'sardaukar', at: 1800, units: ['inf3', 'inf3', 'inf3', 'inf3'], via: 'carryall', to: 'enemy' }],
  9: [{ at: 720, units: ['inf3', 'inf3'], via: 'carryall', to: 'enemy' }, { at: 840, units: ['inf3', 'inf3'], via: 'carryall', to: 'enemy' }, { at: 1200, units: ['tank', 'tank', 'siege'], via: 'edge', to: 'enemy' }, { at: 1800, units: ['inf3', 'inf3', 'inf3', 'inf3'], via: 'carryall', to: 'enemy' }],
};

/** The player's Starport stock from mission 6 (PC CHOAM counts for the Mega Drive's wares; sega-tech.js SEGA_STARPORT
 *  decides which a mission sells, the house roster which the house may buy). */
export const STARPORT_STOCK = {
  6: { trike: 5, quad: 5, combatTank: 4, missileTank: 3, harvester: 2, mcv: 2 },
  7: { trike: 5, quad: 5, combatTank: 5, missileTank: 4, siegeTank: 3, harvester: 2, mcv: 2 },
  8: { trike: 5, quad: 5, combatTank: 5, missileTank: 4, siegeTank: 4, ornithopter: 3, harvester: 2, mcv: 2 },
  9: { trike: 5, quad: 5, combatTank: 6, missileTank: 5, siegeTank: 6, ornithopter: 5, harvester: 4, mcv: 2 },
};
