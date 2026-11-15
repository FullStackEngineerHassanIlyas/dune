import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { setupSkirmish, findFreeTile } from '../src/game/setup.js';
import { deploySpot } from '../src/sim/deploy.js';
import { flatWorld } from './helpers.mjs';

test('each side starts with an MCV on rock and five escorts on distinct tiles', () => {
  const { world, house, rival } = setupSkirmish({ seed: 4, size: 64, house: 'ordos' });
  assert.equal(rival, 'atreides');
  assert.ok(world.houses.get(rival).isAI && !world.houses.get(house).isAI);
  for (const h of [house, rival]) {
    const units = [...world.units.values()].filter((u) => u.house === h);
    assert.equal(units.length, 6);
    const mcv = units.find((u) => u.typeId === 'mcv');
    assert.equal(world.map.ground[world.map.idx(mcv.tx, mcv.ty)], G.ROCK);
  }
  const tiles = [...world.units.values()].map((u) => `${u.tx},${u.ty}`);
  assert.equal(new Set(tiles).size, tiles.length);
});

test('the player MCV can deploy where it starts, on many seeds', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const { world, house } = setupSkirmish({ seed });
    const mcv = [...world.units.values()].find((u) => u.house === house && u.typeId === 'mcv');
    assert.ok(deploySpot(world, mcv), `seed ${seed}`);
  }
});

test('findFreeTile respects the minimum radius and passability', () => {
  const world = flatWorld(12, 12, G.ROCK);
  world.map.ground[world.map.idx(6, 5)] = G.MOUNTAIN;
  const t = findFreeTile(world, 5, 5, 'tracked', 4, 1);
  assert.ok(Math.max(Math.abs(t.x - 5), Math.abs(t.y - 5)) >= 1);
  assert.notDeepEqual([t.x, t.y], [6, 5]);
  assert.equal(findFreeTile(flatWorld(3, 3, G.MOUNTAIN), 1, 1, 'tracked', 2), null);
});

test('skirmish fog of war is on by default and can be switched off', () => {
  assert.equal(setupSkirmish({ seed: 2 }).world.fogOfWar, true);
  assert.equal(setupSkirmish({ seed: 2, fog: false }).world.fogOfWar, false);
});

test('skirmish difficulty goes to the rival\'s brain; aiPlayer makes both sides computer players', () => {
  const { world, house, rival } = setupSkirmish({ seed: 3, difficulty: 'easy' });
  assert.equal(world.houses.get(rival).brain.difficulty, 'easy');
  assert.equal(world.houses.get(house).brain, undefined);
  const both = setupSkirmish({ seed: 3, aiPlayer: true });
  assert.ok(both.world.houses.get(both.house).brain && both.world.houses.get(both.rival).brain);
});

test('a battle address with a size or credits that make no sense still sets up a game', () => {   // ?size=47.5 threw "Invalid array length", 0 and -64 spawned off the map
  const sized = (size) => setupSkirmish({ seed: 2, size }).world.map.w;
  assert.equal(sized(47.5), 48, 'a fraction rounds');
  assert.equal(sized(0), 16);
  assert.equal(sized(-64), 16);
  assert.equal(sized(1e6), 256, 'a map the page could never hold');
  assert.equal(sized(NaN), 64);
  assert.equal(sized(Infinity), 64);
  const cash = (credits) => [...setupSkirmish({ seed: 2, credits }).world.houses.values()].map((h) => h.credits);   // ?credits=-100 started every house in debt, ?credits=Infinity at NaN
  assert.deepEqual(cash(-100), [3000, 3000]);
  assert.deepEqual(cash(Infinity), [3000, 3000]);
  assert.deepEqual(cash(NaN), [3000, 3000]);
  assert.deepEqual(cash(0), [0, 0], 'no credits at all is a game');
});

test('a battle address with a house no skirmish can be played as sets up a game as the first house', () => {   // ?house=fremen threw "Cannot read properties of undefined", ?house=bogus "unknown house bogus": a blank page
  for (const house of ['fremen', 'bogus', '', undefined, null]) {
    const r = setupSkirmish({ seed: 2, house });
    assert.equal(r.house, 'atreides', `house ${house}`);
    assert.ok(r.world.houses.get('atreides') && !r.opponents.includes('atreides'));
  }
  assert.equal(setupSkirmish({ seed: 2, house: 'sardaukar' }).house, 'sardaukar', 'a house of the skirmish stays');
});
