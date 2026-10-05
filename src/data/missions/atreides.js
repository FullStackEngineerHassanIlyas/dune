// House Atreides' nine missions on the Mega Drive (research.md §6): enemies, bases, starting credits and units
// (counts 5,7,8,9,8,8,7,7,6; where the Mega Drive table names no units, the PC scenario's). Seeds are the PC
// scenarios' first-region seeds (appendix A), fed to our own generator; mission 9 shares seed 392 with every house.
// `bases` lists the house of each computer base; `enemies` adds the Emperor's Troopers dropped in 4 and 8.
export const ATREIDES = {
  house: 'atreides',
  symmetry: 0,
  missions: [
    { seed: 353, enemies: ['ordos'], bases: [], credits: 990, units: { trike: 2, infantry: 1, soldier: 2 } },
    { seed: 2620, enemies: ['ordos'], bases: ['ordos'], credits: 1200, units: { quad: 1, trike: 3, infantry: 1, soldier: 2 } },
    { seed: 2106, enemies: ['harkonnen'], bases: ['harkonnen'], credits: 1500, units: { quad: 2, trike: 2, infantry: 1, soldier: 3 } },
    { seed: 233, enemies: ['harkonnen', 'sardaukar'], bases: ['harkonnen'], credits: 1500, units: { quad: 4, trike: 2, infantry: 3 } },
    { seed: 367, enemies: ['ordos'], bases: ['ordos'], credits: 1500, units: { combatTank: 3, quad: 3, infantry: 1, soldier: 1 } },
    { seed: 53, enemies: ['harkonnen'], bases: ['harkonnen'], credits: 1700, units: { combatTank: 3, missileTank: 2, quad: 3 } },
    { seed: 500, enemies: ['ordos'], bases: ['ordos', 'ordos'], credits: 2000, units: { siegeTank: 2, combatTank: 2, missileTank: 1, quad: 2 } },
    { seed: 604, enemies: ['ordos', 'harkonnen', 'sardaukar'], bases: ['ordos', 'harkonnen'], credits: 2000, units: { sonicTank: 2, siegeTank: 2, missileTank: 2, quad: 1 } },
    { seed: 392, enemies: ['sardaukar'], bases: ['sardaukar', 'sardaukar'], credits: 2500, units: { sonicTank: 2, siegeTank: 2, missileTank: 2 } },
  ],
};
