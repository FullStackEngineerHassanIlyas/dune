// Mission set-up (spec §7, C1): a def becomes the same world every time — houses, prebuilt bases before units,
// concrete, standing orders, computer brains, allied computer houses — with no Carryall flying in at t = 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { PALACE } from '../src/data/tuning.js';
import { setupMission, sampleMission } from '../src/game/mission-setup.js';
import { friendly } from '../src/sim/alliance.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { tinyDef, setup } from './missions-helpers.mjs';
import { run } from './helpers.mjs';

const snapshot = (world) => JSON.stringify({
  units: [...world.units.values()].map((u) => [u.id, u.typeId, u.house, Math.round(u.x * 100), Math.round(u.y * 100), u.order.type, u.hp]),
  structures: [...world.structures.values()].map((s) => [s.id, s.typeId, s.house, s.x, s.y, s.hp]),
  credits: [...world.houses.values()].map((h) => [h.id, Math.round(h.credits)]),
  tick: world.tick,
});

test('the same def and seed make the same world, and it runs the same', () => {
  const a = setup(), b = setup();
  assert.deepEqual(a.problems, []);
  assert.equal(snapshot(a.world), snapshot(b.world));
  run(a.world, 60);
  run(b.world, 60);
  assert.equal(snapshot(a.world), snapshot(b.world));
  const c = setup({}, { seed: 99 });
  assert.notEqual(Buffer.from(c.world.map.ground).toString('base64'), Buffer.from(a.world.map.ground).toString('base64'), 'a seed= in the address makes another map');
});

test('houses get the def\'s credits, tech level and upgrades; the rules are the mission\'s', () => {
  const { world, house } = setup({ player: { ...tinyDef().player, credits: 777, upgrades: { heavyFactory: 1 } } });
  assert.equal(house, 'atreides');
  const p = world.houses.get('atreides'), h = world.houses.get('harkonnen');
  assert.deepEqual([p.credits, p.techLevel, p.isAI, p.upgrades.heavyFactory], [777, 3, false, 1]);
  assert.deepEqual([h.credits, h.techLevel, h.isAI], [0, 3, true]);
  assert.deepEqual(world.rules, { victory: false, airDelivery: true, worms: 'off', tech: 'sega' });
  assert.equal(world.visibility, 'shroud');
  assert.ok(world.houses.get('atreides').fog, 'the shroud is drawn before the first frame');
  assert.ok(world.mission, 'the mission rides on the world');
});

test('prebuilt bases stand on rock; the Refinery\'s Harvester waits at its dock and nothing is announced', () => {
  const { world, problems } = setup();
  assert.deepEqual(problems, []);
  const map = world.map;
  for (const s of world.structures.values()) for (let dy = 0; dy < s.h; dy++) for (let dx = 0; dx < s.w; dx++) assert.equal(map.ground[map.idx(s.x + dx, s.y + dy)], G.ROCK, `${s.typeId} on rock`);
  assert.equal([...world.units.values()].filter((u) => u.typeId === 'carryall').length, 0, 'no Carryall at t = 0');
  const harvesters = [...world.units.values()].filter((u) => u.typeId === 'harvester');
  assert.equal(harvesters.length, 1);
  assert.ok(!harvesters[0].inside);
  const events = world.events.drain();
  assert.ok(!events.some((e) => e.type === 'eva'), 'no "Harvester deployed" at the start');
  assert.ok(events.some((e) => e.type === 'structurePlaced'), 'the battle stage still hears of every building');
  assert.deepEqual(checkInvariants(world), []);
  assert.equal(map.concrete[map.idx(6, 19)], world.houses.get('atreides').slot + 1, 'the slabs are down');
});

test('a prebuilt Palace starts charging from the start', () => {
  const def = tinyDef();
  def.player = { ...def.player, structures: [...def.player.structures, { type: 'palace', x: 11, y: 18 }] };
  const { world, problems } = setupMission(def);
  assert.deepEqual(problems, []);
  const palace = [...world.structures.values()].find((s) => s.typeId === 'palace');
  assert.equal(palace.readyAt, PALACE.recharge.fremen);
});

test('the mission\'s Starport sells what the def stocks and nothing else', () => {
  const def = tinyDef({ techLevel: 6, starport: { stock: { quad: 3, combatTank: 1, sonicTank: 2 } } });   // the Sega Starport opens at mission 6
  def.player = { ...def.player, structures: [...def.player.structures, { type: 'starport', x: 11, y: 18 }] };
  const { world, problems } = setupMission(def);
  assert.deepEqual(problems, []);
  run(world, 0.1);
  const m = world.houses.get('atreides').starport;
  assert.deepEqual(m.stock, { quad: 3, combatTank: 1 }, 'only wares the house can buy');
  assert.deepEqual(Object.keys(m.price).sort(), ['combatTank', 'quad']);
  const plain = setup({ techLevel: 6 });
  plain.world.spawnStructure('starport', 'atreides', 11, 18);
  run(plain.world, 0.1);
  assert.ok(Object.keys(plain.world.houses.get('atreides').starport.stock).length > 2, 'without a stock list the market is the usual one');
});

test('computer units take their standing orders; the player\'s stand idle', () => {
  const def = tinyDef();
  def.houses = [{ ...def.houses[0], units: [
    { type: 'combatTank', x: 20, y: 12, order: 'guard' }, { type: 'quad', x: 18, y: 12, order: 'areaGuard' },
    { type: 'troopers', x: 16, y: 14, order: 'ambush' }, { type: 'trike', x: 15, y: 10, order: 'hunt' }, { type: 'harvester', x: 24, y: 11, order: 'guard' }] }];
  const { world } = setupMission(def);
  const of = (type) => [...world.units.values()].find((u) => u.house === 'harkonnen' && u.typeId === type);
  assert.deepEqual([of('combatTank').order.type, of('combatTank').garrison], ['guard', true]);
  assert.deepEqual([of('quad').order.radius, of('quad').order.leash], [6, 12]);
  assert.deepEqual([of('troopers').order.type, of('troopers').order.radius, of('troopers').order.leash], ['guard', 0, 0]);
  assert.deepEqual([of('trike').order.type, !!of('trike').garrison], ['idle', false]);
  assert.equal(of('harvester').order.type, 'harvest', 'a harvester harvests whatever it was told');
  for (const u of world.units.values()) if (u.house === 'atreides' && u.typeId !== 'harvester') assert.equal(u.order.type, 'idle');
});

test('every computer house is allied with every other, and none with the player', () => {
  const def = tinyDef();
  def.houses = [...def.houses, { id: 'ordos', credits: 0, techLevel: 3, ai: { difficulty: 'easy', passive: true }, structures: [{ type: 'constructionYard', x: 24, y: 24 }], units: [] },
    { id: 'sardaukar', credits: 0, techLevel: 3, ai: { difficulty: 'hard', passive: true }, structures: [], units: [] }];
  const { world, problems } = setupMission(def);
  assert.deepEqual(problems, []);
  assert.ok(friendly(world, 'harkonnen', 'ordos') && friendly(world, 'ordos', 'sardaukar'));
  assert.ok(!friendly(world, 'atreides', 'harkonnen') && !friendly(world, 'atreides', 'sardaukar'));
  assert.equal(world.houses.get('sardaukar').brain.params.passive, true, 'the mission\'s AI parameters reach the brain');
});

test('a unit on a taken tile moves to the nearest free one; a bad entry is reported, not fatal', () => {
  const def = tinyDef();
  def.player = { ...def.player, units: [...def.player.units, { type: 'quad', x: 11, y: 22 }, { type: 'bogus', x: 2, y: 2 }],
    structures: [...def.player.structures, { type: 'windtrap', x: 6, y: 21 }] };
  const { world, problems } = setupMission(def);
  assert.equal(problems.length, 2, problems.join('; '));
  assert.equal([...world.units.values()].filter((u) => u.house === 'atreides' && u.typeId === 'quad').length, 2);
  assert.deepEqual(checkInvariants(world), []);
});

test('the sample mission sets up cleanly for every house and plays two minutes without a problem', () => {
  for (const house of ['atreides', 'harkonnen', 'ordos']) {
    const { world, problems } = setupMission(sampleMission(house));
    assert.deepEqual(problems, [], house);
    run(world, 120);
    assert.deepEqual(checkInvariants(world), [], house);
    assert.equal(world.outcome, null, `${house}: nothing decided yet`);
  }
});
