// House specials (spec §4.6): Deviator gas turns enemy ground units to the gasser's side for 40 s; then
// they go home. A unit taken twice keeps its first owner on record, and gas from that owner brings it
// home at once. Units held in a bay or a Carryall are not gassed, and go home only once they are out.
// Destruct: a Devastator stops, glows for three seconds and blows itself apart.
// Saboteurs walk into an enemy building (over its walls) and blow it up; one that is killed goes off where it falls.
import { DEVIATOR, DESTRUCT, SABOTEUR } from '../data/tuning.js';
import { deviatable, killUnit, damage, onTheMove } from './combat.js';
import { splash } from './aftermath.js';
import { transferUnit, beside } from './capture.js';
import { stopUnit } from './orders.js';

/** A gas cloud bursts at p: enemy ground units close by change sides, except the immune. */
export function deviate(world, p) {
  for (const u of [...world.units.values()]) {
    if (u.house === p.house || !deviatable(u) || Math.hypot(u.x - p.x, u.y - p.y) > DEVIATOR.radius) continue;
    if (u.deviated?.from === p.house) { restore(world, u); continue; }   // gassed by the side it was taken from
    const from = u.house;
    u.deviated = { from: u.deviated?.from ?? from, until: world.time + DEVIATOR.seconds };
    transferUnit(world, u, p.house);
    stopUnit(u);
    world.events.push('unitDeviated', { id: u.id, from, to: p.house, x: u.x, y: u.y });
  }
}

function restore(world, u) {
  const home = u.deviated.from;
  u.deviated = null;
  transferUnit(world, u, home);
  stopUnit(u);
  world.events.push('unitReverted', { id: u.id, to: home, x: u.x, y: u.y });
}

/** The gas wears off: deviated units go home (not while held in a bay or a Carryall's claws). */
export function updateDeviations(world) {
  for (const u of [...world.units.values()]) if (u.deviated && world.time >= u.deviated.until && !u.inside) restore(world, u);
}

/** Destruct (spec §4.6): the Devastator stops where it is, glows and takes no more orders. */
export function orderDestruct(world, u) {
  if (!u.type.destructs || u.destructAt !== undefined) return;
  stopUnit(u);
  u.target = null;
  u.aiming = false;
  u.noNudge = true;   // it keeps its tile: friends drive round
  u.destructAt = world.time + DESTRUCT.delay;
  world.events.push('destructArmed', { id: u.id, house: u.house, x: u.x, y: u.y });
}

/** A blast where it stood and seven more round it; nobody close by is spared. */
export function destruct(world, u) {
  const { x, y } = u, by = { house: u.house, id: u.id, kind: 'unit' };
  killUnit(world, u, null, 'destructed');
  splash(world, x, y, world.rng.range(DESTRUCT.centre[0], DESTRUCT.centre[1]), DESTRUCT.radius, by, 'large');
  for (let k = 0; k < DESTRUCT.blasts; k++) {
    const a = world.rng.range(0, Math.PI * 2), r = DESTRUCT.scatter * Math.sqrt(world.rng.next());
    splash(world, x + Math.cos(a) * r, y + Math.sin(a) * r, world.rng.range(DESTRUCT.blast[0], DESTRUCT.blast[1]), DESTRUCT.radius, by, 'medium');
  }
}

const GIVE_UP_TRIES = 8;

/** Saboteurs sent into an enemy building (never a wall: they walk over those). */
export function orderSabotage(world, houseId, units, structureId) {
  const s = world.structures.get(structureId);
  if (!s || s.house === houseId || s.type.isWall) return;
  const ids = [];
  for (const u of units) {
    if (!u.type.sabotage) continue;
    stopUnit(u);
    u.order = { type: 'sabotage', structureId: s.id, tries: 0 };
    u.target = null;
    u.aiming = false;
    ids.push(u.id);
  }
  if (ids.length) world.events.push('sabotageOrdered', { ids, structureId: s.id, house: houseId });
}

/** A Saboteur on its way (runs before movement): beside the building it goes off, else it walks on. */
export function updateSabotage(world, u) {
  const o = u.order, s = world.structures.get(o.structureId);
  if (!s || s.house === u.house) { stopUnit(u); return; }   // gone, or taken by a friend
  if (onTheMove(u)) return;
  if (beside(u, s)) { detonate(world, u, s); return; }
  const goal = ++o.tries > GIVE_UP_TRIES ? -1 : approachTile(world, u, s);
  if (goal < 0) { stopUnit(u); world.events.push('moveFailed', { id: u.id }); return; }
  world.requestPath(u, goal);
}

/** The nearest free tile touching the building that the Saboteur can stand on (a wall will do). */
function approachTile(world, u, s) {
  const map = world.map;
  let best = -1, bestD = Infinity;
  for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) {
    if (!map.inBounds(x, y) || (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)) continue;
    const i = map.idx(x, y);
    if (map.moveFactor(i, u.move) <= 0 || (map.unit[i] && map.unit[i] !== u.id)) continue;
    const d = Math.hypot(x - u.tx, y - u.ty);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** 500 into the building and the blast round it; the Saboteur is spent, not lost. */
function detonate(world, u, s) {
  const by = { house: u.house, id: u.id, kind: 'unit' };
  world.removeUnit(u, 'detonated');
  world.events.push('unitDestroyed', { id: u.id, typeId: u.typeId, house: u.house, x: u.x, y: u.y, by: null, cause: 'detonated' });
  damage(world, s, SABOTEUR.blast, by);
  splash(world, u.x, u.y, SABOTEUR.splash, SABOTEUR.radius, by, 'large');
}
