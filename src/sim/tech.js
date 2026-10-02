// What a house can build right now (spec §4.5): prerequisites, tech level, house rosters, factory
// upgrades and the plan-2 deferrals. Upgrades are items too: `upgrade:<structure>` buys the next level
// of that factory type for the whole house. One vehicle factory: the Heavy Factory's 'heavy' line builds
// every ground vehicle, light and heavy alike. The sub-houses (Sardaukar, Mercenaries) build every structure
// and the units houses.js lists for them, as the original's tables give them.
import { STRUCTURES } from '../data/structures.js';
import { UNITS } from '../data/units.js';
import { DEFERRED } from '../data/phase.js';
import { HOUSES, SUB_HOUSE_UNITS } from '../data/houses.js';

export const STRUCTURE_ORDER = ['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'wor', 'heavyFactory', 'hiTech', 'repair', 'wall', 'turret', 'rocketTurret', 'concrete4', 'starport', 'ix', 'palace'];
export const UNIT_ORDER = ['soldier', 'infantry', 'trooper', 'troopers', 'trike', 'raider', 'quad', 'harvester', 'combatTank', 'missileTank', 'siegeTank', 'mcv', 'sonicTank', 'devastator', 'deviator', 'carryall', 'ornithopter'];
export const UPGRADE_ORDER = ['constructionYard', 'barracks', 'wor', 'heavyFactory', 'hiTech'];
export const LINE_FACTORIES = { structure: ['constructionYard'], infantry: ['barracks', 'wor'], heavy: ['heavyFactory'], air: ['hiTech'] };
const LINE_OF_FACTORY = { barracks: 'infantry', wor: 'infantry', heavyFactory: 'heavy', hiTech: 'air' };
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

/** Is structure or unit `typeId` on the house's roster (tech level, prerequisites and upgrades aside)? */
export function offered(typeId, houseId) {
  const entry = STRUCTURES[typeId] ?? UNITS[typeId];
  if (!entry) return false;
  if (entry.houses.includes(houseId)) return true;
  return !!HOUSES[houseId]?.subHouse && (STRUCTURES[typeId] ? true : SUB_HOUSE_UNITS.includes(typeId));
}

export function upgradeLevel(house, structureType) { return house?.upgrades?.[structureType] ?? 0; }

/** The level the next purchase reaches: the Ordos get the Heavy Factory's last level (Siege Tank) along with
 *  the one before (Missile Tank, not theirs), as the original gives them its last level free. */
export function upgradeResult(house, structureType) {
  const next = upgradeLevel(house, structureType) + 1;
  return house.id === 'ordos' && structureType === 'heavyFactory' && next === 3 ? 4 : next;
}

export function upgradeCost(house, structureType) { return STRUCTURES[structureType]?.upgrades?.[upgradeLevel(house, structureType)] ?? 0; }

/** The next level is for sale when the house owns the factory, the tech level allows it and its extra prerequisites stand. */
export function canUpgrade(house, structureType, owned) {
  const t = STRUCTURES[structureType];
  if (!t?.upgrades || DEFERRED.has(structureType) || !owned.has(structureType)) return false;
  if (house.id === 'harkonnen' && structureType === 'hiTech') return false;   // never, as in the original
  const level = upgradeLevel(house, structureType);
  if (level >= t.upgrades.length) return false;
  const tech = t.upgradeTechByHouse?.[house.id] ?? t.upgradeTech ?? [];
  if ((tech[upgradeResult(house, structureType) - 1] ?? 0) > house.techLevel) return false;   // the Ordos wait for level 3
  if (!(t.upgradeRequires?.[level] ?? []).every((r) => owned.has(r))) return false;
  return upgradeUnlocks(house.id, structureType, level, upgradeResult(house, structureType)).length > 0;   // on sale only when it opens something
}

/** Names of what going from level `from` to `to` opens for the house (sidebar tooltips). */
export function upgradeUnlocks(houseId, structureType, from, to) {
  const opens = (need) => need > from && need <= to;
  const waiting = (requires) => (requires ?? []).some((r) => DEFERRED.has(r));   // e.g. the Ornithopter needs the House of IX (plan 2c)
  const names = [];
  for (const id of UNIT_ORDER) {
    const u = UNITS[id];
    if (u.builtAt === structureType && opens(u.upgrade ?? 0) && offered(id, houseId) && !DEFERRED.has(id) && !waiting(u.requires)) names.push(u.name);
  }
  for (const id of STRUCTURE_ORDER) {
    const t = STRUCTURES[id];
    if (opens(t.requiresUpgrade?.[structureType] ?? 0) && offered(id, houseId) && !DEFERRED.has(id)) names.push(t.name);
  }
  return names;
}

export function canBuildStructure(house, typeId, owned, { implied = true } = {}) {
  const t = STRUCTURES[typeId];
  if (!t || !t.requires || DEFERRED.has(typeId)) return false;
  if (!offered(typeId, house.id) || structureTechLevel(t, house.id) > house.techLevel) return false;
  if (!Object.entries(t.requiresUpgrade ?? {}).every(([k, level]) => upgradeLevel(house, k) >= level)) return false;   // e.g. Rocket Turrets need yard level 2
  if (t.unique && owned.has(typeId)) return false;   // one Starport and one Palace per house (original)
  if (implied && typeId !== 'windtrap' && !t.isConcrete && !owned.has('windtrap')) return false;   // a Wind Trap is implied for everything (spec §4.5)
  return owned.has('constructionYard') && t.requires.every((r) => owned.has(r));
}

export function canBuildUnit(house, typeId, owned) {
  const u = UNITS[typeId];
  if (!u || !LINE_OF_FACTORY[u.builtAt] || DEFERRED.has(typeId) || !offered(typeId, house.id)) return false;
  if (upgradeLevel(house, u.builtAt) < (u.upgrade ?? 0)) return false;   // e.g. the Quad needs the first Heavy Factory upgrade
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
  const out = { structure: [], infantry: [], heavy: [], air: [], upgrades: [] };
  const house = world.houses.get(houseId);
  if (!house) return out;
  const owned = ownedStructureTypes(world, houseId);
  for (const t of STRUCTURE_ORDER) if (canBuildStructure(house, t, owned)) out.structure.push(t);
  for (const t of UNIT_ORDER) if (canBuildUnit(house, t, owned)) out[lineOfItem(t)].push(t);
  for (const t of UPGRADE_ORDER) if (canUpgrade(house, t, owned)) out.upgrades.push(upgradeId(t));
  return out;
}

/** What tech level `level` adds for a house (the set-up screen's note): the buildings it opens, the units those
 *  buildings build from the start (a factory's first units, the House of IX special) and what the factory upgrades
 *  it allows bring. */
export function techOpens(level, houseId) {
  const names = [];
  const usable = (id) => offered(id, houseId) && !DEFERRED.has(id);
  for (const id of STRUCTURE_ORDER) {
    const t = STRUCTURES[id];
    if (usable(id) && structureTechLevel(t, houseId) === level) names.push(t.name);
  }
  for (const id of UNIT_ORDER) {   // a unit opens with the last of its factory and prerequisites
    const u = UNITS[id], needs = [u.builtAt, ...(u.requires ?? [])];
    if ((u.upgrade ?? 0) || !LINE_OF_FACTORY[u.builtAt] || !usable(id) || !needs.every(usable)) continue;
    if (Math.max(...needs.map((r) => structureTechLevel(STRUCTURES[r], houseId))) === level) names.push(u.name);
  }
  for (const type of UPGRADE_ORDER) {
    const t = STRUCTURES[type];
    if (!offered(type, houseId) || (houseId === 'harkonnen' && type === 'hiTech')) continue;
    (t.upgradeTechByHouse?.[houseId] ?? t.upgradeTech ?? []).forEach((need, k) => { if (need === level) names.push(...upgradeUnlocks(houseId, type, k, k + 1)); });
  }
  return [...new Set(names)];
}
