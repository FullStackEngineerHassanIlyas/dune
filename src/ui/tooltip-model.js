// What a build icon's tooltip says (C&C 3 style): name and role; the price this house pays now and the build time at
// the line's present speed (extra factories, low power); for structures power, storage, size and what they lead to;
// for units hit points, speed, class, weapon, sight, the classes they beat and lose to (data/effectiveness.js,
// worked out from the game's numbers) and their special abilities; for upgrades what the level opens; requirements
// still missing; Starport wares and the Palace weapon too. On the Sega ladder (campaign) its prices, levels and
// unlocks (sim/tech.js). Pure: it reads the world and never changes it. Built only while the pointer rests on an icon;
// what never changes for a type is worked out once and kept.
import { STRUCTURES } from '../data/structures.js';
import { UNITS, MOVE } from '../data/units.js';
import { shotFor } from '../data/weapons.js';
import { HOUSES } from '../data/houses.js';
import { SURFACE, moveFactor } from '../data/terrain.js';
import { DEFERRED } from '../data/phase.js';
import { SEGA_REQUIRES_UPGRADE, segaStructureTech, segaUnit, segaLevelTech } from '../data/sega-tech.js';
import {
  STARPORT, PALACE, DEATH_HAND, FREMEN, SABOTEUR, DEVIATOR, DEATH_SPLASH, CAPTURE_BELOW, UNIT_REPAIR_COST, SONIC,
  groundSpeed, airSpeed, fireDelaySeconds, unitSight,
} from '../data/tuning.js';
import { matchups } from '../data/effectiveness.js';
import {
  STRUCTURE_ORDER, UNIT_ORDER, LINE_FACTORIES, lineOfItem, upgradeTarget, upgradeLevel, upgradeResult, upgradeUnlocks, itemCost, offered,
  structureTechLevel, factoryOf, unitUpgrade, ownedStructureTypes, maxUpgradeLevel,
} from '../sim/tech.js';
import { itemSeconds, lineSpeed, factoriesFor } from '../sim/production.js';
import { computePower } from '../sim/economy.js';
import { canCapture } from '../sim/capture.js';
import { HARVEST_CAPACITY } from '../sim/harvest.js';
import { palaceRecharge } from '../sim/palace.js';

const ROLES = {
  concrete: 'Foundation: what stands on it is built at full strength',
  concrete4: 'Four slabs of foundation at once',
  wall: 'Holds back ground units',
  windtrap: 'Power for the base',
  refinery: 'Turns the Harvesters\' spice into credits',
  silo: 'Stores more spice',
  outpost: 'Radar: the map, while the power holds',
  barracks: 'Trains light infantry',
  wor: 'Trains Troopers',
  heavyFactory: 'Builds every ground vehicle',
  hiTech: 'Builds aircraft',
  repair: 'Mends damaged vehicles',
  ix: 'Research: the house\'s special units',
  starport: 'Buys vehicles off-world',
  palace: 'House seat, with the house\'s special weapon',
  turret: 'Gun emplacement',
  rocketTurret: 'Long-range rocket emplacement',
  constructionYard: 'Builds every structure',
  soldier: 'A single rifleman',
  infantry: 'Three riflemen',
  trooper: 'A single rocket soldier',
  troopers: 'Three rocket soldiers',
  fremen: 'Desert warriors who fight on their own',
  saboteur: 'Infiltrator who blows up a building',
  trike: 'Fast scout buggy with a machine gun',
  raider: 'The Ordos Trike: faster and lighter',
  quad: 'Four-wheeled machine-gun buggy',
  combatTank: 'Main battle tank',
  siegeTank: 'Heavy tank, twin cannon',
  missileTank: 'Long-range rocket launcher',
  deviator: 'Gas rockets that turn enemy units',
  sonicTank: 'Sonic wave through everything in a line',
  devastator: 'Plasma-armed giant',
  harvester: 'Gathers spice',
  mcv: 'Mobile base: becomes a Construction Yard',
  carryall: 'Airlifts vehicles',
  ornithopter: 'Fast attack aircraft',
};

const WEAPON_NAMES = {
  rifle: 'Rifle', pistol: 'Pistol', mg: 'Machine gun', cannon: 'Cannon', heavyCannon: 'Heavy cannon', plasma: 'Plasma cannon', sonic: 'Sonic wave',
  rocket: 'Rockets', miniRocket: 'Mini-rockets', gasRocket: 'Gas rockets', trooperRocket: 'Rocket launcher', turretGun: 'Gun', turretRocket: 'Homing rockets',
};

const CLASS_NAMES = { foot: 'Infantry', saboteur: 'Infantry', wheeled: 'Wheeled', tracked: 'Tracked', harvester: 'Tracked', air: 'Aircraft' };

const PLURAL = { constructionYard: 'Construction Yards', barracks: 'Barracks', wor: 'WOR Facilities', heavyFactory: 'Heavy Factories', hiTech: 'Hi-Tech Factories' };

const NAME_TO_ID = new Map([...Object.entries(STRUCTURES), ...Object.entries(UNITS)].map(([id, t]) => [t.name, id]));

const fmt = (n) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1));
const pct = (x) => `${Math.round(x * 100)} %`;
export const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// ---- the ladder in use ----

const isSega = (world, house) => world.rules?.tech === 'sega' || house?.techRules === 'sega';
const techOf = (house) => house.techLevel ?? Infinity;

function structureOffered(world, house, id) {
  const t = STRUCTURES[id];
  if (!t?.requires || DEFERRED.has(id) || !offered(id, house.id)) return false;
  const tech = isSega(world, house) ? segaStructureTech(id, house.id) : structureTechLevel(t, house.id);
  return tech !== null && tech <= techOf(house);
}

function levelOffered(world, house, factory, level) {
  if (level <= upgradeLevel(house, factory)) return true;
  if (isSega(world, house)) return segaLevelTech(factory, level, house.id) <= techOf(house);
  const t = STRUCTURES[factory];
  if (!t?.upgrades || level > t.upgrades.length || (house.id === 'harkonnen' && factory === 'hiTech')) return false;
  return ((t.upgradeTechByHouse?.[house.id] ?? t.upgradeTech ?? [])[level - 1] ?? 0) <= techOf(house);
}

function unitOffered(world, house, id) {
  const u = UNITS[id];
  if (!u || DEFERRED.has(id) || !offered(id, house.id)) return false;
  const sega = isSega(world, house), s = sega ? segaUnit(id, house.id) : null;
  if (sega && (!s || s.tech > techOf(house))) return false;
  const f = factoryOf(house, id);
  if (!f || !STRUCTURES[f]?.produces) return false;
  const req = sega ? s.requires : u.requires ?? [];
  return structureOffered(world, house, f) && req.every((r) => structureOffered(world, house, r)) && levelOffered(world, house, f, unitUpgrade(house, id));
}

/**
 * What the house still lacks for `typeId` (structure, unit or `upgrade:<factory>`), as names: "Radar Outpost",
 * "Heavy Factory level 3". `owned` and `levels` may assume more than the house has (what a building or an upgrade
 * leads to); `self` shortens "<self> level n" to "level n" in a factory's own list.
 */
export function missingFor(world, houseId, typeId, { owned = null, levels = {}, self = null } = {}) {
  const house = world.houses.get(houseId);
  if (!house) return [];
  const have = owned ?? ownedStructureTypes(world, houseId), sega = isSega(world, house);
  const lvl = (f) => levels[f] ?? upgradeLevel(house, f), name = (id) => STRUCTURES[id].name;
  const out = [];
  const add = (s) => { if (!out.includes(s)) out.push(s); };
  const level = (f, n) => add(f === self ? `level ${n}` : `${name(f)} level ${n}`);
  const up = upgradeTarget(typeId);
  if (up) {
    if (!have.has(up)) add(name(up));
    if (!sega) for (const r of STRUCTURES[up]?.upgradeRequires?.[upgradeLevel(house, up)] ?? []) if (!have.has(r)) add(name(r));
    return out;
  }
  const t = STRUCTURES[typeId];
  if (t) {
    if (!have.has('constructionYard')) add(name('constructionYard'));
    for (const r of t.requires ?? []) if (!have.has(r)) add(name(r));
    if (typeId !== 'windtrap' && !t.isConcrete && !have.has('windtrap')) add(name('windtrap'));   // implied for everything (tech.js)
    for (const [f, n] of Object.entries((sega ? SEGA_REQUIRES_UPGRADE[typeId] : t.requiresUpgrade) ?? {})) if (lvl(f) < n) level(f, n);
    return out;
  }
  const u = UNITS[typeId];
  if (!u) return out;
  const f = factoryOf(house, typeId), need = unitUpgrade(house, typeId);
  if (f && lvl(f) < need) level(f, need);   // "Hi-Tech Factory level 1" says the factory too
  else if (f && !have.has(f) && f !== self) add(name(f));
  for (const r of (sega ? segaUnit(typeId, house.id)?.requires : u.requires) ?? []) if (!have.has(r)) add(name(r));
  return out;
}

const entry = (world, houseId, id, opts) => ({ id, name: (STRUCTURES[id] ?? UNITS[id]).name, needs: missingFor(world, houseId, id, opts) });
/** What can be had now first, then what waits (a factory's own list: the nearest level first). */
const levelIn = (e) => Number(/level (\d+)/.exec(e.needs.join())?.[1] ?? 99);
const readyFirst = (list, byLevel = false) => {
  const waiting = list.filter((e) => e.needs.length);
  return [...list.filter((e) => !e.needs.length), ...(byLevel ? waiting.sort((a, b) => levelIn(a) - levelIn(b)) : waiting)];
};

/** A structure's own lists: the units it builds (with the levels they wait for) and what it leads to. */
function structureLists(world, house, typeId) {
  const have = new Set(ownedStructureTypes(world, house.id)).add(typeId), opts = { owned: have, self: typeId }, lists = [];
  const builds = UNIT_ORDER.filter((id) => factoryOf(house, id) === typeId && unitOffered(world, house, id)).map((id) => entry(world, house.id, id, opts));
  if (builds.length) lists.push({ label: 'Builds', items: readyFirst(builds, true) });
  const sega = isSega(world, house);
  const leads = [
    ...STRUCTURE_ORDER.filter((id) => STRUCTURES[id].requires?.includes(typeId) && structureOffered(world, house, id)),
    ...UNIT_ORDER.filter((id) => factoryOf(house, id) !== typeId && ((sega ? segaUnit(id, house.id)?.requires : UNITS[id].requires) ?? []).includes(typeId) && unitOffered(world, house, id)),
  ].map((id) => entry(world, house.id, id, opts));
  if (leads.length) lists.push({ label: 'Leads to', items: readyFirst(leads) });
  return lists;
}

// ---- what never changes for a type ----

const statics = new Map();

function speedText(t) {
  if (t.move === MOVE.AIR) return `${fmt(airSpeed(t.speed))} anywhere`;
  const on = (s) => fmt(groundSpeed(t.speed, moveFactor(s, t.move), t.move));
  return `${on(SURFACE.SAND)} sand · ${on(SURFACE.ROCK)} rock`;
}

/** The weapon row of a unit or turret: { name, text, short, tags }. */
function weaponOf(t) {
  if (!t.weapon || t.weapon === 'swallow') return null;
  const shot = shotFor(t.weapon, 1), far = shotFor(t.weapon, t.range), reload = `reload ${fireDelaySeconds(t.fireDelay).toFixed(1)} s`;
  const tags = [];
  let dmg = `${t.damage} damage`, short = `${t.damage} dmg`;
  if (shot.gas) [dmg, short] = [`turns units for ${DEVIATOR.seconds} s, no damage`, 'gas'];
  else if (shot.wave) [dmg, short] = [`${t.damage} damage, fading to ${Math.round(t.damage * (1 - SONIC.fade))}`, `${t.damage}→${Math.round(t.damage * (1 - SONIC.fade))} dmg`];
  else if (far.damageScale !== 1) [dmg, short] = [`${t.damage} damage, ${Math.round(t.damage * far.damageScale)} beyond 2 tiles`, `${t.damage} (${Math.round(t.damage * far.damageScale)} far) dmg`];
  if (t.firesTwice) tags.push('2 shots above half health');
  if (t.targetAir) tags.push('Anti-air');
  if (!far.accurate && !shot.gas) tags.push(shot.accurate ? 'Scatters beyond 2 tiles' : 'Scatters');
  else if (shot.accurate && !shot.wave) tags.push('Always hits');
  if (t.turret) tags.push('Fires on the move');
  const near = t.near ? ` · ${WEAPON_NAMES[t.near.weapon]} ${t.near.damage} within ${t.near.range} tiles` : '';
  return { name: WEAPON_NAMES[t.weapon] ?? t.weapon, text: `${dmg} · range ${t.range} · ${reload}${near}`, short: `${short} · range ${t.range} · ${reload}`, tags };
}

function unitAbilities(id, u) {
  const out = [];
  if (u.move === MOVE.TRACKED) out.push('Crushes infantry');
  if (canCapture({ typeId: id })) out.push(`Captures buildings below ${pct(CAPTURE_BELOW)} health`);
  if (u.deploysTo) out.push(`Deploys into a ${STRUCTURES[u.deploysTo].name}`);
  if (u.destructs) out.push('Can self-destruct, blasting everything close by');
  if (shotFor(u.weapon, 1)?.gas) out.push(`Turned units fight for you for ${DEVIATOR.seconds} s — not aircraft, ${DEVIATOR.immune.filter((i) => UNITS[i]?.cost).map((i) => `${UNITS[i].name}s`).join(', ')}`);
  if (shotFor(u.weapon, 1)?.wave) out.push('The wave hurts own units too — never Sonic Tanks');
  if (id === 'harvester') out.push(`Gathers ${HARVEST_CAPACITY} credits of spice a load`);
  if (id === 'carryall') out.push('Flies Harvesters to and from the spice, damaged vehicles to repairs');
  if (id === 'ornithopter') out.push('Hunts on its own when idle; never attacks aircraft');
  if (u.move === MOVE.AIR) out.push('Flies over everything');
  if (u.hunts) out.push('Hunt on their own; take no orders');
  if (u.sabotage) out.push(`Walks over walls; ${SABOTEUR.blast} damage to the building it reaches`);
  if (u.explodes) out.push(`Explodes when destroyed: ${DEATH_SPLASH.damage} damage around`);
  return out;
}

function structureAbilities(id, t) {
  const out = [];
  if (t.produces && t.produces !== 'structure') out.push('Each extra one builds 25 % faster, up to twice the speed');
  if (id === 'windtrap') out.push('Every building but concrete needs one');
  if (id === 'refinery') out.push('Comes with a free Harvester');
  if (id === 'repair') out.push(`Repairs a vehicle for ${pct(UNIT_REPAIR_COST)} of its price`);
  if (id === 'starport') out.push(`A Frigate brings orders in ${STARPORT.delivery} s; prices change every minute`);
  if (t.isConcrete) out.push('Buildings on bare rock lose up to half their health');
  if (t.isWall) out.push('Units shoot walls only when ordered to');
  if (t.weapon) out.push('Half rate of fire on low power');
  if (t.unique) out.push('One per house');
  if (t.conquerable) out.push(`Infantry can capture it below ${pct(CAPTURE_BELOW)} health`);
  return out;
}

/** The facts about a type that never change: role, stats, weapon, matchups, abilities. */
export function typeFacts(typeId) {
  if (statics.has(typeId)) return statics.get(typeId);
  const u = UNITS[typeId], t = STRUCTURES[typeId];
  let f = null;
  if (u) {
    const m = matchups(typeId);
    f = {
      role: ROLES[typeId] ?? '', hp: u.hp, speed: speedText(u), moveClass: CLASS_NAMES[u.move] ?? u.move, sight: unitSight(u.sight), weapon: weaponOf(u),
      strong: m?.strong ?? [], weak: m?.weak ?? [], unarmed: !m && !u.weapon, abilities: unitAbilities(typeId, u),
    };
  } else if (t) {
    const m = t.weapon ? matchups(typeId) : null;
    f = {
      role: ROLES[typeId] ?? '', hp: t.hp, size: `${t.w}×${t.h}`, sight: t.sight, power: -t.power, storage: t.storage ?? 0, weapon: weaponOf(t),
      strong: m?.strong ?? [], weak: m?.weak ?? [], unarmed: false, abilities: structureAbilities(typeId, t),
    };
  }
  statics.set(typeId, f);
  return f;
}

// ---- the tooltip ----

/** The line under the name: what the icon is doing and what a click does. */
export function statusLine(item, tip = null) {
  if (item.weapon) return item.ready ? `Ready — ${item.aim ? 'click, then pick a target' : 'click to send it out'}` : `Charging — ready in ${clock(item.seconds)}`;
  if (item.line === 'starport') return [item.note, item.state === 'locked' ? 'none to be had now' : item.state === 'idle' ? 'click to order' : 'right click cancels'].join(' · ');
  const done = Math.floor(item.progress * 100), more = item.count > 1 ? ` · ${item.count - 1} more on order` : '';
  switch (item.state) {
    case 'ready': return 'Ready — click to place';
    case 'building': {
      if (item.starved) return `Waiting for credits at ${done} %${more}`;
      const left = tip?.speed > 0 ? ` · ${Math.ceil(((1 - item.progress) * tip.base) / tip.speed)} s left` : '';
      return `Building ${done} %${left}${more}`;
    }
    case 'hold': return `On hold at ${done} % — click resumes, right click cancels`;
    case 'queued': return item.note ?? `${item.count} on order`;
    case 'locked': return 'Waits for the Construction Yard';
    default: return upgradeTarget(item.typeId) ? 'Click to upgrade' : item.line === 'structure' ? 'Click to build' : 'Click to build · Shift + click for five';
  }
}

/** The build time row: seconds at the line's speed now, with why it is faster or slower than one factory's pace. */
function timeOf(world, house, typeId, line) {
  const base = itemSeconds(typeId), speed = lineSpeed(world, house, line), notes = [];
  const n = factoriesFor(world, house.id, line).length;
  const factory = upgradeTarget(typeId) && line !== 'structure' ? upgradeTarget(typeId) : line === 'structure' ? 'constructionYard' : factoryOf(house, typeId);
  const kinds = new Set(factoriesFor(world, house.id, line).map((s) => s.typeId));
  const plural = kinds.size > 1 ? 'factories of this line' : PLURAL[factory] ?? 'factories';
  if (n > 1) notes.push({ text: `${n} ${plural}: ${pct(Math.min(2, 1 + 0.25 * (n - 1)) - 1)} faster${n >= 5 ? ' (the most)' : ''}`, tone: 'good' });
  else if (n === 1 && line !== 'structure') notes.push({ text: `Another ${STRUCTURES[factory]?.name ?? 'factory'} builds 25 % faster`, tone: null });
  if ((house.power?.ratio ?? 1) < 1) notes.push({ text: `Low power: ${pct(Math.max(0.25, house.power.ratio))} speed`, tone: 'bad' });
  return { base, speed, seconds: speed > 0 ? Math.round(base / speed) : Math.round(base), notes };
}

function unitBody(tip, typeId) {
  const f = typeFacts(typeId);
  tip.role = f.role;
  tip.stats.push({ icon: 'hp', label: 'Hit points', value: String(f.hp) }, { icon: 'class', label: 'Class', value: f.moveClass }, { icon: 'sight', label: 'Sight', value: `${f.sight} tiles` },
    { icon: 'speed', label: 'Speed', value: f.speed, note: 'tiles a second', wide: true });
  Object.assign(tip, { weapon: f.weapon, strong: f.strong, weak: f.weak, unarmed: f.unarmed, abilities: f.abilities });
}

function base(item, kind) {
  return { kind, typeId: item.typeId, icon: item.icon, name: item.name, role: '', cost: null, time: null, base: 0, speed: 0, stats: [], weapon: null, strong: [], weak: [], unarmed: false, abilities: [], lists: [], needs: [] };
}

const costOf = (house, value, note = null) => ({ value, note, short: house.credits < value });

/** The tooltip for a sidebar item (sidebar-model.js), built when the pointer comes to rest on its icon. */
export function tooltipModel(world, houseId, item) {
  const house = world.houses.get(houseId);
  if (!house || !item) return null;
  if (item.weapon) return weaponTip(world, house, item);
  const tip = base(item, 'unit');
  if (item.line === 'starport') {
    const id = item.typeId.slice('starport:'.length), list = UNITS[id].cost, d = item.cost / list - 1;
    tip.kind = 'ware';
    tip.cost = costOf(house, item.cost, Math.abs(d) < 0.005 ? 'list price' : `${d < 0 ? '' : '+'}${pct(d)} on the list price of ${list}`);
    tip.time = { base: STARPORT.delivery, speed: 1, seconds: STARPORT.delivery, notes: [{ text: `By Frigate, up to ${STARPORT.load} units a trip`, tone: null }], label: 'Delivery' };
    unitBody(tip, id);
    return tip;
  }
  const line = lineOfItem(item.typeId), up = upgradeTarget(item.typeId);
  tip.time = timeOf(world, house, item.typeId, line);
  tip.base = tip.time.base;
  tip.speed = tip.time.speed;
  tip.cost = costOf(house, item.cost ?? itemCost(house, item.typeId));
  tip.needs = missingFor(world, houseId, item.typeId);
  if (up) {
    const from = upgradeLevel(house, up), cur = house.lines[line]?.current?.typeId === item.typeId ? house.lines[line].current : null;
    const to = cur?.level ?? upgradeResult(house, up), top = maxUpgradeLevel(house, up);
    tip.kind = 'upgrade';
    tip.role = `All your ${PLURAL[up] ?? STRUCTURES[up].name} to level ${to}${top ? ` of ${top}` : ''}`;
    const opens = upgradeUnlocks(house, up, from, to).map((n) => NAME_TO_ID.get(n)).filter(Boolean);
    tip.lists.push({ label: `Level ${to} opens`, items: readyFirst(opens.map((id) => entry(world, houseId, id, { levels: { [up]: to }, owned: new Set(ownedStructureTypes(world, houseId)).add(up) }))) });
    tip.abilities.push('Starts at once; the item in hand waits and then carries on');
    return tip;
  }
  const t = STRUCTURES[item.typeId];
  if (t) {
    const f = typeFacts(item.typeId);
    tip.kind = 'structure';
    tip.role = f.role;
    if (f.power > 0) tip.stats.push({ icon: 'power', label: 'Power', value: `+${f.power}`, tone: 'good' });
    else if (f.power < 0) {
      const p = computePower(world, houseId), after = p.used - f.power;
      tip.stats.push({ icon: 'power', label: 'Power', value: `−${-f.power}`, note: `then ${after} of ${p.produced} in use${after > p.produced ? ' — low power' : ''}`, tone: after > p.produced ? 'bad' : null, wide: true });
    }
    if (f.storage) tip.stats.push({ icon: 'storage', label: 'Storage', value: `${f.storage} credits` });
    tip.stats.push({ icon: 'hp', label: 'Hit points', value: String(f.hp) }, { icon: 'size', label: 'Size', value: f.size });
    if (item.typeId === 'palace') {
      const w = HOUSES[houseId]?.palace;
      if (w) tip.abilities.push(`${PALACE.names[w]}, ready every ${clock(palaceRecharge(world, houseId))}`);
    }
    Object.assign(tip, { weapon: f.weapon, strong: f.strong, weak: f.weak });
    tip.abilities.push(...f.abilities);
    tip.lists.push(...structureLists(world, house, item.typeId));
    return tip;
  }
  unitBody(tip, item.typeId);
  return tip;
}

/** The Palace weapon's tooltip. */
function weaponTip(world, house, item) {
  const tip = base({ typeId: `palace:${item.weapon}`, icon: item.icon, name: item.name }, 'weapon');
  const full = palaceRecharge(world, house.id);
  tip.time = { base: full, speed: 1, seconds: full, notes: [], label: 'Recharge' };
  if (item.weapon === 'deathHand') {
    tip.role = 'Ballistic missile';
    tip.abilities.push(`Bursts in ${DEATH_HAND.pattern.length} blasts of up to ${DEATH_HAND.damage} damage`, `Lands up to ${DEATH_HAND.scatter} tiles off the aim`, 'Hurts friend and foe alike');
  } else if (item.weapon === 'fremen') {
    unitBody(tip, 'fremen');
    tip.role = 'Desert warriors called from the sand';
    tip.abilities = [`${FREMEN.squads} squads rise within ${FREMEN.reach} tiles of the chosen spot`, ...tip.abilities];
  } else if (item.weapon === 'saboteur') {
    unitBody(tip, 'saboteur');
    tip.role = 'Infiltrator who walks out beside the Palace';
    tip.abilities.push(`Hurts everything close by with ${SABOTEUR.splash} more`);
  }
  return tip;
}

// ---- the selection panel's compact facts ----

const compact = new Map();
/** Two short lines for a selected unit or turret (weapon; strong / weak), or [] for what has none. Kept per type. */
export function compactFacts(typeId) {
  if (compact.has(typeId)) return compact.get(typeId);
  const f = typeFacts(typeId), out = [];
  if (f?.weapon) out.push({ label: f.weapon.name, text: f.weapon.short, tone: null });
  if (f?.strong.length) out.push({ label: 'Strong', text: f.strong.join(', '), tone: 'good' });
  if (f?.weak.length) out.push({ label: 'Weak', text: f.weak.join(', '), tone: 'bad' });
  for (const x of out) Object.freeze(x);
  compact.set(typeId, Object.freeze(out));   // shared by every panel frame: never to be changed
  return out;
}

/** A factory's build speed in words for the selection panel: how many share its line and what low power takes off. */
export function lineSpeedText(world, houseId, typeId) {
  const line = Object.keys(LINE_FACTORIES).find((l) => LINE_FACTORIES[l].includes(typeId));
  const house = world.houses.get(houseId);
  if (!line || !house) return null;
  const n = factoriesFor(world, houseId, line).length, speed = lineSpeed(world, house, line) / (house.buildSpeed ?? 1);
  if (n <= 1 && speed >= 1) return line === 'structure' ? null : '100 % · another one adds 25 %';
  return `${pct(speed)}${n > 1 ? ` · ${n} on this line` : ''}${(house.power?.ratio ?? 1) < 1 ? ' · low power' : ''}`;
}
