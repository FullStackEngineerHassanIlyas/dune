# Plan 2d — House Specials and Palace Weapons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The three House of IX specials (Sonic Tank wave, Deviator gas, Devastator destruct) and the Palace with its three house weapons (Death Hand, Fremen, Saboteur), with their models, effects, sounds, sidebar button and AI use.

**Architecture:** Two new simulation modules: `src/sim/specials.js` (gas conversion and revert, Destruct, Saboteur missions) and `src/sim/palace.js` (weapon charge, Death Hand, Fremen call, Saboteur call, Fremen hunting). The sonic wave is a projectile kind swept in `combat.js`; gas and Death Hand impacts reach their modules through world hooks (`onGas`, `onDeathHand`) like the existing `onCrush`. Walls get their own surface so the Saboteur's new move class can cross them. The view side adds four models, a missile view, new particle recipes, three synth recipes, a sidebar weapon button with a targeting mode, and panel/cursor support.

**Tech Stack:** Plain ES modules, Three.js 0.186.1 (vendored), `node --test`, headless Chrome for smoke and e2e.

**Spec:** `docs/superpowers/specs/2026-09-28-dune2-3d-design.md` (§4.6 special behaviour, §4.7 Palace weapons, §4.10 AI Palace, §5.3 models, §5.4 effects, §5.6 sidebar, §6 audio). Research: `docs/research/raw/units.md` (Saboteur, Deviator, Devastator), `docs/research/raw/structures.md` "Superweapons", `docs/research/raw/mechanics-campaign.md` §5.2 blast table.

## Global Constraints

- The simulation stays deterministic: every random choice in `src/sim` goes through `world.rng`; no `Math.random` there.
- Player and AI act only through `world.issue(house, command)` → `applyCommand`; every command field is validated.
- Numbers from the original tables are converted in `src/data/tuning.js` only.
- No original Dune II assets: models are procedural, sounds synthesized; `docs/research/refs` stays private.
- ES modules, no build step; code reads like its neighbours (comment density, naming, one-line doc comments).
- `npm test` (includes the 15-minute AI-vs-AI soak) stays green after every task; `npm run smoke` and `npm run e2e` at the end.
- Friendly fire is real for the sonic wave, the Death Hand, Destruct and the Saboteur's blast (spec §4.6, §4.7).

## Rulings made while planning

- Saboteur over walls (spec §4.6, research: OpenDUNE gives it speed 255 on wall tiles): walls get `SURFACE.WALL` and the Saboteur its own move class `saboteur`; `onFoot(move)` replaces every `=== 'foot'` check so it still counts as infantry (crushable, no vehicle smoke).
- Fremen (spec §4.7, §4.6 "Trooper-class infantry of their own sub-house"): a `fremen` unit type (Trooper Squad stats) owned by the caller, sand-brown tint, `autonomous` (no orders) and `hunts` (nearest enemy anywhere). No alliance system is added.
- Sonic wave: travels exactly the weapon's range (8 tiles) from the tank, hits each unit or building on the tiles it crosses once, from 60 at the muzzle falling linearly to 30 at the end; Sonic Tanks and walls are spared, own units are not; aircraft and units held inside are never hit.
- Deviator gas: radius 1.5 tiles round the burst, 40 s; immune: aircraft, Harvesters, MCVs, Deviators, sandworms (spec plus OpenDUNE); gas never targets buildings; a unit already taken keeps its first owner on record; gas from that first owner brings it home at once; a unit held in a bay or a Carryall is not gassed and goes home only once out.
- Destruct: the unit keeps its tile, stops, holds fire, ignores orders and does not retaliate for 3 s; then a centre blast of 25–50 and seven blasts of 75–150 within 1.5 tiles (OpenDUNE), each with a 1.5-tile falloff.
- Palace: `unique`; the charge starts when the Palace is placed (a rebuilt Palace starts from empty — the original's instant-ready exploit is not copied); recharge Death Hand 7 min, Fremen and Saboteur 4 min (spec); low power does not slow it (research). A refused launch keeps the charge.
- Death Hand: 6 tiles/s, lands up to 2 tiles from the aim, 17 blasts in the OpenDUNE diamond, 150 each with a 1-tile falloff.
- Saboteur: 500 into the building it reaches plus a 300 blast (1.5 tiles) round it; killed on the way: the same 300 blast. A detonation is not counted as a unit lost. Walls and own buildings are not sabotage targets.
- AI: fires a charged Palace at the richest enemy spot (cost of enemy buildings and ground units within 2.5 tiles), asks at most every 10 s; Saboteurs go for the most expensive enemy building; Fremen and Saboteurs are never drafted into waves or counted against the army cap. The AI does not use Destruct (the spec does not ask for it).

## Review Focus

1. A unit deviated while its old owner's plans still point at it (a Carryall job, a repair order, an AI wave list) must end up controlled by exactly one house and never stuck; a unit held in a bay or claws is not gassed (Task 3 tests "held units" and the `deviatable` stub).
2. Blasts that kill things that explode in turn (MCVs, Trikes, Saboteurs) must count each kill once and never throw mid-iteration (Task 5 test "a Death Hand among exploding vehicles").
3. `map.wall` must stay in step with `map.structure`: a wall destroyed under a Saboteur standing on it leaves a consistent map (Task 1 test "a wall that falls under a Saboteur").
4. The Palace aiming mode when the Palace is destroyed or the aim is off the map: the mode ends, the aim is clamped (Task 8 controller test, Task 5 edge test).
5. A computer Palace whose launch is refused (no room for the Saboteur) must not ask every second; Fremen must not join AI waves (Task 10 tests).

## File map

- Create: `src/sim/specials.js` — Deviator gas and revert, Devastator Destruct, Saboteur missions.
- Create: `src/sim/palace.js` — Palace weapon charge, Death Hand, Fremen, Saboteur call, Fremen hunting.
- Create: `src/render/models/structures/palace.js`, `src/render/models/units/death-hand.js`, `src/render/views/missile-views.js`.
- Modify (sim/data): `terrain.js`, `map.js`, `world.js`, `units.js`, `weapons.js`, `structures.js`, `tuning.js`, `phase.js`, `combat.js`, `orders.js`, `aftermath.js`, `capture.js`, `movement.js`, `tech.js`, `ai.js`, `starport.js`.
- Modify (view/UI): `controller.js`, `game-view.js`, `overlay.js`, `unit-views.js`, `effects.js`, `icons.js`, `cues.js`, `synth.js`, `cursors.js`, `sidebar.js`, `sidebar-model.js`, `selection-panel.js`, `styles.css`, `debug.js`, models `index.js`, `infantry.js`, `devastator.js`, scenes `base.js`, `battle.js`, `gallery.js`, `structures.js`, `icons.js`.
- Tests: new `walls`, `sonic`, `deviator`, `devastator`, `palace`, `fremen-saboteur`, `ai-palace` test files; additions to `ai`, `models-catalog`, `views`, `sidebar-model`, `controller`, `selection-panel`, `icons`, `effects`, `cues`, `synth`, `starport`, `data` tests.
- Scripts: `scripts/scenarios.mjs`, `scripts/e2e.mjs`; `README.md`.

---

### Task 1: Walls, and the Saboteur's way over them

**Files:**
- Modify: `src/data/terrain.js`, `src/sim/map.js`, `src/sim/world.js`, `src/data/units.js`, `src/data/tuning.js`, `src/sim/movement.js`, `src/sim/aftermath.js`, `src/input/controller.js`, `src/game/game-view.js`, `src/render/overlay.js`, `src/render/views/unit-views.js`
- Test: `tests/walls.test.mjs`

**Interfaces:**
- Produces: `SURFACE.WALL` (8); `moveFactor(surface, 'saboteur')`; `map.wall: Uint8Array` (1 where a wall stands); `MOVE.SABOTEUR = 'saboteur'`; `onFoot(move) → boolean` from `src/data/units.js`; `UNITS.saboteur.move === 'saboteur'`, `UNITS.saboteur.builtAt === null`; `DRIVE_ANGLE.saboteur`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/walls.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G, SURFACE, moveFactor } from '../src/data/terrain.js';
import { UNITS, MOVE, onFoot } from '../src/data/units.js';
import { DRIVE_ANGLE } from '../src/data/tuning.js';
import { destroyStructure } from '../src/sim/combat.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { flatWorld, runUntil } from './helpers.mjs';

test('only a Saboteur walks over walls, at full speed; other buildings stop it like anyone', () => {
  assert.equal(moveFactor(SURFACE.WALL, 'saboteur'), 255);
  for (const cls of ['foot', 'tracked', 'harvester', 'wheeled', 'worm']) assert.equal(moveFactor(SURFACE.WALL, cls), 0, cls);
  assert.equal(moveFactor(SURFACE.WALL, 'air'), 255);
  assert.equal(moveFactor(SURFACE.BLOCKED, 'saboteur'), 0);
  for (const s of ['SAND', 'DUNE', 'ROCK', 'MOUNTAIN', 'SPICE', 'CONCRETE', 'RUBBLE']) assert.equal(moveFactor(SURFACE[s], 'saboteur'), moveFactor(SURFACE[s], 'foot'), s);
  assert.equal(UNITS.saboteur.move, MOVE.SABOTEUR);
  assert.equal(UNITS.saboteur.builtAt, null, 'the Palace sends it; no factory builds it');
  assert.equal(DRIVE_ANGLE.saboteur, DRIVE_ANGLE.foot);
  assert.ok(onFoot(MOVE.SABOTEUR) && onFoot(MOVE.FOOT) && !onFoot(MOVE.TRACKED) && !onFoot(undefined));
});

test('the map knows where walls stand and forgets them when they fall', () => {
  const world = flatWorld(12, 12);
  const wall = world.spawnStructure('wall', 'atreides', 5, 5);
  const i = world.map.idx(5, 5);
  assert.equal(world.map.surface(i), SURFACE.WALL);
  world.spawnStructure('windtrap', 'atreides', 1, 1);
  assert.equal(world.map.surface(world.map.idx(1, 1)), SURFACE.BLOCKED);
  world.removeStructure(wall, 'destroyed');
  assert.equal(world.map.wall[i], 0);
  assert.equal(world.map.surface(i), SURFACE.ROCK);
});

test('a Saboteur crosses a wall line that stops infantry', () => {
  const world = flatWorld(16, 12);
  for (let y = 0; y < 12; y++) world.spawnStructure('wall', 'harkonnen', 8, y);
  const sab = world.spawnUnit('saboteur', 'ordos', 4, 5);
  const soldier = world.spawnUnit('soldier', 'ordos', 4, 7);
  world.issue('ordos', { type: 'move', ids: [sab.id, soldier.id], x: 12, y: 6 });
  assert.ok(runUntil(world, () => sab.tx >= 11 && sab.order.type === 'idle', 30) > 0, 'the Saboteur got through');
  assert.ok(soldier.tx < 8, 'the soldier stays on its side');
});

test('a wall that falls under a Saboteur leaves it standing where it was', () => {
  const world = flatWorld(12, 8);
  const wall = world.spawnStructure('wall', 'harkonnen', 6, 3);
  const sab = world.spawnUnit('saboteur', 'ordos', 3, 3);
  world.issue('ordos', { type: 'move', ids: [sab.id], x: 6, y: 3 });
  assert.ok(runUntil(world, () => sab.tx === 6 && sab.order.type === 'idle', 15) > 0, 'on top of the wall');
  destroyStructure(world, wall);
  assert.deepEqual(checkInvariants(world), []);
  world.issue('ordos', { type: 'move', ids: [sab.id], x: 9, y: 3 });
  assert.ok(runUntil(world, () => sab.tx === 9, 15) > 0, 'and walks on');
});

test('tracks crush a Saboteur like any foot soldier', () => {
  const world = flatWorld(24, 16, G.ROCK);
  const m = world.map;
  for (let x = 4; x <= 8; x++) for (let y = 0; y < 16; y++) if (y !== 8) m.ground[m.idx(x, y)] = G.MOUNTAIN;   // a one-tile pass
  m.revision++;
  const sab = world.spawnUnit('saboteur', 'ordos', 6, 8);
  const mcv = world.spawnUnit('mcv', 'harkonnen', 2, 8, { heading: 0 });
  world.issue('harkonnen', { type: 'move', ids: [mcv.id], x: 12, y: 8 });
  let crushed = false;
  runUntil(world, () => (crushed ||= world.events.drain().some((e) => e.type === 'unitDestroyed' && e.id === sab.id && e.cause === 'crushed')), 30);
  assert.ok(crushed);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/walls.test.mjs`
Expected: FAIL — `SURFACE.WALL` is undefined (`moveFactor` throws reading row `undefined`), `onFoot` is not exported.

- [ ] **Step 3: Implement**

Replace `src/data/terrain.js` with:
```js
// Ground types and the original movement table (OpenDUNE landscapeinfo.c,
// docs/research/raw/mechanics-campaign.md §1.2). Values are out of 255 of a unit's full speed; 0 = impassable.
// The Saboteur walks where infantry walks and over walls at full speed (OpenDUNE unit.c).
export const G = { SAND: 0, DUNE: 1, ROCK: 2, MOUNTAIN: 3 };
export const SURFACE = { SAND: 0, DUNE: 1, ROCK: 2, MOUNTAIN: 3, SPICE: 4, CONCRETE: 5, RUBBLE: 6, BLOCKED: 7, WALL: 8 };
//            foot tracked harvester wheeled air worm saboteur
const TABLE = [
  [112, 112, 112, 160, 255, 192, 112], // sand
  [112, 160, 160, 160, 255, 192, 112], // dune
  [112, 160, 160, 112, 255, 0, 112],   // rock
  [64, 0, 0, 0, 255, 0, 64],           // mountain
  [112, 160, 160, 160, 255, 192, 112], // spice (on sand)
  [255, 255, 255, 255, 255, 0, 255],   // concrete slab
  [160, 160, 160, 160, 255, 0, 160],   // rubble (destroyed wall/structure)
  [0, 0, 0, 0, 255, 0, 0],             // structure
  [0, 0, 0, 0, 255, 0, 255],           // wall
];
const COLUMN = { foot: 0, tracked: 1, harvester: 2, wheeled: 3, air: 4, worm: 5, saboteur: 6 };

export function moveFactor(surface, moveClass) {
  return TABLE[surface][COLUMN[moveClass]];
}
```

In `src/sim/map.js` replace
```js
    this.structure = new Int32Array(n);   // structure id or 0
```
with
```js
    this.structure = new Int32Array(n);   // structure id or 0
    this.wall = new Uint8Array(n);        // 1 = the structure here is a wall (a Saboteur walks over it)
```
and replace `    if (this.structure[i]) return SURFACE.BLOCKED;` with
```js
    if (this.structure[i]) return this.wall[i] ? SURFACE.WALL : SURFACE.BLOCKED;
```

In `src/sim/world.js` (`spawnStructure`) replace
```js
    for (const [fx, fy] of footprint(x, y, t.w, t.h)) this.map.structure[this.map.idx(fx, fy)] = s.id;
```
with
```js
    for (const [fx, fy] of footprint(x, y, t.w, t.h)) {
      const i = this.map.idx(fx, fy);
      this.map.structure[i] = s.id;
      if (t.isWall) this.map.wall[i] = 1;
    }
```
and in `removeStructure` replace `      if (this.map.structure[i] === s.id) this.map.structure[i] = 0;` with
```js
      if (this.map.structure[i] === s.id) { this.map.structure[i] = 0; this.map.wall[i] = 0; }
```

In `src/data/units.js` replace the `MOVE` line with
```js
export const MOVE = { FOOT: 'foot', TRACKED: 'tracked', HARVESTER: 'harvester', WHEELED: 'wheeled', AIR: 'air', WORM: 'worm', SABOTEUR: 'saboteur' };
/** Infantry of any kind: the Saboteur is a foot soldier with its own way over walls. */
export const onFoot = (move) => move === MOVE.FOOT || move === MOVE.SABOTEUR;
```
and in the `saboteur` row change `builtAt: 'palace'` to `builtAt: null` and `move: MOVE.FOOT` to `move: MOVE.SABOTEUR`.

In `src/data/tuning.js` add `saboteur: Math.PI` to `DRIVE_ANGLE`:
```js
export const DRIVE_ANGLE = { foot: Math.PI, tracked: 0.5, harvester: 0.5, wheeled: 1.1, air: Math.PI, worm: Math.PI, saboteur: Math.PI };
```

Replace the infantry checks with `onFoot` (import `onFoot` from `data/units.js` in each file; `overlay.js` has no imports yet — add the line under its header comment):
- `src/sim/movement.js`: `other.move === 'foot'` → `onFoot(other.move)` (crush).
- `src/sim/aftermath.js`: `else if (u.move !== 'foot')` → `else if (!onFoot(u.move))`.
- `src/input/controller.js`: `(u.move === 'foot' ? 0.3 : 0.42)` → `(onFoot(u.move) ? 0.3 : 0.42)`.
- `src/game/game-view.js` (extend the existing `UNITS` import): `UNITS[e.typeId]?.move === 'foot'` → `onFoot(UNITS[e.typeId]?.move)`; `(u.move === 'foot' ? 0.2 : 0.34)` → `(onFoot(u.move) ? 0.2 : 0.34)`; `if (u.move === 'foot' || u.inside` → `if (onFoot(u.move) || u.inside`; `if (u.move === 'foot') continue;` → `if (onFoot(u.move)) continue;`.
- `src/render/overlay.js`: `(u.move === 'foot' ? 0.12 : 0.18)` → `(onFoot(u.move) ? 0.12 : 0.18)`; `(u.move === 'foot' ? 0.2 : 0.34)` → `(onFoot(u.move) ? 0.2 : 0.34)`.
- `src/render/views/unit-views.js`: `const foot = u.move === 'foot', air = !u.isGround;` → `const foot = onFoot(u.move), air = !u.isGround;`.

Afterwards `grep -rn "'foot'" src` shows only `src/data/units.js` (the `MOVE` table) and `src/scenes/base.js` (a scene helper asking for a free foot tile) — no behaviour check compares against `'foot'` any more.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/walls.test.mjs tests/data.test.mjs tests/mapgen.test.mjs tests/movement.test.mjs tests/combat-structures.test.mjs`
Expected: PASS.

- [ ] **Step 5: Full suite and commit**

Run: `npm test > "$WS/test.log" 2>&1; tail -5 "$WS/test.log"` — Expected: all pass.
```bash
git add src/data/terrain.js src/sim/map.js src/sim/world.js src/data/units.js src/data/tuning.js src/sim/movement.js src/sim/aftermath.js src/input/controller.js src/game/game-view.js src/render/overlay.js src/render/views/unit-views.js tests/walls.test.mjs
git commit -m "feat(sim): walls get their own surface; the Saboteur walks over them

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The Sonic Tank's wave

**Files:**
- Modify: `src/data/weapons.js`, `src/data/tuning.js`, `src/sim/combat.js`, `src/data/phase.js`, `tests/tech.test.mjs` (message only)
- Test: `tests/sonic.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `WEAPONS.sonic = { projectile: 'sonic', speed: 200, accurate: true, wave: true }`; `shotFor(...).wave`; `SONIC.fade` in tuning; projectiles with `wave: { hit: number[] }` and `projectile: 'sonic'`; `fired` events with `projectile: 'sonic'`. `sonicTank` leaves `DEFERRED`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/sonic.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, shotFor } from '../src/data/weapons.js';
import { buildOptions } from '../src/sim/tech.js';
import { flatWorld, run } from './helpers.mjs';

const lost = (e) => e.maxHp - e.hp;

test('the sonic wave hurts everything on its line once, less the further it goes, and stops after 8 tiles', () => {
  assert.ok(WEAPONS.sonic.wave && shotFor('sonic', 3).wave);
  const world = flatWorld(24, 12);
  world.spawnUnit('sonicTank', 'atreides', 2, 6);
  const near = world.spawnUnit('mcv', 'harkonnen', 4, 6), mid = world.spawnUnit('mcv', 'harkonnen', 8, 6), far = world.spawnUnit('mcv', 'harkonnen', 12, 6);
  run(world, 1.2);   // one wave: the next comes two seconds after the first
  assert.ok(lost(near) >= 50 && lost(near) <= 60, `near ${lost(near)}`);
  assert.ok(lost(mid) >= 32 && lost(mid) < lost(near), `mid ${lost(mid)}`);
  assert.equal(lost(far), 0, 'beyond its 8 tiles');
});

test('friendly fire is real, but Sonic Tanks and walls are spared', () => {
  const world = flatWorld(24, 12);
  const tank = world.spawnUnit('sonicTank', 'atreides', 2, 6);
  const friend = world.spawnUnit('combatTank', 'atreides', 5, 6);
  const brother = world.spawnUnit('sonicTank', 'atreides', 7, 6);
  const wall = world.spawnStructure('wall', 'harkonnen', 9, 6);
  const mcv = world.spawnUnit('mcv', 'harkonnen', 10, 6);
  world.issue('atreides', { type: 'attack', ids: [tank.id], targetKind: 'unit', targetId: mcv.id });
  run(world, 1.2);
  assert.ok(lost(friend) > 0, 'the wave hurt its own side');
  assert.equal(lost(brother), 0, 'Sonic Tanks shrug it off');
  assert.equal(lost(wall), 0, 'walls too');
  assert.equal(lost(tank), 0);
});

test('a building on the wave\'s path takes one hit, however many of its tiles it crosses', () => {
  const world = flatWorld(24, 12);
  world.spawnUnit('sonicTank', 'atreides', 2, 6);
  const trap = world.spawnStructure('windtrap', 'harkonnen', 6, 5);
  run(world, 1.2);
  assert.ok(lost(trap) >= 40 && lost(trap) <= 55, `lost ${lost(trap)}`);
});

test('the Sonic Tank joins the Atreides roster once a House of IX stands', () => {
  const world = flatWorld(20, 20);
  world.spawnStructure('heavyFactory', 'atreides', 1, 1);
  assert.ok(!buildOptions(world, 'atreides').heavy.includes('sonicTank'));
  world.spawnStructure('ix', 'atreides', 6, 1);
  assert.ok(buildOptions(world, 'atreides').heavy.includes('sonicTank'));
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/sonic.test.mjs`
Expected: FAIL — `WEAPONS.sonic.wave` is undefined; the shell hits only its target (mid loses 0); `sonicTank` is deferred.

- [ ] **Step 3: Implement**

In `src/data/weapons.js`: change line 4 of the header to
```js
// The Sonic Tank's wave hurts everything along its path (combat.js); Deviator gas and Devastator plasma get their special behaviour in plan 2.
```
replace the `sonic` row with
```js
  sonic:         { projectile: 'sonic', speed: 200, accurate: true, wave: true },   // a ripple along a line, not a shell
```
and in `shotFor` make the base shot carry the flag:
```js
  const base = { id: weaponId, projectile: w.projectile, speed: w.speed, accurate: w.accurate, homing: !!w.homing, wave: !!w.wave, damageScale: 1 };
```

Append to `src/data/tuning.js`:
```js

export const SONIC = { fade: 0.5 };             // the Sonic Tank's wave has lost half its strength by the end of its 8 tiles
```

In `src/sim/combat.js`:
- Add to the header comment (after "…units that fire twice do so only above half health."): ` The Sonic Tank's wave runs its full range and hurts everything on its path once — friend or foe, but never Sonic Tanks or walls.`
- Add `SONIC` to the tuning import.
- In `fireAt`, right after `if (!shot) return;`:
```js
  if (shot.wave) { fireWave(world, from, p, stats, shot); return; }
```
- After `fireAt`, add:
```js
/** The Sonic Tank's wave (spec §4.6): a ripple straight out to the weapon's range from the gun. */
function fireWave(world, from, p, stats, shot) {
  const map = world.map, a = Math.atan2(p.y - from.y, p.x - from.x);
  const tx = Math.max(0, Math.min(map.w - 0.001, from.x + Math.cos(a) * stats.range));
  const ty = Math.max(0, Math.min(map.h - 0.001, from.y + Math.sin(a) * stats.range));
  const id = world.nextProjectileId++;
  world.projectiles.set(id, {
    id, weapon: stats.weapon, projectile: shot.projectile, house: from.house, sourceId: from.id, sourceKind: from.kind,
    x: from.x, y: from.y, px: from.x, py: from.y, sx: from.x, sy: from.y, tx, ty,
    speed: projectileSpeed(shot.speed), damage: stats.damage, accurate: true, homing: false, target: null, airburst: false, fromAlt: 0, toAlt: 0,
    wave: { hit: [] },
  });
  world.events.push('fired', { id: from.id, kind: from.kind, house: from.house, weapon: stats.weapon, projectile: shot.projectile, x: from.x, y: from.y, tx, ty });
}

/** What the wave passed over since the last tick takes its hit, once per wave and weaker the further it has
 *  run. Units and buildings on those tiles, own ones too; never Sonic Tanks, walls or anything held inside. */
function sweep(world, p) {
  const map = world.map, n = Math.max(1, Math.ceil(Math.hypot(p.x - p.px, p.y - p.py) / 0.25));
  const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1, by = { house: p.house, id: p.sourceId, kind: p.sourceKind };
  for (let k = 0; k <= n; k++) {
    const x = p.px + ((p.x - p.px) * k) / n, y = p.py + ((p.y - p.py) * k) / n, tx = Math.floor(x), ty = Math.floor(y);
    if (!map.inBounds(tx, ty)) continue;
    const i = map.idx(tx, ty);
    const amount = Math.round(p.damage * (1 - (SONIC.fade * Math.hypot(x - p.sx, y - p.sy)) / total));
    for (const v of [world.units.get(map.unit[i]), world.structures.get(map.structure[i])]) {
      if (!v || v.hp <= 0 || v.inside || v.typeId === 'sonicTank' || v.type.isWall || p.wave.hit.includes(v.id)) continue;
      p.wave.hit.push(v.id);
      damage(world, v, amount, by);
    }
  }
}
```
- In `updateProjectiles`, replace
```js
      world.projectiles.delete(p.id);
      impact(world, p);
      continue;
    }
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
```
with
```js
      world.projectiles.delete(p.id);
      if (p.wave) sweep(world, p); else impact(world, p);
      continue;
    }
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
    if (p.wave) sweep(world, p);
```

In `src/data/phase.js` remove `'sonicTank', ` from `DEFERRED`.

In `tests/tech.test.mjs` change the message `'IX specials are plan 2'` to `'the Sonic Tank needs a House of IX'`.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/sonic.test.mjs tests/tech.test.mjs tests/combat.test.mjs`
Expected: PASS.

- [ ] **Step 5: Full suite and commit**

Run: `npm test > "$WS/test.log" 2>&1; tail -5 "$WS/test.log"` — Expected: all pass.
```bash
git add src/data/weapons.js src/data/tuning.js src/sim/combat.js src/data/phase.js tests/tech.test.mjs tests/sonic.test.mjs
git commit -m "feat(sim): the Sonic Tank's wave hurts everything on its path

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Deviator gas

**Files:**
- Create: `src/sim/specials.js`
- Modify: `src/data/weapons.js`, `src/data/tuning.js`, `src/sim/combat.js`, `src/sim/orders.js`, `src/sim/world.js`, `src/data/phase.js`
- Test: `tests/deviator.test.mjs`

**Interfaces:**
- Consumes: `transferUnit(world, u, to)` (capture.js), `stopUnit(u)` (orders.js).
- Produces: `WEAPONS.gasRocket = { projectile: 'gas', …, gas: true }`; `shotFor(...).gas`; `DEVIATOR = { radius, seconds, immune }`; `isArmed` true for gas weapons; `deviatable(u)` and `findTarget(…, { only })` in combat.js; `deviate(world, { house, x, y })` and `updateDeviations(world)` in specials.js; `u.deviated = { from, until }` (null after revert); events `unitDeviated { id, from, to, x, y }`, `unitReverted { id, to, x, y }`, impacts with `projectile: 'gas'`; `world.onGas(p)` hook.

- [ ] **Step 1: Write the failing tests**

**File: `tests/deviator.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../src/data/units.js';
import { isArmed, deviatable } from '../src/sim/combat.js';
import { deviate } from '../src/sim/specials.js';
import { buildOptions } from '../src/sim/tech.js';
import { flatWorld, run } from './helpers.mjs';

const gas = (world, house, x, y) => deviate(world, { house, x: x + 0.5, y: y + 0.5 });

test('gas turns enemy ground units close to the burst to the gasser\'s side; some are immune', () => {
  const world = flatWorld(16, 12);
  const near = world.spawnUnit('combatTank', 'atreides', 5, 5);
  const edge = world.spawnUnit('quad', 'atreides', 6, 5);
  const far = world.spawnUnit('combatTank', 'atreides', 8, 5);
  const immune = ['harvester', 'mcv', 'deviator'].map((t, k) => world.spawnUnit(t, 'atreides', 4 + k, 6));
  const orni = world.spawnUnit('ornithopter', 'atreides', 5, 4);
  const own = world.spawnUnit('combatTank', 'ordos', 4, 5);
  gas(world, 'ordos', 5, 5);
  assert.equal(near.house, 'ordos');
  assert.equal(edge.house, 'ordos');
  assert.equal(near.deviated.from, 'atreides');
  assert.equal(far.house, 'atreides');
  for (const u of [...immune, orni]) assert.equal(u.house, 'atreides', u.typeId);
  assert.equal(own.house, 'ordos');
  assert.equal(own.deviated, undefined);
  assert.ok(!deviatable({ kind: 'unit', typeId: 'combatTank', isGround: true, inside: 9 }), 'nor anything held in a bay or a Carryall');
});

test('a deviated unit takes its new side\'s orders and goes home after 40 s', () => {
  const world = flatWorld(16, 12);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5);
  gas(world, 'ordos', 5, 5);
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 1, y: 5 });
  world.issue('ordos', { type: 'move', ids: [tank.id], x: 10, y: 5 });
  run(world, 1);
  assert.equal(tank.order.type, 'move');
  assert.equal(tank.order.x, 10);
  run(world, 37);
  assert.equal(tank.house, 'ordos', 'still under the gas at 38 s');
  run(world, 2.5);
  assert.equal(tank.house, 'atreides');
  assert.equal(tank.deviated, null);
  assert.equal(tank.order.type, 'idle');
  assert.ok(world.events.drain().some((e) => e.type === 'unitReverted' && e.id === tank.id));
});

test('gas from the side a unit was taken from brings it straight home; a third side keeps the first owner on record', () => {
  const world = flatWorld(16, 12);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5);
  gas(world, 'ordos', 5, 5);
  gas(world, 'harkonnen', 5, 5);
  assert.equal(tank.house, 'harkonnen');
  assert.equal(tank.deviated.from, 'atreides');
  gas(world, 'atreides', 5, 5);
  assert.equal(tank.house, 'atreides');
  assert.equal(tank.deviated, null);
});

test('a deviated unit held in a bay or a Carryall goes home only once it is out', () => {
  const world = flatWorld(16, 12);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5);
  gas(world, 'ordos', 5, 5);
  tank.inside = 999;   // held (the flag is all the revert looks at)
  run(world, 41);
  assert.equal(tank.house, 'ordos');
  tank.inside = 0;
  run(world, 1);
  assert.equal(tank.house, 'atreides');
});

test('the Deviator fires gas only at units it can turn, never at buildings', () => {
  const world = flatWorld(20, 12);
  const dev = world.spawnUnit('deviator', 'ordos', 2, 6);
  assert.ok(isArmed(UNITS.deviator));
  world.spawnUnit('harvester', 'atreides', 5, 6);
  world.spawnStructure('windtrap', 'atreides', 5, 2);
  run(world, 3);
  assert.ok(!world.events.drain().some((e) => e.type === 'fired' && e.id === dev.id), 'nothing worth gassing');
  world.spawnUnit('combatTank', 'atreides', 7, 6);
  run(world, 3);
  const shots = world.events.drain().filter((e) => e.type === 'fired' && e.id === dev.id);
  assert.ok(shots.length >= 1 && shots.every((e) => e.projectile === 'gas'), JSON.stringify(shots));
});

test('an attack order at a Harvester or a building leaves a Deviator be', () => {
  const world = flatWorld(20, 12);
  const dev = world.spawnUnit('deviator', 'ordos', 2, 6);
  const harv = world.spawnUnit('harvester', 'atreides', 5, 6);
  const trap = world.spawnStructure('windtrap', 'atreides', 5, 2);
  const tank = world.spawnUnit('combatTank', 'atreides', 9, 6);
  world.issue('ordos', { type: 'attack', ids: [dev.id], targetKind: 'unit', targetId: harv.id });
  world.issue('ordos', { type: 'attack', ids: [dev.id], targetKind: 'structure', targetId: trap.id });
  world.step();
  assert.notEqual(dev.order.type, 'attack');
  world.issue('ordos', { type: 'attack', ids: [dev.id], targetKind: 'unit', targetId: tank.id });
  world.step();
  assert.equal(dev.order.type, 'attack');
});

test('the Deviator joins the Ordos roster once a House of IX stands', () => {
  const world = flatWorld(20, 20);
  world.spawnStructure('heavyFactory', 'ordos', 1, 1);
  world.spawnStructure('ix', 'ordos', 6, 1);
  assert.ok(buildOptions(world, 'ordos').heavy.includes('deviator'));
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/deviator.test.mjs`
Expected: FAIL — `src/sim/specials.js` does not exist (module not found).

- [ ] **Step 3: Implement**

In `src/data/weapons.js` change header line 4 to
```js
// The Sonic Tank's wave hurts everything along its path (combat.js); Deviator gas turns units instead of hurting them (specials.js).
```
replace the `gasRocket` row with
```js
  gasRocket:     { projectile: 'gas', speed: 200, accurate: false, gas: true },    // turns units, does no harm
```
and add `gas: !!w.gas, ` to the base shot in `shotFor` (after `wave: !!w.wave, `).

Append to `src/data/tuning.js`:
```js

export const DEVIATOR = {
  radius: 1.5,          // units this close to where the gas bursts change sides …
  seconds: 40,          // … for this long, then go home (spec §4.6, tunable)
  immune: ['harvester', 'mcv', 'deviator', 'sandworm'],   // and aircraft: the gas stays on the ground
};
```

In `src/sim/combat.js`:
- Add `DEVIATOR` to the tuning import.
- Replace the `isArmed` line with
```js
export const isArmed = (t) => !!(t && t.weapon && WEAPONS[t.weapon] && (t.damage > 0 || WEAPONS[t.weapon].gas));   // the Deviator's gas does no harm but is its weapon
const GAS_IMMUNE = new Set(DEVIATOR.immune);
/** Deviator gas turns ground units that can change sides: not aircraft, Harvesters, MCVs, Deviators or worms, nor anything held inside. */
export const deviatable = (u) => !!u && u.kind === 'unit' && u.isGround && !u.inside && !GAS_IMMUNE.has(u.typeId);
```
- `findTarget`: add `only = null` to its options (`{ structures = true, ignoreFog = false, exclude = 0, air = false, only = null } = {}`) and extend the unit skip test: `if (u.house === houseId || (!u.isGround && !air) || u.inside || u.type.untargetable || u.id === exclude || (only && !only(u))) continue;`
- In `unitCombat`, replace the scan line
```js
      t = u.target = r ? findTarget(world, u.house, from.x, from.y, r + 0.25, { exclude, air: !!u.type.targetAir }) : null;
```
with
```js
      const gas = !!WEAPONS[u.type.weapon]?.gas;   // a Deviator looks only for units it can turn
      t = u.target = r ? findTarget(world, u.house, from.x, from.y, r + 0.25, { exclude, air: !!u.type.targetAir, structures: !gas, only: gas ? deviatable : null }) : null;
```
- In `fireAt`, add `gas: !!shot.gas,` to the projectile record (after `airburst: air && !hits, fromAlt: …, toAlt: …,`).
- At the top of `impact`, before `const map = world.map;`:
```js
  if (p.gas) {   // Deviator gas: a cloud that turns units instead of hurting them
    world.events.push('impact', { weapon: p.weapon, projectile: p.projectile, x: p.x, y: p.y, hit: false, alt: 0 });
    world.onGas?.(p);
    return;
  }
```

**File: `src/sim/specials.js`**
```js
// House specials (spec §4.6): Deviator gas turns enemy ground units to the gasser's side for 40 s; then
// they go home. A unit taken twice keeps its first owner on record, and gas from that owner brings it
// home at once. Units held in a bay or a Carryall are not gassed, and go home only once they are out.
import { DEVIATOR } from '../data/tuning.js';
import { deviatable } from './combat.js';
import { transferUnit } from './capture.js';
import { stopUnit } from './orders.js';

/** A gas cloud bursts at p: enemy ground units close by change sides, except the immune. */
export function deviate(world, p) {
  for (const u of [...world.units.values()]) {
    if (u.house === p.house || !deviatable(u) || Math.hypot(u.x - p.x, u.y - p.y) > DEVIATOR.radius) continue;
    if (u.deviated?.from === p.house) { restore(world, u); continue; }   // gassed by the side it was taken from
    const from = u.house;
    u.deviated = { from: u.deviated?.from ?? from, until: world.time + DEVIATOR.seconds };
    transferUnit(world, u, p.house);
    stopUnit(u);
    world.events.push('unitDeviated', { id: u.id, from, to: p.house, x: u.x, y: u.y });
  }
}

function restore(world, u) {
  const home = u.deviated.from;
  u.deviated = null;
  transferUnit(world, u, home);
  stopUnit(u);
  world.events.push('unitReverted', { id: u.id, to: home, x: u.x, y: u.y });
}

/** The gas wears off: deviated units go home (not while held in a bay or a Carryall's claws). */
export function updateDeviations(world) {
  for (const u of [...world.units.values()]) if (u.deviated && world.time >= u.deviated.until && !u.inside) restore(world, u);
}
```

In `src/sim/orders.js`: change `import { isArmed } from './combat.js';` to `import { isArmed, deviatable } from './combat.js';`, add `import { WEAPONS } from '../data/weapons.js';`, and in `orderAttack` replace
```js
    if (!isArmed(u.type) || entity === u) continue;
```
with
```js
    if (!isArmed(u.type) || entity === u) continue;
    if (WEAPONS[u.type.weapon]?.gas && entity && !deviatable(entity)) continue;   // gas is wasted on buildings, Harvesters and MCVs
```

In `src/sim/world.js`: add `import { deviate, updateDeviations } from './specials.js';`; in the constructor, after the `onCrush` line:
```js
    this.onGas = (p) => deviate(this, p);
```
and in `step()`, after the power line:
```js
    if (this.tick % 10 === 5) updateDeviations(this);
```

In `src/data/phase.js` remove `'deviator', ` from `DEFERRED`.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/deviator.test.mjs tests/combat.test.mjs tests/orders-combat.test.mjs tests/weapons.test.mjs`
Expected: PASS.

- [ ] **Step 5: Full suite and commit**

Run: `npm test > "$WS/test.log" 2>&1; tail -5 "$WS/test.log"` — Expected: all pass.
```bash
git add src/sim/specials.js src/data/weapons.js src/data/tuning.js src/sim/combat.js src/sim/orders.js src/sim/world.js src/data/phase.js tests/deviator.test.mjs
git commit -m "feat(sim): Deviator gas turns enemy units for 40 s

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Devastator Destruct

**Files:**
- Modify: `src/sim/specials.js`, `src/data/tuning.js`, `src/data/units.js`, `src/sim/orders.js`, `src/sim/combat.js`, `src/sim/world.js`, `src/data/phase.js`, `tests/ai.test.mjs`
- Test: `tests/devastator.test.mjs`

**Interfaces:**
- Consumes: `killUnit` (combat.js), `splash(world, x, y, amount, radius, attacker, size)` (aftermath.js), `stopUnit`.
- Produces: `DESTRUCT` tuning; `UNITS.devastator.destructs = true`; `orderDestruct(world, u)`, `destruct(world, u)` in specials.js; `u.destructAt` (seconds, world time); commands `{ type: 'destruct', ids }` and `'deploy'` → Destruct for Devastators; events `destructArmed { id, house, x, y }` and `unitDestroyed` with `cause: 'destructed'`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/devastator.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOptions } from '../src/sim/tech.js';
import { flatWorld, run } from './helpers.mjs';

test('Destruct: three seconds of warning, then a blast where it stood and seven round it that spare nobody', () => {
  const world = flatWorld(16, 12);
  const dev = world.spawnUnit('devastator', 'harkonnen', 6, 6);
  const foe = world.spawnUnit('mcv', 'atreides', 7, 6);
  const friend = world.spawnUnit('mcv', 'harkonnen', 5, 6);
  world.issue('harkonnen', { type: 'destruct', ids: [dev.id] });
  run(world, 2.9);
  assert.ok(world.units.has(dev.id), 'still counting down');
  assert.equal(foe.hp, foe.maxHp);
  world.events.drain();
  run(world, 0.3);
  assert.ok(!world.units.has(dev.id));
  const events = world.events.drain();
  assert.ok(events.some((e) => e.type === 'unitDestroyed' && e.id === dev.id && e.cause === 'destructed'));
  assert.ok(events.filter((e) => e.type === 'explosion').length >= 8);
  assert.ok(foe.hp < foe.maxHp && friend.hp < friend.maxHp, 'friend and foe alike');
});

test('a Devastator counting down stops, holds its fire and takes no orders, not even to shoot back', () => {
  const world = flatWorld(16, 12);
  const dev = world.spawnUnit('devastator', 'harkonnen', 3, 6);
  world.issue('harkonnen', { type: 'move', ids: [dev.id], x: 12, y: 6 });
  run(world, 0.5);
  world.issue('harkonnen', { type: 'destruct', ids: [dev.id] });
  run(world, 0.1);
  assert.equal(dev.order.type, 'idle');
  assert.equal(dev.path.length, 0);
  world.spawnUnit('combatTank', 'atreides', 7, 6);
  world.issue('harkonnen', { type: 'move', ids: [dev.id], x: 1, y: 6 });
  world.events.drain();
  run(world, 2);
  assert.equal(dev.order.type, 'idle');
  assert.ok(!world.events.drain().some((e) => e.type === 'fired' && e.id === dev.id), 'it holds its fire');
});

test('D on a Devastator means Destruct; an MCV still deploys', () => {
  const world = flatWorld(16, 12);
  const dev = world.spawnUnit('devastator', 'harkonnen', 3, 6);
  world.spawnUnit('mcv', 'harkonnen', 10, 6);
  world.issue('harkonnen', { type: 'deploy', ids: [...world.units.keys()] });
  world.step();
  assert.ok(dev.destructAt > 0);
  assert.ok([...world.structures.values()].some((s) => s.typeId === 'constructionYard'));
});

test('the Devastator joins the Harkonnen roster once a House of IX stands', () => {
  const world = flatWorld(20, 20);
  world.spawnStructure('heavyFactory', 'harkonnen', 1, 1);
  world.spawnStructure('ix', 'harkonnen', 6, 1);
  assert.ok(buildOptions(world, 'harkonnen').heavy.includes('devastator'));
});
```

In `tests/ai.test.mjs`, the last test: rename it to `'the AI puts its turrets up before a Starport; the Harkonnen go for a House of IX too, for the Devastator'` and replace its last three lines
```js
  const hk = base('harkonnen', 'wor');
  run(hk, 300);
  assert.ok(![...hk.structures.values()].some((s) => s.typeId === 'starport' || s.typeId === 'ix'), 'nothing for the Harkonnen to open yet');
```
with
```js
  const hk = base('harkonnen', 'wor');
  run(hk, 300);
  assert.ok([...hk.structures.values()].some((s) => s.typeId === 'starport'), 'a Starport on the way to the Devastator');
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/devastator.test.mjs tests/ai.test.mjs`
Expected: FAIL — the `destruct` command is rejected (the Devastator lives on), `deploy` leaves it be, `devastator` is deferred, the Harkonnen AI builds no Starport.

- [ ] **Step 3: Implement**

Append to `src/data/tuning.js`:
```js

export const DESTRUCT = {
  delay: 3,             // seconds of warning glow before a Devastator blows itself apart (spec §4.6)
  centre: [25, 50],     // the blast where it stood …
  blasts: 7,            // … and seven more round it (OpenDUNE)
  blast: [75, 150],
  scatter: 1.5,         // tiles from the centre
  radius: 1.5,          // each blast's reach
};
```

In `src/data/units.js`, add `destructs: true` to the end of the `devastator` row (after `sight: 4`).

In `src/sim/specials.js`: add a line at the end of the header comment:
```js
// Destruct: a Devastator stops, glows for three seconds and blows itself apart.
```
Replace the import lines with
```js
import { DEVIATOR, DESTRUCT } from '../data/tuning.js';
import { deviatable, killUnit } from './combat.js';
import { splash } from './aftermath.js';
import { transferUnit } from './capture.js';
import { stopUnit } from './orders.js';
```
and append:
```js

/** Destruct (spec §4.6): the Devastator stops where it is, glows and takes no more orders. */
export function orderDestruct(world, u) {
  if (!u.type.destructs || u.destructAt !== undefined) return;
  stopUnit(u);
  u.target = null;
  u.aiming = false;
  u.destructAt = world.time + DESTRUCT.delay;
  world.events.push('destructArmed', { id: u.id, house: u.house, x: u.x, y: u.y });
}

/** A blast where it stood and seven more round it; nobody close by is spared. */
export function destruct(world, u) {
  const { x, y } = u, by = { house: u.house, id: u.id, kind: 'unit' };
  killUnit(world, u, null, 'destructed');
  splash(world, x, y, world.rng.range(DESTRUCT.centre[0], DESTRUCT.centre[1]), DESTRUCT.radius, by, 'large');
  for (let k = 0; k < DESTRUCT.blasts; k++) {
    const a = world.rng.range(0, Math.PI * 2), r = DESTRUCT.scatter * Math.sqrt(world.rng.next());
    splash(world, x + Math.cos(a) * r, y + Math.sin(a) * r, world.rng.range(DESTRUCT.blast[0], DESTRUCT.blast[1]), DESTRUCT.radius, by, 'medium');
  }
}
```

In `src/sim/orders.js`: add `import { orderDestruct } from './specials.js';`; in `applyCommand` extend the unit filter with `&& u.destructAt === undefined` (units counting down take no orders), and replace the `deploy` case with
```js
    case 'deploy': units.forEach((u) => (u.type.destructs ? orderDestruct(world, u) : orderDeploy(world, u))); return;   // D: Deploy or Destruct (spec §5.6)
    case 'destruct': units.forEach((u) => orderDestruct(world, u)); return;
```

In `src/sim/combat.js`:
- `updateCombat`: `if (u.isGround && !u.inside && isArmed(u.type)) unitCombat(world, u);` → `if (u.isGround && !u.inside && u.destructAt === undefined && isArmed(u.type)) unitCombat(world, u);   // a Devastator counting down holds its fire`
- `retaliate`: start the first condition with `victim.destructAt !== undefined || `: `if (victim.destructAt !== undefined || victim.kind !== 'unit' || !attacker || …`.

In `src/sim/world.js`: import `destruct` alongside the others from `./specials.js`; in the per-unit loop, after `if (!u.isGround) { updateAircraft(this, u); continue; }`:
```js
      if (u.destructAt !== undefined && this.time >= u.destructAt) { destruct(this, u); continue; }
```

In `src/data/phase.js` remove `'devastator', ` from `DEFERRED`.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/devastator.test.mjs tests/ai.test.mjs tests/deploy.test.mjs tests/orders.test.mjs`
Expected: PASS.

- [ ] **Step 5: Full suite and commit**

Run: `npm test > "$WS/test.log" 2>&1; tail -5 "$WS/test.log"` — Expected: all pass.
```bash
git add src/sim/specials.js src/data/tuning.js src/data/units.js src/sim/orders.js src/sim/combat.js src/sim/world.js src/data/phase.js tests/devastator.test.mjs tests/ai.test.mjs
git commit -m "feat(sim): Devastator Destruct: three seconds of warning, eight blasts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The Palace, its weapon charge and the Death Hand

**Files:**
- Create: `src/sim/palace.js`
- Modify: `src/data/tuning.js`, `src/data/structures.js`, `src/sim/tech.js` (comment), `src/sim/combat.js`, `src/sim/world.js`, `src/sim/orders.js`, `src/data/phase.js`
- Test: `tests/palace.test.mjs`

**Interfaces:**
- Consumes: `splash` (aftermath.js); `HOUSES[id].palace` (`'deathHand' | 'fremen' | 'saboteur'`).
- Produces: `PALACE = { recharge, names }`, `DEATH_HAND` tuning; palace.js exports `palaceWeapon(houseId)`, `palaceOf(world, houseId)`, `palaceReady(world, s)`, `armPalace(world, s)`, `updatePalaces(world)`, `orderPalace(world, houseId, x, y)`, `deathHandBlast(world, p)`; structure fields `s.readyAt`, `s.announced`; command `{ type: 'palace', x, y }`; events `palaceFired { house, weapon, x, y }`, `deathHandBlast { house, x, y }`, eva keys `weaponReady`, `notReady`; projectiles `projectile: 'deathHand'` with `deathHand: true`; `world.onDeathHand(p)` hook. `palace` leaves `DEFERRED`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/palace.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { STRUCTURES } from '../src/data/structures.js';
import { canBuild } from '../src/sim/tech.js';
import { palaceWeapon, palaceReady, deathHandBlast } from '../src/sim/palace.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

function palace(house) {
  const world = flatWorld(48, 32);
  const s = world.spawnStructure('palace', house, 2, 2);
  return { world, s };
}
const charge = (world, s) => { s.readyAt = world.time; };

test('a Palace arms its house weapon: the Death Hand in seven minutes, Fremen and Saboteur in four', () => {
  assert.deepEqual(['harkonnen', 'atreides', 'ordos'].map(palaceWeapon), ['deathHand', 'fremen', 'saboteur']);
  const { world, s } = palace('harkonnen');
  run(world, 419);
  assert.ok(!palaceReady(world, s));
  run(world, 1.5);
  assert.ok(palaceReady(world, s));
  const said = world.events.drain().filter((e) => e.type === 'eva' && e.key === 'weaponReady');
  assert.deepEqual(said.map((e) => [e.house, e.text]), [['harkonnen', 'Death Hand ready.']]);
  for (const house of ['atreides', 'ordos']) {
    const p = palace(house);
    run(p.world, 239);
    assert.ok(!palaceReady(p.world, p.s), house);
    run(p.world, 1.5);
    assert.ok(palaceReady(p.world, p.s), house);
  }
});

test('the Death Hand fires only when charged; it rises from the Palace and comes down near the aim', () => {
  const { world, s } = palace('harkonnen');
  world.issue('harkonnen', { type: 'palace', x: 40, y: 20 });
  world.step();
  assert.equal(world.projectiles.size, 0);
  assert.ok(world.events.drain().some((e) => e.type === 'eva' && e.key === 'notReady'));
  charge(world, s);
  world.issue('harkonnen', { type: 'palace', x: 40, y: 20 });
  world.step();
  const [p] = [...world.projectiles.values()];
  assert.equal(p.projectile, 'deathHand');
  assert.deepEqual([p.sx, p.sy], [3.5, 3.5], 'from the Palace');
  assert.ok(Math.hypot(p.tx - 40.5, p.ty - 20.5) <= 2 + 1e-9, 'within two tiles of the aim');
  assert.ok(s.readyAt >= world.time + 419, 'the clock starts again');
  assert.ok(runUntil(world, () => world.projectiles.size === 0, 10) > 0, 'it lands');
  assert.ok(world.events.drain().some((e) => e.type === 'deathHandBlast'));
});

test('the Death Hand bursts in 17 blasts that wreck what stands there, friend or foe', () => {
  const { world, s } = palace('harkonnen');
  const yard = world.spawnStructure('constructionYard', 'atreides', 30, 20);
  const own = world.spawnUnit('combatTank', 'harkonnen', 32, 21);
  world.events.drain();
  deathHandBlast(world, { house: 'harkonnen', sourceId: s.id, sourceKind: 'structure', x: 31, y: 21, damage: 150 });
  const large = world.events.drain().filter((e) => e.type === 'explosion' && e.size === 'large').length;
  assert.equal(large, 17 + (world.structures.has(yard.id) ? 0 : 1), 'seventeen blasts (and the yard going up)');
  assert.ok(yard.hp <= yard.maxHp - 300, `yard ${yard.hp}`);
  assert.ok(own.hp < own.maxHp, 'no friend is spared');
});

test('a Death Hand among exploding vehicles counts each kill once', () => {
  const { world, s } = palace('harkonnen');
  const mcvs = [[30, 20], [31, 20], [30, 21], [31, 21]].map(([x, y]) => world.spawnUnit('mcv', 'atreides', x, y));
  deathHandBlast(world, { house: 'harkonnen', sourceId: s.id, sourceKind: 'structure', x: 31, y: 21, damage: 150 });
  const dead = mcvs.filter((u) => !world.units.has(u.id)).length;
  assert.ok(dead >= 3, `${dead} dead`);
  assert.equal(world.houses.get('harkonnen').stats.unitsKilled, dead);
  assert.equal(world.houses.get('atreides').stats.unitsLost, dead);
});

test('an aim off the map is brought back onto it', () => {
  const { world, s } = palace('harkonnen');
  charge(world, s);
  world.issue('harkonnen', { type: 'palace', x: -30, y: 999 });
  world.step();
  const [p] = [...world.projectiles.values()];
  assert.ok(p.tx >= 0.5 && p.tx <= 2.5 && p.ty >= 29.5 && p.ty <= 31.5, `${p.tx}, ${p.ty}`);
});

test('one Palace to a house, and it cannot be captured', () => {
  const world = flatWorld(40, 30);
  for (const [t, x, y] of [['constructionYard', 1, 1], ['windtrap', 4, 1], ['refinery', 7, 1], ['starport', 11, 1]]) world.spawnStructure(t, 'harkonnen', x, y);
  assert.ok(canBuild(world, 'harkonnen', 'palace'));
  world.spawnStructure('palace', 'harkonnen', 20, 10);
  assert.ok(!canBuild(world, 'harkonnen', 'palace'));
  assert.ok(!STRUCTURES.palace.conquerable);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/palace.test.mjs`
Expected: FAIL — `src/sim/palace.js` does not exist.

- [ ] **Step 3: Implement**

Append to `src/data/tuning.js`:
```js

export const PALACE = {
  recharge: { deathHand: 420, fremen: 240, saboteur: 240 },   // seconds (spec §4.7)
  names: { deathHand: 'Death Hand', fremen: 'Fremen', saboteur: 'Saboteur' },
};

export const DEATH_HAND = {
  speed: 6,             // tiles per second
  scatter: 2,           // it comes down up to this far from the aim
  damage: 150,          // each of its 17 blasts, falling off over …
  radius: 1,            // … a tile
  pattern: [[0, 0], [0, 1], [0, -1], [0.78, 0.78], [-0.78, 0.78], [0.78, -0.78], [-0.78, -0.78], [1, 0], [-1, 0], [0, 2], [0, -2], [1.56, 1.56], [-1.56, 1.56], [1.56, -1.56], [-1.56, -1.56], [2, 0], [-2, 0]],   // a diamond out to 2 tiles (OpenDUNE)
};
```

In `src/data/structures.js` add `unique: true` to the end of the `palace` row (after `tech: 8`). In `src/sim/tech.js` change the comment `// one Starport per house (original)` to `// one Starport and one Palace per house (original)`.

**File: `src/sim/palace.js`**
```js
// Palace weapons (spec §4.7; research: structures.md "Superweapons"). A Palace arms its house's weapon —
// the Harkonnen Death Hand, the Atreides Fremen, the Ordos Saboteur — from the moment it stands (a new
// Palace starts from empty: the original's instant-ready rebuild is not copied) and fires on command. The
// Death Hand is a ballistic missile that comes down near the aim and bursts in 17 blasts; friend and foe
// alike are hurt. A launch that cannot happen keeps the charge.
import { HOUSES } from '../data/houses.js';
import { PALACE, DEATH_HAND } from '../data/tuning.js';
import { splash } from './aftermath.js';

const eva = (world, houseId, key, text) => world.events.push('eva', { house: houseId, key, text });

/** The house weapon: 'deathHand', 'fremen' or 'saboteur'. */
export const palaceWeapon = (houseId) => HOUSES[houseId]?.palace ?? null;

export function palaceOf(world, houseId) {
  for (const s of world.structures.values()) if (s.house === houseId && s.typeId === 'palace') return s;
  return null;
}

export const palaceReady = (world, s) => !!s && world.time >= s.readyAt;

/** A new Palace, or one that has just fired, charges its weapon from empty. */
export function armPalace(world, s) {
  s.readyAt = world.time + PALACE.recharge[palaceWeapon(s.house)];
  s.announced = false;
}

/** Once a second: a weapon that has finished charging says so. */
export function updatePalaces(world) {
  for (const s of world.structures.values()) {
    if (s.typeId !== 'palace' || s.announced || world.time < s.readyAt) continue;
    s.announced = true;
    eva(world, s.house, 'weaponReady', `${PALACE.names[palaceWeapon(s.house)]} ready.`);
  }
}

export function orderPalace(world, houseId, x, y) {
  const s = palaceOf(world, houseId), weapon = palaceWeapon(houseId);
  const launch = { deathHand: launchDeathHand }[weapon];
  const aimed = weapon !== 'saboteur';
  if (!s || !launch || (aimed && !(Number.isFinite(x) && Number.isFinite(y)))) { world.events.push('commandRejected', { house: houseId, command: 'palace' }); return; }
  if (!palaceReady(world, s)) { eva(world, houseId, 'notReady', `The ${PALACE.names[weapon]} is not ready.`); return; }
  const map = world.map;
  const tx = aimed ? Math.max(0, Math.min(map.w - 1, Math.floor(x))) : null, ty = aimed ? Math.max(0, Math.min(map.h - 1, Math.floor(y))) : null;
  if (!launch(world, s, tx, ty)) return;
  armPalace(world, s);
  world.events.push('palaceFired', { house: houseId, weapon, x: tx, y: ty });
}

/** Off it goes from the Palace, to come down up to two tiles from the aim. */
function launchDeathHand(world, s, tx, ty) {
  const map = world.map, a = world.rng.range(0, Math.PI * 2), r = DEATH_HAND.scatter * Math.sqrt(world.rng.next());
  const x = Math.max(0.5, Math.min(map.w - 0.5, tx + 0.5 + Math.cos(a) * r)), y = Math.max(0.5, Math.min(map.h - 0.5, ty + 0.5 + Math.sin(a) * r));
  const fx = s.x + s.w / 2, fy = s.y + s.h / 2, id = world.nextProjectileId++;
  world.projectiles.set(id, {
    id, weapon: 'deathHand', projectile: 'deathHand', house: s.house, sourceId: s.id, sourceKind: 'structure',
    x: fx, y: fy, px: fx, py: fy, sx: fx, sy: fy, tx: x, ty: y, speed: DEATH_HAND.speed, damage: DEATH_HAND.damage,
    accurate: true, homing: false, target: null, airburst: false, fromAlt: 0, toAlt: 0, deathHand: true,
  });
  world.events.push('fired', { id: s.id, kind: 'structure', house: s.house, weapon: 'deathHand', projectile: 'deathHand', x: fx, y: fy, tx: x, ty: y });
  return true;
}

/** It lands: 17 blasts in a diamond out to two tiles. */
export function deathHandBlast(world, p) {
  const by = { house: p.house, id: p.sourceId, kind: p.sourceKind };
  world.events.push('deathHandBlast', { house: p.house, x: p.x, y: p.y });
  for (const [dx, dy] of DEATH_HAND.pattern) splash(world, p.x + dx, p.y + dy, p.damage, DEATH_HAND.radius, by, 'large');
}
```

In `src/sim/combat.js`, at the very top of `impact` (before the gas branch):
```js
  if (p.deathHand) { world.onDeathHand?.(p); return; }   // palace.js: the cluster blast
```

In `src/sim/world.js`: add `import { armPalace, updatePalaces, deathHandBlast } from './palace.js';`; in `onStructurePlaced` add a line `if (s.typeId === 'palace') armPalace(this, s);` (after the refinery line); after the `onGas` hook add `this.onDeathHand = (p) => deathHandBlast(this, p);`; in `step()` after the deviations line:
```js
    if (this.tick % 20 === 5) updatePalaces(this);
```

In `src/sim/orders.js`: add `import { orderPalace } from './palace.js';` and the case
```js
    case 'palace': orderPalace(world, houseId, cmd.x, cmd.y); return;
```

In `src/data/phase.js` remove `'palace',` (the first line of the set) so it reads `new Set(['saboteur', 'frigate', 'sandworm'])` in the existing layout.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/palace.test.mjs tests/tech.test.mjs tests/data.test.mjs tests/sidebar-model.test.mjs`
Expected: PASS (if a sidebar or tech test lists a Starport-owning house's structures, the Palace now appears in it: extend that expected list and ledger it as a ruling).

- [ ] **Step 5: Full suite and commit**

Run: `npm test > "$WS/test.log" 2>&1; tail -5 "$WS/test.log"` — Expected: all pass.
```bash
git add src/sim/palace.js src/data/tuning.js src/data/structures.js src/sim/tech.js src/sim/combat.js src/sim/world.js src/sim/orders.js src/data/phase.js tests/palace.test.mjs
git commit -m "feat(sim): the Palace charges its house weapon; the Death Hand

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The Fremen and the Saboteur

**Files:**
- Modify: `src/sim/palace.js`, `src/sim/specials.js`, `src/data/units.js`, `src/data/tuning.js`, `src/sim/aftermath.js`, `src/sim/capture.js`, `src/sim/world.js`, `src/sim/orders.js`, `src/data/phase.js`
- Test: `tests/fremen-saboteur.test.mjs`

**Interfaces:**
- Consumes: `exitTile(world, s, moveClass)` (spawn.js), `findTarget(…, { ignoreFog, exclude })`, `orderAttack(world, units, cmd)`, `damage`, `onTheMove`, `killUnit`.
- Produces: `UNITS.fremen` (`autonomous`, `hunts`, `colour: 'fremen'`); `UNITS.saboteur.sabotage = true`; `FREMEN`, `SABOTEUR` tuning; palace.js `updateHunters(world)` plus the Fremen and Saboteur launches; specials.js `orderSabotage(world, houseId, units, structureId)`, `updateSabotage(world, u)`; `beside(u, s)` exported from capture.js; command `{ type: 'sabotage', ids, structureId }`; order `{ type: 'sabotage', structureId, tries }`; events `fremenRose { id, house, x, y }`, `sabotageOrdered`, `unitDestroyed` with `cause: 'detonated'`; eva keys `fremenArrived`, `saboteurReady`. `saboteur` leaves `DEFERRED`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/fremen-saboteur.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { UNITS } from '../src/data/units.js';
import { killUnit } from '../src/sim/combat.js';
import { beside } from '../src/sim/capture.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

const units = (world, typeId) => [...world.units.values()].filter((u) => u.typeId === typeId);
function charged(house) {
  const world = flatWorld(40, 30, G.ROCK);
  const s = world.spawnStructure('palace', house, 2, 2);
  s.readyAt = 0;
  return { world, s };
}

test('five Fremen squads rise from the sand near the chosen spot and fight for the caller on their own', () => {
  const { world, s } = charged('atreides');
  const m = world.map;
  for (let y = 12; y <= 18; y++) for (let x = 0; x < m.w; x++) m.ground[m.idx(x, y)] = G.SAND;
  m.revision++;
  world.issue('atreides', { type: 'palace', x: 20, y: 10 });   // on rock: the nearest sand is two tiles south
  world.step();
  const fremen = units(world, 'fremen');
  assert.equal(fremen.length, 5);
  for (const u of fremen) {
    assert.equal(u.house, 'atreides');
    assert.ok(m.isSand(m.idx(u.tx, u.ty)) && Math.max(Math.abs(u.tx - 20), Math.abs(u.ty - 10)) <= 8, `${u.tx},${u.ty}`);
  }
  assert.ok(UNITS.fremen.autonomous && s.readyAt > world.time + 239);
  world.issue('atreides', { type: 'move', ids: fremen.map((u) => u.id), x: 1, y: 20 });
  run(world, 0.5);
  assert.ok(fremen.every((u) => u.order.type === 'idle'), 'they take no orders');
});

test('Fremen hunt the nearest enemy wherever it is', () => {
  const { world } = charged('atreides');
  const prey = world.spawnUnit('quad', 'harkonnen', 36, 26);
  world.spawnUnit('combatTank', 'harkonnen', 38, 2);
  world.issue('atreides', { type: 'palace', x: 30, y: 20 });
  run(world, 2);
  const fremen = units(world, 'fremen');
  assert.ok(fremen.length > 0 && fremen.every((u) => u.order.type === 'attack' && u.order.target.id === prey.id), JSON.stringify(fremen.map((u) => u.order)));
});

test('the Saboteur walks out beside the Palace and takes orders', () => {
  const { world, s } = charged('ordos');
  world.issue('ordos', { type: 'palace' });
  world.step();
  const [sab] = units(world, 'saboteur');
  assert.ok(sab && sab.house === 'ordos' && beside(sab, s));
  assert.ok(s.readyAt > world.time + 239);
  world.issue('ordos', { type: 'move', ids: [sab.id], x: 20, y: 20 });
  world.step();
  assert.equal(sab.order.type, 'move');
});

test('a Saboteur sent into an enemy building crosses the walls round it and blows it up', () => {
  const world = flatWorld(30, 20);
  for (let x = 18; x <= 24; x++) for (const y of [6, 11]) world.spawnStructure('wall', 'harkonnen', x, y);
  for (let y = 7; y <= 10; y++) for (const x of [18, 24]) world.spawnStructure('wall', 'harkonnen', x, y);
  const factory = world.spawnStructure('heavyFactory', 'harkonnen', 20, 8);
  const sab = world.spawnUnit('saboteur', 'ordos', 5, 9);
  world.issue('ordos', { type: 'sabotage', ids: [sab.id], structureId: factory.id });
  assert.ok(runUntil(world, () => !world.units.has(sab.id), 40) > 0, 'it got there');
  assert.ok(!world.structures.has(factory.id), 'and the factory is gone');
  assert.ok(world.events.drain().some((e) => e.type === 'unitDestroyed' && e.id === sab.id && e.cause === 'detonated'));
  assert.equal(world.houses.get('ordos').stats.unitsLost, 0, 'a Saboteur that did its job is not a loss');
});

test('a Saboteur shot down still goes off: 300 round where it fell', () => {
  const world = flatWorld(20, 12);
  const sab = world.spawnUnit('saboteur', 'ordos', 5, 5);
  const near = world.spawnUnit('combatTank', 'harkonnen', 6, 5);
  killUnit(world, sab, { house: 'harkonnen', id: near.id, kind: 'unit' });
  assert.equal(near.hp, near.maxHp - 150);
});

test('walls and own buildings are no work for a Saboteur', () => {
  const world = flatWorld(20, 12);
  const sab = world.spawnUnit('saboteur', 'ordos', 5, 5);
  const wall = world.spawnStructure('wall', 'harkonnen', 9, 5);
  const own = world.spawnStructure('windtrap', 'ordos', 12, 5);
  for (const s of [wall, own]) world.issue('ordos', { type: 'sabotage', ids: [sab.id], structureId: s.id });
  world.step();
  assert.equal(sab.order.type, 'idle');
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/fremen-saboteur.test.mjs`
Expected: FAIL — `beside` is not exported from capture.js; the `palace` command is rejected for Atreides and Ordos; `UNITS.fremen` is undefined.

- [ ] **Step 3: Implement**

Append to `src/data/tuning.js`:
```js

export const FREMEN = { squads: 5, reach: 8 };   // five squads rise from the sand within eight tiles of the chosen spot
export const SABOTEUR = { blast: 500, splash: 300, radius: 1.5 };   // into the building it reaches; round it (also when it is killed)
```

In `src/data/units.js`: add `sabotage: true` to the end of the `saboteur` row, and after the `troopers` row add
```js
  fremen:      { name: 'Fremen', houses: [], builtAt: null, upgrade: 0, cost: 0, buildTime: 0, hp: 110, move: MOVE.FOOT, speed: 10, turn: 3, turret: false, weapon: 'trooperRocket', damage: 5, range: 5, fireDelay: 50, firesTwice: true, targetAir: true, sight: 1, figures: 3, autonomous: true, hunts: true, colour: 'fremen' },   // called by the Atreides Palace: Trooper-class, no orders, hunt on their own
```

In `src/sim/capture.js` change `const beside = ` to `export const beside = `.

In `src/sim/palace.js`: extend the header comment's last sentence to `… A launch that cannot happen keeps the charge. The Fremen rise from the sand near the chosen spot and hunt on their own; the Saboteur walks out beside the Palace.`; replace the imports with
```js
import { HOUSES } from '../data/houses.js';
import { MOVE } from '../data/units.js';
import { PALACE, DEATH_HAND, FREMEN } from '../data/tuning.js';
import { splash } from './aftermath.js';
import { findTarget } from './combat.js';
import { orderAttack } from './orders.js';
import { exitTile } from './spawn.js';
```
change the launch table in `orderPalace` to
```js
  const launch = { deathHand: launchDeathHand, fremen: callFremen, saboteur: sendSaboteur }[weapon];
```
and append:
```js

/** Five Fremen squads rise from the sand near the chosen spot (anywhere on the map). */
function callFremen(world, s, x, y) {
  const spots = risingSpots(world, x, y), map = world.map;
  if (!spots.length) { eva(world, s.house, 'cannotDeploy', 'The Fremen cannot reach that place.'); return false; }
  for (let k = 0; k < FREMEN.squads && spots.length; k++) {
    const i = spots.splice(world.rng.int(spots.length), 1)[0];
    const u = world.spawnUnit('fremen', s.house, map.xOf(i), map.yOf(i), { heading: world.rng.range(0, Math.PI * 2) });
    world.events.push('fremenRose', { id: u.id, house: s.house, x: u.x, y: u.y });
  }
  eva(world, s.house, 'fremenArrived', 'The Fremen have come.');
  return true;
}

/** Free sand near (x, y), nearest rings first; open ground if there is no sand within reach. */
function risingSpots(world, x, y) {
  const map = world.map, sand = [], ground = [], want = FREMEN.squads * 2;
  for (let r = 0; r <= FREMEN.reach && sand.length < want; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !map.inBounds(x + dx, y + dy)) continue;
      const i = map.idx(x + dx, y + dy);
      if (map.unit[i] || map.structure[i] || map.moveFactor(i, MOVE.FOOT) === 0) continue;
      (map.isSand(i) ? sand : ground).push(i);
    }
  }
  return sand.length ? sand : ground.slice(0, want);
}

/** One Saboteur walks out beside the Palace, the player's to command. */
function sendSaboteur(world, s) {
  const spot = exitTile(world, s, MOVE.SABOTEUR);
  if (!spot) { eva(world, s.house, 'cannotDeploy', 'No room for the Saboteur by the Palace.'); return false; }
  world.spawnUnit('saboteur', s.house, spot.x, spot.y, { heading: Math.PI / 2 });
  eva(world, s.house, 'saboteurReady', 'Saboteur ready.');
  return true;
}

/** Fremen hunt on their own (spec §4.7): an idle warrior goes after the nearest enemy anywhere on the map. */
export function updateHunters(world) {
  for (const u of world.units.values()) {
    if (!u.type.hunts || u.inside || u.order.type !== 'idle' || u.target) continue;
    const exclude = u.abandoned && world.time < u.abandoned.until ? u.abandoned.id : 0;   // not straight back to what it gave up on
    const t = findTarget(world, u.house, u.x, u.y, Infinity, { ignoreFog: true, exclude });
    if (t) orderAttack(world, [u], { targetKind: t.kind, targetId: t.id });
  }
}
```

In `src/sim/specials.js`: add a header line `// Saboteurs walk into an enemy building (over its walls) and blow it up; one that is killed goes off where it falls.`; replace the imports with
```js
import { DEVIATOR, DESTRUCT, SABOTEUR } from '../data/tuning.js';
import { deviatable, killUnit, damage, onTheMove } from './combat.js';
import { splash } from './aftermath.js';
import { transferUnit, beside } from './capture.js';
import { stopUnit } from './orders.js';
```
and append:
```js

const GIVE_UP_TRIES = 8;

/** Saboteurs sent into an enemy building (never a wall: they walk over those). */
export function orderSabotage(world, houseId, units, structureId) {
  const s = world.structures.get(structureId);
  if (!s || s.house === houseId || s.type.isWall) return;
  const ids = [];
  for (const u of units) {
    if (!u.type.sabotage) continue;
    stopUnit(u);
    u.order = { type: 'sabotage', structureId: s.id, tries: 0 };
    u.target = null;
    u.aiming = false;
    ids.push(u.id);
  }
  if (ids.length) world.events.push('sabotageOrdered', { ids, structureId: s.id, house: houseId });
}

/** A Saboteur on its way (runs before movement): beside the building it goes off, else it walks on. */
export function updateSabotage(world, u) {
  const o = u.order, s = world.structures.get(o.structureId);
  if (!s || s.house === u.house) { stopUnit(u); return; }   // gone, or taken by a friend
  if (onTheMove(u)) return;
  if (beside(u, s)) { detonate(world, u, s); return; }
  const goal = ++o.tries > GIVE_UP_TRIES ? -1 : approachTile(world, u, s);
  if (goal < 0) { stopUnit(u); world.events.push('moveFailed', { id: u.id }); return; }
  world.requestPath(u, goal);
}

/** The nearest free tile touching the building that the Saboteur can stand on (a wall will do). */
function approachTile(world, u, s) {
  const map = world.map;
  let best = -1, bestD = Infinity;
  for (let y = s.y - 1; y <= s.y + s.h; y++) for (let x = s.x - 1; x <= s.x + s.w; x++) {
    if (!map.inBounds(x, y) || (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)) continue;
    const i = map.idx(x, y);
    if (map.moveFactor(i, u.move) <= 0 || (map.unit[i] && map.unit[i] !== u.id)) continue;
    const d = Math.hypot(x - u.tx, y - u.ty);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** 500 into the building and the blast round it; the Saboteur is spent, not lost. */
function detonate(world, u, s) {
  const by = { house: u.house, id: u.id, kind: 'unit' };
  world.removeUnit(u, 'detonated');
  world.events.push('unitDestroyed', { id: u.id, typeId: u.typeId, house: u.house, x: u.x, y: u.y, by: null, cause: 'detonated' });
  damage(world, s, SABOTEUR.blast, by);
  splash(world, u.x, u.y, SABOTEUR.splash, SABOTEUR.radius, by, 'large');
}
```

In `src/sim/aftermath.js`: add `SABOTEUR` to the tuning import; update the header's first sentence to `… Trikes, Missile Tanks, Harvesters and MCVs blow up and hurt what stands close, and a Saboteur always goes off;`; in `aftermathOfUnit`, before `if (!u.isGround)`:
```js
  if (u.type.sabotage) { splash(world, u.x, u.y, SABOTEUR.splash, SABOTEUR.radius, { house: u.house, id: u.id, kind: 'unit' }, 'large'); return; }   // its charge goes off where it falls
```

In `src/sim/world.js`: add `updateSabotage` to the `./specials.js` import and `updateHunters` to the `./palace.js` import; in the per-unit loop after the capture line:
```js
      if (u.order.type === 'sabotage') { updateSabotage(this, u); if (!this.units.has(u.id)) continue; }   // a Saboteur that went off is gone
```
and in `step()` after the palaces line:
```js
    if (this.tick % 20 === 15) updateHunters(this);
```

In `src/sim/orders.js`: import `orderSabotage` with `orderDestruct` from `./specials.js`, and add the case
```js
    case 'sabotage': orderSabotage(world, houseId, units, cmd.structureId); return;
```

In `src/data/phase.js` remove `'saboteur', `.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/fremen-saboteur.test.mjs tests/palace.test.mjs tests/capture.test.mjs tests/walls.test.mjs`
Expected: PASS.

- [ ] **Step 5: Full suite and commit**

Run: `npm test > "$WS/test.log" 2>&1; tail -5 "$WS/test.log"` — Expected: all pass.
```bash
git add src/sim/palace.js src/sim/specials.js src/data/units.js src/data/tuning.js src/sim/aftermath.js src/sim/capture.js src/sim/world.js src/sim/orders.js src/data/phase.js tests/fremen-saboteur.test.mjs
git commit -m "feat(sim): the Fremen rise and hunt; the Saboteur blows up what it reaches

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Models — Palace, Saboteur, Fremen, Death Hand; the Devastator's warning glow

**Files:**
- Create: `src/render/models/structures/palace.js`, `src/render/models/units/death-hand.js`
- Modify: `src/render/models/units/infantry.js`, `src/render/models/units/devastator.js`, `src/render/models/index.js`, `src/render/views/unit-views.js`, `src/scenes/gallery.js`, `src/scenes/structures.js`
- Test: `tests/models-catalog.test.mjs`, `tests/views.test.mjs` (appended)

**Interfaces:**
- Consumes: `UNITS.fremen.colour`, `u.destructAt`, `map.wall`.
- Produces: model ids `palace`, `saboteur`, `fremen`, `deathHandMissile`; `STRUCTURE_MODEL.palace`, `UNIT_MODEL.saboteur`, `UNIT_MODEL.fremen`; the Devastator's `warn` scale node (rest value 0) driven by the `warn` param; unit tint `HOUSES[u.type.colour ?? u.house]`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/models-catalog.test.mjs`:
```js

test('the Palace, the Saboteur, the Fremen and the Death Hand have real models', () => {
  assert.equal(STRUCTURE_MODEL.palace, 'palace');
  assert.equal(UNIT_MODEL.saboteur, 'saboteur');
  assert.equal(UNIT_MODEL.fremen, 'fremen');
  for (const id of ['palace', 'saboteur', 'fremen', 'deathHandMissile']) assert.ok(modelDef(id).parts.length > 0, id);
  assert.ok(modelDef('saboteur').nodes.legL && modelDef('fremen').nodes.legR, 'they walk');
  const warn = modelDef('devastator').nodes.warn;
  assert.ok(warn && warn.kind === 'scale' && warn.value === 0, 'the Destruct glow is hidden until it counts down');
});
```

Append to `tests/views.test.mjs`:
```js

import { HOUSES } from '../src/data/houses.js';
import { runUntil } from './helpers.mjs';

test('Fremen wear their sand colour whoever calls them; a Devastator counting down glows', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const views = new UnitViews(new THREE.Scene(), new Heightfield(world.map, { sub: 2, seed: 1 }));
  const f = world.spawnUnit('fremen', 'atreides', 3, 3);
  const d = world.spawnUnit('devastator', 'harkonnen', 8, 8);
  views.sync(world, 1, 0.016);
  assert.equal(views.views.get(f.id).handles[0].color.getHex(), new THREE.Color(HOUSES.fremen.color).getHex());
  assert.equal(views.views.get(d.id).handles[0].params.warn, 0);
  world.issue('harkonnen', { type: 'destruct', ids: [d.id] });
  world.step();
  views.sync(world, 1, 0.016);
  assert.ok(views.views.get(d.id).handles[0].params.warn > 0);
});

test('a Saboteur crossing a wall walks on top of it', () => {
  const world = flatWorld(12, 6, G.ROCK);
  world.spawnStructure('wall', 'harkonnen', 5, 2);
  const sab = world.spawnUnit('saboteur', 'ordos', 3, 2);
  world.issue('ordos', { type: 'move', ids: [sab.id], x: 5, y: 2 });
  assert.ok(runUntil(world, () => sab.tx === 5 && !sab.step, 15) > 0);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new UnitViews(new THREE.Scene(), hf);
  views.sync(world, 1, 0.016);
  const y = pos(views.views.get(sab.id).handles[0].matrix).y;
  assert.ok(Math.abs(y - (hf.heightAt(5.5, 2.5) + 0.364)) < 0.01, `y ${y}`);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/models-catalog.test.mjs tests/views.test.mjs`
Expected: FAIL — `STRUCTURE_MODEL.palace` is undefined; the Fremen are tinted Atreides blue; `params.warn` is undefined; the Saboteur stands at ground height.

- [ ] **Step 3: Implement**

**File: `src/render/models/structures/palace.js`**
```js
// Palace (3x3): a sand-stone palace on a stepped plinth — a great golden onion dome over the hall, four
// corner towers with smaller domes, and an ornate gold gate between house banners (spec §5.3).
import { ModelBuilder, MAT, box, cyl, lathe } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

/** An onion dome of radius r: swelling out, then drawn up into a point (height 1.72 r). */
const onion = (r) => [[0, 0], [r * 0.82, 0], [r * 1.08, r * 0.38], [r, r * 0.78], [r * 0.62, r * 1.12], [r * 0.24, r * 1.42], [0.001, r * 1.72]];

export function palace() {
  const b = new ModelBuilder('palace');
  slab(b, 3, 3);
  b.add(MAT.PAINT, box(2.7, 0.14, 2.7, { p: [0, 0.12, 0], color: PAL.adobeDark }));
  b.add(MAT.PAINT, box(2.1, 0.5, 1.9, { p: [0, 0.44, -0.1], color: PAL.adobe }));
  b.add(MAT.PAINT, box(2.16, 0.06, 1.96, { p: [0, 0.72, -0.1], color: PAL.sandLight }));
  b.add(MAT.PAINT, cyl(0.5, 0.56, 0.24, 24, { p: [0, 0.87, -0.1], color: PAL.adobe }));
  b.add(MAT.METAL, lathe(onion(0.5), 24, { p: [0, 0.99, -0.1], color: PAL.gold }));
  b.add(MAT.METAL, cyl(0.012, 0.022, 0.22, 6, { p: [0, 1.96, -0.1], color: PAL.gold }));
  for (const [x, z] of [[-1.15, -1.15], [1.15, -1.15], [-1.15, 1.15], [1.15, 1.15]]) {
    b.add(MAT.PAINT, cyl(0.2, 0.24, 0.95, 16, { p: [x, 0.66, z], color: PAL.adobe }));
    b.add(MAT.PAINT, cyl(0.23, 0.23, 0.05, 16, { p: [x, 1.15, z], color: PAL.sandLight }));
    b.add(MAT.METAL, lathe(onion(0.19), 16, { p: [x, 1.17, z], color: PAL.gold }));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      b.add(MAT.LIGHT, box(0.05, 0.1, 0.012, { p: [x + Math.cos(a) * 0.215, 0.86, z + Math.sin(a) * 0.215], r: [0, -a + Math.PI / 2, 0], color: PAL.orangeGlow, glow: 1.4 }));
    }
  }
  b.add(MAT.METAL, box(0.52, 0.52, 0.08, { p: [0, 0.45, 0.86], color: PAL.gold }));
  b.add(MAT.DARK, box(0.34, 0.38, 0.09, { p: [0, 0.38, 0.87], color: PAL.gunmetal }));
  b.add(MAT.METAL, lathe(onion(0.15), 12, { p: [0, 0.71, 0.86], color: PAL.gold }));
  for (const x of [-0.42, 0.42]) b.add(MAT.HOUSE, box(0.14, 0.34, 0.02, { p: [x, 0.5, 0.87] }));
  for (const x of [-0.8, -0.55, 0.55, 0.8]) b.add(MAT.LIGHT, box(0.1, 0.14, 0.012, { p: [x, 0.5, 0.86], color: PAL.orangeGlow, glow: 1.2 }));
  beacon(b, 1.15, 1.53, 1.15);
  return b.build({ radius: 1.6 });
}
```

**File: `src/render/models/units/death-hand.js`**
```js
// The Death Hand: a long white ballistic missile with a red warhead, a house band and four fins; it
// lies along +x like every unit model (the flight view and the Palace weapon icon use it).
import { ModelBuilder, MAT, cyl, cone, box } from '../kit.js';
import { PAL } from '../palette.js';

export function deathHandMissile() {
  const b = new ModelBuilder('deathHandMissile');
  const along = [0, 0, -Math.PI / 2];   // cylinders stand on y: lay them along +x
  b.add(MAT.PAINT, cyl(0.07, 0.07, 0.62, 16, { r: along, color: PAL.white }));
  b.add(MAT.PAINT, cone(0.07, 0.2, 16, { p: [0.41, 0, 0], r: along, color: PAL.rocketRed }));
  b.add(MAT.HOUSE, cyl(0.072, 0.072, 0.08, 16, { p: [0.18, 0, 0], r: along }));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    b.add(MAT.PAINT, box(0.16, 0.012, 0.1, { p: [-0.27, Math.cos(a) * 0.1, Math.sin(a) * 0.1], r: [a - Math.PI / 2, 0, 0], color: PAL.steelDark }));
  }
  b.add(MAT.LIGHT, cyl(0.05, 0.035, 0.05, 12, { p: [-0.335, 0, 0], r: along, color: PAL.orangeGlow, glow: 3 }));
  return b.build({ radius: 0.5 });
}
```

Replace `src/render/models/units/infantry.js` with:
```js
// Infantry figures: stillsuit soldier with mask and red goggles; bulkier armoured trooper with a
// shoulder rocket launcher; the Ordos Saboteur, slim and dark with a satchel charge; robed Fremen with
// the blue-within-blue eyes. Squads draw three figures per unit.
import { ModelBuilder, MAT, box, cyl, sphere } from '../kit.js';
import { PAL } from '../palette.js';

function figure(name, { scale = 1, body = PAL.cloth, legs = PAL.cloth, head = PAL.cloth, pack = PAL.clothDark, eyes = PAL.redGlow, gear = 'rifle', robe = null } = {}) {
  const b = new ModelBuilder(name);
  const k = scale * 1.35;   // exaggerated like every RTS so figures read at battle zoom
  const hip = 0.085 * k, torso = 0.07 * k;
  b.node('legL', { pivot: [0, hip, 0.022 * k], axis: 'z' });
  b.node('legR', { pivot: [0, hip, -0.022 * k], axis: 'z' });
  for (const n of ['legL', 'legR']) {
    b.add(MAT.PAINT, box(0.03 * k, 0.075 * k, 0.028 * k, { p: [0, -0.04 * k, 0], color: legs }), n);
    b.add(MAT.DARK, box(0.04 * k, 0.014 * k, 0.03 * k, { p: [0.006, -0.08 * k, 0], color: PAL.clothDark }), n);
  }
  if (robe) b.add(MAT.PAINT, cyl(0.032 * k, 0.05 * k, 0.07 * k, 10, { p: [0, hip - 0.012 * k, 0], color: robe }));   // a robe over the hips
  b.add(MAT.PAINT, box(0.045 * k, torso, 0.07 * k, { p: [0, hip + torso / 2, 0], color: body }));
  b.add(MAT.HOUSE, box(0.05 * k, torso * 0.55, 0.074 * k, { p: [0.002, hip + torso * 0.6, 0] }));
  b.add(MAT.PAINT, sphere(0.022 * k, 10, { p: [0.004, hip + torso + 0.022 * k, 0], color: head }));
  b.add(MAT.DARK, box(0.016, 0.016, 0.03, { p: [0.022 * k, hip + torso + 0.016 * k, 0], color: PAL.mask }));
  b.add(MAT.LIGHT, box(0.004, 0.006, 0.026, { p: [0.025 * k, hip + torso + 0.027 * k, 0], color: eyes, glow: 1.2 }));
  b.add(MAT.PAINT, box(0.03 * k, 0.05 * k, 0.05 * k, { p: [-0.032 * k, hip + torso * 0.55, 0], color: pack }));
  for (const side of [1, -1]) b.add(MAT.PAINT, box(0.05, 0.018, 0.018, { p: [0.025, hip + torso * 0.55, side * 0.04 * k], r: [0, side * 0.3, 0], color: body }));
  if (gear === 'launcher') {
    b.add(MAT.METAL, cyl(0.016, 0.016, 0.1, 8, { p: [0, hip + torso + 0.01, -0.045], r: [0, 0, Math.PI / 2], color: PAL.steelDark }));
    b.add(MAT.HOUSE, box(0.03, 0.03, 0.03, { p: [-0.05, hip + torso + 0.01, -0.045] }));
    b.add(MAT.METAL, cyl(0.008, 0.008, 0.07, 6, { p: [0.05, hip + torso * 0.5, 0.02], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }));
  } else if (gear === 'charge') {
    b.add(MAT.METAL, box(0.05, 0.012, 0.012, { p: [0.04, hip + torso * 0.5, 0.01], color: PAL.gunmetal }));   // a pistol
    b.add(MAT.DARK, box(0.024 * k, 0.03 * k, 0.04 * k, { p: [-0.048 * k, hip + torso * 0.3, 0], color: PAL.oliveDark }));   // the satchel charge
    b.add(MAT.LIGHT, sphere(0.006, 6, { p: [-0.06 * k, hip + torso * 0.45, 0], color: PAL.redGlow, glow: 3 }));
  } else {
    b.add(MAT.METAL, box(0.1, 0.012, 0.012, { p: [0.05, hip + torso * 0.5, 0.01], color: PAL.gunmetal }));
  }
  return b.build({ radius: 0.12 * k, muzzle: [0.1, hip + torso * 0.5, 0] });
}

export const soldier = () => figure('soldier');
export const trooper = () => figure('trooper', { scale: 1.12, body: PAL.sand, legs: PAL.sandDark, head: PAL.sandDark, gear: 'launcher' });
export const saboteur = () => figure('saboteur', { scale: 0.95, body: 0x2c2f36, legs: 0x23252b, head: 0x23252b, pack: 0x3a2e24, eyes: PAL.greenGlow, gear: 'charge' });
export const fremen = () => figure('fremen', { scale: 1.06, body: 0x9a7b52, legs: 0x7b6143, head: 0x8a6d49, eyes: PAL.blueGlow, gear: 'launcher', robe: 0x8e7048 });
```
(The soldier and trooper keep exactly their former geometry: same scale, colours and gear.)

In `src/render/models/units/devastator.js`: import `sphere` too (`import { ModelBuilder, MAT, box, rbox, cyl, prism, sphere } from '../kit.js';`), change the header to `// Devastator: huge armoured tank with hull-fixed twin plasma cannons, glowing reactor vents and red warning lights for Destruct.`, and before `return b.build(…)` add
```js
  b.node('warn', { pivot: [0, top + 0.16, 0], kind: 'scale', value: 0 });   // Destruct: hidden until it counts down
  for (const [x, z] of [[0.12, -0.2], [0.12, 0.2], [-0.3, -0.2], [-0.3, 0.2], [0.3, 0]]) b.add(MAT.LIGHT, sphere(0.035, 8, { p: [x, 0, z], color: PAL.redGlow, glow: 3 }), 'warn');
```

In `src/render/models/index.js`: import `{ soldier, trooper, saboteur, fremen }` from `./units/infantry.js`, `{ deathHandMissile }` from `./units/death-hand.js`, `{ palace }` from `./structures/palace.js`; add `saboteur, fremen, deathHandMissile` to the unit part of `BUILDERS` and `palace` to the structure part; in `UNIT_MODEL` change `saboteur: 'soldier'` to `saboteur: 'saboteur'` and add `fremen: 'fremen'`; in `STRUCTURE_MODEL` add `palace: 'palace'` after `ix: 'houseOfIX'`.

In `src/render/views/unit-views.js`:
- Add constants under `PAD_LIFT`:
```js
const WALL_TOP = 0.36;    // a Saboteur crossing a wall walks on top of it
const tint = (u) => HOUSES[u.type.colour ?? u.house]?.color ?? 0xffffff;   // Fremen keep their sand colour
```
- In `create`: `const color = new THREE.Color(HOUSES[u.house]?.color ?? 0xffffff);` → `const color = new THREE.Color(tint(u));`
- In `pose`, the recolour line `v.color.set(HOUSES[u.house]?.color ?? 0xffffff);` → `v.color.set(tint(u));`
- In `sync`, first line: `this.clock = (this.clock ?? 0) + dt;`
- Replace `const lift = u.alt ?? (u.inside ? PAD_LIFT : 0);   // flying, …` with
```js
    let lift = u.alt ?? (u.inside ? PAD_LIFT : 0);   // flying, hanging under a Carryall, or on a repair pad
    if (u.move === 'saboteur' && world) {   // up and over walls
      const top = (i) => (world.map.wall[i] ? WALL_TOP : 0), s = u.step;
      lift = s ? top(s.from) + (top(s.to) - top(s.from)) * Math.min(1, s.progress) : top(world.map.idx(u.tx, u.ty));
    }
```
- In the per-handle params, after `p.clawsB = -p.claws;`:
```js
      p.warn = u.destructAt !== undefined ? 1.2 + 0.4 * Math.sin(this.clock * 18) : 0;   // Destruct: red lights pulse
```

Scenes:
- `src/scenes/gallery.js`: after the flying-row line add
```js
  place('saboteur', 2.2, 6.6, heading);
  place('fremen', 3.4, 6.6, heading, 3);
```
- `src/scenes/structures.js`: append `['palace', 16, 9]` to `LAYOUT`.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/models-catalog.test.mjs tests/views.test.mjs tests/icons.test.mjs tests/models-kit.test.mjs`
Expected: PASS (the footprint test covers the Palace inside 3 × 3).

- [ ] **Step 5: Full suite, a look, and commit**

Run: `npm test > "$WS/test.log" 2>&1; tail -5 "$WS/test.log"` — Expected: all pass.
Run: `node scripts/smoke.mjs structures-atreides gallery-ordos gallery-closeup` and look at the screenshots — the Palace domes, gate and towers read clearly; the Saboteur and the Fremen stand beside the other infantry.
```bash
git add src/render/models src/render/views/unit-views.js src/scenes/gallery.js src/scenes/structures.js tests/models-catalog.test.mjs tests/views.test.mjs
git commit -m "feat(render): Palace, Saboteur, Fremen and Death Hand models; Destruct lights

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The Palace weapon button, aiming, Sabotage and Destruct in the interface

**Files:**
- Modify: `src/ui/sidebar-model.js`, `src/ui/sidebar.js`, `src/ui/styles.css`, `src/input/controller.js`, `src/ui/cursors.js`, `src/ui/selection-panel.js`, `src/render/icons.js`, `src/scenes/icons.js`, `src/game/game-view.js`, `src/game/debug.js`
- Test: `tests/sidebar-model.test.mjs`, `tests/controller.test.mjs`, `tests/selection-panel.test.mjs`, `tests/icons.test.mjs` (appended)

**Interfaces:**
- Consumes: `palaceOf`, `palaceWeapon`, `palaceReady`, `PALACE`, command `palace`, `sabotage`, `destruct`, `u.deviated`, `u.destructAt`.
- Produces: `sidebarModel(...).special = { weapon, icon: 'palace:<weapon>', name, ready, progress, seconds, aim } | null`; `tipText(item)` and `clock(seconds)` from sidebar-model.js; Sidebar option `onSpecial(special)`; controller mode `{ kind: 'palace' }`; cursors `target`, `sabotage`; panel button `destruct`; `palaceIconKey(key)` from icons.js; debug `weaponRect()`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/sidebar-model.test.mjs`:
```js

import { tipText } from '../src/ui/sidebar-model.js';

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
```

Append to `tests/controller.test.mjs`:
```js

test('the Palace weapon aims where the player clicks; the aim ends if the Palace falls', () => {
  const { world, c, issued, cursors } = setup();
  const s = world.spawnStructure('palace', 'atreides', 1, 12);
  s.readyAt = 0;
  c.setMode({ kind: 'palace' });
  c.frame();
  assert.equal(cursors.at(-1), 'target');
  c.onClick(px(12), px(5), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'palace', x: 12, y: 5 });
  assert.equal(c.mode, null);
  c.setMode({ kind: 'palace' });
  c.onClick(px(3), px(3), 2, NONE, false);
  assert.equal(c.mode, null, 'right click cancels');
  assert.equal(issued.length, 1);
  c.setMode({ kind: 'palace' });
  world.removeStructure(s);
  c.frame();
  assert.equal(c.mode, null, 'no Palace, no aim');
});

test('a Saboteur clicked onto an enemy building goes in to blow it up while the rest attack; the cursor shows a bomb', () => {
  const { world, tank, c, issued, cursors } = setup();
  const sab = world.spawnUnit('saboteur', 'atreides', 3, 8);
  const silo = world.spawnStructure('silo', 'harkonnen', 12, 9);
  c.selection.set([sab.id, tank.id]);
  c.onMove(px(12), px(9));
  c.frame();
  assert.equal(cursors.at(-1), 'sabotage');
  c.onClick(px(12), px(9), 0, NONE, false);
  assert.deepEqual(issued.at(-2), { type: 'sabotage', ids: [sab.id], structureId: silo.id });
  assert.deepEqual(issued.at(-1), { type: 'attack', ids: [tank.id], targetKind: 'structure', targetId: silo.id, force: false });
});
```

Append to `tests/selection-panel.test.mjs`:
```js

import { deviate } from '../src/sim/specials.js';

test('a Devastator offers Destruct on D and says when it is counting down', () => {
  const world = flatWorld(12, 12, G.ROCK);
  const dev = world.spawnUnit('devastator', 'harkonnen', 3, 3);
  const sel = new Selection();
  sel.set([dev.id]);
  assert.deepEqual(selectionPanelModel(world, sel, 'harkonnen').buttons.map((b) => [b.id, b.key]), [['stop', 'S'], ['guard', 'G'], ['scatter', 'X'], ['destruct', 'D']]);
  world.issue('harkonnen', { type: 'destruct', ids: [dev.id] });
  world.step();
  const m = selectionPanelModel(world, sel, 'harkonnen');
  assert.deepEqual([m.buttons, m.details], [[], ['Self-destructing']]);
});

test('a deviated unit says whose it was and when it goes back; Fremen hunt; a Saboteur on its way says so', () => {
  const world = flatWorld(24, 12, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 3, 3);
  deviate(world, { house: 'ordos', x: 3.5, y: 3.5 });
  const sel = new Selection();
  sel.set([tank.id]);
  assert.deepEqual(selectionPanelModel(world, sel, 'ordos').details, ['Deviated · back to Atreides in 40 s', 'Idle']);
  const f = world.spawnUnit('fremen', 'atreides', 8, 3);
  sel.set([f.id]);
  const fm = selectionPanelModel(world, sel, 'atreides');
  assert.deepEqual([fm.details, fm.buttons], [['Hunting'], []]);
  const sab = world.spawnUnit('saboteur', 'ordos', 12, 3);
  const trap = world.spawnStructure('windtrap', 'harkonnen', 18, 3);
  world.issue('ordos', { type: 'sabotage', ids: [sab.id], structureId: trap.id });
  world.step();
  sel.set([sab.id]);
  assert.deepEqual(selectionPanelModel(world, sel, 'ordos').details, ['Moving in to sabotage']);
});
```

Append to `tests/icons.test.mjs`:
```js

import { palaceIconKey } from '../src/render/icons.js';

test('Palace weapon icon keys name the weapon', () => {
  assert.deepEqual(palaceIconKey('palace:deathHand'), { weapon: 'deathHand' });
  assert.deepEqual(palaceIconKey('palace:fremen'), { weapon: 'fremen' });
  assert.equal(palaceIconKey('palace:nuke'), null);
  assert.equal(palaceIconKey('palace'), null);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/sidebar-model.test.mjs tests/controller.test.mjs tests/selection-panel.test.mjs tests/icons.test.mjs`
Expected: FAIL — `tipText` and `palaceIconKey` are not exported, `special` is undefined, the palace mode issues nothing, no Destruct button.

- [ ] **Step 3: Implement**

`src/ui/sidebar-model.js`:
- Header: add `, the Palace weapon with its charge` after `radar availability`.
- Imports: add `PALACE` to the tuning import and `import { palaceOf, palaceWeapon } from '../sim/palace.js';`.
- Before `sidebarModel` add:
```js
/** The Palace weapon (spec §4.7): what it is, how far it has charged, whether it needs a target. */
function specialOf(world, houseId) {
  const s = palaceOf(world, houseId), weapon = palaceWeapon(houseId), full = PALACE.recharge[weapon];
  if (!s || !full) return null;
  const left = Math.max(0, s.readyAt - world.time);
  return { weapon, icon: `palace:${weapon}`, name: PALACE.names[weapon], ready: left === 0, progress: 1 - left / full, seconds: Math.ceil(left), aim: weapon !== 'saboteur' };
}
```
- In the returned object, after `radar: …,` add `special: specialOf(world, houseId),`.
- After `rollCredits` add:
```js

export const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** The line under an icon's name in its tooltip. */
export function tipText(item) {
  if (item.weapon) return item.ready ? `Ready — ${item.aim ? 'click, then pick a target' : 'click to send it out'}` : `Charging — ready in ${clock(item.seconds)}`;
  if (item.state === 'ready') return 'Ready — click to place';
  return [`Cost ${item.cost} · ${item.seconds} s`, item.note].filter(Boolean).join(' · ');
}
```

`src/ui/sidebar.js`:
- Header: after `…Repair and Sell toggles` add `, the Palace weapon (a charging clock; click, then aim)`; and `The tooltip follows what it describes while the pointer rests on it.`
- `import { rollCredits, tipText, clock } from './sidebar-model.js';`
- Constructor signature: `constructor(root, { iconFor, onCommand, onPlace, onTool, onSpecial = () => {} })` and `Object.assign(this, { iconFor, onCommand, onPlace, onTool, onSpecial });`
- In the template, right after the `sb-tools` div:
```html
      <button class="sb-item sb-weapon" hidden><img alt="" draggable="false"><span class="sb-state"></span></button>
```
- After `this.tip = …`:
```js
    this.weapon = el.querySelector('.sb-weapon');
    this.weaponImg = this.weapon.querySelector('img');
    this.weaponState = this.weapon.querySelector('.sb-state');
    this.weapon.addEventListener('click', () => { if (this.weapon.item?.ready) this.onSpecial(this.weapon.item); });
    this.weapon.addEventListener('pointerenter', () => this.showTip(this.weapon));
    this.weapon.addEventListener('pointerleave', () => this.hideTip());
    this.tipFor = null;
```
- `setTool(kind)`: add `this.weapon.classList.toggle('aiming', kind === 'palace');`
- `update(model, dt)`: after the two `fill` calls:
```js
    this.showSpecial(model.special);
    if (this.tipFor?.isConnected && this.tipFor.item) this.showTip(this.tipFor);   // prices, stock and clocks change under the pointer
    else if (this.tipFor) this.hideTip();
```
- In `makeButton`: `b.addEventListener('pointerleave', () => this.tip.classList.remove('show'));` → `b.addEventListener('pointerleave', () => this.hideTip());`
- Add methods:
```js
  showSpecial(sp) {
    const b = this.weapon;
    b.hidden = !sp;
    b.item = sp;
    if (!sp) return;
    if (b.dataset.icon !== sp.icon) { b.dataset.icon = sp.icon; this.weaponImg.src = this.iconFor(sp.icon); this.weaponImg.alt = sp.name; }
    b.classList.toggle('state-ready', sp.ready);
    b.classList.toggle('state-building', !sp.ready);
    const p = sp.ready ? '1' : sp.progress.toFixed(3);
    if (b.style.getPropertyValue('--p') !== p) b.style.setProperty('--p', p);
    const label = sp.ready ? 'READY' : clock(sp.seconds);
    if (this.weaponState.textContent !== label) this.weaponState.textContent = label;
  }

  hideTip() {
    this.tipFor = null;
    this.tip.classList.remove('show');
  }
```
- Replace `showTip(b)` with:
```js
  showTip(b) {
    this.tipFor = b;
    const i = b.item;
    this.tip.querySelector('b').textContent = i.name;
    this.tip.querySelector('span').textContent = tipText(i);
    this.tip.style.top = `${b.getBoundingClientRect().top - this.el.getBoundingClientRect().top}px`;
    this.tip.classList.add('show');
  }
```

Append to `src/ui/styles.css`:
```css
.sb-weapon { height: 64px; flex: none; }
.sb-weapon[hidden] { display: none; }
.sb-weapon img { object-fit: contain; background: radial-gradient(#3a2a18, #1a120a); }
.sb-weapon.aiming { border-color: #ff4a36; box-shadow: 0 0 10px rgba(255, 74, 54, .6); }
```

`src/input/controller.js`:
- `import { palaceOf, palaceReady } from '../sim/palace.js';`
- In `modeClick`, after the right-click line:
```js
    if (this.mode.kind === 'palace') {   // the Palace weapon goes where the player clicks (spec §4.7)
      const hit = this.hitTest(x, y);
      this.setMode(null);
      if (!hit) return;
      const tx = hit.kind === 'unit' ? hit.unit.tx : hit.tx, ty = hit.kind === 'unit' ? hit.unit.ty : hit.ty;
      this.issue({ type: 'palace', x: tx, y: ty });
      this.onMarker(tx + 0.5, ty + 0.5);
      return;
    }
```
- In `frame()`, after the place-mode block:
```js
    if (this.mode?.kind === 'palace' && !palaceReady(this.world, palaceOf(this.world, this.house))) this.setMode(null);   // it fired, or the Palace fell
```
- In `cursorFor`, first line inside `if (this.mode) {`: `if (this.mode.kind === 'palace') return 'target';`
- In `order()`: change `const units = this.ownSelected();` to `let units = this.ownSelected();`; move `const armed = …` below the new block; right after the `enemy` line insert:
```js
    if (hit.kind === 'structure' && enemy && !mods.ctrl && !entity.type.isWall && units.some((u) => u.type.sabotage)) {   // Saboteurs go in; the rest carry on
      this.issue({ type: 'sabotage', ids: units.filter((u) => u.type.sabotage).map((u) => u.id), structureId: entity.id });
      units = units.filter((u) => !u.type.sabotage);
      if (!units.length) return;
    }
    const armed = units.filter((u) => isArmed(u.type));
```
(the order of lines becomes: deploy shortcut, `entity`, `enemy`, the Saboteur block, `armed`, the capture block, …)
- In `cursorFor`'s structure branch, before the capture line:
```js
      if (own.length && s?.house !== this.house && !s.type.isWall && own.some((u) => u.type.sabotage)) return 'sabotage';
```

`src/ui/cursors.js` — add to `CURSORS`:
```js
  target: svg(`<g fill='none' stroke='#000' stroke-width='4' opacity='.5'><circle cx='16' cy='16' r='11'/><circle cx='16' cy='16' r='4'/></g><g fill='none' stroke='#ffd24a' stroke-width='2'><circle cx='16' cy='16' r='11'/><circle cx='16' cy='16' r='4'/><path d='M16 1v8M16 23v8M1 16h8M23 16h8'/></g>`, 16, 16),
  sabotage: svg(`<circle cx='14' cy='19' r='9' fill='#1d1408' stroke='#ffd24a' stroke-width='2'/><path d='M19 12l4-4' stroke='#ffd24a' stroke-width='2.5'/><path d='M23 8l3-2M24 9l3 1M22 6l1-3' stroke='#ff4a36' stroke-width='1.6'/>`, 14, 19),
```

`src/ui/selection-panel.js`:
- Header: `Stop / Guard / Scatter / Deploy / Destruct / Return`.
- `import { HOUSES } from '../data/houses.js';`
- `ORDER_TEXT`: add `sabotage: 'Moving in to sabotage'`.
- `unitButtons`: `own = own.filter((u) => !u.type.autonomous);` → `own = own.filter((u) => !u.type.autonomous && u.destructAt === undefined);   // Carryalls, Fremen and a Devastator counting down take no orders`; after the Deploy line: `if (own.some((u) => u.type.destructs)) b.push({ id: 'destruct', label: 'Destruct', key: 'D' });`
- `unitText`: first lines
```js
  if (u.destructAt !== undefined) return 'Self-destructing';
  if (u.type.hunts) return 'Hunting';
```
- In the single-unit branch, after the harvest detail:
```js
    if (u.deviated) details.push(`Deviated · back to ${HOUSES[u.deviated.from]?.name ?? 'its side'} in ${Math.max(0, Math.ceil(u.deviated.until - world.time))} s`);
```

`src/render/icons.js`:
- Before `export class IconFactory` add:
```js
const PALACE_ICON = { deathHand: 'deathHandMissile', fremen: 'fremen', saboteur: 'saboteur' };

/** 'palace:<weapon>' → the Palace weapon it names, or null. */
export function palaceIconKey(key) {
  const m = /^palace:(\w+)$/.exec(key);
  return m && PALACE_ICON[m[1]] ? { weapon: m[1] } : null;
}
```
- In `forItem`: first line becomes `const color = HOUSES[UNITS[typeId]?.colour ?? houseId]?.color ?? 0xffffff;   // Fremen keep their sand colour`, and before the upgrade lookup:
```js
    const pw = palaceIconKey(typeId);
    if (pw) return this.get(PALACE_ICON[pw.weapon], pw.weapon === 'fremen' ? HOUSES.fremen.color : color, UNIT_ICON_YAW);
```

`src/scenes/icons.js`: append `'palace:deathHand', 'palace:fremen', 'palace:saboteur'` to the icon list.

`src/game/game-view.js`:
- Sidebar options: add `onSpecial: click((special) => (special.aim ? this.controller.setMode({ kind: 'palace' }) : world.issue(house, { type: 'palace' }))),`
- `panelAction`: `['stop', 'guard', 'scatter', 'deploy']` → `['stop', 'guard', 'scatter', 'deploy', 'destruct']`.

`src/game/debug.js`: add `weaponRect: () => rect(document.querySelector('.sidebar .sb-weapon')),` after `toolRect`.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/sidebar-model.test.mjs tests/controller.test.mjs tests/selection-panel.test.mjs tests/icons.test.mjs`
Expected: PASS.

- [ ] **Step 5: Full suite, a look, and commit**

Run: `npm test > "$WS/test.log" 2>&1; tail -5 "$WS/test.log"` — Expected: all pass.
Run: `node scripts/smoke.mjs icons-harkonnen icons-atreides` — the three Palace weapon icons render (missile, robed Fremen in sand brown, dark Saboteur).
```bash
git add src/ui src/input/controller.js src/render/icons.js src/scenes/icons.js src/game/game-view.js src/game/debug.js tests/sidebar-model.test.mjs tests/controller.test.mjs tests/selection-panel.test.mjs tests/icons.test.mjs
git commit -m "feat(ui): Palace weapon button and aiming; Sabotage and Destruct orders; live tooltips

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Effects and sounds

**Files:**
- Create: `src/render/views/missile-views.js`
- Modify: `src/render/effects.js`, `src/game/game-view.js`, `src/audio/cues.js`, `src/audio/synth.js`
- Test: `tests/effects.test.mjs`, `tests/cues.test.mjs`, `tests/synth.test.mjs`, `tests/views.test.mjs` (appended)

**Interfaces:**
- Consumes: projectile kinds `sonic`, `gas`, `deathHand`; events `deathHandBlast`, `fremenRose`, `unitReverted`, `destructArmed`, `unitDestroyed` (`cause: 'destructed'`), eva `notReady`.
- Produces: `Effects#sonic(x, y, z, dir)`, `#gasCloud`, `#shockwave`, `#rise`, trails `gas` and `deathHand`; `arcHeight(kind, t, total)` and `MissileViews` from missile-views.js; synth recipes `sonic`, `gas`, `alarm`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/effects.test.mjs`:
```js

test('the sonic wave, Deviator gas and the Death Hand each have their own look, within the budget', () => {
  const fx = new Effects(new THREE.Scene(), { particles: 400, flashLights: 0 });
  const count = () => fx.glow.n + fx.smoke.n;
  const looks = { sonic: () => fx.sonic(0, 0, 0, 0), gasTrail: () => fx.trail('gas', 0, 0, 0), gasCloud: () => fx.impact(0, 0, 0, 'gas', false), deathHand: () => fx.trail('deathHand', 0, 0, 0), shockwave: () => fx.shockwave(0, 0, 0), rise: () => fx.rise(0, 0, 0) };
  for (const [name, make] of Object.entries(looks)) {
    const before = count();
    make();
    assert.ok(count() > before, name);
  }
  assert.ok(fx.glow.n <= fx.glow.capacity && fx.smoke.n <= fx.smoke.capacity);
});
```

Append to `tests/cues.test.mjs`:
```js

test('specials have their own sounds: sonic hum, gas hiss, the Destruct alarm; a weapon not ready buzzes', () => {
  assert.equal(cueFor({ type: 'fired', weapon: 'sonic', projectile: 'sonic', x: 0, y: 0 }, 'atreides', all).id, 'sonic');
  assert.equal(cueFor({ type: 'fired', weapon: 'gasRocket', projectile: 'gas', x: 0, y: 0 }, 'atreides', all).id, 'rocket');
  assert.equal(cueFor({ type: 'fired', weapon: 'deathHand', projectile: 'deathHand', x: 0, y: 0 }, 'atreides', all).id, 'rocket');
  assert.equal(cueFor({ type: 'impact', projectile: 'gas', x: 0, y: 0 }, 'atreides', all).id, 'gas');
  assert.equal(cueFor({ type: 'destructArmed', house: 'harkonnen', x: 0, y: 0 }, 'atreides', all).id, 'alarm');
  assert.equal(cueFor({ type: 'eva', house: 'atreides', key: 'notReady' }, 'atreides', all).id, 'error');
});
```

Append to `tests/synth.test.mjs`:
```js

test('the specials\' sounds are there: sonic hum, gas hiss, Destruct alarm', () => {
  for (const id of ['sonic', 'gas', 'alarm']) assert.ok(RECIPES[id] && render(id).length > 0, id);
});
```

Append to `tests/views.test.mjs`:
```js

import { MissileViews, arcHeight } from '../src/render/views/missile-views.js';

test('the Death Hand flies as a missile high over its path and is gone when it lands', () => {
  assert.equal(arcHeight('bullet', 0.5, 10), 0);
  assert.ok(arcHeight('rocket', 0.5, 10) > 0 && arcHeight('rocket', 0.5, 10) <= 1.2);
  assert.ok(arcHeight('deathHand', 0.5, 30) >= 10 && arcHeight('deathHand', 0, 30) === 0);
  const views = new MissileViews(new THREE.Scene());
  const world = { projectiles: new Map([[1, { id: 1, projectile: 'deathHand', house: 'harkonnen', x: 10, y: 5, px: 10, py: 5, sx: 5, sy: 5, tx: 15, ty: 5 }]]) };
  views.sync(world, 1, () => 0);
  assert.ok(pos(views.handles.get(1).matrix).y > 3, 'high over the midpoint');
  world.projectiles.delete(1);
  views.sync(world, 1, () => 0);
  assert.equal(views.handles.size, 0);
  assert.equal(views.model.count, 0);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/effects.test.mjs tests/cues.test.mjs tests/synth.test.mjs tests/views.test.mjs`
Expected: FAIL — `fx.sonic` is not a function, the sonic cue is `heavyCannon`, recipes missing, missile-views.js missing.

- [ ] **Step 3: Implement**

`src/render/effects.js`:
- Header: after `…impacts, explosions, smoke and flames` add `, the sonic ripple, Deviator gas and the Death Hand's trail and shockwave`.
- In `trail`, insert before `} else if (kind === 'shell')`:
```js
    } else if (kind === 'gas') {
      this.smoke.emit({ x, y, z, vx: rnd(-0.08, 0.08), vy: rnd(0.05, 0.2), vz: rnd(-0.08, 0.08), life: rnd(0.5, 0.9), size: [0.12, 0.45], color: [0.4, 0.75, 0.3], alpha: [0.5, 0], drag: 1 });
      this.glow.emit({ x, y, z, life: 0.06, size: [0.2, 0.1], color: [2.5, 6, 1.5], alpha: [1, 0] });
    } else if (kind === 'deathHand') {
      this.glow.emit({ x, y, z, life: 0.1, size: [0.5, 0.2], color: [9, 5, 2], alpha: [1, 0] });
      for (let k = 0; k < 2; k++) this.smoke.emit({ x, y, z, vx: rnd(-0.15, 0.15), vy: rnd(0, 0.2), vz: rnd(-0.15, 0.15), life: rnd(1.5, 2.5), size: [0.25, 1.1], color: [0.8, 0.78, 0.74], alpha: [0.6, 0], drag: 0.8 });
```
(the `rocket` branch ends with `}` before this `else if`; keep the chain intact.)
- In `impact`, first line: `if (kind === 'gas') { this.gasCloud(x, y, z); return; }`
- Add methods after `weld`:
```js
  /** The sonic wave's front: a pale shimmer across its path, drifting on. */
  sonic(x, y, z, dir) {
    const sx = -Math.sin(dir), sz = Math.cos(dir);
    for (let k = -2; k <= 2; k++) this.glow.emit({ x: x + sx * k * 0.16, y: y + rnd(-0.05, 0.05), z: z + sz * k * 0.16, vx: Math.cos(dir) * 0.6, vz: Math.sin(dir) * 0.6, life: 0.3, size: [0.22, 0.55], color: [0.7, 0.95, 1.5], alpha: [0.45, 0] });
  }

  /** Deviator gas bursting: a green cloud that lingers. */
  gasCloud(x, y, z) {
    for (let k = 0; k < 16; k++) this.smoke.emit({ x: x + rnd(-0.3, 0.3), y, z: z + rnd(-0.3, 0.3), vx: rnd(-0.7, 0.7), vy: rnd(0.1, 0.4), vz: rnd(-0.7, 0.7), life: rnd(1.6, 2.6), size: [0.4, 1.6], color: [0.33, 0.8, 0.2], color2: [0.55, 0.72, 0.4], alpha: [0.6, 0], drag: 1.2 });
  }

  /** Where the Death Hand comes down: a ring of dust racing outward and a white-hot flash. */
  shockwave(x, y, z) {
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      this.smoke.emit({ x, y, z, vx: Math.cos(a) * 7, vy: 0.2, vz: Math.sin(a) * 7, life: 0.9, size: [0.4, 1.4], color: [0.8, 0.66, 0.46], alpha: [0.55, 0], drag: 2.5 });
    }
    this.glow.emit({ x, y: y + 0.3, z, life: 0.35, size: [2, 6], color: [8, 5, 2.5], alpha: [1, 0] });
    this.flash(x, y, z, 14);
  }

  /** Fremen rising out of the sand. */
  rise(x, y, z) {
    for (let k = 0; k < 5; k++) this.dust(x + rnd(-0.3, 0.3), y, z + rnd(-0.3, 0.3), 1.3);
  }
```

**File: `src/render/views/missile-views.js`**
```js
// Shots with a body (spec §5.4): the Death Hand rides its ballistic arc as a missile model, nose along its
// path. arcHeight is the one arc the trails and the model share.
import { HOUSES } from '../../data/houses.js';
import { InstancedModel } from '../models/instancer.js';
import { modelDef } from '../models/index.js';
import { poseMatrix } from './pose.js';

/** Height above the straight line at fraction t of a flight `total` tiles long: rockets arc a little, the Death Hand climbs high. */
export function arcHeight(kind, t, total) {
  if (kind === 'deathHand') return 4 * t * (1 - t) * Math.max(3, total * 0.4);
  if (kind === 'rocket' || kind === 'gas') return 4 * t * (1 - t) * Math.min(1.2, 0.15 + total * 0.06);
  return 0;
}

export class MissileViews {
  constructor(scene) {
    this.scene = scene;
    this.model = null;
    this.handles = new Map();
  }

  sync(world, alpha, heightAt, seen = () => true) {
    for (const p of world.projectiles.values()) {
      if (p.projectile !== 'deathHand') continue;
      let h = this.handles.get(p.id);
      if (!h) {
        this.model ??= new InstancedModel(modelDef('deathHandMissile'), this.scene);
        h = this.model.add();
        h.color.set(HOUSES[p.house]?.color ?? 0xffffff);
        this.handles.set(p.id, h);
      }
      const x = p.px + (p.x - p.px) * alpha, z = p.py + (p.y - p.py) * alpha;
      const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1, t = Math.min(1, Math.hypot(x - p.sx, z - p.sy) / total);
      const rise = (arcHeight('deathHand', Math.min(1, t + 0.01), total) - arcHeight('deathHand', Math.max(0, t - 0.01), total)) / (0.02 * total);
      const pitch = Math.atan(rise), heading = Math.atan2(p.ty - p.sy, p.tx - p.sx);
      poseMatrix(h.matrix, x, heightAt(x, z) + 0.5 + arcHeight('deathHand', t, total), z, heading,
        { x: -Math.cos(heading) * Math.sin(pitch), y: Math.cos(pitch), z: -Math.sin(heading) * Math.sin(pitch) });   // nose up the climb, down the fall
      h.visible = seen(x, z);
    }
    for (const [id, h] of this.handles) if (!world.projectiles.has(id)) { this.model.remove(h); this.handles.delete(id); }
    this.model?.update();
  }
}
```

`src/game/game-view.js`:
- `import { MissileViews, arcHeight } from '../render/views/missile-views.js';`; in the constructor after `this.effects = …`: `this.missiles = new MissileViews(r3d.scene);`
- `onEvent` switch — add cases:
```js
      case 'deathHandBlast':
        if (!this.catchingUp && this.seen(e.x, e.y)) { this.effects.shockwave(e.x, this.heightAt(e.x, e.y) + 0.2, e.y); this.rig.shake = Math.max(this.rig.shake, 1.2); }
        break;
      case 'fremenRose': if (!this.catchingUp && this.seen(e.x, e.y)) this.effects.rise(e.x, this.heightAt(e.x, e.y) + 0.05, e.y); break;
      case 'unitReverted': if (!this.catchingUp && this.seen(e.x, e.y)) this.effects.gasCloud(e.x, this.heightAt(e.x, e.y) + 0.3, e.y); break;
```
  and extend the `unitDestroyed` case with `if (!this.catchingUp && e.cause === 'destructed' && this.seen(e.x, e.y)) this.rig.shake = Math.max(this.rig.shake, 0.6);`.
- `onFired`: replace the last line `this.effects.muzzle(x, this.heightAt(x, z) + lift, z, big);` with
```js
    if (e.projectile === 'sonic') this.effects.sonic(x, this.heightAt(x, z) + lift, z, dir);
    else this.effects.muzzle(x, this.heightAt(x, z) + lift, z, big);
```
- `combatEffects`: replace the projectile loop body after the `seen` check with
```js
      const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1;
      const t = Math.min(1, Math.hypot(x - p.sx, z - p.sy) / total);
      const from = 0.35 + (p.fromAlt ?? 0), to = 0.2 + (p.toAlt ?? 0);   // from a flying gun, up to an aircraft
      const y = this.heightAt(x, z) + from + (to - from) * t + arcHeight(p.projectile, t, total);
      if (p.projectile === 'sonic') this.effects.sonic(x, y, z, Math.atan2(p.ty - p.sy, p.tx - p.sx));
      else this.effects.trail(p.projectile, x, y, z);
```
- `frame()`: after `this.combatEffects(dt, alpha);` add `this.missiles.sync(world, alpha, this.heightAt, (x, z) => this.seen(x, z));`

`src/audio/cues.js`:
- In `WEAPON`, change `sonic: 'heavyCannon'` to `sonic: 'sonic'`.
- Add `const LAUNCH = new Set(['rocket', 'gas', 'deathHand']);   // shots that whoosh away` and add `'notReady'` to `ERRORS`.
- `fired`: `return at(LAUNCH.has(e.projectile) ? 'rocket' : WEAPON[e.weapon] ?? 'rifle', e.x, e.y);`
- `impact`: `return e.projectile === 'rocket' ? at('explosionSmall', e.x, e.y) : e.projectile === 'gas' ? at('gas', e.x, e.y) : e.projectile === 'shell' ? at('hit', e.x, e.y) : null;`
- New case: `case 'destructArmed': return at('alarm', e.x, e.y);`

`src/audio/synth.js` — add to `RECIPES` (before `static`):
```js
  sonic: () => {   // the Sonic Tank: a deep warbling hum that swells and fades
    const a = mix([[tone(0.7, 110, 70), 1], [tone(0.7, 220, 150, 'triangle'), 0.5], [tone(0.7, 55, 50), 0.8]]);
    for (let i = 0; i < a.length; i++) a[i] *= 0.6 + 0.4 * Math.sin(i / 180);
    return normalize(envelope(a, 0.08, 1.4), 0.8);
  },
  gas: () => normalize(envelope(lowpass(highpass(noise(0.9, 40), 900), 5200, 2400), 0.05, 1.8), 0.5),   // Deviator gas hissing out
  alarm: () => normalize(mix([0, 1, 2].map((k) => [envelope(tone(0.22, 700, 1100, 'square'), 0.01, 1.2), 0.5, k * 0.3])), 0.4),   // a Devastator about to go
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/effects.test.mjs tests/cues.test.mjs tests/synth.test.mjs tests/views.test.mjs tests/sound-engine.test.mjs`
Expected: PASS.

- [ ] **Step 5: Full suite and commit**

Run: `npm test > "$WS/test.log" 2>&1; tail -5 "$WS/test.log"` — Expected: all pass.
```bash
git add src/render/effects.js src/render/views/missile-views.js src/game/game-view.js src/audio/cues.js src/audio/synth.js tests/effects.test.mjs tests/cues.test.mjs tests/synth.test.mjs tests/views.test.mjs
git commit -m "feat(fx): sonic ripple, gas clouds, the Death Hand in flight; sonic, gas and alarm sounds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The computer's Palace and specials

**Files:**
- Modify: `src/sim/ai.js`
- Test: `tests/ai-palace.test.mjs`

**Interfaces:**
- Consumes: `palaceOf`, `palaceReady`, `palaceWeapon`; commands `palace`, `sabotage`.
- Produces: `ARMY_WEIGHTS` (exported) with `sonicTank`, `devastator`, `deviator`; `richestTarget(world, houseId) → { x, y } | null` (exported); the AI builds a Palace after its House of IX; `brain.palaceAt`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/ai-palace.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { createBrain, ARMY_WEIGHTS, richestTarget } from '../src/sim/ai.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

function aiPalace(house) {
  const world = flatWorld(48, 32, G.ROCK);
  const s = world.spawnStructure('palace', house, 2, 2);
  s.readyAt = 0;
  const brain = createBrain(world, house, 'normal');
  return { world, s, brain };
}

test('the richest spot to hit is where enemy value crowds together', () => {
  const world = flatWorld(48, 32, G.ROCK);
  for (const x of [30, 32, 34]) world.spawnStructure('windtrap', 'atreides', x, 20);
  world.spawnUnit('combatTank', 'atreides', 10, 25);
  world.spawnStructure('windtrap', 'harkonnen', 12, 12);
  assert.deepEqual(richestTarget(world, 'harkonnen'), { x: 33, y: 21 });
  assert.equal(richestTarget(flatWorld(8, 8), 'harkonnen'), null);
});

test('a charged AI Palace fires the Death Hand at the richest enemy spot', () => {
  const { world, s } = aiPalace('harkonnen');
  for (const x of [30, 32, 34]) world.spawnStructure('windtrap', 'atreides', x, 20);
  world.spawnUnit('combatTank', 'atreides', 10, 25);
  let fired = null;
  runUntil(world, () => (fired ??= world.events.drain().find((e) => e.type === 'palaceFired')), 3);
  assert.deepEqual(fired && [fired.house, fired.weapon, fired.x, fired.y], ['harkonnen', 'deathHand', 33, 21]);
  assert.ok(s.readyAt > world.time + 400);
});

test('an Ordos AI sends its Saboteur into the most valuable enemy building', () => {
  const { world } = aiPalace('ordos');
  world.spawnStructure('windtrap', 'atreides', 20, 5);
  const factory = world.spawnStructure('heavyFactory', 'atreides', 30, 20);
  world.spawnStructure('silo', 'atreides', 10, 10);
  assert.ok(runUntil(world, () => [...world.units.values()].some((u) => u.typeId === 'saboteur' && u.order.type === 'sabotage'), 5) > 0);
  assert.equal([...world.units.values()].find((u) => u.typeId === 'saboteur').order.structureId, factory.id);
});

test('a Palace that cannot fire is not asked again every second', () => {
  const world = flatWorld(48, 32, G.ROCK);
  const s = world.spawnStructure('palace', 'ordos', 0, 0);
  for (let y = 0; y <= 8; y++) for (let x = 0; x <= 6; x++) if (!world.map.structure[world.map.idx(x, y)]) world.spawnStructure('wall', 'ordos', x, y);   // no room for a Saboteur
  s.readyAt = 0;
  createBrain(world, 'ordos', 'normal');
  const tries = [];
  const issue = world.issue.bind(world);
  world.issue = (h, cmd) => { if (cmd.type === 'palace') tries.push(world.time); issue(h, cmd); };
  run(world, 30);
  assert.ok(tries.length >= 1 && tries.length <= 4, `${tries.length} tries in 30 s`);
});

test('Fremen are never drafted into an AI wave', () => {
  const world = flatWorld(48, 32, G.ROCK);
  world.spawnStructure('constructionYard', 'atreides', 2, 2);
  world.spawnStructure('silo', 'harkonnen', 40, 24);
  const fremen = world.spawnUnit('fremen', 'atreides', 10, 10);
  for (let k = 0; k < 4; k++) world.spawnUnit('combatTank', 'atreides', 6 + k, 8);
  const brain = createBrain(world, 'atreides', 'normal');
  brain.nextAttack = 0;
  run(world, 1);
  assert.ok(brain.wave.length === 4 && !brain.wave.includes(fremen.id), JSON.stringify(brain.wave));
});

test('the computer builds a Palace once its House of IX stands, and fields its House special', () => {
  assert.ok(ARMY_WEIGHTS.sonicTank > 0 && ARMY_WEIGHTS.devastator > 0 && ARMY_WEIGHTS.deviator > 0);
  const world = flatWorld(56, 44, G.ROCK);
  const layout = [['constructionYard', 2, 2], ['windtrap', 5, 2], ['windtrap', 8, 2], ['windtrap', 11, 2], ['windtrap', 14, 2], ['windtrap', 17, 2], ['refinery', 2, 6], ['refinery', 6, 6], ['outpost', 10, 6], ['wor', 13, 6], ['lightFactory', 16, 6], ['heavyFactory', 2, 10], ['silo', 6, 10], ['repair', 9, 10], ['hiTech', 13, 10], ['turret', 17, 10], ['turret', 18, 10], ['starport', 2, 14], ['ix', 6, 14]];
  for (const [t, x, y] of layout) world.spawnStructure(t, 'harkonnen', x, y);
  const h = world.houses.get('harkonnen');
  h.credits = 20000;
  h.startBuffer = 40000;
  createBrain(world, 'harkonnen', 'normal');
  assert.ok(runUntil(world, () => [...world.structures.values()].some((s) => s.house === 'harkonnen' && s.typeId === 'palace'), 150) > 0);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/ai-palace.test.mjs`
Expected: FAIL — `ARMY_WEIGHTS` and `richestTarget` are not exported; the AI never fires or builds a Palace.

- [ ] **Step 3: Implement** (all in `src/sim/ai.js`)

- Header: after `Then an army, rally points, base defence and attack waves.` add ` A charged Palace fires at once — the Death Hand and the Fremen at the richest enemy spot, the Saboteur into the most valuable enemy building.`
- `import { palaceOf, palaceReady, palaceWeapon } from './palace.js';`
- After the `DIFFICULTY` table add:
```js
/** Units the AI commands in its army: Fremen hunt on their own and Saboteurs have their own work. */
const fighter = (u) => isArmed(u.type) && !u.type.autonomous && !u.type.sabotage;
```
- In `think`, after `attack(world, house, view);`:
```js
  usePalace(world, house, view);
  sabotage(world, house, view);
```
- In `nextStructure`, replace the Starport/IX block
```js
  if (ixOpensSomething(id) && has('heavyFactory') && has('turret') + has('rocketTurret') >= d.turrets) {   // defences first; the Starport only as the way to IX
    if (!has('starport') && can('starport')) return 'starport';
    if (has('starport') && !has('ix') && can('ix')) return 'ix';
  }
```
with
```js
  if (has('heavyFactory') && has('turret') + has('rocketTurret') >= d.turrets) {   // defences first; the Starport only as the way to IX and the Palace
    if (ixOpensSomething(id) && !has('starport') && can('starport')) return 'starport';
    if (ixOpensSomething(id) && has('starport') && !has('ix') && can('ix')) return 'ix';
    if (has('ix') && !has('palace') && can('palace')) return 'palace';
  }
```
- `const ARMY_WEIGHTS = { ornithopter: 3, …` → `export const ARMY_WEIGHTS = { sonicTank: 3, devastator: 2, deviator: 2, ornithopter: 3, …` (rest unchanged).
- `buildArmy`: `view.units.filter((u) => isArmed(u.type)).length` → `view.units.filter(fighter).length`.
- `defend`: `.filter((u) => isArmed(u.type) && !b.wave.includes(u.id) …` → `.filter((u) => fighter(u) && !b.wave.includes(u.id) …`.
- `attack`: `b.wave = b.wave.filter((id) => world.units.has(id));` → `b.wave = b.wave.filter((id) => world.units.get(id)?.house === house.id);   // lost, or turned by gas`; `const ready = view.units.filter((u) => isArmed(u.type) && …` → `const ready = view.units.filter((u) => fighter(u) && …`.
- Append:
```js

/** The richest spot to hit: enemy buildings and ground units valued at their cost, summed within 2.5 tiles. */
export function richestTarget(world, houseId) {
  const things = [];
  for (const s of world.structures.values()) if (s.house !== houseId && !s.type.isWall) things.push({ x: s.x + s.w / 2, y: s.y + s.h / 2, value: s.type.cost });
  for (const u of world.units.values()) if (u.house !== houseId && u.isGround && !u.inside) things.push({ x: u.x, y: u.y, value: u.type.cost });
  let best = null, bestValue = 0;
  for (const c of things) {
    let v = 0;
    for (const o of things) if (Math.hypot(o.x - c.x, o.y - c.y) <= 2.5) v += o.value;
    if (v > bestValue) { bestValue = v; best = c; }
  }
  return best && { x: Math.floor(best.x), y: Math.floor(best.y) };
}

/** A charged Palace fires at once (spec §4.10); a launch that was refused is tried again after ten seconds. */
function usePalace(world, house, view) {
  const b = house.brain, s = view.mine.find((x) => x.typeId === 'palace');
  if (!palaceReady(world, s) || world.time < (b.palaceAt ?? 0)) return;
  b.palaceAt = world.time + 10;
  if (palaceWeapon(house.id) === 'saboteur') { issue(world, house, { type: 'palace' }); return; }
  const t = richestTarget(world, house.id);
  if (t) issue(world, house, { type: 'palace', x: t.x, y: t.y });
}

/** Saboteurs head for the most valuable enemy building, the nearest of equals. */
function sabotage(world, house, view) {
  for (const u of view.units) {
    if (!u.type.sabotage || u.order.type === 'sabotage') continue;
    let best = null, bestD = Infinity;
    for (const s of world.structures.values()) {
      if (s.house === house.id || s.type.isWall) continue;
      const d = Math.hypot(s.x + s.w / 2 - u.x, s.y + s.h / 2 - u.y);
      if (!best || s.type.cost > best.type.cost || (s.type.cost === best.type.cost && d < bestD)) { best = s; bestD = d; }
    }
    if (best) issue(world, house, { type: 'sabotage', ids: [u.id], structureId: best.id });
  }
}
```
(`palaceOf` is not needed in ai.js; import only `palaceReady, palaceWeapon`.)

- [ ] **Step 4: Run the tests**

Run: `node --test tests/ai-palace.test.mjs tests/ai.test.mjs`
Expected: PASS.

- [ ] **Step 5: Full suite (the soak exercises all of it) and commit**

Run: `npm test > "$WS/test.log" 2>&1; tail -5 "$WS/test.log"` — Expected: all pass, the 15-minute soak included.
```bash
git add src/sim/ai.js tests/ai-palace.test.mjs
git commit -m "feat(ai): the computer builds a Palace, fires it when charged and fields its House special

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Plan 2c minors, showcase scenes, smoke, end-to-end, README

**Files:**
- Modify: `src/sim/starport.js`, `src/data/phase.js`, `src/scenes/base.js`, `src/scenes/battle.js`, `scripts/scenarios.mjs`, `scripts/e2e.mjs`, `README.md`
- Test: `tests/starport.test.mjs`, `tests/data.test.mjs` (appended)

**Interfaces:**
- Consumes: everything above; debug `weaponRect()`.
- Produces: batches move to a standing Starport; `DEFERRED = {'sandworm'}`; base flag `palace=1` (weapon charged, camera on the Palace); battle flag `specials=1`; smoke scenes `base-palace`, `battle-specials`; e2e checks for the Palace weapon and live tooltips.

- [ ] **Step 1: Write the failing tests**

Append to `tests/starport.test.mjs`:
```js

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
```

Append to `tests/data.test.mjs`:
```js

import { DEFERRED } from '../src/data/phase.js';

test('only the sandworm still waits for a later plan', () => {
  assert.deepEqual([...DEFERRED], ['sandworm']);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tests/starport.test.mjs tests/data.test.mjs`
Expected: FAIL — the batch stays on the lost Starport; the cancel after landing is silent; `DEFERRED` still holds `frigate`.

- [ ] **Step 3: Implement**

`src/sim/starport.js`:
- Header: after `One Starport per house.` add ` A batch whose Starport is lost goes to another the house holds (a captured one).`
- In `updateStarports`, right after `const b = m.batch;`:
```js
    if (b && !b.landed && !world.structures.has(b.structureId)) {   // its Starport is gone: another of the house's takes the delivery
      const s = starportOf(world, house.id);
      if (s) { b.structureId = s.id; b.pad = { x: s.x + s.w / 2, y: s.y + s.h / 2 }; }
    }
```
- In `cancelStarport`, replace `if (!b || b.landed) return;` with
```js
  if (!b) return;
  if (b.landed) { eva(world, house, 'busy', 'Unable to comply, the Frigate is unloading.'); return; }
```

`src/data/phase.js`: `DEFERRED` becomes `new Set(['sandworm'])` (keep the comment line above it).

`src/scenes/base.js`:
- Header: add `palace=1 charges the Palace weapon and looks at the Palace;` to the flag list.
- `LAYOUT`: insert `'palace'` after `'ix'`.
- After the Frigate block:
```js
  const pal = [...world.structures.values()].find((s) => s.house === house && s.typeId === 'palace');
  if (pal && params.bool('palace')) {   // the house weapon charged: READY in the sidebar
    pal.readyAt = 0;
    focus = { x: pal.x + 1.5, z: pal.y + 4 };
  }
```

`src/scenes/battle.js`:
- Header: add `specials=1 adds two Atreides Sonic Tanks, a Harkonnen Devastator and an Ordos Deviator gassing from the north.`
- Before the `ticks` loop:
```js
  if (params.bool('specials')) {
    for (const [x, y] of [[4, 9], [4, 15]]) world.spawnUnit('sonicTank', 'atreides', x, y, { heading: 0 });
    world.spawnUnit('devastator', 'harkonnen', 34, 9, { heading: Math.PI });
    world.addHouse('ordos', { credits: 0 });
    world.spawnUnit('deviator', 'ordos', 20, 3, { heading: Math.PI / 2 });
  }
```

`scripts/scenarios.mjs` — add:
```js
  'base-palace': { query: 'scene=base&house=harkonnen&fog=0&palace=1&dist=14', settleMs: 1500 },
  'battle-specials': { query: 'scene=battle&specials=1&dist=24&ticks=140', settleMs: 1500 },
```

`scripts/e2e.mjs`:
- Base page URL: add `&palace=1` (`…&damaged=1&capture=1&palace=1&quality=low…`).
- Right after `if (ware?.visible) await base.click(ware.x, ware.y);` (the Quad purchase), before the landing loop:
```js
  if (ware?.visible) {   // the pointer rests on the ware: its tooltip counts the Frigate down
    await base.mouse('mouseMoved', ware.x, ware.y, { button: 'none', held: 'none' });
    await sleep(300);
    const tipA = await bv(`document.querySelector('.sb-tip span').textContent`);
    await sleep(2500);
    const tipB = await bv(`document.querySelector('.sb-tip span').textContent`);
    check('a tooltip keeps up while the pointer rests on it', /Frigate in/.test(tipA) && tipA !== tipB, `${tipA} → ${tipB}`);
  }
```
- After the Starport check (`check('buying a Quad …')`):
```js
  const pal = (await bv(`__dune.structures('palace')`)).find((s) => s.house === 'atreides');
  await bv(`__dune.lookAt(${pal.x + 1.5}, ${pal.y + 6})`);
  await sleep(500);
  const weapon = await bv('__dune.weaponRect()');
  if (weapon?.visible) await base.click(weapon.x, weapon.y);
  await sleep(250);
  const aiming = (await bv('__dune.mode()')) === 'palace';
  const spot = await bv(`__dune.screenOfTile(${pal.x + 1}, ${pal.y + 6})`);
  await base.click(spot.x, spot.y);
  let fremen = 0;
  for (let i = 0; i < 50 && fremen < 5; i++) { await sleep(200); fremen = (await bv(`__dune.units('fremen')`)).length; }
  check('the Palace button and a click call the Fremen', aiming && fremen === 5, `aiming ${aiming}, ${fremen} Fremen`);
```

`README.md`:
- Status: replace `the House of IX are in; the House of IX specials, sandworms, the Palace, music and announcer voices follow;` with `the House of IX with its specials and the Palace with its weapons are in; sandworms, music and announcer voices follow;`.
- Controls table: `| S · G · X · D | Stop · guard · scatter · deploy |` → `| S · G · X · D | Stop · guard · scatter · deploy (a Devastator: Destruct) |`.
- After the Starport paragraph, add:
```markdown
The House of IX opens each house's special tank. The Atreides Sonic Tank sends a wave eight tiles out
that hurts everything on its path — your own units too — except Sonic Tanks and walls. The Ordos
Deviator's gas turns enemy ground units to your side for 40 seconds (not aircraft, Harvesters or
MCVs). The Harkonnen Devastator is the toughest tank; its Destruct order (D or the panel button) glows
for three seconds, then blows it apart in eight blasts.

The Palace adds its house weapon at the top of the sidebar, with a charging clock. The Harkonnen Death
Hand (every 7 minutes) is a missile that comes down near where you click in 17 blasts; the Atreides
call five Fremen squads out of the sand near where you click (every 4 minutes) — they hunt on their
own; the Ordos get a Saboteur by the Palace (every 4 minutes) that walks over walls and blows up the
building you send it into. The computer uses its Palace as soon as it is charged.
```
- Scenes: after `` `battle` (two armies fighting; `&idle=1` waits for orders, `&ticks=300` skips ahead) `` add ` (`&specials=1` brings in the House of IX tanks)` and after the `base` entry add ` (`&palace=1` charges the Palace)`.

- [ ] **Step 4: Run the tests, smoke and end-to-end**

Run: `node --test tests/starport.test.mjs tests/data.test.mjs` — Expected: PASS.
Run: `npm test > "$WS/test.log" 2>&1; tail -5 "$WS/test.log"` — Expected: all pass.
Run: `npm run smoke > "$WS/smoke.log" 2>&1; tail -5 "$WS/smoke.log"` — Expected: every scene captured with no console errors; look at `base-palace` (Palace with READY weapon button), `battle-specials` (wave, gas, Devastator), `structures-harkonnen`, `gallery-ordos`, `icons-atreides`.
Run: `npm run e2e > "$WS/e2e.log" 2>&1; tail -8 "$WS/e2e.log"` — Expected: `29/29 checks passed`.

- [ ] **Step 5: Commit**

```bash
git add src/sim/starport.js src/data/phase.js src/scenes/base.js src/scenes/battle.js scripts/scenarios.mjs scripts/e2e.mjs README.md tests/starport.test.mjs tests/data.test.mjs
git commit -m "test: Palace and specials showcase, smoke and end-to-end checks; plan 2c minors; README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
