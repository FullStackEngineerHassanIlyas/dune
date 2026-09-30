import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOptions } from '../src/sim/tech.js';
import { flatWorld, run } from './helpers.mjs';

test('Destruct: three seconds of warning, then a blast where it stood and seven round it that spare nobody', () => {
  const world = flatWorld(16, 12);
  const dev = world.spawnUnit('devastator', 'harkonnen', 6, 6);
  const foe = world.spawnUnit('mcv', 'atreides', 7, 6);
  const friend = world.spawnUnit('mcv', 'harkonnen', 5, 6);
  world.issue('harkonnen', { type: 'destruct', ids: [dev.id] });
  run(world, 2.9);
  assert.ok(world.units.has(dev.id), 'still counting down');
  assert.equal(foe.hp, foe.maxHp);
  world.events.drain();
  run(world, 0.3);
  assert.ok(!world.units.has(dev.id));
  const events = world.events.drain();
  assert.ok(events.some((e) => e.type === 'unitDestroyed' && e.id === dev.id && e.cause === 'destructed'));
  assert.ok(events.filter((e) => e.type === 'explosion').length >= 8);
  assert.ok(foe.hp < foe.maxHp && friend.hp < friend.maxHp, 'friend and foe alike');
});

test('a Devastator counting down stops, holds its fire and takes no orders, not even to shoot back', () => {
  const world = flatWorld(16, 12);
  const dev = world.spawnUnit('devastator', 'harkonnen', 3, 6);
  world.issue('harkonnen', { type: 'move', ids: [dev.id], x: 12, y: 6 });
  run(world, 0.5);
  world.issue('harkonnen', { type: 'destruct', ids: [dev.id] });
  run(world, 0.1);
  assert.equal(dev.order.type, 'idle');
  assert.equal(dev.path.length, 0);
  world.spawnUnit('combatTank', 'atreides', 7, 6);
  world.issue('harkonnen', { type: 'move', ids: [dev.id], x: 1, y: 6 });
  world.events.drain();
  run(world, 2);
  assert.equal(dev.order.type, 'idle');
  assert.ok(!world.events.drain().some((e) => e.type === 'fired' && e.id === dev.id), 'it holds its fire');
});

test('D on a Devastator means Destruct; an MCV still deploys', () => {
  const world = flatWorld(16, 12);
  const dev = world.spawnUnit('devastator', 'harkonnen', 3, 6);
  world.spawnUnit('mcv', 'harkonnen', 10, 6);
  world.issue('harkonnen', { type: 'deploy', ids: [...world.units.keys()] });
  world.step();
  assert.ok(dev.destructAt > 0);
  assert.ok([...world.structures.values()].some((s) => s.typeId === 'constructionYard'));
});

test('the Devastator joins the Harkonnen roster once a House of IX stands', () => {
  const world = flatWorld(20, 20);
  world.spawnStructure('heavyFactory', 'harkonnen', 1, 1);
  world.spawnStructure('ix', 'harkonnen', 6, 1);
  assert.ok(buildOptions(world, 'harkonnen').heavy.includes('devastator'));
});
