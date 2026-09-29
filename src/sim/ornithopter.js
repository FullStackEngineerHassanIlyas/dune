// Ornithopter (spec §4.6; research: units.md "Ornithopter"): a fast, fragile air striker. Left to itself
// it hunts — the nearest enemy unit or building it can see anywhere (the computer sees everything) —
// making passes and firing its mini-rockets when the target is in range ahead of its nose, twice a pass
// while above half health. A move order sends it to a spot it then guards, circling and engaging what
// comes near; an attack order sends it after one target and afterwards it guards where it is; Stop sets
// it hunting again. It never goes after other aircraft.
import { DT, AIR, fireDelaySeconds, SECOND_SHOT_DELAY } from '../data/tuning.js';
import { angleDiff } from './geometry.js';
import { findTarget, targetPoint, distanceTo, fireAt, validTarget, canSee } from './combat.js';
import { flyAt, climb } from './air.js';

const SCAN_TICKS = 4;
const gun = (u) => ({ kind: 'unit', id: u.id, house: u.house, x: u.x, y: u.y, alt: u.alt });

export function updateOrnithopter(world, u) {
  climb(u, AIR.cruise);
  if (u.cooldown > 0) u.cooldown -= DT;
  const o = u.order;
  let t;
  if (o.type === 'attack') {
    t = o.target;
    if (!validTarget(world, u.house, t, o.force)) { u.order = { type: 'guard', x: u.tx, y: u.ty }; t = null; }
  } else {
    t = u.target;
    if (t && !keep(world, u, t)) t = u.target = null;
    if (!t && o.type !== 'move' && (world.tick + u.id) % SCAN_TICKS === 0) {
      const from = o.type === 'guard' ? { x: o.x + 0.5, y: o.y + 0.5 } : u;
      t = u.target = findTarget(world, u.house, from.x, from.y, o.type === 'idle' ? AIR.huntRadius : u.type.range + AIR.guardRadius);
    }
  }
  secondShot(world, u, t);
  if (t) { attackRun(world, u, t); return; }
  if (o.type === 'move' || o.type === 'attackMove') {
    if (flyAt(world, u, o.x + 0.5, o.y + 0.5) < AIR.orbit + 0.5) u.order = { type: 'guard', x: o.x, y: o.y };   // arrived: guard the spot
    return;
  }
  if (u.order.type === 'guard') { flyAt(world, u, u.order.x + 0.5, u.order.y + 0.5); return; }
  u.loiter ??= { x: u.x, y: u.y };   // nothing to hunt: circle where it is
  flyAt(world, u, u.loiter.x, u.loiter.y);
}

/** Hunting: to the end. Guarding or attack-moving: while it stays near the post or the path. */
function keep(world, u, t) {
  if (!validTarget(world, u.house, t, false)) return false;
  const p = targetPoint(world, t), o = u.order;
  if (!canSee(world, u.house, t.kind, p.entity)) return false;
  if (o.type === 'guard') return Math.hypot(p.x - o.x - 0.5, p.y - o.y - 0.5) <= u.type.range + AIR.guardRadius + 2;
  if (o.type === 'attackMove') return Math.hypot(p.x - u.x, p.y - u.y) <= u.type.range + AIR.guardRadius + 2;
  return o.type !== 'move';
}

function attackRun(world, u, t) {
  u.loiter = null;
  const p = targetPoint(world, t);
  flyAt(world, u, p.x, p.y);
  const d = distanceTo(u.x, u.y, t, p);
  if (u.cooldown > 0 || d > u.type.range + 0.25 || Math.abs(angleDiff(u.heading, Math.atan2(p.y - u.y, p.x - u.x))) > AIR.aimCone) return;
  fireAt(world, gun(u), t, p, d, u.type);
  u.cooldown = fireDelaySeconds(u.type.fireDelay);
  if (u.type.firesTwice && u.hp > u.maxHp / 2) u.secondShot = SECOND_SHOT_DELAY;
}

function secondShot(world, u, t) {
  if (!(u.secondShot > 0) || (u.secondShot -= DT) > 0) return;
  u.secondShot = 0;
  if (!t || !validTarget(world, u.house, t, u.order.force)) return;
  const p = targetPoint(world, t), d = distanceTo(u.x, u.y, t, p);
  if (d <= u.type.range + 0.5) fireAt(world, gun(u), t, p, d, u.type);
}
