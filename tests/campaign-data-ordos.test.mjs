// House Ordos' nine missions against the Mega Drive table (research.md §6; PC scenario units where it names none).
import { campaignHouseTests } from './scenarios-helpers.mjs';

const destroy = { kind: 'destroy' };
campaignHouseTests('ordos', [
  { objective: { kind: 'quota', quota: 1000 }, enemies: ['harkonnen'], bases: [], credits: 990, units: { soldier: 2, infantry: 1, raider: 2 } },
  { objective: { kind: 'quotaOrDestroy', quota: 2700 }, enemies: ['harkonnen'], bases: ['harkonnen'], credits: 1200, units: { raider: 4, infantry: 2, soldier: 2, troopers: 1 } },
  { objective: destroy, enemies: ['atreides'], bases: ['atreides'], credits: 1500, units: { raider: 4, soldier: 3, infantry: 1 } },
  { objective: destroy, enemies: ['atreides', 'sardaukar'], bases: ['atreides'], credits: 1500, units: { quad: 3, raider: 2, infantry: 2 } },
  { objective: destroy, enemies: ['harkonnen'], bases: ['harkonnen', 'harkonnen'], credits: 1500, units: { combatTank: 4, quad: 3, troopers: 1 } },
  { objective: destroy, enemies: ['atreides'], bases: ['atreides', 'atreides'], credits: 1700, units: { combatTank: 3, quad: 3, troopers: 2 } },
  { objective: destroy, enemies: ['harkonnen'], bases: ['harkonnen', 'harkonnen'], credits: 2000, units: { combatTank: 2, quad: 2, siegeTank: 2, troopers: 1 } },
  { objective: destroy, enemies: ['atreides', 'harkonnen', 'sardaukar'], bases: ['atreides', 'harkonnen'], credits: 2000, units: { combatTank: 2, deviator: 2, siegeTank: 2 } },
  { objective: destroy, enemies: ['sardaukar'], bases: ['sardaukar', 'sardaukar'], credits: 2000, units: { combatTank: 1, deviator: 2, quad: 1, siegeTank: 3 } },
]);
