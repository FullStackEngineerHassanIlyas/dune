// What destruction leaves behind (spec §4.3, §4.6): Trikes, Missile Tanks, Harvesters and MCVs blow
// up and hurt what stands close; a Harvester spills its load as spice; a destroyed Refinery or Silo
// burns its share of the owner's credits. Kills by the blast count for whoever caused the first
// death; nobody is ever credited for killing their own.
import { G } from '../data/terrain.js';
import { DEATH_SPLASH, SPICE_PER_TILE } from '../data/tuning.js';
import { damage, distanceTo } from './combat.js';
import { loseStorageShare } from './economy.js';
import { HARVEST_CAPACITY } from './harvest.js';

export function splash(world, x, y, amount, radius, attacker, size = 'medium') {
  world.events.push('explosion', { x, y, size });
  for (const u of [...world.units.values()]) {
    if (!u.isGround || u.inside) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d <= radius) damage(world, u, Math.round(amount * (1 - d / (radius + 0.5))), attacker);
  }
  for (const s of [...world.structures.values()]) {
    const d = distanceTo(x, y, { kind: 'structure' }, { entity: s });
    if (d <= radius) damage(world, s, Math.round(amount * (1 - d / (radius + 0.5))), attacker);
  }
}

export function spillSpice(world, tx, ty, load) {
  const r = Math.round((3 * load) / HARVEST_CAPACITY);
  if (r <= 0) return;
  const map = world.map;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r + r) continue;
    const x = tx + dx, y = ty + dy;
    if (!map.inBounds(x, y)) continue;
    const i = map.idx(x, y), g = map.ground[i];
    if ((g === G.SAND || g === G.DUNE) && !map.structure[i]) map.setSpice(i, Math.max(map.spice[i], SPICE_PER_TILE));
  }
}

export function aftermathOfUnit(world, u, attacker) {
  if (u.harvest?.load > 0) spillSpice(world, u.tx, u.ty, u.harvest.load);
  if (u.type.explodes) splash(world, u.x, u.y, DEATH_SPLASH.damage, DEATH_SPLASH.radius, attacker);
  else if (u.move !== 'foot') world.events.push('explosion', { x: u.x, y: u.y, size: 'small' });
}

export function aftermathOfStructure(world, s) {
  world.events.push('explosion', { x: s.x + s.w / 2, y: s.y + s.h / 2, size: 'large' });
  const house = world.houses.get(s.house);
  if (house && s.type.storage) loseStorageShare(world, house, s.type.storage);
}
