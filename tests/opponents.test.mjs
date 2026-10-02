import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { SKIRMISH_HOUSES, PLAYABLE_HOUSES, HOUSES, LIGHT_VEHICLE, INFANTRY } from '../src/data/houses.js';
import { STRUCTURE_ORDER, buildOptions, canBuildStructure, techOpens } from '../src/sim/tech.js';
import { flatWorld } from './helpers.mjs';

function subHouseWorld(house, types) {
  const world = flatWorld(40, 40, G.ROCK);
  world.addHouse(house);
  types.forEach((t, k) => world.spawnStructure(t, house, 2 + (k % 8) * 4, 2 + Math.floor(k / 8) * 4));
  return world;
}

test('the Sardaukar and the Mercenaries build what the original gives them: both infantry lines, the Trike, no IX special', () => {
  for (const house of ['sardaukar', 'mercenary']) {
    const world = subHouseWorld(house, ['constructionYard', 'windtrap', 'refinery', 'outpost', 'heavyFactory', 'barracks', 'wor', 'hiTech', 'starport', 'ix']);
    world.houses.get(house).upgrades = { heavyFactory: 4, barracks: 1, wor: 1, hiTech: 1 };
    const o = buildOptions(world, house);
    assert.deepEqual(o.heavy, ['trike', 'quad', 'harvester', 'combatTank', 'missileTank', 'siegeTank', 'mcv'], house);
    assert.deepEqual(o.infantry, ['soldier', 'infantry', 'trooper', 'troopers'], house);
    assert.deepEqual(o.air, ['carryall', 'ornithopter'], house);
    assert.ok(o.structure.includes('palace') && o.structure.includes('barracks') && o.structure.includes('wor'), o.structure.join());
  }
});

test('every skirmish house has colours, a Palace weapon and an opening force; the Fremen are none of them', () => {
  assert.deepEqual(SKIRMISH_HOUSES.slice(0, 3), PLAYABLE_HOUSES);
  assert.ok(!SKIRMISH_HOUSES.includes('fremen'));
  assert.equal(HOUSES.sardaukar.palace, 'deathHand');
  assert.equal(HOUSES.mercenary.palace, 'saboteur');
  for (const id of SKIRMISH_HOUSES) {
    assert.ok(HOUSES[id] && Number.isInteger(HOUSES[id].color), id);
    assert.ok(LIGHT_VEHICLE[id] && INFANTRY[id], id);
  }
  assert.equal(new Set(SKIRMISH_HOUSES.map((id) => HOUSES[id].color)).size, SKIRMISH_HOUSES.length);
});

test('the tech level gates buildings level by level, as the campaign opened them', () => {
  const offered = (house, level) => {
    const h = { id: house, techLevel: level, upgrades: { constructionYard: 2 } };
    return STRUCTURE_ORDER.filter((id) => canBuildStructure(h, id, new Set(['constructionYard', ...STRUCTURE_ORDER.filter((x) => x !== id)])));
  };
  const atreides = {
    1: ['concrete', 'windtrap', 'refinery'],
    2: ['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'heavyFactory'],
    4: ['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'heavyFactory', 'wall', 'concrete4'],
    5: ['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'heavyFactory', 'hiTech', 'repair', 'wall', 'turret', 'concrete4'],
    6: ['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'heavyFactory', 'hiTech', 'repair', 'wall', 'turret', 'rocketTurret', 'concrete4', 'starport'],
    7: ['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'heavyFactory', 'hiTech', 'repair', 'wall', 'turret', 'rocketTurret', 'concrete4', 'starport', 'ix'],
  };
  for (const [level, list] of Object.entries(atreides)) assert.deepEqual(offered('atreides', Number(level)), list, `level ${level}`);
  assert.deepEqual(offered('atreides', 3), atreides[2]);
  assert.deepEqual(offered('atreides', 8), [...atreides[7], 'palace']);
  assert.deepEqual(offered('atreides', 9), offered('atreides', 8));
  assert.ok(!offered('harkonnen', 2).includes('heavyFactory') && offered('harkonnen', 3).includes('heavyFactory'), 'the Harkonnen wait a level for theirs');
  assert.ok(offered('harkonnen', 2).includes('wor') && !offered('harkonnen', 2).includes('barracks'));
  assert.ok(offered('sardaukar', 2).includes('barracks') && !offered('sardaukar', 4).includes('wor') && offered('sardaukar', 5).includes('wor'));
});

test('the set-up screen can say what each tech level opens', () => {
  assert.deepEqual(techOpens(1, 'atreides'), ['Concrete Slab', 'Wind Trap', 'Spice Refinery']);
  assert.ok(techOpens(3, 'harkonnen').includes('Heavy Factory'));
  assert.ok(techOpens(3, 'atreides').includes('Quad'), techOpens(3, 'atreides').join());
  assert.ok(techOpens(6, 'atreides').includes('Siege Tank') && techOpens(6, 'atreides').includes('Rocket Turret'));
  assert.deepEqual(techOpens(8, 'ordos'), ['Palace']);
  for (let level = 1; level <= 8; level++) for (const h of PLAYABLE_HOUSES) assert.ok(techOpens(level, h).length, `${h} ${level}`);
});
