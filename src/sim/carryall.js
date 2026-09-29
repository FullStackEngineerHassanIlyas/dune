// Carryall (spec §4.3, §4.6; research: units.md "Carryall"): an unarmed lifter the player does not
// command. A visiting Carryall flies the free Harvester of a new Refinery in from the map edge and
// leaves again. A house's own Carryalls hover over their Hi-Tech Factory until a Harvester or a
// damaged vehicle has a long way to go (16 tiles or more); then the nearest idle one flies over,
// comes down, lifts it and sets it down on the nearest free tile to where it was heading. A pickup is
// given up when the unit gets another order (even one of the same kind), dies, is held elsewhere or
// gets close by itself.
// Whatever a Carryall carries dies with it.
import { AIR } from '../data/tuning.js';
import { findFreeTile } from './spawn.js';
import { hoverTo, climb } from './air.js';

const VEHICLES = new Set(['tracked', 'wheeled', 'harvester']);

export function updateCarryall(world, c) {
  const stage = c.job?.stage;
  if (stage === 'fetch') fetch(world, c, c.job);
  else if (stage === 'carry') carry(world, c, c.job);
  else if (stage === 'leave') leave(world, c, c.job);
  else idle(world, c);
  hang(world, c);
}

/** A long trip for a harvester or a damaged vehicle: the nearest idle Carryall of the house flies it to tile `to`. */
export function callCarryall(world, u, to) {
  if (!u.isGround || !VEHICLES.has(u.move) || u.inside) return false;
  const far = Math.hypot(u.tx - to.x, u.ty - to.y) >= AIR.ferryDistance;
  const coming = world.units.get(u.ferry);
  if (coming?.job?.unit === u.id && coming.job.stage === 'fetch') {
    if (far && coming.job.order === u.order) { coming.job.to = { x: to.x, y: to.y }; return true; }   // on its way: to the latest destination
    coming.job = null;   // a new order, or a trip short enough to drive
  }
  u.ferry = 0;
  if (!far) return false;
  let best = null, bestD = Infinity;
  for (const c of world.units.values()) {
    if (c.house !== u.house || c.typeId !== 'carryall' || c.job || c.cargo || c.visitor) continue;
    const d = Math.hypot(c.x - u.x, c.y - u.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best) return false;
  best.job = { stage: 'fetch', unit: u.id, order: u.order, to: { x: to.x, y: to.y } };
  u.ferry = best.id;
  world.events.push('ferryCalled', { id: u.id, carrier: best.id, house: u.house });
  return true;
}

/** A visiting Carryall brings a new unit in from the nearest map edge, sets it down on tile `to` and flies off. */
export function deliverByAir(world, houseId, typeId, to, announce = null) {
  const map = world.map;
  const edges = [[to.x, 0], [to.x, map.h - 1], [0, to.y], [map.w - 1, to.y]];
  const [ex, ey] = edges.reduce((a, b) => (Math.hypot(b[0] - to.x, b[1] - to.y) < Math.hypot(a[0] - to.x, a[1] - to.y) ? b : a));
  const c = world.spawnUnit('carryall', houseId, ex, ey, { heading: Math.atan2(to.y - ey, to.x - ex) });
  c.visitor = true;
  const u = world.spawnUnit(typeId, houseId, ex, ey, { inside: c.id });
  c.cargo = u.id;
  c.job = { stage: 'carry', to: { x: to.x, y: to.y }, leave: true, exit: { x: ex, y: ey }, announce };
  hang(world, c);
  return u;
}

function idle(world, c) {
  climb(c, AIR.cruise);
  const home = homePoint(world, c);
  if (home) hoverTo(world, c, home.x, home.y);
}

/** Over its factory, side by side with the others; the house's Construction Yard when the factory is gone. */
function homePoint(world, c) {
  let f = world.structures.get(c.home);
  if (!f || f.house !== c.house) {
    const own = [...world.structures.values()].filter((s) => s.house === c.house);
    f = own.find((s) => s.typeId === 'hiTech') ?? own.find((s) => s.typeId === 'constructionYard') ?? null;
    c.home = f?.id ?? 0;
  }
  if (!f) return null;
  return { x: f.x + f.w / 2 + ((c.id % 3) - 1) * 0.7, y: f.y + f.h / 2 - 0.2 };
}

function fetch(world, c, job) {
  const u = world.units.get(job.unit);
  if (!u || u.inside || u.house !== c.house || u.order !== job.order || Math.hypot(u.x - job.to.x - 0.5, u.y - job.to.y - 0.5) < AIR.ferryCancel) {
    if (u?.ferry === c.id) u.ferry = 0;
    c.job = null;   // not needed any more
    return;
  }
  if (!hoverTo(world, c, u.x, u.y)) { climb(c, AIR.cruise); return; }
  if (!climb(c, AIR.low)) return;
  const map = world.map;
  for (const i of [map.idx(u.tx, u.ty), u.step?.from, u.step?.to]) if (i !== undefined && map.unit[i] === u.id) map.unit[i] = 0;
  u.step = null; u.path = []; u.pathIndex = 0; u.pathState = 'none'; u.goal = -1; u.carry = 0;
  u.inside = c.id;
  u.ferry = 0;
  c.cargo = u.id;
  job.stage = 'carry';
  world.events.push('pickedUp', { id: u.id, carrier: c.id, house: c.house, x: u.x, y: u.y });
}

function carry(world, c, job) {
  const u = world.units.get(c.cargo);
  if (!u) { done(c, job); return; }
  if (!hoverTo(world, c, job.to.x + 0.5, job.to.y + 0.5)) { climb(c, AIR.cruise); return; }
  const map = world.map, i = map.idx(job.to.x, job.to.y);
  if (map.unit[i] || map.structure[i] || map.moveFactor(i, u.move) <= 0) {   // taken or blocked: the nearest free tile
    const spot = findFreeTile(world, job.to.x, job.to.y, u.move, 4, 1);
    if (spot) job.to = spot;
    return;
  }
  if (!climb(c, AIR.low)) return;
  map.unit[i] = u.id;
  u.inside = 0;
  u.alt = undefined;
  u.tx = job.to.x; u.ty = job.to.y; u.x = job.to.x + 0.5; u.y = job.to.y + 0.5;
  c.cargo = 0;
  world.events.push('setDown', { id: u.id, carrier: c.id, house: c.house, x: u.x, y: u.y });
  if (job.announce) world.events.push('eva', { house: c.house, key: job.announce.key, text: job.announce.text });
  done(c, job);
}

function done(c, job) { c.job = job.leave ? { stage: 'leave', exit: job.exit } : null; }

function leave(world, c, job) {
  climb(c, AIR.cruise);
  if (hoverTo(world, c, job.exit.x + 0.5, job.exit.y + 0.5)) world.removeUnit(c, 'left');
}

/** The load hangs under the lifter. */
function hang(world, c) {
  const u = c.cargo ? world.units.get(c.cargo) : null;
  if (!u) { c.cargo = 0; return; }
  u.x = c.x; u.y = c.y; u.tx = c.tx; u.ty = c.ty;
  u.heading = c.heading; u.turret = c.heading;
  u.alt = Math.max(0, c.alt - AIR.cargoDrop);
}
