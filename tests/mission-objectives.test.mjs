// Mission objectives and the loss (spec §7; research §2, §5, §6): quota (credits in storage at that moment),
// quota or destroy, destroy (every enemy structure but walls, slabs and turrets gone; captured counts); the
// player loses with no structure left (an MCV does not save them); nothing ends before the minimum time, and the
// end is announced once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { transferStructure } from '../src/sim/capture.js';
import { setup, razeBase, evas } from './missions-helpers.mjs';
import { run, runUntil } from './helpers.mjs';

const ends = (world) => world.events.drain().filter((e) => e.type === 'gameOver');
/** No harvesting: the credits are only what the test sets. */
// no income: the Harvesters go, and the Refineries too (a Refinery without a Harvester gets one flown in, as in the original)
const noHarvest = (world) => {
  for (const u of [...world.units.values()]) if (u.typeId === 'harvester') world.removeUnit(u);
  for (const s of [...world.structures.values()]) if (s.typeId === 'refinery' && s.house === 'atreides') world.removeStructure(s, 'sold');
};

test('destroy: the enemy base gone wins — but not before the minimum time, and only once', () => {
  const { world } = setup();
  run(world, 10);
  razeBase(world, 'harkonnen', 'atreides');
  assert.ok([...world.structures.values()].some((s) => s.house === 'harkonnen' && s.typeId === 'turret'), 'a turret still stands');
  run(world, 100);
  assert.equal(world.outcome, null, 'nothing ends before two minutes');
  assert.ok(runUntil(world, () => world.outcome, 15) >= 0);
  assert.ok(world.outcome.seconds >= 120 && world.outcome.seconds < 120.3, `ended at ${world.outcome.seconds}`);
  assert.equal(world.outcome.winner, 'atreides');
  const events = world.events.drain();
  assert.equal(events.filter((e) => e.type === 'gameOver').length, 1);
  assert.equal(evas(events, 'atreides', 'missionAccomplished').length, 1);
  run(world, 10);
  assert.equal(ends(world).length, 0, 'announced once');
});

test('destroy: a captured building counts as gone', () => {
  const { world } = setup({ minSeconds: 5 });
  for (const s of [...world.structures.values()]) if (s.house === 'harkonnen' && s.typeId === 'windtrap') transferStructure(world, s, 'atreides');
  for (const s of [...world.structures.values()]) if (s.house === 'harkonnen' && s.typeId === 'constructionYard') transferStructure(world, s, 'atreides');
  run(world, 6);
  assert.equal(world.outcome?.winner, 'atreides');
});

test('quota: the credits in storage at that moment, not what was spent', () => {
  const { world } = setup({ objective: { kind: 'quota', quota: 1000 }, title: 'Harvest 1000 credits' });
  noHarvest(world);
  const p = world.houses.get('atreides');
  run(world, 30);
  razeBase(world, 'harkonnen', 'atreides');
  p.credits = 999;
  run(world, 100);
  assert.equal(world.outcome, null, 'a destroyed base is no quota, and 999 is short');
  p.credits = 1000;
  run(world, 0.3);
  assert.equal(world.outcome?.winner, 'atreides');
});

test('quota reached early still waits for the minimum time, and must still hold then', () => {
  const { world } = setup({ objective: { kind: 'quota', quota: 600 } });
  noHarvest(world);
  const p = world.houses.get('atreides');
  p.credits = 700;
  run(world, 60);
  assert.equal(world.outcome, null);
  p.credits = 100;   // spent it
  run(world, 70);
  assert.equal(world.outcome, null);
  p.credits = 650;
  run(world, 0.3);
  assert.equal(world.outcome?.winner, 'atreides');
});

test('quota or destroy: either way wins', () => {
  const a = setup({ objective: { kind: 'quotaOrDestroy', quota: 2700 }, minSeconds: 10 });
  a.world.houses.get('atreides').credits = 2700;
  run(a.world, 10.3);
  assert.equal(a.world.outcome?.winner, 'atreides');
  const b = setup({ objective: { kind: 'quotaOrDestroy', quota: 2700 }, minSeconds: 10 });
  razeBase(b.world, 'harkonnen', 'atreides');
  run(b.world, 10.3);
  assert.equal(b.world.outcome?.winner, 'atreides');
});

test('the player with no structure left loses — walls, turrets and an MCV do not save them', () => {
  const { world } = setup({ minSeconds: 20 });
  world.spawnStructure('wall', 'atreides', 13, 20);
  world.spawnStructure('turret', 'atreides', 13, 22);
  world.spawnUnit('mcv', 'atreides', 12, 27);
  razeBase(world, 'atreides', 'harkonnen');
  run(world, 19);
  assert.equal(world.outcome, null, 'not before the minimum time');
  run(world, 1.3);
  assert.equal(world.outcome?.winner, 'harkonnen');
  const events = world.events.drain();
  assert.equal(evas(events, 'atreides', 'missionFailed').length, 1);
  assert.equal(evas(events, 'atreides', 'missionAccomplished').length, 0);
  run(world, 5);
  assert.equal(ends(world).length, 0, 'announced once');
});

test('an MCV deployed in time saves the base; both bases gone is the computer\'s win', () => {
  const a = setup({ minSeconds: 30 });
  const mcv = a.world.spawnUnit('mcv', 'atreides', 12, 27);
  razeBase(a.world, 'atreides', 'harkonnen');
  a.world.issue('atreides', { type: 'deploy', ids: [mcv.id] });
  run(a.world, 31);
  assert.equal(a.world.outcome, null, 'a new Construction Yard is a base');
  const b = setup({ minSeconds: 5 });
  razeBase(b.world, 'atreides', 'harkonnen');
  razeBase(b.world, 'harkonnen', 'atreides');
  run(b.world, 5.3);
  assert.equal(b.world.outcome?.winner, 'harkonnen');
  assert.equal(b.world.outcome.draw, false);
});

test('the HUD line names the objective and how far along it is', () => {
  const q = setup({ objective: { kind: 'quota', quota: 1000 }, title: 'Harvest 1000 credits' });
  q.world.houses.get('atreides').credits = 640.7;
  assert.equal(q.world.mission.hudLine(), 'Harvest 1000 credits · 640 / 1000 credits');
  const d = setup();
  assert.equal(d.world.mission.hudLine(), 'Destroy the Harkonnen base · 2 enemy buildings left');
  const e = setup({ objective: { kind: 'quotaOrDestroy', quota: 2700 }, title: '' });
  assert.match(e.world.mission.hudLine(), /^Harvest 2700 credits or destroy the enemy base · 500 \/ 2700 credits · 2 enemy buildings left$/);
  razeBase(d.world, 'harkonnen', 'atreides');
  run(d.world, 120.3);
  assert.equal(d.world.mission.hudLine(), 'Destroy the Harkonnen base · Mission accomplished');
});
