import test from 'node:test';
import assert from 'node:assert/strict';
import { G, SURFACE, moveFactor } from '../src/data/terrain.js';
import { UNITS, MOVE, onFoot } from '../src/data/units.js';
import { DRIVE_ANGLE } from '../src/data/tuning.js';
import { destroyStructure } from '../src/sim/combat.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { flatWorld, runUntil } from './helpers.mjs';

test('only a Saboteur walks over walls, at full speed; other buildings stop it like anyone', () => {
  assert.equal(moveFactor(SURFACE.WALL, 'saboteur'), 255);
  for (const cls of ['foot', 'tracked', 'harvester', 'wheeled', 'worm']) assert.equal(moveFactor(SURFACE.WALL, cls), 0, cls);
  assert.equal(moveFactor(SURFACE.WALL, 'air'), 255);
  assert.equal(moveFactor(SURFACE.BLOCKED, 'saboteur'), 0);
  for (const s of ['SAND', 'DUNE', 'ROCK', 'MOUNTAIN', 'SPICE', 'CONCRETE', 'RUBBLE']) assert.equal(moveFactor(SURFACE[s], 'saboteur'), moveFactor(SURFACE[s], 'foot'), s);
  assert.equal(UNITS.saboteur.move, MOVE.SABOTEUR);
  assert.equal(UNITS.saboteur.builtAt, null, 'the Palace sends it; no factory builds it');
  assert.equal(DRIVE_ANGLE.saboteur, DRIVE_ANGLE.foot);
  assert.ok(onFoot(MOVE.SABOTEUR) && onFoot(MOVE.FOOT) && !onFoot(MOVE.TRACKED) && !onFoot(undefined));
});

test('the map knows where walls stand and forgets them when they fall', () => {
  const world = flatWorld(12, 12);
  const wall = world.spawnStructure('wall', 'atreides', 5, 5);
  const i = world.map.idx(5, 5);
  assert.equal(world.map.surface(i), SURFACE.WALL);
  world.spawnStructure('windtrap', 'atreides', 1, 1);
  assert.equal(world.map.surface(world.map.idx(1, 1)), SURFACE.BLOCKED);
  world.removeStructure(wall, 'destroyed');
  assert.equal(world.map.wall[i], 0);
  assert.equal(world.map.surface(i), SURFACE.ROCK);
});

test('a Saboteur crosses a wall line that stops infantry', () => {
  const world = flatWorld(16, 12);
  for (let y = 0; y < 12; y++) world.spawnStructure('wall', 'harkonnen', 8, y);
  const sab = world.spawnUnit('saboteur', 'ordos', 4, 5);
  const soldier = world.spawnUnit('soldier', 'ordos', 4, 7);
  world.issue('ordos', { type: 'move', ids: [sab.id, soldier.id], x: 12, y: 6 });
  assert.ok(runUntil(world, () => sab.tx >= 11 && sab.order.type === 'idle', 30) > 0, 'the Saboteur got through');
  assert.ok(soldier.tx < 8, 'the soldier stays on its side');
});

test('a wall that falls under a Saboteur leaves it standing where it was', () => {
  const world = flatWorld(12, 8);
  const wall = world.spawnStructure('wall', 'harkonnen', 6, 3);
  const sab = world.spawnUnit('saboteur', 'ordos', 3, 3);
  world.issue('ordos', { type: 'move', ids: [sab.id], x: 6, y: 3 });
  assert.ok(runUntil(world, () => sab.tx === 6 && sab.order.type === 'idle', 15) > 0, 'on top of the wall');
  destroyStructure(world, wall);
  assert.deepEqual(checkInvariants(world), []);
  world.issue('ordos', { type: 'move', ids: [sab.id], x: 9, y: 3 });
  assert.ok(runUntil(world, () => sab.tx === 9, 15) > 0, 'and walks on');
});

test('tracks crush a Saboteur like any foot soldier', () => {
  const world = flatWorld(24, 16, G.ROCK);
  const m = world.map;
  for (let x = 4; x <= 8; x++) for (let y = 0; y < 16; y++) if (y !== 8) m.ground[m.idx(x, y)] = G.MOUNTAIN;   // a one-tile pass
  m.revision++;
  const sab = world.spawnUnit('saboteur', 'ordos', 6, 8);
  const mcv = world.spawnUnit('mcv', 'harkonnen', 2, 8, { heading: 0 });
  world.issue('harkonnen', { type: 'move', ids: [mcv.id], x: 12, y: 8 });
  let crushed = false;
  runUntil(world, () => (crushed ||= world.events.drain().some((e) => e.type === 'unitDestroyed' && e.id === sab.id && e.cause === 'crushed')), 30);
  assert.ok(crushed);
});
