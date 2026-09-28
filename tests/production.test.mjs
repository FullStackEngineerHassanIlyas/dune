import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

function base(house = 'atreides', credits = 5000) {
  const world = flatWorld(32, 32, G.ROCK);
  const h = world.houses.get(house);
  h.credits = credits;
  h.startBuffer = 100000;
  world.spawnStructure('constructionYard', house, 4, 4);
  return { world, h };
}
const powered = (world, house = 'atreides') => world.spawnStructure('windtrap', house, 0, 0);   // factories need power to run at full speed
const count = (world, typeId) => [...world.units.values()].filter((u) => u.typeId === typeId).length;

test('a Wind Trap takes 21.6 s and is paid progressively', () => {
  const { world, h } = base();
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  run(world, 10.8);
  assert.ok(Math.abs(h.credits - 4850) < 2, `credits ${h.credits}`);
  run(world, 11);
  assert.equal(h.lines.structure.current.state, 'ready');
  assert.ok(Math.abs(h.credits - 4700) < 1e-6);
  assert.ok(world.events.drain().some((e) => e.type === 'eva' && e.key === 'constructionComplete'));
});

test('insufficient funds stalls and resumes without going negative', () => {
  const { world, h } = base('atreides', 100);
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  run(world, 15);
  assert.ok(h.credits >= 0 && h.credits < 1, `credits ${h.credits}`);
  const stalled = h.lines.structure.current.progress;
  assert.ok(stalled > 0.3 && stalled < 0.36, `progress ${stalled}`);
  assert.equal(world.events.drain().filter((e) => e.key === 'insufficientFunds').length, 1);
  run(world, 5);
  assert.equal(h.lines.structure.current.progress, stalled);
  h.credits += 500;
  run(world, 16);
  assert.equal(h.lines.structure.current.state, 'ready');
});

test('hold then cancel refunds what was paid', () => {
  const { world, h } = base();
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  run(world, 5);
  world.issue('atreides', { type: 'hold', typeId: 'windtrap' });
  run(world, 1);
  const paid = h.lines.structure.current.paid;
  assert.ok(paid > 0 && Math.abs(5000 - h.credits - paid) < 1e-6);
  const before = h.credits;
  run(world, 3);
  assert.equal(h.credits, before, 'nothing is spent while on hold');
  world.issue('atreides', { type: 'hold', typeId: 'windtrap' });
  world.step();
  assert.equal(h.lines.structure.current, null);
  assert.ok(Math.abs(h.credits - 5000) < 1e-6);
});

test('the structure line refuses a second structure while one is in progress', () => {
  const { world, h } = base();
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  world.issue('atreides', { type: 'build', typeId: 'concrete' });
  world.step();
  assert.equal(h.lines.structure.current.typeId, 'windtrap');
  assert.ok(world.events.drain().some((e) => e.key === 'busy'));
});

test('placing on an invalid spot keeps the structure ready', () => {
  const { world, h } = base();
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  run(world, 22);
  world.issue('atreides', { type: 'place', typeId: 'windtrap', x: 20, y: 20 });
  world.step();
  assert.equal(h.lines.structure.current.state, 'ready');
  assert.ok(world.events.drain().some((e) => e.key === 'cannotPlace'));
  world.issue('atreides', { type: 'place', typeId: 'windtrap', x: 6, y: 4 });
  world.step();
  assert.equal(h.lines.structure.current, null);
  assert.ok([...world.structures.values()].some((s) => s.typeId === 'windtrap' && s.x === 6 && s.y === 4));
});

test('units leave by the factory\'s south side and drive to the rally point', () => {
  const { world } = base();
  powered(world);
  const lf = world.spawnStructure('lightFactory', 'atreides', 10, 10);
  world.issue('atreides', { type: 'setRally', structureId: lf.id, x: 11, y: 20 });
  world.issue('atreides', { type: 'build', typeId: 'trike' });
  run(world, 18.2);
  const trike = [...world.units.values()].find((u) => u.typeId === 'trike');
  assert.ok(trike, 'built after 18 s');
  assert.equal(trike.ty, 12);
  assert.ok(world.events.drain().some((e) => e.type === 'unitBuilt' && e.structureId === lf.id));
  run(world, 12);
  assert.ok(Math.max(Math.abs(trike.tx - 11), Math.abs(trike.ty - 20)) <= 1, `trike at ${trike.tx},${trike.ty}`);
});

test('the unit queue holds at most nine items', () => {
  const { world, h } = base();
  world.spawnStructure('barracks', 'atreides', 10, 10);
  world.issue('atreides', { type: 'build', typeId: 'soldier', count: 12 });
  world.step();
  assert.equal(1 + h.lines.infantry.queue.length, 9);
});

test('a second factory speeds its line up by a quarter; low power slows it to a quarter', () => {
  const time = (setup) => {
    const { world } = base();
    setup(world);
    world.issue('atreides', { type: 'build', typeId: 'soldier' });
    return runUntil(world, () => count(world, 'soldier') > 0, 70);
  };
  const one = time((w) => { powered(w); w.spawnStructure('barracks', 'atreides', 10, 10); });
  const two = time((w) => { powered(w); w.spawnStructure('barracks', 'atreides', 10, 10); w.spawnStructure('barracks', 'atreides', 14, 10); });
  const low = time((w) => { w.spawnStructure('barracks', 'atreides', 10, 10); for (let k = 0; k < 4; k++) w.spawnStructure('outpost', 'atreides', 2 + k * 3, 20); });
  assert.ok(Math.abs(one - 14.4) < 0.2, `one barracks ${one}`);
  assert.ok(Math.abs(two - 11.52) < 0.2, `two barracks ${two}`);
  assert.ok(low > 50 && low < 60, `low power ${low}`);
});

test('losing the factory refunds the item in progress', () => {
  const { world, h } = base();
  const b = world.spawnStructure('barracks', 'atreides', 10, 10);
  world.issue('atreides', { type: 'build', typeId: 'soldier' });
  run(world, 5);
  world.removeStructure(b);
  run(world, 1.1);
  assert.equal(h.lines.infantry.current, null);
  assert.ok(Math.abs(h.credits - 5000) < 1e-6);
});

test('items the house cannot build are rejected', () => {
  const { world, h } = base('harkonnen');
  world.issue('harkonnen', { type: 'build', typeId: 'barracks' });
  world.issue('harkonnen', { type: 'build', typeId: 'hiTech' });
  world.step();
  assert.equal(h.lines.structure.current, null);
  assert.equal(world.events.drain().filter((e) => e.type === 'commandRejected').length, 2);
});

test('primary factory is where new units appear', () => {
  const { world } = base();
  powered(world);
  world.spawnStructure('barracks', 'atreides', 10, 10);
  const second = world.spawnStructure('barracks', 'atreides', 20, 10);
  world.issue('atreides', { type: 'setPrimary', structureId: second.id });
  world.issue('atreides', { type: 'build', typeId: 'soldier' });
  runUntil(world, () => count(world, 'soldier') > 0, 20);
  const s = [...world.units.values()].find((u) => u.typeId === 'soldier');
  assert.ok(s.tx >= 20 && s.tx <= 21 && s.ty === 12, `soldier at ${s.tx},${s.ty}`);
});
