// Alliances (spec §7; research §6): a campaign mission allies every computer house with every other against the
// player, as the original did; a skirmish stays a free-for-all. One predicate (sim/alliance.js) decides it everywhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { friendly, hostile, setAlliances } from '../src/sim/alliance.js';
import { findTarget, damage, destroyStructure } from '../src/sim/combat.js';
import { sizeUpRivals, nearestEnemyTarget, richestTarget, createBrain } from '../src/sim/ai.js';
import { deviate } from '../src/sim/specials.js';
import { orderCapture } from '../src/sim/capture.js';
import { updateFog, structureVisibleTo } from '../src/sim/fog.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

const tough = (u) => { u.hp = u.maxHp = 100000; return u; };
const allied = () => { const world = flatWorld(32, 20, G.ROCK); setAlliances(world, [['harkonnen', 'ordos']]); return world; };

test('without alliances only a house is its own friend: the skirmish free-for-all', () => {
  const world = flatWorld(24, 16, G.ROCK);
  assert.equal(world.teams, null);
  assert.ok(friendly(world, 'harkonnen', 'harkonnen'));
  assert.ok(hostile(world, 'harkonnen', 'ordos'));
  assert.ok(hostile(world, 'atreides', 'ordos'));
  world.spawnUnit('combatTank', 'harkonnen', 5, 8);
  const quad = world.spawnUnit('quad', 'ordos', 8, 8);
  assert.deepEqual(findTarget(world, 'harkonnen', 5.5, 8.5, 6, { ignoreFog: true }), { kind: 'unit', id: quad.id });
});

test('allied houses are friends both ways, and the player stays everyone\'s enemy', () => {
  const world = allied();
  assert.ok(friendly(world, 'harkonnen', 'ordos') && friendly(world, 'ordos', 'harkonnen'));
  assert.ok(hostile(world, 'atreides', 'harkonnen') && hostile(world, 'ordos', 'atreides'));
  assert.ok(hostile(world, 'harkonnen', 'sardaukar'), 'a house outside every team fights alone');
});

test('allied units and turrets never pick each other, and both fire on the player', () => {
  const world = allied();
  const tank = tough(world.spawnUnit('combatTank', 'harkonnen', 5, 8, { heading: 0 }));
  const quad = tough(world.spawnUnit('quad', 'ordos', 7, 8, { heading: Math.PI }));
  const turret = world.spawnStructure('turret', 'harkonnen', 9, 9);
  run(world, 6);
  const shots = world.events.drain().filter((e) => e.type === 'fired');
  assert.equal(shots.length, 0, 'nobody fired on a friend');
  assert.equal(tank.target, null);
  assert.equal(turret.target, null);
  const intruder = tough(world.spawnUnit('combatTank', 'atreides', 9, 7));
  run(world, 4);
  const fired = world.events.drain().filter((e) => e.type === 'fired');
  for (const id of [tank.id, quad.id, turret.id]) assert.ok(fired.some((e) => e.id === id), `${id} fired at the player`);
  assert.ok(intruder.hp < intruder.maxHp);
});

test('an attack order on an ally is refused unless forced', () => {
  const world = allied();
  const tank = world.spawnUnit('combatTank', 'harkonnen', 5, 8);
  const quad = world.spawnUnit('quad', 'ordos', 9, 8);
  world.issue('harkonnen', { type: 'attack', ids: [tank.id], targetKind: 'unit', targetId: quad.id });
  run(world, 0.1);
  assert.notEqual(tank.order.type, 'attack');
  world.issue('harkonnen', { type: 'attack', ids: [tank.id], targetKind: 'unit', targetId: quad.id, force: true });
  run(world, 0.1);
  assert.equal(tank.order.type, 'attack');
});

test('a stray hit from an ally is not answered, not announced and not counted as a kill', () => {
  const world = allied();
  const quad = world.spawnUnit('quad', 'ordos', 9, 8);
  const yard = world.spawnStructure('constructionYard', 'ordos', 12, 12);
  world.events.drain();
  damage(world, quad, 5, { house: 'harkonnen', id: 999, kind: 'unit' });
  damage(world, yard, 5, { house: 'harkonnen', id: 999, kind: 'unit' });
  assert.equal(quad.order.type, 'idle', 'no retaliation against a friend');
  assert.ok(!world.events.drain().some((e) => e.type === 'eva'), 'no "base under attack" for a friend\'s stray shot');
  destroyStructure(world, yard, { house: 'harkonnen', id: 999, kind: 'unit' });
  assert.equal(world.houses.get('harkonnen').stats.structuresKilled, 0);
  assert.equal(world.houses.get('ordos').stats.structuresLost, 1);
});

test('tracks do not crush allied infantry', () => {
  const world = allied();
  const tank = world.spawnUnit('combatTank', 'harkonnen', 4, 8, { heading: 0 });
  const men = world.spawnUnit('infantry', 'ordos', 6, 8);
  world.issue('harkonnen', { type: 'move', ids: [tank.id], x: 9, y: 8 });
  run(world, 8);
  assert.ok(world.units.has(men.id), 'the friend was not run over');
});

test('Deviator gas leaves allies alone; infantry cannot capture a friend\'s building', () => {
  const world = allied();
  const quad = world.spawnUnit('quad', 'ordos', 9, 8);
  const foe = world.spawnUnit('quad', 'atreides', 10, 8);
  deviate(world, { house: 'harkonnen', x: 9.5, y: 8.5 });
  assert.equal(quad.house, 'ordos');
  assert.equal(foe.house, 'harkonnen');
  const silo = world.spawnStructure('silo', 'ordos', 14, 4);
  silo.hp = 1;
  const men = world.spawnUnit('infantry', 'harkonnen', 13, 6);
  orderCapture(world, 'harkonnen', [men], silo.id);
  assert.notEqual(men.order.type, 'capture');
});

test('the AI sizes up only its enemies: allies are no rivals, no target and no intruders', () => {
  const world = allied();
  world.spawnStructure('constructionYard', 'harkonnen', 2, 2);
  world.spawnStructure('constructionYard', 'ordos', 6, 2);
  world.spawnStructure('constructionYard', 'atreides', 26, 14);
  world.spawnUnit('combatTank', 'ordos', 4, 6);
  assert.deepEqual(sizeUpRivals(world, 'harkonnen', { x: 3, y: 3 }).map((r) => r.house), ['atreides']);
  const t = nearestEnemyTarget(world, 'harkonnen', 3, 3);
  assert.ok(t.x >= 26, 'the nearest target is the player\'s, not the ally next door');
  const rich = richestTarget(world, 'harkonnen');
  assert.ok(rich.x >= 26);
  createBrain(world, 'harkonnen', 'normal');
  run(world, 3);
  assert.equal(world.houses.get('harkonnen').brain.grudge, undefined, 'an allied tank by the base is no intruder');
});

test('allies share their sight; a free-for-all does not', () => {
  const world = allied();
  world.visibility = 'shroud';
  const silo = world.spawnStructure('silo', 'ordos', 28, 16);
  updateFog(world);
  assert.ok(structureVisibleTo(world, 'harkonnen', silo));
  assert.ok(!structureVisibleTo(world, 'atreides', silo));
  assert.equal(world.houses.get('harkonnen').fog.visible[17 * 32 + 29], 1, 'what the ally sees, the house sees');
});

test('a skirmish between allies ends when only one side stands', () => {
  const world = flatWorld(32, 16, G.ROCK);
  setAlliances(world, [['harkonnen', 'ordos']]);
  world.rules.victory = true;
  const a = world.spawnStructure('constructionYard', 'atreides', 2, 2);
  world.spawnStructure('constructionYard', 'harkonnen', 26, 2);
  world.spawnStructure('constructionYard', 'ordos', 26, 10);
  run(world, 1);
  assert.equal(world.outcome, null);
  destroyStructure(world, a, null);
  assert.ok(runUntil(world, () => world.outcome, 2) >= 0);
  assert.ok(['harkonnen', 'ordos'].includes(world.outcome.winner));
  assert.deepEqual([...world.outcome.standing].sort(), ['harkonnen', 'ordos']);
});
