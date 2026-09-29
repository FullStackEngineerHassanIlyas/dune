// Carryall (spec §4.3, §4.6; research: units.md "Carryall"): an unarmed lifter the player does not
// command. Idle, it hovers over its Hi-Tech Factory (or the Construction Yard). Its jobs — flying in the
// free Harvester of a new Refinery, ferrying Harvesters and damaged vehicles on long trips — follow.
import { AIR } from '../data/tuning.js';
import { hoverTo, climb } from './air.js';

export function updateCarryall(world, c) {
  idle(world, c);
}

function idle(world, c) {
  climb(c, AIR.cruise);
  const home = homePoint(world, c);
  if (home) hoverTo(world, c, home.x, home.y);
}

/** Over its factory, side by side with the others; the house's Construction Yard when the factory is gone. */
function homePoint(world, c) {
  let f = world.structures.get(c.home);
  if (!f || f.house !== c.house) {
    const own = [...world.structures.values()].filter((s) => s.house === c.house);
    f = own.find((s) => s.typeId === 'hiTech') ?? own.find((s) => s.typeId === 'constructionYard') ?? null;
    c.home = f?.id ?? 0;
  }
  if (!f) return null;
  return { x: f.x + f.w / 2 + ((c.id % 3) - 1) * 0.7, y: f.y + f.h / 2 - 0.2 };
}
