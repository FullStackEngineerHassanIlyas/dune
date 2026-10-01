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
  assert.deepEqual(m.details, ['Power use 20', 'Upgrade level 0 of 1', 'Primary factory', 'Rally point set']);
  world.houses.get('atreides').upgrades.lightFactory = 1;
  assert.ok(selectionPanelModel(world, sel, 'atreides').details.includes('Upgrade level 1 of 1'));
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

import { runUntil } from './helpers.mjs';

test('a repair facility tells which vehicle it is fixing and how far along it is', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 1000;
  h.startBuffer = 5000;
  world.spawnStructure('windtrap', 'atreides', 1, 1);
  const bay = world.spawnStructure('repair', 'atreides', 8, 8);
  const sel = new Selection();
  sel.setStructure(bay.id);
  assert.ok(selectionPanelModel(world, sel, 'atreides').details.includes('Repair bay free'));
  const t = world.spawnUnit('combatTank', 'atreides', 9, 12);
  t.hp = 100;
  world.issue('atreides', { type: 'repairAt', ids: [t.id], structureId: bay.id });
  world.step();
  const unitSel = new Selection();
  unitSel.set([t.id]);
  assert.ok(selectionPanelModel(world, unitSel, 'atreides').details.includes('Going for repairs'));
  assert.ok(runUntil(world, () => bay.bay?.state === 'repairing', 20) > 0);
  assert.ok(selectionPanelModel(world, sel, 'atreides').details.some((d) => /^Repairing Combat Tank \d+ %$/.test(d)));
});

test('a Carryall tells its job and offers Stop, Duty and Drop; an idle Ornithopter is hunting', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const c = world.spawnUnit('carryall', 'atreides', 5, 5);
  const o = world.spawnUnit('ornithopter', 'atreides', 9, 9);
  const t = world.spawnUnit('combatTank', 'atreides', 15, 15);
  const sel = new Selection();
  sel.set([c.id]);
  let m = selectionPanelModel(world, sel, 'atreides');
  assert.ok(m.details.includes('Standing by'));
  assert.deepEqual(m.buttons.map((b) => [b.id, b.label, !!b.active, !!b.disabled]), [['stop', 'Stop', false, false], ['guard', 'Duty', true, false], ['deploy', 'Drop', false, true]]);
  c.job = { stage: 'fetch', unit: t.id };
  assert.ok(selectionPanelModel(world, sel, 'atreides').details.includes('Fetching Combat Tank'));
  world.map.unit[world.map.idx(15, 15)] = 0;
  t.inside = c.id;
  c.cargo = t.id;
  c.job = { stage: 'hold', x: 5.5, y: 5.5 };
  c.manual = true;
  m = selectionPanelModel(world, sel, 'atreides');
  assert.ok(m.details.includes('Holding Combat Tank'), m.details.join());
  assert.deepEqual(m.buttons.map((b) => [b.id, !!b.active, !!b.disabled]), [['stop', false, false], ['guard', false, false], ['deploy', false, false]], 'off duty, with a load to drop');
  c.job = null;
  c.cargo = 0;
  assert.ok(selectionPanelModel(world, sel, 'atreides').details.includes('Holding position'));
  const visitor = world.spawnUnit('carryall', 'atreides', 20, 20);
  visitor.visitor = true;
  sel.set([visitor.id]);
  assert.deepEqual(selectionPanelModel(world, sel, 'atreides').buttons, [], 'a visitor only delivers');
  sel.set([o.id]);
  m = selectionPanelModel(world, sel, 'atreides');
  assert.ok(m.details.includes('Hunting'));
});

test('a Starport tells when its Frigate is due', () => {
  const world = flatWorld(40, 30, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 5000;
  h.startBuffer = 100000;
  world.spawnStructure('windtrap', 'atreides', 1, 1);
  const s = world.spawnStructure('starport', 'atreides', 10, 10);
  world.step();
  const sel = new Selection();
  sel.setStructure(s.id);
  assert.ok(selectionPanelModel(world, sel, 'atreides').details.includes('No orders'));
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  assert.ok(selectionPanelModel(world, sel, 'atreides').details.includes('Frigate due in 30 s · 1 ordered'));
});

import { deviate } from '../src/sim/specials.js';

test('a Devastator offers Destruct on D and says when it is counting down', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const dev = world.spawnUnit('devastator', 'harkonnen', 3, 3);
  const sel = new Selection();
  sel.set([dev.id]);
  assert.deepEqual(selectionPanelModel(world, sel, 'harkonnen').buttons.map((b) => [b.id, b.key]), [['stop', 'S'], ['guard', 'G'], ['scatter', 'X'], ['destruct', 'D']]);
  world.issue('harkonnen', { type: 'destruct', ids: [dev.id] });
  world.step();
  const m = selectionPanelModel(world, sel, 'harkonnen');
  assert.deepEqual([m.buttons, m.details], [[], ['Self-destructing']]);
});

test('with an MCV in the selection D means Deploy: the Destruct button shows no key', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const dev = world.spawnUnit('devastator', 'harkonnen', 3, 3);
  const mcv = world.spawnUnit('mcv', 'harkonnen', 6, 3);
  const sel = new Selection();
  sel.set([dev.id, mcv.id]);
  const keys = selectionPanelModel(world, sel, 'harkonnen').buttons.filter((b) => b.id === 'deploy' || b.id === 'destruct').map((b) => [b.id, b.key ?? null]);
  assert.deepEqual(keys, [['deploy', 'D'], ['destruct', null]]);
});

test('a deviated unit says whose it was and when it goes back; Fremen hunt; a Saboteur on its way says so', () => {
  const world = flatWorld(24, 12, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 3, 3);
  deviate(world, { house: 'ordos', x: 3.5, y: 3.5 });
  const sel = new Selection();
  sel.set([tank.id]);
  assert.deepEqual(selectionPanelModel(world, sel, 'ordos').details, ['Deviated · back to Atreides in 40 s', 'Idle']);
  const f = world.spawnUnit('fremen', 'atreides', 8, 3);
  sel.set([f.id]);
  const fm = selectionPanelModel(world, sel, 'atreides');
  assert.deepEqual([fm.details, fm.buttons], [['Hunting'], []]);
  const sab = world.spawnUnit('saboteur', 'ordos', 12, 3);
  const trap = world.spawnStructure('windtrap', 'harkonnen', 18, 3);
  world.issue('ordos', { type: 'sabotage', ids: [sab.id], structureId: trap.id });
  world.step();
  sel.set([sab.id]);
  assert.deepEqual(selectionPanelModel(world, sel, 'ordos').details, ['Moving in to sabotage']);
});
