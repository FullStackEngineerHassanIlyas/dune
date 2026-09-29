// Production lines (spec §4.5): structure, infantry, light, heavy and air. Each line builds one item
// at a time and pays for it progressively; without credits it stalls, low power slows it, and every
// extra factory of the line's type adds 25 % speed (cap 2x). Units leave by the factory's south side
// and drive to its rally point; structures wait, ready, until the player places them.
import { STRUCTURES } from '../data/structures.js';
import { UNITS } from '../data/units.js';
import { DT, buildSeconds } from '../data/tuning.js';
import { LINE_FACTORIES, lineOfItem, canBuild } from './tech.js';
import { placeStructure } from './placement.js';
import { spend, addCredits } from './economy.js';
import { exitTile } from './spawn.js';
import { orderMove } from './orders.js';

export const LINES = ['structure', 'infantry', 'light', 'heavy', 'air'];
export const MAX_QUEUE = 9;
const FUNDS_WARNING_SECONDS = 10;

export function createLines() { return Object.fromEntries(LINES.map((l) => [l, { current: null, queue: [] }])); }

function makeItem(typeId) {
  const t = STRUCTURES[typeId] ?? UNITS[typeId];
  return { typeId, cost: t.cost, total: buildSeconds(t.buildTime), progress: 0, paid: 0, state: 'building', starved: false };
}

const eva = (world, house, key, text) => world.events.push('eva', { house: house.id, key, text });

export function factoriesFor(world, houseId, line) {
  const types = LINE_FACTORIES[line];
  const out = [];
  for (const s of world.structures.values()) if (s.house === houseId && types.includes(s.typeId)) out.push(s);
  return out;
}

export function lineSpeed(world, house, line) {
  const n = factoriesFor(world, house.id, line).length;
  if (!n) return 0;
  return Math.min(2, 1 + 0.25 * (n - 1)) * Math.max(0.25, house.power.ratio) * (house.buildSpeed ?? 1);
}

export function orderBuild(world, houseId, typeId, count = 1) {
  const house = world.houses.get(houseId);
  const line = lineOfItem(typeId);
  if (!house || !line || !canBuild(world, houseId, typeId)) {
    world.events.push('commandRejected', { house: houseId, command: 'build', typeId });
    return;
  }
  const l = house.lines[line];
  if (l.current?.typeId === typeId && l.current.state === 'hold') { l.current.state = 'building'; eva(world, house, 'building', 'Building.'); return; }
  if (line === 'structure') {
    if (l.current) { eva(world, house, 'busy', 'Unable to comply, building in progress.'); return; }
    l.current = makeItem(typeId);
    eva(world, house, 'building', 'Building.');
    return;
  }
  const n = Math.max(1, Math.min(MAX_QUEUE, Math.floor(count) || 1));
  for (let k = 0; k < n; k++) {
    if ((l.current ? 1 : 0) + l.queue.length >= MAX_QUEUE) break;
    if (!l.current) l.current = makeItem(typeId); else l.queue.push(typeId);
  }
  eva(world, house, 'building', 'Building.');
}

export function orderHold(world, houseId, typeId) {
  const house = world.houses.get(houseId);
  const line = lineOfItem(typeId);
  if (!house || !line) return;
  const l = house.lines[line];
  if (l.current?.typeId === typeId) {
    if (l.current.state === 'building') { l.current.state = 'hold'; eva(world, house, 'onHold', 'On hold.'); return; }
    addCredits(world, house, l.current.paid);   // second press, or a ready structure: cancel with a refund (up to the storage)
    l.current = null;
    eva(world, house, 'cancelled', 'Cancelled.');
    world.events.push('productionCancelled', { house: houseId, typeId });
    return;
  }
  const k = l.queue.lastIndexOf(typeId);
  if (k >= 0) { l.queue.splice(k, 1); eva(world, house, 'cancelled', 'Cancelled.'); }
}

export function orderPlace(world, houseId, typeId, x, y) {
  const house = world.houses.get(houseId);
  const l = house?.lines.structure;
  if (!l?.current || l.current.typeId !== typeId || l.current.state !== 'ready') return null;
  const placed = placeStructure(world, houseId, typeId, x, y);
  if (!placed) { eva(world, house, 'cannotPlace', 'Cannot build there.'); return null; }
  l.current = null;
  return placed;
}

export function orderRally(world, houseId, structureId, x, y) {
  const s = world.structures.get(structureId);
  if (!s || s.house !== houseId || !Number.isFinite(x) || !Number.isFinite(y)) return;
  s.rally = { x: Math.max(0, Math.min(world.map.w - 1, Math.floor(x))), y: Math.max(0, Math.min(world.map.h - 1, Math.floor(y))) };
  world.events.push('rallySet', { id: s.id, house: houseId, x: s.rally.x, y: s.rally.y });
}

export function orderPrimary(world, houseId, structureId) {
  const s = world.structures.get(structureId);
  if (!s || s.house !== houseId) return;
  for (const o of world.structures.values()) if (o.house === houseId && o.typeId === s.typeId) o.primary = o === s;
  world.events.push('eva', { house: houseId, key: 'primary', text: 'Primary building selected.' });
}

export function spawnFromFactory(world, house, typeId) {
  const t = UNITS[typeId];
  const factories = [...world.structures.values()].filter((s) => s.house === house.id && s.typeId === t.builtAt);
  const f = factories.find((s) => s.primary) ?? factories[0];
  if (!f) return null;
  const spot = exitTile(world, f, t.move);
  if (!spot) return null;
  const u = world.spawnUnit(typeId, house.id, spot.x, spot.y, { heading: Math.PI / 2 });
  world.events.push('unitBuilt', { id: u.id, house: house.id, structureId: f.id, unitType: typeId });
  if (f.rally && typeId !== 'harvester') orderMove(world, [u], f.rally.x, f.rally.y);
  return u;
}

function complete(world, house, line, item) {
  if (line === 'structure') {
    item.state = 'ready';
    eva(world, house, 'constructionComplete', 'Construction complete.');
    world.events.push('productionReady', { house: house.id, typeId: item.typeId });
    return;
  }
  if (!spawnFromFactory(world, house, item.typeId)) return;   // exit blocked: retry next tick
  house.lines[line].current = null;
  eva(world, house, 'unitDeployed', item.typeId === 'harvester' ? 'Harvester deployed.' : 'Unit deployed.');
}

export function updateProduction(world) {
  for (const house of world.houses.values()) {
    for (const line of LINES) {
      const l = house.lines[line];
      if (!l.current && l.queue.length) l.current = makeItem(l.queue.shift());
      const item = l.current;
      if (!item || item.state !== 'building') continue;
      if (item.progress < 1) {
        const speed = lineSpeed(world, house, line);
        if (speed <= 0) continue;
        const dp = Math.min(1 - item.progress, (DT * speed) / item.total);
        const dc = Math.min(item.cost - item.paid, item.cost * dp);
        if (!spend(house, dc)) {
          if (!item.starved && world.time - (house.lastFundsWarning ?? -1e9) >= FUNDS_WARNING_SECONDS) {
            house.lastFundsWarning = world.time;
            eva(world, house, 'insufficientFunds', 'Insufficient funds.');
          }
          item.starved = true;
          continue;
        }
        item.starved = false;
        item.paid += dc;
        item.progress += dp;
      }
      if (item.progress >= 1 - 1e-9) { item.progress = 1; complete(world, house, line, item); }
    }
  }
}

/** Items whose factory or prerequisites vanished are dropped with a refund of what was paid. */
export function revalidateProduction(world) {
  for (const house of world.houses.values()) {
    for (const line of LINES) {
      const l = house.lines[line];
      if (l.current && !canBuild(world, house.id, l.current.typeId)) {   // a READY structure too: its yard may be gone
        addCredits(world, house, l.current.paid);
        world.events.push('productionCancelled', { house: house.id, typeId: l.current.typeId });
        l.current = null;
      }
      l.queue = l.queue.filter((t) => canBuild(world, house.id, t));
    }
  }
}
