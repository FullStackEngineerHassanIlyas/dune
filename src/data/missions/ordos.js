// House Ordos' nine missions on the Mega Drive (research.md §6): enemies, bases (two Harkonnen bases from mission 5,
// two Atreides in 6), starting credits and units (counts 5,9,8,7,8,8,7,6,7; where the Mega Drive table names no
// units, the PC scenario's). Seeds are the PC scenarios' first-region seeds (appendix A); 9 shares seed 392.
export const ORDOS = {
  house: 'ordos',
  symmetry: 3,
  missions: [
    { seed: 1498, enemies: ['harkonnen'], bases: [], credits: 990, units: { raider: 2, infantry: 1, soldier: 2 } },
    { seed: 3161, enemies: ['harkonnen'], bases: ['harkonnen'], credits: 1200, units: { raider: 4, infantry: 2, troopers: 1, soldier: 2 } },
    { seed: 2437, enemies: ['atreides'], bases: ['atreides'], credits: 1500, units: { raider: 4, infantry: 1, soldier: 3 } },
    { seed: 12, enemies: ['atreides', 'sardaukar'], bases: ['atreides'], credits: 1500, units: { quad: 3, raider: 2, infantry: 2 } },
    { seed: 203, enemies: ['harkonnen'], bases: ['harkonnen', 'harkonnen'], credits: 1500, units: { combatTank: 4, quad: 3, troopers: 1 } },
    { seed: 53, enemies: ['atreides'], bases: ['atreides', 'atreides'], credits: 1700, units: { combatTank: 3, quad: 3, troopers: 2 } },
    { seed: 500, enemies: ['harkonnen'], bases: ['harkonnen', 'harkonnen'], credits: 2000, units: { siegeTank: 2, combatTank: 2, quad: 2, troopers: 1 } },
    { seed: 717, enemies: ['atreides', 'harkonnen', 'sardaukar'], bases: ['atreides', 'harkonnen'], credits: 2000, units: { deviator: 2, siegeTank: 2, combatTank: 2 } },
    { seed: 392, enemies: ['sardaukar'], bases: ['sardaukar', 'sardaukar'], credits: 2000, units: { deviator: 2, siegeTank: 3, combatTank: 1, quad: 1 } },
  ],
};
