// What a house can build right now (spec §4.5): prerequisites, tech level, house rosters, factory
// upgrades and the plan-2 deferrals. Upgrades are items too: `upgrade:<structure>` buys the next level
// of that factory type for the whole house. One vehicle factory: the Heavy Factory's 'heavy' line builds
// every ground vehicle, light and heavy alike. The sub-houses (Sardaukar, Mercenaries) build every structure
// and the units houses.js lists for them, as the original's tables give them.
// A campaign mission sets world.rules.tech = 'sega' (phase 3, C10): the Sega Mega Drive ladder of
// src/data/sega-tech.js then decides by house.techLevel (the mission number): structures by mission, the units
// each factory level opens, its prices, one 2x2 slab, no House of IX. canBuild and buildOptions mark the world's
// houses (house.techRules) so the helpers that get a house alone (upgradeCost, upgradeResult) agree with them.
import { STRUCTURES } from '../data/structures.js';
import { UNITS } from '../data/units.js';
import { DEFERRED } from '../data/phase.js';
import { HOUSES, SUB_HOUSE_UNITS } from '../data/houses.js';
import { SEGA_LADDERS, SEGA_REQUIRES_UPGRADE, segaStructureTech, segaUnit, segaLevelTech } from '../data/sega-tech.js';

export const STRUCTURE_ORDER = ['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'wor', 'heavyFactory', 'hiTech', 'repair', 'wall', 'turret', 'rocketTurret', 'concrete4', 'starport', 'ix', 'palace'];
export const UNIT_ORDER = ['soldier', 'infantry', 'trooper', 'troopers', 'trike', 'raider', 'quad', 'harvester', 'combatTank', 'missileTank', 'siegeTank', 'mcv', 'sonicTank', 'devastator', 'deviator', 'carryall', 'ornithopter'];
export const UPGRADE_ORDER = ['constructionYard', 'barracks', 'wor', 'heavyFactory', 'hiTech'];
export const LINE_FACTORIES = { structure: ['constructionYard'], infantry: ['barracks', 'wor'], heavy: ['heavyFactory'], air: ['hiTech'] };
const LINE_OF_FACTORY = { barracks: 'infantry', wor: 'infantry', heavyFactory: 'heavy', hiTech: 'air' };
const UPGRADE = 'upgrade:';

const isSega = (house) => house?.techRules === 'sega';

/** Marks the houses of a Sega world (canBuild and buildOptions mark the house they look at; a mission may call this once at set-up). */
export function applyTechRules(world) {
  if (world.rules?.tech !== 'sega') return;
  for (const h of world.houses.values()) h.techRules = 'sega';
}

const follow = (world, house) => { if (house && world.rules?.tech === 'sega' && house.techRules !== 'sega') house.techRules = 'sega'; };

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
  if (isSega(house)) return segaNext(house.id, structureType, upgradeLevel(house, structureType)) ?? upgradeLevel(house, structureType) + 1;
  const next = upgradeLevel(house, structureType) + 1;
  return house.id === 'ordos' && structureType === 'heavyFactory' && next === 3 ? 4 : next;
}

/** Sega: the price of the level the purchase reaches. */
export function upgradeCost(house, structureType) {
  if (isSega(house)) return SEGA_LADDERS[structureType]?.[upgradeResult(house, structureType) - 1]?.cost ?? 0;
  return STRUCTURES[structureType]?.upgrades?.[upgradeLevel(house, structureType)] ?? 0;
}

// ---- the Sega ladder ----

/** Ids of what Sega factory level `level` of `structureType` opens for a house: its units, then the structures behind it. */
function segaLevelOpens(houseId, structureType, level) {
  const ids = [];
  for (const id of UNIT_ORDER) {
    const s = segaUnit(id, houseId);
    if (s && s.at === structureType && s.level === level && offered(id, houseId) && !DEFERRED.has(id)) ids.push(id);
  }
  for (const id of STRUCTURE_ORDER) {
    if ((SEGA_REQUIRES_UPGRADE[id]?.[structureType] ?? 0) === level && segaStructureTech(id, houseId) !== null && offered(id, houseId)) ids.push(id);
  }
  return ids;
}

/** The next Sega level above `from` that opens something for the house (empty levels are skipped), or null. */
function segaNext(houseId, structureType, from) {
  const ladder = SEGA_LADDERS[structureType] ?? [];
  for (let k = from + 1; k <= ladder.length; k++) if (segaLevelOpens(houseId, structureType, k).length) return k;
  return null;
}

/** Factory levels a house may own by Sega mission `techLevel` (from its start levels), e.g. a prebuilt enemy base's. */
export function segaUpgrades(houseId, techLevel) {
  const out = { ...(HOUSES[houseId]?.startUpgrades ?? {}) };
  for (const type of UPGRADE_ORDER) {
    let level = out[type] ?? 0;
    for (let next = segaNext(houseId, type, level); next !== null && segaLevelTech(type, next, houseId) <= techLevel; next = segaNext(houseId, type, level)) level = next;
    if (level) out[type] = level;
  }
  return out;
}

/** What Sega mission `level` opens for a house (the briefing's "new technology"): structures, then units. */
export function segaOpens(level, houseId) {
  const names = [];
  const start = HOUSES[houseId]?.startUpgrades ?? {};
  const structureAt = (id) => (offered(id, houseId) ? segaStructureTech(id, houseId) ?? Infinity : Infinity);
  for (const id of STRUCTURE_ORDER) if (structureAt(id) === level) names.push(STRUCTURES[id].name);
  for (const id of UNIT_ORDER) {
    const s = segaUnit(id, houseId);
    if (!s || !offered(id, houseId) || DEFERRED.has(id)) continue;
    const ladder = s.level > (start[s.at] ?? 0) ? segaLevelTech(s.at, s.level, houseId) : 0;
    if (Math.max(structureAt(s.at), ladder, s.tech, ...s.requires.map(structureAt)) === level) names.push(UNITS[id].name);
  }
  return names;
}

/** The factory a unit leaves by (on the Sega ladder it may differ from units.js `builtAt`). */
export function factoryOf(house, typeId) {
  return (isSega(house) ? segaUnit(typeId, house.id)?.at : null) ?? UNITS[typeId]?.builtAt ?? null;
}

/** The factory level a unit needs on the ladder in use. */
export function unitUpgrade(house, typeId) {
  return isSega(house) ? segaUnit(typeId, house.id)?.level ?? 0 : UNITS[typeId]?.upgrade ?? 0;
}

function canUpgradeSega(house, structureType, owned) {
  if (!SEGA_LADDERS[structureType] || DEFERRED.has(structureType) || !owned.has(structureType)) return false;
  const next = segaNext(house.id, structureType, upgradeLevel(house, structureType));
  return next !== null && segaLevelTech(structureType, next, house.id) <= house.techLevel;
}

/** The next level is for sale when the house owns the factory, the tech level allows it and its extra prerequisites stand. */
export function canUpgrade(house, structureType, owned) {
  if (isSega(house)) return canUpgradeSega(house, structureType, owned);
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

/** Names of what going from level `from` to `to` opens for the house (sidebar tooltips). Pass the house itself, not
 *  its id, for a Sega world's ladder. */
export function upgradeUnlocks(houseOrId, structureType, from, to) {
  const house = typeof houseOrId === 'object' ? houseOrId : null, houseId = house?.id ?? houseOrId;
  if (isSega(house)) {
    const ids = [];
    for (let k = from + 1; k <= to; k++) ids.push(...segaLevelOpens(houseId, structureType, k));
    return ids.map((id) => (UNITS[id] ?? STRUCTURES[id]).name);
  }
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
  const sega = isSega(house);
  if (!offered(typeId, house.id) || (sega ? segaStructureTech(typeId, house.id) ?? Infinity : structureTechLevel(t, house.id)) > house.techLevel) return false;
  const needs = sega ? SEGA_REQUIRES_UPGRADE[typeId] : t.requiresUpgrade;
  if (!Object.entries(needs ?? {}).every(([k, level]) => upgradeLevel(house, k) >= level)) return false;   // e.g. Rocket Turrets need yard level 2 (Sega: 1)
  if (t.unique && owned.has(typeId)) return false;   // one Starport and one Palace per house (original)
  if (implied && typeId !== 'windtrap' && !t.isConcrete && !owned.has('windtrap')) return false;   // a Wind Trap is implied for everything (spec §4.5)
  return owned.has('constructionYard') && t.requires.every((r) => owned.has(r));
}

export function canBuildUnit(house, typeId, owned) {
  const u = UNITS[typeId];
  if (!u || !LINE_OF_FACTORY[u.builtAt] || DEFERRED.has(typeId) || !offered(typeId, house.id)) return false;
  if (isSega(house)) {   // the Sega ladder: its factory and level, the Hi-Tech for the specials, their mission
    const s = segaUnit(typeId, house.id);
    if (!s || s.tech > house.techLevel || upgradeLevel(house, s.at) < s.level) return false;
    return owned.has(s.at) && s.requires.every((r) => owned.has(r));
  }
  if (upgradeLevel(house, u.builtAt) < (u.upgrade ?? 0)) return false;   // e.g. the Quad needs the first Heavy Factory upgrade
  return owned.has(u.builtAt) && (u.requires ?? []).every((r) => owned.has(r));
}

export function canBuild(world, houseId, typeId, opts = {}) {
  const house = world.houses.get(houseId);
  if (!house) return false;
  follow(world, house);
  const owned = ownedStructureTypes(world, houseId);
  const up = upgradeTarget(typeId);
  if (up) return canUpgrade(house, up, owned);
  return STRUCTURES[typeId] ? canBuildStructure(house, typeId, owned, opts) : canBuildUnit(house, typeId, owned);
}

export function buildOptions(world, houseId) {
  const out = { structure: [], infantry: [], heavy: [], air: [], upgrades: [] };
  const house = world.houses.get(houseId);
  if (!house) return out;
  follow(world, house);
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
