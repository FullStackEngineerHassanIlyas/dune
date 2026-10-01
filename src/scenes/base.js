// Base showcase: a skirmish map with a built-up base for one house — every structure built so far placed
// by the placement rules next to the deployed yard, harvesters out on the nearest spice — for
// screenshots and real-GPU frame-rate checks (?scene=base&fps=1). Flags: damaged=1 adds a worn tank by
// the Repair Facility (repair=1 also sends it in), capture=1 a ruined enemy silo with a squad to take it;
// frigate=1 orders from the Starport at the start; palace=1 charges the Palace weapon and looks at the Palace.
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { STRUCTURES } from '../data/structures.js';
import { setupSkirmish } from '../game/setup.js';
import { GameView } from '../game/game-view.js';
import { findPlacement, placeStructure } from '../sim/placement.js';
import { findFreeTile } from '../sim/spawn.js';
import { G } from '../data/terrain.js';
import { INFANTRY } from '../data/houses.js';

const LAYOUT = ['windtrap', 'refinery', 'windtrap', 'outpost', 'silo', 'barracks', 'wor', 'heavyFactory', 'repair', 'hiTech', 'starport', 'ix', 'palace', 'windtrap', 'refinery', 'turret', 'rocketTurret', 'turret', 'windtrap'];

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const house = params.str('house', 'atreides');
  const { world, starts, rival } = setupSkirmish({ seed: params.num('seed', 11), size: params.num('size', 64), house, credits: 5000, fog: params.bool('fog', true), visibility: params.str('visibility') ?? undefined });
  const mcv = [...world.units.values()].find((u) => u.house === house && u.typeId === 'mcv');
  world.issue(house, { type: 'deploy', ids: [mcv.id] });
  world.step();
  const yard = [...world.structures.values()].find((s) => s.house === house && s.typeId === 'constructionYard');
  let focus = yard ? { x: yard.x + 1, z: yard.y + 3 } : { x: starts[0].x + 0.5, z: starts[0].y + 2.5 };
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
  const bay = [...world.structures.values()].find((s) => s.house === house && s.typeId === 'repair');
  if (bay && (params.bool('damaged') || params.bool('repair'))) {   // a worn tank beside the Repair Facility, sent in with repair=1
    const spot = besideFree(world, bay);   // right beside it: the packed base leaves closed pockets further out
    if (spot) {
      const tank = world.spawnUnit('combatTank', house, spot.x, spot.y, { heading: -Math.PI / 2 });
      tank.hp = 40;
      if (params.bool('repair')) world.issue(house, { type: 'repairAt', ids: [tank.id], structureId: bay.id });
    }
    focus = { x: bay.x + 1.5, z: bay.y + 2.5 };
  }
  if (yard && params.bool('capture')) {   // a ruined enemy silo out of the army's reach and a squad to take it
    const spot = quietSpot(world, house, yard.x, yard.y);
    if (spot) {
      world.spawnStructure('silo', rival, spot.x, spot.y).hp = 25;
      const tile = findFreeTile(world, spot.x, spot.y + 5, 'foot', 4);
      if (tile) world.spawnUnit(INFANTRY[house], house, tile.x, tile.y);
      focus = { x: spot.x + 1, z: spot.y + 3 };
    }
  }
  const hq = [...world.structures.values()].find((s) => s.house === house && s.typeId === 'hiTech');
  if (hq) world.spawnUnit('carryall', house, hq.x + 1, hq.y + 1).home = hq.id;   // the base's own lifter, ready to ferry
  if (params.bool('frigate')) {   // an order at the start: the Frigate comes down after 30 s
    world.issue(house, { type: 'starportOrder', typeId: 'quad' });
    world.issue(house, { type: 'starportOrder', typeId: 'combatTank' });
    const port = [...world.structures.values()].find((s) => s.house === house && s.typeId === 'starport');
    if (port) focus = { x: port.x + 1.5, z: port.y + 3.5 };
  }
  const pal = [...world.structures.values()].find((s) => s.house === house && s.typeId === 'palace');
  if (pal && params.bool('palace')) {   // the house weapon charged: READY in the sidebar
    pal.readyAt = 0;
    focus = { x: pal.x + 1.5, z: pal.y + 4 };
  }
  for (let i = 0, n = params.num('ticks', 600); i < n; i++) world.step();
  const view = new GameView({ world, house, settings, params, focus });
  view.start();
  return view;
}

/** Free rock for a 2x2 building at least seven tiles from every unit of the house. */
function quietSpot(world, house, x0, y0) {
  const map = world.map;
  const units = [...world.units.values()].filter((u) => u.house === house);
  for (let r = 6; r < 24; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = x0 + dx, y = y0 + dy;
      if (!map.inBounds(x, y) || !map.inBounds(x + 1, y + 1)) continue;
      const tiles = [map.idx(x, y), map.idx(x + 1, y), map.idx(x, y + 1), map.idx(x + 1, y + 1)];
      if (tiles.some((i) => map.ground[i] !== G.ROCK || map.structure[i] || map.unit[i])) continue;
      if (units.some((u) => Math.hypot(u.x - x - 1, u.y - y - 1) < 7)) continue;
      return { x, y };
    }
  }
  return null;
}

/** A free tile right beside a structure. */
function besideFree(world, s) {
  const map = world.map;
  for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) {
    if (!map.inBounds(x, y) || (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)) continue;
    const i = map.idx(x, y);
    if (!map.unit[i] && !map.structure[i] && map.moveFactor(i, 'tracked') > 0) return { x, y };
  }
  return null;
}
