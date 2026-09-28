# Plan 1b — Base building and economy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the plan-1a sandbox into a base-building RTS: a C&C sidebar with 3D icons builds structures and units, structures are placed on rock with Dune II's concrete rule, wind traps power the base, harvesters bring spice to refineries for credits, fog of war hides the map, the radar needs a powered Outpost, and every standard structure has a 3D model.

**Architecture:** New simulation systems in `src/sim/` (economy, placement, tech, production, structure actions, harvest, fog, spawn) are called from `World.step()` in a fixed order; the UI (`src/ui/`) reads pure view-models and issues commands through `world.issue`, exactly like plan 1a. `src/game/game-view.js` takes over the frame loop from the skirmish scene so every scene shares one presentation stack.

**Tech Stack:** as plan 1a — ES modules, vendored Three.js 0.186.1, Node 24 `node:test`, headless Chrome over CDP for smoke and end-to-end runs.

**Spec:** `docs/superpowers/specs/2026-09-28-dune2-3d-design.md` — this plan covers §4.3 (economy), §4.4 (power), §4.5 (placement, production, tech; upgrades still count as bought), §4.9 (fog, radar), §5.3 (standard structure models), §5.6 (sidebar, placement grid, cursors, selection panel), §5.7 (sidebar clicks, rally, sell/repair modes) and the plan-1a deferred minors (`docs/superpowers/notes/2026-09-29-plan1a-execution-notes.md`). Combat, AI, effects and sound are plan 1c.

## Global Constraints

- Everything from plan 1a's Global Constraints still holds (no build step, pure sim under Node, 20 Hz deterministic sim, tile = world unit, headings, `tuning.js` owns conversions, house colours, English text, no original assets, instanced rendering, conventional commits with the Co-Authored-By line).
- Credits are floats inside the simulation; the UI shows `Math.floor(credits)`. Nothing ever makes credits negative.
- Structures deferred to plan 2 are never offered in 1b: `hiTech`, `repair`, `starport`, `ix`, `palace`; units deferred: `carryall`, `ornithopter`, `deviator`, `sonicTank`, `devastator`, `saboteur`, `frigate`, `sandworm` (single list in `src/data/phase.js`).
- Factory upgrades count as already bought (spec §11 phase 1).
- The sidebar is 272 px wide; the 3D canvas and overlay shrink to the space left of it.
- New sim systems run in this order each tick: commands → path queue → per-unit (harvester brain, movement) → production → repairs → power (every 10 ticks) → fog (every 5 ticks) → production revalidation (every 20 ticks).

## Review Focus

1. **Placing a structure on sand, over units, off the map, or away from the base** must be refused with nothing spent and the ready item kept; the ghost shows red cells. → Task 3 tests (`checkPlacement`) and Task 5 test "placing on an invalid spot keeps the structure ready".
2. **Running out of credits mid-production** must pause the item without going negative and resume when spice arrives; cancelling refunds exactly what was paid. → Task 5 tests "insufficient funds stalls and resumes" and "hold then cancel refunds what was paid".
3. **Full storage while harvesting** caps credits, loses the extra spice with one warning per 15 s, and the harvester still empties and goes back to work. → Task 7 test "full storage loses spice but the harvester keeps working".
4. **Several harvesters at one refinery, or the refinery sold mid-unload,** must not deadlock: one docks, the rest queue; a sold refinery sends them to another refinery or makes them wait. → Task 7 tests "two harvesters share one refinery" and "selling the refinery mid-unload releases the harvester".
5. **Selling a store (refinery/silo) while holding more credits than the remaining capacity** clamps credits to capacity and the sidebar never shows more than the house can store. → Task 6 test "selling a store clamps credits to the remaining capacity".

## File map (new and changed)

```
src/core/guard.js                 guardFrame: first exception stops the loop and shows an error screen
src/game/game-view.js             presentation stack + frame loop shared by all scenes
src/data/phase.js                 items deferred to plan 2
src/sim/invariants.js             debug-mode consistency checks
src/sim/spawn.js                  findFreeTile (moved from game/setup.js), exitTile
src/sim/economy.js                storage, credits, power, radar availability
src/sim/placement.js              checkPlacement, placeStructure (concrete rule)
src/sim/tech.js                   build options per production line
src/sim/production.js             production lines, build/hold/place/rally/primary
src/sim/structure-actions.js      sell, repair
src/sim/harvest.js                harvester brain, refinery docking, free harvester
src/sim/fog.js                    explored/visible layers, structure sightings
src/render/grade-pass.js          colour grade + vignette
src/render/icons.js               offscreen model icons for the sidebar
src/render/placement-ghost.js     translucent ghost + tile grid for placement
src/render/models/structures/*.js windtrap, refinery, silo, outpost, barracks, wor, light-factory,
                                  heavy-factory, turret (gun + rocket), wall, common
src/ui/fps.js                     ?fps=1 meter
src/ui/sidebar-model.js           pure sidebar view-model
src/ui/sidebar.js, radar.js, radar-model.js, selection-panel.js, crash.js
src/scenes/stress.js, structures.js, base.js
```

---

### Task 1: Robustness, GameView and the stress scene

**Files:**
- Create: `src/core/guard.js`, `src/sim/invariants.js`, `src/render/grade-pass.js`, `src/ui/fps.js`, `src/ui/crash.js`, `src/game/game-view.js`, `src/scenes/stress.js`
- Modify: `src/render/renderer.js`, `src/render/quality.js`, `src/render/heightfield.js`, `src/input/controller.js`, `src/scenes/skirmish.js`, `src/main.js`, `scripts/scenarios.mjs`, `src/ui/styles.css`
- Test: `tests/robustness.test.mjs`, `tests/controller.test.mjs` (additions), `tests/heightfield.test.mjs` (addition), `tests/quality.test.mjs` (addition)

**Interfaces:**
- Produces: `guardFrame(frame, onError)` → wrapped function returning `true` while healthy, `false` after the first exception; `checkInvariants(world)` → `string[]`; `GradeShader`, `createGradePass()`; `terrainSubFor(mapW, preset)`; `Heightfield.maxHeight`; `FpsMeter(root, renderer).frame(dt)`; `showCrash(err)`; `class GameView({world, house, settings, params, focus:{x,z}})` with `start()`, fields `world, house, r3d, hf, terrain, unitViews, structureViews, rig, controller, selection, groups, overlay, hud, project, ground, positionOf, heightAt`, hook `onFrame(dtSeconds)`; `Renderer3D.onContextRestored`.
- Controller behaviour change: held keys (auto-repeat) never re-issue hotkeys or group taps; a ground click on a tile no selected unit can enter issues no order.

- [ ] **Step 1: Write the failing tests**

**File: `tests/robustness.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { guardFrame } from '../src/core/guard.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { createGradePass } from '../src/render/grade-pass.js';
import { G } from '../src/data/terrain.js';
import { flatWorld } from './helpers.mjs';

test('guardFrame reports the first exception once and stops', () => {
  const errors = [];
  let calls = 0;
  const frame = guardFrame(() => { calls++; if (calls === 2) throw new Error('boom'); }, (e) => errors.push(e.message));
  assert.equal(frame(), true);
  assert.equal(frame(), false);
  assert.equal(frame(), false);
  assert.deepEqual(errors, ['boom']);
  assert.equal(calls, 2);
});

test('invariants hold for a healthy world and catch corruption', () => {
  const world = flatWorld(16, 16, G.ROCK);
  world.spawnUnit('combatTank', 'atreides', 3, 3);
  const cy = world.spawnStructure('constructionYard', 'atreides', 8, 8);
  assert.deepEqual(checkInvariants(world), []);
  world.map.unit[world.map.idx(12, 12)] = 999;
  world.map.structure[world.map.idx(cy.x, cy.y)] = 0;
  const problems = checkInvariants(world);
  assert.ok(problems.some((p) => p.includes('missing unit 999')));
  assert.ok(problems.some((p) => p.includes(`structure ${cy.id} lost tile`)));
});

test('grade pass carries tint, saturation and vignette uniforms', () => {
  const pass = createGradePass();
  assert.equal(pass.uniforms.uVignette.value, 0.32);
  assert.ok(pass.material.fragmentShader.includes('smoothstep'));
});
```

Append to `tests/quality.test.mjs`:
```js
import { terrainSubFor } from '../src/render/quality.js';

test('large maps use at most three terrain vertices per tile side', () => {
  assert.equal(terrainSubFor(128, QUALITY.high), 3);
  assert.equal(terrainSubFor(96, QUALITY.medium), 3);
  assert.equal(terrainSubFor(64, QUALITY.medium), 4);
  assert.equal(terrainSubFor(128, QUALITY.low), 3);
});
```

Append to `tests/heightfield.test.mjs`:
```js
test('maxHeight is the highest vertex', () => {
  const hf = new Heightfield(testMap(), { sub: 2, seed: 3 });
  assert.equal(hf.maxHeight, Math.max(...hf.data));
});
```

Append to `tests/controller.test.mjs`:
```js
test('held keys do not repeat orders or group taps', () => {
  const { tank, c, issued, looked } = setup();
  c.selection.set([tank.id]);
  c.onKey('x', 'KeyX', NONE);
  c.onKey('x', 'KeyX', { ...NONE, repeat: true });
  assert.equal(issued.filter((i) => i.type === 'scatter').length, 1);
  c.onKey('2', 'Digit2', { ...NONE, ctrl: true });
  c.onKey('2', 'Digit2', NONE);
  c.onKey('2', 'Digit2', { ...NONE, repeat: true });
  assert.equal(looked.length, 0);
});

test('no order on ground none of the selected units can enter; infantry may climb', () => {
  const { tank, world, c, issued } = setup();
  c.selection.set([tank.id]);
  c.onClick(px(15), px(15), 0, NONE, false);
  assert.equal(issued.length, 0);
  const trooper = world.spawnUnit('trooper', 'atreides', 2, 12);
  c.selection.set([tank.id, trooper.id]);
  c.onClick(px(15), px(15), 0, NONE, false);
  assert.equal(issued.at(-1).type, 'move');
});

test('a click on ground beyond the map edge issues nothing', () => {
  const { tank, c, issued } = setup();
  c.selection.set([tank.id]);
  c.onClick(px(25), px(5), 0, NONE, false);
  assert.equal(issued.length, 0);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/robustness.test.mjs tests/quality.test.mjs tests/heightfield.test.mjs tests/controller.test.mjs`
Expected: FAIL — `guard.js` missing; `terrainSubFor` not exported; `maxHeight` undefined; the repeat test sees two scatters; the mountain test sees a move order.

- [ ] **Step 3: Implement guard, invariants, grade pass, quality and heightfield changes**

**File: `src/core/guard.js`**
```js
// Wraps a per-frame function: the first exception stops the loop and is reported once, so a bug
// shows an error screen instead of silently freezing the game (spec §9).
export function guardFrame(frame, onError) {
  let failed = false;
  return (...args) => {
    if (failed) return false;
    try {
      frame(...args);
      return true;
    } catch (err) {
      failed = true;
      onError(err);
      return false;
    }
  };
}
```

**File: `src/sim/invariants.js`**
```js
// Debug-mode consistency checks (spec §9): positions are finite, every ground unit holds its tile(s),
// no tile is held by a missing unit, structures own their footprint. Returns a list of problems.
export function checkInvariants(world) {
  const problems = [];
  const map = world.map;
  const held = new Map();
  for (let i = 0; i < map.unit.length; i++) { const id = map.unit[i]; if (id) held.set(id, (held.get(id) ?? 0) + 1); }
  for (const u of world.units.values()) {
    if (!Number.isFinite(u.x) || !Number.isFinite(u.y) || !Number.isFinite(u.heading)) problems.push(`unit ${u.id} has a non-finite position`);
    if (!u.isGround) continue;
    const n = held.get(u.id) ?? 0;
    if (n < 1 || n > 2) problems.push(`unit ${u.id} holds ${n} tiles`);
    if (map.unit[map.idx(u.tx, u.ty)] !== u.id && !(u.step && u.step.released)) problems.push(`unit ${u.id} lost its tile ${u.tx},${u.ty}`);
  }
  for (const id of held.keys()) if (!world.units.has(id)) problems.push(`tile held by missing unit ${id}`);
  for (const s of world.structures.values()) {
    for (let dy = 0; dy < s.h; dy++) for (let dx = 0; dx < s.w; dx++) {
      if (map.structure[map.idx(s.x + dx, s.y + dy)] !== s.id) problems.push(`structure ${s.id} lost tile ${s.x + dx},${s.y + dy}`);
    }
  }
  return problems;
}
```

**File: `src/render/grade-pass.js`**
```js
// Colour grade and vignette (spec §5.1), applied in linear light before the OutputPass tone-maps.
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uTint: { value: [1.04, 1.0, 0.94] },
    uSaturation: { value: 1.08 },
    uVignette: { value: 0.32 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uTint;
    uniform float uSaturation;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * uTint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);
      float d = distance(vUv, vec2(0.5));
      col *= mix(1.0, smoothstep(0.85, 0.3, d), uVignette);
      gl_FragColor = vec4(max(col, 0.0), c.a);
    }`,
};

export function createGradePass() { return new ShaderPass(GradeShader); }
```

Modify `src/render/quality.js` — append:
```js
/** Large maps drop to three terrain vertices per tile side (spec §5.2). */
export function terrainSubFor(mapW, preset) { return mapW > 64 ? Math.min(3, preset.terrainSub) : preset.terrainSub; }
```

Modify `src/render/heightfield.js` — in `build()`, replace `      this.data[k] = h;` with:
```js
      this.data[k] = h;
      if (h > this.maxHeight) this.maxHeight = h;
```
and in the constructor, before `this.build();`, add:
```js
    this.maxHeight = 0;
```

Modify `src/render/renderer.js`:
- replace `r.shadowMap.type = THREE.PCFSoftShadowMap;` with `r.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft was removed in r186`
- add `import { createGradePass } from './grade-pass.js';` after the `qualityPreset` import
- replace `    this.composer.addPass(new OutputPass());` with:
```js
    this.composer.addPass(createGradePass());
    this.composer.addPass(new OutputPass());
```
- replace the context-loss listener line with:
```js
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; this.onContextLost?.(); });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.onContextRestored?.(); });
```

- [ ] **Step 4: Controller changes**

Modify `src/input/controller.js`:
- In `order(hit)`, after `const tx = …, ty = …;` add:
```js
    if (hit.kind === 'structure') return;   // structure clicks are handled by selection (Task 15) and combat (plan 1c)
    const map = this.world.map, i = map.idx(tx, ty);
    if (!units.some((u) => map.moveFactor(i, u.move) > 0)) return;   // nobody selected can go there
```
- In `onKey`, directly after `const digit = …;` add:
```js
    if (mods.repeat && (digit !== null || HOTKEYS[key])) return true;   // held keys must not repeat orders
```

- [ ] **Step 5: FPS meter, crash screen and GameView**

**File: `src/ui/fps.js`**
```js
// ?fps=1 overlay (spec §10): frames per second, worst frame time, draw calls and triangles.
export class FpsMeter {
  constructor(root, renderer) {
    this.el = document.createElement('div');
    this.el.className = 'fps-meter';
    root.appendChild(this.el);
    this.renderer = renderer;
    this.frames = 0; this.acc = 0; this.worst = 0;
  }
  frame(dt) {
    this.frames++; this.acc += dt; this.worst = Math.max(this.worst, dt);
    if (this.acc < 0.5) return;
    const info = this.renderer.info.render;
    this.el.textContent = `${(this.frames / this.acc).toFixed(0)} fps · worst ${(this.worst * 1000).toFixed(0)} ms · ${info.calls} draws · ${(info.triangles / 1000).toFixed(0)}k tris`;
    this.frames = 0; this.acc = 0; this.worst = 0;
  }
}
```

**File: `src/ui/crash.js`**
```js
// Error screen shown when a frame throws (spec §9): the message, a hint to the console, and a reload button.
export function showCrash(err) {
  console.error(err);
  const div = document.createElement('div');
  div.className = 'fatal';
  div.innerHTML = '<div><h2>Something went wrong</h2><p class="msg"></p><p>Details are in the browser console.</p><button>Reload</button></div>';
  div.querySelector('.msg').textContent = err?.message ?? String(err);
  div.querySelector('button').addEventListener('click', () => location.reload());
  document.getElementById('ui').appendChild(div);
}
```

Append to `src/ui/styles.css`:
```css
.fps-meter { position: absolute; left: 8px; top: 8px; padding: 3px 8px; background: rgba(0,0,0,.55); color: #9f9; font: 12px monospace; pointer-events: none; z-index: 5; }
.fatal h2 { margin: 0 0 .4em; color: #ffcf7a; }
.fatal button { margin-top: 1em; padding: .5em 1.4em; font: bold 15px "Trebuchet MS", sans-serif; background: #b8893a; border: 0; color: #1a1008; cursor: pointer; }
```

**File: `src/game/game-view.js`**
```js
// Everything between the simulation and the screen (spec §3): renderer, terrain, unit and structure
// views, RTS camera, input, overlay, HUD and the frame loop. Scenes build a World and hand it over.
import { Renderer3D } from '../render/renderer.js';
import { terrainSubFor } from '../render/quality.js';
import { Heightfield } from '../render/heightfield.js';
import { TerrainView } from '../render/terrain.js';
import { CameraRig } from '../render/camera-rig.js';
import { screenToGround, worldToScreen, pixelsPerUnit } from '../render/picking.js';
import { UnitViews } from '../render/views/unit-views.js';
import { StructureViews } from '../render/views/structure-views.js';
import { Overlay } from '../render/overlay.js';
import { CameraControl } from '../input/camera-control.js';
import { Pointer } from '../input/pointer.js';
import { Keyboard } from '../input/keyboard.js';
import { Selection } from '../input/selection.js';
import { Groups } from '../input/groups.js';
import { Controller } from '../input/controller.js';
import { makeCursorSetter } from '../ui/cursors.js';
import { Hud } from '../ui/hud.js';
import { FpsMeter } from '../ui/fps.js';
import { showCrash } from '../ui/crash.js';
import { FixedLoop } from '../core/loop.js';
import { guardFrame } from '../core/guard.js';
import { DT, GAME_SPEED } from '../data/tuning.js';
import { checkInvariants } from '../sim/invariants.js';
import { createDebugApi } from './debug.js';

export class GameView {
  constructor({ world, house, settings, params, focus }) {
    this.world = world;
    this.house = house;
    this.settings = settings;
    this.params = params;
    this.debug = params.bool('debug');
    const canvas = (this.canvas = document.getElementById('gl'));
    const r3d = (this.r3d = new Renderer3D(canvas, settings.quality));
    r3d.renderer.info.autoReset = false;
    const hf = (this.hf = new Heightfield(world.map, { sub: terrainSubFor(world.map.w, r3d.quality), seed: world.map.seed }));
    this.heightAt = (x, z) => hf.heightAt(x, z);
    this.terrain = new TerrainView(world.map, hf);
    r3d.scene.add(this.terrain.group);
    this.unitViews = new UnitViews(r3d.scene, hf);
    this.structureViews = new StructureViews(r3d.scene, hf);
    this.rig = new CameraRig(r3d.camera, world.map.w, world.map.h);
    const dist = params.num('dist');
    if (dist) this.rig.goalDistance = this.rig.distance = dist;
    this.rig.lookAt(focus.x, focus.z, true);
    this.cameraControl = new CameraControl(this.rig, canvas, settings);
    this.overlay = new Overlay(document.getElementById('overlay'));
    this.hud = new Hud(document.getElementById('ui'));
    this.fps = params.bool('fps') ? new FpsMeter(document.getElementById('ui'), r3d.renderer) : null;
    this.selection = new Selection();
    this.groups = new Groups();
    this.project = (x, z, lift = 0) => {
      const y = this.heightAt(x, z) + lift;
      const s = worldToScreen(r3d.camera, x, y, z, r3d.width, r3d.height);
      s.pxPerUnit = pixelsPerUnit(r3d.camera, x, y, z, r3d.height);
      s.visible = s.visible && s.x > -60 && s.x < r3d.width + 60 && s.y > -60 && s.y < r3d.height + 60;
      return s;
    };
    this.ground = (sx, sy) => screenToGround(r3d.camera, (sx / r3d.width) * 2 - 1, 1 - (sy / r3d.height) * 2, this.heightAt, hf.maxHeight + 0.5);
    this.positionOf = (u) => this.unitViews.renderPos(u);
    this.controller = new Controller({
      world, house, selection: this.selection, groups: this.groups, settings, project: this.project, ground: this.ground,
      rig: this.rig, positionOf: this.positionOf,
      viewport: () => ({ left: 0, top: 0, right: r3d.width, bottom: r3d.height }),
      onCursor: makeCursorSetter(canvas),
      onMarker: (x, z) => this.overlay.marker(x, z),
      onDragBox: (box) => this.overlay.setDragBox(box),
    });
    new Pointer(canvas, this.controller);
    new Keyboard((key, code, mods) => this.controller.onKey(key, code, mods));
    this.loop = new FixedLoop(DT);
    this.speed = GAME_SPEED[settings.gameSpeed] ?? 1;
    this.paused = document.hidden;
    this.lost = false;
    this.last = performance.now();
    document.addEventListener('visibilitychange', () => { this.paused = document.hidden || this.lost; this.last = performance.now(); });
    r3d.onContextLost = () => { this.lost = true; this.paused = true; this.hud.message('The graphics device was reset — restoring…', 3600); };
    r3d.onContextRestored = () => location.reload();
    this.onFrame = null;
    this.nextInvariantCheck = 0;
  }

  handleEvents() {
    for (const e of this.world.events.drain()) this.onEvent(e);
  }

  onEvent(e) {
    if (e.type === 'eva' && e.house === this.house) this.hud.message(e.text);
    else if (e.type === 'deployed' && e.house === this.house) this.hud.message('Construction Yard deployed.');
    if (e.type === 'structurePlaced') {
      const s = this.world.structures.get(e.id);
      if (s) this.terrain.flattenFootprint(s.x, s.y, s.w, s.h);
    }
  }

  frame(now) {
    const { world, r3d } = this;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const { steps, alpha } = this.paused ? { steps: 0, alpha: 1 } : this.loop.advance(dt, this.speed);
    for (let i = 0; i < steps; i++) world.step();
    if (this.debug && world.time >= this.nextInvariantCheck) {
      this.nextInvariantCheck = world.time + 1;
      const problems = checkInvariants(world);
      if (problems.length) console.error('invariants:', problems.slice(0, 5).join('; '));
    }
    this.handleEvents();
    this.selection.prune((id) => world.units.has(id));
    this.onFrame?.(dt);
    this.cameraControl.update(dt);
    this.rig.update(dt, this.heightAt);
    r3d.follow(this.rig.target.x, this.rig.target.z, this.rig.distance * 1.1);
    this.unitViews.sync(world, alpha, dt);
    this.structureViews.sync(world, now);
    this.terrain.update(now);
    r3d.renderer.info.reset();
    r3d.render();
    this.controller.frame();
    this.overlay.draw({ world, selection: this.selection, hoverId: this.controller.hoverId, project: this.project, positionOf: this.positionOf, groups: this.groups, dt, healthBars: this.settings.healthBars });
    this.hud.update(dt);
    this.fps?.frame(dt);
  }

  start() {
    const tick = guardFrame((now) => this.frame(now), showCrash);
    const loop = (now) => { if (tick(now)) requestAnimationFrame(loop); };
    requestAnimationFrame((now) => {
      this.last = now;
      this.rig.update(1, this.heightAt);
      if (!tick(now)) return;
      window.__dune = createDebugApi({ world: this.world, house: this.house, selection: this.selection, project: this.project, positionOf: this.positionOf, rig: this.rig });
      window.__dune.ready = true;
      requestAnimationFrame(loop);
    });
  }
}
```

**File: `src/scenes/skirmish.js`** (replace the whole file)
```js
// Skirmish: generated map, both houses' opening forces, played through the shared GameView.
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { setupSkirmish } from '../game/setup.js';
import { GameView } from '../game/game-view.js';

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const house = params.str('house', 'atreides');
  const { world, starts } = setupSkirmish({ seed: params.num('seed', 1), size: params.num('size', 64), house, enemy: params.str('enemy') });
  for (let i = 0, n = params.num('ticks', 0); i < n; i++) world.step();
  const view = new GameView({ world, house, settings, params, focus: { x: starts[0].x + 0.5, z: starts[0].y + 2.5 } });
  view.start();
  return view;
}
```

**File: `src/scenes/stress.js`**
```js
// Stress scene (spec §10): 200 mixed units on a 128-tile map, regrouping every six seconds.
// Open with ?scene=stress&fps=1 on the target laptop to measure frame time.
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { generateMap } from '../sim/mapgen.js';
import { World } from '../sim/world.js';
import { findFreeTile } from '../game/setup.js';
import { UNITS } from '../data/units.js';
import { GameView } from '../game/game-view.js';

const TYPES = ['combatTank', 'quad', 'trike', 'siegeTank', 'missileTank', 'harvester', 'infantry', 'troopers', 'mcv', 'raider'];

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const count = params.num('units', 200);
  const { map } = generateMap({ w: 128, h: 128, seed: params.num('seed', 3), players: 2 });
  const world = new World({ map, seed: 3 });
  world.addHouse('atreides');
  world.addHouse('harkonnen', { ai: true });
  const ids = [];
  for (let k = 0; k < count; k++) {
    const type = TYPES[k % TYPES.length];
    const house = k % 2 ? 'harkonnen' : 'atreides';
    const spot = findFreeTile(world, 44 + world.rng.int(40), 44 + world.rng.int(40), UNITS[type].move, 12);
    if (spot) ids.push({ id: world.spawnUnit(type, house, spot.x, spot.y, { heading: world.rng.range(-Math.PI, Math.PI) }).id, house });
  }
  const view = new GameView({ world, house: 'atreides', settings, params, focus: { x: 64, z: 66 } });
  let next = 0;
  view.onFrame = () => {
    if (world.time < next) return;
    next = world.time + 6;
    for (let g = 0; g < ids.length; g += 10) {
      const group = ids.slice(g, g + 10);
      const x = 30 + world.rng.int(68), y = 30 + world.rng.int(68);
      world.issue(group[0].house, { type: 'move', ids: group.filter((u) => u.house === group[0].house).map((u) => u.id), x, y });
    }
  };
  view.start();
  return view;
}
```

Modify `src/main.js` — add to `SCENES`:
```js
  stress: () => import('./scenes/stress.js'),
```

Modify `scripts/scenarios.mjs` — add:
```js
  stress: { query: 'scene=stress&fps=1&quality=low', settleMs: 4000 },
```

- [ ] **Step 6: Run the tests, the smoke scenes and the end-to-end check**

Run: `npm test && npm run smoke stress skirmish-atreides && npm run e2e`
Expected: all Node tests pass; `stress` and `skirmish-atreides` screenshots write with no console errors (three no longer warns about PCFSoftShadowMap); e2e 7/7. The stress screenshot shows 200 units spread over the map and the fps meter in the top-left corner; the skirmish screenshot has a subtle warm grade and darkened corners.

- [ ] **Step 7: Commit**

```bash
git add src tests scripts
git commit -m "feat: GameView frame loop with crash screen, context-loss pause, debug invariants, fps meter, stress scene, colour grade; plan-1a minors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Economy — storage, credits and power

**Files:**
- Create: `src/sim/economy.js`
- Modify: `src/sim/house.js` (start buffer, power), `src/sim/world.js` (power every 10 ticks)
- Test: `tests/economy.test.mjs`

**Interfaces:**
- Consumes: `World`, `House`, `STRUCTURES` (`storage`, `power`).
- Produces: `builtStorage(world, houseId)`, `storageCapacity(world, house)` (applies the start buffer and revokes it once built storage exceeds it), `addCredits(world, house, amount)` → credits actually added (overflow lost, `eva storageFull` at most once per `STORAGE_WARNING_SECONDS`=15), `spend(house, amount)` → boolean, `clampToStorage(world, house)`, `loseStorageShare(world, house, storage)`, `computePower(world, houseId)` → `{produced, used, ratio}`, `updatePower(world)` (sets `house.power`, `eva lowPower` when a shortage starts, at most once per 20 s), `radarOnline(world, houseId)`. `House` gains `startBuffer` (= starting credits) and `power`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/economy.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { storageCapacity, addCredits, spend, clampToStorage, loseStorageShare, computePower, updatePower, radarOnline } from '../src/sim/economy.js';
import { flatWorld, run } from './helpers.mjs';

function world2() {
  const world = flatWorld(24, 24, G.ROCK);
  world.houses.get('atreides').credits = 1000;
  world.houses.get('atreides').startBuffer = 1000;
  return world;
}

test('starting credits act as storage until built storage exceeds them', () => {
  const world = world2();
  const h = world.houses.get('atreides');
  assert.equal(storageCapacity(world, h), 1000);
  world.spawnStructure('refinery', 'atreides', 2, 2);
  assert.equal(storageCapacity(world, h), 1005);
  assert.equal(h.startBuffer, 0, 'the buffer is revoked for good');
  world.removeStructure([...world.structures.values()][0]);
  assert.equal(storageCapacity(world, h), 0);
});

test('credits beyond storage are lost with one warning per 15 seconds', () => {
  const world = world2();
  const h = world.houses.get('atreides');
  assert.equal(addCredits(world, h, 300), 0, 'already at the 1000 buffer');
  assert.equal(addCredits(world, h, 300), 0);
  const warnings = world.events.drain().filter((e) => e.type === 'eva' && e.key === 'storageFull');
  assert.equal(warnings.length, 1);
  h.credits = 400;
  assert.equal(addCredits(world, h, 300), 300);
  assert.equal(h.credits, 700);
});

test('spend never goes negative', () => {
  const h = { credits: 50 };
  assert.equal(spend(h, 60), false);
  assert.equal(h.credits, 50);
  assert.equal(spend(h, 50), true);
  assert.equal(h.credits, 0);
});

test('losing a store burns its share; clamping trims to capacity', () => {
  const world = world2();
  const h = world.houses.get('atreides');
  world.spawnStructure('refinery', 'atreides', 2, 2);
  const silo = world.spawnStructure('silo', 'atreides', 6, 2);
  h.credits = 2005;
  world.removeStructure(silo);
  loseStorageShare(world, h, 1000);
  assert.ok(Math.abs(h.credits - 2005 * (1005 / 2005)) < 1e-6);
  h.credits = 5000;
  clampToStorage(world, h);
  assert.equal(h.credits, 1005);
});

test('wind traps power the base; damage lowers output but never below half', () => {
  const world = world2();
  const trap = world.spawnStructure('windtrap', 'atreides', 2, 2);
  world.spawnStructure('refinery', 'atreides', 6, 2);
  world.spawnStructure('outpost', 'atreides', 10, 2);
  assert.deepEqual(computePower(world, 'atreides'), { produced: 100, used: 60, ratio: 1 });
  trap.hp = trap.maxHp * 0.2;
  const p = computePower(world, 'atreides');
  assert.equal(p.produced, 50);
  assert.ok(Math.abs(p.ratio - 50 / 60) < 1e-9);
});

test('a new shortage is announced once and radar needs a powered outpost', () => {
  const world = world2();
  world.spawnStructure('windtrap', 'atreides', 2, 2);
  const outpost = world.spawnStructure('outpost', 'atreides', 6, 2);
  run(world, 1);
  assert.equal(radarOnline(world, 'atreides'), true);
  for (let k = 0; k < 3; k++) world.spawnStructure('refinery', 'atreides', 2 + k * 4, 8);
  run(world, 3);
  assert.equal(radarOnline(world, 'atreides'), false);
  assert.equal(world.events.drain().filter((e) => e.key === 'lowPower').length, 1);
  world.removeStructure(outpost);
  run(world, 1);
  assert.equal(radarOnline(world, 'atreides'), false);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/economy.test.mjs`
Expected: FAIL — cannot find `../src/sim/economy.js`.

- [ ] **Step 3: Implement the economy**

**File: `src/sim/economy.js`**
```js
// House economy (spec §4.3–§4.4): credits limited by refinery/silo storage, wind-trap power, radar.

export const STORAGE_WARNING_SECONDS = 15;
export const POWER_WARNING_SECONDS = 20;

export function builtStorage(world, houseId) {
  let cap = 0;
  for (const s of world.structures.values()) if (s.house === houseId && s.type.storage) cap += s.type.storage;
  return cap;
}

/** The starting credits count as storage until built storage exceeds them; then never again. */
export function storageCapacity(world, house) {
  const built = builtStorage(world, house.id);
  if (house.startBuffer && built > house.startBuffer) house.startBuffer = 0;
  return Math.max(built, house.startBuffer ?? 0);
}

/** Adds credits up to the storage limit; the rest is lost with a warning. Returns what was added. */
export function addCredits(world, house, amount) {
  if (!(amount > 0)) return 0;
  const room = Math.max(0, storageCapacity(world, house) - house.credits);
  const added = Math.min(room, amount);
  house.credits += added;
  if (added < amount && world.time - (house.lastStorageWarning ?? -1e9) >= STORAGE_WARNING_SECONDS) {
    house.lastStorageWarning = world.time;
    world.events.push('eva', { house: house.id, key: 'storageFull', text: 'Spice storage full — build Silos.' });
  }
  return added;
}

export function spend(house, amount) {
  if (amount <= 0) return true;
  if (house.credits + 1e-9 < amount) return false;
  house.credits = Math.max(0, house.credits - amount);
  return true;
}

export function clampToStorage(world, house) {
  house.credits = Math.min(house.credits, storageCapacity(world, house));
}

/** Called after a refinery or silo was destroyed: the house loses that store's share of its credits. */
export function loseStorageShare(world, house, storage) {
  const before = builtStorage(world, house.id) + storage;
  if (before > 0) house.credits = Math.max(0, house.credits - house.credits * (storage / before));
}

export function computePower(world, houseId) {
  let produced = 0, used = 0;
  for (const s of world.structures.values()) {
    if (s.house !== houseId) continue;
    if (s.type.power < 0) produced += -s.type.power * Math.max(0.5, Math.min(1, s.hp / s.maxHp));
    else used += s.type.power;
  }
  return { produced: Math.round(produced), used, ratio: used > 0 ? Math.min(1, produced / used) : 1 };
}

export function updatePower(world) {
  for (const house of world.houses.values()) {
    const p = computePower(world, house.id);
    const wasShort = house.power.ratio < 1;
    house.power = p;
    if (p.ratio < 1 && !wasShort && world.time - (house.lastPowerWarning ?? -1e9) >= POWER_WARNING_SECONDS) {
      house.lastPowerWarning = world.time;
      world.events.push('eva', { house: house.id, key: 'lowPower', text: 'Low power.' });
    }
  }
}

/** Radar needs an Outpost and at least as much power as the base uses (spec §4.9). */
export function radarOnline(world, houseId) {
  const house = world.houses.get(houseId);
  if (!house || house.power.ratio < 1) return false;
  for (const s of world.structures.values()) if (s.house === houseId && s.typeId === 'outpost') return true;
  return false;
}
```

Modify `src/sim/house.js` — in the constructor, after `this.credits = credits;` add:
```js
    this.startBuffer = credits;          // starting credits count as storage until built storage exceeds them
    this.power = { produced: 0, used: 0, ratio: 1 };
```

Modify `src/sim/world.js`:
- add `import { updatePower } from './economy.js';` after the `tryDeploy` import
- in `step()`, replace `    this.tick++;` with:
```js
    if (this.tick % 10 === 0) updatePower(this);
    this.tick++;
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/economy.test.mjs && npm test`
Expected: PASS (6 new tests; suite green).

- [ ] **Step 5: Commit**

```bash
git add src/sim/economy.js src/sim/house.js src/sim/world.js tests/economy.test.mjs
git commit -m "feat(sim): spice storage with start buffer and overflow, wind-trap power and radar availability

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Placement and the concrete rule

**Files:**
- Create: `src/sim/placement.js`
- Test: `tests/placement.test.mjs`

**Interfaces:**
- Consumes: `World.spawnStructure(typeId, houseId, x, y, {hpFraction})`, `GameMap` arrays, `STRUCTURES` (`w`, `h`, `isConcrete`).
- Produces: `checkPlacement(world, houseId, typeId, x, y)` → `{ok, tiles:[{x, y, state:'concrete'|'bare'|'blocked'}], adjacent, reason:null|'blocked'|'notAdjacent'|'unknown'}`; `placeStructure(world, houseId, typeId, x, y)` → the new structure, `{concrete:true}` for slabs, or `null`; `findPlacement(world, houseId, typeId, cx, cy, maxR = 10)` → nearest valid `{x, y}` (square rings outwards) or `null`. A structure's HP starts at `1 − 0.5 × bare/tiles` of max (spec §4.5). Slabs set `map.concrete[i] = slot+1`, bump `concreteRevision`, emit `concretePlaced {house, x, y, w, h}`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/placement.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { checkPlacement, placeStructure, findPlacement } from '../src/sim/placement.js';
import { flatWorld } from './helpers.mjs';

function base() {
  const world = flatWorld(20, 20, G.ROCK);
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  return world;
}

test('a structure needs free rock inside the map', () => {
  const world = base();
  assert.equal(checkPlacement(world, 'atreides', 'windtrap', 6, 4).ok, true);
  world.map.ground[world.map.idx(7, 5)] = G.SAND;
  const c = checkPlacement(world, 'atreides', 'windtrap', 6, 4);
  assert.equal(c.ok, false);
  assert.equal(c.reason, 'blocked');
  assert.equal(c.tiles.find((t) => t.x === 7 && t.y === 5).state, 'blocked');
  assert.equal(checkPlacement(world, 'atreides', 'windtrap', 19, 4).ok, false, 'off the east edge');
  assert.equal(checkPlacement(world, 'atreides', 'nonsense', 6, 4).reason, 'unknown');
});

test('units standing in the footprint block placement', () => {
  const world = base();
  world.spawnUnit('soldier', 'atreides', 7, 4);
  assert.equal(checkPlacement(world, 'atreides', 'windtrap', 6, 4).ok, false);
});

test('placement must touch the house\'s own base', () => {
  const world = base();
  assert.equal(checkPlacement(world, 'atreides', 'windtrap', 12, 12).reason, 'notAdjacent');
  world.spawnStructure('constructionYard', 'harkonnen', 12, 4);
  assert.equal(checkPlacement(world, 'atreides', 'windtrap', 14, 4).reason, 'notAdjacent', 'next to an enemy yard does not count');
  assert.equal(checkPlacement(world, 'atreides', 'windtrap', 7, 7).ok, true, 'diagonal contact counts');
});

test('bare rock costs up to half the hit points; own concrete prevents it', () => {
  const world = base();
  placeStructure(world, 'atreides', 'concrete', 6, 4);
  placeStructure(world, 'atreides', 'concrete', 6, 5);
  const trap = placeStructure(world, 'atreides', 'windtrap', 6, 4);
  assert.equal(trap.hp, 150);   // two of four tiles on concrete: 75 %
  const bare = placeStructure(world, 'atreides', 'windtrap', 4, 6);
  assert.equal(bare.hp, 100);   // all bare: 50 %
});

test('concrete slabs go on bare rock only and mark their tiles', () => {
  const world = base();
  const rev = world.map.concreteRevision;
  assert.deepEqual(placeStructure(world, 'atreides', 'concrete4', 6, 4), { concrete: true });
  const slot = world.houses.get('atreides').slot + 1;
  for (const [x, y] of [[6, 4], [7, 4], [6, 5], [7, 5]]) assert.equal(world.map.concrete[world.map.idx(x, y)], slot);
  assert.equal(world.map.concreteRevision, rev + 1);
  assert.equal(checkPlacement(world, 'atreides', 'concrete', 6, 4).ok, false, 'no slab on a slab');
  assert.ok(world.events.drain().some((e) => e.type === 'concretePlaced'));
});

test('findPlacement returns the nearest valid spot next to the base, or null', () => {
  const world = flatWorld(24, 24, G.ROCK);
  world.spawnStructure('constructionYard', 'atreides', 10, 10);
  const spot = findPlacement(world, 'atreides', 'windtrap', 10, 10);
  assert.ok(spot && checkPlacement(world, 'atreides', 'windtrap', spot.x, spot.y).ok);
  assert.ok(Math.max(Math.abs(spot.x - 10), Math.abs(spot.y - 10)) <= 2);
  assert.equal(findPlacement(flatWorld(24, 24, G.SAND), 'atreides', 'windtrap', 10, 10), null);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/placement.test.mjs`
Expected: FAIL — cannot find `../src/sim/placement.js`.

- [ ] **Step 3: Implement placement**

**File: `src/sim/placement.js`**
```js
// Structure placement (spec §4.5): every footprint tile must be free rock inside the map, and the
// footprint must touch (8-neighbourhood) the house's own structure or concrete. Building on bare rock
// costs up to half the hit points; the house's own concrete prevents that. Slabs go on bare rock only.
import { STRUCTURES } from '../data/structures.js';
import { G } from '../data/terrain.js';

export function checkPlacement(world, houseId, typeId, x, y) {
  const t = STRUCTURES[typeId];
  const house = world.houses.get(houseId);
  if (!t || !house) return { ok: false, tiles: [], adjacent: false, reason: 'unknown' };
  const map = world.map, slot = house.slot + 1;
  const tiles = [];
  let blocked = false;
  for (let dy = 0; dy < t.h; dy++) for (let dx = 0; dx < t.w; dx++) {
    const tx = x + dx, ty = y + dy;
    let state = 'blocked';
    if (map.inBounds(tx, ty)) {
      const i = map.idx(tx, ty);
      if (map.ground[i] === G.ROCK && !map.structure[i] && !map.unit[i]) {
        if (t.isConcrete) state = map.concrete[i] ? 'blocked' : 'bare';
        else state = map.concrete[i] === slot ? 'concrete' : 'bare';
      }
    }
    if (state === 'blocked') blocked = true;
    tiles.push({ x: tx, y: ty, state });
  }
  const adjacent = touchesBase(world, houseId, slot, x, y, t.w, t.h);
  const ok = !blocked && adjacent;
  return { ok, tiles, adjacent, reason: ok ? null : blocked ? 'blocked' : 'notAdjacent' };
}

function touchesBase(world, houseId, slot, x, y, w, h) {
  const map = world.map;
  for (let ty = y - 1; ty <= y + h; ty++) for (let tx = x - 1; tx <= x + w; tx++) {
    if (tx >= x && tx < x + w && ty >= y && ty < y + h) continue;
    if (!map.inBounds(tx, ty)) continue;
    const i = map.idx(tx, ty);
    if (map.concrete[i] === slot) return true;
    const sid = map.structure[i];
    if (sid && world.structures.get(sid)?.house === houseId) return true;
  }
  return false;
}

/** Nearest valid origin for `typeId` around (cx, cy), searching square rings outwards; null if none. */
export function findPlacement(world, houseId, typeId, cx, cy, maxR = 10) {
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (checkPlacement(world, houseId, typeId, cx + dx, cy + dy).ok) return { x: cx + dx, y: cy + dy };
    }
  }
  return null;
}

export function placeStructure(world, houseId, typeId, x, y) {
  const check = checkPlacement(world, houseId, typeId, x, y);
  if (!check.ok) return null;
  const t = STRUCTURES[typeId];
  const map = world.map, slot = world.houses.get(houseId).slot + 1;
  if (t.isConcrete) {
    for (const tile of check.tiles) map.concrete[map.idx(tile.x, tile.y)] = slot;
    map.concreteRevision++;
    world.events.push('concretePlaced', { house: houseId, x, y, w: t.w, h: t.h });
    return { concrete: true };
  }
  const bare = check.tiles.filter((tile) => tile.state === 'bare').length;
  return world.spawnStructure(typeId, houseId, x, y, { hpFraction: 1 - 0.5 * (bare / check.tiles.length) });
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/placement.test.mjs && npm test`
Expected: PASS (6 new tests); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/sim/placement.js tests/placement.test.mjs
git commit -m "feat(sim): structure placement with adjacency and the Dune II concrete hit-point rule

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Tech — what each house can build

**Files:**
- Create: `src/data/phase.js`, `src/sim/tech.js`
- Test: `tests/tech.test.mjs`

**Interfaces:**
- Consumes: `STRUCTURES`, `UNITS`, `House.techLevel`.
- Produces: `DEFERRED` (Set); `STRUCTURE_ORDER`, `UNIT_ORDER`; `LINE_FACTORIES = {structure:['constructionYard'], infantry:['barracks','wor'], light:['lightFactory'], heavy:['heavyFactory'], air:['hiTech']}`; `lineOfItem(typeId)` → `'structure'|'infantry'|'light'|'heavy'|'air'|null`; `ownedStructureTypes(world, houseId)` → Set; `structureTechLevel(t, houseId)`; `canBuildStructure(house, typeId, owned)`; `canBuildUnit(house, typeId, owned)`; `canBuild(world, houseId, typeId)`; `buildOptions(world, houseId)` → `{structure:[], infantry:[], light:[], heavy:[], air:[]}` in display order.

- [ ] **Step 1: Write the failing tests**

**File: `tests/tech.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { buildOptions, lineOfItem, canBuild } from '../src/sim/tech.js';
import { flatWorld } from './helpers.mjs';

function withStructures(house, types) {
  const world = flatWorld(40, 40, G.ROCK);
  types.forEach((t, k) => world.spawnStructure(t, house, 2 + (k % 8) * 4, 2 + Math.floor(k / 8) * 4));
  return world;
}

test('a bare Construction Yard offers concrete and wind traps', () => {
  const world = withStructures('atreides', ['constructionYard']);
  assert.deepEqual(buildOptions(world, 'atreides').structure, ['concrete', 'windtrap', 'concrete4']);
});

test('each prerequisite opens the next buildings', () => {
  const world = withStructures('atreides', ['constructionYard', 'windtrap']);
  assert.deepEqual(buildOptions(world, 'atreides').structure, ['concrete', 'windtrap', 'refinery', 'outpost', 'concrete4']);
  const more = withStructures('atreides', ['constructionYard', 'windtrap', 'refinery', 'outpost', 'lightFactory']);
  assert.deepEqual(buildOptions(more, 'atreides').structure,
    ['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'lightFactory', 'heavyFactory', 'wall', 'turret', 'rocketTurret', 'concrete4']);
});

test('infantry buildings follow the house', () => {
  const types = ['constructionYard', 'windtrap', 'outpost'];
  assert.ok(buildOptions(withStructures('harkonnen', types), 'harkonnen').structure.includes('wor'));
  assert.ok(!buildOptions(withStructures('harkonnen', types), 'harkonnen').structure.includes('barracks'));
  const ordos = buildOptions(withStructures('ordos', types), 'ordos').structure;
  assert.ok(ordos.includes('barracks') && ordos.includes('wor'));
  assert.ok(!buildOptions(withStructures('atreides', types), 'atreides').structure.includes('wor'));
});

test('factories offer their house roster; plan-2 items stay hidden', () => {
  const opts = (house) => buildOptions(withStructures(house, ['constructionYard', 'heavyFactory', 'lightFactory', 'barracks', 'wor', 'ix']), house);
  assert.deepEqual(opts('atreides').heavy, ['harvester', 'combatTank', 'missileTank', 'siegeTank', 'mcv']);
  assert.deepEqual(opts('ordos').heavy, ['harvester', 'combatTank', 'siegeTank', 'mcv']);
  assert.deepEqual(opts('harkonnen').light, ['quad']);
  assert.deepEqual(opts('ordos').light, ['raider', 'quad']);
  assert.deepEqual(opts('ordos').infantry, ['soldier', 'infantry', 'trooper', 'troopers']);
  assert.ok(!opts('atreides').heavy.includes('sonicTank'), 'IX specials are plan 2');
});

test('tech level gates structures, with the per-house light factory rule', () => {
  const world = withStructures('harkonnen', ['constructionYard', 'windtrap', 'refinery']);
  world.houses.get('harkonnen').techLevel = 2;
  assert.ok(!buildOptions(world, 'harkonnen').structure.includes('lightFactory'));
  const a = withStructures('atreides', ['constructionYard', 'windtrap', 'refinery']);
  a.houses.get('atreides').techLevel = 2;
  assert.ok(buildOptions(a, 'atreides').structure.includes('lightFactory'));
});

test('lines and direct checks', () => {
  assert.equal(lineOfItem('windtrap'), 'structure');
  assert.equal(lineOfItem('quad'), 'light');
  assert.equal(lineOfItem('troopers'), 'infantry');
  assert.equal(lineOfItem('saboteur'), null);
  const world = withStructures('atreides', ['constructionYard']);
  assert.equal(canBuild(world, 'atreides', 'windtrap'), true);
  assert.equal(canBuild(world, 'atreides', 'hiTech'), false);
  assert.equal(canBuild(world, 'atreides', 'combatTank'), false);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/tech.test.mjs`
Expected: FAIL — cannot find `../src/sim/tech.js`.

- [ ] **Step 3: Implement tech and the deferral list**

**File: `src/data/phase.js`**
```js
// Items the game does not offer yet; plan 2 removes entries as their behaviour lands.
export const DEFERRED = new Set([
  'hiTech', 'repair', 'starport', 'ix', 'palace',
  'carryall', 'ornithopter', 'deviator', 'sonicTank', 'devastator', 'saboteur', 'frigate', 'sandworm',
]);
```

**File: `src/sim/tech.js`**
```js
// What a house can build right now (spec §4.5): prerequisites, tech level, house rosters and the
// plan-2 deferrals. Factory upgrades count as already bought until plan 2.
import { STRUCTURES } from '../data/structures.js';
import { UNITS } from '../data/units.js';
import { DEFERRED } from '../data/phase.js';

export const STRUCTURE_ORDER = ['concrete', 'windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'hiTech', 'repair', 'wall', 'turret', 'rocketTurret', 'concrete4', 'starport', 'ix', 'palace'];
export const UNIT_ORDER = ['soldier', 'infantry', 'trooper', 'troopers', 'trike', 'raider', 'quad', 'harvester', 'combatTank', 'missileTank', 'siegeTank', 'mcv', 'sonicTank', 'devastator', 'deviator', 'carryall', 'ornithopter'];
export const LINE_FACTORIES = { structure: ['constructionYard'], infantry: ['barracks', 'wor'], light: ['lightFactory'], heavy: ['heavyFactory'], air: ['hiTech'] };
const LINE_OF_FACTORY = { barracks: 'infantry', wor: 'infantry', lightFactory: 'light', heavyFactory: 'heavy', hiTech: 'air' };

export function lineOfItem(typeId) {
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

export function canBuildStructure(house, typeId, owned) {
  const t = STRUCTURES[typeId];
  if (!t || !t.requires || DEFERRED.has(typeId)) return false;
  if (!t.houses.includes(house.id) || structureTechLevel(t, house.id) > house.techLevel) return false;
  return owned.has('constructionYard') && t.requires.every((r) => owned.has(r));
}

export function canBuildUnit(house, typeId, owned) {
  const u = UNITS[typeId];
  if (!u || !LINE_OF_FACTORY[u.builtAt] || DEFERRED.has(typeId) || !u.houses.includes(house.id)) return false;
  return owned.has(u.builtAt) && (u.requires ?? []).every((r) => owned.has(r));
}

export function canBuild(world, houseId, typeId) {
  const house = world.houses.get(houseId);
  if (!house) return false;
  const owned = ownedStructureTypes(world, houseId);
  return STRUCTURES[typeId] ? canBuildStructure(house, typeId, owned) : canBuildUnit(house, typeId, owned);
}

export function buildOptions(world, houseId) {
  const out = { structure: [], infantry: [], light: [], heavy: [], air: [] };
  const house = world.houses.get(houseId);
  if (!house) return out;
  const owned = ownedStructureTypes(world, houseId);
  for (const t of STRUCTURE_ORDER) if (canBuildStructure(house, t, owned)) out.structure.push(t);
  for (const t of UNIT_ORDER) if (canBuildUnit(house, t, owned)) out[lineOfItem(t)].push(t);
  return out;
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/tech.test.mjs && npm test`
Expected: PASS (6 new tests); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/data/phase.js src/sim/tech.js tests/tech.test.mjs
git commit -m "feat(sim): build options per production line from prerequisites, tech level and house rosters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Production lines

**Files:**
- Create: `src/sim/spawn.js`, `src/sim/production.js`
- Modify: `src/game/setup.js` (re-export `findFreeTile` from `sim/spawn.js`), `src/sim/house.js` (lines), `src/sim/orders.js` (commands), `src/sim/world.js` (production each tick, revalidation every 20 ticks)
- Test: `tests/production.test.mjs`

**Interfaces:**
- Consumes: `canBuild`, `lineOfItem`, `LINE_FACTORIES` (Task 4); `placeStructure` (Task 3); `spend` (Task 2); `orderMove` (plan 1a orders); `buildSeconds`, `DT`.
- Produces: `findFreeTile(world, x, y, moveClass, maxR, minR)`, `exitTile(world, structure, moveClass)` (south side first); `LINES`, `MAX_QUEUE = 9`, `createLines()`, `factoriesFor(world, houseId, line)`, `lineSpeed(world, house, line)`, `orderBuild(world, houseId, typeId, count)`, `orderHold(world, houseId, typeId)` (hold, then cancel with refund of everything paid; a ready structure cancels at once), `orderPlace(world, houseId, typeId, x, y)`, `orderRally(world, houseId, structureId, x, y)`, `orderPrimary(world, houseId, structureId)`, `spawnFromFactory(world, house, typeId)`, `updateProduction(world)`, `revalidateProduction(world)`. `House.lines[line] = {current: {typeId, cost, total, progress, paid, state:'building'|'hold'|'ready', starved} | null, queue: string[]}`.
- Commands: `{type:'build', typeId, count?}`, `{type:'hold', typeId}`, `{type:'place', typeId, x, y}`, `{type:'setRally', structureId, x, y}`, `{type:'setPrimary', structureId}`.
- Events: `eva` keys `building`, `busy`, `onHold`, `cancelled`, `insufficientFunds` (at most once per 10 s), `constructionComplete`, `unitDeployed`, `cannotPlace`, `primary`; `productionReady {house, typeId}`, `productionCancelled {house, typeId}`, `unitBuilt {id, house, structureId, unitType}`, `rallySet {id, house, x, y}`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/production.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

function base(house = 'atreides', credits = 5000) {
  const world = flatWorld(32, 32, G.ROCK);
  const h = world.houses.get(house);
  h.credits = credits;
  h.startBuffer = 100000;
  world.spawnStructure('constructionYard', house, 4, 4);
  return { world, h };
}
const count = (world, typeId) => [...world.units.values()].filter((u) => u.typeId === typeId).length;

test('a Wind Trap takes 21.6 s and is paid progressively', () => {
  const { world, h } = base();
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  run(world, 10.8);
  assert.ok(Math.abs(h.credits - 4850) < 2, `credits ${h.credits}`);
  run(world, 11);
  assert.equal(h.lines.structure.current.state, 'ready');
  assert.ok(Math.abs(h.credits - 4700) < 1e-6);
  assert.ok(world.events.drain().some((e) => e.type === 'eva' && e.key === 'constructionComplete'));
});

test('insufficient funds stalls and resumes without going negative', () => {
  const { world, h } = base('atreides', 100);
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  run(world, 15);
  assert.ok(h.credits >= 0 && h.credits < 1, `credits ${h.credits}`);
  const stalled = h.lines.structure.current.progress;
  assert.ok(stalled > 0.3 && stalled < 0.36, `progress ${stalled}`);
  assert.equal(world.events.drain().filter((e) => e.key === 'insufficientFunds').length, 1);
  run(world, 5);
  assert.equal(h.lines.structure.current.progress, stalled);
  h.credits += 500;
  run(world, 16);
  assert.equal(h.lines.structure.current.state, 'ready');
});

test('hold then cancel refunds what was paid', () => {
  const { world, h } = base();
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  run(world, 5);
  world.issue('atreides', { type: 'hold', typeId: 'windtrap' });
  run(world, 1);
  const paid = h.lines.structure.current.paid;
  assert.ok(paid > 0 && Math.abs(5000 - h.credits - paid) < 1e-6);
  const before = h.credits;
  run(world, 3);
  assert.equal(h.credits, before, 'nothing is spent while on hold');
  world.issue('atreides', { type: 'hold', typeId: 'windtrap' });
  world.step();
  assert.equal(h.lines.structure.current, null);
  assert.ok(Math.abs(h.credits - 5000) < 1e-6);
});

test('the structure line refuses a second structure while one is in progress', () => {
  const { world, h } = base();
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  world.issue('atreides', { type: 'build', typeId: 'concrete' });
  world.step();
  assert.equal(h.lines.structure.current.typeId, 'windtrap');
  assert.ok(world.events.drain().some((e) => e.key === 'busy'));
});

test('placing on an invalid spot keeps the structure ready', () => {
  const { world, h } = base();
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  run(world, 22);
  world.issue('atreides', { type: 'place', typeId: 'windtrap', x: 20, y: 20 });
  world.step();
  assert.equal(h.lines.structure.current.state, 'ready');
  assert.ok(world.events.drain().some((e) => e.key === 'cannotPlace'));
  world.issue('atreides', { type: 'place', typeId: 'windtrap', x: 6, y: 4 });
  world.step();
  assert.equal(h.lines.structure.current, null);
  assert.ok([...world.structures.values()].some((s) => s.typeId === 'windtrap' && s.x === 6 && s.y === 4));
});

test('units leave by the factory\'s south side and drive to the rally point', () => {
  const { world } = base();
  const lf = world.spawnStructure('lightFactory', 'atreides', 10, 10);
  world.issue('atreides', { type: 'setRally', structureId: lf.id, x: 11, y: 20 });
  world.issue('atreides', { type: 'build', typeId: 'trike' });
  run(world, 18.2);
  const trike = [...world.units.values()].find((u) => u.typeId === 'trike');
  assert.ok(trike, 'built after 18 s');
  assert.equal(trike.ty, 12);
  assert.ok(world.events.drain().some((e) => e.type === 'unitBuilt' && e.structureId === lf.id));
  run(world, 12);
  assert.ok(Math.max(Math.abs(trike.tx - 11), Math.abs(trike.ty - 20)) <= 1, `trike at ${trike.tx},${trike.ty}`);
});

test('the unit queue holds at most nine items', () => {
  const { world, h } = base();
  world.spawnStructure('barracks', 'atreides', 10, 10);
  world.issue('atreides', { type: 'build', typeId: 'soldier', count: 12 });
  world.step();
  assert.equal(1 + h.lines.infantry.queue.length, 9);
});

test('a second factory speeds its line up by a quarter; low power slows it to a quarter', () => {
  const time = (setup) => {
    const { world } = base();
    setup(world);
    world.issue('atreides', { type: 'build', typeId: 'soldier' });
    return runUntil(world, () => count(world, 'soldier') > 0, 70);
  };
  const one = time((w) => w.spawnStructure('barracks', 'atreides', 10, 10));
  const two = time((w) => { w.spawnStructure('barracks', 'atreides', 10, 10); w.spawnStructure('barracks', 'atreides', 14, 10); });
  const low = time((w) => { w.spawnStructure('barracks', 'atreides', 10, 10); for (let k = 0; k < 4; k++) w.spawnStructure('outpost', 'atreides', 2 + k * 3, 20); });
  assert.ok(Math.abs(one - 14.4) < 0.2, `one barracks ${one}`);
  assert.ok(Math.abs(two - 11.52) < 0.2, `two barracks ${two}`);
  assert.ok(low > 50 && low < 60, `low power ${low}`);
});

test('losing the factory refunds the item in progress', () => {
  const { world, h } = base();
  const b = world.spawnStructure('barracks', 'atreides', 10, 10);
  world.issue('atreides', { type: 'build', typeId: 'soldier' });
  run(world, 5);
  world.removeStructure(b);
  run(world, 1.1);
  assert.equal(h.lines.infantry.current, null);
  assert.ok(Math.abs(h.credits - 5000) < 1e-6);
});

test('items the house cannot build are rejected', () => {
  const { world, h } = base('harkonnen');
  world.issue('harkonnen', { type: 'build', typeId: 'barracks' });
  world.issue('harkonnen', { type: 'build', typeId: 'hiTech' });
  world.step();
  assert.equal(h.lines.structure.current, null);
  assert.equal(world.events.drain().filter((e) => e.type === 'commandRejected').length, 2);
});

test('primary factory is where new units appear', () => {
  const { world } = base();
  world.spawnStructure('barracks', 'atreides', 10, 10);
  const second = world.spawnStructure('barracks', 'atreides', 20, 10);
  world.issue('atreides', { type: 'setPrimary', structureId: second.id });
  world.issue('atreides', { type: 'build', typeId: 'soldier' });
  runUntil(world, () => count(world, 'soldier') > 0, 20);
  const s = [...world.units.values()].find((u) => u.typeId === 'soldier');
  assert.ok(s.tx >= 20 && s.tx <= 21 && s.ty === 12, `soldier at ${s.tx},${s.ty}`);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/production.test.mjs`
Expected: FAIL — `h.lines` is undefined (no production yet).

- [ ] **Step 3: Move `findFreeTile` into the simulation and add `exitTile`**

**File: `src/sim/spawn.js`**
```js
// Free tiles for new units: a spiral search, and factory exits (south side first — doors face south).
export function findFreeTile(world, x, y, moveClass, maxR = 8, minR = 0) {
  const map = world.map;
  for (let r = minR; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const tx = x + dx, ty = y + dy;
      if (!map.inBounds(tx, ty)) continue;
      const i = map.idx(tx, ty);
      if (!map.unit[i] && !map.structure[i] && map.moveFactor(i, moveClass) > 0) return { x: tx, y: ty };
    }
  }
  return null;
}

export function exitTile(world, s, moveClass) {
  const map = world.map;
  const free = (x, y) => {
    if (!map.inBounds(x, y)) return false;
    const i = map.idx(x, y);
    return !map.unit[i] && !map.structure[i] && map.moveFactor(i, moveClass) > 0;
  };
  const ring = [];
  for (let x = s.x; x < s.x + s.w; x++) ring.push([x, s.y + s.h]);
  for (let y = s.y + s.h - 1; y >= s.y; y--) ring.push([s.x + s.w, y]);
  for (let y = s.y + s.h - 1; y >= s.y; y--) ring.push([s.x - 1, y]);
  for (let x = s.x; x < s.x + s.w; x++) ring.push([x, s.y - 1]);
  ring.push([s.x - 1, s.y + s.h], [s.x + s.w, s.y + s.h], [s.x - 1, s.y - 1], [s.x + s.w, s.y - 1]);
  for (const [x, y] of ring) if (free(x, y)) return { x, y };
  return findFreeTile(world, s.x + Math.floor(s.w / 2), s.y + s.h, moveClass, 4, 1);
}
```

Modify `src/game/setup.js` — delete the whole `export function findFreeTile(…) { … }` definition and add, after the imports:
```js
import { findFreeTile } from '../sim/spawn.js';

export { findFreeTile };
```

- [ ] **Step 4: Implement production and wire it in**

**File: `src/sim/production.js`**
```js
// Production lines (spec §4.5): structure, infantry, light, heavy and air. Each line builds one item
// at a time and pays for it progressively; without credits it stalls, low power slows it, and every
// extra factory of the line's type adds 25 % speed (cap 2x). Units leave by the factory's south side
// and drive to its rally point; structures wait, ready, until the player places them.
import { STRUCTURES } from '../data/structures.js';
import { UNITS } from '../data/units.js';
import { DT, buildSeconds } from '../data/tuning.js';
import { LINE_FACTORIES, lineOfItem, canBuild } from './tech.js';
import { placeStructure } from './placement.js';
import { spend } from './economy.js';
import { exitTile } from './spawn.js';
import { orderMove } from './orders.js';

export const LINES = ['structure', 'infantry', 'light', 'heavy', 'air'];
export const MAX_QUEUE = 9;
const FUNDS_WARNING_SECONDS = 10;

export function createLines() { return Object.fromEntries(LINES.map((l) => [l, { current: null, queue: [] }])); }

function makeItem(typeId) {
  const t = STRUCTURES[typeId] ?? UNITS[typeId];
  return { typeId, cost: t.cost, total: buildSeconds(t.buildTime), progress: 0, paid: 0, state: 'building', starved: false };
}

const eva = (world, house, key, text) => world.events.push('eva', { house: house.id, key, text });

export function factoriesFor(world, houseId, line) {
  const types = LINE_FACTORIES[line];
  const out = [];
  for (const s of world.structures.values()) if (s.house === houseId && types.includes(s.typeId)) out.push(s);
  return out;
}

export function lineSpeed(world, house, line) {
  const n = factoriesFor(world, house.id, line).length;
  if (!n) return 0;
  return Math.min(2, 1 + 0.25 * (n - 1)) * Math.max(0.25, house.power.ratio) * (house.buildSpeed ?? 1);
}

export function orderBuild(world, houseId, typeId, count = 1) {
  const house = world.houses.get(houseId);
  const line = lineOfItem(typeId);
  if (!house || !line || !canBuild(world, houseId, typeId)) {
    world.events.push('commandRejected', { house: houseId, command: 'build', typeId });
    return;
  }
  const l = house.lines[line];
  if (l.current?.typeId === typeId && l.current.state === 'hold') { l.current.state = 'building'; eva(world, house, 'building', 'Building.'); return; }
  if (line === 'structure') {
    if (l.current) { eva(world, house, 'busy', 'Unable to comply, building in progress.'); return; }
    l.current = makeItem(typeId);
    eva(world, house, 'building', 'Building.');
    return;
  }
  const n = Math.max(1, Math.min(MAX_QUEUE, Math.floor(count) || 1));
  for (let k = 0; k < n; k++) {
    if ((l.current ? 1 : 0) + l.queue.length >= MAX_QUEUE) break;
    if (!l.current) l.current = makeItem(typeId); else l.queue.push(typeId);
  }
  eva(world, house, 'building', 'Building.');
}

export function orderHold(world, houseId, typeId) {
  const house = world.houses.get(houseId);
  const line = lineOfItem(typeId);
  if (!house || !line) return;
  const l = house.lines[line];
  if (l.current?.typeId === typeId) {
    if (l.current.state === 'building') { l.current.state = 'hold'; eva(world, house, 'onHold', 'On hold.'); return; }
    house.credits += l.current.paid;   // second press, or a ready structure: cancel with a full refund
    l.current = null;
    eva(world, house, 'cancelled', 'Cancelled.');
    world.events.push('productionCancelled', { house: houseId, typeId });
    return;
  }
  const k = l.queue.lastIndexOf(typeId);
  if (k >= 0) { l.queue.splice(k, 1); eva(world, house, 'cancelled', 'Cancelled.'); }
}

export function orderPlace(world, houseId, typeId, x, y) {
  const house = world.houses.get(houseId);
  const l = house?.lines.structure;
  if (!l?.current || l.current.typeId !== typeId || l.current.state !== 'ready') return null;
  const placed = placeStructure(world, houseId, typeId, x, y);
  if (!placed) { eva(world, house, 'cannotPlace', 'Cannot build there.'); return null; }
  l.current = null;
  return placed;
}

export function orderRally(world, houseId, structureId, x, y) {
  const s = world.structures.get(structureId);
  if (!s || s.house !== houseId || !Number.isFinite(x) || !Number.isFinite(y)) return;
  s.rally = { x: Math.max(0, Math.min(world.map.w - 1, Math.floor(x))), y: Math.max(0, Math.min(world.map.h - 1, Math.floor(y))) };
  world.events.push('rallySet', { id: s.id, house: houseId, x: s.rally.x, y: s.rally.y });
}

export function orderPrimary(world, houseId, structureId) {
  const s = world.structures.get(structureId);
  if (!s || s.house !== houseId) return;
  for (const o of world.structures.values()) if (o.house === houseId && o.typeId === s.typeId) o.primary = o === s;
  world.events.push('eva', { house: houseId, key: 'primary', text: 'Primary building selected.' });
}

export function spawnFromFactory(world, house, typeId) {
  const t = UNITS[typeId];
  const factories = [...world.structures.values()].filter((s) => s.house === house.id && s.typeId === t.builtAt);
  const f = factories.find((s) => s.primary) ?? factories[0];
  if (!f) return null;
  const spot = exitTile(world, f, t.move);
  if (!spot) return null;
  const u = world.spawnUnit(typeId, house.id, spot.x, spot.y, { heading: Math.PI / 2 });
  world.events.push('unitBuilt', { id: u.id, house: house.id, structureId: f.id, unitType: typeId });
  if (f.rally && typeId !== 'harvester') orderMove(world, [u], f.rally.x, f.rally.y);
  return u;
}

function complete(world, house, line, item) {
  if (line === 'structure') {
    item.state = 'ready';
    eva(world, house, 'constructionComplete', 'Construction complete.');
    world.events.push('productionReady', { house: house.id, typeId: item.typeId });
    return;
  }
  if (!spawnFromFactory(world, house, item.typeId)) return;   // exit blocked: retry next tick
  house.lines[line].current = null;
  eva(world, house, 'unitDeployed', item.typeId === 'harvester' ? 'Harvester deployed.' : 'Unit deployed.');
}

export function updateProduction(world) {
  for (const house of world.houses.values()) {
    for (const line of LINES) {
      const l = house.lines[line];
      if (!l.current && l.queue.length) l.current = makeItem(l.queue.shift());
      const item = l.current;
      if (!item || item.state !== 'building') continue;
      if (item.progress < 1) {
        const speed = lineSpeed(world, house, line);
        if (speed <= 0) continue;
        const dp = Math.min(1 - item.progress, (DT * speed) / item.total);
        const dc = Math.min(item.cost - item.paid, item.cost * dp);
        if (!spend(house, dc)) {
          if (!item.starved && world.time - (house.lastFundsWarning ?? -1e9) >= FUNDS_WARNING_SECONDS) {
            house.lastFundsWarning = world.time;
            eva(world, house, 'insufficientFunds', 'Insufficient funds.');
          }
          item.starved = true;
          continue;
        }
        item.starved = false;
        item.paid += dc;
        item.progress += dp;
      }
      if (item.progress >= 1 - 1e-9) { item.progress = 1; complete(world, house, line, item); }
    }
  }
}

/** Items whose factory or prerequisites vanished are dropped with a refund of what was paid. */
export function revalidateProduction(world) {
  for (const house of world.houses.values()) {
    for (const line of LINES) {
      const l = house.lines[line];
      if (l.current && l.current.state !== 'ready' && !canBuild(world, house.id, l.current.typeId)) {
        house.credits += l.current.paid;
        world.events.push('productionCancelled', { house: house.id, typeId: l.current.typeId });
        l.current = null;
      }
      l.queue = l.queue.filter((t) => canBuild(world, house.id, t));
    }
  }
}
```

Modify `src/sim/house.js`:
- add `import { createLines } from './production.js';` after the `HOUSES` import
- in the constructor, after the `this.power = …` line, add `    this.lines = createLines();`

Modify `src/sim/orders.js`:
- add `import { orderBuild, orderHold, orderPlace, orderRally, orderPrimary } from './production.js';` after the `orderDeploy` import
- add these cases before `default:`
```js
    case 'build': orderBuild(world, houseId, cmd.typeId, cmd.count ?? 1); return;
    case 'hold': orderHold(world, houseId, cmd.typeId); return;
    case 'place': orderPlace(world, houseId, cmd.typeId, cmd.x, cmd.y); return;
    case 'setRally': orderRally(world, houseId, cmd.structureId, cmd.x, cmd.y); return;
    case 'setPrimary': orderPrimary(world, houseId, cmd.structureId); return;
```

Modify `src/sim/world.js`:
- add `import { updateProduction, revalidateProduction } from './production.js';` after the economy import
- in `step()`, replace
```js
    if (this.tick % 10 === 0) updatePower(this);
    this.tick++;
```
with
```js
    updateProduction(this);
    if (this.tick % 10 === 0) updatePower(this);
    if (this.tick % 20 === 0) revalidateProduction(this);
    this.tick++;
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/production.test.mjs && npm test`
Expected: PASS (11 new tests); suite green (the setup tests still pass through the re-exported `findFreeTile`).

- [ ] **Step 6: Commit**

```bash
git add src/sim src/game/setup.js tests/production.test.mjs
git commit -m "feat(sim): production lines with progressive payment, hold/cancel, placement, rally and primary factories

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Sell and repair

**Files:**
- Create: `src/sim/structure-actions.js`
- Modify: `src/sim/orders.js` (commands), `src/sim/world.js` (repairs each tick)
- Test: `tests/structure-actions.test.mjs`

**Interfaces:**
- Consumes: `World.removeStructure`, `spend`, `clampToStorage` (Task 2), `DT`.
- Produces: `REPAIR_SECONDS = 12`, `REPAIR_COST_FRACTION = 0.4`; `orderSell(world, houseId, structureId)` → refund `floor(0.5 × cost × hp/maxHp)`, removes the structure (reason `'sold'`), clamps credits to the remaining storage, emits `sold {id, house, refund, typeId, x, y, w, h}`; `orderRepair(world, houseId, structureId, on?)` toggles `s.repairing`; `updateRepairs(world)` heals `maxHp/12` per second at `0.4 × cost / maxHp` credits per HP, pausing (`s.repairStalled`) without credits, emitting `repaired {id, house}` when full.
- Commands: `{type:'sell', structureId}`, `{type:'repair', structureId, on?}`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/structure-actions.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, run } from './helpers.mjs';

function world1(credits = 1000) {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = credits;
  h.startBuffer = 100000;
  return { world, h };
}

test('selling refunds half the price scaled by health', () => {
  const { world, h } = world1(0);
  const trap = world.spawnStructure('windtrap', 'atreides', 2, 2);
  trap.hp = 100;
  world.issue('atreides', { type: 'sell', structureId: trap.id });
  world.step();
  assert.equal(world.structures.has(trap.id), false);
  assert.equal(h.credits, 75);
  assert.ok(world.events.drain().some((e) => e.type === 'sold' && e.refund === 75 && e.typeId === 'windtrap'));
});

test('only the owner can sell or repair', () => {
  const { world, h } = world1(0);
  const trap = world.spawnStructure('windtrap', 'harkonnen', 2, 2);
  world.issue('atreides', { type: 'sell', structureId: trap.id });
  world.issue('atreides', { type: 'repair', structureId: trap.id });
  world.step();
  assert.ok(world.structures.has(trap.id));
  assert.ok(!trap.repairing);
  assert.equal(h.credits, 0);
});

test('selling a store clamps credits to the remaining capacity', () => {
  const { world, h } = world1();
  h.startBuffer = 0;
  world.spawnStructure('refinery', 'atreides', 2, 2);
  const silo = world.spawnStructure('silo', 'atreides', 6, 2);
  h.credits = 2000;
  world.issue('atreides', { type: 'sell', structureId: silo.id });
  world.step();
  assert.equal(h.credits, 1005);
});

test('repair heals in about twelve seconds for 40 % of the price from zero', () => {
  const { world, h } = world1(1000);
  const trap = world.spawnStructure('windtrap', 'atreides', 2, 2);
  trap.hp = 1;
  world.issue('atreides', { type: 'repair', structureId: trap.id });
  run(world, 12.1);
  assert.equal(trap.hp, trap.maxHp);
  assert.equal(trap.repairing, false);
  const spent = 1000 - h.credits;
  assert.ok(Math.abs(spent - 0.4 * 300 * (199 / 200)) < 1, `spent ${spent}`);
  assert.ok(world.events.drain().some((e) => e.type === 'repaired' && e.id === trap.id));
});

test('repair pauses without credits and resumes when they arrive', () => {
  const { world, h } = world1(10);
  const trap = world.spawnStructure('windtrap', 'atreides', 2, 2);
  trap.hp = 50;
  world.issue('atreides', { type: 'repair', structureId: trap.id });
  run(world, 6);
  assert.ok(trap.repairStalled && trap.repairing);
  const stuck = trap.hp;
  run(world, 2);
  assert.equal(trap.hp, stuck);
  h.credits += 500;
  run(world, 10);
  assert.equal(trap.hp, trap.maxHp);
});

test('a second repair command switches repair off', () => {
  const { world } = world1();
  const trap = world.spawnStructure('windtrap', 'atreides', 2, 2);
  trap.hp = 50;
  world.issue('atreides', { type: 'repair', structureId: trap.id });
  world.step();
  world.issue('atreides', { type: 'repair', structureId: trap.id });
  world.step();
  assert.equal(trap.repairing, false);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/structure-actions.test.mjs`
Expected: FAIL — `sell`/`repair` are rejected commands, so the first test finds the wind trap still standing.

- [ ] **Step 3: Implement sell and repair**

**File: `src/sim/structure-actions.js`**
```js
// Sell and repair (spec §4.3): selling refunds half the price scaled by health; repairing restores
// the structure in about twelve seconds from zero for 40 % of its price, pausing without credits.
import { DT } from '../data/tuning.js';
import { spend, clampToStorage } from './economy.js';

export const REPAIR_SECONDS = 12;
export const REPAIR_COST_FRACTION = 0.4;

export function orderSell(world, houseId, structureId) {
  const s = world.structures.get(structureId);
  if (!s || s.house !== houseId) return;
  const house = world.houses.get(houseId);
  const refund = Math.floor(0.5 * s.type.cost * (s.hp / s.maxHp));
  world.removeStructure(s, 'sold');
  house.credits += refund;
  clampToStorage(world, house);
  world.events.push('sold', { id: s.id, house: houseId, refund, typeId: s.typeId, x: s.x, y: s.y, w: s.w, h: s.h });
}

export function orderRepair(world, houseId, structureId, on) {
  const s = world.structures.get(structureId);
  if (!s || s.house !== houseId) return;
  s.repairing = (on ?? !s.repairing) && s.hp < s.maxHp;
  s.repairStalled = false;
  world.events.push('repairToggled', { id: s.id, house: houseId, on: s.repairing });
}

export function updateRepairs(world) {
  for (const s of world.structures.values()) {
    if (!s.repairing) continue;
    const house = world.houses.get(s.house);
    const hp = Math.min(s.maxHp - s.hp, (s.maxHp / REPAIR_SECONDS) * DT);
    const cost = (hp * REPAIR_COST_FRACTION * s.type.cost) / s.maxHp;
    if (!house || !spend(house, cost)) { s.repairStalled = true; continue; }
    s.repairStalled = false;
    s.hp = Math.min(s.maxHp, s.hp + hp);
    if (s.hp >= s.maxHp) {
      s.repairing = false;
      world.events.push('repaired', { id: s.id, house: s.house });
    }
  }
}
```

Modify `src/sim/orders.js`:
- add `import { orderSell, orderRepair } from './structure-actions.js';` after the production import
- add before `default:`
```js
    case 'sell': orderSell(world, houseId, cmd.structureId); return;
    case 'repair': orderRepair(world, houseId, cmd.structureId, cmd.on); return;
```

Modify `src/sim/world.js`:
- add `import { updateRepairs } from './structure-actions.js';` after the production import
- in `step()`, after `    updateProduction(this);` add `    updateRepairs(this);`

- [ ] **Step 4: Run the tests**

Run: `node --test tests/structure-actions.test.mjs && npm test`
Expected: PASS (6 new tests); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/sim tests/structure-actions.test.mjs
git commit -m "feat(sim): sell for half the health-scaled price and paid repairs that pause without credits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Harvesters and refineries

**Files:**
- Create: `src/sim/harvest.js`
- Modify: `src/sim/world.js` (brain per unit, `onStructurePlaced` hook, harvester init on spawn), `src/sim/orders.js` (`harvest`, `returnToBase`), `src/sim/movement.js` (nudged units resume their order; busy units are not nudged), `src/input/controller.js` (click spice with harvesters → harvest)
- Test: `tests/harvest.test.mjs`, `tests/controller.test.mjs` (addition)

**Interfaces:**
- Consumes: `addCredits` (Task 2), `findFreeTile` (Task 5), `World.requestPath`, `World.spawnUnit`.
- Produces: `HARVEST_CAPACITY = 700`, `HARVEST_RATE = 35`, `UNLOAD_RATE = 140`; `initHarvester(u)` (sets `u.harvest = {state, load, acc, field, target, refinery, wait}` and order `harvest`); `dockTile(world, refinery)` → tile index south of the pad column (`x+w-1, y+h`); `findSpice(world, u)`; `updateHarvester(world, u)`; `spawnFreeHarvester(world, refinery)`; `orderHarvest(world, units, x, y)`; `orderReturn(world, units)`. Refinery field `dockedBy` (unit id or 0). Harvester states: `seek`, `toField`, `harvesting`, `toRefinery`, `queued`, `unloading`.
- Commands: `{type:'harvest', ids, x?, y?}`, `{type:'returnToBase', ids}`. Events: `docked {id, refinery}`, `undocked {id, refinery}`, `unitBuilt {…, free:true}`, `eva harvesterDeployed`.
- World: `onStructurePlaced(structure)` hook (spawns the free harvester for refineries).

- [ ] **Step 1: Write the failing tests**

**File: `tests/harvest.test.mjs`**
```js
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
  assert.ok(runUntil(world, () => u.harvest.state === 'harvesting', 40) > 0);
});
```

Append to `tests/controller.test.mjs`:
```js
test('with only harvesters selected, a click on spice orders harvesting there', () => {
  const { world, c, issued } = setup();
  world.map.setSpice(world.map.idx(12, 12), 250);
  const hv = world.spawnUnit('harvester', 'atreides', 3, 14);
  c.selection.set([hv.id]);
  assert.equal(c.cursorFor(c.hitTest(px(12), px(12))), 'attack');
  c.onClick(px(12), px(12), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'harvest', ids: [hv.id], x: 12, y: 12 });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/harvest.test.mjs tests/controller.test.mjs`
Expected: FAIL — spawned harvesters have no `harvest` state (`Cannot read properties of undefined (reading 'load')`) and the controller issues a `move`.

- [ ] **Step 3: Implement the harvester routine**

**File: `src/sim/harvest.js`**
```js
// Harvesters (spec §4.3): find the nearest unclaimed spice, fill up (700 credits in about 20 s),
// drive to the dock just south of a refinery's pad, unload (about 5 s) and return to the field.
// A refinery comes with a free harvester. A player's move or stop suspends the routine; a harvest
// order (or being left idle on spice) resumes it.
import { DT } from '../data/tuning.js';
import { addCredits } from './economy.js';
import { findFreeTile } from './spawn.js';

export const HARVEST_CAPACITY = 700;
export const HARVEST_RATE = 35;
export const UNLOAD_RATE = 140;
const SEEK_RADIUS = 32;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function initHarvester(u) {
  u.harvest = { state: 'seek', load: 0, acc: 0, field: -1, target: -1, refinery: 0, wait: 0 };
  u.order = { type: 'harvest' };
}

export function dockTile(world, ref) {
  const map = world.map;
  const x = ref.x + ref.w - 1, y = ref.y + ref.h;
  if (map.inBounds(x, y) && map.moveFactor(map.idx(x, y), 'harvester') > 0) return map.idx(x, y);
  const t = findFreeTile(world, ref.x + 1, ref.y + ref.h, 'harvester', 3, 1);
  return t ? map.idx(t.x, t.y) : -1;
}

function claimedFields(world, self) {
  const claimed = new Set();
  for (const o of world.units.values()) {
    if (o !== self && o.harvest && (o.harvest.state === 'toField' || o.harvest.state === 'harvesting') && o.harvest.field >= 0) claimed.add(o.harvest.field);
  }
  return claimed;
}

function searchSpice(world, from, radius, claimed, self) {
  const map = world.map;
  const fx = map.xOf(from), fy = map.yOf(from);
  const seen = new Set([from]);
  const queue = [from];
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    if (map.spice[i] > 0 && !claimed.has(i) && (!map.unit[i] || map.unit[i] === self.id)) return i;
    const x = map.xOf(i), y = map.yOf(i);
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy;
      if (!map.inBounds(nx, ny) || Math.max(Math.abs(nx - fx), Math.abs(ny - fy)) > radius) continue;
      const ni = map.idx(nx, ny);
      if (seen.has(ni)) continue;
      seen.add(ni);
      if (map.moveFactor(ni, 'harvester') > 0) queue.push(ni);
    }
  }
  return -1;
}

export function findSpice(world, u) {
  const claimed = claimedFields(world, u);
  if (u.harvest.field >= 0) {
    const near = searchSpice(world, u.harvest.field, 6, claimed, u);
    if (near >= 0) return near;
  }
  return searchSpice(world, world.map.idx(u.tx, u.ty), SEEK_RADIUS, claimed, u);
}

function chooseRefinery(world, u) {
  let best = null, bestScore = Infinity;
  for (const s of world.structures.values()) {
    if (s.house !== u.house || s.typeId !== 'refinery') continue;
    const score = Math.hypot(s.x + s.w - 1 - u.tx, s.y + s.h - u.ty) + (s.dockedBy && s.dockedBy !== u.id ? 6 : 0);
    if (score < bestScore) { best = s; bestScore = score; }
  }
  return best;
}

function releaseDock(world, u) {
  u.noNudge = false;
  const ref = world.structures.get(u.harvest.refinery);
  if (ref && ref.dockedBy === u.id) ref.dockedBy = 0;
  world.events.push('undocked', { id: u.id, refinery: u.harvest.refinery });
}

const near = (map, u, i, r) => Math.max(Math.abs(u.tx - map.xOf(i)), Math.abs(u.ty - map.yOf(i))) <= r;

export function updateHarvester(world, u) {
  const h = u.harvest;
  const map = world.map;
  const here = map.idx(u.tx, u.ty);
  if (u.order.type !== 'harvest') {
    if (h.state === 'unloading') { releaseDock(world, u); h.state = 'toRefinery'; h.target = -1; }
    if (u.order.type === 'idle' && !u.step && u.pathState === 'none' && map.spice[here] > 0) {
      u.order = { type: 'harvest' };
      h.state = 'harvesting';
      h.field = here;
    }
    return;
  }
  const moving = !!u.step || u.pathState === 'waiting' || (u.pathState === 'ready' && u.pathIndex < u.path.length);
  switch (h.state) {
    case 'seek': {
      if (h.load >= HARVEST_CAPACITY) { h.state = 'toRefinery'; h.target = -1; return; }
      if ((h.wait -= DT) > 0) return;
      const tile = findSpice(world, u);
      if (tile < 0) {
        h.wait = 3;
        if (h.load > 0) { h.state = 'toRefinery'; h.target = -1; }
        return;
      }
      h.field = tile;
      if (tile === here) { h.state = 'harvesting'; return; }
      h.state = 'toField';
      world.requestPath(u, tile);
      return;
    }
    case 'toField': {
      if (moving) return;
      if (map.spice[here] > 0) { h.state = 'harvesting'; h.field = here; } else h.state = 'seek';
      return;
    }
    case 'harvesting': {
      if (moving) return;
      h.acc += HARVEST_RATE * DT;
      const take = Math.min(Math.floor(h.acc), map.spice[here], Math.ceil(HARVEST_CAPACITY - h.load));
      if (take > 0) {
        map.setSpice(here, map.spice[here] - take);
        h.load = Math.min(HARVEST_CAPACITY, h.load + take);
        h.acc -= take;
      }
      if (h.load >= HARVEST_CAPACITY) { h.state = 'toRefinery'; h.target = -1; h.acc = 0; return; }
      if (map.spice[here] <= 0) { h.state = 'seek'; h.wait = 0; h.acc = 0; }
      return;
    }
    case 'toRefinery': {
      const ref = chooseRefinery(world, u);
      if (!ref) return;
      const dock = dockTile(world, ref);
      if (dock < 0) return;
      h.refinery = ref.id;
      if (here === dock && !u.step) {
        if (!ref.dockedBy || ref.dockedBy === u.id || !world.units.has(ref.dockedBy)) {
          ref.dockedBy = u.id;
          u.noNudge = true;
          h.state = 'unloading';
          world.events.push('docked', { id: u.id, refinery: ref.id });
        } else h.state = 'queued';
        return;
      }
      if (moving) return;
      if (h.target === dock && ref.dockedBy && ref.dockedBy !== u.id && near(map, u, dock, 2)) { h.state = 'queued'; return; }
      h.target = dock;
      world.requestPath(u, dock);
      return;
    }
    case 'queued': {
      const ref = world.structures.get(h.refinery);
      if (!ref) { h.state = 'toRefinery'; h.target = -1; return; }
      if (!ref.dockedBy || !world.units.has(ref.dockedBy)) { ref.dockedBy = 0; h.state = 'toRefinery'; h.target = -1; }
      return;
    }
    case 'unloading': {
      const ref = world.structures.get(h.refinery);
      if (!ref || ref.dockedBy !== u.id) { u.noNudge = false; h.state = 'toRefinery'; h.target = -1; return; }
      const house = world.houses.get(u.house);
      const amount = Math.min(UNLOAD_RATE * DT, h.load);
      addCredits(world, house, amount);
      house.stats.spiceHarvested += amount;
      h.load -= amount;
      if (h.load <= 1e-6) {
        h.load = 0;
        releaseDock(world, u);
        h.state = 'seek';
        h.wait = 0;
      }
      return;
    }
  }
}

export function spawnFreeHarvester(world, ref) {
  const map = world.map;
  const dock = dockTile(world, ref);
  const spot = dock >= 0 && !map.unit[dock] ? { x: map.xOf(dock), y: map.yOf(dock) } : findFreeTile(world, ref.x + 1, ref.y + ref.h, 'harvester', 5, 1);
  if (!spot) return null;
  const u = world.spawnUnit('harvester', ref.house, spot.x, spot.y, { heading: Math.PI / 2 });
  world.events.push('unitBuilt', { id: u.id, house: ref.house, structureId: ref.id, unitType: 'harvester', free: true });
  world.events.push('eva', { house: ref.house, key: 'harvesterDeployed', text: 'Harvester deployed.' });
  return u;
}

export function orderHarvest(world, units, x, y) {
  const map = world.map;
  for (const u of units) {
    if (!u.harvest) continue;
    if (u.harvest.state === 'unloading') releaseDock(world, u);
    u.order = { type: 'harvest' };
    u.harvest.state = 'seek';
    u.harvest.wait = 0;
    if (Number.isFinite(x) && Number.isFinite(y) && map.inBounds(Math.floor(x), Math.floor(y))) u.harvest.field = map.idx(Math.floor(x), Math.floor(y));
  }
}

export function orderReturn(world, units) {
  for (const u of units) {
    if (!u.harvest) continue;
    u.order = { type: 'harvest' };
    u.harvest.state = 'toRefinery';
    u.harvest.target = -1;
  }
}
```

- [ ] **Step 4: Wire it into the world, orders, movement and controller**

Modify `src/sim/world.js`:
- add `import { initHarvester, updateHarvester, spawnFreeHarvester } from './harvest.js';` after the structure-actions import
- in the constructor, after the `this.onTileEntered = …` line, add:
```js
    this.onStructurePlaced = (s) => { if (s.typeId === 'refinery') spawnFreeHarvester(this, s); };
```
- in `spawnUnit`, before `this.units.set(unit.id, unit);` add:
```js
    if (unit.typeId === 'harvester') initHarvester(unit);
```
- in `spawnStructure`, after the `structurePlaced` event push, add:
```js
    this.onStructurePlaced?.(s);
```
- in `step()`, replace
```js
    for (const u of [...this.units.values()]) if (this.units.has(u.id)) updateMovement(this, u);
```
with
```js
    for (const u of [...this.units.values()]) {
      if (!this.units.has(u.id)) continue;
      if (u.harvest) updateHarvester(this, u);
      updateMovement(this, u);
    }
```

Modify `src/sim/orders.js`:
- add `import { orderHarvest, orderReturn } from './harvest.js';` after the structure-actions import
- add before `default:`
```js
    case 'harvest': orderHarvest(world, units, cmd.x, cmd.y); return;
    case 'returnToBase': orderReturn(world, units); return;
```

Modify `src/sim/movement.js`:
- in `nudge(world, other, requester)`, change the first line to
```js
  if (world.tick - other.nudgedAt < 30 || other.noNudge) return;
```
  and replace `  other.order = { type: 'move', x: map.xOf(target), y: map.yOf(target), nudge: true };` with
```js
  other.resumeOrder = other.order.type === 'move' ? null : other.order;   // e.g. a harvester's routine
  other.order = { type: 'move', x: map.xOf(target), y: map.yOf(target), nudge: true };
```
- in `arrive(world, u)`, replace
```js
  if (u.order.type === 'move') {
    u.order = { type: 'idle' };
```
with
```js
  if (u.order.type === 'move') {
    u.order = (u.order.nudge && u.resumeOrder) || { type: 'idle' };
    u.resumeOrder = null;
```

Modify `src/input/controller.js`:
- in `order(hit)`, directly after the passability check (`if (!units.some(…)) return;`), add:
```js
    if (units.every((u) => u.harvest) && map.spice[i] > 0) {
      this.issue({ type: 'harvest', ids: units.map((u) => u.id), x: tx, y: ty });
      this.onMarker(tx + 0.5, ty + 0.5);
      return;
    }
```
- in `cursorFor(hit)`, replace the last line `    return own.some(…) ? 'move' : 'noMove';` with:
```js
    if (!own.some((u) => this.world.map.moveFactor(i, u.move) > 0)) return 'noMove';
    return own.every((u) => u.harvest) && this.world.map.spice[i] > 0 ? 'attack' : 'move';
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/harvest.test.mjs tests/controller.test.mjs && npm test`
Expected: PASS (6 + 1 new tests); suite green. If "two harvesters share one refinery" sees `most = 2`, check that `toRefinery` only docks when `dockedBy` is empty and that the queued harvester waits within two tiles of the dock.

- [ ] **Step 6: Commit**

```bash
git add src/sim src/input/controller.js tests/harvest.test.mjs tests/controller.test.mjs
git commit -m "feat(sim): harvesters with fields, refinery docking queue, free harvester, harvest orders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Fog of war

**Files:**
- Create: `src/sim/fog.js`
- Modify: `src/sim/world.js` (fog every 5 ticks)
- Test: `tests/fog.test.mjs`

**Interfaces:**
- Consumes: `unitSight` (tuning), structure `sight`.
- Produces: `class FogLayer(w, h)` with `explored`, `visible` (Uint8Array 0/1), `revision` (bumped by every update), `reveal(cx, cy, r)`; `updateFog(world)` (every house gets `house.fog`; enemy structures record `seenBy` bits by house slot); `isVisible(world, houseId, x, y)`; `unitVisibleTo(world, houseId, unit)`; `structureVisibleTo(world, houseId, structure)`; `World.fogOfWar` (default `true`; `false` skips fog and makes everything visible). Explored tiles never re-cover; units need current sight; structures stay visible once seen (spec §4.9).

- [ ] **Step 1: Write the failing tests**

**File: `tests/fog.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { isVisible, unitVisibleTo, structureVisibleTo } from '../src/sim/fog.js';
import { flatWorld, run } from './helpers.mjs';

test('units reveal their sight radius; explored ground stays revealed', () => {
  const world = flatWorld(40, 20, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 10, { heading: 0 });
  world.step();
  const fog = world.houses.get('atreides').fog;
  assert.equal(isVisible(world, 'atreides', 9, 10), true, 'sight 3 + 1 reaches four tiles');
  assert.equal(isVisible(world, 'atreides', 10, 10), false);
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 30, y: 10 });
  run(world, 30);
  assert.equal(isVisible(world, 'atreides', 5, 10), false, 'no longer seen');
  assert.equal(fog.explored[world.map.idx(5, 10)], 1, 'but still explored');
});

test('enemy units are visible only in current sight; own units always', () => {
  const world = flatWorld(40, 20, G.ROCK);
  world.spawnUnit('combatTank', 'atreides', 5, 10);
  const near = world.spawnUnit('quad', 'harkonnen', 8, 10);
  const far = world.spawnUnit('quad', 'harkonnen', 30, 10);
  world.step();
  assert.equal(unitVisibleTo(world, 'atreides', near), true);
  assert.equal(unitVisibleTo(world, 'atreides', far), false);
  assert.equal(unitVisibleTo(world, 'harkonnen', far), true);
});

test('enemy structures stay visible after they were seen once', () => {
  const world = flatWorld(40, 20, G.ROCK);
  const scout = world.spawnUnit('trike', 'atreides', 22, 10, { heading: 0 });
  const yard = world.spawnStructure('constructionYard', 'harkonnen', 24, 9);
  assert.equal(structureVisibleTo(world, 'atreides', yard), false);
  world.step();
  assert.equal(structureVisibleTo(world, 'atreides', yard), true);
  world.issue('atreides', { type: 'move', ids: [scout.id], x: 2, y: 10 });
  run(world, 15);
  assert.equal(isVisible(world, 'atreides', 24, 9), false);
  assert.equal(structureVisibleTo(world, 'atreides', yard), true);
});

test('with fog of war switched off everything is visible', () => {
  const world = flatWorld(40, 20, G.ROCK);
  world.fogOfWar = false;
  world.spawnUnit('combatTank', 'atreides', 5, 10);
  const far = world.spawnUnit('quad', 'harkonnen', 30, 10);
  const yard = world.spawnStructure('constructionYard', 'harkonnen', 34, 4);
  world.step();
  assert.equal(world.houses.get('atreides').fog, undefined);
  assert.equal(isVisible(world, 'atreides', 30, 10), true);
  assert.equal(unitVisibleTo(world, 'atreides', far), true);
  assert.equal(structureVisibleTo(world, 'atreides', yard), true);
});

test('structures reveal around their footprint', () => {
  const world = flatWorld(40, 20, G.ROCK);
  world.spawnStructure('outpost', 'atreides', 10, 10);
  world.step();
  assert.equal(isVisible(world, 'atreides', 20, 10), true, 'the outpost sees ten tiles');
  assert.equal(isVisible(world, 'atreides', 24, 10), false);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/fog.test.mjs`
Expected: FAIL — cannot find `../src/sim/fog.js`.

- [ ] **Step 3: Implement fog**

**File: `src/sim/fog.js`**
```js
// Fog of war (spec §4.9): explored terrain stays revealed; enemy units need current sight; enemy
// structures stay visible once seen. One layer per house, rebuilt every five ticks.
import { unitSight } from '../data/tuning.js';

export class FogLayer {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.explored = new Uint8Array(w * h);
    this.visible = new Uint8Array(w * h);
    this.revision = 0;   // bumps on every update so views know when to refresh
  }

  reveal(cx, cy, r) {
    const r2 = r * r + r * 0.5;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
      const i = y * this.w + x;
      this.visible[i] = 1;
      this.explored[i] = 1;
    }
  }
}

export function updateFog(world) {
  const { map } = world;
  for (const house of world.houses.values()) {
    const fog = (house.fog ??= new FogLayer(map.w, map.h));
    fog.visible.fill(0);
    fog.revision++;
    for (const u of world.units.values()) if (u.house === house.id) fog.reveal(u.tx, u.ty, unitSight(u.type.sight));
    for (const s of world.structures.values()) if (s.house === house.id) fog.reveal(s.x + (s.w - 1) / 2, s.y + (s.h - 1) / 2, s.type.sight + Math.max(s.w, s.h) / 2);
    const bit = 1 << house.slot;
    for (const s of world.structures.values()) {
      if (s.house === house.id || (s.seenBy ?? 0) & bit) continue;
      for (let dy = 0; dy < s.h && !((s.seenBy ?? 0) & bit); dy++) for (let dx = 0; dx < s.w; dx++) {
        if (fog.visible[(s.y + dy) * map.w + s.x + dx]) { s.seenBy = (s.seenBy ?? 0) | bit; break; }
      }
    }
  }
}

export function isVisible(world, houseId, x, y) {
  if (!world.fogOfWar) return true;
  const fog = world.houses.get(houseId)?.fog;
  if (!fog) return true;
  return fog.visible[y * fog.w + x] === 1;
}

export function unitVisibleTo(world, houseId, u) {
  return u.house === houseId || isVisible(world, houseId, u.tx, u.ty);
}

export function structureVisibleTo(world, houseId, s) {
  if (s.house === houseId || !world.fogOfWar) return true;
  const house = world.houses.get(houseId);
  return !!house && ((s.seenBy ?? 0) & (1 << house.slot)) !== 0;
}
```

Modify `src/sim/world.js`:
- add `import { updateFog } from './fog.js';` after the harvest import
- in the constructor, after `this.tick = 0;` add `    this.fogOfWar = true;    // skirmish option; false reveals everything`
- in `step()`, after `    if (this.tick % 10 === 0) updatePower(this);` add
```js
    if (this.fogOfWar && this.tick % 5 === 0) updateFog(this);
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/fog.test.mjs && npm test`
Expected: PASS (5 new tests); suite green.

- [ ] **Step 5: Commit**

```bash
git add src/sim/fog.js src/sim/world.js tests/fog.test.mjs
git commit -m "feat(sim): fog of war with permanent exploration, current sight and remembered structures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Structure models

**Files:**
- Create: `src/render/models/structures/common.js`, `windtrap.js`, `refinery.js`, `silo.js`, `outpost.js`, `barracks.js`, `wor.js`, `light-factory.js`, `heavy-factory.js`, `turret.js`, `wall.js` (all in `src/render/models/structures/`), `src/scenes/structures.js`
- Modify: `src/render/models/palette.js` (olive, adobe, beige), `src/render/models/index.js` (registry), `src/main.js`, `scripts/scenarios.mjs`
- Test: `tests/models-catalog.test.mjs` (additions)

**Interfaces:**
- Consumes: kit, palette, `ModelBuilder` (plan 1a).
- Produces: model builders `windtrap`, `refinery`, `silo`, `outpost`, `barracks`, `wor`, `lightFactory`, `heavyFactory`, `gunTurret` (id `turret`), `rocketTurret`, `wallPost`, `wallArm`; helpers `slab(b, w, h, color)` and `beacon(b, x, y, z, node)`. Animated node params: `fan` (wind trap turbine), `dish` (outpost radar), `padLights` (refinery, scale pulse, default 1), `door` (heavy factory, slides up 0…0.4), `flag` (barracks), `turret` + `barrel` (turrets). Every structure model is centred on its footprint, stands on y = 0 and faces south (+z). `STRUCTURE_MODEL` maps every non-deferred structure to its model (`wall` → `wallPost`; views add arms).

- [ ] **Step 1: Extend the catalogue test (failing)**

Append to `tests/models-catalog.test.mjs`:
```js
import { STRUCTURE_MODEL } from '../src/render/models/index.js';

test('every plan-1b structure has a real model with its animated nodes', () => {
  for (const id of ['windtrap', 'refinery', 'silo', 'outpost', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'turret', 'rocketTurret', 'wall']) {
    assert.ok(STRUCTURE_MODEL[id], `${id} is mapped`);
    assert.ok(!STRUCTURE_MODEL[id].startsWith('placeholder'));
  }
  const nodes = (id) => modelDef(STRUCTURE_MODEL[id]).nodes;
  assert.ok(nodes('windtrap').fan && nodes('outpost').dish && nodes('refinery').padLights && nodes('heavyFactory').door);
  assert.ok(nodes('barracks').flag && nodes('turret').turret && nodes('turret').barrel && nodes('rocketTurret').turret);
  assert.ok(modelDef('wallArm').parts.length > 0);
});

test('structure models stay inside their footprint', () => {
  for (const [id, s] of Object.entries(STRUCTURES)) {
    const m = STRUCTURE_MODEL[id];
    if (!m || m.startsWith('placeholder')) continue;
    for (const p of modelDef(m).parts) {
      if (p.node !== 'root') continue;
      p.geometry.computeBoundingBox();
      const b = p.geometry.boundingBox;
      assert.ok(b.max.x - b.min.x <= s.w + 0.01 && b.max.z - b.min.z <= s.h + 0.01, `${id} fits ${s.w}x${s.h}`);
    }
  }
});
```

Run: `node --test tests/models-catalog.test.mjs`
Expected: FAIL — `STRUCTURE_MODEL.windtrap` is undefined.

- [ ] **Step 2: Palette additions and shared helpers**

Modify `src/render/models/palette.js` — add these entries inside `PAL` (after `concreteDark`):
```js
  olive: 0x7d7a52, oliveDark: 0x5c5a3c, adobe: 0xb58a5c, adobeDark: 0x8e6843, beige: 0xcbb896,
```

**File: `src/render/models/structures/common.js`**
```js
// Shared structure pieces: the concrete apron (dips below ground to hide terrain seams) and a house beacon.
import { MAT, box, sphere } from '../kit.js';
import { PAL } from '../palette.js';

export function slab(b, w, h, color = PAL.concrete) {
  b.add(MAT.PAINT, box(w - 0.06, 0.11, h - 0.06, { p: [0, -0.005, 0], color }));
  for (let k = 1; k < w; k++) b.add(MAT.DARK, box(0.02, 0.012, h - 0.1, { p: [-w / 2 + k, 0.052, 0], color: PAL.concreteDark }));
  for (let k = 1; k < h; k++) b.add(MAT.DARK, box(w - 0.1, 0.012, 0.02, { p: [0, 0.052, -h / 2 + k], color: PAL.concreteDark }));
}

export function beacon(b, x, y, z, node = 'root') {
  b.add(MAT.HOUSE_LIGHT, sphere(0.03, 8, { p: [x, y, z], glow: 2.5 }), node);
}

export function halfArc(r, height, steps = 14) {
  const pts = [];
  for (let k = 0; k <= steps; k++) { const a = (k / steps) * Math.PI; pts.push([Math.cos(a) * r, Math.sin(a) * height]); }
  return pts;
}
```

- [ ] **Step 3: Economy and command structures**

**File: `src/render/models/structures/windtrap.js`**
```js
// Wind Trap (2x2): two ribbed half-dome air intakes with dark louvred mouths facing south (Mentat
// art), a machinery block behind them with a spinning turbine vent, and pipes between.
import { ModelBuilder, MAT, box, rbox, cyl, prism, torus } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon, halfArc } from './common.js';

export function windtrap() {
  const b = new ModelBuilder('windtrap');
  slab(b, 2, 2);
  for (const x of [-0.47, 0.47]) {
    b.add(MAT.PAINT, prism(halfArc(0.42, 0.5), 1.0, { p: [x, 0.05, 0.08], color: PAL.steel }));
    b.add(MAT.DARK, prism(halfArc(0.34, 0.41), 0.02, { p: [x, 0.05, 0.59], color: 0x1b1916 }));
    for (let k = 0; k < 4; k++) {
      const y = 0.12 + k * 0.08;
      const half = 0.34 * Math.sqrt(Math.max(0, 1 - ((y - 0.05) / 0.41) ** 2));
      b.add(MAT.METAL, box(half * 1.9, 0.018, 0.03, { p: [x, y, 0.605], color: PAL.steelDark }));
    }
    for (const z of [-0.3, 0.05, 0.4]) b.add(MAT.METAL, torus(0.425, 0.014, 4, 16, { p: [x, 0.05, z], s: [1, 1.18, 1], color: PAL.steelDark }, Math.PI));
    b.add(MAT.METAL, cyl(0.05, 0.05, 0.36, 8, { p: [x, 0.2, -0.46], r: [Math.PI / 2, 0, 0], color: PAL.gunmetal }));
  }
  b.add(MAT.PAINT, rbox(1.7, 0.3, 0.42, 0.03, { p: [0, 0.2, -0.72], color: PAL.steelDark }));
  b.add(MAT.HOUSE, box(1.72, 0.05, 0.43, { p: [0, 0.3, -0.72] }));
  b.add(MAT.METAL, cyl(0.2, 0.22, 0.12, 18, { p: [0.45, 0.4, -0.72], color: PAL.steel }));
  b.node('fan', { pivot: [0.45, 0.47, -0.72] });
  b.add(MAT.DARK, cyl(0.04, 0.04, 0.03, 8, { color: PAL.gunmetal }), 'fan');
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    b.add(MAT.METAL, box(0.17, 0.012, 0.05, { p: [Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09], r: [0, -a, 0], color: PAL.steelDark }), 'fan');
  }
  beacon(b, -0.8, 0.4, -0.72);
  return b.build({ radius: 1.0 });
}
```

**File: `src/render/models/structures/refinery.js`**
```js
// Spice Refinery (3x2): domed processing tanks, a processing tower and stack on the west two thirds,
// and the harvester docking pad (house chevrons, pulsing pad lights, gantry) in the east column.
// Harvesters dock on the tile just south of the pad.
import { ModelBuilder, MAT, box, cyl, dome, sphere, tube } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

export function refinery() {
  const b = new ModelBuilder('refinery');
  slab(b, 3, 2);
  const tank = (x, z, r, h) => {
    b.add(MAT.PAINT, cyl(r, r, h, 20, { p: [x, 0.05 + h / 2, z], color: PAL.steel }));
    b.add(MAT.PAINT, dome(r, 20, { p: [x, 0.05 + h, z], color: PAL.steel }));
    b.add(MAT.HOUSE, cyl(r + 0.005, r + 0.005, 0.05, 20, { p: [x, 0.05 + h * 0.7, z] }));
  };
  tank(-1.05, -0.45, 0.3, 0.5);
  tank(-0.4, -0.5, 0.26, 0.42);
  tank(-0.75, 0.38, 0.28, 0.36);
  b.add(MAT.PAINT, box(0.34, 0.95, 0.34, { p: [0.05, 0.5, 0.35], color: PAL.steelDark }));
  b.add(MAT.GLASS, box(0.35, 0.08, 0.35, { p: [0.05, 0.75, 0.35], color: PAL.glass }));
  b.add(MAT.METAL, cyl(0.07, 0.08, 0.5, 10, { p: [0.05, 1.2, 0.35], color: PAL.gunmetal }));
  b.add(MAT.METAL, tube([[-1.05, 0.35, -0.45], [-0.4, 0.4, -0.45], [0.2, 0.35, -0.3], [0.55, 0.3, -0.3]], 0.035, 6, { color: PAL.steelDark }));
  b.add(MAT.METAL, tube([[-0.75, 0.3, 0.38], [-0.3, 0.3, 0.1], [0.55, 0.25, 0.1]], 0.03, 6, { color: PAL.steelDark }));
  b.add(MAT.DARK, box(0.88, 0.07, 1.86, { p: [1.0, 0.085, 0], color: 0x2e2d2b }));
  for (const z of [-0.55, 0, 0.55]) for (const side of [-1, 1]) b.add(MAT.HOUSE, box(0.3, 0.012, 0.07, { p: [1.0 + side * 0.13, 0.126, z], r: [0, side * 0.55, 0] }));
  b.node('padLights', { pivot: [1.0, 0.13, 0], kind: 'scale' });
  for (const z of [-0.85, -0.3, 0.3, 0.85]) for (const x of [-0.4, 0.4]) b.add(MAT.HOUSE_LIGHT, sphere(0.028, 8, { p: [x, 0, z], glow: 2.5 }), 'padLights');
  for (const z of [-0.8, 0.8]) b.add(MAT.METAL, box(0.06, 0.6, 0.06, { p: [1.42, 0.35, z], color: PAL.steelDark }));
  b.add(MAT.METAL, box(0.08, 0.06, 1.68, { p: [1.42, 0.66, 0], color: PAL.steel }));
  b.add(MAT.METAL, box(0.5, 0.05, 0.08, { p: [1.18, 0.62, -0.2], color: PAL.steelDark }));
  beacon(b, 0.05, 1.47, 0.35);
  return b.build({ radius: 1.6 });
}
```

**File: `src/render/models/structures/silo.js`**
```js
// Spice Silo (2x2): two tall storage tanks with flattened domes, house bands, ladders and a pump house.
import { ModelBuilder, MAT, box, rbox, cyl, dome, tube } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

export function silo() {
  const b = new ModelBuilder('silo');
  slab(b, 2, 2);
  for (const x of [-0.45, 0.45]) {
    b.add(MAT.PAINT, cyl(0.4, 0.42, 0.72, 24, { p: [x, 0.41, -0.12], color: PAL.steel }));
    b.add(MAT.PAINT, dome(0.4, 24, { p: [x, 0.77, -0.12], s: [1, 0.45, 1], color: PAL.steel }));
    b.add(MAT.HOUSE, cyl(0.405, 0.415, 0.07, 24, { p: [x, 0.5, -0.12] }));
    b.add(MAT.METAL, box(0.05, 0.62, 0.02, { p: [x + 0.2, 0.4, 0.28], color: PAL.steelDark }));
    for (let k = 0; k < 6; k++) b.add(MAT.METAL, box(0.08, 0.01, 0.02, { p: [x + 0.2, 0.15 + k * 0.1, 0.29], color: PAL.steelDark }));
  }
  b.add(MAT.PAINT, rbox(0.5, 0.2, 0.3, 0.03, { p: [0, 0.16, 0.6], color: PAL.steelDark }));
  b.add(MAT.METAL, tube([[-0.45, 0.2, 0.3], [0, 0.25, 0.55], [0.45, 0.2, 0.3]], 0.04, 6, { color: PAL.gunmetal }));
  beacon(b, 0, 0.3, 0.6);
  return b.build({ radius: 1.0 });
}
```

**File: `src/render/models/structures/outpost.js`**
```js
// Radar Outpost (2x2): olive command bunker with slit windows, a mast with a rotating radar dish,
// and whip antennas.
import { ModelBuilder, MAT, box, rbox, cyl, prism, lathe } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

export function outpost() {
  const b = new ModelBuilder('outpost');
  slab(b, 2, 2);
  b.add(MAT.PAINT, rbox(1.5, 0.38, 1.2, 0.05, { p: [0, 0.24, 0.1], color: PAL.olive }));
  b.add(MAT.PAINT, prism([[-0.75, 0], [0.75, 0], [0.62, 0.14], [-0.62, 0.14]], 1.1, { p: [0, 0.43, 0.1], color: PAL.oliveDark }));
  for (const x of [-0.45, 0, 0.45]) b.add(MAT.GLASS, box(0.3, 0.06, 0.02, { p: [x, 0.3, 0.71], color: PAL.glass }));
  b.add(MAT.HOUSE, box(1.52, 0.05, 1.22, { p: [0, 0.39, 0.1] }));
  b.add(MAT.METAL, cyl(0.04, 0.06, 0.75, 8, { p: [0.45, 0.8, -0.35], color: PAL.steelDark }));
  b.node('dish', { pivot: [0.45, 1.15, -0.35] });
  const bowl = [[0.01, 0], [0.12, 0.03], [0.26, 0.11], [0.3, 0.15]];
  b.add(MAT.METAL, lathe(bowl, 20, { r: [1.2, 0, 0], color: PAL.steel }), 'dish');
  b.add(MAT.METAL, lathe([...bowl].reverse(), 20, { r: [1.2, 0, 0], color: PAL.steelDark }), 'dish');
  b.add(MAT.METAL, cyl(0.012, 0.012, 0.2, 6, { p: [0, 0.05, 0.1], r: [1.2, 0, 0], color: PAL.gunmetal }), 'dish');
  for (const [x, z, h] of [[-0.6, -0.4, 0.5], [-0.45, -0.45, 0.35]]) b.add(MAT.METAL, cyl(0.008, 0.01, h, 5, { p: [x, 0.43 + h / 2, z], color: PAL.gunmetal }));
  beacon(b, -0.6, 0.7, -0.4);
  return b.build({ radius: 1.0 });
}
```

- [ ] **Step 4: Military structures, turrets and walls**

**File: `src/render/models/structures/barracks.js`**
```js
// Barracks (2x2): walled compound (Mentat art) with a gate facing south, two low buildings, steps,
// and a flagpole flying the house flag.
import { ModelBuilder, MAT, box, rbox, cyl } from '../kit.js';
import { PAL } from '../palette.js';
import { slab } from './common.js';

export function barracks() {
  const b = new ModelBuilder('barracks');
  slab(b, 2, 2, PAL.beige);
  const wall = (x, z, w, d) => b.add(MAT.PAINT, box(w, 0.26, d, { p: [x, 0.18, z], color: PAL.sandLight }));
  wall(0, -0.9, 1.8, 0.1);
  wall(-0.9, 0, 0.1, 1.8);
  wall(0.9, 0, 0.1, 1.8);
  wall(-0.55, 0.9, 0.7, 0.1);
  wall(0.55, 0.9, 0.7, 0.1);
  b.add(MAT.PAINT, rbox(0.75, 0.34, 0.5, 0.03, { p: [-0.35, 0.22, -0.5], color: PAL.sand }));
  b.add(MAT.PAINT, rbox(0.55, 0.28, 0.62, 0.03, { p: [0.45, 0.19, -0.2], color: PAL.sandDark }));
  b.add(MAT.HOUSE, box(0.77, 0.04, 0.52, { p: [-0.35, 0.4, -0.5] }));
  for (let k = 0; k < 3; k++) b.add(MAT.PAINT, box(0.2, 0.05, 0.08, { p: [-0.35, 0.07 + k * 0.05, -0.2 + k * 0.07], color: PAL.sandDark }));
  b.add(MAT.DARK, box(0.18, 0.2, 0.02, { p: [0.45, 0.15, 0.11], color: PAL.gunmetal }));
  b.add(MAT.METAL, cyl(0.012, 0.015, 0.9, 6, { p: [0.62, 0.5, 0.55], color: PAL.steel }));
  b.node('flag', { pivot: [0.62, 0.88, 0.55] });
  b.add(MAT.HOUSE, box(0.26, 0.15, 0.012, { p: [0.14, 0, 0] }), 'flag');
  return b.build({ radius: 1.0 });
}
```

**File: `src/render/models/structures/wor.js`**
```js
// WOR trooper facility (2x2): adobe fortress (Mentat art) with arched windows, four crenellated
// corner towers, a central dome and a house banner over the gate.
import { ModelBuilder, MAT, box, rbox, cyl, dome, sphere } from '../kit.js';
import { PAL } from '../palette.js';
import { slab } from './common.js';

export function wor() {
  const b = new ModelBuilder('wor');
  slab(b, 2, 2, PAL.beige);
  b.add(MAT.PAINT, rbox(1.4, 0.42, 1.3, 0.04, { p: [0, 0.26, 0], color: PAL.adobe }));
  for (const x of [-0.45, -0.15, 0.15, 0.45]) {
    b.add(MAT.DARK, box(0.12, 0.16, 0.02, { p: [x, 0.3, 0.655], color: 0x2b211a }));
    b.add(MAT.DARK, cyl(0.06, 0.06, 0.02, 10, { p: [x, 0.38, 0.655], r: [Math.PI / 2, 0, 0], color: 0x2b211a }));
  }
  for (const [x, z] of [[-0.72, -0.66], [0.72, -0.66], [-0.72, 0.66], [0.72, 0.66]]) {
    b.add(MAT.PAINT, cyl(0.16, 0.19, 0.66, 12, { p: [x, 0.38, z], color: PAL.adobeDark }));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      b.add(MAT.PAINT, box(0.07, 0.07, 0.07, { p: [x + Math.cos(a) * 0.14, 0.74, z + Math.sin(a) * 0.14], color: PAL.adobeDark }));
    }
  }
  b.add(MAT.PAINT, dome(0.34, 20, { p: [0, 0.47, -0.1], color: PAL.adobeDark }));
  b.add(MAT.HOUSE, box(0.3, 0.36, 0.02, { p: [0, 0.3, 0.665] }));
  b.add(MAT.HOUSE_LIGHT, sphere(0.03, 8, { p: [0, 0.82, -0.1], glow: 2.5 }));
  return b.build({ radius: 1.0 });
}
```

**File: `src/render/models/structures/light-factory.js`**
```js
// Light Factory (2x2): vehicle hangar with a curved roof and an open bay facing south, a gantry
// crane over the yard, and a glazed control booth.
import { ModelBuilder, MAT, box, rbox, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon, halfArc } from './common.js';

export function lightFactory() {
  const b = new ModelBuilder('lightFactory');
  slab(b, 2, 2);
  const arc = halfArc(0.55, 0.45);
  b.add(MAT.PAINT, prism(arc, 1.1, { p: [-0.25, 0.05, -0.3], color: PAL.steel }));
  b.add(MAT.DARK, prism(arc.map(([x, y]) => [x * 0.8, y * 0.8]), 0.02, { p: [-0.25, 0.05, 0.26], color: 0x1b1916 }));
  b.add(MAT.HOUSE, box(0.06, 0.06, 1.12, { p: [-0.25, 0.5, -0.3] }));
  for (const x of [0.45, 0.85]) b.add(MAT.METAL, box(0.05, 0.62, 0.05, { p: [x, 0.36, 0.55], color: PAL.yellow }));
  b.add(MAT.METAL, box(0.5, 0.06, 0.06, { p: [0.65, 0.68, 0.55], color: PAL.yellow }));
  b.add(MAT.METAL, cyl(0.004, 0.004, 0.3, 4, { p: [0.62, 0.52, 0.55], color: PAL.gunmetal }));
  b.add(MAT.PAINT, rbox(0.32, 0.36, 0.3, 0.03, { p: [0.65, 0.23, -0.55], color: PAL.steelDark }));
  b.add(MAT.GLASS, box(0.33, 0.07, 0.31, { p: [0.65, 0.35, -0.55], color: PAL.glass }));
  beacon(b, 0.65, 0.46, -0.55);
  return b.build({ radius: 1.0 });
}
```

**File: `src/render/models/structures/heavy-factory.js`**
```js
// Heavy Factory (3x2): big vehicle hall with a sawtooth roof, a bay door on the south side that slides
// up when a vehicle rolls out, twin smokestacks with house bands, a roof crane and an office.
import { ModelBuilder, MAT, box, rbox, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

export function heavyFactory() {
  const b = new ModelBuilder('heavyFactory');
  slab(b, 3, 2);
  b.add(MAT.PAINT, box(2.7, 0.55, 1.35, { p: [0, 0.33, -0.2], color: PAL.steel }));
  for (let k = 0; k < 4; k++) b.add(MAT.PAINT, prism([[-0.3, 0], [0.3, 0], [0.3, 0.22]], 1.3, { p: [-1.0 + k * 0.66, 0.6, -0.2], color: PAL.steelDark }));
  b.add(MAT.DARK, box(1.1, 0.42, 0.04, { p: [0.3, 0.26, 0.48], color: 0x161513 }));
  b.node('door', { pivot: [0.3, 0.26, 0.5], axis: 'y', kind: 'trans' });
  b.add(MAT.PAINT, box(1.12, 0.42, 0.03, { color: PAL.steelDark }), 'door');
  for (let k = 0; k < 5; k++) b.add(MAT.DARK, box(1.12, 0.012, 0.035, { p: [0, -0.16 + k * 0.08, 0], color: PAL.gunmetal }), 'door');
  b.add(MAT.HOUSE, box(1.2, 0.06, 0.04, { p: [0.3, 0.52, 0.5] }));
  for (const x of [-1.1, -0.8]) {
    b.add(MAT.METAL, cyl(0.08, 0.1, 0.9, 12, { p: [x, 0.95, -0.65], color: PAL.gunmetal }));
    b.add(MAT.HOUSE, cyl(0.105, 0.105, 0.06, 12, { p: [x, 1.2, -0.65] }));
  }
  b.add(MAT.METAL, box(0.08, 0.35, 0.08, { p: [0.9, 0.78, -0.6], color: PAL.yellow }));
  b.add(MAT.METAL, box(0.7, 0.06, 0.08, { p: [0.65, 0.95, -0.6], color: PAL.yellow }));
  b.add(MAT.PAINT, rbox(0.4, 0.3, 0.35, 0.03, { p: [-1.05, 0.2, 0.55], color: PAL.steelDark }));
  b.add(MAT.GLASS, box(0.41, 0.07, 0.36, { p: [-1.05, 0.3, 0.55], color: PAL.glass }));
  beacon(b, -1.05, 0.4, 0.55);
  return b.build({ radius: 1.6 });
}
```

**File: `src/render/models/structures/turret.js`**
```js
// Gun Turret and Rocket Turret (1x1): round khaki bunker (Mentat art) with a rotating head — a long
// gun with a muzzle brake, or twin rocket pods with red warheads. Heads rest facing east (+x);
// views turn them north on placement.
import { ModelBuilder, MAT, box, rbox, cyl, cone } from '../kit.js';
import { PAL } from '../palette.js';
import { slab } from './common.js';

function bunker(b) {
  slab(b, 1, 1, PAL.concreteDark);
  b.add(MAT.PAINT, cyl(0.36, 0.44, 0.34, 20, { p: [0, 0.2, 0], color: PAL.olive }));
  b.add(MAT.HOUSE, cyl(0.365, 0.37, 0.05, 20, { p: [0, 0.3, 0] }));
  b.node('turret', { pivot: [0, 0.37, 0] });
}

export function gunTurret() {
  const b = new ModelBuilder('turret');
  bunker(b);
  b.node('barrel', { parent: 'turret', pivot: [0.14, 0.07, 0], axis: 'x', kind: 'trans' });
  b.add(MAT.PAINT, rbox(0.36, 0.14, 0.3, 0.04, { p: [0, 0.07, 0], color: PAL.oliveDark }), 'turret');
  b.add(MAT.METAL, cyl(0.022, 0.026, 0.42, 10, { p: [0.21, 0, 0], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }), 'barrel');
  b.add(MAT.METAL, box(0.06, 0.05, 0.06, { p: [0.43, 0, 0], color: PAL.gunmetal }), 'barrel');
  return b.build({ radius: 0.5, muzzle: [0.46, 0, 0] });
}

export function rocketTurret() {
  const b = new ModelBuilder('rocketTurret');
  bunker(b);
  b.add(MAT.PAINT, rbox(0.26, 0.14, 0.24, 0.04, { p: [0, 0.07, 0], color: PAL.oliveDark }), 'turret');
  for (const z of [-0.2, 0.2]) {
    b.add(MAT.METAL, box(0.3, 0.14, 0.13, { p: [0.03, 0.12, z], r: [0, 0, 0.2], color: PAL.steelDark }), 'turret');
    for (const y of [0.09, 0.15]) for (const dz of [-0.03, 0.03]) {
      b.add(MAT.PAINT, cone(0.02, 0.05, 6, { p: [0.2, y + 0.03, z + dz], r: [0, 0, -Math.PI / 2 + 0.2], color: PAL.rocketRed }), 'turret');
    }
  }
  return b.build({ radius: 0.5, muzzle: [0.22, 0.15, 0] });
}
```

**File: `src/render/models/structures/wall.js`**
```js
// Wall pieces: a crenellated post on every wall tile, and an arm reaching towards each walled
// neighbour (the structure views add and turn the arms).
import { ModelBuilder, MAT, box } from '../kit.js';
import { PAL } from '../palette.js';

export function wallPost() {
  const b = new ModelBuilder('wallPost');
  b.add(MAT.PAINT, box(0.36, 0.38, 0.36, { p: [0, 0.17, 0], color: PAL.beige }));
  for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) b.add(MAT.PAINT, box(0.08, 0.08, 0.08, { p: [x, 0.4, z], color: PAL.beige }));
  return b.build({ radius: 0.5 });
}

export function wallArm() {
  const b = new ModelBuilder('wallArm');
  b.add(MAT.PAINT, box(0.34, 0.3, 0.26, { p: [0.33, 0.13, 0], color: PAL.sandLight }));
  for (const x of [0.22, 0.4]) b.add(MAT.PAINT, box(0.07, 0.07, 0.26, { p: [x, 0.315, 0], color: PAL.sandLight }));
  return b.build({ radius: 0.5 });
}
```

Modify `src/render/models/index.js`:
- add imports after the construction-yard import:
```js
import { windtrap } from './structures/windtrap.js';
import { refinery } from './structures/refinery.js';
import { silo } from './structures/silo.js';
import { outpost } from './structures/outpost.js';
import { barracks } from './structures/barracks.js';
import { wor } from './structures/wor.js';
import { lightFactory } from './structures/light-factory.js';
import { heavyFactory } from './structures/heavy-factory.js';
import { gunTurret, rocketTurret } from './structures/turret.js';
import { wallPost, wallArm } from './structures/wall.js';
```
- replace the `BUILDERS` line with:
```js
const BUILDERS = {
  combatTank, siegeTank, missileTank, deviator, sonicTank, devastator, harvester, mcv, trike, quad, soldier, trooper,
  constructionYard, windtrap, refinery, silo, outpost, barracks, wor, lightFactory, heavyFactory,
  turret: gunTurret, rocketTurret, wallPost, wallArm, placeholderUnit,
};
```
- replace the `STRUCTURE_MODEL` line with:
```js
export const STRUCTURE_MODEL = {
  constructionYard: 'constructionYard', windtrap: 'windtrap', refinery: 'refinery', silo: 'silo', outpost: 'outpost',
  barracks: 'barracks', wor: 'wor', lightFactory: 'lightFactory', heavyFactory: 'heavyFactory',
  turret: 'turret', rocketTurret: 'rocketTurret', wall: 'wallPost',
};
```

- [ ] **Step 5: Run the catalogue tests**

Run: `node --test tests/models-catalog.test.mjs && npm test`
Expected: PASS; suite green. A footprint failure names the model whose root parts overflow — shrink that part.

- [ ] **Step 6: Structure gallery scene and review**

**File: `src/scenes/structures.js`**
```js
// Structure gallery: every plan-1b structure in one house's colours on concrete, with animations
// running, for visual review against docs/research/refs/pc-structure-*.
import * as THREE from 'three';
import { Renderer3D } from '../render/renderer.js';
import { Heightfield } from '../render/heightfield.js';
import { TerrainView } from '../render/terrain.js';
import { CameraRig } from '../render/camera-rig.js';
import { InstancedModel } from '../render/models/instancer.js';
import { modelDef, STRUCTURE_MODEL } from '../render/models/index.js';
import { GameMap } from '../sim/map.js';
import { G } from '../data/terrain.js';
import { STRUCTURES } from '../data/structures.js';
import { HOUSES } from '../data/houses.js';
import { readParams } from '../core/params.js';

const LAYOUT = [
  ['constructionYard', 1, 1], ['windtrap', 4, 1], ['refinery', 7, 1], ['silo', 11, 1], ['outpost', 14, 1],
  ['barracks', 1, 5], ['wor', 4, 5], ['lightFactory', 7, 5], ['heavyFactory', 10, 5], ['turret', 14, 5], ['rocketTurret', 16, 5],
];

export async function start({ search }) {
  const params = readParams(search);
  const house = HOUSES[params.str('house', 'atreides')] ?? HOUSES.atreides;
  const map = new GameMap(19, 9);
  map.ground.fill(G.ROCK);
  map.concrete.fill(1);
  map.concreteRevision++;
  const r3d = new Renderer3D(document.getElementById('gl'), params.str('quality', 'high'));
  const hf = new Heightfield(map, { sub: 2, seed: 1 });
  const terrain = new TerrainView(map, hf);
  r3d.scene.add(terrain.group);
  const models = new Map();
  const handles = [];
  for (const [typeId, x, y] of LAYOUT) {
    const s = STRUCTURES[typeId];
    const id = STRUCTURE_MODEL[typeId];
    if (!models.has(id)) models.set(id, new InstancedModel(modelDef(id), r3d.scene));
    const h = models.get(id).add();
    h.matrix.makeTranslation(x + s.w / 2, 0, y + s.h / 2);
    h.color.set(house.color);
    h.params.turret = Math.PI / 2 - 0.6;
    handles.push(h);
  }
  const rig = new CameraRig(r3d.camera, map.w, map.h);
  rig.goalDistance = rig.distance = params.num('dist', 13);
  rig.goalPitch = rig.pitch = THREE.MathUtils.degToRad(params.num('pitch', 42));
  rig.lookAt(params.num('x', 9.5), params.num('z', 5), true);
  rig.update(1, (x, z) => hf.heightAt(x, z));
  r3d.follow(rig.target.x, rig.target.z, 16);
  const frame = (now) => {
    for (const h of handles) { h.params.fan = now * 0.004; h.params.dish = now * 0.0012; h.params.padLights = 1 + 0.25 * Math.sin(now * 0.006); h.params.flag = Math.sin(now * 0.002) * 0.3; h.params.crane = now * 0.00025; h.params.door = 0.2; }
    for (const m of models.values()) m.update();
    terrain.update(now);
    r3d.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame((now) => { frame(now); window.__dune = { ready: true, scene: 'structures' }; });
}
```

Modify `src/main.js` — add to `SCENES`: `  structures: () => import('./scenes/structures.js'),`

Modify `scripts/scenarios.mjs` — add:
```js
  'structures-atreides': { query: 'scene=structures&house=atreides' },
  'structures-harkonnen': { query: 'scene=structures&house=harkonnen' },
  'structures-closeup': { query: 'scene=structures&house=ordos&dist=6&x=6&z=3&pitch=35' },
```

Run: `npm run smoke structures-atreides structures-harkonnen structures-closeup`
Expected: three screenshots, no errors. Review them with the Read tool beside `docs/research/refs/pc-structure-*.{jpg,gif}`: the wind trap reads as two ribbed intake domes with dark mouths; the refinery shows domed tanks, a stack and a dark pad with house chevrons and lights; the silo is two tall tanks; the outpost is an olive bunker with a raised dish; the barracks is a walled compound with a flag; the WOR an adobe fort with towers and a dome; the light factory a curved hangar with a yellow gantry; the heavy factory a long hall with sawtooth roof, big door and stacks; turrets are round khaki bunkers with a gun or rocket pods. House colour visibly changes between the Atreides and Harkonnen shots. Adjust proportions or colours and re-run until they hold.

- [ ] **Step 7: Commit**

```bash
git add src/render/models src/scenes/structures.js src/main.js scripts/scenarios.mjs tests/models-catalog.test.mjs
git commit -m "feat(render): 3D models for the standard structures and a structure gallery scene

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Views — fog visibility, walls, animations, removal

**Files:**
- Modify: `src/render/views/structure-views.js`, `src/render/views/unit-views.js`, `src/input/controller.js` (`canSee`)
- Test: `tests/views.test.mjs` (additions), `tests/controller.test.mjs` (addition)

**Interfaces:**
- Consumes: `unitVisibleTo`, `structureVisibleTo` (Task 8); wall and structure models (Task 9).
- Produces: `new UnitViews(scene, hf, {viewer})` hides units the viewer cannot see; `new StructureViews(scene, hf, {viewer})` with `sync(world, nowMs)` (fog visibility, animated params, wall arms, 0.7 s sink-away on removal), `notify(event, nowMs)` (handles `unitBuilt` → opens the heavy factory door for 2 s), `views` (id → view). Structure turret heads face north at rest (`params.turret = π/2` when `s.turret` is undefined; otherwise `−s.turret`). Controller option `canSee(unit)` (default: always true) — hidden units are not pickable.

- [ ] **Step 1: Write the failing tests**

Append to `tests/views.test.mjs`:
```js
test('enemy units and structures stay hidden outside the viewer\'s sight', () => {
  const world = flatWorld(40, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const units = new UnitViews(new THREE.Scene(), hf, { viewer: 'atreides' });
  const structures = new StructureViews(new THREE.Scene(), hf, { viewer: 'atreides' });
  world.spawnUnit('combatTank', 'atreides', 3, 8);
  const enemy = world.spawnUnit('quad', 'harkonnen', 30, 8);
  const yard = world.spawnStructure('constructionYard', 'harkonnen', 32, 4);
  world.step();
  units.sync(world, 1, 0.016);
  structures.sync(world, 1000);
  assert.equal(units.views.get(enemy.id).handles[0].visible, false);
  assert.equal(structures.views.get(yard.id).handles[0].visible, false);
  world.spawnUnit('trike', 'atreides', 29, 6);
  for (let i = 0; i < 5; i++) world.step();   // fog refreshes every five ticks
  units.sync(world, 1, 0.016);
  structures.sync(world, 1100);
  assert.equal(units.views.get(enemy.id).handles[0].visible, true);
  assert.equal(structures.views.get(yard.id).handles[0].visible, true);
});

test('wall arms reach only towards walled neighbours', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new StructureViews(new THREE.Scene(), hf, { viewer: 'atreides' });
  const a = world.spawnStructure('wall', 'atreides', 5, 5);
  world.spawnStructure('wall', 'atreides', 6, 5);
  world.spawnStructure('wall', 'atreides', 5, 6);
  world.step();
  views.sync(world, 1000);
  const [, e, s, w, n] = views.views.get(a.id).handles;   // post, then arms E, S, W, N
  assert.deepEqual([e.visible, s.visible, w.visible, n.visible], [true, true, false, false]);
});

test('a sold structure sinks away over 0.7 s and is then removed', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new StructureViews(new THREE.Scene(), hf, { viewer: 'atreides' });
  const trap = world.spawnStructure('windtrap', 'atreides', 4, 4);
  views.sync(world, 0);
  views.sync(world, 2000);
  world.removeStructure(trap, 'sold');
  views.sync(world, 2300);   // the view notices the removal and starts sinking
  views.sync(world, 2650);
  const v = views.views.get(trap.id);
  assert.ok(v, 'still sinking');
  const sy = new THREE.Vector3().setFromMatrixScale(v.handles[0].matrix).y;
  assert.ok(sy < 0.6 && sy > 0.4, `scale ${sy}`);
  views.sync(world, 3100);
  assert.equal(views.views.has(trap.id), false);
});

test('the heavy factory door opens when a vehicle is built there, and turrets rest facing north', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new StructureViews(new THREE.Scene(), hf, { viewer: 'atreides' });
  const hf1 = world.spawnStructure('heavyFactory', 'atreides', 4, 4);
  const gun = world.spawnStructure('turret', 'atreides', 10, 10);
  views.sync(world, 5000);
  assert.equal(views.views.get(hf1.id).handles[0].params.door, 0);
  assert.ok(Math.abs(views.views.get(gun.id).handles[0].params.turret - Math.PI / 2) < 1e-9);
  views.notify({ type: 'unitBuilt', structureId: hf1.id }, 5000);
  views.sync(world, 5600);
  assert.ok(views.views.get(hf1.id).handles[0].params.door > 0.3);
  views.sync(world, 8000);
  assert.equal(views.views.get(hf1.id).handles[0].params.door, 0);
});
```

Append to `tests/controller.test.mjs`:
```js
test('units the player cannot see cannot be clicked', () => {
  const { enemy, tank, c, issued } = setup();
  c.canSee = (u) => u.id !== enemy.id;
  c.selection.set([tank.id]);
  c.onClick(px(12), px(5), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'move', ids: [tank.id], x: 12, y: 5 }, 'treated as ground');
  assert.equal(c.cursorFor(c.hitTest(px(12), px(5))), 'move');
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/views.test.mjs tests/controller.test.mjs`
Expected: FAIL — views ignore fog (`visible` stays true), walls have one handle, removal is instant, `notify` is not a function; the controller still picks the hidden enemy.

- [ ] **Step 3: Implement the structure views**

**File: `src/render/views/structure-views.js`** (replace the whole file)
```js
// One view per structure (spec §5.3): standing on its flattened footprint, rising out of the ground
// when placed, sinking away when sold or destroyed, hidden until the viewer has seen it, with its
// animated parts (turbines, radar dishes, pad lights, factory doors, flags, cranes, turret heads).
// Walls get a post plus an arm towards each walled neighbour.
import { HOUSES } from '../../data/houses.js';
import { structureVisibleTo } from '../../sim/fog.js';
import { InstancedModel } from '../models/instancer.js';
import { modelDef, structureModelId } from '../models/index.js';

const ARMS = [[1, 0, 0], [0, 1, -Math.PI / 2], [-1, 0, Math.PI], [0, -1, Math.PI / 2]];   // E, S, W, N and their yaw
const RISE_MS = 900, SINK_MS = 700, DOOR_MS = 2000;

export class StructureViews {
  constructor(scene, hf, { viewer = null } = {}) {
    this.scene = scene;
    this.hf = hf;
    this.viewer = viewer;
    this.models = new Map();
    this.views = new Map();
  }

  model(id) {
    let m = this.models.get(id);
    if (!m) { m = new InstancedModel(modelDef(id), this.scene); this.models.set(id, m); }
    return m;
  }

  notify(e, now) {
    if (e.type === 'unitBuilt') { const v = this.views.get(e.structureId); if (v) v.doorUntil = now + DOOR_MS; }
  }

  sync(world, now) {
    for (const s of world.structures.values()) if (!this.views.has(s.id)) this.create(s, now);
    for (const [id, v] of this.views) {
      if (world.structures.has(id)) continue;
      v.dying ??= now;
      if (now - v.dying >= SINK_MS) { for (const h of v.handles) v.model(h).remove(h); this.views.delete(id); }
    }
    for (const [id, v] of this.views) this.pose(world, world.structures.get(id) ?? v.last, v, now);
    for (const m of this.models.values()) m.update();
  }

  create(s, now) {
    const color = HOUSES[s.house]?.color ?? 0xffffff;
    const handles = [];
    const owners = new Map();
    const add = (modelId) => { const m = this.model(modelId); const h = m.add(); h.color.set(color); owners.set(h, m); handles.push(h); return h; };
    add(structureModelId(s.typeId, s.w, s.h));
    if (s.type.isWall) for (let k = 0; k < 4; k++) add('wallArm');
    let sum = 0, n = 0;
    for (let dy = 0; dy <= s.h; dy++) for (let dx = 0; dx <= s.w; dx++) { sum += this.hf.heightAt(s.x + dx, s.y + dy); n++; }
    this.views.set(s.id, { handles, model: (h) => owners.get(h), born: now, cx: s.x + s.w / 2, cz: s.y + s.h / 2, y: sum / n, house: s.house, doorUntil: 0, last: s });
  }

  pose(world, s, v, now) {
    v.last = s;
    const visible = !this.viewer || structureVisibleTo(world, this.viewer, s);
    let scale = 1 - Math.pow(1 - Math.min(1, (now - v.born) / RISE_MS), 3);
    if (v.dying !== undefined) scale = Math.max(0.02, 1 - (now - v.dying) / SINK_MS);
    if (v.house !== s.house) { v.house = s.house; for (const h of v.handles) h.color.set(HOUSES[s.house]?.color ?? 0xffffff); }
    const [main, ...arms] = v.handles;
    main.visible = visible;
    main.matrix.makeScale(1, Math.max(0.02, scale), 1).setPosition(v.cx, v.y, v.cz);
    const p = main.params;
    p.crane = now * 0.00025;
    p.fan = now * 0.004;
    p.dish = now * 0.0012;
    p.flag = Math.sin(now * 0.002) * 0.3;
    p.padLights = s.dockedBy ? 1 + 0.25 * Math.sin(now * 0.012) : 1;
    p.door = now < v.doorUntil ? 0.4 : 0;
    p.turret = s.turret === undefined ? Math.PI / 2 : -s.turret;
    if (!arms.length) return;
    const map = world.map;
    arms.forEach((h, k) => {
      const [dx, dy, yaw] = ARMS[k];
      const nx = s.x + dx, ny = s.y + dy;
      const other = map.inBounds(nx, ny) ? world.structures.get(map.structure[map.idx(nx, ny)]) : null;
      h.visible = visible && !!other?.type.isWall;
      h.matrix.makeRotationY(yaw).scale({ x: 1, y: Math.max(0.02, scale), z: 1 }).setPosition(v.cx, v.y, v.cz);
    });
  }
}
```

- [ ] **Step 4: Fog in unit views and the controller**

Modify `src/render/views/unit-views.js`:
- add `import { unitVisibleTo } from '../../sim/fog.js';` after the geometry import
- change the constructor signature and body start to:
```js
  constructor(scene, hf, { viewer = null } = {}) {
    this.scene = scene;
    this.hf = hf;
    this.viewer = viewer;
```
- change `sync(world, alpha, dt)` so that it passes the world to `pose`:
```js
    for (const u of world.units.values()) this.pose(u, this.views.get(u.id), alpha, dt, world);
```
- change the `pose` signature to `pose(u, v, alpha, dt, world = null) {` and, right after `v.z = z;`, add:
```js
    v.visible = !this.viewer || !world || unitVisibleTo(world, this.viewer, u);
```

Modify `src/input/controller.js`:
- in the constructor parameter list add `canSee = () => true` after `onDragBox = () => {}`, and add `canSee` to the `Object.assign` list
- in `candidates()`, change the first loop line to:
```js
    for (const u of this.world.units.values()) {
      if (!this.canSee(u)) continue;
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/views.test.mjs tests/controller.test.mjs && npm test`
Expected: PASS (5 new tests); suite green.

- [ ] **Step 6: Commit**

```bash
git add src/render/views src/input/controller.js tests/views.test.mjs tests/controller.test.mjs
git commit -m "feat(render): fog-aware views, joined walls, animated structure parts, sink-away removal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 11: Model icons for the sidebar

**Files:**
- Create: `src/render/icons.js`, `src/scenes/icons.js`
- Modify: `src/main.js`, `scripts/scenarios.mjs`
- Test: `tests/icons.test.mjs`

**Interfaces:**
- Consumes: `modelDef`, `UNIT_MODEL`, `STRUCTURE_MODEL`, `unitModelId`, `structureModelId` (models/index.js); `getMaterial`, `HOUSE_TINTED` (models/materials.js); `Renderer3D` (its `renderer` and `scene.environment`).
- Produces: `ICON_W = 128`, `ICON_H = 96`, `UNIT_ICON_YAW = -1.9`; `modelBounds(def, matrix?)` → `THREE.Box3`; `iconFraming(box, {fov, aspect, fill})` → `{target, position, distance, radius}`; `flipRows(pixels, w, h)` → `Uint8ClampedArray`; `class IconFactory(renderer, {environment})` with `get(modelId, colorHex, yaw = 0)` → PNG data URL (cached) and `forItem(typeId, houseId)` → data URL for a unit or structure type in a house's colour. Icons are opaque (dark panel background), 128 × 96, seen from the front-left and above.

- [ ] **Step 1: Write the failing tests**

**File: `tests/icons.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { modelBounds, iconFraming, flipRows, ICON_W, ICON_H, UNIT_ICON_YAW } from '../src/render/icons.js';
import { modelDef } from '../src/render/models/index.js';

const corners = (b) => {
  const out = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new THREE.Vector3(x, y, z));
  return out;
};

test('model bounds enclose every part, also when the model is turned', () => {
  const def = modelDef('windtrap');
  const box = modelBounds(def);
  for (const p of def.parts) { p.geometry.computeBoundingBox(); assert.ok(box.containsBox(p.geometry.boundingBox)); }
  assert.ok(box.max.y > 0.4 && box.min.y < 0.01);
  const turned = modelBounds(modelDef('combatTank'), new THREE.Matrix4().makeRotationY(UNIT_ICON_YAW));
  assert.ok(turned.max.z - turned.min.z > 0.3);
});

test('icon framing fills the view without cutting the model off', () => {
  for (const id of ['heavyFactory', 'soldier', 'mcv', 'turret']) {
    const box = modelBounds(modelDef(id));
    const f = iconFraming(box);
    const cam = new THREE.PerspectiveCamera(30, ICON_W / ICON_H, 0.01, 100);
    cam.position.copy(f.position);
    cam.lookAt(f.target);
    cam.updateMatrixWorld();
    let extent = 0;
    for (const c of corners(box)) {
      const v = c.project(cam);
      assert.ok(Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1, `${id} corner outside the view`);
      extent = Math.max(extent, Math.abs(v.x), Math.abs(v.y));
    }
    assert.ok(extent > 0.8, `${id} fills the icon (${extent.toFixed(2)})`);
    assert.ok(f.position.y > f.target.y && f.position.z > f.target.z, 'seen from above and the south');
  }
});

test('flipRows turns WebGL bottom-up rows top-down', () => {
  const src = new Uint8Array([1, 1, 1, 1, 2, 2, 2, 2]);
  assert.deepEqual([...flipRows(src, 1, 2)], [2, 2, 2, 2, 1, 1, 1, 1]);
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `node --test tests/icons.test.mjs`
Expected: FAIL — cannot find `../src/render/icons.js`.

- [ ] **Step 3: Implement the icon factory**

**File: `src/render/icons.js`**
```js
// Sidebar and selection-panel icons rendered from the real 3D models (spec §5.6). Each model is
// framed from the front-left and above in its house colour on a dark panel background, rendered once
// into an HDR target, tone-mapped by an OutputPass exactly like the battlefield, read back and kept
// as a PNG data URL. Plain one-instance meshes are used so shared geometry attributes stay untouched.
import * as THREE from 'three';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { modelDef, unitModelId, structureModelId } from './models/index.js';
import { getMaterial, HOUSE_TINTED } from './models/materials.js';
import { STRUCTURES } from '../data/structures.js';
import { HOUSES } from '../data/houses.js';

export const ICON_W = 128, ICON_H = 96;
export const UNIT_ICON_YAW = -1.9;   // units rest facing east; this turns them towards the viewer's left
const FOV = 30;
const ELEVATION = THREE.MathUtils.degToRad(34), AZIMUTH = THREE.MathUtils.degToRad(32);

/** Union of the part bounding boxes (nodes at rest), optionally transformed. */
export function modelBounds(def, matrix = null) {
  const box = new THREE.Box3();
  for (const p of def.parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox); }
  return matrix ? box.applyMatrix4(matrix) : box;
}

/** Camera placement that fills about `fill` of the view with the box's projection. */
export function iconFraming(box, { fov = FOV, aspect = ICON_W / ICON_H, fill = 0.88 } = {}) {
  const target = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  const dir = new THREE.Vector3(Math.sin(AZIMUTH) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(AZIMUTH) * Math.cos(ELEVATION));
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.01, 1000);
  const pts = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, y, z));
  const v = new THREE.Vector3();
  let distance = Math.max(0.1, radius / Math.sin(THREE.MathUtils.degToRad(fov) / 2));
  for (let k = 0; k < 6; k++) {
    cam.position.copy(target).addScaledVector(dir, distance);
    cam.lookAt(target);
    cam.updateMatrixWorld();
    let extent = 0;
    for (const p of pts) { v.copy(p).project(cam); extent = Math.max(extent, Math.abs(v.x), Math.abs(v.y)); }
    distance = Math.max(radius * 1.05, distance * (extent / fill));
  }
  return { target, radius, distance, position: target.clone().addScaledVector(dir, distance) };
}

/** WebGL rows run bottom-up; ImageData rows run top-down. */
export function flipRows(src, w, h) {
  const out = new Uint8ClampedArray(src.length), row = w * 4;
  for (let y = 0; y < h; y++) out.set(src.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  return out;
}

export class IconFactory {
  constructor(renderer, { environment = null } = {}) {
    this.renderer = renderer;
    this.cache = new Map();
    this.scene = new THREE.Scene();
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.6;
    const key = new THREE.DirectionalLight(0xfff0d6, 2.9);
    key.position.set(-3, 6, 4);
    const rim = new THREE.DirectionalLight(0xbfd4ff, 1.2);
    rim.position.set(4, 3, -5);
    this.scene.add(key, rim, new THREE.HemisphereLight(0xcfe0ff, 0x8a6a44, 0.9));
    this.camera = new THREE.PerspectiveCamera(FOV, ICON_W / ICON_H, 0.01, 100);
    this.hdr = new THREE.WebGLRenderTarget(ICON_W, ICON_H, { type: THREE.HalfFloatType, samples: 4 });
    this.ldr = new THREE.WebGLRenderTarget(ICON_W, ICON_H);
    this.output = new OutputPass();
    this.pixels = new Uint8Array(ICON_W * ICON_H * 4);
    this.canvas = document.createElement('canvas');
    this.canvas.width = ICON_W;
    this.canvas.height = ICON_H;
    this.ctx = this.canvas.getContext('2d');
  }

  forItem(typeId, houseId) {
    const color = HOUSES[houseId]?.color ?? 0xffffff;
    const s = STRUCTURES[typeId];
    return s ? this.get(structureModelId(typeId, s.w, s.h), color) : this.get(unitModelId(typeId), color, UNIT_ICON_YAW);
  }

  get(modelId, color, yaw = 0) {
    const key = `${modelId}|${color}|${yaw}`;
    let url = this.cache.get(key);
    if (!url) { url = this.render(modelId, color, yaw); this.cache.set(key, url); }
    return url;
  }

  render(modelId, color, yaw) {
    const def = modelDef(modelId);
    const matrix = new THREE.Matrix4().makeRotationY(yaw);
    const tint = new THREE.Color(color);
    const meshes = def.parts.map((part) => {
      const mesh = new THREE.InstancedMesh(part.geometry, getMaterial(part.material), 1);
      mesh.setMatrixAt(0, matrix);
      if (HOUSE_TINTED.has(part.material)) mesh.setColorAt(0, tint);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      return mesh;
    });
    const f = iconFraming(modelBounds(def, matrix));
    this.camera.position.copy(f.position);
    this.camera.lookAt(f.target);
    this.camera.near = Math.max(0.01, f.distance - f.radius * 2);
    this.camera.far = f.distance + f.radius * 2;
    this.camera.updateProjectionMatrix();
    const r = this.renderer;
    const prevTarget = r.getRenderTarget(), prevColor = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    r.setRenderTarget(this.hdr);
    r.setClearColor(0x2b2117, 1);
    r.clear();
    r.render(this.scene, this.camera);
    this.output.render(r, this.ldr, this.hdr);
    r.readRenderTargetPixels(this.ldr, 0, 0, ICON_W, ICON_H, this.pixels);
    r.setRenderTarget(prevTarget);
    r.setClearColor(prevColor, prevAlpha);
    for (const mesh of meshes) { this.scene.remove(mesh); mesh.dispose(); }
    this.ctx.putImageData(new ImageData(flipRows(this.pixels, ICON_W, ICON_H), ICON_W, ICON_H), 0, 0);
    return this.canvas.toDataURL();
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/icons.test.mjs && npm test`
Expected: PASS (3 new tests); suite green.

- [ ] **Step 5: Icon sheet scene and visual review**

**File: `src/scenes/icons.js`**
```js
// Icon sheet: every unit and structure icon of one house, as the sidebar will show them.
import { Renderer3D } from '../render/renderer.js';
import { IconFactory } from '../render/icons.js';
import { UNIT_MODEL, STRUCTURE_MODEL } from '../render/models/index.js';
import { readParams } from '../core/params.js';

export async function start({ search }) {
  const params = readParams(search);
  const house = params.str('house', 'atreides');
  const canvas = document.getElementById('gl');
  const r3d = new Renderer3D(canvas, 'low');
  canvas.style.display = 'none';
  const icons = new IconFactory(r3d.renderer, { environment: r3d.scene.environment });
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:absolute;inset:0;padding:16px;display:flex;flex-wrap:wrap;gap:10px;align-content:flex-start;overflow:auto;background:#140e08;pointer-events:auto';
  for (const typeId of [...Object.keys(STRUCTURE_MODEL), ...Object.keys(UNIT_MODEL)]) {
    const fig = document.createElement('figure');
    fig.style.cssText = 'margin:0;text-align:center;font:11px sans-serif;color:#f2d7a0';
    const img = new Image();
    img.src = icons.forItem(typeId, house);
    img.style.cssText = 'display:block;width:128px;height:96px;border:2px solid #b8893a';
    fig.append(img, typeId);
    sheet.appendChild(fig);
  }
  document.getElementById('ui').appendChild(sheet);
  window.__dune = { ready: true, scene: 'icons' };
}
```

Modify `src/main.js` — add to `SCENES`: `  icons: () => import('./scenes/icons.js'),`

Modify `scripts/scenarios.mjs` — add:
```js
  'icons-atreides': { query: 'scene=icons&house=atreides' },
  'icons-harkonnen': { query: 'scene=icons&house=harkonnen' },
```

Run: `npm run smoke icons-atreides icons-harkonnen`
Expected: two screenshots, no console errors. Read them: every icon shows its whole model filling most of the tile, lit from the front-left, in house colour on a dark brown background; units face the viewer's left; no icon is black, blank or cut off. Tune `ELEVATION`, `AZIMUTH`, `fill` or the lights if icons read poorly, then re-run.

- [ ] **Step 6: Commit**

```bash
git add src/render/icons.js src/scenes/icons.js src/main.js scripts/scenarios.mjs tests/icons.test.mjs
git commit -m "feat(render): sidebar icons rendered from the 3D models, with an icon sheet scene

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 12: Placement, sell and repair modes

**Files:**
- Create: `src/render/placement-ghost.js`
- Modify: `src/input/controller.js`, `src/ui/cursors.js`, `src/game/game-view.js`
- Test: `tests/controller.test.mjs` (additions), `tests/placement-ghost.test.mjs`

**Interfaces:**
- Consumes: `checkPlacement` (Task 3); commands `place` (Task 5), `sell` and `repair` (Task 6); `House.lines.structure` (Task 5); `Controller` as changed by Tasks 1, 7 and 10.
- Produces: `placementOrigin(g, size)` = `Math.round(g − size / 2)` (the footprint is centred on the cursor); `Controller` gains `mode` (`null | {kind:'place', typeId} | {kind:'sell'} | {kind:'repair'}`), `setMode(mode)`, `startPlacement(typeId)`, `placementAt(sx, sy)` → `{typeId, x, y, check} | null`, and options `onMode(mode)`, `onGhost(placement | null)`, `onNotice(text)`. In a mode, left clicks act on the mode (placement stays on after a refused spot, sell and repair stay on until cancelled), right click or Escape leaves it. Placement mode ends by itself when the structure is no longer ready. `PlacementGhost(scene, hf)` with `show(placement | null)`, fields `group`, `cells`, `cellMaterials {concrete, bare, blocked}`. Cursors `sell`, `noSell`, `repair`, `noRepair`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/controller.test.mjs`:
```js
test('placement mode places the ready structure centred on the cursor and refuses bad spots', () => {
  const { world, c, issued } = setup();
  const notices = [];
  c.onNotice = (t) => notices.push(t);
  world.spawnStructure('constructionYard', 'atreides', 2, 12);
  world.houses.get('atreides').lines.structure.current = { typeId: 'windtrap', cost: 300, total: 21.6, progress: 1, paid: 300, state: 'ready', starved: false };
  c.startPlacement('windtrap');
  c.onClick(18 * 40, 3 * 40, 0, NONE, false);
  assert.equal(issued.length, 0);
  assert.equal(notices.length, 1);
  assert.equal(c.mode.kind, 'place', 'still placing after a refused spot');
  assert.deepEqual(c.placementAt(200, 520).check.ok, true);
  c.onClick(200, 520, 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'place', typeId: 'windtrap', x: 4, y: 12 });
  assert.equal(c.mode, null);
});

test('placement mode ends when the structure is no longer ready', () => {
  const { world, c } = setup();
  const line = world.houses.get('atreides').lines.structure;
  line.current = { typeId: 'windtrap', cost: 300, total: 21.6, progress: 1, paid: 300, state: 'ready', starved: false };
  c.startPlacement('windtrap');
  c.frame();
  assert.equal(c.mode.kind, 'place');
  line.current = null;
  c.frame();
  assert.equal(c.mode, null);
});

test('right click or Escape leaves a mode without ordering anything', () => {
  const { c, issued } = setup();
  c.setMode({ kind: 'sell' });
  c.onClick(px(5), px(5), 2, NONE, false);
  assert.equal(c.mode, null);
  c.setMode({ kind: 'repair' });
  c.onKey('Escape', 'Escape', NONE);
  assert.equal(c.mode, null);
  assert.equal(issued.length, 0);
});

test('sell mode sells own structures only; repair mode repairs damaged own structures', () => {
  const { world, c, issued } = setup();
  const own = world.spawnStructure('windtrap', 'atreides', 2, 12);
  world.spawnStructure('windtrap', 'harkonnen', 10, 12);
  c.setMode({ kind: 'sell' });
  assert.equal(c.cursorFor(c.hitTest(px(10), px(12))), 'noSell');
  c.onClick(px(10), px(12), 0, NONE, false);
  assert.equal(issued.length, 0);
  assert.equal(c.cursorFor(c.hitTest(px(2), px(12))), 'sell');
  c.onClick(px(2), px(12), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'sell', structureId: own.id });
  assert.equal(c.mode.kind, 'sell', 'sell mode stays on until cancelled');
  c.setMode({ kind: 'repair' });
  assert.equal(c.cursorFor(c.hitTest(px(3), px(13))), 'noRepair');
  c.onClick(px(3), px(13), 0, NONE, false);
  assert.equal(issued.length, 1, 'undamaged: nothing to repair');
  own.hp = own.maxHp / 2;
  assert.equal(c.cursorFor(c.hitTest(px(3), px(13))), 'repair');
  c.onClick(px(3), px(13), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'repair', structureId: own.id });
});
```

**File: `tests/placement-ghost.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { G } from '../src/data/terrain.js';
import { Heightfield } from '../src/render/heightfield.js';
import { PlacementGhost } from '../src/render/placement-ghost.js';
import { checkPlacement } from '../src/sim/placement.js';
import { flatWorld } from './helpers.mjs';

const colours = (ghost) => ghost.cells.map((c) => (c.material === ghost.cellMaterials.concrete ? 'g' : c.material === ghost.cellMaterials.bare ? 'y' : 'r')).join('');

test('the ghost shows green on own concrete, yellow on bare rock and red when it cannot go', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const ghost = new PlacementGhost(new THREE.Scene(), hf);
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  world.map.concrete[world.map.idx(6, 4)] = world.houses.get('atreides').slot + 1;
  ghost.show({ typeId: 'windtrap', x: 6, y: 4, check: checkPlacement(world, 'atreides', 'windtrap', 6, 4) });
  assert.equal(ghost.group.visible, true);
  assert.equal(colours(ghost), 'gyyy');
  assert.ok(ghost.body.children.length > 0, 'a translucent model');
  ghost.show({ typeId: 'windtrap', x: 12, y: 12, check: checkPlacement(world, 'atreides', 'windtrap', 12, 12) });
  assert.equal(colours(ghost), 'rrrr', 'away from the base');
  ghost.show({ typeId: 'concrete', x: 6, y: 5, check: checkPlacement(world, 'atreides', 'concrete', 6, 5) });
  assert.equal(colours(ghost), 'g', 'a slab that fits is green');
  assert.equal(ghost.body.children.length, 0, 'slabs have no model');
  ghost.show(null);
  assert.equal(ghost.group.visible, false);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/controller.test.mjs tests/placement-ghost.test.mjs`
Expected: FAIL — `c.startPlacement is not a function`, `c.setMode is not a function`; cannot find `placement-ghost.js`.

- [ ] **Step 3: Implement the modes**

Modify `src/input/controller.js`:
- add imports after the `deploySpot` import:
```js
import { STRUCTURES } from '../data/structures.js';
import { checkPlacement } from '../sim/placement.js';

/** Footprint origin that centres a structure of `size` tiles on ground coordinate `g`. */
export const placementOrigin = (g, size) => Math.round(g - size / 2);
```
- in the constructor parameter list add `onMode = () => {}, onGhost = () => {}, onNotice = () => {}` after `canSee = () => true`, add `onMode, onGhost, onNotice` to the `Object.assign` list, and after `this.hoverId = null;` add `    this.mode = null;`
- add these methods after `issue(cmd) { … }`:
```js
  setMode(mode) {
    this.mode = mode;
    if (mode?.kind !== 'place') this.onGhost(null);
    this.onMode(mode);
  }

  startPlacement(typeId) { this.setMode({ kind: 'place', typeId }); }

  placementAt(x, y) {
    if (this.mode?.kind !== 'place') return null;
    const g = this.ground(x, y);
    if (!g) return null;
    const t = STRUCTURES[this.mode.typeId];
    const px = placementOrigin(g.x, t.w), py = placementOrigin(g.z, t.h);
    return { typeId: this.mode.typeId, x: px, y: py, check: checkPlacement(this.world, this.house, this.mode.typeId, px, py) };
  }

  modeClick(x, y, button) {
    if (button === 2) { this.setMode(null); return; }
    const m = this.mode;
    if (m.kind === 'place') {
      const p = this.placementAt(x, y);
      if (!p) return;
      if (!p.check.ok) { this.onNotice(p.check.reason === 'notAdjacent' ? 'Structures must be placed next to your base.' : 'Cannot build there.'); return; }
      this.issue({ type: 'place', typeId: m.typeId, x: p.x, y: p.y });
      this.setMode(null);
      return;
    }
    const s = this.ownStructureAt(x, y);
    if (!s) return;
    if (m.kind === 'sell') this.issue({ type: 'sell', structureId: s.id });
    else if (m.kind === 'repair' && s.hp < s.maxHp) this.issue({ type: 'repair', structureId: s.id });
  }

  ownStructureAt(x, y) {
    const hit = this.hitTest(x, y);
    return hit?.kind === 'structure' && hit.structure?.house === this.house ? hit.structure : null;
  }
```
- in `onClick`, directly after `if (!this.inViewport(x, y)) return;` add:
```js
    if (this.mode) { this.modeClick(x, y, button); return; }
```
- in `onKey`, replace `    if (key === 'Escape') { this.selection.clear(); return true; }` with:
```js
    if (key === 'Escape') { if (this.mode) this.setMode(null); else this.selection.clear(); return true; }
```
- replace `frame()` with:
```js
  frame() {
    const { x, y } = this.mouse;
    const inside = x >= 0 && this.inViewport(x, y);
    if (this.mode?.kind === 'place') {
      const item = this.world.houses.get(this.house)?.lines?.structure.current;
      if (item?.typeId !== this.mode.typeId || item.state !== 'ready') this.setMode(null);
    }
    const hit = inside ? this.hitTest(x, y) : null;
    this.hoverId = hit?.kind === 'unit' ? hit.unit.id : null;
    if (this.mode?.kind === 'place') this.onGhost(inside ? this.placementAt(x, y) : null);
    this.onCursor(this.cursorFor(hit));
  }
```
- at the top of `cursorFor(hit)` add:
```js
    if (this.mode) {
      if (this.mode.kind === 'place') return 'default';
      const s = hit?.kind === 'structure' && hit.structure?.house === this.house ? hit.structure : null;
      if (this.mode.kind === 'sell') return s ? 'sell' : 'noSell';
      return s && s.hp < s.maxHp ? 'repair' : 'noRepair';
    }
```

Modify `src/ui/cursors.js` — add to `CURSORS` after `noDeploy`:
```js
  sell: svg(`<circle cx='16' cy='16' r='12' fill='#1d1408' stroke='#ffd24a' stroke-width='2.5'/><path d='M20 11.5c-.9-1.4-2.5-2-4.2-2-2.3 0-4 1.2-4 3 0 4.4 8.6 2.3 8.6 6.8 0 2-1.8 3.3-4.5 3.3-2 0-3.8-.8-4.7-2.2M16 7v18' fill='none' stroke='#ffd24a' stroke-width='2.2' stroke-linecap='round'/>`, 16, 16),
  noSell: svg(`<circle cx='16' cy='16' r='12' fill='#1d1408' stroke='#8a8a8a' stroke-width='2.5'/><path d='M20 11.5c-.9-1.4-2.5-2-4.2-2-2.3 0-4 1.2-4 3 0 4.4 8.6 2.3 8.6 6.8 0 2-1.8 3.3-4.5 3.3-2 0-3.8-.8-4.7-2.2M16 7v18' fill='none' stroke='#8a8a8a' stroke-width='2.2' stroke-linecap='round'/><path d='M7 25L25 7' stroke='#ff4a3a' stroke-width='3'/>`, 16, 16),
  repair: svg(`<path d='M21 4a6 6 0 0 0-5.6 8.1L5 22.5 9.5 27l10.4-10.4A6 6 0 0 0 28 11l-3.6 3.6-3.4-.6-.6-3.4L24 7a6 6 0 0 0-3-3z' fill='#7dff7a' stroke='#000' stroke-width='1.2'/>`, 8, 24),
  noRepair: svg(`<path d='M21 4a6 6 0 0 0-5.6 8.1L5 22.5 9.5 27l10.4-10.4A6 6 0 0 0 28 11l-3.6 3.6-3.4-.6-.6-3.4L24 7a6 6 0 0 0-3-3z' fill='#8a8a8a' stroke='#000' stroke-width='1.2'/><path d='M6 6L26 26' stroke='#ff4a3a' stroke-width='3'/>`, 8, 24),
```

- [ ] **Step 4: Implement the ghost**

**File: `src/render/placement-ghost.js`**
```js
// Placement preview (spec §4.5, §5.6): a translucent copy of the structure over a tile grid — green on
// the house's own concrete, yellow on bare rock (the structure starts damaged), red where it cannot
// go (every cell turns red when the footprint does not touch the base). Slabs show only their cells.
import * as THREE from 'three';
import { STRUCTURES } from '../data/structures.js';
import { modelDef, structureModelId } from './models/index.js';

const COLORS = { concrete: 0x46e05a, bare: 0xf2c53d, blocked: 0xff3b30 };

export class PlacementGhost {
  constructor(scene, hf) {
    this.hf = hf;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.6, metalness: 0.1 });
    this.cellMaterials = Object.fromEntries(Object.entries(COLORS).map(([k, c]) => [k, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.42, depthWrite: false })]));
    this.cellGeometry = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
    this.cells = [];
    this.typeId = null;
  }

  setType(typeId) {
    if (typeId === this.typeId) return;
    this.typeId = typeId;
    this.body.clear();
    for (const c of this.cells) this.group.remove(c);
    this.cells = [];
    const t = STRUCTURES[typeId];
    if (!t.isConcrete) for (const part of modelDef(structureModelId(typeId, t.w, t.h)).parts) this.body.add(new THREE.Mesh(part.geometry, this.bodyMaterial));
    for (let k = 0; k < t.w * t.h; k++) {
      const cell = new THREE.Mesh(this.cellGeometry, this.cellMaterials.bare);
      cell.renderOrder = 5;
      this.group.add(cell);
      this.cells.push(cell);
    }
  }

  /** placement: {typeId, x, y, check} from Controller.placementAt, or null to hide. */
  show(placement) {
    if (!placement) { this.group.visible = false; return; }
    const { typeId, x, y, check } = placement;
    this.setType(typeId);
    const t = STRUCTURES[typeId];
    let sum = 0;
    check.tiles.forEach((tile, k) => {
      const cell = this.cells[k];
      const h = this.hf.heightAt(tile.x + 0.5, tile.y + 0.5);
      sum += h;
      cell.position.set(tile.x + 0.5, h + 0.04, tile.y + 0.5);
      const state = t.isConcrete && tile.state === 'bare' ? 'concrete' : tile.state;
      cell.material = this.cellMaterials[check.ok ? state : 'blocked'];
    });
    this.body.position.set(x + t.w / 2, sum / check.tiles.length + 0.02, y + t.h / 2);
    this.group.visible = true;
  }
}
```

- [ ] **Step 5: Wire the ghost and notices into GameView**

Modify `src/game/game-view.js`:
- add `import { PlacementGhost } from '../render/placement-ghost.js';` after the StructureViews import
- after `this.structureViews = new StructureViews(r3d.scene, hf);` add `    this.ghost = new PlacementGhost(r3d.scene, hf);`
- in the `new Controller({ … })` options, after `onDragBox: (box) => this.overlay.setDragBox(box),` add:
```js
      onGhost: (p) => this.ghost.show(p),
      onNotice: (text) => this.hud.message(text),
```

- [ ] **Step 6: Run the tests**

Run: `node --test tests/controller.test.mjs tests/placement-ghost.test.mjs && npm test`
Expected: PASS (5 new tests); suite green.

- [ ] **Step 7: Commit**

```bash
git add src/input/controller.js src/ui/cursors.js src/render/placement-ghost.js src/game/game-view.js tests/controller.test.mjs tests/placement-ghost.test.mjs
git commit -m "feat(input): placement, sell and repair modes with a translucent placement ghost

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13: The sidebar

**Files:**
- Create: `src/ui/sidebar-model.js`, `src/ui/sidebar.js`
- Modify: `src/ui/styles.css`, `src/input/camera-control.js`, `src/game/game-view.js`, `src/scenes/skirmish.js`, `scripts/scenarios.mjs`
- Test: `tests/sidebar-model.test.mjs`, `tests/camera-control.test.mjs`

**Interfaces:**
- Consumes: `buildOptions` (Task 4); `computePower`, `builtStorage`, `radarOnline` (Task 2); `House.lines` (Task 5); `IconFactory.forItem` (Task 11); `Controller.startPlacement`, `setMode`, `mode`, option `onMode` (Task 12).
- Produces: `sidebarModel(world, houseId)` → `{credits, storage, power:{produced, used, ratio, level}, radar, structures:[item], units:[item]}` with `item = {typeId, line, name, cost, seconds, state:'idle'|'building'|'hold'|'ready'|'queued'|'locked', progress, count, starved}` (pure — never mutates the house); `powerLevel({produced, used})` → `'ok'|'low'|'critical'`; `rollCredits(shown, target, dt)`; `class Sidebar(root, {iconFor, onCommand, onPlace, onTool})` with `update(model, dt)`, `setTool(kind|null)`, fields `el`, `radarEl` (Task 14 mounts the radar there), `strips.{structures,units}.buttons` (typeId → button). `edgeScroll(x, y, w, h, margin = 6)` → `[right, forward]`; `CameraControl(rig, element, settings, {win = window})` tracks the pointer over the whole window. `#app.has-sidebar` narrows the canvas and overlay by `--sidebar-w` (272 px). Skirmish query `deploy=1` deploys the player's MCV at start.

- [ ] **Step 1: Write the failing tests**

**File: `tests/sidebar-model.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { sidebarModel, powerLevel, rollCredits } from '../src/ui/sidebar-model.js';
import { flatWorld, run } from './helpers.mjs';

function base() {
  const world = flatWorld(32, 32, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 1000;
  h.startBuffer = 100000;
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  return { world, h };
}

function factories(world) {
  world.spawnStructure('windtrap', 'atreides', 8, 4);
  world.spawnStructure('refinery', 'atreides', 4, 8);
  world.spawnStructure('lightFactory', 'atreides', 10, 8);
}

test('the strips list what the house can build, in display order', () => {
  const { world } = base();
  let m = sidebarModel(world, 'atreides');
  assert.deepEqual(m.structures.map((i) => i.typeId), ['concrete', 'windtrap', 'concrete4']);
  assert.deepEqual(m.units, []);
  factories(world);
  m = sidebarModel(world, 'atreides');
  assert.deepEqual(m.units.map((i) => i.typeId), ['trike', 'quad']);
  const wt = m.structures.find((i) => i.typeId === 'windtrap');
  assert.deepEqual([wt.name, wt.cost, wt.seconds, wt.line, wt.state], ['Wind Trap', 300, 22, 'structure', 'idle']);
});

test('icons carry production state, progress and queue counts', () => {
  const { world } = base();
  factories(world);
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  world.issue('atreides', { type: 'build', typeId: 'trike', count: 3 });
  run(world, 5);
  const m = sidebarModel(world, 'atreides');
  const wt = m.structures.find((i) => i.typeId === 'windtrap');
  assert.equal(wt.state, 'building');
  assert.ok(wt.progress > 0.2 && wt.progress < 0.25, `progress ${wt.progress}`);
  assert.equal(m.structures.find((i) => i.typeId === 'concrete').state, 'locked', 'the yard is busy');
  const trike = m.units.find((i) => i.typeId === 'trike');
  assert.deepEqual([trike.state, trike.count], ['building', 3]);
  assert.equal(m.units.find((i) => i.typeId === 'quad').state, 'idle');
  world.issue('atreides', { type: 'hold', typeId: 'windtrap' });
  world.step();
  assert.equal(sidebarModel(world, 'atreides').structures.find((i) => i.typeId === 'windtrap').state, 'hold');
});

test('the sidebar reads storage, power and radar without touching the house', () => {
  const { world, h } = base();
  h.startBuffer = 500;
  factories(world);
  const m = sidebarModel(world, 'atreides');
  assert.equal(m.storage, 1005);
  assert.equal(h.startBuffer, 500, 'revoking the start buffer is the simulation\'s business');
  assert.deepEqual([m.power.produced, m.power.used, m.power.level], [100, 50, 'ok']);
  assert.equal(m.radar, false, 'no outpost');
  assert.equal(m.credits, 1000);
});

test('power level: green when production covers use, amber when short, red below half', () => {
  assert.equal(powerLevel({ produced: 100, used: 100 }), 'ok');
  assert.equal(powerLevel({ produced: 100, used: 150 }), 'low');
  assert.equal(powerLevel({ produced: 100, used: 201 }), 'critical');
  assert.equal(powerLevel({ produced: 0, used: 0 }), 'ok');
});

test('credits roll towards the target and settle within about a second', () => {
  let shown = 0;
  for (let k = 0; k < 90; k++) shown = rollCredits(shown, 2000, 0.016);
  assert.equal(shown, 2000);
  shown = rollCredits(2000, 1990, 0.016);
  assert.ok(shown < 2000 && shown >= 1990);
});
```

**File: `tests/camera-control.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CameraControl, edgeScroll } from '../src/input/camera-control.js';

test('edge scrolling works at every window edge', () => {
  assert.deepEqual(edgeScroll(3, 300, 1400, 800), [-1, 0]);
  assert.deepEqual(edgeScroll(1398, 300, 1400, 800), [1, 0]);
  assert.deepEqual(edgeScroll(700, 2, 1400, 800), [0, 1]);
  assert.deepEqual(edgeScroll(700, 797, 1400, 800), [0, -1]);
  assert.deepEqual(edgeScroll(700, 400, 1400, 800), [0, 0]);
});

test('the camera pans while the pointer rests on the right window edge, over the sidebar', () => {
  const listeners = {};
  const target = () => ({ addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); }, setPointerCapture() {}, clientWidth: 1128, clientHeight: 800 });
  const win = { ...target(), innerWidth: 1400, innerHeight: 800, document: target() };
  const pans = [];
  const rig = { distance: 20, pan: (r, f) => pans.push([Math.sign(r), Math.sign(f)]), zoom() {}, rotate() {} };
  const cc = new CameraControl(rig, target(), { edgeScroll: true }, { win });
  for (const fn of listeners.pointermove) fn({ clientX: 1399, clientY: 400 });
  cc.update(0.016);
  assert.deepEqual(pans, [[1, 0]]);
  for (const fn of listeners.mouseout) fn({ relatedTarget: null });
  cc.update(0.016);
  assert.equal(pans.length, 1, 'no scrolling once the pointer left the window');
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/sidebar-model.test.mjs tests/camera-control.test.mjs`
Expected: FAIL — cannot find `sidebar-model.js`; `edgeScroll` is not exported.

- [ ] **Step 3: Implement the view-model and window edge scrolling**

**File: `src/ui/sidebar-model.js`**
```js
// Pure view-model of the C&C sidebar (spec §4.4, §5.6): credits and storage, the power bar's level,
// radar availability and the two build strips — structures, then the units of every line — with each
// icon's state, progress and queue count. It reads the world and never changes it.
import { STRUCTURES } from '../data/structures.js';
import { UNITS } from '../data/units.js';
import { buildSeconds } from '../data/tuning.js';
import { buildOptions } from '../sim/tech.js';
import { computePower, builtStorage, radarOnline } from '../sim/economy.js';

const UNIT_LINES = ['infantry', 'light', 'heavy', 'air'];

export function powerLevel({ produced, used }) {
  if (used <= produced) return 'ok';
  return used > 2 * produced ? 'critical' : 'low';
}

function itemState(l, typeId, line) {
  const cur = l.current;
  const queued = l.queue.reduce((n, t) => n + (t === typeId ? 1 : 0), 0);
  if (cur?.typeId === typeId) return { state: cur.state, progress: cur.progress, count: queued + 1, starved: cur.starved };
  if (queued) return { state: 'queued', progress: 0, count: queued, starved: false };
  return { state: line === 'structure' && cur ? 'locked' : 'idle', progress: 0, count: 0, starved: false };
}

export function sidebarModel(world, houseId) {
  const house = world.houses.get(houseId);
  const options = buildOptions(world, houseId);
  const entry = (line) => (typeId) => {
    const t = STRUCTURES[typeId] ?? UNITS[typeId];
    return { typeId, line, name: t.name, cost: t.cost, seconds: Math.round(buildSeconds(t.buildTime)), ...itemState(house.lines[line], typeId, line) };
  };
  const power = computePower(world, houseId);
  return {
    credits: Math.floor(house.credits),
    storage: Math.max(builtStorage(world, houseId), house.startBuffer ?? 0),
    power: { ...power, level: powerLevel(power) },
    radar: radarOnline(world, houseId),
    structures: options.structure.map(entry('structure')),
    units: UNIT_LINES.flatMap((line) => options[line].map(entry(line))),
  };
}

/** Rolling credits counter (C&C): moves towards the target and settles in about a second. */
export function rollCredits(shown, target, dt) {
  const diff = target - shown;
  const step = Math.max(300, Math.abs(diff) * 4) * dt;
  return Math.abs(diff) <= step ? target : shown + Math.sign(diff) * step;
}
```

Replace `src/input/camera-control.js` with:
```js
// Camera input (spec §5.5): screen-edge scrolling over the whole window (the sidebar included),
// arrow keys, wheel zoom, middle-drag pan and Alt + middle-drag rotate/tilt. Edge scrolling stops
// when the pointer leaves the window or the window loses focus.
export function edgeScroll(x, y, w, h, margin = 6) {
  const right = x <= margin ? -1 : x >= w - 1 - margin ? 1 : 0;
  const forward = y <= margin ? 1 : y >= h - 1 - margin ? -1 : 0;
  return [right, forward];
}

export class CameraControl {
  constructor(rig, element, settings, { win = window } = {}) {
    this.rig = rig;
    this.el = element;
    this.settings = settings;
    this.win = win;
    this.mouse = { x: -1, y: -1, inside: false };
    this.keys = new Set();
    this.drag = null;
    win.addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
      if (this.drag) this.onDrag(e);
    });
    win.document?.addEventListener('mouseout', (e) => { if (!e.relatedTarget) this.mouse.inside = false; });
    win.addEventListener('blur', () => { this.mouse.inside = false; this.keys.clear(); this.drag = null; });
    element.addEventListener('wheel', (e) => { e.preventDefault(); this.rig.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    element.addEventListener('pointerdown', (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      this.drag = { x: e.clientX, y: e.clientY, rotate: e.altKey };
      element.setPointerCapture?.(e.pointerId);
    });
    element.addEventListener('pointerup', (e) => { if (e.button === 1) this.drag = null; });
    win.addEventListener('keydown', (e) => { if (e.key.startsWith('Arrow')) { this.keys.add(e.key); e.preventDefault(); } });
    win.addEventListener('keyup', (e) => this.keys.delete(e.key));
  }

  onDrag(e) {
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX; this.drag.y = e.clientY;
    if (this.drag.rotate) { this.rig.rotate(-dx * 0.006, dy * 0.004); return; }
    const scale = this.rig.distance * 0.0019;
    this.rig.pan(-dx * scale, dy * scale);
  }

  update(dt) {
    const speed = this.rig.distance * 0.95 * (this.settings.scrollSpeed ?? 1) * dt;
    let dr = 0, df = 0;
    if (this.keys.has('ArrowLeft')) dr -= 1;
    if (this.keys.has('ArrowRight')) dr += 1;
    if (this.keys.has('ArrowUp')) df += 1;
    if (this.keys.has('ArrowDown')) df -= 1;
    if (this.settings.edgeScroll && this.mouse.inside && !this.drag) {
      const [er, ef] = edgeScroll(this.mouse.x, this.mouse.y, this.win.innerWidth, this.win.innerHeight);
      dr += er;
      df += ef;
    }
    if (dr || df) this.rig.pan(Math.sign(dr) * speed, Math.sign(df) * speed);
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/sidebar-model.test.mjs tests/camera-control.test.mjs && npm test`
Expected: PASS (7 new tests); suite green.

- [ ] **Step 5: Sidebar DOM and styles**

**File: `src/ui/sidebar.js`**
```js
// C&C sidebar (spec §5.6, §5.7): rolling credits with a storage gauge, the radar slot, a vertical
// power bar, Repair and Sell toggles and two build strips (structures | units) with model icons,
// clock-wipe progress, READY / ON HOLD and queue badges, scroll arrows and a tooltip. Left click
// builds, resumes or (when READY) starts placement; right click holds, then cancels with a refund;
// Shift + left click queues five.
import { rollCredits } from './sidebar-model.js';

const SLOT = 92;   // icon height plus gap (px)

export class Sidebar {
  constructor(root, { iconFor, onCommand, onPlace, onTool }) {
    Object.assign(this, { iconFor, onCommand, onPlace, onTool });
    const el = (this.el = document.createElement('div'));
    el.className = 'sidebar';
    el.innerHTML = `
      <div class="sb-credits"><span class="sb-label">Credits</span><span class="sb-digits">0</span><div class="sb-storage"><i></i></div></div>
      <div class="sb-radar"></div>
      <div class="sb-tools"><button class="sb-tool" data-tool="repair">Repair</button><button class="sb-tool" data-tool="sell">Sell</button></div>
      <div class="sb-body">
        <div class="sb-power"><div class="sb-power-fill"></div><div class="sb-power-use"></div></div>
        <div class="sb-strip" data-strip="structures"><button class="sb-arrow" data-dir="-1">&#9650;</button><div class="sb-slots"><div class="sb-list"></div></div><button class="sb-arrow" data-dir="1">&#9660;</button></div>
        <div class="sb-strip" data-strip="units"><button class="sb-arrow" data-dir="-1">&#9650;</button><div class="sb-slots"><div class="sb-list"></div></div><button class="sb-arrow" data-dir="1">&#9660;</button></div>
      </div>
      <div class="sb-tip"><b></b><span></span></div>`;
    root.appendChild(el);
    this.digits = el.querySelector('.sb-digits');
    this.storageBar = el.querySelector('.sb-storage i');
    this.radarEl = el.querySelector('.sb-radar');
    this.power = el.querySelector('.sb-power');
    this.powerFill = el.querySelector('.sb-power-fill');
    this.powerUse = el.querySelector('.sb-power-use');
    this.tip = el.querySelector('.sb-tip');
    this.strips = {};
    for (const node of el.querySelectorAll('.sb-strip')) {
      const strip = { el: node, list: node.querySelector('.sb-list'), slots: node.querySelector('.sb-slots'), offset: 0, key: null, buttons: new Map() };
      this.strips[node.dataset.strip] = strip;
      for (const a of node.querySelectorAll('.sb-arrow')) a.addEventListener('click', () => this.scroll(strip, Number(a.dataset.dir)));
      node.addEventListener('wheel', (e) => { e.preventDefault(); this.scroll(strip, Math.sign(e.deltaY)); }, { passive: false });
    }
    for (const b of el.querySelectorAll('.sb-tool')) b.addEventListener('click', () => this.onTool(b.dataset.tool));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.shown = null;
  }

  setTool(kind) {
    for (const b of this.el.querySelectorAll('.sb-tool')) b.classList.toggle('active', b.dataset.tool === kind);
  }

  update(model, dt) {
    this.shown = this.shown === null ? model.credits : rollCredits(this.shown, model.credits, dt);
    const text = String(Math.floor(this.shown));
    if (this.digits.textContent !== text) this.digits.textContent = text;
    this.storageBar.style.width = `${Math.min(100, (model.credits / Math.max(1, model.storage)) * 100).toFixed(1)}%`;
    const { produced, used, level } = model.power;
    const scale = Math.max(produced, used, 100) * 1.25;
    this.powerFill.style.height = `${((produced / scale) * 100).toFixed(1)}%`;
    this.powerUse.style.bottom = `${((used / scale) * 100).toFixed(1)}%`;
    if (this.powerFill.dataset.level !== level) this.powerFill.dataset.level = level;
    this.power.title = `Power ${produced} / ${used}`;
    this.fill(this.strips.structures, model.structures);
    this.fill(this.strips.units, model.units);
  }

  fill(strip, items) {
    const key = items.map((i) => i.typeId).join(',');
    if (key !== strip.key) {   // rebuild only when the set of buildable items changes
      strip.key = key;
      strip.list.textContent = '';
      strip.buttons.clear();
      for (const item of items) strip.list.appendChild(this.makeButton(strip, item));
      this.scroll(strip, 0);
    }
    for (const item of items) {
      const b = strip.buttons.get(item.typeId);
      b.item = item;
      const cls = `sb-item state-${item.state}${item.starved ? ' starved' : ''}`;
      if (b.className !== cls) b.className = cls;
      const p = item.state === 'building' || item.state === 'hold' ? item.progress.toFixed(3) : '1';
      if (b.style.getPropertyValue('--p') !== p) b.style.setProperty('--p', p);
      const label = item.state === 'ready' ? 'READY' : item.state === 'hold' ? 'ON HOLD' : '';
      if (b.stateEl.textContent !== label) b.stateEl.textContent = label;
      const count = item.count > 1 ? String(item.count) : '';
      if (b.countEl.textContent !== count) b.countEl.textContent = count;
    }
  }

  makeButton(strip, item) {
    const b = document.createElement('button');
    b.dataset.type = item.typeId;
    b.item = item;
    const img = new Image();
    img.src = this.iconFor(item.typeId);
    img.alt = item.name;
    img.draggable = false;
    b.stateEl = document.createElement('span');
    b.stateEl.className = 'sb-state';
    b.countEl = document.createElement('span');
    b.countEl.className = 'sb-count';
    b.append(img, b.stateEl, b.countEl);
    b.addEventListener('click', (e) => this.leftClick(b.item, e.shiftKey));
    b.addEventListener('contextmenu', (e) => { e.preventDefault(); this.onCommand({ type: 'hold', typeId: b.item.typeId }); });
    b.addEventListener('pointerenter', () => this.showTip(b));
    b.addEventListener('pointerleave', () => this.tip.classList.remove('show'));
    strip.buttons.set(item.typeId, b);
    return b;
  }

  leftClick(item, shift) {
    if (item.line === 'structure' && item.state === 'ready') { this.onPlace(item.typeId); return; }
    this.onCommand({ type: 'build', typeId: item.typeId, count: shift ? 5 : 1 });
  }

  showTip(b) {
    const i = b.item;
    this.tip.querySelector('b').textContent = i.name;
    this.tip.querySelector('span').textContent = i.state === 'ready' ? 'Ready — click to place' : `Cost ${i.cost} · ${i.seconds} s`;
    this.tip.style.top = `${b.getBoundingClientRect().top - this.el.getBoundingClientRect().top}px`;
    this.tip.classList.add('show');
  }

  scroll(strip, dir) {
    const visible = Math.max(1, Math.floor((strip.slots.clientHeight + 4) / SLOT));
    const max = Math.max(0, strip.buttons.size - visible);
    strip.offset = Math.max(0, Math.min(max, strip.offset + dir));
    strip.list.style.transform = `translateY(${-strip.offset * SLOT}px)`;
  }
}
```

Modify `src/ui/styles.css` — append:
```css
:root { --sidebar-w: 272px; }
#app.has-sidebar #gl, #app.has-sidebar #overlay { width: calc(100% - var(--sidebar-w)); }
#app.has-sidebar .message-bar { left: calc((100% - var(--sidebar-w)) / 2); }
.sidebar { position: absolute; top: 0; right: 0; bottom: 0; width: var(--sidebar-w); box-sizing: border-box; display: flex; flex-direction: column; gap: 6px;
  padding: 8px 8px 10px 13px; background: linear-gradient(90deg, #24190d, #3a2917 35%, #2c1f11); border-left: 2px solid #b8893a;
  box-shadow: -4px 0 14px rgba(0,0,0,.55); pointer-events: auto; color: #f2d7a0; }
.sidebar::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: repeating-linear-gradient(135deg, #d9a52e 0 6px, #1d1408 6px 12px); opacity: .85; }
.sidebar button { font-family: inherit; }
.sb-credits { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; padding: 5px 10px 6px; background: #120c06; border: 2px solid #b8893a; border-radius: 3px; }
.sb-label { font: bold 12px "Trebuchet MS", sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #c9a063; }
.sb-digits { font: bold 22px Consolas, "Courier New", monospace; color: #ffb52e; text-shadow: 0 0 6px rgba(255,160,40,.65); letter-spacing: .08em; }
.sb-storage { flex-basis: 100%; height: 3px; margin-top: 3px; background: #3a2a18; }
.sb-storage i { display: block; height: 100%; width: 0; background: var(--house, #d9a52e); transition: width .3s; }
.sb-radar { position: relative; width: 220px; height: 220px; align-self: center; background: #000; border: 2px solid #b8893a; border-radius: 3px; overflow: hidden; }
.sb-tools { display: flex; gap: 6px; }
.sb-tool { flex: 1; padding: 5px 0; font: bold 13px "Trebuchet MS", sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #f5d48a;
  background: linear-gradient(#4a3520, #2a1d10); border: 2px solid #8e6843; border-radius: 3px; cursor: pointer; }
.sb-tool:hover { border-color: #d9a52e; }
.sb-tool.active { border-color: #ffd24a; background: linear-gradient(#6a4a22, #3a2710); box-shadow: inset 0 0 8px rgba(255,210,74,.5); }
.sb-body { flex: 1; min-height: 0; display: flex; gap: 5px; }
.sb-power { position: relative; width: 12px; background: #120c06; border: 2px solid #8e6843; border-radius: 2px; }
.sb-power-fill { position: absolute; left: 0; right: 0; bottom: 0; height: 0; background: #35d04a; transition: height .3s; }
.sb-power-fill[data-level="low"] { background: #e3c237; }
.sb-power-fill[data-level="critical"] { background: #e0412f; }
.sb-power-use { position: absolute; left: -4px; right: -4px; height: 2px; background: #fff; box-shadow: 0 0 3px #000; }
.sb-strip { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.sb-arrow { height: 20px; padding: 0; font-size: 10px; color: #f5d48a; background: linear-gradient(#4a3520, #2a1d10); border: 1px solid #8e6843; border-radius: 2px; cursor: pointer; }
.sb-slots { flex: 1; min-height: 0; overflow: hidden; }
.sb-list { display: flex; flex-direction: column; gap: 4px; transition: transform .15s; }
.sb-item { position: relative; flex: none; height: 88px; padding: 0; border: 2px solid #8e6843; border-radius: 2px; background: #2b2117; cursor: pointer; overflow: hidden; }
.sb-item img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.sb-item::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: conic-gradient(transparent calc(var(--p, 1) * 360deg), rgba(0,0,0,.62) 0); }
.sb-item.starved::after { background: conic-gradient(transparent calc(var(--p, 1) * 360deg), rgba(110,10,0,.62) 0); }
.sb-item.state-locked { filter: grayscale(.6) brightness(.6); }
.sb-item:hover { border-color: #ffd24a; }
.sb-state { position: absolute; left: 0; right: 0; bottom: 4px; z-index: 1; text-align: center; font: bold 12px "Trebuchet MS", sans-serif; letter-spacing: .1em; color: #fff; text-shadow: 0 1px 2px #000, 0 0 4px #000; }
.sb-item.state-ready .sb-state { color: #7dff7a; animation: sb-blink 1s steps(2) infinite; }
.sb-count { position: absolute; top: 3px; right: 5px; z-index: 1; font: bold 14px Consolas, monospace; color: #ffd24a; text-shadow: 0 1px 2px #000; }
@keyframes sb-blink { 50% { opacity: .35; } }
.sb-tip { position: absolute; right: calc(100% + 6px); display: none; min-width: 150px; padding: 6px 10px; background: rgba(18,12,6,.94); border: 1px solid #b8893a; border-radius: 3px; pointer-events: none; }
.sb-tip.show { display: block; }
.sb-tip b { display: block; font-size: 13px; color: #f5d48a; }
.sb-tip span { font-size: 12px; color: #d8c29a; }
```

- [ ] **Step 6: Wire the sidebar into GameView; deploy on request in skirmish**

Modify `src/game/game-view.js`:
- add imports after the Hud import:
```js
import { Sidebar } from '../ui/sidebar.js';
import { sidebarModel } from '../ui/sidebar-model.js';
import { IconFactory } from '../render/icons.js';
import { HOUSES } from '../data/houses.js';
```
- at the start of the constructor body, before `const canvas = …`, add:
```js
    document.getElementById('app').classList.add('has-sidebar');   // before the renderer measures the canvas
```
- after `this.hud = new Hud(document.getElementById('ui'));` add:
```js
    this.icons = new IconFactory(r3d.renderer, { environment: r3d.scene.environment });
    this.sidebar = new Sidebar(document.getElementById('ui'), {
      iconFor: (typeId) => this.icons.forItem(typeId, house),
      onCommand: (cmd) => world.issue(house, cmd),
      onPlace: (typeId) => this.controller.startPlacement(typeId),
      onTool: (tool) => this.controller.setMode(this.controller.mode?.kind === tool ? null : { kind: tool }),
    });
    this.sidebar.el.style.setProperty('--house', `#${(HOUSES[house]?.color ?? 0xd9a52e).toString(16).padStart(6, '0')}`);
```
- in the `new Controller({ … })` options, after `onNotice: …,` add:
```js
      onMode: (mode) => this.sidebar.setTool(mode?.kind ?? null),
```
- in `frame(now)`, after `this.hud.update(dt);` add:
```js
    this.sidebar.update(sidebarModel(world, this.house), dt);
```

Modify `src/scenes/skirmish.js` — after the `for (let i = 0, n = params.num('ticks', 0); …)` line add:
```js
  if (params.bool('deploy')) {
    const mcv = [...world.units.values()].find((u) => u.house === house && u.typeId === 'mcv');
    if (mcv) { world.issue(house, { type: 'deploy', ids: [mcv.id] }); world.step(); }
  }
```

Modify `scripts/scenarios.mjs` — add:
```js
  'skirmish-sidebar': { query: 'scene=skirmish&seed=11&house=atreides&deploy=1' },
  'skirmish-sidebar-ordos': { query: 'scene=skirmish&seed=5&house=ordos&deploy=1&dist=14' },
```

- [ ] **Step 7: Visual check**

Run: `npm run smoke skirmish-sidebar skirmish-sidebar-ordos skirmish-atreides`
Expected: three screenshots, no console errors. Read them: the battlefield ends at the sidebar's hazard-striped left edge; the sidebar shows amber credits with a house-colour storage gauge, a black radar square, Repair and Sell buttons, the power bar, and in the deployed scenes the structure strip shows Concrete Slab, Wind Trap and Large Concrete Slab icons (unit strip empty); the message bar is centred over the battlefield. Fix layout or styling problems and re-run.

- [ ] **Step 8: Commit**

```bash
git add src/ui src/input/camera-control.js src/game/game-view.js src/scenes/skirmish.js scripts/scenarios.mjs tests/sidebar-model.test.mjs tests/camera-control.test.mjs
git commit -m "feat(ui): C&C sidebar with model icons, clock-wipe production, power bar and window edge scrolling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 14: Radar

**Files:**
- Create: `src/ui/radar-model.js`, `src/ui/radar.js`
- Modify: `src/render/picking.js`, `src/input/controller.js`, `src/game/game-view.js`, `src/ui/styles.css`
- Test: `tests/radar-model.test.mjs`, `tests/picking.test.mjs` (addition), `tests/controller.test.mjs` (addition)

**Interfaces:**
- Consumes: `unitVisibleTo`, `structureVisibleTo`, `World.fogOfWar`, `house.fog.explored` (Task 8); `sidebarModel(…).radar` (Task 13); `Sidebar.radarEl` (Task 13).
- Produces: `RADAR_GROUND` (per `G`), `RADAR_SPICE`, `RADAR_THICK_SPICE`, `RADAR_CONCRETE`; `radarImage(world, houseId, out?)` → `Uint8ClampedArray` (RGBA, one pixel per tile); `screenToPlane(camera, ndcX, ndcY, h = 0)` → `{x, z} | null`; `Controller.orderTile(tx, ty)`; `class Radar(el, {world, house, onJump(x, z), onOrder(tx, ty), ordersOnLeft(), ordersOnRight()})` with `update(dt, {online, view})` where `view` is the camera's ground quad (4 `{x, z}`) or `null`; `GameView.viewQuad()`.

- [ ] **Step 1: Write the failing tests**

**File: `tests/radar-model.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { radarImage, RADAR_GROUND, RADAR_SPICE, RADAR_THICK_SPICE } from '../src/ui/radar-model.js';
import { flatWorld, run } from './helpers.mjs';

const pixel = (img, w, x, y) => [...img.slice((y * w + x) * 4, (y * w + x) * 4 + 3)];

test('the radar shows explored terrain and own forces, and black where unexplored', () => {
  const world = flatWorld(20, 10, G.SAND);
  world.map.ground[world.map.idx(3, 3)] = G.ROCK;
  world.map.spice[world.map.idx(4, 3)] = 250;
  world.map.spice[world.map.idx(5, 3)] = 700;
  world.spawnUnit('combatTank', 'atreides', 4, 4);
  world.spawnStructure('constructionYard', 'atreides', 1, 1);
  world.spawnUnit('quad', 'harkonnen', 17, 5);
  world.step();
  const img = radarImage(world, 'atreides');
  assert.equal(img.length, 20 * 10 * 4);
  assert.deepEqual(pixel(img, 20, 3, 3), RADAR_GROUND[G.ROCK]);
  assert.deepEqual(pixel(img, 20, 4, 3), RADAR_SPICE);
  assert.deepEqual(pixel(img, 20, 5, 3), RADAR_THICK_SPICE);
  assert.deepEqual(pixel(img, 20, 1, 1), [0x2f, 0x6f, 0xe0], 'own structure in house colour');
  assert.notDeepEqual(pixel(img, 20, 4, 4), RADAR_GROUND[G.SAND], 'own unit shows');
  assert.deepEqual(pixel(img, 20, 17, 5), [0, 0, 0], 'unexplored stays black; the enemy is hidden');
});

test('enemy structures stay on the radar once seen; fog off shows everything', () => {
  const world = flatWorld(30, 10, G.ROCK);
  const scout = world.spawnUnit('trike', 'atreides', 20, 5);
  world.spawnStructure('constructionYard', 'harkonnen', 22, 4);
  const quad = world.spawnUnit('quad', 'harkonnen', 27, 8);
  world.step();
  world.issue('atreides', { type: 'move', ids: [scout.id], x: 2, y: 5 });
  run(world, 15);
  let img = radarImage(world, 'atreides');
  assert.deepEqual(pixel(img, 30, 22, 4), [0xc8, 0x26, 0x1e]);
  world.fogOfWar = false;
  img = radarImage(world, 'atreides');
  assert.notDeepEqual(pixel(img, 30, quad.tx, quad.ty), RADAR_GROUND[G.ROCK], 'no fog: the quad shows');
});
```

Append to `tests/picking.test.mjs`:
```js
import { screenToPlane } from '../src/render/picking.js';

test('screenToPlane meets a flat plane; the top of the view lies farther north', () => {
  const cam = camera();
  const c = screenToPlane(cam, 0, 0, 0);
  assert.ok(Math.abs(c.x - 10) < 1e-6 && Math.abs(c.z - 10) < 1e-6);
  assert.ok(screenToPlane(cam, 0, 1, 0).z < screenToPlane(cam, 0, -1, 0).z);
});
```

Append to `tests/controller.test.mjs`:
```js
test('orderTile orders the selection to a map tile (the radar uses it)', () => {
  const { tank, c, issued } = setup();
  c.selection.set([tank.id]);
  c.orderTile(12, 7);
  assert.deepEqual(issued.at(-1), { type: 'move', ids: [tank.id], x: 12, y: 7 });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/radar-model.test.mjs tests/picking.test.mjs tests/controller.test.mjs`
Expected: FAIL — cannot find `radar-model.js`; `screenToPlane` is not exported; `c.orderTile is not a function`.

- [ ] **Step 3: Implement**

**File: `src/ui/radar-model.js`**
```js
// Pure radar picture (spec §4.9, §5.6): one RGBA pixel per tile — black where unexplored, terrain
// colours where explored, house colours for own units and structures, enemy units in current sight
// and enemy structures once seen. Units are drawn lighter than structures.
import { HOUSES } from '../data/houses.js';
import { SPICE_PER_TILE } from '../data/tuning.js';
import { unitVisibleTo, structureVisibleTo } from '../sim/fog.js';

export const RADAR_GROUND = [[196, 154, 96], [214, 172, 112], [124, 106, 88], [78, 66, 56]];   // sand, dune, rock, mountain
export const RADAR_SPICE = [214, 110, 52];
export const RADAR_THICK_SPICE = [170, 66, 34];
export const RADAR_CONCRETE = [158, 154, 144];

const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const STRUCTURE_RGB = Object.fromEntries(Object.entries(HOUSES).map(([id, h]) => [id, rgb(h.color)]));
const UNIT_RGB = Object.fromEntries(Object.entries(STRUCTURE_RGB).map(([id, c]) => [id, c.map((v) => Math.round(v + (255 - v) * 0.4))]));

export function radarImage(world, houseId, out = new Uint8ClampedArray(world.map.w * world.map.h * 4)) {
  const map = world.map, n = map.w * map.h;
  const fog = world.fogOfWar ? world.houses.get(houseId)?.fog : null;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    out[o + 3] = 255;
    if (fog && !fog.explored[i]) { out[o] = out[o + 1] = out[o + 2] = 0; continue; }
    const c = map.concrete[i] ? RADAR_CONCRETE : map.spice[i] > SPICE_PER_TILE ? RADAR_THICK_SPICE : map.spice[i] > 0 ? RADAR_SPICE : RADAR_GROUND[map.ground[i]];
    out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2];
  }
  const put = (x, y, c) => { const o = (y * map.w + x) * 4; out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; };
  for (const s of world.structures.values()) {
    if (!structureVisibleTo(world, houseId, s)) continue;
    const c = STRUCTURE_RGB[s.house] ?? [255, 255, 255];
    for (let dy = 0; dy < s.h; dy++) for (let dx = 0; dx < s.w; dx++) put(s.x + dx, s.y + dy, c);
  }
  for (const u of world.units.values()) {
    if (!map.inBounds(u.tx, u.ty) || !unitVisibleTo(world, houseId, u)) continue;
    put(u.tx, u.ty, UNIT_RGB[u.house] ?? [255, 255, 255]);
  }
  return out;
}
```

Modify `src/render/picking.js` — add after `screenToGround`:
```js
/** Where the ray through an NDC point meets the plane y = h, or null at or above the horizon. */
export function screenToPlane(camera, ndcX, ndcY, h = 0) {
  ndc.set(ndcX, ndcY);
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  if (d.y > -1e-4) return null;
  const t = (o.y - h) / -d.y;
  return { x: o.x + d.x * t, z: o.z + d.z * t };
}
```

Modify `src/input/controller.js` — add after `issue(cmd) { … }`:
```js
  orderTile(tx, ty) { this.order({ kind: 'ground', tx, ty }); }
```

**File: `src/ui/radar.js`**
```js
// Radar (spec §4.9, §5.6, §5.7): the minimap in the sidebar, the map as the player knows it with the
// camera's view outlined in white. Left click or drag jumps the camera; in the Classic scheme a left
// click with own units selected orders them there, in Modern a right click does. Without a powered
// Outpost it shows static and "RADAR OFFLINE"; coming online it opens from the centre.
import { radarImage } from './radar-model.js';

const NOISE = 48, REFRESH = 0.25, OPEN = 0.8;

export class Radar {
  constructor(el, { world, house, onJump, onOrder, ordersOnLeft = () => false, ordersOnRight = () => false }) {
    Object.assign(this, { world, house, onJump, onOrder, ordersOnLeft, ordersOnRight });
    const map = world.map;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'radar-canvas';
    this.label = document.createElement('div');
    this.label.className = 'radar-offline';
    this.label.textContent = 'RADAR OFFLINE';
    el.append(this.canvas, this.label);
    this.ctx = this.canvas.getContext('2d');
    this.tiles = document.createElement('canvas');
    this.tiles.width = map.w;
    this.tiles.height = map.h;
    this.tctx = this.tiles.getContext('2d');
    this.image = this.tctx.createImageData(map.w, map.h);
    this.noise = document.createElement('canvas');
    this.noise.width = this.noise.height = NOISE;
    this.nctx = this.noise.getContext('2d');
    this.noiseImage = this.nctx.createImageData(NOISE, NOISE);
    this.online = null;
    this.age = 0;
    this.timer = 0;
    this.size = 0;
    this.dragging = false;
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('pointerdown', (e) => this.pointer(e, true));
    this.canvas.addEventListener('pointermove', (e) => { if (this.dragging) this.pointer(e, false); });
    const stop = () => { this.dragging = false; };
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointercancel', stop);
  }

  layout() {
    const map = this.world.map, scale = this.size / Math.max(map.w, map.h);
    return { scale, ox: (this.size - map.w * scale) / 2, oy: (this.size - map.h * scale) / 2 };
  }

  pointer(e, down) {
    if (!this.online) return;
    const r = this.canvas.getBoundingClientRect(), { scale, ox, oy } = this.layout();
    const x = (e.clientX - r.left - ox) / scale, y = (e.clientY - r.top - oy) / scale;
    const map = this.world.map;
    if (x < 0 || y < 0 || x >= map.w || y >= map.h) return;
    if (down && e.button === 2) { if (this.ordersOnRight()) this.onOrder(Math.floor(x), Math.floor(y)); return; }
    if (down && e.button !== 0) return;
    if (down && this.ordersOnLeft()) { this.onOrder(Math.floor(x), Math.floor(y)); return; }
    if (down) { this.dragging = true; this.canvas.setPointerCapture?.(e.pointerId); }
    this.onJump(x, y);
  }

  resize() {
    const size = this.canvas.clientWidth || 220;
    if (size === this.size) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.size = size;
    this.canvas.width = this.canvas.height = Math.round(size * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  update(dt, { online, view }) {
    this.resize();
    if (online !== this.online) {
      this.online = online;
      this.age = 0;
      this.timer = 0;
      this.label.classList.toggle('show', !online);
    }
    this.age += dt;
    const c = this.ctx, size = this.size;
    if (!online) { this.drawStatic(); return; }
    if ((this.timer -= dt) <= 0) {
      this.timer = REFRESH;
      radarImage(this.world, this.house, this.image.data);
      this.tctx.putImageData(this.image, 0, 0);
    }
    const { scale, ox, oy } = this.layout(), map = this.world.map;
    c.save();
    c.fillStyle = '#000';
    c.fillRect(0, 0, size, size);
    if (this.age < OPEN) { c.beginPath(); c.arc(size / 2, size / 2, (this.age / OPEN) * size * 0.72, 0, Math.PI * 2); c.clip(); }
    c.imageSmoothingEnabled = false;
    c.drawImage(this.tiles, ox, oy, map.w * scale, map.h * scale);
    if (view) {
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 1;
      c.beginPath();
      view.forEach((p, k) => { const x = ox + p.x * scale, y = oy + p.z * scale; if (k) c.lineTo(x, y); else c.moveTo(x, y); });
      c.closePath();
      c.stroke();
    }
    c.restore();
  }

  drawStatic() {
    const d = this.noiseImage.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 110; d[i] = v; d[i + 1] = v * 0.9; d[i + 2] = v * 0.7; d[i + 3] = 255; }
    this.nctx.putImageData(this.noiseImage, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.noise, 0, 0, this.size, this.size);
  }
}
```

Modify `src/ui/styles.css` — append:
```css
.radar-canvas { display: block; width: 100%; height: 100%; cursor: crosshair; }
.radar-offline { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); display: none; text-align: center; pointer-events: none;
  font: bold 14px Consolas, monospace; letter-spacing: .2em; color: #ffb52e; text-shadow: 0 0 6px #000, 0 0 2px #000; }
.radar-offline.show { display: block; }
```

- [ ] **Step 4: Wire the radar into GameView**

Modify `src/game/game-view.js`:
- change the picking import to `import { screenToGround, screenToPlane, worldToScreen, pixelsPerUnit } from '../render/picking.js';`
- add `import { Radar } from '../ui/radar.js';` after the Sidebar import
- after the `this.sidebar.el.style.setProperty('--house', …);` line, add:
```js
    this.radar = new Radar(this.sidebar.radarEl, {
      world, house,
      onJump: (x, z) => this.rig.lookAt(x, z, true),
      onOrder: (tx, ty) => this.controller.orderTile(tx, ty),
      ordersOnLeft: () => settings.scheme !== 'modern' && this.controller.ownSelected().length > 0,
      ordersOnRight: () => settings.scheme === 'modern',
    });
```
- in `frame(now)`, replace `    this.sidebar.update(sidebarModel(world, this.house), dt);` with:
```js
    const sidebar = sidebarModel(world, this.house);
    this.sidebar.update(sidebar, dt);
    this.radar.update(dt, { online: sidebar.radar, view: this.viewQuad() });
```
- add this method after `onEvent(e) { … }`:
```js
  /** The camera's view on the ground (tile coordinates), for the radar outline. */
  viewQuad() {
    const out = [];
    for (const [x, y] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
      const p = screenToPlane(this.r3d.camera, x, y, 0.2);
      if (!p) return null;
      out.push(p);
    }
    return out;
  }
```

- [ ] **Step 5: Run the tests and look at the radar**

Run: `node --test tests/radar-model.test.mjs tests/picking.test.mjs tests/controller.test.mjs && npm test`
Expected: PASS (4 new tests); suite green.

Modify `scripts/scenarios.mjs` — add:
```js
  'radar-online': { query: 'scene=skirmish&seed=11&house=atreides&deploy=1&radar=1' },
```
Modify `src/scenes/skirmish.js` — after the `deploy` block add (a showcase switch, like `deploy`, not a cheat reachable in play):
```js
  if (params.bool('radar')) {
    const yard = [...world.structures.values()].find((s) => s.house === house && s.typeId === 'constructionYard');
    for (const typeId of ['windtrap', 'outpost']) {
      const spot = yard && findPlacement(world, house, typeId, yard.x, yard.y);
      if (spot) placeStructure(world, house, typeId, spot.x, spot.y);
    }
    for (let i = 0; i < 20; i++) world.step();
  }
```
and add `import { placeStructure, findPlacement } from '../sim/placement.js';` to its imports.

Run: `npm run smoke radar-online skirmish-sidebar`
Expected: two screenshots, no console errors. Read them: `radar-online` shows the explored area around the base in terrain colours, own structures and units in house colour, black elsewhere and a white view outline; `skirmish-sidebar` (no outpost) shows grey static with "RADAR OFFLINE". Adjust colours and re-run if the radar is hard to read.

- [ ] **Step 6: Commit**

```bash
git add src/ui src/render/picking.js src/input/controller.js src/game/game-view.js src/scenes/skirmish.js scripts/scenarios.mjs tests/radar-model.test.mjs tests/picking.test.mjs tests/controller.test.mjs
git commit -m "feat(ui): radar with fog-aware minimap, view outline, click to jump or order, offline static

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 15: Structure selection, rally points and the selection panel

**Files:**
- Create: `src/ui/selection-panel.js`
- Modify: `src/input/selection.js`, `src/input/controller.js`, `src/render/overlay.js`, `src/game/game-view.js`, `src/ui/styles.css`
- Test: `tests/selection.test.mjs` (addition), `tests/controller.test.mjs` (additions), `tests/selection-panel.test.mjs`

**Interfaces:**
- Consumes: commands `setRally`, `setPrimary` (Task 5), `sell`, `repair` (Task 6), `returnToBase` and `HARVEST_CAPACITY` (Task 7); structure fields `rally`, `primary`, `repairing`, `repairStalled`, `dockedBy`; `LINE_FACTORIES` (Task 4); `unitVisibleTo` (Task 8); `IconFactory.forItem` (Task 11); the controller as changed by Tasks 1, 7, 10, 12 and 14.
- Produces: `Selection.structureId` (0 = none) and `setStructure(id)`; `set`, `add`, `toggle` and `clear` drop the structure; `prune(unitAlive, structureAlive = () => true)`. `Controller.clickStructure(s, classic, double)`, `rallyTarget()`, `rally(hit)` → boolean, `hoverStructureId`. Classic: click a structure to select it (own harvesters clicked onto an own refinery return instead; with own units selected an enemy structure click does nothing until plan 1c adds attacks); a ground click with an own unit factory selected sets its rally point; a double click makes it primary. Modern: the same with right click for rally. `selectionPanelModel(world, selection, houseId)` → `null | {kind:'unit'|'group'|'structure', typeId, house, own, name, hp, maxHp, count, details:string[], buttons:[{id, label, key?, active?, disabled?}]}`; `class SelectionPanel(root, {iconFor(typeId, houseId), onButton(id)})` with `update(model)`. `Overlay.draw` takes `hoverStructureId` and `canSee(unit)` and draws structure brackets, structure health bars, rally lines and a PRIMARY tag.

- [ ] **Step 1: Write the failing tests**

Append to `tests/selection.test.mjs`:
```js
test('selecting a structure drops the units and back; prune drops dead structures', () => {
  const s = new Selection();
  s.set([1, 2]);
  s.setStructure(7);
  assert.deepEqual([s.list(), s.structureId], [[], 7]);
  s.set([3]);
  assert.equal(s.structureId, 0);
  s.setStructure(7);
  const v = s.version;
  s.prune(() => true, (id) => id !== 7);
  assert.equal(s.structureId, 0);
  assert.ok(s.version > v);
  s.setStructure(8);
  s.clear();
  assert.equal(s.structureId, 0);
});
```

Append to `tests/controller.test.mjs`:
```js
test('a click selects a structure; with a factory selected a ground click sets its rally point', () => {
  const { world, c, issued } = setup();
  const lf = world.spawnStructure('lightFactory', 'atreides', 2, 12);
  c.onClick(px(2), px(12), 0, NONE, false);
  assert.equal(c.selection.structureId, lf.id);
  assert.equal(c.selection.list().length, 0);
  assert.equal(c.cursorFor(c.hitTest(px(9), px(14))), 'move');
  c.onClick(px(9), px(14), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'setRally', structureId: lf.id, x: 9, y: 14 });
  assert.equal(c.selection.structureId, lf.id, 'the factory stays selected');
  c.onClick(px(2), px(12), 0, NONE, true);
  assert.deepEqual(issued.at(-1), { type: 'setPrimary', structureId: lf.id });
  c.onClick(px(9), px(14), 2, NONE, false);
  assert.equal(c.selection.structureId, 0, 'right click deselects (classic)');
});

test('modern scheme: right click on the ground sets the rally point of the selected factory', () => {
  const { world, c, issued } = setup('modern');
  const lf = world.spawnStructure('lightFactory', 'atreides', 2, 12);
  c.onClick(px(2), px(12), 0, NONE, false);
  c.onClick(px(9), px(14), 2, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'setRally', structureId: lf.id, x: 9, y: 14 });
});

test('harvesters clicked onto an own refinery go back to base; enemy structures do not steal the selection', () => {
  const { world, tank, c, issued } = setup();
  world.spawnStructure('refinery', 'atreides', 2, 12);
  const harv = world.spawnUnit('harvester', 'atreides', 10, 10);
  c.selection.set([harv.id]);
  assert.equal(c.cursorFor(c.hitTest(px(3), px(12))), 'move');
  c.onClick(px(3), px(12), 0, NONE, false);
  assert.deepEqual(issued.at(-1), { type: 'returnToBase', ids: [harv.id] });
  world.spawnStructure('windtrap', 'harkonnen', 14, 2);
  c.selection.set([tank.id]);
  c.onClick(px(14), px(2), 0, NONE, false);
  assert.deepEqual(c.selection.list(), [tank.id]);
  assert.equal(c.selection.structureId, 0);
});
```

**File: `tests/selection-panel.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { Selection } from '../src/input/selection.js';
import { selectionPanelModel } from '../src/ui/selection-panel.js';
import { flatWorld } from './helpers.mjs';

test('a single harvester shows its load and what it is doing, with a Return button', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.spawnUnit('harvester', 'atreides', 5, 5);
  h.harvest.load = 350;
  h.harvest.state = 'harvesting';
  const sel = new Selection();
  sel.set([h.id]);
  const m = selectionPanelModel(world, sel, 'atreides');
  assert.deepEqual([m.kind, m.name, m.own, m.count], ['unit', 'Harvester', true, 1]);
  assert.deepEqual(m.details, ['Spice 50 %', 'Harvesting']);
  assert.deepEqual(m.buttons.map((b) => b.id), ['stop', 'guard', 'scatter', 'return']);
});

test('a group sums hit points and counts its types; enemies get no buttons', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const a = world.spawnUnit('combatTank', 'atreides', 3, 3);
  const b = world.spawnUnit('combatTank', 'atreides', 5, 3);
  const t = world.spawnUnit('mcv', 'atreides', 7, 3);
  a.hp = 100;
  const sel = new Selection();
  sel.set([a.id, b.id, t.id]);
  const m = selectionPanelModel(world, sel, 'atreides');
  assert.deepEqual([m.kind, m.count, m.hp, m.maxHp], ['group', 3, 100 + 200 + 150, 200 + 200 + 150]);
  assert.deepEqual(m.details, ['2 × Combat Tank', '1 × MCV']);
  assert.deepEqual(m.buttons.map((x) => x.id), ['stop', 'guard', 'scatter', 'deploy']);
  const enemy = world.spawnUnit('quad', 'harkonnen', 12, 12);
  sel.set([enemy.id]);
  assert.deepEqual(selectionPanelModel(world, sel, 'atreides').buttons, []);
});

test('an own factory offers Repair, Sell and Set primary', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const lf = world.spawnStructure('lightFactory', 'atreides', 4, 4);
  const sel = new Selection();
  sel.setStructure(lf.id);
  let m = selectionPanelModel(world, sel, 'atreides');
  assert.deepEqual(m.buttons.map((b) => b.id), ['repair', 'sell', 'primary']);
  assert.equal(m.buttons[0].disabled, true, 'nothing to repair');
  lf.primary = true;
  lf.hp = 100;
  lf.rally = { x: 9, y: 9 };
  m = selectionPanelModel(world, sel, 'atreides');
  assert.deepEqual(m.buttons.map((b) => b.id), ['repair', 'sell']);
  assert.equal(m.buttons[0].disabled, false);
  assert.deepEqual(m.details, ['Power use 20', 'Primary factory', 'Rally point set']);
  assert.equal(selectionPanelModel(world, new Selection(), 'atreides'), null);
});

test('a damaged wind trap reports its reduced output', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const trap = world.spawnStructure('windtrap', 'atreides', 4, 4);
  trap.hp = trap.maxHp / 2;
  trap.repairing = true;
  const sel = new Selection();
  sel.setStructure(trap.id);
  const m = selectionPanelModel(world, sel, 'atreides');
  assert.deepEqual(m.details, ['Power output 50', 'Repairing']);
  assert.deepEqual([m.buttons[0].label, m.buttons[0].active], ['Stop repair', true]);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/selection.test.mjs tests/controller.test.mjs tests/selection-panel.test.mjs`
Expected: FAIL — `s.setStructure is not a function`; structure clicks select nothing; cannot find `selection-panel.js`.

- [ ] **Step 3: Selection and controller**

Modify `src/input/selection.js` — replace the `Selection` class with:
```js
export class Selection {
  constructor() { this.ids = new Set(); this.structureId = 0; this.version = 0; }
  set(ids) { this.ids = new Set(ids); this.structureId = 0; this.version++; }
  add(ids) { for (const id of ids) this.ids.add(id); this.structureId = 0; this.version++; }
  toggle(id) { if (this.ids.has(id)) this.ids.delete(id); else this.ids.add(id); this.structureId = 0; this.version++; }
  setStructure(id) { this.ids = new Set(); this.structureId = id; this.version++; }
  clear() { if (this.ids.size || this.structureId) { this.ids.clear(); this.structureId = 0; this.version++; } }
  has(id) { return this.ids.has(id); }
  list() { return [...this.ids]; }
  prune(alive, structureAlive = () => true) {
    let changed = false;
    for (const id of this.ids) if (!alive(id)) { this.ids.delete(id); changed = true; }
    if (this.structureId && !structureAlive(this.structureId)) { this.structureId = 0; changed = true; }
    if (changed) this.version++;
  }
}
```

Modify `src/input/controller.js`:
- add `import { LINE_FACTORIES } from '../sim/tech.js';` after the placement import, and below the imports:
```js
const UNIT_FACTORIES = new Set(Object.entries(LINE_FACTORIES).filter(([line]) => line !== 'structure').flatMap(([, types]) => types));
```
- after `this.hoverId = null;` add `    this.hoverStructureId = null;`
- replace `onClick(…) { … }` with:
```js
  onClick(x, y, button, mods, double) {
    if (!this.inViewport(x, y)) return;
    if (this.mode) { this.modeClick(x, y, button); return; }
    const classic = this.settings.scheme !== 'modern';
    const hit = this.hitTest(x, y);
    if (button === 2) {
      if (classic) this.selection.clear();
      else if (!this.rally(hit)) this.order(hit);
      return;
    }
    if (hit?.kind === 'unit' && hit.unit.house === this.house) {
      const u = hit.unit;
      // a second click on the selected MCV deploys it, even when the two clicks were quick enough to count as a double click
      if (classic && !mods.shift && u.type.deploysTo && this.selection.ids.size === 1 && this.selection.has(u.id)) { this.issue({ type: 'deploy', ids: [u.id] }); return; }
      if (double) { this.selectSameType(u); return; }
      if (mods.shift) this.selection.toggle(u.id); else this.selection.set([u.id]);
      return;
    }
    if (hit?.kind === 'structure' && hit.structure) { this.clickStructure(hit.structure, classic, double); return; }
    if (classic && this.ownSelected().length) { this.order(hit); return; }
    if (classic && this.rally(hit)) return;
    if (hit?.kind === 'unit') { this.selection.set([hit.unit.id]); return; }
    if (!mods.shift) this.selection.clear();
  }

  clickStructure(s, classic, double) {
    const units = this.ownSelected();
    if (classic && units.length) {
      if (s.house === this.house && s.typeId === 'refinery' && units.every((u) => u.harvest)) { this.issue({ type: 'returnToBase', ids: units.map((u) => u.id) }); return; }
      if (s.house !== this.house) return;   // attacking structures arrives with combat (plan 1c)
    }
    if (double && s.house === this.house && UNIT_FACTORIES.has(s.typeId)) this.issue({ type: 'setPrimary', structureId: s.id });
    this.selection.setStructure(s.id);
  }

  /** The selected own unit factory, whose rally point a ground click sets. */
  rallyTarget() {
    const s = this.world.structures.get(this.selection.structureId);
    return s && s.house === this.house && UNIT_FACTORIES.has(s.typeId) ? s : null;
  }

  rally(hit) {
    const s = hit?.kind === 'ground' ? this.rallyTarget() : null;
    if (!s) return false;
    this.issue({ type: 'setRally', structureId: s.id, x: hit.tx, y: hit.ty });
    this.onMarker(hit.tx + 0.5, hit.ty + 0.5);
    return true;
  }
```
- in `frame()`, after `this.hoverId = hit?.kind === 'unit' ? hit.unit.id : null;` add:
```js
    this.hoverStructureId = hit?.kind === 'structure' ? hit.structure?.id ?? null : null;
```
- replace `cursorFor(hit) { … }` with:
```js
  cursorFor(hit) {
    if (this.mode) {
      if (this.mode.kind === 'place') return 'default';
      const s = hit?.kind === 'structure' && hit.structure?.house === this.house ? hit.structure : null;
      if (this.mode.kind === 'sell') return s ? 'sell' : 'noSell';
      return s && s.hp < s.maxHp ? 'repair' : 'noRepair';
    }
    const own = this.ownSelected();
    if (!hit) return own.length ? 'noMove' : 'default';
    if (hit.kind === 'unit') {
      if (hit.unit.house !== this.house) return own.length ? 'attack' : 'select';
      if (own.length === 1 && own[0].id === hit.unit.id && hit.unit.type.deploysTo) return deploySpot(this.world, hit.unit) ? 'deploy' : 'noDeploy';
      return 'select';
    }
    if (hit.kind === 'structure') {
      const s = hit.structure;
      if (own.length && s?.house === this.house && s.typeId === 'refinery' && own.every((u) => u.harvest)) return 'move';
      return own.length && s?.house !== this.house ? 'noMove' : 'select';
    }
    if (!own.length) return this.rallyTarget() ? 'move' : 'default';
    const i = this.world.map.idx(hit.tx, hit.ty);
    if (!own.some((u) => this.world.map.moveFactor(i, u.move) > 0)) return 'noMove';
    return own.every((u) => u.harvest) && this.world.map.spice[i] > 0 ? 'attack' : 'move';
  }
```

- [ ] **Step 4: Selection panel**

**File: `src/ui/selection-panel.js`**
```js
// Selection panel (spec §5.6): bottom-left of the battlefield — portrait (model icon), name, hit
// points and what the selection is doing, with order buttons: Stop / Guard / Scatter / Deploy /
// Return for units, Repair / Sell / Set primary for own structures. The model part is pure.
import { UNITS } from '../data/units.js';
import { LINE_FACTORIES } from '../sim/tech.js';
import { HARVEST_CAPACITY } from '../sim/harvest.js';

const UNIT_FACTORIES = new Set(Object.entries(LINE_FACTORIES).filter(([line]) => line !== 'structure').flatMap(([, types]) => types));
const HARVEST_TEXT = { seek: 'Looking for spice', toField: 'Heading to spice', harvesting: 'Harvesting', toRefinery: 'Returning to refinery', queued: 'Waiting to unload', unloading: 'Unloading' };
const ORDER_TEXT = { idle: 'Idle', move: 'Moving', guard: 'Guarding', stop: 'Idle' };

function structureModel(world, s, houseId) {
  const own = s.house === houseId, t = s.type, details = [];
  if (t.power < 0) details.push(`Power output ${Math.round(-t.power * Math.max(0.5, Math.min(1, s.hp / s.maxHp)))}`);
  else if (t.power > 0) details.push(`Power use ${t.power}`);
  if (t.storage) details.push(`Storage ${t.storage}`);
  if (UNIT_FACTORIES.has(s.typeId)) {
    if (s.primary) details.push('Primary factory');
    if (s.rally) details.push('Rally point set');
  }
  if (s.typeId === 'refinery') details.push(s.dockedBy ? 'Harvester unloading' : 'Landing pad free');
  if (s.repairing) details.push(s.repairStalled ? 'Repair paused: no credits' : 'Repairing');
  const buttons = own ? [
    { id: 'repair', label: s.repairing ? 'Stop repair' : 'Repair', active: !!s.repairing, disabled: !s.repairing && s.hp >= s.maxHp },
    { id: 'sell', label: 'Sell' },
    ...(UNIT_FACTORIES.has(s.typeId) && !s.primary ? [{ id: 'primary', label: 'Set primary' }] : []),
  ] : [];
  return { kind: 'structure', typeId: s.typeId, house: s.house, own, name: t.name, hp: s.hp, maxHp: s.maxHp, count: 1, details, buttons };
}

function unitButtons(own) {
  if (!own.length) return [];
  const b = [{ id: 'stop', label: 'Stop', key: 'S' }, { id: 'guard', label: 'Guard', key: 'G' }, { id: 'scatter', label: 'Scatter', key: 'X' }];
  if (own.some((u) => u.type.deploysTo)) b.push({ id: 'deploy', label: 'Deploy', key: 'D' });
  if (own.some((u) => u.harvest)) b.push({ id: 'return', label: 'Return' });
  return b;
}

export function selectionPanelModel(world, selection, houseId) {
  const s = world.structures.get(selection.structureId);
  if (s) return structureModel(world, s, houseId);
  const units = selection.list().map((id) => world.units.get(id)).filter(Boolean);
  if (!units.length) return null;
  const own = units.filter((u) => u.house === houseId);
  const buttons = unitButtons(own);
  if (units.length === 1) {
    const u = units[0], details = [];
    if (u.harvest) details.push(`Spice ${Math.round((u.harvest.load / HARVEST_CAPACITY) * 100)} %`, HARVEST_TEXT[u.harvest.state] ?? 'Harvesting');
    else details.push(ORDER_TEXT[u.order.type] ?? 'Busy');
    return { kind: 'unit', typeId: u.typeId, house: u.house, own: u.house === houseId, name: u.type.name, hp: u.hp, maxHp: u.maxHp, count: 1, details, buttons };
  }
  const counts = new Map();
  for (const u of units) counts.set(u.typeId, (counts.get(u.typeId) ?? 0) + 1);
  const types = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    kind: 'group', typeId: types[0][0], house: units[0].house, own: own.length > 0, name: `${units.length} units`,
    hp: units.reduce((n, u) => n + u.hp, 0), maxHp: units.reduce((n, u) => n + u.maxHp, 0), count: units.length,
    details: types.slice(0, 4).map(([typeId, n]) => `${n} × ${UNITS[typeId].name}`), buttons,
  };
}

export class SelectionPanel {
  constructor(root, { iconFor, onButton }) {
    this.iconFor = iconFor;
    this.el = document.createElement('div');
    this.el.className = 'sel-panel';
    this.el.innerHTML = '<img class="sel-portrait" alt=""><div class="sel-info"><div class="sel-name"></div><div class="sel-hp"><i></i><span></span></div><div class="sel-details"></div></div><div class="sel-buttons"></div>';
    root.appendChild(this.el);
    this.portrait = this.el.querySelector('.sel-portrait');
    this.name = this.el.querySelector('.sel-name');
    this.hpBar = this.el.querySelector('.sel-hp i');
    this.hpText = this.el.querySelector('.sel-hp span');
    this.details = this.el.querySelector('.sel-details');
    this.buttons = this.el.querySelector('.sel-buttons');
    this.buttons.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !b.disabled) onButton(b.dataset.id); });
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.key = null;
  }

  update(model) {
    this.el.classList.toggle('show', !!model);
    if (!model) { this.key = null; return; }
    const key = JSON.stringify([model.kind, model.typeId, model.house, model.name, model.details, model.buttons]);
    if (key !== this.key) {
      this.key = key;
      this.portrait.src = this.iconFor(model.typeId, model.house);
      this.name.textContent = model.name;
      this.details.textContent = '';
      for (const line of model.details) { const d = document.createElement('div'); d.textContent = line; this.details.appendChild(d); }
      this.buttons.textContent = '';
      for (const b of model.buttons) {
        const el = document.createElement('button');
        el.dataset.id = b.id;
        el.textContent = b.label;
        if (b.key) { const k = document.createElement('kbd'); k.textContent = b.key; el.appendChild(k); }
        el.disabled = !!b.disabled;
        el.classList.toggle('active', !!b.active);
        this.buttons.appendChild(el);
      }
    }
    const frac = Math.max(0, Math.min(1, model.hp / model.maxHp));
    this.hpBar.style.width = `${(frac * 100).toFixed(1)}%`;
    this.hpBar.style.background = frac > 0.5 ? '#35d04a' : frac > 0.25 ? '#e3c237' : '#e0412f';
    const text = `${Math.ceil(model.hp)} / ${model.maxHp}`;
    if (this.hpText.textContent !== text) this.hpText.textContent = text;
  }
}
```

Modify `src/ui/styles.css` — append:
```css
.sel-panel { position: absolute; left: 10px; bottom: 10px; display: none; gap: 10px; align-items: flex-start; padding: 8px 10px; max-width: 520px;
  background: linear-gradient(#3a2a18, #22170c); border: 2px solid #b8893a; border-radius: 3px; box-shadow: 0 2px 10px rgba(0,0,0,.6); pointer-events: auto; }
.sel-panel.show { display: flex; }
.sel-portrait { width: 96px; height: 72px; border: 2px solid #8e6843; border-radius: 2px; object-fit: cover; }
.sel-info { min-width: 150px; }
.sel-name { font: bold 15px "Trebuchet MS", sans-serif; color: #f5d48a; }
.sel-hp { position: relative; height: 12px; margin: 4px 0; background: #120c06; border: 1px solid #8e6843; }
.sel-hp i { position: absolute; left: 0; top: 0; bottom: 0; }
.sel-hp span { position: absolute; inset: 0; font: bold 10px Consolas, monospace; line-height: 12px; text-align: center; color: #fff; text-shadow: 0 1px 1px #000; }
.sel-details { font-size: 12px; color: #d8c29a; line-height: 1.35; }
.sel-buttons { display: grid; grid-template-columns: repeat(2, auto); gap: 4px; }
.sel-buttons button { padding: 4px 10px; font: bold 12px "Trebuchet MS", sans-serif; color: #f5d48a; background: linear-gradient(#4a3520, #2a1d10); border: 1px solid #8e6843; border-radius: 2px; cursor: pointer; text-align: left; }
.sel-buttons button:hover:not(:disabled) { border-color: #ffd24a; }
.sel-buttons button:disabled { opacity: .45; cursor: default; }
.sel-buttons button.active { border-color: #7dff7a; color: #7dff7a; }
.sel-buttons kbd { margin-left: 6px; font: 10px Consolas, monospace; color: #c9a063; }
```

- [ ] **Step 5: Overlay and GameView**

Modify `src/render/overlay.js`:
- change the `draw` signature to:
```js
  draw({ world, selection, hoverId, hoverStructureId = null, project, positionOf, groups, dt, healthBars = 'selected', canSee = () => true }) {
```
- as the first line inside the `for (const u of world.units.values()) {` loop add `      if (!canSee(u)) continue;`
- directly before `    this.markers = this.markers.filter(…);` add:
```js
    for (const s of world.structures.values()) {
      const selected = s.id === selection.structureId, hovered = s.id === hoverStructureId;
      if (!selected && !hovered && healthBars !== 'always' && !(healthBars === 'damaged' && s.hp < s.maxHp)) continue;
      const p = project(s.x + s.w / 2, s.y + s.h / 2, 0.3);
      if (!p.visible) continue;
      const half = Math.max(12, p.pxPerUnit * Math.max(s.w, s.h) * 0.52);
      if (selected || hovered) brackets(c, p.x, p.y, half, selected ? '#ffffff' : 'rgba(255,255,255,0.45)');
      healthBar(c, p.x, p.y - half - 7, Math.min(half * 2, 96), s.hp / s.maxHp);
      if (!selected) continue;
      if (s.rally) {
        const r = project(s.rally.x + 0.5, s.rally.y + 0.5, 0.05);
        c.save();
        c.setLineDash([6, 5]);
        c.strokeStyle = 'rgba(255,255,255,0.85)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(r.x, r.y);
        c.stroke();
        c.restore();
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(r.x, r.y, 4, 0, Math.PI * 2);
        c.fill();
      }
      if (s.primary) {
        c.font = 'bold 11px "Trebuchet MS", sans-serif';
        c.textAlign = 'center';
        c.fillStyle = '#000';
        c.fillText('PRIMARY', p.x + 1, p.y + half + 14);
        c.fillStyle = '#ffd24a';
        c.fillText('PRIMARY', p.x, p.y + half + 13);
        c.textAlign = 'start';
      }
    }
```

Modify `src/game/game-view.js`:
- add imports:
```js
import { SelectionPanel, selectionPanelModel } from '../ui/selection-panel.js';
import { unitVisibleTo } from '../sim/fog.js';
```
- after the `this.radar = new Radar(…);` statement add:
```js
    this.panel = new SelectionPanel(document.getElementById('ui'), {
      iconFor: (typeId, houseId) => this.icons.forItem(typeId, houseId),
      onButton: (id) => this.panelAction(id),
    });
```
- add this method after `viewQuad()`:
```js
  panelAction(id) {
    const units = this.controller.ownSelected();
    const s = this.world.structures.get(this.selection.structureId);
    const issue = (cmd) => this.world.issue(this.house, cmd);
    if (['stop', 'guard', 'scatter', 'deploy'].includes(id) && units.length) issue({ type: id, ids: units.map((u) => u.id) });
    else if (id === 'return') issue({ type: 'returnToBase', ids: units.filter((u) => u.harvest).map((u) => u.id) });
    else if (s && id === 'repair') issue({ type: 'repair', structureId: s.id });
    else if (s && id === 'sell') issue({ type: 'sell', structureId: s.id });
    else if (s && id === 'primary') issue({ type: 'setPrimary', structureId: s.id });
  }
```
- in `frame(now)`, replace `    this.selection.prune((id) => world.units.has(id));` with:
```js
    this.selection.prune((id) => { const u = world.units.get(id); return !!u && unitVisibleTo(world, this.house, u); }, (id) => world.structures.has(id));
```
- in `frame(now)`, replace the `this.overlay.draw({ … });` call with:
```js
    this.overlay.draw({
      world, selection: this.selection, hoverId: this.controller.hoverId, hoverStructureId: this.controller.hoverStructureId,
      project: this.project, positionOf: this.positionOf, groups: this.groups, dt, healthBars: this.settings.healthBars,
      canSee: (u) => unitVisibleTo(world, this.house, u),
    });
    this.panel.update(selectionPanelModel(world, this.selection, this.house));
```

- [ ] **Step 6: Run the tests**

Run: `node --test tests/selection.test.mjs tests/controller.test.mjs tests/selection-panel.test.mjs && npm test`
Expected: PASS (8 new tests); suite green.

- [ ] **Step 7: Commit**

```bash
git add src/input src/ui src/render/overlay.js src/game/game-view.js tests/selection.test.mjs tests/controller.test.mjs tests/selection-panel.test.mjs
git commit -m "feat(ui): structure selection, rally points, primary factories and the selection panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 16: Fog on screen, debug hooks, base showcase and the end-to-end run

**Files:**
- Create: `src/render/shroud.js`, `src/scenes/base.js`
- Modify: `src/game/game-view.js`, `src/game/debug.js`, `src/game/setup.js`, `src/scenes/skirmish.js`, `src/main.js`, `scripts/scenarios.mjs`, `scripts/e2e.mjs`
- Test: `tests/shroud.test.mjs`, `tests/setup.test.mjs` (addition)

**Interfaces:**
- Consumes: everything above — `FogLayer.revision` and `World.fogOfWar` (Task 8), `UnitViews`/`StructureViews` `{viewer}` and `notify` (Task 10), `Controller` `canSee` and `mode` (Tasks 10, 12), `findPlacement` (Task 3), `sidebarModel` (Task 13), `TerrainView.setShroud(explored, visible)` (plan 1a).
- Produces: `class ShroudSync(n)` with `update(fog)` → `true` when the 0/255 `explored` and `visible` bytes changed; `setupSkirmish({…, fog = true})` sets `world.fogOfWar`; skirmish and base queries `fog=0`; debug API additions `credits()`, `sidebar()`, `mode()`, `buttonRect(typeId)`, `toolRect(tool)`, `findPlacement(typeId)`, `screenOfFootprint(typeId, x, y)`, and `hp`/`maxHp` in `structures()`; scene `base` (`?scene=base&house=…&fog=…&ticks=…`).

- [ ] **Step 1: Write the failing tests**

**File: `tests/shroud.test.mjs`**
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { ShroudSync } from '../src/render/shroud.js';
import { flatWorld } from './helpers.mjs';

test('the shroud follows the fog layer and refreshes only when the fog changed', () => {
  const world = flatWorld(20, 10, G.ROCK);
  world.spawnUnit('combatTank', 'atreides', 3, 3);
  const sync = new ShroudSync(200);
  assert.equal(sync.update(world.houses.get('atreides').fog), false, 'no fog yet');
  world.step();
  const fog = world.houses.get('atreides').fog;
  assert.equal(sync.update(fog), true);
  assert.equal(sync.explored[world.map.idx(3, 3)], 255);
  assert.equal(sync.visible[world.map.idx(3, 3)], 255);
  assert.equal(sync.explored[world.map.idx(15, 8)], 0);
  assert.equal(sync.update(fog), false, 'unchanged');
  for (let i = 0; i < 5; i++) world.step();
  assert.equal(sync.update(fog), true);
});
```

Append to `tests/setup.test.mjs`:
```js
test('skirmish fog of war is on by default and can be switched off', () => {
  assert.equal(setupSkirmish({ seed: 2 }).world.fogOfWar, true);
  assert.equal(setupSkirmish({ seed: 2, fog: false }).world.fogOfWar, false);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `node --test tests/shroud.test.mjs tests/setup.test.mjs`
Expected: FAIL — cannot find `shroud.js`; `fogOfWar` stays `true` with `fog: false`.

- [ ] **Step 3: Implement**

**File: `src/render/shroud.js`**
```js
// Fog layer (0/1 per tile) → the terrain's shroud bytes (0/255), refreshed only when the fog changed.
export class ShroudSync {
  constructor(n) {
    this.explored = new Uint8Array(n);
    this.visible = new Uint8Array(n);
    this.revision = -1;
  }

  update(fog) {
    if (!fog || fog.revision === this.revision) return false;
    this.revision = fog.revision;
    for (let i = 0; i < this.explored.length; i++) {
      this.explored[i] = fog.explored[i] * 255;
      this.visible[i] = fog.visible[i] * 255;
    }
    return true;
  }
}
```

Modify `src/game/setup.js` — change the `setupSkirmish` signature and add the switch:
```js
export function setupSkirmish({ seed = 1, size = 64, house = 'atreides', enemy = null, credits = 3000, fog = true } = {}) {
  const { map, starts } = generateMap({ w: size, h: size, seed, players: 2 });
  const world = new World({ map, seed });
  world.fogOfWar = fog;
```
(the rest of the function is unchanged).

Modify `src/scenes/skirmish.js` — pass the switch: in the `setupSkirmish({ … })` call add `fog: params.bool('fog', true)`.

Modify `src/game/game-view.js`:
- add `import { ShroudSync } from '../render/shroud.js';` after the PlacementGhost import
- replace `this.unitViews = new UnitViews(r3d.scene, hf);` and `this.structureViews = new StructureViews(r3d.scene, hf);` with:
```js
    this.unitViews = new UnitViews(r3d.scene, hf, { viewer: house });
    this.structureViews = new StructureViews(r3d.scene, hf, { viewer: house });
    this.shroud = new ShroudSync(world.map.w * world.map.h);
```
- in the `new Controller({ … })` options, after `onMode: …,` add:
```js
      canSee: (u) => unitVisibleTo(world, house, u),
```
- in `onEvent(e)`, after the `deployed` branch add:
```js
    else if (e.type === 'sold' && e.house === this.house) this.hud.message('Structure sold.');
    if (e.type === 'unitBuilt') this.structureViews.notify(e, performance.now());
```
- in `frame(now)`, directly after `this.handleEvents();` add:
```js
    if (world.fogOfWar && this.shroud.update(world.houses.get(this.house)?.fog)) this.terrain.setShroud(this.shroud.explored, this.shroud.visible);
```
- in `start()`, change the `createDebugApi({ … })` call to also pass `controller: this.controller`.

Replace `src/game/debug.js` with:
```js
// window.__dune: read-only hooks for smoke and end-to-end tests (no cheats).
import { findFreeTile } from './setup.js';
import { STRUCTURES } from '../data/structures.js';
import { findPlacement } from '../sim/placement.js';
import { sidebarModel } from '../ui/sidebar-model.js';

export function createDebugApi({ world, house, selection, project, positionOf, rig, controller }) {
  const brief = (u) => u && { id: u.id, typeId: u.typeId, house: u.house, tx: u.tx, ty: u.ty, x: u.x, y: u.y, order: u.order.type, hp: u.hp };
  const screen = (x, z, lift) => { const s = project(x, z, lift); return { x: Math.round(s.x), y: Math.round(s.y), visible: s.visible }; };
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), visible: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight };
  };
  const yard = () => [...world.structures.values()].find((s) => s.house === house && s.typeId === 'constructionYard');
  return {
    ready: false,
    scene: 'skirmish',
    world,
    house,
    selection: () => selection.list(),
    units: (typeId = null, h = house) => [...world.units.values()].filter((u) => u.house === h && (!typeId || u.typeId === typeId)).map(brief),
    unit: (id) => brief(world.units.get(id)),
    structures: (typeId = null) => [...world.structures.values()].filter((s) => !typeId || s.typeId === typeId).map((s) => ({ id: s.id, typeId: s.typeId, house: s.house, x: s.x, y: s.y, hp: s.hp, maxHp: s.maxHp })),
    screenOfUnit: (id) => { const u = world.units.get(id); if (!u) return null; const p = positionOf(u); return screen(p.x, p.z, 0.12); },
    screenOfTile: (x, y) => screen(x + 0.5, y + 0.5, 0),
    screenOfFootprint: (typeId, x, y) => { const t = STRUCTURES[typeId]; return screen(x + t.w / 2, y + t.h / 2, 0); },
    freeTileNear: (x, y, moveClass = 'tracked') => findFreeTile(world, x, y, moveClass, 6),
    findPlacement: (typeId) => { const y = yard(); return y ? findPlacement(world, house, typeId, y.x, y.y) : null; },
    credits: () => Math.floor(world.houses.get(house).credits),
    sidebar: () => sidebarModel(world, house),
    mode: () => controller?.mode?.kind ?? null,
    buttonRect: (typeId) => rect(document.querySelector(`.sidebar .sb-item[data-type="${typeId}"]`)),
    toolRect: (tool) => rect(document.querySelector(`.sidebar .sb-tool[data-tool="${tool}"]`)),
    lookAt: (x, z) => rig.lookAt(x, z, true),
  };
}
```

**File: `src/scenes/base.js`**
```js
// Base showcase: a skirmish map with a built-up base for one house — every plan-1b structure placed
// by the placement rules next to the deployed yard, harvesters out on the nearest spice — for
// screenshots and real-GPU frame-rate checks (?scene=base&fps=1).
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { STRUCTURES } from '../data/structures.js';
import { setupSkirmish } from '../game/setup.js';
import { GameView } from '../game/game-view.js';
import { findPlacement, placeStructure } from '../sim/placement.js';

const LAYOUT = ['windtrap', 'refinery', 'windtrap', 'outpost', 'silo', 'barracks', 'wor', 'lightFactory', 'heavyFactory', 'windtrap', 'refinery', 'turret', 'rocketTurret', 'turret', 'windtrap'];

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const house = params.str('house', 'atreides');
  const { world, starts } = setupSkirmish({ seed: params.num('seed', 11), size: params.num('size', 64), house, credits: 5000, fog: params.bool('fog', true) });
  const mcv = [...world.units.values()].find((u) => u.house === house && u.typeId === 'mcv');
  world.issue(house, { type: 'deploy', ids: [mcv.id] });
  world.step();
  const yard = [...world.structures.values()].find((s) => s.house === house && s.typeId === 'constructionYard');
  const focus = yard ? { x: yard.x + 1, z: yard.y + 3 } : { x: starts[0].x + 0.5, z: starts[0].y + 2.5 };
  if (yard) {
    for (const typeId of LAYOUT) {
      if (!STRUCTURES[typeId].houses.includes(house)) continue;
      const spot = findPlacement(world, house, typeId, yard.x, yard.y, 12);
      if (spot) placeStructure(world, house, typeId, spot.x, spot.y);
    }
    for (let k = 0; k < 6; k++) {
      const spot = findPlacement(world, house, 'wall', yard.x + 5, yard.y + 5, 12);
      if (spot) placeStructure(world, house, 'wall', spot.x, spot.y);
    }
  }
  for (let i = 0, n = params.num('ticks', 600); i < n; i++) world.step();
  const view = new GameView({ world, house, settings, params, focus });
  view.start();
  return view;
}
```

Modify `src/main.js` — add to `SCENES`: `  base: () => import('./scenes/base.js'),`

Modify `scripts/scenarios.mjs` — add:
```js
  'base-atreides': { query: 'scene=base&house=atreides&fog=0' },
  'base-harkonnen-close': { query: 'scene=base&house=harkonnen&dist=12' },
  'base-ordos-fog': { query: 'scene=base&house=ordos&dist=30' },
```

- [ ] **Step 4: Extend the end-to-end run**

Modify `scripts/e2e.mjs`:
- change the page URL to `http://localhost:${PORT}/?scene=skirmish&seed=11&house=atreides&quality=low&gameSpeed=fastest`
- directly before `  await sleep(1500);` (the line before the final screenshot) insert:
```js
  let wt = null;
  for (let i = 0; i < 25 && !wt?.visible; i++) { await sleep(200); wt = await ev(`__dune.buttonRect('windtrap')`); }
  check('the deployed yard fills the structure strip', !!wt?.visible);
  const creditsBefore = await ev('__dune.credits()');
  await page.click(wt.x, wt.y);
  let ready = false;
  for (let i = 0; i < 150 && !ready; i++) {
    await sleep(200);
    ready = (await ev(`__dune.sidebar().structures.find((i) => i.typeId === 'windtrap').state`)) === 'ready';
  }
  check('clicking the Wind Trap icon builds it and pays for it', ready && (await ev('__dune.credits()')) <= creditsBefore - 290);
  await page.click(wt.x, wt.y);
  await sleep(200);
  check('clicking a READY icon starts placement', (await ev('__dune.mode()')) === 'place');
  const spot = await ev(`__dune.findPlacement('windtrap')`);
  const ps = await ev(`__dune.screenOfFootprint('windtrap', ${spot.x}, ${spot.y})`);
  await page.mouse('mouseMoved', ps.x, ps.y, { button: 'none', held: 'none' });
  await sleep(250);
  await page.click(ps.x, ps.y);
  let trap = null;
  for (let i = 0; i < 25 && !trap; i++) { await sleep(150); trap = (await ev(`__dune.structures('windtrap')`)).find((s) => s.house === 'atreides') ?? null; }
  check('clicking the ground places the Wind Trap next to the yard', !!trap && trap.x === spot.x && trap.y === spot.y);
  check('the radar stays offline without an Outpost', (await ev('__dune.sidebar().radar')) === false);
  const sell = await ev(`__dune.toolRect('sell')`);
  await page.click(sell.x, sell.y);
  await sleep(150);
  const credits = await ev('__dune.credits()');
  const ts2 = await ev(`__dune.screenOfFootprint('windtrap', ${trap.x}, ${trap.y})`);
  await page.click(ts2.x, ts2.y);
  let sold = false;
  for (let i = 0; i < 25 && !sold; i++) { await sleep(150); sold = !(await ev(`__dune.structures('windtrap')`)).some((s) => s.house === 'atreides'); }
  check('sell mode sells the Wind Trap for a refund', sold && (await ev('__dune.credits()')) > credits);
  await deselect();
  check('right click leaves sell mode', (await ev('__dune.mode()')) === null);
```

- [ ] **Step 5: Run everything**

Run: `npm test && npm run smoke && npm run e2e`
Expected: all Node tests pass; every smoke scenario writes a screenshot with no console errors; e2e prints `14/14 checks passed`. Read the skirmish, base and radar screenshots: unexplored ground is black with soft edges, explored ground outside current sight is dimmed, enemy units outside sight are not drawn; the base scenes show every standard structure with animated parts, harvesters on spice and a working radar. Fix and re-run until all three commands are green.

- [ ] **Step 6: Commit**

```bash
git add src/render/shroud.js src/scenes/base.js src/game src/scenes/skirmish.js src/main.js scripts tests/shroud.test.mjs tests/setup.test.mjs
git commit -m "feat(game): fog of war on screen, base showcase scene, sidebar end-to-end run

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: README and final verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the finished plan-1b game.
- Produces: README sections for base building (sidebar, placement, concrete, power, harvesting, sell and repair, radar, fog), the new scenes (`structures`, `icons`, `base`, `stress`), the query switches (`deploy`, `radar`, `fog`, `fps`, `debug`, `gameSpeed`) and the verification commands.

- [ ] **Step 1: Update the README**

Modify `README.md`:
- in the controls section add rows:
```markdown
| Sidebar icon: left click | Build; resume when on hold; place when READY |
| Sidebar icon: right click | Put on hold; a second right click cancels with a full refund |
| Sidebar icon: Shift + left click | Queue five units |
| Repair / Sell buttons | Toggle repair or sell mode; click own structures; right click or Esc leaves the mode |
| Click a factory, then the ground | Set its rally point (Modern: right click); double-click a factory to make it primary |
| Radar | Left click or drag jumps the camera; with own units selected a left click (Modern: right click) orders them there |
```
- add a "Base building" section:
```markdown
## Base building

Deploy the MCV to get a Construction Yard; its sidebar strip then offers what the tech tree allows.
Structures go on rock next to your base; tiles without your concrete cost hit points (the ghost shows
green = concrete, yellow = bare rock, red = blocked). Wind Traps power the base — short power slows
production and switches the radar off. Every Refinery comes with a Harvester; full loads are worth 700
credits, Refineries and Silos store them. Selling refunds half the price times the health left;
repairs cost up to 40 % of the price. An Outpost with enough power turns the radar on. Explored ground
stays visible; enemies show only inside your units' and buildings' sight.
```
- in the scenes list add: `structures` (every structure model), `icons` (sidebar icon sheet), `base` (a built-up base: `?scene=base&house=harkonnen&fps=1`), `stress` (200 units, `&fps=1` for the meter)
- in the URL switches add: `deploy=1` (skirmish starts with the MCV deployed), `fog=0` (no fog of war), `gameSpeed=slowest…fastest`, `debug=1` (invariant checks), `fps=1` (frame meter)

- [ ] **Step 2: Full verification**

Run: `npm test && npm run smoke && npm run e2e`
Expected: everything green, as at the end of Task 16. Screenshots reviewed.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README for base building, new scenes and switches

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Deferred to later plans

- Plan-1a minor #14 (two units on mirrored diagonal steps can pass through each other) moves to plan 1c with the combat movement work.
- Combat, turrets firing, unit and structure destruction, AI opponents, effects and sound: plan 1c.
- Upgrades as purchasable items, carryall delivery of the free harvester, starport, hi-tech, repair facility, IX, palace: plan 2.
