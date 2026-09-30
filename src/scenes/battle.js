// Battle: two small armies with turrets on open rock, fog off, fighting within seconds — for
// screenshots of combat effects and for the end-to-end attack check (?scene=battle&idle=1 keeps
// both sides waiting for orders). air=1 adds three Atreides Ornithopters (guarding their corner with
// idle=1, hunting otherwise); aa=0 leaves the Harkonnen without anti-air (no Troopers, Missile Tank
// or turret) so the end-to-end check can watch the Ornithopters strafe. specials=1 adds two Atreides Sonic
// Tanks, a Harkonnen Devastator and an Ordos Deviator gassing from the north.
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { GameMap } from '../sim/map.js';
import { World } from '../sim/world.js';
import { G } from '../data/terrain.js';
import { GameView } from '../game/game-view.js';
import { UNITS } from '../data/units.js';

const ARMIES = {
  atreides: { units: [['combatTank', 6, 9], ['combatTank', 6, 12], ['combatTank', 6, 15], ['siegeTank', 4, 12], ['quad', 8, 10], ['quad', 8, 14], ['infantry', 9, 12]], turret: [11, 5], yard: [1, 3], windtrap: [1, 6] },
  harkonnen: { units: [['combatTank', 32, 9], ['combatTank', 32, 12], ['combatTank', 32, 15], ['missileTank', 34, 12], ['quad', 30, 10], ['troopers', 29, 12], ['troopers', 29, 15]], turret: [27, 19], yard: [36, 19], windtrap: [36, 16] },
};

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const map = new GameMap(40, 24);
  map.ground.fill(G.ROCK);
  for (let x = 0; x < 40; x++) for (const y of [0, 1, 22, 23]) map.ground[map.idx(x, y)] = G.SAND;
  map.seed = 3;
  const world = new World({ map, seed: 3 });
  world.fogOfWar = false;
  world.addHouse('atreides', { credits: 1000 });
  world.addHouse('harkonnen', { credits: 1000, ai: true });
  for (const [house, a] of Object.entries(ARMIES)) {
    world.spawnStructure('constructionYard', house, ...a.yard);
    world.spawnStructure('windtrap', house, ...a.windtrap);
    const noAA = house === 'harkonnen' && !params.bool('aa', true);
    if (!noAA) world.spawnStructure(house === 'atreides' ? 'turret' : 'rocketTurret', house, ...a.turret);
    const ids = a.units.filter(([typeId]) => !noAA || !UNITS[typeId].targetAir).map(([typeId, x, y]) => world.spawnUnit(typeId, house, x, y, { heading: house === 'atreides' ? 0 : Math.PI }).id);
    if (!params.bool('idle')) world.issue(house, { type: 'attackMove', ids, x: house === 'atreides' ? 30 : 8, y: 12 });
  }
  if (params.bool('air')) {
    for (const [x, y] of [[3, 2], [5, 3], [3, 4]]) {
      const o = world.spawnUnit('ornithopter', 'atreides', x, y, { heading: 0 });
      if (params.bool('idle')) o.order = { type: 'guard', x: 4, y: 3 };
    }
  }
  if (params.bool('specials')) {
    for (const [x, y] of [[4, 9], [4, 15]]) world.spawnUnit('sonicTank', 'atreides', x, y, { heading: 0 });
    world.spawnUnit('devastator', 'harkonnen', 34, 9, { heading: Math.PI });
    world.addHouse('ordos', { credits: 0 });
    world.spawnUnit('deviator', 'ordos', 20, 3, { heading: Math.PI / 2 });
  }
  for (let i = 0, n = params.num('ticks', 0); i < n; i++) world.step();
  const view = new GameView({ world, house: 'atreides', settings, params, focus: { x: 19, z: 13 } });
  view.start();
  return view;
}
