// The Sega Mega Drive tech ladder (phase 3 C10; research.md §6): with world.rules.tech === 'sega' a house builds
// what the Mega Drive campaign offers at mission house.techLevel; without the rule nothing changes (skirmish).
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { UNITS } from '../src/data/units.js';
import { SEGA_STRUCTURES, ORDOS_TROOPERS_AT } from '../src/data/sega-tech.js';
import { buildOptions, canBuild, upgradeId, upgradeCost, upgradeResult, upgradeUnlocks, segaUpgrades, segaOpens, factoryOf, unitUpgrade, applyTechRules, STRUCTURE_ORDER, UNIT_ORDER, UPGRADE_ORDER } from '../src/sim/tech.js';
import { createBrain } from '../src/sim/ai.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { flatWorld, run } from './helpers.mjs';

const HOUSES = ['atreides', 'ordos', 'harkonnen'];

/** A Sega world in which `houseId` (at mission `n`) owns `types`, laid out on a 6-wide grid of 5-tile cells. */
function segaWorld(houseId, n, types, upgrades = null) {
  const world = flatWorld(48, 48, G.ROCK);
  world.rules.tech = 'sega';
  const h = world.houses.get(houseId) ?? world.addHouse(houseId);
  h.techLevel = n;
  h.credits = 20000;
  h.startBuffer = 100000;
  if (upgrades) h.upgrades = { ...upgrades };
  types.forEach((t, k) => world.spawnStructure(t, houseId, 2 + (k % 6) * 6, 2 + Math.floor(k / 6) * 6));
  return { world, h };
}

// The first mission of each structure per house (research.md §6 "Genesis tech"); absent = never on the Sega ladder.
const FIRST = {
  atreides:  { concrete4: 1, windtrap: 1, refinery: 1, outpost: 2, silo: 2, barracks: 2, heavyFactory: 2, wall: 4, hiTech: 5, repair: 5, turret: 5, rocketTurret: 6, starport: 6, palace: 8 },
  ordos:     { concrete4: 1, windtrap: 1, refinery: 1, outpost: 2, silo: 2, barracks: 2, heavyFactory: 2, wall: 4, hiTech: 5, repair: 5, turret: 5, rocketTurret: 6, starport: 6, palace: 8, ...(ORDOS_TROOPERS_AT === 'wor' ? { wor: 4 } : {}) },
  harkonnen: { concrete4: 1, windtrap: 1, refinery: 1, outpost: 2, silo: 2, wor: 2, heavyFactory: 3, wall: 4, hiTech: 5, repair: 5, turret: 5, rocketTurret: 6, starport: 6, palace: 8 },
};

test('structures open mission by mission as on the Mega Drive', () => {
  for (const house of HOUSES) {
    for (let n = 1; n <= 9; n++) {
      const { world } = segaWorld(house, n, ['constructionYard', 'windtrap', 'refinery', 'outpost', 'heavyFactory'], { constructionYard: 1 });
      const withPort = segaWorld(house, n, ['constructionYard', 'windtrap', 'refinery', 'outpost', 'starport']);
      for (const t of STRUCTURE_ORDER) {
        const w = t === 'palace' ? withPort.world : world;
        const want = (FIRST[house][t] ?? Infinity) <= n;
        assert.equal(canBuild(w, house, t), want, `${house} mission ${n} ${t}`);
      }
    }
  }
});

test('one 2x2 slab and no small one, no House of IX; the large slab needs no yard upgrade', () => {
  for (const house of HOUSES) {
    const { world } = segaWorld(house, 9, ['constructionYard', 'windtrap', 'refinery', 'outpost', 'starport']);
    assert.equal(canBuild(world, house, 'concrete'), false);
    assert.equal(canBuild(world, house, 'concrete4'), true);
    assert.equal(canBuild(world, house, 'ix'), false);
    assert.ok(!('ix' in SEGA_STRUCTURES) && !('concrete' in SEGA_STRUCTURES));
  }
});

// Units on sale by mission (research.md §6 "Units on sale per mission"), with every upgrade bought that the mission allows.
const UNITS_AT = {
  atreides:  { 2: ['soldier', 'infantry', 'trike'], 3: ['quad'], 4: ['harvester', 'combatTank', 'mcv'], 5: ['missileTank', 'carryall'], 6: ['siegeTank'], 7: ['sonicTank', 'ornithopter'] },
  ordos:     { 2: ['soldier', 'infantry', 'raider'], 3: ['quad'], 4: ['trooper', 'harvester', 'combatTank', 'mcv'], 5: ['carryall'], 6: ['troopers'], 7: ['siegeTank', 'deviator', 'ornithopter'] },
  harkonnen: { 2: ['trooper'], 3: ['quad'], 4: ['troopers', 'harvester', 'combatTank', 'mcv'], 5: ['missileTank', 'carryall'], 6: ['siegeTank'], 7: ['devastator'] },
};
const FACTORY_TYPES = ['barracks', 'wor', 'heavyFactory', 'hiTech'];

test('units on sale by mission follow the Mega Drive ladder', () => {
  for (const house of HOUSES) {
    const want = [];
    for (let n = 1; n <= 9; n++) {
      want.push(...(UNITS_AT[house][n] ?? []));
      const owned = ['constructionYard', 'windtrap', 'refinery', 'outpost', ...FACTORY_TYPES.filter((t) => (FIRST[house][t] ?? Infinity) <= n)];
      const { world } = segaWorld(house, n, owned, segaUpgrades(house, n));
      const o = buildOptions(world, house);
      const got = [...o.infantry, ...o.heavy, ...o.air];
      assert.deepEqual(new Set(got), new Set(want), `${house} mission ${n}: ${got.join(', ')}`);
      assert.deepEqual(o.upgrades, [], `${house} mission ${n}: nothing more to buy once the mission's upgrades are owned`);
    }
  }
});

// Upgrade prices in purchase order (research.md §6 "Upgrade ladder"); the Ordos skip the Missile Tank level.
const PRICES = {
  atreides:  { constructionYard: [200], barracks: [150], heavyFactory: [200, 200, 300, 300, 300], hiTech: [250] },
  ordos:     { constructionYard: [200], barracks: [150], heavyFactory: [200, 200, 300, 300], hiTech: [250], ...(ORDOS_TROOPERS_AT === 'wor' ? { wor: [200] } : {}) },
  harkonnen: { constructionYard: [200], wor: [200], heavyFactory: [200, 300, 300, 300] },
};

/** Buys every upgrade the house can at its mission, one after another; returns { prices, levels }. */
function buyAll(world, h) {
  const prices = {};
  for (let guard = 0; guard < 40; guard++) {
    const type = UPGRADE_ORDER.find((t) => canBuild(world, h.id, upgradeId(t)));
    if (!type) break;
    (prices[type] ??= []).push(upgradeCost(h, type));
    h.upgrades[type] = upgradeResult(h, type);
  }
  return prices;
}

test('factory upgrades cost what the Mega Drive asks, and each mission opens its levels', () => {
  for (const house of HOUSES) {
    const all = ['constructionYard', 'windtrap', 'refinery', 'outpost', ...FACTORY_TYPES.filter((t) => FIRST[house][t])];
    const { world, h } = segaWorld(house, 9, all);
    assert.deepEqual(buyAll(world, h), PRICES[house], house);
    for (let n = 1; n <= 9; n++) {
      const step = segaWorld(house, n, all);
      buyAll(step.world, step.h);
      assert.deepEqual(step.h.upgrades, segaUpgrades(house, n), `${house} mission ${n}`);
    }
  }
  assert.deepEqual(segaUpgrades('harkonnen', 1), { heavyFactory: 1 }, 'the Harkonnen factory comes with the Quad');
  assert.equal(segaUpgrades('harkonnen', 9).hiTech, undefined, 'the Harkonnen never get the Ornithopter');
});

test('the yard upgrade opens the Rocket Turret; the upgrade tooltip names what the Sega level opens', () => {
  const { world, h } = segaWorld('atreides', 6, ['constructionYard', 'windtrap', 'refinery', 'outpost', 'heavyFactory']);
  assert.equal(canBuild(world, 'atreides', 'rocketTurret'), false);
  assert.equal(canBuild(world, 'atreides', upgradeId('constructionYard')), true);
  assert.deepEqual(upgradeUnlocks(h, 'constructionYard', 0, 1), ['Rocket Turret']);
  assert.deepEqual(upgradeUnlocks(h, 'heavyFactory', 1, 2), ['Harvester', 'Combat Tank']);
  assert.deepEqual(upgradeUnlocks(h, 'heavyFactory', 2, 3), ['MCV']);
  h.upgrades.constructionYard = 1;
  assert.equal(canBuild(world, 'atreides', 'rocketTurret'), true);
  assert.equal(canBuild(world, 'atreides', upgradeId('constructionYard')), false, 'the yard has one level on the Mega Drive');
});

test('special tanks and the Ornithopter come from the Hi-Tech Factory, from mission 7', () => {
  const specials = { atreides: 'sonicTank', harkonnen: 'devastator', ordos: 'deviator' };
  for (const house of HOUSES) {
    const base = ['constructionYard', 'windtrap', 'refinery', 'outpost', 'heavyFactory'];
    assert.equal(canBuild(segaWorld(house, 7, base).world, house, specials[house]), false, `${house} without a Hi-Tech`);
    assert.equal(canBuild(segaWorld(house, 6, [...base, 'hiTech']).world, house, specials[house]), false, `${house} at mission 6`);
    assert.equal(canBuild(segaWorld(house, 7, [...base, 'hiTech']).world, house, specials[house]), true, `${house} at mission 7`);
    const air = segaWorld(house, 7, [...base, 'hiTech'], { hiTech: 1 });
    assert.equal(canBuild(air.world, house, 'ornithopter'), house !== 'harkonnen', `${house} Ornithopter`);
  }
});

test('the Emperor\'s troops: every structure but IX, no MCV', () => {
  const { world } = segaWorld('sardaukar', 9, ['constructionYard', 'windtrap', 'refinery', 'outpost', 'barracks', 'wor', 'heavyFactory', 'hiTech'], segaUpgrades('sardaukar', 9));
  const o = buildOptions(world, 'sardaukar');
  assert.ok(o.structure.includes('palace') === false && o.structure.includes('starport'), o.structure.join());
  assert.ok(!o.structure.includes('ix') && !o.structure.includes('concrete'));
  assert.ok(!o.heavy.includes('mcv'), o.heavy.join());
  assert.ok(o.heavy.includes('siegeTank') && o.infantry.includes('troopers') && o.air.includes('ornithopter'), JSON.stringify(o));
});

test('factoryOf and unitUpgrade follow the ladder in use', () => {
  const { world, h } = segaWorld('ordos', 6, ['constructionYard']);
  applyTechRules(world);
  assert.equal(factoryOf(h, 'trooper'), ORDOS_TROOPERS_AT);
  assert.equal(factoryOf(h, 'quad'), 'heavyFactory');
  assert.equal(unitUpgrade(h, 'mcv'), 3);
  const plain = flatWorld(16, 16, G.ROCK).houses.get('ordos');
  assert.equal(factoryOf(plain, 'trooper'), 'wor');
  assert.equal(unitUpgrade(plain, 'mcv'), UNITS.mcv.upgrade);
});

test('what each mission opens, for the briefing', () => {
  assert.deepEqual(segaOpens(1, 'atreides'), ['Wind Trap', 'Spice Refinery', 'Large Concrete Slab']);
  assert.ok(segaOpens(2, 'atreides').includes('Barracks') && segaOpens(2, 'atreides').includes('Trike'));
  assert.ok(segaOpens(3, 'harkonnen').includes('Heavy Factory') && segaOpens(3, 'harkonnen').includes('Quad'));
  assert.ok(segaOpens(7, 'ordos').includes('Deviator') && segaOpens(7, 'ordos').includes('Ornithopter'));
  assert.ok(segaOpens(8, 'harkonnen').includes('Palace'));
  for (let n = 1; n <= 9; n++) for (const house of HOUSES) assert.ok(!segaOpens(n, house).includes('House of IX'));
});

test('skirmish worlds keep the PC tree: no rule, no Sega marks', () => {
  const world = flatWorld(48, 48, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 5000;
  for (const [k, t] of ['constructionYard', 'windtrap', 'refinery', 'outpost', 'starport'].entries()) world.spawnStructure(t, 'atreides', 2 + k * 6, 2);
  assert.equal(canBuild(world, 'atreides', 'concrete'), true);
  assert.equal(canBuild(world, 'atreides', 'ix'), true);
  assert.equal(canBuild(world, 'atreides', 'concrete4'), false, 'the PC large slab needs the yard upgrade');
  assert.equal(h.techRules, undefined);
  assert.equal(factoryOf(h, 'trooper'), 'wor');
});

test('an Ordos computer on the Sega ladder builds and buys only what its mission offers', () => {
  const { world, h } = segaWorld('ordos', 4, ['constructionYard', 'windtrap', 'windtrap', 'refinery', 'outpost', 'barracks', 'heavyFactory', 'windtrap'], segaUpgrades('ordos', 4));
  h.credits = 4000;
  createBrain(world, 'ordos', 'hard');
  const built = new Set();
  const placed = new Set();
  const wrap = world.events.push.bind(world.events);
  world.events.push = (type, data) => {
    if (type === 'unitBuilt' && data.house === 'ordos') built.add(data.unitType);
    if (type === 'structurePlaced' && data.house === 'ordos' && world.tick > 0) placed.add(data.structureType);
    return wrap(type, data);
  };
  run(world, 300);
  assert.deepEqual(checkInvariants(world), []);
  const allowedUnits = new Set(Object.entries(UNITS_AT.ordos).filter(([n]) => n <= 4).flatMap(([, list]) => list));
  for (const t of built) assert.ok(allowedUnits.has(t), `built ${t}`);
  for (const t of placed) assert.ok((FIRST.ordos[t] ?? Infinity) <= 4, `placed ${t}`);
  assert.ok(built.size > 0, 'the computer built units');
  for (const line of ['infantry', 'heavy']) {
    const cur = h.lines[line].current;
    assert.ok(!cur || cur.progress < 1, `${line} line not stuck on ${cur?.typeId}`);
  }
});

test('an Ordos Trooper ordered on the Sega ladder leaves its factory', () => {
  const types = ['constructionYard', 'windtrap', 'refinery', 'outpost', 'barracks', ...(ORDOS_TROOPERS_AT === 'wor' ? ['wor'] : [])];
  const { world } = segaWorld('ordos', 4, types, segaUpgrades('ordos', 4));
  world.issue('ordos', { type: 'build', typeId: 'trooper' });
  run(world, 60);
  assert.ok([...world.units.values()].some((u) => u.house === 'ordos' && u.typeId === 'trooper'));
});

test('every structure and unit of the Sega ladder exists in the data', () => {
  for (const t of Object.keys(SEGA_STRUCTURES)) assert.ok(STRUCTURE_ORDER.includes(t), t);
  for (const t of UNIT_ORDER) if (UNITS[t].builtAt) assert.ok(t in UNITS);
});
