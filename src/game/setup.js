// Skirmish set-up: map, houses and the Dune II style opening force — an MCV on the plateau centre
// with an escort parked at least two tiles away so the Construction Yard has room.
import { generateMap } from '../sim/mapgen.js';
import { World } from '../sim/world.js';
import { LIGHT_VEHICLE, INFANTRY, PLAYABLE_HOUSES } from '../data/houses.js';
import { UNITS } from '../data/units.js';
import { createBrain } from '../sim/ai.js';
import { findFreeTile } from '../sim/spawn.js';

export { findFreeTile };

export function spawnStartingForces(world, house, start) {
  const facing = Math.atan2(world.map.h / 2 - start.y, world.map.w / 2 - start.x);
  const units = [world.spawnUnit('mcv', house, start.x, start.y, { heading: facing })];
  for (const type of ['combatTank', 'combatTank', LIGHT_VEHICLE[house], INFANTRY[house], INFANTRY[house]]) {
    const spot = findFreeTile(world, start.x, start.y, UNITS[type].move, 8, 2);
    if (spot) units.push(world.spawnUnit(type, house, spot.x, spot.y, { heading: facing }));
  }
  return units;
}

export function setupSkirmish({ seed = 1, size = 64, house = 'atreides', enemy = null, credits = 3000, fog = true, difficulty = 'normal', aiPlayer = false } = {}) {
  const { map, starts } = generateMap({ w: size, h: size, seed, players: 2 });
  const world = new World({ map, seed });
  world.fogOfWar = fog;
  world.rules.victory = true;
  const rival = enemy && enemy !== house ? enemy : PLAYABLE_HOUSES.find((h) => h !== house);
  world.addHouse(house, { credits });
  world.addHouse(rival, { credits, ai: true });
  spawnStartingForces(world, house, starts[0]);
  spawnStartingForces(world, rival, starts[1]);
  createBrain(world, rival, difficulty);
  if (aiPlayer) createBrain(world, house, difficulty);
  return { world, starts, house, rival };
}
