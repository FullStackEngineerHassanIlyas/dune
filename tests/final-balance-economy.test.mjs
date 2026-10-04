// The computer's economy in missions 1-3 (final review): the Sega ladder sells no Harvester before mission 4, so when
// the worm has eaten the last one a new Refinery (its Harvester comes by Carryall) is the only way back. The computer
// keeps a Refinery's price in hand while it cannot buy a Harvester, and with none left builds a Refinery first — once
// the hungry worm has gone, or after two minutes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionDef, CAMPAIGN_HOUSES } from '../src/data/campaign.js';
import { setupMission } from '../src/game/mission-setup.js';
import { canBuild } from '../src/sim/tech.js';
import { createBrain } from '../src/sim/ai.js';
import { spawnWorm } from '../src/sim/worm.js';
import { GameMap } from '../src/sim/map.js';
import { World } from '../src/sim/world.js';
import { G } from '../src/data/terrain.js';
import { run } from './helpers.mjs';

const MINUTES = 12, REFINERY = 400;
const harvesters = (world, id) => [...world.units.values()].filter((u) => u.house === id && u.typeId === 'harvester').length;

test(`mission 3: a computer whose Harvesters the worm ate rebuilds whenever it can pay for a Refinery (${MINUTES} game minutes)`, () => {
  const broke = {};
  for (const house of CAMPAIGN_HOUSES) {
    const def = missionDef(house, 3), foe = def.houses[0].id;
    const { world } = setupMission(def);
    for (const s of world.structures.values()) if (s.house === house) s.hp = s.maxHp = 1e9;
    assert.equal(canBuild(world, foe, 'harvester'), false, `${def.id}: no Harvester for sale before mission 4`);
    const h = world.houses.get(foe);
    let bareSince = null;
    broke[def.id] = 0;
    for (let k = 1; k <= MINUTES * 60 * 20; k++) {
      world.step();
      if (k % 20 === 0) world.events.drain();
      if (k % 200) continue;   // every 10 s
      if (harvesters(world, foe)) { bareSince = null; continue; }
      bareSince ??= world.time;
      if (h.credits < 50) broke[def.id] += 10;
      if (world.time - bareSince > 150) assert.ok(h.credits < REFINERY || h.lines.structure.current?.typeId === 'refinery', `${def.id} at ${world.time.toFixed(0)} s: ${foe} sits on ${Math.floor(h.credits)} credits with no Harvester`);
    }
  }
  // the worm on the Atreides map eats the Harkonnen Harvesters faster than a 300-credit base can replace them; the others recover
  assert.ok(broke['ordos-3'] <= 60 && broke['harkonnen-3'] <= 60, JSON.stringify(broke));
});

/** A small Sega mission-3 world: the Harkonnen base on rock in the north, sand in the south. */
function segaWorld() {
  const map = new GameMap(40, 40);
  map.ground.fill(G.ROCK);
  for (let y = 22; y < 40; y++) for (let x = 0; x < 40; x++) map.ground[map.idx(x, y)] = G.SAND;
  const world = new World({ map, seed: 3 });
  world.rules.tech = 'sega';
  world.addHouse('atreides', { techLevel: 3 });
  const h = world.addHouse('harkonnen', { credits: 0, ai: true, techLevel: 3 });
  for (const [type, x, y] of [['constructionYard', 4, 4], ['windtrap', 8, 4], ['windtrap', 11, 4], ['refinery', 4, 8], ['heavyFactory', 8, 8], ['wor', 12, 8]]) world.spawnStructure(type, 'harkonnen', x, y);
  world.spawnStructure('constructionYard', 'atreides', 34, 4);
  createBrain(world, 'harkonnen', 'easy');
  for (const u of [...world.units.values()]) if (u.house === 'harkonnen' && u.typeId === 'harvester') world.removeUnit(u);
  return { world, h };
}

test('a computer house that cannot buy a Harvester builds a Refinery when its last one is gone, and saves for it', () => {
  const { world, h } = segaWorld();
  assert.equal(canBuild(world, 'harkonnen', 'harvester'), false);
  h.credits = 450;
  run(world, 3);
  assert.equal(h.lines.structure.current?.typeId, 'refinery', 'the Refinery comes first');
  assert.ok(!h.lines.heavy.current && !h.lines.infantry.current, 'nothing else draws on the money for it');
  run(world, 90);
  assert.ok(harvesters(world, 'harkonnen') >= 1, 'its Harvester came with it');
  h.credits = 380;
  run(world, 5);
  assert.ok(!h.lines.heavy.current && !h.lines.infantry.current && !h.lines.structure.current, 'below a Refinery\'s price it buys nothing');
  h.credits = 1000;
  run(world, 3);
  assert.ok(h.lines.heavy.current || h.lines.infantry.current || h.lines.structure.current, 'above it, it builds again');
});

test('with a hungry worm about it waits up to two minutes before the next Refinery', () => {
  const { world, h } = segaWorld();
  const worm = spawnWorm(world, 20, 34);
  h.credits = 450;
  run(world, 60);
  assert.ok(world.units.has(worm.id) && worm.worm.meals === 0, 'the worm is still about, unfed');
  assert.equal(h.lines.structure.current, null, 'no Refinery while the worm waits for a meal');
  run(world, 65);
  assert.equal(h.lines.structure.current?.typeId, 'refinery', 'after two minutes it builds one anyway');
});
