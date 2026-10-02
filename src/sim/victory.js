// Victory (spec §4.11): a house is out when it has no structures and no MCV, and its fall is named to everyone
// ('houseDefeated'). A skirmish is a free-for-all: it ends when at most one house stands (nobody left is a draw),
// or when every human player is out while computers fight on — a loss for the player, not a draw. The outcome
// is decided once and announced once; the statistics of every house are frozen with it.
import { announce, defeatText } from './announce.js';
import { HOUSES } from '../data/houses.js';

function standing(world, houseId) {
  for (const s of world.structures.values()) if (s.house === houseId && !s.type.isWall) return true;   // walls are terrain, not a base
  for (const u of world.units.values()) if (u.house === houseId && u.type.deploysTo) return true;
  return false;
}

export function updateVictory(world) {
  if (!world.rules.victory || world.outcome) return;
  const left = [];
  let humans = 0, humansLeft = 0;
  for (const house of world.houses.values()) {
    if (!house.isAI) humans++;
    if (house.defeated) continue;
    if (standing(world, house.id)) { left.push(house.id); if (!house.isAI) humansLeft++; continue; }
    house.defeated = true;
    house.defeatedAt = world.time;
    world.events.push('houseDefeated', { house: house.id, name: HOUSES[house.id]?.name ?? house.id, text: defeatText(house.id) });
  }
  if (left.length > 1 && (humansLeft > 0 || humans === 0)) return;
  const winner = left.length === 1 ? left[0] : null, draw = left.length === 0;
  const stats = Object.fromEntries([...world.houses.values()].map((h) => [h.id, { ...h.stats }]));
  world.outcome = { winner, draw, standing: left, tick: world.tick, seconds: world.time, stats };
  world.events.push('gameOver', { winner });
  for (const house of world.houses.values()) {
    if (draw) announce(world, house.id, 'draw', 'The battle is a draw.');
    else if (house.id === winner) announce(world, house.id, 'missionAccomplished', 'Mission accomplished.');
    else if (house.defeated) announce(world, house.id, 'missionFailed', 'Mission failed.');
  }
}

/** The end screen's numbers: every house in a column, the player's first, frozen at the end. */
export function endStats(world, houseId) {
  const statsOf = (h) => world.outcome?.stats?.[h.id] ?? h.stats;
  const all = [...world.houses.values()];
  const order = [...all.filter((h) => h.id === houseId), ...all.filter((h) => h.id !== houseId)];
  const winner = world.outcome?.winner ?? null;
  const houses = order.map((h) => ({ id: h.id, name: HOUSES[h.id]?.name ?? h.id, color: HOUSES[h.id]?.color ?? 0xffffff, you: h.id === houseId, winner: h.id === winner,
    out: h.defeated ? Math.round(h.defeatedAt ?? world.time) : null }));
  const row = (label, k) => {
    const values = order.map((h) => Math.round(statsOf(h)[k]));
    return { label, you: values[0], enemy: values.slice(1).reduce((n, v) => n + v, 0), values };
  };
  return {
    won: !!world.outcome && winner === houseId,
    draw: !!world.outcome?.draw,
    seconds: Math.round(world.outcome?.seconds ?? world.time),
    houses,
    standing: (world.outcome?.standing ?? []).filter((id) => id !== houseId).map((id) => HOUSES[id]?.name ?? id),
    rows: [
      row('Spice harvested', 'spiceHarvested'),
      row('Units destroyed', 'unitsKilled'),
      row('Units lost', 'unitsLost'),
      row('Buildings destroyed', 'structuresKilled'),
      row('Buildings lost', 'structuresLost'),
    ],
  };
}
