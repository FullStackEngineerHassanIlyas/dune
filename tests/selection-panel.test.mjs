import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { Selection } from '../src/input/selection.js';
import { selectionPanelModel } from '../src/ui/selection-panel.js';
import { flatWorld } from './helpers.mjs';

test('a single harvester shows its load and what it is doing, with a Return button', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.spawnUnit('harvester', 'atreides', 5, 5);
  h.harvest.load = 350;
  h.harvest.state = 'harvesting';
  const sel = new Selection();
  sel.set([h.id]);
  const m = selectionPanelModel(world, sel, 'atreides');
  assert.deepEqual([m.kind, m.name, m.own, m.count], ['unit', 'Harvester', true, 1]);
  assert.deepEqual(m.details, ['Spice 50 %', 'Harvesting']);
  assert.deepEqual(m.buttons.map((b) => b.id), ['stop', 'guard', 'scatter', 'return']);
});

test('a group sums hit points and counts its types; enemies get no buttons', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const a = world.spawnUnit('combatTank', 'atreides', 3, 3);
  const b = world.spawnUnit('combatTank', 'atreides', 5, 3);
  const t = world.spawnUnit('mcv', 'atreides', 7, 3);
  a.hp = 100;
  const sel = new Selection();
  sel.set([a.id, b.id, t.id]);
  const m = selectionPanelModel(world, sel, 'atreides');
  assert.deepEqual([m.kind, m.count, m.hp, m.maxHp], ['group', 3, 100 + 200 + 150, 200 + 200 + 150]);
  assert.deepEqual(m.details, ['2 × Combat Tank', '1 × MCV']);
  assert.deepEqual(m.buttons.map((x) => x.id), ['stop', 'guard', 'scatter', 'deploy']);
  const enemy = world.spawnUnit('quad', 'harkonnen', 12, 12);
  sel.set([enemy.id]);
  assert.deepEqual(selectionPanelModel(world, sel, 'atreides').buttons, []);
});

test('an own factory offers Repair, Sell and Set primary', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const lf = world.spawnStructure('lightFactory', 'atreides', 4, 4);
  const sel = new Selection();
  sel.setStructure(lf.id);
  let m = selectionPanelModel(world, sel, 'atreides');
  assert.deepEqual(m.buttons.map((b) => b.id), ['repair', 'sell', 'primary']);
  assert.equal(m.buttons[0].disabled, true, 'nothing to repair');
  lf.primary = true;
  lf.hp = 100;
  lf.rally = { x: 9, y: 9 };
  m = selectionPanelModel(world, sel, 'atreides');
  assert.deepEqual(m.buttons.map((b) => b.id), ['repair', 'sell']);
  assert.equal(m.buttons[0].disabled, false);
  assert.deepEqual(m.details, ['Power use 20', 'Primary factory', 'Rally point set']);
  assert.equal(selectionPanelModel(world, new Selection(), 'atreides'), null);
});

test('a damaged wind trap reports its reduced output', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const trap = world.spawnStructure('windtrap', 'atreides', 4, 4);
  trap.hp = trap.maxHp / 2;
  trap.repairing = true;
  const sel = new Selection();
  sel.setStructure(trap.id);
  const m = selectionPanelModel(world, sel, 'atreides');
  assert.deepEqual(m.details, ['Power output 50', 'Repairing']);
  assert.deepEqual([m.buttons[0].label, m.buttons[0].active], ['Stop repair', true]);
});

test('a harvester sent elsewhere shows its order, not the paused routine', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.spawnUnit('harvester', 'atreides', 5, 5);
  h.harvest.load = 700;
  h.harvest.state = 'harvesting';
  h.order = { type: 'move', x: 12, y: 12 };
  const sel = new Selection();
  sel.set([h.id]);
  assert.deepEqual(selectionPanelModel(world, sel, 'atreides').details, ['Spice 100 %', 'Moving']);
});

test('an enemy structure shows only its name and hit points', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const trap = world.spawnStructure('refinery', 'harkonnen', 4, 4);
  const sel = new Selection();
  sel.setStructure(trap.id);
  const m = selectionPanelModel(world, sel, 'atreides');
  assert.deepEqual([m.own, m.name, m.details, m.buttons], [false, 'Spice Refinery', [], []]);
});
