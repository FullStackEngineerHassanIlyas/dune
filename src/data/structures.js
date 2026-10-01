// Structure table with the original Dune II values (OpenDUNE structureinfo.c,
// docs/research/raw/structures.md). power > 0 consumes, power < 0 produces.
// requires: null means "never built from the menu" (the Construction Yard comes from an MCV).
// One vehicle factory, as on the Genesis (spec §4.5): the Heavy Factory takes the PC Light Factory's
// place in the tree — after a Refinery, at its tech level, price and build time, keeping its own size,
// hit points and power — and builds every ground vehicle; its upgrade ladder is the Light Factory's
// level (Quad) followed by its own three.
const ALL = ['atreides', 'harkonnen', 'ordos'];

export const STRUCTURES = {
  concrete:         { name: 'Concrete Slab', w: 1, h: 1, cost: 5, buildTime: 16, hp: 20, power: 0, sight: 1, requires: [], houses: ALL, tech: 1, isConcrete: true },
  concrete4:        { name: 'Large Concrete Slab', w: 2, h: 2, cost: 20, buildTime: 16, hp: 20, power: 0, sight: 1, requires: [], requiresUpgrade: { constructionYard: 1 }, houses: ALL, tech: 4, isConcrete: true },
  wall:             { name: 'Wall', w: 1, h: 1, cost: 50, buildTime: 40, hp: 50, power: 0, sight: 1, requires: ['outpost'], houses: ALL, tech: 4, isWall: true },
  windtrap:         { name: 'Wind Trap', w: 2, h: 2, cost: 300, buildTime: 48, hp: 200, power: -100, sight: 2, requires: [], houses: ALL, tech: 1, conquerable: true },
  refinery:         { name: 'Spice Refinery', w: 3, h: 2, cost: 400, buildTime: 80, hp: 450, power: 30, storage: 1005, sight: 4, requires: ['windtrap'], houses: ALL, tech: 1, conquerable: true },
  silo:             { name: 'Spice Silo', w: 2, h: 2, cost: 150, buildTime: 48, hp: 150, power: 5, storage: 1000, sight: 2, requires: ['refinery'], houses: ALL, tech: 2, conquerable: true },
  outpost:          { name: 'Radar Outpost', w: 2, h: 2, cost: 400, buildTime: 80, hp: 500, power: 30, sight: 10, requires: ['windtrap'], houses: ALL, tech: 2 },
  barracks:         { name: 'Barracks', w: 2, h: 2, cost: 300, buildTime: 72, hp: 300, power: 10, sight: 2, requires: ['outpost'], houses: ['atreides', 'ordos'], tech: 2, produces: 'infantry', upgrades: [150], upgradeTech: [2] },
  wor:              { name: 'WOR Trooper Facility', w: 2, h: 2, cost: 400, buildTime: 104, hp: 400, power: 20, sight: 3, requires: ['outpost'], houses: ['harkonnen', 'ordos'], tech: 5, techByHouse: { harkonnen: 2 }, produces: 'infantry', upgrades: [200], upgradeTech: [6], upgradeTechByHouse: { harkonnen: [5] } },
  heavyFactory:     { name: 'Heavy Factory', w: 3, h: 2, cost: 400, buildTime: 96, hp: 200, power: 35, sight: 3, requires: ['refinery'], houses: ALL, tech: 3, techByHouse: { atreides: 2, ordos: 2 }, produces: 'heavy', upgrades: [200, 300, 300, 300], upgradeTech: [3, 4, 5, 6], conquerable: true },
  hiTech:           { name: 'Hi-Tech Factory', w: 3, h: 2, cost: 500, buildTime: 120, hp: 400, power: 35, sight: 3, requires: ['heavyFactory', 'outpost'], houses: ALL, tech: 5, produces: 'air', upgrades: [250], upgradeTech: [7], conquerable: true },
  repair:           { name: 'Repair Facility', w: 3, h: 2, cost: 700, buildTime: 80, hp: 200, power: 20, sight: 3, requires: ['heavyFactory', 'outpost'], houses: ALL, tech: 5, conquerable: true, entrance: [1, 2], pad: [1.5, 1] },
  ix:               { name: 'House of IX', w: 2, h: 2, cost: 500, buildTime: 120, hp: 400, power: 40, sight: 3, requires: ['starport'], houses: ALL, tech: 7 },
  starport:         { name: 'Starport', w: 3, h: 3, cost: 500, buildTime: 120, hp: 500, power: 50, sight: 6, requires: ['refinery'], houses: ALL, tech: 6, conquerable: true, unique: true },
  palace:           { name: 'Palace', w: 3, h: 3, cost: 999, buildTime: 130, hp: 1000, power: 80, sight: 5, requires: ['starport'], houses: ALL, tech: 8, unique: true },
  turret:           { name: 'Gun Turret', w: 1, h: 1, cost: 125, buildTime: 64, hp: 200, power: 10, sight: 2, requires: ['outpost'], houses: ALL, tech: 5, conquerable: true, targetAir: true, weapon: 'turretGun', damage: 20, range: 5, fireDelay: 80 },
  rocketTurret:     { name: 'Rocket Turret', w: 1, h: 1, cost: 250, buildTime: 96, hp: 200, power: 25, sight: 5, requires: ['outpost'], requiresUpgrade: { constructionYard: 2 }, houses: ALL, tech: 6, conquerable: true, targetAir: true, weapon: 'turretRocket', damage: 30, range: 8, fireDelay: 120, near: { weapon: 'turretGun', damage: 20, range: 3, fireDelay: 80 } },
  constructionYard: { name: 'Construction Yard', w: 2, h: 2, cost: 400, buildTime: 80, hp: 400, power: 0, sight: 3, requires: null, houses: ALL, tech: 1, produces: 'structure', upgrades: [200, 200], upgradeTech: [4, 6], upgradeRequires: [[], ['outpost', 'windtrap']], conquerable: true },
};
