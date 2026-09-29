import test from 'node:test';
import assert from 'node:assert/strict';
import { setupSkirmish } from '../src/game/setup.js';
import { findPlacement, placeStructure } from '../src/sim/placement.js';

const MINUTES = 10, STUCK_LIMIT = 60;   // seconds a harvester may spend driving to one place or waiting

test('harvest soak: on generated maps every harvester keeps delivering for ten game minutes', () => {
  for (const seed of [1, 5, 8, 11]) {
    const { world, house } = setupSkirmish({ seed, size: 64, house: 'atreides', credits: 0, fog: false });
    const mcv = [...world.units.values()].find((u) => u.house === house && u.typeId === 'mcv');
    world.issue(house, { type: 'deploy', ids: [mcv.id] });
    world.step();
    const yard = [...world.structures.values()].find((s) => s.house === house && s.typeId === 'constructionYard');
    let pad = null;
    for (const typeId of ['windtrap', 'refinery', 'silo', 'windtrap', 'refinery']) {
      // the silo goes as close as it can to the first refinery's pad tile: tight bases cover docks
      const [ax, ay] = typeId === 'silo' && pad ? pad : [yard.x, yard.y];
      const spot = findPlacement(world, house, typeId, ax, ay, 12);
      assert.ok(spot, `seed ${seed}: room for ${typeId}`);
      const s = placeStructure(world, house, typeId, spot.x, spot.y);
      if (typeId === 'refinery' && !pad) pad = [s.x + s.w - 1, s.y + s.h];
    }
    const docks = new Map(), since = new Map();
    let worst = { secs: 0, what: '' };
    for (let t = 0; t < MINUTES * 60 * 20; t++) {
      world.step();
      for (const e of world.events.drain()) if (e.type === 'docked') docks.set(e.id, (docks.get(e.id) ?? 0) + 1);
      for (const u of world.units.values()) {
        if (!u.harvest || u.house !== house) continue;
        const key = `${u.harvest.state}:${u.harvest.state === 'harvesting' ? u.tx + ',' + u.ty : ''}`;
        const s = since.get(u.id);
        if (!s || s.key !== key) { since.set(u.id, { key, t }); continue; }
        const secs = (t - s.t) / 20;
        if (!['harvesting', 'unloading'].includes(u.harvest.state) && secs > worst.secs) worst = { secs, what: `harvester ${u.id} ${key} at ${u.tx},${u.ty}` };
      }
    }
    const harvesters = [...world.units.values()].filter((u) => u.harvest && u.house === house);
    assert.ok(harvesters.length >= 2, `seed ${seed}: harvesters`);
    for (const u of harvesters) assert.ok((docks.get(u.id) ?? 0) >= 4, `seed ${seed}: harvester ${u.id} docked ${docks.get(u.id) ?? 0} times`);
    assert.ok(worst.secs <= STUCK_LIMIT, `seed ${seed}: ${worst.what} for ${worst.secs} s`);
  }
});
