import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { STRUCTURES } from '../src/data/structures.js';
import { UNITS, MOVE, onFoot } from '../src/data/units.js';
import { LIGHT_VEHICLE, PLAYABLE_HOUSES } from '../src/data/houses.js';
import { buildOptions, canBuild, lineOfItem, upgradeUnlocks, upgradeCost, LINE_FACTORIES } from '../src/sim/tech.js';
import { LINES } from '../src/sim/production.js';
import { setupSkirmish } from '../src/game/setup.js';
import { flatWorld, runUntil } from './helpers.mjs';

// One vehicle factory (spec §4.5): the Heavy Factory takes the Light Factory's place and builds every ground vehicle.

function base(house = 'atreides', types = ['constructionYard', 'windtrap', 'refinery']) {
  const world = flatWorld(40, 32, G.ROCK);
  const h = world.houses.get(house);
  h.credits = 10000;
  h.startBuffer = 100000;
  types.forEach((t, k) => world.spawnStructure(t, house, 2 + (k % 6) * 5, 2 + Math.floor(k / 6) * 5));
  return { world, h };
}
const built = (world, typeId) => [...world.units.values()].filter((u) => u.typeId === typeId);

test('there is no Light Factory: the Heavy Factory builds every ground vehicle and stands where the Light Factory stood', () => {
  assert.equal(STRUCTURES.lightFactory, undefined);
  assert.ok(!LINES.includes('light') && !('light' in LINE_FACTORIES));
  for (const [id, u] of Object.entries(UNITS)) {
    if (!u.builtAt || onFoot(u.move) || u.move === MOVE.AIR) continue;
    assert.equal(u.builtAt, 'heavyFactory', id);
    assert.equal(lineOfItem(id), 'heavy', id);
  }
  const hf = STRUCTURES.heavyFactory;
  assert.deepEqual([hf.name, hf.requires, hf.cost, hf.buildTime, hf.tech, hf.techByHouse], ['Heavy Factory', ['refinery'], 400, 96, 3, { atreides: 2, ordos: 2 }]);
  for (const id of ['hiTech', 'repair']) assert.deepEqual(STRUCTURES[id].requires, ['heavyFactory', 'outpost'], id);
});

test('the Heavy Factory is on offer as soon as a Refinery stands, not before', () => {
  const { world } = base('atreides', ['constructionYard', 'windtrap']);
  assert.ok(!buildOptions(world, 'atreides').structure.includes('heavyFactory'));
  world.spawnStructure('refinery', 'atreides', 20, 20);
  assert.ok(buildOptions(world, 'atreides').structure.includes('heavyFactory'), 'no Outpost needed');
});

test('it builds each house\'s light vehicle and the Combat Tank from the start', () => {
  for (const house of PLAYABLE_HOUSES) {
    const { world } = base(house, ['constructionYard', 'windtrap', 'refinery', 'heavyFactory']);
    const offered = buildOptions(world, house).heavy;
    for (const t of [LIGHT_VEHICLE[house], 'combatTank', 'harvester']) assert.ok(offered.includes(t), `${house}: ${t} in ${offered}`);
    assert.equal(canBuild(world, house, 'mcv'), false, `${house}: the MCV still waits for its upgrade`);
  }
});

test('the merged upgrade ladder: Quad, then MCV, Missile Tank and Siege Tank, at the old prices and tech levels', () => {
  const opened = (house) => [0, 1, 2, 3].map((level) => upgradeUnlocks(house, 'heavyFactory', level, level + 1));
  assert.deepEqual(opened('atreides'), [['Quad'], ['MCV'], ['Missile Tank'], ['Siege Tank']]);
  assert.deepEqual(opened('ordos'), [['Quad'], ['MCV'], [], ['Siege Tank']], 'the Ordos skip the Missile Tank level (tech.js upgradeResult)');
  assert.deepEqual(STRUCTURES.heavyFactory.upgrades, [200, 300, 300, 300]);
  assert.deepEqual(STRUCTURES.heavyFactory.upgradeTech, [3, 4, 5, 6]);
  const h = { id: 'atreides', upgrades: {} };
  assert.deepEqual([0, 1, 2, 3].map((level) => { h.upgrades.heavyFactory = level; return upgradeCost(h, 'heavyFactory'); }), [200, 300, 300, 300]);
  const { world, h: house } = base('atreides', ['constructionYard', 'windtrap', 'refinery', 'heavyFactory']);
  for (const [level, open] of [[0, ['trike', 'harvester', 'combatTank']], [1, ['trike', 'quad', 'harvester', 'combatTank']], [2, ['trike', 'quad', 'harvester', 'combatTank', 'mcv']],
    [3, ['trike', 'quad', 'harvester', 'combatTank', 'missileTank', 'mcv']], [4, ['trike', 'quad', 'harvester', 'combatTank', 'missileTank', 'siegeTank', 'mcv']]]) {
    house.upgrades.heavyFactory = level;
    assert.deepEqual(buildOptions(world, 'atreides').heavy, open, `level ${level}`);
  }
});

test('light and heavy vehicles share one queue: one build at a time, out of the same door', () => {
  const { world, h } = base('atreides', ['constructionYard', 'windtrap', 'refinery', 'heavyFactory']);
  const hf = [...world.structures.values()].find((s) => s.typeId === 'heavyFactory');
  world.issue('atreides', { type: 'build', typeId: 'combatTank' });
  world.issue('atreides', { type: 'build', typeId: 'trike' });
  world.step();
  assert.equal(h.lines.heavy.current.typeId, 'combatTank');
  assert.deepEqual(h.lines.heavy.queue, ['trike'], 'the trike waits for the tank');
  const out = [];
  for (let k = 0; k < 20 * 60; k++) { world.step(); for (const e of world.events.drain()) if (e.type === 'unitBuilt' && !e.free) out.push([e.unitType, e.structureId, Math.round(world.time * 10) / 10]); }
  assert.deepEqual(out.map(([t, s]) => [t, s]), [['combatTank', hf.id], ['trike', hf.id]]);
  assert.ok(Math.abs(out[1][2] - out[0][2] - 18) < 0.2, `the trike took its own 18 s after the tank: ${out[1][2] - out[0][2]}`);
});

test('a second Heavy Factory speeds the vehicle line by a quarter, and vehicles leave by the primary one', () => {
  const trikeTime = (two) => {
    const { world } = base('atreides', ['constructionYard', 'windtrap', 'refinery', 'heavyFactory']);
    const second = two ? world.spawnStructure('heavyFactory', 'atreides', 20, 20) : null;
    if (second) world.issue('atreides', { type: 'setPrimary', structureId: second.id });
    world.issue('atreides', { type: 'build', typeId: 'trike' });
    const t = runUntil(world, () => built(world, 'trike').length > 0, 40);
    return { t, trike: built(world, 'trike')[0], second };
  };
  const one = trikeTime(false), two = trikeTime(true);
  assert.ok(Math.abs(one.t - 18) < 0.2, `one factory: ${one.t} s`);
  assert.ok(Math.abs(two.t - 14.4) < 0.2, `two factories: ${two.t} s`);
  assert.ok(two.trike.ty === two.second.y + two.second.h && two.trike.tx >= 20 && two.trike.tx < 23, `out of the primary at ${two.trike.tx},${two.trike.ty}`);
});

test('the AI builds the Heavy Factory early and fields light vehicles and tanks from it', () => {
  const { world, rival } = setupSkirmish({ seed: 11, difficulty: 'normal' });
  const kinds = new Set();
  let factoryAt = -1;
  for (let k = 0; k < 20 * 600; k++) {
    world.step();
    for (const e of world.events.drain()) {
      if (e.house !== rival) continue;
      if (e.type === 'structurePlaced' && e.structureType === 'heavyFactory' && factoryAt < 0) factoryAt = world.time;
      if (e.type === 'unitBuilt' && e.unitType !== 'harvester') kinds.add(UNITS[e.unitType].move === MOVE.WHEELED ? 'light' : UNITS[e.unitType].move === MOVE.TRACKED ? 'tank' : 'other');
    }
  }
  assert.ok(factoryAt > 0 && factoryAt < 270, `the Heavy Factory went up at ${factoryAt} s`);
  assert.ok(kinds.has('light') && kinds.has('tank'), [...kinds].join(', '));
});
