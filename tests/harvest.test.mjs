import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

function spiceWorld() {
  const world = flatWorld(40, 24, G.ROCK);
  const m = world.map;
  for (let y = 0; y < 24; y++) for (let x = 20; x < 40; x++) m.ground[m.idx(x, y)] = G.SAND;
  const h = world.houses.get('atreides');
  h.credits = 0;
  h.startBuffer = 0;
  return { world, h, m };
}
const spiceSum = (m) => m.spice.reduce((a, b) => a + b, 0);
const field = (m, x0, y0, x1, y1, amount = 250) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.setSpice(m.idx(x, y), amount); };
const harvesters = (world) => [...world.units.values()].filter((u) => u.typeId === 'harvester');

test('a harvester on spice fills 700 in about 20 s and the ground loses exactly that', () => {
  const { world, m } = spiceWorld();
  field(m, 24, 10, 30, 11, 750);
  const u = world.spawnUnit('harvester', 'atreides', 24, 10);
  const before = spiceSum(m);
  const t = runUntil(world, () => u.harvest.load >= 700, 40);
  assert.ok(t > 19 && t < 22, `filled in ${t}s`);
  assert.equal(before - spiceSum(m), 700);
});

test('the full cycle: free harvester, field, dock, 700 credits, back to work', () => {
  const { world, h, m } = spiceWorld();
  field(m, 26, 8, 31, 13);
  world.spawnStructure('constructionYard', 'atreides', 4, 8);
  world.spawnStructure('refinery', 'atreides', 8, 8);
  const [u] = harvesters(world);
  assert.ok(u, 'a free harvester arrives with the refinery');
  assert.deepEqual([u.tx, u.ty], [10, 10], 'parked on the dock');
  assert.ok(world.events.drain().some((e) => e.type === 'eva' && e.key === 'harvesterDeployed'));
  assert.ok(runUntil(world, () => h.credits >= 699.9, 150) > 0, 'credits arrived');
  assert.ok(h.stats.spiceHarvested >= 699.9);
  run(world, 20);
  assert.ok(['seek', 'toField', 'harvesting'].includes(u.harvest.state), `back to work: ${u.harvest.state}`);
});

test('two harvesters share one refinery: one unloads while the other queues', () => {
  const { world, h, m } = spiceWorld();
  h.startBuffer = 5000;
  field(m, 30, 2, 36, 6);
  world.spawnStructure('refinery', 'atreides', 8, 8);
  const second = world.spawnUnit('harvester', 'atreides', 14, 14);
  for (const u of harvesters(world)) { u.harvest.load = 700; u.harvest.state = 'toRefinery'; u.harvest.target = -1; }
  let most = 0;
  for (let i = 0; i < 20 * 60 && h.credits < 1399.9; i++) {
    world.step();
    most = Math.max(most, harvesters(world).filter((u) => u.harvest.state === 'unloading').length);
  }
  assert.ok(h.credits >= 1399.9, `credits ${h.credits}`);
  assert.equal(most, 1);
  assert.equal(second.harvest.load < 700, true);
});

test('full storage loses spice but the harvester keeps working', () => {
  const { world, h, m } = spiceWorld();
  field(m, 30, 2, 36, 6);
  world.spawnStructure('refinery', 'atreides', 8, 8);
  const [u] = harvesters(world);
  h.credits = 1000;
  u.harvest.load = 700;
  u.harvest.state = 'toRefinery';
  assert.ok(runUntil(world, () => u.harvest.load === 0, 30) > 0);
  assert.equal(h.credits, 1005);
  assert.equal(world.events.drain().filter((e) => e.key === 'storageFull').length, 1);
  run(world, 2);
  assert.ok(['seek', 'toField'].includes(u.harvest.state));
});

test('selling the refinery mid-unload releases the harvester to another refinery', () => {
  const { world, h, m } = spiceWorld();
  h.startBuffer = 5000;
  const first = world.spawnStructure('refinery', 'atreides', 8, 8);
  world.spawnStructure('refinery', 'atreides', 8, 16);
  const u = harvesters(world).find((x) => x.tx === 10 && x.ty === 10);
  for (const other of harvesters(world)) if (other !== u) world.removeUnit(other);
  u.harvest.load = 700;
  u.harvest.state = 'toRefinery';
  runUntil(world, () => u.harvest.state === 'unloading', 5);
  run(world, 1);
  world.issue('atreides', { type: 'sell', structureId: first.id });
  assert.ok(runUntil(world, () => u.harvest.load === 0, 60) > 0, 'finished at the second refinery');
  assert.ok(Math.abs(h.credits + 0 - 700 - 200) < 1, `credits ${h.credits}`);   // 700 spice + 200 refund
});

test('a manual move suspends harvesting; a harvest order resumes it', () => {
  const { world, m } = spiceWorld();
  field(m, 24, 10, 30, 12, 750);
  const u = world.spawnUnit('harvester', 'atreides', 24, 10);
  run(world, 3);
  world.issue('atreides', { type: 'move', ids: [u.id], x: 12, y: 10 });
  runUntil(world, () => u.order.type === 'idle', 40);
  const load = u.harvest.load;
  run(world, 3);
  assert.equal(u.harvest.load, load, 'no harvesting away from spice');
  world.issue('atreides', { type: 'harvest', ids: [u.id], x: 26, y: 11 });
  assert.ok(runUntil(world, () => u.harvest.load > load, 40) > 0, 'harvesting resumed');
});

test('a harvester whose nudge move failed picks its routine up again', () => {
  const { world, m } = spiceWorld();
  field(m, 24, 10, 30, 12, 750);
  const u = world.spawnUnit('harvester', 'atreides', 14, 10);
  const routine = u.order;
  u.resumeOrder = routine;              // what nudge() saved …
  u.order = { type: 'idle' };           // … and what giveUp() leaves behind
  world.step();
  assert.equal(u.order, routine);
  assert.equal(u.resumeOrder, null);
});
