// Combat (spec §4.6): targets, aiming, firing, projectiles, damage and death. Flat damage, no armour;
// accurate weapons always hit their target, rockets scatter (1 in 16 wildly); units that fire twice do
// so only above half health. The Sonic Tank's wave runs its full range and hurts everything on its path
// once — friend or foe, but never Sonic Tanks or walls. Turreted units aim independently and fire on the
// move; the others turn the hull and fire only while standing. Stances: idle units engage what comes
// into range, guards chase no further than their leash, attack-move engages on the way, an attack
// order chases its target and gives up when it gets no closer. The player's side engages only what its
// fog shows; the AI sees everything, as in the original.
import { WEAPONS, shotFor } from '../data/weapons.js';
import { DT, TURN_RATE, TURRET_TURN_RATE, fireDelaySeconds, projectileSpeed, SECOND_SHOT_DELAY, SCATTER, AIM_TOLERANCE, GUARD_RADIUS, GUARD_LEASH, CHASE_GIVEUP_SECONDS, LOW_POWER_TURRET_RATE, RETALIATE_RANGE, AIR, SONIC, DEVIATOR } from '../data/tuning.js';
import { angleDiff, turnToward } from './geometry.js';
import { unitVisibleTo, structureVisibleTo } from './fog.js';

const SCAN_TICKS = 4;   // targets are looked for five times a second

export const isArmed = (t) => !!(t && t.weapon && WEAPONS[t.weapon] && (t.damage > 0 || WEAPONS[t.weapon].gas));   // the Deviator's gas does no harm but is its weapon
const GAS_IMMUNE = new Set(DEVIATOR.immune);
/** Deviator gas turns ground units that can change sides: not aircraft, Harvesters, MCVs, Deviators or worms, nor anything held inside. */
export const deviatable = (u) => !!u && u.kind === 'unit' && u.isGround && !u.inside && !GAS_IMMUNE.has(u.typeId);
export const onTheMove = (u) => !!u.step || u.pathState === 'waiting' || (u.pathState === 'ready' && u.pathIndex < u.path.length);

export function targetPoint(world, t) {
  if (!t) return null;
  if (t.kind === 'unit') { const u = world.units.get(t.id); return u ? { x: u.x, y: u.y, entity: u } : null; }
  if (t.kind === 'structure') { const s = world.structures.get(t.id); return s ? { x: s.x + s.w / 2, y: s.y + s.h / 2, entity: s } : null; }
  return { x: t.x + 0.5, y: t.y + 0.5, entity: null };
}

/** Tiles from (x, y) to a target; structures count from their nearest footprint tile. */
export function distanceTo(x, y, t, p) {
  if (t.kind === 'structure') {
    const s = p.entity;
    const cx = Math.max(s.x + 0.5, Math.min(s.x + s.w - 0.5, x)), cy = Math.max(s.y + 0.5, Math.min(s.y + s.h - 0.5, y));
    return Math.hypot(cx - x, cy - y);
  }
  return Math.hypot(p.x - x, p.y - y);
}

const seesAll = (world, houseId) => { const h = world.houses.get(houseId); return !h || h.isAI || !world.fogOfWar; };
export const canSee = (world, houseId, kind, e) => seesAll(world, houseId) || (kind === 'unit' ? unitVisibleTo(world, houseId, e) : structureVisibleTo(world, houseId, e));

export function findTarget(world, houseId, x, y, radius, { structures = true, ignoreFog = false, exclude = 0, air = false, only = null } = {}) {
  let best = null, bestD = Infinity;
  for (const u of world.units.values()) {
    if (u.house === houseId || (!u.isGround && !air) || u.inside || u.type.untargetable || u.id === exclude || (only && !only(u))) continue;   // aircraft only for anti-air; never the Frigate
    const d = Math.hypot(u.x - x, u.y - y);
    if (d > radius || d >= bestD || (!ignoreFog && !canSee(world, houseId, 'unit', u))) continue;
    best = { kind: 'unit', id: u.id };
    bestD = d;
  }
  if (!structures) return best;
  for (const s of world.structures.values()) {
    if (s.house === houseId || s.type.isWall || s.id === exclude) continue;
    const d = distanceTo(x, y, { kind: 'structure' }, { entity: s });
    if (d > radius || d >= bestD - 0.5 || (!ignoreFog && !canSee(world, houseId, 'structure', s))) continue;   // units win close calls: they shoot back
    best = { kind: 'structure', id: s.id };
    bestD = d;
  }
  return best;
}

export function validTarget(world, houseId, t, force, canHitAir = false) {
  if (!t) return false;
  if (t.kind === 'tile') return true;
  const e = t.kind === 'unit' ? world.units.get(t.id) : world.structures.get(t.id);
  if (!e || e.hp <= 0) return false;
  if (t.kind === 'unit' && (e.inside || e.type.untargetable || (!e.isGround && !canHitAir))) return false;   // held in a bay or a Carryall: safe; aircraft: anti-air only
  return !!force || e.house !== houseId;
}

/** Stop after the current tile, keeping the order. */
export function stopMoving(u) {
  if (u.pathState === 'waiting') u.pathState = 'none';
  if (u.pathState === 'ready') u.path.length = Math.min(u.path.length, u.pathIndex + (u.step ? 1 : 0));
  u.goal = -1;
  u.pathReached = true;
}

export function fireAt(world, from, t, p, dist, stats) {
  const shot = shotFor(stats.weapon, dist);
  if (!shot) return;
  if (shot.wave) { fireWave(world, from, p, stats, shot); return; }
  const air = t.kind === 'unit' && !!p.entity && !p.entity.isGround;
  let ax = p.x, ay = p.y;
  if (!shot.accurate && !air) {
    const wild = world.rng.chance(SCATTER.wildChance);
    const r = (wild ? SCATTER.wildBase + dist * SCATTER.wildPerTile : SCATTER.base + dist * SCATTER.perTile) * world.rng.next();
    const a = world.rng.range(0, Math.PI * 2);
    ax += Math.cos(a) * r;
    ay += Math.sin(a) * r;
  }
  const hits = !air || shot.accurate || world.rng.chance(AIR.hitChance);   // at aircraft everything homes in; loose rockets may still miss
  const id = world.nextProjectileId++;
  world.projectiles.set(id, {
    id, weapon: stats.weapon, projectile: shot.projectile, house: from.house, sourceId: from.id, sourceKind: from.kind,
    x: from.x, y: from.y, px: from.x, py: from.y, sx: from.x, sy: from.y, tx: ax, ty: ay,
    speed: projectileSpeed(shot.speed), damage: Math.round(stats.damage * shot.damageScale),
    accurate: shot.accurate || air, homing: shot.homing || air, target: (shot.accurate || air) && hits && t.kind !== 'tile' ? { kind: t.kind, id: t.id } : null,
    airburst: air && !hits, fromAlt: from.alt ?? 0, toAlt: p.entity?.alt ?? 0, gas: !!shot.gas,
  });
  world.events.push('fired', { id: from.id, kind: from.kind, house: from.house, weapon: stats.weapon, projectile: shot.projectile, x: from.x, y: from.y, tx: ax, ty: ay });
}

/** The Sonic Tank's wave (spec §4.6): a ripple straight out to the weapon's range from the gun. */
function fireWave(world, from, p, stats, shot) {
  const map = world.map, a = Math.atan2(p.y - from.y, p.x - from.x);
  const tx = Math.max(0, Math.min(map.w - 0.001, from.x + Math.cos(a) * stats.range));
  const ty = Math.max(0, Math.min(map.h - 0.001, from.y + Math.sin(a) * stats.range));
  const id = world.nextProjectileId++;
  world.projectiles.set(id, {
    id, weapon: stats.weapon, projectile: shot.projectile, house: from.house, sourceId: from.id, sourceKind: from.kind,
    x: from.x, y: from.y, px: from.x, py: from.y, sx: from.x, sy: from.y, tx, ty,
    speed: projectileSpeed(shot.speed), damage: stats.damage, accurate: true, homing: false, target: null, airburst: false, fromAlt: 0, toAlt: 0,
    wave: { hit: [] },
  });
  world.events.push('fired', { id: from.id, kind: from.kind, house: from.house, weapon: stats.weapon, projectile: shot.projectile, x: from.x, y: from.y, tx, ty });
}

/** What the wave passed over since the last tick takes its hit, once per wave and weaker the further it has
 *  run. Units and buildings on those tiles, own ones too; never Sonic Tanks, walls or anything held inside. */
function sweep(world, p) {
  const map = world.map, n = Math.max(1, Math.ceil(Math.hypot(p.x - p.px, p.y - p.py) / 0.25));
  const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1, by = { house: p.house, id: p.sourceId, kind: p.sourceKind };
  for (let k = 0; k <= n; k++) {
    const x = p.px + ((p.x - p.px) * k) / n, y = p.py + ((p.y - p.py) * k) / n, tx = Math.floor(x), ty = Math.floor(y);
    if (!map.inBounds(tx, ty)) continue;
    const i = map.idx(tx, ty);
    const amount = Math.round(p.damage * (1 - (SONIC.fade * Math.hypot(x - p.sx, y - p.sy)) / total));
    for (const v of [world.units.get(map.unit[i]), world.structures.get(map.structure[i])]) {
      if (!v || v.hp <= 0 || v.inside || v.typeId === 'sonicTank' || v.type.isWall || p.wave.hit.includes(v.id)) continue;
      p.wave.hit.push(v.id);
      damage(world, v, amount, by);
    }
  }
}

export function updateProjectiles(world) {
  for (const p of [...world.projectiles.values()]) {
    p.px = p.x;
    p.py = p.y;
    if (p.homing && p.target) { const tp = targetPoint(world, p.target); if (tp && !tp.entity?.inside) { p.tx = tp.x; p.ty = tp.y; } }   // not into a bay or a Carryall
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.speed * DT;
    if (d <= step) {
      p.x = p.tx;
      p.y = p.ty;
      world.projectiles.delete(p.id);
      if (p.wave) sweep(world, p); else impact(world, p);
      continue;
    }
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
    if (p.wave) sweep(world, p);
  }
}

function impact(world, p) {
  if (p.deathHand) { world.onDeathHand?.(p); return; }   // palace.js: the cluster blast
  if (p.gas) {   // Deviator gas: a cloud that turns units instead of hurting them
    world.events.push('impact', { weapon: p.weapon, projectile: p.projectile, x: p.x, y: p.y, hit: false, alt: 0 });
    world.onGas?.(p);
    return;
  }
  const map = world.map;
  let victim = p.target ? targetPoint(world, p.target)?.entity ?? null : null;   // an accurate shot hits its target if it still exists
  if (victim?.kind === 'unit' && victim.inside) victim = null;   // it drove into a bay or was lifted away: the shot lands on the spot
  if (!victim && !p.airburst && !(p.toAlt > 0)) {   // a shot at an aircraft that is gone bursts in the air
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (map.inBounds(tx, ty)) { const i = map.idx(tx, ty); victim = world.units.get(map.unit[i]) ?? world.structures.get(map.structure[i]) ?? null; }
  }
  world.events.push('impact', { weapon: p.weapon, projectile: p.projectile, x: p.x, y: p.y, hit: !!victim, alt: p.airburst || (victim && victim.kind === 'unit' && !victim.isGround) ? p.toAlt : 0 });
  if (victim) damage(world, victim, p.damage, { house: p.house, id: p.sourceId, kind: p.sourceKind });
}

/** Flat damage (no armour). attacker: {house, id, kind} or null. */
export function damage(world, victim, amount, attacker = null) {
  if (!(amount > 0) || victim.hp <= 0) return;
  if (victim.kind === 'unit' ? !world.units.has(victim.id) : !world.structures.has(victim.id)) return;
  victim.hp -= amount;
  world.events.push('damaged', { kind: victim.kind, id: victim.id, house: victim.house, by: attacker?.house ?? null, amount });
  if (victim.hp <= 0) {
    if (victim.kind === 'unit') killUnit(world, victim, attacker);
    else destroyStructure(world, victim, attacker);
    return;
  }
  world.onDamaged?.(victim, attacker);
}

function countLoss(world, victimHouse, attacker, lost, killed) {
  const h = world.houses.get(victimHouse);
  if (h) h.stats[lost]++;
  if (attacker && attacker.house !== victimHouse) { const k = world.houses.get(attacker.house); if (k) k.stats[killed]++; }
}

export function killUnit(world, u, attacker = null, cause = 'destroyed') {
  if (!world.units.has(u.id)) return;
  u.hp = 0;
  world.removeUnit(u, cause);
  countLoss(world, u.house, attacker, 'unitsLost', 'unitsKilled');
  world.events.push('unitDestroyed', { id: u.id, typeId: u.typeId, house: u.house, x: u.x, y: u.y, by: attacker?.house ?? null, cause });
  world.onUnitKilled?.(u, attacker);
}

export function destroyStructure(world, s, attacker = null) {
  if (!world.structures.has(s.id)) return;
  s.hp = 0;
  world.removeStructure(s, 'destroyed');
  countLoss(world, s.house, attacker, 'structuresLost', 'structuresKilled');
  world.events.push('structureDestroyed', { id: s.id, typeId: s.typeId, house: s.house, x: s.x, y: s.y, w: s.w, h: s.h, by: attacker?.house ?? null });
  world.onStructureKilled?.(s, attacker);
}

export function updateCombat(world) {
  for (const u of world.units.values()) if (u.isGround && !u.inside && u.destructAt === undefined && isArmed(u.type)) unitCombat(world, u);   // a Devastator counting down holds its fire
  for (const s of world.structures.values()) if (s.type.weapon) structureCombat(world, s);
}

/** Turrets (spec §4.4, structures.md): ground units only, one target at a time, half rate on low power. */
function structureCombat(world, s) {
  const t = s.type;
  const house = world.houses.get(s.house);
  if (s.cooldown > 0) s.cooldown -= DT * (house && house.power.ratio < 1 ? LOW_POWER_TURRET_RATE : 1);
  if (s.turret === undefined) s.turret = -Math.PI / 2;   // turrets rest facing north
  const x = s.x + s.w / 2, y = s.y + s.h / 2;
  let tgt = s.target;
  if (tgt) {
    const p = validTarget(world, s.house, tgt, false, !!t.targetAir) ? targetPoint(world, tgt) : null;
    if (!p || distanceTo(x, y, tgt, p) > t.range + 0.25) tgt = s.target = null;
  }
  // turrets see further than their fog radius (a gun turret uncovers two tiles but shoots five): they ignore fog
  if (!tgt && (world.tick + s.id) % SCAN_TICKS === 0) tgt = s.target = findTarget(world, s.house, x, y, t.range + 0.25, { structures: false, ignoreFog: true, air: !!t.targetAir });
  if (!tgt) return;
  const p = targetPoint(world, tgt), dist = distanceTo(x, y, tgt, p);
  const want = Math.atan2(p.y - y, p.x - x);
  s.turret = turnToward(s.turret, want, TURRET_TURN_RATE * DT);
  if (Math.abs(angleDiff(s.turret, want)) >= AIM_TOLERANCE || s.cooldown > 0) return;
  const stats = t.near && dist <= t.near.range ? t.near : t;
  fireAt(world, { kind: 'structure', id: s.id, house: s.house, x, y }, tgt, p, dist, stats);
  s.cooldown = fireDelaySeconds(stats.fireDelay);
}

function scanRadius(u) {
  switch (u.order.type) {
    case 'idle': return u.type.range;
    case 'move': return u.type.turret ? u.type.range : 0;
    case 'guard': case 'attackMove': return u.type.range + GUARD_RADIUS;
    default: return 0;
  }
}

function stillWorthIt(world, u, t) {
  if (!validTarget(world, u.house, t, false, !!u.type.targetAir)) return false;
  const p = targetPoint(world, t);
  if (!canSee(world, u.house, t.kind, p.entity)) return false;
  const o = u.order, d = distanceTo(u.x, u.y, t, p);
  if (o.type === 'guard') return Math.hypot(p.x - o.x - 0.5, p.y - o.y - 0.5) <= GUARD_LEASH + u.type.range;
  if (o.type === 'attackMove') return d <= u.type.range + GUARD_RADIUS + 2;
  return d <= u.type.range + 0.5;
}

function endAttack(u) {
  u.order = { type: 'idle' };
  u.target = null;
  u.aiming = false;
}

function unitCombat(world, u) {
  if (u.cooldown > 0) u.cooldown -= DT;
  const o = u.order;
  let t;
  if (o.type === 'attack') {
    t = o.target;
    if (!validTarget(world, u.house, t, o.force, !!u.type.targetAir)) { endAttack(u); stopMoving(u); return; }   // do not drive on to where it died
  } else {
    t = u.target;
    if (t && !stillWorthIt(world, u, t)) {
      t = u.target = null;
      if (o.type === 'guard' || o.type === 'attackMove') stopMoving(u);   // drop the chase; resume() heads back or on
    }
    if (!t && (world.tick + u.id) % SCAN_TICKS === 0) {
      const r = scanRadius(u);
      const from = o.type === 'guard' ? { x: o.x + 0.5, y: o.y + 0.5 } : u;   // a guard watches the area around its post
      const exclude = u.abandoned && world.time < u.abandoned.until ? u.abandoned.id : 0;   // no second go at what it gave up on
      const gas = !!WEAPONS[u.type.weapon]?.gas;   // a Deviator looks only for units it can turn
      t = u.target = r ? findTarget(world, u.house, from.x, from.y, r + 0.25, { exclude, air: !!u.type.targetAir, structures: !gas, only: gas ? deviatable : null }) : null;
    }
  }
  if (!t) { u.aiming = false; u.secondShot = 0; resume(world, u); return; }
  const p = targetPoint(world, t);
  const dist = distanceTo(u.x, u.y, t, p);
  if (dist > u.type.range + 0.25) { u.aiming = false; chase(world, u, t, p, dist); return; }
  u.chaseBest = Infinity;
  u.chaseStall = 0;
  if (o.type !== 'move') stopMoving(u);
  aimAndFire(world, u, t, p, dist);
}

function chase(world, u, t, p, dist) {
  const o = u.order;
  if (o.type !== 'attack' && o.type !== 'guard' && o.type !== 'attackMove') { u.target = null; return; }
  if (dist < (u.chaseBest ?? Infinity) - 0.25) { u.chaseBest = dist; u.chaseStall = 0; }
  else if ((u.chaseStall = (u.chaseStall ?? 0) + DT) >= CHASE_GIVEUP_SECONDS) {
    u.chaseBest = Infinity;
    u.chaseStall = 0;
    u.abandoned = { id: t.id, until: world.time + 90 };   // left alone for a minute and a half
    if (o.type === 'attack') endAttack(u); else u.target = null;
    stopMoving(u);
    world.events.push('attackAbandoned', { id: u.id });
    return;
  }
  if (world.tick < (u.chaseAt ?? 0) || u.pathState === 'waiting') return;
  u.chaseAt = world.tick + 20;   // re-path at most once a second
  const map = world.map;
  const gx = Math.max(0, Math.min(map.w - 1, Math.floor(p.x))), gy = Math.max(0, Math.min(map.h - 1, Math.floor(p.y)));
  world.requestPath(u, map.idx(gx, gy));
}

/** With nothing to shoot: attack-movers carry on, guards walk back to their post. */
function resume(world, u) {
  const o = u.order;
  if ((o.type !== 'attackMove' && o.type !== 'guard') || onTheMove(u) || world.tick < (u.chaseAt ?? 0)) return;
  const map = world.map;
  const goal = o.type === 'attackMove' && o.goal >= 0 ? o.goal : map.idx(o.x, o.y);
  const home = Math.max(Math.abs(u.tx - map.xOf(goal)), Math.abs(u.ty - map.yOf(goal))) <= 1;
  if (home) { if (o.type === 'attackMove') u.order = { type: 'idle' }; return; }
  const here = map.idx(u.tx, u.ty);
  if (o.lastTry === here && ++o.tries >= 3) { if (o.type === 'attackMove') u.order = { type: 'idle' }; return; }   // the path ends short: stay
  if (o.lastTry !== here) { o.lastTry = here; o.tries = 0; }
  u.chaseAt = world.tick + 20;
  world.requestPath(u, goal);
}

function aimAndFire(world, u, t, p, dist) {
  const want = Math.atan2(p.y - u.y, p.x - u.x);
  let aimed;
  if (u.type.turret) {
    u.aiming = true;
    u.turret = turnToward(u.turret, want, TURRET_TURN_RATE * DT);
    aimed = Math.abs(angleDiff(u.turret, want)) < AIM_TOLERANCE;
  } else {
    if (onTheMove(u)) return;   // hull-mounted guns fire only while standing
    u.heading = turnToward(u.heading, want, TURN_RATE[u.type.turn] * DT);
    u.turret = u.heading;
    aimed = Math.abs(angleDiff(u.heading, want)) < AIM_TOLERANCE;
  }
  if (!aimed) return;
  const gun = { kind: 'unit', id: u.id, house: u.house, x: u.x, y: u.y };
  if (u.secondShot > 0) {
    if ((u.secondShot -= DT) <= 0) { u.secondShot = 0; fireAt(world, gun, t, p, dist, u.type); }
    return;
  }
  if (u.cooldown > 0) return;
  fireAt(world, gun, t, p, dist, u.type);
  u.cooldown = fireDelaySeconds(u.type.fireDelay);
  if (u.type.firesTwice && u.hp > u.maxHp / 2) u.secondShot = SECOND_SHOT_DELAY;
}

/** An idle armed unit that is shot at from close by answers fire (busy units keep their orders). */
export function retaliate(world, victim, attacker) {
  if (victim.destructAt !== undefined || victim.kind !== 'unit' || !attacker || attacker.house === victim.house || !victim.isGround || !isArmed(victim.type)) return;
  if (victim.order.type !== 'idle' || victim.target) return;
  const t = { kind: attacker.kind, id: attacker.id };
  const p = targetPoint(world, t);
  if (p?.entity && p.entity.kind === 'unit' && !p.entity.isGround && !victim.type.targetAir) return;   // nothing to answer an aircraft with
  if (p && WEAPONS[victim.type.weapon]?.gas && !deviatable(p.entity)) return;   // gas is wasted on buildings and the immune
  if (!p || distanceTo(victim.x, victim.y, t, p) > RETALIATE_RANGE) return;
  victim.order = { type: 'attack', target: t, retaliation: true };
  victim.chaseAt = 0;
  victim.chaseBest = Infinity;
  victim.chaseStall = 0;
}
