# Plan 2c — Starport, Frigate and House of IX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the Starport and the House of IX.

- **The Starport** is a market of the house's standard vehicles and aircraft, with stock and changing prices. Orders are paid at once and delivered by a Frigate that lands on the pad 30 s after the first order of a batch.
- **The House of IX** makes the Ornithopter (and later the house specials) buildable. The computer builds both.
- **Plan 2b's three deferred minors** are closed.

**Architecture:**
- **Market and Frigate.** `src/sim/starport.js` owns a per-house market (`house.starport`: stock, prices, the open batch) and the Frigate's brain. The Frigate is an untargetable, autonomous aircraft that flies with plan 2b's `hoverTo`/`climb`.
- **Orders.** They are commands (`starportOrder`, `starportCancel`), validated like the rest.
- **Sidebar.** Starport wares join the unit strip as entries keyed `starport:<unit>`, with an order and a cancel command, a price, stock and batch count, and a "$" icon badge.
- **Models.** New models for the Starport, the Frigate and the House of IX.

**Tech Stack:** as before — ES modules, vendored Three.js 0.186.1, Node 24 `node:test`, headless Chrome over CDP.

**Spec:** `docs/superpowers/specs/2026-09-28-dune2-3d-design.md`:

- **§4.5 Starport:** "sells standard vehicles and aircraft for the house; each type has stock (2–6, +1 every 90 s, cap 10) and a price re-rolled every 60 s with the original 40–160 % formula. Orders are paid immediately; a Frigate lands on the pad 30 s after the first order of a batch ("Frigate has arrived") and unloads everything".
- **§4.5 prerequisites:** Starport ← Refinery; House of IX ← Starport.
- **§4.5 rosters:** Ordos get the Missile Tank via the Starport.
- **§5.3 models:** Starport, House of IX, Frigate.
- **§6:** "Frigate has arrived".

Research: `docs/research/raw/structures.md` ("Starport", "House of IX"), `units.md` ("Frigate") and `mechanics-campaign.md` §2.5. Deferred minors: `docs/superpowers/notes/2026-09-30-plan2b-execution-notes.md`.

## Global Constraints

- Everything from plans 1a–2b holds:
  - pure deterministic sim (`world.rng` only in `src/sim`);
  - commands validated in `orders.js`;
  - instanced rendering;
  - English text;
  - no original assets;
  - commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Price formula (original `GUI_FactoryWindow_CalculateStarportPrice`): `price = floor(cost / 10) × (4 + rand(0..6) + rand(0..6))`, capped at 999.
- Timings (spec): stock starts at 2–6, grows +1 every 90 s up to 10, prices re-roll every 60 s, and the Frigate lands 30 s after the first order.
- The house specials (Sonic Tank, Deviator, Devastator), the Palace and its weapons stay deferred to plan 2d.

## Rulings built into this plan

The spec is silent on these, or the research sources disagree.

- **Stock growth.** "+1 every 90 s" is read per type: every type gains one each 90 s. The original raised one random type every 1800 ticks.
- **Price re-rolls.** Prices re-roll on the spec's 60 s clock. The original re-rolled every time the order screen opened.
- **One Starport per house**, as in the original. It gives a single pad for the Frigate.
- **Batches.** A batch holds at most 9 units (one Frigate load).
- **Cancelling.** An order can be cancelled for a full refund until the Frigate lands. This is the sidebar's right-click convention; the original had no cancel. If a cancel empties the batch, the Frigate turns back.
- **Lost Starport.** The Frigate still lands where the Starport stood and unloads there. The research disagrees on whether the original dropped the cargo at a random spot or got stuck.
- **The Frigate** cannot be targeted, selected or ordered. It comes from the map edge nearest the Starport, and it is timed to land exactly 30 s after the first order.
- **The computer** builds a Starport and a House of IX (for Ornithopters) but never buys from the Starport, as in the original.

## Review Focus

1. **Orders around the Frigate's arrival** — an order placed just before landing joins the load; one placed during unloading is refused; a new batch starts after the Frigate unloads; a cancel that empties the batch sends the Frigate away. → Task 2 and Task 3 tests.
2. **The Starport lost, sold or captured with a Frigate on its way** — the delivery still happens where it stood, and nothing is lost or duplicated. → Task 3 test "if the Starport falls before the Frigate lands, it still lands where it stood".
3. **No room around the pad** — units wait in the Frigate until a tile frees up, and are never put on a unit or a building. → Task 3 test "units wait aboard until there is room".
4. **Money and stock edges** — insufficient credits, stock at zero, a full hold, wares of another house, no Starport: refused, with the right message, and nothing charged. → Task 2 test "no Starport, no stock, no money, a full hold: no order".
5. **The House of IX lost with an Ornithopter in production** — the Ornithopter is cancelled and refunded, the same as any lost prerequisite. → Task 1 test.

## File map (new and changed)

```
src/data/phase.js             Starport and House of IX no longer deferred
src/data/structures.js        the Starport is unique
src/data/units.js             the Frigate is autonomous and untargetable
src/data/tuning.js            STARPORT (wares, stock, restock, reprice, delivery, load)
src/sim/tech.js               unique structures
src/sim/starport.js     NEW   market, orders, cancels, Frigate brain
src/sim/air.js                nearestEdge(); the Frigate in updateAircraft
src/sim/carryall.js           deliverByAir uses nearestEdge
src/sim/world.js              updateStarports in the step
src/sim/orders.js             starportOrder, starportCancel
src/sim/combat.js             untargetable units; homing stops when the target is lifted away
src/sim/ai.js                 Starport and House of IX in the build order; aircraft on guard rejoin waves
src/render/models/structures/starport.js, structures/house-of-ix.js, units/frigate.js   NEW models
src/render/models/index.js    registry
src/render/views/structure-views.js  Starport pad lights while a Frigate is due
src/render/icons.js           Starport icons with a "$" badge
src/ui/sidebar-model.js       Starport wares in the unit strip
src/ui/sidebar.js             order and cancel commands per entry
src/ui/selection-panel.js     Starport details
src/audio/cues.js             sold out and full hold are errors
src/input/controller.js       no attack cursor on aircraft without anti-air; untargetable units cannot be picked
src/scenes/{structures,gallery,base}.js, scripts/scenarios.mjs, scripts/e2e.mjs, README.md
```

---

### Task 1: Starport and House of IX in the tech tree

**Files:**
- Modify: `src/data/phase.js`, `src/data/structures.js`, `src/data/units.js`, `src/data/tuning.js`, `src/sim/tech.js`
- Test: `tests/tech.test.mjs`, `tests/upgrades.test.mjs`

**Interfaces:**
- Produces:
  - `starport` and `ix` are buildable, and `starport.unique` limits a house to one Starport.
  - `frigate.autonomous` and `frigate.untargetable`.
  - `STARPORT` in tuning.js.
  - The Hi-Tech upgrade is now on sale (the Ornithopter needs a House of IX, which can now be built).

- [ ] **Step 1: Write the failing tests**

Modify `tests/tech.test.mjs`:
- in `each prerequisite opens the next buildings` the second expected list becomes `['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'lightFactory', 'heavyFactory', 'hiTech', 'repair', 'wall', 'turret', 'starport']`;
- append:
```js
test('a Starport opens after a Refinery, one per house; a House of IX needs it; losing IX cancels an Ornithopter', () => {
  const world = withStructures('atreides', ['constructionYard', 'windtrap', 'refinery']);
  assert.ok(buildOptions(world, 'atreides').structure.includes('starport'));
  assert.ok(!buildOptions(world, 'atreides').structure.includes('ix'));
  world.spawnStructure('starport', 'atreides', 30, 30);
  const o = buildOptions(world, 'atreides').structure;
  assert.ok(o.includes('ix') && !o.includes('starport'), 'one Starport at a time');
  const h = world.houses.get('atreides');
  h.credits = 5000;
  h.startBuffer = 100000;
  const hq = world.spawnStructure('hiTech', 'atreides', 20, 20);
  const ix = world.spawnStructure('ix', 'atreides', 26, 20);
  h.upgrades.hiTech = 1;
  world.issue('atreides', { type: 'build', typeId: 'ornithopter' });
  for (let k = 0; k < 100; k++) world.step();
  assert.equal(h.lines.air.current?.typeId, 'ornithopter');
  world.removeStructure(ix);
  for (let k = 0; k < 22; k++) world.step();
  assert.equal(h.lines.air.current, null, 'no House of IX: cancelled');
  assert.ok(Math.abs(h.credits - 5000) < 1e-6, 'refunded');
  assert.ok(hq);
});
```

Modify `tests/upgrades.test.mjs` — replace the whole test `the Hi-Tech upgrade waits until it opens something: the Ornithopter needs the House of IX (plan 2c)` with:
```js
test('the Hi-Tech upgrade opens the Ornithopter, never for the Harkonnen', () => {
  const at = withStructures('atreides', ['constructionYard', 'hiTech']);
  assert.deepEqual(upgradeUnlocks('atreides', 'hiTech', 0, 1), ['Ornithopter']);
  assert.equal(canBuild(at, 'atreides', upgradeId('hiTech')), true);
  const hk = withStructures('harkonnen', ['constructionYard', 'hiTech']);
  assert.equal(canBuild(hk, 'harkonnen', upgradeId('hiTech')), false);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/tech.test.mjs tests/upgrades.test.mjs`
Expected: FAIL — the Starport and the House of IX are still deferred.

- [ ] **Step 3: Implement**

Modify `src/data/phase.js` — replace `  'starport', 'ix', 'palace',\n` with `  'palace',\n`.

Modify `src/data/structures.js` — replace `houses: ALL, tech: 6, conquerable: true },` (the Starport line) with `houses: ALL, tech: 6, conquerable: true, unique: true },`.

Modify `src/data/units.js` — on the `frigate` line replace `weapon: null, sight: 0 },` with `weapon: null, sight: 0, autonomous: true, untargetable: true },`.

Append to `src/data/tuning.js`:
```js
export const STARPORT = {
  wares: ['trike', 'raider', 'quad', 'combatTank', 'missileTank', 'siegeTank', 'harvester', 'mcv', 'carryall', 'ornithopter'],   // standard vehicles and aircraft (spec §4.5)
  extra: { missileTank: ['ordos'] },   // the Ordos buy the Missile Tank they cannot build
  stock: [2, 6],        // each type starts with 2–6 …
  restock: 90,          // … gains one every 90 s …
  maxStock: 10,         // … up to ten
  reprice: 60,          // seconds between price re-rolls (40–160 % of the cost)
  delivery: 30,         // seconds from the first order of a batch to the Frigate landing
  load: 9,              // a Frigate carries at most nine units
};
```

Modify `src/sim/tech.js` — in `canBuildStructure`, after the `requiresUpgrade` line add:
```js
  if (t.unique && owned.has(typeId)) return false;   // one Starport per house (original)
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/tech.test.mjs tests/upgrades.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/phase.js src/data/structures.js src/data/units.js src/data/tuning.js src/sim/tech.js tests/tech.test.mjs tests/upgrades.test.mjs
git commit -m "feat(sim): Starport and House of IX join the tech tree

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The Starport market

**Files:**
- Create: `src/sim/starport.js`
- Modify: `src/sim/air.js`, `src/sim/carryall.js`, `src/sim/world.js`, `src/sim/orders.js`
- Test: `tests/starport.test.mjs` (new)

**Interfaces:**
- Consumes: `spend`, `addCredits`, `UNITS`, `STARPORT`, `AIR`, `airSpeed`, `DEFERRED`.
- Produces:
  - Queries: `wares(houseId) → typeIds`, `starportOf(world, houseId) → structure | null`, `market(world, house) → house.starport`, opened lazily when the house first owns a Starport.
  - Updates and orders: `updateStarports(world)`, `orderStarport(world, houseId, typeId, count)`, `cancelStarport(world, houseId, typeId)`.
  - `nearestEdge(map, x, y)` in air.js.
  - The market: `house.starport = { stock: {type: n}, price: {type: n}, restockAt, repriceAt, batch }`, where `batch = { items: [{ typeId, paid }], structureId, pad: {x, y}, edge: {x, y}, landAt, spawnAt, frigate, landed }`.
  - Commands `{ type: 'starportOrder', typeId, count }` and `{ type: 'starportCancel', typeId }`.
  - Events `starportOrdered`; eva keys `soldOut`, `frigateFull`, `busy`, `insufficientFunds`, `cancelled`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/starport.test.mjs`**
```js
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
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/starport.test.mjs`
Expected: FAIL — `h.starport` is undefined (no market).

- [ ] **Step 3: Implement**

Modify `src/sim/air.js` — after `updateAircraft` add:
```js
/** The nearest point on the map edge (tile coordinates): where visiting aircraft come from and leave to. */
export function nearestEdge(map, x, y) {
  const tx = Math.max(0, Math.min(map.w - 1, Math.floor(x))), ty = Math.max(0, Math.min(map.h - 1, Math.floor(y)));
  const edges = [[tx, 0], [tx, map.h - 1], [0, ty], [map.w - 1, ty]];
  const [ex, ey] = edges.reduce((a, b) => (Math.hypot(b[0] - x, b[1] - y) < Math.hypot(a[0] - x, a[1] - y) ? b : a));
  return { x: ex, y: ey };
}
```

Modify `src/sim/carryall.js`:
- replace `import { hoverTo, climb } from './air.js';` with `import { hoverTo, climb, nearestEdge } from './air.js';`
- in `deliverByAir` replace the two lines
```js
  const edges = [[to.x, 0], [to.x, map.h - 1], [0, to.y], [map.w - 1, to.y]];
  const [ex, ey] = edges.reduce((a, b) => (Math.hypot(b[0] - to.x, b[1] - to.y) < Math.hypot(a[0] - to.x, a[1] - to.y) ? b : a));
```
with
```js
  const { x: ex, y: ey } = nearestEdge(map, to.x, to.y);
```

**File: `src/sim/starport.js`**
```js
// Starport (spec §4.5; research: structures.md "Starport"): a house with a Starport buys the standard
// vehicles and aircraft of its roster (the Ordos also the Missile Tank they cannot build). Each type
// starts with 2–6 in stock and gains one every 90 s up to ten; prices are re-rolled every minute to
// 40–160 % of the cost with the original formula. Orders are paid at once. The first order of a batch
// books a Frigate that lands on the pad 30 s later and unloads the whole batch (at most nine units);
// until it lands, an order can be cancelled for a refund. One Starport per house.
import { UNITS } from '../data/units.js';
import { STARPORT, AIR, airSpeed } from '../data/tuning.js';
import { DEFERRED } from '../data/phase.js';
import { spend, addCredits } from './economy.js';
import { nearestEdge } from './air.js';

const eva = (world, house, key, text) => world.events.push('eva', { house: house.id, key, text });

/** What a house can buy: its roster's standard vehicles and aircraft, in the order of STARPORT.wares. */
export const wares = (houseId) => STARPORT.wares.filter((t) => !DEFERRED.has(t) && (UNITS[t].houses.includes(houseId) || STARPORT.extra[t]?.includes(houseId)));

export function starportOf(world, houseId) {
  for (const s of world.structures.values()) if (s.house === houseId && s.typeId === 'starport') return s;
  return null;
}

/** The original formula: a tenth of the cost times 4 + two rolls of 0–6, at most 999. */
function priceOf(world, typeId) {
  return Math.min(999, Math.floor(UNITS[typeId].cost / 10) * (4 + world.rng.int(7) + world.rng.int(7)));
}

/** The house's market, opened the first time it owns a Starport (null before). */
export function market(world, house) {
  if (house.starport) return house.starport;
  if (!starportOf(world, house.id)) return null;
  const m = { stock: {}, price: {}, restockAt: world.time + STARPORT.restock, repriceAt: world.time + STARPORT.reprice, batch: null };
  for (const t of wares(house.id)) {
    m.stock[t] = STARPORT.stock[0] + world.rng.int(STARPORT.stock[1] - STARPORT.stock[0] + 1);
    m.price[t] = priceOf(world, t);
  }
  house.starport = m;
  return m;
}

export function updateStarports(world) {
  for (const house of world.houses.values()) {
    const m = market(world, house);
    if (!m) continue;
    if (world.time >= m.restockAt) {
      m.restockAt += STARPORT.restock;
      for (const t of Object.keys(m.stock)) m.stock[t] = Math.min(STARPORT.maxStock, m.stock[t] + 1);
    }
    if (world.time >= m.repriceAt) {
      m.repriceAt += STARPORT.reprice;
      for (const t of Object.keys(m.price)) m.price[t] = priceOf(world, t);
    }
  }
}

export function orderStarport(world, houseId, typeId, count = 1) {
  const house = world.houses.get(houseId);
  const s = house ? starportOf(world, houseId) : null;
  const m = s ? market(world, house) : null;
  if (!m || !(typeId in m.stock)) { world.events.push('commandRejected', { house: houseId, command: 'starportOrder', typeId }); return; }
  const n = Math.max(1, Math.min(5, Math.floor(count) || 1));
  for (let k = 0; k < n; k++) {
    if (m.batch?.landed) { eva(world, house, 'busy', 'Unable to comply, the Frigate is unloading.'); return; }
    if (m.batch && m.batch.items.length >= STARPORT.load) { eva(world, house, 'frigateFull', 'The Frigate is fully loaded.'); return; }
    if (m.stock[typeId] <= 0) { eva(world, house, 'soldOut', 'Sold out.'); return; }
    const price = m.price[typeId];
    if (!spend(house, price)) { eva(world, house, 'insufficientFunds', 'Insufficient funds.'); return; }
    m.stock[typeId]--;
    m.batch ??= book(world, s);
    m.batch.items.push({ typeId, paid: price });
    world.events.push('starportOrdered', { house: houseId, typeId, price });
  }
}

/** A new batch: the Frigate is timed to land on the pad STARPORT.delivery seconds from now. */
function book(world, s) {
  const pad = { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  const edge = nearestEdge(world.map, pad.x, pad.y);
  const travel = Math.hypot(edge.x + 0.5 - pad.x, edge.y + 0.5 - pad.y) / airSpeed(UNITS.frigate.speed) + (AIR.cruise - AIR.low) / AIR.climb;
  const landAt = world.time + STARPORT.delivery;
  return { items: [], structureId: s.id, pad, edge, landAt, spawnAt: landAt - travel, frigate: 0, landed: false };
}

export function cancelStarport(world, houseId, typeId) {
  const house = world.houses.get(houseId), m = house?.starport, b = m?.batch;
  if (!b || b.landed) return;
  const k = b.items.map((i) => i.typeId).lastIndexOf(typeId);
  if (k < 0) return;
  const [item] = b.items.splice(k, 1);
  addCredits(world, house, item.paid);
  m.stock[typeId] = Math.min(STARPORT.maxStock, m.stock[typeId] + 1);
  eva(world, house, 'cancelled', 'Cancelled.');
  if (!b.items.length) m.batch = null;   // nothing left to bring
}
```

Modify `src/sim/world.js`:
- add the import `import { updateStarports } from './starport.js';`
- after `updateRepairBays(this);` add `updateStarports(this);`

Modify `src/sim/orders.js`:
- add the import `import { orderStarport, cancelStarport } from './starport.js';`
- after the `case 'capture': …` line add:
```js
    case 'starportOrder': orderStarport(world, houseId, cmd.typeId, cmd.count ?? 1); return;
    case 'starportCancel': cancelStarport(world, houseId, cmd.typeId); return;
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/starport.test.mjs tests/carryall.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sim/starport.js src/sim/air.js src/sim/carryall.js src/sim/world.js src/sim/orders.js tests/starport.test.mjs
git commit -m "feat(sim): the Starport market — stock, prices, orders paid at once, cancels refunded

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The Frigate

**Files:**
- Modify: `src/sim/starport.js`, `src/sim/air.js`, `src/sim/combat.js`, `src/input/controller.js`
- Test: `tests/starport.test.mjs` (append)

**Interfaces:**
- Consumes: Task 2 (the batch), `hoverTo`, `climb`, `findFreeTile`.
- Produces:
  - Frigate lifecycle: `updateStarports` summons the Frigate at `batch.spawnAt`, and `updateFrigate(world, f)` runs it through the stages in → unload → out. It lands, sets `batch.landed`, unloads every unit around the pad (aircraft on the pad) and leaves by the map edge.
  - Events: `frigateLanded`, `unitDelivered { id, house, unitType, x, y }`, and eva `frigateArrived` ("Frigate has arrived.").
  - A cancel that empties the batch sends the Frigate away.
  - Untargetable units are skipped by `findTarget`, `validTarget` and the controller's picking.

- [ ] **Step 1: Write the failing tests**

Append to `tests/starport.test.mjs`:
```js
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
  assert.ok(runUntil(world, () => units(world, 'frigate').length === 0, 30) > 0, 'it turns back');
  assert.equal(units(world, 'quad').length, 0);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/starport.test.mjs`
Expected: FAIL — no Frigate is ever summoned.

- [ ] **Step 3: Implement**

Modify `src/sim/starport.js`:
- replace `import { nearestEdge } from './air.js';` with:
```js
import { nearestEdge, hoverTo, climb } from './air.js';
import { findFreeTile } from './spawn.js';
```
- in `updateStarports`, after the reprice block add:
```js
    const b = m.batch;
    if (b && !b.frigate && world.time >= b.spawnAt) {   // off it goes, timed to land on the dot
      const f = world.spawnUnit('frigate', house.id, b.edge.x, b.edge.y, { heading: Math.atan2(b.pad.y - b.edge.y, b.pad.x - b.edge.x) });
      f.job = { stage: 'in' };
      b.frigate = f.id;
    }
```
- in `cancelStarport` replace `if (!b.items.length) m.batch = null;   // nothing left to bring` with:
```js
  if (!b.items.length) {   // nothing left to bring: the Frigate turns back
    const f = world.units.get(b.frigate);
    if (f) f.job = { stage: 'out', exit: b.edge };
    m.batch = null;
  }
```
- append:
```js
/** The Frigate: in over the pad, down, every unit of the batch set down around it, up and away. */
export function updateFrigate(world, f) {
  const house = world.houses.get(f.house), m = house?.starport, b = m?.batch;
  const job = f.job ?? { stage: 'out', exit: nearestEdge(world.map, f.x, f.y) };
  if (job.stage === 'in') {
    if (!b || b.frigate !== f.id) { f.job = { stage: 'out', exit: nearestEdge(world.map, f.x, f.y) }; return; }
    if (!hoverTo(world, f, b.pad.x, b.pad.y)) { climb(f, AIR.cruise); return; }
    if (!climb(f, AIR.low)) return;
    b.landed = true;
    f.job = { stage: 'unload' };
    world.events.push('eva', { house: f.house, key: 'frigateArrived', text: 'Frigate has arrived.' });
    world.events.push('frigateLanded', { id: f.id, house: f.house, x: f.x, y: f.y });
    return;
  }
  if (job.stage === 'unload') {
    while (b?.items.length) {
      if (!unload(world, f, b.items[0].typeId, b)) return;   // no room yet: they wait aboard
      b.items.shift();
    }
    if (m) m.batch = null;
    f.job = { stage: 'out', exit: b?.edge ?? nearestEdge(world.map, f.x, f.y) };
    return;
  }
  climb(f, AIR.cruise);
  if (hoverTo(world, f, job.exit.x + 0.5, job.exit.y + 0.5)) world.removeUnit(f, 'left');
}

function unload(world, f, typeId, b) {
  const t = UNITS[typeId];
  const air = t.move === 'air';
  const spot = air ? { x: Math.floor(b.pad.x), y: Math.floor(b.pad.y) } : findFreeTile(world, Math.floor(b.pad.x), Math.floor(b.pad.y), t.move, 5, 1);
  if (!spot) return false;
  const u = world.spawnUnit(typeId, f.house, spot.x, spot.y, air ? { heading: f.heading, alt: AIR.low } : { heading: Math.PI / 2 });
  world.events.push('unitDelivered', { id: u.id, house: f.house, unitType: typeId, x: u.x, y: u.y });
  return true;
}
```

Modify `src/sim/air.js`:
- add the import `import { updateFrigate } from './starport.js';`
- replace `  else if (u.typeId === 'ornithopter') updateOrnithopter(world, u);` with:
```js
  else if (u.typeId === 'ornithopter') updateOrnithopter(world, u);
  else if (u.typeId === 'frigate') updateFrigate(world, u);
```

Modify `src/sim/combat.js`:
- in `findTarget` replace `if (u.house === houseId || (!u.isGround && !air) || u.inside || u.id === exclude) continue;   // aircraft only for anti-air` with `if (u.house === houseId || (!u.isGround && !air) || u.inside || u.type.untargetable || u.id === exclude) continue;   // aircraft only for anti-air; never the Frigate`
- in `validTarget` replace `if (t.kind === 'unit' && (e.inside || (!e.isGround && !canHitAir))) return false;` with `if (t.kind === 'unit' && (e.inside || e.type.untargetable || (!e.isGround && !canHitAir))) return false;`

Modify `src/input/controller.js` — in `candidates` replace `if (u.inside || !this.canSee(u)) continue;   // vehicles in a repair bay cannot be picked` with `if (u.inside || u.type.untargetable || !this.canSee(u)) continue;   // held units and the Frigate cannot be picked`

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/starport.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sim/starport.js src/sim/air.js src/sim/combat.js src/input/controller.js tests/starport.test.mjs
git commit -m "feat(sim): the Frigate lands the Starport's orders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Starport, Frigate and House of IX models

**Files:**
- Create: `src/render/models/structures/starport.js`, `src/render/models/structures/house-of-ix.js`, `src/render/models/units/frigate.js`
- Modify: `src/render/models/index.js`, `src/scenes/structures.js`, `src/scenes/gallery.js`
- Test: `tests/models-catalog.test.mjs`

**Interfaces:**
- Produces:
  - Models `starport` (with a `padLights` node), `houseOfIX` and `frigate`.
  - Mappings `STRUCTURE_MODEL.starport`, `STRUCTURE_MODEL.ix` and `UNIT_MODEL.frigate`.
  - Gallery rows showing all three.

- [ ] **Step 1: Write the failing test**

Modify `tests/models-catalog.test.mjs`:
- in `every plan-1b structure has a real model with its animated nodes` add `'starport', 'ix'` to the list of ids;
- in `aircraft have real models with wings that flap and claws that grip` add at the end:
```js
  assert.equal(UNIT_MODEL.frigate, 'frigate');
  assert.ok(modelDef('starport').nodes.padLights);
```

- [ ] **Step 2: Run the test to see it fail**

Run: `node --test tests/models-catalog.test.mjs`
Expected: FAIL — `starport` and `ix` have only placeholders; the Frigate is unmapped.

- [ ] **Step 3: Implement**

**File: `src/render/models/structures/starport.js`**
```js
// Starport (3x3): a landing pad with a house-colour X and a diamond of lights that pulse when a Frigate
// is due, two mushroom-shaped control towers on the west side and a glazed terminal along the north
// (spec §5.3). The Frigate lands on the pad.
import { ModelBuilder, MAT, box, rbox, cyl, sphere } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

export function starport() {
  const b = new ModelBuilder('starport');
  slab(b, 3, 3);
  b.add(MAT.DARK, box(2.0, 0.012, 2.0, { p: [0.3, 0.056, 0.35], color: 0x2e2d2b }));
  for (const r of [Math.PI / 4, -Math.PI / 4]) b.add(MAT.HOUSE, box(2.2, 0.008, 0.12, { p: [0.3, 0.066, 0.35], r: [0, r, 0] }));
  b.node('padLights', { pivot: [0.3, 0.075, 0.35], kind: 'scale' });
  for (const [x, z] of [[0, -0.9], [0.9, 0], [0, 0.9], [-0.9, 0], [0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]]) b.add(MAT.HOUSE_LIGHT, sphere(0.03, 8, { p: [x, 0, z], glow: 2.5 }), 'padLights');
  b.add(MAT.PAINT, rbox(2.7, 0.42, 0.5, 0.04, { p: [0, 0.26, -1.18], color: PAL.steel }));
  b.add(MAT.GLASS, box(2.5, 0.08, 0.51, { p: [0, 0.36, -1.18], color: PAL.glass }));
  b.add(MAT.HOUSE, box(2.72, 0.04, 0.52, { p: [0, 0.48, -1.18] }));
  for (const z of [-0.15, 1.0]) {
    b.add(MAT.PAINT, cyl(0.07, 0.1, 0.72, 12, { p: [-1.15, 0.41, z], color: PAL.steelDark }));
    b.add(MAT.PAINT, cyl(0.3, 0.2, 0.12, 20, { p: [-1.15, 0.83, z], color: PAL.white }));
    b.add(MAT.GLASS, cyl(0.29, 0.29, 0.05, 20, { p: [-1.15, 0.76, z], color: PAL.glass }));
    b.add(MAT.HOUSE_LIGHT, sphere(0.035, 8, { p: [-1.15, 0.92, z], glow: 2.5 }));
  }
  beacon(b, 1.3, 0.55, -1.18);
  return b.build({ radius: 2.2 });
}
```

**File: `src/render/models/structures/house-of-ix.js`**
```js
// House of IX (2x2): stepped blue-glass domes on a round tiered base, green lights round the step and
// a spire — the Ixian research house (spec §5.3).
import { ModelBuilder, MAT, cyl, sphere, dome } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

export function houseOfIX() {
  const b = new ModelBuilder('houseOfIX');
  slab(b, 2, 2);
  b.add(MAT.PAINT, cyl(0.84, 0.88, 0.16, 28, { p: [0, 0.12, 0], color: PAL.steelDark }));
  b.add(MAT.PAINT, cyl(0.66, 0.7, 0.16, 28, { p: [0, 0.28, 0], color: PAL.steel }));
  b.add(MAT.HOUSE, cyl(0.705, 0.705, 0.04, 28, { p: [0, 0.35, 0] }));
  b.add(MAT.GLASS, dome(0.55, 28, { p: [0, 0.36, 0], color: 0x2c6cc4 }));
  for (const [x, z] of [[0.62, 0.62], [-0.62, 0.62]]) b.add(MAT.GLASS, dome(0.2, 20, { p: [x, 0.05, z], color: 0x2c6cc4 }));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    b.add(MAT.LIGHT, sphere(0.03, 8, { p: [Math.cos(a) * 0.78, 0.21, Math.sin(a) * 0.78], color: PAL.greenGlow, glow: 3 }));
  }
  b.add(MAT.METAL, cyl(0.02, 0.035, 0.5, 8, { p: [0, 1.12, 0], color: PAL.gunmetal }));
  b.add(MAT.LIGHT, sphere(0.04, 8, { p: [0, 1.39, 0], color: PAL.greenGlow, glow: 3 }));
  beacon(b, 0.72, 0.22, -0.72);
  return b.build({ radius: 1.0 });
}
```

**File: `src/render/models/units/frigate.js`**
```js
// Frigate: a big cargo ship — a long, deep hull with a rounded nose, a bridge on top, four thruster
// pods glowing underneath and landing legs, in neutral grey with a house band (spec §5.3). Faces +x.
import { ModelBuilder, MAT, box, rbox, cyl } from '../kit.js';
import { PAL } from '../palette.js';

export function frigate() {
  const b = new ModelBuilder('frigate');
  b.add(MAT.PAINT, rbox(1.9, 0.36, 0.8, 0.12, { p: [0, 0.3, 0], color: PAL.steel }));
  b.add(MAT.PAINT, rbox(0.5, 0.3, 0.7, 0.12, { p: [0.95, 0.27, 0], color: PAL.steel }));
  b.add(MAT.GLASS, box(0.2, 0.1, 0.5, { p: [1.12, 0.38, 0], color: PAL.glass }));
  b.add(MAT.PAINT, rbox(0.5, 0.18, 0.4, 0.05, { p: [-0.3, 0.55, 0], color: PAL.steelDark }));
  b.add(MAT.GLASS, box(0.51, 0.05, 0.41, { p: [-0.3, 0.6, 0], color: PAL.glass }));
  b.add(MAT.HOUSE, box(1.5, 0.04, 0.81, { p: [-0.1, 0.42, 0] }));
  for (const [x, z] of [[0.6, 0.45], [0.6, -0.45], [-0.7, 0.45], [-0.7, -0.45]]) {
    b.add(MAT.METAL, cyl(0.11, 0.13, 0.22, 12, { p: [x, 0.2, z], color: PAL.gunmetal }));
    b.add(MAT.LIGHT, cyl(0.08, 0.08, 0.02, 12, { p: [x, 0.085, z], color: PAL.orangeGlow, glow: 2 }));
    b.add(MAT.METAL, box(0.04, 0.2, 0.04, { p: [x * 0.9, 0.02, z * 0.7], color: PAL.gunmetal }));
  }
  return b.build({ radius: 1.1 });
}
```

Modify `src/render/models/index.js`:
- add the imports `import { starport } from './structures/starport.js';`, `import { houseOfIX } from './structures/house-of-ix.js';` and `import { frigate } from './units/frigate.js';`
- in `BUILDERS` replace `carryall, ornithopter,` with `carryall, ornithopter, frigate,` and `repairFacility, hiTechFactory,` with `repairFacility, hiTechFactory, starport, houseOfIX,`
- in `UNIT_MODEL` replace `carryall: 'carryall', ornithopter: 'ornithopter',` with `carryall: 'carryall', ornithopter: 'ornithopter', frigate: 'frigate',`
- in `STRUCTURE_MODEL` replace `hiTech: 'hiTechFactory',` with `hiTech: 'hiTechFactory', starport: 'starport', ix: 'houseOfIX',`

Modify `src/scenes/structures.js`:
- in `LAYOUT` replace `['hiTech', 18, 5],` with `['hiTech', 18, 5], ['starport', 1, 9], ['ix', 5, 9],`
- replace `const map = new GameMap(22, 9);` with `const map = new GameMap(22, 13);`
- replace `rig.goalDistance = rig.distance = params.num('dist', 17);` with `rig.goalDistance = rig.distance = params.num('dist', 19);`
- replace `rig.lookAt(params.num('x', 11), params.num('z', 5), true);` with `rig.lookAt(params.num('x', 11), params.num('z', 6.5), true);`

Modify `src/scenes/gallery.js` — replace `['carryall', 'ornithopter'].forEach((id, c) => place(id, 5 + c * 2.6, 6.6, heading, 1, 0.9));` with `['carryall', 'ornithopter', 'frigate'].forEach((id, c) => place(id, 5 + c * 2.8, 6.6, heading, 1, 0.9));`

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/models-catalog.test.mjs tests/icons.test.mjs`
Expected: PASS.

Run: `npm test && node scripts/smoke.mjs structures-atreides gallery-atreides icons-atreides`
Expected: all pass. The screenshots show:
- the Starport: a pad with an X, two mushroom towers and a terminal;
- the House of IX: blue domes with green lights;
- the Frigate: a grey cargo ship with glowing thrusters.

- [ ] **Step 5: Commit**

```bash
git add src/render/models/structures/starport.js src/render/models/structures/house-of-ix.js src/render/models/units/frigate.js src/render/models/index.js src/scenes/structures.js src/scenes/gallery.js tests/models-catalog.test.mjs
git commit -m "feat(render): Starport, House of IX and Frigate models

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Buying from the sidebar

**Files:**
- Modify: `src/ui/sidebar-model.js`, `src/ui/sidebar.js`, `src/render/icons.js`, `src/ui/selection-panel.js`, `src/render/views/structure-views.js`, `src/audio/cues.js`, `src/scenes/icons.js`
- Test: `tests/sidebar-model.test.mjs`, `tests/icons.test.mjs`, `tests/selection-panel.test.mjs`, `tests/views.test.mjs`, `tests/cues.test.mjs` (append each)

**Interfaces:**
- Consumes: Tasks 2–3 (`house.starport`, `starportOf`, `STARPORT`).
- Produces:
  - Sidebar unit-strip entries for the wares: `{ typeId: 'starport:<unit>', line: 'starport', icon: 'starport:<unit>', name, cost: price, seconds: 30, note, state, count, order, cancel }`.
    - `state` is `locked` when there is no stock, the Frigate is unloading or the hold is full.
    - `count` is how many are in the open batch.
    - `note` reads `Starport · N in stock[ · Frigate in S s]`.
  - `Sidebar` sends `item.order` on a left click and `item.cancel` on a right click, when present.
  - Icons: `starportIconKey(key) → { unitType } | null`, and `IconFactory.forItem` draws a unit icon with a "$" badge.
  - Starport panel details: `No orders`, `Frigate due in S s · N ordered` or `Frigate unloading`.
  - The Starport's pad lights pulse while its Frigate is due.
  - Cues: `soldOut` and `frigateFull` are errors.

- [ ] **Step 1: Write the failing tests**

Append to `tests/sidebar-model.test.mjs`:
```js
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
```

Append to `tests/icons.test.mjs`:
```js
import { starportIconKey } from '../src/render/icons.js';

test('Starport icon keys name the unit on sale', () => {
  assert.deepEqual(starportIconKey('starport:quad'), { unitType: 'quad' });
  assert.equal(starportIconKey('quad'), null);
  assert.equal(starportIconKey('starport:windtrap'), null);
});
```

Append to `tests/selection-panel.test.mjs`:
```js
test('a Starport tells when its Frigate is due', () => {
  const world = flatWorld(40, 30, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 5000;
  h.startBuffer = 100000;
  world.spawnStructure('windtrap', 'atreides', 1, 1);
  const s = world.spawnStructure('starport', 'atreides', 10, 10);
  world.step();
  const sel = new Selection();
  sel.setStructure(s.id);
  assert.ok(selectionPanelModel(world, sel, 'atreides').details.includes('No orders'));
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  assert.ok(selectionPanelModel(world, sel, 'atreides').details.includes('Frigate due in 30 s · 1 ordered'));
});
```

Append to `tests/views.test.mjs`:
```js
test('the Starport\'s pad lights pulse while its Frigate is due', () => {
  const world = flatWorld(40, 30, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 5000;
  h.startBuffer = 100000;
  world.spawnStructure('windtrap', 'atreides', 1, 1);
  const s = world.spawnStructure('starport', 'atreides', 10, 10);
  world.step();
  const views = new StructureViews(new THREE.Scene(), new Heightfield(world.map, { sub: 2, seed: 1 }));
  views.sync(world, 1000);
  assert.equal(views.views.get(s.id).handles[0].params.padLights, 1);
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  views.sync(world, 1100);
  assert.notEqual(views.views.get(s.id).handles[0].params.padLights, 1);
});
```

Append to `tests/cues.test.mjs`:
```js
test('a sold-out ware or a full Frigate sounds like an error', () => {
  assert.equal(cueFor({ type: 'eva', house: 'atreides', key: 'soldOut' }, 'atreides', all).id, 'error');
  assert.equal(cueFor({ type: 'eva', house: 'atreides', key: 'frigateFull' }, 'atreides', all).id, 'error');
  assert.equal(cueFor({ type: 'eva', house: 'atreides', key: 'frigateArrived' }, 'atreides', all).id, 'beep');
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/sidebar-model.test.mjs tests/icons.test.mjs tests/selection-panel.test.mjs tests/views.test.mjs tests/cues.test.mjs`
Expected: FAIL — no Starport entries, no icon key, no panel details, no pad pulse and no error cues.

- [ ] **Step 3: Implement**

Modify `src/ui/sidebar-model.js`:
- replace `import { buildSeconds, UPGRADE_BUILD_TIME } from '../data/tuning.js';` with `import { buildSeconds, UPGRADE_BUILD_TIME, STARPORT } from '../data/tuning.js';`
- add the import `import { starportOf } from '../sim/starport.js';`
- in `sidebarModel`, after the `upgrade` function add:
```js
  const m = house.starport, open = m && starportOf(world, houseId);
  const ware = (t) => {
    const b = m.batch, ordered = b ? b.items.filter((i) => i.typeId === t).length : 0;
    const locked = m.stock[t] <= 0 || !!b?.landed || (b && b.items.length >= STARPORT.load);
    const eta = b && !b.landed ? ` · Frigate in ${Math.max(0, Math.ceil(b.landAt - world.time))} s` : '';
    return {
      typeId: `starport:${t}`, line: 'starport', icon: `starport:${t}`, name: UNITS[t].name, cost: m.price[t], seconds: STARPORT.delivery,
      note: `Starport · ${m.stock[t]} in stock${eta}`, state: locked ? 'locked' : ordered ? 'queued' : 'idle', progress: 0, count: ordered, starved: false,
      order: { type: 'starportOrder', typeId: t }, cancel: { type: 'starportCancel', typeId: t },
    };
  };
```
- replace `units: UNIT_LINES.flatMap((line) => options[line].map(entry(line))),` with `units: [...UNIT_LINES.flatMap((line) => options[line].map(entry(line))), ...(open ? Object.keys(m.stock).map(ware) : [])],`

Modify `src/ui/sidebar.js`:
- replace `b.addEventListener('contextmenu', (e) => { e.preventDefault(); this.onCommand({ type: 'hold', typeId: b.item.typeId }); });` with `b.addEventListener('contextmenu', (e) => { e.preventDefault(); this.onCommand(b.item.cancel ?? { type: 'hold', typeId: b.item.typeId }); });`
- in `leftClick`, before `this.onCommand({ type: 'build', typeId: item.typeId, count: shift ? 5 : 1 });` add `if (item.order) { this.onCommand({ ...item.order, count: shift ? 5 : 1 }); return; }   // Starport wares`

Modify `src/render/icons.js`:
- after `upgradeIconKey` add:
```js
/** 'starport:<unit>' → the Starport ware it names, or null. */
export function starportIconKey(key) {
  const m = /^starport:(\w+)$/.exec(key);
  return m && UNITS[m[1]] ? { unitType: m[1] } : null;
}

/** Starport wares: the unit with a gold coin in the bottom left corner. */
function drawPortBadge(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(20, 14, 6, 0.85)';
  ctx.strokeStyle = '#e8b84a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(20, ICON_H - 20, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 20, ICON_H - 19);
  ctx.restore();
}
```
- add `import { UNITS } from '../data/units.js';` to the imports;
- replace `    if (badge) drawUpgradeBadge(this.ctx, badge);` with `    if (badge === 'port') drawPortBadge(this.ctx); else if (badge) drawUpgradeBadge(this.ctx, badge);`
- in `forItem`, after the upgrade line (`if (up) { … }`) add:
```js
    const ware = starportIconKey(typeId);
    if (ware) return this.get(unitModelId(ware.unitType), color, UNIT_ICON_YAW, 'port');
```

Modify `src/ui/selection-panel.js` — after the `repair` block in `structureModel` add:
```js
  if (s.typeId === 'starport') {
    const b = world.houses.get(houseId)?.starport?.batch;
    details.push(!b ? 'No orders' : b.landed ? 'Frigate unloading' : `Frigate due in ${Math.max(0, Math.ceil(b.landAt - world.time))} s · ${b.items.length} ordered`);
  }
```

Modify `src/render/views/structure-views.js` — replace `p.padLights = s.dockedBy || s.occupant ? 1 + 0.25 * Math.sin(now * 0.012) : 1;` with:
```js
    const due = s.typeId === 'starport' && world.houses.get(s.house)?.starport?.batch?.structureId === s.id;   // a Frigate is on its way
    p.padLights = s.dockedBy || s.occupant || due ? 1 + 0.25 * Math.sin(now * 0.012) : 1;
```

Modify `src/audio/cues.js` — replace `const ERRORS = new Set(['insufficientFunds', 'cannotPlace', 'busy', 'cannotDeploy']);` with `const ERRORS = new Set(['insufficientFunds', 'cannotPlace', 'busy', 'cannotDeploy', 'soldOut', 'frigateFull']);`

Modify `src/scenes/icons.js` — replace `'upgrade:heavyFactory:3']) {` with `'upgrade:heavyFactory:3', 'starport:quad', 'starport:carryall']) {`

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/sidebar-model.test.mjs tests/icons.test.mjs tests/selection-panel.test.mjs tests/views.test.mjs tests/cues.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/sidebar-model.js src/ui/sidebar.js src/render/icons.js src/ui/selection-panel.js src/render/views/structure-views.js src/audio/cues.js src/scenes/icons.js tests/sidebar-model.test.mjs tests/icons.test.mjs tests/selection-panel.test.mjs tests/views.test.mjs tests/cues.test.mjs
git commit -m "feat(ui): buy from the Starport in the sidebar; pad lights and panel for the Frigate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The computer builds a Starport and a House of IX

**Files:**
- Modify: `src/sim/ai.js`
- Test: `tests/ai.test.mjs` (append)

**Interfaces:**
- Produces:
  - `BUILD_ORDER` ends with a Starport and a House of IX, so the computer can build Ornithopters. It still never buys from the Starport (original).
  - Wave members that are aircraft and on guard get re-tasked like idle ones (plan 2b minor).

- [ ] **Step 1: Write the failing tests**

Append to `tests/ai.test.mjs`:
```js
test('the AI puts up a Starport and a House of IX and then flies Ornithopters', () => {
  const world = flatWorld(56, 44, G.ROCK);
  for (const [t, x, y] of [['constructionYard', 2, 2], ['windtrap', 5, 2], ['windtrap', 8, 2], ['windtrap', 11, 2], ['windtrap', 14, 2], ['windtrap', 17, 2], ['refinery', 2, 6], ['outpost', 6, 6], ['barracks', 9, 6], ['lightFactory', 12, 6], ['heavyFactory', 15, 6], ['silo', 2, 10], ['refinery', 5, 10], ['repair', 9, 10], ['hiTech', 13, 10]]) world.spawnStructure(t, 'atreides', x, y);
  const h = world.houses.get('atreides');
  h.credits = 20000;
  h.startBuffer = 40000;
  createBrain(world, 'atreides', 'normal');
  const has = (t) => [...world.structures.values()].some((s) => s.house === 'atreides' && s.typeId === t);
  assert.ok(runUntil(world, () => has('starport') && has('ix'), 300) > 0, 'Starport and House of IX');
  assert.ok(runUntil(world, () => [...world.units.values()].some((u) => u.house === 'atreides' && u.typeId === 'ornithopter'), 300) > 0, 'an Ornithopter');
  assert.equal(h.starport?.batch ?? null, null, 'it never buys at the Starport');
});

test('aircraft of a wave that end up guarding are sent on to the next target', () => {
  const world = flatWorld(48, 32, G.ROCK);
  world.spawnStructure('constructionYard', 'harkonnen', 2, 2);
  world.spawnStructure('silo', 'atreides', 40, 24);
  const o = world.spawnUnit('ornithopter', 'harkonnen', 20, 12);
  o.order = { type: 'guard', x: 20, y: 12 };
  const brain = createBrain(world, 'harkonnen', 'normal');
  brain.wave.push(o.id);
  brain.nextAttack = 1e9;
  assert.ok(runUntil(world, () => o.order.type === 'attackMove', 3) > 0);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/ai.test.mjs`
Expected: FAIL — no Starport in the build order, and the guarding Ornithopter is left alone.

- [ ] **Step 3: Implement**

Modify `src/sim/ai.js`:
- in each of the three `BUILD_ORDER` lists replace `'repair', 'hiTech', 'windtrap']` with `'repair', 'hiTech', 'windtrap', 'starport', 'ix']`;
- replace `const idle = b.wave.map((id) => world.units.get(id)).filter((u) => u.order.type === 'idle');` with:
```js
  const idle = b.wave.map((id) => world.units.get(id)).filter((u) => u.order.type === 'idle' || (!u.isGround && u.order.type === 'guard'));   // aircraft end a move on guard
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/ai.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: all pass (the AI-versus-AI soak included).

- [ ] **Step 5: Commit**

```bash
git add src/sim/ai.js tests/ai.test.mjs
git commit -m "feat(ai): the computer builds a Starport and a House of IX; wave aircraft keep hunting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Plan 2b's remaining minors

**Files:**
- Modify: `src/input/controller.js`, `src/sim/combat.js`
- Test: `tests/controller.test.mjs` (append), `tests/anti-air.test.mjs` (append)

**Interfaces:**
- Produces:
  - Over an enemy aircraft, the cursor reads `noMove` when none of the selected units can shoot upwards.
  - A homing projectile stops following a target that was lifted into a Carryall or drove into a bay, and lands where it was aimed.

- [ ] **Step 1: Write the failing tests**

Append to `tests/controller.test.mjs`:
```js
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
```

Append to `tests/anti-air.test.mjs`:
```js
test('a homing rocket stops following a unit that is lifted away and lands where it was aimed', () => {
  const world = flatWorld(30, 30, G.ROCK);
  const t = world.spawnUnit('combatTank', 'harkonnen', 10, 10);
  world.projectiles.set(1, { id: 1, weapon: 'turretRocket', projectile: 'rocket', house: 'atreides', sourceId: 0, sourceKind: 'structure', x: 4.5, y: 10.5, px: 4.5, py: 10.5, sx: 4.5, sy: 10.5, tx: 10.5, ty: 10.5, speed: 1, damage: 30, accurate: true, homing: true, target: { kind: 'unit', id: t.id }, airburst: false, fromAlt: 0, toAlt: 0 });
  const c = world.spawnUnit('carryall', 'harkonnen', 20, 10);   // lifted away and carried off to 20,10
  world.map.unit[world.map.idx(10, 10)] = 0;
  t.inside = c.id;
  c.cargo = t.id;
  world.step();
  const p = world.projectiles.get(1);
  assert.deepEqual([p.tx, p.ty], [10.5, 10.5], 'it keeps to where it was aimed');
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/controller.test.mjs tests/anti-air.test.mjs`
Expected: FAIL — the cursor shows `attack`, and the rocket retargets to the carried tank.

- [ ] **Step 3: Implement**

Modify `src/input/controller.js` — replace `if (hit.unit.house !== this.house) return own.length ? 'attack' : 'select';` with:
```js
      if (hit.unit.house !== this.house) return !own.length ? 'select' : hit.unit.isGround || own.some((u) => u.type.targetAir) ? 'attack' : 'noMove';   // aircraft: anti-air only
```

Modify `src/sim/combat.js` — replace `    if (p.homing && p.target) { const tp = targetPoint(world, p.target); if (tp) { p.tx = tp.x; p.ty = tp.y; } }` with:
```js
    if (p.homing && p.target) { const tp = targetPoint(world, p.target); if (tp && !tp.entity?.inside) { p.tx = tp.x; p.ty = tp.y; } }   // not into a bay or a Carryall
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/controller.test.mjs tests/anti-air.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/input/controller.js src/sim/combat.js tests/controller.test.mjs tests/anti-air.test.mjs
git commit -m "fix: plan 2b minors — honest cursor over aircraft, homing stops at lifted units

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Starport showcase, smoke, end-to-end, README

**Files:**
- Modify: `src/scenes/base.js`, `scripts/scenarios.mjs`, `scripts/e2e.mjs`, `README.md`
- Test: `npm run smoke`, `npm run e2e`

**Interfaces:**
- Produces:
  - The base showcase now has a Starport and a House of IX. With `frigate=1` it orders a Quad and a Combat Tank at the start.
  - Smoke scene `base-frigate`: the Frigate coming down.
  - E2E check: "buying a Quad at the Starport brings it by Frigate".

- [ ] **Step 1: Scene**

Modify `src/scenes/base.js`:
- in `LAYOUT` replace `'hiTech', 'windtrap',` with `'hiTech', 'starport', 'ix', 'windtrap',`
- before the ticks loop (after the Carryall line) add:
```js
  if (params.bool('frigate')) {   // an order at the start: the Frigate comes down after 30 s
    world.issue(house, { type: 'starportOrder', typeId: 'quad' });
    world.issue(house, { type: 'starportOrder', typeId: 'combatTank' });
    const port = [...world.structures.values()].find((s) => s.house === house && s.typeId === 'starport');
    if (port) focus = { x: port.x + 1.5, z: port.y + 3.5 };
  }
```
- header comment: append ` frigate=1 orders from the Starport at the start.`

Modify `scripts/scenarios.mjs` — after the `'base-air'` entry add:
```js
  'base-frigate': { query: 'scene=base&house=atreides&fog=0&frigate=1&ticks=585&dist=14', settleMs: 1200 },
```

- [ ] **Step 2: End-to-end check**

Modify `scripts/e2e.mjs` — in the base-scene block, directly before `const baseErrors = base.logs.filter(`, insert:
```js
  let ware = await bv(`__dune.buttonRect('starport:quad')`);
  for (let i = 0; i < 30 && ware && !ware.visible; i++) {   // scroll the unit strip down to the Starport's wares
    const down = await bv(`__dune.arrowRect('units', 1)`);
    await base.click(down.x, down.y);
    await sleep(150);
    ware = await bv(`__dune.buttonRect('starport:quad')`);
  }
  const quads = (await bv(`__dune.units('quad')`)).length;
  if (ware?.visible) await base.click(ware.x, ware.y);
  let landed = false;
  for (let i = 0; i < 600 && !landed; i++) { await sleep(200); landed = (await bv(`__dune.units('quad')`)).length > quads; }
  check('buying a Quad at the Starport brings it by Frigate', landed);
```

- [ ] **Step 3: README**

Modify `README.md`:
- in `## Status` replace `aircraft (Carryall, Ornithopter) are in; the` with `aircraft (Carryall, Ornithopter), the Starport and the House of IX are in; the`, and replace `House of IX specials, sandworms, the Starport and Palace,` with `House of IX specials, sandworms, the Palace,`
- at the end of `## Base building` add:
```

A Starport sells the house's vehicles and aircraft at prices that change every minute (40–160 % of
the usual cost) while stock lasts; orders are paid at once, a Frigate lands them on the pad 30 s after
the first order, and right-clicking an order before it lands cancels it for a refund. A House of IX
opens the Ornithopter.
```

- [ ] **Step 4: Run everything**

Run: `npm test`
Expected: all pass.

Run: `npm run smoke`
Expected: 35 scenes captured; `base-frigate.png` shows the Frigate coming down on the Starport pad.

Run: `npm run e2e`
Expected: 27/27 checks pass.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/base.js scripts/scenarios.mjs scripts/e2e.mjs README.md
git commit -m "test: Starport showcase, smoke and end-to-end checks; README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
