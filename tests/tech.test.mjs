import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { buildOptions, lineOfItem, canBuild } from '../src/sim/tech.js';
import { flatWorld } from './helpers.mjs';

function withStructures(house, types) {
  const world = flatWorld(40, 40, G.ROCK);
  types.forEach((t, k) => world.spawnStructure(t, house, 2 + (k % 8) * 4, 2 + Math.floor(k / 8) * 4));
  return world;
}

test('a bare Construction Yard offers concrete and wind traps', () => {
  const world = withStructures('atreides', ['constructionYard']);
  assert.deepEqual(buildOptions(world, 'atreides').structure, ['concrete', 'windtrap']);
});

test('each prerequisite opens the next buildings', () => {
  const world = withStructures('atreides', ['constructionYard', 'windtrap']);
  assert.deepEqual(buildOptions(world, 'atreides').structure, ['concrete', 'windtrap', 'refinery', 'outpost']);
  const more = withStructures('atreides', ['constructionYard', 'windtrap', 'refinery', 'outpost', 'lightFactory']);
  assert.deepEqual(buildOptions(more, 'atreides').structure,
    ['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'lightFactory', 'heavyFactory', 'hiTech', 'repair', 'wall', 'turret', 'starport']);
});

test('infantry buildings follow the house', () => {
  const types = ['constructionYard', 'windtrap', 'outpost'];
  assert.ok(buildOptions(withStructures('harkonnen', types), 'harkonnen').structure.includes('wor'));
  assert.ok(!buildOptions(withStructures('harkonnen', types), 'harkonnen').structure.includes('barracks'));
  const ordos = buildOptions(withStructures('ordos', types), 'ordos').structure;
  assert.ok(ordos.includes('barracks') && ordos.includes('wor'));
  assert.ok(!buildOptions(withStructures('atreides', types), 'atreides').structure.includes('wor'));
});

test('factories offer their house roster, the House of IX specials included', () => {
  const opts = (house) => {
    const world = withStructures(house, ['constructionYard', 'heavyFactory', 'lightFactory', 'barracks', 'wor', 'ix']);
    world.houses.get(house).upgrades = { heavyFactory: 3, lightFactory: 1, barracks: 1, wor: 1 };
    return buildOptions(world, house);
  };
  assert.deepEqual(opts('atreides').heavy, ['harvester', 'combatTank', 'missileTank', 'siegeTank', 'mcv', 'sonicTank']);
  assert.deepEqual(opts('ordos').heavy, ['harvester', 'combatTank', 'siegeTank', 'mcv', 'deviator']);
  assert.deepEqual(opts('harkonnen').light, ['quad']);
  assert.deepEqual(opts('ordos').light, ['raider', 'quad']);
  assert.deepEqual(opts('ordos').infantry, ['soldier', 'infantry', 'trooper', 'troopers']);
  assert.ok(!buildOptions(withStructures('atreides', ['constructionYard', 'heavyFactory']), 'atreides').heavy.includes('sonicTank'), 'the Sonic Tank needs a House of IX');
});

test('tech level gates structures, with the per-house light factory rule', () => {
  const world = withStructures('harkonnen', ['constructionYard', 'windtrap', 'refinery']);
  world.houses.get('harkonnen').techLevel = 2;
  assert.ok(!buildOptions(world, 'harkonnen').structure.includes('lightFactory'));
  const a = withStructures('atreides', ['constructionYard', 'windtrap', 'refinery']);
  a.houses.get('atreides').techLevel = 2;
  assert.ok(buildOptions(a, 'atreides').structure.includes('lightFactory'));
});

test('lines and direct checks', () => {
  assert.equal(lineOfItem('windtrap'), 'structure');
  assert.equal(lineOfItem('quad'), 'light');
  assert.equal(lineOfItem('troopers'), 'infantry');
  assert.equal(lineOfItem('saboteur'), null);
  const world = withStructures('atreides', ['constructionYard']);
  assert.equal(canBuild(world, 'atreides', 'windtrap'), true);
  assert.equal(canBuild(world, 'atreides', 'hiTech'), false);
  assert.equal(canBuild(world, 'atreides', 'combatTank'), false);
});

test('the Hi-Tech Factory builds Carryalls; Ornithopters need its upgrade and a House of IX', () => {
  const world = withStructures('atreides', ['constructionYard', 'hiTech']);
  const h = world.houses.get('atreides');
  assert.deepEqual(buildOptions(world, 'atreides').air, ['carryall']);
  h.upgrades.hiTech = 1;
  assert.deepEqual(buildOptions(world, 'atreides').air, ['carryall'], 'no House of IX yet');
  world.spawnStructure('ix', 'atreides', 30, 30);
  assert.deepEqual(buildOptions(world, 'atreides').air, ['carryall', 'ornithopter']);
  assert.equal(lineOfItem('ornithopter'), 'air');
});

test('a Starport opens after a Refinery, one per house; a House of IX needs it; losing IX cancels an Ornithopter', () => {
  const world = withStructures('atreides', ['constructionYard', 'windtrap', 'refinery']);
  assert.ok(buildOptions(world, 'atreides').structure.includes('starport'));
  assert.ok(!buildOptions(world, 'atreides').structure.includes('ix'));
  world.spawnStructure('starport', 'atreides', 30, 30);
  const o = buildOptions(world, 'atreides').structure;
  assert.ok(o.includes('ix') && !o.includes('starport'), 'one Starport at a time');
  const h = world.houses.get('atreides');
  h.credits = 5000;
  h.startBuffer = 100000;
  const hq = world.spawnStructure('hiTech', 'atreides', 20, 20);
  const ix = world.spawnStructure('ix', 'atreides', 26, 20);
  h.upgrades.hiTech = 1;
  world.issue('atreides', { type: 'build', typeId: 'ornithopter' });
  for (let k = 0; k < 100; k++) world.step();
  assert.equal(h.lines.air.current?.typeId, 'ornithopter');
  world.removeStructure(ix);
  for (let k = 0; k < 22; k++) world.step();
  assert.equal(h.lines.air.current, null, 'no House of IX: cancelled');
  assert.ok(Math.abs(h.credits - 5000) < 1e-6, 'refunded');
  assert.ok(hq);
});
