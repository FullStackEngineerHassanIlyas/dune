// The campaign's openings (final review): a player who does nothing at all still has a base after three minutes in
// every one of the 27 missions — no house's start force falls to the first raid before the mission's two minutes are up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionDef, CAMPAIGN_HOUSES, MISSIONS } from '../src/data/campaign.js';
import { setupMission } from '../src/game/mission-setup.js';

const SECONDS = 180;

test(`campaign: an idle player loses no mission in its first ${SECONDS / 60} minutes`, () => {
  const lost = [];
  for (const house of CAMPAIGN_HOUSES) for (let n = 1; n <= MISSIONS; n++) {
    const { world } = setupMission(missionDef(house, n));
    for (let k = 0; world.time < SECONDS && !world.outcome; k++) { world.step(); if (k % 20 === 0) world.events.drain(); }
    if (world.outcome && world.outcome.winner !== house) lost.push(`${house}-${n} at ${Math.round(world.outcome.seconds)} s`);
  }
  assert.deepEqual(lost, []);
});
