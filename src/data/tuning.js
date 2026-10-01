// Every conversion from original Dune II numbers to real time and tiles (spec §4.1). Tune here only.
// Pacing choices and their before/after numbers: docs/superpowers/notes/2026-10-01-pacing.md.
import { onFoot } from './units.js';

export const SIM_HZ = 20;
export const DT = 1 / SIM_HZ;
export const TERRAIN_REF = 192;

/** A ground unit covers `(base + factor / 24) × terrain / 192` tiles per second. The base lifts the slow
 *  original factors (infantry 5–15 against a tank's 25) so nobody crawls, yet keeps the original order
 *  within each class. Foot soldiers get the larger base: at the vehicles' 0.25 an Infantry Squad took 37 s
 *  over ten tiles of sand and could never keep up with a battle; at 0.6 it takes 21 s, and a Combat Tank
 *  still outruns every foot soldier but the Saboteur on any ground they share (a base above 0.66 would not). */
export const SPEED_BASE = { vehicle: 0.25, foot: 0.6 };

/** Tiles per second for a ground unit with original speed factor on terrain value 0..255. */
export function groundSpeed(factor, terrain, move) { return (((onFoot(move) ? SPEED_BASE.foot : SPEED_BASE.vehicle) + factor / 24) * terrain) / TERRAIN_REF; }
/** Tiles per second for aircraft. */
export function airSpeed(factor) { return factor / 40; }
export function fireDelaySeconds(fireDelay) { return fireDelay / 40; }

/** Seconds for an item of `buildTime` original steps (spec §4.1): units, and structures of the Hi-Tech tier and up. */
export function buildSeconds(buildTime) { return buildTime * 0.45; }

/** Structures: the original's steps make small things slow (a 5-credit slab 7 s, one wall segment 18 s,
 *  a Wind Trap 22 s) against C&C's habit of near-instant cheap items. Below the Hi-Tech tier (`knee`
 *  steps: Hi-Tech Factory, Starport, House of IX) a structure's time shrinks in proportion to its size,
 *  `steps × 0.45 × steps / knee`, so the time grows with the square of the original number: a Wind Trap
 *  builds in 9 s, a wall segment in 6 s, a Gun Turret in 15 s, a Refinery in 24 s. The order of the
 *  original table is kept exactly (more steps never builds quicker) and the late-game buildings keep
 *  their original pace. Nothing builds in under `min` seconds, so the sweep and the EVA call still read. */
export const STRUCTURE_BUILD = { knee: 120, min: 2 };
export function structureSeconds(buildTime) {
  return Math.max(STRUCTURE_BUILD.min, buildSeconds(buildTime) * Math.min(1, buildTime / STRUCTURE_BUILD.knee));
}

/** A factory upgrade: 20 original steps (a countdown of 100 in steps of 5), which put it between a slab
 *  (16) and a wall (40). It keeps that place on the new curve, and it starts at once, setting aside the
 *  item in hand (src/sim/production.js), instead of waiting its turn behind it. */
export const UPGRADE_SECONDS = 5;

export function unitSight(radius) { return radius + 1; }

/** Radians per second by original turning class (1 = heavy tracked … 3 = infantry). */
export const TURN_RATE = [0, 2.6, 4.8, 10];
/** How far off its heading (radians) a unit may start driving; beyond it, it turns on the spot first. */
export const DRIVE_ANGLE = { foot: Math.PI, tracked: 0.5, harvester: 0.5, wheeled: 1.1, air: Math.PI, worm: Math.PI, saboteur: Math.PI };
export const GAME_SPEED = { slowest: 0.5, slow: 0.75, normal: 1, fast: 1.25, fastest: 1.5 };

/** Turret traverse (radians per second) when swinging back in line with the hull. */
export const TURRET_TURN_RATE = 3.5;

export const STUCK_REPATH_SECONDS = 1.5;
export const STUCK_GIVEUP_SECONDS = 5;

export const SPICE_PER_TILE = 250;
export const THICK_SPICE_PER_TILE = 750;

/** Projectile speed (original units) → tiles per second: bullets and shells ≈ 16, rockets 11–12.5. */
export function projectileSpeed(speed) { return speed / 16; }
export const SECOND_SHOT_DELAY = 0.35;          // seconds between the two shots of units that fire twice
export const SCATTER = { base: 0.4, perTile: 0.12, wildChance: 1 / 16, wildBase: 1.5, wildPerTile: 0.35 };   // rocket miss radius, tiles
export const DEATH_SPLASH = { damage: 30, radius: 1.6 };   // Trikes, Missile Tanks, Harvesters and MCVs blow up
export const AIM_TOLERANCE = 0.12;              // radians: close enough to fire
export const GUARD_RADIUS = 3;                  // idle and guarding units look this far beyond weapon range …
export const GUARD_LEASH = 6;                   // … and a guard chases at most this far from its post
export const RETALIATE_RANGE = 8;               // idle units answer fire from this close
export const LOW_POWER_TURRET_RATE = 0.5;       // turrets fire at half rate on low power (spec §4.4)
export const CHASE_GIVEUP_SECONDS = 8;          // an attacker that gets no closer for this long gives up

export const UNIT_REPAIR_COST = 0.25;           // a full repair at the Repair Facility costs a quarter of the unit (original: build rate ÷ 4)
export const BAY_DRIVE_SECONDS = 1;             // driving onto or off the repair pad

export const CAPTURE_BELOW = 0.25;              // infantry take a conquerable building below a quarter of its hit points (spec §4.6)

export const AIR = {
  cruise: 1.6,          // flying height above the ground (tiles)
  low: 0.45,            // a Carryall's height as it picks up or sets down
  climb: 1.5,           // tiles per second up or down
  orbit: 1.5,           // an Ornithopter's turning radius (tiles)
  ferryDistance: 16,    // a trip this long is worth a Carryall (tiles)
  ferryCancel: 6,       // … and no longer once the unit is this close to its goal
  hitChance: 0.5,       // inaccurate rockets that reach an aircraft hit it this often
  aimCone: 0.35,        // an Ornithopter fires within this angle of its nose (radians)
  huntRadius: 96,       // an idle Ornithopter looks this far for prey (tiles)
  guardRadius: 4,       // … a guarding one this far beyond its weapon range
  cargoDrop: 0.42,      // a carried unit hangs this far below its Carryall (clear of its belly)
};

export const STARPORT = {
  wares: ['trike', 'raider', 'quad', 'combatTank', 'missileTank', 'siegeTank', 'harvester', 'mcv', 'carryall', 'ornithopter'],   // standard vehicles and aircraft (spec §4.5)
  extra: { missileTank: ['ordos'] },   // the Ordos buy the Missile Tank they cannot build
  stock: [2, 6],        // each type starts with 2–6 …
  restock: 90,          // … gains one every 90 s …
  maxStock: 10,         // … up to ten
  reprice: 60,          // seconds between price re-rolls (40–160 % of the cost)
  delivery: 30,         // seconds from the first order of a batch to the Frigate landing
  load: 9,              // a Frigate carries at most nine units
};

export const SONIC = { fade: 0.5 };             // the Sonic Tank's wave has lost half its strength by the end of its 8 tiles

export const DEVIATOR = {
  radius: 1.5,          // units this close to where the gas bursts change sides …
  seconds: 40,          // … for this long, then go home (spec §4.6, tunable)
  immune: ['harvester', 'mcv', 'deviator', 'sandworm'],   // and aircraft: the gas stays on the ground
};

export const DESTRUCT = {
  delay: 3,             // seconds of warning glow before a Devastator blows itself apart (spec §4.6)
  centre: [25, 50],     // the blast where it stood …
  blasts: 7,            // … and seven more round it (OpenDUNE)
  blast: [75, 150],
  scatter: 1.5,         // tiles from the centre
  radius: 1.5,          // each blast's reach
};

export const PALACE = {
  recharge: { deathHand: 420, fremen: 240, saboteur: 240 },   // seconds (spec §4.7)
  names: { deathHand: 'Death Hand', fremen: 'Fremen', saboteur: 'Saboteur' },
};

export const DEATH_HAND = {
  speed: 6,             // tiles per second
  scatter: 2,           // it comes down up to this far from the aim
  damage: 150,          // each of its 17 blasts, falling off over …
  radius: 1,            // … a tile
  pattern: [[0, 0], [0, 1], [0, -1], [0.78, 0.78], [-0.78, 0.78], [0.78, -0.78], [-0.78, -0.78], [1, 0], [-1, 0], [0, 2], [0, -2], [1.56, 1.56], [-1.56, 1.56], [1.56, -1.56], [-1.56, -1.56], [2, 0], [-2, 0]],   // a diamond out to 2 tiles (OpenDUNE)
};

export const FREMEN = { squads: 5, reach: 8 };   // five squads rise from the sand within eight tiles of the chosen spot
export const SABOTEUR = { blast: 500, splash: 300, radius: 1.5 };   // into the building it reaches; round it (also when it is killed)
