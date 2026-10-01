// Announcer (spec §6 event list): the 'eva' events the message bar shows and the house announcer speaks
// (src/audio/voice.js maps each key to a voiced line). Keys are throttled per house so a battle does not
// drown the player in repeats; `extra` carries what a voice needs beyond the key, such as the foe's house.
import { HOUSES } from '../data/houses.js';

export function announce(world, houseId, key, text, every = 0, extra = null) {
  const house = world.houses.get(houseId);
  if (!house) return;
  house.lastSaid ??= {};
  if (every && world.time - (house.lastSaid[key] ?? -1e9) < every) return;
  house.lastSaid[key] = world.time;
  world.events.push('eva', extra ? { house: houseId, key, text, ...extra } : { house: houseId, key, text });
}

const foe = (houseId) => HOUSES[houseId]?.name ?? 'Enemy';

export function alertDamage(world, victim, attacker) {
  if (!attacker || attacker.house === victim.house) return;
  if (victim.kind === 'structure') announce(world, victim.house, 'baseAttack', 'Our base is under attack.', 20);
  else if (victim.typeId === 'harvester') announce(world, victim.house, 'harvesterAttack', 'Harvester under attack.', 20);
}

export function alertUnitKilled(world, u, attacker) {
  announce(world, u.house, 'unitLost', 'Unit lost.', 4);
  if (attacker && attacker.house !== u.house) announce(world, attacker.house, 'enemyUnitDestroyed', `${foe(u.house)} unit destroyed.`, 4, { foe: u.house });
}

export function alertStructureKilled(world, s, attacker) {
  announce(world, s.house, 'structureLost', 'Structure destroyed.', 1);
  if (attacker && attacker.house !== s.house) announce(world, attacker.house, 'enemyStructureDestroyed', `${foe(s.house)} structure destroyed.`, 1, { foe: s.house });
}
