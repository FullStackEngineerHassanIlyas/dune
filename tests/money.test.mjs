import test from 'node:test';
import assert from 'node:assert/strict';
import { setupSkirmish } from '../src/game/setup.js';
import { LINES } from '../src/sim/production.js';
import { buildOptions } from '../src/sim/tech.js';
import { findPlacement } from '../src/sim/placement.js';

// Money is conserved (spec §4.3, §4.5): every credit a house gains or loses comes from a known source,
// and every credit paid into a production line ends up in a finished item (at its exact cost), back in
// the bank when the item is cancelled, or in an item still in hand — the one an upgrade set aside too.
// Storage is made unlimited so a refund is never cut short by a full store (that loss is the design).

const SOURCES = new Set(['production', 'harvest', 'repair-bay', 'structure-actions', 'starport', 'aftermath', 'capture']);

/** Watches every house's credits (by the sim file that changed them) and every item on its lines (by identity). */
function ledger(world) {
  const books = new Map();
  for (const h of world.houses.values()) {
    let credits = h.credits;
    h.startBuffer = 1e12;
    const b = { start: credits, by: {}, delivered: 0, cancelled: 0, wrong: [], low: 0, asides: new Set() };
    books.set(h.id, b);
    Object.defineProperty(h, 'credits', {
      get: () => credits,
      set: (v) => {
        const d = v - credits;
        credits = v;
        if (!d) return;
        const limit = Error.stackTraceLimit;
        Error.stackTraceLimit = 30;
        const files = new Error().stack.split('\n').map((l) => /\/src\/sim\/([\w-]+)\.js/.exec(l)?.[1]).filter((f) => f && f !== 'economy');
        Error.stackTraceLimit = limit;
        const key = `${files[0] ?? 'unknown'}${d > 0 ? '+' : '-'}`;
        b.by[key] = (b.by[key] ?? 0) + d;
        b.low = Math.min(b.low, v);
      },
    });
  }
  const inHand = (h) => LINES.flatMap((l) => [h.lines[l].current, h.lines[l].aside]).filter(Boolean);
  let prev = new Map();
  return {
    books,
    /** After each step: items that left a line were delivered (paid in full) or cancelled (refunded). */
    tick(events) {
      const now = new Map();
      for (const h of world.houses.values()) {
        for (const it of inHand(h)) now.set(it, h.id);
        for (const l of LINES) if (h.lines[l].aside) books.get(h.id).asides.add(h.lines[l].aside);
      }
      for (const [it, id] of prev) {
        if (now.has(it)) continue;
        const b = books.get(id);
        if (events.some((e) => e.type === 'productionCancelled' && e.house === id && e.typeId === it.typeId)) { b.cancelled += it.paid; continue; }
        b.delivered += it.paid;
        if (Math.abs(it.paid - it.cost) > 1e-6) b.wrong.push(`${it.typeId} left the line at ${world.time.toFixed(2)} s having paid ${it.paid.toFixed(2)} of ${it.cost}`);
      }
      prev = now;
    },
    check(h) {
      const b = books.get(h.id), hand = inHand(h).reduce((n, it) => n + it.paid, 0);
      const unknown = Object.keys(b.by).filter((k) => !SOURCES.has(k.slice(0, -1)));
      assert.deepEqual(unknown, [], `${h.id}: credits changed by ${unknown.join(', ')}`);
      assert.ok(b.low >= 0, `${h.id} went into debt: ${b.low}`);
      assert.deepEqual(b.wrong, [], h.id);
      const spent = -(b.by['production-'] ?? 0), refunded = b.by['production+'] ?? 0;
      assert.ok(Math.abs(spent - b.delivered - b.cancelled - hand) < 1e-6, `${h.id}: ${spent} paid into production, ${b.delivered} delivered, ${b.cancelled} cancelled, ${hand} in hand`);
      assert.ok(Math.abs(refunded - b.cancelled) < 1e-6, `${h.id}: ${b.cancelled} cancelled but ${refunded} refunded`);
      const total = Object.values(b.by).reduce((n, d) => n + d, b.start);
      assert.ok(Math.abs(total - h.credits) < 1e-6, `${h.id}: the books say ${total}, the bank ${h.credits}`);
      return b;
    },
  };
}

test('AI against AI: twelve game minutes without a credit made or lost', () => {
  const { world, house, rival } = setupSkirmish({ seed: 7, house: 'atreides', enemy: 'ordos', fog: false, aiPlayer: true, difficulty: 'normal' });
  const books = ledger(world);
  for (let t = 0; t < 12 * 60 * 20 && !world.outcome; t++) { world.step(); books.tick(world.events.drain()); }
  for (const id of [house, rival]) {
    const h = world.houses.get(id), b = books.check(h);
    assert.ok(Object.keys(h.upgrades).length > 0, `${id} bought no upgrades`);
    assert.ok(b.delivered > 5000, `${id} delivered only ${b.delivered}`);
  }
});

test('production chaos: builds, upgrades that set work aside, holds, cancels and lost factories keep the books straight', () => {
  const { world, house } = setupSkirmish({ seed: 3, house: 'ordos', enemy: 'harkonnen', fog: false, credits: 20000 });
  world.rules.victory = false;
  const h = world.houses.get(house);
  const mcv = [...world.units.values()].find((u) => u.house === house && u.typeId === 'mcv');
  world.issue(house, { type: 'deploy', ids: [mcv.id] });
  world.step();
  const books = ledger(world), yard = [...world.structures.values()].find((s) => s.house === house);
  const BASE = ['windtrap', 'windtrap', 'windtrap', 'windtrap', 'refinery', 'outpost', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'hiTech'];
  const FACTORIES = ['barracks', 'wor', 'lightFactory', 'heavyFactory', 'hiTech'];
  const restock = () => {   // lost factories come back, so every line keeps working
    const have = {}, need = {};
    for (const s of world.structures.values()) if (s.house === house) have[s.typeId] = (have[s.typeId] ?? 0) + 1;
    for (const t of BASE) {
      need[t] = (need[t] ?? 0) + 1;
      if ((have[t] ?? 0) >= need[t]) continue;
      const spot = findPlacement(world, house, t, yard.x + 1, yard.y + 1, 20);
      if (spot) { world.spawnStructure(t, house, spot.x, spot.y); have[t] = (have[t] ?? 0) + 1; }
    }
  };
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648, pick = (a) => a[Math.floor(rnd() * a.length)];
  for (let t = 0; t < 5 * 60 * 20; t++) {
    if (t % 600 === 0) restock();
    if (t % 400 === 199) for (const k of Object.keys(h.upgrades)) if (!LINES.some((l) => h.lines[l].current?.upgrade === k || h.lines[l].queue.includes(`upgrade:${k}`))) delete h.upgrades[k];   // upgrades stay on sale
    if (t % 10 === 0) {
      const o = buildOptions(world, house), all = LINES.flatMap((l) => o[l]), cur = h.lines.structure.current, r = rnd();
      if (cur?.state === 'ready') {
        const spot = findPlacement(world, house, cur.typeId, yard.x + 1, yard.y + 1, 14);
        world.issue(house, spot && rnd() < 0.8 ? { type: 'place', typeId: cur.typeId, x: spot.x, y: spot.y } : { type: 'hold', typeId: cur.typeId });
      }
      if (r < 0.35 && all.length) world.issue(house, { type: 'build', typeId: pick(all), count: 1 + Math.floor(rnd() * 3) });
      else if (r < 0.5 && o.upgrades.length) world.issue(house, { type: 'build', typeId: pick(o.upgrades) });
      else if (r < 0.65) {
        const l = h.lines[pick(LINES)], ids = [l.current?.typeId, ...l.queue].filter(Boolean);
        if (ids.length) world.issue(house, { type: 'hold', typeId: pick(ids) });
      } else if (r < 0.68) {
        const f = [...world.structures.values()].filter((s) => s.house === house && FACTORIES.includes(s.typeId));
        if (f.length && r < 0.665) world.issue(house, { type: 'sell', structureId: pick(f).id });
        else if (f.length) world.removeStructure(pick(f), 'destroyed');
      }
    }
    for (const l of LINES) {   // an order in the very tick an upgrade frees the line, before the item it set aside is back
      const o = buildOptions(world, house)[l];
      if (h.lines[l].aside && !h.lines[l].current && o?.length && rnd() < 0.5) world.issue(house, { type: 'build', typeId: pick(o) });
    }
    world.step();
    books.tick(world.events.drain());
    for (const l of LINES) {
      const line = h.lines[l];
      if (line.aside) assert.ok(line.queue.includes(line.aside.typeId) && (!line.current || line.current.upgrade), `${l} at ${world.time} s: ${line.aside.typeId} aside, ${line.current?.typeId} in hand, queue ${line.queue}`);
    }
  }
  const b = books.check(h);
  assert.ok(b.asides.size >= 10, `only ${b.asides.size} items were set aside`);
  assert.ok(b.cancelled > 0 && b.delivered > 0);
});
