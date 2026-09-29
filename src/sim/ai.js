// Computer opponent (spec §4.10): one brain per AI house, thinking once a second. It sees the whole map,
// as the original's AI does, but acts only through world.issue, exactly like a player. Economy first:
// deploy the MCV, stay ahead on power, follow the house's build order, keep two harvesters per refinery
// and add silos when storage runs full. Then an army, rally points, base defence and attack waves.
import { STRUCTURES } from '../data/structures.js';
import { G } from '../data/terrain.js';
import { computePower, builtStorage } from './economy.js';
import { canBuild, buildOptions, lineOfItem, upgradeId, upgradeLevel, upgradeCost } from './tech.js';
import { isArmed } from './combat.js';
import { findPlacement } from './placement.js';
import { deploySpot } from './deploy.js';

export const DIFFICULTY = {
  easy:   { buildSpeed: 0.7, income: 1, firstAttack: 480, waveEvery: 180, waveBase: 3, waveGrow: 1, waveMax: 10, armyCap: 12, turrets: 1, reserve: 300 },
  normal: { buildSpeed: 1, income: 1, firstAttack: 300, waveEvery: 150, waveBase: 4, waveGrow: 1.5, waveMax: 14, armyCap: 20, turrets: 2, reserve: 200 },
  hard:   { buildSpeed: 1.25, income: 1.5, firstAttack: 210, waveEvery: 120, waveBase: 5, waveGrow: 2, waveMax: 18, armyCap: 28, turrets: 4, reserve: 100 },
};

export const BUILD_ORDER = {
  atreides:  ['windtrap', 'refinery', 'windtrap', 'outpost', 'barracks', 'lightFactory', 'windtrap', 'heavyFactory', 'silo', 'refinery', 'windtrap'],
  harkonnen: ['windtrap', 'refinery', 'windtrap', 'outpost', 'wor', 'lightFactory', 'windtrap', 'heavyFactory', 'silo', 'refinery', 'windtrap'],
  ordos:     ['windtrap', 'refinery', 'windtrap', 'outpost', 'barracks', 'lightFactory', 'windtrap', 'heavyFactory', 'silo', 'refinery', 'windtrap'],
};

const NO_ROOM_RETRY = 60;   // seconds before a structure that found no spot is tried again

export function createBrain(world, houseId, difficulty = 'normal') {
  const house = world.houses.get(houseId);
  const level = DIFFICULTY[difficulty] ? difficulty : 'normal';
  const d = DIFFICULTY[level];
  house.isAI = true;
  house.buildSpeed = d.buildSpeed;
  house.incomeRate = d.income;
  house.brain = { difficulty: level, noRoom: {}, rallied: [], wave: [], waves: 0, nextAttack: d.firstAttack, commands: 0 };
  return house.brain;
}

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
  if (!view.home) return;
  const rebuilding = !view.yard && !view.units.some((u) => u.type.deploysTo);
  if (!rebuilding) { buyUpgrades(world, house, view); buildArmy(world, house, view); }   // the new MCV comes first
  rally(world, house, view);
  defend(world, house, view);
  attack(world, house, view);
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

export function enemyCentre(world, houseId) {
  let sx = 0, sy = 0, n = 0;
  for (const s of world.structures.values()) if (s.house !== houseId && !s.type.isWall) { sx += s.x + s.w / 2; sy += s.y + s.h / 2; n++; }
  if (!n) for (const u of world.units.values()) if (u.house !== houseId && u.isGround) { sx += u.x; sy += u.y; n++; }
  return n ? { x: sx / n, y: sy / n } : null;
}

/** Where to send an attack: below the nearest enemy building (reachable ground), else the nearest enemy unit. */
export function nearestEnemyTarget(world, houseId, x, y) {
  let best = null, bestD = Infinity;
  for (const s of world.structures.values()) {
    if (s.house === houseId || s.type.isWall) continue;
    const d = Math.hypot(s.x + s.w / 2 - x, s.y + s.h / 2 - y);
    if (d < bestD) { bestD = d; best = { x: s.x + Math.floor(s.w / 2), y: Math.min(world.map.h - 1, s.y + s.h) }; }
  }
  if (best) return best;
  for (const u of world.units.values()) {
    if (u.house === houseId || !u.isGround) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d < bestD) { bestD = d; best = { x: u.tx, y: u.ty }; }
  }
  return best;
}

function towardsEnemy(world, house, view, reach) {
  const foe = enemyCentre(world, house.id) ?? { x: world.map.w / 2, y: world.map.h / 2 };
  const dx = foe.x - view.home.x, dy = foe.y - view.home.y, d = Math.hypot(dx, dy) || 1;
  return { x: Math.round(view.home.x + (dx / d) * reach), y: Math.round(view.home.y + (dy / d) * reach) };
}

function buildBase(world, house, view) {
  const b = house.brain;
  const item = house.lines.structure.current;
  if (item?.state === 'ready') {
    const turret = item.typeId === 'turret' || item.typeId === 'rocketTurret';
    const anchor = turret ? towardsEnemy(world, house, view, 6) : view.home;
    const spot = findPlacement(world, house.id, item.typeId, anchor.x, anchor.y, 12);
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
  if (view.count.heavyFactory && canBuild(world, house.id, yardUp) && house.credits >= upgradeCost(house, 'constructionYard') + DIFFICULTY[house.brain.difficulty].reserve) issue(world, house, { type: 'build', typeId: yardUp });
}

function nextStructure(world, house, view) {
  const b = house.brain, id = house.id, d = DIFFICULTY[b.difficulty];
  const can = (t) => canBuild(world, id, t) && world.time - (b.noRoom[t] ?? -1e9) >= NO_ROOM_RETRY;
  const has = (t) => view.count[t] ?? 0;
  const power = computePower(world, id);
  if (power.produced < power.used + 20 && can('windtrap')) return 'windtrap';
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
  return null;
}

function keepHarvesters(world, house, view) {
  const refineries = view.count.refinery ?? 0;
  if (!refineries || !view.count.heavyFactory) return;
  const heavy = house.lines.heavy;
  const queued = (heavy.current?.typeId === 'harvester' ? 1 : 0) + heavy.queue.filter((t) => t === 'harvester').length;
  const have = view.units.filter((u) => u.typeId === 'harvester').length;
  if (have + queued < Math.min(6, 2 * refineries) && house.credits >= 300 && canBuild(world, house.id, 'harvester')) issue(world, house, { type: 'build', typeId: 'harvester' });
}

const ARMY_WEIGHTS = { combatTank: 6, siegeTank: 3, missileTank: 3, quad: 2, trike: 2, raider: 2, infantry: 2, troopers: 2, soldier: 1, trooper: 1 };
const FACTORIES = ['barracks', 'wor', 'lightFactory', 'heavyFactory'];

function weightedPick(rng, pool) {
  let r = rng.next() * pool.reduce((n, t) => n + ARMY_WEIGHTS[t], 0);
  for (const t of pool) if ((r -= ARMY_WEIGHTS[t]) < 0) return t;
  return pool[pool.length - 1];
}

function buildArmy(world, house, view) {
  const d = DIFFICULTY[house.brain.difficulty];
  if (view.units.filter((u) => isArmed(u.type)).length >= d.armyCap) return;
  const options = buildOptions(world, house.id);
  for (const line of ['heavy', 'light', 'infantry']) {
    const l = house.lines[line];
    if (l.current || l.queue.length || house.credits < d.reserve) continue;
    const pool = options[line].filter((t) => ARMY_WEIGHTS[t]);
    if (pool.length) issue(world, house, { type: 'build', typeId: weightedPick(world.rng, pool) });
  }
}

const FACTORY_UPGRADES = ['heavyFactory', 'lightFactory', 'barracks', 'wor'];   // what the army needs, most useful first

/** Factory upgrades open better units: one new purchase per think, saving up for the most useful one. */
function buyUpgrades(world, house, view) {
  const d = DIFFICULTY[house.brain.difficulty];
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
  const spot = towardsEnemy(world, house, view, 5);
  for (const s of view.mine) {
    if (!FACTORIES.includes(s.typeId) || b.rallied.includes(s.id)) continue;
    b.rallied.push(s.id);
    issue(world, house, { type: 'setRally', structureId: s.id, x: spot.x, y: spot.y });
  }
}

function defend(world, house, view) {
  const b = house.brain;
  let intruder = null, best = 10;
  for (const u of world.units.values()) {
    if (u.house === house.id || !u.isGround) continue;
    for (const s of view.mine) {
      const d = Math.hypot(u.x - s.x - s.w / 2, u.y - s.y - s.h / 2);
      if (d < best) { best = d; intruder = u; }
    }
  }
  if (!intruder) return;
  const ids = view.units
    .filter((u) => isArmed(u.type) && !b.wave.includes(u.id) && u.order.type !== 'attack' && Math.hypot(u.x - intruder.x, u.y - intruder.y) < 24)
    .map((u) => u.id);
  if (ids.length) issue(world, house, { type: 'attack', ids, targetKind: 'unit', targetId: intruder.id });
}

function attack(world, house, view) {
  const b = house.brain, d = DIFFICULTY[b.difficulty];
  b.wave = b.wave.filter((id) => world.units.has(id));
  const idle = b.wave.map((id) => world.units.get(id)).filter((u) => u.order.type === 'idle');
  if (idle.length && world.time >= (b.huntAt ?? 0)) {   // wave members that stopped hunt the next target (at most every 10 s)
    b.huntAt = world.time + 10;
    const lead = idle[0], ids = idle.map((u) => u.id);
    const t = nearestEnemyTarget(world, house.id, lead.x, lead.y);
    const stuckShort = t && Math.hypot(t.x + 0.5 - lead.x, t.y + 0.5 - lead.y) > lead.type.range + 2;
    const wall = stuckShort ? nearestEnemyWall(world, house.id, lead.x, lead.y, 8) : null;   // walls in the way: break through
    if (wall) issue(world, house, { type: 'attack', ids, targetKind: 'structure', targetId: wall.id });
    else if (t) issue(world, house, { type: 'attackMove', ids, x: t.x, y: t.y });
  }
  if (world.time < b.nextAttack) return;
  const size = Math.min(d.waveMax, Math.round(d.waveBase + d.waveGrow * b.waves));
  const ready = view.units.filter((u) => isArmed(u.type) && !b.wave.includes(u.id) && (u.order.type === 'idle' || u.order.type === 'guard'));
  if (ready.length < size) { b.nextAttack = world.time + 15; return; }
  const target = nearestEnemyTarget(world, house.id, view.home.x, view.home.y);
  if (!target) return;
  const group = ready.slice(0, size).map((u) => u.id);
  issue(world, house, { type: 'attackMove', ids: group, x: target.x, y: target.y });
  b.wave.push(...group);
  b.waves++;
  b.nextAttack = world.time + d.waveEvery;
  world.events.push('aiAttack', { house: house.id, size: group.length, x: target.x, y: target.y });
}

function nearestEnemyWall(world, houseId, x, y, radius) {
  let best = null, bestD = radius;
  for (const s of world.structures.values()) {
    if (s.house === houseId || !s.type.isWall) continue;
    const d = Math.hypot(s.x + 0.5 - x, s.y + 0.5 - y);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

/** Without a Construction Yard or an MCV the base cannot grow: buy an MCV (after the upgrade that opens it) and deploy it. */
function rebuildMcv(world, house, view) {
  const heavy = house.lines.heavy;
  if (!view.count.heavyFactory || heavy.current?.typeId === 'mcv' || heavy.queue.includes('mcv')) return;
  if (canBuild(world, house.id, 'mcv')) { issue(world, house, { type: 'build', typeId: 'mcv' }); return; }   // queued behind the current item and paid as it builds
  const up = upgradeId('heavyFactory');
  if (upgradeLevel(house, 'heavyFactory') < 1 && canBuild(world, house.id, up) && heavy.current?.typeId !== up && !heavy.queue.includes(up)) issue(world, house, { type: 'build', typeId: up });
}
