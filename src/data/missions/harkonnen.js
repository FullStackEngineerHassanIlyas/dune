// House Harkonnen's nine missions on the Mega Drive (research.md §6): enemies, bases (two Ordos bases in 6, two
// Atreides in 7), starting credits and units (counts 5,7,7,7,8,7,7,6,6; where the Mega Drive table names no units,
// the PC scenario's). Seeds are the PC scenarios' first-region seeds (appendix A); 9 shares seed 392.
export const HARKONNEN = {
  house: 'harkonnen',
  symmetry: 6,
  missions: [
    { seed: 332, enemies: ['atreides'], bases: [], credits: 990, units: { quad: 2, trooper: 3 } },
    { seed: 223, enemies: ['atreides'], bases: ['atreides'], credits: 1200, units: { quad: 4, trooper: 3 } },
    { seed: 2674, enemies: ['ordos'], bases: ['ordos'], credits: 1500, units: { quad: 4, trooper: 3 } },
    { seed: 269, enemies: ['ordos', 'sardaukar'], bases: ['ordos'], credits: 1500, units: { quad: 4, troopers: 3 } },
    { seed: 103, enemies: ['atreides'], bases: ['atreides'], credits: 1500, units: { combatTank: 3, quad: 3, troopers: 2 } },
    { seed: 500, enemies: ['ordos'], bases: ['ordos', 'ordos'], credits: 1700, units: { combatTank: 3, missileTank: 1, quad: 3 } },
    { seed: 552, enemies: ['atreides'], bases: ['atreides', 'atreides'], credits: 1800, units: { siegeTank: 2, combatTank: 2, missileTank: 1, quad: 1, troopers: 1 } },
    { seed: 604, enemies: ['atreides', 'ordos', 'sardaukar'], bases: ['atreides', 'ordos'], credits: 2000, units: { devastator: 1, siegeTank: 2, missileTank: 2, combatTank: 1 } },
    { seed: 392, enemies: ['sardaukar'], bases: ['sardaukar', 'sardaukar'], credits: 2500, units: { devastator: 2, siegeTank: 1, missileTank: 2, combatTank: 1 } },
  ],
};
