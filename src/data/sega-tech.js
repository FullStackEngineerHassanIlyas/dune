// The Sega Mega Drive tech ladder (phase 3, contract C10; research.md §6 "Genesis tech", "Upgrade ladder",
// "Units on sale"): what a house may build in campaign mission n, with world.rules.tech === 'sega' and
// house.techLevel = n. One 2x2 slab and no 1x1 one, no House of IX (the special tanks and the Ornithopter come
// from the Hi-Tech Factory and its upgrade), one vehicle factory whose ladder runs Quad → Harvester and Combat
// Tank → MCV → Missile Tank → Siege Tank, and the Rocket Turret behind the yard's single upgrade. Skirmish
// keeps the PC tree of src/data/structures.js and units.js; src/sim/tech.js reads this table only for Sega worlds.

/** The first mission each structure is offered in (a number, or per house with `default`). Absent = never. */
export const SEGA_STRUCTURES = {
  concrete4: 1, windtrap: 1, refinery: 1,
  outpost: 2, silo: 2, barracks: 2, wor: { default: 2, ordos: 4 },
  heavyFactory: { default: 3, atreides: 2, ordos: 2 },
  wall: 4,
  hiTech: 5, repair: 5, turret: 5,
  rocketTurret: 6, starport: 6,
  palace: 8,
};

/** Upgrades a Sega structure needs (in place of structures.js `requiresUpgrade`): the yard's one level opens the Rocket Turret. */
export const SEGA_REQUIRES_UPGRADE = { rocketTurret: { constructionYard: 1 } };

/** Sega slab price (structures.js keeps the PC 20 for the large slab; production reads that one today). */
export const SEGA_SLAB_COST = 15;

/** Where the Ordos train Troopers. On the Mega Drive they come from Barracks upgrades (150 Trooper at 4, 200 Troopers
 *  at 6); production.js spawns a unit at units.js `builtAt` (the WOR), so until it spawns at tech.js factoryOf() they
 *  train at a WOR the Ordos may build from mission 4 (same missions, same prices for the squad). Flip to 'barracks'
 *  together with that production.js change (notes: 2026-10-03-phase3-scenarios.md). */
export const ORDOS_TROOPERS_AT = 'wor';

/** Structures a house never builds on the Sega ladder (beyond its units.js/structures.js roster). */
export const SEGA_NOT_OFFERED = {
  ordos: ORDOS_TROOPERS_AT === 'barracks' ? ['wor'] : [],
  sardaukar: ['mcv'],   // the Emperor's troops use every unit but the Deviator, Fremen, MCV, Raider and Saboteur
};

/** Factory upgrade levels: cost and first mission (per house where it differs). What a level opens follows from
 *  SEGA_UNITS and SEGA_REQUIRES_UPGRADE; a level that opens nothing for a house is skipped by its purchases. */
export const SEGA_LADDERS = {
  constructionYard: [{ cost: 200, tech: 6 }],                                    // Rocket Turret
  barracks: [{ cost: 150, tech: 2 }, { cost: 150, tech: 4 }, { cost: 200, tech: 6 }],   // Infantry; the Ordos' Trooper, Troopers
  wor: [{ cost: 200, tech: 4, techByHouse: { ordos: 6 } }],                      // Troopers
  heavyFactory: [
    { cost: 200, tech: 3 },                                                      // Quad (the Harkonnen start with it)
    { cost: 200, tech: 4 },                                                      // Harvester, Combat Tank
    { cost: 300, tech: 4 },                                                      // MCV
    { cost: 300, tech: 5 },                                                      // Missile Tank (not the Ordos')
    { cost: 300, tech: 6, techByHouse: { ordos: 7 } },                           // Siege Tank
  ],
  hiTech: [{ cost: 250, tech: 7 }],                                              // Ornithopter (never the Harkonnen)
};

const ordosTrooper = (level) => (ORDOS_TROOPERS_AT === 'barracks' ? { ordos: { at: 'barracks', level } } : {});

/** Each buildable unit: its factory (`at`), the factory level it needs, extra structures, the first mission. */
export const SEGA_UNITS = {
  soldier:     { at: 'barracks', level: 0 },
  infantry:    { at: 'barracks', level: 1 },
  trooper:     { at: 'wor', level: 0, byHouse: ordosTrooper(2) },
  troopers:    { at: 'wor', level: 1, byHouse: ordosTrooper(3) },
  trike:       { at: 'heavyFactory', level: 0 },
  raider:      { at: 'heavyFactory', level: 0 },
  quad:        { at: 'heavyFactory', level: 1 },
  harvester:   { at: 'heavyFactory', level: 2 },
  combatTank:  { at: 'heavyFactory', level: 2 },
  mcv:         { at: 'heavyFactory', level: 3 },
  missileTank: { at: 'heavyFactory', level: 4 },
  siegeTank:   { at: 'heavyFactory', level: 5 },
  sonicTank:   { at: 'heavyFactory', level: 0, requires: ['hiTech'], tech: 7 },
  devastator:  { at: 'heavyFactory', level: 0, requires: ['hiTech'], tech: 7 },
  deviator:    { at: 'heavyFactory', level: 0, requires: ['hiTech'], tech: 7 },
  carryall:    { at: 'hiTech', level: 0 },
  ornithopter: { at: 'hiTech', level: 1 },
};

/** Starport wares on the Sega ladder (from mission 6): the standard vehicles, the Siege Tank from 7, the Ornithopter
 *  from 8. The Mega Drive also sells the Trike to the Ordos and Harkonnen, which their units.js roster does not hold. */
export const SEGA_STARPORT = { combatTank: 6, harvester: 6, mcv: 6, missileTank: 6, quad: 6, trike: 6, siegeTank: 7, ornithopter: 8 };

/** The first mission a structure is offered in for a house, or null. */
export function segaStructureTech(typeId, houseId) {
  const t = SEGA_STRUCTURES[typeId];
  if (t === undefined || SEGA_NOT_OFFERED[houseId]?.includes(typeId)) return null;
  return typeof t === 'number' ? t : t[houseId] ?? t.default;
}

/** A unit's Sega entry for a house ({ at, level, requires, tech }), or null when the ladder never builds it. */
export function segaUnit(typeId, houseId) {
  const u = SEGA_UNITS[typeId];
  if (!u || SEGA_NOT_OFFERED[houseId]?.includes(typeId)) return null;
  return { at: u.at, level: u.level, requires: u.requires ?? [], tech: u.tech ?? 0, ...(u.byHouse?.[houseId] ?? {}) };
}

/** The first mission a factory level (1-based) is for sale in, for a house. */
export function segaLevelTech(structureType, level, houseId) {
  const step = SEGA_LADDERS[structureType]?.[level - 1];
  return step ? step.techByHouse?.[houseId] ?? step.tech : Infinity;
}
