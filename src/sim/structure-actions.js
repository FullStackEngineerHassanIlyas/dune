// Sell and repair (spec §4.3): selling refunds half the price scaled by health; repairing restores
// the structure in about twelve seconds from zero for 40 % of its price, pausing without credits.
import { DT } from '../data/tuning.js';
import { spend, clampToStorage, refund as giveBack } from './economy.js';
import { emptyBay } from './repair-bay.js';

export const REPAIR_SECONDS = 12;
export const REPAIR_COST_FRACTION = 0.4;

export function orderSell(world, houseId, structureId) {
  const s = world.structures.get(structureId);
  if (!s || s.house !== houseId) return;
  const house = world.houses.get(houseId);
  const refund = Math.floor(0.5 * s.type.cost * (s.hp / s.maxHp));
  emptyBay(world, s, 'sold');   // a vehicle in the bay drives out unfinished
  world.removeStructure(s, 'sold');
  clampToStorage(world, house);        // a sold store takes its share of the credits with it
  giveBack(house, refund);    // the sale's money comes back in full (cash, not spice)
  world.events.push('sold', { id: s.id, house: houseId, refund, typeId: s.typeId, x: s.x, y: s.y, w: s.w, h: s.h });
}

export function orderRepair(world, houseId, structureId, on) {
  const s = world.structures.get(structureId);
  if (!s || s.house !== houseId) return;
  s.repairing = (on ?? !s.repairing) && s.hp < s.maxHp;
  s.repairStalled = false;
  world.events.push('repairToggled', { id: s.id, house: houseId, on: s.repairing });
}

export function updateRepairs(world) {
  for (const s of world.structures.values()) {
    if (!s.repairing) continue;
    const house = world.houses.get(s.house);
    const hp = Math.min(s.maxHp - s.hp, (s.maxHp / REPAIR_SECONDS) * DT);
    const cost = (hp * REPAIR_COST_FRACTION * s.type.cost) / s.maxHp;
    if (!house || !spend(house, cost)) { s.repairStalled = true; continue; }
    s.repairStalled = false;
    s.hp = Math.min(s.maxHp, s.hp + hp);
    if (s.hp >= s.maxHp) {
      s.repairing = false;
      world.events.push('repaired', { id: s.id, house: s.house });
    }
  }
}
