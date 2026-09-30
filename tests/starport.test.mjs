import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { UNITS } from '../src/data/units.js';
import { flatWorld, run } from './helpers.mjs';

export function port(house = 'atreides', credits = 5000) {
  const world = flatWorld(48, 32, G.ROCK);
  const h = world.houses.get(house);
  h.credits = credits;
  h.startBuffer = 100000;
  world.spawnStructure('windtrap', house, 1, 1);
  const s = world.spawnStructure('starport', house, 20, 12);
  world.step();   // the market opens
  return { world, h, s };
}

test('a Starport opens a market of the house\'s vehicles and aircraft at 40–160 % of their cost', () => {
  const { h } = port();
  assert.deepEqual(Object.keys(h.starport.stock), ['trike', 'quad', 'combatTank', 'missileTank', 'siegeTank', 'harvester', 'mcv', 'carryall', 'ornithopter']);
  for (const [t, n] of Object.entries(h.starport.stock)) {
    assert.ok(n >= 2 && n <= 6, `${t} stock ${n}`);
    const price = h.starport.price[t], cost = UNITS[t].cost, tenth = Math.floor(cost / 10);
    assert.ok(price >= 4 * tenth && price <= Math.min(999, 16 * tenth) && (price === 999 || price % tenth === 0), `${t} at ${price}`);
  }
  assert.deepEqual(Object.keys(port('ordos').h.starport.stock), ['raider', 'quad', 'combatTank', 'missileTank', 'siegeTank', 'harvester', 'mcv', 'carryall', 'ornithopter']);
  assert.deepEqual(Object.keys(port('harkonnen').h.starport.stock), ['quad', 'combatTank', 'missileTank', 'siegeTank', 'harvester', 'mcv', 'carryall']);
});

test('prices change every minute; stock grows by one every 90 s, up to ten', () => {
  const { world, h } = port();
  const before = { ...h.starport.price };
  run(world, 61);
  assert.notDeepEqual(h.starport.price, before);
  const stock = { ...h.starport.stock };
  run(world, 30);
  for (const t of Object.keys(stock)) assert.equal(h.starport.stock[t], Math.min(10, stock[t] + 1));
  run(world, 90 * 8);
  assert.ok(Object.values(h.starport.stock).every((n) => n === 10));
});

test('an order is paid at once and books a Frigate for 30 s later; later orders join its load', () => {
  const { world, h } = port();
  const price = h.starport.price.quad, stock = h.starport.stock.quad;
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  assert.ok(Math.abs(h.credits - (5000 - price)) < 1e-6);
  assert.equal(h.starport.stock.quad, stock - 1);
  const b = h.starport.batch;
  assert.ok(Math.abs(b.landAt - (world.time - 0.05 + 30)) < 1e-6, `lands at ${b.landAt}`);
  assert.ok(b.spawnAt > world.time && b.spawnAt < b.landAt, 'the Frigate sets off in time to land then');
  run(world, 10);
  world.issue('atreides', { type: 'starportOrder', typeId: 'combatTank', count: 2 });
  world.step();
  assert.deepEqual(b.items.map((i) => i.typeId), ['quad', 'combatTank', 'combatTank']);
  assert.equal(h.starport.batch, b, 'the same batch');
});

test('an order can be cancelled for a refund until the Frigate lands', () => {
  const { world, h } = port();
  world.issue('atreides', { type: 'starportOrder', typeId: 'trike', count: 2 });
  world.step();
  const credits = h.credits, stock = h.starport.stock.trike;
  world.issue('atreides', { type: 'starportCancel', typeId: 'trike' });
  world.step();
  assert.ok(h.credits > credits);
  assert.equal(h.starport.stock.trike, stock + 1);
  assert.equal(h.starport.batch.items.length, 1);
  world.issue('atreides', { type: 'starportCancel', typeId: 'trike' });
  world.step();
  assert.equal(h.starport.batch, null, 'nothing left to bring');
  assert.ok(Math.abs(h.credits - 5000) < 1e-6);
});

test('no Starport, no stock, no money, a full hold: no order', () => {
  const { world, h, s } = port();
  h.starport.stock.mcv = 0;
  world.issue('atreides', { type: 'starportOrder', typeId: 'mcv' });
  world.issue('atreides', { type: 'starportOrder', typeId: 'raider' });   // an Ordos ware
  world.step();
  const events = world.events.drain();
  assert.equal(h.starport.batch, null);
  assert.ok(events.some((e) => e.type === 'eva' && e.key === 'soldOut'));
  assert.ok(events.some((e) => e.type === 'commandRejected' && e.typeId === 'raider'));
  h.credits = 10;
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  assert.equal(h.starport.batch, null);
  assert.equal(h.credits, 10, 'nothing charged');
  h.credits = 20000;
  for (const t of Object.keys(h.starport.stock)) h.starport.stock[t] = 10;
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad', count: 5 });
  world.issue('atreides', { type: 'starportOrder', typeId: 'trike', count: 5 });
  world.step();
  assert.equal(h.starport.batch.items.length, 9, 'a Frigate carries nine');
  assert.ok(world.events.drain().some((e) => e.type === 'eva' && e.key === 'frigateFull'));
  world.removeStructure(s);
  const credits = h.credits;
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  assert.equal(h.credits, credits, 'no Starport: no order');
});

import { runUntil } from './helpers.mjs';
import { checkInvariants } from '../src/sim/invariants.js';
import { findTarget } from '../src/sim/combat.js';

const units = (world, typeId) => [...world.units.values()].filter((u) => u.typeId === typeId);

test('the Frigate flies in from the map edge, lands on the pad 30 s after the first order, unloads and leaves', () => {
  const { world, h, s } = port();
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.issue('atreides', { type: 'starportOrder', typeId: 'carryall' });
  world.step();
  world.events.drain();
  const t = runUntil(world, () => units(world, 'quad').length > 0, 40);
  assert.ok(t > 28.5 && t < 30.5, `delivered after ${t + 0.05} s`);
  const events = world.events.drain();
  assert.ok(events.some((e) => e.type === 'eva' && e.key === 'frigateArrived'));
  const [quad] = units(world, 'quad'), [carry] = units(world, 'carryall');
  assert.ok(Math.hypot(quad.x - (s.x + 1.5), quad.y - (s.y + 1.5)) < 5, 'set down around the pad');
  assert.ok(carry && !carry.isGround, 'the Carryall lifts off the pad');
  assert.deepEqual(checkInvariants(world), []);
  assert.ok(runUntil(world, () => units(world, 'frigate').length === 0, 30) > 0, 'the Frigate leaves');
  assert.equal(h.starport.batch, null);
  world.issue('atreides', { type: 'starportOrder', typeId: 'trike' });
  world.step();
  assert.ok(h.starport.batch && h.starport.batch.items.length === 1, 'a new batch');
});

test('a Frigate cannot be targeted, picked or ordered', () => {
  const { world } = port();
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  assert.ok(runUntil(world, () => units(world, 'frigate').length > 0, 30) > 0);
  const [f] = units(world, 'frigate');
  assert.equal(findTarget(world, 'harkonnen', f.x, f.y, 5, { air: true }), null);
  world.issue('atreides', { type: 'move', ids: [f.id], x: 2, y: 2 });
  world.step();
  assert.notEqual(f.order.type, 'move');
});

test('if the Starport falls before the Frigate lands, it still lands where it stood', () => {
  const { world, s } = port();
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  run(world, 5);
  world.removeStructure(s);
  assert.ok(runUntil(world, () => units(world, 'quad').length > 0, 30) > 0);
  const [quad] = units(world, 'quad');
  assert.ok(Math.hypot(quad.x - (s.x + 1.5), quad.y - (s.y + 1.5)) < 5);
});

test('units wait aboard until there is room around the pad', () => {
  const { world, h, s } = port();
  const map = world.map;
  const blockers = [];
  for (let y = s.y - 5; y <= s.y + s.h + 4; y++) for (let x = s.x - 5; x <= s.x + s.w + 4; x++) {
    if (!map.inBounds(x, y) || map.structure[map.idx(x, y)] || map.unit[map.idx(x, y)]) continue;
    blockers.push(world.spawnUnit('soldier', 'atreides', x, y));   // own troops everywhere around the pad
  }
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  run(world, 32);
  assert.equal(units(world, 'quad').length, 0, 'no room: still aboard');
  assert.ok(h.starport.batch?.landed);
  world.removeUnit(blockers.find((u) => u.tx === s.x - 1 && u.ty === s.y));   // one steps aside next to the pad
  assert.ok(runUntil(world, () => units(world, 'quad').length === 1, 2) >= 0);
  assert.deepEqual(checkInvariants(world), []);
});

test('a cancel that empties the batch sends the Frigate away', () => {
  const { world, h } = port();
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  assert.ok(runUntil(world, () => units(world, 'frigate').length > 0, 30) > 0);
  world.issue('atreides', { type: 'starportCancel', typeId: 'quad' });
  world.step();
  assert.equal(h.starport.batch, null);
  assert.ok(runUntil(world, () => units(world, 'frigate').length === 0, 30) >= 0, 'it turns back (here at once: it was still at the edge)');
  assert.equal(units(world, 'quad').length, 0);
});

test('an order says so; a malformed ware is refused without touching the credits', () => {
  const { world, h } = port();
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  assert.ok(world.events.drain().some((e) => e.type === 'eva' && e.key === 'ordered'));
  const credits = h.credits;
  world.issue('atreides', { type: 'starportOrder', typeId: 'constructor' });
  world.step();
  assert.equal(h.credits, credits);
  assert.ok(world.events.drain().some((e) => e.type === 'commandRejected' && e.typeId === 'constructor'));
});

test('when the ring round the pad is full, the Frigate looks further out after a while', () => {
  const { world, s } = port();
  const map = world.map;
  for (let y = s.y - 4; y <= s.y + s.h + 3; y++) for (let x = s.x - 4; x <= s.x + s.w + 3; x++) {
    if (map.inBounds(x, y) && !map.structure[map.idx(x, y)] && !map.unit[map.idx(x, y)]) world.spawnUnit('soldier', 'atreides', x, y);
  }
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  assert.ok(runUntil(world, () => units(world, 'quad').length === 1, 45) > 0, 'delivered further out');
  const [quad] = units(world, 'quad');
  assert.ok(Math.max(Math.abs(quad.tx - (s.x + 1)), Math.abs(quad.ty - (s.y + 1))) > 5);
});

test('a Frigate on its way turns back when its last order is cancelled', () => {
  const { world, h } = port();
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  assert.ok(runUntil(world, () => units(world, 'frigate').some((f) => f.y > 4), 30) > 0, 'well on its way');
  const [f] = units(world, 'frigate');
  const y = f.y;
  world.issue('atreides', { type: 'starportCancel', typeId: 'quad' });
  run(world, 1);
  assert.ok(world.units.has(f.id) && f.y < y, 'heading back to the edge');
  assert.ok(runUntil(world, () => !world.units.has(f.id), 20) > 0);
  assert.equal(units(world, 'quad').length, 0);
  assert.equal(h.starport.batch, null);
});

import { destroyStructure } from '../src/sim/combat.js';

test('a batch whose Starport is lost goes to the house\'s other Starport', () => {
  const { world, h, s } = port();
  const other = world.spawnStructure('starport', 'atreides', 30, 20);   // say, a captured one
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  run(world, 1);
  destroyStructure(world, s);
  run(world, 1);
  assert.equal(h.starport.batch.structureId, other.id);
  assert.deepEqual(h.starport.batch.pad, { x: 31.5, y: 21.5 });
  assert.ok(runUntil(world, () => units(world, 'quad').length > 0, 60) > 0);
  const [q] = units(world, 'quad');
  assert.ok(Math.hypot(q.x - 31.5, q.y - 21.5) < 6, 'delivered at the Starport that stands');
});

test('a right click on a ware while the Frigate unloads says why nothing happens', () => {
  const { world, h } = port();
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  assert.ok(runUntil(world, () => h.starport.batch?.landed, 40) > 0);
  world.events.drain();
  world.issue('atreides', { type: 'starportCancel', typeId: 'quad' });
  world.step();
  assert.ok(world.events.drain().some((e) => e.type === 'eva' && e.key === 'busy'));
});
