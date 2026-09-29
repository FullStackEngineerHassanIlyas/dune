// Repair Facility (spec §4.6; research: structures.md "Repair Facility"): vehicles ordered to it drive up
// beside it — to the entrance south of the pad when that is free and reachable, else to any other side —
// and, one at a time, onto the pad under the gantry. Inside they are off the tile grid: they cannot be
// shot or splashed and take no orders. A full repair takes as long as building the unit and costs a
// quarter of its price, both in proportion to the damage; low power slows it like production and it
// pauses without credits. Then the vehicle drives out the way it came (or by the nearest free tile)
// and heads for the facility's rally point, or back to harvesting. The others wait close by. Infantry and aircraft cannot use it. The vehicle shares the bay's fate: destroyed with it,
// pushed out when the facility is sold, captured along with it.
import { DT, buildSeconds, UNIT_REPAIR_COST, BAY_DRIVE_SECONDS } from '../data/tuning.js';
import { spend } from './economy.js';
import { exitTile, findFreeTile } from './spawn.js';
import { dockTile, clearDock } from './harvest.js';
import { orderMove, stopUnit } from './orders.js';
import { killUnit } from './combat.js';
import { turnToward } from './geometry.js';

const VEHICLES = new Set(['tracked', 'wheeled', 'harvester']);
const FUNDS_WARNING_SECONDS = 10;
const GIVE_UP_TRIES = 12;
const TURN_ON_PAD = 4;   // radians per second while driving on or off

export const needsRepair = (u) => u.isGround && VEHICLES.has(u.move) && !u.inside && u.hp < u.maxHp;
const moving = (u) => !!u.step || u.pathState === 'waiting' || (u.pathState === 'ready' && u.pathIndex < u.path.length);
const gap = (u, s) => Math.max(s.x - u.tx, u.tx - (s.x + s.w - 1), s.y - u.ty, u.ty - (s.y + s.h - 1), 0);   // tiles from a unit to a footprint

/** Where a vehicle stands in the bay (tile units). */
export function padPoint(s) {
  const [px, py] = s.type.pad ?? [s.w / 2, s.h / 2];
  return { x: s.x + px, y: s.y + py };
}

export function orderRepairAt(world, houseId, units, structureId) {
  const s = world.structures.get(structureId);
  if (!s || s.house !== houseId || s.typeId !== 'repair') return;
  const ids = [];
  for (const u of units) {
    if (!needsRepair(u)) continue;
    const resume = u.harvest ? 'harvest' : null;
    stopUnit(u);
    u.order = { type: 'repairAt', structureId: s.id, tries: 0, retryAt: 0, wait: 0, resume };
    u.target = null;
    u.aiming = false;
    ids.push(u.id);
  }
  if (ids.length) world.events.push('repairOrdered', { ids, structureId: s.id, house: houseId });
}

/** A vehicle on its way to the bay: runs before movement, like the harvester routine. */
export function updateRepairOrder(world, u) {
  const o = u.order, map = world.map;
  const s = world.structures.get(o.structureId);
  if (!s || s.house !== u.house || u.hp >= u.maxHp) { stopUnit(u); return; }   // gone, taken or repaired some other way
  if (moving(u)) return;
  const busy = !!s.occupant && world.units.has(s.occupant);
  if (gap(u, s) === 1 && !busy) { enter(world, u, s); return; }   // beside the facility: drive onto the pad
  if (busy && gap(u, s) <= 3) return;   // wait close by for the bay
  if (world.tick < o.retryAt) return;
  if (++o.tries > GIVE_UP_TRIES) { stopUnit(u); world.events.push('moveFailed', { id: u.id }); return; }
  o.retryAt = world.tick + 20;
  const goal = besideTile(world, u, s);
  if (goal >= 0) { world.requestPath(u, goal); return; }
  const entrance = dockTile(world, s), parked = entrance >= 0 ? world.units.get(map.unit[entrance]) : null;
  if (parked && parked.order.type !== 'repairAt') clearDock(world, parked.id, u);   // every way in is taken: ask a parked friend to make room
}

/** The free tile beside the facility the vehicle can reach, nearest first, the entrance south of the pad preferred; -1 if none. */
function besideTile(world, u, s) {
  const map = world.map, start = map.idx(u.tx, u.ty), entrance = dockTile(world, s);
  let best = -1, bestCost = Infinity;
  for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) {
    if (!map.inBounds(x, y) || (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)) continue;
    const i = map.idx(x, y);
    if (map.structure[i] || map.moveFactor(i, u.move) <= 0 || (map.unit[i] && map.unit[i] !== u.id)) continue;
    if (!world.reach.connected(start, i, u.move)) continue;
    const cost = Math.hypot(x - u.tx, y - u.ty) - (i === entrance ? 3 : 0);
    if (cost < bestCost) { bestCost = cost; best = i; }
  }
  return best;
}

/** The tile the vehicle came in by if it is free, else the usual factory-style exit. */
function wayOut(world, s, u) {
  const map = world.map, d = s.bay?.door ?? -1;
  if (d >= 0 && !map.unit[d] && !map.structure[d]) return { x: map.xOf(d), y: map.yOf(d) };
  return exitTile(world, s, u.move);
}

function enter(world, u, s) {
  const map = world.map, here = map.idx(u.tx, u.ty);
  if (map.unit[here] === u.id) map.unit[here] = 0;
  u.path = []; u.pathIndex = 0; u.pathState = 'none'; u.goal = -1;
  const pad = padPoint(s);
  u.inside = s.id;
  u.tx = Math.floor(pad.x);
  u.ty = Math.floor(pad.y);
  s.occupant = u.id;
  s.bay = { state: 'entering', t: 0, door: here, fromX: u.x, fromY: u.y, toX: pad.x, toY: pad.y, stalled: false };
  world.events.push('bayEntered', { id: u.id, structureId: s.id, house: s.house, x: pad.x, y: pad.y });
}

/** Vehicles driving on, being repaired and driving off (once per tick, after production). */
export function updateRepairBays(world) {
  for (const s of world.structures.values()) {
    if (!s.occupant) continue;
    const u = world.units.get(s.occupant);
    if (!u || u.inside !== s.id) { s.occupant = 0; s.bay = null; continue; }
    const bay = s.bay;
    if (bay.state === 'repairing') { repair(world, s, u, bay); continue; }
    drive(u, bay);
    if (bay.t < 1) continue;
    if (bay.state === 'entering') bay.state = 'repairing';
    else release(world, s, u);
  }
}

function drive(u, bay) {
  const dx = bay.toX - bay.fromX, dy = bay.toY - bay.fromY;
  bay.t = Math.min(1, bay.t + DT / BAY_DRIVE_SECONDS);
  u.x = bay.fromX + dx * bay.t;
  u.y = bay.fromY + dy * bay.t;
  u.distance += (Math.hypot(dx, dy) * DT) / BAY_DRIVE_SECONDS;   // wheels and treads turn
  if (dx || dy) u.heading = turnToward(u.heading, Math.atan2(dy, dx), TURN_ON_PAD * DT);
  if (!u.type.turret) u.turret = u.heading;
}

function repair(world, s, u, bay) {
  const house = world.houses.get(s.house);
  if (u.hp < u.maxHp) {
    const speed = Math.max(0.25, house?.power.ratio ?? 1) * (house?.buildSpeed ?? 1);
    const hp = Math.min(u.maxHp - u.hp, (u.maxHp / buildSeconds(u.type.buildTime)) * speed * DT);
    const cost = (hp / u.maxHp) * u.type.cost * UNIT_REPAIR_COST;
    if (!house || !spend(house, cost)) {
      if (house && !bay.stalled && world.time - (house.lastFundsWarning ?? -1e9) >= FUNDS_WARNING_SECONDS) {
        house.lastFundsWarning = world.time;
        world.events.push('eva', { house: house.id, key: 'insufficientFunds', text: 'Insufficient funds.' });
      }
      bay.stalled = true;
      return;
    }
    bay.stalled = false;
    u.hp = u.maxHp - u.hp - hp < 1e-6 ? u.maxHp : u.hp + hp;
    if (u.hp < u.maxHp) return;
  }
  const spot = wayOut(world, s, u);
  if (!spot) return;   // boxed in: wait for room
  const map = world.map;
  map.unit[map.idx(spot.x, spot.y)] = u.id;   // hold the way out
  u.tx = spot.x;
  u.ty = spot.y;
  Object.assign(bay, { state: 'leaving', t: 0, fromX: u.x, fromY: u.y, toX: spot.x + 0.5, toY: spot.y + 0.5 });
  world.events.push('unitRepaired', { id: u.id, structureId: s.id, house: s.house, x: u.x, y: u.y });
}

function release(world, s, u) {
  u.inside = 0;
  u.x = s.bay.toX;
  u.y = s.bay.toY;
  s.occupant = 0;
  s.bay = null;
  const resume = u.order.resume;
  stopUnit(u);
  if (resume === 'harvest' && u.harvest) { u.order = { type: 'harvest' }; u.harvest.state = 'seek'; u.harvest.wait = 0; }
  else if (s.rally) orderMove(world, [u], s.rally.x, s.rally.y);
  world.events.push('bayLeft', { id: u.id, structureId: s.id, house: s.house });
}

/** The facility is going: 'destroyed' takes the vehicle inside with it, 'sold' pushes it out unfinished. */
export function emptyBay(world, s, how, attacker = null) {
  const u = s.occupant ? world.units.get(s.occupant) : null;
  const out = u?.inside === s.id && how !== 'destroyed' ? wayOut(world, s, u) : null;
  s.occupant = 0;
  s.bay = null;
  if (!u || u.inside !== s.id) return;
  if (how === 'destroyed') { killUnit(world, u, attacker); return; }
  const map = world.map;
  const held = map.unit[map.idx(u.tx, u.ty)] === u.id;   // already on its way out
  const spot = held ? { x: u.tx, y: u.ty } : out ?? findFreeTile(world, s.x + 1, s.y + s.h, u.move, 8, 1);
  if (!spot) { killUnit(world, u, null); return; }
  map.unit[map.idx(spot.x, spot.y)] = u.id;
  u.inside = 0;
  u.tx = spot.x;
  u.ty = spot.y;
  u.x = spot.x + 0.5;
  u.y = spot.y + 0.5;
  stopUnit(u);
  world.events.push('bayLeft', { id: u.id, structureId: s.id, house: s.house });
}
