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

export const UPGRADE_BUILD_TIME = 20;           // original steps per upgrade level (a countdown of 100 in steps of 5): 9 s

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
