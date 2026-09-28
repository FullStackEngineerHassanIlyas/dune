// Ground types and the original movement table (OpenDUNE landscapeinfo.c,
// docs/research/raw/mechanics-campaign.md §1.2). Values are out of 255 of a unit's full speed; 0 = impassable.
export const G = { SAND: 0, DUNE: 1, ROCK: 2, MOUNTAIN: 3 };
export const SURFACE = { SAND: 0, DUNE: 1, ROCK: 2, MOUNTAIN: 3, SPICE: 4, CONCRETE: 5, RUBBLE: 6, BLOCKED: 7 };
//            foot tracked harvester wheeled air worm
const TABLE = [
  [112, 112, 112, 160, 255, 192], // sand
  [112, 160, 160, 160, 255, 192], // dune
  [112, 160, 160, 112, 255, 0],   // rock
  [64, 0, 0, 0, 255, 0],          // mountain
  [112, 160, 160, 160, 255, 192], // spice (on sand)
  [255, 255, 255, 255, 255, 0],   // concrete slab
  [160, 160, 160, 160, 255, 0],   // rubble (destroyed wall/structure)
  [0, 0, 0, 0, 255, 0],           // structure or wall
];
const COLUMN = { foot: 0, tracked: 1, harvester: 2, wheeled: 3, air: 4, worm: 5 };

export function moveFactor(surface, moveClass) {
  return TABLE[surface][COLUMN[moveClass]];
}
