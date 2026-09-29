import test from 'node:test';
import assert from 'node:assert/strict';
import { setupSkirmish } from '../src/game/setup.js';
import { checkInvariants } from '../src/sim/invariants.js';

test('AI against AI: fifteen game minutes of building, harvesting and fighting', () => {
  const { world, house, rival } = setupSkirmish({ seed: 7, house: 'atreides', enemy: 'harkonnen', fog: false, aiPlayer: true, difficulty: 'normal' });
  const placed = new Map(), waves = new Map(), still = new Map();
  let stuck = null;
  for (let t = 0; t < 15 * 60 * 20 && !world.outcome; t++) {
    world.step();
    for (const e of world.events.drain()) {
      if (e.type === 'structurePlaced') placed.set(e.house, (placed.get(e.house) ?? 0) + 1);
      if (e.type === 'aiAttack') waves.set(e.house, (waves.get(e.house) ?? 0) + 1);
    }
    if (t % 1200 === 0) assert.deepEqual(checkInvariants(world), [], `invariants at ${t / 20} s`);
    if (t % 20) continue;
    for (const u of world.units.values()) {   // a unit told to go somewhere that stays put for a minute and a half is stuck
      const moving = u.order.type === 'move' || u.order.type === 'attackMove';   // told to go somewhere, fighting or not
      const key = `${u.tx},${u.ty}`, s = still.get(u.id);
      if (!moving) { still.delete(u.id); continue; }
      if (!s || s.key !== key) still.set(u.id, { key, since: world.time });
      else if (world.time - s.since > 90 && !stuck) stuck = `${u.typeId} ${u.id} at ${key} (${u.order.type})`;
    }
  }
  for (const id of [house, rival]) {
    const h = world.houses.get(id);
    assert.ok((placed.get(id) ?? 0) >= 6, `${id} built ${placed.get(id) ?? 0} structures`);
    assert.ok(h.stats.spiceHarvested >= 1400, `${id} harvested ${Math.round(h.stats.spiceHarvested)}`);
    assert.ok((waves.get(id) ?? 0) >= 1, `${id} never attacked`);
  }
  const blood = [house, rival].reduce((n, id) => n + world.houses.get(id).stats.unitsKilled + world.houses.get(id).stats.structuresKilled, 0);
  assert.ok(blood > 0, 'nobody fought');
  assert.equal(stuck, null, stuck);
});
