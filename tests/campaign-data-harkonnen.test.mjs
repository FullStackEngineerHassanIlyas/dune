// House Harkonnen's nine missions against the Mega Drive table (research.md §6; PC scenario units where it names none).
import { campaignHouseTests } from './scenarios-helpers.mjs';

const destroy = { kind: 'destroy' };
campaignHouseTests('harkonnen', [
  { objective: { kind: 'quota', quota: 1000 }, enemies: ['atreides'], bases: [], credits: 990, units: { quad: 2, trooper: 3 } },
  { objective: { kind: 'quotaOrDestroy', quota: 2700 }, enemies: ['atreides'], bases: ['atreides'], credits: 1200, units: { quad: 4, trooper: 3 } },
  { objective: destroy, enemies: ['ordos'], bases: ['ordos'], credits: 1500, units: { quad: 4, trooper: 3 } },
  { objective: destroy, enemies: ['ordos', 'sardaukar'], bases: ['ordos'], credits: 1500, units: { quad: 4, troopers: 3 } },
  { objective: destroy, enemies: ['atreides'], bases: ['atreides'], credits: 1500, units: { combatTank: 3, quad: 3, troopers: 2 } },
  { objective: destroy, enemies: ['ordos'], bases: ['ordos', 'ordos'], credits: 1700, units: { combatTank: 3, missileTank: 1, quad: 3 } },
  { objective: destroy, enemies: ['atreides'], bases: ['atreides', 'atreides'], credits: 1800, units: { combatTank: 2, missileTank: 1, quad: 1, siegeTank: 2, troopers: 1 } },
  { objective: destroy, enemies: ['atreides', 'ordos', 'sardaukar'], bases: ['atreides', 'ordos'], credits: 2000, units: { combatTank: 1, devastator: 1, missileTank: 2, siegeTank: 2 } },
  { objective: destroy, enemies: ['sardaukar'], bases: ['sardaukar', 'sardaukar'], credits: 2500, units: { combatTank: 1, devastator: 2, missileTank: 2, siegeTank: 1 } },
]);
