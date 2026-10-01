// The Great Houses and the campaign sub-houses (docs/research/raw/mechanics-campaign.md §10.2).
export const HOUSES = {
  atreides:  { id: 'atreides',  name: 'Atreides',  color: 0x2f6fe0, mentat: 'Cyril',  palace: 'fremen',    toughness: 77,  playable: true },
  harkonnen: { id: 'harkonnen', name: 'Harkonnen', color: 0xc8261e, mentat: 'Radnor', palace: 'deathHand', toughness: 200, playable: true, startUpgrades: { heavyFactory: 1 } },
  ordos:     { id: 'ordos',     name: 'Ordos',     color: 0x2e9e3e, mentat: 'Ammon',  palace: 'saboteur',  toughness: 128, playable: true },
  fremen:    { id: 'fremen',    name: 'Fremen',    color: 0xa8834a, palace: 'fremen',    toughness: 10, playable: false },
  sardaukar: { id: 'sardaukar', name: 'Sardaukar', color: 0x7a3fb0, palace: 'deathHand', toughness: 10, playable: false },
};
export const PLAYABLE_HOUSES = ['atreides', 'harkonnen', 'ordos'];
// Starting-force helpers: the light vehicle and infantry each house fields from the start.
export const LIGHT_VEHICLE = { atreides: 'trike', harkonnen: 'quad', ordos: 'raider' };
export const INFANTRY = { atreides: 'infantry', harkonnen: 'troopers', ordos: 'infantry' };
