// The campaign: three houses, nine missions each, as the Sega Mega Drive release runs it (phase 3, contract C1;
// research.md §6, the PC template of §2 where the Mega Drive says nothing). A mission definition is plain data —
// map (seed, size, the sites its bases stand on), objective, the player's start, each computer house's base,
// units and AI settings, reinforcements, Starport stock — that src/game/mission-setup.js turns into a world.
// Every computer house in a mission is allied with every other computer house, as in the original.
import { ATREIDES } from './missions/atreides.js';
import { ORDOS } from './missions/ordos.js';
import { HARKONNEN } from './missions/harkonnen.js';
import { buildMission } from './missions/build.js';

/** The houses in the Mega Drive's house-select order. */
export const CAMPAIGN_HOUSES = ['atreides', 'ordos', 'harkonnen'];
export const MISSIONS = 9;

const DATA = { atreides: ATREIDES, ordos: ORDOS, harkonnen: HARKONNEN };
const built = new Map();

/** Mission `n` (1-9) of `house`, a fresh copy each call; null for anything else. */
export function missionDef(house, n) {
  if (!DATA[house] || !Number.isInteger(n) || n < 1 || n > MISSIONS) return null;
  const key = `${house}-${n}`;
  if (!built.has(key)) built.set(key, buildMission(DATA[house], n));
  return structuredClone(built.get(key));
}

/** The house's nine missions in order. */
export function missionList(house) {
  if (!DATA[house]) return [];
  return Array.from({ length: MISSIONS }, (_, k) => missionDef(house, k + 1));
}
