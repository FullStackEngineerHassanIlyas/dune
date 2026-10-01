// Carryall (spec §4.3, §4.6; research: units.md "Carryall", structures.md "Repair Facility",
// mechanics-campaign.md §4.4): an unarmed lifter. A visiting Carryall flies the free Harvester of a new
// Refinery in from the map edge and leaves again. A house's own Carryalls — the AI's too — are on duty:
//  - harvester support: a Harvester with a long way to its spice or its Refinery (AIR.ferryDistance tiles
//    or more, when the lift beats the drive) is flown there, and one that finds no spice within its
//    search is flown to the nearest free field it can drive home from;
//  - battlefield recovery: while the house has a Repair Facility, a vehicle at half health or worse that
//    is far from it and not fighting at point-blank range is lifted to its entrance and joins the repair
//    queue; repaired, it heads back to where it was picked up (the original's Script_Unit_Pickup looks
//    for a free Repair Facility for any damaged unit);
//  - between jobs they wait over the house's Refineries and Repair Facility, spread out (over the Hi-Tech
//    Factory, else the Construction Yard, when there are none).
// The player may direct one: a ground click sends it there and that spot becomes its station; a click on
// an own vehicle has it lift that vehicle, and the next ground click sets it down (a damaged one is taken
// to the Repair Facility if no other order comes, anything else is held); a click on the Repair Facility
// or a Refinery delivers the load there. Stop holds it where it is, Drop (D) sets the load down below and
// Duty (the Guard command) returns it to automatic duty. A player order suspends duty until it is done
// or Duty is pressed. An automatic pickup is given up when the unit gets another order (even one of the
// same kind), dies, is held elsewhere or gets close by itself. Whatever a Carryall carries dies with it.
import { AIR, SIM_HZ, airSpeed, groundSpeed } from '../data/tuning.js';
import { findFreeTile } from './spawn.js';
import { hoverTo, climb, nearestEdge } from './air.js';
import { dockTile, orderHarvest, orderReturn, HARVEST_CAPACITY } from './harvest.js';
import { orderRepairAt } from './repair-bay.js';
import { stopUnit } from './orders.js';
import { isArmed } from './combat.js';

const VEHICLES = new Set(['tracked', 'wheeled', 'harvester']);
const POST_TICKS = 40;   // how long a waiting spot is kept before it is worked out again

/** A house's own Carryall, which works on its own and takes the player's orders (visitors only deliver). */
export const isLifter = (u) => u?.typeId === 'carryall' && !u.visitor;
/** A vehicle a Carryall can lift: on the ground, not in a bay or another Carryall, not docked at a Refinery. */
export const liftable = (u) => !!u && u.isGround && VEHICLES.has(u.move) && !u.inside && !u.noNudge && u.harvest?.state !== 'unloading';
const free = (c) => isLifter(c) && !c.job && !c.cargo && !c.manual;
const moving = (u) => !!u.step || u.pathState === 'waiting' || (u.pathState === 'ready' && u.pathIndex < u.path.length);
const tileOf = (world, i) => ({ x: world.map.xOf(i), y: world.map.yOf(i) });

export function updateCarryall(world, c) {
  const job = c.job;
  switch (job?.stage) {
    case 'fetch': fetch(world, c, job); break;
    case 'carry': carry(world, c, job); break;
    case 'hold': hold(world, c, job); break;
    case 'goto': goTo(world, c, job); break;
    case 'leave': leave(world, c, job); break;
    default: idle(world, c);
  }
  hang(world, c);
}

/** A long trip for a vehicle: the free Carryall of the house that gets it there soonest flies it to tile `to`, if that beats driving. */
export function callCarryall(world, u, to) {
  if (!liftable(u)) return false;
  const far = Math.hypot(u.tx - to.x, u.ty - to.y) >= AIR.ferryDistance;
  const coming = world.units.get(u.ferry);
  if (coming?.job?.unit === u.id && coming.job.stage === 'fetch') {
    if (coming.job.why === 'lift') return true;   // the player sent it: it comes whatever the unit does
    if (far && coming.job.order === u.order) { coming.job.to = { x: to.x, y: to.y }; return true; }   // on its way: to the latest destination
    coming.job = null;   // a new order, or a trip short enough to drive
  }
  u.ferry = 0;
  if (!far) return false;
  let best = null, bestT = Infinity;
  for (const c of world.units.values()) {
    if (c.house !== u.house || !free(c)) continue;
    const t = airTime(c, u, to);
    if (t < bestT) { bestT = t; best = c; }
  }
  if (!best || bestT + AIR.ferrySaving > driveTime(world, u, to)) return false;
  assign(world, best, u, to, 'ferry');
  return true;
}

/** A visiting Carryall brings a new unit in from the nearest map edge, sets it down on tile `to` and flies off. */
export function deliverByAir(world, houseId, typeId, to, announce = null) {
  const map = world.map;
  const { x: ex, y: ey } = nearestEdge(map, to.x, to.y);
  const c = world.spawnUnit('carryall', houseId, ex, ey, { heading: Math.atan2(to.y - ey, to.x - ex) });
  c.visitor = true;
  const u = world.spawnUnit(typeId, houseId, ex, ey, { inside: c.id });
  c.cargo = u.id;
  c.job = { stage: 'carry', to: { x: to.x, y: to.y }, leave: true, exit: { x: ex, y: ey }, announce };
  hang(world, c);
  return u;
}

/** Seconds for Carryall `c` to reach unit `u`, lift it and set it down on tile `to`. */
function airTime(c, u, to) {
  const legs = Math.hypot(c.x - u.x, c.y - u.y) + Math.hypot(u.x - to.x - 0.5, u.y - to.y - 0.5);
  return legs / airSpeed(c.type.speed) + (2 * (AIR.cruise - AIR.low)) / AIR.climb;
}

/** Seconds for unit `u` to drive to tile `to` over ground like its own. */
function driveTime(world, u, to) {
  const map = world.map;
  const speed = groundSpeed(u.type.speed, map.moveFactor(map.idx(u.tx, u.ty), u.move) || 160) * (u.speedMul ?? 1);
  return (Math.hypot(u.x - to.x - 0.5, u.y - to.y - 0.5) * AIR.detour) / Math.max(0.05, speed);
}

/** Carryall `c` goes for unit `u` (to set it down on tile `to` when there is one); any other on its way turns back. */
function assign(world, c, u, to, why, extra = {}) {
  const prev = world.units.get(u.ferry);
  if (prev && prev !== c && prev.job?.unit === u.id && prev.job.stage === 'fetch') {
    if (prev.job.manual) prev.manual = false;   // the player's earlier pick is superseded: back on duty
    prev.job = null;
  }
  c.job = { stage: 'fetch', unit: u.id, order: u.order, to: to ? { x: to.x, y: to.y } : null, why, ...extra };
  u.ferry = c.id;
  world.events.push('ferryCalled', { id: u.id, carrier: c.id, house: u.house, why });
}

function idle(world, c) {
  climb(c, AIR.cruise);
  if (!c.manual && !c.cargo && isLifter(c) && (world.tick + c.id) % Math.round(AIR.dutyScan * SIM_HZ) === 0 && duty(world, c)) return;
  const p = c.station ?? post(world, c);
  if (p) hoverTo(world, c, p.x, p.y);
}

/**
 * Where an idle Carryall waits: over one of the house's Refineries and Repair Facilities, the Carryalls
 * shared out among them and side by side over each; over its Hi-Tech Factory (the Construction Yard when
 * that is gone) when there are none; where it is when the house has no buildings.
 */
function post(world, c) {
  if (c.post && world.tick < c.post.until) return c.post.at;
  const own = [...world.structures.values()].filter((s) => s.house === c.house);
  let spots = own.filter((s) => s.typeId === 'refinery' || s.typeId === 'repair');
  if (!spots.length) {
    let f = world.structures.get(c.home);
    if (!f || f.house !== c.house) {
      f = own.find((s) => s.typeId === 'hiTech') ?? own.find((s) => s.typeId === 'constructionYard') ?? null;
      c.home = f?.id ?? 0;
    }
    spots = f ? [f] : [];
  }
  let at = null;
  if (spots.length) {
    let rank = 0;
    for (const o of world.units.values()) if (o !== c && o.house === c.house && isLifter(o) && o.id < c.id) rank++;
    const s = spots[rank % spots.length], slot = Math.floor(rank / spots.length);
    const side = slot === 0 ? 0 : (slot % 2 ? -1 : 1) * Math.ceil(slot / 2);
    at = { x: s.x + s.w / 2 + side * 0.8, y: s.y + s.h / 2 - 0.2 };
  }
  c.post = { at, until: world.tick + POST_TICKS };
  return at;
}

/** Look for work: a worn vehicle to recover first, then a Harvester to help along. True when a job was taken. */
function duty(world, c) {
  return recover(world, c) || helpHarvester(world, c);
}

/** Being fetched by a Carryall right now. */
function ferried(world, u) {
  const f = world.units.get(u.ferry);
  return !!f && f.job?.unit === u.id && f.job.stage === 'fetch';
}

/** An armed enemy close enough to be trading shots at point-blank range. */
function closeCombat(world, u) {
  const r = AIR.recoverClear;
  for (const o of world.units.values()) {
    if (o.house !== u.house && o.isGround && !o.inside && isArmed(o.type) && Math.abs(o.x - u.x) <= r && Math.abs(o.y - u.y) <= r) return true;
  }
  for (const s of world.structures.values()) {
    if (s.house === u.house || !isArmed(s.type)) continue;
    const gap = Math.max(s.x - u.tx, u.tx - (s.x + s.w - 1), s.y - u.ty, u.ty - (s.y + s.h - 1), 0);
    if (gap <= r) return true;
  }
  return false;
}

/** The house's Repair Facilities that have a way in, with their entrance tiles. */
function baysOf(world, houseId) {
  const out = [];
  for (const s of world.structures.values()) {
    if (s.house !== houseId || s.typeId !== 'repair') continue;
    const e = dockTile(world, s);
    if (e >= 0) out.push({ bay: s, to: tileOf(world, e) });
  }
  return out;
}

/** Of `bays`, the one nearest to unit `u` (the one it is already heading for, if any), with its distance; null if none. */
function nearestBay(world, u, bays = baysOf(world, u.house)) {
  let best = null, bestD = Infinity;
  for (const b of bays) {
    const d = Math.hypot(b.to.x - u.tx, b.to.y - u.ty);
    if (u.order.type === 'repairAt' && u.order.structureId === b.bay.id) return { ...b, d };
    if (d < bestD) { bestD = d; best = { ...b, d }; }
  }
  return best;
}

/** Battlefield recovery: the worn vehicle of the house best worth fetching goes to the Repair Facility by air. */
function recover(world, c) {
  const bays = baysOf(world, c.house);
  if (!bays.length) return false;
  let best = null, bestScore = Infinity;
  for (const u of world.units.values()) {
    if (u.house !== c.house || !liftable(u) || u.hp > u.maxHp * AIR.recoverBelow) continue;
    if (u.type.deploysTo || u.deviated || u.destructAt !== undefined || (u.recoverAfter ?? 0) > world.time || ferried(world, u)) continue;
    const near = nearestBay(world, u, bays);
    if (near.d < AIR.ferryDistance || closeCombat(world, u)) continue;   // close enough to drive, or busy fighting
    const score = Math.hypot(u.x - c.x, u.y - c.y) + (u.hp / u.maxHp) * 20;
    if (score < bestScore) { bestScore = score; best = { u, ...near }; }
  }
  if (!best) return false;
  const { u, bay, to } = best;
  if (u.order.type === 'repairAt') { assign(world, c, u, to, 'recover'); return true; }   // already on its way to that bay: a lift
  const back = { x: u.tx, y: u.ty };
  orderRepairAt(world, c.house, [u], bay.id);   // (a free Carryall may already have been called)
  if (u.order.type !== 'repairAt') return false;
  u.order.back = back;   // repaired, it heads back here
  if (ferried(world, u)) world.units.get(u.ferry).job.why = 'recover';
  else assign(world, c, u, to, 'recover');
  return true;
}

/** Harvester support: one on a long drive that no Carryall took up, else one that found no spice near. */
function helpHarvester(world, c) {
  const map = world.map;
  let stranded = null;
  for (const u of world.units.values()) {
    if (u.house !== c.house || !u.harvest || u.order.type !== 'harvest' || !liftable(u) || ferried(world, u)) continue;
    const h = u.harvest;
    const goal = h.state === 'toField' ? h.field : h.state === 'toRefinery' ? h.target : -1;
    if (goal >= 0 && moving(u) && callCarryall(world, u, tileOf(world, goal))) return true;
    if (!stranded && h.state === 'seek' && h.wait > 0 && h.load < HARVEST_CAPACITY && !moving(u)) stranded = u;
  }
  if (!stranded) return false;
  const tile = farSpice(world, stranded);
  if (tile < 0) return false;
  assign(world, c, stranded, tileOf(world, tile), 'ferry', { then: 'harvest' });
  return true;
}

/** The nearest free spice tile on the whole map that Harvester `u` could drive to (and so back home from); -1 if none or no Refinery. */
function farSpice(world, u) {
  const map = world.map, claimed = new Set(), here = map.idx(u.tx, u.ty);
  let refinery = false;
  for (const s of world.structures.values()) if (s.house === u.house && s.typeId === 'refinery') { refinery = true; break; }
  if (!refinery) return -1;
  for (const o of world.units.values()) {
    if (o !== u && o.harvest && o.harvest.field >= 0 && (o.harvest.state === 'toField' || o.harvest.state === 'harvesting')) claimed.add(o.harvest.field);
  }
  let best = -1, bestD = Infinity;
  for (let i = 0; i < map.spice.length; i++) {
    if (!map.spice[i] || map.unit[i] || claimed.has(i) || map.moveFactor(i, u.move) <= 0) continue;
    const d = Math.hypot(map.xOf(i) - u.tx, map.yOf(i) - u.ty);
    if (d >= bestD || !world.reach.connected(here, i, u.move)) continue;
    best = i; bestD = d;
  }
  return best;
}

function fetch(world, c, job) {
  const u = world.units.get(job.unit);
  const lost = !u || !liftable(u) || u.house !== c.house;
  const reordered = !lost && job.why !== 'lift' && u.order !== job.order;
  const arrived = !lost && job.to && Math.hypot(u.x - job.to.x - 0.5, u.y - job.to.y - 0.5) < AIR.ferryCancel;
  if (lost || (job.why !== 'lift' && (reordered || arrived))) {
    if (u?.ferry === c.id) u.ferry = 0;
    if (reordered) u.recoverAfter = world.time + AIR.recoverSnooze;   // the player wants it elsewhere: leave it be for a while
    finish(c, job);   // not needed any more
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
  world.events.push('pickedUp', { id: u.id, carrier: c.id, house: c.house, x: u.x, y: u.y });
  if (job.why !== 'lift') { job.stage = 'carry'; return; }
  const near = u.hp < u.maxHp ? nearestBay(world, u) : null;   // the player's pick: a damaged one to repairs, else held here
  c.job = near ? { stage: 'carry', to: near.to, bay: near.bay.id, manual: true } : { stage: 'hold', x: c.x, y: c.y };
}

function carry(world, c, job) {
  const u = world.units.get(c.cargo);
  if (!u) { finish(c, job); return; }
  if (!c.visitor) reroute(world, c, job, u);
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
  if (job.bay) {   // into the repair queue (a recovered vehicle still heads back afterwards)
    const back = u.order.back;
    orderRepairAt(world, c.house, [u], job.bay);
    if (back && u.order.type === 'repairAt') u.order.back = back;
  } else if (job.then === 'harvest') orderHarvest(world, [u], u.tx, u.ty);
  else if (job.then === 'return') orderReturn(world, [u]);
  else if (job.then === 'stop') stopUnit(u);
  finish(c, job);
}

/**
 * A load bound for a Repair Facility that is gone or in enemy hands is taken to the house's nearest
 * other one instead, or set down right here when there is none.
 */
function reroute(world, c, job, u) {
  const own = !job.then && u.order.type === 'repairAt' ? u.order.structureId : 0;   // a lift on duty for a vehicle bound there (not a load the player placed)
  const id = job.bay ?? own, s = id ? world.structures.get(id) : null;
  if (!id || s?.house === c.house) return;
  const near = nearestBay(world, u);
  if (near) Object.assign(job, { to: near.to, bay: near.bay.id });
  else Object.assign(job, { to: { x: c.tx, y: c.ty }, bay: 0, then: afterDrop(u) });   // once: then it is set down like any load
}

/** The job is over: a visitor leaves, a player's order is carried out (back on duty). */
function finish(c, job) {
  c.job = job.leave ? { stage: 'leave', exit: job.exit } : null;
  if (job.manual) c.manual = false;
}

function hold(world, c, job) {
  if (!world.units.has(c.cargo)) { c.job = null; c.manual = false; return; }   // the load is gone
  climb(c, AIR.cruise);
  hoverTo(world, c, job.x, job.y);
}

function goTo(world, c, job) {
  climb(c, AIR.cruise);
  if (!hoverTo(world, c, job.x, job.y)) return;
  c.station = { x: job.x, y: job.y };   // its station from now on
  finish(c, job);
}

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

// ── the player's orders ───────────────────────────────────────────────────────────────────────────────

/** Give up a pickup on the way (the unit is left to its own devices). */
function dropFetch(world, c) {
  if (c.job?.stage !== 'fetch') return;
  const u = world.units.get(c.job.unit);
  if (u?.ferry === c.id) u.ferry = 0;
  c.job = null;
}

/** What a unit set down by the player does next: a Harvester harvests (or unloads when full), anything else stands. */
const afterDrop = (u) => (u?.harvest ? 'harvest' : 'stop');

/** Set the load down on tile (x, y), or the nearest free tile to it; then the order is done. */
function setDownAt(world, c, x, y) {
  const u = world.units.get(c.cargo);
  if (!u) return;
  const map = world.map;
  c.job = { stage: 'carry', to: { x: Math.max(0, Math.min(map.w - 1, x)), y: Math.max(0, Math.min(map.h - 1, y)) }, then: afterDrop(u), manual: true };
  c.manual = true;
}

/**
 * Orders for a house's own Carryalls, validated like every command: move (fly there and make it the
 * station, or set the load down there), lift (targetId: an own vehicle), stop (hold here, off duty),
 * guard or duty (back to automatic duty), deploy or drop (set the load down below), repairAt
 * (structureId: take a worn load into that Repair Facility's queue) and returnToBase (a Harvester load to the
 * Refinery structureId, else the nearest). A load bound for a Repair Facility that is lost on the way goes to another.
 */
export function orderCarryalls(world, houseId, lifters, cmd) {
  lifters = lifters.filter((c) => isLifter(c) && c.house === houseId);
  if (!lifters.length) return;
  const map = world.map;
  switch (cmd.type) {
    case 'move': {
      if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.y)) return;
      const tx = Math.max(0, Math.min(map.w - 1, Math.floor(cmd.x))), ty = Math.max(0, Math.min(map.h - 1, Math.floor(cmd.y)));
      let k = 0;
      for (const c of lifters) {
        if (c.cargo) { setDownAt(world, c, tx, ty); continue; }
        dropFetch(world, c);
        const side = k === 0 ? 0 : (k % 2 ? -1 : 1) * Math.ceil(k / 2);   // several side by side
        k++;
        c.job = { stage: 'goto', x: tx + 0.5 + side * 0.8, y: ty + 0.5, manual: true };
        c.manual = true;
      }
      world.events.push('moveOrdered', { ids: lifters.map((c) => c.id), x: tx, y: ty });
      return;
    }
    case 'lift': {
      const u = world.units.get(cmd.targetId);
      if (!u || u.house !== houseId || !liftable(u)) return;
      let best = null, bestD = Infinity;
      for (const c of lifters) {
        if (c.cargo) continue;
        const d = Math.hypot(c.x - u.x, c.y - u.y);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (!best) return;
      dropFetch(world, best);
      best.manual = true;
      assign(world, best, u, null, 'lift', { manual: true });
      world.events.push('moveOrdered', { ids: [best.id], x: u.tx, y: u.ty });
      return;
    }
    case 'stop':
      for (const c of lifters) {
        dropFetch(world, c);
        c.manual = true;
        c.station = { x: c.x, y: c.y };
        c.job = c.cargo ? { stage: 'hold', x: c.x, y: c.y } : null;
      }
      return;
    case 'guard': case 'duty':
      for (const c of lifters) {
        c.manual = false;
        c.station = null;
        c.post = null;
        if (c.job?.stage === 'fetch' && c.job.why === 'lift') dropFetch(world, c);
        else if (c.job?.stage === 'goto') c.job = null;
        else if (c.cargo && (c.job?.stage === 'hold' || c.job?.manual)) {   // the player's load: a worn one to repairs, else set down here
          const u = world.units.get(c.cargo), near = u && u.hp < u.maxHp ? nearestBay(world, u) : null;
          c.job = near ? { stage: 'carry', to: near.to, bay: near.bay.id } : { stage: 'carry', to: { x: c.tx, y: c.ty }, then: afterDrop(u) };
        }
      }
      return;
    case 'deploy': case 'drop':
      for (const c of lifters) if (c.cargo) setDownAt(world, c, c.tx, c.ty);
      return;
    case 'repairAt': {
      const s = world.structures.get(cmd.structureId);
      if (!s || s.house !== houseId || s.typeId !== 'repair') return;
      const e = dockTile(world, s);
      if (e < 0) return;
      for (const c of lifters) {
        const u = world.units.get(c.cargo);
        if (!u || u.hp >= u.maxHp) continue;
        c.job = { stage: 'carry', to: tileOf(world, e), bay: s.id, manual: true };
        c.manual = true;
      }
      return;
    }
    case 'returnToBase': {
      const chosen = world.structures.get(cmd.structureId);   // the Refinery clicked, else the nearest
      const ok = (s) => s?.house === houseId && s.typeId === 'refinery' && dockTile(world, s) >= 0;
      for (const c of lifters) {
        const u = world.units.get(c.cargo);
        if (!u?.harvest) continue;
        let best = ok(chosen) ? dockTile(world, chosen) : -1, bestD = Infinity;
        for (const s of best < 0 ? world.structures.values() : []) {
          if (!ok(s)) continue;
          const d = dockTile(world, s), far = Math.hypot(map.xOf(d) - c.x, map.yOf(d) - c.y);
          if (far < bestD) { bestD = far; best = d; }
        }
        if (best < 0) continue;
        c.job = { stage: 'carry', to: tileOf(world, best), then: 'return', manual: true };
        c.manual = true;
      }
      return;
    }
  }
}
