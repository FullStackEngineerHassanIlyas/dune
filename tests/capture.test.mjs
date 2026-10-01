import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { captureStructure } from '../src/sim/capture.js';
import { updateFog, structureVisibleTo } from '../src/sim/fog.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

const capture = (world, units, s) => world.issue(units[0].house, { type: 'capture', ids: units.map((u) => u.id), structureId: s.id });

test('infantry walk into a badly damaged enemy factory and take it over', () => {
  const world = flatWorld(32, 32, G.ROCK);
  const hf = world.spawnStructure('heavyFactory', 'harkonnen', 12, 10);
  const squad = world.spawnUnit('infantry', 'atreides', 13, 20);
  hf.hp = 40;
  capture(world, [squad], hf);
  assert.ok(runUntil(world, () => hf.house === 'atreides', 60) > 0, 'captured');
  assert.equal(world.units.has(squad.id), false, 'the squad is used up');
  const events = world.events.drain();
  assert.ok(events.some((e) => e.type === 'structureCaptured' && e.id === hf.id && e.from === 'harkonnen' && e.to === 'atreides'));
  assert.ok(events.some((e) => e.type === 'eva' && e.house === 'atreides' && e.key === 'captured'));
  assert.ok(events.some((e) => e.type === 'eva' && e.house === 'harkonnen' && e.key === 'lostToCapture'));
  assert.equal(world.houses.get('harkonnen').stats.structuresLost, 1);
  assert.equal(world.houses.get('atreides').stats.structuresCaptured, 1);
});

test('a building still too strong is attacked instead; a second soldier finds it taken and stands down', () => {
  const world = flatWorld(32, 32, G.ROCK);
  const silo = world.spawnStructure('silo', 'harkonnen', 12, 10);
  const a = world.spawnUnit('soldier', 'atreides', 12, 14);
  capture(world, [a], silo);
  world.step();   // the order applies at the next tick
  assert.ok(runUntil(world, () => a.order.type !== 'capture', 30) > 0);
  assert.equal(a.order.type, 'attack');
  assert.equal(silo.house, 'harkonnen');
  world.removeUnit(a);
  silo.hp = 30;   // a fifth of 150
  const b = world.spawnUnit('soldier', 'atreides', 14, 14), c = world.spawnUnit('soldier', 'atreides', 11, 14);
  capture(world, [b, c], silo);
  assert.ok(runUntil(world, () => silo.house === 'atreides', 30) > 0);
  run(world, 1);
  const left = [b, c].filter((u) => world.units.has(u.id));
  assert.equal(left.length, 1, 'one soldier went in');
  assert.equal(left[0].order.type, 'idle', 'the other stood down');
});

test('walls, Outposts, own buildings and vehicles are not for capture', () => {
  const world = flatWorld(32, 32, G.ROCK);
  const outpost = world.spawnStructure('outpost', 'harkonnen', 2, 2);
  const wall = world.spawnStructure('wall', 'harkonnen', 6, 2);
  const own = world.spawnStructure('silo', 'atreides', 2, 26);
  for (const s of [outpost, wall, own]) s.hp = 1;
  const soldier = world.spawnUnit('soldier', 'atreides', 10, 10);
  const tank = world.spawnUnit('combatTank', 'atreides', 12, 10);
  for (const s of [outpost, wall, own]) capture(world, [soldier], s);
  const target = world.spawnStructure('silo', 'harkonnen', 20, 20);
  target.hp = 1;
  capture(world, [tank], target);
  world.step();
  assert.deepEqual([soldier.order.type, tank.order.type], ['idle', 'idle']);
});

test('a captured refinery brings its unloading harvester; the old owner loses that store\'s credits', () => {
  const world = flatWorld(32, 32, G.ROCK);
  const hk = world.houses.get('harkonnen'), at = world.houses.get('atreides');
  hk.startBuffer = 0;
  world.spawnStructure('refinery', 'harkonnen', 2, 2);
  const ref = world.spawnStructure('refinery', 'harkonnen', 10, 2);
  const hv = [...world.units.values()].find((u) => u.typeId === 'harvester' && u.tx === 12 && u.ty === 4);
  Object.assign(hv.harvest, { state: 'toRefinery', target: -1, load: 700 });
  assert.ok(runUntil(world, () => hv.harvest.state === 'unloading', 5) > 0, 'docked in the slot');
  assert.equal(ref.dockedBy, hv.id);
  hk.credits = 2010;
  at.credits = 0;
  at.startBuffer = 5000;
  ref.hp = 50;
  captureStructure(world, ref, world.spawnUnit('soldier', 'atreides', 12, 5));
  assert.deepEqual([ref.house, hv.house], ['atreides', 'atreides']);
  assert.equal(hv.inside, ref.id, 'still in the slot');
  assert.ok(Math.abs(hk.credits - 1005) < 1e-6, `Harkonnen kept ${hk.credits}`);
  run(world, 3);   // slowly: the refinery is badly damaged
  assert.ok(at.credits > 100, `the harvester unloads for its new owner: ${at.credits}`);
});

test('a captured repair bay changes hands with the vehicle inside', () => {
  const world = flatWorld(32, 32, G.ROCK);
  const hk = world.houses.get('harkonnen'), at = world.houses.get('atreides');
  for (const h of [hk, at]) { h.credits = 1000; h.startBuffer = 5000; }
  world.spawnStructure('windtrap', 'harkonnen', 2, 2);
  world.spawnStructure('windtrap', 'atreides', 26, 26);
  const bay = world.spawnStructure('repair', 'harkonnen', 10, 10);
  const t = world.spawnUnit('combatTank', 'harkonnen', 11, 14);
  t.hp = 50;
  world.issue('harkonnen', { type: 'repairAt', ids: [t.id], structureId: bay.id });
  assert.ok(runUntil(world, () => t.inside === bay.id, 20) > 0);
  bay.hp = 40;
  captureStructure(world, bay, world.spawnUnit('soldier', 'atreides', 14, 13));
  assert.equal(t.house, 'atreides');
  const credits = at.credits;
  assert.ok(runUntil(world, () => !t.inside, 60) > 0);
  assert.equal(t.hp, t.maxHp);
  assert.ok(at.credits < credits, 'the new owner pays for the rest');
});

test('the old owner loses what the captured factory was building, refunded', () => {
  const world = flatWorld(32, 32, G.ROCK);
  const hk = world.houses.get('harkonnen');
  hk.credits = 5000;
  hk.startBuffer = 100000;
  world.spawnStructure('windtrap', 'harkonnen', 2, 2);
  const hf = world.spawnStructure('heavyFactory', 'harkonnen', 10, 10);
  world.issue('harkonnen', { type: 'build', typeId: 'combatTank' });
  run(world, 5);
  hf.hp = 40;
  captureStructure(world, hf, world.spawnUnit('soldier', 'atreides', 10, 13));
  run(world, 1.1);
  assert.equal(hk.lines.heavy.current, null);
  assert.ok(Math.abs(hk.credits - 5000) < 1e-6);
});

test('a captured building stays on its former owner\'s map as last seen', () => {
  const world = flatWorld(40, 30, G.ROCK);
  world.spawnStructure('constructionYard', 'harkonnen', 2, 2);
  const far = world.spawnStructure('silo', 'harkonnen', 30, 20);
  far.hp = 20;
  updateFog(world);
  captureStructure(world, far, world.spawnUnit('soldier', 'atreides', 30, 23));
  updateFog(world);
  assert.equal(structureVisibleTo(world, 'harkonnen', far), true);
});
