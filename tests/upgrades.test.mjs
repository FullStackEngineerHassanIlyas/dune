import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { buildOptions, canBuild, lineOfItem, upgradeId, upgradeLevel, upgradeResult, upgradeUnlocks, upgradeCost } from '../src/sim/tech.js';
import { flatWorld, run } from './helpers.mjs';

function withStructures(house, types) {
  const world = flatWorld(40, 40, G.ROCK);
  types.forEach((t, k) => world.spawnStructure(t, house, 2 + (k % 8) * 4, 2 + Math.floor(k / 8) * 4));
  return world;
}

function factoryBase(house = 'atreides') {
  const world = flatWorld(32, 32, G.ROCK);
  const h = world.houses.get(house);
  h.credits = 5000;
  h.startBuffer = 100000;
  world.spawnStructure('constructionYard', house, 4, 4);
  world.spawnStructure('windtrap', house, 0, 0);
  const hf = world.spawnStructure('heavyFactory', house, 10, 10);
  return { world, h, hf };
}

test('each factory offers its next upgrade while there is one', () => {
  const world = withStructures('atreides', ['constructionYard', 'windtrap', 'outpost', 'barracks', 'heavyFactory']);
  const h = world.houses.get('atreides');
  assert.deepEqual(buildOptions(world, 'atreides').upgrades, ['upgrade:constructionYard', 'upgrade:barracks', 'upgrade:heavyFactory']);
  h.upgrades = { constructionYard: 2, barracks: 1, heavyFactory: 4 };
  assert.deepEqual(buildOptions(world, 'atreides').upgrades, []);
  const bare = withStructures('atreides', ['constructionYard']);
  bare.houses.get('atreides').upgrades.constructionYard = 1;
  assert.equal(canBuild(bare, 'atreides', upgradeId('constructionYard')), false, 'the second yard upgrade needs an Outpost and a Wind Trap');
});

test('tech level gates each upgrade level; the Ordos take heavy factory levels 3 and 4 together', () => {
  const { world, h } = factoryBase();
  h.techLevel = 2;
  assert.equal(canBuild(world, 'atreides', upgradeId('heavyFactory')), false);
  h.techLevel = 3;
  assert.equal(canBuild(world, 'atreides', upgradeId('heavyFactory')), true, 'level 1 (Quad) at tech 3, where the old Light Factory upgrade was');
  h.upgrades.heavyFactory = 1;
  assert.equal(canBuild(world, 'atreides', upgradeId('heavyFactory')), false, 'level 2 waits for tech 4');
  assert.equal(upgradeResult(h, 'heavyFactory'), 2);
  h.techLevel = 4;
  assert.equal(canBuild(world, 'atreides', upgradeId('heavyFactory')), true);
  const o = factoryBase('ordos');
  o.h.upgrades.heavyFactory = 2;
  o.h.techLevel = 5;
  assert.equal(canBuild(o.world, 'ordos', upgradeId('heavyFactory')), false, 'the Ordos wait until the last level is on offer');
  o.h.techLevel = 6;
  assert.equal(canBuild(o.world, 'ordos', upgradeId('heavyFactory')), true);
  assert.equal(upgradeResult(o.h, 'heavyFactory'), 4);
});

test('Harkonnen start with the first Heavy Factory upgrade: the Quad, their only light vehicle', () => {
  const world = withStructures('harkonnen', ['constructionYard', 'heavyFactory']);
  const h = world.houses.get('harkonnen');
  assert.equal(upgradeLevel(h, 'heavyFactory'), 1);
  assert.deepEqual(buildOptions(world, 'harkonnen').heavy, ['quad', 'harvester', 'combatTank']);
  assert.equal(upgradeResult(h, 'heavyFactory'), 2, 'the next purchase is the MCV level');
  assert.deepEqual(upgradeUnlocks('harkonnen', 'heavyFactory', 1, 2), ['MCV']);
  assert.equal(upgradeCost(h, 'heavyFactory'), 300);
  assert.equal(upgradeLevel(world.houses.get('atreides'), 'heavyFactory'), 0);
});

test('upgrades run on the line of the factory they improve and name what they open', () => {
  assert.equal(lineOfItem(upgradeId('constructionYard')), 'structure');
  assert.equal(lineOfItem(upgradeId('heavyFactory')), 'heavy');
  assert.equal(lineOfItem(upgradeId('wor')), 'infantry');
  assert.equal(lineOfItem('upgrade:nothing'), null);
  assert.deepEqual(upgradeUnlocks('atreides', 'constructionYard', 0, 1), ['Large Concrete Slab']);
  assert.deepEqual(upgradeUnlocks('atreides', 'constructionYard', 1, 2), ['Rocket Turret']);
  assert.deepEqual(upgradeUnlocks('atreides', 'heavyFactory', 0, 1), ['Quad']);
  assert.deepEqual(upgradeUnlocks('atreides', 'heavyFactory', 1, 2), ['MCV']);
  assert.deepEqual(upgradeUnlocks('ordos', 'heavyFactory', 2, 4), ['Siege Tank'], 'no Missile Tank for the Ordos');
  assert.deepEqual(upgradeUnlocks('harkonnen', 'wor', 0, 1), ['Trooper Squad']);
});

test('an upgrade is paid as it runs and takes nine seconds', () => {
  const { world, h } = factoryBase();
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  run(world, 4.5);
  assert.ok(Math.abs(h.credits - 4900) < 2, `credits ${h.credits}`);
  assert.equal(upgradeLevel(h, 'heavyFactory'), 0);
  run(world, 4.6);
  assert.equal(upgradeLevel(h, 'heavyFactory'), 1);
  assert.equal(h.lines.heavy.current, null);
  assert.ok(Math.abs(h.credits - 4800) < 1e-6, 'the first level costs what the Light Factory upgrade did');
  const events = world.events.drain();
  assert.ok(events.some((e) => e.type === 'eva' && e.key === 'upgradeComplete'));
  assert.ok(events.some((e) => e.type === 'upgraded' && e.structureType === 'heavyFactory' && e.level === 1));
});

test('an upgrade goes ahead of the units waiting on its line, once', () => {
  const { world, h } = factoryBase();
  world.issue('atreides', { type: 'build', typeId: 'combatTank', count: 3 });
  world.step();
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  world.step();
  assert.equal(h.lines.heavy.current.typeId, 'combatTank');
  assert.deepEqual(h.lines.heavy.queue, ['upgrade:heavyFactory', 'combatTank', 'combatTank']);
});

test('holding, then cancelling an upgrade refunds what was paid; the yard is busy meanwhile', () => {
  const { world, h } = factoryBase();
  world.issue('atreides', { type: 'build', typeId: 'upgrade:constructionYard' });
  run(world, 3);
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  world.step();
  assert.ok(world.events.drain().some((e) => e.key === 'busy'), 'the yard is upgrading');
  world.issue('atreides', { type: 'hold', typeId: 'upgrade:constructionYard' });
  world.step();
  assert.equal(h.lines.structure.current.state, 'hold');
  world.issue('atreides', { type: 'hold', typeId: 'upgrade:constructionYard' });
  world.step();
  assert.equal(h.lines.structure.current, null);
  assert.ok(Math.abs(h.credits - 5000) < 1e-6);
  assert.equal(upgradeLevel(h, 'constructionYard'), 0);
});

test('losing every factory of the type refunds the upgrade in progress; a finished upgrade outlasts the factory', () => {
  const { world, h, hf } = factoryBase();
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  run(world, 3);
  world.removeStructure(hf);
  run(world, 1.1);
  assert.equal(h.lines.heavy.current, null);
  assert.ok(Math.abs(h.credits - 5000) < 1e-6);
  const again = factoryBase();
  again.world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  run(again.world, 9.2);
  again.world.removeStructure(again.hf);
  again.world.spawnStructure('heavyFactory', 'atreides', 20, 20);
  assert.equal(upgradeLevel(again.h, 'heavyFactory'), 1);
});

test('the Ordos pay once for heavy factory levels 3 and 4', () => {
  const { world, h } = factoryBase('ordos');
  h.upgrades.heavyFactory = 2;
  world.issue('ordos', { type: 'build', typeId: 'upgrade:heavyFactory' });
  run(world, 9.2);
  assert.equal(upgradeLevel(h, 'heavyFactory'), 4);
  assert.ok(Math.abs(h.credits - 4700) < 1e-6);
});

test('an upgrade the house cannot buy is rejected', () => {
  const { world, h } = factoryBase();
  h.upgrades.heavyFactory = 4;
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  world.issue('atreides', { type: 'build', typeId: 'upgrade:windtrap' });
  world.issue('atreides', { type: 'build', typeId: 'upgrade:bogus' });
  world.step();
  assert.equal(world.events.drain().filter((e) => e.type === 'commandRejected').length, 3);
});

test('units and structures wait for the upgrades they need', () => {
  const world = withStructures('atreides', ['constructionYard', 'windtrap', 'outpost', 'barracks', 'heavyFactory']);
  const h = world.houses.get('atreides');
  let o = buildOptions(world, 'atreides');
  assert.deepEqual([o.heavy, o.infantry], [['trike', 'harvester', 'combatTank'], ['soldier']]);
  assert.ok(!o.structure.includes('concrete4') && !o.structure.includes('rocketTurret'));
  h.upgrades = { constructionYard: 1, barracks: 1, heavyFactory: 1 };
  o = buildOptions(world, 'atreides');
  assert.deepEqual([o.heavy, o.infantry], [['trike', 'quad', 'harvester', 'combatTank'], ['soldier', 'infantry']]);
  assert.ok(o.structure.includes('concrete4') && !o.structure.includes('rocketTurret'));
  h.upgrades = { constructionYard: 2, heavyFactory: 4 };
  o = buildOptions(world, 'atreides');
  assert.deepEqual(o.heavy, ['trike', 'quad', 'harvester', 'combatTank', 'missileTank', 'siegeTank', 'mcv']);
  assert.ok(o.structure.includes('rocketTurret'));
  h.upgrades = {};
  world.issue('atreides', { type: 'build', typeId: 'quad' });
  world.step();
  assert.ok(world.events.drain().some((e) => e.type === 'commandRejected' && e.typeId === 'quad'), 'no Quad without the first Heavy Factory upgrade');
});

test('the Hi-Tech upgrade opens the Ornithopter, never for the Harkonnen', () => {
  const at = withStructures('atreides', ['constructionYard', 'hiTech']);
  assert.deepEqual(upgradeUnlocks('atreides', 'hiTech', 0, 1), ['Ornithopter']);
  assert.equal(canBuild(at, 'atreides', upgradeId('hiTech')), true);
  const hk = withStructures('harkonnen', ['constructionYard', 'hiTech']);
  assert.equal(canBuild(hk, 'harkonnen', upgradeId('hiTech')), false);
});
