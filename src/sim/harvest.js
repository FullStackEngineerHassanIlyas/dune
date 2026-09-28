// Harvesters (spec §4.3): find the nearest unclaimed spice, fill up (700 credits in about 20 s),
// drive to the dock just south of a refinery's pad, unload (about 5 s) and return to the field.
// A refinery comes with a free harvester. A player's move or stop suspends the routine; a harvest
// order (or being left idle on spice) resumes it.
import { DT } from '../data/tuning.js';
import { addCredits } from './economy.js';
import { findFreeTile } from './spawn.js';

export const HARVEST_CAPACITY = 700;
export const HARVEST_RATE = 35;
export const UNLOAD_RATE = 140;
const SEEK_RADIUS = 32;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function initHarvester(u) {
  u.harvest = { state: 'seek', load: 0, acc: 0, field: -1, target: -1, refinery: 0, wait: 0 };
  u.order = { type: 'harvest' };
}

export function dockTile(world, ref) {
  const map = world.map;
  const x = ref.x + ref.w - 1, y = ref.y + ref.h;
  if (map.inBounds(x, y) && map.moveFactor(map.idx(x, y), 'harvester') > 0) return map.idx(x, y);
  const t = findFreeTile(world, ref.x + 1, ref.y + ref.h, 'harvester', 3, 1);
  return t ? map.idx(t.x, t.y) : -1;
}

function claimedFields(world, self) {
  const claimed = new Set();
  for (const o of world.units.values()) {
    if (o !== self && o.harvest && (o.harvest.state === 'toField' || o.harvest.state === 'harvesting') && o.harvest.field >= 0) claimed.add(o.harvest.field);
  }
  return claimed;
}

function searchSpice(world, from, radius, claimed, self) {
  const map = world.map;
  const fx = map.xOf(from), fy = map.yOf(from);
  const seen = new Set([from]);
  const queue = [from];
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    if (map.spice[i] > 0 && !claimed.has(i) && (!map.unit[i] || map.unit[i] === self.id)) return i;
    const x = map.xOf(i), y = map.yOf(i);
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy;
      if (!map.inBounds(nx, ny) || Math.max(Math.abs(nx - fx), Math.abs(ny - fy)) > radius) continue;
      const ni = map.idx(nx, ny);
      if (seen.has(ni)) continue;
      seen.add(ni);
      if (map.moveFactor(ni, 'harvester') > 0) queue.push(ni);
    }
  }
  return -1;
}

export function findSpice(world, u) {
  const claimed = claimedFields(world, u);
  if (u.harvest.field >= 0) {
    const near = searchSpice(world, u.harvest.field, 6, claimed, u);
    if (near >= 0) return near;
  }
  return searchSpice(world, world.map.idx(u.tx, u.ty), SEEK_RADIUS, claimed, u);
}

function chooseRefinery(world, u) {
  let best = null, bestScore = Infinity;
  for (const s of world.structures.values()) {
    if (s.house !== u.house || s.typeId !== 'refinery') continue;
    const score = Math.hypot(s.x + s.w - 1 - u.tx, s.y + s.h - u.ty) + (s.dockedBy && s.dockedBy !== u.id ? 6 : 0);
    if (score < bestScore) { best = s; bestScore = score; }
  }
  return best;
}

function releaseDock(world, u) {
  u.noNudge = false;
  const ref = world.structures.get(u.harvest.refinery);
  if (ref && ref.dockedBy === u.id) ref.dockedBy = 0;
  world.events.push('undocked', { id: u.id, refinery: u.harvest.refinery });
}

const near = (map, u, i, r) => Math.max(Math.abs(u.tx - map.xOf(i)), Math.abs(u.ty - map.yOf(i))) <= r;

export function updateHarvester(world, u) {
  const h = u.harvest;
  const map = world.map;
  const here = map.idx(u.tx, u.ty);
  if (u.order.type === 'idle' && u.resumeOrder?.type === 'harvest') { u.order = u.resumeOrder; u.resumeOrder = null; }   // a failed nudge must not end the routine
  if (u.order.type !== 'harvest') {
    if (h.state === 'unloading') { releaseDock(world, u); h.state = 'toRefinery'; h.target = -1; }
    if (u.order.type === 'idle' && !u.step && u.pathState === 'none' && map.spice[here] > 0) {
      u.order = { type: 'harvest' };
      h.state = 'harvesting';
      h.field = here;
    }
    return;
  }
  const moving = !!u.step || u.pathState === 'waiting' || (u.pathState === 'ready' && u.pathIndex < u.path.length);
  switch (h.state) {
    case 'seek': {
      if (h.load >= HARVEST_CAPACITY) { h.state = 'toRefinery'; h.target = -1; return; }
      if ((h.wait -= DT) > 0) return;
      const tile = findSpice(world, u);
      if (tile < 0) {
        h.wait = 3;
        if (h.load > 0) { h.state = 'toRefinery'; h.target = -1; }
        return;
      }
      h.field = tile;
      if (tile === here) { h.state = 'harvesting'; return; }
      h.state = 'toField';
      world.requestPath(u, tile);
      return;
    }
    case 'toField': {
      if (moving) return;
      if (map.spice[here] > 0) { h.state = 'harvesting'; h.field = here; } else h.state = 'seek';
      return;
    }
    case 'harvesting': {
      if (moving) return;
      h.acc += HARVEST_RATE * DT;
      const take = Math.min(Math.floor(h.acc), map.spice[here], Math.ceil(HARVEST_CAPACITY - h.load));
      if (take > 0) {
        map.setSpice(here, map.spice[here] - take);
        h.load = Math.min(HARVEST_CAPACITY, h.load + take);
        h.acc -= take;
      }
      if (h.load >= HARVEST_CAPACITY) { h.state = 'toRefinery'; h.target = -1; h.acc = 0; return; }
      if (map.spice[here] <= 0) { h.state = 'seek'; h.wait = 0; h.acc = 0; }
      return;
    }
    case 'toRefinery': {
      const ref = chooseRefinery(world, u);
      if (!ref) return;
      const dock = dockTile(world, ref);
      if (dock < 0) return;
      h.refinery = ref.id;
      if (here === dock && !u.step) {
        if (!ref.dockedBy || ref.dockedBy === u.id || !world.units.has(ref.dockedBy)) {
          ref.dockedBy = u.id;
          u.noNudge = true;
          h.state = 'unloading';
          world.events.push('docked', { id: u.id, refinery: ref.id });
        } else h.state = 'queued';
        return;
      }
      if (moving) return;
      if (h.target === dock && ref.dockedBy && ref.dockedBy !== u.id && near(map, u, dock, 2)) { h.state = 'queued'; return; }
      h.target = dock;
      world.requestPath(u, dock);
      return;
    }
    case 'queued': {
      const ref = world.structures.get(h.refinery);
      if (!ref) { h.state = 'toRefinery'; h.target = -1; return; }
      if (!ref.dockedBy || !world.units.has(ref.dockedBy)) { ref.dockedBy = 0; h.state = 'toRefinery'; h.target = -1; }
      return;
    }
    case 'unloading': {
      const ref = world.structures.get(h.refinery);
      if (!ref || ref.dockedBy !== u.id) { u.noNudge = false; h.state = 'toRefinery'; h.target = -1; return; }
      const house = world.houses.get(u.house);
      const amount = Math.min(UNLOAD_RATE * DT, h.load);
      addCredits(world, house, amount);
      house.stats.spiceHarvested += amount;
      h.load -= amount;
      if (h.load <= 1e-6) {
        h.load = 0;
        releaseDock(world, u);
        h.state = 'seek';
        h.wait = 0;
      }
      return;
    }
  }
}

export function spawnFreeHarvester(world, ref) {
  const map = world.map;
  const dock = dockTile(world, ref);
  const spot = dock >= 0 && !map.unit[dock] ? { x: map.xOf(dock), y: map.yOf(dock) } : findFreeTile(world, ref.x + 1, ref.y + ref.h, 'harvester', 5, 1);
  if (!spot) return null;
  const u = world.spawnUnit('harvester', ref.house, spot.x, spot.y, { heading: Math.PI / 2 });
  world.events.push('unitBuilt', { id: u.id, house: ref.house, structureId: ref.id, unitType: 'harvester', free: true });
  world.events.push('eva', { house: ref.house, key: 'harvesterDeployed', text: 'Harvester deployed.' });
  return u;
}

export function orderHarvest(world, units, x, y) {
  const map = world.map;
  for (const u of units) {
    if (!u.harvest) continue;
    if (u.harvest.state === 'unloading') releaseDock(world, u);
    u.order = { type: 'harvest' };
    u.harvest.state = 'seek';
    u.harvest.wait = 0;
    if (Number.isFinite(x) && Number.isFinite(y) && map.inBounds(Math.floor(x), Math.floor(y))) u.harvest.field = map.idx(Math.floor(x), Math.floor(y));
  }
}

export function orderReturn(world, units) {
  for (const u of units) {
    if (!u.harvest) continue;
    u.order = { type: 'harvest' };
    u.harvest.state = 'toRefinery';
    u.harvest.target = -1;
  }
}
