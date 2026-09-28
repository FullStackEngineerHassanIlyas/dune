// Base showcase: a skirmish map with a built-up base for one house — every plan-1b structure placed
// by the placement rules next to the deployed yard, harvesters out on the nearest spice — for
// screenshots and real-GPU frame-rate checks (?scene=base&fps=1).
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { STRUCTURES } from '../data/structures.js';
import { setupSkirmish } from '../game/setup.js';
import { GameView } from '../game/game-view.js';
import { findPlacement, placeStructure } from '../sim/placement.js';

const LAYOUT = ['windtrap', 'refinery', 'windtrap', 'outpost', 'silo', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'windtrap', 'refinery', 'turret', 'rocketTurret', 'turret', 'windtrap'];

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const house = params.str('house', 'atreides');
  const { world, starts } = setupSkirmish({ seed: params.num('seed', 11), size: params.num('size', 64), house, credits: 5000, fog: params.bool('fog', true) });
  const mcv = [...world.units.values()].find((u) => u.house === house && u.typeId === 'mcv');
  world.issue(house, { type: 'deploy', ids: [mcv.id] });
  world.step();
  const yard = [...world.structures.values()].find((s) => s.house === house && s.typeId === 'constructionYard');
  const focus = yard ? { x: yard.x + 1, z: yard.y + 3 } : { x: starts[0].x + 0.5, z: starts[0].y + 2.5 };
  if (yard) {
    for (const typeId of LAYOUT) {
      if (!STRUCTURES[typeId].houses.includes(house)) continue;
      const spot = findPlacement(world, house, typeId, yard.x, yard.y, 12);
      if (spot) placeStructure(world, house, typeId, spot.x, spot.y);
    }
    for (let k = 0; k < 6; k++) {
      const spot = findPlacement(world, house, 'wall', yard.x + 5, yard.y + 5, 12);
      if (spot) placeStructure(world, house, 'wall', spot.x, spot.y);
    }
  }
  for (const s of world.structures.values()) if (s.house === house) s.hp = s.maxHp;   // a finished base: repaired, so the traps give full power
  for (let i = 0, n = params.num('ticks', 600); i < n; i++) world.step();
  const view = new GameView({ world, house, settings, params, focus });
  view.start();
  return view;
}
