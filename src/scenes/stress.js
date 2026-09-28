// Stress scene (spec §10): 200 mixed units on a 128-tile map, regrouping every six seconds.
// Open with ?scene=stress&fps=1 on the target laptop to measure frame time.
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { generateMap } from '../sim/mapgen.js';
import { World } from '../sim/world.js';
import { findFreeTile } from '../game/setup.js';
import { UNITS } from '../data/units.js';
import { GameView } from '../game/game-view.js';

const TYPES = ['combatTank', 'quad', 'trike', 'siegeTank', 'missileTank', 'harvester', 'infantry', 'troopers', 'mcv', 'raider'];

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const count = params.num('units', 200);
  const { map } = generateMap({ w: 128, h: 128, seed: params.num('seed', 3), players: 2 });
  const world = new World({ map, seed: 3 });
  world.addHouse('atreides');
  world.addHouse('harkonnen', { ai: true });
  const ids = [];
  for (let k = 0; k < count; k++) {
    const type = TYPES[k % TYPES.length];
    const house = k % 2 ? 'harkonnen' : 'atreides';
    const spot = findFreeTile(world, 44 + world.rng.int(40), 44 + world.rng.int(40), UNITS[type].move, 12);
    if (spot) ids.push({ id: world.spawnUnit(type, house, spot.x, spot.y, { heading: world.rng.range(-Math.PI, Math.PI) }).id, house });
  }
  const view = new GameView({ world, house: 'atreides', settings, params, focus: { x: 64, z: 66 } });
  let next = 0;
  view.onFrame = () => {
    if (world.time < next) return;
    next = world.time + 6;
    for (let g = 0; g < ids.length; g += 10) {
      const group = ids.slice(g, g + 10);
      const x = 30 + world.rng.int(68), y = 30 + world.rng.int(68);
      world.issue(group[0].house, { type: 'move', ids: group.filter((u) => u.house === group[0].house).map((u) => u.id), x, y });
    }
  };
  view.start();
  return view;
}
