// Skirmish set-up (spec §5.8): map, houses and the Dune II style opening force — an MCV on the plateau centre
// with an escort parked at least two tiles away so the Construction Yard has room. The player and one to three
// computer opponents, each its own house in its own corner, every house at the set-up's tech level.
import { generateMap } from '../sim/mapgen.js';
import { World } from '../sim/world.js';
import { LIGHT_VEHICLE, INFANTRY, SKIRMISH_HOUSES } from '../data/houses.js';
import { UNITS } from '../data/units.js';
import { createBrain, DIFFICULTY } from '../sim/ai.js';
import { updateFog } from '../sim/fog.js';
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

export const VISIBILITY = ['shroud', 'fog', 'revealed'];
export const WORMS = ['off', 'few', 'many'];
export const TECH_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Opponents a map has room for: four corner bases from Medium (64) up, three on a Small map. */
export const maxOpponents = (size) => (size < 64 ? 2 : 3);

/** 'harkonnen:hard,ordos' → [{ house, difficulty }]; a missing or unknown difficulty takes `difficulty`. */
export function parseOpponents(text, difficulty = 'normal') {
  const fallback = DIFFICULTY[difficulty] ? difficulty : 'normal';
  return String(text ?? '').split(',').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [house, level] = part.split(':');
    return { house, difficulty: DIFFICULTY[level] ? level : fallback };
  });
}

export const formatOpponents = (list) => list.map((o) => `${o.house}:${o.difficulty}`).join(',');

/** Each opponent its own house: a clash, an unknown house or 'random' takes the first house still free. */
function resolveOpponents(house, list, size, difficulty) {
  const taken = new Set([house]), out = [];
  for (const o of list.slice(0, maxOpponents(size))) {
    const id = SKIRMISH_HOUSES.includes(o?.house) && !taken.has(o.house) ? o.house : SKIRMISH_HOUSES.find((h) => !taken.has(h));
    if (!id) break;
    taken.add(id);
    out.push({ house: id, difficulty: DIFFICULTY[o?.difficulty] ? o.difficulty : difficulty });
  }
  return out;
}

export function setupSkirmish({ seed = 1, size = 64, house = 'atreides', enemy = null, opponents = null, credits = 3000, fog = true, visibility = fog ? 'shroud' : 'revealed',
  difficulty = 'normal', techLevel = 9, worms = 'few', aiPlayer = false } = {}) {
  const level = DIFFICULTY[difficulty] ? difficulty : 'normal';
  const rivals = resolveOpponents(house, opponents?.length ? opponents : [{ house: enemy, difficulty: level }], size, level);
  const { map, starts } = generateMap({ w: size, h: size, seed, players: 1 + rivals.length });
  const world = new World({ map, seed });
  world.visibility = VISIBILITY.includes(visibility) ? visibility : 'shroud';   // Dune II's shroud unless the player picks otherwise
  world.fogOfWar = world.visibility !== 'revealed';
  world.rules.victory = true;
  world.rules.airDelivery = true;   // Refineries get their Harvester by Carryall
  world.rules.worms = WORMS.includes(worms) ? worms : 'few';
  const tech = TECH_LEVELS.includes(techLevel) ? techLevel : 9;
  world.addHouse(house, { credits, techLevel: tech });
  for (const r of rivals) world.addHouse(r.house, { credits, ai: true, techLevel: tech });
  spawnStartingForces(world, house, starts[0]);
  rivals.forEach((r, k) => spawnStartingForces(world, r.house, starts[k + 1]));
  for (const r of rivals) createBrain(world, r.house, r.difficulty);
  if (aiPlayer) createBrain(world, house, level);
  if (world.fogOfWar) updateFog(world);   // shroud from the very first frame
  return { world, starts, house, rival: rivals[0]?.house ?? null, opponents: rivals.map((r) => r.house) };
}
