# Plan 2a — Factory upgrades, Repair Facility and capture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make factory upgrades real purchases (their own icons in the structure strip, paid and timed like a build, gating what they unlock), open the Repair Facility (vehicles drive in, are repaired for credits and drive out; the computer uses it too), and let infantry capture badly damaged enemy buildings.

**Architecture:** Upgrades are production items with ids `upgrade:<structureType>`. They run on the line of the factory they improve and raise a per-house level (`house.upgrades`); `src/sim/tech.js` owns every upgrade rule and gates units (`unit.upgrade`) and structures (`requiresUpgrade`) by it. A new `src/sim/repair-bay.js` runs the `repairAt` order and the bay: a vehicle inside is off the tile grid, cannot be targeted and is drawn on the pad. A new `src/sim/capture.js` runs the `capture` order and hands buildings (with a docked harvester or the vehicle in the bay) to the captor. UI: upgrade icons with a level badge, `enter` and `capture` cursors, click rules, panel details, and a new Repair Facility model.

**Tech Stack:** as before — ES modules, vendored Three.js 0.186.1, Node 24 `node:test`, headless Chrome over CDP.

**Spec:** `docs/superpowers/specs/2026-09-28-dune2-3d-design.md` — §4.5 (Upgrades table, prerequisites, tech level), §4.6 (infantry capture), §5.3 (Repair Facility model), §5.6 (enter/capture cursors), §5.7 (context orders), §11 phase 2. Research: `docs/research/raw/structures.md` ("Repair, upgrade, capture", Repair Facility, Construction Yard, Heavy Factory), `docs/research/raw/mechanics-campaign.md` §4.2 (upgrade cost and countdown, repair pad cost ÷ 4).

## Global Constraints

- Everything from plans 1a–1d holds: pure deterministic sim (`world.rng` only in `src/sim`, no `Math.random` there); every player and AI action is a command through `world.issue`, validated in `orders.js`; instanced rendering; English UI text; no original assets; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Upgrade prices and unlocks are the spec §4.5 table: Construction Yard 200 / 200 (Large Concrete Slab / Rocket Turret), Barracks 150 (Infantry Squad), WOR 200 (Trooper Squad), Light Factory 200 (Quad; Harkonnen start upgraded), Heavy Factory 300 × 3 (MCV / Missile Tank / Siege Tank; the Ordos' third level is free), Hi-Tech 250 (plan 2b).
- "Upgrades appear as their own icons in the structure strip and are paid and timed like a build" (spec §4.5).
- Infantry capture an enemy structure below 25 % HP by walking in; Barracks, WOR, Outpost, House of IX and Palace cannot be captured (spec §4.6; the `conquerable` flags in `structures.js`).
- Deferred to plan 2b: the Hi-Tech Factory (its upgrade and the Harkonnen never-upgrade rule) and Carryalls ferrying vehicles to the Repair Facility.

## Rulings built into this plan

The spec is silent on these; the original (per-building upgrades) and C&C differ.

- **Upgrades belong to the house**, not to one building — the strip is house-wide. A new or second factory has the house's level, and losing every factory keeps the level.
- **Upgrades run on the line of the factory they improve** (the Construction Yard's on the structure line), ahead of the units already queued. Only one upgrade of a type runs at a time.
- **Upgrade duration** is 20 original steps = 9 s (research: a countdown of 100 in steps of 5), scaled by the line's usual speed factors.
- **The computer pays for upgrades and waits like the player** (the original's AI got them instantly).
- **Unit repair** (research): a full repair costs a quarter of the unit's price and takes as long as building it, both in proportion to the damage. Low power slows it like production, and it pauses without credits.
- **A vehicle inside the bay** is off the tile grid, cannot be targeted or splashed, and ignores orders. The facility's destruction kills it and capture transfers it (both from the research). Selling the facility pushes it out; selling is a C&C addition.
- **Infantry reaching a building that is not (or no longer) capturable attack it**, instead of the original's suicide entry.

## Review Focus

1. **A vehicle inside the bay when the facility is destroyed, sold or captured** must die with it, come out, or change sides — never stay "inside" nothing. → Task 4 test "a destroyed bay takes the vehicle inside with it; a sold one pushes it out"; Task 8 test "a captured repair bay changes hands with the vehicle inside".
2. **Several vehicles sent to one bay at once**: one goes in and the rest wait near the entrance and follow in turn. A unit parked on the entrance is moved off, and nobody deadlocks. → Task 4 tests "a second vehicle waits by the entrance and goes in when the bay is free" and "a unit parked on the entrance is moved off it".
3. **An upgrade bought while its factory's line is busy, then held, cancelled, or orphaned by losing the factory**: it runs first, refunds what was paid, and cannot be queued twice. → Task 1 tests.
4. **A capture target taken by another squad, repaired above a quarter, or not conquerable at all**: the infantry stand down or attack. Walls, Outposts and own buildings are refused. → Task 8 tests.
5. **The computer with upgrades enforced**: it still rebuilds its MCV (buying the Heavy Factory upgrade first), still reaches missile and siege tanks, and the AI-versus-AI soak stays stuck-free with repair traffic. → Task 2 tests, Task 7 test, and the soak test in every full run.

## File map (new and changed)

```
src/data/structures.js        upgradeTech / upgradeRequires per factory; Repair Facility entrance and pad
src/data/houses.js            Harkonnen start with the Light Factory upgrade
src/data/phase.js             the Repair Facility is no longer deferred
src/data/tuning.js            UPGRADE_BUILD_TIME, UNIT_REPAIR_COST, BAY_DRIVE_SECONDS, CAPTURE_BELOW
src/sim/house.js              house.upgrades, stats.structuresCaptured
src/sim/tech.js               upgrade rules; unit and structure gating
src/sim/production.js         upgrade items
src/sim/repair-bay.js   NEW   repairAt order, the bay, emptyBay
src/sim/capture.js      NEW   capture order, transferStructure, transferUnit
src/sim/harvest.js            dockTile reads the structure's entrance; clearDock exported; refinery house check
src/sim/orders.js             repairAt and capture commands; units in a bay take no orders
src/sim/world.js              bay and capture updates in the step
src/sim/combat.js             vehicles in a bay are not targets and do not fight
src/sim/aftermath.js          splash skips vehicles in a bay
src/sim/structure-actions.js  selling a bay pushes its vehicle out
src/sim/invariants.js         vehicles in a bay hold no tile (one while driving out)
src/sim/ai.js                 buys upgrades, builds and uses a Repair Facility
src/render/models/structures/repair.js  NEW   Repair Facility model
src/render/models/index.js    registry
src/render/views/structure-views.js    hoist and pad lights; weldPoint()
src/render/views/unit-views.js         vehicles on the pad stand on its plate
src/render/effects.js         weld sparks
src/render/icons.js           upgrade icons with a level badge
src/ui/sidebar-model.js       upgrade entries in the structure strip
src/ui/sidebar.js             icon keys, tooltip notes
src/ui/selection-panel.js     upgrade level, bay details, order texts
src/ui/cursors.js             enter, capture
src/input/controller.js       repair and capture clicks and cursors
src/audio/cues.js             bay and capture sounds
src/game/game-view.js         welding sparks; units in a bay drop out of the selection
src/game/debug.js             arrowRect, upgradeLevel, unit.inside, clipped buttonRect
src/scenes/{base,structures,icons}.js   repair, capture and upgrade showcases
scripts/scenarios.mjs, scripts/e2e.mjs  base-repair shot; upgrade, repair and capture by mouse
README.md                     status and controls
```

---

### Task 1: Upgrades as production items

**Files:**
- Modify: `src/data/structures.js`, `src/data/houses.js`, `src/data/tuning.js`, `src/sim/house.js`, `src/sim/tech.js`, `src/sim/production.js`
- Test: `tests/upgrades.test.mjs` (new)

**Interfaces:**
- Consumes: plan-1 production lines (`orderBuild`, `orderHold`, `updateProduction`, `revalidateProduction`), `canBuild`, `buildOptions`.
- Produces (tech.js):
  - Ids and levels: `UPGRADE_ORDER`, `upgradeId(type) → 'upgrade:<type>'`, `upgradeTarget(typeId) → type | null`, `upgradeLevel(house, type) → number`, `upgradeResult(house, type) → the level the next purchase reaches`.
  - Rules and names: `upgradeCost(house, type)`, `canUpgrade(house, type, owned)`, `upgradeUnlocks(houseId, type, from, to) → names`.
  - Plumbing: `buildOptions(...).upgrades` (ids), and `lineOfItem` / `canBuild` accept upgrade ids.
- Produces (production.js): upgrade items `{ typeId, upgrade, level, cost, total, progress, paid, state, starved }`; event `upgraded { house, structureType, level }`; eva keys `upgrading`, `upgradeComplete`.
- Produces: `house.upgrades` (Harkonnen start with `{ lightFactory: 1 }`); `UPGRADE_BUILD_TIME = 20` in tuning.js.
- Units and structures are **not yet gated** by upgrades — Task 2 switches that on together with the AI.

- [ ] **Step 1: Write the failing tests**

**File: `tests/upgrades.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { buildOptions, canBuild, lineOfItem, upgradeId, upgradeLevel, upgradeResult, upgradeUnlocks } from '../src/sim/tech.js';
import { flatWorld, run } from './helpers.mjs';

function withStructures(house, types) {
  const world = flatWorld(40, 40, G.ROCK);
  types.forEach((t, k) => world.spawnStructure(t, house, 2 + (k % 8) * 4, 2 + Math.floor(k / 8) * 4));
  return world;
}

function factoryBase(house = 'atreides') {
  const world = flatWorld(32, 32, G.ROCK);
  const h = world.houses.get(house);
  h.credits = 5000;
  h.startBuffer = 100000;
  world.spawnStructure('constructionYard', house, 4, 4);
  world.spawnStructure('windtrap', house, 0, 0);
  const hf = world.spawnStructure('heavyFactory', house, 10, 10);
  return { world, h, hf };
}

test('each factory offers its next upgrade while there is one', () => {
  const world = withStructures('atreides', ['constructionYard', 'windtrap', 'outpost', 'barracks', 'lightFactory', 'heavyFactory']);
  const h = world.houses.get('atreides');
  assert.deepEqual(buildOptions(world, 'atreides').upgrades, ['upgrade:constructionYard', 'upgrade:barracks', 'upgrade:lightFactory', 'upgrade:heavyFactory']);
  h.upgrades = { constructionYard: 2, barracks: 1, lightFactory: 1, heavyFactory: 3 };
  assert.deepEqual(buildOptions(world, 'atreides').upgrades, []);
  const bare = withStructures('atreides', ['constructionYard']);
  bare.houses.get('atreides').upgrades.constructionYard = 1;
  assert.equal(canBuild(bare, 'atreides', upgradeId('constructionYard')), false, 'the second yard upgrade needs an Outpost and a Wind Trap');
});

test('tech level gates each upgrade level; the Ordos take heavy factory levels 2 and 3 together', () => {
  const { world, h } = factoryBase();
  h.techLevel = 3;
  assert.equal(canBuild(world, 'atreides', upgradeId('heavyFactory')), false);
  h.techLevel = 4;
  assert.equal(canBuild(world, 'atreides', upgradeId('heavyFactory')), true);
  h.upgrades.heavyFactory = 1;
  assert.equal(canBuild(world, 'atreides', upgradeId('heavyFactory')), false, 'level 2 waits for tech 5');
  assert.equal(upgradeResult(h, 'heavyFactory'), 2);
  const o = factoryBase('ordos');
  o.h.upgrades.heavyFactory = 1;
  o.h.techLevel = 5;
  assert.equal(canBuild(o.world, 'ordos', upgradeId('heavyFactory')), false, 'the Ordos wait until level 3 is on offer');
  o.h.techLevel = 6;
  assert.equal(canBuild(o.world, 'ordos', upgradeId('heavyFactory')), true);
  assert.equal(upgradeResult(o.h, 'heavyFactory'), 3);
});

test('Harkonnen start with the light factory upgrade', () => {
  const world = withStructures('harkonnen', ['constructionYard', 'lightFactory']);
  const h = world.houses.get('harkonnen');
  assert.equal(upgradeLevel(h, 'lightFactory'), 1);
  assert.equal(canBuild(world, 'harkonnen', upgradeId('lightFactory')), false, 'nothing left to buy');
  assert.equal(upgradeLevel(world.houses.get('atreides'), 'lightFactory'), 0);
});

test('upgrades run on the line of the factory they improve and name what they open', () => {
  assert.equal(lineOfItem(upgradeId('constructionYard')), 'structure');
  assert.equal(lineOfItem(upgradeId('heavyFactory')), 'heavy');
  assert.equal(lineOfItem(upgradeId('wor')), 'infantry');
  assert.equal(lineOfItem('upgrade:nothing'), null);
  assert.deepEqual(upgradeUnlocks('atreides', 'constructionYard', 0, 1), ['Large Concrete Slab']);
  assert.deepEqual(upgradeUnlocks('atreides', 'constructionYard', 1, 2), ['Rocket Turret']);
  assert.deepEqual(upgradeUnlocks('atreides', 'heavyFactory', 0, 1), ['MCV']);
  assert.deepEqual(upgradeUnlocks('ordos', 'heavyFactory', 1, 3), ['Siege Tank'], 'no Missile Tank for the Ordos');
  assert.deepEqual(upgradeUnlocks('harkonnen', 'wor', 0, 1), ['Trooper Squad']);
});

test('an upgrade is paid as it runs and takes nine seconds', () => {
  const { world, h } = factoryBase();
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  run(world, 4.5);
  assert.ok(Math.abs(h.credits - 4850) < 2, `credits ${h.credits}`);
  assert.equal(upgradeLevel(h, 'heavyFactory'), 0);
  run(world, 4.6);
  assert.equal(upgradeLevel(h, 'heavyFactory'), 1);
  assert.equal(h.lines.heavy.current, null);
  assert.ok(Math.abs(h.credits - 4700) < 1e-6);
  const events = world.events.drain();
  assert.ok(events.some((e) => e.type === 'eva' && e.key === 'upgradeComplete'));
  assert.ok(events.some((e) => e.type === 'upgraded' && e.structureType === 'heavyFactory' && e.level === 1));
});

test('an upgrade goes ahead of the units waiting on its line, once', () => {
  const { world, h } = factoryBase();
  world.issue('atreides', { type: 'build', typeId: 'combatTank', count: 3 });
  world.step();
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  world.step();
  assert.equal(h.lines.heavy.current.typeId, 'combatTank');
  assert.deepEqual(h.lines.heavy.queue, ['upgrade:heavyFactory', 'combatTank', 'combatTank']);
});

test('holding, then cancelling an upgrade refunds what was paid; the yard is busy meanwhile', () => {
  const { world, h } = factoryBase();
  world.issue('atreides', { type: 'build', typeId: 'upgrade:constructionYard' });
  run(world, 3);
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  world.step();
  assert.ok(world.events.drain().some((e) => e.key === 'busy'), 'the yard is upgrading');
  world.issue('atreides', { type: 'hold', typeId: 'upgrade:constructionYard' });
  world.step();
  assert.equal(h.lines.structure.current.state, 'hold');
  world.issue('atreides', { type: 'hold', typeId: 'upgrade:constructionYard' });
  world.step();
  assert.equal(h.lines.structure.current, null);
  assert.ok(Math.abs(h.credits - 5000) < 1e-6);
  assert.equal(upgradeLevel(h, 'constructionYard'), 0);
});

test('losing every factory of the type refunds the upgrade in progress; a finished upgrade outlasts the factory', () => {
  const { world, h, hf } = factoryBase();
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  run(world, 3);
  world.removeStructure(hf);
  run(world, 1.1);
  assert.equal(h.lines.heavy.current, null);
  assert.ok(Math.abs(h.credits - 5000) < 1e-6);
  const again = factoryBase();
  again.world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  run(again.world, 9.2);
  again.world.removeStructure(again.hf);
  again.world.spawnStructure('heavyFactory', 'atreides', 20, 20);
  assert.equal(upgradeLevel(again.h, 'heavyFactory'), 1);
});

test('the Ordos pay once for heavy factory levels 2 and 3', () => {
  const { world, h } = factoryBase('ordos');
  h.upgrades.heavyFactory = 1;
  world.issue('ordos', { type: 'build', typeId: 'upgrade:heavyFactory' });
  run(world, 9.2);
  assert.equal(upgradeLevel(h, 'heavyFactory'), 3);
  assert.ok(Math.abs(h.credits - 4700) < 1e-6);
});

test('an upgrade the house cannot buy is rejected', () => {
  const { world, h } = factoryBase();
  h.upgrades.heavyFactory = 3;
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  world.issue('atreides', { type: 'build', typeId: 'upgrade:lightFactory' });
  world.issue('atreides', { type: 'build', typeId: 'upgrade:bogus' });
  world.step();
  assert.equal(world.events.drain().filter((e) => e.type === 'commandRejected').length, 3);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/upgrades.test.mjs`
Expected: FAIL — `upgradeId` (and the other upgrade helpers) are not exported by `src/sim/tech.js`.

- [ ] **Step 3: Implement**

Modify `src/data/structures.js`, replacing (each string occurs once):
- `produces: 'infantry', upgrades: [150] },` → `produces: 'infantry', upgrades: [150], upgradeTech: [2] },`
- `produces: 'infantry', upgrades: [200] },` → `produces: 'infantry', upgrades: [200], upgradeTech: [6], upgradeTechByHouse: { harkonnen: [5] } },`
- `produces: 'light', upgrades: [200], conquerable: true },` → `produces: 'light', upgrades: [200], upgradeTech: [3], conquerable: true },`
- `produces: 'heavy', upgrades: [300, 300, 300], conquerable: true },` → `produces: 'heavy', upgrades: [300, 300, 300], upgradeTech: [4, 5, 6], conquerable: true },`
- `produces: 'air', upgrades: [250], conquerable: true },` → `produces: 'air', upgrades: [250], upgradeTech: [7], conquerable: true },`
- `produces: 'structure', upgrades: [200, 200], conquerable: true },` → `produces: 'structure', upgrades: [200, 200], upgradeTech: [4, 6], upgradeRequires: [[], ['outpost', 'windtrap']], conquerable: true },`

(`upgradeTech[k]` is the tech level at which level k + 1 goes on sale — the original's `upgradeCampaign`; the Harkonnen WOR exception and the yard's second level needing the Rocket Turret's prerequisites are from `Structure_IsUpgradable()`.)

Modify `src/data/houses.js` — in the `harkonnen` entry replace `toughness: 200, playable: true },` with `toughness: 200, playable: true, startUpgrades: { lightFactory: 1 } },`.

Append to `src/data/tuning.js`:
```js
export const UPGRADE_BUILD_TIME = 20;           // original steps per upgrade level (a countdown of 100 in steps of 5): 9 s
```

Modify `src/sim/house.js` — after `this.lines = createLines();` add:
```js
    this.upgrades = { ...(HOUSES[id].startUpgrades ?? {}) };   // factory upgrade levels, house-wide (spec §4.5)
```

Replace `src/sim/tech.js` with:
```js
// What a house can build right now (spec §4.5): prerequisites, tech level, house rosters, factory
// upgrades and the plan-2 deferrals. Upgrades are items too: `upgrade:<structure>` buys the next level
// of that factory type for the whole house.
import { STRUCTURES } from '../data/structures.js';
import { UNITS } from '../data/units.js';
import { DEFERRED } from '../data/phase.js';

export const STRUCTURE_ORDER = ['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'hiTech', 'repair', 'wall', 'turret', 'rocketTurret', 'concrete4', 'starport', 'ix', 'palace'];
export const UNIT_ORDER = ['soldier', 'infantry', 'trooper', 'troopers', 'trike', 'raider', 'quad', 'harvester', 'combatTank', 'missileTank', 'siegeTank', 'mcv', 'sonicTank', 'devastator', 'deviator', 'carryall', 'ornithopter'];
export const UPGRADE_ORDER = ['constructionYard', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'hiTech'];
export const LINE_FACTORIES = { structure: ['constructionYard'], infantry: ['barracks', 'wor'], light: ['lightFactory'], heavy: ['heavyFactory'], air: ['hiTech'] };
const LINE_OF_FACTORY = { barracks: 'infantry', wor: 'infantry', lightFactory: 'light', heavyFactory: 'heavy', hiTech: 'air' };
const UPGRADE = 'upgrade:';

export const upgradeId = (structureType) => UPGRADE + structureType;
export const upgradeTarget = (typeId) => (typeof typeId === 'string' && typeId.startsWith(UPGRADE) ? typeId.slice(UPGRADE.length) : null);

export function lineOfItem(typeId) {
  const up = upgradeTarget(typeId);
  if (up) return up === 'constructionYard' ? 'structure' : LINE_OF_FACTORY[up] ?? null;   // upgrades run on the improved factory's line
  if (STRUCTURES[typeId]) return 'structure';
  const u = UNITS[typeId];
  return (u && LINE_OF_FACTORY[u.builtAt]) ?? null;
}

export function ownedStructureTypes(world, houseId) {
  const owned = new Set();
  for (const s of world.structures.values()) if (s.house === houseId) owned.add(s.typeId);
  return owned;
}

export function structureTechLevel(t, houseId) { return t.techByHouse?.[houseId] ?? t.tech; }

export function upgradeLevel(house, structureType) { return house?.upgrades?.[structureType] ?? 0; }

/** The level the next purchase reaches: the Ordos get Heavy Factory level 3 along with level 2 (original). */
export function upgradeResult(house, structureType) {
  const next = upgradeLevel(house, structureType) + 1;
  return house.id === 'ordos' && structureType === 'heavyFactory' && next === 2 ? 3 : next;
}

export function upgradeCost(house, structureType) { return STRUCTURES[structureType]?.upgrades?.[upgradeLevel(house, structureType)] ?? 0; }

/** The next level is for sale when the house owns the factory, the tech level allows it and its extra prerequisites stand. */
export function canUpgrade(house, structureType, owned) {
  const t = STRUCTURES[structureType];
  if (!t?.upgrades || DEFERRED.has(structureType) || !owned.has(structureType)) return false;
  const level = upgradeLevel(house, structureType);
  if (level >= t.upgrades.length) return false;
  const tech = t.upgradeTechByHouse?.[house.id] ?? t.upgradeTech ?? [];
  if ((tech[upgradeResult(house, structureType) - 1] ?? 0) > house.techLevel) return false;   // the Ordos wait for level 3
  return (t.upgradeRequires?.[level] ?? []).every((r) => owned.has(r));
}

/** Names of what going from level `from` to `to` opens for the house (sidebar tooltips). */
export function upgradeUnlocks(houseId, structureType, from, to) {
  const opens = (need) => need > from && need <= to;
  const names = [];
  for (const id of UNIT_ORDER) {
    const u = UNITS[id];
    if (u.builtAt === structureType && opens(u.upgrade ?? 0) && u.houses.includes(houseId) && !DEFERRED.has(id)) names.push(u.name);
  }
  for (const id of STRUCTURE_ORDER) {
    const t = STRUCTURES[id];
    if (opens(t.requiresUpgrade?.[structureType] ?? 0) && t.houses.includes(houseId) && !DEFERRED.has(id)) names.push(t.name);
  }
  return names;
}

export function canBuildStructure(house, typeId, owned, { implied = true } = {}) {
  const t = STRUCTURES[typeId];
  if (!t || !t.requires || DEFERRED.has(typeId)) return false;
  if (!t.houses.includes(house.id) || structureTechLevel(t, house.id) > house.techLevel) return false;
  if (implied && typeId !== 'windtrap' && !t.isConcrete && !owned.has('windtrap')) return false;   // a Wind Trap is implied for everything (spec §4.5)
  return owned.has('constructionYard') && t.requires.every((r) => owned.has(r));
}

export function canBuildUnit(house, typeId, owned) {
  const u = UNITS[typeId];
  if (!u || !LINE_OF_FACTORY[u.builtAt] || DEFERRED.has(typeId) || !u.houses.includes(house.id)) return false;
  return owned.has(u.builtAt) && (u.requires ?? []).every((r) => owned.has(r));
}

export function canBuild(world, houseId, typeId, opts = {}) {
  const house = world.houses.get(houseId);
  if (!house) return false;
  const owned = ownedStructureTypes(world, houseId);
  const up = upgradeTarget(typeId);
  if (up) return canUpgrade(house, up, owned);
  return STRUCTURES[typeId] ? canBuildStructure(house, typeId, owned, opts) : canBuildUnit(house, typeId, owned);
}

export function buildOptions(world, houseId) {
  const out = { structure: [], infantry: [], light: [], heavy: [], air: [], upgrades: [] };
  const house = world.houses.get(houseId);
  if (!house) return out;
  const owned = ownedStructureTypes(world, houseId);
  for (const t of STRUCTURE_ORDER) if (canBuildStructure(house, t, owned)) out.structure.push(t);
  for (const t of UNIT_ORDER) if (canBuildUnit(house, t, owned)) out[lineOfItem(t)].push(t);
  for (const t of UPGRADE_ORDER) if (canUpgrade(house, t, owned)) out.upgrades.push(upgradeId(t));
  return out;
}
```

Modify `src/sim/production.js`:
- extend the header comment's last sentence with: ` Factory upgrades are items too: they run on the line of the factory they improve, ahead of its queue, and raise the house's level when done.`
- replace the tuning and tech imports with:
```js
import { DT, buildSeconds, UPGRADE_BUILD_TIME } from '../data/tuning.js';
import { LINE_FACTORIES, lineOfItem, canBuild, upgradeTarget, upgradeLevel, upgradeResult, upgradeCost } from './tech.js';
```
- replace `function makeItem(typeId) { … }` with:
```js
function makeItem(house, typeId) {
  const up = upgradeTarget(typeId);
  if (up) return { typeId, upgrade: up, level: upgradeResult(house, up), cost: upgradeCost(house, up), total: buildSeconds(UPGRADE_BUILD_TIME), progress: 0, paid: 0, state: 'building', starved: false };
  const t = STRUCTURES[typeId] ?? UNITS[typeId];
  return { typeId, cost: t.cost, total: buildSeconds(t.buildTime), progress: 0, paid: 0, state: 'building', starved: false };
}
```
- replace the body of `orderBuild` from `if (line === 'structure') {` through the end of the function with:
```js
  const upgrade = !!upgradeTarget(typeId);
  if (line === 'structure') {
    if (l.current) { eva(world, house, 'busy', 'Unable to comply, building in progress.'); return; }
    l.current = makeItem(house, typeId);
    if (upgrade) eva(world, house, 'upgrading', 'Upgrading.'); else eva(world, house, 'building', 'Building.');
    return;
  }
  if (upgrade) {   // one at a time, ahead of the units waiting on the line
    if (l.current?.typeId === typeId || l.queue.includes(typeId)) return;
    if (l.current) l.queue.unshift(typeId); else l.current = makeItem(house, typeId);
    eva(world, house, 'upgrading', 'Upgrading.');
    return;
  }
  const n = Math.max(1, Math.min(MAX_QUEUE, Math.floor(count) || 1));
  for (let k = 0; k < n; k++) {
    if ((l.current ? 1 : 0) + l.queue.length >= MAX_QUEUE) break;
    if (!l.current) l.current = makeItem(house, typeId); else l.queue.push(typeId);
  }
  eva(world, house, 'building', 'Building.');
}
```
- at the top of `complete`, before `if (line === 'structure') {`, add:
```js
  if (item.upgrade) {
    house.upgrades[item.upgrade] = Math.max(upgradeLevel(house, item.upgrade), item.level);
    house.lines[line].current = null;
    eva(world, house, 'upgradeComplete', 'Upgrade complete.');
    world.events.push('upgraded', { house: house.id, structureType: item.upgrade, level: house.upgrades[item.upgrade] });
    return;
  }
```
- in `updateProduction` replace `l.current = makeItem(l.queue.shift());` with `l.current = makeItem(house, l.queue.shift());`

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/upgrades.test.mjs`
Expected: PASS, 10/10.

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/structures.js src/data/houses.js src/data/tuning.js src/sim/house.js src/sim/tech.js src/sim/production.js tests/upgrades.test.mjs
git commit -m "feat(sim): factory upgrades as production items

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Upgrades gate units and structures; the computer buys them

**Files:**
- Modify: `src/sim/tech.js`, `src/sim/ai.js`
- Test: `tests/upgrades.test.mjs` (append), `tests/ai.test.mjs` (append and one change), `tests/tech.test.mjs`, `tests/sidebar-model.test.mjs`

**Interfaces:**
- Consumes: Task 1 (`upgradeLevel`, `upgradeId`, `upgradeCost`, `lineOfItem`, upgrade items).
- Produces: `canBuildUnit` requires `upgradeLevel(house, unit.builtAt) >= unit.upgrade`; `canBuildStructure` requires every `requiresUpgrade` level. The AI:
  - buys factory upgrades (Heavy, Light, Barracks/WOR) when it owns the factory and has the money above its reserve;
  - buys the Heavy Factory upgrade first when it must rebuild its MCV;
  - buys Construction Yard upgrades once it has a Heavy Factory and nothing else to build.

- [ ] **Step 1: Write the failing tests**

Append to `tests/upgrades.test.mjs`:
```js
test('units and structures wait for the upgrades they need', () => {
  const world = withStructures('atreides', ['constructionYard', 'windtrap', 'outpost', 'barracks', 'lightFactory', 'heavyFactory']);
  const h = world.houses.get('atreides');
  let o = buildOptions(world, 'atreides');
  assert.deepEqual([o.heavy, o.light, o.infantry], [['harvester', 'combatTank'], ['trike'], ['soldier']]);
  assert.ok(!o.structure.includes('concrete4') && !o.structure.includes('rocketTurret'));
  h.upgrades = { constructionYard: 1, barracks: 1, lightFactory: 1, heavyFactory: 1 };
  o = buildOptions(world, 'atreides');
  assert.deepEqual([o.heavy, o.light, o.infantry], [['harvester', 'combatTank', 'mcv'], ['trike', 'quad'], ['soldier', 'infantry']]);
  assert.ok(o.structure.includes('concrete4') && !o.structure.includes('rocketTurret'));
  h.upgrades = { constructionYard: 2, heavyFactory: 3 };
  o = buildOptions(world, 'atreides');
  assert.deepEqual(o.heavy, ['harvester', 'combatTank', 'missileTank', 'siegeTank', 'mcv']);
  assert.ok(o.structure.includes('rocketTurret'));
  world.issue('atreides', { type: 'build', typeId: 'quad' });
  world.step();
  assert.ok(world.events.drain().some((e) => e.type === 'commandRejected' && e.typeId === 'quad'), 'no Quad without the light factory upgrade');
});
```

Append to `tests/ai.test.mjs`:
```js
import { upgradeLevel } from '../src/sim/tech.js';

test('an AI buys factory upgrades and fields the units they open', () => {
  const world = flatWorld(48, 40, G.ROCK);
  for (const [t, x, y] of [['constructionYard', 2, 2], ['windtrap', 5, 2], ['windtrap', 8, 2], ['windtrap', 11, 2], ['refinery', 2, 6], ['outpost', 6, 6], ['lightFactory', 9, 6], ['heavyFactory', 12, 6]]) world.spawnStructure(t, 'atreides', x, y);
  const h = world.houses.get('atreides');
  h.credits = 20000;
  h.startBuffer = 40000;
  createBrain(world, 'atreides', 'normal');
  assert.ok(runUntil(world, () => upgradeLevel(h, 'heavyFactory') >= 3, 400) > 0, `heavy factory level ${upgradeLevel(h, 'heavyFactory')}`);
  assert.ok(runUntil(world, () => upgradeLevel(h, 'lightFactory') >= 1, 120) >= 0, 'the light factory too');
  assert.ok(runUntil(world, () => [...world.units.values()].some((u) => u.house === 'atreides' && (u.typeId === 'siegeTank' || u.typeId === 'missileTank')), 300) > 0, 'a missile or siege tank rolled out');
});
```

Modify `tests/ai.test.mjs` — in the test `an AI that loses its yard mid-game orders a new MCV at once and redeploys`, replace the `const mcvOrdered = …` line with (buying the upgrade that opens the MCV counts as ordering it):
```js
  const mcvOrdered = () => { const l = world.houses.get(rival).lines.heavy; return [l.current?.typeId, ...l.queue].some((t) => t === 'mcv' || t === 'upgrade:heavyFactory') || [...world.units.values()].some((u) => u.house === rival && u.typeId === 'mcv'); };
```

Modify `tests/tech.test.mjs` (plan-1 expectations assumed every upgrade bought):
- in `a bare Construction Yard offers concrete and wind traps` the expected list becomes `['concrete', 'windtrap']`;
- in `each prerequisite opens the next buildings` the first expected list becomes `['concrete', 'windtrap', 'refinery', 'outpost']` and the second `['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'lightFactory', 'heavyFactory', 'wall', 'turret']`;
- in `factories offer their house roster; plan-2 items stay hidden` replace the `const opts = …` line with:
```js
  const opts = (house) => {
    const world = withStructures(house, ['constructionYard', 'heavyFactory', 'lightFactory', 'barracks', 'wor', 'ix']);
    world.houses.get(house).upgrades = { heavyFactory: 3, lightFactory: 1, barracks: 1, wor: 1 };
    return buildOptions(world, house);
  };
```

Modify `tests/sidebar-model.test.mjs`:
- in `the strips list what the house can build, in display order` replace `['concrete', 'windtrap', 'concrete4']` with `['concrete', 'windtrap']` and `['trike', 'quad']` with `['trike']`;
- in `icons carry production state, progress and queue counts` delete the line `assert.equal(m.units.find((i) => i.typeId === 'quad').state, 'idle');`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/upgrades.test.mjs tests/tech.test.mjs tests/sidebar-model.test.mjs`
Expected: FAIL — `units and structures wait for the upgrades they need` sees `mcv` and `quad` offered, and the tech and sidebar expectations still see `concrete4`, `rocketTurret` and `quad`.

- [ ] **Step 3: Implement**

Modify `src/sim/tech.js`:
- in `canBuildStructure`, after the tech-level line add:
```js
  if (!Object.entries(t.requiresUpgrade ?? {}).every(([k, level]) => upgradeLevel(house, k) >= level)) return false;   // e.g. Rocket Turrets need yard level 2
```
- in `canBuildUnit`, after its first `if` add:
```js
  if (upgradeLevel(house, u.builtAt) < (u.upgrade ?? 0)) return false;   // e.g. the Quad needs the Light Factory upgrade
```

Modify `src/sim/ai.js`:
- replace the tech import with `import { canBuild, buildOptions, lineOfItem, upgradeId, upgradeLevel, upgradeCost } from './tech.js';`
- in `think`, replace `if (!rebuilding) buildArmy(world, house, view);   // the new MCV comes first` with:
```js
  if (!rebuilding) { buyUpgrades(world, house, view); buildArmy(world, house, view); }   // the new MCV comes first
```
- in `buildBase`, replace the last two lines (`const next = …` and the `if (next && …) issue(…)` line) with:
```js
  const next = nextStructure(world, house, view);
  if (next) {
    if (house.credits >= Math.min(STRUCTURES[next].cost, 150)) issue(world, house, { type: 'build', typeId: next });
    return;
  }
  const yardUp = upgradeId('constructionYard');   // the base stands: the yard upgrades that lead to Rocket Turrets
  if (view.count.heavyFactory && canBuild(world, house.id, yardUp) && house.credits >= upgradeCost(house, 'constructionYard') + DIFFICULTY[house.brain.difficulty].reserve) issue(world, house, { type: 'build', typeId: yardUp });
```
- replace `rebuildMcv` with:
```js
/** Without a Construction Yard or an MCV the base cannot grow: buy an MCV (after the upgrade that opens it) and deploy it. */
function rebuildMcv(world, house, view) {
  const heavy = house.lines.heavy;
  if (!view.count.heavyFactory || heavy.current?.typeId === 'mcv' || heavy.queue.includes('mcv')) return;
  if (canBuild(world, house.id, 'mcv')) { issue(world, house, { type: 'build', typeId: 'mcv' }); return; }   // queued behind the current item and paid as it builds
  const up = upgradeId('heavyFactory');
  if (upgradeLevel(house, 'heavyFactory') < 1 && canBuild(world, house.id, up) && heavy.current?.typeId !== up && !heavy.queue.includes(up)) issue(world, house, { type: 'build', typeId: up });
}
```
- after `buildArmy` add:
```js
const FACTORY_UPGRADES = ['heavyFactory', 'lightFactory', 'barracks', 'wor'];   // what the army needs, most useful first

/** Factory upgrades open better units: one new purchase per think, saving up for the most useful one. */
function buyUpgrades(world, house, view) {
  const d = DIFFICULTY[house.brain.difficulty];
  for (const type of FACTORY_UPGRADES) {
    const id = upgradeId(type);
    if (!view.count[type] || !canBuild(world, house.id, id)) continue;
    const l = house.lines[lineOfItem(id)];
    if (l.current?.typeId === id || l.queue.includes(id)) continue;   // already under way
    if (house.credits < upgradeCost(house, type) + d.reserve) return;
    issue(world, house, { type: 'build', typeId: id });
    return;
  }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/upgrades.test.mjs tests/tech.test.mjs tests/sidebar-model.test.mjs tests/ai.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: all pass (the AI-versus-AI soak included).

- [ ] **Step 5: Commit**

```bash
git add src/sim/tech.js src/sim/ai.js tests/upgrades.test.mjs tests/ai.test.mjs tests/tech.test.mjs tests/sidebar-model.test.mjs
git commit -m "feat(sim): upgrades gate units and structures; the AI buys them

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Upgrade icons in the structure strip

**Files:**
- Modify: `src/ui/sidebar-model.js`, `src/ui/sidebar.js`, `src/render/icons.js`, `src/ui/selection-panel.js`, `src/scenes/icons.js`
- Test: `tests/sidebar-model.test.mjs`, `tests/icons.test.mjs` (append), `tests/selection-panel.test.mjs`

**Interfaces:**
- Consumes: Task 1 (`buildOptions(...).upgrades`, `upgradeTarget`, `upgradeLevel`, `upgradeResult`, `upgradeCost`, `upgradeUnlocks`, `UPGRADE_BUILD_TIME`).
- Produces:
  - Sidebar entries: every entry gains `icon` (its icon key — the type id, or `upgrade:<type>:<level>` for upgrades). Upgrade entries also carry `note` (`Level N — unlocks …`) and the line they run on.
  - `upgradeIconKey(key) → { structureType, level } | null` in icons.js, and `IconFactory.forItem` accepts upgrade keys (building icon plus a gold arrow and the level).
  - The panel for an own factory shows `Upgrade level N of M`.

- [ ] **Step 1: Write the failing tests**

Modify `tests/sidebar-model.test.mjs` — in `the strips list what the house can build, in display order` replace `['concrete', 'windtrap']` with `['concrete', 'windtrap', 'upgrade:constructionYard']`. Then append:
```js
test('upgrades close the structure strip with their level, price, time and what they open', () => {
  const { world } = base();
  factories(world);
  let m = sidebarModel(world, 'atreides');
  assert.deepEqual(m.structures.slice(-2).map((i) => i.typeId), ['upgrade:constructionYard', 'upgrade:lightFactory']);
  const up = m.structures.at(-1);
  assert.deepEqual([up.line, up.icon, up.name, up.cost, up.seconds, up.state], ['light', 'upgrade:lightFactory:1', 'Light Factory upgrade', 200, 9, 'idle']);
  assert.equal(up.note, 'Level 1 — unlocks Quad');
  assert.equal(m.structures[0].icon, 'concrete', 'other icons are keyed by their type');
  world.issue('atreides', { type: 'build', typeId: 'upgrade:lightFactory' });
  run(world, 3);
  const busy = sidebarModel(world, 'atreides').structures.at(-1);
  assert.equal(busy.state, 'building');
  assert.ok(busy.progress > 0.3 && busy.progress < 0.36, `progress ${busy.progress}`);
  run(world, 6.2);
  m = sidebarModel(world, 'atreides');
  assert.ok(!m.structures.some((i) => i.typeId === 'upgrade:lightFactory'), 'nothing more to buy');
  assert.deepEqual(m.units.map((i) => i.typeId), ['trike', 'quad']);
});
```

Append to `tests/icons.test.mjs`:
```js
import { upgradeIconKey } from '../src/render/icons.js';

test('upgrade icon keys name the building and the level it reaches', () => {
  assert.deepEqual(upgradeIconKey('upgrade:heavyFactory:2'), { structureType: 'heavyFactory', level: 2 });
  assert.equal(upgradeIconKey('heavyFactory'), null);
  assert.equal(upgradeIconKey('upgrade:windtrap:1'), null, 'wind traps have no upgrades');
});
```

Modify `tests/selection-panel.test.mjs` — in `an own factory offers Repair, Sell and Set primary` replace `assert.deepEqual(m.details, ['Power use 20', 'Primary factory', 'Rally point set']);` with:
```js
  assert.deepEqual(m.details, ['Power use 20', 'Upgrade level 0 of 1', 'Primary factory', 'Rally point set']);
  world.houses.get('atreides').upgrades.lightFactory = 1;
  assert.ok(selectionPanelModel(world, sel, 'atreides').details.includes('Upgrade level 1 of 1'));
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/sidebar-model.test.mjs tests/icons.test.mjs tests/selection-panel.test.mjs`
Expected: FAIL — no upgrade entries in the strip, `upgradeIconKey` not exported, and no upgrade level in the panel.

- [ ] **Step 3: Implement**

Modify `src/ui/sidebar-model.js`:
- header comment: replace `two build strips — structures, then the units of every line —` with `two build strips — structures and factory upgrades, then the units of every line —`;
- replace the imports of tuning and tech with:
```js
import { buildSeconds, UPGRADE_BUILD_TIME } from '../data/tuning.js';
import { buildOptions, lineOfItem, upgradeTarget, upgradeLevel, upgradeResult, upgradeCost, upgradeUnlocks } from '../sim/tech.js';
```
- in `sidebarModel`, replace the `entry` function with:
```js
  const entry = (line) => (typeId) => {
    const t = STRUCTURES[typeId] ?? UNITS[typeId];
    return { typeId, line, icon: typeId, name: t.name, cost: t.cost, seconds: Math.round(buildSeconds(t.buildTime)), ...itemState(house.lines[line], typeId, line) };
  };
  const upgrade = (typeId) => {
    const target = upgradeTarget(typeId), line = lineOfItem(typeId);
    const cur = house.lines[line].current?.typeId === typeId ? house.lines[line].current : null;
    const level = cur?.level ?? upgradeResult(house, target);
    const opens = upgradeUnlocks(houseId, target, upgradeLevel(house, target), level);
    return {
      typeId, line, icon: `${typeId}:${level}`, name: `${STRUCTURES[target].name} upgrade`, cost: cur?.cost ?? upgradeCost(house, target),
      seconds: Math.round(buildSeconds(UPGRADE_BUILD_TIME)), note: `Level ${level}${opens.length ? ` — unlocks ${opens.join(', ')}` : ''}`,
      ...itemState(house.lines[line], typeId, line),
    };
  };
```
- replace `structures: options.structure.map(entry('structure')),` with `structures: [...options.structure.map(entry('structure')), ...options.upgrades.map(upgrade)],`.

Modify `src/ui/sidebar.js`:
- header comment: after `two build strips (structures | units)` insert ` — factory upgrades close the structure strip —`;
- in `fill` replace `const key = items.map((i) => i.typeId).join(',');` with `const key = items.map((i) => i.icon).join(',');   // an upgrade that levels up gets its new icon`;
- in `makeButton` replace `img.src = this.iconFor(item.typeId);` with `img.src = this.iconFor(item.icon);`;
- in `showTip` replace the line that sets the span text with:
```js
    this.tip.querySelector('span').textContent = i.state === 'ready' ? 'Ready — click to place' : [`Cost ${i.cost} · ${i.seconds} s`, i.note].filter(Boolean).join(' · ');
```

Modify `src/render/icons.js`:
- after `flipRows` add:
```js
/** 'upgrade:<structure>:<level>' → the upgrade icon it names, or null. */
export function upgradeIconKey(key) {
  const m = /^upgrade:(\w+):(\d+)$/.exec(key);
  return m && STRUCTURES[m[1]]?.upgrades ? { structureType: m[1], level: Number(m[2]) } : null;
}

/** Upgrade icons: the building with a gold arrow and the level it reaches in the top right corner. */
function drawUpgradeBadge(ctx, level) {
  const x = ICON_W - 46, y = 4;
  ctx.save();
  ctx.fillStyle = 'rgba(20, 14, 6, 0.85)';
  ctx.strokeStyle = '#e8b84a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, 42, 30, 6); else ctx.rect(x, y, 42, 30);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 24);
  ctx.lineTo(x + 14, y + 6);
  ctx.lineTo(x + 22, y + 24);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 19px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(level), x + 32, y + 16);
  ctx.restore();
}
```
- replace `get(modelId, color, yaw = 0) {` … through the end of `get` with:
```js
  get(modelId, color, yaw = 0, badge = 0) {
    const key = `${modelId}|${color}|${yaw}|${badge}`;
    let url = this.cache.get(key);
    if (!url) { url = this.render(modelId, color, yaw, badge); this.cache.set(key, url); }
    return url;
  }
```
- change the signature `render(modelId, color, yaw) {` to `render(modelId, color, yaw, badge = 0) {`, and replace the line `this.ctx.putImageData(new ImageData(flipRows(this.pixels, ICON_W, ICON_H), ICON_W, ICON_H), 0, 0);` with:
```js
    this.ctx.putImageData(new ImageData(flipRows(this.pixels, ICON_W, ICON_H), ICON_W, ICON_H), 0, 0);
    if (badge) drawUpgradeBadge(this.ctx, badge);
```
- replace `forItem` with:
```js
  forItem(typeId, houseId) {
    const color = HOUSES[houseId]?.color ?? 0xffffff;
    const up = upgradeIconKey(typeId);
    if (up) { const t = STRUCTURES[up.structureType]; return this.get(structureModelId(up.structureType, t.w, t.h), color, 0, up.level); }
    const s = STRUCTURES[typeId];
    return s ? this.get(structureModelId(typeId, s.w, s.h), color) : this.get(unitModelId(typeId), color, UNIT_ICON_YAW);
  }
```

Modify `src/ui/selection-panel.js`:
- replace `import { LINE_FACTORIES } from '../sim/tech.js';` with `import { LINE_FACTORIES, upgradeLevel } from '../sim/tech.js';`
- in `structureModel`, after `if (t.storage) details.push(`Storage ${t.storage}`);` add:
```js
  if (t.upgrades) details.push(`Upgrade level ${upgradeLevel(world.houses.get(houseId), s.typeId)} of ${t.upgrades.length}`);
```

Modify `src/scenes/icons.js` — replace `for (const typeId of [...Object.keys(STRUCTURE_MODEL), ...Object.keys(UNIT_MODEL)]) {` with:
```js
  for (const typeId of [...Object.keys(STRUCTURE_MODEL), ...Object.keys(UNIT_MODEL), 'upgrade:constructionYard:2', 'upgrade:lightFactory:1', 'upgrade:heavyFactory:3']) {
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/sidebar-model.test.mjs tests/icons.test.mjs tests/selection-panel.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/sidebar-model.js src/ui/sidebar.js src/render/icons.js src/ui/selection-panel.js src/scenes/icons.js tests/sidebar-model.test.mjs tests/icons.test.mjs tests/selection-panel.test.mjs
git commit -m "feat(ui): upgrade icons in the structure strip

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The Repair Facility bay

**Files:**
- Create: `src/sim/repair-bay.js`
- Modify: `src/data/phase.js`, `src/data/structures.js`, `src/data/tuning.js`, `src/sim/harvest.js`, `src/sim/orders.js`, `src/sim/world.js`, `src/sim/combat.js`, `src/sim/aftermath.js`, `src/sim/structure-actions.js`, `src/sim/invariants.js`
- Test: `tests/repair-bay.test.mjs` (new), `tests/tech.test.mjs`

**Interfaces:**
- Consumes: `dockTile` / `clearDock` (harvest.js), `exitTile` / `findFreeTile` (spawn.js), `stopUnit` / `orderMove` (orders.js), `killUnit` (combat.js).
- Produces:
  - Command `{ type: 'repairAt', ids, structureId }` and `needsRepair(u)` (a damaged ground vehicle not already in a bay).
  - `orderRepairAt(world, houseId, units, structureId)`, `updateRepairOrder(world, u)`, `updateRepairBays(world)`, `emptyBay(world, s, 'destroyed' | 'sold', attacker)`, `padPoint(s)`.
  - Unit field `u.inside` (the structure id, 0 otherwise). Structure fields `s.occupant` (unit id) and `s.bay = { state: 'entering' | 'repairing' | 'leaving', t, fromX, fromY, toX, toY, stalled }`.
  - Events `repairOrdered`, `bayEntered { id, structureId, house, x, y }`, `unitRepaired { id, structureId, house, x, y }`, `bayLeft`.
  - Data `repair.entrance = [1, 2]`, `repair.pad = [1.5, 1]`; `UNIT_REPAIR_COST`, `BAY_DRIVE_SECONDS`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/repair-bay.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { destroyStructure } from '../src/sim/combat.js';
import { splash } from '../src/sim/aftermath.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

function bay(credits = 5000) {
  const world = flatWorld(32, 32, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = credits;
  h.startBuffer = 100000;
  world.spawnStructure('windtrap', 'atreides', 2, 2);
  const s = world.spawnStructure('repair', 'atreides', 10, 10);   // entrance 11,12; pad 11.5,11
  return { world, h, s };
}
const tank = (world, x, y, hp = 100) => { const u = world.spawnUnit('combatTank', 'atreides', x, y); u.hp = hp; return u; };
const sendIn = (world, units, s) => world.issue('atreides', { type: 'repairAt', ids: units.map((u) => u.id), structureId: s.id });

test('a damaged tank drives into the bay, is repaired for its damage and drives out', () => {
  const { world, h, s } = bay();
  const u = tank(world, 11, 20);
  sendIn(world, [u], s);
  assert.ok(runUntil(world, () => u.inside === s.id, 30) > 0, 'it went in');
  assert.equal(s.occupant, u.id);
  assert.equal(world.map.unit[world.map.idx(11, 12)], 0, 'the entrance is free for the next one');
  assert.deepEqual(checkInvariants(world), []);
  const before = h.credits;
  const t = runUntil(world, () => !u.inside, 40);
  assert.ok(t > 15 && t < 18, `half a repair takes half the build time (14.4 s) plus driving on and off: ${t}`);
  assert.equal(u.hp, 200);
  assert.ok(Math.abs(before - h.credits - 37.5) < 0.5, `paid ${before - h.credits}`);
  assert.equal(u.order.type, 'idle');
  assert.equal(world.map.unit[world.map.idx(u.tx, u.ty)], u.id);
  assert.deepEqual(checkInvariants(world), []);
});

test('a second vehicle waits by the entrance and goes in when the bay is free', () => {
  const { world, s } = bay();
  const a = tank(world, 11, 18), b = tank(world, 13, 18);
  sendIn(world, [a, b], s);
  assert.ok(runUntil(world, () => !!s.occupant, 30) > 0);
  const first = world.units.get(s.occupant), second = first === a ? b : a;
  run(world, 5);
  assert.ok(!second.inside && Math.max(Math.abs(second.tx - 11), Math.abs(second.ty - 12)) <= 3, `waits near the entrance at ${second.tx},${second.ty}`);
  assert.ok(runUntil(world, () => second.inside === s.id, 40) > 0, 'in after the first');
  assert.equal(first.hp, first.maxHp);
  assert.ok(runUntil(world, () => !second.inside, 40) > 0);
  assert.equal(second.hp, second.maxHp);
});

test('a unit parked on the entrance is moved off it', () => {
  const { world, s } = bay();
  const parked = world.spawnUnit('combatTank', 'atreides', 11, 12);
  const u = tank(world, 11, 18);
  sendIn(world, [u], s);
  assert.ok(runUntil(world, () => u.inside === s.id, 40) > 0);
  assert.notDeepEqual([parked.tx, parked.ty], [11, 12]);
});

test('only damaged vehicles of the owner go in', () => {
  const { world, s } = bay();
  const soldier = world.spawnUnit('soldier', 'atreides', 5, 20);
  soldier.hp = 5;
  const healthy = tank(world, 7, 20, 200);
  const foe = world.spawnUnit('combatTank', 'harkonnen', 9, 26);
  foe.hp = 50;
  sendIn(world, [soldier, healthy], s);
  world.issue('harkonnen', { type: 'repairAt', ids: [foe.id], structureId: s.id });
  world.step();
  assert.deepEqual([soldier.order.type, healthy.order.type, foe.order.type], ['idle', 'idle', 'idle']);
});

test('inside the bay a vehicle cannot be targeted, splashed or ordered about', () => {
  const { world, s } = bay();
  const u = tank(world, 11, 14);
  sendIn(world, [u], s);
  assert.ok(runUntil(world, () => u.inside === s.id, 20) > 0);
  const foe = world.spawnUnit('combatTank', 'harkonnen', 20, 11);
  world.issue('harkonnen', { type: 'attack', ids: [foe.id], targetKind: 'unit', targetId: u.id });
  world.issue('atreides', { type: 'move', ids: [u.id], x: 2, y: 20 });
  world.step();
  assert.equal(foe.order.type, 'idle', 'no valid target');
  assert.equal(u.order.type, 'repairAt');
  const hp = u.hp;
  splash(world, u.x, u.y, 100, 1.5, null);
  assert.equal(u.hp, hp);
  assert.ok(s.hp < s.maxHp, 'the building took the blast');
});

test('a destroyed bay takes the vehicle inside with it; a sold one pushes it out', () => {
  const one = bay();
  const u = tank(one.world, 11, 14);
  sendIn(one.world, [u], one.s);
  assert.ok(runUntil(one.world, () => u.inside === one.s.id, 20) > 0);
  one.world.events.drain();
  destroyStructure(one.world, one.s, { house: 'harkonnen', id: 0, kind: 'unit' });
  assert.equal(one.world.units.has(u.id), false);
  assert.equal(one.world.events.drain().find((e) => e.type === 'unitDestroyed' && e.id === u.id)?.by, 'harkonnen');
  assert.deepEqual(checkInvariants(one.world), []);

  const two = bay();
  const v = tank(two.world, 11, 14);
  sendIn(two.world, [v], two.s);
  assert.ok(runUntil(two.world, () => v.inside === two.s.id, 20) > 0);
  run(two.world, 3);
  two.world.issue('atreides', { type: 'sell', structureId: two.s.id });
  two.world.step();
  assert.ok(two.world.units.has(v.id) && !v.inside, 'out and alive');
  assert.equal(two.world.map.unit[two.world.map.idx(v.tx, v.ty)], v.id);
  assert.ok(v.hp < v.maxHp, 'the repair was cut short');
  assert.deepEqual(checkInvariants(two.world), []);
});

test('without credits the repair pauses and picks up again', () => {
  const { world, h, s } = bay(0);
  const u = tank(world, 11, 14);
  sendIn(world, [u], s);
  assert.ok(runUntil(world, () => u.inside === s.id, 20) > 0);
  run(world, 5);
  assert.equal(u.hp, 100);
  assert.ok(world.events.drain().some((e) => e.type === 'eva' && e.key === 'insufficientFunds'));
  h.credits = 1000;
  assert.ok(runUntil(world, () => u.hp === 200, 30) > 0);
});

test('a harvester goes back to its routine after the repair', () => {
  const { world, s } = bay();
  const hv = world.spawnUnit('harvester', 'atreides', 11, 16);
  hv.hp = 75;
  sendIn(world, [hv], s);
  assert.ok(runUntil(world, () => hv.inside === s.id, 20) > 0);
  assert.ok(runUntil(world, () => !hv.inside, 40) > 0);
  assert.equal(hv.order.type, 'harvest');
  assert.equal(hv.hp, hv.maxHp);
});
```

Modify `tests/tech.test.mjs` — in `each prerequisite opens the next buildings` the second expected list becomes `['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'lightFactory', 'heavyFactory', 'repair', 'wall', 'turret']`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/repair-bay.test.mjs tests/tech.test.mjs`
Expected: FAIL — `repairAt` is an unknown command (the vehicles never go inside), and `repair` is still deferred.

- [ ] **Step 3: Implement**

Modify `src/data/phase.js` — replace `'hiTech', 'repair', 'starport',` with `'hiTech', 'starport',`.

Modify `src/data/structures.js` — replace the line starting `  repair:           { name: 'Repair Facility'` with:
```js
  repair:           { name: 'Repair Facility', w: 3, h: 2, cost: 700, buildTime: 80, hp: 200, power: 20, sight: 3, requires: ['lightFactory', 'outpost'], houses: ALL, tech: 5, conquerable: true, entrance: [1, 2], pad: [1.5, 1] },
```

Append to `src/data/tuning.js`:
```js
export const UNIT_REPAIR_COST = 0.25;           // a full repair at the Repair Facility costs a quarter of the unit (original: build rate ÷ 4)
export const BAY_DRIVE_SECONDS = 1;             // driving onto or off the repair pad
```

Modify `src/sim/harvest.js`:
- replace the doc comment of `dockTile` with:
```js
/**
 * The tile a vehicle docks on — a refinery's unloading spot south of the pad column, a repair bay's
 * entrance — or, when terrain or a building blocks it, the nearest open ground around that tile. Units
 * standing about never move it (a dock that moved whenever a harvester reached it could never be
 * reached); it is cached until the map changes.
 */
```
- in `dockTile` replace `const x = ref.x + ref.w - 1, y = ref.y + ref.h;` with:
```js
  const [dx, dy] = ref.type?.entrance ?? [ref.w - 1, ref.h];
  const x = ref.x + dx, y = ref.y + dy;
```
- replace `function clearDock(world, id, requester) {` with `export function clearDock(world, id, requester) {`.

**File: `src/sim/repair-bay.js`**
```js
// Repair Facility (spec §4.6; research: structures.md "Repair Facility"): vehicles ordered to it drive
// to the entrance south of the pad and, one at a time, onto the pad under the gantry. Inside they are
// off the tile grid: they cannot be shot or splashed and take no orders. A full repair takes as long
// as building the unit and costs a quarter of its price, both in proportion to the damage; low power
// slows it like production and it pauses without credits. Then the vehicle drives out by the nearest
// free tile and heads for the facility's rally point, or back to harvesting. The others wait near the
// entrance. Infantry and aircraft cannot use it. The vehicle shares the bay's fate: destroyed with it,
// pushed out when the facility is sold, captured along with it.
import { DT, buildSeconds, UNIT_REPAIR_COST, BAY_DRIVE_SECONDS } from '../data/tuning.js';
import { spend } from './economy.js';
import { exitTile, findFreeTile } from './spawn.js';
import { dockTile, clearDock } from './harvest.js';
import { orderMove, stopUnit } from './orders.js';
import { killUnit } from './combat.js';
import { turnToward } from './geometry.js';

const VEHICLES = new Set(['tracked', 'wheeled', 'harvester']);
const FUNDS_WARNING_SECONDS = 10;
const GIVE_UP_TRIES = 12;
const TURN_ON_PAD = 4;   // radians per second while driving on or off

export const needsRepair = (u) => u.isGround && VEHICLES.has(u.move) && !u.inside && u.hp < u.maxHp;
const moving = (u) => !!u.step || u.pathState === 'waiting' || (u.pathState === 'ready' && u.pathIndex < u.path.length);
const near = (map, u, i, r) => Math.max(Math.abs(u.tx - map.xOf(i)), Math.abs(u.ty - map.yOf(i))) <= r;

/** Where a vehicle stands in the bay (tile units). */
export function padPoint(s) {
  const [px, py] = s.type.pad ?? [s.w / 2, s.h / 2];
  return { x: s.x + px, y: s.y + py };
}

export function orderRepairAt(world, houseId, units, structureId) {
  const s = world.structures.get(structureId);
  if (!s || s.house !== houseId || s.typeId !== 'repair') return;
  const ids = [];
  for (const u of units) {
    if (!needsRepair(u)) continue;
    const resume = u.harvest ? 'harvest' : null;
    stopUnit(u);
    u.order = { type: 'repairAt', structureId: s.id, tries: 0, retryAt: 0, wait: 0, resume };
    u.target = null;
    u.aiming = false;
    ids.push(u.id);
  }
  if (ids.length) world.events.push('repairOrdered', { ids, structureId: s.id, house: houseId });
}

/** A vehicle on its way to the bay: runs before movement, like the harvester routine. */
export function updateRepairOrder(world, u) {
  const o = u.order, map = world.map;
  const s = world.structures.get(o.structureId);
  const dock = s && s.house === u.house && u.hp < u.maxHp ? dockTile(world, s) : -1;
  if (dock < 0) { stopUnit(u); return; }   // gone, taken, repaired some other way, or walled in
  if (moving(u)) return;
  const busy = !!s.occupant && world.units.has(s.occupant);
  if (map.idx(u.tx, u.ty) === dock && !busy) { enter(world, u, s); return; }
  const parked = map.unit[dock] && map.unit[dock] !== u.id ? world.units.get(map.unit[dock]) : null;
  if ((busy || parked) && near(map, u, dock, 3)) {   // wait close by, and move a parked friend off the entrance
    if ((o.wait -= DT) > 0) return;
    o.wait = 1;
    if (parked && parked.order.type !== 'repairAt') clearDock(world, parked.id, u);
    return;
  }
  if (world.tick < o.retryAt) return;
  if (++o.tries > GIVE_UP_TRIES) { stopUnit(u); world.events.push('moveFailed', { id: u.id }); return; }
  o.retryAt = world.tick + 20;
  world.requestPath(u, dock);
}

function enter(world, u, s) {
  const map = world.map, here = map.idx(u.tx, u.ty);
  if (map.unit[here] === u.id) map.unit[here] = 0;
  u.path = []; u.pathIndex = 0; u.pathState = 'none'; u.goal = -1;
  const pad = padPoint(s);
  u.inside = s.id;
  u.tx = Math.floor(pad.x);
  u.ty = Math.floor(pad.y);
  s.occupant = u.id;
  s.bay = { state: 'entering', t: 0, fromX: u.x, fromY: u.y, toX: pad.x, toY: pad.y, stalled: false };
  world.events.push('bayEntered', { id: u.id, structureId: s.id, house: s.house, x: pad.x, y: pad.y });
}

/** Vehicles driving on, being repaired and driving off (once per tick, after production). */
export function updateRepairBays(world) {
  for (const s of world.structures.values()) {
    if (!s.occupant) continue;
    const u = world.units.get(s.occupant);
    if (!u || u.inside !== s.id) { s.occupant = 0; s.bay = null; continue; }
    const bay = s.bay;
    if (bay.state === 'repairing') { repair(world, s, u, bay); continue; }
    drive(u, bay);
    if (bay.t < 1) continue;
    if (bay.state === 'entering') bay.state = 'repairing';
    else release(world, s, u);
  }
}

function drive(u, bay) {
  const dx = bay.toX - bay.fromX, dy = bay.toY - bay.fromY;
  bay.t = Math.min(1, bay.t + DT / BAY_DRIVE_SECONDS);
  u.x = bay.fromX + dx * bay.t;
  u.y = bay.fromY + dy * bay.t;
  u.distance += (Math.hypot(dx, dy) * DT) / BAY_DRIVE_SECONDS;   // wheels and treads turn
  if (dx || dy) u.heading = turnToward(u.heading, Math.atan2(dy, dx), TURN_ON_PAD * DT);
  if (!u.type.turret) u.turret = u.heading;
}

function repair(world, s, u, bay) {
  const house = world.houses.get(s.house);
  if (u.hp < u.maxHp) {
    const speed = Math.max(0.25, house?.power.ratio ?? 1) * (house?.buildSpeed ?? 1);
    const hp = Math.min(u.maxHp - u.hp, (u.maxHp / buildSeconds(u.type.buildTime)) * speed * DT);
    const cost = (hp / u.maxHp) * u.type.cost * UNIT_REPAIR_COST;
    if (!house || !spend(house, cost)) {
      if (house && !bay.stalled && world.time - (house.lastFundsWarning ?? -1e9) >= FUNDS_WARNING_SECONDS) {
        house.lastFundsWarning = world.time;
        world.events.push('eva', { house: house.id, key: 'insufficientFunds', text: 'Insufficient funds.' });
      }
      bay.stalled = true;
      return;
    }
    bay.stalled = false;
    u.hp = u.maxHp - u.hp - hp < 1e-6 ? u.maxHp : u.hp + hp;
    if (u.hp < u.maxHp) return;
  }
  const spot = exitTile(world, s, u.move);
  if (!spot) return;   // boxed in: wait for room
  const map = world.map;
  map.unit[map.idx(spot.x, spot.y)] = u.id;   // hold the way out
  u.tx = spot.x;
  u.ty = spot.y;
  Object.assign(bay, { state: 'leaving', t: 0, fromX: u.x, fromY: u.y, toX: spot.x + 0.5, toY: spot.y + 0.5 });
  world.events.push('unitRepaired', { id: u.id, structureId: s.id, house: s.house, x: u.x, y: u.y });
}

function release(world, s, u) {
  u.inside = 0;
  u.x = s.bay.toX;
  u.y = s.bay.toY;
  s.occupant = 0;
  s.bay = null;
  const resume = u.order.resume;
  stopUnit(u);
  if (resume === 'harvest' && u.harvest) { u.order = { type: 'harvest' }; u.harvest.state = 'seek'; u.harvest.wait = 0; }
  else if (s.rally) orderMove(world, [u], s.rally.x, s.rally.y);
  world.events.push('bayLeft', { id: u.id, structureId: s.id, house: s.house });
}

/** The facility is going: 'destroyed' takes the vehicle inside with it, 'sold' pushes it out unfinished. */
export function emptyBay(world, s, how, attacker = null) {
  const u = s.occupant ? world.units.get(s.occupant) : null;
  s.occupant = 0;
  s.bay = null;
  if (!u || u.inside !== s.id) return;
  if (how === 'destroyed') { killUnit(world, u, attacker); return; }
  const map = world.map;
  const held = map.unit[map.idx(u.tx, u.ty)] === u.id;   // already on its way out
  const spot = held ? { x: u.tx, y: u.ty } : exitTile(world, s, u.move) ?? findFreeTile(world, s.x + 1, s.y + s.h, u.move, 8, 1);
  if (!spot) { killUnit(world, u, null); return; }
  map.unit[map.idx(spot.x, spot.y)] = u.id;
  u.inside = 0;
  u.tx = spot.x;
  u.ty = spot.y;
  u.x = spot.x + 0.5;
  u.y = spot.y + 0.5;
  stopUnit(u);
  world.events.push('bayLeft', { id: u.id, structureId: s.id, house: s.house });
}
```

Modify `src/sim/orders.js`:
- add the import `import { orderRepairAt } from './repair-bay.js';`
- in `applyCommand` replace `.filter((u) => u && u.house === houseId);` with `.filter((u) => u && u.house === houseId && !u.inside);   // a vehicle in a repair bay takes no orders`
- add the case (after `case 'returnToBase': …`):
```js
    case 'repairAt': orderRepairAt(world, houseId, units, cmd.structureId); return;
```

Modify `src/sim/world.js`:
- add the import `import { updateRepairOrder, updateRepairBays, emptyBay } from './repair-bay.js';`
- replace the `this.onStructureKilled = …` line with:
```js
    this.onStructureKilled = (s, attacker) => { emptyBay(this, s, 'destroyed', attacker); aftermathOfStructure(this, s); alertStructureKilled(this, s, attacker); };
```
- in `step`, replace the per-unit loop with:
```js
    for (const u of [...this.units.values()]) {
      if (!this.units.has(u.id) || u.inside) continue;   // a vehicle in a repair bay is moved by the bay
      if (u.harvest) updateHarvester(this, u);
      if (u.order.type === 'repairAt') updateRepairOrder(this, u);
      updateMovement(this, u);
    }
```
- after `updateRepairs(this);` add `updateRepairBays(this);`

Modify `src/sim/combat.js`:
- in `findTarget` replace `if (u.house === houseId || !u.isGround || u.id === exclude) continue;` with `if (u.house === houseId || !u.isGround || u.inside || u.id === exclude) continue;`
- in `validTarget` replace `if (t.kind === 'unit' && !e.isGround) return false;   // aircraft arrive in plan 2` with `if (t.kind === 'unit' && (!e.isGround || e.inside)) return false;   // aircraft arrive in plan 2b; vehicles in a repair bay are safe`
- in `updateCombat` replace `if (u.isGround && isArmed(u.type)) unitCombat(world, u);` with `if (u.isGround && !u.inside && isArmed(u.type)) unitCombat(world, u);`

Modify `src/sim/aftermath.js` — in `splash` replace `if (!u.isGround) continue;` with `if (!u.isGround || u.inside) continue;`.

Modify `src/sim/structure-actions.js`:
- add the import `import { emptyBay } from './repair-bay.js';`
- in `orderSell`, before `world.removeStructure(s, 'sold');` add `emptyBay(world, s, 'sold');   // a vehicle in the bay drives out unfinished`

Modify `src/sim/invariants.js`:
- header comment: replace `every ground unit holds its tile(s),` with `every ground unit holds its tile(s) (a vehicle in a repair bay none, or the one it drives out to),`
- in the unit loop, replace `const n = held.get(u.id) ?? 0;` with:
```js
    const n = held.get(u.id) ?? 0;
    if (u.inside) {
      const s = world.structures.get(u.inside);
      if (!s || s.occupant !== u.id) problems.push(`unit ${u.id} is inside a structure that does not hold it`);
      if (n > 1) problems.push(`unit ${u.id} in a bay holds ${n} tiles`);
      continue;
    }
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/repair-bay.test.mjs tests/tech.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/phase.js src/data/structures.js src/data/tuning.js src/sim/repair-bay.js src/sim/harvest.js src/sim/orders.js src/sim/world.js src/sim/combat.js src/sim/aftermath.js src/sim/structure-actions.js src/sim/invariants.js tests/repair-bay.test.mjs tests/tech.test.mjs
git commit -m "feat(sim): Repair Facility bay — vehicles drive in, are repaired for credits and drive out

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Repair Facility model, vehicles on the pad, welding sparks

**Files:**
- Create: `src/render/models/structures/repair.js`
- Modify: `src/render/models/index.js`, `src/render/views/structure-views.js`, `src/render/views/unit-views.js`, `src/render/effects.js`, `src/game/game-view.js`, `src/scenes/structures.js`
- Test: `tests/models-catalog.test.mjs`, `tests/views.test.mjs` (append), `tests/effects.test.mjs` (append)

**Interfaces:**
- Consumes: Task 4 (`s.bay`, `s.occupant`, `u.inside`, `padPoint`).
- Produces:
  - Model `repairFacility` with nodes `padLights` (scale) and `arm` (the hoist, sliding along z); `STRUCTURE_MODEL.repair`.
  - `StructureViews.weldPoint(id, now) → {x, y, z} | null`, non-null only while repairing and not stalled.
  - `Effects.weld(x, y, z)`; unit views lift vehicles in a bay onto the pad plate.

- [ ] **Step 1: Write the failing tests**

Modify `tests/models-catalog.test.mjs` — in `every plan-1b structure has a real model with its animated nodes` add `'repair'` to the list of ids, and after the `nodes('barracks')…` assertion add:
```js
  assert.ok(nodes('repair').arm && nodes('repair').padLights);
```

Append to `tests/views.test.mjs`:
```js
import { runUntil } from './helpers.mjs';

test('a vehicle in the repair bay stands on the pad while the hoist works and welds', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 1000;
  h.startBuffer = 5000;
  world.spawnStructure('windtrap', 'atreides', 1, 1);
  const bay = world.spawnStructure('repair', 'atreides', 8, 8);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const units = new UnitViews(new THREE.Scene(), hf);
  const structures = new StructureViews(new THREE.Scene(), hf);
  const t = world.spawnUnit('combatTank', 'atreides', 9, 12);
  t.hp = 100;
  structures.sync(world, 0);
  assert.equal(structures.weldPoint(bay.id, 0), null, 'nothing to weld');
  world.issue('atreides', { type: 'repairAt', ids: [t.id], structureId: bay.id });
  assert.ok(runUntil(world, () => bay.bay?.state === 'repairing', 20) > 0);
  structures.sync(world, 5000);
  units.sync(world, 1, 0.016);
  const p = pos(units.views.get(t.id).handles[0].matrix);
  assert.deepEqual([+p.x.toFixed(2), +p.z.toFixed(2)], [9.5, 9]);
  assert.ok(p.y > hf.heightAt(9.5, 9) + 0.05, 'on the pad plate');
  const w = structures.weldPoint(bay.id, 5000);
  assert.ok(w && Math.abs(w.x - 9.5) < 1e-9 && w.y > hf.heightAt(9.5, 9) + 0.3);
  assert.notEqual(structures.views.get(bay.id).handles[0].params.arm, 0);
});
```

Append to `tests/effects.test.mjs`:
```js
test('welding throws a few short-lived sparks and no smoke', () => {
  const fx = new Effects(new THREE.Scene(), { particles: 400, flashLights: 0 });
  fx.weld(0, 0.4, 0);
  assert.ok(fx.glow.n >= 2 && fx.smoke.n === 0);
  fx.update(0.4);
  assert.equal(fx.glow.n, 0, 'gone within a moment');
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/models-catalog.test.mjs tests/views.test.mjs tests/effects.test.mjs`
Expected: FAIL — `repair` is not mapped to a model, `weldPoint` and `weld` do not exist.

- [ ] **Step 3: Implement**

**File: `src/render/models/structures/repair.js`**
```js
// Repair Facility (3x2): an open steel gantry over the repair pad in the middle, a hoist that runs
// along it with a welding head, a glazed control block on the east and a parts store with gas
// bottles on the west. Vehicles drive onto the pad from the entrance south of it (spec §5.3).
import { ModelBuilder, MAT, box, rbox, cyl, sphere } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

export function repairFacility() {
  const b = new ModelBuilder('repairFacility');
  slab(b, 3, 2);
  b.add(MAT.DARK, box(1.0, 0.012, 1.5, { p: [0, 0.056, 0.2], color: 0x2e2d2b }));
  for (let k = 0; k < 6; k++) for (const x of [-0.46, 0.46]) b.add(MAT.PAINT, box(0.06, 0.008, 0.13, { p: [x, 0.066, -0.45 + k * 0.26], color: k % 2 ? 0x1b1a18 : PAL.yellow }));
  for (const side of [-1, 1]) b.add(MAT.HOUSE, box(0.28, 0.008, 0.06, { p: [side * 0.13, 0.066, 0.86], r: [0, side * 0.55, 0] }));
  b.node('padLights', { pivot: [0, 0.075, 0.2], kind: 'scale' });
  for (const z of [-0.5, 0.2, 0.9]) for (const x of [-0.5, 0.5]) b.add(MAT.HOUSE_LIGHT, sphere(0.024, 8, { p: [x, 0, z], glow: 2.5 }), 'padLights');
  for (const x of [-0.56, 0.56]) {
    for (const z of [-0.55, 0.75]) b.add(MAT.METAL, box(0.07, 0.8, 0.07, { p: [x, 0.45, z], color: PAL.yellow }));
    b.add(MAT.METAL, box(0.08, 0.08, 1.42, { p: [x, 0.86, 0.1], color: PAL.yellow }));
  }
  b.add(MAT.METAL, box(1.2, 0.06, 0.08, { p: [0, 0.86, -0.55], color: PAL.steelDark }));
  b.node('arm', { pivot: [0, 0.86, 0.1], axis: 'z', kind: 'trans' });
  b.add(MAT.METAL, box(1.18, 0.07, 0.16, { color: PAL.steelDark }), 'arm');
  b.add(MAT.METAL, cyl(0.008, 0.008, 0.36, 4, { p: [0, -0.21, 0], color: PAL.gunmetal }), 'arm');
  b.add(MAT.PAINT, box(0.12, 0.1, 0.12, { p: [0, -0.43, 0], color: PAL.steel }), 'arm');
  b.add(MAT.LIGHT, sphere(0.025, 8, { p: [0, -0.49, 0], color: PAL.blueGlow, glow: 3 }), 'arm');
  b.add(MAT.PAINT, rbox(0.62, 0.5, 1.5, 0.04, { p: [1.08, 0.3, -0.1], color: PAL.steel }));
  b.add(MAT.GLASS, box(0.63, 0.08, 1.2, { p: [1.08, 0.43, -0.1], color: PAL.glass }));
  b.add(MAT.HOUSE, box(0.64, 0.05, 1.52, { p: [1.08, 0.56, -0.1] }));
  b.add(MAT.METAL, cyl(0.02, 0.02, 0.4, 6, { p: [1.25, 0.75, -0.6], color: PAL.gunmetal }));
  b.add(MAT.PAINT, box(0.6, 0.36, 0.9, { p: [-1.08, 0.23, -0.45], color: PAL.steelDark }));
  b.add(MAT.HOUSE, box(0.61, 0.05, 0.91, { p: [-1.08, 0.38, -0.45] }));
  for (const [x, z] of [[-1.25, 0.35], [-1.08, 0.55], [-0.91, 0.35]]) b.add(MAT.PAINT, cyl(0.07, 0.07, 0.42, 12, { p: [x, 0.26, z], color: PAL.rocketRed }));
  beacon(b, 1.3, 0.62, 0.55);
  return b.build({ radius: 1.6 });
}
```

Modify `src/render/models/index.js`:
- add the import `import { repairFacility } from './structures/repair.js';` after the heavy-factory import;
- in `BUILDERS` replace `lightFactory, heavyFactory,` with `lightFactory, heavyFactory, repairFacility,`;
- in `STRUCTURE_MODEL` replace `barracks: 'barracks', wor: 'wor', lightFactory: 'lightFactory', heavyFactory: 'heavyFactory',` with `barracks: 'barracks', wor: 'wor', lightFactory: 'lightFactory', heavyFactory: 'heavyFactory', repair: 'repairFacility',`.

Modify `src/render/views/structure-views.js`:
- header comment: replace `factory doors, flags, cranes, turret heads).` with `factory doors, flags, cranes, turret heads, the repair hoist).`
- after the `const RISE_MS = …` line add:
```js
const armOffset = (now) => Math.sin(now * 0.0015) * 0.3;   // the repair hoist runs up and down the gantry
```
- in `pose`, replace `p.padLights = s.dockedBy ? 1 + 0.25 * Math.sin(now * 0.012) : 1;` with:
```js
    p.padLights = s.dockedBy || s.occupant ? 1 + 0.25 * Math.sin(now * 0.012) : 1;
    p.arm = s.bay?.state === 'repairing' && !s.bay.stalled ? armOffset(now) : 0;
```
- add the method (after `pose`):
```js
  /** Where the welding head is over an occupied repair pad, in world units; null when nothing is being repaired. */
  weldPoint(id, now) {
    const v = this.views.get(id), s = v?.last;
    if (s?.bay?.state !== 'repairing' || s.bay.stalled) return null;
    return { x: v.cx, y: v.y + 0.37, z: v.cz + 0.1 + armOffset(now) };
  }
```

Modify `src/render/views/unit-views.js`:
- after the `const MAX_TILT = …` line add `const PAD_LIFT = 0.066;   // vehicles in a repair bay stand on the pad plate`
- in `pose` replace `poseMatrix(h.matrix, fx, this.hf.heightAt(fx, fz) + 0.004, fz, heading, n);` with `poseMatrix(h.matrix, fx, this.hf.heightAt(fx, fz) + 0.004 + (u.inside ? PAD_LIFT : 0), fz, heading, n);`

Modify `src/render/effects.js` — after `dust(…) { … }` add:
```js
  weld(x, y, z) {
    for (let k = 0; k < 3; k++) this.glow.emit({ x, y, z, vx: rnd(-1.2, 1.2), vy: rnd(0.2, 1.4), vz: rnd(-1.2, 1.2), life: rnd(0.12, 0.28), size: [0.05, 0.02], color: [5, 6, 8], alpha: [1, 0], gravity: 7 });
  }
```

Modify `src/game/game-view.js`:
- after `this.dustClock = 0;` add `this.weldClock = 0;`
- in `ambient`, after the line `for (const id of this.trackFrom.keys()) if (!w.units.has(id)) this.trackFrom.delete(id);` add:
```js
    this.weldClock += dt;
    if (this.weldClock >= 0.12) {   // welding sparks over occupied repair pads the player can see
      this.weldClock = 0;
      for (const s of w.structures.values()) {
        if (!s.bay || !nearCamera(s.x + s.w / 2, s.y + s.h / 2, this.rig.target.x, this.rig.target.z, this.rig.distance) || !this.seen(s.x + s.w / 2, s.y + s.h / 2)) continue;
        const p = this.structureViews.weldPoint(s.id, performance.now());
        if (p) this.effects.weld(p.x, p.y, p.z);
      }
    }
```

Modify `src/scenes/structures.js`:
- header comment: replace `every plan-1b structure` with `every structure built so far`;
- in `LAYOUT` replace `['outpost', 14, 1],` with `['outpost', 14, 1], ['repair', 17, 1],`;
- replace `const map = new GameMap(19, 9);` with `const map = new GameMap(21, 9);`
- replace `rig.lookAt(params.num('x', 9.5), params.num('z', 5), true);` with `rig.lookAt(params.num('x', 10.5), params.num('z', 5), true);`
- in `frame`, inside the handle loop, append `h.params.arm = Math.sin(now * 0.0015) * 0.3;` to the parameter assignments.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/models-catalog.test.mjs tests/views.test.mjs tests/effects.test.mjs`
Expected: PASS.

Run: `npm test && npm run smoke`
Expected: all pass; `screenshots/structures-atreides.png` shows the Repair Facility beside the Outpost (gantry, pad, hoist, control block, gas bottles).

- [ ] **Step 5: Commit**

```bash
git add src/render/models/structures/repair.js src/render/models/index.js src/render/views/structure-views.js src/render/views/unit-views.js src/render/effects.js src/game/game-view.js src/scenes/structures.js tests/models-catalog.test.mjs tests/views.test.mjs tests/effects.test.mjs
git commit -m "feat(render): Repair Facility model, vehicles on the pad, welding sparks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Repair orders by mouse; bay details in the panel

**Files:**
- Modify: `src/input/controller.js`, `src/ui/cursors.js`, `src/ui/selection-panel.js`, `src/game/game-view.js`
- Test: `tests/controller.test.mjs` (append), `tests/selection-panel.test.mjs` (append)

**Interfaces:**
- Consumes: Task 4 (`needsRepair`, `repairAt`, `u.inside`, `s.bay`, `s.occupant`).
- Produces:
  - Controller: a click on an own Repair Facility with damaged vehicles selected sends them in (Classic: left click; Modern: right click). The cursor shows `enter`. Vehicles in a bay cannot be picked.
  - `Controller.structureOrder(s, units) → boolean` also covers the refinery return, now in both schemes.
  - Cursors `enter` and `capture`.
  - Panel: `Repair bay free` / `Repairing <unit> N %` / `Bay paused: no credits`; order texts `Going for repairs` and `Moving in to capture`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/controller.test.mjs`:
```js
test('damaged vehicles clicked onto an own repair facility drive in; healthy ones just select it', () => {
  const { world, tank, c, issued, cursors } = setup();
  const bay = world.spawnStructure('repair', 'atreides', 2, 12);
  c.selection.set([tank.id]);
  c.onMove(px(3), px(12));
  c.frame();
  assert.equal(cursors.at(-1), 'select', 'nothing to repair');
  c.onClick(px(3), px(12), 0, NONE, false);
  assert.equal(c.selection.structureId, bay.id);
  tank.hp = 50;
  c.selection.set([tank.id]);
  c.frame();
  assert.equal(cursors.at(-1), 'enter');
  c.onClick(px(3), px(12), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'repairAt', ids: [tank.id], structureId: bay.id });
});

test('modern: right click on an own repair facility sends damaged vehicles in; a vehicle in the bay cannot be clicked', () => {
  const { world, tank, tank2, c, issued } = setup('modern');
  const bay = world.spawnStructure('repair', 'atreides', 2, 12);
  tank.hp = 50;
  c.selection.set([tank.id]);
  c.onClick(px(3), px(12), 2, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'repairAt', ids: [tank.id], structureId: bay.id });
  tank2.inside = bay.id;
  c.onClick(px(7), px(5), 0, NONE, false);
  assert.ok(!c.selection.has(tank2.id));
});
```

Append to `tests/selection-panel.test.mjs`:
```js
import { runUntil } from './helpers.mjs';

test('a repair facility tells which vehicle it is fixing and how far along it is', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 1000;
  h.startBuffer = 5000;
  world.spawnStructure('windtrap', 'atreides', 1, 1);
  const bay = world.spawnStructure('repair', 'atreides', 8, 8);
  const sel = new Selection();
  sel.setStructure(bay.id);
  assert.ok(selectionPanelModel(world, sel, 'atreides').details.includes('Repair bay free'));
  const t = world.spawnUnit('combatTank', 'atreides', 9, 12);
  t.hp = 100;
  world.issue('atreides', { type: 'repairAt', ids: [t.id], structureId: bay.id });
  world.step();
  const unitSel = new Selection();
  unitSel.set([t.id]);
  assert.ok(selectionPanelModel(world, unitSel, 'atreides').details.includes('Going for repairs'));
  assert.ok(runUntil(world, () => bay.bay?.state === 'repairing', 20) > 0);
  assert.ok(selectionPanelModel(world, sel, 'atreides').details.some((d) => /^Repairing Combat Tank \d+ %$/.test(d)));
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/controller.test.mjs tests/selection-panel.test.mjs`
Expected: FAIL — clicks on the facility only select it, no `enter` cursor, and no bay details.

- [ ] **Step 3: Implement**

Modify `src/input/controller.js`:
- add the import `import { needsRepair } from '../sim/repair-bay.js';`
- in `candidates` replace `if (!this.canSee(u)) continue;` with `if (u.inside || !this.canSee(u)) continue;   // vehicles in a repair bay cannot be picked`
- replace `clickStructure` with:
```js
  clickStructure(s, classic, double) {
    const units = this.ownSelected();
    if (classic && units.length) {
      if (this.structureOrder(s, units)) return;
      if (s.house !== this.house) { this.order({ kind: 'structure', structure: s, tx: s.x, ty: s.y }); return; }
    }
    if (double && s.house === this.house && UNIT_FACTORIES.has(s.typeId)) this.issue({ type: 'setPrimary', structureId: s.id });
    this.selection.setStructure(s.id);
  }

  /** What a click on an own building tells the selection: harvesters unload at a refinery, damaged vehicles drive into a repair bay. */
  structureOrder(s, units) {
    if (s.house !== this.house) return false;
    if (s.typeId === 'refinery' && units.every((u) => u.harvest)) { this.issue({ type: 'returnToBase', ids: units.map((u) => u.id) }); return true; }
    const fix = s.typeId === 'repair' ? units.filter(needsRepair) : [];
    if (!fix.length) return false;
    this.issue({ type: 'repairAt', ids: fix.map((u) => u.id), structureId: s.id });
    return true;
  }
```
- in `order`, replace `if (hit.kind === 'structure') return;   // structure clicks are handled by selection (Task 15) and combat (plan 1c)` with:
```js
    if (hit.kind === 'structure') { this.structureOrder(hit.structure, units); return; }   // own buildings: unload, repair
```
- in `cursorFor`, in the `hit.kind === 'structure'` branch, after the refinery line add:
```js
      if (own.length && s?.house === this.house && s.typeId === 'repair' && own.some(needsRepair)) return 'enter';
```

Modify `src/ui/cursors.js` — in `CURSORS`, after `noRepair: …` add:
```js
  enter: svg(`<path d='M16 3l11 9h-4v14H9V12H5z' fill='#7dff7a' stroke='#000' stroke-width='1.2'/><path d='M13 26v-7h6v7' fill='#1d1408'/>`, 16, 16),
  capture: svg(`<path d='M16 3l11 9h-4v14H9V12H5z' fill='#ffd24a' stroke='#000' stroke-width='1.2'/><path d='M12 10v12M12 10h9l-2 3 2 3h-9' fill='#e0412f' stroke='#000' stroke-width='1'/>`, 16, 16),
```

Modify `src/ui/selection-panel.js`:
- replace the `ORDER_TEXT` line with:
```js
const ORDER_TEXT = { idle: 'Idle', move: 'Moving', guard: 'Guarding', stop: 'Idle', repairAt: 'Going for repairs', capture: 'Moving in to capture' };
```
- in `structureModel`, after the refinery line add:
```js
  if (s.typeId === 'repair') {
    const u = world.units.get(s.occupant);
    details.push(!u ? 'Repair bay free' : s.bay?.stalled ? 'Bay paused: no credits' : `Repairing ${u.type.name} ${Math.floor((u.hp / u.maxHp) * 100)} %`);
  }
```

Modify `src/game/game-view.js` — in `frame`, in the `this.selection.prune(…)` call, replace `return !!u && unitVisibleTo(world, this.house, u);` with `return !!u && !u.inside && unitVisibleTo(world, this.house, u);`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/controller.test.mjs tests/selection-panel.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/input/controller.js src/ui/cursors.js src/ui/selection-panel.js src/game/game-view.js tests/controller.test.mjs tests/selection-panel.test.mjs
git commit -m "feat(ui): send vehicles to the Repair Facility by mouse; bay details in the panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The computer repairs its vehicles

**Files:**
- Modify: `src/sim/ai.js`
- Test: `tests/ai.test.mjs` (append)

**Interfaces:**
- Consumes: Task 4 (`needsRepair`, `repairAt`).
- Produces: `BUILD_ORDER` gains a Repair Facility after the second Refinery. The AI sends vehicles to it: idle, guarding or harvesting ones below half health, and any below 30 % (they leave their attack wave). The defence never pulls vehicles out of the bay queue.

- [ ] **Step 1: Write the failing test**

Append to `tests/ai.test.mjs`:
```js
test('the AI builds a repair facility and sends worn vehicles to it', () => {
  const world = flatWorld(48, 40, G.ROCK);
  for (const [t, x, y] of [['constructionYard', 2, 2], ['windtrap', 5, 2], ['windtrap', 8, 2], ['windtrap', 11, 2], ['refinery', 2, 6], ['outpost', 6, 6], ['wor', 9, 6], ['lightFactory', 12, 6], ['heavyFactory', 15, 6], ['silo', 2, 10], ['refinery', 5, 10]]) world.spawnStructure(t, 'harkonnen', x, y);
  const h = world.houses.get('harkonnen');
  h.credits = 5000;
  h.startBuffer = 10000;
  createBrain(world, 'harkonnen', 'normal');
  const bay = () => [...world.structures.values()].find((s) => s.house === 'harkonnen' && s.typeId === 'repair');
  assert.ok(runUntil(world, () => !!bay(), 150) > 0, 'a repair facility went up');
  const tank = world.spawnUnit('combatTank', 'harkonnen', 30, 30);
  tank.hp = 60;
  assert.ok(runUntil(world, () => tank.order.type === 'repairAt' || !!tank.inside, 3) >= 0, 'sent for repairs');
  assert.ok(runUntil(world, () => tank.hp === tank.maxHp, 120) > 0, 'repaired');
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `node --test tests/ai.test.mjs`
Expected: FAIL — `a repair facility went up` (the build order has no Repair Facility).

- [ ] **Step 3: Implement**

Modify `src/sim/ai.js`:
- add the import `import { needsRepair } from './repair-bay.js';`
- in each of the three `BUILD_ORDER` lists replace `'silo', 'refinery', 'windtrap']` with `'silo', 'refinery', 'repair', 'windtrap']`;
- in `think`, replace `  rally(world, house, view);` with:
```js
  rally(world, house, view);
  sendForRepairs(world, house, view);
```
- in `defend`, replace `.filter((u) => isArmed(u.type) && !b.wave.includes(u.id) && u.order.type !== 'attack' && Math.hypot(u.x - intruder.x, u.y - intruder.y) < 24)` with `.filter((u) => isArmed(u.type) && !b.wave.includes(u.id) && u.order.type !== 'attack' && u.order.type !== 'repairAt' && !u.inside && Math.hypot(u.x - intruder.x, u.y - intruder.y) < 24)`
- after `defend` add:
```js
const REPAIR_BELOW = 0.5, RETREAT_BELOW = 0.3;

/** Worn vehicles go to the Repair Facility: resting ones below half health, any below 30 % (they leave their wave). */
function sendForRepairs(world, house, view) {
  const bay = view.mine.find((s) => s.typeId === 'repair');
  if (!bay) return;
  const b = house.brain;
  const ids = [];
  for (const u of view.units) {
    if (!needsRepair(u) || u.order.type === 'repairAt' || u.type.deploysTo) continue;
    const worn = u.hp / u.maxHp;
    const resting = u.order.type === 'idle' || u.order.type === 'guard' || u.order.type === 'harvest';
    if (worn < RETREAT_BELOW || (resting && worn < REPAIR_BELOW)) ids.push(u.id);
  }
  if (!ids.length) return;
  b.wave = b.wave.filter((id) => !ids.includes(id));
  issue(world, house, { type: 'repairAt', ids, structureId: bay.id });
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/ai.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: all pass (the AI-versus-AI soak included: builds, harvests, fights, nobody stuck).

- [ ] **Step 5: Commit**

```bash
git add src/sim/ai.js tests/ai.test.mjs
git commit -m "feat(ai): the computer builds a Repair Facility and sends worn vehicles to it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Infantry capture enemy buildings

**Files:**
- Create: `src/sim/capture.js`
- Modify: `src/data/tuning.js`, `src/sim/house.js`, `src/sim/orders.js`, `src/sim/world.js`, `src/sim/harvest.js`
- Test: `tests/capture.test.mjs` (new)

**Interfaces:**
- Consumes: `orderAttack` / `stopUnit` (orders.js), `onTheMove` (combat.js), `loseStorageShare` / `revokeStartBuffer` (economy.js), `announce`, Task 4 (`s.occupant`).
- Produces:
  - Command `{ type: 'capture', ids, structureId }`; `CAPTURE_BELOW = 0.25`.
  - Predicates `canCapture(u)` and `capturable(s, houseId)`.
  - Order functions `orderCapture(world, houseId, units, structureId)`, `updateCapture(world, u)`, `captureStructure(world, s, u)`.
  - Transfers `transferStructure(world, s, toHouse)` and `transferUnit(world, u, toHouse)`.
  - Events `captureOrdered`, `structureCaptured { id, typeId, from, to, x, y, w, h }`, `unitCaptured { id, from, to }`; eva keys `captured` (captor), `lostToCapture` (old owner); `stats.structuresCaptured`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/capture.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { captureStructure } from '../src/sim/capture.js';
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
  Object.assign(hv.harvest, { state: 'unloading', refinery: ref.id, load: 700 });
  ref.dockedBy = hv.id;
  hk.credits = 2010;
  at.credits = 0;
  at.startBuffer = 5000;
  ref.hp = 50;
  captureStructure(world, ref, world.spawnUnit('soldier', 'atreides', 12, 5));
  assert.deepEqual([ref.house, hv.house], ['atreides', 'atreides']);
  assert.ok(Math.abs(hk.credits - 1005) < 1e-6, `Harkonnen kept ${hk.credits}`);
  run(world, 1);
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
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/capture.test.mjs`
Expected: FAIL — `src/sim/capture.js` does not exist.

- [ ] **Step 3: Implement**

Append to `src/data/tuning.js`:
```js
export const CAPTURE_BELOW = 0.25;              // infantry take a conquerable building below a quarter of its hit points (spec §4.6)
```

Modify `src/sim/house.js` — in `stats` replace `structuresLost: 0 };` with `structuresLost: 0, structuresCaptured: 0 };`.

**File: `src/sim/capture.js`**
```js
// Capturing (spec §4.6; research: structures.md "Capture"): infantry ordered into an enemy building walk
// up to it; if it is conquerable and below a quarter of its hit points it changes hands and the soldiers
// stay inside (they are used up). A building that is still too strong is attacked instead. Barracks,
// WOR, Outposts, the House of IX, Palaces and walls cannot be taken. What the building holds changes hands
// with it: a harvester unloading on a refinery pad, a vehicle in a repair bay. The old owner loses the
// share of credits a captured store held, as when one is destroyed.
import { CAPTURE_BELOW } from '../data/tuning.js';
import { loseStorageShare, revokeStartBuffer } from './economy.js';
import { onTheMove } from './combat.js';
import { orderAttack, stopUnit } from './orders.js';
import { announce } from './announce.js';

const GIVE_UP_TRIES = 8;
const INFANTRY = new Set(['soldier', 'infantry', 'trooper', 'troopers']);   // the Saboteur has its own mission (plan 2c)

export const canCapture = (u) => INFANTRY.has(u.typeId);
export const capturable = (s, houseId) => !!s && s.house !== houseId && !!s.type.conquerable && s.hp < s.maxHp * CAPTURE_BELOW;

export function orderCapture(world, houseId, units, structureId) {
  const s = world.structures.get(structureId);
  if (!s || s.house === houseId || !s.type.conquerable) return;
  const ids = [];
  for (const u of units) {
    if (!canCapture(u)) continue;
    stopUnit(u);
    u.order = { type: 'capture', structureId: s.id, tries: 0 };
    u.target = null;
    u.aiming = false;
    ids.push(u.id);
  }
  if (ids.length) world.events.push('captureOrdered', { ids, structureId: s.id, house: houseId });
}

const beside = (u, s) => u.tx >= s.x - 1 && u.tx <= s.x + s.w && u.ty >= s.y - 1 && u.ty <= s.y + s.h;

/** The free tile next to the building nearest to the unit, or -1. */
function besideTile(world, u, s) {
  const map = world.map;
  let best = -1, bestD = Infinity;
  for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) {
    if (!map.inBounds(x, y) || (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)) continue;
    const i = map.idx(x, y);
    if (map.structure[i] || map.moveFactor(i, u.move) <= 0 || (map.unit[i] && map.unit[i] !== u.id)) continue;
    const d = Math.hypot(x - u.tx, y - u.ty);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** Infantry on a capture order (runs before movement). */
export function updateCapture(world, u) {
  const o = u.order, s = world.structures.get(o.structureId);
  if (!s || s.house === u.house) { stopUnit(u); return; }   // gone, or taken by a comrade
  if (onTheMove(u)) return;
  if (beside(u, s)) {
    if (capturable(s, u.house)) captureStructure(world, s, u);
    else orderAttack(world, [u], { targetKind: 'structure', targetId: s.id });   // still too strong: shoot at it
    return;
  }
  const goal = ++o.tries > GIVE_UP_TRIES ? -1 : besideTile(world, u, s);
  if (goal < 0) { stopUnit(u); world.events.push('moveFailed', { id: u.id }); return; }
  world.requestPath(u, goal);
}

/** The squad walks in: the building and what it holds change hands. */
export function captureStructure(world, s, u) {
  const from = s.house, to = u.house;
  world.removeUnit(u, 'entered');
  transferStructure(world, s, to);
  const loser = world.houses.get(from), captor = world.houses.get(to);
  if (loser) loser.stats.structuresLost++;
  if (captor) captor.stats.structuresCaptured++;
  world.events.push('structureCaptured', { id: s.id, typeId: s.typeId, from, to, x: s.x, y: s.y, w: s.w, h: s.h });
  announce(world, to, 'captured', 'Structure captured.');
  announce(world, from, 'lostToCapture', 'Structure lost to the enemy.');
}

export function transferStructure(world, s, to) {
  const from = world.houses.get(s.house), next = world.houses.get(to);
  s.house = to;
  s.repairing = false;
  s.repairStalled = false;
  s.primary = false;
  s.rally = null;
  s.target = null;
  for (const id of [s.dockedBy, s.occupant]) if (id && world.units.has(id)) transferUnit(world, world.units.get(id), to);
  if (s.type.storage) {
    if (from) loseStorageShare(world, from, s.type.storage);
    if (next) revokeStartBuffer(world, next);
  }
}

/** A unit changes sides and carries on with what it was doing (unloading, being repaired). */
export function transferUnit(world, u, to) {
  const from = u.house;
  u.house = to;
  u.target = null;
  u.abandoned = null;
  world.events.push('unitCaptured', { id: u.id, from, to });
}
```

Modify `src/sim/orders.js`:
- add the import `import { orderCapture } from './capture.js';`
- add the case (after `case 'repairAt': …`):
```js
    case 'capture': orderCapture(world, houseId, units, cmd.structureId); return;
```

Modify `src/sim/world.js`:
- add the import `import { updateCapture } from './capture.js';`
- in the per-unit loop, after the `repairAt` line add:
```js
      if (u.order.type === 'capture') { updateCapture(this, u); if (!this.units.has(u.id)) continue; }   // a squad that walked in is gone
```

Modify `src/sim/harvest.js` — in the `queued` case replace `if (!ref) { h.state = 'toRefinery'; h.target = -1; return; }` with `if (!ref || ref.house !== u.house) { h.state = 'toRefinery'; h.target = -1; return; }   // gone or captured`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/capture.test.mjs`
Expected: PASS, 6/6.

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/data/tuning.js src/sim/house.js src/sim/capture.js src/sim/orders.js src/sim/world.js src/sim/harvest.js tests/capture.test.mjs
git commit -m "feat(sim): infantry capture badly damaged enemy buildings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Capture by mouse; bay and capture sounds

**Files:**
- Modify: `src/input/controller.js`, `src/audio/cues.js`
- Test: `tests/controller.test.mjs` (append), `tests/cues.test.mjs` (append)

**Interfaces:**
- Consumes: Task 8 (`canCapture`, `capturable`, `capture`), Task 6 (`capture` cursor), Task 4 events.
- Produces:
  - A click on a capturable enemy building (red, conquerable) with infantry selected orders the infantry to capture it and the other armed units to attack it. Ctrl + click still forces fire. The cursor shows `capture`.
  - Cues: `bayEntered` → ratchet, `unitRepaired` → clunk, and `structureCaptured` → clunk for the captor.

- [ ] **Step 1: Write the failing tests**

Append to `tests/controller.test.mjs`:
```js
test('infantry clicked onto a badly damaged enemy building capture it while the rest attack', () => {
  const { world, tank, c, issued, cursors } = setup();
  const squad = world.spawnUnit('infantry', 'atreides', 3, 3);
  const silo = world.spawnStructure('silo', 'harkonnen', 12, 12);
  const outpost = world.spawnStructure('outpost', 'harkonnen', 8, 14);
  outpost.hp = 10;
  c.selection.set([squad.id, tank.id]);
  c.onMove(px(12), px(12));
  c.frame();
  assert.equal(cursors.at(-1), 'attack', 'not weak enough yet');
  silo.hp = 20;
  c.frame();
  assert.equal(cursors.at(-1), 'capture');
  c.onClick(px(12), px(12), 0, NONE, false);
  assert.deepEqual(issued.slice(-2), [
    { type: 'capture', ids: [squad.id], structureId: silo.id },
    { type: 'attack', ids: [tank.id], targetKind: 'structure', targetId: silo.id, force: false },
  ]);
  c.onMove(px(8), px(14));
  c.frame();
  assert.equal(cursors.at(-1), 'attack', 'Outposts cannot be captured');
});
```

Append to `tests/cues.test.mjs`:
```js
test('the repair bay clanks as vehicles roll in and out; a capture thuds for the captor', () => {
  assert.equal(cueFor({ type: 'bayEntered', house: 'atreides', x: 5, y: 5 }, 'atreides', all).id, 'ratchet');
  assert.equal(cueFor({ type: 'unitRepaired', house: 'atreides', x: 5, y: 5 }, 'atreides', all).id, 'clunk');
  assert.equal(cueFor({ type: 'bayEntered', house: 'harkonnen', x: 5, y: 5 }, 'atreides', all), null);
  assert.equal(cueFor({ type: 'structureCaptured', from: 'harkonnen', to: 'atreides', x: 4, y: 4, w: 2, h: 2 }, 'atreides', all).id, 'clunk');
  assert.equal(cueFor({ type: 'structureCaptured', from: 'atreides', to: 'harkonnen', x: 4, y: 4, w: 2, h: 2 }, 'atreides', all), null);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/controller.test.mjs tests/cues.test.mjs`
Expected: FAIL — the cursor stays `attack` and the click issues one attack; the cues are null.

- [ ] **Step 3: Implement**

Modify `src/input/controller.js`:
- add the import `import { canCapture, capturable } from '../sim/capture.js';`
- in `order`, directly before `if (armed.length && (enemy || mods.ctrl)) {` add:
```js
    if (hit.kind === 'structure' && !mods.ctrl && capturable(entity, this.house)) {   // infantry walk in, the rest open fire
      const takers = units.filter(canCapture);
      if (takers.length) {
        this.issue({ type: 'capture', ids: takers.map((u) => u.id), structureId: entity.id });
        const rest = armed.filter((u) => !canCapture(u));
        if (rest.length) this.issue({ type: 'attack', ids: rest.map((u) => u.id), targetKind: 'structure', targetId: entity.id, force: false });
        return;
      }
    }
```
- in `cursorFor`, replace `if (own.length && s?.house !== this.house) return own.some((u) => isArmed(u.type)) ? 'attack' : 'noMove';` with:
```js
      if (own.length && s?.house !== this.house) return capturable(s, this.house) && own.some(canCapture) ? 'capture' : own.some((u) => isArmed(u.type)) ? 'attack' : 'noMove';
```

Modify `src/audio/cues.js` — in `cueFor`, before `default: return null;` add:
```js
    case 'bayEntered': return mine ? at('ratchet', e.x, e.y) : null;
    case 'unitRepaired': return mine ? at('clunk', e.x, e.y) : null;
    case 'structureCaptured': return e.to === me ? at('clunk', e.x + e.w / 2, e.y + e.h / 2) : null;
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/controller.test.mjs tests/cues.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/input/controller.js src/audio/cues.js tests/controller.test.mjs tests/cues.test.mjs
git commit -m "feat(ui): capture by mouse; bay and capture sounds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Showcase scenes, smoke shot, end-to-end checks, README

**Files:**
- Modify: `src/scenes/base.js`, `src/game/debug.js`, `scripts/scenarios.mjs`, `scripts/e2e.mjs`, `README.md`
- Test: `npm run smoke`, `npm run e2e`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - Base scene: the Repair Facility in the layout, plus three flags:
    - `damaged=1` — a worn tank beside the facility;
    - `repair=1` — the worn tank is also sent in;
    - `capture=1` — a ruined enemy silo away from the army, with an infantry squad next to it.
  - Debug hooks: `arrowRect(strip, dir)`, `upgradeLevel(type)`, `unit(id).inside`, and a `buttonRect` that is visible only inside its strip.
  - Smoke scene `base-repair`; three e2e checks (upgrade, repair, capture) plus a console check for the new page.

- [ ] **Step 1: Scenes and hooks**

Modify `src/scenes/base.js`:
- replace the imports block's `import { findPlacement, placeStructure } from '../sim/placement.js';` with:
```js
import { findPlacement, placeStructure } from '../sim/placement.js';
import { findFreeTile } from '../sim/spawn.js';
import { G } from '../data/terrain.js';
import { INFANTRY } from '../data/houses.js';
```
- in `LAYOUT` replace `'heavyFactory', 'windtrap',` with `'heavyFactory', 'repair', 'windtrap',`;
- replace `const { world, starts } = setupSkirmish(` with `const { world, starts, rival } = setupSkirmish(`;
- replace `const focus = yard ? …;` with `let focus = yard ? { x: yard.x + 1, z: yard.y + 3 } : { x: starts[0].x + 0.5, z: starts[0].y + 2.5 };`;
- after the line `for (const s of world.structures.values()) if (s.house === house) s.hp = s.maxHp;   // …` add:
```js
  const bay = [...world.structures.values()].find((s) => s.house === house && s.typeId === 'repair');
  if (bay && (params.bool('damaged') || params.bool('repair'))) {   // a worn tank beside the Repair Facility, sent in with repair=1
    const spot = findFreeTile(world, bay.x + 1, bay.y + bay.h + 3, 'tracked', 6);
    if (spot) {
      const tank = world.spawnUnit('combatTank', house, spot.x, spot.y, { heading: -Math.PI / 2 });
      tank.hp = 40;
      if (params.bool('repair')) world.issue(house, { type: 'repairAt', ids: [tank.id], structureId: bay.id });
    }
    focus = { x: bay.x + 1.5, z: bay.y + 2.5 };
  }
  if (yard && params.bool('capture')) {   // a ruined enemy silo out of the army's reach and a squad to take it
    const spot = quietSpot(world, house, yard.x, yard.y);
    if (spot) {
      world.spawnStructure('silo', rival, spot.x, spot.y).hp = 25;
      const tile = findFreeTile(world, spot.x, spot.y + 5, 'foot', 4);
      if (tile) world.spawnUnit(INFANTRY[house], house, tile.x, tile.y);
      focus = { x: spot.x + 1, z: spot.y + 3 };
    }
  }
```
- after `start` add:
```js
/** Free rock for a 2x2 building at least seven tiles from every unit of the house. */
function quietSpot(world, house, x0, y0) {
  const map = world.map;
  const units = [...world.units.values()].filter((u) => u.house === house);
  for (let r = 6; r < 24; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = x0 + dx, y = y0 + dy;
      if (!map.inBounds(x, y) || !map.inBounds(x + 1, y + 1)) continue;
      const tiles = [map.idx(x, y), map.idx(x + 1, y), map.idx(x, y + 1), map.idx(x + 1, y + 1)];
      if (tiles.some((i) => map.ground[i] !== G.ROCK || map.structure[i] || map.unit[i])) continue;
      if (units.some((u) => Math.hypot(u.x - x - 1, u.y - y - 1) < 7)) continue;
      return { x, y };
    }
  }
  return null;
}
```
- header comment: replace `every plan-1b structure placed` with `every structure built so far placed` and append a sentence: `Flags: damaged=1 adds a worn tank by the Repair Facility (repair=1 also sends it in), capture=1 a ruined enemy silo with a squad to take it.`

Modify `src/game/debug.js`:
- in `brief`, replace `order: u.order.type, hp: u.hp };` with `order: u.order.type, hp: u.hp, inside: u.inside ?? 0 };`
- replace the `buttonRect:` line with:
```js
    buttonRect: (typeId) => {   // visible only when not scrolled out of its strip
      const b = document.querySelector(`.sidebar .sb-item[data-type="${typeId}"]`);
      const r = rect(b);
      const box = b?.closest('.sb-slots')?.getBoundingClientRect(), br = b?.getBoundingClientRect();
      if (r && box) r.visible = r.visible && br.top >= box.top - 1 && br.bottom <= box.bottom + 1;
      return r;
    },
    arrowRect: (strip, dir) => rect(document.querySelector(`.sidebar .sb-strip[data-strip="${strip}"] .sb-arrow[data-dir="${dir}"]`)),
    upgradeLevel: (type) => world.houses.get(house).upgrades?.[type] ?? 0,
```

Modify `scripts/scenarios.mjs` — after the `'base-ordos-fog'` entry add:
```js
  'base-repair': { query: 'scene=base&house=atreides&fog=0&repair=1&dist=9&ticks=300', settleMs: 1500 },
```

- [ ] **Step 2: End-to-end checks**

Modify `scripts/e2e.mjs` — directly before the line `await sleep(1500);` that precedes `await mkdir(path.join(root, 'screenshots')…`, insert:
```js
  const base = await openPage(chrome, `http://localhost:${PORT}/?scene=base&house=atreides&fog=0&damaged=1&capture=1&quality=low&gameSpeed=fastest`);
  await base.waitFor('window.__dune && window.__dune.ready === true', 120000);
  await sleep(600);
  const bv = (expr) => base.eval(expr);
  let up = await bv(`__dune.buttonRect('upgrade:heavyFactory')`);
  for (let i = 0; i < 24 && up && !up.visible; i++) {   // scroll the structure strip down to the upgrades
    const down = await bv(`__dune.arrowRect('structures', 1)`);
    await base.click(down.x, down.y);
    await sleep(150);
    up = await bv(`__dune.buttonRect('upgrade:heavyFactory')`);
  }
  if (up?.visible) await base.click(up.x, up.y);
  let level = 0;
  for (let i = 0; i < 300 && level < 1; i++) { await sleep(200); level = await bv(`__dune.upgradeLevel('heavyFactory')`); }
  check('clicking the Heavy Factory upgrade icon upgrades it', level === 1, `level ${level}`);

  const [bayS] = (await bv(`__dune.structures('repair')`)).filter((s) => s.house === 'atreides');
  const worn = (await bv(`__dune.units('combatTank')`)).find((u) => u.hp < 200);
  await bv(`__dune.lookAt(${bayS.x + 1.5}, ${bayS.y + 2.5})`);
  await sleep(500);
  const ws = await bv(`__dune.screenOfUnit(${worn.id})`);
  await base.click(ws.x, ws.y);
  await sleep(300);
  const bs = await bv(`__dune.screenOfFootprint('repair', ${bayS.x}, ${bayS.y})`);
  await base.click(bs.x, bs.y);
  let wentIn = false, fixed = false;
  for (let i = 0; i < 600 && !fixed; i++) {
    await sleep(200);
    const u = await bv(`__dune.unit(${worn.id})`);
    wentIn ||= !!u?.inside;
    fixed = !!u && u.hp === 200 && !u.inside;
  }
  check('a damaged tank clicked onto the Repair Facility goes in and comes out repaired', wentIn && fixed);

  const silo = (await bv(`__dune.structures('silo')`)).find((s) => s.house !== 'atreides');
  const squad = (await bv(`__dune.units('infantry')`)).sort((a, b) => b.id - a.id)[0];
  await bv(`__dune.lookAt(${silo.x + 1}, ${silo.y + 3})`);
  await sleep(500);
  const qs = await bv(`__dune.screenOfUnit(${squad.id})`);
  await base.click(qs.x, qs.y);
  await sleep(300);
  const ss = await bv(`__dune.screenOfFootprint('silo', ${silo.x}, ${silo.y})`);
  await base.click(ss.x, ss.y);
  let taken = false;
  for (let i = 0; i < 600 && !taken; i++) { await sleep(200); taken = (await bv(`__dune.structures('silo')`)).some((s) => s.id === silo.id && s.house === 'atreides'); }
  check('infantry clicked onto a ruined enemy silo capture it', taken);
  const baseErrors = base.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[exception]'));
  check('no console errors in the base', baseErrors.length === 0, baseErrors.join(' | '));
  base.close();
```

- [ ] **Step 3: README**

Modify `README.md`:
- in `## Status`, replace the sentence `Phase 2 adds the House of IX` … `music and announcer voices;` with:
```
Phase 2 is under way: factory upgrades, the Repair Facility and infantry capture are in; the House
of IX specials, aircraft, sandworms, the Starport and Palace, music and announcer voices follow;
```
- in the Controls table, after the row `| Left click an enemy (with units selected) | Attack it (Modern: right click) |` add:
```
| Left click an own Repair Facility (damaged vehicles selected) | Drive in for repairs, one at a time (Modern: right click) |
| Left click a badly damaged enemy building (infantry selected) | Capture it — the cursor shows a flag; other units attack |
```
- at the end of `## Base building` add the paragraph:
```

Factory upgrades show up at the end of the structure strip with a gold arrow and the level they reach:
they are paid and timed like a build on the factory's own line and open better units (Quad, squads,
MCV, Missile and Siege Tanks) and the Large Concrete Slab and Rocket Turret. A Repair Facility fixes one
vehicle at a time for a quarter of its price by the damage; badly damaged enemy buildings (red health)
can be captured by walking infantry in — except Barracks, WOR, Outposts, the House of IX and Palaces.
```

- [ ] **Step 4: Run everything**

Run: `npm test`
Expected: all pass.

Run: `npm run smoke`
Expected: 32 scenes captured.
- `base-repair.png` shows the worn tank on the repair pad under the gantry.
- `icons-atreides.png` shows the three upgrade icons with their gold arrows and levels.
- The base shots show the Repair Facility.

Run: `npm run e2e`
Expected: 23/23 checks pass.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/base.js src/game/debug.js scripts/scenarios.mjs scripts/e2e.mjs README.md
git commit -m "test: showcase, smoke and end-to-end checks for upgrades, repair and capture; README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
