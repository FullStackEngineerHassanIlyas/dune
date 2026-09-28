// Skirmish: generated map, both houses' opening forces, played through the shared GameView.
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { setupSkirmish } from '../game/setup.js';
import { GameView } from '../game/game-view.js';

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const house = params.str('house', 'atreides');
  const { world, starts } = setupSkirmish({ seed: params.num('seed', 1), size: params.num('size', 64), house, enemy: params.str('enemy') });
  for (let i = 0, n = params.num('ticks', 0); i < n; i++) world.step();
  if (params.bool('deploy')) {
    const mcv = [...world.units.values()].find((u) => u.house === house && u.typeId === 'mcv');
    if (mcv) { world.issue(house, { type: 'deploy', ids: [mcv.id] }); world.step(); }
  }
  const view = new GameView({ world, house, settings, params, focus: { x: starts[0].x + 0.5, z: starts[0].y + 2.5 } });
  view.start();
  return view;
}
