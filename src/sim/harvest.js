// Harvesters (spec §4.3; research: structures.md "Spice Refinery"): find the nearest unclaimed spice,
// fill up (700 credits in about 20 s), drive to the entrance just south of a refinery's pad column and,
// one at a time, into its drop-zone slot. On the pad inside the building a harvester is held like a
// vehicle in a repair bay (off the tile grid, immune to fire, captured along with the refinery) but can
// still be selected. It unloads there while the refinery works — about 5 s, slower in a damaged
// refinery, down to a third of the rate (mechanics-campaign.md §2.1) — then backs out onto the entrance
// and returns to the field. The others wait close by, off the entrance and the lane out of it.
// A refinery that is sold or destroyed sets its harvester down where it stood. Orders for a docked
// harvester are carried out once it has backed out; a harvest order only picks its next field. A
// refinery comes with a free harvester (flown in by a Carryall in real games); Carryalls also ferry
// harvesters on long trips and set them down at the entrance. A player's move or stop suspends the
// routine; a harvest order (or being left idle on spice) resumes it.
import { DT, TURN_RATE, BAY_DRIVE_SECONDS } from '../data/tuning.js';
import { addCredits } from './economy.js';
import { findFreeTile } from './spawn.js';
import { orderMove, applyCommand } from './orders.js';
import { callCarryall, deliverByAir } from './carryall.js';
import { killUnit } from './combat.js';
import { angleDiff, turnToward } from './geometry.js';

export const HARVEST_CAPACITY = 700;
export const HARVEST_RATE = 35;
export const UNLOAD_RATE = 140;
const SEEK_RADIUS = 32;
const QUEUE_RADIUS = 3;      // tiles from the entrance where harvesters wait their turn
const CLAIM_RADIUS = 4;      // a harvester this close to a free slot takes it
const EXIT_PATIENCE = 2;     // seconds a harvester backing out waits for its entrance before it takes another way out
const MIN_REFINE = 1 / 3;    // the original refines 3 load points a cycle scaled by the refinery's health, at least 1
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const IN_SLOT = new Set(['docking', 'unloading', 'undocking']);
const UNIT_COMMANDS = new Set(['move', 'stop', 'guard', 'scatter', 'deploy', 'destruct', 'repairAt', 'capture', 'sabotage', 'attack', 'attackMove']);

export function initHarvester(u) {
  u.harvest = { state: 'seek', load: 0, acc: 0, field: -1, target: -1, refinery: 0, wait: 0, queuedAt: 0 };
  u.order = { type: 'harvest' };
}

/**
 * The tile a vehicle docks on — a refinery's entrance south of the pad column, a repair bay's
 * entrance — or, when terrain or a building blocks it, the nearest open ground around that tile. Units
 * standing about never move it (a dock that moved whenever a harvester reached it could never be
 * reached); it is cached until the map changes.
 */
export function dockTile(world, ref) {
  const map = world.map;
  if (ref.dock?.rev === map.revision) return ref.dock.tile;
  const [dx, dy] = ref.type?.entrance ?? [ref.w - 1, ref.h];
  const x = ref.x + dx, y = ref.y + dy;
  const open = (tx, ty) => map.inBounds(tx, ty) && map.moveFactor(map.idx(tx, ty), 'harvester') > 0;
  let tile = open(x, y) ? map.idx(x, y) : -1;
  for (let r = 1; r <= 3 && tile < 0; r++) {
    for (let dy = -r; dy <= r && tile < 0; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && open(x + dx, y + dy)) { tile = map.idx(x + dx, y + dy); break; }
    }
  }
  ref.dock = { rev: map.revision, tile };
  return tile;
}

/** Where a docked harvester stands: the refinery's pad (tile units). */
export function slotPoint(ref) {
  const [px, py] = ref.type.pad ?? [ref.w - 0.5, ref.h / 2];
  return { x: ref.x + px, y: ref.y + py };
}

function onOwnDock(world, u) {
  const here = world.map.idx(u.tx, u.ty);
  for (const s of world.structures.values()) if (s.house === u.house && s.typeId === 'refinery' && dockTile(world, s) === here) return true;
  return false;
}

const onTheMove = (u) => !!u.step || u.pathState === 'waiting' || (u.pathState === 'ready' && u.pathIndex < u.path.length);

/** Send a parked friendly unit off a dock (an idle harvester keeps its routine). */
export function clearDock(world, id, requester) {
  const o = world.units.get(id);
  if (!o || o.house !== requester.house || o.inside || onTheMove(o)) return;
  const spot = findFreeTile(world, o.tx, o.ty, o.move, 4, 2);
  if (!spot) return;
  if (o.harvest && o.order.type === 'harvest') { o.harvest.wait = Math.max(o.harvest.wait, 3); world.requestPath(o, world.map.idx(spot.x, spot.y)); }
  else orderMove(world, [o], spot.x, spot.y);
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

/** The harvester in the refinery's slot (driving in, unloading or backing out), or null. */
const occupantOf = (world, ref) => { const u = ref.dockedBy ? world.units.get(ref.dockedBy) : null; return u?.docked === ref.id ? u : null; };

/** The harvester on its way into the slot, or null (a stale claim is dropped). */
function claimant(world, ref) {
  const u = ref.incoming ? world.units.get(ref.incoming) : null;
  if (u && !u.inside && u.house === ref.house && u.order.type === 'harvest' && u.harvest.state === 'toRefinery' && u.harvest.refinery === ref.id) return u;
  ref.incoming = 0;
  return null;
}

/** True when no harvester has waited for this refinery longer than u. */
function firstInLine(world, ref, u) {
  const mine = u.harvest.state === 'queued' ? u.harvest.queuedAt : Infinity;
  for (const o of world.units.values()) {
    if (o === u || o.house !== ref.house || o.harvest?.state !== 'queued' || o.harvest.refinery !== ref.id || o.order.type !== 'harvest') continue;
    if (o.harvest.queuedAt < mine || (o.harvest.queuedAt === mine && o.id < u.id)) return false;
  }
  return true;
}

/** May u drive into the slot now: nobody inside, nobody else on the way in, nobody waiting longer. */
function slotFree(world, ref, u) {
  if (occupantOf(world, ref)) return false;
  const c = claimant(world, ref);
  return c ? c === u : firstInLine(world, ref, u);
}

function chooseRefinery(world, u) {
  const refs = [];
  for (const s of world.structures.values()) if (s.house === u.house && s.typeId === 'refinery' && dockTile(world, s) >= 0) refs.push(s);
  if (refs.length < 2) return refs[0] ?? null;
  const waiting = new Map();   // a busy refinery with a queue is worth a detour to a free one
  for (const o of world.units.values()) if (o !== u && o.house === u.house && o.harvest?.state === 'queued') waiting.set(o.harvest.refinery, (waiting.get(o.harvest.refinery) ?? 0) + 1);
  let best = null, bestScore = Infinity;
  for (const s of refs) {
    const dock = dockTile(world, s);
    const busy = (s.dockedBy && s.dockedBy !== u.id) || (s.incoming && s.incoming !== u.id);
    const score = Math.hypot(world.map.xOf(dock) - u.tx, world.map.yOf(dock) - u.ty) + (busy ? 6 : 0) + 6 * (waiting.get(s.id) ?? 0);
    if (score < bestScore) { best = s; bestScore = score; }
  }
  return best;
}

const near = (map, u, i, r) => Math.max(Math.abs(u.tx - map.xOf(i)), Math.abs(u.ty - map.yOf(i))) <= r;

/** The tile straight out of the entrance, which a harvester backing out needs clear. */
function laneTile(map, ref, door) {
  const pad = slotPoint(ref), x = map.xOf(door), y = map.yOf(door);
  const lx = x + Math.sign(Math.round(x + 0.5 - pad.x)), ly = y + Math.sign(Math.round(y + 0.5 - pad.y));
  return map.inBounds(lx, ly) ? map.idx(lx, ly) : -1;
}

/** A free tile to wait on beside the entrance (never the entrance or the lane out of it), nearest the entrance, then nearest u; -1 if none. */
function waitTile(world, ref, u, door) {
  const map = world.map, dx = map.xOf(door), dy = map.yOf(door), lane = laneTile(map, ref, door);
  for (let r = 1; r <= QUEUE_RADIUS; r++) {
    let best = -1, bestD = Infinity;
    for (let y = dy - r; y <= dy + r; y++) for (let x = dx - r; x <= dx + r; x++) {
      if (Math.max(Math.abs(x - dx), Math.abs(y - dy)) !== r || !map.inBounds(x, y)) continue;
      const i = map.idx(x, y);
      if (i === lane || map.structure[i] || map.moveFactor(i, 'harvester') <= 0 || (map.unit[i] && map.unit[i] !== u.id) || !world.reach.connected(door, i, 'harvester')) continue;
      const d = Math.hypot(x - u.tx, y - u.ty);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) return best;
  }
  return -1;
}

/** The slot is taken: wait close by, off the entrance and the lane out of it. */
function queue(world, u, ref, door) {
  const h = u.harvest, map = world.map, here = map.idx(u.tx, u.ty);
  if (h.state !== 'queued') h.queuedAt = world.tick;
  h.state = 'queued';
  h.refinery = ref.id;
  h.target = -1;
  h.wait = 0.5;
  if (ref.incoming === u.id) ref.incoming = 0;
  if (!onTheMove(u) && here !== door && here !== laneTile(map, ref, door) && near(map, u, door, QUEUE_RADIUS)) return;   // already out of the way
  const spot = waitTile(world, ref, u, door);
  if (spot >= 0) { if (spot !== here) world.requestPath(u, spot); return; }
  if (here !== door) return;
  const off = findFreeTile(world, u.tx, u.ty, 'harvester', 4, 1);   // nowhere to queue: at least clear the entrance
  if (off) world.requestPath(u, map.idx(off.x, off.y));
}

/** At the entrance with the slot free: drive in. */
function enter(world, u, ref, door) {
  const map = world.map, h = u.harvest;
  if (map.unit[door] === u.id) map.unit[door] = 0;
  u.path = []; u.pathIndex = 0; u.pathState = 'none'; u.goal = -1;
  const pad = slotPoint(ref);
  const slot = { state: 'entering', t: 0, door, outX: u.x, outY: u.y, padX: pad.x, padY: pad.y, face: Math.atan2(pad.y - u.y, pad.x - u.x), reverse: false, waited: 0 };
  u.inside = ref.id;
  u.docked = ref.id;
  u.tx = Math.floor(pad.x);
  u.ty = Math.floor(pad.y);
  ref.dockedBy = u.id;
  ref.incoming = 0;
  ref.slot = slot;
  h.state = 'docking';
  h.target = -1;
  world.events.push('docked', { id: u.id, refinery: ref.id, house: u.house, x: pad.x, y: pad.y });
}

export function updateHarvester(world, u) {
  const h = u.harvest;
  const map = world.map;
  const here = map.idx(u.tx, u.ty);
  u.speedMul = (255 - (100 * h.load) / HARVEST_CAPACITY) / 256;   // the original: a full load is noticeably slower
  if (IN_SLOT.has(h.state) && !u.docked) { h.state = 'toRefinery'; h.target = -1; }   // not actually in a slot (set up by hand): go and dock
  if (u.order.type === 'idle' && u.resumeOrder?.type === 'harvest') { u.order = u.resumeOrder; u.resumeOrder = null; }   // a failed nudge must not end the routine
  if (u.order.type !== 'harvest') {
    if (u.order.type === 'idle' && !u.step && u.pathState === 'none' && map.spice[here] > 0) {
      u.order = { type: 'harvest' };
      h.state = 'harvesting';
      h.field = here;
    }
    return;
  }
  const moving = onTheMove(u);
  switch (h.state) {
    case 'seek': {
      if (h.load >= HARVEST_CAPACITY) { h.state = 'toRefinery'; h.target = -1; return; }
      if ((h.wait -= DT) > 0) return;
      const tile = findSpice(world, u);
      if (tile < 0) {
        h.wait = 3;
        if (h.load > 0) { h.state = 'toRefinery'; h.target = -1; return; }
        if (!moving && onOwnDock(world, u)) clearDock(world, u.id, u);   // nothing to do: do not block the entrance
        return;
      }
      h.field = tile;
      if (tile === here) { h.state = 'harvesting'; return; }
      h.state = 'toField';
      world.requestPath(u, tile);
      callCarryall(world, u, { x: map.xOf(tile), y: map.yOf(tile) });   // a long way: a Carryall may fly it there
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
      if (moving) {   // close to the entrance: take the slot if it is free, else do not drive onto the entrance
        const ref = world.structures.get(h.refinery);
        if (!ref || h.target < 0 || u.goal !== h.target || !near(map, u, h.target, CLAIM_RADIUS)) return;
        if (slotFree(world, ref, u)) ref.incoming = u.id;
        else if (near(map, u, h.target, 2)) queue(world, u, ref, h.target);
        return;
      }
      const ref = chooseRefinery(world, u);
      if (!ref) return;
      const door = dockTile(world, ref);
      h.refinery = ref.id;
      const free = slotFree(world, ref, u);
      if (here === door) {
        if (free) enter(world, u, ref, door); else queue(world, u, ref, door);
        return;
      }
      const close = near(map, u, door, CLAIM_RADIUS);
      if (close && !free) { queue(world, u, ref, door); return; }
      if (close) ref.incoming = u.id;
      const occupant = map.unit[door];
      if (occupant && occupant !== u.id) clearDock(world, occupant, u);
      h.target = door;
      world.requestPath(u, door);
      if (!close) callCarryall(world, u, { x: map.xOf(door), y: map.yOf(door) });   // a long way: a Carryall may fly it to the entrance
      return;
    }
    case 'queued': {
      const ref = world.structures.get(h.refinery);
      if (!ref || ref.house !== u.house || ref.typeId !== 'refinery') { h.state = 'toRefinery'; h.target = -1; return; }   // gone or captured
      if ((h.wait -= DT) > 0) return;
      h.wait = 0.5;
      const door = dockTile(world, ref);
      if (door < 0) { h.state = 'toRefinery'; return; }
      if (slotFree(world, ref, u)) {
        ref.incoming = u.id;
        h.state = 'toRefinery';
        h.target = door;
        if (here !== door) world.requestPath(u, door);
        return;
      }
      if (world.tick % 40 < 10 && chooseRefinery(world, u) !== ref) { h.state = 'toRefinery'; h.target = -1; return; }   // another refinery is free
      if (!moving && (here === door || here === laneTile(map, ref, door) || !near(map, u, door, QUEUE_RADIUS))) queue(world, u, ref, door);
      return;
    }
  }
}

/**
 * Harvesters driving into a refinery's slot, unloading on its pad and backing out (once per tick, after
 * the repair bays). A harvester whose refinery went — sold, destroyed or removed — is set down where it stood.
 */
export function updateRefineries(world) {
  for (const u of world.units.values()) if (u.docked && !world.structures.has(u.docked)) setDown(world, u);
  for (const ref of world.structures.values()) {
    if (!ref.dockedBy) continue;
    const u = occupantOf(world, ref);
    if (!u || !ref.slot) { ref.dockedBy = 0; ref.slot = null; continue; }
    const slot = ref.slot;
    if (slot.state === 'entering') {
      if (driveIn(u, slot)) { slot.state = 'unloading'; u.harvest.state = 'unloading'; }
    } else if (slot.state === 'unloading') unload(world, ref, u, slot);
    else if (driveOut(u, slot)) release(world, ref, u);
  }
}

/** Turn into line with the slot on the entrance, then drive up onto the pad. */
function driveIn(u, slot) {
  if (Math.abs(angleDiff(u.heading, slot.face)) > 1e-3) {
    u.heading = turnToward(u.heading, slot.face, TURN_RATE[u.type.turn ?? 1] * DT);
    if (!u.type.turret) u.turret = u.heading;
    return false;
  }
  const dx = slot.padX - slot.outX, dy = slot.padY - slot.outY;
  slot.t = Math.min(1, slot.t + DT / BAY_DRIVE_SECONDS);
  u.x = slot.outX + dx * slot.t;
  u.y = slot.outY + dy * slot.t;
  u.distance += (Math.hypot(dx, dy) * DT) / BAY_DRIVE_SECONDS;   // treads turn
  return slot.t >= 1;
}

/** Back out the way it came (treads in reverse); by another way out, drive and turn as it goes. */
function driveOut(u, slot) {
  const dx = slot.outX - slot.padX, dy = slot.outY - slot.padY, len = Math.hypot(dx, dy);
  slot.t = Math.min(1, slot.t + DT / BAY_DRIVE_SECONDS);
  u.x = slot.padX + dx * slot.t;
  u.y = slot.padY + dy * slot.t;
  u.distance += ((slot.reverse ? -len : len) * DT) / BAY_DRIVE_SECONDS;
  if (!slot.reverse && len) u.heading = turnToward(u.heading, Math.atan2(dy, dx), TURN_RATE[u.type.turn ?? 1] * DT);
  if (!u.type.turret) u.turret = u.heading;
  return slot.t >= 1;
}

function unload(world, ref, u, slot) {
  const h = u.harvest;
  if (h.load > 0 && !u.afterDock) {
    const house = world.houses.get(u.house);
    const amount = Math.min(UNLOAD_RATE * DT * Math.max(MIN_REFINE, ref.hp / ref.maxHp), h.load);
    house.stats.spiceHarvested += addCredits(world, house, amount * (house.incomeRate ?? 1));   // banked credits; Hard AIs earn half again
    h.load -= amount;
    if (h.load > 1e-6) return;
    h.load = 0;
  }
  const out = exitTile(world, ref, u, slot);   // empty, or called away: back out
  if (out < 0) return;   // boxed in: wait for room
  const map = world.map;
  map.unit[out] = u.id;   // hold the way out
  u.tx = map.xOf(out);
  u.ty = map.yOf(out);
  const ox = u.tx + 0.5, oy = u.ty + 0.5;
  Object.assign(slot, { state: 'leaving', t: 0, outX: ox, outY: oy, padX: u.x, padY: u.y, reverse: Math.abs(angleDiff(u.heading + Math.PI, Math.atan2(oy - u.y, ox - u.x))) < Math.PI / 4 });
  h.state = 'undocking';
}

/** The entrance when it is clear; after a short wait for it, any free tile beside the building on the same ground. -1 while boxed in. */
function exitTile(world, ref, u, slot) {
  const map = world.map, door = slot.door;
  const open = (i) => !map.unit[i] && !map.structure[i] && map.moveFactor(i, 'harvester') > 0;
  if (open(door)) return door;
  const blocker = world.units.get(map.unit[door]);
  if (blocker) clearDock(world, blocker.id, u);   // ask a parked friend to make room
  if ((slot.waited += DT) < EXIT_PATIENCE) return -1;
  const sameGround = !map.structure[door];
  let best = -1, bestD = Infinity;
  for (let y = ref.y - 1; y <= ref.y + ref.h; y++) for (let x = ref.x - 1; x <= ref.x + ref.w; x++) {
    if (!map.inBounds(x, y)) continue;
    const i = map.idx(x, y);
    if (!open(i) || (sameGround && !world.reach.connected(door, i, 'harvester'))) continue;
    const d = Math.hypot(x - map.xOf(door), y - map.yOf(door));
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function release(world, ref, u) {
  u.inside = 0;
  u.docked = 0;
  u.x = ref.slot.outX;
  u.y = ref.slot.outY;
  ref.dockedBy = 0;
  ref.slot = null;
  world.events.push('undocked', { id: u.id, refinery: ref.id, house: u.house, x: u.x, y: u.y });
  resume(world, u);
}

/** The refinery went with the harvester in it: put it down on its own tile, or the nearest free one. */
function setDown(world, u) {
  const map = world.map, refinery = u.docked;
  const held = map.unit[map.idx(u.tx, u.ty)] === u.id;   // already backing out onto it
  const spot = held ? { x: u.tx, y: u.ty } : findFreeTile(world, Math.floor(u.x), Math.floor(u.y), 'harvester', 12);
  u.inside = 0;
  u.docked = 0;
  if (!spot) { killUnit(world, u, null); return; }
  map.unit[map.idx(spot.x, spot.y)] = u.id;
  u.tx = spot.x;
  u.ty = spot.y;
  u.x = spot.x + 0.5;
  u.y = spot.y + 0.5;
  world.events.push('undocked', { id: u.id, refinery, house: u.house, x: u.x, y: u.y });
  resume(world, u);
}

/** Out of the slot: carry out an order given while docked, else back to the routine. */
function resume(world, u) {
  const h = u.harvest, next = u.afterDock;
  u.afterDock = null;
  h.state = h.load > 0 ? 'toRefinery' : 'seek';
  h.target = -1;
  h.wait = 0;
  if (next && next.house === u.house) applyCommand(world, u.house, next.cmd);
}

/**
 * Orders for harvesters in a refinery's slot (units held inside take no orders directly): a harvest
 * order picks the next field and lets it finish unloading, a return order is already done, anything
 * else is carried out once it has backed out.
 */
export function orderDocked(world, houseId, cmd) {
  if (!Array.isArray(cmd?.ids)) return;
  const map = world.map;
  for (const id of cmd.ids) {
    const u = world.units.get(id);
    if (!u?.docked || u.house !== houseId) continue;
    if (cmd.type === 'harvest') {
      if (Number.isFinite(cmd.x) && Number.isFinite(cmd.y) && map.inBounds(Math.floor(cmd.x), Math.floor(cmd.y))) u.harvest.field = map.idx(Math.floor(cmd.x), Math.floor(cmd.y));
      u.afterDock = null;
      u.order = { type: 'harvest' };
    } else if (UNIT_COMMANDS.has(cmd.type)) u.afterDock = { house: houseId, cmd: { ...cmd, ids: [u.id] } };
  }
}

export function spawnFreeHarvester(world, ref) {
  const map = world.map;
  const dock = dockTile(world, ref);
  if (world.rules.airDelivery && dock >= 0) {   // flown in from the map edge by a Carryall (spec §4.3)
    return deliverByAir(world, ref.house, 'harvester', { x: map.xOf(dock), y: map.yOf(dock) }, { key: 'harvesterDeployed', text: 'Harvester deployed.' });
  }
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
