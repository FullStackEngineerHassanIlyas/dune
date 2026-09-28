// Every conversion from original Dune II numbers to real time and tiles (spec §4.1). Tune here only.
export const SIM_HZ = 20;
export const DT = 1 / SIM_HZ;
export const TERRAIN_REF = 192;

/** Tiles per second for a ground unit with original speed factor on terrain value 0..255. */
export function groundSpeed(factor, terrain) { return ((0.25 + factor / 24) * terrain) / TERRAIN_REF; }
/** Tiles per second for aircraft. */
export function airSpeed(factor) { return factor / 40; }
export function fireDelaySeconds(fireDelay) { return fireDelay / 40; }
export function buildSeconds(buildTime) { return buildTime * 0.45; }
export function unitSight(radius) { return radius + 1; }

/** Radians per second by original turning class (1 = heavy tracked … 3 = infantry). */
export const TURN_RATE = [0, 2.6, 4.8, 10];
/** How far off its heading (radians) a unit may start driving; beyond it, it turns on the spot first. */
export const DRIVE_ANGLE = { foot: Math.PI, tracked: 0.5, harvester: 0.5, wheeled: 1.1, air: Math.PI, worm: Math.PI };
export const GAME_SPEED = { slowest: 0.5, slow: 0.75, normal: 1, fast: 1.25, fastest: 1.5 };

/** Turret traverse (radians per second) when swinging back in line with the hull. */
export const TURRET_TURN_RATE = 3.5;

export const STUCK_REPATH_SECONDS = 1.5;
export const STUCK_GIVEUP_SECONDS = 5;

export const SPICE_PER_TILE = 250;
export const THICK_SPICE_PER_TILE = 750;
