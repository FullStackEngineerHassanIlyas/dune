// Sell and repair (spec §4.3): selling refunds half the price scaled by health; repairing restores
// the structure in about twelve peaceful seconds from zero for 40 % of its price, pausing without credits.
// Sustained fire reduces healing, so affordable repairs cannot indefinitely cancel a siege.
import { DT } from '../data/tuning.js';
import { spend, storageCapacity, refund as giveBack } from './economy.js';
import { emptyBay } from './repair-bay.js';

export const REPAIR_SECONDS = 12;
export const REPAIR_COST_FRACTION = 0.4;
export const REPAIR_UNDER_FIRE_SECONDS = 3;
export const REPAIR_UNDER_FIRE_RATE = 0.25;

export function orderSell(world, houseId, structureId) {
  const s = world.structures.get(structureId);
  if (!s || s.house !== houseId) return;
  const house = world.houses.get(houseId);
  const refund = Math.floor(0.5 * s.type.cost * (s.hp / s.maxHp));
  emptyBay(world, s, 'sold');   // a vehicle in the bay drives out unfinished
  world.removeStructure(s, 'sold');
  // A sold store takes what no longer fits, and never more than it could hold: cash above the stores
  // (refunds, earlier sales) is not spice and stays. A building that stores nothing takes nothing.
  if (s.type.storage) {
    const over = house.credits - storageCapacity(world, house);
    if (over > 0) house.credits -= Math.min(over, s.type.storage);
  }
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
    const underFire = world.time - (s.lastDamagedAt ?? -Infinity) < REPAIR_UNDER_FIRE_SECONDS;
    const rate = underFire ? REPAIR_UNDER_FIRE_RATE : 1;
    const hp = Math.min(s.maxHp - s.hp, (s.maxHp / REPAIR_SECONDS) * DT * rate);
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
