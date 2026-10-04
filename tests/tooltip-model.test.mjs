// The build tooltips (C&C 3 style): what each icon's card says, from the house's prices, the line's speed, the
// ladder in use and the effectiveness table.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { sidebarModel } from '../src/ui/sidebar-model.js';
import { tooltipModel, missingFor, statusLine, typeFacts, compactFacts, lineSpeedText } from '../src/ui/tooltip-model.js';
import { flatWorld, run } from './helpers.mjs';

function base(houseId = 'atreides', types = ['constructionYard', 'windtrap']) {
  const world = flatWorld(48, 48, G.ROCK);
  const h = world.houses.get(houseId);
  h.credits = 5000;
  h.startBuffer = 100000;
  types.forEach((t, k) => world.spawnStructure(t, houseId, 2 + (k % 6) * 7, 2 + Math.floor(k / 6) * 6));
  run(world, 0.5);   // the house's power is counted every half second
  return { world, h };
}

function segaBase(houseId, mission, types, upgrades = {}) {
  const world = flatWorld(48, 48, G.ROCK);
  world.rules.tech = 'sega';
  const h = world.houses.get(houseId);
  h.techLevel = mission;
  h.credits = 5000;
  h.startBuffer = 100000;
  h.upgrades = { ...upgrades };
  types.forEach((t, k) => world.spawnStructure(t, houseId, 2 + (k % 6) * 7, 2 + Math.floor(k / 6) * 6));
  run(world, 0.5);   // the house's power is counted every half second
  return { world, h };
}

const itemOf = (world, houseId, typeId) => {
  const m = sidebarModel(world, houseId);
  return [...m.structures, ...m.units].find((i) => i.typeId === typeId);
};
const tipOf = (world, houseId, typeId) => tooltipModel(world, houseId, itemOf(world, houseId, typeId));
const list = (tip, label) => tip.lists.find((l) => l.label === label)?.items.map((x) => (x.needs.length ? `${x.name} (${x.needs.join(', ')})` : x.name));

test('a structure: price, build time, power with the base after it, storage, size and what it leads to', () => {
  const { world } = base();
  const t = tipOf(world, 'atreides', 'outpost');
  assert.deepEqual([t.kind, t.name, t.role, t.cost.value, t.time.seconds], ['structure', 'Radar Outpost', 'Radar: the map, while the power holds', 400, 24]);
  assert.deepEqual(t.stats.map((s) => [s.label, s.value]), [['Power', '−30'], ['Hit points', '500'], ['Size', '2×2']]);
  assert.equal(t.stats[0].note, 'then 30 of 100 in use');
  assert.deepEqual(list(t, 'Leads to'), ['Barracks', 'Wall', 'Gun Turret', 'Hi-Tech Factory (Heavy Factory)', 'Repair Facility (Heavy Factory)', 'Rocket Turret (Construction Yard level 2)']);
  assert.deepEqual(t.needs, []);
  const refinery = tipOf(world, 'atreides', 'refinery');
  assert.deepEqual(refinery.stats.find((s) => s.label === 'Storage').value, '1005 credits');
  assert.ok(refinery.abilities.includes('Comes with a free Harvester'));
  const wind = tipOf(world, 'atreides', 'windtrap');
  assert.deepEqual([wind.stats[0].value, wind.stats[0].tone], ['+100', 'good']);
});

test('a structure that would overload the power says so', () => {
  const { world } = base('atreides', ['constructionYard', 'windtrap', 'refinery', 'outpost']);
  const t = tipOf(world, 'atreides', 'heavyFactory');
  assert.deepEqual([t.stats[0].note, t.stats[0].tone], ['then 95 of 100 in use', null]);
  world.spawnStructure('silo', 'atreides', 30, 30);
  world.spawnStructure('silo', 'atreides', 34, 30);
  const over = tipOf(world, 'atreides', 'heavyFactory');
  assert.deepEqual([over.stats[0].note, over.stats[0].tone], ['then 105 of 100 in use — low power', 'bad']);
});

test('a unit: hit points, speed, class, sight, weapon, strong and weak, abilities — and the line\'s speed', () => {
  const { world } = base('atreides', ['constructionYard', 'windtrap', 'refinery', 'heavyFactory']);
  let t = tipOf(world, 'atreides', 'combatTank');
  assert.deepEqual([t.kind, t.cost.value, t.time.seconds], ['unit', 300, 29]);
  assert.deepEqual(t.time.notes, [{ text: 'Another Heavy Factory builds 25 % faster', tone: null }]);
  assert.deepEqual(t.stats.map((s) => [s.label, s.value]), [['Hit points', '200'], ['Class', 'Tracked'], ['Sight', '4 tiles'], ['Speed', '0.8 sand · 1.1 rock']]);
  assert.deepEqual([t.weapon.name, t.weapon.text], ['Cannon', '25 damage · range 4 · reload 2.0 s']);
  assert.deepEqual(t.weapon.tags, ['Always hits', 'Fires on the move']);
  assert.ok(t.strong.includes('Infantry') && t.strong.includes('Tanks'), `${t.strong}`);
  assert.ok(t.weak.includes('Aircraft'), `${t.weak}`);
  assert.ok(t.abilities.includes('Crushes infantry'));
  world.spawnStructure('heavyFactory', 'atreides', 30, 30);
  run(world, 0.5);
  t = tipOf(world, 'atreides', 'combatTank');
  assert.deepEqual([t.time.seconds, t.time.notes[0]], [23, { text: '2 Heavy Factories: 25 % faster', tone: 'good' }], 'more factories, quicker (spec §4.5)');
  for (const [x, y] of [[30, 36], [36, 36], [36, 42]]) world.spawnStructure('heavyFactory', 'atreides', x, y);
  run(world, 0.5);
  t = tipOf(world, 'atreides', 'combatTank');
  assert.deepEqual([t.time.seconds, t.time.notes[0].text], [30, '5 Heavy Factories: 100 % faster (the most)'], 'twice the speed at most …');
  assert.deepEqual(t.time.notes[1], { text: 'Low power: 49 % speed', tone: 'bad' }, '… but five factories outrun one Wind Trap: 205 used, 100 made');
  for (const [x, y] of [[2, 20], [9, 20], [16, 20]]) world.spawnStructure('windtrap', 'atreides', x, y);
  run(world, 0.5);
  t = tipOf(world, 'atreides', 'combatTank');
  assert.deepEqual([t.time.seconds, t.time.notes.length], [14, 1], 'powered up: twice the speed');
});

test('special abilities and the unarmed', () => {
  const facts = (id) => typeFacts(id).abilities.join(' | ');
  assert.match(facts('infantry'), /Captures buildings below 25 % health/);
  assert.match(facts('mcv'), /Deploys into a Construction Yard/);
  assert.match(facts('devastator'), /self-destruct/);
  assert.match(facts('deviator'), /fight for you for 40 s — not aircraft, Harvesters, MCVs, Deviators/);
  assert.match(facts('sonicTank'), /never Sonic Tanks/);
  assert.match(facts('carryall'), /Flies over everything/);
  assert.match(facts('trike'), /Explodes when destroyed: 30 damage around/);
  assert.equal(typeFacts('harvester').unarmed, true);
  assert.deepEqual(typeFacts('missileTank').weapon.tags, ['2 shots above half health', 'Anti-air', 'Scatters', 'Fires on the move']);
  assert.deepEqual(typeFacts('trooper').weapon.tags, ['Anti-air', 'Scatters beyond 2 tiles']);
  assert.equal(typeFacts('trooper').weapon.text, '5 damage, 4 beyond 2 tiles · range 5 · reload 1.3 s');
  assert.equal(typeFacts('rocketTurret').weapon.text, '30 damage · range 8 · reload 3.0 s · Gun 20 within 3 tiles');
  assert.equal(typeFacts('quad'), typeFacts('quad'), 'worked out once per type');
});

test('an upgrade: its level, price and what it opens, with what those still need', () => {
  const { world, h } = base('atreides', ['constructionYard', 'windtrap', 'windtrap', 'refinery', 'heavyFactory', 'outpost', 'hiTech']);
  const t = tipOf(world, 'atreides', 'upgrade:heavyFactory');
  assert.deepEqual([t.kind, t.cost.value, t.time.seconds, t.role], ['upgrade', 200, 5, 'All your Heavy Factories to level 1 of 4']);
  assert.deepEqual(t.lists, [{ label: 'Level 1 opens', items: [{ id: 'quad', name: 'Quad', needs: [] }] }]);
  const air = tipOf(world, 'atreides', 'upgrade:hiTech');
  assert.deepEqual([air.cost.value, list(air, 'Level 1 opens')], [250, ['Ornithopter (House of IX)']], 'the Ornithopter also waits for the House of IX');
  h.upgrades.heavyFactory = 2;
  assert.deepEqual(list(tipOf(world, 'atreides', 'upgrade:heavyFactory'), 'Level 3 opens'), ['Missile Tank']);
});

test('a factory lists what it builds now and what waits for its levels', () => {
  const { world } = base('atreides', ['constructionYard', 'windtrap', 'refinery']);
  const t = tipOf(world, 'atreides', 'heavyFactory');
  assert.deepEqual(list(t, 'Builds'), ['Trike', 'Harvester', 'Combat Tank', 'Quad (level 1)', 'MCV (level 2)', 'Missile Tank (level 3)', 'Siege Tank (level 4)', 'Sonic Tank (House of IX)']);
  assert.deepEqual(list(t, 'Leads to'), ['Hi-Tech Factory (Radar Outpost)', 'Repair Facility (Radar Outpost)']);
  assert.ok(t.abilities.includes('Each extra one builds 25 % faster, up to twice the speed'));
});

test('missing requirements, by name and level', () => {
  const { world, h } = base();
  assert.deepEqual(missingFor(world, 'atreides', 'hiTech'), ['Heavy Factory', 'Radar Outpost']);
  assert.deepEqual(missingFor(world, 'atreides', 'rocketTurret'), ['Radar Outpost', 'Construction Yard level 2']);
  assert.deepEqual(missingFor(world, 'atreides', 'siegeTank'), ['Heavy Factory level 4']);
  assert.deepEqual(missingFor(world, 'atreides', 'ornithopter'), ['Hi-Tech Factory level 1', 'House of IX']);
  assert.deepEqual(missingFor(world, 'atreides', 'upgrade:hiTech'), ['Hi-Tech Factory']);
  h.upgrades.heavyFactory = 4;
  assert.deepEqual(missingFor(world, 'atreides', 'siegeTank'), ['Heavy Factory']);
  const t = tooltipModel(world, 'atreides', { typeId: 'hiTech', line: 'structure', icon: 'hiTech', name: 'Hi-Tech Factory', cost: 500, state: 'idle', progress: 0, count: 0 });
  assert.deepEqual(t.needs, ['Heavy Factory', 'Radar Outpost'], 'an item the house cannot build yet says what it lacks');
  assert.deepEqual(tipOf(world, 'atreides', 'windtrap').needs, [], 'what is on the strip lacks nothing');
});

test('on the Sega ladder: its prices, levels and unlocks, and nothing beyond the mission', () => {
  let { world } = segaBase('atreides', 4, ['constructionYard', 'windtrap', 'refinery', 'heavyFactory', 'outpost']);
  assert.equal(tipOf(world, 'atreides', 'concrete4').cost.value, 15, 'the Sega slab');
  const up = tipOf(world, 'atreides', 'upgrade:heavyFactory');
  assert.deepEqual([up.cost.value, up.role, list(up, 'Level 1 opens')], [200, 'All your Heavy Factories to level 1 of 5', ['Quad']]);
  const hf = tipOf(world, 'atreides', 'heavyFactory');
  assert.deepEqual(list(hf, 'Builds'), ['Trike', 'Quad (level 1)', 'Harvester (level 2)', 'Combat Tank (level 2)', 'MCV (level 3)'], 'mission 4: no Missile Tank yet');
  assert.equal(tipOf(world, 'atreides', 'outpost').lists[0].items.some((x) => x.id === 'hiTech'), false, 'no Hi-Tech Factory before mission 5');
  ({ world } = segaBase('atreides', 6, ['constructionYard', 'windtrap', 'refinery', 'heavyFactory', 'outpost'], { heavyFactory: 2 }));
  assert.deepEqual(list(tipOf(world, 'atreides', 'heavyFactory'), 'Builds'), ['Trike', 'Quad', 'Harvester', 'Combat Tank', 'MCV (level 3)', 'Missile Tank (level 4)', 'Siege Tank (level 5)']);
  assert.deepEqual(list(tipOf(world, 'atreides', 'upgrade:constructionYard'), 'Level 1 opens'), ['Rocket Turret'], 'the yard\'s one Sega level');
  assert.ok(list(tipOf(world, 'atreides', 'outpost'), 'Leads to').includes('Rocket Turret (Construction Yard level 1)'));
  assert.deepEqual(missingFor(world, 'atreides', 'sonicTank'), ['Hi-Tech Factory'], 'the Sega specials come from the Hi-Tech Factory, not the House of IX');
});

test('a Starport ware: today\'s price against the list price, and the Frigate', () => {
  const { world, h } = base('atreides', ['windtrap', 'starport']);
  h.starport.price.quad = 160;
  const t = tipOf(world, 'atreides', 'starport:quad');
  assert.deepEqual([t.kind, t.name, t.cost.value, t.cost.note], ['ware', 'Quad', 160, '-20 % on the list price of 200']);
  assert.deepEqual([t.time.seconds, t.time.label], [30, 'Delivery']);
  assert.equal(t.weapon.name, 'Machine gun');
  assert.match(statusLine(itemOf(world, 'atreides', 'starport:quad')), /^Starport · \d+ in stock · click to order$/);
});

test('the Palace weapon: what it does and its recharge, at the Sega pace in a campaign', () => {
  const { world } = base('harkonnen', ['windtrap', 'palace']);
  const sp = sidebarModel(world, 'harkonnen').special;
  let t = tooltipModel(world, 'harkonnen', sp);
  assert.deepEqual([t.kind, t.name, t.time.seconds, t.time.label], ['weapon', 'Death Hand', 420, 'Recharge']);
  assert.ok(t.abilities.includes('Bursts in 17 blasts of up to 150 damage'));
  world.rules.tech = 'sega';
  t = tooltipModel(world, 'harkonnen', sp);
  assert.equal(t.time.seconds, 690);
  const fremen = base('atreides', ['windtrap', 'palace']);
  const f = tooltipModel(fremen.world, 'atreides', sidebarModel(fremen.world, 'atreides').special);
  assert.ok(f.abilities[0] === '5 squads rise within 8 tiles of the chosen spot' && f.strong.includes('Aircraft'), 'the Fremen fight as a Trooper Squad');
});

test('the state line says what the icon is doing, with the time left at the line\'s speed', () => {
  const { world, h } = base('atreides', ['constructionYard', 'windtrap', 'refinery', 'heavyFactory']);
  assert.equal(statusLine(itemOf(world, 'atreides', 'trike')), 'Click to build · Shift + click for five');
  assert.equal(statusLine(itemOf(world, 'atreides', 'upgrade:heavyFactory')), 'Click to upgrade');
  world.issue('atreides', { type: 'build', typeId: 'trike', count: 3 });
  world.issue('atreides', { type: 'build', typeId: 'silo' });
  run(world, 4.6);
  const trike = itemOf(world, 'atreides', 'trike');
  assert.equal(statusLine(trike, tooltipModel(world, 'atreides', trike)), 'Building 25 % · 14 s left · 2 more on order');
  assert.equal(statusLine(itemOf(world, 'atreides', 'windtrap')), 'Waits for the Construction Yard');
  run(world, 6);
  assert.equal(statusLine(itemOf(world, 'atreides', 'silo')), 'Ready — click to place');
  h.credits = 0;
  run(world, 1);
  assert.match(statusLine(itemOf(world, 'atreides', 'trike')), /^Waiting for credits at \d+ %/);
});

test('the selection panel\'s compact facts and a factory\'s build speed', () => {
  assert.deepEqual(compactFacts('combatTank').map((f) => [f.label, f.text]), [['Cannon', '25 dmg · range 4 · reload 2.0 s'], ['Strong', typeFacts('combatTank').strong.join(', ')], ['Weak', typeFacts('combatTank').weak.join(', ')]]);
  assert.deepEqual(compactFacts('harvester'), []);
  assert.ok(Object.isFrozen(compactFacts('quad')), 'shared between frames');
  const { world } = base('atreides', ['constructionYard', 'windtrap', 'refinery', 'heavyFactory']);
  assert.equal(lineSpeedText(world, 'atreides', 'heavyFactory'), '100 % · another one adds 25 %');
  assert.equal(lineSpeedText(world, 'atreides', 'constructionYard'), null);
  world.spawnStructure('heavyFactory', 'atreides', 30, 30);
  run(world, 0.5);
  assert.equal(lineSpeedText(world, 'atreides', 'heavyFactory'), '125 % · 2 on this line');
});
