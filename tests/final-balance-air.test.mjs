// The computer's Ornithopters in the campaign (final review): a new one flies to its Hi-Tech's rally point and waits
// there for the attack waves, as the rest of the army does; none goes for the player before the mission's first attack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionDef, CAMPAIGN_HOUSES } from '../src/data/campaign.js';
import { setupMission } from '../src/game/mission-setup.js';

const ownedBy = (world, t, house) => (t.kind === 'unit' ? world.units.get(t.id) : world.structures.get(t.id))?.house === house;

test('campaign: no computer Ornithopter goes for the player before the mission\'s first attack (missions 7-9, idle player)', () => {
  for (const house of CAMPAIGN_HOUSES) for (let n = 7; n <= 9; n++) {
    const def = missionDef(house, n);
    const { world } = setupMission(def);
    const first = Math.min(...def.houses.filter((h) => !h.ai.passive).map((h) => h.ai.firstAttack));
    let built = 0, early = null;
    const prev = world.onDamaged;
    world.onDamaged = (victim, attacker) => {
      if (victim.house === house && world.units.get(attacker?.id)?.typeId === 'ornithopter') early ??= `${attacker.house} Ornithopter hit the player's ${victim.typeId} at ${world.time.toFixed(0)} s`;
      prev?.(victim, attacker);
    };
    for (let k = 0; world.time < first && !early; k++) {
      world.step();
      if (k % 20) continue;
      world.events.drain();
      for (const u of world.units.values()) {
        if (u.typeId !== 'ornithopter' || u.house === house) continue;
        built = Math.max(built, u.id);
        if (u.target && ownedBy(world, u.target, house)) early ??= `${u.house} Ornithopter after the player at ${world.time.toFixed(0)} s`;
      }
    }
    assert.equal(early, null, `${def.id} (first attack at ${first} s)`);
    if (house !== 'ordos' || n !== 7) assert.ok(built, `${def.id}: the computer built an Ornithopter`);   // the Harkonnen Hi-Tech never builds one
  }
});
