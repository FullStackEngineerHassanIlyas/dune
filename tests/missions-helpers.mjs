// Small mission defs (C1 shape) for the missions stream's tests: a 32x32 map, the player's base in the south-west
// and a passive computer base in the north-east, no worms and no reinforcements unless a test adds them.
import { setupMission } from '../src/game/mission-setup.js';
import { destroyStructure } from '../src/sim/combat.js';

export function tinyDef(over = {}) {
  const def = {
    id: 'atreides-test', house: 'atreides', mission: 3, title: 'Destroy the Harkonnen base', enemies: ['harkonnen'],
    objective: { kind: 'destroy' }, minSeconds: 120,
    map: { w: 32, h: 32, seed: 5, sites: [{ id: 'atreides', x: 8, y: 23, r: 6 }, { id: 'harkonnen', x: 23, y: 8, r: 6 }], spiceFields: 3, blooms: 0 },
    visibility: 'shroud', worms: 'off', rules: { tech: 'sega' }, techLevel: 3,
    player: {
      credits: 500, upgrades: {},
      structures: [{ type: 'constructionYard', x: 6, y: 21 }, { type: 'windtrap', x: 9, y: 21 }, { type: 'refinery', x: 6, y: 24 }],
      units: [{ type: 'combatTank', x: 11, y: 22 }, { type: 'quad', x: 11, y: 25 }],
      concrete: [{ x: 6, y: 19, w: 4, h: 2 }],
    },
    houses: [{ id: 'harkonnen', credits: 0, techLevel: 3, ai: { difficulty: 'easy', passive: true },
      structures: [{ type: 'constructionYard', x: 22, y: 6 }, { type: 'windtrap', x: 25, y: 6 }, { type: 'turret', x: 21, y: 10 }],
      units: [{ type: 'combatTank', x: 20, y: 12, order: 'guard' }] }],
    reinforcements: [],
    starport: null,
  };
  return { ...def, ...over };
}

export const setup = (over = {}, opts = {}) => setupMission(tinyDef(over), opts);

/** Every structure of `house` that counts for the objective (not walls, slabs or turrets) knocked down by `by`. */
export function razeBase(world, house, by = null) {
  for (const s of [...world.structures.values()]) {
    if (s.house !== house || s.type.isWall || s.type.weapon) continue;
    destroyStructure(world, s, by && { house: by, id: 0, kind: 'unit' });
  }
}

/** The 'eva' events for `house` among a drained batch. */
export const evas = (events, house, key = null) => events.filter((e) => e.type === 'eva' && e.house === house && (!key || e.key === key));
