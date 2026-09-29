// House specials (spec §4.6): Deviator gas turns enemy ground units to the gasser's side for 40 s; then
// they go home. A unit taken twice keeps its first owner on record, and gas from that owner brings it
// home at once. Units held in a bay or a Carryall are not gassed, and go home only once they are out.
// Destruct: a Devastator stops, glows for three seconds and blows itself apart.
import { DEVIATOR, DESTRUCT } from '../data/tuning.js';
import { deviatable, killUnit } from './combat.js';
import { splash } from './aftermath.js';
import { transferUnit } from './capture.js';
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
