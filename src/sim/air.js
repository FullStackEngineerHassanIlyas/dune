// Aircraft (spec §4.1, §4.6): Carryalls and Ornithopters fly over everything at their original speeds
// (speedFactor / 40 tiles per second), hold no tiles and keep a cruising height `alt`. A Carryall is a
// VTOL lifter: it flies straight at its goal and hovers there. An Ornithopter flies like a plane —
// always at full speed, turning no tighter than its orbit — so it circles over a spot and makes passes.
import { DT, TURN_RATE, airSpeed, AIR } from '../data/tuning.js';
import { turnToward } from './geometry.js';
import { updateCarryall } from './carryall.js';
import { updateOrnithopter } from './ornithopter.js';
import { updateFrigate } from './starport.js';

export function updateAircraft(world, u) {
  if (u.typeId === 'carryall') updateCarryall(world, u);
  else if (u.typeId === 'ornithopter') updateOrnithopter(world, u);
  else if (u.typeId === 'frigate') updateFrigate(world, u);
}

/** The nearest point on the map edge (tile coordinates): where visiting aircraft come from and leave to. */
export function nearestEdge(map, x, y) {
  const tx = Math.max(0, Math.min(map.w - 1, Math.floor(x))), ty = Math.max(0, Math.min(map.h - 1, Math.floor(y)));
  const edges = [[tx, 0], [tx, map.h - 1], [0, ty], [map.w - 1, ty]];
  const [ex, ey] = edges.reduce((a, b) => (Math.hypot(b[0] - x, b[1] - y) < Math.hypot(a[0] - x, a[1] - y) ? b : a));
  return { x: ex, y: ey };
}

/** Keep a flying unit over the map and its tile indices current (fog, radar and picking read them). */
export function track(world, u) {
  const map = world.map;
  u.x = Math.max(0.5, Math.min(map.w - 0.5, u.x));
  u.y = Math.max(0.5, Math.min(map.h - 0.5, u.y));
  u.tx = Math.floor(u.x);
  u.ty = Math.floor(u.y);
  u.turret = u.heading;
}

/** Towards a flying height at the climb rate; true once there. */
export function climb(u, alt) {
  const now = u.alt ?? 0, d = alt - now;
  u.alt = now + Math.sign(d) * Math.min(Math.abs(d), AIR.climb * DT);
  return Math.abs(alt - u.alt) < 1e-9;
}

/** VTOL flight straight at (x, y), the nose turning that way; true on arrival. */
export function hoverTo(world, u, x, y) {
  const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy), step = airSpeed(u.type.speed) * DT;
  if (d > 0.05) u.heading = turnToward(u.heading, Math.atan2(dy, dx), TURN_RATE[u.type.turn] * DT);
  if (d <= step) { u.x = x; u.y = y; u.distance += d; track(world, u); return true; }
  u.x += (dx / d) * step;
  u.y += (dy / d) * step;
  u.distance += step;
  track(world, u);
  return false;
}

/** Winged flight: full speed along the nose, turning towards (x, y) no tighter than the orbit. Returns the distance left. */
export function flyAt(world, u, x, y) {
  const speed = airSpeed(u.type.speed);
  u.heading = turnToward(u.heading, Math.atan2(y - u.y, x - u.x), (speed / AIR.orbit) * DT);
  u.x += Math.cos(u.heading) * speed * DT;
  u.y += Math.sin(u.heading) * speed * DT;
  u.distance += speed * DT;
  track(world, u);
  return Math.hypot(x - u.x, y - u.y);
}
