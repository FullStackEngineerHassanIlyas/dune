import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { isVisible, unitVisibleTo, structureVisibleTo, unitReach, structureReach } from '../src/sim/fog.js';
import { UNITS } from '../src/data/units.js';
import { STRUCTURES } from '../src/data/structures.js';
import { setupSkirmish } from '../src/game/setup.js';
import { flatWorld, run } from './helpers.mjs';

test('in a fog-of-war game units reveal their sight, never less than their range; explored ground stays revealed', () => {
  const world = flatWorld(40, 20, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 10, { heading: 0 });
  world.step();
  const fog = world.houses.get('atreides').fog;
  assert.equal(isVisible(world, 'atreides', 10, 10), true, 'range 4 + 1 reaches five tiles (its sight, 3 + 1, would reach four)');
  assert.equal(isVisible(world, 'atreides', 11, 10), false);
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 30, y: 10 });
  run(world, 30);
  assert.equal(isVisible(world, 'atreides', 5, 10), false, 'no longer seen');
  assert.equal(fog.explored[world.map.idx(5, 10)], 1, 'but still explored');
});

test('enemy units are visible only in current sight; own units always', () => {
  const world = flatWorld(40, 20, G.ROCK);
  world.spawnUnit('combatTank', 'atreides', 5, 10);
  const near = world.spawnUnit('quad', 'harkonnen', 8, 10);
  const far = world.spawnUnit('quad', 'harkonnen', 30, 10);
  world.step();
  assert.equal(unitVisibleTo(world, 'atreides', near), true);
  assert.equal(unitVisibleTo(world, 'atreides', far), false);
  assert.equal(unitVisibleTo(world, 'harkonnen', far), true);
});

test('enemy structures stay visible after they were seen once', () => {
  const world = flatWorld(40, 20, G.ROCK);
  const scout = world.spawnUnit('trike', 'atreides', 22, 10, { heading: 0 });
  const yard = world.spawnStructure('constructionYard', 'harkonnen', 24, 9);
  assert.equal(structureVisibleTo(world, 'atreides', yard), false);
  world.step();
  assert.equal(structureVisibleTo(world, 'atreides', yard), true);
  world.issue('atreides', { type: 'move', ids: [scout.id], x: 2, y: 10 });
  run(world, 15);
  assert.equal(isVisible(world, 'atreides', 24, 9), false);
  assert.equal(structureVisibleTo(world, 'atreides', yard), true);
});

test('with fog of war switched off everything is visible', () => {
  const world = flatWorld(40, 20, G.ROCK);
  world.fogOfWar = false;
  world.spawnUnit('combatTank', 'atreides', 5, 10);
  const far = world.spawnUnit('quad', 'harkonnen', 30, 10);
  const yard = world.spawnStructure('constructionYard', 'harkonnen', 34, 4);
  world.step();
  assert.equal(world.houses.get('atreides').fog, undefined);
  assert.equal(isVisible(world, 'atreides', 30, 10), true);
  assert.equal(unitVisibleTo(world, 'atreides', far), true);
  assert.equal(structureVisibleTo(world, 'atreides', yard), true);
});

test('structures reveal around their footprint', () => {
  const world = flatWorld(40, 20, G.ROCK);
  world.spawnStructure('outpost', 'atreides', 10, 10);
  world.step();
  assert.equal(isVisible(world, 'atreides', 20, 10), true, 'the outpost sees ten tiles');
  assert.equal(isVisible(world, 'atreides', 24, 10), false);
});

test('the Dune II shroud: ground once seen stays in view, and so do enemy units on it', () => {
  const world = flatWorld(40, 20, G.ROCK);
  world.visibility = 'shroud';
  const scout = world.spawnUnit('trike', 'atreides', 5, 10, { heading: 0 });
  world.step();
  assert.equal(isVisible(world, 'atreides', 8, 10), true, 'the original sight: 2 + 1');
  assert.equal(isVisible(world, 'atreides', 9, 10), false, 'unexplored stays black');
  world.issue('atreides', { type: 'move', ids: [scout.id], x: 30, y: 10 });
  run(world, 20);
  const raider = world.spawnUnit('quad', 'harkonnen', 6, 10);
  world.step();
  assert.equal(isVisible(world, 'atreides', 5, 10), true, 'left behind, still in view');
  assert.equal(unitVisibleTo(world, 'atreides', raider), true, 'an enemy on ground once seen is seen');
  const hidden = world.spawnUnit('quad', 'harkonnen', 20, 3);
  world.step();
  assert.equal(unitVisibleTo(world, 'atreides', hidden), false, 'one in the black is not');
});

test('fog of war: nothing outranges its own sight, so no unit or building shoots from where it cannot see', () => {
  for (const t of Object.values(UNITS)) if (t.range) assert.ok(unitReach(t, true) > t.range, `${t.name}: sees ${unitReach(t, true)}, shoots ${t.range}`);
  for (const [id, t] of Object.entries(STRUCTURES)) if (t.range) assert.ok(structureReach({ ...t, id }, true) - Math.max(t.w, t.h) / 2 > t.range, `${t.name}`);
  assert.equal(unitReach(UNITS.missileTank, true), 10, 'a Missile Tank sees the 9 tiles it shoots, and one more');
  assert.equal(unitReach(UNITS.missileTank, false), 6, 'the shroud keeps the original sight');
});

test('a skirmish starts in the Dune II shroud; fog of war and a revealed map are choices', () => {
  assert.equal(setupSkirmish({ seed: 2 }).world.visibility, 'shroud');
  assert.equal(setupSkirmish({ seed: 2, visibility: 'fog' }).world.visibility, 'fog');
  const open = setupSkirmish({ seed: 2, fog: false }).world;
  assert.deepEqual([open.visibility, open.fogOfWar], ['revealed', false]);
  assert.equal(setupSkirmish({ seed: 2, visibility: 'nonsense' }).world.visibility, 'shroud');
});
