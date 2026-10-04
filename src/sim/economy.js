// House economy (spec §4.3–§4.4): credits limited by refinery/silo storage, wind-trap power, radar.

export const STORAGE_WARNING_SECONDS = 15;
export const POWER_WARNING_SECONDS = 20;

export function builtStorage(world, houseId) {
  let cap = 0;
  for (const s of world.structures.values()) if (s.house === houseId && s.type.storage) cap += s.type.storage;
  return cap;
}

/** The starting credits count as storage until built storage exceeds them; then never again. */
export function storageCapacity(world, house) {
  const built = builtStorage(world, house.id);
  if (house.startBuffer && built > house.startBuffer) house.startBuffer = 0;
  return Math.max(built, house.startBuffer ?? 0);
}

/** The starting allowance ends for good the moment built storage passes it (not lazily at the next payment). */
export function revokeStartBuffer(world, house) {
  if (house?.startBuffer && builtStorage(world, house.id) > house.startBuffer) house.startBuffer = 0;
}

/** Adds credits up to the storage limit; the rest is lost with a warning. Returns what was added. */
export function addCredits(world, house, amount) {
  if (!(amount > 0)) return 0;
  const room = Math.max(0, storageCapacity(world, house) - house.credits);
  const added = Math.min(room, amount);
  house.credits += added;
  if (added < amount && world.time - (house.lastStorageWarning ?? -1e9) >= STORAGE_WARNING_SECONDS) {
    house.lastStorageWarning = world.time;
    world.events.push('eva', { house: house.id, key: 'storageFull', text: 'Spice storage full — build Silos.' });
  }
  return added;
}

/** Money given back (a sale, a cancelled or lost order) is cash, not stored spice: it all comes back, storage or not,
 *  so a base that lost its Refinery and Silos can still sell and rebuild. Only harvested spice is held by storage. */
export function refund(house, amount) {
  if (!(amount > 0)) return 0;
  house.credits += amount;
  return amount;
}

export function spend(house, amount) {
  if (amount <= 0) return true;
  if (house.credits + 1e-9 < amount) return false;
  house.credits = Math.max(0, house.credits - amount);
  return true;
}

export function clampToStorage(world, house) {
  house.credits = Math.min(house.credits, storageCapacity(world, house));
}

/** Called after a refinery or silo was destroyed: the house loses that store's share of its credits. */
export function loseStorageShare(world, house, storage) {
  const after = builtStorage(world, house.id), buffer = house.startBuffer ?? 0;
  const capBefore = Math.max(after + storage, buffer), capAfter = Math.max(after, buffer);   // the starting allowance keeps holding what it held
  if (capBefore > capAfter) house.credits = Math.max(0, house.credits - house.credits * ((capBefore - capAfter) / capBefore));
}

export function computePower(world, houseId) {
  let produced = 0, used = 0;
  for (const s of world.structures.values()) {
    if (s.house !== houseId) continue;
    if (s.type.power < 0) produced += -s.type.power * Math.max(0.5, Math.min(1, s.hp / s.maxHp));
    else used += s.type.power;
  }
  return { produced: Math.round(produced), used, ratio: used > 0 ? Math.min(1, produced / used) : 1 };
}

export function updatePower(world) {
  for (const house of world.houses.values()) {
    const p = computePower(world, house.id);
    const wasShort = house.power.ratio < 1;
    house.power = p;
    if (p.ratio < 1 && !wasShort && world.time - (house.lastPowerWarning ?? -1e9) >= POWER_WARNING_SECONDS) {
      house.lastPowerWarning = world.time;
      world.events.push('eva', { house: house.id, key: 'lowPower', text: 'Low power.' });
    }
  }
}

/** Radar needs an Outpost and at least as much power as the base uses (spec §4.9). */
export function radarOnline(world, houseId) {
  const house = world.houses.get(houseId);
  if (!house || house.power.ratio < 1) return false;
  for (const s of world.structures.values()) if (s.house === houseId && s.typeId === 'outpost') return true;
  return false;
}
