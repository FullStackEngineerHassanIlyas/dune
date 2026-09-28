// Skirmish: generated map, both houses' opening forces, played through the shared GameView.
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { setupSkirmish } from '../game/setup.js';
import { GameView } from '../game/game-view.js';
import { placeStructure, findPlacement } from '../sim/placement.js';

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const house = params.str('house', 'atreides');
  const { world, starts } = setupSkirmish({ seed: params.num('seed', 1), size: params.num('size', 64), house, enemy: params.str('enemy'), fog: params.bool('fog', true) });
  for (let i = 0, n = params.num('ticks', 0); i < n; i++) world.step();
  if (params.bool('deploy')) {
    const mcv = [...world.units.values()].find((u) => u.house === house && u.typeId === 'mcv');
    if (mcv) { world.issue(house, { type: 'deploy', ids: [mcv.id] }); world.step(); }
  }
  if (params.bool('radar')) {
    const yard = [...world.structures.values()].find((s) => s.house === house && s.typeId === 'constructionYard');
    for (const typeId of ['windtrap', 'outpost']) {
      const spot = yard && findPlacement(world, house, typeId, yard.x, yard.y);
      if (spot) placeStructure(world, house, typeId, spot.x, spot.y);
    }
    for (let i = 0; i < 20; i++) world.step();
  }
  const view = new GameView({ world, house, settings, params, focus: { x: starts[0].x + 0.5, z: starts[0].y + 2.5 } });
  view.start();
  return view;
}
