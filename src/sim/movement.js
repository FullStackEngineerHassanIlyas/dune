// Tile-to-tile ground movement: a unit holds its tile and reserves the next, turns toward it
// (tracked vehicles on the spot), then drives at the original speed for the terrain it enters.
// The tile it leaves is released halfway. Blocked units wait, ask idle friends to make way,
// re-plan around units, and give up after STUCK_GIVEUP_SECONDS so nothing deadlocks.
import { DT, SIM_HZ, TURN_RATE, TURRET_TURN_RATE, DRIVE_ANGLE, groundSpeed, STUCK_REPATH_SECONDS, STUCK_GIVEUP_SECONDS } from '../data/tuning.js';
import { angleDiff, turnToward } from './geometry.js';

const REPATH_TICKS = Math.round(STUCK_REPATH_SECONDS * SIM_HZ);
const GIVEUP_TICKS = Math.round(STUCK_GIVEUP_SECONDS * SIM_HZ);
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function updateMovement(world, u) {
  if (!u.isGround) return;
  if (!u.type.turret) u.turret = u.heading;
  else if (!u.aiming) u.turret = turnToward(u.turret, u.heading, TURRET_TURN_RATE * DT);   // combat sets aiming
  if (u.step) { advance(world, u); return; }
  if (u.pathState === 'waiting') return;
  if (u.pathState !== 'ready' || u.pathIndex >= u.path.length) { arrive(world, u); return; }
  const map = world.map;
  const next = u.path[u.pathIndex];
  const nx = map.xOf(next), ny = map.yOf(next);
  if (map.moveFactor(next, u.move) === 0 || Math.max(Math.abs(nx - u.tx), Math.abs(ny - u.ty)) !== 1) { replan(world, u); return; }
  const want = Math.atan2(ny - u.ty, nx - u.tx);
  const off = Math.abs(angleDiff(u.heading, want));
  u.heading = turnToward(u.heading, want, TURN_RATE[u.type.turn] * DT);
  if (off > DRIVE_ANGLE[u.move]) return;
  const occupant = map.unit[next];
  if (occupant && occupant !== u.id) { blocked(world, u, occupant); return; }
  if (nx !== u.tx && ny !== u.ty && crossing(world, u, nx, ny)) return;   // wait: someone is crossing the other diagonal
  map.unit[next] = u.id;
  const dist = nx !== u.tx && ny !== u.ty ? Math.SQRT2 : 1;
  u.step = { from: map.idx(u.tx, u.ty), to: next, dist, progress: u.carry / dist, released: false };
  u.carry = 0;
  u.waitTicks = 0;
  advance(world, u);
}

function advance(world, u) {
  const map = world.map, s = u.step;
  const speed = groundSpeed(u.type.speed, map.moveFactor(s.to, u.move) || 64) * (u.speedMul ?? 1);
  const fx = map.xOf(s.from) + 0.5, fy = map.yOf(s.from) + 0.5, tx = map.xOf(s.to) + 0.5, ty = map.yOf(s.to) + 0.5;
  u.heading = turnToward(u.heading, Math.atan2(ty - fy, tx - fx), TURN_RATE[u.type.turn] * DT);
  s.progress += (speed * DT) / s.dist;
  u.distance += speed * DT;
  if (!s.released && s.progress >= 0.5) {
    if (map.unit[s.from] === u.id) map.unit[s.from] = 0;
    s.released = true;
  }
  if (s.progress >= 1) {
    u.carry = Math.min(0.5, (s.progress - 1) * s.dist);
    u.x = tx; u.y = ty;
    u.tx = map.xOf(s.to); u.ty = map.yOf(s.to);
    u.step = null;
    u.pathIndex++;
    // progress means getting closer to the goal than ever before; side-steps do not reset the give-up clock
    const d = u.goal >= 0 ? Math.max(Math.abs(u.tx - map.xOf(u.goal)), Math.abs(u.ty - map.yOf(u.goal))) : 0;
    if (d < (u.bestGoalDist ?? Infinity)) { u.bestGoalDist = d; u.stuckTicks = 0; u.repaths = 0; }
    world.onTileEntered?.(u);
  } else {
    u.x = fx + (tx - fx) * s.progress;
    u.y = fy + (ty - fy) * s.progress;
  }
}

const isIdle = (u) => u.pathState !== 'ready' && u.pathState !== 'waiting';

function blocked(world, u, occupantId) {
  const other = world.units.get(occupantId);
  if (other && u.move === 'tracked' && other.move === 'foot' && other.house !== u.house && world.onCrush) { world.onCrush(u, other); return; }   // tracks crush enemy infantry
  const lastStep = u.pathIndex === u.path.length - 1;
  const parked = other && !other.step && isIdle(other);
  if (parked) {
    if (lastStep) { u.path.length = u.pathIndex; arrive(world, u); return; }   // our spot is taken: stop beside it
    if (other.house === u.house) nudge(world, other, u);
  }
  if (++u.waitTicks < REPATH_TICKS) return;
  u.waitTicks = 0;
  u.stuckTicks += REPATH_TICKS;
  if (u.stuckTicks >= GIVEUP_TICKS) { giveUp(world, u); return; }
  // A blocker that is parked, or waiting for our own tile (head-on), will not clear by itself: if there
  // is no way around it, stop. A blocker that is moving on will clear: keep the route and wait.
  const headOn = other && !other.step && other.path[other.pathIndex] === world.map.idx(u.tx, u.ty);
  // Two units waiting for each other's tiles would both side-step the same way, again and again: only
  // the one with the higher id goes round; the other holds still so the detour stays open.
  if (headOn && u.id < other.id) return;
  replan(world, u, { avoidUnits: true, keepIfEmpty: !(parked || headOn) });
}

// Ask an idle friendly unit to step onto a free neighbouring tile that is not on our way.
function nudge(world, other, requester) {
  if (world.tick - other.nudgedAt < 30 || other.noNudge || other.inside) return;   // a vehicle driving out of a repair bay keeps its way
  const map = world.map;
  const onPath = new Set(requester.path.slice(requester.pathIndex, requester.pathIndex + 4));
  const options = [];
  for (const [dx, dy] of N8) {
    const x = other.tx + dx, y = other.ty + dy;
    if (!map.inBounds(x, y)) continue;
    const i = map.idx(x, y);
    if (!map.unit[i] && map.moveFactor(i, other.move) > 0 && !onPath.has(i)) options.push(i);
  }
  if (!options.length) return;
  const target = options[world.rng.int(options.length)];
  other.nudgedAt = world.tick;
  other.resumeOrder = other.order.type === 'move' ? null : other.order;   // e.g. a harvester's routine
  other.order = { type: 'move', x: map.xOf(target), y: map.yOf(target), nudge: true };
  other.goal = target;
  other.path = [target];
  other.pathIndex = 0;
  other.pathState = 'ready';
  other.pathReached = true;
  other.stuckTicks = 0;
  other.waitTicks = 0;
}

function replan(world, u, opts = {}) {
  if (u.goal < 0) { arrive(world, u); return; }
  u.repaths++;
  world.requestPath(u, u.goal, opts);
}

function giveUp(world, u) {
  u.path = []; u.pathIndex = 0; u.pathState = 'none'; u.goal = -1; u.stuckTicks = 0; u.waitTicks = 0;
  if (u.order.type === 'move') u.order = { type: 'idle' };
  world.events.push('moveFailed', { id: u.id });
}

function arrive(world, u) {
  u.carry = 0;
  const here = world.map.idx(u.tx, u.ty);
  // a partial path (search budget ran out) continues toward the goal
  if (u.pathState === 'ready' && !u.pathReached && u.goal >= 0 && here !== u.goal && u.repaths < 6) { replan(world, u); return; }
  u.path = []; u.pathIndex = 0; u.pathState = 'none'; u.stuckTicks = 0; u.waitTicks = 0;
  if (u.order.type === 'move') {
    u.order = (u.order.nudge && u.resumeOrder) || { type: 'idle' };
    u.resumeOrder = null;
    u.goal = -1;
    world.events.push('arrived', { id: u.id });
  } else if (u.order.type === 'deploy') {
    world.onDeploy?.(u);
  }
}

/** Another unit mid-step along the other diagonal of the same 2 × 2 square would pass through this one. */
function crossing(world, u, nx, ny) {
  const map = world.map, a = map.idx(nx, u.ty), b = map.idx(u.tx, ny);
  for (const i of [a, b]) {
    const o = world.units.get(map.unit[i]);
    if (o && o !== u && o.step && ((o.step.from === a && o.step.to === b) || (o.step.from === b && o.step.to === a))) return true;
  }
  return false;
}
