// Skirmish: generated map, every house's opening force, played through the shared GameView. The opponents come
// from opponents=harkonnen:hard,ordos:normal (an older URL's enemy= and ai= still work), with tech= and worms=.
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { setupSkirmish, parseOpponents } from '../game/setup.js';
import { GameView } from '../game/game-view.js';
import { placeStructure, findPlacement } from '../sim/placement.js';

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const house = params.str('house', 'atreides');
  const difficulty = params.str('ai', 'normal');
  const { world, starts } = setupSkirmish({ seed: params.num('seed', 1), size: params.num('size', 64), house, enemy: params.str('enemy'), opponents: parseOpponents(params.str('opponents'), difficulty),
    credits: params.num('credits', 3000), fog: params.bool('fog', true), visibility: params.str('visibility') ?? undefined, difficulty, techLevel: params.num('tech', 9), worms: params.str('worms') ?? undefined });
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
  const focus = params.str('focus') === 'rival' ? 1 : params.num('focus', 0);   // screenshots of a computer's base: focus=rival or its number
  const look = starts[Math.max(0, Math.min(starts.length - 1, Math.floor(focus)))];
  const view = new GameView({ world, house, settings, params, focus: { x: look.x + 0.5, z: look.y + 2.5 } });
  view.start();
  return view;
}
