import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { SKIRMISH_HOUSES, PLAYABLE_HOUSES, HOUSES, LIGHT_VEHICLE, INFANTRY } from '../src/data/houses.js';
import { STRUCTURE_ORDER, buildOptions, canBuildStructure, techOpens, structureTechLevel } from '../src/sim/tech.js';
import { setupSkirmish, skirmishOptions, maxOpponents, parseOpponents, formatOpponents } from '../src/game/setup.js';
import { readParams } from '../src/core/params.js';
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

test('computer houses keep to the tech level too', () => {
  const { world, house, opponents } = setupSkirmish({ seed: 4, techLevel: 3, aiPlayer: true, fog: false, opponents: [{ house: 'harkonnen' }, { house: 'sardaukar' }] });
  for (let t = 0; t < 8 * 60 * 20; t++) world.step();
  for (const id of [house, ...opponents]) {
    const built = [...world.structures.values()].filter((s) => s.house === id);
    assert.ok(built.length >= 4, `${id} built ${built.length}`);
    for (const s of built) assert.ok(structureTechLevel(s.type, id) <= 3, `${id} put up a ${s.typeId}`);
  }
  assert.ok([...world.structures.values()].some((s) => s.house === 'harkonnen' && s.typeId === 'heavyFactory'), 'level 3 opens the Harkonnen Heavy Factory');
});

test('the set-up screen can say what each tech level opens', () => {
  assert.deepEqual(techOpens(1, 'atreides'), ['Concrete Slab', 'Wind Trap', 'Spice Refinery']);
  assert.ok(techOpens(3, 'harkonnen').includes('Heavy Factory'));
  assert.ok(techOpens(3, 'atreides').includes('Quad'), techOpens(3, 'atreides').join());
  assert.ok(techOpens(6, 'atreides').includes('Siege Tank') && techOpens(6, 'atreides').includes('Rocket Turret'));
  assert.deepEqual(techOpens(8, 'ordos'), ['Palace']);
  assert.deepEqual(techOpens(2, 'harkonnen'), ['Spice Silo', 'Radar Outpost', 'WOR Trooper Facility', 'Heavy Trooper'], 'a new factory names the units it builds');
  assert.deepEqual(techOpens(3, 'harkonnen'), ['Heavy Factory', 'Harvester', 'Combat Tank', 'Quad']);
  assert.deepEqual(techOpens(5, 'atreides'), ['Hi-Tech Factory', 'Repair Facility', 'Gun Turret', 'Carryall', 'Missile Tank']);
  assert.deepEqual(techOpens(5, 'harkonnen'), ['Hi-Tech Factory', 'Repair Facility', 'Gun Turret', 'Carryall', 'Trooper Squad', 'Missile Tank']);
  assert.deepEqual(techOpens(5, 'ordos'), ['WOR Trooper Facility', 'Hi-Tech Factory', 'Repair Facility', 'Gun Turret', 'Heavy Trooper', 'Carryall']);
  assert.deepEqual(techOpens(7, 'atreides'), ['House of IX', 'Sonic Tank', 'Ornithopter'], 'the House of IX special comes with level 7');
  assert.deepEqual(techOpens(7, 'harkonnen'), ['House of IX', 'Devastator']);
  assert.deepEqual(techOpens(7, 'ordos'), ['House of IX', 'Deviator', 'Ornithopter']);
  for (let level = 1; level <= 8; level++) for (const h of PLAYABLE_HOUSES) assert.ok(techOpens(level, h).length, `${h} ${level}`);
});

test('three opponents get the four corners, each its own house, difficulty and opening force', () => {
  const { world, starts, house, rival, opponents } = setupSkirmish({ seed: 3, size: 64, house: 'atreides',
    opponents: [{ house: 'harkonnen', difficulty: 'hard' }, { house: 'sardaukar', difficulty: 'easy' }, { house: 'mercenary' }] });
  assert.deepEqual(opponents, ['harkonnen', 'sardaukar', 'mercenary']);
  assert.equal(rival, 'harkonnen');
  assert.deepEqual([...world.houses.keys()], ['atreides', 'harkonnen', 'sardaukar', 'mercenary']);
  assert.equal(starts.length, 4);
  const corner = (s) => `${s.x < 32 ? 'W' : 'E'}${s.y < 32 ? 'N' : 'S'}`;
  assert.equal(new Set(starts.map(corner)).size, 4, 'one per corner');
  assert.deepEqual(opponents.map((id) => world.houses.get(id).brain.difficulty), ['hard', 'easy', 'normal']);
  assert.ok(!world.houses.get(house).brain && !world.houses.get(house).isAI);
  [house, ...opponents].forEach((id, k) => {
    const mcv = [...world.units.values()].find((u) => u.house === id && u.typeId === 'mcv');
    assert.ok(mcv && Math.hypot(mcv.tx - starts[k].x, mcv.ty - starts[k].y) < 1, `${id} starts at its own corner`);
    assert.equal([...world.units.values()].filter((u) => u.house === id).length, 6, id);
  });
});

test('a house is never fielded twice: clashes and unknown houses take the first free one', () => {
  const { opponents } = setupSkirmish({ seed: 2, house: 'ordos', opponents: [{ house: 'ordos' }, { house: 'harkonnen' }, { house: 'harkonnen' }] });
  assert.deepEqual(opponents, ['atreides', 'harkonnen', 'sardaukar']);
  assert.deepEqual(setupSkirmish({ seed: 2, house: 'ordos', opponents: [{ house: 'fremen' }] }).opponents, ['atreides'], 'the Fremen hold no base');
  const old = setupSkirmish({ seed: 2, house: 'atreides', enemy: 'ordos', difficulty: 'hard' });
  assert.deepEqual(old.opponents, ['ordos'], 'the old enemy argument still works');
  assert.equal(old.world.houses.get('ordos').brain.difficulty, 'hard');
});

test('a small map holds three bases at most; the set-up caps the opponents', () => {
  assert.deepEqual([48, 64, 96, 128].map(maxOpponents), [2, 3, 3, 3]);
  const { opponents, starts } = setupSkirmish({ seed: 2, size: 48, opponents: [{ house: 'harkonnen' }, { house: 'ordos' }, { house: 'sardaukar' }] });
  assert.deepEqual(opponents, ['harkonnen', 'ordos']);
  assert.equal(starts.length, 3);
});

test('tech level and worms reach the world: every house gets the tech level', () => {
  const { world } = setupSkirmish({ seed: 2, techLevel: 4, worms: 'many', opponents: [{ house: 'harkonnen' }, { house: 'ordos' }] });
  assert.deepEqual([...world.houses.values()].map((h) => h.techLevel), [4, 4, 4]);
  assert.equal(world.rules.worms, 'many');
  assert.equal(setupSkirmish({ seed: 2, worms: 'off' }).world.rules.worms, 'off');
  assert.equal(setupSkirmish({ seed: 2 }).world.rules.worms, 'off', 'code callers (scenes, tests) get no worms unless they ask');
  assert.equal(setupSkirmish({ seed: 2, worms: 'plenty' }).world.rules.worms, 'off');
  const fromUrl = (q) => setupSkirmish(skirmishOptions(readParams(q))).world.rules.worms;
  assert.deepEqual([fromUrl('?scene=skirmish&seed=2'), fromUrl('?scene=skirmish&seed=2&worms=plenty'), fromUrl('?scene=skirmish&seed=2&worms=many')], ['few', 'few', 'many'],
    'a battle URL is a player\'s skirmish: few worms unless it says otherwise');
  assert.equal(setupSkirmish({ seed: 2 }).world.houses.get('atreides').techLevel, 9);
  assert.equal(setupSkirmish({ seed: 2, techLevel: 0 }).world.houses.get('atreides').techLevel, 9, 'out of range: everything');
});

test('opponents travel in the battle URL as house:difficulty pairs', () => {
  const list = [{ house: 'harkonnen', difficulty: 'hard' }, { house: 'ordos', difficulty: 'normal' }];
  assert.equal(formatOpponents(list), 'harkonnen:hard,ordos:normal');
  assert.deepEqual(parseOpponents('harkonnen:hard,ordos:normal'), list);
  assert.deepEqual(parseOpponents('mercenary,sardaukar:easy', 'hard'), [{ house: 'mercenary', difficulty: 'hard' }, { house: 'sardaukar', difficulty: 'easy' }]);
  assert.deepEqual(parseOpponents('harkonnen:insane'), [{ house: 'harkonnen', difficulty: 'normal' }]);
  assert.deepEqual(parseOpponents(''), []);
  assert.deepEqual(parseOpponents(null), []);
});
