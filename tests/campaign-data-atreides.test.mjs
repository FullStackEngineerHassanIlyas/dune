// House Atreides' nine missions against the Mega Drive table (research.md §6; PC scenario units where it names none).
import { campaignHouseTests } from './scenarios-helpers.mjs';

const destroy = { kind: 'destroy' };
campaignHouseTests('atreides', [
  { objective: { kind: 'quota', quota: 1000 }, enemies: ['ordos'], bases: [], credits: 990, units: { soldier: 2, infantry: 1, trike: 2 } },
  { objective: { kind: 'quotaOrDestroy', quota: 2700 }, enemies: ['ordos'], bases: ['ordos'], credits: 1200, units: { soldier: 2, infantry: 1, trike: 3, quad: 1 } },
  { objective: destroy, enemies: ['harkonnen'], bases: ['harkonnen'], credits: 1500, units: { soldier: 3, infantry: 1, trike: 2, quad: 2 } },
  { objective: destroy, enemies: ['harkonnen', 'sardaukar'], bases: ['harkonnen'], credits: 1500, units: { infantry: 3, trike: 2, quad: 4 } },
  { objective: destroy, enemies: ['ordos'], bases: ['ordos'], credits: 1500, units: { soldier: 1, infantry: 1, quad: 3, combatTank: 3 } },
  { objective: destroy, enemies: ['harkonnen'], bases: ['harkonnen'], credits: 1700, units: { quad: 3, combatTank: 3, missileTank: 2 } },
  { objective: destroy, enemies: ['ordos'], bases: ['ordos', 'ordos'], credits: 2000, units: { quad: 2, combatTank: 2, missileTank: 1, siegeTank: 2 } },
  { objective: destroy, enemies: ['ordos', 'harkonnen', 'sardaukar'], bases: ['ordos', 'harkonnen'], credits: 2000, units: { quad: 1, missileTank: 2, siegeTank: 2, sonicTank: 2 } },
  { objective: destroy, enemies: ['sardaukar'], bases: ['sardaukar', 'sardaukar'], credits: 2500, units: { missileTank: 2, siegeTank: 2, sonicTank: 2 } },
]);
