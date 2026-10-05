// Victory (spec §4.11): a house is out when it has no structures and no MCV, and its fall is named to everyone
// ('houseDefeated'). A skirmish is a free-for-all: it ends when at most one house stands (nobody left is a draw)
// or only allies do (sim/alliance.js), or when every human player is out while computers fight on — a loss for
// the player, not a draw. The outcome is decided once and announced once; the statistics of every house are
// frozen with it.
import { announce, defeatText } from './announce.js';
import { HOUSES } from '../data/houses.js';
import { friendly } from './alliance.js';

/** A house stands while it has a structure (walls do not count) or an MCV. */
export function standing(world, houseId) {
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
  const oneSide = left.every((id) => friendly(world, id, left[0]));   // allies left alone together have won
  if (left.length > 1 && !oneSide && (humansLeft > 0 || humans === 0)) return;
  const winner = left.length === 1 ? left[0] : left.length && oneSide ? left.find((id) => !world.houses.get(id).isAI) ?? left[0] : null;
  finishGame(world, { winner, draw: left.length === 0, standing: left });
}

/** Ends the game once (a skirmish's last house standing, or a mission's objective): freezes every house's
 *  statistics, tells everyone ('gameOver') and announces the result to each house. `lost` names the houses
 *  that hear "Mission failed"; by default the defeated ones. Returns the outcome. */
export function finishGame(world, { winner = null, draw = false, standing: left = [], lost = null } = {}) {
  if (world.outcome) return world.outcome;
  const stats = Object.fromEntries([...world.houses.values()].map((h) => [h.id, { ...h.stats }]));
  world.outcome = { winner, draw, standing: left, tick: world.tick, seconds: world.time, stats };
  world.events.push('gameOver', { winner });
  for (const house of world.houses.values()) {
    if (draw) announce(world, house.id, 'draw', 'The battle is a draw.');
    else if (house.id === winner) announce(world, house.id, 'missionAccomplished', 'Mission accomplished.');
    else if (lost ? lost.includes(house.id) : house.defeated) announce(world, house.id, 'missionFailed', 'Mission failed.');
  }
  return world.outcome;
}

const shown = (id) => HOUSES[id]?.plural ?? HOUSES[id]?.name ?? id;   // "the Mercenaries" on the end screen

/** The end screen's numbers: every house in a column, the player's first, frozen at the end. */
export function endStats(world, houseId) {
  const statsOf = (h) => world.outcome?.stats?.[h.id] ?? h.stats;
  const all = [...world.houses.values()];
  const order = [...all.filter((h) => h.id === houseId), ...all.filter((h) => h.id !== houseId)];
  const winner = world.outcome?.winner ?? null;
  // allies left standing won together (a skirmish's allied computers, a mission's side): each is marked a winner
  const winners = new Set(winner ? [winner, ...(world.outcome?.standing ?? []).filter((id) => friendly(world, id, winner))] : []);
  const houses = order.map((h) => ({ id: h.id, name: shown(h.id), color: HOUSES[h.id]?.color ?? 0xffffff, you: h.id === houseId, winner: winners.has(h.id),
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
    standing: winner ? [] : (world.outcome?.standing ?? []).filter((id) => id !== houseId).map(shown),   // who fights on: only when nobody has won
    rows: [
      row('Spice harvested', 'spiceHarvested'),
      row('Units destroyed', 'unitsKilled'),
      row('Units lost', 'unitsLost'),
      row('Buildings destroyed', 'structuresKilled'),
      row('Buildings lost', 'structuresLost'),
    ],
  };
}
