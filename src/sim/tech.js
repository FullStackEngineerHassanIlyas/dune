// What a house can build right now (spec §4.5): prerequisites, tech level, house rosters, factory
// upgrades and the plan-2 deferrals. Upgrades are items too: `upgrade:<structure>` buys the next level
// of that factory type for the whole house.
import { STRUCTURES } from '../data/structures.js';
import { UNITS } from '../data/units.js';
import { DEFERRED } from '../data/phase.js';

export const STRUCTURE_ORDER = ['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'hiTech', 'repair', 'wall', 'turret', 'rocketTurret', 'concrete4', 'starport', 'ix', 'palace'];
export const UNIT_ORDER = ['soldier', 'infantry', 'trooper', 'troopers', 'trike', 'raider', 'quad', 'harvester', 'combatTank', 'missileTank', 'siegeTank', 'mcv', 'sonicTank', 'devastator', 'deviator', 'carryall', 'ornithopter'];
export const UPGRADE_ORDER = ['constructionYard', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'hiTech'];
export const LINE_FACTORIES = { structure: ['constructionYard'], infantry: ['barracks', 'wor'], light: ['lightFactory'], heavy: ['heavyFactory'], air: ['hiTech'] };
const LINE_OF_FACTORY = { barracks: 'infantry', wor: 'infantry', lightFactory: 'light', heavyFactory: 'heavy', hiTech: 'air' };
const UPGRADE = 'upgrade:';

export const upgradeId = (structureType) => UPGRADE + structureType;
export const upgradeTarget = (typeId) => (typeof typeId === 'string' && typeId.startsWith(UPGRADE) ? typeId.slice(UPGRADE.length) : null);

export function lineOfItem(typeId) {
  const up = upgradeTarget(typeId);
  if (up) return up === 'constructionYard' ? 'structure' : LINE_OF_FACTORY[up] ?? null;   // upgrades run on the improved factory's line
  if (STRUCTURES[typeId]) return 'structure';
  const u = UNITS[typeId];
  return (u && LINE_OF_FACTORY[u.builtAt]) ?? null;
}

export function ownedStructureTypes(world, houseId) {
  const owned = new Set();
  for (const s of world.structures.values()) if (s.house === houseId) owned.add(s.typeId);
  return owned;
}

export function structureTechLevel(t, houseId) { return t.techByHouse?.[houseId] ?? t.tech; }

export function upgradeLevel(house, structureType) { return house?.upgrades?.[structureType] ?? 0; }

/** The level the next purchase reaches: the Ordos get Heavy Factory level 3 along with level 2 (original). */
export function upgradeResult(house, structureType) {
  const next = upgradeLevel(house, structureType) + 1;
  return house.id === 'ordos' && structureType === 'heavyFactory' && next === 2 ? 3 : next;
}

export function upgradeCost(house, structureType) { return STRUCTURES[structureType]?.upgrades?.[upgradeLevel(house, structureType)] ?? 0; }

/** The next level is for sale when the house owns the factory, the tech level allows it and its extra prerequisites stand. */
export function canUpgrade(house, structureType, owned) {
  const t = STRUCTURES[structureType];
  if (!t?.upgrades || DEFERRED.has(structureType) || !owned.has(structureType)) return false;
  const level = upgradeLevel(house, structureType);
  if (level >= t.upgrades.length) return false;
  const tech = t.upgradeTechByHouse?.[house.id] ?? t.upgradeTech ?? [];
  if ((tech[upgradeResult(house, structureType) - 1] ?? 0) > house.techLevel) return false;   // the Ordos wait for level 3
  return (t.upgradeRequires?.[level] ?? []).every((r) => owned.has(r));
}

/** Names of what going from level `from` to `to` opens for the house (sidebar tooltips). */
export function upgradeUnlocks(houseId, structureType, from, to) {
  const opens = (need) => need > from && need <= to;
  const names = [];
  for (const id of UNIT_ORDER) {
    const u = UNITS[id];
    if (u.builtAt === structureType && opens(u.upgrade ?? 0) && u.houses.includes(houseId) && !DEFERRED.has(id)) names.push(u.name);
  }
  for (const id of STRUCTURE_ORDER) {
    const t = STRUCTURES[id];
    if (opens(t.requiresUpgrade?.[structureType] ?? 0) && t.houses.includes(houseId) && !DEFERRED.has(id)) names.push(t.name);
  }
  return names;
}

export function canBuildStructure(house, typeId, owned, { implied = true } = {}) {
  const t = STRUCTURES[typeId];
  if (!t || !t.requires || DEFERRED.has(typeId)) return false;
  if (!t.houses.includes(house.id) || structureTechLevel(t, house.id) > house.techLevel) return false;
  if (!Object.entries(t.requiresUpgrade ?? {}).every(([k, level]) => upgradeLevel(house, k) >= level)) return false;   // e.g. Rocket Turrets need yard level 2
  if (implied && typeId !== 'windtrap' && !t.isConcrete && !owned.has('windtrap')) return false;   // a Wind Trap is implied for everything (spec §4.5)
  return owned.has('constructionYard') && t.requires.every((r) => owned.has(r));
}

export function canBuildUnit(house, typeId, owned) {
  const u = UNITS[typeId];
  if (!u || !LINE_OF_FACTORY[u.builtAt] || DEFERRED.has(typeId) || !u.houses.includes(house.id)) return false;
  if (upgradeLevel(house, u.builtAt) < (u.upgrade ?? 0)) return false;   // e.g. the Quad needs the Light Factory upgrade
  return owned.has(u.builtAt) && (u.requires ?? []).every((r) => owned.has(r));
}

export function canBuild(world, houseId, typeId, opts = {}) {
  const house = world.houses.get(houseId);
  if (!house) return false;
  const owned = ownedStructureTypes(world, houseId);
  const up = upgradeTarget(typeId);
  if (up) return canUpgrade(house, up, owned);
  return STRUCTURES[typeId] ? canBuildStructure(house, typeId, owned, opts) : canBuildUnit(house, typeId, owned);
}

export function buildOptions(world, houseId) {
  const out = { structure: [], infantry: [], light: [], heavy: [], air: [], upgrades: [] };
  const house = world.houses.get(houseId);
  if (!house) return out;
  const owned = ownedStructureTypes(world, houseId);
  for (const t of STRUCTURE_ORDER) if (canBuildStructure(house, t, owned)) out.structure.push(t);
  for (const t of UNIT_ORDER) if (canBuildUnit(house, t, owned)) out[lineOfItem(t)].push(t);
  for (const t of UPGRADE_ORDER) if (canUpgrade(house, t, owned)) out.upgrades.push(upgradeId(t));
  return out;
}
