// Victory (spec §4.11): a house is out when it has no structures and no MCV; the skirmish ends when at
// most one house stands (nobody left is a draw). The outcome is decided once and announced once.
import { announce } from './announce.js';

export function updateVictory(world) {
  if (!world.rules.victory || world.outcome) return;
  const standing = [];
  for (const house of world.houses.values()) {
    if (house.defeated) continue;
    let alive = false;
    for (const s of world.structures.values()) if (s.house === house.id) { alive = true; break; }
    if (!alive) for (const u of world.units.values()) if (u.house === house.id && u.type.deploysTo) { alive = true; break; }
    if (alive) standing.push(house.id);
    else { house.defeated = true; world.events.push('houseDefeated', { house: house.id }); }
  }
  if (standing.length > 1) return;
  const winner = standing[0] ?? null;
  world.outcome = { winner, tick: world.tick };
  world.events.push('gameOver', { winner });
  for (const house of world.houses.values()) {
    if (house.id === winner) announce(world, house.id, 'missionAccomplished', 'Mission accomplished.');
    else announce(world, house.id, 'missionFailed', 'Mission failed.');
  }
}

export function endStats(world, houseId) {
  const me = world.houses.get(houseId);
  const others = [...world.houses.values()].filter((h) => h.id !== houseId);
  const sum = (k) => others.reduce((n, h) => n + h.stats[k], 0);
  const row = (label, k) => ({ label, you: Math.round(me.stats[k]), enemy: Math.round(sum(k)) });
  return {
    won: world.outcome?.winner === houseId,
    draw: !!world.outcome && world.outcome.winner === null,
    seconds: Math.round(world.time),
    rows: [
      row('Spice harvested', 'spiceHarvested'),
      row('Units destroyed', 'unitsKilled'),
      row('Units lost', 'unitsLost'),
      row('Buildings destroyed', 'structuresKilled'),
      row('Buildings lost', 'structuresLost'),
    ],
  };
}
