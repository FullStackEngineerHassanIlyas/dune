// A mission's reinforcement schedule (spec §7; research §1-2: Carryall drops at the home or the enemy base, or
// units driving in from an edge) and the computer units' standing orders (guard, area guard, ambush, hunt).
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupMission } from '../src/game/mission-setup.js';
import { edgePoint } from '../src/sim/air.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { friendly, hostile } from '../src/sim/alliance.js';
import { tinyDef, setup, evas } from './missions-helpers.mjs';
import { run, runUntil } from './helpers.mjs';

const carryalls = (world, house) => [...world.units.values()].filter((u) => u.typeId === 'carryall' && u.house === house);
const yard = (world, house) => [...world.structures.values()].find((s) => s.house === house && s.typeId === 'constructionYard');

test('edgePoint: a named side level with the target, else the nearest edge', () => {
  const map = { w: 32, h: 24 };
  assert.deepEqual(edgePoint(map, 'north', 10.6, 9), { x: 10, y: 0 });
  assert.deepEqual(edgePoint(map, 'south', 10, 9), { x: 10, y: 23 });
  assert.deepEqual(edgePoint(map, 'west', 10, 9), { x: 0, y: 9 });
  assert.deepEqual(edgePoint(map, 'east', 10, 9), { x: 31, y: 9 });
  assert.deepEqual(edgePoint(map, undefined, 29, 12), { x: 31, y: 12 });
});

test('the player\'s reinforcements come by Carryall from the chosen side at their time and are announced once they are down', () => {
  const { world } = setup({ reinforcements: [{ house: 'atreides', units: ['combatTank', 'quad'], at: 10, via: 'carryall', to: 'home', from: 'north' }] });
  assert.deepEqual(world.mission.nextReinforcement(), { at: 10, units: ['combatTank', 'quad'], via: 'carryall' });
  run(world, 9.9);
  assert.equal(carryalls(world, 'atreides').length, 0, 'not before their time');
  world.events.drain();
  run(world, 0.3);
  const lifters = carryalls(world, 'atreides');
  assert.equal(lifters.length, 2, 'one Carryall for each unit');
  assert.ok(lifters.every((c) => c.visitor && c.cargo && c.ty <= 1), 'they come in over the north edge, loaded');
  assert.equal(world.mission.nextReinforcement(), null);
  const ids = lifters.map((c) => c.cargo);
  let said = [];
  const t = runUntil(world, () => { said.push(...evas(world.events.drain(), 'atreides', 'reinforcements')); return ids.every((id) => !world.units.get(id).inside); }, 30);
  assert.ok(t > 0, 'they were set down');
  run(world, 0.3);
  said.push(...evas(world.events.drain(), 'atreides', 'reinforcements'));
  assert.equal(said.length, 1, 'announced once');
  assert.equal(said[0].text, 'Reinforcements have arrived.');
  assert.ok(Number.isFinite(said[0].x) && Number.isFinite(said[0].y), 'with a place for Space to jump to');
  const units = ids.map((id) => world.units.get(id)), y = yard(world, 'atreides');
  assert.notEqual(`${units[0].tx},${units[0].ty}`, `${units[1].tx},${units[1].ty}`, 'each on its own tile');
  for (const u of units) {
    assert.equal(world.map.structure[world.map.idx(u.tx, u.ty)], 0, 'on free ground');
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) assert.equal(world.map.structure[world.map.idx(u.tx + dx, u.ty + dy)], 0, 'in the open, not squeezed between buildings');
    assert.ok(Math.hypot(u.tx - y.x, u.ty - y.y) < 10, 'at the base');
    assert.equal(u.order.type, 'idle', 'the player\'s to command');
  }
  run(world, 30);
  assert.equal(carryalls(world, 'atreides').length, 0, 'the Carryalls flew off');
  assert.deepEqual(checkInvariants(world), []);
});

test('the enemy\'s drops at home arrive quietly; the ones at the player\'s base hunt', () => {
  const { world } = setup({ reinforcements: [
    { house: 'harkonnen', units: ['troopers', 'troopers'], at: 5, via: 'carryall', to: 'home' },
    { house: 'harkonnen', units: ['quad'], at: 5, via: 'carryall', to: 'enemy', from: 'west' },
  ] });
  run(world, 5.3);
  const drop = carryalls(world, 'harkonnen').map((c) => world.units.get(c.cargo));
  assert.equal(drop.length, 3);
  const all = [];
  runUntil(world, () => { all.push(...world.events.drain()); return drop.every((u) => !world.units.get(u.id)?.inside); }, 40);
  run(world, 1.5);
  all.push(...world.events.drain());
  assert.equal(all.filter((e) => e.type === 'eva' && e.key === 'reinforcements').length, 0, 'nobody announces the enemy\'s');
  const home = yard(world, 'harkonnen'), base = yard(world, 'atreides');
  const [a, b, quad] = drop;
  for (const u of [a, b]) assert.ok(Math.hypot(u.tx - home.x, u.ty - home.y) < 10, 'the troopers came down at their base');
  assert.ok(Math.hypot(quad.tx - base.x, quad.ty - base.y) < 12, 'the quad came down by the player\'s base');
  assert.ok(['attackMove', 'attack'].includes(quad.order.type) || quad.target, `and hunts (${quad.order.type})`);
  assert.equal(world.mission.debug().hunters, 1);
});

test('units that drive in from an edge appear there at their time, head for the base and are announced', () => {
  const { world } = setup({ reinforcements: [{ house: 'atreides', units: ['trike', 'trike'], at: 8, via: 'edge', to: 'home', from: 'west' }] });
  run(world, 7.9);
  world.events.drain();
  run(world, 0.3);
  const trikes = [...world.units.values()].filter((u) => u.house === 'atreides' && u.typeId === 'trike');
  assert.equal(trikes.length, 2);
  assert.ok(trikes.every((u) => u.tx <= 1), 'on the west edge');
  run(world, 0.3);
  const said = evas(world.events.drain(), 'atreides', 'reinforcements');
  assert.equal(said.length, 1);
  assert.ok(trikes.every((u) => u.order.type === 'move'));
  run(world, 20);
  const y = yard(world, 'atreides');
  assert.ok(trikes.every((u) => Math.hypot(u.tx - y.x, u.ty - y.y) < 10), 'they drove to the base');
});

test('hunters go for the player; an ambush waits for the enemy to come into sight; guards go back to their posts', () => {
  const def = tinyDef();
  def.houses = [{ ...def.houses[0], units: [
    { type: 'trike', x: 16, y: 6, order: 'hunt' }, { type: 'troopers', x: 18, y: 14, order: 'ambush' }, { type: 'combatTank', x: 20, y: 12, order: 'guard' }] }];
  const { world } = setupMission(def);
  const of = (type) => [...world.units.values()].find((u) => u.house === 'harkonnen' && u.typeId === type);
  const hunter = of('trike'), ambush = of('troopers'), guard = of('combatTank');
  run(world, 1.5);
  assert.ok(['attackMove', 'attack'].includes(hunter.order.type), 'the hunter is off');
  run(world, 5);
  assert.deepEqual([ambush.tx, ambush.ty, ambush.order.type], [18, 14, 'guard'], 'the ambush lies still');
  const scout = world.spawnUnit('quad', 'atreides', 16, 18);
  run(world, 1.5);
  assert.ok(world.mission.debug().ambushes === 0, 'sprung by an enemy in sight');
  assert.ok(['attackMove', 'attack'].includes(ambush.order.type) || ambush.target, `the ambush hunts (${ambush.order.type})`);
  world.removeUnit(scout);
  guard.order = { type: 'idle' };   // as after chasing an intruder off
  guard.target = null;
  run(world, 1.5);
  assert.deepEqual([guard.order.type, guard.order.x, guard.order.y], ['guard', 20, 12], 'back on guard at its post');
});

test('a house named only in the reinforcements joins the computer side and its drop comes (the Sega\'s Sardaukar)', () => {
  const { world, problems } = setupMission(tinyDef({ reinforcements: [
    { house: 'sardaukar', units: ['troopers', 'troopers'], at: 5, via: 'carryall', to: 'enemy' },
    { house: 'sardaukar', units: ['troopers'], at: 5, via: 'carryall', to: 'home' },
  ] }));
  assert.deepEqual(problems, []);
  const sardaukar = world.houses.get('sardaukar');
  assert.ok(sardaukar?.isAI, 'a computer house');
  assert.equal(sardaukar.credits, 0);
  assert.ok(friendly(world, 'sardaukar', 'harkonnen') && hostile(world, 'sardaukar', 'atreides'), 'allied with the computer, against the player');
  run(world, 5.3);
  const drop = carryalls(world, 'sardaukar').map((c) => world.units.get(c.cargo));
  assert.equal(drop.length, 3);
  runUntil(world, () => drop.every((u) => !world.units.get(u.id)?.inside), 40);
  const [a, b, home] = drop, base = yard(world, 'atreides'), allies = yard(world, 'harkonnen');
  for (const u of [a, b]) assert.ok(Math.hypot(u.tx - base.x, u.ty - base.y) < 12, 'came down by the player\'s base');
  assert.ok(Math.hypot(home.tx - allies.x, home.ty - allies.y) < 10, '"home" for a house with no base is its allies\' base');
  assert.equal(world.mission.debug().pending, 0);
});

test('a reinforcement of an unknown house or of no known unit is skipped and reported', () => {
  const { world, problems } = setupMission(tinyDef({ reinforcements: [{ house: 'bogus', units: ['quad'], at: 1 }, { house: 'atreides', units: ['bogus'], at: 1 }] }));
  assert.equal(problems.length, 2, problems.join('; '));
  assert.ok(problems.some((p) => /bogus/.test(p) && /house/.test(p)) && problems.some((p) => /unknown unit bogus/.test(p)), problems.join('; '));
  run(world, 3);
  assert.equal(carryalls(world, 'atreides').length, 0);
  assert.equal(world.mission.debug().pending, 0);
});
