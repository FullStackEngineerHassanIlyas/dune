// Computer opponent (spec §4.10): one brain per AI house, thinking once a second. It sees the whole map,
// as the original's AI does, but acts only through world.issue, exactly like a player. Economy first:
// deploy the MCV, stay ahead on power, follow the house's build order, keep two harvesters per refinery
// and add silos when storage runs full; no building goes up on the apron of a Refinery or Repair Facility
// (harvesters waiting and backing out in a narrow way in would lock horns). Then an army, rally points, base defence and attack waves. A
// charged Palace fires at once — the Death Hand and the Fremen at the richest enemy spot (the Death Hand
// only where its own army and base are clear of the blast), the Saboteur into the most valuable enemy
// building its blast brings down. A skirmish is a free-for-all: every other house is a rival, computer or
// not, and each wave picks its foe — near and weakly guarded first, a house that raided the base before others.
// A campaign mission allies every computer house against the player, as the original did (sim/alliance.js):
// allies are no rivals, targets or intruders.
import { STRUCTURES } from '../data/structures.js';
import { G } from '../data/terrain.js';
import { computePower, builtStorage } from './economy.js';
import { canBuild, buildOptions, lineOfItem, upgradeId, upgradeLevel, upgradeCost, offered, UNIT_ORDER } from './tech.js';
import { UNITS, MOVE } from '../data/units.js';
import { DEFERRED } from '../data/phase.js';
import { isArmed, distanceTo } from './combat.js';
import { findPlacement } from './placement.js';
import { deploySpot } from './deploy.js';
import { needsRepair } from './repair-bay.js';
import { dockTile } from './harvest.js';
import { palaceReady, palaceWeapon } from './palace.js';
import { DEATH_HAND, SABOTEUR } from '../data/tuning.js';
import { friendly } from './alliance.js';

export const DIFFICULTY = {
  easy:   { buildSpeed: 0.7, income: 1, firstAttack: 480, waveEvery: 180, waveBase: 3, waveGrow: 1, waveMax: 10, armyCap: 12, turrets: 1, reserve: 300 },
  normal: { buildSpeed: 1, income: 1, firstAttack: 300, waveEvery: 150, waveBase: 4, waveGrow: 1.5, waveMax: 14, armyCap: 20, turrets: 2, reserve: 200 },
  hard:   { buildSpeed: 1.25, income: 1.5, firstAttack: 210, waveEvery: 120, waveBase: 5, waveGrow: 2, waveMax: 18, armyCap: 28, turrets: 4, reserve: 100 },
};

/** Units the AI commands in its army: Fremen hunt on their own and Saboteurs have their own work. */
const fighter = (u) => isArmed(u.type) && !u.type.autonomous && !u.type.sabotage;

export const BUILD_ORDER = {
  atreides:  ['windtrap', 'refinery', 'windtrap', 'outpost', 'barracks', 'windtrap', 'heavyFactory', 'silo', 'refinery', 'repair', 'hiTech', 'windtrap'],
  harkonnen: ['windtrap', 'refinery', 'windtrap', 'outpost', 'wor', 'windtrap', 'heavyFactory', 'silo', 'refinery', 'repair', 'hiTech', 'windtrap'],
  ordos:     ['windtrap', 'refinery', 'windtrap', 'outpost', 'barracks', 'windtrap', 'heavyFactory', 'silo', 'refinery', 'repair', 'hiTech', 'windtrap'],
  sardaukar: ['windtrap', 'refinery', 'windtrap', 'outpost', 'barracks', 'windtrap', 'heavyFactory', 'silo', 'refinery', 'wor', 'repair', 'hiTech', 'windtrap'],   // troopers once the WOR opens
  mercenary: ['windtrap', 'refinery', 'windtrap', 'outpost', 'barracks', 'windtrap', 'heavyFactory', 'silo', 'refinery', 'repair', 'hiTech', 'windtrap'],
};

const NO_ROOM_RETRY = 60;   // seconds before a structure that found no spot is tried again

/**
 * A computer house's brain at a difficulty. A campaign mission (game/mission-setup.js) tunes it further with
 * `mission` = { firstAttack, attackEvery (seconds), buildSpeed, incomeRate, passive (no attack waves) }: those
 * go into brain.params over the difficulty's own, so the skirmish's DIFFICULTY table keeps its three presets.
 */
export function createBrain(world, houseId, difficulty = 'normal', mission = null) {
  const house = world.houses.get(houseId);
  const level = DIFFICULTY[difficulty] ? difficulty : 'normal';
  const d = mission ? missionParams(DIFFICULTY[level], mission) : DIFFICULTY[level];
  house.isAI = true;
  house.buildSpeed = d.buildSpeed;
  house.incomeRate = d.income;
  house.brain = { difficulty: level, noRoom: {}, rallied: [], wave: [], waveFoe: {}, waves: 0, nextAttack: d.passive ? Infinity : d.firstAttack, commands: 0 };
  if (mission) house.brain.params = d;
  return house.brain;
}

const num = (v) => typeof v === 'number' && Number.isFinite(v);

function missionParams(d, m) {
  const p = { ...d, passive: !!m.passive };
  if (num(m.firstAttack)) p.firstAttack = Math.max(0, m.firstAttack);
  if (num(m.attackEvery)) p.waveEvery = Math.max(10, m.attackEvery);
  if (num(m.buildSpeed)) p.buildSpeed = Math.max(0.1, m.buildSpeed);
  if (num(m.incomeRate)) p.income = Math.max(0, m.incomeRate);
  return p;
}

/** What a brain plays by: its mission's parameters, else its difficulty's. */
const tuning = (house) => house.brain.params ?? DIFFICULTY[house.brain.difficulty];

export function updateAI(world) {
  for (const house of world.houses.values()) if (house.brain && !house.defeated) think(world, house);
}

function issue(world, house, cmd) {
  house.brain.commands++;
  world.issue(house.id, cmd);
}

function survey(world, house) {
  const mine = [], units = [], count = {};
  for (const s of world.structures.values()) if (s.house === house.id) { mine.push(s); count[s.typeId] = (count[s.typeId] ?? 0) + 1; }
  for (const u of world.units.values()) if (u.house === house.id) units.push(u);
  const yard = mine.find((s) => s.typeId === 'constructionYard') ?? null;
  const anchor = yard ?? mine[0] ?? null;
  return { mine, units, count, yard, home: anchor ? { x: anchor.x + 1, y: anchor.y + 1 } : null };
}

function think(world, house) {
  const view = survey(world, house);
  if (!view.yard) {
    if (view.units.some((u) => u.type.deploysTo)) deployMcv(world, house, view);
    else rebuildMcv(world, house, view);
  }
  else buildBase(world, house, view);
  keepHarvesters(world, house, view);
  keepCarryall(world, house, view);
  if (!view.home) return;
  const rebuilding = !view.yard && !view.units.some((u) => u.type.deploysTo);
  if (!rebuilding) { buyUpgrades(world, house, view); buildArmy(world, house, view); }   // the new MCV comes first
  rally(world, house, view);
  const repairing = sendForRepairs(world, house, view);
  const defending = defend(world, house, view, repairing);
  attack(world, house, view, defending);
  usePalace(world, house, view);
  sabotage(world, house, view);
}

function deployMcv(world, house, view) {
  const mcv = view.units.find((u) => u.type.deploysTo);
  if (!mcv || mcv.order.type === 'deploy' || mcv.step || mcv.pathState !== 'none') return;
  if (deploySpot(world, mcv)) { issue(world, house, { type: 'deploy', ids: [mcv.id] }); return; }
  const map = world.map;
  for (let k = 0; k < 12; k++) {   // drive to open rock nearby and try again there
    const x = mcv.tx + world.rng.int(11) - 5, y = mcv.ty + world.rng.int(11) - 5;
    if (!map.inBounds(x, y)) continue;
    const i = map.idx(x, y);
    if (map.ground[i] === G.ROCK && !map.unit[i] && !map.structure[i]) { issue(world, house, { type: 'move', ids: [mcv.id], x, y }); return; }
  }
}

/** Where to send an attack: below the nearest enemy building (reachable ground), else the nearest enemy unit;
 *  with `only`, that house's alone. A sandworm belongs to no house in the game and is nobody's target. */
export function nearestEnemyTarget(world, houseId, x, y, only = null) {
  let best = null, bestD = Infinity;
  const skip = (h) => friendly(world, h, houseId) || (only !== null && h !== only) || !world.houses.has(h);
  for (const s of world.structures.values()) {
    if (skip(s.house) || s.type.isWall) continue;
    const d = Math.hypot(s.x + s.w / 2 - x, s.y + s.h / 2 - y);
    if (d < bestD) { bestD = d; best = { x: s.x + Math.floor(s.w / 2), y: Math.min(world.map.h - 1, s.y + s.h) }; }
  }
  if (best) return best;
  for (const u of world.units.values()) {
    if (skip(u.house) || !u.isGround) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d < bestD) { bestD = d; best = { x: u.tx, y: u.ty }; }
  }
  return best;
}

/**
 * Every other house still in the game (a free-for-all: computers fight each other too), sized up from `from`:
 * how far its nearest building is (its nearest ground unit when it has none), where to aim at it, and what its
 * armed units and turrets are worth. The AI sees through the shroud, as the original's does.
 */
export function sizeUpRivals(world, houseId, from) {
  const rivals = new Map();
  for (const h of world.houses.values()) if (!friendly(world, h.id, houseId) && !h.defeated) rivals.set(h.id, { house: h.id, d: Infinity, at: null, army: 0, ud: Infinity, uat: null });
  for (const s of world.structures.values()) {
    const r = rivals.get(s.house);
    if (!r || s.type.isWall) continue;
    if (s.type.weapon) r.army += s.type.cost;
    const d = Math.hypot(s.x + s.w / 2 - from.x, s.y + s.h / 2 - from.y);
    if (d < r.d) { r.d = d; r.at = { x: s.x + Math.floor(s.w / 2), y: Math.min(world.map.h - 1, s.y + s.h) }; }
  }
  for (const u of world.units.values()) {
    const r = rivals.get(u.house);
    if (!r) continue;
    if (fighter(u)) r.army += u.type.cost;
    const d = u.isGround ? Math.hypot(u.x - from.x, u.y - from.y) : Infinity;
    if (d < r.ud) { r.ud = d; r.uat = { x: u.tx, y: u.ty }; }
  }
  const out = [];
  for (const r of rivals.values()) {
    if (!r.at) { r.d = r.ud; r.at = r.uat; }
    if (r.at) out.push({ house: r.house, d: r.d, at: r.at, army: r.army });
  }
  return out;
}

const GRUDGE = 120;   // seconds a raid on the base is remembered

/**
 * The house the next wave goes for: the nearest, unless it is much better guarded than the wave is strong —
 * a bare rival a little further off comes first — and a house that raided the base lately before the others.
 * The last foe keeps a small edge, so waves do not swap targets on a whim.
 */
function chooseFoe(world, house, view, strength) {
  const b = house.brain;
  let best = null, bestCost = Infinity;
  for (const r of sizeUpRivals(world, house.id, view.home)) {
    let cost = r.d * (0.5 + r.army / (r.army + strength + 1));
    if (b.grudge?.house === r.house && world.time - b.grudge.at < GRUDGE) cost *= 0.5;
    if (r.house === b.foe) cost *= 0.8;
    if (cost < bestCost) { bestCost = cost; best = r; }
  }
  b.foe = best?.house ?? null;
  return best;
}

/** A point `reach` tiles from home towards the nearest rival's base (the map centre when there is none). */
function towardsEnemy(world, house, view, reach) {
  let foe = { x: world.map.w / 2, y: world.map.h / 2 }, bestD = Infinity;
  for (const r of sizeUpRivals(world, house.id, view.home)) if (r.d < bestD) { bestD = r.d; foe = r.at; }
  const dx = foe.x - view.home.x, dy = foe.y - view.home.y, d = Math.hypot(dx, dy) || 1;
  return { x: Math.round(view.home.x + (dx / d) * reach), y: Math.round(view.home.y + (dy / d) * reach) };
}

function buildBase(world, house, view) {
  const b = house.brain;
  const item = house.lines.structure.current;
  if (item?.state === 'ready') {
    const turret = item.typeId === 'turret' || item.typeId === 'rocketTurret';
    const anchor = turret ? towardsEnemy(world, house, view, 6) : view.home;
    const spot = findPlacement(world, house.id, item.typeId, anchor.x, anchor.y, 12, keepsWaysIn(world, house.id, item.typeId));
    if (spot) issue(world, house, { type: 'place', typeId: item.typeId, x: spot.x, y: spot.y });
    else { b.noRoom[item.typeId] = world.time; issue(world, house, { type: 'hold', typeId: item.typeId }); }   // a ready structure cancels at once, refunded
    return;
  }
  if (item) return;
  const next = nextStructure(world, house, view);
  if (next) {
    if (house.credits >= Math.min(STRUCTURES[next].cost, 150)) issue(world, house, { type: 'build', typeId: next });
    return;
  }
  const yardUp = upgradeId('constructionYard');   // the base stands: the yard upgrades that lead to Rocket Turrets
  if (view.count.heavyFactory && canBuild(world, house.id, yardUp) && house.credits >= upgradeCost(house, 'constructionYard') + tuning(house).reserve) issue(world, house, { type: 'build', typeId: yardUp });
}

const WAY_OUT = 8;   // tiles an entrance must lead out, past the rest of the base
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Does ground tile `from` lead WAY_OUT tiles away for a vehicle, around buildings and the footprint `covers`? */
function leadsOut(map, from, covers = () => false) {
  const fx = map.xOf(from), fy = map.yOf(from);
  const pass = (i, x, y) => map.moveFactor(i, 'harvester') > 0 && !map.structure[i] && !covers(x, y);
  if (!pass(from, fx, fy)) return false;
  const seen = new Set([from]), queue = [from];
  for (let k = 0; k < queue.length; k++) {
    const x = map.xOf(queue[k]), y = map.yOf(queue[k]);
    if (Math.max(Math.abs(x - fx), Math.abs(y - fy)) >= WAY_OUT) return true;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy, j = map.inBounds(nx, ny) ? map.idx(nx, ny) : -1;
      if (j >= 0 && !seen.has(j) && pass(j, nx, ny)) { seen.add(j); queue.push(j); }
    }
  }
  return false;
}

/**
 * A placement test for a building of `typeId`: it may not go up on the apron of one of the house's
 * Refineries or Repair Facilities — the entrance, the tile straight out of it (where a harvester backs
 * out) and the tiles either side of both, room for the others to wait and pass — nor shut an entrance in;
 * a new one needs its own apron clear and an entrance that leads out.
 */
export function keepsWaysIn(world, houseId, typeId) {
  const map = world.map, t = STRUCTURES[typeId], aprons = [];
  if (!t || t.isConcrete) return () => true;
  const apron = (x, y) => {   // entrances face south
    const out = [];
    for (let dy = 0; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (map.inBounds(x + dx, y + dy)) out.push(map.idx(x + dx, y + dy));
    return out;
  };
  for (const s of world.structures.values()) {
    if (s.house !== houseId || !s.type.entrance) continue;
    const door = dockTile(world, s);
    if (door < 0 || !leadsOut(map, door)) continue;   // one already shut in has nothing left to keep
    aprons.push({ door, open: apron(map.xOf(door), map.yOf(door)).filter((i) => !map.structure[i]) });
  }
  return (x, y) => {
    const covers = (tx, ty) => tx >= x && tx < x + t.w && ty >= y && ty < y + t.h;
    const clear = (i) => !covers(map.xOf(i), map.yOf(i));
    if (t.entrance) {
      const ex = x + t.entrance[0], ey = y + t.entrance[1];
      if (!map.inBounds(ex, ey + 1) || apron(ex, ey).some((i) => map.structure[i]) || !leadsOut(map, map.idx(ex, ey + 1), covers)) return false;
    }
    return aprons.every((a) => a.open.every(clear) && leadsOut(map, a.door, covers));
  };
}

/** The next building: a Wind Trap whenever the margin is thin or the building due would use more than is spare. */
function nextStructure(world, house, view) {
  const b = house.brain, id = house.id;
  const can = (t) => canBuild(world, id, t) && world.time - (b.noRoom[t] ?? -1e9) >= NO_ROOM_RETRY;
  const power = computePower(world, id);
  if (power.produced < power.used + 20 && can('windtrap')) return 'windtrap';
  const t = wantedStructure(world, house, view, can);
  return t && power.produced < power.used + STRUCTURES[t].power && can('windtrap') ? 'windtrap' : t;
}

function wantedStructure(world, house, view, can) {
  const id = house.id, d = tuning(house);
  const has = (t) => view.count[t] ?? 0;
  const need = {};
  for (const t of BUILD_ORDER[id] ?? BUILD_ORDER.atreides) {
    need[t] = (need[t] ?? 0) + 1;
    if (has(t) < need[t] && can(t)) return t;
  }
  if (house.credits > Math.max(builtStorage(world, id), house.startBuffer ?? 0) * 0.8 && has('silo') < 4 && can('silo')) return 'silo';
  if (has('heavyFactory') && has('turret') + has('rocketTurret') < d.turrets) {
    if (can('rocketTurret')) return 'rocketTurret';
    if (can('turret')) return 'turret';
  }
  if (has('refinery') < 3 && view.units.filter((u) => u.typeId === 'harvester').length >= 2 * has('refinery') && can('refinery')) return 'refinery';
  if (has('heavyFactory') && has('turret') + has('rocketTurret') >= d.turrets) {   // defences first; the Starport only as the way to IX and the Palace
    if (ixOpensSomething(id) && !has('starport') && can('starport')) return 'starport';
    if (ixOpensSomething(id) && has('starport') && !has('ix') && can('ix')) return 'ix';
    if (has('ix') && !has('palace') && can('palace')) return 'palace';
  }
  return null;
}

/** The House of IX is worth building only when it opens a unit the house can use (the AI never shops at the Starport). */
const ixOpensSomething = (houseId) => UNIT_ORDER.some((t) => UNITS[t].requires?.includes('ix') && offered(t, houseId) && !DEFERRED.has(t));

function keepHarvesters(world, house, view) {
  const refineries = view.count.refinery ?? 0;
  if (!refineries || !view.count.heavyFactory) return;
  const heavy = house.lines.heavy;
  const queued = (heavy.current?.typeId === 'harvester' ? 1 : 0) + heavy.queue.filter((t) => t === 'harvester').length;
  const have = view.units.filter((u) => u.typeId === 'harvester').length;
  if (have + queued < Math.min(6, 2 * refineries) && house.credits >= 300 && canBuild(world, house.id, 'harvester')) issue(world, house, { type: 'build', typeId: 'harvester' });
}

/** One Carryall of its own for ferrying, never more (the original's AI rule). */
function keepCarryall(world, house, view) {
  if (!view.count.hiTech) return;
  const air = house.lines.air;
  const queued = (air.current?.typeId === 'carryall' ? 1 : 0) + air.queue.filter((t) => t === 'carryall').length;
  const have = view.units.filter((u) => u.typeId === 'carryall' && !u.visitor).length;
  if (have + queued >= 1 || house.credits < 800 + tuning(house).reserve || !canBuild(world, house.id, 'carryall')) return;
  issue(world, house, { type: 'build', typeId: 'carryall' });
}

export const ARMY_WEIGHTS = { sonicTank: 3, devastator: 2, deviator: 2, ornithopter: 3, combatTank: 6, siegeTank: 3, missileTank: 3, quad: 2, trike: 2, raider: 2, infantry: 2, troopers: 2, soldier: 1, trooper: 1 };
const FACTORIES = ['barracks', 'wor', 'heavyFactory'];

function weightedPick(rng, pool) {
  let r = rng.next() * pool.reduce((n, t) => n + ARMY_WEIGHTS[t], 0);
  for (const t of pool) if ((r -= ARMY_WEIGHTS[t]) < 0) return t;
  return pool[pool.length - 1];
}

export const LIGHT_SHARE = 1 / 3;   // of the vehicles in the field: the one vehicle factory keeps light ones coming

/** The vehicle line's pick: a light vehicle whenever they make up less than a third of the army's vehicles, else a tank. */
function vehicleChoice(view, pool) {
  const wheeled = (t) => UNITS[t].move === MOVE.WHEELED;
  const vehicles = view.units.filter((u) => fighter(u) && u.type.builtAt === 'heavyFactory');
  const light = vehicles.filter((u) => wheeled(u.typeId)).length < LIGHT_SHARE * (vehicles.length + 1);
  const want = pool.filter((t) => wheeled(t) === light);
  return want.length ? want : pool;
}

function buildArmy(world, house, view) {
  const d = tuning(house);
  if (view.units.filter(fighter).length >= d.armyCap) return;
  const options = buildOptions(world, house.id);
  for (const line of ['heavy', 'infantry', 'air']) {
    const l = house.lines[line];
    if (l.current || l.queue.length || house.credits < d.reserve) continue;
    const pool = options[line].filter((t) => ARMY_WEIGHTS[t]);
    if (pool.length) issue(world, house, { type: 'build', typeId: weightedPick(world.rng, line === 'heavy' ? vehicleChoice(view, pool) : pool) });
  }
}

const FACTORY_UPGRADES = ['heavyFactory', 'barracks', 'wor', 'hiTech'];   // what the army needs, most useful first

/** Factory upgrades open better units: one new purchase per think, saving up for the most useful one. */
function buyUpgrades(world, house, view) {
  const d = tuning(house);
  for (const type of FACTORY_UPGRADES) {
    const id = upgradeId(type);
    if (!view.count[type] || !canBuild(world, house.id, id)) continue;
    const l = house.lines[lineOfItem(id)];
    if (l.current?.typeId === id || l.queue.includes(id)) continue;   // already under way
    if (house.credits < upgradeCost(house, type) + d.reserve) return;
    issue(world, house, { type: 'build', typeId: id });
    return;
  }
}

function rally(world, house, view) {
  const b = house.brain;
  let spot = null;
  for (const s of view.mine) {
    if (!FACTORIES.includes(s.typeId) || b.rallied.includes(s.id)) continue;
    b.rallied.push(s.id);
    spot ??= towardsEnemy(world, house, view, 5);
    issue(world, house, { type: 'setRally', structureId: s.id, x: spot.x, y: spot.y });
  }
}

function defend(world, house, view, repairing = []) {
  const b = house.brain;
  let intruder = null, best = 10;
  for (const u of world.units.values()) {
    if (friendly(world, u.house, house.id) || !u.isGround || u.inside || !world.houses.has(u.house)) continue;   // a vehicle in a repair bay is no intruder, nor a worm or an ally
    for (const s of view.mine) {
      const d = Math.hypot(u.x - s.x - s.w / 2, u.y - s.y - s.h / 2);
      if (d < best) { best = d; intruder = u; }
    }
  }
  if (!intruder) return [];
  b.grudge = { house: intruder.house, at: world.time };   // the next wave pays them back
  const ids = view.units
    .filter((u) => fighter(u) && !b.wave.includes(u.id) && u.order.type !== 'attack' && u.order.type !== 'repairAt' && !repairing.includes(u.id) && !u.inside && Math.hypot(u.x - intruder.x, u.y - intruder.y) < 24)
    .map((u) => u.id);
  if (ids.length) issue(world, house, { type: 'attack', ids, targetKind: 'unit', targetId: intruder.id });
  return ids;
}

const REPAIR_BELOW = 0.5, RETREAT_BELOW = 0.3;

/** Worn vehicles go to the Repair Facility: resting ones below half health, any below 30 % (they leave their wave). */
function sendForRepairs(world, house, view) {
  const bay = view.mine.find((s) => s.typeId === 'repair');
  if (!bay) return [];
  const b = house.brain;
  const ids = [];
  for (const u of view.units) {
    if (!needsRepair(u) || u.order.type === 'repairAt' || u.type.deploysTo) continue;
    const worn = u.hp / u.maxHp;
    const resting = u.order.type === 'idle' || u.order.type === 'guard' || u.order.type === 'harvest';
    if (worn < RETREAT_BELOW || (resting && worn < REPAIR_BELOW)) ids.push(u.id);
  }
  if (!ids.length) return ids;
  b.wave = b.wave.filter((id) => !ids.includes(id));
  issue(world, house, { type: 'repairAt', ids, structureId: bay.id });
  return ids;
}

function attack(world, house, view, defending = []) {
  const b = house.brain, d = tuning(house);
  b.wave = b.wave.filter((id) => world.units.get(id)?.house === house.id);   // lost, or turned by gas
  const idle = b.wave.map((id) => world.units.get(id)).filter((u) => u.order.type === 'idle' || (!u.isGround && u.order.type === 'guard'));   // aircraft end a move on guard
  if (b.foe && world.houses.get(b.foe)?.defeated) b.foe = null;
  if (idle.length && world.time >= (b.huntAt ?? 0)) {   // wave members that stopped hunt the next target, their own wave's foe first (at most every 10 s)
    b.huntAt = world.time + 10;
    const byFoe = new Map();   // a later wave may have gone for another house: each keeps to its own
    for (const u of idle) {
      const own = b.waveFoe[u.id], foe = own && !world.houses.get(own)?.defeated ? own : null;
      if (byFoe.has(foe)) byFoe.get(foe).push(u); else byFoe.set(foe, [u]);
    }
    for (const [foe, members] of byFoe) hunt(world, house, members, foe);
  }
  if (world.time < b.nextAttack) return;
  const size = Math.min(d.waveMax, Math.round(d.waveBase + d.waveGrow * b.waves));
  const ready = view.units.filter((u) => fighter(u) && !u.garrison && !b.wave.includes(u.id) && !defending.includes(u.id) && (u.order.type === 'idle' || u.order.type === 'guard'));   // not the ones just sent at an intruder, nor a mission's posted guards
  if (ready.length < size) { b.nextAttack = world.time + 15; return; }
  const units = ready.slice(0, size);
  const foe = chooseFoe(world, house, view, units.reduce((n, u) => n + u.type.cost, 0));
  if (!foe) return;
  const group = units.map((u) => u.id), target = foe.at;
  issue(world, house, { type: 'attackMove', ids: group, x: target.x, y: target.y });
  b.waveFoe = Object.fromEntries(b.wave.map((id) => [id, b.waveFoe[id]]));   // forget the fallen
  b.wave.push(...group);
  for (const id of group) b.waveFoe[id] = foe.house;
  b.waves++;
  b.nextAttack = world.time + d.waveEvery;
  world.events.push('aiAttack', { house: house.id, target: foe.house, size: group.length, x: target.x, y: target.y });
}

/** Idle members of one wave go for the nearest target of their foe (any rival's, when it is beaten). */
function hunt(world, house, members, foe) {
  const lead = members[0], ids = members.map((u) => u.id);
  const t = (foe && nearestEnemyTarget(world, house.id, lead.x, lead.y, foe)) || nearestEnemyTarget(world, house.id, lead.x, lead.y);
  const stuckShort = t && Math.hypot(t.x + 0.5 - lead.x, t.y + 0.5 - lead.y) > lead.type.range + 2;
  const wall = stuckShort ? nearestEnemyWall(world, house.id, lead.x, lead.y, 8) : null;   // walls in the way: break through
  if (wall) issue(world, house, { type: 'attack', ids, targetKind: 'structure', targetId: wall.id });
  else if (t) issue(world, house, { type: 'attackMove', ids, x: t.x, y: t.y });
}

function nearestEnemyWall(world, houseId, x, y, radius) {
  let best = null, bestD = radius;
  for (const s of world.structures.values()) {
    if (friendly(world, s.house, houseId) || !s.type.isWall) continue;
    const d = Math.hypot(s.x + 0.5 - x, s.y + 0.5 - y);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

/** Without a Construction Yard or an MCV the base cannot grow: buy an MCV (after the upgrades that open it) and deploy it. */
function rebuildMcv(world, house, view) {
  const heavy = house.lines.heavy;
  if (!view.count.heavyFactory || heavy.current?.typeId === 'mcv' || heavy.queue.includes('mcv')) return;
  if (canBuild(world, house.id, 'mcv')) { issue(world, house, { type: 'build', typeId: 'mcv' }); return; }   // queued behind the current item and paid as it builds
  const up = upgradeId('heavyFactory');
  if (upgradeLevel(house, 'heavyFactory') < UNITS.mcv.upgrade && canBuild(world, house.id, up) && heavy.current?.typeId !== up && !heavy.queue.includes(up)) issue(world, house, { type: 'build', typeId: up });
}

/** The richest spot to hit: enemy buildings and ground units valued at their cost, summed within 2.5 tiles.
 *  With `spare`, no spot within that many tiles of the house's own units or buildings; null when there is none. */
export function richestTarget(world, houseId, spare = 0) {
  const things = [], own = [];
  for (const s of world.structures.values()) {
    if (s.type.isWall) continue;
    if (!friendly(world, s.house, houseId)) things.push({ x: s.x + s.w / 2, y: s.y + s.h / 2, value: s.type.cost });
    else if (spare) own.push({ kind: 'structure', entity: s });
  }
  for (const u of world.units.values()) {
    if (!u.isGround || u.inside) continue;
    if (!friendly(world, u.house, houseId)) things.push({ x: u.x, y: u.y, value: u.type.cost });
    else if (spare) own.push({ kind: 'unit', x: u.x, y: u.y });
  }
  let best = null, bestValue = 0;
  for (const c of things) {
    if (spare && own.some((o) => distanceTo(c.x, c.y, o, o) <= spare)) continue;   // friends in the blast
    let v = 0;
    for (const o of things) if (Math.hypot(o.x - c.x, o.y - c.y) <= 2.5) v += o.value;
    if (v > bestValue) { bestValue = v; best = c; }
  }
  return best && { x: Math.floor(best.x), y: Math.floor(best.y) };
}

/** How far from the aim the Death Hand can hurt: its scatter, the reach of its blast pattern and each blast's falloff. */
const DEATH_HAND_REACH = DEATH_HAND.scatter + DEATH_HAND.radius + Math.max(...DEATH_HAND.pattern.map(([dx, dy]) => Math.hypot(dx, dy)));

/** A charged Palace fires at once (spec §4.10); a launch that was refused is tried again after ten seconds. */
function usePalace(world, house, view) {
  const b = house.brain, s = view.mine.find((x) => x.typeId === 'palace');
  if (!palaceReady(world, s) || world.time < (b.palaceAt ?? 0)) return;
  b.palaceAt = world.time + 10;
  if (palaceWeapon(house.id) === 'saboteur') { issue(world, house, { type: 'palace' }); return; }
  const t = richestTarget(world, house.id, palaceWeapon(house.id) === 'deathHand' ? DEATH_HAND_REACH : 0);   // Fremen hurt only the enemy
  if (t) issue(world, house, { type: 'palace', x: t.x, y: t.y });
}

/** Saboteurs head for the most valuable enemy building their blast brings down (any, when none is that weak), the nearest of equals. */
function sabotage(world, house, view) {
  for (const u of view.units) {
    if (!u.type.sabotage || u.order.type === 'sabotage') continue;
    let best = null, bestD = Infinity, bestFalls = false;
    for (const s of world.structures.values()) {
      if (friendly(world, s.house, house.id) || s.type.isWall) continue;
      const d = Math.hypot(s.x + s.w / 2 - u.x, s.y + s.h / 2 - u.y), falls = s.hp <= SABOTEUR.blast;
      const better = !best || (falls !== bestFalls ? falls : s.type.cost > best.type.cost || (s.type.cost === best.type.cost && d < bestD));
      if (better) { best = s; bestD = d; bestFalls = falls; }
    }
    if (best) issue(world, house, { type: 'sabotage', ids: [u.id], structureId: best.id });
  }
}
