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
  world.spawnStructure('heavyFactory', 'atreides', 10, 8);
}

test('the strips list what the house can build, in display order', () => {
  const { world } = base();
  let m = sidebarModel(world, 'atreides');
  assert.deepEqual(m.structures.map((i) => i.typeId), ['concrete', 'windtrap', 'upgrade:constructionYard']);
  assert.deepEqual(m.units, []);
  factories(world);
  m = sidebarModel(world, 'atreides');
  assert.deepEqual(m.units.map((i) => i.typeId), ['trike', 'harvester', 'combatTank'], 'one strip from the one vehicle factory, light vehicles first');
  assert.ok(m.units.every((i) => i.line === 'heavy'));
  const wt = m.structures.find((i) => i.typeId === 'windtrap');
  assert.deepEqual([wt.name, wt.cost, wt.seconds, wt.line, wt.state], ['Wind Trap', 300, 9, 'structure', 'idle']);
});

test('icons carry production state, progress and queue counts', () => {
  const { world } = base();
  factories(world);
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  world.issue('atreides', { type: 'build', typeId: 'trike', count: 3 });
  run(world, 2);
  const m = sidebarModel(world, 'atreides');
  const wt = m.structures.find((i) => i.typeId === 'windtrap');
  assert.equal(wt.state, 'building');
  assert.ok(wt.progress > 0.2 && wt.progress < 0.25, `progress ${wt.progress}`);
  assert.equal(m.structures.find((i) => i.typeId === 'concrete').state, 'locked', 'the yard is busy');
  const trike = m.units.find((i) => i.typeId === 'trike');
  assert.deepEqual([trike.state, trike.count], ['building', 3]);
  world.issue('atreides', { type: 'hold', typeId: 'windtrap' });
  world.step();
  assert.equal(sidebarModel(world, 'atreides').structures.find((i) => i.typeId === 'windtrap').state, 'hold');
});

test('the yard upgrade stays open while a structure builds, and the structure it sets aside keeps its progress', () => {
  const { world, h } = base();
  factories(world);
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  run(world, 2);
  const yardUp = (m) => m.structures.find((i) => i.typeId === 'upgrade:constructionYard');
  assert.equal(yardUp(sidebarModel(world, 'atreides')).state, 'idle', 'it starts at once, setting the Wind Trap aside');
  const progress = h.lines.structure.current.progress;
  world.issue('atreides', { type: 'build', typeId: 'upgrade:constructionYard' });
  world.step();
  const wt = sidebarModel(world, 'atreides').structures.find((i) => i.typeId === 'windtrap');
  assert.deepEqual([wt.state, wt.count], ['queued', 1]);
  assert.equal(wt.progress, progress, 'shown as far as it got');
  run(world, 6);
  run(world, (1 - progress) * 9);
  assert.equal(h.lines.structure.current.state, 'ready');
  world.spawnStructure('outpost', 'atreides', 14, 4);   // the second level needs one
  assert.equal(yardUp(sidebarModel(world, 'atreides')).state, 'locked', 'a structure waiting to be placed keeps the yard');
});

test('the sidebar reads storage, power and radar without touching the house', () => {
  const { world, h } = base();
  factories(world);
  h.startBuffer = 500;   // set after building: the simulation ends the allowance itself when storage passes it
  const m = sidebarModel(world, 'atreides');
  assert.equal(m.storage, 1005);
  assert.equal(h.startBuffer, 500, 'revoking the start buffer is the simulation\'s business');
  assert.deepEqual([m.power.produced, m.power.used, m.power.level], [100, 65, 'ok']);
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

test('upgrades close the structure strip with their level, price, time and what they open', () => {
  const { world } = base();
  factories(world);
  let m = sidebarModel(world, 'atreides');
  assert.deepEqual(m.structures.slice(-2).map((i) => i.typeId), ['upgrade:constructionYard', 'upgrade:heavyFactory']);
  const up = m.structures.at(-1);
  assert.deepEqual([up.line, up.icon, up.name, up.cost, up.seconds, up.state], ['heavy', 'upgrade:heavyFactory:1', 'Heavy Factory upgrade', 200, 5, 'idle']);
  assert.equal(up.note, 'Level 1 — unlocks Quad');
  assert.equal(m.structures[0].icon, 'concrete', 'other icons are keyed by their type');
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  run(world, 1.7);
  const busy = sidebarModel(world, 'atreides').structures.at(-1);
  assert.equal(busy.state, 'building');
  assert.ok(busy.progress > 0.3 && busy.progress < 0.36, `progress ${busy.progress}`);
  run(world, 3.5);
  m = sidebarModel(world, 'atreides');
  const next = m.structures.at(-1);
  assert.deepEqual([next.typeId, next.icon, next.cost, next.note], ['upgrade:heavyFactory', 'upgrade:heavyFactory:2', 300, 'Level 2 — unlocks MCV'], 'the ladder goes on');
  assert.deepEqual(m.units.map((i) => i.typeId), ['trike', 'quad', 'harvester', 'combatTank']);
});

test('the Starport\'s wares close the unit strip with their price, stock and what is on order', () => {
  const world = flatWorld(40, 30, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 5000;
  h.startBuffer = 100000;
  world.spawnStructure('windtrap', 'atreides', 1, 1);
  world.spawnStructure('starport', 'atreides', 10, 10);
  world.step();
  let m = sidebarModel(world, 'atreides');
  const quad = m.units.find((i) => i.typeId === 'starport:quad');
  assert.deepEqual([quad.line, quad.icon, quad.name, quad.cost, quad.state, quad.count], ['starport', 'starport:quad', 'Quad', h.starport.price.quad, 'idle', 0]);
  assert.equal(quad.note, `Starport · ${h.starport.stock.quad} in stock`);
  assert.deepEqual([quad.order, quad.cancel], [{ type: 'starportOrder', typeId: 'quad' }, { type: 'starportCancel', typeId: 'quad' }]);
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  m = sidebarModel(world, 'atreides');
  const ordered = m.units.find((i) => i.typeId === 'starport:quad');
  assert.deepEqual([ordered.state, ordered.count], ['queued', 1]);
  assert.match(ordered.note, /· Frigate in 30 s$/);
  h.starport.stock.mcv = 0;
  assert.equal(sidebarModel(world, 'atreides').units.find((i) => i.typeId === 'starport:mcv').state, 'locked');
});

import { tipText, badgeOf, wipeOf } from '../src/ui/sidebar-model.js';

test('the item an upgrade sets aside keeps its clock and a badge in the strip, and its tooltip says why it waits', () => {
  const { world } = base();
  factories(world);
  world.issue('atreides', { type: 'build', typeId: 'trike' });
  run(world, 4);
  world.issue('atreides', { type: 'build', typeId: 'upgrade:lightFactory' });
  world.step();
  const m = sidebarModel(world, 'atreides');
  const trike = m.units.find((i) => i.typeId === 'trike');
  assert.equal(trike.state, 'queued');
  assert.ok(trike.progress > 0.1, `the clock stays where the Trike was: ${trike.progress}`);
  assert.equal(wipeOf(trike), trike.progress.toFixed(3));
  assert.equal(badgeOf(trike), '1', 'still on order');
  assert.match(tipText(trike), /resumes after the upgrade/);
  assert.deepEqual([badgeOf({ state: 'queued', count: 1, progress: 0 }), wipeOf({ state: 'queued', count: 1, progress: 0 })], ['1', '1'], 'any item on order but not begun');
  const cur = sidebarModel(world, 'atreides').structures.find((i) => i.typeId === 'upgrade:lightFactory');
  assert.deepEqual([cur.state, badgeOf(cur)], ['building', ''], 'the one in work shows its clock, and a number only for more of it');
  assert.equal(badgeOf({ typeId: 'upgrade:heavyFactory', state: 'queued', count: 1, progress: 0 }), '', 'a queued upgrade: its level arrow has that corner');
});

test('a Palace puts its weapon at the top of the sidebar with a charging clock', () => {
  const world = flatWorld(40, 30, G.ROCK);
  assert.equal(sidebarModel(world, 'harkonnen').special, null);
  const s = world.spawnStructure('palace', 'harkonnen', 10, 10);
  run(world, 210);
  const m = sidebarModel(world, 'harkonnen').special;
  assert.deepEqual([m.weapon, m.name, m.icon, m.ready, m.aim], ['deathHand', 'Death Hand', 'palace:deathHand', false, true]);
  assert.ok(Math.abs(m.progress - 0.5) < 0.01 && Math.abs(m.seconds - 210) <= 1);
  assert.equal(tipText(m), `Charging — ready in ${Math.floor(m.seconds / 60)}:${String(m.seconds % 60).padStart(2, '0')}`);
  s.readyAt = world.time;
  const r = sidebarModel(world, 'harkonnen').special;
  assert.ok(r.ready && r.progress === 1);
  assert.equal(tipText(r), 'Ready — click, then pick a target');
  world.spawnStructure('palace', 'ordos', 20, 20);
  assert.equal(sidebarModel(world, 'ordos').special.aim, false, 'the Saboteur needs no target');
});
