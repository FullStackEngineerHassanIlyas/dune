// Starport (spec §4.5; research: structures.md "Starport"): a house with a Starport buys the standard
// vehicles and aircraft of its roster (the Ordos also the Missile Tank they cannot build). Each type
// starts with 2–6 in stock and gains one every 90 s up to ten; prices are re-rolled every minute to
// 40–160 % of the cost with the original formula. Orders are paid at once. The first order of a batch
// books a Frigate that lands on the pad 30 s later and unloads the whole batch (at most nine units);
// until it lands, an order can be cancelled for a refund. One Starport per house.
import { UNITS } from '../data/units.js';
import { STARPORT, AIR, airSpeed } from '../data/tuning.js';
import { DEFERRED } from '../data/phase.js';
import { spend, addCredits } from './economy.js';
import { nearestEdge } from './air.js';

const eva = (world, house, key, text) => world.events.push('eva', { house: house.id, key, text });

/** What a house can buy: its roster's standard vehicles and aircraft, in the order of STARPORT.wares. */
export const wares = (houseId) => STARPORT.wares.filter((t) => !DEFERRED.has(t) && (UNITS[t].houses.includes(houseId) || STARPORT.extra[t]?.includes(houseId)));

export function starportOf(world, houseId) {
  for (const s of world.structures.values()) if (s.house === houseId && s.typeId === 'starport') return s;
  return null;
}

/** The original formula: a tenth of the cost times 4 + two rolls of 0–6, at most 999. */
function priceOf(world, typeId) {
  return Math.min(999, Math.floor(UNITS[typeId].cost / 10) * (4 + world.rng.int(7) + world.rng.int(7)));
}

/** The house's market, opened the first time it owns a Starport (null before). */
export function market(world, house) {
  if (house.starport) return house.starport;
  if (!starportOf(world, house.id)) return null;
  const m = { stock: {}, price: {}, restockAt: world.time + STARPORT.restock, repriceAt: world.time + STARPORT.reprice, batch: null };
  for (const t of wares(house.id)) {
    m.stock[t] = STARPORT.stock[0] + world.rng.int(STARPORT.stock[1] - STARPORT.stock[0] + 1);
    m.price[t] = priceOf(world, t);
  }
  house.starport = m;
  return m;
}

export function updateStarports(world) {
  for (const house of world.houses.values()) {
    const m = market(world, house);
    if (!m) continue;
    if (world.time >= m.restockAt) {
      m.restockAt += STARPORT.restock;
      for (const t of Object.keys(m.stock)) m.stock[t] = Math.min(STARPORT.maxStock, m.stock[t] + 1);
    }
    if (world.time >= m.repriceAt) {
      m.repriceAt += STARPORT.reprice;
      for (const t of Object.keys(m.price)) m.price[t] = priceOf(world, t);
    }
  }
}

export function orderStarport(world, houseId, typeId, count = 1) {
  const house = world.houses.get(houseId);
  const s = house ? starportOf(world, houseId) : null;
  const m = s ? market(world, house) : null;
  if (!m || !(typeId in m.stock)) { world.events.push('commandRejected', { house: houseId, command: 'starportOrder', typeId }); return; }
  const n = Math.max(1, Math.min(5, Math.floor(count) || 1));
  for (let k = 0; k < n; k++) {
    if (m.batch?.landed) { eva(world, house, 'busy', 'Unable to comply, the Frigate is unloading.'); return; }
    if (m.batch && m.batch.items.length >= STARPORT.load) { eva(world, house, 'frigateFull', 'The Frigate is fully loaded.'); return; }
    if (m.stock[typeId] <= 0) { eva(world, house, 'soldOut', 'Sold out.'); return; }
    const price = m.price[typeId];
    if (!spend(house, price)) { eva(world, house, 'insufficientFunds', 'Insufficient funds.'); return; }
    m.stock[typeId]--;
    m.batch ??= book(world, s);
    m.batch.items.push({ typeId, paid: price });
    world.events.push('starportOrdered', { house: houseId, typeId, price });
  }
}

/** A new batch: the Frigate is timed to land on the pad STARPORT.delivery seconds from now. */
function book(world, s) {
  const pad = { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  const edge = nearestEdge(world.map, pad.x, pad.y);
  const travel = Math.hypot(edge.x + 0.5 - pad.x, edge.y + 0.5 - pad.y) / airSpeed(UNITS.frigate.speed) + (AIR.cruise - AIR.low) / AIR.climb;
  const landAt = world.time + STARPORT.delivery;
  return { items: [], structureId: s.id, pad, edge, landAt, spawnAt: landAt - travel, frigate: 0, landed: false };
}

export function cancelStarport(world, houseId, typeId) {
  const house = world.houses.get(houseId), m = house?.starport, b = m?.batch;
  if (!b || b.landed) return;
  const k = b.items.map((i) => i.typeId).lastIndexOf(typeId);
  if (k < 0) return;
  const [item] = b.items.splice(k, 1);
  addCredits(world, house, item.paid);
  m.stock[typeId] = Math.min(STARPORT.maxStock, m.stock[typeId] + 1);
  eva(world, house, 'cancelled', 'Cancelled.');
  if (!b.items.length) m.batch = null;   // nothing left to bring
}
