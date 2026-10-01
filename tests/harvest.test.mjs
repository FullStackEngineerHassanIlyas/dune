import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { wrapAngle } from '../src/sim/geometry.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { destroyStructure } from '../src/sim/combat.js';
import { createBrain } from '../src/sim/ai.js';
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

// Review fix-pass tests: the dock must not move or stay blocked.
function loaded(world, x, y) {
  const u = world.spawnUnit('harvester', 'atreides', x, y);
  u.harvest.load = 700;
  u.harvest.state = 'toRefinery';
  u.harvest.target = -1;
  return u;
}

test('a refinery whose pad tile is covered by a silo still takes deliveries', () => {
  const { world, h } = spiceWorld();
  h.startBuffer = 5000;
  world.spawnStructure('refinery', 'atreides', 8, 8);
  for (const u of harvesters(world)) world.removeUnit(u);
  world.spawnStructure('silo', 'atreides', 10, 10);   // covers (10,10), the tile south of the pad column
  loaded(world, 4, 16);
  assert.ok(runUntil(world, () => h.credits >= 699.9, 90) > 0, `credits ${h.credits}`);
});

test('a mountain on the pad tile does not stop deliveries', () => {
  const { world, h, m } = spiceWorld();
  h.startBuffer = 5000;
  m.ground[m.idx(10, 10)] = G.MOUNTAIN;
  world.spawnStructure('refinery', 'atreides', 8, 8);
  for (const u of harvesters(world)) world.removeUnit(u);
  loaded(world, 4, 16);
  assert.ok(runUntil(world, () => h.credits >= 699.9, 90) > 0, `credits ${h.credits}`);
});

test('a tank parked on the dock is moved aside and the harvester unloads', () => {
  const { world, h } = spiceWorld();
  h.startBuffer = 5000;
  world.spawnStructure('refinery', 'atreides', 8, 8);
  for (const u of harvesters(world)) world.removeUnit(u);
  world.spawnUnit('combatTank', 'atreides', 10, 10);
  loaded(world, 4, 16);
  assert.ok(runUntil(world, () => h.credits >= 699.9, 90) > 0, `credits ${h.credits}`);
});

test('when the field runs dry every harvester still delivers its load', () => {
  const { world, h, m } = spiceWorld();
  h.startBuffer = 50000;
  field(m, 24, 10, 30, 11, 250);   // 1500 spice
  world.spawnStructure('refinery', 'atreides', 8, 8);
  world.spawnUnit('harvester', 'atreides', 22, 12);
  world.spawnUnit('harvester', 'atreides', 22, 8);
  run(world, 240);
  assert.equal(spiceSum(m), 0);
  assert.ok(harvesters(world).every((u) => u.harvest.load === 0), `loads ${harvesters(world).map((u) => u.harvest.load)}`);
  assert.ok(Math.abs(h.credits - 1500) < 1e-6, `credits ${h.credits}`);
});

// Docking in the refinery's drop-zone slot (research: structures.md "Spice Refinery").
const cheb = (u, x, y) => Math.max(Math.abs(u.tx - x), Math.abs(u.ty - y));
const atRest = (u) => !u.step && u.pathState !== 'waiting' && !(u.pathState === 'ready' && u.pathIndex < u.path.length);
const noseIn = (u) => Math.abs(wrapAngle(u.heading + Math.PI / 2)) < 0.05;

function dockedWorld(house = 'atreides') {
  const { world, h, m } = spiceWorld();
  const home = world.houses.get(house);
  home.credits = 0;
  home.startBuffer = 50000;
  field(m, 30, 2, 36, 6);
  const ref = world.spawnStructure('refinery', house, 8, 8);   // pad column x = 10, entrance 10,10
  const [u] = harvesters(world);
  u.harvest.load = 700;
  u.harvest.state = 'toRefinery';
  u.harvest.target = -1;
  return { world, h: home, m, ref, u };
}

test('a harvester drives into the refinery\'s slot, unloads on the pad and backs out', () => {
  const { world, h, m, ref, u } = dockedWorld();
  assert.deepEqual([u.tx, u.ty], [10, 10], 'starts on the entrance');
  assert.ok(runUntil(world, () => u.harvest.state === 'unloading', 5) > 0, 'docked');
  assert.equal(u.inside, ref.id);
  assert.equal(u.docked, ref.id);
  assert.equal(ref.dockedBy, u.id);
  assert.ok(u.x > 10 && u.x < 11 && u.y > 8.5 && u.y < 10, `on the pad inside the footprint at ${u.x},${u.y}`);
  assert.ok(noseIn(u), `nose in (heading ${u.heading})`);
  assert.equal(m.unit[m.idx(10, 10)], 0, 'the entrance is clear while it unloads');
  assert.deepEqual(checkInvariants(world), []);
  const before = h.credits;
  run(world, 1);
  assert.ok(h.credits > before, 'credits flow while it sits on the pad');
  assert.equal(u.inside, ref.id);
  assert.ok(runUntil(world, () => !u.inside, 10) > 0, 'out again');
  assert.ok(Math.abs(h.credits - 700) < 1e-6, `credits ${h.credits}`);
  assert.deepEqual([u.tx, u.ty], [10, 10], 'backed out onto the entrance');
  assert.ok(noseIn(u), 'in reverse: still facing the refinery');
  assert.equal(m.unit[m.idx(10, 10)], u.id);
  assert.equal(ref.dockedBy || 0, 0);
  assert.deepEqual(checkInvariants(world), []);
  run(world, 3);
  assert.ok(['seek', 'toField', 'harvesting'].includes(u.harvest.state), `back to work: ${u.harvest.state}`);
});

test('one harvester in the slot at a time; the others wait close by without blocking the entrance', () => {
  const { world, h, m } = spiceWorld();
  h.startBuffer = 50000;
  const ref = world.spawnStructure('refinery', 'atreides', 8, 8);
  for (const u of harvesters(world)) world.removeUnit(u);
  const team = [loaded(world, 4, 16), loaded(world, 14, 16), loaded(world, 16, 11)];
  const door = m.idx(10, 10);
  let most = 0, blocking = 0, waited = false, problems = [];
  for (let i = 0; i < 20 * 90 && h.credits < 2099.9; i++) {
    world.step();
    most = Math.max(most, team.filter((u) => u.docked === ref.id).length);
    for (const u of team) {
      if (u.harvest.state !== 'queued' || !atRest(u)) continue;
      if (m.unit[door] === u.id) blocking++;
      if (cheb(u, 10, 10) <= 3) waited = true;
    }
    if (i % 20 === 0 && !problems.length) problems = checkInvariants(world);
  }
  assert.ok(h.credits >= 2099.9, `credits ${h.credits}`);
  assert.equal(most, 1, 'never two in the slot');
  assert.ok(waited, 'the others queued beside the entrance');
  assert.equal(blocking, 0, 'no queued harvester parked on the entrance');
  assert.deepEqual(problems, []);
});

for (const how of ['sold', 'destroyed']) {
  test(`a harvester in a refinery that is ${how} is set down safely and takes its load elsewhere`, () => {
    const { world, h } = spiceWorld();
    h.startBuffer = 50000;
    const first = world.spawnStructure('refinery', 'atreides', 8, 8);
    world.spawnStructure('refinery', 'atreides', 8, 16);
    const u = harvesters(world).find((x) => x.tx === 10 && x.ty === 10);
    for (const other of harvesters(world)) if (other !== u) world.removeUnit(other);
    u.harvest.load = 700;
    u.harvest.state = 'toRefinery';
    assert.ok(runUntil(world, () => u.harvest.state === 'unloading', 5) > 0);
    run(world, 1);
    const left = u.harvest.load;
    if (how === 'sold') world.issue('atreides', { type: 'sell', structureId: first.id });
    else destroyStructure(world, first);
    world.step();
    assert.ok(world.units.has(u.id), 'it survives');
    assert.ok(!u.inside && !u.docked, 'set down');
    assert.equal(world.map.unit[world.map.idx(u.tx, u.ty)], u.id);
    assert.deepEqual(checkInvariants(world), []);
    assert.ok(u.harvest.load > 0 && u.harvest.load <= left, `still carrying ${u.harvest.load}`);
    assert.ok(runUntil(world, () => u.harvest.load === 0, 60) > 0, 'unloaded at the other refinery');
  });
}

test('a docked harvester takes a move order once it has backed out, with what it has left', () => {
  const { world, ref, u } = dockedWorld();
  assert.ok(runUntil(world, () => u.harvest.state === 'unloading', 5) > 0);
  run(world, 1);
  world.issue('atreides', { type: 'move', ids: [u.id], x: 4, y: 16 });
  run(world, 0.2);
  assert.ok(u.inside === ref.id || u.harvest.state === 'undocking' || !u.inside, 'leaving');
  assert.ok(runUntil(world, () => !u.inside, 5) > 0, 'backs out');
  assert.ok(u.harvest.load > 0, 'with what it had left');
  assert.ok(runUntil(world, () => u.tx === 4 && u.ty === 16, 30) > 0, 'then drives off');
});

test('a harvest order to a docked harvester picks its next field and lets it finish unloading', () => {
  const { world, m, ref, u } = dockedWorld();
  assert.ok(runUntil(world, () => u.harvest.state === 'unloading', 5) > 0);
  world.issue('atreides', { type: 'harvest', ids: [u.id], x: 32, y: 4 });
  run(world, 0.5);
  assert.equal(u.inside, ref.id, 'keeps unloading');
  assert.ok(runUntil(world, () => u.harvest.load === 0, 10) > 0);
  assert.equal(u.harvest.field, m.idx(32, 4));
  assert.ok(runUntil(world, () => u.harvest.state === 'harvesting' && cheb(u, 32, 4) <= 3, 40) > 0, 'harvesting at the new field');
});

test('computer-controlled harvesters dock in the slot the same way', () => {
  const { world, ref, u } = dockedWorld('harkonnen');
  createBrain(world, 'harkonnen', 'normal');
  assert.ok(runUntil(world, () => u.docked === ref.id && u.harvest.state === 'unloading', 5) > 0);
  assert.ok(runUntil(world, () => u.harvest.load === 0 && !u.inside, 15) > 0);
  assert.deepEqual([u.tx, u.ty], [10, 10]);
});

test('a harvester the Carryall set down beside a busy refinery queues off the entrance', () => {
  const { world, m, ref, u } = dockedWorld();
  assert.ok(runUntil(world, () => u.harvest.state === 'unloading', 5) > 0);
  const late = loaded(world, 10, 10);   // set down right on the entrance
  run(world, 3);
  assert.equal(late.harvest.state, 'queued');
  assert.notEqual(m.unit[m.idx(10, 10)], late.id, 'moved off the entrance');
  assert.ok(cheb(late, 10, 10) <= 3, `waits close by at ${late.tx},${late.ty}`);
  assert.ok(runUntil(world, () => late.docked === ref.id, 20) > 0, 'its turn');
});

test('a damaged refinery refines more slowly, never below a third of the rate', () => {
  const secs = (hp) => {
    const { world, ref, u } = dockedWorld();
    ref.hp = ref.maxHp * hp;
    assert.ok(runUntil(world, () => u.harvest.state === 'unloading', 5) > 0);
    return runUntil(world, () => u.harvest.load === 0, 30);
  };
  const full = secs(1), half = secs(0.5), wreck = secs(0.05);
  assert.ok(Math.abs(full - 5) < 0.2, `full health: ${full}s`);
  assert.ok(Math.abs(half - 10) < 0.3, `half health: ${half}s`);
  assert.ok(Math.abs(wreck - 15) < 0.4, `a wreck: ${wreck}s`);
});

// Review (logistics): the slot is never held for good.
test('a harvester whose entrance was built over while it unloaded backs out by the new one, friends making room', () => {
  const { world, m, ref, u } = dockedWorld();
  assert.ok(runUntil(world, () => u.harvest.state === 'unloading', 5) > 0);
  world.spawnStructure('windtrap', 'atreides', 10, 10);   // over the entrance 10,10 (the AI packs its base like this)
  for (let y = 7; y <= 10; y++) for (let x = 7; x <= 11; x++) {   // idle troops on every other tile around the refinery
    const i = m.idx(x, y);
    if (!m.structure[i] && !m.unit[i]) world.spawnUnit('combatTank', 'atreides', x, y);
  }
  assert.ok(runUntil(world, () => !u.inside, 20) > 0, 'out of the slot');
  assert.equal(ref.dockedBy || 0, 0, 'the slot is free again');
  assert.deepEqual(checkInvariants(world), []);
});

test('a unit parked in an entrance with one way out is let out before the harvester drives in', () => {
  const { world, h, m, ref } = dockedWorld();
  for (const u of harvesters(world)) world.removeUnit(u);
  world.spawnStructure('wall', 'atreides', 9, 10);   // the entrance 10,10 is an alcove: in and out by 11,10 only
  world.spawnStructure('wall', 'atreides', 10, 11);
  world.spawnStructure('wall', 'atreides', 11, 11);
  world.spawnUnit('soldier', 'atreides', 10, 10);
  const u = loaded(world, 11, 10);   // right at its mouth
  assert.ok(runUntil(world, () => u.docked === ref.id, 40) > 0, `docked (stuck at ${u.tx},${u.ty})`);
  assert.ok(runUntil(world, () => h.credits >= 699.9, 20) > 0);
});

test('a harvester whose entrance became a closed pocket with a unit stuck in it still backs out', () => {
  const { world, m, ref, u } = dockedWorld();
  assert.ok(runUntil(world, () => u.harvest.state === 'unloading', 5) > 0);
  world.spawnUnit('soldier', 'atreides', 10, 10);   // on the entrance …
  world.spawnStructure('wall', 'atreides', 9, 10);   // … walled in on every side but the refinery's
  world.spawnStructure('wall', 'atreides', 11, 10);
  for (let x = 9; x <= 11; x++) world.spawnStructure('wall', 'atreides', x, 11);
  assert.ok(runUntil(world, () => !u.inside, 20) > 0, 'out of the slot by another side');
  assert.equal(ref.dockedBy || 0, 0);
  assert.deepEqual(checkInvariants(world), []);
});
