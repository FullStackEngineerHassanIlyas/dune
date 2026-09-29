// What a house can build right now (spec §4.5): prerequisites, tech level, house rosters and the
// plan-2 deferrals. Factory upgrades count as already bought until plan 2.
import { STRUCTURES } from '../data/structures.js';
import { UNITS } from '../data/units.js';
import { DEFERRED } from '../data/phase.js';

export const STRUCTURE_ORDER = ['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'hiTech', 'repair', 'wall', 'turret', 'rocketTurret', 'concrete4', 'starport', 'ix', 'palace'];
export const UNIT_ORDER = ['soldier', 'infantry', 'trooper', 'troopers', 'trike', 'raider', 'quad', 'harvester', 'combatTank', 'missileTank', 'siegeTank', 'mcv', 'sonicTank', 'devastator', 'deviator', 'carryall', 'ornithopter'];
export const LINE_FACTORIES = { structure: ['constructionYard'], infantry: ['barracks', 'wor'], light: ['lightFactory'], heavy: ['heavyFactory'], air: ['hiTech'] };
const LINE_OF_FACTORY = { barracks: 'infantry', wor: 'infantry', lightFactory: 'light', heavyFactory: 'heavy', hiTech: 'air' };

export function lineOfItem(typeId) {
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

export function canBuildStructure(house, typeId, owned, { implied = true } = {}) {
  const t = STRUCTURES[typeId];
  if (!t || !t.requires || DEFERRED.has(typeId)) return false;
  if (!t.houses.includes(house.id) || structureTechLevel(t, house.id) > house.techLevel) return false;
  if (implied && typeId !== 'windtrap' && !t.isConcrete && !owned.has('windtrap')) return false;   // a Wind Trap is implied for everything (spec §4.5)
  return owned.has('constructionYard') && t.requires.every((r) => owned.has(r));
}

export function canBuildUnit(house, typeId, owned) {
  const u = UNITS[typeId];
  if (!u || !LINE_OF_FACTORY[u.builtAt] || DEFERRED.has(typeId) || !u.houses.includes(house.id)) return false;
  return owned.has(u.builtAt) && (u.requires ?? []).every((r) => owned.has(r));
}

export function canBuild(world, houseId, typeId, opts = {}) {
  const house = world.houses.get(houseId);
  if (!house) return false;
  const owned = ownedStructureTypes(world, houseId);
  return STRUCTURES[typeId] ? canBuildStructure(house, typeId, owned, opts) : canBuildUnit(house, typeId, owned);
}

export function buildOptions(world, houseId) {
  const out = { structure: [], infantry: [], light: [], heavy: [], air: [] };
  const house = world.houses.get(houseId);
  if (!house) return out;
  const owned = ownedStructureTypes(world, houseId);
  for (const t of STRUCTURE_ORDER) if (canBuildStructure(house, t, owned)) out.structure.push(t);
  for (const t of UNIT_ORDER) if (canBuildUnit(house, t, owned)) out[lineOfItem(t)].push(t);
  return out;
}
