import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { Controller } from '../src/input/controller.js';
import { Selection } from '../src/input/selection.js';
import { Groups } from '../src/input/groups.js';
import { flatWorld } from './helpers.mjs';

const NONE = { shift: false, ctrl: false, alt: false };
const px = (t) => (t + 0.5) * 40;

function setup(scheme = 'classic') {
  const world = flatWorld(20, 20, G.ROCK);
  world.map.ground[world.map.idx(15, 15)] = G.MOUNTAIN;
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5);
  const tank2 = world.spawnUnit('combatTank', 'atreides', 7, 5);
  const enemy = world.spawnUnit('combatTank', 'harkonnen', 12, 5);
  const mcv = world.spawnUnit('mcv', 'atreides', 8, 8);
  const issued = [];
  const issue = world.issue.bind(world);
  world.issue = (h, cmd) => { issued.push(cmd); issue(h, cmd); };
  const looked = [];
  const resets = [];
  const cursors = [];
  const c = new Controller({
    world, house: 'atreides', selection: new Selection(), groups: new Groups(), settings: { scheme },
    project: (x, z) => ({ x: x * 40, y: z * 40, visible: true, pxPerUnit: 40 }),
    ground: (sx, sy) => (sy < 20 ? null : { x: sx / 40, y: 0, z: sy / 40 }),
    viewport: () => ({ left: 0, top: 0, right: 2000, bottom: 2000 }),
    rig: { lookAt: (x, z) => looked.push([x, z]), reset: () => resets.push(1) },
    positionOf: (u) => ({ x: u.x, z: u.y }),
    onCursor: (name) => cursors.push(name),
  });
  return { world, tank, tank2, enemy, mcv, c, issued, looked, resets, cursors };
}

test('classic: click selects, click on ground moves, right click deselects', () => {
  const { tank, c, issued } = setup();
  c.onClick(px(5), px(5), 0, NONE, false);
  assert.deepEqual(c.selection.list(), [tank.id]);
  c.onClick(px(10), px(9), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'move', ids: [tank.id], x: 10, y: 9 });
  c.onClick(px(3), px(15), 2, NONE, false);
  assert.equal(c.selection.list().length, 0);
});

test('a click that meets no ground issues nothing and does not throw', () => {
  const { tank, c, issued } = setup();
  c.selection.set([tank.id]);
  c.onClick(300, 10, 0, NONE, false);
  c.onClick(300, 10, 2, NONE, false);
  assert.equal(issued.length, 0);
});

test('classic: clicking the selected MCV again deploys it', () => {
  const { mcv, c, issued } = setup();
  c.onClick(px(8), px(8), 0, NONE, false);
  c.onClick(px(8), px(8), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'deploy', ids: [mcv.id] });
});

test('modern: right click orders, left click on empty ground deselects', () => {
  const { tank, c, issued } = setup('modern');
  c.onClick(px(5), px(5), 0, NONE, false);
  c.onClick(px(10), px(12), 2, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'move', ids: [tank.id], x: 10, y: 12 });
  c.onClick(px(10), px(12), 0, NONE, false);
  assert.equal(c.selection.list().length, 0);
});

test('drag box selects own units only; shift adds', () => {
  const { tank, tank2, mcv, c } = setup();
  c.onDragEnd(0, 0, px(12) + 20, px(6), NONE);
  assert.deepEqual(c.selection.list().sort(), [tank.id, tank2.id].sort());
  c.onDragEnd(px(8) - 10, px(8) - 10, px(8) + 10, px(8) + 10, { ...NONE, shift: true });
  assert.ok(c.selection.has(mcv.id) && c.selection.has(tank.id));
});

test('double click selects every visible own unit of the same type', () => {
  const { tank, tank2, c } = setup();
  c.onClick(px(5), px(5), 0, NONE, true);
  assert.deepEqual(c.selection.list().sort(), [tank.id, tank2.id].sort());
});

test('control groups: ctrl+digit assigns, digit recalls, double tap centres', () => {
  const { tank, c, looked } = setup();
  c.selection.set([tank.id]);
  assert.equal(c.onKey('1', 'Digit1', { ...NONE, ctrl: true }), true);
  c.selection.clear();
  c.onKey('1', 'Digit1', NONE);
  assert.deepEqual(c.selection.list(), [tank.id]);
  c.onKey('1', 'Digit1', NONE);
  assert.equal(looked.length, 1);
});

test('hotkeys issue stop, guard, scatter and deploy for the selection', () => {
  const { tank, c, issued } = setup();
  c.selection.set([tank.id]);
  for (const k of ['s', 'g', 'x', 'd']) c.onKey(k, `Key${k.toUpperCase()}`, NONE);
  assert.deepEqual(issued.map((i) => i.type), ['stop', 'guard', 'scatter', 'deploy']);
});

test('cursor reflects what a click would do', () => {
  const { tank, mcv, c } = setup();
  c.selection.set([tank.id]);
  assert.equal(c.cursorFor(c.hitTest(px(10), px(10))), 'move');
  assert.equal(c.cursorFor(c.hitTest(px(15), px(15))), 'noMove');
  assert.equal(c.cursorFor(c.hitTest(px(12), px(5))), 'attack');
  c.selection.set([mcv.id]);
  assert.equal(c.cursorFor(c.hitTest(px(8), px(8))), 'deploy');
  assert.equal(c.cursorFor(null), 'noMove');
});

test('Home resets the view and centres on the base; H only centres', () => {
  const { c, looked, resets } = setup();
  c.onKey('Home', 'Home', NONE);
  assert.equal(resets.length, 1);
  assert.equal(looked.length, 1);
  c.onKey('h', 'KeyH', NONE);
  assert.equal(resets.length, 1);
  assert.equal(looked.length, 2);
});

test('a quick second click on the selected MCV deploys it even when it counts as a double click', () => {
  const { mcv, c, issued } = setup();
  c.onClick(px(8), px(8), 0, NONE, false);
  c.onClick(px(8), px(8), 0, NONE, true);
  assert.deepEqual(issued.at(-1), { type: 'deploy', ids: [mcv.id] });
});

test('held keys do not repeat orders or group taps', () => {
  const { tank, c, issued, looked } = setup();
  c.selection.set([tank.id]);
  c.onKey('x', 'KeyX', NONE);
  c.onKey('x', 'KeyX', { ...NONE, repeat: true });
  assert.equal(issued.filter((i) => i.type === 'scatter').length, 1);
  c.onKey('2', 'Digit2', { ...NONE, ctrl: true });
  c.onKey('2', 'Digit2', NONE);
  c.onKey('2', 'Digit2', { ...NONE, repeat: true });
  assert.equal(looked.length, 0);
});

test('no order on ground none of the selected units can enter; infantry may climb', () => {
  const { tank, world, c, issued } = setup();
  c.selection.set([tank.id]);
  c.onClick(px(15), px(15), 0, NONE, false);
  assert.equal(issued.length, 0);
  const trooper = world.spawnUnit('trooper', 'atreides', 2, 12);
  c.selection.set([tank.id, trooper.id]);
  c.onClick(px(15), px(15), 0, NONE, false);
  assert.equal(issued.at(-1).type, 'move');
});

test('a click on ground beyond the map edge issues nothing', () => {
  const { tank, c, issued } = setup();
  c.selection.set([tank.id]);
  c.onClick(px(25), px(5), 0, NONE, false);
  assert.equal(issued.length, 0);
});

test('with only harvesters selected, a click on spice orders harvesting there', () => {
  const { world, c, issued } = setup();
  world.map.setSpice(world.map.idx(12, 12), 250);
  const hv = world.spawnUnit('harvester', 'atreides', 3, 14);
  c.selection.set([hv.id]);
  assert.equal(c.cursorFor(c.hitTest(px(12), px(12))), 'attack');
  c.onClick(px(12), px(12), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'harvest', ids: [hv.id], x: 12, y: 12 });
});

test('units the player cannot see cannot be clicked', () => {
  const { enemy, tank, c, issued } = setup();
  c.canSee = (u) => u.id !== enemy.id;
  c.selection.set([tank.id]);
  c.onClick(px(12), px(5), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'move', ids: [tank.id], x: 12, y: 5 }, 'treated as ground');
  assert.equal(c.cursorFor(c.hitTest(px(12), px(5))), 'move');
});

test('placement mode places the ready structure centred on the cursor and refuses bad spots', () => {
  const { world, c, issued } = setup();
  const notices = [];
  c.onNotice = (t) => notices.push(t);
  world.spawnStructure('constructionYard', 'atreides', 2, 12);
  world.houses.get('atreides').lines.structure.current = { typeId: 'windtrap', cost: 300, total: 21.6, progress: 1, paid: 300, state: 'ready', starved: false };
  c.startPlacement('windtrap');
  c.onClick(18 * 40, 3 * 40, 0, NONE, false);
  assert.equal(issued.length, 0);
  assert.equal(notices.length, 1);
  assert.equal(c.mode.kind, 'place', 'still placing after a refused spot');
  assert.deepEqual(c.placementAt(200, 520).check.ok, true);
  c.onClick(200, 520, 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'place', typeId: 'windtrap', x: 4, y: 12 });
  assert.equal(c.mode, null);
});

test('placement mode ends when the structure is no longer ready', () => {
  const { world, c } = setup();
  const line = world.houses.get('atreides').lines.structure;
  line.current = { typeId: 'windtrap', cost: 300, total: 21.6, progress: 1, paid: 300, state: 'ready', starved: false };
  c.startPlacement('windtrap');
  c.frame();
  assert.equal(c.mode.kind, 'place');
  line.current = null;
  c.frame();
  assert.equal(c.mode, null);
});

test('right click or Escape leaves a mode without ordering anything', () => {
  const { c, issued } = setup();
  c.setMode({ kind: 'sell' });
  c.onClick(px(5), px(5), 2, NONE, false);
  assert.equal(c.mode, null);
  c.setMode({ kind: 'repair' });
  c.onKey('Escape', 'Escape', NONE);
  assert.equal(c.mode, null);
  assert.equal(issued.length, 0);
});

test('sell mode sells own structures only; repair mode repairs damaged own structures', () => {
  const { world, c, issued } = setup();
  const own = world.spawnStructure('windtrap', 'atreides', 2, 12);
  world.spawnStructure('windtrap', 'harkonnen', 10, 12);
  c.setMode({ kind: 'sell' });
  assert.equal(c.cursorFor(c.hitTest(px(10), px(12))), 'noSell');
  c.onClick(px(10), px(12), 0, NONE, false);
  assert.equal(issued.length, 0);
  assert.equal(c.cursorFor(c.hitTest(px(2), px(12))), 'sell');
  c.onClick(px(2), px(12), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'sell', structureId: own.id });
  assert.equal(c.mode.kind, 'sell', 'sell mode stays on until cancelled');
  c.setMode({ kind: 'repair' });
  assert.equal(c.cursorFor(c.hitTest(px(3), px(13))), 'noRepair');
  c.onClick(px(3), px(13), 0, NONE, false);
  assert.equal(issued.length, 1, 'undamaged: nothing to repair');
  own.hp = own.maxHp / 2;
  assert.equal(c.cursorFor(c.hitTest(px(3), px(13))), 'repair');
  c.onClick(px(3), px(13), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'repair', structureId: own.id });
});

test('orderTile orders the selection to a map tile (the radar uses it)', () => {
  const { tank, c, issued } = setup();
  c.selection.set([tank.id]);
  c.orderTile(12, 7);
  assert.deepEqual(issued.at(-1), { type: 'move', ids: [tank.id], x: 12, y: 7 });
});

test('a click selects a structure; with a factory selected a ground click sets its rally point', () => {
  const { world, c, issued } = setup();
  const lf = world.spawnStructure('lightFactory', 'atreides', 2, 12);
  c.onClick(px(2), px(12), 0, NONE, false);
  assert.equal(c.selection.structureId, lf.id);
  assert.equal(c.selection.list().length, 0);
  assert.equal(c.cursorFor(c.hitTest(px(9), px(14))), 'move');
  c.onClick(px(9), px(14), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'setRally', structureId: lf.id, x: 9, y: 14 });
  assert.equal(c.selection.structureId, lf.id, 'the factory stays selected');
  c.onClick(px(2), px(12), 0, NONE, true);
  assert.deepEqual(issued.at(-1), { type: 'setPrimary', structureId: lf.id });
  c.onClick(px(9), px(14), 2, NONE, false);
  assert.equal(c.selection.structureId, 0, 'right click deselects (classic)');
});

test('modern scheme: right click on the ground sets the rally point of the selected factory', () => {
  const { world, c, issued } = setup('modern');
  const lf = world.spawnStructure('lightFactory', 'atreides', 2, 12);
  c.onClick(px(2), px(12), 0, NONE, false);
  c.onClick(px(9), px(14), 2, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'setRally', structureId: lf.id, x: 9, y: 14 });
});

test('harvesters clicked onto an own refinery go back to base; enemy structures do not steal the selection', () => {
  const { world, tank, c, issued } = setup();
  world.spawnStructure('refinery', 'atreides', 2, 12);
  const harv = world.spawnUnit('harvester', 'atreides', 10, 10);
  c.selection.set([harv.id]);
  assert.equal(c.cursorFor(c.hitTest(px(3), px(12))), 'move');
  c.onClick(px(3), px(12), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'returnToBase', ids: [harv.id] });
  world.spawnStructure('windtrap', 'harkonnen', 14, 2);
  c.selection.set([tank.id]);
  c.onClick(px(14), px(2), 0, NONE, false);
  assert.deepEqual(c.selection.list(), [tank.id]);
  assert.equal(c.selection.structureId, 0);
});

test('structures the player has not seen cannot be hovered or selected', () => {
  const { world, c } = setup();
  world.spawnStructure('windtrap', 'harkonnen', 14, 12);
  c.canSeeStructure = (s) => s.house === 'atreides';
  assert.equal(c.hitTest(px(14), px(12)).kind, 'ground');
  c.onClick(px(14), px(12), 0, NONE, false);
  assert.equal(c.selection.structureId, 0);
});

test('clicking an enemy with units selected attacks it (classic left click, modern right click)', () => {
  const { tank, enemy, c, issued } = setup();
  c.selection.set([tank.id]);
  c.onClick(px(12), px(5), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'attack', ids: [tank.id], targetKind: 'unit', targetId: enemy.id, force: false });
  const m = setup('modern');
  m.c.selection.set([m.tank.id]);
  m.c.onClick(px(12), px(5), 2, NONE, false);
  assert.equal(m.issued.at(-1).type, 'attack');
});

test('enemy buildings are attacked, and the cursor says so', () => {
  const { world, tank, c, issued } = setup();
  const trap = world.spawnStructure('windtrap', 'harkonnen', 14, 12);
  c.selection.set([tank.id]);
  assert.equal(c.cursorFor(c.hitTest(px(14), px(12))), 'attack');
  c.onClick(px(14), px(12), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'attack', ids: [tank.id], targetKind: 'structure', targetId: trap.id, force: false });
});

test('Ctrl + click forces fire on a friend or on the ground', () => {
  const { tank, tank2, c, issued } = setup();
  c.selection.set([tank.id]);
  c.onClick(px(7), px(5), 0, { ...NONE, ctrl: true }, false);
  assert.deepEqual(issued.at(-1), { type: 'attack', ids: [tank.id], targetKind: 'unit', targetId: tank2.id, force: true });
  c.onClick(px(10), px(10), 0, { ...NONE, ctrl: true }, false);
  assert.deepEqual(issued.at(-1), { type: 'attack', ids: [tank.id], x: 10, y: 10, force: true });
  assert.deepEqual(c.selection.list(), [tank.id], 'the selection stays');
});

test('A then a click attack-moves the selection; Escape cancels', () => {
  const { tank, c, issued } = setup();
  c.selection.set([tank.id]);
  c.onKey('a', 'KeyA', NONE);
  assert.equal(c.mode.kind, 'attackMove');
  assert.equal(c.cursorFor(c.hitTest(px(10), px(10))), 'attack');
  c.onClick(px(10), px(10), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'attackMove', ids: [tank.id], x: 10, y: 10 });
  assert.equal(c.mode, null);
  c.onKey('a', 'KeyA', NONE);
  c.onKey('Escape', 'Escape', NONE);
  assert.equal(c.mode, null);
  assert.equal(issued.length, 1);
});

test('damaged vehicles clicked onto an own repair facility drive in; healthy ones just select it', () => {
  const { world, tank, c, issued, cursors } = setup();
  const bay = world.spawnStructure('repair', 'atreides', 2, 12);
  c.selection.set([tank.id]);
  c.onMove(px(3), px(12));
  c.frame();
  assert.equal(cursors.at(-1), 'select', 'nothing to repair');
  c.onClick(px(3), px(12), 0, NONE, false);
  assert.equal(c.selection.structureId, bay.id);
  tank.hp = 50;
  c.selection.set([tank.id]);
  c.frame();
  assert.equal(cursors.at(-1), 'enter');
  c.onClick(px(3), px(12), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'repairAt', ids: [tank.id], structureId: bay.id });
});

test('modern: right click on an own repair facility sends damaged vehicles in; a vehicle in the bay cannot be clicked', () => {
  const { world, tank, tank2, c, issued } = setup('modern');
  const bay = world.spawnStructure('repair', 'atreides', 2, 12);
  tank.hp = 50;
  c.selection.set([tank.id]);
  c.onClick(px(3), px(12), 2, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'repairAt', ids: [tank.id], structureId: bay.id });
  tank2.inside = bay.id;
  c.onClick(px(7), px(5), 0, NONE, false);
  assert.ok(!c.selection.has(tank2.id));
});

test('infantry clicked onto a badly damaged enemy building capture it while the rest attack', () => {
  const { world, tank, c, issued, cursors } = setup();
  const squad = world.spawnUnit('infantry', 'atreides', 3, 3);
  const silo = world.spawnStructure('silo', 'harkonnen', 12, 12);
  const outpost = world.spawnStructure('outpost', 'harkonnen', 8, 14);
  outpost.hp = 10;
  c.selection.set([squad.id, tank.id]);
  c.onMove(px(12), px(12));
  c.frame();
  assert.equal(cursors.at(-1), 'attack', 'not weak enough yet');
  silo.hp = 20;
  c.frame();
  assert.equal(cursors.at(-1), 'capture');
  c.onClick(px(12), px(12), 0, NONE, false);
  assert.deepEqual(issued.slice(-2), [
    { type: 'capture', ids: [squad.id], structureId: silo.id },
    { type: 'attack', ids: [tank.id], targetKind: 'structure', targetId: silo.id, force: false },
  ]);
  c.onMove(px(8), px(14));
  c.frame();
  assert.equal(cursors.at(-1), 'attack', 'Outposts cannot be captured');
});

test('aircraft are picked at their flying height; a selected Carryall takes no orders', () => {
  const { world, c, issued } = setup();
  const o = world.spawnUnit('ornithopter', 'atreides', 3, 3);
  const cy = world.spawnUnit('carryall', 'atreides', 3, 10);
  const lifts = [];
  c.project = (x, z, lift) => { lifts.push(lift); return { x: x * 40, y: z * 40, visible: true, pxPerUnit: 40 }; };
  c.candidates();
  assert.ok(lifts.includes(o.alt), 'projected at its height');
  c.selection.set([cy.id]);
  const before = issued.length;
  c.onClick(px(8), px(12), 0, NONE, false);
  assert.equal(issued.length, before, 'nothing ordered');
});

test('over an enemy aircraft the cursor tells whether the selection can shoot upwards', () => {
  const { world, tank, c, cursors } = setup();
  const o = world.spawnUnit('ornithopter', 'harkonnen', 14, 12);
  c.project = (x, z) => ({ x: x * 40, y: z * 40, visible: true, pxPerUnit: 40 });
  c.selection.set([tank.id]);
  c.onMove(o.x * 40, o.y * 40);
  c.frame();
  assert.equal(cursors.at(-1), 'noMove', 'a tank cannot shoot upwards');
  const troopers = world.spawnUnit('troopers', 'atreides', 3, 3);
  c.selection.set([tank.id, troopers.id]);
  c.frame();
  assert.equal(cursors.at(-1), 'attack');
});

test('the Palace weapon aims where the player clicks; the aim ends if the Palace falls', () => {
  const { world, c, issued, cursors } = setup();
  const s = world.spawnStructure('palace', 'atreides', 1, 12);
  s.readyAt = 0;
  c.setMode({ kind: 'palace' });
  c.frame();
  assert.equal(cursors.at(-1), 'target');
  c.onClick(px(12), px(5), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'palace', x: 12, y: 5 });
  assert.equal(c.mode, null);
  c.setMode({ kind: 'palace' });
  c.onClick(px(3), px(3), 2, NONE, false);
  assert.equal(c.mode, null, 'right click cancels');
  assert.equal(issued.length, 1);
  c.setMode({ kind: 'palace' });
  world.removeStructure(s);
  c.frame();
  assert.equal(c.mode, null, 'no Palace, no aim');
});

test('a Saboteur clicked onto an enemy building goes in to blow it up while the rest attack; the cursor shows a bomb', () => {
  const { world, tank, c, issued, cursors } = setup();
  const sab = world.spawnUnit('saboteur', 'atreides', 3, 8);
  const silo = world.spawnStructure('silo', 'harkonnen', 12, 9);
  c.selection.set([sab.id, tank.id]);
  c.onMove(px(12), px(9));
  c.frame();
  assert.equal(cursors.at(-1), 'sabotage');
  c.onClick(px(12), px(9), 0, NONE, false);
  assert.deepEqual(issued.at(-2), { type: 'sabotage', ids: [sab.id], structureId: silo.id });
  assert.deepEqual(issued.at(-1), { type: 'attack', ids: [tank.id], targetKind: 'structure', targetId: silo.id, force: false });
});
