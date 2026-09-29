// Computer opponent (spec §4.10): one brain per AI house, thinking once a second. It sees the whole map,
// as the original's AI does, but acts only through world.issue, exactly like a player. Economy first:
// deploy the MCV, stay ahead on power, follow the house's build order, keep two harvesters per refinery
// and add silos when storage runs full. Then an army, rally points, base defence and attack waves.
import { STRUCTURES } from '../data/structures.js';
import { G } from '../data/terrain.js';
import { computePower, builtStorage } from './economy.js';
import { canBuild } from './tech.js';
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
  if (!view.yard) deployMcv(world, house, view);
  else buildBase(world, house, view);
  keepHarvesters(world, house, view);
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
  for (const s of world.structures.values()) if (s.house !== houseId) { sx += s.x + s.w / 2; sy += s.y + s.h / 2; n++; }
  if (!n) for (const u of world.units.values()) if (u.house !== houseId && u.isGround) { sx += u.x; sy += u.y; n++; }
  return n ? { x: sx / n, y: sy / n } : null;
}

/** Where to send an attack: below the nearest enemy building (reachable ground), else the nearest enemy unit. */
export function nearestEnemyTarget(world, houseId, x, y) {
  let best = null, bestD = Infinity;
  for (const s of world.structures.values()) {
    if (s.house === houseId) continue;
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
  if (next && house.credits >= Math.min(STRUCTURES[next].cost, 150)) issue(world, house, { type: 'build', typeId: next });
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
  if (house.credits > Math.max(builtStorage(world, id), house.startBuffer ?? 0) * 0.8 && can('silo')) return 'silo';
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
