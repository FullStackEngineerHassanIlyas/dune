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
