// Skirmish set-up: map, houses and the Dune II style opening force — an MCV on the plateau centre
// with an escort parked at least two tiles away so the Construction Yard has room.
import { generateMap } from '../sim/mapgen.js';
import { World } from '../sim/world.js';
import { LIGHT_VEHICLE, INFANTRY, PLAYABLE_HOUSES } from '../data/houses.js';
import { UNITS } from '../data/units.js';

export function findFreeTile(world, x, y, moveClass, maxR = 8, minR = 0) {
  const map = world.map;
  for (let r = minR; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = x + dx, ty = y + dy;
      if (!map.inBounds(tx, ty)) continue;
      const i = map.idx(tx, ty);
      if (!map.unit[i] && !map.structure[i] && map.moveFactor(i, moveClass) > 0) return { x: tx, y: ty };
    }
  }
  return null;
}

export function spawnStartingForces(world, house, start) {
  const facing = Math.atan2(world.map.h / 2 - start.y, world.map.w / 2 - start.x);
  const units = [world.spawnUnit('mcv', house, start.x, start.y, { heading: facing })];
  for (const type of ['combatTank', 'combatTank', LIGHT_VEHICLE[house], INFANTRY[house], INFANTRY[house]]) {
    const spot = findFreeTile(world, start.x, start.y, UNITS[type].move, 8, 2);
    if (spot) units.push(world.spawnUnit(type, house, spot.x, spot.y, { heading: facing }));
  }
  return units;
}

export function setupSkirmish({ seed = 1, size = 64, house = 'atreides', enemy = null, credits = 3000 } = {}) {
  const { map, starts } = generateMap({ w: size, h: size, seed, players: 2 });
  const world = new World({ map, seed });
  const rival = enemy && enemy !== house ? enemy : PLAYABLE_HOUSES.find((h) => h !== house);
  world.addHouse(house, { credits });
  world.addHouse(rival, { credits, ai: true });
  spawnStartingForces(world, house, starts[0]);
  spawnStartingForces(world, rival, starts[1]);
  return { world, starts, house, rival };
}
