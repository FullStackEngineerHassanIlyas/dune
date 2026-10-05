// Palace recharge on the Sega ladder (final review; research.md §6): the Harkonnen Death Hand about 11-12 minutes, the
// Emperor's 15-16, the Ordos Saboteur 6-7, the Atreides Fremen about 4. The skirmish keeps its own (tuning.js PALACE).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PALACE, SEGA_PALACE } from '../src/data/tuning.js';
import { palaceWeapon, palaceReady, palaceRecharge } from '../src/sim/palace.js';
import { missionDef } from '../src/data/campaign.js';
import { setupMission } from '../src/game/mission-setup.js';
import { flatWorld, run } from './helpers.mjs';

const MINUTE = 60;

function palace(house, sega) {
  const world = flatWorld(48, 32);
  if (sega) world.rules.tech = 'sega';
  if (!world.houses.has(house)) world.addHouse(house);
  const s = world.spawnStructure('palace', house, 2, 2);
  return { world, s };
}

test('Sega Palaces charge at the Mega Drive\'s pace, from the start and after each shot', () => {
  const want = { harkonnen: [11, 12], sardaukar: [15, 16], ordos: [6, 7], atreides: [3.5, 4.5] };
  for (const [house, [lo, hi]] of Object.entries(want)) {
    const { world, s } = palace(house, true);
    const t = palaceRecharge(world, house);
    assert.ok(t >= lo * MINUTE && t <= hi * MINUTE, `${house} ${t} s`);
    assert.equal(s.readyAt, world.time + t, `${house}: a new Palace charges from empty`);
    run(world, t - 1);
    assert.ok(!palaceReady(world, s), house);
    run(world, 1.5);
    assert.ok(palaceReady(world, s), house);
  }
  const { world, s } = palace('ordos', true);
  s.readyAt = world.time;
  world.issue('ordos', { type: 'palace' });
  run(world, 0.2);
  assert.ok(Math.abs(s.readyAt - world.time - SEGA_PALACE.recharge.ordos) < 1, 'the Saboteur sent, the clock starts again from the Sega figure');
});

test('the skirmish Palaces keep the PC pace', () => {
  for (const house of ['harkonnen', 'sardaukar', 'ordos', 'atreides']) {
    const { world, s } = palace(house, false);
    assert.equal(palaceRecharge(world, house), PALACE.recharge[palaceWeapon(house)], house);
    assert.equal(s.readyAt, world.time + PALACE.recharge[palaceWeapon(house)], house);
  }
});

test('mission 9: the Emperor\'s first Death Hand comes after a quarter of an hour, not at seven minutes', () => {
  const { world } = setupMission(missionDef('ordos', 9));
  const palaces = [...world.structures.values()].filter((s) => s.typeId === 'palace');
  assert.ok(palaces.length >= 1);
  for (const s of palaces) assert.equal(s.readyAt, SEGA_PALACE.recharge[s.house], s.house);
  assert.ok(palaces.every((s) => s.readyAt >= 15 * MINUTE));
});
