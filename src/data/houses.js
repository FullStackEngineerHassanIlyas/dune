// The Great Houses and the sub-houses (docs/research/raw/mechanics-campaign.md §9.3, §10.2; units.md and
// structures.md, availableHouse). The original engine treats the Sardaukar and the Mercenaries as full houses
// with a Palace weapon of their own (Death Hand, Saboteur) and the shared buildings and vehicles, so either can
// hold a computer base in a skirmish beside the three Great Houses — four houses can play. The Fremen cannot:
// they are the Atreides Palace's warriors (drawn in their sand colour whoever calls them) and, in the
// original, the house the sandworms belong to; nor are they ever the player's house.
export const HOUSES = {
  atreides:  { id: 'atreides',  name: 'Atreides',  color: 0x2f6fe0, mentat: 'Cyril',  palace: 'fremen',    toughness: 77,  playable: true },
  harkonnen: { id: 'harkonnen', name: 'Harkonnen', color: 0xc8261e, mentat: 'Radnor', palace: 'deathHand', toughness: 200, playable: true, startUpgrades: { heavyFactory: 1 } },
  ordos:     { id: 'ordos',     name: 'Ordos',     color: 0x2e9e3e, mentat: 'Ammon',  palace: 'saboteur',  toughness: 128, playable: true },
  fremen:    { id: 'fremen',    name: 'Fremen',    color: 0xa8834a, palace: 'fremen',    toughness: 10, playable: false },
  sardaukar: { id: 'sardaukar', name: 'Sardaukar', color: 0x7a3fb0, palace: 'deathHand', toughness: 10, playable: false, subHouse: true },
  // PC palette slot 224, never sampled (visual-units.md §3): shown in gold, as remakes that read the original palette show them
  mercenary: { id: 'mercenary', name: 'Mercenary', plural: 'Mercenaries', color: 0xe1c814, palace: 'saboteur', toughness: 0, playable: false, subHouse: true },
};
export const PLAYABLE_HOUSES = ['atreides', 'harkonnen', 'ordos'];
/** Houses that may hold a base in a skirmish: the player picks a Great House, the computer any of these. */
export const SKIRMISH_HOUSES = ['atreides', 'harkonnen', 'ordos', 'sardaukar', 'mercenary'];
/** What a sub-house builds besides every structure (the original's unit table): both infantry lines, the Trike and
 *  the shared vehicles and aircraft; none of the House of IX specials, which stay with their Great House. */
export const SUB_HOUSE_UNITS = ['soldier', 'infantry', 'trooper', 'troopers', 'trike', 'quad', 'combatTank', 'missileTank', 'siegeTank', 'harvester', 'mcv', 'carryall', 'ornithopter'];
// Starting-force helpers: the light vehicle and infantry each house fields from the start.
export const LIGHT_VEHICLE = { atreides: 'trike', harkonnen: 'quad', ordos: 'raider', sardaukar: 'trike', mercenary: 'trike' };
export const INFANTRY = { atreides: 'infantry', harkonnen: 'troopers', ordos: 'infantry', sardaukar: 'troopers', mercenary: 'infantry' };
