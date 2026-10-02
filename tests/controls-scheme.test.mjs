// Spec §5.7's controls table, the rows the first controller tests left open: Alt + click force move,
// Space to the last alert, and the radar order that sets a rally point; and the controls screen to match.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { Controller } from '../src/input/controller.js';
import { Selection } from '../src/input/selection.js';
import { Groups } from '../src/input/groups.js';
import { controlRows } from '../src/ui/controls-help.js';
import { flatWorld, run } from './helpers.mjs';

const NONE = { shift: false, ctrl: false, alt: false };
const ALT = { shift: false, ctrl: false, alt: true };
const px = (t) => (t + 0.5) * 40;

function setup(scheme = 'classic') {
  const world = flatWorld(20, 20, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5);
  const harvester = world.spawnUnit('harvester', 'atreides', 5, 10);
  const soldier = world.spawnUnit('infantry', 'harkonnen', 9, 5);
  const issued = [];
  const issue = world.issue.bind(world);
  world.issue = (h, cmd) => { issued.push(cmd); issue(h, cmd); };
  const looked = [];
  const c = new Controller({
    world, house: 'atreides', selection: new Selection(), groups: new Groups(), settings: { scheme },
    project: (x, z) => ({ x: x * 40, y: z * 40, visible: true, pxPerUnit: 40 }),
    ground: (sx, sy) => ({ x: sx / 40, y: 0, z: sy / 40 }),
    viewport: () => ({ left: 0, top: 0, right: 2000, bottom: 2000 }),
    rig: { lookAt: (x, z) => looked.push([x, z]), reset() {} },
    positionOf: (u) => ({ x: u.x, z: u.y }),
  });
  return { world, tank, harvester, soldier, c, issued, looked };
}

test('classic: Alt + left click moves onto an enemy instead of attacking it, and the tracks crush the soldier', () => {
  const { world, tank, soldier, c, issued } = setup();
  c.selection.set([tank.id]);
  c.onClick(px(9), px(5), 0, ALT, false);
  assert.deepEqual(issued.at(-1), { type: 'move', ids: [tank.id], x: 9, y: 5 });
  assert.deepEqual(c.selection.list(), [tank.id], 'the selection stays');
  run(world, 6);
  assert.ok(!world.units.has(soldier.id), 'crushed under the tracks');
});

test('modern: Alt + right click is the force move; a plain right click on the enemy attacks', () => {
  const { tank, c, issued } = setup('modern');
  c.selection.set([tank.id]);
  c.onClick(px(9), px(5), 2, NONE, false);
  assert.equal(issued.at(-1).type, 'attack');
  c.onClick(px(9), px(5), 2, ALT, false);
  assert.deepEqual(issued.at(-1), { type: 'move', ids: [tank.id], x: 9, y: 5 });
});

test('Alt + click: harvesters drive onto spice without harvesting, onto own units and buildings without selecting them', () => {
  const { world, tank, harvester, c, issued } = setup();
  world.map.spice[world.map.idx(12, 12)] = 300;
  c.selection.set([harvester.id]);
  c.onClick(px(12), px(12), 0, ALT, false);
  assert.deepEqual(issued.at(-1), { type: 'move', ids: [harvester.id], x: 12, y: 12 });
  c.onClick(px(5), px(5), 0, ALT, false);
  assert.deepEqual(issued.at(-1), { type: 'move', ids: [harvester.id], x: 5, y: 5 }, 'to the tank\'s tile');
  assert.deepEqual(c.selection.list(), [harvester.id]);
  assert.ok(tank);
});

test('Alt + click with nothing selected still selects', () => {
  const { tank, c, issued } = setup();
  c.onClick(px(5), px(5), 0, ALT, false);
  assert.deepEqual(c.selection.list(), [tank.id]);
  assert.equal(issued.length, 0);
});

test('Space jumps to the last alert: an attack on the base or a harvester, a lost building, any alert with a place', () => {
  const { world, harvester, c, looked } = setup();
  assert.equal(c.onKey(' ', 'Space', NONE), true);
  assert.equal(looked.length, 0, 'no alert yet: the camera stays');
  const yard = world.spawnStructure('constructionYard', 'atreides', 14, 14);
  c.noteEvent({ type: 'damaged', kind: 'structure', id: yard.id, house: 'atreides', by: 'harkonnen', amount: 10 });
  c.noteEvent({ type: 'eva', house: 'atreides', key: 'baseAttack', text: 'Our base is under attack.' });
  c.onKey(' ', 'Space', NONE);
  assert.deepEqual(looked.at(-1), [yard.x + yard.w / 2, yard.y + yard.h / 2]);
  c.noteEvent({ type: 'damaged', kind: 'unit', id: harvester.id, house: 'atreides', by: 'harkonnen', amount: 5 });
  c.onKey(' ', 'Space', NONE);
  assert.deepEqual(looked.at(-1), [yard.x + yard.w / 2, yard.y + yard.h / 2], 'a hit alone is no alert');
  c.noteEvent({ type: 'eva', house: 'atreides', key: 'harvesterAttack', text: 'Harvester under attack.' });
  c.onKey(' ', 'Space', NONE);
  assert.deepEqual(looked.at(-1), [harvester.x, harvester.y]);
  c.noteEvent({ type: 'structureDestroyed', id: 99, house: 'atreides', x: 2, y: 3, w: 2, h: 2, by: 'harkonnen' });
  c.noteEvent({ type: 'eva', house: 'atreides', key: 'structureLost', text: 'Structure destroyed.' });
  c.onKey(' ', 'Space', NONE);
  assert.deepEqual(looked.at(-1), [3, 4]);
  c.noteEvent({ type: 'eva', house: 'atreides', key: 'wormsign', text: 'Warning! Wormsign!', x: 7.5, y: 8.5 });
  c.onKey(' ', 'Space', NONE);
  assert.deepEqual(looked.at(-1), [7.5, 8.5], 'an alert that names its place');
});

test('other houses\' alerts, own-goal hits and chatter do not move the jump point', () => {
  const { harvester, c, looked } = setup();
  c.noteEvent({ type: 'damaged', kind: 'unit', id: harvester.id, house: 'atreides', by: 'harkonnen', amount: 5 });
  c.noteEvent({ type: 'eva', house: 'harkonnen', key: 'baseAttack', text: 'Our base is under attack.' });
  c.noteEvent({ type: 'eva', house: 'atreides', key: 'constructionComplete', text: 'Construction complete.' });
  c.onKey(' ', 'Space', NONE);
  assert.equal(looked.length, 0);
  const own = setup();
  own.c.noteEvent({ type: 'damaged', kind: 'unit', id: own.harvester.id, house: 'atreides', by: 'atreides', amount: 5 });
  own.c.noteEvent({ type: 'eva', house: 'atreides', key: 'harvesterAttack', text: 'Harvester under attack.' });
  own.c.onKey(' ', 'Space', NONE);
  assert.equal(own.looked.length, 0, 'friendly fire leaves no place to jump to');
});

test('the radar order on the ground sets the selected factory\'s rally point (modern right click on the radar)', () => {
  const { world, c, issued } = setup('modern');
  const hf = world.spawnStructure('heavyFactory', 'atreides', 2, 14);
  c.onClick(px(2), px(14), 0, NONE, false);
  c.orderTile(9, 16);
  assert.deepEqual(issued.at(-1), { type: 'setRally', structureId: hf.id, x: 9, y: 16 });
});

test('the controls screen names every row of the spec §5.7 table, in the words of the chosen scheme', () => {
  const text = (scheme) => controlRows(scheme).map(([what, how]) => `${what}: ${how}`).join('\n');
  for (const scheme of ['classic', 'modern']) {
    const t = text(scheme);
    for (const must of [/Ctrl \+ click/, /Alt \+ (right )?click/, /Space/, /\bH\b/, /Home/, /Double click|double click/, /Ctrl \+ 1–9/, /\bA\b/, /\bS\b/, /\bG\b/, /\bX\b/, /\bD\b/, /Radar/, /Esc/, /\bP\b/, /Shift \+ left click/]) {
      assert.match(t, must, `${scheme}: ${must}`);
    }
  }
  const radar = (scheme) => controlRows(scheme).find(([w]) => w === 'Radar')[1];
  assert.match(radar('classic'), /left click orders/i);
  assert.match(radar('modern'), /right click orders/i);
  assert.match(text('classic'), /Alt \+ click/);
  assert.match(text('modern'), /Alt \+ right click/);
});
