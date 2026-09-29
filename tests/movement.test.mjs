import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

test('a tank drives to its destination and holds only that tile', () => {
  const world = flatWorld();
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 5, { heading: 0 });
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 12, y: 5 });
  const t = runUntil(world, () => tank.order.type === 'idle' && tank.tx === 12, 20);
  assert.ok(t > 8 && t < 11, `took ${t}s (10 tiles at ~1.08 tiles/s)`);
  assert.equal(world.map.unit[world.map.idx(12, 5)], tank.id);
  assert.equal(world.map.unit[world.map.idx(2, 5)], 0);
  assert.equal(tank.x, 12.5);
  assert.equal(tank.y, 5.5);
});

test('tracked vehicles turn on the spot before driving', () => {
  const world = flatWorld();
  const tank = world.spawnUnit('combatTank', 'atreides', 10, 5, { heading: 0 });
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 2, y: 5 });
  world.step();
  world.step();
  assert.equal(tank.x, 10.5, 'still on its tile while turning');
  assert.notEqual(tank.heading, 0);
  assert.ok(runUntil(world, () => tank.order.type === 'idle', 20) > 0);
  assert.equal(tank.tx, 2);
});

test('a group order spreads units over distinct nearby tiles', () => {
  const world = flatWorld(30, 30, G.SAND);
  const ids = [];
  for (let k = 0; k < 20; k++) ids.push(world.spawnUnit('quad', 'harkonnen', 2 + (k % 5), 2 + Math.floor(k / 5)).id);
  world.issue('harkonnen', { type: 'move', ids, x: 20, y: 20 });
  world.step();   // the command applies on the next tick
  const t = runUntil(world, () => ids.every((id) => world.units.get(id).order.type === 'idle'), 60);
  assert.ok(t > 0, 'every unit settled');
  const units = ids.map((id) => world.units.get(id));
  assert.equal(new Set(units.map((u) => `${u.tx},${u.ty}`)).size, 20);
  for (const u of units) assert.ok(Math.max(Math.abs(u.tx - 20), Math.abs(u.ty - 20)) <= 5, `unit at ${u.tx},${u.ty}`);
});

test('an unreachable target sends the unit to the nearest reachable tile', () => {
  const world = flatWorld(20, 20, G.ROCK);
  const m = world.map;
  for (let y = 8; y <= 12; y++) for (let x = 8; x <= 12; x++) if (x === 8 || x === 12 || y === 8 || y === 12) m.ground[m.idx(x, y)] = G.MOUNTAIN;
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 10, { heading: 0 });
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 10, y: 10 });
  world.step();
  assert.ok(runUntil(world, () => tank.order.type === 'idle', 30) > 0);
  assert.deepEqual([tank.tx, tank.ty], [7, 10]);
});

test('two tanks meeting head-on in a one-tile corridor never overlap and settle', () => {
  const world = flatWorld(20, 7, G.MOUNTAIN);
  const m = world.map;
  for (let x = 0; x < 20; x++) m.ground[m.idx(x, 3)] = G.ROCK;
  const a = world.spawnUnit('combatTank', 'atreides', 2, 3, { heading: 0 });
  const b = world.spawnUnit('combatTank', 'atreides', 17, 3, { heading: Math.PI });
  world.issue('atreides', { type: 'move', ids: [a.id], x: 17, y: 3 });
  world.issue('atreides', { type: 'move', ids: [b.id], x: 2, y: 3 });
  let minGap = Infinity;
  for (let i = 0; i < 20 * 20; i++) {
    world.step();
    minGap = Math.min(minGap, Math.hypot(a.x - b.x, a.y - b.y));
  }
  assert.ok(minGap >= 0.5, `closest approach ${minGap}`);
  assert.equal(a.order.type, 'idle');
  assert.equal(b.order.type, 'idle');
});

test('occupancy stays consistent under crossing traffic', () => {
  const world = flatWorld(24, 24, G.SAND, 3);
  const west = [], east = [];
  for (let k = 0; k < 6; k++) {
    west.push(world.spawnUnit('quad', 'atreides', 1, 4 + k * 2).id);
    east.push(world.spawnUnit('combatTank', 'atreides', 22, 4 + k * 2, { heading: Math.PI }).id);
  }
  world.issue('atreides', { type: 'move', ids: west, x: 21, y: 12 });
  world.issue('atreides', { type: 'move', ids: east, x: 2, y: 12 });
  for (let i = 0; i < 20 * 60; i++) {
    world.step();
    const held = new Map();
    for (const id of world.map.unit) if (id) held.set(id, (held.get(id) ?? 0) + 1);
    for (const u of world.units.values()) {
      const n = held.get(u.id) ?? 0;
      assert.ok(n >= 1 && n <= 2, `unit ${u.id} holds ${n} tiles at tick ${world.tick}`);
      assert.ok(world.map.unit[world.map.idx(u.tx, u.ty)] === u.id || (u.step && u.step.released), `unit ${u.id} lost its tile`);
      assert.ok(Number.isFinite(u.x) && Number.isFinite(u.y));
    }
  }
  for (const u of world.units.values()) assert.equal(u.order.type, 'idle', `unit ${u.id} still ${u.order.type}`);
});

test('same seed and commands give identical results', () => {
  const once = () => {
    const world = flatWorld(24, 24, G.SAND, 9);
    const ids = [];
    for (let k = 0; k < 8; k++) ids.push(world.spawnUnit('quad', 'atreides', 1 + k, 1).id);
    world.issue('atreides', { type: 'move', ids, x: 18, y: 18 });
    world.issue('atreides', { type: 'scatter', ids: ids.slice(0, 3) });
    run(world, 15);
    return ids.map((id) => { const u = world.units.get(id); return [u.x, u.y, u.heading]; });
  };
  assert.deepEqual(once(), once());
});

test('a unit re-plans when a structure appears on its path', () => {
  const world = flatWorld(24, 12, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 1, 5, { heading: 0 });
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 20, y: 5 });
  run(world, 1);
  world.spawnStructure('windtrap', 'harkonnen', 10, 4);
  assert.ok(runUntil(world, () => tank.order.type === 'idle', 40) > 0);
  assert.deepEqual([tank.tx, tank.ty], [20, 5]);
});

test('two units meeting head-on in open ground get past each other', () => {
  const world = flatWorld(20, 16, G.ROCK);
  const a = world.spawnUnit('combatTank', 'atreides', 4, 7, { heading: 0 });
  const b = world.spawnUnit('combatTank', 'atreides', 9, 7, { heading: Math.PI });
  world.issue('atreides', { type: 'move', ids: [a.id], x: 9, y: 7 });
  world.issue('atreides', { type: 'move', ids: [b.id], x: 4, y: 7 });
  world.step();
  const t = runUntil(world, () => a.order.type === 'idle' && b.order.type === 'idle', 120);
  assert.ok(t > 0 && t < 30, `settled after ${t} s`);
  assert.ok(Math.max(Math.abs(a.tx - 9), Math.abs(a.ty - 7)) <= 1, `a at ${a.tx},${a.ty}`);
  assert.ok(Math.max(Math.abs(b.tx - 4), Math.abs(b.ty - 7)) <= 1, `b at ${b.tx},${b.ty}`);
});

test('two units meeting head-on in a two-lane pass get past each other', () => {
  const world = flatWorld(20, 20, G.ROCK);
  const m = world.map;
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) if (x !== 9 && x !== 10) m.ground[m.idx(x, y)] = G.MOUNTAIN;
  m.revision++;
  const a = world.spawnUnit('combatTank', 'atreides', 9, 3);
  const b = world.spawnUnit('combatTank', 'atreides', 9, 12);
  world.issue('atreides', { type: 'move', ids: [a.id], x: 9, y: 14 });
  world.issue('atreides', { type: 'move', ids: [b.id], x: 9, y: 1 });
  world.step();
  const t = runUntil(world, () => a.order.type === 'idle' && b.order.type === 'idle', 120);
  assert.ok(t > 0 && t < 40, `settled after ${t} s`);
  assert.ok(a.ty >= 13 && b.ty <= 2, `a at ${a.tx},${a.ty}; b at ${b.tx},${b.ty}`);
});
