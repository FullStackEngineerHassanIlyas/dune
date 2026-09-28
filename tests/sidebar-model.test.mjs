import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { sidebarModel, powerLevel, rollCredits } from '../src/ui/sidebar-model.js';
import { flatWorld, run } from './helpers.mjs';

function base() {
  const world = flatWorld(32, 32, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 1000;
  h.startBuffer = 100000;
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  return { world, h };
}

function factories(world) {
  world.spawnStructure('windtrap', 'atreides', 8, 4);
  world.spawnStructure('refinery', 'atreides', 4, 8);
  world.spawnStructure('lightFactory', 'atreides', 10, 8);
}

test('the strips list what the house can build, in display order', () => {
  const { world } = base();
  let m = sidebarModel(world, 'atreides');
  assert.deepEqual(m.structures.map((i) => i.typeId), ['concrete', 'windtrap', 'concrete4']);
  assert.deepEqual(m.units, []);
  factories(world);
  m = sidebarModel(world, 'atreides');
  assert.deepEqual(m.units.map((i) => i.typeId), ['trike', 'quad']);
  const wt = m.structures.find((i) => i.typeId === 'windtrap');
  assert.deepEqual([wt.name, wt.cost, wt.seconds, wt.line, wt.state], ['Wind Trap', 300, 22, 'structure', 'idle']);
});

test('icons carry production state, progress and queue counts', () => {
  const { world } = base();
  factories(world);
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  world.issue('atreides', { type: 'build', typeId: 'trike', count: 3 });
  run(world, 5);
  const m = sidebarModel(world, 'atreides');
  const wt = m.structures.find((i) => i.typeId === 'windtrap');
  assert.equal(wt.state, 'building');
  assert.ok(wt.progress > 0.2 && wt.progress < 0.25, `progress ${wt.progress}`);
  assert.equal(m.structures.find((i) => i.typeId === 'concrete').state, 'locked', 'the yard is busy');
  const trike = m.units.find((i) => i.typeId === 'trike');
  assert.deepEqual([trike.state, trike.count], ['building', 3]);
  assert.equal(m.units.find((i) => i.typeId === 'quad').state, 'idle');
  world.issue('atreides', { type: 'hold', typeId: 'windtrap' });
  world.step();
  assert.equal(sidebarModel(world, 'atreides').structures.find((i) => i.typeId === 'windtrap').state, 'hold');
});

test('the sidebar reads storage, power and radar without touching the house', () => {
  const { world, h } = base();
  h.startBuffer = 500;
  factories(world);
  const m = sidebarModel(world, 'atreides');
  assert.equal(m.storage, 1005);
  assert.equal(h.startBuffer, 500, 'revoking the start buffer is the simulation\'s business');
  assert.deepEqual([m.power.produced, m.power.used, m.power.level], [100, 50, 'ok']);
  assert.equal(m.radar, false, 'no outpost');
  assert.equal(m.credits, 1000);
});

test('power level: green when production covers use, amber when short, red below half', () => {
  assert.equal(powerLevel({ produced: 100, used: 100 }), 'ok');
  assert.equal(powerLevel({ produced: 100, used: 150 }), 'low');
  assert.equal(powerLevel({ produced: 100, used: 201 }), 'critical');
  assert.equal(powerLevel({ produced: 0, used: 0 }), 'ok');
});

test('credits roll towards the target and settle within about a second', () => {
  let shown = 0;
  for (let k = 0; k < 90; k++) shown = rollCredits(shown, 2000, 0.016);
  assert.equal(shown, 2000);
  shown = rollCredits(2000, 1990, 0.016);
  assert.ok(shown < 2000 && shown >= 1990);
});
