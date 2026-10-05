// The first two missions are about as hard for every house (final review): the enemy's forces are worth about the same,
// and the Harkonnen — whose foot soldier is the Heavy Trooper — field no Trooper squads and no Quad but the one every
// mission-2 base holds (the Sega ladder opens the Quad at mission 3), where the Atreides and Ordos field Light Infantry,
// squads and Trikes or Raiders; and no Trooper hunts the player in mission 1, where the others' hunters are two Light Infantry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionDef, CAMPAIGN_HOUSES } from '../src/data/campaign.js';
import { setupMission } from '../src/game/mission-setup.js';
import { UNITS } from '../src/data/units.js';

const worth = (units) => units.reduce((n, u) => n + UNITS[u.type].cost, 0);
const enemy = (def) => def.houses.flatMap((h) => h.units);

test('missions 1-2: the enemy\'s forces are worth about the same for every house', () => {
  for (const n of [1, 2]) {
    const values = CAMPAIGN_HOUSES.map((h) => worth(enemy(missionDef(h, n))));
    assert.ok(Math.max(...values) <= 1.25 * Math.min(...values), `mission ${n}: ${CAMPAIGN_HOUSES.map((h, k) => `${h} faces ${values[k]}`).join(', ')}`);
  }
});

test('missions 1-2 against the Harkonnen: Heavy Troopers, no squads, none hunting in mission 1, and only the base\'s own Quad', () => {
  const ordos = (n) => enemy(missionDef('ordos', n)).map((u) => u.type);
  assert.ok(ordos(1).every((t) => t === 'trooper'), ordos(1).join());
  assert.deepEqual(ordos(2).filter((t) => t !== 'trooper'), ['quad'], 'mission 2: the one Quad every base holds');
  assert.deepEqual(enemy(missionDef('ordos', 1)).filter((u) => u.order === 'hunt'), [], 'mission 1: no Trooper hunts — they outrange the start force; the others\' hunters are Light Infantry');
  assert.ok(enemy(missionDef('atreides', 1)).some((u) => u.order === 'hunt' && u.type === 'soldier'));
  assert.ok(enemy(missionDef('atreides', 3)).filter((u) => u.type === 'quad').length > 1 && enemy(missionDef('atreides', 3)).some((u) => u.type === 'troopers'), 'the Harkonnen field Quads and squads again from mission 3');
});

test('mission 1: an idle player\'s start force holds the patrols off as well as the other houses\' do', () => {
  const left = {};
  for (const house of CAMPAIGN_HOUSES) {
    const def = missionDef(house, 1);
    const { world } = setupMission(def);
    const armed = () => [...world.units.values()].filter((u) => u.house === house && u.type.weapon).length;
    const start = armed();
    for (let k = 0; k < 180 * 20; k++) { world.step(); if (k % 20 === 0) world.events.drain(); }
    left[house] = armed() / start;
  }
  assert.ok(Object.values(left).every((f) => f >= 0.6), JSON.stringify(left));
});
