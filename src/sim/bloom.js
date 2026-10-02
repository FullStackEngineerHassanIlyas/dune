// Spice blooms (spec §4.8; docs/research/raw/mechanics-campaign.md §1.3, OpenDUNE map.c
// Map_Bloom_ExplodeSpice and Map_FillCircleWithSpice). A bloom is a mound on open sand (map.bloom) that
// bursts when a ground vehicle or soldier drives onto it or a shot lands on it: it does 100 damage to
// everything around it and turns the sand within about five tiles into spice (the rim ragged, every tile
// on it a coin flip, as in the original). New mounds grow over time on open sand, away from bases and
// units, back up to the number the map started with, so long games do not run dry. Dice: world.wildRng.
import { SPICE_PER_TILE } from '../data/tuning.js';
import { damage, distanceTo } from './combat.js';

export const BLOOM = {
  damage: 100,
  blast: 1.5,            // tiles from the mound's centre that the burst hurts
  radius: 5,             // the spice field: tiles within this (max + min / 2) distance; the outermost tile a coin flip
  every: [90, 180],      // seconds between two chances for a new mound
  clear: { base: 8, unit: 3, spice: 2 },   // tiles a new mound keeps from buildings, units and spice
};

export function countBlooms(map) {
  let n = 0;
  for (let i = 0; i < map.bloom.length; i++) n += map.bloom[i];
  return n;
}

/** World.onTileEntered: a ground unit has driven onto tile (u.tx, u.ty). Worms swim under the mounds. */
export function bloomStep(world, u) {
  const i = world.map.idx(u.tx, u.ty);
  if (world.map.bloom[i] && u.isGround && u.move !== 'worm') eruptBloom(world, i, { house: u.house, id: u.id, kind: 'unit' });
}

/** Bursts the bloom on tile i (by: what set it off, {house, id, kind} or null). False if there is none. */
export function eruptBloom(world, i, by = null) {
  const map = world.map;
  if (!map.bloom[i]) return false;
  map.bloom[i] = 0;
  world.bloomRevision++;
  const tx = map.xOf(i), ty = map.yOf(i), x = tx + 0.5, y = ty + 0.5;
  world.events.push('bloomErupted', { x, y, by: by?.house ?? null });
  fillSpice(world, tx, ty, BLOOM.radius);
  for (const u of [...world.units.values()]) {
    if (u.isGround && !u.inside && u.move !== 'worm' && Math.hypot(u.x - x, u.y - y) <= BLOOM.blast) damage(world, u, BLOOM.damage, null);
  }
  for (const s of [...world.structures.values()]) if (distanceTo(x, y, { kind: 'structure' }, { entity: s }) <= BLOOM.blast) damage(world, s, BLOOM.damage, null);
  return true;
}

/** Sand within `r` of (cx, cy) becomes spice (at least a field's worth); the rim is ragged. */
export function fillSpice(world, cx, cy, r) {
  const map = world.map;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const ax = Math.abs(dx), ay = Math.abs(dy), d = Math.max(ax, ay) + Math.min(ax, ay) / 2;
    const x = cx + dx, y = cy + dy;
    if (d > r || !map.inBounds(x, y)) continue;
    const i = map.idx(x, y);
    if (!map.isSand(i) || map.spice[i] >= SPICE_PER_TILE) continue;
    if (d > r - 1 && !world.wildRng.chance(0.5)) continue;
    map.setSpice(i, SPICE_PER_TILE);
  }
}

/** Every second: now and then a new mound, while there are fewer than the map started with. */
export function updateBlooms(world) {
  const map = world.map;
  const b = (world.blooms ??= { target: countBlooms(map), next: -1 });
  if (!b.target) return;
  if (b.next < 0) b.next = world.time + world.wildRng.range(...BLOOM.every);
  if (world.time < b.next) return;
  b.next = world.time + world.wildRng.range(...BLOOM.every);
  if (countBlooms(map) >= b.target) return;
  const i = bloomSpot(world);
  if (i < 0) return;
  map.bloom[i] = 1;
  world.bloomRevision++;
  world.events.push('bloomGrown', { x: map.xOf(i) + 0.5, y: map.yOf(i) + 0.5 });
}

/** A tile of open sand for a new mound: no spice close by, clear of buildings and units; -1 if none turns up. */
export function bloomSpot(world) {
  const map = world.map, c = BLOOM.clear;
  const open = (i) => {
    const x = map.xOf(i), y = map.yOf(i);
    for (let dy = -c.spice; dy <= c.spice; dy++) for (let dx = -c.spice; dx <= c.spice; dx++) {
      if (!map.inBounds(x + dx, y + dy)) return false;
      const j = map.idx(x + dx, y + dy);
      if (!map.isSand(j) || map.spice[j] || map.bloom[j]) return false;
    }
    for (const s of world.structures.values()) if (distanceTo(x + 0.5, y + 0.5, { kind: 'structure' }, { entity: s }) < c.base) return false;
    for (const u of world.units.values()) if (u.isGround && Math.hypot(u.x - x - 0.5, u.y - y - 0.5) < c.unit) return false;
    return true;
  };
  for (let k = 0; k < 120; k++) {
    const i = map.idx(world.wildRng.int(map.w), world.wildRng.int(map.h));
    if (open(i)) return i;
  }
  return -1;
}
