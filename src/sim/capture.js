// Capturing (spec §4.6; research: structures.md "Capture"): infantry ordered into an enemy building walk
// up to it; if it is conquerable and below a quarter of its hit points it changes hands and the soldiers
// stay inside (they are used up). A building that is still too strong is attacked instead. Barracks,
// WOR, Outposts, the House of IX, Palaces and walls cannot be taken. What the building holds changes hands
// with it: a harvester unloading on a refinery pad, a vehicle in a repair bay. The old owner loses the
// share of credits a captured store held, as when one is destroyed.
import { CAPTURE_BELOW } from '../data/tuning.js';
import { loseStorageShare, revokeStartBuffer } from './economy.js';
import { onTheMove } from './combat.js';
import { orderAttack, stopUnit } from './orders.js';
import { announce } from './announce.js';

const GIVE_UP_TRIES = 8;
const INFANTRY = new Set(['soldier', 'infantry', 'trooper', 'troopers']);   // the Saboteur has its own mission (specials.js)

export const canCapture = (u) => INFANTRY.has(u.typeId);
export const capturable = (s, houseId) => !!s && s.house !== houseId && !!s.type.conquerable && s.hp < s.maxHp * CAPTURE_BELOW;

export function orderCapture(world, houseId, units, structureId) {
  const s = world.structures.get(structureId);
  if (!s || s.house === houseId || !s.type.conquerable) return;
  const ids = [];
  for (const u of units) {
    if (!canCapture(u)) continue;
    stopUnit(u);
    u.order = { type: 'capture', structureId: s.id, tries: 0 };
    u.target = null;
    u.aiming = false;
    ids.push(u.id);
  }
  if (ids.length) world.events.push('captureOrdered', { ids, structureId: s.id, house: houseId });
}

export const beside = (u, s) => u.tx >= s.x - 1 && u.tx <= s.x + s.w && u.ty >= s.y - 1 && u.ty <= s.y + s.h;

/** The free tile next to the building nearest to the unit, or -1. */
function besideTile(world, u, s) {
  const map = world.map;
  let best = -1, bestD = Infinity;
  for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) {
    if (!map.inBounds(x, y) || (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)) continue;
    const i = map.idx(x, y);
    if (map.structure[i] || map.moveFactor(i, u.move) <= 0 || (map.unit[i] && map.unit[i] !== u.id)) continue;
    const d = Math.hypot(x - u.tx, y - u.ty);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** Infantry on a capture order (runs before movement). */
export function updateCapture(world, u) {
  const o = u.order, s = world.structures.get(o.structureId);
  if (!s || s.house === u.house) { stopUnit(u); return; }   // gone, or taken by a comrade
  if (onTheMove(u)) return;
  if (beside(u, s)) {
    if (capturable(s, u.house)) captureStructure(world, s, u);
    else orderAttack(world, [u], { targetKind: 'structure', targetId: s.id });   // still too strong: shoot at it
    return;
  }
  const goal = ++o.tries > GIVE_UP_TRIES ? -1 : besideTile(world, u, s);
  if (goal < 0) { stopUnit(u); world.events.push('moveFailed', { id: u.id }); return; }
  world.requestPath(u, goal);
}

/** The squad walks in: the building and what it holds change hands. */
export function captureStructure(world, s, u) {
  const from = s.house, to = u.house;
  world.removeUnit(u, 'entered');
  transferStructure(world, s, to);
  const loser = world.houses.get(from), captor = world.houses.get(to);
  if (loser) loser.stats.structuresLost++;
  if (captor) captor.stats.structuresCaptured++;
  world.events.push('structureCaptured', { id: s.id, typeId: s.typeId, from, to, x: s.x, y: s.y, w: s.w, h: s.h });
  announce(world, to, 'captured', 'Structure captured.');
  announce(world, from, 'lostToCapture', 'Structure lost to the enemy.');
}

export function transferStructure(world, s, to) {
  const from = world.houses.get(s.house), next = world.houses.get(to);
  s.house = to;
  s.repairing = false;
  s.repairStalled = false;
  s.primary = false;
  s.rally = null;
  s.target = null;
  if (from) s.seenBy = (s.seenBy ?? 0) | (1 << from.slot);   // its former owner keeps it on the map as last seen
  for (const id of [s.dockedBy, s.occupant]) if (id && world.units.has(id)) transferUnit(world, world.units.get(id), to);
  if (s.type.storage) {
    if (from) loseStorageShare(world, from, s.type.storage);
    if (next) revokeStartBuffer(world, next);
  }
}

/** A unit changes sides and carries on with what it was doing (unloading, being repaired). */
export function transferUnit(world, u, to) {
  const from = u.house;
  u.house = to;
  u.target = null;
  u.abandoned = null;
  world.events.push('unitCaptured', { id: u.id, from, to });
}
