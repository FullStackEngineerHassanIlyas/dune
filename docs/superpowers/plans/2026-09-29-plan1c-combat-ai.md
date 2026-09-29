# Plan 1c — Combat and the computer opponent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Units and turrets fight with the original weapons, units and buildings are destroyed with explosions, a computer opponent deploys, builds a base, harvests and attacks on Easy, Normal or Hard, and a skirmish ends in victory or defeat — the spec's phase-1 result "skirmish against one AI, start to finish" (sound follows in plan 1d).

**Architecture:** New simulation systems in `src/sim/` — `combat.js` (targets, aiming, firing, projectiles, damage, death), `victory.js`, `ai.js`, `announce.js` — run inside `World.step()` in a fixed order and stay deterministic (`world.rng` only). Commands `attack` and `attackMove` join `orders.js`; the controller turns clicks into them. The presentation adds a CPU-simulated GPU particle system (`src/render/effects.js`) fed by combat events, an end screen and pause.

**Tech Stack:** as plans 1a/1b — ES modules, vendored Three.js 0.186.1, Node 24 `node:test`, headless Chrome over CDP.

**Spec:** `docs/superpowers/specs/2026-09-28-dune2-3d-design.md` — §4.6 (combat; the House-of-IX specials, Ornithopter and worm stay in plan 2), §4.4 (turrets at half rate on low power), §4.10 (AI), §4.11 (victory), §5.4 (effects, basic set), §7 (end screen statistics), §10 (combat, victory and AI-vs-AI soak tests), §11 phase 1. Research numbers: `docs/research/raw/units.md` (weapons, projectiles), `structures.md` (turrets), `mechanics-campaign.md` §5 (scatter, splash, crush), §8–9 (stances, AI).

## Global Constraints

- Everything from plans 1a and 1b still holds (no build step, pure deterministic sim under Node, 20 Hz, tile = world unit, headings, `tuning.js` owns conversions, instanced rendering, English text, no original assets, commits with the Co-Authored-By line).
- System order each tick: commands → path queue → per-unit (harvester brain, movement) → combat (units, then structure turrets) → projectiles → production → repairs → power (every 10 ticks) → fog (every 5) → revalidation (every 20) → AI (every 20, at tick ≡ 10 mod 20) → victory (every 20).
- Damage is flat (no armour). Accurate weapons always hit their target; rockets scatter (1 in 16 wildly). Units that fire twice do so only above half health.
- All randomness in `src/sim` comes from `world.rng`; no `Math.random` there.
- The AI acts only through `world.issue` commands, like a player, and may read the whole world (it ignores fog, as in the original).
- The UI never mutates simulation state; it issues commands.
- Particles never exceed the quality preset's `particles` budget; point lights for muzzle flashes are a fixed pool (none on Low) so shaders never recompile mid-game.
- Deferred to plan 1d: all sound, dust/harvest/construction particles, the plan-1b deferred minors. Deferred to plan 2: Deviator, Sonic Tank, Devastator, Ornithopter, Saboteur, Fremen, sandworms, capture, Palace weapons.

## Review Focus

1. **A target that dies, is sold or changes owner while shots are in flight** must never throw; projectiles land and hit whatever stands on the landing tile, or nothing. → Task 2 test "a projectile whose target died lands without error".
2. **Attacking something unreachable** (behind mountains, on an island) must end: the unit gets as close as it can, then gives up and idles instead of re-pathing for ever. → Task 4 test "attacking an unreachable target gives up".
3. **An AI with no credits, no room to build, no Construction Yard or no factories** must not throw or issue commands every tick; it retries at a sane rate and keeps playing with what it has. → Task 10 tests "an AI without room or money does not spam commands" and "an AI that lost its yard carries on".
4. **The game ending while shots are in flight, or both sides losing their last building in the same tick,** yields exactly one outcome (a draw when nobody is left), announced once. → Task 5 test "both sides falling in one tick is a single draw".
5. **Friendly fire** (scattering rockets, exploding vehicles) damages own units and buildings but never counts as a kill for the victim's own house, and tracked vehicles never crush own infantry. → Task 3 tests "friendly fire hurts but never scores" and "tanks crush enemy infantry, never their own".

## File map (new and changed)

```
src/data/weapons.js            weapon and projectile table, shotFor()
src/data/structures.js         turret weapons (gun turret, rocket turret)
src/data/tuning.js             projectile speed, scatter, second shot, splash, guard ranges
src/sim/announce.js            throttled announcer events
src/sim/combat.js              targets, aiming, firing, projectiles, damage, death, turrets, crush
src/sim/victory.js             defeat, outcome, end statistics
src/sim/ai.js                  computer opponent: deploy, economy, base, army, waves, defence
src/sim/orders.js              attack, attackMove commands
src/sim/world.js               combat/projectile/AI/victory systems, hooks
src/sim/movement.js            crush, stop helper
src/game/setup.js              difficulty, AI brains, victory rules
src/render/effects.js          particle pools and effect recipes
src/render/views/unit-views.js recoil on firing
src/ui/end-screen.js           end screen and endStats()
src/input/controller.js        attack clicks, attack-move mode, force fire
src/game/game-view.js          combat events → effects, pause, end screen
src/scenes/battle.js           two armies for screenshots and the e2e attack check
```

---
### Task 1: Weapons and combat tuning

**Files:**
- Create: `src/data/weapons.js`
- Modify: `src/data/structures.js` (turret weapons), `src/data/tuning.js`
- Test: `tests/weapons.test.mjs`

**Interfaces:**
- Consumes: `UNITS` (`weapon`, `damage`, `range`, `fireDelay`, `firesTwice`, `turret`), `STRUCTURES`.
- Produces: `WEAPONS` (`projectile: 'bullet'|'shell'|'rocket'`, `speed`, `accurate`, `homing?`, `far?`); `shotFor(weaponId, dist)` → `{id, projectile, speed, accurate, homing, damageScale}` or `null`; turret fields `STRUCTURES.turret = {…, weapon:'turretGun', damage:20, range:5, fireDelay:80}`, `STRUCTURES.rocketTurret = {…, weapon:'turretRocket', damage:30, range:8, fireDelay:120, near:{weapon:'turretGun', damage:20, range:3, fireDelay:80}}`; tuning `projectileSpeed(speed)` (tiles/s), `SECOND_SHOT_DELAY`, `SCATTER`, `DEATH_SPLASH`, `AIM_TOLERANCE`, `GUARD_RADIUS`, `GUARD_LEASH`, `RETALIATE_RANGE`, `LOW_POWER_TURRET_RATE`, `CHASE_GIVEUP_SECONDS`.

- [ ] **Step 1: Write the failing test**

**File: `tests/weapons.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../src/data/units.js';
import { STRUCTURES } from '../src/data/structures.js';
import { WEAPONS, shotFor } from '../src/data/weapons.js';
import { projectileSpeed, SCATTER } from '../src/data/tuning.js';

test('every armed unit and turret names a known weapon', () => {
  for (const [id, u] of Object.entries(UNITS)) if (u.weapon && u.weapon !== 'swallow') assert.ok(WEAPONS[u.weapon], `${id} → ${u.weapon}`);
  for (const id of ['turret', 'rocketTurret']) {
    const s = STRUCTURES[id];
    assert.ok(WEAPONS[s.weapon] && s.damage > 0 && s.range > 0 && s.fireDelay > 0, id);
  }
  assert.ok(WEAPONS[STRUCTURES.rocketTurret.near.weapon]);
});

test('guns always hit, rockets scatter, the rocket turret homes', () => {
  assert.equal(shotFor('cannon', 3).accurate, true);
  assert.equal(shotFor('rocket', 5).accurate, false);
  assert.deepEqual([shotFor('turretRocket', 6).accurate, shotFor('turretRocket', 6).homing], [true, true]);
  assert.equal(shotFor('nope', 1), null);
  assert.ok(SCATTER.wildChance > 0 && SCATTER.wildChance < 0.1);
});

test('troopers fire bullets up close and weaker, scattering mini-rockets beyond two tiles', () => {
  assert.equal(shotFor('trooperRocket', 2).projectile, 'bullet');
  const far = shotFor('trooperRocket', 4);
  assert.deepEqual([far.projectile, far.accurate, far.damageScale], ['rocket', false, 0.75]);
  assert.equal(Math.round(UNITS.trooper.damage * far.damageScale), 4, '5 → 4 as in the original');
});

test('projectiles cross a screen of battle in well under a second', () => {
  assert.ok(projectileSpeed(WEAPONS.cannon.speed) > 12);
  assert.ok(projectileSpeed(WEAPONS.rocket.speed) > 8 && projectileSpeed(WEAPONS.rocket.speed) < projectileSpeed(WEAPONS.cannon.speed));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/weapons.test.mjs`
Expected: FAIL — cannot find `../src/data/weapons.js`.

- [ ] **Step 3: Implement**

**File: `src/data/weapons.js`**
```js
// Weapons and projectiles (spec §4.6; docs/research/raw/units.md "Projectiles", structures.md
// "Turrets — combat detail"). Units and structures name a weapon here; damage, range and fire delay
// stay on the unit or structure. Accurate weapons always hit their target; the others scatter.
// Deviator gas, the sonic wave and Devastator plasma get their special behaviour in plan 2.
export const WEAPONS = {
  rifle:         { projectile: 'bullet', speed: 250, accurate: true },
  pistol:        { projectile: 'bullet', speed: 250, accurate: true },
  mg:            { projectile: 'bullet', speed: 250, accurate: true },
  cannon:        { projectile: 'shell', speed: 250, accurate: true },
  heavyCannon:   { projectile: 'shell', speed: 250, accurate: true },
  plasma:        { projectile: 'shell', speed: 250, accurate: true },
  sonic:         { projectile: 'shell', speed: 200, accurate: true },
  rocket:        { projectile: 'rocket', speed: 200, accurate: false },
  miniRocket:    { projectile: 'rocket', speed: 180, accurate: false },
  gasRocket:     { projectile: 'rocket', speed: 200, accurate: false },
  trooperRocket: { projectile: 'bullet', speed: 250, accurate: true, far: { beyond: 2, projectile: 'rocket', speed: 180, accurate: false, damageScale: 0.75 } },
  turretGun:     { projectile: 'shell', speed: 250, accurate: true },
  turretRocket:  { projectile: 'rocket', speed: 200, accurate: true, homing: true },
};

/** The shot a weapon makes at `dist` tiles (troopers switch to mini-rockets beyond two tiles). */
export function shotFor(weaponId, dist) {
  const w = WEAPONS[weaponId];
  if (!w) return null;
  const base = { id: weaponId, projectile: w.projectile, speed: w.speed, accurate: w.accurate, homing: !!w.homing, damageScale: 1 };
  return w.far && dist > w.far.beyond ? { ...base, ...w.far, homing: false } : base;
}
```

Modify `src/data/structures.js`:
- in the `turret:` entry, after `conquerable: true` add `, weapon: 'turretGun', damage: 20, range: 5, fireDelay: 80`
- in the `rocketTurret:` entry, after `conquerable: true` add `, weapon: 'turretRocket', damage: 30, range: 8, fireDelay: 120, near: { weapon: 'turretGun', damage: 20, range: 3, fireDelay: 80 }`

Modify `src/data/tuning.js` — append:
```js
/** Projectile speed (original units) → tiles per second: bullets and shells ≈ 16, rockets 11–12.5. */
export function projectileSpeed(speed) { return speed / 16; }
export const SECOND_SHOT_DELAY = 0.35;          // seconds between the two shots of units that fire twice
export const SCATTER = { base: 0.4, perTile: 0.12, wildChance: 1 / 16, wildBase: 1.5, wildPerTile: 0.35 };   // rocket miss radius, tiles
export const DEATH_SPLASH = { damage: 30, radius: 1.6 };   // Trikes, Missile Tanks, Harvesters and MCVs blow up
export const AIM_TOLERANCE = 0.12;              // radians: close enough to fire
export const GUARD_RADIUS = 3;                  // idle and guarding units look this far beyond weapon range …
export const GUARD_LEASH = 6;                   // … and a guard chases at most this far from its post
export const RETALIATE_RANGE = 8;               // idle units answer fire from this close
export const LOW_POWER_TURRET_RATE = 0.5;       // turrets fire at half rate on low power (spec §4.4)
export const CHASE_GIVEUP_SECONDS = 8;          // an attacker that gets no closer for this long gives up
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/weapons.test.mjs && npm test`
Expected: PASS (4 new tests); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/data/weapons.js src/data/structures.js src/data/tuning.js tests/weapons.test.mjs
git commit -m "feat(data): weapon and projectile table, turret weapons, combat tuning

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: Combat core — targets, aiming, firing, projectiles, damage

**Files:**
- Create: `src/sim/combat.js`
- Modify: `src/sim/world.js` (projectiles, combat systems), `src/sim/invariants.js` (projectile check)
- Test: `tests/combat.test.mjs`

**Interfaces:**
- Consumes: `WEAPONS`, `shotFor` and the tuning constants (Task 1); `unitVisibleTo`, `structureVisibleTo` (plan 1b); `world.requestPath`, `world.removeUnit`, `world.removeStructure`, `world.rng`.
- Produces: `isArmed(type)`; `targetPoint(world, target)` → `{x, y, entity}` or `null`; `distanceTo(x, y, target, point)`; `findTarget(world, houseId, x, y, radius, {structures, ignoreFog})` → `{kind, id}` or `null` (walls never auto-targeted; the player's side only sees what its fog shows unless `ignoreFog`); `onTheMove(u)`; `stopMoving(u)`; `damage(world, victim, amount, attacker)`; `killUnit(world, u, attacker, cause)`; `destroyStructure(world, s, attacker)`; `updateCombat(world)`; `updateProjectiles(world)`; `fireAt(world, from, target, point, dist, stats)` (shared with turrets in Task 3). Targets are `{kind:'unit'|'structure'|'tile', id?, x?, y?}`. Unit fields `target`, `cooldown`, `secondShot`, `aiming`, `chaseAt`, `chaseBest`, `chaseStall`. `world.projectiles: Map<id, {id, weapon, projectile, house, sourceId, sourceKind, x, y, px, py, sx, sy, tx, ty, speed, damage, accurate, homing, target}>`. Hooks (optional, set by later tasks): `world.onDamaged(victim, attacker)`, `world.onUnitKilled(u, attacker)`, `world.onStructureKilled(s, attacker)`.
- Stances handled here: `idle` engages within weapon range (no chase); `move` — turreted units fire on the way; `guard {x, y}` engages within range + `GUARD_RADIUS` and chases no further than `GUARD_LEASH` from its post, then walks back; `attackMove {x, y, goal}` engages within range + `GUARD_RADIUS`, chases a little, then resumes towards `goal` and turns idle on arrival; `attack {target, force?}` chases its target and gives up (idle, event `attackAbandoned`) after `CHASE_GIVEUP_SECONDS` without getting closer.
- Events: `fired {id, kind, house, weapon, projectile, x, y, tx, ty}`, `impact {weapon, projectile, x, y, hit}`, `damaged {kind, id, house, by, amount}`, `unitDestroyed {id, typeId, house, x, y, by, cause}`, `structureDestroyed {id, typeId, house, x, y, w, h, by}`, `attackAbandoned {id}`. Stats: `unitsKilled`, `unitsLost`, `structuresKilled`, `structuresLost` (kills never count for the victim's own house).

- [ ] **Step 1: Write the failing tests**

**File: `tests/combat.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

const tough = (u) => { u.hp = u.maxHp = 100000; return u; };

test('an idle tank shoots an enemy in range until it dies, and the kill is counted', () => {
  const world = flatWorld(24, 16, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 8, { heading: 0 });
  const quad = world.spawnUnit('quad', 'harkonnen', 8, 8, { heading: Math.PI });
  assert.ok(runUntil(world, () => !world.units.has(quad.id), 30) > 0, 'the quad was destroyed');
  assert.ok(world.units.has(tank.id), 'the tank survived');
  assert.equal(world.houses.get('atreides').stats.unitsKilled, 1);
  assert.equal(world.houses.get('harkonnen').stats.unitsLost, 1);
  assert.ok(world.events.drain().some((e) => e.type === 'unitDestroyed' && e.id === quad.id && e.by === 'atreides'));
});

test('damage is flat: every tank shell takes exactly 25', () => {
  const world = flatWorld(24, 16, G.ROCK);
  world.spawnUnit('combatTank', 'atreides', 5, 8, { heading: 0 });
  const mcv = world.spawnUnit('mcv', 'harkonnen', 8, 8);
  run(world, 6);
  const hits = world.events.drain().filter((e) => e.type === 'damaged' && e.id === mcv.id);
  assert.ok(hits.length >= 2);
  assert.ok(hits.every((e) => e.amount === 25));
  assert.equal(mcv.hp, 150 - 25 * hits.length);
});

test('units that fire twice do so only above half health', () => {
  const shots = (hpFraction) => {
    const world = flatWorld(24, 16, G.ROCK);
    const quad = world.spawnUnit('quad', 'atreides', 5, 8, { heading: 0 });
    quad.hp = quad.maxHp * hpFraction;
    world.spawnUnit('mcv', 'harkonnen', 7, 8);
    run(world, 10);
    return world.events.drain().filter((e) => e.type === 'fired' && e.id === quad.id).length;
  };
  const healthy = shots(1), hurt = shots(0.4);
  assert.ok(hurt >= 4 && healthy >= 2 * hurt - 1, `healthy ${healthy}, hurt ${hurt}`);
});

test('cannons always hit; rockets scatter and sometimes miss', () => {
  const world = flatWorld(32, 16, G.ROCK);
  world.houses.get('harkonnen').isAI = true;
  world.spawnUnit('missileTank', 'harkonnen', 4, 8, { heading: 0 });
  tough(world.spawnUnit('mcv', 'atreides', 12, 8));
  run(world, 60);
  const rockets = world.events.drain().filter((e) => e.type === 'impact');
  assert.ok(rockets.length >= 20, `${rockets.length} rockets`);
  assert.ok(rockets.some((e) => !e.hit) && rockets.some((e) => e.hit));
  const w2 = flatWorld(24, 16, G.ROCK);
  w2.spawnUnit('combatTank', 'atreides', 5, 8, { heading: 0 });
  tough(w2.spawnUnit('mcv', 'harkonnen', 8, 8));
  run(w2, 20);
  const shells = w2.events.drain().filter((e) => e.type === 'impact');
  assert.ok(shells.length >= 8 && shells.every((e) => e.hit));
});

test('a projectile whose target died lands without error', () => {
  const world = flatWorld(24, 16, G.ROCK);
  world.spawnUnit('combatTank', 'atreides', 5, 8, { heading: 0 });
  const quad = world.spawnUnit('quad', 'harkonnen', 9, 8, { heading: Math.PI });
  assert.ok(runUntil(world, () => world.projectiles.size > 0, 10) >= 0);
  world.removeUnit(quad);
  run(world, 1);
  assert.equal(world.projectiles.size, 0);
  const impacts = world.events.drain().filter((e) => e.type === 'impact');
  assert.ok(impacts.length >= 1 && impacts.every((e) => !e.hit));
});

test('the player\'s units engage only what their fog shows; the AI sees everything', () => {
  const world = flatWorld(32, 16, G.ROCK);
  world.spawnUnit('missileTank', 'atreides', 4, 8, { heading: 0 });
  world.spawnUnit('mcv', 'harkonnen', 12, 8);
  run(world, 5);
  assert.equal(world.events.drain().filter((e) => e.type === 'fired').length, 0, 'eight tiles away is beyond its sight');
  world.houses.get('atreides').isAI = true;
  run(world, 5);
  assert.ok(world.events.drain().some((e) => e.type === 'fired'));
});

test('turreted tanks fire on the move; hull-mounted guns only when standing', () => {
  const shotsWhileDriving = (typeId) => {
    const world = flatWorld(32, 16, G.ROCK);
    const u = world.spawnUnit(typeId, 'atreides', 2, 6, { heading: 0 });
    tough(world.spawnUnit('mcv', 'harkonnen', 12, 8));
    world.issue('atreides', { type: 'move', ids: [u.id], x: 24, y: 6 });
    let fired = 0;
    for (let i = 0; i < 20 * 20; i++) {
      world.step();
      for (const e of world.events.drain()) if (e.type === 'fired' && e.id === u.id && u.order.type === 'move') fired++;
    }
    return fired;
  };
  assert.ok(shotsWhileDriving('combatTank') > 0);
  assert.equal(shotsWhileDriving('quad'), 0);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/combat.test.mjs`
Expected: FAIL — nothing fires (no combat system yet); the projectile test finds `world.projectiles` undefined.

- [ ] **Step 3: Implement combat**

**File: `src/sim/combat.js`**
```js
// Combat (spec §4.6): targets, aiming, firing, projectiles, damage and death. Flat damage, no armour;
// accurate weapons always hit their target, rockets scatter (1 in 16 wildly); units that fire twice do
// so only above half health. Turreted units aim independently and fire on the move; the others turn
// the hull and fire only while standing. Stances: idle units engage what comes into range, guards
// chase no further than their leash, attack-move engages on the way, an attack order chases its
// target and gives up when it gets no closer. The player's side engages only what its fog shows; the
// AI sees everything, as in the original.
import { WEAPONS, shotFor } from '../data/weapons.js';
import { DT, TURN_RATE, TURRET_TURN_RATE, fireDelaySeconds, projectileSpeed, SECOND_SHOT_DELAY, SCATTER, AIM_TOLERANCE, GUARD_RADIUS, GUARD_LEASH, CHASE_GIVEUP_SECONDS } from '../data/tuning.js';
import { angleDiff, turnToward } from './geometry.js';
import { unitVisibleTo, structureVisibleTo } from './fog.js';

const SCAN_TICKS = 4;   // targets are looked for five times a second

export const isArmed = (t) => !!(t && t.weapon && WEAPONS[t.weapon] && t.damage > 0);
export const onTheMove = (u) => !!u.step || u.pathState === 'waiting' || (u.pathState === 'ready' && u.pathIndex < u.path.length);

export function targetPoint(world, t) {
  if (!t) return null;
  if (t.kind === 'unit') { const u = world.units.get(t.id); return u ? { x: u.x, y: u.y, entity: u } : null; }
  if (t.kind === 'structure') { const s = world.structures.get(t.id); return s ? { x: s.x + s.w / 2, y: s.y + s.h / 2, entity: s } : null; }
  return { x: t.x + 0.5, y: t.y + 0.5, entity: null };
}

/** Tiles from (x, y) to a target; structures count from their nearest footprint tile. */
export function distanceTo(x, y, t, p) {
  if (t.kind === 'structure') {
    const s = p.entity;
    const cx = Math.max(s.x + 0.5, Math.min(s.x + s.w - 0.5, x)), cy = Math.max(s.y + 0.5, Math.min(s.y + s.h - 0.5, y));
    return Math.hypot(cx - x, cy - y);
  }
  return Math.hypot(p.x - x, p.y - y);
}

const seesAll = (world, houseId) => { const h = world.houses.get(houseId); return !h || h.isAI || !world.fogOfWar; };
const canSee = (world, houseId, kind, e) => seesAll(world, houseId) || (kind === 'unit' ? unitVisibleTo(world, houseId, e) : structureVisibleTo(world, houseId, e));

export function findTarget(world, houseId, x, y, radius, { structures = true, ignoreFog = false } = {}) {
  let best = null, bestD = Infinity;
  for (const u of world.units.values()) {
    if (u.house === houseId || !u.isGround) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d > radius || d >= bestD || (!ignoreFog && !canSee(world, houseId, 'unit', u))) continue;
    best = { kind: 'unit', id: u.id };
    bestD = d;
  }
  if (!structures) return best;
  for (const s of world.structures.values()) {
    if (s.house === houseId || s.type.isWall) continue;
    const d = distanceTo(x, y, { kind: 'structure' }, { entity: s });
    if (d > radius || d >= bestD - 0.5 || !canSee(world, houseId, 'structure', s)) continue;   // units win close calls: they shoot back
    best = { kind: 'structure', id: s.id };
    bestD = d;
  }
  return best;
}

function validTarget(world, houseId, t, force) {
  if (!t) return false;
  if (t.kind === 'tile') return true;
  const e = t.kind === 'unit' ? world.units.get(t.id) : world.structures.get(t.id);
  if (!e || e.hp <= 0) return false;
  if (t.kind === 'unit' && !e.isGround) return false;   // aircraft arrive in plan 2
  return !!force || e.house !== houseId;
}

/** Stop after the current tile, keeping the order. */
export function stopMoving(u) {
  if (u.pathState === 'waiting') u.pathState = 'none';
  if (u.pathState === 'ready') u.path.length = Math.min(u.path.length, u.pathIndex + (u.step ? 1 : 0));
  u.goal = -1;
  u.pathReached = true;
}

export function fireAt(world, from, t, p, dist, stats) {
  const shot = shotFor(stats.weapon, dist);
  if (!shot) return;
  let ax = p.x, ay = p.y;
  if (!shot.accurate) {
    const wild = world.rng.chance(SCATTER.wildChance);
    const r = (wild ? SCATTER.wildBase + dist * SCATTER.wildPerTile : SCATTER.base + dist * SCATTER.perTile) * world.rng.next();
    const a = world.rng.range(0, Math.PI * 2);
    ax += Math.cos(a) * r;
    ay += Math.sin(a) * r;
  }
  const id = world.nextProjectileId++;
  world.projectiles.set(id, {
    id, weapon: stats.weapon, projectile: shot.projectile, house: from.house, sourceId: from.id, sourceKind: from.kind,
    x: from.x, y: from.y, px: from.x, py: from.y, sx: from.x, sy: from.y, tx: ax, ty: ay,
    speed: projectileSpeed(shot.speed), damage: Math.round(stats.damage * shot.damageScale),
    accurate: shot.accurate, homing: shot.homing, target: shot.accurate && t.kind !== 'tile' ? { kind: t.kind, id: t.id } : null,
  });
  world.events.push('fired', { id: from.id, kind: from.kind, house: from.house, weapon: stats.weapon, projectile: shot.projectile, x: from.x, y: from.y, tx: ax, ty: ay });
}

export function updateProjectiles(world) {
  for (const p of [...world.projectiles.values()]) {
    p.px = p.x;
    p.py = p.y;
    if (p.homing && p.target) { const tp = targetPoint(world, p.target); if (tp) { p.tx = tp.x; p.ty = tp.y; } }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.speed * DT;
    if (d <= step) {
      p.x = p.tx;
      p.y = p.ty;
      world.projectiles.delete(p.id);
      impact(world, p);
      continue;
    }
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
  }
}

function impact(world, p) {
  const map = world.map;
  let victim = p.target ? targetPoint(world, p.target)?.entity ?? null : null;   // an accurate shot hits its target if it still exists
  if (!victim) {
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (map.inBounds(tx, ty)) { const i = map.idx(tx, ty); victim = world.units.get(map.unit[i]) ?? world.structures.get(map.structure[i]) ?? null; }
  }
  world.events.push('impact', { weapon: p.weapon, projectile: p.projectile, x: p.x, y: p.y, hit: !!victim });
  if (victim) damage(world, victim, p.damage, { house: p.house, id: p.sourceId, kind: p.sourceKind });
}

/** Flat damage (no armour). attacker: {house, id, kind} or null. */
export function damage(world, victim, amount, attacker = null) {
  if (!(amount > 0) || victim.hp <= 0) return;
  if (victim.kind === 'unit' ? !world.units.has(victim.id) : !world.structures.has(victim.id)) return;
  victim.hp -= amount;
  world.events.push('damaged', { kind: victim.kind, id: victim.id, house: victim.house, by: attacker?.house ?? null, amount });
  if (victim.hp <= 0) {
    if (victim.kind === 'unit') killUnit(world, victim, attacker);
    else destroyStructure(world, victim, attacker);
    return;
  }
  world.onDamaged?.(victim, attacker);
}

function countLoss(world, victimHouse, attacker, lost, killed) {
  const h = world.houses.get(victimHouse);
  if (h) h.stats[lost]++;
  if (attacker && attacker.house !== victimHouse) { const k = world.houses.get(attacker.house); if (k) k.stats[killed]++; }
}

export function killUnit(world, u, attacker = null, cause = 'destroyed') {
  if (!world.units.has(u.id)) return;
  u.hp = 0;
  world.removeUnit(u, cause);
  countLoss(world, u.house, attacker, 'unitsLost', 'unitsKilled');
  world.events.push('unitDestroyed', { id: u.id, typeId: u.typeId, house: u.house, x: u.x, y: u.y, by: attacker?.house ?? null, cause });
  world.onUnitKilled?.(u, attacker);
}

export function destroyStructure(world, s, attacker = null) {
  if (!world.structures.has(s.id)) return;
  s.hp = 0;
  world.removeStructure(s, 'destroyed');
  countLoss(world, s.house, attacker, 'structuresLost', 'structuresKilled');
  world.events.push('structureDestroyed', { id: s.id, typeId: s.typeId, house: s.house, x: s.x, y: s.y, w: s.w, h: s.h, by: attacker?.house ?? null });
  world.onStructureKilled?.(s, attacker);
}

export function updateCombat(world) {
  for (const u of world.units.values()) if (u.isGround && isArmed(u.type)) unitCombat(world, u);
}

function scanRadius(u) {
  switch (u.order.type) {
    case 'idle': return u.type.range;
    case 'move': return u.type.turret ? u.type.range : 0;
    case 'guard': case 'attackMove': return u.type.range + GUARD_RADIUS;
    default: return 0;
  }
}

function stillWorthIt(world, u, t) {
  if (!validTarget(world, u.house, t, false)) return false;
  const p = targetPoint(world, t);
  if (!canSee(world, u.house, t.kind, p.entity)) return false;
  const o = u.order, d = distanceTo(u.x, u.y, t, p);
  if (o.type === 'guard') return Math.hypot(p.x - o.x - 0.5, p.y - o.y - 0.5) <= GUARD_LEASH + u.type.range;
  if (o.type === 'attackMove') return d <= u.type.range + GUARD_RADIUS + 2;
  return d <= u.type.range + 0.5;
}

function endAttack(u) {
  u.order = { type: 'idle' };
  u.target = null;
  u.aiming = false;
}

function unitCombat(world, u) {
  if (u.cooldown > 0) u.cooldown -= DT;
  const o = u.order;
  let t;
  if (o.type === 'attack') {
    t = o.target;
    if (!validTarget(world, u.house, t, o.force)) { endAttack(u); return; }
  } else {
    t = u.target;
    if (t && !stillWorthIt(world, u, t)) t = u.target = null;
    if (!t && (world.tick + u.id) % SCAN_TICKS === 0) {
      const r = scanRadius(u);
      t = u.target = r ? findTarget(world, u.house, u.x, u.y, r + 0.25) : null;
    }
  }
  if (!t) { u.aiming = false; u.secondShot = 0; resume(world, u); return; }
  const p = targetPoint(world, t);
  const dist = distanceTo(u.x, u.y, t, p);
  if (dist > u.type.range + 0.25) { u.aiming = false; chase(world, u, t, p, dist); return; }
  u.chaseBest = Infinity;
  u.chaseStall = 0;
  if (o.type !== 'move') stopMoving(u);
  aimAndFire(world, u, t, p, dist);
}

function chase(world, u, t, p, dist) {
  const o = u.order;
  if (o.type !== 'attack' && o.type !== 'guard' && o.type !== 'attackMove') { u.target = null; return; }
  if (dist < (u.chaseBest ?? Infinity) - 0.25) { u.chaseBest = dist; u.chaseStall = 0; }
  else if ((u.chaseStall = (u.chaseStall ?? 0) + DT) >= CHASE_GIVEUP_SECONDS) {
    u.chaseBest = Infinity;
    u.chaseStall = 0;
    if (o.type === 'attack') { endAttack(u); stopMoving(u); } else u.target = null;
    world.events.push('attackAbandoned', { id: u.id });
    return;
  }
  if (world.tick < (u.chaseAt ?? 0) || u.pathState === 'waiting') return;
  u.chaseAt = world.tick + 20;   // re-path at most once a second
  const map = world.map;
  const gx = Math.max(0, Math.min(map.w - 1, Math.floor(p.x))), gy = Math.max(0, Math.min(map.h - 1, Math.floor(p.y)));
  world.requestPath(u, map.idx(gx, gy));
}

/** With nothing to shoot: attack-movers carry on, guards walk back to their post. */
function resume(world, u) {
  const o = u.order;
  if ((o.type !== 'attackMove' && o.type !== 'guard') || onTheMove(u) || world.tick < (u.chaseAt ?? 0)) return;
  const map = world.map;
  const goal = o.type === 'attackMove' && o.goal >= 0 ? o.goal : map.idx(o.x, o.y);
  const home = Math.max(Math.abs(u.tx - map.xOf(goal)), Math.abs(u.ty - map.yOf(goal))) <= 1;
  if (home) { if (o.type === 'attackMove') u.order = { type: 'idle' }; return; }
  const here = map.idx(u.tx, u.ty);
  if (o.lastTry === here && ++o.tries >= 3) { if (o.type === 'attackMove') u.order = { type: 'idle' }; return; }   // the path ends short: stay
  if (o.lastTry !== here) { o.lastTry = here; o.tries = 0; }
  u.chaseAt = world.tick + 20;
  world.requestPath(u, goal);
}

function aimAndFire(world, u, t, p, dist) {
  const want = Math.atan2(p.y - u.y, p.x - u.x);
  let aimed;
  if (u.type.turret) {
    u.aiming = true;
    u.turret = turnToward(u.turret, want, TURRET_TURN_RATE * DT);
    aimed = Math.abs(angleDiff(u.turret, want)) < AIM_TOLERANCE;
  } else {
    if (onTheMove(u)) return;   // hull-mounted guns fire only while standing
    u.heading = turnToward(u.heading, want, TURN_RATE[u.type.turn] * DT);
    u.turret = u.heading;
    aimed = Math.abs(angleDiff(u.heading, want)) < AIM_TOLERANCE;
  }
  if (!aimed) return;
  const gun = { kind: 'unit', id: u.id, house: u.house, x: u.x, y: u.y };
  if (u.secondShot > 0) {
    if ((u.secondShot -= DT) <= 0) { u.secondShot = 0; fireAt(world, gun, t, p, dist, u.type); }
    return;
  }
  if (u.cooldown > 0) return;
  fireAt(world, gun, t, p, dist, u.type);
  u.cooldown = fireDelaySeconds(u.type.fireDelay);
  if (u.type.firesTwice && u.hp > u.maxHp / 2) u.secondShot = SECOND_SHOT_DELAY;
}
```

Modify `src/sim/world.js`:
- add `import { updateCombat, updateProjectiles } from './combat.js';` after the fog import
- in the constructor, after `this.structures = new Map();` add:
```js
    this.projectiles = new Map();
    this.nextProjectileId = 1;
```
- in `step()`, after the per-unit loop (the `for (const u of [...this.units.values()]) { … }` block) add:
```js
    updateCombat(this);
    updateProjectiles(this);
```

Modify `src/sim/invariants.js` — before `return problems;` add:
```js
  for (const p of world.projectiles?.values() ?? []) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.tx) || !Number.isFinite(p.ty)) problems.push(`projectile ${p.id} has a non-finite position`);
  }
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/combat.test.mjs && npm test`
Expected: PASS (7 new tests); suite green (the harvest soak and the movement tests still pass: harvesters are unarmed).

- [ ] **Step 5: Commit**

```bash
git add src/sim/combat.js src/sim/world.js src/sim/invariants.js tests/combat.test.mjs
git commit -m "feat(sim): combat — target acquisition, turret aiming, firing twice, projectiles, scatter, flat damage, kills

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Turrets, destruction and its consequences

**Files:**
- Create: `src/sim/aftermath.js`
- Modify: `src/sim/combat.js` (structure turrets), `src/sim/movement.js` (crush), `src/sim/world.js` (hooks)
- Test: `tests/combat-structures.test.mjs`

**Interfaces:**
- Consumes: `fireAt`, `findTarget`, `damage`, `killUnit`, `distanceTo`, `targetPoint` (Task 2); `loseStorageShare` (plan 1b); `HARVEST_CAPACITY` (plan 1b); `DEATH_SPLASH`, `LOW_POWER_TURRET_RATE` (Task 1).
- Produces: structures with `type.weapon` aim (`s.turret`, rest −π/2 = north) and fire at enemy ground units (never structures), at half rate while `house.power.ratio < 1`; the rocket turret uses `near` stats within 3 tiles. `splash(world, x, y, damage, radius, attacker, exclude)`; `spillSpice(world, x, y, load)`; `aftermathOfUnit(world, u, attacker)` (exploding vehicles splash `DEATH_SPLASH`, harvesters spill up to 3 tiles of spice), `aftermathOfStructure(world, s)` (stores burn their share of credits). Events `explosion {x, y, size:'small'|'medium'|'large'}`. Crush: a tracked vehicle blocked by an enemy foot unit kills it (`unitDestroyed … cause:'crushed'`); own infantry is never crushed. World hooks `onUnitKilled`, `onStructureKilled`, `onCrush`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/combat-structures.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { damage, killUnit, destroyStructure } from '../src/sim/combat.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

const tough = (u) => { u.hp = u.maxHp = 100000; return u; };
const fired = (world, id) => world.events.drain().filter((e) => e.type === 'fired' && e.id === id);

test('a gun turret rests facing north and shoots enemy ground units in range', () => {
  const world = flatWorld(24, 16, G.ROCK);
  world.spawnStructure('windtrap', 'atreides', 2, 2);
  const gun = world.spawnStructure('turret', 'atreides', 10, 8);
  world.step();
  assert.ok(Math.abs(gun.turret + Math.PI / 2) < 1e-9);
  const quad = world.spawnUnit('quad', 'harkonnen', 13, 8);
  run(world, 6);
  assert.ok(quad.hp < quad.maxHp, 'hit');
  assert.ok(Math.abs(gun.turret) < 0.2, 'turned east towards it');
});

test('turrets fire at half rate on low power', () => {
  const shots = (powered) => {
    const world = flatWorld(24, 16, G.ROCK);
    if (powered) world.spawnStructure('windtrap', 'atreides', 2, 2);
    const gun = world.spawnStructure('turret', 'atreides', 10, 8);
    tough(world.spawnUnit('mcv', 'harkonnen', 13, 8));
    run(world, 20);
    return fired(world, gun.id).length;
  };
  const full = shots(true), low = shots(false);
  assert.ok(full >= 9 && Math.abs(low - full / 2) <= 1.5, `full ${full}, low ${low}`);
});

test('the rocket turret uses its gun up close and rockets further out', () => {
  const weaponAt = (dx) => {
    const world = flatWorld(24, 16, G.ROCK);
    world.spawnStructure('windtrap', 'atreides', 2, 2);
    const rt = world.spawnStructure('rocketTurret', 'atreides', 10, 8);
    tough(world.spawnUnit('mcv', 'harkonnen', 10 + dx, 8));
    run(world, 5);
    return fired(world, rt.id)[0]?.weapon;
  };
  assert.equal(weaponAt(2), 'turretGun');
  assert.equal(weaponAt(6), 'turretRocket');
});

test('destroying a refinery burns its share of the owner\'s credits', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.houses.get('atreides');
  h.startBuffer = 0;
  const a = world.spawnStructure('refinery', 'atreides', 2, 2);
  world.spawnStructure('refinery', 'atreides', 10, 2);
  h.credits = 2000;
  destroyStructure(world, a, { house: 'harkonnen', id: 0, kind: 'unit' });
  assert.ok(Math.abs(h.credits - 1000) < 1, `credits ${h.credits}`);
  assert.equal(world.houses.get('harkonnen').stats.structuresKilled, 1);
  assert.equal(h.stats.structuresLost, 1);
});

test('a destroyed harvester spills its load as spice', () => {
  const world = flatWorld(24, 24, G.SAND);
  const u = world.spawnUnit('harvester', 'atreides', 12, 12);
  u.harvest.load = 700;
  killUnit(world, u, null);
  let tiles = 0;
  for (let i = 0; i < world.map.spice.length; i++) if (world.map.spice[i] > 0) tiles++;
  assert.ok(tiles >= 25 && tiles <= 45, `${tiles} spice tiles`);
});

test('exploding vehicles hurt their neighbours; friendly fire hurts but never scores', () => {
  const world = flatWorld(24, 16, G.ROCK);
  const trike = world.spawnUnit('trike', 'atreides', 8, 8);
  const tank = world.spawnUnit('combatTank', 'atreides', 9, 8);
  damage(world, trike, 1000, { house: 'harkonnen', id: 0, kind: 'unit' });
  assert.ok(tank.hp < tank.maxHp, 'the blast reached the tank');
  assert.ok(world.events.drain().some((e) => e.type === 'explosion'));
  assert.equal(world.houses.get('harkonnen').stats.unitsKilled, 1);
  const own = world.spawnUnit('trike', 'atreides', 4, 4);
  damage(world, own, 1000, { house: 'atreides', id: tank.id, kind: 'unit' });
  const a = world.houses.get('atreides').stats;
  assert.equal(a.unitsKilled, 0, 'no credit for killing your own');
  assert.equal(a.unitsLost, 2);
});

function corridor() {   // a one-tile pass: the only way east runs over the soldier
  const world = flatWorld(24, 16, G.ROCK);
  const m = world.map;
  for (let x = 4; x <= 8; x++) { m.ground[m.idx(x, 7)] = G.MOUNTAIN; m.ground[m.idx(x, 9)] = G.MOUNTAIN; }
  m.revision++;
  return world;
}

test('tanks crush enemy infantry, never their own', () => {
  const world = corridor();
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 8, { heading: 0 });
  const enemy = tough(world.spawnUnit('soldier', 'harkonnen', 6, 8));
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 12, y: 8 });
  assert.ok(runUntil(world, () => !world.units.has(enemy.id), 20) > 0, 'crushed');
  assert.ok(world.events.drain().some((e) => e.type === 'unitDestroyed' && e.cause === 'crushed'));
  const w2 = corridor();
  const t2 = w2.spawnUnit('combatTank', 'atreides', 2, 8, { heading: 0 });
  const friend = w2.spawnUnit('soldier', 'atreides', 6, 8);
  w2.issue('atreides', { type: 'move', ids: [t2.id], x: 12, y: 8 });
  run(w2, 20);
  assert.ok(w2.units.has(friend.id), 'own infantry survives');
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/combat-structures.test.mjs`
Expected: FAIL — turrets never turn or fire, stores keep their credits, no spice spills, no explosions, the tank waits behind the soldier.

- [ ] **Step 3: Implement**

Modify `src/sim/combat.js`:
- change the tuning import to also bring in `LOW_POWER_TURRET_RATE`
- replace `updateCombat` with:
```js
export function updateCombat(world) {
  for (const u of world.units.values()) if (u.isGround && isArmed(u.type)) unitCombat(world, u);
  for (const s of world.structures.values()) if (s.type.weapon) structureCombat(world, s);
}

/** Turrets (spec §4.4, structures.md): ground units only, one target at a time, half rate on low power. */
function structureCombat(world, s) {
  const t = s.type;
  const house = world.houses.get(s.house);
  if (s.cooldown > 0) s.cooldown -= DT * (house && house.power.ratio < 1 ? LOW_POWER_TURRET_RATE : 1);
  if (s.turret === undefined) s.turret = -Math.PI / 2;   // turrets rest facing north
  const x = s.x + s.w / 2, y = s.y + s.h / 2;
  let tgt = s.target;
  if (tgt) {
    const p = validTarget(world, s.house, tgt, false) ? targetPoint(world, tgt) : null;
    if (!p || distanceTo(x, y, tgt, p) > t.range + 0.25) tgt = s.target = null;
  }
  // turrets see further than their fog radius (a gun turret uncovers two tiles but shoots five): they ignore fog
  if (!tgt && (world.tick + s.id) % SCAN_TICKS === 0) tgt = s.target = findTarget(world, s.house, x, y, t.range + 0.25, { structures: false, ignoreFog: true });
  if (!tgt) return;
  const p = targetPoint(world, tgt), dist = distanceTo(x, y, tgt, p);
  const want = Math.atan2(p.y - y, p.x - x);
  s.turret = turnToward(s.turret, want, TURRET_TURN_RATE * DT);
  if (Math.abs(angleDiff(s.turret, want)) >= AIM_TOLERANCE || s.cooldown > 0) return;
  const stats = t.near && dist <= t.near.range ? t.near : t;
  fireAt(world, { kind: 'structure', id: s.id, house: s.house, x, y }, tgt, p, dist, stats);
  s.cooldown = fireDelaySeconds(stats.fireDelay);
}
```

**File: `src/sim/aftermath.js`**
```js
// What destruction leaves behind (spec §4.3, §4.6): Trikes, Missile Tanks, Harvesters and MCVs blow
// up and hurt what stands close; a Harvester spills its load as spice; a destroyed Refinery or Silo
// burns its share of the owner's credits. Kills by the blast count for whoever caused the first
// death; nobody is ever credited for killing their own.
import { G } from '../data/terrain.js';
import { DEATH_SPLASH, SPICE_PER_TILE } from '../data/tuning.js';
import { damage, distanceTo } from './combat.js';
import { loseStorageShare } from './economy.js';
import { HARVEST_CAPACITY } from './harvest.js';

export function splash(world, x, y, amount, radius, attacker, size = 'medium') {
  world.events.push('explosion', { x, y, size });
  for (const u of [...world.units.values()]) {
    if (!u.isGround) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d <= radius) damage(world, u, Math.round(amount * (1 - d / (radius + 0.5))), attacker);
  }
  for (const s of [...world.structures.values()]) {
    const d = distanceTo(x, y, { kind: 'structure' }, { entity: s });
    if (d <= radius) damage(world, s, Math.round(amount * (1 - d / (radius + 0.5))), attacker);
  }
}

export function spillSpice(world, tx, ty, load) {
  const r = Math.round((3 * load) / HARVEST_CAPACITY);
  if (r <= 0) return;
  const map = world.map;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r + r) continue;
    const x = tx + dx, y = ty + dy;
    if (!map.inBounds(x, y)) continue;
    const i = map.idx(x, y), g = map.ground[i];
    if ((g === G.SAND || g === G.DUNE) && !map.structure[i]) map.setSpice(i, Math.max(map.spice[i], SPICE_PER_TILE));
  }
}

export function aftermathOfUnit(world, u, attacker) {
  if (u.harvest?.load > 0) spillSpice(world, u.tx, u.ty, u.harvest.load);
  if (u.type.explodes) splash(world, u.x, u.y, DEATH_SPLASH.damage, DEATH_SPLASH.radius, attacker);
  else if (u.move !== 'foot') world.events.push('explosion', { x: u.x, y: u.y, size: 'small' });
}

export function aftermathOfStructure(world, s) {
  world.events.push('explosion', { x: s.x + s.w / 2, y: s.y + s.h / 2, size: 'large' });
  const house = world.houses.get(s.house);
  if (house && s.type.storage) loseStorageShare(world, house, s.type.storage);
}
```

Modify `src/sim/world.js`:
- change the combat import to `import { updateCombat, updateProjectiles, killUnit } from './combat.js';` and add `import { aftermathOfUnit, aftermathOfStructure } from './aftermath.js';`
- in the constructor, after the `this.onStructurePlaced = …` line add:
```js
    this.onUnitKilled = (u, attacker) => aftermathOfUnit(this, u, attacker);
    this.onStructureKilled = (s) => aftermathOfStructure(this, s);
    this.onCrush = (tank, victim) => killUnit(this, victim, { house: tank.house, id: tank.id, kind: 'unit' }, 'crushed');
```

Modify `src/sim/movement.js` — at the top of `blocked(world, u, occupantId)`, right after `const other = world.units.get(occupantId);`, add:
```js
  if (other && u.move === 'tracked' && other.move === 'foot' && other.house !== u.house && world.onCrush) { world.onCrush(u, other); return; }   // tracks crush enemy infantry
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/combat-structures.test.mjs && npm test`
Expected: PASS (7 new tests); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/sim/aftermath.js src/sim/combat.js src/sim/world.js src/sim/movement.js tests/combat-structures.test.mjs
git commit -m "feat(sim): turrets, exploding vehicles, spice spills, store losses and crushing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Attack commands, attack-move, guard and retaliation

**Files:**
- Modify: `src/sim/orders.js` (`attack`, `attackMove`), `src/sim/combat.js` (`retaliate`), `src/sim/world.js` (`onDamaged`)
- Test: `tests/orders-combat.test.mjs`

**Interfaces:**
- Consumes: the stances in `combat.js` (Task 2); `orderMove`, `stopUnit` (plan 1a).
- Produces: commands `{type:'attack', ids, targetKind:'unit'|'structure', targetId, force?}` and `{type:'attack', ids, x, y, force:true}` (force fire on the ground), `{type:'attackMove', ids, x, y}`; `orderAttack(world, units, cmd)`, `orderAttackMove(world, units, x, y)`; own units or buildings are attacked only with `force`; unarmed units in an attack-move simply move. `retaliate(world, victim, attacker)`: an idle armed unit hit from within `RETALIATE_RANGE` attacks back (order `attack` with `retaliation: true`). Event `attackOrdered {ids, target}`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/orders-combat.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { GUARD_LEASH } from '../src/data/tuning.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

const tough = (u) => { u.hp = u.maxHp = 100000; return u; };

test('an attack order chases the target and destroys it', () => {
  const world = flatWorld(24, 16, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 8, { heading: 0 });
  const mcv = world.spawnUnit('mcv', 'harkonnen', 16, 8);
  world.issue('atreides', { type: 'attack', ids: [tank.id], targetKind: 'unit', targetId: mcv.id });
  assert.ok(runUntil(world, () => !world.units.has(mcv.id), 45) > 0);
  assert.equal(tank.order.type, 'idle');
  assert.ok(tank.tx >= 11, 'drove into range');
});

test('attack-move stops to fight on the way, then carries on', () => {
  const world = flatWorld(32, 16, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 8, { heading: 0 });
  const quad = world.spawnUnit('quad', 'harkonnen', 12, 6);
  world.issue('atreides', { type: 'attackMove', ids: [tank.id], x: 24, y: 8 });
  assert.ok(runUntil(world, () => !world.units.has(quad.id), 40) > 0, 'the quad fell on the way');
  assert.ok(runUntil(world, () => tank.order.type === 'idle', 40) >= 0);
  assert.ok(Math.max(Math.abs(tank.tx - 24), Math.abs(tank.ty - 8)) <= 1, `arrived at ${tank.tx},${tank.ty}`);
});

test('a guard chases intruders no further than its leash, then walks back', () => {
  const world = flatWorld(40, 16, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 8, { heading: 0 });
  world.issue('atreides', { type: 'guard', ids: [tank.id] });
  const mcv = tough(world.spawnUnit('mcv', 'harkonnen', 11, 8));
  world.step();
  world.issue('harkonnen', { type: 'move', ids: [mcv.id], x: 36, y: 8 });
  let furthest = 0;
  for (let i = 0; i < 40 * 20; i++) { world.step(); furthest = Math.max(furthest, tank.tx); }
  assert.ok(furthest > 6, 'it went after the intruder');
  assert.ok(furthest <= 5 + GUARD_LEASH + 4, `stayed on its leash (x ≤ ${furthest})`);
  assert.ok(Math.max(Math.abs(tank.tx - 5), Math.abs(tank.ty - 8)) <= 1, `back at its post, at ${tank.tx},${tank.ty}`);
});

test('an idle unit answers fire from beyond its own range', () => {
  const world = flatWorld(32, 16, G.ROCK);
  world.houses.get('harkonnen').isAI = true;
  const tank = world.spawnUnit('combatTank', 'atreides', 4, 8, { heading: 0 });
  const launcher = world.spawnUnit('missileTank', 'harkonnen', 11, 8, { heading: Math.PI });
  assert.ok(runUntil(world, () => tank.order.type === 'attack', 20) > 0, 'it took the hit personally');
  assert.equal(tank.order.target.id, launcher.id);
});

test('attacking an unreachable target gives up', () => {
  const world = flatWorld(32, 20, G.ROCK);
  const m = world.map;
  for (let y = 4; y <= 14; y++) for (let x = 16; x <= 26; x++) if (Math.max(Math.abs(x - 21), Math.abs(y - 9)) >= 4) m.ground[m.idx(x, y)] = G.MOUNTAIN;
  m.revision++;
  const tank = world.spawnUnit('combatTank', 'atreides', 2, 9, { heading: 0 });
  const island = tough(world.spawnUnit('mcv', 'harkonnen', 21, 9));
  world.issue('atreides', { type: 'attack', ids: [tank.id], targetKind: 'unit', targetId: island.id });
  assert.ok(runUntil(world, () => tank.order.type === 'idle', 60) > 0, 'gave up');
  assert.ok(world.events.drain().some((e) => e.type === 'attackAbandoned' && e.id === tank.id));
});

test('own units and the ground are attacked only when forced; foreign commands are ignored', () => {
  const world = flatWorld(24, 16, G.ROCK);
  const a = world.spawnUnit('combatTank', 'atreides', 4, 8, { heading: 0 });
  const b = world.spawnUnit('combatTank', 'atreides', 6, 8);
  world.issue('atreides', { type: 'attack', ids: [a.id], targetKind: 'unit', targetId: b.id });
  world.issue('atreides', { type: 'attack', ids: [a.id], x: 9, y: 8 });
  world.issue('harkonnen', { type: 'attack', ids: [a.id], targetKind: 'unit', targetId: b.id, force: true });
  world.step();
  assert.equal(a.order.type, 'idle');
  world.issue('atreides', { type: 'attack', ids: [a.id], x: 9, y: 8, force: true });
  world.step();
  assert.deepEqual(a.order.target, { kind: 'tile', x: 9, y: 8 });
  run(world, 4);
  assert.ok(world.events.drain().some((e) => e.type === 'fired' && e.id === a.id));
  assert.equal(b.hp, b.maxHp, 'nothing hit the friend');
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/orders-combat.test.mjs`
Expected: FAIL — `attack` and `attackMove` are rejected commands; the idle tank never answers fire.

- [ ] **Step 3: Implement**

Modify `src/sim/orders.js`:
- add `import { isArmed } from './combat.js';` after the harvest import
- add these cases before `default:`
```js
    case 'attack': orderAttack(world, units, cmd); return;
    case 'attackMove': orderAttackMove(world, units, cmd.x, cmd.y); return;
```
- append:
```js
export function orderAttack(world, units, cmd) {
  const force = cmd.force === true;
  const map = world.map;
  let entity = null, target = null;
  if (cmd.targetKind === 'unit') entity = world.units.get(cmd.targetId) ?? null;
  else if (cmd.targetKind === 'structure') entity = world.structures.get(cmd.targetId) ?? null;
  if (entity) target = { kind: cmd.targetKind, id: entity.id };
  else if (force && Number.isFinite(cmd.x) && Number.isFinite(cmd.y)) {
    target = { kind: 'tile', x: Math.max(0, Math.min(map.w - 1, Math.floor(cmd.x))), y: Math.max(0, Math.min(map.h - 1, Math.floor(cmd.y))) };
  }
  if (!target) return;
  const ids = [];
  for (const u of units) {
    if (!u.isGround || !isArmed(u.type) || entity === u) continue;
    if (entity && entity.house === u.house && !force) continue;
    u.order = { type: 'attack', target: { ...target }, force };
    u.target = null;
    u.chaseAt = 0;
    u.chaseBest = Infinity;
    u.chaseStall = 0;
    ids.push(u.id);
  }
  if (ids.length) world.events.push('attackOrdered', { ids, target });
}

export function orderAttackMove(world, units, x, y) {
  orderMove(world, units, x, y);   // slots, paths and the moveOrdered event
  for (const u of units) {
    if (u.order.type !== 'move' || !isArmed(u.type)) continue;   // unarmed units simply move
    u.order = { type: 'attackMove', x: u.order.x, y: u.order.y, goal: u.goal };
    u.target = null;
  }
}
```

Modify `src/sim/combat.js`:
- add `RETALIATE_RANGE` to the tuning import
- append:
```js
/** An idle armed unit that is shot at from close by answers fire (busy units keep their orders). */
export function retaliate(world, victim, attacker) {
  if (victim.kind !== 'unit' || !attacker || attacker.house === victim.house || !victim.isGround || !isArmed(victim.type)) return;
  if (victim.order.type !== 'idle' || victim.target) return;
  const t = { kind: attacker.kind, id: attacker.id };
  const p = targetPoint(world, t);
  if (!p || distanceTo(victim.x, victim.y, t, p) > RETALIATE_RANGE) return;
  victim.order = { type: 'attack', target: t, retaliation: true };
  victim.chaseAt = 0;
  victim.chaseBest = Infinity;
  victim.chaseStall = 0;
}
```

Modify `src/sim/world.js`:
- change the combat import to also bring in `retaliate`
- in the constructor, after the `this.onCrush = …` line add:
```js
    this.onDamaged = (victim, attacker) => retaliate(this, victim, attacker);
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/orders-combat.test.mjs && npm test`
Expected: PASS (6 new tests); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/sim/orders.js src/sim/combat.js src/sim/world.js tests/orders-combat.test.mjs
git commit -m "feat(sim): attack and attack-move commands, force fire, guard leash, retaliation, giving up on unreachable targets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Victory, defeat and combat announcements

**Files:**
- Create: `src/sim/announce.js`, `src/sim/victory.js`
- Modify: `src/sim/world.js` (rules, victory system, alert hooks), `src/game/setup.js` (victory on)
- Test: `tests/victory.test.mjs`

**Interfaces:**
- Consumes: kill and damage hooks (Tasks 2–4); `House.stats`.
- Produces: `announce(world, houseId, key, text, everySeconds = 0)` (per-house throttle, event `eva`); `alertDamage(world, victim, attacker)` (`baseAttack` "Our base is under attack." / `harvesterAttack` "Harvester under attack." at most every 20 s), `alertUnitKilled(world, u, attacker)` (`unitLost` "Unit lost." every 4 s; the attacker hears `enemyUnitDestroyed`), `alertStructureKilled(world, s, attacker)` (`structureLost` "Structure destroyed."; the attacker hears `enemyStructureDestroyed`). `World.rules = {victory:false}` (skirmish sets `true`); `updateVictory(world)` every 20 ticks: a house with no structures and no MCV is `defeated` (event `houseDefeated {house}`); when at most one house stands, `world.outcome = {winner|null, tick}` is set once, event `gameOver {winner}`, and every house hears `missionAccomplished` or `missionFailed`. `endStats(world, houseId)` → `{won, draw, seconds, rows:[{label, you, enemy}]}`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/victory.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { destroyStructure, damage } from '../src/sim/combat.js';
import { endStats } from '../src/sim/victory.js';
import { flatWorld, run } from './helpers.mjs';

function duel() {
  const world = flatWorld(32, 16, G.ROCK);
  world.rules.victory = true;
  const a = world.spawnStructure('constructionYard', 'atreides', 2, 2);
  const h = world.spawnStructure('constructionYard', 'harkonnen', 26, 2);
  return { world, a, h };
}
const events = (world, type) => world.events.drain().filter((e) => e.type === type);

test('a house with no buildings and no MCV is defeated; the last one standing wins', () => {
  const { world, h } = duel();
  run(world, 2);
  assert.equal(world.outcome, null);
  destroyStructure(world, h, { house: 'atreides', id: 0, kind: 'unit' });
  run(world, 2);
  assert.equal(world.houses.get('harkonnen').defeated, true);
  assert.deepEqual([world.outcome.winner], ['atreides']);
  const all = world.events.drain();
  assert.equal(all.filter((e) => e.type === 'gameOver').length, 1);
  assert.ok(all.some((e) => e.type === 'eva' && e.house === 'atreides' && e.key === 'missionAccomplished'));
  assert.ok(all.some((e) => e.type === 'eva' && e.house === 'harkonnen' && e.key === 'missionFailed'));
  run(world, 5);
  assert.equal(events(world, 'gameOver').length, 0, 'announced once');
});

test('an MCV keeps a house in the game', () => {
  const { world, h } = duel();
  world.spawnUnit('mcv', 'harkonnen', 20, 10);
  destroyStructure(world, h, null);
  run(world, 3);
  assert.equal(world.houses.get('harkonnen').defeated, undefined);
  assert.equal(world.outcome, null);
});

test('both sides falling in one tick is a single draw', () => {
  const { world, a, h } = duel();
  run(world, 1.05);
  destroyStructure(world, a, null);
  destroyStructure(world, h, null);
  run(world, 2);
  assert.equal(world.outcome.winner, null);
  assert.equal(events(world, 'gameOver').length, 1);
});

test('base alerts are throttled; losses are announced', () => {
  const { world, a } = duel();
  const attacker = { house: 'harkonnen', id: 0, kind: 'unit' };
  damage(world, a, 10, attacker);
  damage(world, a, 10, attacker);
  run(world, 5);
  damage(world, a, 10, attacker);
  assert.equal(events(world, 'eva').filter((e) => e.key === 'baseAttack').length, 1);
  run(world, 20);
  damage(world, a, 10, attacker);
  assert.equal(events(world, 'eva').filter((e) => e.key === 'baseAttack').length, 1, 'again after 20 s');
  const u = world.spawnUnit('trike', 'atreides', 8, 8);
  damage(world, u, 1000, attacker);
  const said = events(world, 'eva');
  assert.ok(said.some((e) => e.house === 'atreides' && e.key === 'unitLost'));
  assert.ok(said.some((e) => e.house === 'harkonnen' && e.key === 'enemyUnitDestroyed'));
});

test('end statistics compare the player with everyone else', () => {
  const { world, h } = duel();
  world.houses.get('atreides').stats.spiceHarvested = 1400;
  world.houses.get('harkonnen').stats.spiceHarvested = 700;
  destroyStructure(world, h, { house: 'atreides', id: 0, kind: 'unit' });
  run(world, 2);
  const s = endStats(world, 'atreides');
  assert.equal(s.won, true);
  assert.equal(s.draw, false);
  assert.deepEqual(s.rows[0], { label: 'Spice harvested', you: 1400, enemy: 700 });
  assert.deepEqual(s.rows.find((r) => r.label === 'Buildings destroyed'), { label: 'Buildings destroyed', you: 1, enemy: 0 });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/victory.test.mjs`
Expected: FAIL — cannot find `../src/sim/victory.js`.

- [ ] **Step 3: Implement**

**File: `src/sim/announce.js`**
```js
// Announcer (spec §6 event list): events the message bar shows now and voices speak from plan 1d on.
// Keys are throttled per house so a battle does not drown the player in repeats.
import { HOUSES } from '../data/houses.js';

export function announce(world, houseId, key, text, every = 0) {
  const house = world.houses.get(houseId);
  if (!house) return;
  house.lastSaid ??= {};
  if (every && world.time - (house.lastSaid[key] ?? -1e9) < every) return;
  house.lastSaid[key] = world.time;
  world.events.push('eva', { house: houseId, key, text });
}

const foe = (houseId) => HOUSES[houseId]?.name ?? 'Enemy';

export function alertDamage(world, victim, attacker) {
  if (!attacker || attacker.house === victim.house) return;
  if (victim.kind === 'structure') announce(world, victim.house, 'baseAttack', 'Our base is under attack.', 20);
  else if (victim.typeId === 'harvester') announce(world, victim.house, 'harvesterAttack', 'Harvester under attack.', 20);
}

export function alertUnitKilled(world, u, attacker) {
  announce(world, u.house, 'unitLost', 'Unit lost.', 4);
  if (attacker && attacker.house !== u.house) announce(world, attacker.house, 'enemyUnitDestroyed', `${foe(u.house)} unit destroyed.`, 4);
}

export function alertStructureKilled(world, s, attacker) {
  announce(world, s.house, 'structureLost', 'Structure destroyed.', 1);
  if (attacker && attacker.house !== s.house) announce(world, attacker.house, 'enemyStructureDestroyed', `${foe(s.house)} structure destroyed.`, 1);
}
```

**File: `src/sim/victory.js`**
```js
// Victory (spec §4.11): a house is out when it has no structures and no MCV; the skirmish ends when at
// most one house stands (nobody left is a draw). The outcome is decided once and announced once.
import { announce } from './announce.js';

export function updateVictory(world) {
  if (!world.rules.victory || world.outcome) return;
  const standing = [];
  for (const house of world.houses.values()) {
    if (house.defeated) continue;
    let alive = false;
    for (const s of world.structures.values()) if (s.house === house.id) { alive = true; break; }
    if (!alive) for (const u of world.units.values()) if (u.house === house.id && u.type.deploysTo) { alive = true; break; }
    if (alive) standing.push(house.id);
    else { house.defeated = true; world.events.push('houseDefeated', { house: house.id }); }
  }
  if (standing.length > 1) return;
  const winner = standing[0] ?? null;
  world.outcome = { winner, tick: world.tick };
  world.events.push('gameOver', { winner });
  for (const house of world.houses.values()) {
    if (house.id === winner) announce(world, house.id, 'missionAccomplished', 'Mission accomplished.');
    else announce(world, house.id, 'missionFailed', 'Mission failed.');
  }
}

export function endStats(world, houseId) {
  const me = world.houses.get(houseId);
  const others = [...world.houses.values()].filter((h) => h.id !== houseId);
  const sum = (k) => others.reduce((n, h) => n + h.stats[k], 0);
  const row = (label, k) => ({ label, you: Math.round(me.stats[k]), enemy: Math.round(sum(k)) });
  return {
    won: world.outcome?.winner === houseId,
    draw: !!world.outcome && world.outcome.winner === null,
    seconds: Math.round(world.time),
    rows: [
      row('Spice harvested', 'spiceHarvested'),
      row('Units destroyed', 'unitsKilled'),
      row('Units lost', 'unitsLost'),
      row('Buildings destroyed', 'structuresKilled'),
      row('Buildings lost', 'structuresLost'),
    ],
  };
}
```

Modify `src/sim/world.js`:
- add imports:
```js
import { updateVictory } from './victory.js';
import { alertDamage, alertUnitKilled, alertStructureKilled } from './announce.js';
```
- in the constructor, after `this.fogOfWar = true; …` add `    this.rules = { victory: false };   // skirmish and campaign switch victory checks on`, and `    this.outcome = null;`
- replace the three hook lines `this.onUnitKilled = …`, `this.onStructureKilled = …` and `this.onDamaged = …` with:
```js
    this.onUnitKilled = (u, attacker) => { aftermathOfUnit(this, u, attacker); alertUnitKilled(this, u, attacker); };
    this.onStructureKilled = (s, attacker) => { aftermathOfStructure(this, s); alertStructureKilled(this, s, attacker); };
    this.onDamaged = (victim, attacker) => { retaliate(this, victim, attacker); alertDamage(this, victim, attacker); };
```
- in `step()`, directly before `    this.tick++;` add:
```js
    if (this.tick % 20 === 0) updateVictory(this);
```

Modify `src/game/setup.js` — in `setupSkirmish`, after `world.fogOfWar = fog;` add `  world.rules.victory = true;`

- [ ] **Step 4: Run the tests**

Run: `node --test tests/victory.test.mjs && npm test`
Expected: PASS (5 new tests); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/sim/announce.js src/sim/victory.js src/sim/world.js src/game/setup.js tests/victory.test.mjs
git commit -m "feat(sim): defeat, victory and draws decided once; throttled combat announcements; end statistics

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: Controller — attack clicks, attack-move, force fire

**Files:**
- Modify: `src/input/controller.js`
- Test: `tests/controller.test.mjs` (additions)

**Interfaces:**
- Consumes: commands `attack` and `attackMove` (Task 4); `isArmed` (Task 2); the controller as left by plan 1b.
- Produces: with own armed units selected, a click on an enemy unit or building (Classic: left; Modern: right) issues `attack`; Ctrl + left click issues a forced `attack` on whatever is under the cursor (own unit, own building or ground) and keeps the selection; `A` enters mode `{kind:'attackMove'}` — the next left click issues `attackMove` to that tile (or `attack` on an enemy), right click or Escape cancels. `order(hit, mods = {})`. Cursor `attack` over enemy buildings and in attack-move mode.

- [ ] **Step 1: Write the failing tests**

Append to `tests/controller.test.mjs`:
```js
test('clicking an enemy with units selected attacks it (classic left click, modern right click)', () => {
  const { tank, enemy, c, issued } = setup();
  c.selection.set([tank.id]);
  c.onClick(px(12), px(5), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'attack', ids: [tank.id], targetKind: 'unit', targetId: enemy.id, force: false });
  const m = setup('modern');
  m.c.selection.set([m.tank.id]);
  m.c.onClick(px(12), px(5), 2, NONE, false);
  assert.equal(m.issued.at(-1).type, 'attack');
});

test('enemy buildings are attacked, and the cursor says so', () => {
  const { world, tank, c, issued } = setup();
  const trap = world.spawnStructure('windtrap', 'harkonnen', 14, 12);
  c.selection.set([tank.id]);
  assert.equal(c.cursorFor(c.hitTest(px(14), px(12))), 'attack');
  c.onClick(px(14), px(12), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'attack', ids: [tank.id], targetKind: 'structure', targetId: trap.id, force: false });
});

test('Ctrl + click forces fire on a friend or on the ground', () => {
  const { tank, tank2, c, issued } = setup();
  c.selection.set([tank.id]);
  c.onClick(px(7), px(5), 0, { ...NONE, ctrl: true }, false);
  assert.deepEqual(issued.at(-1), { type: 'attack', ids: [tank.id], targetKind: 'unit', targetId: tank2.id, force: true });
  c.onClick(px(10), px(10), 0, { ...NONE, ctrl: true }, false);
  assert.deepEqual(issued.at(-1), { type: 'attack', ids: [tank.id], x: 10, y: 10, force: true });
  assert.deepEqual(c.selection.list(), [tank.id], 'the selection stays');
});

test('A then a click attack-moves the selection; Escape cancels', () => {
  const { tank, c, issued } = setup();
  c.selection.set([tank.id]);
  c.onKey('a', 'KeyA', NONE);
  assert.equal(c.mode.kind, 'attackMove');
  assert.equal(c.cursorFor(c.hitTest(px(10), px(10))), 'attack');
  c.onClick(px(10), px(10), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'attackMove', ids: [tank.id], x: 10, y: 10 });
  assert.equal(c.mode, null);
  c.onKey('a', 'KeyA', NONE);
  c.onKey('Escape', 'Escape', NONE);
  assert.equal(c.mode, null);
  assert.equal(issued.length, 1);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/controller.test.mjs`
Expected: FAIL — clicking an enemy issues `move`; Ctrl + click selects; `A` does nothing.

- [ ] **Step 3: Implement**

Modify `src/input/controller.js`:
- add `import { isArmed } from '../sim/combat.js';` after the tech import
- in `onClick`, replace `      else if (!this.rally(hit)) this.order(hit);` with `      else if (!this.rally(hit)) this.order(hit, mods);`, and directly after the `if (button === 2) { … }` block add:
```js
    if (mods.ctrl && hit && this.ownSelected().some((u) => isArmed(u.type))) { this.order(hit, mods); return; }   // force fire
```
- in `clickStructure`, replace `      if (s.house !== this.house) return;   // attacking structures arrives with combat (plan 1c)` with:
```js
      if (s.house !== this.house) { this.order({ kind: 'structure', structure: s, tx: s.x, ty: s.y }); return; }
```
- in `order(hit)`, change the signature to `order(hit, mods = {}) {` and, directly after the MCV deploy special case (the `if (hit.kind === 'unit' && units.length === 1 … ) { … return; }` block), add:
```js
    const armed = units.filter((u) => isArmed(u.type));
    const entity = hit.kind === 'unit' ? hit.unit : hit.kind === 'structure' ? hit.structure : null;
    const enemy = !!entity && entity.house !== this.house;
    if (armed.length && (enemy || mods.ctrl)) {
      const ids = armed.map((u) => u.id);
      if (entity) this.issue({ type: 'attack', ids, targetKind: entity.kind, targetId: entity.id, force: !enemy });
      else this.issue({ type: 'attack', ids, x: hit.tx, y: hit.ty, force: true });
      return;
    }
```
- in `modeClick`, directly after `if (button === 2) { this.setMode(null); return; }` add:
```js
    if (this.mode.kind === 'attackMove') {
      const hit = this.hitTest(x, y);
      this.setMode(null);
      const ids = this.ownSelected().map((u) => u.id);
      if (!hit || !ids.length) return;
      const entity = hit.kind === 'unit' ? hit.unit : hit.kind === 'structure' ? hit.structure : null;
      if (entity && entity.house !== this.house) { this.order(hit); return; }
      const tx = hit.kind === 'unit' ? hit.unit.tx : hit.tx, ty = hit.kind === 'unit' ? hit.unit.ty : hit.ty;
      this.issue({ type: 'attackMove', ids, x: tx, y: ty });
      this.onMarker(tx + 0.5, ty + 0.5);
      return;
    }
```
- in `onKey`, directly before `    if (HOTKEYS[key]) {` add:
```js
    if (key === 'a' && !mods.ctrl) {
      if (this.ownSelected().some((u) => isArmed(u.type))) this.setMode({ kind: 'attackMove' });
      return true;
    }
```
- in `cursorFor(hit)`, inside `if (this.mode) {` add as its first line `      if (this.mode.kind === 'attackMove') return 'attack';`, and replace `      return own.length && s?.house !== this.house ? 'noMove' : 'select';` with:
```js
      if (own.length && s?.house !== this.house) return own.some((u) => isArmed(u.type)) ? 'attack' : 'noMove';
      return 'select';
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/controller.test.mjs && npm test`
Expected: PASS (4 new tests); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/input/controller.js tests/controller.test.mjs
git commit -m "feat(input): attack enemies and buildings by click, A for attack-move, Ctrl for force fire

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Particle effects

**Files:**
- Create: `src/render/effects.js`
- Modify: `src/render/quality.js` (`flashLights`)
- Test: `tests/effects.test.mjs`

**Interfaces:**
- Consumes: the quality preset (`particles`, new `flashLights`).
- Produces: `class ParticlePool(scene, capacity, {additive})` with `emit({x, y, z, vx, vy, vz, life, size:[from,to], color:[r,g,b], color2?, alpha:[from,to], drag, gravity})` → boolean (false when full), `update(dt)`, fields `n`, `capacity`, `pos`, `mesh`; `class Effects(scene, quality)` with `muzzle(x, y, z, big)`, `trail(kind, x, y, z)` (`'bullet'|'shell'|'rocket'`), `impact(x, y, z, kind, hit)`, `explosion(x, y, z, size)` (`'small'|'medium'|'large'`), `smokePuff(x, y, z)`, `flame(x, y, z)`, `update(dt)`, fields `glow`, `smoke` (pools), `lights` (`[{light, t}]`). World coordinates: x = tile x, z = tile y, y = height. Presets gain `flashLights`: Low 0, Medium 2, High 4.

- [ ] **Step 1: Write the failing test**

**File: `tests/effects.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ParticlePool, Effects } from '../src/render/effects.js';

test('particles move, age and die; a pool never grows past its capacity', () => {
  const pool = new ParticlePool(new THREE.Scene(), 16, { additive: true });
  let accepted = 0;
  for (let k = 0; k < 20; k++) accepted += pool.emit({ x: 0, y: 0, z: 0, vx: 2, life: k < 10 ? 0.1 : 1, size: [1, 1], color: [1, 1, 1], alpha: [1, 0] }) ? 1 : 0;
  assert.equal(accepted, 16);
  pool.update(0.05);
  assert.equal(pool.mesh.count, 16);
  assert.ok(pool.pos[0] > 0.05, 'moved');
  pool.update(0.1);
  assert.equal(pool.n, 6, 'the ten short-lived ones are gone');
});

test('bigger explosions throw more particles, never beyond the budget', () => {
  const fx = new Effects(new THREE.Scene(), { particles: 400, flashLights: 0 });
  fx.explosion(0, 0, 0, 'small');
  const small = fx.glow.n + fx.smoke.n;
  fx.explosion(0, 0, 0, 'large');
  assert.ok(fx.glow.n + fx.smoke.n - small > small);
  for (let k = 0; k < 100; k++) fx.explosion(0, 0, 0, 'large');
  assert.ok(fx.glow.n <= fx.glow.capacity && fx.smoke.n <= fx.smoke.capacity);
  assert.ok(fx.glow.capacity + fx.smoke.capacity <= 400);
});

test('muzzle flashes borrow a fixed set of point lights that fade out', () => {
  const scene = new THREE.Scene();
  const fx = new Effects(scene, { particles: 400, flashLights: 2 });
  const count = () => scene.children.filter((o) => o.isPointLight).length;
  assert.equal(count(), 2);
  for (let k = 0; k < 5; k++) fx.muzzle(k, 0.3, 0, true);
  assert.equal(count(), 2);
  assert.ok(fx.lights.some((l) => l.light.intensity > 0));
  fx.update(0.2);
  assert.ok(fx.lights.every((l) => l.light.intensity === 0));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/effects.test.mjs`
Expected: FAIL — cannot find `../src/render/effects.js`.

- [ ] **Step 3: Implement**

Modify `src/render/quality.js` — add `flashLights` to each preset: `low … terrainSub: 3, flashLights: 0 }`, `medium … terrainSub: 4, flashLights: 2 }`, `high … terrainSub: 4, flashLights: 4 }`.

**File: `src/render/effects.js`**
```js
// Particle effects (spec §5.4): pools of camera-facing soft sprites, one InstancedMesh each — additive
// for fire, flashes, tracers and sparks, alpha-blended for smoke — simulated on the CPU within the
// quality preset's particle budget. Recipes turn combat events into muzzle flashes, projectile trails,
// impacts, explosions, smoke and flames. Muzzle flashes also borrow one of a fixed set of point lights
// (none on Low), so the lighting setup — and every compiled shader — never changes mid-game.
import * as THREE from 'three';

const VERT = `
attribute float aAlpha;
varying float vAlpha;
varying vec3 vColor;
varying vec2 vUv;
void main() {
  vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  center.xy += position.xy * length(instanceMatrix[0].xyz);
  gl_Position = projectionMatrix * center;
  vUv = uv;
  vAlpha = aAlpha;
#ifdef USE_INSTANCING_COLOR
  vColor = instanceColor;
#else
  vColor = vec3(1.0);
#endif
}`;

const FRAG = `
varying float vAlpha;
varying vec3 vColor;
varying vec2 vUv;
void main() {
  float soft = pow(clamp(1.0 - length(vUv - 0.5) * 2.0, 0.0, 1.0), 1.6);
#ifdef ADDITIVE
  gl_FragColor = vec4(vColor * soft * vAlpha, 1.0);
#else
  gl_FragColor = vec4(vColor, soft * vAlpha);
#endif
}`;

const rnd = (a, b) => a + Math.random() * (b - a);

export class ParticlePool {
  constructor(scene, capacity, { additive = false } = {}) {
    const N = (this.capacity = Math.max(16, Math.floor(capacity)));
    this.n = 0;
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.age = new Float32Array(N);
    this.life = new Float32Array(N);
    this.size = new Float32Array(N * 2);
    this.col = new Float32Array(N * 6);
    this.alpha = new Float32Array(N * 2);
    this.phys = new Float32Array(N * 2);
    const geo = new THREE.PlaneGeometry(1, 1);
    this.alphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
    this.alphaAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAlpha', this.alphaAttr);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, defines: additive ? { ADDITIVE: '' } : {},
    });
    this.mesh = new THREE.InstancedMesh(geo, material, N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 11 : 10;
    scene.add(this.mesh);
  }

  emit({ x, y, z, vx = 0, vy = 0, vz = 0, life = 1, size = [0.3, 0.3], color = [1, 1, 1], color2 = color, alpha = [1, 0], drag = 0, gravity = 0 }) {
    if (this.n >= this.capacity) return false;
    const i = this.n++;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.age[i] = 0;
    this.life[i] = life;
    this.size.set(size, i * 2);
    this.col.set([color[0], color[1], color[2], color2[0], color2[1], color2[2]], i * 6);
    this.alpha.set(alpha, i * 2);
    this.phys.set([drag, gravity], i * 2);
    return true;
  }

  kill(i) {
    const last = --this.n;
    if (i === last) return;
    this.pos.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.vel.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.age[i] = this.age[last];
    this.life[i] = this.life[last];
    this.size.copyWithin(i * 2, last * 2, last * 2 + 2);
    this.col.copyWithin(i * 6, last * 6, last * 6 + 6);
    this.alpha.copyWithin(i * 2, last * 2, last * 2 + 2);
    this.phys.copyWithin(i * 2, last * 2, last * 2 + 2);
  }

  update(dt) {
    const m = this.mesh.instanceMatrix.array, c = this.mesh.instanceColor.array, a = this.alphaAttr.array;
    let i = 0;
    while (i < this.n) {
      if ((this.age[i] += dt) >= this.life[i]) { this.kill(i); continue; }
      const p = i * 3, drag = Math.max(0, 1 - this.phys[i * 2] * dt), g = this.phys[i * 2 + 1];
      this.vel[p] *= drag;
      this.vel[p + 1] = this.vel[p + 1] * drag - g * dt;
      this.vel[p + 2] *= drag;
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
      const t = this.age[i] / this.life[i];
      const s = this.size[i * 2] + (this.size[i * 2 + 1] - this.size[i * 2]) * t;
      const o = i * 16;
      m.fill(0, o, o + 16);
      m[o] = s; m[o + 5] = s; m[o + 10] = s; m[o + 15] = 1;
      m[o + 12] = this.pos[p]; m[o + 13] = this.pos[p + 1]; m[o + 14] = this.pos[p + 2];
      const q = i * 6;
      for (let k = 0; k < 3; k++) c[p + k] = this.col[q + k] + (this.col[q + 3 + k] - this.col[q + k]) * t;
      a[i] = this.alpha[i * 2] + (this.alpha[i * 2 + 1] - this.alpha[i * 2]) * t;
      i++;
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
  }
}

const SIZES = { small: { n: 6, s: 0.45 }, medium: { n: 14, s: 0.8 }, large: { n: 28, s: 1.4 } };

export class Effects {
  constructor(scene, quality) {
    const budget = quality.particles ?? 4000;
    this.glow = new ParticlePool(scene, budget * 0.45, { additive: true });
    this.smoke = new ParticlePool(scene, budget * 0.55, { additive: false });
    this.lights = [];
    for (let k = 0; k < (quality.flashLights ?? 0); k++) {
      const light = new THREE.PointLight(0xffb060, 0, 3.5, 2);
      scene.add(light);
      this.lights.push({ light, t: 0 });
    }
    this.nextLight = 0;
  }

  flash(x, y, z, intensity) {
    if (!this.lights.length) return;
    const l = this.lights[this.nextLight++ % this.lights.length];
    l.light.position.set(x, y + 0.25, z);
    l.light.intensity = intensity;
    l.t = 0.09;
  }

  muzzle(x, y, z, big = false) {
    this.glow.emit({ x, y, z, life: 0.07, size: [big ? 0.55 : 0.3, big ? 0.9 : 0.45], color: [7, 4.5, 1.6], alpha: [1, 0] });
    if (big) for (let k = 0; k < 3; k++) this.smoke.emit({ x, y, z, vx: rnd(-0.3, 0.3), vy: rnd(0.2, 0.6), vz: rnd(-0.3, 0.3), life: rnd(0.4, 0.8), size: [0.2, 0.6], color: [0.36, 0.34, 0.31], alpha: [0.5, 0], drag: 1.5 });
    this.flash(x, y, z, big ? 6 : 2.5);
  }

  trail(kind, x, y, z) {
    if (kind === 'rocket') {
      this.glow.emit({ x, y, z, life: 0.06, size: [0.22, 0.1], color: [8, 5, 2], alpha: [1, 0] });
      this.smoke.emit({ x, y, z, vx: rnd(-0.08, 0.08), vy: rnd(0.05, 0.2), vz: rnd(-0.08, 0.08), life: rnd(0.6, 1.0), size: [0.12, 0.5], color: [0.62, 0.6, 0.57], alpha: [0.55, 0], drag: 1 });
    } else if (kind === 'shell') this.glow.emit({ x, y, z, life: 0.05, size: [0.16, 0.08], color: [6, 3, 0.8], alpha: [1, 0] });
    else this.glow.emit({ x, y, z, life: 0.04, size: [0.09, 0.05], color: [6, 5, 2], alpha: [1, 0] });
  }

  impact(x, y, z, kind, hit) {
    if (kind === 'rocket') { this.explosion(x, y, z, 'small'); return; }
    const sparks = kind === 'shell' ? 6 : 2;
    for (let k = 0; k < sparks; k++) this.glow.emit({ x, y, z, vx: rnd(-1.5, 1.5), vy: rnd(0.5, 2), vz: rnd(-1.5, 1.5), life: rnd(0.15, 0.3), size: [0.07, 0.03], color: [6, 4, 1.5], alpha: [1, 0], gravity: 6 });
    if (kind === 'shell') this.smoke.emit({ x, y, z, vy: 0.3, life: 0.9, size: [0.2, 0.7], color: hit ? [0.3, 0.28, 0.26] : [0.62, 0.5, 0.36], alpha: [0.6, 0], drag: 1 });
  }

  explosion(x, y, z, size = 'medium') {
    const { n, s } = SIZES[size] ?? SIZES.medium;
    for (let k = 0; k < n; k++) {
      this.glow.emit({ x, y, z, vx: rnd(-1, 1) * s * 1.6, vy: rnd(0.2, 1.4) * s * 1.6, vz: rnd(-1, 1) * s * 1.6, life: rnd(0.35, 0.7), size: [s * 0.6, s * 1.4], color: [8, 3.2, 0.8], color2: [2, 0.4, 0.1], alpha: [1, 0], drag: 3 });
    }
    for (let k = 0; k < n / 2; k++) this.glow.emit({ x, y, z, vx: rnd(-4, 4) * s, vy: rnd(1, 4) * s, vz: rnd(-4, 4) * s, life: rnd(0.3, 0.6), size: [0.08, 0.03], color: [7, 4, 1.2], alpha: [1, 0], gravity: 7 });
    for (let k = 0; k < n / 2; k++) {
      this.smoke.emit({ x: x + rnd(-0.3, 0.3) * s, y, z: z + rnd(-0.3, 0.3) * s, vx: rnd(-0.4, 0.4), vy: rnd(0.3, 0.9), vz: rnd(-0.4, 0.4), life: rnd(1.5, 3), size: [s * 0.6, s * 2.2], color: [0.2, 0.18, 0.16], color2: [0.42, 0.4, 0.38], alpha: [0.75, 0], drag: 1 });
    }
    this.flash(x, y, z, 4 + s * 6);
  }

  smokePuff(x, y, z) {
    this.smoke.emit({ x, y, z, vx: rnd(-0.1, 0.1), vy: rnd(0.35, 0.7), vz: rnd(-0.1, 0.1), life: rnd(1.2, 2), size: [0.15, 0.7], color: [0.16, 0.15, 0.14], color2: [0.4, 0.38, 0.36], alpha: [0.6, 0], drag: 0.6 });
  }

  flame(x, y, z) {
    this.glow.emit({ x: x + rnd(-0.1, 0.1), y, z: z + rnd(-0.1, 0.1), vy: rnd(0.4, 0.9), life: rnd(0.3, 0.6), size: [0.28, 0.08], color: [6, 2.4, 0.5], color2: [1.4, 0.3, 0.05], alpha: [1, 0] });
  }

  update(dt) {
    this.glow.update(dt);
    this.smoke.update(dt);
    for (const l of this.lights) if (l.t > 0 && (l.t -= dt) <= 0) { l.t = 0; l.light.intensity = 0; }
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/effects.test.mjs tests/quality.test.mjs && npm test`
Expected: PASS (3 new tests); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/render/effects.js src/render/quality.js tests/effects.test.mjs
git commit -m "feat(render): CPU-simulated GPU particle pools with muzzle flashes, trails, impacts, explosions, smoke and flames

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Combat on screen

**Files:**
- Modify: `src/game/game-view.js`, `src/render/views/unit-views.js` (recoil), `scripts/scenarios.mjs`
- Create: `src/scenes/battle.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `Effects` (Task 7); events `fired`, `impact`, `explosion`, `unitDestroyed` (Tasks 2–3); `world.projectiles`; `isVisible` (plan 1b fog); `TerrainView.decals.scorch(x, y, r)`.
- Produces: `UnitViews.recoil(id)`; `GameView.effects`, `GameView.seen(x, z)` (fog check for effects), per-frame projectile trails (interpolated, rockets arc), smoke from vehicles below half health, smoke and flames from buildings below half health, scorch marks under explosions. Scene `battle` (`?scene=battle&ticks=…&idle=1`): two armies with turrets and yards on flat rock, fog off, both sides attack-moving at each other unless `idle=1`.

- [ ] **Step 1: Unit recoil**

Modify `src/render/views/unit-views.js` — add this method after `renderPos(u) { … }`:
```js
  recoil(id) {
    const v = this.views.get(id);
    if (v) v.recoil = 0.08;
  }
```

- [ ] **Step 2: Effects in GameView**

Modify `src/game/game-view.js`:
- add imports:
```js
import { Effects } from '../render/effects.js';
import { isVisible } from '../sim/fog.js';
```
- after `this.ghost = new PlacementGhost(r3d.scene, hf);` add:
```js
    this.effects = new Effects(r3d.scene, r3d.quality);
    this.smokeClock = 0;
```
- in `onEvent(e)`, at its end add:
```js
    switch (e.type) {
      case 'fired': this.onFired(e); break;
      case 'impact': if (this.seen(e.x, e.y)) this.effects.impact(e.x, this.heightAt(e.x, e.y) + 0.12, e.y, e.projectile, e.hit); break;
      case 'explosion':
        if (!this.seen(e.x, e.y)) break;
        this.effects.explosion(e.x, this.heightAt(e.x, e.y) + 0.25, e.y, e.size);
        this.terrain.decals?.scorch(e.x, e.y, e.size === 'large' ? 1.8 : e.size === 'medium' ? 1 : 0.6);
        break;
      case 'unitDestroyed':
        if (e.cause === 'crushed' || (UNITS[e.typeId]?.move === 'foot' && this.seen(e.x, e.y))) this.effects.smokePuff(e.x, this.heightAt(e.x, e.y) + 0.1, e.y);
        break;
    }
```
- add `import { UNITS } from '../data/units.js';` to the imports
- add these methods after `onEvent(e) { … }`:
```js
  /** Effects only show where the player can see (fog off: everywhere). */
  seen(x, z) {
    const w = this.world;
    if (!w.fogOfWar) return true;
    const tx = Math.floor(x), ty = Math.floor(z);
    return w.map.inBounds(tx, ty) && isVisible(w, this.house, tx, ty);
  }

  onFired(e) {
    if (!this.seen(e.x, e.y)) return;
    const dir = Math.atan2(e.ty - e.y, e.tx - e.x);
    const big = e.projectile !== 'bullet';
    let x = e.x, z = e.y, lift = 0.45;
    if (e.kind === 'unit') {
      const u = this.world.units.get(e.id);
      if (u) { const p = this.unitViews.renderPos(u); x = p.x; z = p.z; lift = u.move === 'foot' ? 0.2 : 0.34; }
      this.unitViews.recoil(e.id);
    }
    const reach = e.kind === 'unit' ? 0.38 : 0.45;
    x += Math.cos(dir) * reach;
    z += Math.sin(dir) * reach;
    this.effects.muzzle(x, this.heightAt(x, z) + lift, z, big);
  }

  /** Trails for shots in flight (interpolated between ticks; rockets arc) and smoke from the wounded. */
  combatEffects(dt, alpha) {
    const w = this.world;
    for (const p of w.projectiles.values()) {
      const x = p.px + (p.x - p.px) * alpha, z = p.py + (p.y - p.py) * alpha;
      if (!this.seen(x, z)) continue;
      const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1;
      const t = Math.min(1, Math.hypot(x - p.sx, z - p.sy) / total);
      const arc = p.projectile === 'rocket' ? 4 * t * (1 - t) * Math.min(1.2, 0.15 + total * 0.06) : 0;
      this.effects.trail(p.projectile, x, this.heightAt(x, z) + 0.35 + (0.2 - 0.35) * t + arc, z);
    }
    this.smokeClock += dt;
    if (this.smokeClock < 0.12) return;
    this.smokeClock = 0;
    for (const u of w.units.values()) {
      if (u.move === 'foot' || u.hp > u.maxHp / 2 || !this.seen(u.x, u.y) || Math.random() > 0.6) continue;
      const p = this.unitViews.renderPos(u);
      this.effects.smokePuff(p.x, this.heightAt(p.x, p.z) + 0.35, p.z);
    }
    for (const s of w.structures.values()) {
      if (s.hp > s.maxHp / 2 || s.type.isWall || !this.seen(s.x + s.w / 2, s.y + s.h / 2)) continue;
      const x = s.x + Math.random() * s.w, z = s.y + Math.random() * s.h;
      const y = this.heightAt(x, z) + 0.5;
      this.effects.smokePuff(x, y, z);
      if (s.hp < s.maxHp / 4 || Math.random() < 0.5) this.effects.flame(x, y - 0.1, z);
    }
  }
```
- in `frame(now)`, directly after `this.structureViews.sync(world, now);` add:
```js
    this.combatEffects(dt, alpha);
    this.effects.update(dt);
```

- [ ] **Step 3: Battle scene**

**File: `src/scenes/battle.js`**
```js
// Battle: two small armies with turrets on open rock, fog off, fighting within seconds — for
// screenshots of combat effects and for the end-to-end attack check (?scene=battle&idle=1 keeps
// both sides waiting for orders).
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { GameMap } from '../sim/map.js';
import { World } from '../sim/world.js';
import { G } from '../data/terrain.js';
import { GameView } from '../game/game-view.js';

const ARMIES = {
  atreides: { units: [['combatTank', 6, 9], ['combatTank', 6, 12], ['combatTank', 6, 15], ['siegeTank', 4, 12], ['quad', 8, 10], ['quad', 8, 14], ['infantry', 9, 12]], turret: [11, 5], yard: [1, 3], windtrap: [1, 6] },
  harkonnen: { units: [['combatTank', 32, 9], ['combatTank', 32, 12], ['combatTank', 32, 15], ['missileTank', 34, 12], ['quad', 30, 10], ['troopers', 29, 12], ['troopers', 29, 15]], turret: [27, 19], yard: [36, 19], windtrap: [36, 16] },
};

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const map = new GameMap(40, 24);
  map.ground.fill(G.ROCK);
  for (let x = 0; x < 40; x++) for (const y of [0, 1, 22, 23]) map.ground[map.idx(x, y)] = G.SAND;
  map.seed = 3;
  const world = new World({ map, seed: 3 });
  world.fogOfWar = false;
  world.addHouse('atreides', { credits: 1000 });
  world.addHouse('harkonnen', { credits: 1000, ai: true });
  for (const [house, a] of Object.entries(ARMIES)) {
    world.spawnStructure('constructionYard', house, ...a.yard);
    world.spawnStructure('windtrap', house, ...a.windtrap);
    world.spawnStructure(house === 'atreides' ? 'turret' : 'rocketTurret', house, ...a.turret);
    const ids = a.units.map(([typeId, x, y]) => world.spawnUnit(typeId, house, x, y, { heading: house === 'atreides' ? 0 : Math.PI }).id);
    if (!params.bool('idle')) world.issue(house, { type: 'attackMove', ids, x: house === 'atreides' ? 30 : 8, y: 12 });
  }
  for (let i = 0, n = params.num('ticks', 0); i < n; i++) world.step();
  const view = new GameView({ world, house: 'atreides', settings, params, focus: { x: 19, z: 13 } });
  view.start();
  return view;
}
```

Modify `src/main.js` — add to `SCENES`: `  battle: () => import('./scenes/battle.js'),`

Modify `scripts/scenarios.mjs` — add:
```js
  'battle-start': { query: 'scene=battle&dist=26', settleMs: 1500 },
  'battle-fight': { query: 'scene=battle&dist=22&ticks=300', settleMs: 1500 },
  'battle-aftermath': { query: 'scene=battle&dist=26&ticks=900', settleMs: 2500 },
```

- [ ] **Step 4: Look at it**

Run: `npm test && npm run smoke battle-start battle-fight battle-aftermath`
Expected: suite green; three screenshots, no console errors. Read them: `battle-fight` shows muzzle flashes, glowing shell tracers, rocket smoke trails arcing between the armies, orange fireballs with dark smoke where shots land, and damaged vehicles trailing smoke; `battle-aftermath` shows scorch marks on the rock, burning or smoking buildings where turrets were hit and fewer units. Tune colours, sizes or counts in `effects.js` if the fight reads poorly, then re-run.

- [ ] **Step 5: Commit**

```bash
git add src/game/game-view.js src/render/views/unit-views.js src/scenes/battle.js src/main.js scripts/scenarios.mjs
git commit -m "feat(game): combat on screen — muzzle flashes, trails, impacts, explosions, smoke, flames, scorch; battle scene

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: End screen and pause

**Files:**
- Create: `src/ui/end-screen.js`
- Modify: `src/game/game-view.js`, `src/ui/styles.css`
- Test: `tests/end-screen.test.mjs`

**Interfaces:**
- Consumes: `endStats(world, houseId)` and the `gameOver` event (Task 5).
- Produces: `formatTime(seconds)` → `'m:ss'`; `class EndScreen(root, {onReplay})` with `show(stats)` and `hide()`; the end screen appears 2.5 s after `gameOver` ("Mission accomplished", "Mission failed" or "Draw", the statistics table, the time, buttons "Play again" — reloads with the next seed — and "Keep watching"). `P` toggles pause (simulation stops, camera still moves, the message bar says so); `GameView.onKey(key, code, mods)` handles `P` before the controller.

- [ ] **Step 1: Write the failing test**

**File: `tests/end-screen.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime } from '../src/ui/end-screen.js';

test('game time reads as minutes and seconds', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(75), '1:15');
  assert.equal(formatTime(3601), '60:01');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/end-screen.test.mjs`
Expected: FAIL — cannot find `../src/ui/end-screen.js`.

- [ ] **Step 3: Implement**

**File: `src/ui/end-screen.js`**
```js
// End of a skirmish (spec §4.11, §7): "Mission accomplished", "Mission failed" or a draw, the player's
// statistics against everyone else, the game time, and buttons to play again or keep watching.
export const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class EndScreen {
  constructor(root, { onReplay }) {
    this.el = document.createElement('div');
    this.el.className = 'end-screen';
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (act === 'replay') onReplay();
      else if (act === 'close') this.hide();
    });
  }

  show(stats) {
    const box = document.createElement('div');
    box.className = 'end-box';
    const title = document.createElement('h2');
    title.textContent = stats.draw ? 'Draw' : stats.won ? 'Mission accomplished' : 'Mission failed';
    title.className = stats.won ? 'won' : 'lost';
    const table = document.createElement('table');
    const head = table.insertRow();
    for (const text of ['', 'You', 'Enemy']) { const th = document.createElement('th'); th.textContent = text; head.appendChild(th); }
    for (const r of stats.rows) {
      const tr = table.insertRow();
      for (const text of [r.label, r.you, r.enemy]) tr.insertCell().textContent = String(text);
    }
    const time = document.createElement('p');
    time.textContent = `Game time ${formatTime(stats.seconds)}`;
    const buttons = document.createElement('div');
    buttons.className = 'end-buttons';
    for (const [act, text] of [['replay', 'Play again'], ['close', 'Keep watching']]) {
      const b = document.createElement('button');
      b.dataset.act = act;
      b.textContent = text;
      buttons.appendChild(b);
    }
    box.append(title, table, time, buttons);
    this.el.replaceChildren(box);
    this.el.classList.add('show');
  }

  hide() { this.el.classList.remove('show'); }
}
```

Modify `src/ui/styles.css` — append:
```css
.end-screen { position: absolute; inset: 0; display: none; place-items: center; background: rgba(10,6,2,.55); pointer-events: auto; z-index: 20; }
.end-screen.show { display: grid; }
.end-box { min-width: 360px; padding: 18px 26px 20px; background: linear-gradient(#3a2a18, #1d1409); border: 3px solid #b8893a; border-radius: 4px; box-shadow: 0 6px 30px rgba(0,0,0,.7); text-align: center; }
.end-box h2 { margin: 0 0 12px; font: bold 26px "Trebuchet MS", sans-serif; letter-spacing: .06em; }
.end-box h2.won { color: #ffd24a; }
.end-box h2.lost { color: #ff7a5a; }
.end-box table { width: 100%; border-collapse: collapse; font-size: 14px; }
.end-box th { color: #c9a063; font-weight: bold; padding: 3px 8px; }
.end-box td { padding: 3px 8px; border-top: 1px solid rgba(184,137,58,.3); }
.end-box td:first-child { text-align: left; color: #d8c29a; }
.end-box p { margin: 12px 0; color: #d8c29a; }
.end-buttons { display: flex; gap: 10px; justify-content: center; }
.end-buttons button { padding: 7px 18px; font: bold 14px "Trebuchet MS", sans-serif; color: #1a1008; background: #d9a52e; border: 0; border-radius: 3px; cursor: pointer; }
.end-buttons button[data-act="close"] { background: #8e6843; color: #f5d48a; }
```

Modify `src/game/game-view.js`:
- add `import { EndScreen } from '../ui/end-screen.js';` and `import { endStats } from '../sim/victory.js';`
- after `this.panel = new SelectionPanel(…);` add:
```js
    this.endScreen = new EndScreen(document.getElementById('ui'), {
      onReplay: () => {
        const q = new URLSearchParams(location.search);
        q.set('seed', String((Number(q.get('seed')) || 1) + 1));
        location.search = q.toString();
      },
    });
    this.endAt = 0;
    this.userPaused = false;
```
- replace `new Keyboard((key, code, mods) => this.controller.onKey(key, code, mods));` with `new Keyboard((key, code, mods) => this.onKey(key, code, mods));`
- replace the visibility listener line with:
```js
    document.addEventListener('visibilitychange', () => { this.paused = document.hidden || this.lost || this.userPaused; this.last = performance.now(); });
```
- add these methods after `panelAction(id) { … }`:
```js
  onKey(key, code, mods) {
    if (key === 'p' && !mods.ctrl) {
      if (!mods.repeat) this.togglePause();
      return true;
    }
    return this.controller.onKey(key, code, mods);
  }

  togglePause() {
    this.userPaused = !this.userPaused;
    this.paused = document.hidden || this.lost || this.userPaused;
    this.hud.message(this.userPaused ? 'Paused — press P to continue' : 'Resumed', this.userPaused ? 1e9 : 1.5);
  }
```
- in `onEvent(e)`, add to the `switch` a case:
```js
      case 'gameOver': this.endAt = performance.now() + 2500; break;
```
- in `frame(now)`, directly before `this.fps?.frame();` add:
```js
    if (this.endAt && now >= this.endAt) { this.endAt = 0; this.endScreen.show(endStats(world, this.house)); }
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/end-screen.test.mjs && npm test`
Expected: PASS (1 new test); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/end-screen.js src/ui/styles.css src/game/game-view.js tests/end-screen.test.mjs
git commit -m "feat(ui): end screen with statistics and replay; P pauses the game

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Computer opponent — deployment, economy and base

**Files:**
- Create: `src/sim/ai.js`
- Modify: `src/sim/world.js` (AI system), `src/sim/harvest.js` (income rate)
- Test: `tests/ai.test.mjs`

**Interfaces:**
- Consumes: `computePower`, `builtStorage` (plan 1b); `canBuild`, `buildOptions` (plan 1b); `findPlacement` (plan 1b); `deploySpot` (plan 1a); `house.lines` (plan 1b); commands `deploy`, `move`, `build`, `hold`, `place`.
- Produces: `DIFFICULTY.{easy,normal,hard} = {buildSpeed, income, firstAttack, waveEvery, waveBase, waveGrow, waveMax, armyCap, turrets, reserve}`; `BUILD_ORDER[houseId]`; `createBrain(world, houseId, difficulty)` (sets `house.isAI`, `house.buildSpeed`, `house.incomeRate`, `house.brain = {difficulty, noRoom, rallied, wave, waves, nextAttack, commands}`); `updateAI(world)` (called at tick ≡ 10 mod 20); `enemyCentre(world, houseId)`; `nearestEnemyTarget(world, houseId, x, y)` → `{x, y}` or `null`. Brain behaviour here: deploy the MCV (or drive it to open rock first); keep power ahead of use; follow the house build order; silos above 80 % storage; turrets facing the enemy once a Heavy Factory stands; up to three refineries; two harvesters per refinery (max 6); a structure with no room is cancelled and not retried for 60 s. Harvest income is multiplied by `house.incomeRate` (Hard: 1.5).

- [ ] **Step 1: Write the failing tests**

**File: `tests/ai.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { setupSkirmish } from '../src/game/setup.js';
import { createBrain } from '../src/sim/ai.js';
import { computePower } from '../src/sim/economy.js';
import { flatWorld, run } from './helpers.mjs';

const owned = (world, houseId) => {
  const n = {};
  for (const s of world.structures.values()) if (s.house === houseId) n[s.typeId] = (n[s.typeId] ?? 0) + 1;
  return n;
};

test('the AI deploys its MCV and builds power and a refinery first', () => {
  const { world, rival } = setupSkirmish({ seed: 11 });
  createBrain(world, rival, 'normal');
  run(world, 90);
  const n = owned(world, rival);
  assert.ok(n.constructionYard === 1 && n.windtrap >= 1 && n.refinery >= 1, JSON.stringify(n));
  assert.ok([...world.units.values()].some((u) => u.house === rival && u.typeId === 'harvester'));
});

test('the AI follows its build order and keeps its power up', () => {
  const { world, rival } = setupSkirmish({ seed: 5, enemy: 'harkonnen' });
  createBrain(world, rival, 'normal');
  run(world, 600);
  const n = owned(world, rival);
  for (const t of ['outpost', 'wor', 'lightFactory', 'heavyFactory']) assert.ok(n[t] >= 1, `${t} in ${JSON.stringify(n)}`);
  const p = computePower(world, rival);
  assert.ok(p.produced >= p.used, `power ${p.produced}/${p.used}`);
});

test('an AI without room or money does not spam commands', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const m = world.map;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) > 1.5) m.ground[m.idx(x, y)] = G.MOUNTAIN;
  m.revision++;
  world.spawnStructure('constructionYard', 'harkonnen', 7, 7);
  const brain = createBrain(world, 'harkonnen', 'hard');
  const h = world.houses.get('harkonnen');
  h.credits = 0;
  run(world, 60);
  assert.equal(brain.commands, 0, 'nothing to pay with: no orders');
  h.credits = 5000;
  h.startBuffer = 5000;   // room to take the refunds back
  run(world, 120);
  assert.ok(brain.commands <= 6, `${brain.commands} commands in two minutes with nowhere to build`);
  assert.ok(Math.abs(h.credits - 5000) < 1e-6, 'every cancelled structure was refunded');
});

test('an AI that lost its yard carries on with what it has', () => {
  const world = flatWorld(32, 24, G.ROCK);
  for (const [t, x, y] of [['windtrap', 2, 2], ['windtrap', 5, 2], ['refinery', 2, 6], ['heavyFactory', 8, 6]]) world.spawnStructure(t, 'harkonnen', x, y);
  const h = world.houses.get('harkonnen');
  h.credits = 3000;
  h.startBuffer = 5000;
  createBrain(world, 'harkonnen', 'normal');
  run(world, 120);
  const harvesters = [...world.units.values()].filter((u) => u.house === 'harkonnen' && u.typeId === 'harvester').length;
  assert.ok(harvesters >= 2, `${harvesters} harvesters`);
});

test('Hard doubles down on income: harvest is worth half again as much', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 0;
  h.startBuffer = 5000;
  createBrain(world, 'atreides', 'hard');
  world.spawnStructure('refinery', 'atreides', 8, 8);
  const u = [...world.units.values()].find((x) => x.typeId === 'harvester');
  u.harvest.load = 700;
  u.harvest.state = 'toRefinery';
  run(world, 20);
  assert.ok(Math.abs(h.credits - 1050) < 1e-6, `credits ${h.credits}`);
  assert.equal(h.buildSpeed, 1.25);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/ai.test.mjs`
Expected: FAIL — cannot find `../src/sim/ai.js`.

- [ ] **Step 3: Implement**

**File: `src/sim/ai.js`**
```js
// Computer opponent (spec §4.10): one brain per AI house, thinking once a second. It sees the whole map,
// as the original's AI does, but acts only through world.issue, exactly like a player. Economy first:
// deploy the MCV, stay ahead on power, follow the house's build order, keep two harvesters per refinery
// and add silos when storage runs full. Then an army, rally points, base defence and attack waves.
import { STRUCTURES } from '../data/structures.js';
import { G } from '../data/terrain.js';
import { computePower, builtStorage } from './economy.js';
import { canBuild } from './tech.js';
import { findPlacement } from './placement.js';
import { deploySpot } from './deploy.js';

export const DIFFICULTY = {
  easy:   { buildSpeed: 0.7, income: 1, firstAttack: 480, waveEvery: 180, waveBase: 3, waveGrow: 1, waveMax: 10, armyCap: 12, turrets: 1, reserve: 300 },
  normal: { buildSpeed: 1, income: 1, firstAttack: 300, waveEvery: 150, waveBase: 4, waveGrow: 1.5, waveMax: 14, armyCap: 20, turrets: 2, reserve: 200 },
  hard:   { buildSpeed: 1.25, income: 1.5, firstAttack: 210, waveEvery: 120, waveBase: 5, waveGrow: 2, waveMax: 18, armyCap: 28, turrets: 4, reserve: 100 },
};

export const BUILD_ORDER = {
  atreides:  ['windtrap', 'refinery', 'windtrap', 'outpost', 'barracks', 'lightFactory', 'windtrap', 'heavyFactory', 'silo', 'refinery', 'windtrap'],
  harkonnen: ['windtrap', 'refinery', 'windtrap', 'outpost', 'wor', 'lightFactory', 'windtrap', 'heavyFactory', 'silo', 'refinery', 'windtrap'],
  ordos:     ['windtrap', 'refinery', 'windtrap', 'outpost', 'barracks', 'lightFactory', 'windtrap', 'heavyFactory', 'silo', 'refinery', 'windtrap'],
};

const NO_ROOM_RETRY = 60;   // seconds before a structure that found no spot is tried again

export function createBrain(world, houseId, difficulty = 'normal') {
  const house = world.houses.get(houseId);
  const level = DIFFICULTY[difficulty] ? difficulty : 'normal';
  const d = DIFFICULTY[level];
  house.isAI = true;
  house.buildSpeed = d.buildSpeed;
  house.incomeRate = d.income;
  house.brain = { difficulty: level, noRoom: {}, rallied: [], wave: [], waves: 0, nextAttack: d.firstAttack, commands: 0 };
  return house.brain;
}

export function updateAI(world) {
  for (const house of world.houses.values()) if (house.brain && !house.defeated) think(world, house);
}

function issue(world, house, cmd) {
  house.brain.commands++;
  world.issue(house.id, cmd);
}

function survey(world, house) {
  const mine = [], units = [], count = {};
  for (const s of world.structures.values()) if (s.house === house.id) { mine.push(s); count[s.typeId] = (count[s.typeId] ?? 0) + 1; }
  for (const u of world.units.values()) if (u.house === house.id) units.push(u);
  const yard = mine.find((s) => s.typeId === 'constructionYard') ?? null;
  const anchor = yard ?? mine[0] ?? null;
  return { mine, units, count, yard, home: anchor ? { x: anchor.x + 1, y: anchor.y + 1 } : null };
}

function think(world, house) {
  const view = survey(world, house);
  if (!view.yard) deployMcv(world, house, view);
  else buildBase(world, house, view);
  keepHarvesters(world, house, view);
}

function deployMcv(world, house, view) {
  const mcv = view.units.find((u) => u.type.deploysTo);
  if (!mcv || mcv.order.type === 'deploy' || mcv.step || mcv.pathState !== 'none') return;
  if (deploySpot(world, mcv)) { issue(world, house, { type: 'deploy', ids: [mcv.id] }); return; }
  const map = world.map;
  for (let k = 0; k < 12; k++) {   // drive to open rock nearby and try again there
    const x = mcv.tx + world.rng.int(11) - 5, y = mcv.ty + world.rng.int(11) - 5;
    if (!map.inBounds(x, y)) continue;
    const i = map.idx(x, y);
    if (map.ground[i] === G.ROCK && !map.unit[i] && !map.structure[i]) { issue(world, house, { type: 'move', ids: [mcv.id], x, y }); return; }
  }
}

export function enemyCentre(world, houseId) {
  let sx = 0, sy = 0, n = 0;
  for (const s of world.structures.values()) if (s.house !== houseId) { sx += s.x + s.w / 2; sy += s.y + s.h / 2; n++; }
  if (!n) for (const u of world.units.values()) if (u.house !== houseId && u.isGround) { sx += u.x; sy += u.y; n++; }
  return n ? { x: sx / n, y: sy / n } : null;
}

/** Where to send an attack: below the nearest enemy building (reachable ground), else the nearest enemy unit. */
export function nearestEnemyTarget(world, houseId, x, y) {
  let best = null, bestD = Infinity;
  for (const s of world.structures.values()) {
    if (s.house === houseId) continue;
    const d = Math.hypot(s.x + s.w / 2 - x, s.y + s.h / 2 - y);
    if (d < bestD) { bestD = d; best = { x: s.x + Math.floor(s.w / 2), y: Math.min(world.map.h - 1, s.y + s.h) }; }
  }
  if (best) return best;
  for (const u of world.units.values()) {
    if (u.house === houseId || !u.isGround) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d < bestD) { bestD = d; best = { x: u.tx, y: u.ty }; }
  }
  return best;
}

function towardsEnemy(world, house, view, reach) {
  const foe = enemyCentre(world, house.id) ?? { x: world.map.w / 2, y: world.map.h / 2 };
  const dx = foe.x - view.home.x, dy = foe.y - view.home.y, d = Math.hypot(dx, dy) || 1;
  return { x: Math.round(view.home.x + (dx / d) * reach), y: Math.round(view.home.y + (dy / d) * reach) };
}

function buildBase(world, house, view) {
  const b = house.brain;
  const item = house.lines.structure.current;
  if (item?.state === 'ready') {
    const turret = item.typeId === 'turret' || item.typeId === 'rocketTurret';
    const anchor = turret ? towardsEnemy(world, house, view, 6) : view.home;
    const spot = findPlacement(world, house.id, item.typeId, anchor.x, anchor.y, 12);
    if (spot) issue(world, house, { type: 'place', typeId: item.typeId, x: spot.x, y: spot.y });
    else { b.noRoom[item.typeId] = world.time; issue(world, house, { type: 'hold', typeId: item.typeId }); }   // a ready structure cancels at once, refunded
    return;
  }
  if (item) return;
  const next = nextStructure(world, house, view);
  if (next && house.credits >= Math.min(STRUCTURES[next].cost, 150)) issue(world, house, { type: 'build', typeId: next });
}

function nextStructure(world, house, view) {
  const b = house.brain, id = house.id, d = DIFFICULTY[b.difficulty];
  const can = (t) => canBuild(world, id, t) && world.time - (b.noRoom[t] ?? -1e9) >= NO_ROOM_RETRY;
  const has = (t) => view.count[t] ?? 0;
  const power = computePower(world, id);
  if (power.produced < power.used + 20 && can('windtrap')) return 'windtrap';
  const need = {};
  for (const t of BUILD_ORDER[id] ?? BUILD_ORDER.atreides) {
    need[t] = (need[t] ?? 0) + 1;
    if (has(t) < need[t] && can(t)) return t;
  }
  if (house.credits > Math.max(builtStorage(world, id), house.startBuffer ?? 0) * 0.8 && can('silo')) return 'silo';
  if (has('heavyFactory') && has('turret') + has('rocketTurret') < d.turrets) {
    if (can('rocketTurret')) return 'rocketTurret';
    if (can('turret')) return 'turret';
  }
  if (has('refinery') < 3 && view.units.filter((u) => u.typeId === 'harvester').length >= 2 * has('refinery') && can('refinery')) return 'refinery';
  return null;
}

function keepHarvesters(world, house, view) {
  const refineries = view.count.refinery ?? 0;
  if (!refineries || !view.count.heavyFactory) return;
  const heavy = house.lines.heavy;
  const queued = (heavy.current?.typeId === 'harvester' ? 1 : 0) + heavy.queue.filter((t) => t === 'harvester').length;
  const have = view.units.filter((u) => u.typeId === 'harvester').length;
  if (have + queued < Math.min(6, 2 * refineries) && house.credits >= 300 && canBuild(world, house.id, 'harvester')) issue(world, house, { type: 'build', typeId: 'harvester' });
}
```

Modify `src/sim/world.js`:
- add `import { updateAI } from './ai.js';`
- in `step()`, directly before `    if (this.tick % 20 === 0) updateVictory(this);` add:
```js
    if (this.tick % 20 === 10) updateAI(this);
```

Modify `src/sim/harvest.js` — in the `unloading` case replace `      addCredits(world, house, amount);` with:
```js
      addCredits(world, house, amount * (house.incomeRate ?? 1));   // Hard AIs earn half again as much (spec §4.10)
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/ai.test.mjs && npm test`
Expected: PASS (5 new tests); suite green. If the build-order test times out on credits, check that the refinery's free harvester is working (the AI does not touch it) and that `nextStructure` never returns a structure `canBuild` rejects.

- [ ] **Step 5: Commit**

```bash
git add src/sim/ai.js src/sim/world.js src/sim/harvest.js tests/ai.test.mjs
git commit -m "feat(sim): computer opponent economy — MCV deployment, power, build orders, harvesters, silos, turrets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Computer opponent — army, attack waves, defence, difficulty

**Files:**
- Modify: `src/sim/ai.js`, `src/game/setup.js`, `src/scenes/skirmish.js`, `scripts/scenarios.mjs`
- Test: `tests/ai.test.mjs` (additions), `tests/setup.test.mjs` (addition)

**Interfaces:**
- Consumes: Task 10's brain; commands `build`, `setRally`, `attack`, `attackMove` (Task 4); `isArmed` (Task 2); `buildOptions` (plan 1b).
- Produces: army production (weighted house roster per line while credits exceed `reserve` and the army is below `armyCap`), rally points five tiles towards the enemy, defence (idle units within 24 tiles attack the nearest enemy that comes within 10 tiles of any AI building), attack waves (first after `firstAttack` seconds, then every `waveEvery`; size `min(waveMax, waveBase + waveGrow × waves)`; wave members that go idle hunt the next target; event `aiAttack {house, size, x, y}`). `setupSkirmish({…, difficulty = 'normal', aiPlayer = false})` gives the rival a brain (and the player too when `aiPlayer`, for soak tests); skirmish query `ai=easy|normal|hard`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/ai.test.mjs`:
```js
test('the AI builds an army and sends its first wave after the attack timer', () => {
  const { world, house, rival } = setupSkirmish({ seed: 11, difficulty: 'hard' });
  const waves = [];
  for (let t = 0; t < 9 * 60 * 20 && !waves.length; t++) {
    world.step();
    for (const e of world.events.drain()) if (e.type === 'aiAttack' && e.house === rival) waves.push({ ...e, at: world.time });
  }
  assert.equal(waves.length, 1, 'a wave went out');
  assert.ok(waves[0].at >= 210 - 1, `not before the timer (${waves[0].at})`);
  assert.ok(waves[0].size >= 5);
  run(world, 180);
  assert.ok(world.houses.get(rival).stats.unitsKilled + world.houses.get(rival).stats.structuresKilled > 0, 'the wave hurt the player');
  assert.ok(world.houses.get(house).stats.unitsLost + world.houses.get(house).stats.structuresLost > 0);
});

test('the AI defends its base against intruders', () => {
  const world = flatWorld(40, 24, G.ROCK);
  for (const [t, x, y] of [['constructionYard', 2, 2], ['windtrap', 5, 2]]) world.spawnStructure(t, 'harkonnen', x, y);
  const guards = [world.spawnUnit('combatTank', 'harkonnen', 3, 12), world.spawnUnit('combatTank', 'harkonnen', 5, 12)];
  createBrain(world, 'harkonnen', 'normal');
  world.houses.get('harkonnen').credits = 0;
  const raider = world.spawnUnit('quad', 'atreides', 12, 4);
  run(world, 2);
  assert.ok(guards.every((u) => u.order.type === 'attack' && u.order.target.id === raider.id), guards.map((u) => u.order.type).join());
});
```

Append to `tests/setup.test.mjs`:
```js
test('skirmish difficulty goes to the rival\'s brain; aiPlayer makes both sides computer players', () => {
  const { world, house, rival } = setupSkirmish({ seed: 3, difficulty: 'easy' });
  assert.equal(world.houses.get(rival).brain.difficulty, 'easy');
  assert.equal(world.houses.get(house).brain, undefined);
  const both = setupSkirmish({ seed: 3, aiPlayer: true });
  assert.ok(both.world.houses.get(both.house).brain && both.world.houses.get(both.rival).brain);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test tests/ai.test.mjs tests/setup.test.mjs`
Expected: FAIL — no `aiAttack` event within nine minutes; the guards stay idle; `brain` is undefined after `setupSkirmish`.

- [ ] **Step 3: Implement**

Modify `src/sim/ai.js`:
- add imports `import { buildOptions } from './tech.js';` (merge with the existing tech import: `import { canBuild, buildOptions } from './tech.js';`) and `import { isArmed } from './combat.js';`
- replace `think(world, house)` with:
```js
function think(world, house) {
  const view = survey(world, house);
  if (!view.yard) deployMcv(world, house, view);
  else buildBase(world, house, view);
  keepHarvesters(world, house, view);
  if (!view.home) return;
  buildArmy(world, house, view);
  rally(world, house, view);
  defend(world, house, view);
  attack(world, house, view);
}
```
- append:
```js
const ARMY_WEIGHTS = { combatTank: 6, siegeTank: 3, missileTank: 3, quad: 2, trike: 2, raider: 2, infantry: 2, troopers: 2, soldier: 1, trooper: 1 };
const FACTORIES = ['barracks', 'wor', 'lightFactory', 'heavyFactory'];

function weightedPick(rng, pool) {
  let r = rng.next() * pool.reduce((n, t) => n + ARMY_WEIGHTS[t], 0);
  for (const t of pool) if ((r -= ARMY_WEIGHTS[t]) < 0) return t;
  return pool[pool.length - 1];
}

function buildArmy(world, house, view) {
  const d = DIFFICULTY[house.brain.difficulty];
  if (view.units.filter((u) => isArmed(u.type)).length >= d.armyCap) return;
  const options = buildOptions(world, house.id);
  for (const line of ['heavy', 'light', 'infantry']) {
    const l = house.lines[line];
    if (l.current || l.queue.length || house.credits < d.reserve) continue;
    const pool = options[line].filter((t) => ARMY_WEIGHTS[t]);
    if (pool.length) issue(world, house, { type: 'build', typeId: weightedPick(world.rng, pool) });
  }
}

function rally(world, house, view) {
  const b = house.brain;
  const spot = towardsEnemy(world, house, view, 5);
  for (const s of view.mine) {
    if (!FACTORIES.includes(s.typeId) || b.rallied.includes(s.id)) continue;
    b.rallied.push(s.id);
    issue(world, house, { type: 'setRally', structureId: s.id, x: spot.x, y: spot.y });
  }
}

function defend(world, house, view) {
  const b = house.brain;
  let intruder = null, best = 10;
  for (const u of world.units.values()) {
    if (u.house === house.id || !u.isGround) continue;
    for (const s of view.mine) {
      const d = Math.hypot(u.x - s.x - s.w / 2, u.y - s.y - s.h / 2);
      if (d < best) { best = d; intruder = u; }
    }
  }
  if (!intruder) return;
  const ids = view.units
    .filter((u) => isArmed(u.type) && !b.wave.includes(u.id) && u.order.type !== 'attack' && Math.hypot(u.x - intruder.x, u.y - intruder.y) < 24)
    .map((u) => u.id);
  if (ids.length) issue(world, house, { type: 'attack', ids, targetKind: 'unit', targetId: intruder.id });
}

function attack(world, house, view) {
  const b = house.brain, d = DIFFICULTY[b.difficulty];
  b.wave = b.wave.filter((id) => world.units.has(id));
  const idle = b.wave.map((id) => world.units.get(id)).filter((u) => u.order.type === 'idle');
  if (idle.length) {   // wave members that reached their target hunt the next one
    const t = nearestEnemyTarget(world, house.id, idle[0].x, idle[0].y);
    if (t) issue(world, house, { type: 'attackMove', ids: idle.map((u) => u.id), x: t.x, y: t.y });
  }
  if (world.time < b.nextAttack) return;
  const size = Math.min(d.waveMax, Math.round(d.waveBase + d.waveGrow * b.waves));
  const ready = view.units.filter((u) => isArmed(u.type) && !b.wave.includes(u.id) && (u.order.type === 'idle' || u.order.type === 'guard'));
  if (ready.length < size) { b.nextAttack = world.time + 15; return; }
  const target = nearestEnemyTarget(world, house.id, view.home.x, view.home.y);
  if (!target) return;
  const group = ready.slice(0, size).map((u) => u.id);
  issue(world, house, { type: 'attackMove', ids: group, x: target.x, y: target.y });
  b.wave.push(...group);
  b.waves++;
  b.nextAttack = world.time + d.waveEvery;
  world.events.push('aiAttack', { house: house.id, size: group.length, x: target.x, y: target.y });
}
```

Modify `src/game/setup.js`:
- add `import { createBrain } from '../sim/ai.js';`
- change the signature to `export function setupSkirmish({ seed = 1, size = 64, house = 'atreides', enemy = null, credits = 3000, fog = true, difficulty = 'normal', aiPlayer = false } = {}) {`
- after the two `spawnStartingForces(…)` lines add:
```js
  createBrain(world, rival, difficulty);
  if (aiPlayer) createBrain(world, house, difficulty);
```

Modify `src/scenes/skirmish.js` — add `difficulty: params.str('ai', 'normal')` to the `setupSkirmish({ … })` call.

Modify `scripts/scenarios.mjs` — add:
```js
  'skirmish-ai-base': { query: 'scene=skirmish&seed=11&house=atreides&fog=0&ticks=6000&dist=60', settleMs: 1500 },
```

- [ ] **Step 4: Run the tests and look at an AI base**

Run: `node --test tests/ai.test.mjs tests/setup.test.mjs && npm test && npm run smoke skirmish-ai-base`
Expected: PASS (3 new tests); suite green; the screenshot (five minutes into a game, fog off, zoomed out) shows the computer's base — yard, wind traps, refinery, outpost, factories — and its units near the rally point. If the first-wave test fails on "the wave hurt the player", check that attack-move targets a reachable tile below the player's MCV or buildings.

- [ ] **Step 5: Commit**

```bash
git add src/sim/ai.js src/game/setup.js src/scenes/skirmish.js scripts/scenarios.mjs tests/ai.test.mjs tests/setup.test.mjs
git commit -m "feat(sim): computer opponent army — weighted rosters, rally points, base defence, growing attack waves, difficulty

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: AI-versus-AI soak and the end-to-end battle

**Files:**
- Create: `tests/soak-ai.test.mjs`
- Modify: `scripts/e2e.mjs`, `src/game/debug.js`

**Interfaces:**
- Consumes: everything above; `checkInvariants` (plan 1b); the battle scene (Task 8); `GameView` pause (Task 9).
- Produces: the spec §10 soak — two computer players for fifteen game minutes with no exceptions, invariants holding every minute, both building at least six structures, harvesting at least 1400 credits of spice and sending at least one wave, blood shed on the field and no unit stuck for more than a minute on a move order; debug hooks `tick()`, `paused()`, `outcome()`; e2e checks "a tank attacks an enemy tank" (battle scene) and "P pauses the simulation".

- [ ] **Step 1: Write the soak test**

**File: `tests/soak-ai.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupSkirmish } from '../src/game/setup.js';
import { checkInvariants } from '../src/sim/invariants.js';

test('AI against AI: fifteen game minutes of building, harvesting and fighting', () => {
  const { world, house, rival } = setupSkirmish({ seed: 7, house: 'atreides', enemy: 'harkonnen', fog: false, aiPlayer: true, difficulty: 'normal' });
  const placed = new Map(), waves = new Map(), still = new Map();
  let stuck = null;
  for (let t = 0; t < 15 * 60 * 20 && !world.outcome; t++) {
    world.step();
    for (const e of world.events.drain()) {
      if (e.type === 'structurePlaced') placed.set(e.house, (placed.get(e.house) ?? 0) + 1);
      if (e.type === 'aiAttack') waves.set(e.house, (waves.get(e.house) ?? 0) + 1);
    }
    if (t % 1200 === 0) assert.deepEqual(checkInvariants(world), [], `invariants at ${t / 20} s`);
    if (t % 20) continue;
    for (const u of world.units.values()) {   // a unit told to go somewhere that stays put for a minute is stuck
      const moving = (u.order.type === 'move' || u.order.type === 'attackMove') && !u.target;
      const key = `${u.tx},${u.ty}`, s = still.get(u.id);
      if (!moving) { still.delete(u.id); continue; }
      if (!s || s.key !== key) still.set(u.id, { key, since: world.time });
      else if (world.time - s.since > 60 && !stuck) stuck = `${u.typeId} ${u.id} at ${key} (${u.order.type})`;
    }
  }
  for (const id of [house, rival]) {
    const h = world.houses.get(id);
    assert.ok((placed.get(id) ?? 0) >= 6, `${id} built ${placed.get(id) ?? 0} structures`);
    assert.ok(h.stats.spiceHarvested >= 1400, `${id} harvested ${Math.round(h.stats.spiceHarvested)}`);
    assert.ok((waves.get(id) ?? 0) >= 1, `${id} never attacked`);
  }
  const blood = [house, rival].reduce((n, id) => n + world.houses.get(id).stats.unitsKilled + world.houses.get(id).stats.structuresKilled, 0);
  assert.ok(blood > 0, 'nobody fought');
  assert.equal(stuck, null, stuck);
});
```

- [ ] **Step 2: Run it**

Run: `node --test tests/soak-ai.test.mjs`
Expected: PASS within about a minute. A failure names the house or the stuck unit; fix the cause in the owning module (AI, combat or movement) with a focused test there first, then re-run.

- [ ] **Step 3: Debug hooks and the e2e battle**

Modify `src/game/debug.js` — add `view` to the destructured parameters (`{ world, house, selection, project, positionOf, rig, controller, view }`) and these entries to the returned object:
```js
    tick: () => world.tick,
    paused: () => !!view?.paused,
    outcome: () => world.outcome,
```

Modify `src/game/game-view.js` — in `start()`, add `view: this` to the `createDebugApi({ … })` call.

Modify `scripts/e2e.mjs` — directly before `  await sleep(1500);` (the line before the final screenshot) insert:
```js
  await page.key('p', { code: 'KeyP' });
  await sleep(300);
  const pausedAt = await ev('__dune.tick()');
  await sleep(1200);
  check('P pauses the simulation', (await ev('__dune.paused()')) && (await ev('__dune.tick()')) === pausedAt);
  await page.key('p', { code: 'KeyP' });
  await sleep(1200);
  check('P again resumes it', (await ev('__dune.tick()')) > pausedAt);

  const battle = await openPage(chrome, `http://localhost:${PORT}/?scene=battle&idle=1&quality=low&dist=24`);
  await battle.waitFor('window.__dune && window.__dune.ready === true', 120000);
  await sleep(600);
  const bev = (expr) => battle.eval(expr);
  const [mine] = await bev(`__dune.units('combatTank')`);
  const foes = await bev(`__dune.units('combatTank', 'harkonnen')`);
  const foe = foes.sort((a, b) => Math.abs(a.ty - mine.ty) - Math.abs(b.ty - mine.ty))[0];
  const ms = await bev(`__dune.screenOfUnit(${mine.id})`);
  await battle.click(ms.x, ms.y);
  await sleep(300);
  const fs = await bev(`__dune.screenOfUnit(${foe.id})`);
  await battle.click(fs.x, fs.y);
  let hurt = false;
  for (let i = 0; i < 150 && !hurt; i++) {
    await sleep(200);
    const f = await bev(`__dune.unit(${foe.id})`);
    hurt = !f || f.hp < 200;
  }
  check('a tank sent at an enemy tank drives up and hits it', hurt);
  const battleErrors = battle.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[exception]'));
  check('no console errors in the battle', battleErrors.length === 0, battleErrors.join(' | '));
  battle.close();
```
and add `openPage` is already imported at the top (it is).

- [ ] **Step 4: Run everything**

Run: `npm test && npm run smoke && npm run e2e`
Expected: all Node tests pass (the soak included); every smoke scenario writes a screenshot without console errors; e2e prints `18/18 checks passed`.

- [ ] **Step 5: Commit**

```bash
git add tests/soak-ai.test.mjs scripts/e2e.mjs src/game/debug.js src/game/game-view.js
git commit -m "test: fifteen-minute AI-versus-AI soak; e2e pause and battle checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: README and final verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the finished plan-1c game.
- Produces: README sections for combat controls, the computer opponent, the end of a game and the new scenes/flags.

- [ ] **Step 1: Update the README**

Modify `README.md`:
- in the Status section, replace its paragraph with:
```markdown
Plans 1a–1c are done: a full skirmish against a computer opponent on Easy, Normal or Hard — build a
base, harvest spice, raise an army, fight with the original weapons (cannons always hit, rockets
scatter, tanks crush infantry, turrets guard the base) and win or lose. Sound and more effects arrive
with plan 1d; the House of IX specials, air units, sandworms and the Palace with plan 2.
```
- in the controls table add rows:
```markdown
| Left click an enemy (with units selected) | Attack it (Modern: right click) |
| A, then click | Attack-move: go there and fight whatever is met on the way |
| Ctrl + click | Force fire at a unit, building or the ground |
| G | Area guard: engage what comes near, then return |
| P | Pause and resume |
```
- add a section:
```markdown
## The computer opponent

`?ai=easy|normal|hard` (default Normal). The computer deploys its MCV, builds in its house's order,
keeps its power up, runs two harvesters per refinery, defends its base and sends growing attack waves
— the first after about eight minutes on Easy, five on Normal and three and a half on Hard, where it
also builds faster and earns half again as much from spice. Like the original, it ignores fog of war.
The game ends when one side has no buildings and no MCV left.
```
- in the scenes list add `battle` (two armies fighting; `&idle=1` waits for orders; `&ticks=300` skips ahead)

- [ ] **Step 2: Full verification**

Run: `npm test && npm run smoke && npm run e2e`
Expected: everything green, as at the end of Task 12.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README for combat, the computer opponent and the end of a game

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Deferred to plan 1d

- All sound: the Web Audio engine, synthesized effects, positional playback and voice limits.
- Dust trails, harvest dust, construction dust and other ambient particles.
- The plan-1b deferred minors (placement ghost cells, start-buffer revocation, loaded harvesters slower, the implied Wind Trap prerequisite, tooltip prerequisites, context-loss reload button, first unshrouded frames, spice statistics, radar layout reads, integer placement coordinates) and plan-1a #14.
