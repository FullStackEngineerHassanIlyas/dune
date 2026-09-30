// Palace weapons (spec §4.7; research: structures.md "Superweapons"). A Palace arms its house's weapon —
// the Harkonnen Death Hand, the Atreides Fremen, the Ordos Saboteur — from the moment it stands (a new
// Palace starts from empty: the original's instant-ready rebuild is not copied) and fires on command. The
// Death Hand is a ballistic missile that comes down near the aim and bursts in 17 blasts; friend and foe
// alike are hurt. A launch that cannot happen keeps the charge. The Fremen rise from the sand near the
// chosen spot and hunt on their own; the Saboteur walks out beside the Palace.
import { HOUSES } from '../data/houses.js';
import { MOVE } from '../data/units.js';
import { PALACE, DEATH_HAND, FREMEN } from '../data/tuning.js';
import { splash } from './aftermath.js';
import { findTarget } from './combat.js';
import { orderAttack } from './orders.js';
import { exitTile } from './spawn.js';

const eva = (world, houseId, key, text) => world.events.push('eva', { house: houseId, key, text });

/** The house weapon: 'deathHand', 'fremen' or 'saboteur'. */
export const palaceWeapon = (houseId) => HOUSES[houseId]?.palace ?? null;

export function palaceOf(world, houseId) {
  for (const s of world.structures.values()) if (s.house === houseId && s.typeId === 'palace') return s;
  return null;
}

export const palaceReady = (world, s) => !!s && world.time >= s.readyAt;

/** A new Palace, or one that has just fired, charges its weapon from empty. */
export function armPalace(world, s) {
  s.readyAt = world.time + PALACE.recharge[palaceWeapon(s.house)];
  s.announced = false;
}

/** Once a second: a weapon that has finished charging says so. */
export function updatePalaces(world) {
  for (const s of world.structures.values()) {
    if (s.typeId !== 'palace' || s.announced || world.time < s.readyAt) continue;
    s.announced = true;
    eva(world, s.house, 'weaponReady', `${PALACE.names[palaceWeapon(s.house)]} ready.`);
  }
}

export function orderPalace(world, houseId, x, y) {
  const s = palaceOf(world, houseId), weapon = palaceWeapon(houseId);
  const launch = { deathHand: launchDeathHand, fremen: callFremen, saboteur: sendSaboteur }[weapon];
  const aimed = weapon !== 'saboteur';
  const reject = () => world.events.push('commandRejected', { house: houseId, command: 'palace' });
  if (!s || !launch) { reject(); return; }
  if (!palaceReady(world, s)) { eva(world, houseId, 'notReady', `The ${PALACE.names[weapon]} is not ready.`); return; }   // also for a click on the charging button
  if (aimed && !(Number.isFinite(x) && Number.isFinite(y))) { reject(); return; }
  const map = world.map;
  const tx = aimed ? Math.max(0, Math.min(map.w - 1, Math.floor(x))) : null, ty = aimed ? Math.max(0, Math.min(map.h - 1, Math.floor(y))) : null;
  if (!launch(world, s, tx, ty)) return;
  armPalace(world, s);
  world.events.push('palaceFired', { house: houseId, weapon, x: tx, y: ty });
}

/** Off it goes from the Palace, to come down up to two tiles from the aim. */
function launchDeathHand(world, s, tx, ty) {
  const map = world.map, a = world.rng.range(0, Math.PI * 2), r = DEATH_HAND.scatter * Math.sqrt(world.rng.next());
  const x = Math.max(0.5, Math.min(map.w - 0.5, tx + 0.5 + Math.cos(a) * r)), y = Math.max(0.5, Math.min(map.h - 0.5, ty + 0.5 + Math.sin(a) * r));
  const fx = s.x + s.w / 2, fy = s.y + s.h / 2, id = world.nextProjectileId++;
  world.projectiles.set(id, {
    id, weapon: 'deathHand', projectile: 'deathHand', house: s.house, sourceId: s.id, sourceKind: 'structure',
    x: fx, y: fy, px: fx, py: fy, sx: fx, sy: fy, tx: x, ty: y, speed: DEATH_HAND.speed, damage: DEATH_HAND.damage,
    accurate: true, homing: false, target: null, airburst: false, fromAlt: 0, toAlt: 0, deathHand: true,
  });
  world.events.push('fired', { id: s.id, kind: 'structure', house: s.house, weapon: 'deathHand', projectile: 'deathHand', x: fx, y: fy, tx: x, ty: y });
  return true;
}

/** It lands: 17 blasts in a diamond out to two tiles. */
export function deathHandBlast(world, p) {
  const by = { house: p.house, id: p.sourceId, kind: p.sourceKind };
  world.events.push('deathHandBlast', { house: p.house, x: p.x, y: p.y });
  for (const [dx, dy] of DEATH_HAND.pattern) splash(world, p.x + dx, p.y + dy, p.damage, DEATH_HAND.radius, by, 'large');
}

/** Five Fremen squads rise from the sand near the chosen spot (anywhere on the map). */
function callFremen(world, s, x, y) {
  const spots = risingSpots(world, x, y), map = world.map;
  if (!spots.length) { eva(world, s.house, 'cannotDeploy', 'The Fremen cannot reach that place.'); return false; }
  for (let k = 0; k < FREMEN.squads && spots.length; k++) {
    const i = spots.splice(world.rng.int(spots.length), 1)[0];
    const u = world.spawnUnit('fremen', s.house, map.xOf(i), map.yOf(i), { heading: world.rng.range(0, Math.PI * 2) });
    world.events.push('fremenRose', { id: u.id, house: s.house, x: u.x, y: u.y });
  }
  eva(world, s.house, 'fremenArrived', 'The Fremen have come.');
  return true;
}

/** Free sand near (x, y), nearest rings first; with too little sand within reach, the rest from open ground, nearest first. */
function risingSpots(world, x, y) {
  const map = world.map, sand = [], ground = [], want = FREMEN.squads * 2;
  for (let r = 0; r <= FREMEN.reach && sand.length < want; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !map.inBounds(x + dx, y + dy)) continue;
      const i = map.idx(x + dx, y + dy);
      if (map.unit[i] || map.structure[i] || map.moveFactor(i, MOVE.FOOT) === 0) continue;
      (map.isSand(i) ? sand : ground).push(i);
    }
  }
  if (sand.length >= FREMEN.squads) return sand;
  return sand.length ? sand.concat(ground.slice(0, FREMEN.squads - sand.length)) : ground.slice(0, want);
}

/** One Saboteur walks out beside the Palace, the player's to command. */
function sendSaboteur(world, s) {
  const spot = exitTile(world, s, MOVE.SABOTEUR);
  if (!spot) { eva(world, s.house, 'cannotDeploy', 'No room for the Saboteur by the Palace.'); return false; }
  world.spawnUnit('saboteur', s.house, spot.x, spot.y, { heading: Math.PI / 2 });
  eva(world, s.house, 'saboteurReady', 'Saboteur ready.');
  return true;
}

/** Fremen hunt on their own (spec §4.7): an idle warrior goes after the nearest enemy anywhere on the map. */
export function updateHunters(world) {
  for (const u of world.units.values()) {
    if (!u.type.hunts || u.inside || u.order.type !== 'idle' || u.target) continue;
    const exclude = u.abandoned && world.time < u.abandoned.until ? u.abandoned.id : 0;   // not straight back to what it gave up on
    const t = findTarget(world, u.house, u.x, u.y, Infinity, { ignoreFog: true, exclude });
    if (t) orderAttack(world, [u], { targetKind: t.kind, targetId: t.id });
  }
}
