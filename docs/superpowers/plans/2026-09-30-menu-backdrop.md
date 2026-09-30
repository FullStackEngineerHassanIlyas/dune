# Main menu backdrop (Arrakis, then a battle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dune flyover behind the main menu with a loop: Arrakis turning in space → a dive into the planet → a live battle between two random houses → a climb back out.

**Architecture:** The display half of `GameView` moves into a reusable `BattleStage`. The menu drives a `ShowcaseDirector` (simulation only: map, armies, reinforcements, specials, hotspot) through a `BattleStage`, with a pure `showcase-camera` for the cinematic camera and a pure `backdrop-timeline` for phases, fades, caption and sound level. A `PlanetShot` (own scene and camera, shaded in GLSL) renders the space phases. `MenuBackdrop` runs it all on the menu's single `Renderer3D`. Spec: `docs/superpowers/specs/2026-09-30-menu-backdrop-design.md`.

**Tech Stack:** Plain ES modules, three.js r186 (vendored), `node --test` for unit tests, headless Chrome over CDP for smoke and e2e.

---

## Ground rules for this worktree

- Work only in `/home/purelogics-3621/games/dune/.claude/worktrees/menu-backdrop` (branch `feat/menu-backdrop`). Another agent works in the main checkout; never touch it.
- Git: in this session the RTK hook rewrites `git` and the worktree guard refuses it. Run git as `/usr/bin/git -C /home/purelogics-3621/games/dune/.claude/worktrees/menu-backdrop …`, one git command per shell call.
- Commit identity (no global identity on this machine): add `-c user.name="Hassan Ilyas" -c user.email="hassan.ilyas0@gmail.com"` before `commit`. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ports: the other agent may run the same scripts. Always run browser checks on our own ports:
  `SMOKE_PORT=8571`, `E2E_PORT=8572`, `E2E_MENU_PORT=8573`.
- `G` below means `/usr/bin/git -C /home/purelogics-3621/games/dune/.claude/worktrees/menu-backdrop`.

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/render/views/unit-views.js` | modify | `dispose()` |
| `src/render/views/structure-views.js` | modify | `dispose()` |
| `src/render/views/missile-views.js` | modify | `dispose()` |
| `src/render/effects.js` | modify | `ParticlePool.dispose()`, `Effects.dispose()` |
| `src/render/terrain.js` | modify | `TerrainView.dispose()` |
| `src/render/renderer.js` | modify | `render(scene, camera)` through the composer |
| `src/game/battle-stage.js` | create | views, effects, event effects and sound cues for one `World` |
| `src/game/game-view.js` | modify | uses a `BattleStage`; input, HUD, loop stay |
| `src/game/showcase-camera.js` | create | pure cinematic camera math |
| `src/game/backdrop-timeline.js` | create | pure phase clock, fade, caption, sound level |
| `src/game/showcase-director.js` | create | the menu battle's simulation side |
| `src/render/planet.js` | create | `PlanetShot`, `planetFraming` |
| `src/scenes/menu-backdrop.js` | create | `MenuBackdrop`: the loop on one renderer, DOM overlays, sound |
| `src/scenes/menu.js` | modify | uses `MenuBackdrop` (flyover stays as fallback), debug hook |
| `src/ui/menu.css` | modify | fade layer, caption, battle scrim |
| `tests/views.test.mjs`, `tests/effects.test.mjs` | modify | dispose tests |
| `tests/showcase-camera.test.mjs`, `tests/backdrop-timeline.test.mjs`, `tests/showcase-director.test.mjs`, `tests/planet.test.mjs` | create | unit tests |
| `scripts/scenarios.mjs`, `scripts/e2e-menu.mjs` | modify | smoke shots, backdrop e2e checks |
| `README.md`, spec | modify | docs |

---

### Task 1: dispose() for the views and effects

**Files:**
- Modify: `src/render/views/unit-views.js`, `src/render/views/structure-views.js`, `src/render/views/missile-views.js`, `src/render/effects.js`, `src/render/terrain.js`
- Test: `tests/views.test.mjs`, `tests/effects.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `tests/effects.test.mjs`:

```js
test('dispose takes the particle meshes and flash lights off the scene', () => {
  const scene = new THREE.Scene();
  const fx = new Effects(scene, { particles: 400, flashLights: 2 });
  fx.explosion(0, 0, 0, 'large');
  assert.ok(scene.children.length >= 4);
  fx.dispose();
  assert.equal(scene.children.length, 0);
});
```

Append to `tests/views.test.mjs` (add `import { MissileViews } from '../src/render/views/missile-views.js';` to the imports):

```js
test('dispose takes every unit, structure and missile mesh off the scene', () => {
  const world = flatWorld(32, 32, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const scene = new THREE.Scene();
  const units = new UnitViews(scene, hf), structures = new StructureViews(scene, hf), missiles = new MissileViews(scene);
  world.spawnUnit('combatTank', 'atreides', 3, 3);
  world.spawnUnit('troopers', 'harkonnen', 8, 8);
  const palace = world.spawnStructure('palace', 'harkonnen', 20, 20);
  palace.readyAt = 0;
  world.issue('harkonnen', { type: 'palace', x: 4, y: 4 });
  world.step();
  units.sync(world, 1, 0.016);
  structures.sync(world, 0);
  missiles.sync(world, 1, () => 0);
  assert.ok(missiles.model, 'the Death Hand is in flight');
  assert.ok(scene.children.length > 0);
  units.dispose();
  structures.dispose();
  missiles.dispose();
  assert.equal(scene.children.length, 0);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `node --test tests/effects.test.mjs tests/views.test.mjs`
Expected: the two new tests FAIL with `TypeError: fx.dispose is not a function` / `units.dispose is not a function`.

- [ ] **Step 3: Implement**

`src/render/effects.js` — add to `ParticlePool` (after `update(dt)`):

```js
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
```

and to `Effects` (after `update(dt)`):

```js
  /** Takes the pools and the flash lights off the scene and frees them. */
  dispose() {
    this.glow.dispose();
    this.smoke.dispose();
    for (const { light } of this.lights) { light.removeFromParent(); light.dispose(); }
    this.lights = [];
  }
```

`src/render/views/unit-views.js` — add to `UnitViews` (after `renderPos`):

```js
  /** Frees the instanced meshes; the shared model geometry and materials stay for the next battle. */
  dispose() {
    for (const m of this.models.values()) m.dispose();
    this.models.clear();
    this.views.clear();
  }
```

`src/render/views/structure-views.js` — add the same method to `StructureViews` (after `sync`):

```js
  /** Frees the instanced meshes; the shared model geometry and materials stay for the next battle. */
  dispose() {
    for (const m of this.models.values()) m.dispose();
    this.models.clear();
    this.views.clear();
  }
```

`src/render/views/missile-views.js` — add to `MissileViews` (after `sync`):

```js
  dispose() {
    this.model?.dispose();
    this.model = null;
    this.handles.clear();
  }
```

`src/render/terrain.js` — add to `TerrainView` (after `setShroud`):

```js
  /** Takes the ground off the scene and frees its geometry, materials and textures. */
  dispose() {
    this.group.removeFromParent();
    for (const mesh of [this.mesh, this.apron]) { mesh.geometry.dispose(); mesh.material.dispose(); }
    for (const t of [this.spiceTex, this.concreteTex, this.shroudTex, this.uniforms.uRockTex.value, this.decals.texture]) t?.dispose();
  }
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `node --test tests/effects.test.mjs tests/views.test.mjs`
Expected: all PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm test 2>&1 | tail -8`
Expected: `# fail 0`.

- [ ] **Step 6: Commit**

```bash
G add src/render/effects.js src/render/terrain.js src/render/views/unit-views.js src/render/views/structure-views.js src/render/views/missile-views.js tests/effects.test.mjs tests/views.test.mjs
G -c user.name="Hassan Ilyas" -c user.email="hassan.ilyas0@gmail.com" commit -m "feat(render): views, effects and terrain can be disposed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Renderer3D renders any scene through its composer

**Files:**
- Modify: `src/render/renderer.js`

- [ ] **Step 1: Keep the RenderPass and take a scene and camera**

In the constructor replace

```js
    this.composer.addPass(new RenderPass(this.scene, this.camera));
```

with

```js
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
```

and replace

```js
  render() { if (!this.lost) this.composer.render(); }
```

with

```js
  /** Draws `scene` through `camera` (the battlefield by default) with the whole post-processing chain. */
  render(scene = this.scene, camera = this.camera) {
    if (this.lost) return;
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.composer.render();
  }
```

- [ ] **Step 2: Check nothing else broke**

Run: `npm test 2>&1 | tail -4`
Expected: `# fail 0`. (The renderer has no Node test; Task 3's smoke run covers it.)

- [ ] **Step 3: Commit**

```bash
G add src/render/renderer.js
G -c user.name="Hassan Ilyas" -c user.email="hassan.ilyas0@gmail.com" commit -m "feat(render): the renderer draws any scene and camera through its composer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Extract BattleStage from GameView (no behaviour change)

**Files:**
- Create: `src/game/battle-stage.js`
- Modify: `src/game/game-view.js`

- [ ] **Step 1: Create `src/game/battle-stage.js`**

The methods below are moved verbatim from `GameView`, with `this.house` → `this.viewer` and camera shake going through `onShake`.

```js
// Everything between a World and the picture that is not input or HUD (menu backdrop spec): terrain,
// unit, structure and missile views, particle effects, tracks and dust, and the sound cues of
// simulation events. The game view and the main menu's battle both draw through one. All of its
// scene objects hang under `root`, so dispose() can take a finished battle off the GPU.
import * as THREE from 'three';
import { terrainSubFor } from '../render/quality.js';
import { Heightfield } from '../render/heightfield.js';
import { TerrainView } from '../render/terrain.js';
import { UnitViews } from '../render/views/unit-views.js';
import { StructureViews } from '../render/views/structure-views.js';
import { ShroudSync } from '../render/shroud.js';
import { Effects } from '../render/effects.js';
import { MissileViews, arcHeight } from '../render/views/missile-views.js';
import { nearCamera } from '../render/near-camera.js';
import { cueFor } from '../audio/cues.js';
import { isVisible } from '../sim/fog.js';
import { UNITS, onFoot } from '../data/units.js';
import { G } from '../data/terrain.js';

export class BattleStage {
  /**
   * world: the simulation. scene: where `root` goes. quality: the renderer's preset. viewer: the house
   * whose fog decides what shows (null: everything). sound: a SoundEngine, or null for silence.
   * rig: the CameraRig (dust and tracks only near what it looks at). onShake(amount): big blasts.
   */
  constructor({ world, scene, quality, viewer = null, sound = null, rig, onShake = () => {} }) {
    Object.assign(this, { world, scene, viewer, sound, rig, onShake });
    this.root = new THREE.Group();
    scene.add(this.root);
    const hf = (this.hf = new Heightfield(world.map, { sub: terrainSubFor(world.map.w, quality), seed: world.map.seed }));
    this.heightAt = (x, z) => hf.heightAt(x, z);
    this.terrain = new TerrainView(world.map, hf);
    this.root.add(this.terrain.group);
    this.unitViews = new UnitViews(this.root, hf, { viewer });
    this.structureViews = new StructureViews(this.root, hf, { viewer });
    this.shroud = new ShroudSync(world.map.w * world.map.h);
    this.effects = new Effects(this.root, quality);
    this.missiles = new MissileViews(this.root);
    this.smokeClock = 0;
    this.dustClock = 0;
    this.weldClock = 0;
    this.trackFrom = new Map();
    this.catchingUp = true;   // events simulated ahead: marks yes, fireworks no — the owner clears it after the first drain
  }

  /** One simulation event: its sound, its effect, and what it changes on the ground. */
  onEvent(e) {
    if (!this.catchingUp && this.sound) {
      const cue = cueFor(e, this.viewer, (x, z) => this.seen(x, z));
      if (cue) this.sound.play(cue.id, { x: cue.x ?? null, z: cue.z ?? null, rate: 0.94 + Math.random() * 0.12 });
    }
    if (e.type === 'unitBuilt') this.structureViews.notify(e, performance.now());
    if (e.type === 'structurePlaced') {
      const s = this.world.structures.get(e.id);
      if (s) this.terrain.flattenFootprint(s.x, s.y, s.w, s.h);
      if (s && !this.catchingUp && this.seen(s.x + s.w / 2, s.y + s.h / 2)) this.constructionDust(s);
    }
    switch (e.type) {
      case 'fired': if (!this.catchingUp) this.onFired(e); break;
      case 'impact': if (!this.catchingUp && this.seen(e.x, e.y)) this.effects.impact(e.x, this.heightAt(e.x, e.y) + 0.12 + (e.alt ?? 0), e.y, e.projectile, e.hit); break;
      case 'explosion':
        if (!this.seen(e.x, e.y)) break;
        if (!this.catchingUp) this.effects.explosion(e.x, this.heightAt(e.x, e.y) + 0.25 + (e.alt ?? 0), e.y, e.size);
        if (!e.alt) this.terrain.decals?.scorch(e.x, e.y, e.size === 'large' ? 1.8 : e.size === 'medium' ? 1 : 0.6);
        break;
      case 'deathHandBlast':
        if (!this.catchingUp && this.seen(e.x, e.y)) { this.effects.shockwave(e.x, this.heightAt(e.x, e.y) + 0.2, e.y); this.onShake(1.2); }
        break;
      case 'fremenRose': if (!this.catchingUp && this.seen(e.x, e.y)) this.effects.rise(e.x, this.heightAt(e.x, e.y) + 0.05, e.y); break;
      case 'unitReverted': if (!this.catchingUp && this.seen(e.x, e.y)) this.effects.gasCloud(e.x, this.heightAt(e.x, e.y) + 0.3, e.y); break;
      case 'unitDestroyed':
        if (!this.catchingUp && e.cause === 'destructed' && this.seen(e.x, e.y)) this.onShake(0.6);
        if (!this.catchingUp && onFoot(UNITS[e.typeId]?.move) && this.seen(e.x, e.y)) this.effects.smokePuff(e.x, this.heightAt(e.x, e.y) + 0.1, e.y);
        break;
    }
  }

  /** Effects only show where the viewer can see (fog off, or no viewer: everywhere). */
  seen(x, z) {
    const w = this.world;
    if (!w.fogOfWar || !this.viewer) return true;
    const tx = Math.floor(x), ty = Math.floor(z);
    return w.map.inBounds(tx, ty) && isVisible(w, this.viewer, tx, ty);
  }

  onFired(e) {
    if (!this.seen(e.x, e.y)) return;
    const dir = Math.atan2(e.ty - e.y, e.tx - e.x);
    const big = e.projectile !== 'bullet';
    let x = e.x, z = e.y, lift = 0.45;
    if (e.kind === 'unit') {
      const u = this.world.units.get(e.id);
      if (u) { const p = this.unitViews.renderPos(u); x = p.x; z = p.z; lift = u.alt ?? (onFoot(u.move) ? 0.2 : 0.34); }
      this.unitViews.recoil(e.id);
    }
    const reach = e.kind === 'unit' ? 0.38 : 0.45;
    x += Math.cos(dir) * reach;
    z += Math.sin(dir) * reach;
    if (e.projectile === 'sonic') this.effects.sonic(x, this.heightAt(x, z) + lift, z, dir);
    else this.effects.muzzle(x, this.heightAt(x, z) + lift, z, big);
  }

  /** The per-frame view update: fog shroud, views, shots in flight, dust and tracks, particles, ground. */
  sync(alpha, dt, now) {
    const world = this.world;
    if (world.fogOfWar && this.shroud.update(world.houses.get(this.viewer)?.fog)) this.terrain.setShroud(this.shroud.explored, this.shroud.visible);
    this.unitViews.sync(world, alpha, dt);
    this.structureViews.sync(world, now);
    this.combatEffects(dt, alpha);
    this.missiles.sync(world, alpha, this.heightAt, (x, z) => this.seen(x, z));
    this.ambient(dt);
    this.effects.update(dt);
    this.terrain.update(now);
  }

  /** Trails for shots in flight (interpolated between ticks; rockets arc) and smoke from the wounded. */
  combatEffects(dt, alpha) {
    const w = this.world;
    for (const p of w.projectiles.values()) {
      const x = p.px + (p.x - p.px) * alpha, z = p.py + (p.y - p.py) * alpha;
      if (!this.seen(x, z)) continue;
      const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1;
      const t = Math.min(1, Math.hypot(x - p.sx, z - p.sy) / total);
      const from = 0.35 + (p.fromAlt ?? 0), to = 0.2 + (p.toAlt ?? 0);   // from a flying gun, up to an aircraft
      const y = this.heightAt(x, z) + from + (to - from) * t + arcHeight(p.projectile, t, total);
      if (p.projectile === 'sonic') this.effects.sonic(x, y, z, Math.atan2(p.ty - p.sy, p.tx - p.sx));
      else this.effects.trail(p.projectile, x, y, z);
    }
    this.smokeClock += dt;
    if (this.smokeClock < 0.12) return;
    this.smokeClock = 0;
    for (const u of w.units.values()) {
      if (onFoot(u.move) || u.inside || u.hp > u.maxHp / 2 || !this.seen(u.x, u.y) || Math.random() > 0.6) continue;
      const p = this.unitViews.renderPos(u);
      this.effects.smokePuff(p.x, this.heightAt(p.x, p.z) + 0.35 + (u.alt ?? 0), p.z);
    }
    for (const s of w.structures.values()) {
      if (s.hp > s.maxHp / 2 || s.type.isWall || !this.seen(s.x + s.w / 2, s.y + s.h / 2)) continue;
      const x = s.x + Math.random() * s.w, z = s.y + Math.random() * s.h;
      const y = this.heightAt(x, z) + 0.5;
      this.effects.smokePuff(x, y, z);
      if (s.hp < s.maxHp / 4 || Math.random() < 0.5) this.effects.flame(x, y - 0.1, z);
    }
  }

  /** Dust behind vehicles on sand, tread marks and harvest dust (spec §5.4). */
  ambient(dt) {
    const w = this.world, map = w.map, rig = this.rig;
    this.dustClock += dt;
    const puff = this.dustClock >= 0.09;
    if (puff) this.dustClock = 0;
    for (const u of w.units.values()) {
      if (onFoot(u.move)) continue;
      const i = map.idx(u.tx, u.ty);
      const soft = (map.ground[i] === G.SAND || map.ground[i] === G.DUNE) && !map.concrete[i];
      const p = this.unitViews.renderPos(u);
      if (!nearCamera(p.x, p.z, rig.target.x, rig.target.z, rig.distance)) continue;
      const visible = this.seen(p.x, p.z);
      if (u.step && soft) {
        const last = this.trackFrom.get(u.id);
        if (!last || Math.hypot(p.x - last.x, p.z - last.z) > 0.3) {
          if (last && visible) this.terrain.decals?.track(p.x, p.z, u.heading, u.move === 'wheeled' ? 0.2 : 0.28, u.move === 'wheeled' ? 0.035 : 0.05);
          this.trackFrom.set(u.id, { x: p.x, z: p.z });
        }
        if (puff && visible) this.effects.dust(p.x - Math.cos(u.heading) * 0.35, this.heightAt(p.x, p.z) + 0.08, p.z - Math.sin(u.heading) * 0.35, u.move === 'wheeled' ? 0.9 : 0.7);
      } else if (!u.step) this.trackFrom.delete(u.id);
      if (puff && visible && u.harvest?.state === 'harvesting') {
        this.effects.dust(p.x + Math.cos(u.heading) * 0.45, this.heightAt(p.x, p.z) + 0.1, p.z + Math.sin(u.heading) * 0.45, 1.2);
      }
    }
    for (const id of this.trackFrom.keys()) if (!w.units.has(id)) this.trackFrom.delete(id);
    this.weldClock += dt;
    if (this.weldClock >= 0.12) {   // welding sparks over occupied repair pads the viewer can see
      this.weldClock = 0;
      for (const s of w.structures.values()) {
        if (!s.bay || !nearCamera(s.x + s.w / 2, s.y + s.h / 2, rig.target.x, rig.target.z, rig.distance) || !this.seen(s.x + s.w / 2, s.y + s.h / 2)) continue;
        const p = this.structureViews.weldPoint(s.id, performance.now());
        if (p) this.effects.weld(p.x, p.y, p.z);
      }
    }
  }

  constructionDust(s) {
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      const x = s.x + s.w / 2 + Math.cos(a) * s.w * 0.55, z = s.y + s.h / 2 + Math.sin(a) * s.h * 0.55;
      this.effects.dust(x, this.heightAt(x, z) + 0.05, z, 1.4);
    }
  }

  /** Takes the whole battle off the scene and frees what it alone owns. */
  dispose() {
    this.scene.remove(this.root);
    this.unitViews.dispose();
    this.structureViews.dispose();
    this.missiles.dispose();
    this.effects.dispose();
    this.terrain.dispose();
  }
}
```

- [ ] **Step 2: Rewire `src/game/game-view.js`**

1. Header comment: replace the first two lines with

```js
// Everything between the simulation and the screen (spec §3): renderer, the BattleStage (terrain, views,
// effects, event effects), RTS camera, input, overlay, HUD and the frame loop. Scenes build a World and hand it over.
```

2. Imports: delete the imports of `terrainSubFor`, `Heightfield`, `TerrainView`, `UnitViews`, `StructureViews`, `ShroudSync`, `Effects`, `MissileViews`/`arcHeight`, `cueFor`, `UNITS`/`onFoot`, `G`, `nearCamera`; change `import { unitVisibleTo, structureVisibleTo, isVisible } from '../sim/fog.js';` to `import { unitVisibleTo, structureVisibleTo } from '../sim/fog.js';`; add `import { BattleStage } from './battle-stage.js';` after the `createDebugApi` import.

3. Constructor: replace the block from `const hf = (this.hf = new Heightfield(` through `this.rig.lookAt(focus.x, focus.z, true);` with

```js
    this.rig = new CameraRig(r3d.camera, world.map.w, world.map.h);
    const dist = params.num('dist');
    if (dist) this.rig.goalDistance = this.rig.distance = dist;
    this.rig.lookAt(focus.x, focus.z, true);
    this.sound = new SoundEngine({ enabled: settings.sound, volume: settings.volume });
    this.stage = new BattleStage({
      world, scene: r3d.scene, quality: r3d.quality, viewer: house, sound: this.sound, rig: this.rig,
      onShake: (amount) => { this.rig.shake = Math.max(this.rig.shake, amount); },
    });
    const hf = (this.hf = this.stage.hf);
    this.heightAt = this.stage.heightAt;
    this.ghost = new PlacementGhost(r3d.scene, hf);
```

   then delete the later line `this.sound = new SoundEngine({ enabled: settings.sound, volume: settings.volume });` (it sits after `this.hud = new Hud(...)`), and change `this.positionOf = (u) => this.unitViews.renderPos(u);` to `this.positionOf = (u) => this.stage.unitViews.renderPos(u);`.

4. Replace `handleEvents()` and `onEvent(e)` with

```js
  handleEvents() {
    for (const e of this.world.events.drain()) this.onEvent(e);
    this.stage.catchingUp = false;
  }

  onEvent(e) {
    this.stage.onEvent(e);
    if (e.type === 'eva' && e.house === this.house) this.hud.message(e.text);
    else if (e.type === 'deployed' && e.house === this.house) this.hud.message('Construction Yard deployed.');
    else if (e.type === 'sold' && e.house === this.house) this.hud.message('Structure sold.');
    if (e.type === 'gameOver') this.endAt = performance.now() + 2500;
  }
```

5. Delete the methods `seen`, `onFired`, `combatEffects`, `ambient` and `constructionDust` from `GameView` (they now live in `BattleStage`).

6. In `frame(now)`: delete the line

```js
    if (world.fogOfWar && this.shroud.update(world.houses.get(this.house)?.fog)) this.terrain.setShroud(this.shroud.explored, this.shroud.visible);
```

   and replace the seven lines

```js
    this.unitViews.sync(world, alpha, dt);
    this.structureViews.sync(world, now);
    this.combatEffects(dt, alpha);
    this.missiles.sync(world, alpha, this.heightAt, (x, z) => this.seen(x, z));
    this.ambient(dt);
    this.effects.update(dt);
    this.terrain.update(now);
```

   with

```js
    this.stage.sync(alpha, dt, now);
```

- [ ] **Step 3: Check no stale references are left**

Run: `grep -nE "\b(UNITS|onFoot|nearCamera|isVisible|cueFor|arcHeight|Heightfield|TerrainView)\b|this\.(terrain|unitViews|structureViews|effects|missiles|shroud|catchingUp|trackFrom|seen)\b|G\." src/game/game-view.js`
Expected: no output.

- [ ] **Step 4: Unit tests**

Run: `npm test 2>&1 | tail -8`
Expected: `# fail 0` (475+ tests).

- [ ] **Step 5: Game end-to-end and smoke (real Chrome)**

Run: `E2E_PORT=8572 npm run e2e 2>&1 | tail -15`
Expected: every line `ok`, ending with the all-passed line.

Run: `E2E_MENU_PORT=8573 npm run e2e:menu 2>&1 | tail -8`
Expected: `all menu and control checks passed`.

Run: `SMOKE_PORT=8571 node scripts/smoke.mjs battle-fight battle-specials skirmish-atreides base-palace base-ordos-fog 2>&1 | tail -6`
Expected: `wrote screenshots/<name>.png` for each of the five, no FAIL. Open `screenshots/battle-fight.png` and `screenshots/base-ordos-fog.png` with the Read tool: units, tracers, explosions and the fog shroud draw as before.

- [ ] **Step 6: Commit**

```bash
G add src/game/battle-stage.js src/game/game-view.js
G -c user.name="Hassan Ilyas" -c user.email="hassan.ilyas0@gmail.com" commit -m "refactor(game): views, effects and event effects move into a BattleStage

The game view keeps input, HUD, menus and the loop; the main menu's battle will draw
through the same stage.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Cinematic camera math

**Files:**
- Create: `src/game/showcase-camera.js`
- Test: `tests/showcase-camera.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { battleCamera, riseCamera, CUT_EVERY, DESCENT } from '../src/game/showcase-camera.js';

const f = { x: 30, z: 20 };
const angle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

test('the battle opens high above and settles into a low orbit around the focus', () => {
  const a = battleCamera(0, f), b = battleCamera(DESCENT, f);
  assert.ok(a.distance > 80 && a.pitch > b.pitch);
  assert.ok(b.distance > 20 && b.distance < 32);
  assert.deepEqual([b.x, b.z], [30, 20]);
});

test('a cut to a new angle every CUT_EVERY seconds, a slow orbit in between', () => {
  const before = battleCamera(CUT_EVERY - 0.01, f), after = battleCamera(CUT_EVERY + 0.01, f);
  assert.equal(before.shot + 1, after.shot);
  assert.ok(angle(after.yaw, before.yaw) > 0.5);
  const s = battleCamera(CUT_EVERY + 1, f), t = battleCamera(CUT_EVERY + 5, f);
  assert.ok(t.yaw > s.yaw && t.yaw - s.yaw < 0.5);
});

test('reduced motion holds one wide shot', () => {
  const a = battleCamera(0, f, { reduced: true }), b = battleCamera(30, f, { reduced: true });
  assert.deepEqual(a, b);
  assert.ok(a.distance > 30);
});

test('the rise climbs and tilts down from the last battle shot', () => {
  const from = battleCamera(40, f);
  assert.equal(riseCamera(0, from).distance, from.distance);
  const top = riseCamera(1, from);
  assert.ok(top.distance > from.distance + 40 && top.pitch > from.pitch);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/showcase-camera.test.mjs`
Expected: FAIL, `Cannot find module '../src/game/showcase-camera.js'`.

- [ ] **Step 3: Implement `src/game/showcase-camera.js`**

```js
// Cinematic camera for the main menu battle (menu backdrop spec): a descent from high above, a slow
// orbit around the fighting and a cut to a new angle every CUT_EVERY seconds; one still wide shot
// when the viewer asks for reduced motion. Pure math: the backdrop hands the result to a CameraRig.
const deg = (d) => (d * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const easeOutCubic = (t) => 1 - (1 - clamp01(t)) ** 3;
export const easeInCubic = (t) => clamp01(t) ** 3;

export const CUT_EVERY = 12;   // seconds between cuts to a new angle
export const DESCENT = 6;      // seconds of the opening descent
const ORBIT_RATE = 0.045;      // radians per second around the focus
const HIGH = { distance: 95, pitch: deg(72) };
const SHOT = { distance: 26, pitch: deg(31) };
const WIDE = { distance: 40, pitch: deg(40) };

/** The yaw a shot starts from: spread round the compass by the golden ratio, new for every shot and battle. */
export function shotYaw(seed, shot) {
  return (((seed * 0.6180339887 + shot * 0.3819660113) % 1) + 1) % 1 * Math.PI * 2;
}

/** Camera for second `t` of the battle phase, looking at `focus` ({ x, z }). */
export function battleCamera(t, focus, { reduced = false, seed = 0 } = {}) {
  if (reduced) return { x: focus.x, z: focus.z, distance: WIDE.distance, pitch: WIDE.pitch, yaw: shotYaw(seed, 0), shot: 0 };
  const shot = Math.max(0, Math.floor(t / CUT_EVERY));
  const ts = t - shot * CUT_EVERY;
  let distance = SHOT.distance + Math.sin(ts * 0.35) * 2.5, pitch = SHOT.pitch;   // a gentle push in and out
  if (shot === 0 && t < DESCENT) {
    const e = easeOutCubic(t / DESCENT);
    distance = lerp(HIGH.distance, distance, e);
    pitch = lerp(HIGH.pitch, pitch, e);
  }
  return { x: focus.x, z: focus.z, distance, pitch, yaw: shotYaw(seed, shot) + ts * ORBIT_RATE, shot };
}

/** The climb away at the end of a battle, k 0..1 through the rise, from the last battle shot. */
export function riseCamera(k, from) {
  const e = easeInCubic(k);
  return { ...from, distance: lerp(from.distance, from.distance + 60, e), pitch: lerp(from.pitch, deg(75), e) };
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `node --test tests/showcase-camera.test.mjs`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
G add src/game/showcase-camera.js tests/showcase-camera.test.mjs
G -c user.name="Hassan Ilyas" -c user.email="hassan.ilyas0@gmail.com" commit -m "feat(menu): cinematic camera for the menu battle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Backdrop timeline (phases, fade, caption, sound level)

**Files:**
- Create: `src/game/backdrop-timeline.js`
- Test: `tests/backdrop-timeline.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { BackdropClock, DURATIONS, HOLD_AT, fadeAt, captionAt, soundLevelAt } from '../src/game/backdrop-timeline.js';
import { CUT_EVERY } from '../src/game/showcase-camera.js';

const runFor = (clock, seconds, ready = true) => {
  const entered = [];
  for (let t = 0; t < seconds; t += 0.05) { const p = clock.advance(0.05, ready); if (p) entered.push(p); }
  return entered;
};
const total = DURATIONS.planet + DURATIONS.dive + DURATIONS.battle + DURATIONS.rise;

test('the loop runs planet → dive → battle → rise → planet', () => {
  const c = new BackdropClock();
  assert.equal(c.phase, 'planet');
  assert.deepEqual(runFor(c, total + 0.5), ['dive', 'battle', 'rise', 'planet']);
  assert.equal(c.cycle, 1);
});

test('the planet keeps turning until the next battle is ready', () => {
  const c = new BackdropClock();
  assert.deepEqual(runFor(c, DURATIONS.planet + 5, false), []);
  assert.deepEqual(runFor(c, 0.1, true), ['dive']);
});

test('a held phase stays put, starting past its opening fades; unknown holds are ignored', () => {
  const p = new BackdropClock({ hold: 'planet' }), b = new BackdropClock({ hold: 'battle' });
  assert.equal(b.t, HOLD_AT.battle);
  runFor(p, 100);
  runFor(b, 100);
  assert.deepEqual([p.phase, b.phase], ['planet', 'battle']);
  assert.equal(new BackdropClock({ hold: 'nonsense' }).hold, null);
});

test('restart goes back to the planet', () => {
  const c = new BackdropClock();
  runFor(c, DURATIONS.planet + 1);
  c.restart();
  assert.deepEqual([c.phase, c.t], ['planet', 0]);
});

test('the fade: in from black, into haze at the end of the dive, out of it on the battle, dips at cuts, to black on the rise', () => {
  assert.equal(fadeAt('planet', 0).opacity, 1);
  assert.equal(fadeAt('planet', 1).opacity, 0);
  assert.equal(fadeAt('dive', 1).opacity, 0);
  assert.deepEqual(fadeAt('dive', DURATIONS.dive), { color: 'haze', opacity: 1 });
  assert.equal(fadeAt('battle', 0).opacity, 1);
  assert.equal(fadeAt('battle', 3).opacity, 0);
  assert.equal(fadeAt('battle', CUT_EVERY).opacity, 1);
  assert.equal(fadeAt('battle', CUT_EVERY + 1).opacity, 0);
  assert.deepEqual(fadeAt('rise', DURATIONS.rise), { color: 'black', opacity: 1 });
});

test('reduced motion: plain crossfades and no dips at cuts', () => {
  assert.ok(fadeAt('dive', 1, { reduced: true }).opacity > 0.2);
  assert.equal(fadeAt('battle', CUT_EVERY, { reduced: true }).opacity, 0);
});

test('the caption shows on the planet only, once it has faded in and until the dive', () => {
  assert.equal(captionAt('planet', 0.5), 0);
  assert.equal(captionAt('planet', 5), 1);
  assert.equal(captionAt('planet', DURATIONS.planet), 0);
  assert.equal(captionAt('battle', 5), 0);
});

test('battle sound: silent in space, in as the battle appears, out on the rise', () => {
  assert.equal(soundLevelAt('planet', 5), 0);
  assert.equal(soundLevelAt('dive', 2), 0);
  assert.equal(soundLevelAt('battle', 0), 0);
  assert.equal(soundLevelAt('battle', 10), 1);
  assert.equal(soundLevelAt('rise', DURATIONS.rise), 0);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/backdrop-timeline.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/game/backdrop-timeline.js`**

```js
// The main menu backdrop's loop (menu backdrop spec): planet → dive → battle → rise, and what the fade
// layer, the caption and the battle sound do at each moment. Pure functions of the phase and its clock.
import { CUT_EVERY } from './showcase-camera.js';

export const DURATIONS = { planet: 10, dive: 3, battle: 45, rise: 2 };
const NEXT = { planet: 'dive', dive: 'battle', battle: 'rise', rise: 'planet' };
/** Where a held phase (?backdrop=planet|battle, for screenshots) starts: past its opening fades. */
export const HOLD_AT = { planet: 3, battle: 6.5 };
/** The haze between space and the battle: the renderer's fog colour. */
export const HAZE = '#d9b98a';

const ramp = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

export class BackdropClock {
  constructor({ durations = DURATIONS, hold = null } = {}) {
    this.durations = durations;
    this.hold = Object.hasOwn(HOLD_AT, hold ?? '') ? hold : null;
    this.cycle = 0;
    this.restart();
  }

  get k() { return Math.min(1, this.t / this.durations[this.phase]); }

  /** Moves on by dt seconds; the planet waits for the next battle to be ready. Returns the phase entered, or null. */
  advance(dt, battleReady = true) {
    this.t += dt;
    if (this.phase === this.hold || this.t < this.durations[this.phase]) return null;
    if (this.phase === 'planet' && !battleReady) return null;
    return this.skip();
  }

  /** Straight on to the next phase. */
  skip() {
    this.phase = NEXT[this.phase];
    this.t = 0;
    if (this.phase === 'planet') this.cycle++;
    return this.phase;
  }

  /** Back to the start of the loop (or of the held phase). */
  restart() {
    this.phase = this.hold ?? 'planet';
    this.t = this.hold ? HOLD_AT[this.hold] : 0;
  }
}

/** The layer over the 3D picture: { color: 'black' | 'haze', opacity }. */
export function fadeAt(phase, t, { durations = DURATIONS, reduced = false } = {}) {
  const d = durations[phase];
  if (phase === 'planet') return { color: 'black', opacity: 1 - ramp(t, 0, 0.8) };
  if (phase === 'dive') return { color: 'haze', opacity: reduced ? ramp(t, 0, d) : ramp(t, d - 0.8, d) };
  if (phase === 'battle') {
    let opacity = 1 - ramp(t, 0, reduced ? 1.5 : 1);
    if (!reduced) for (let c = CUT_EVERY; c < d; c += CUT_EVERY) opacity = Math.max(opacity, ramp(t, c - 0.3, c) * (1 - ramp(t, c, c + 0.45)));
    return { color: 'haze', opacity };
  }
  return { color: 'black', opacity: ramp(t, 0, d) };   // rise
}

/** The caption's opacity: in after 1.5 s of the planet, out before the dive. */
export function captionAt(phase, t, { durations = DURATIONS } = {}) {
  if (phase !== 'planet') return 0;
  const d = durations.planet;
  return ramp(t, 1.5, 2.5) * (1 - ramp(t, d - 1.6, d - 0.8));
}

/** Battle sound 0..1: silent in space, in over the battle's first two seconds, out on the rise. */
export function soundLevelAt(phase, t, { durations = DURATIONS } = {}) {
  if (phase === 'battle') return ramp(t, 0, 2);
  if (phase === 'rise') return 1 - ramp(t, 0, durations.rise);
  return 0;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `node --test tests/backdrop-timeline.test.mjs`
Expected: 8 PASS.

- [ ] **Step 5: Commit**

```bash
G add src/game/backdrop-timeline.js tests/backdrop-timeline.test.mjs
G -c user.name="Hassan Ilyas" -c user.email="hassan.ilyas0@gmail.com" commit -m "feat(menu): backdrop timeline — phases, fades, caption and sound level

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: ShowcaseDirector — map, bases and armies

**Files:**
- Create: `src/game/showcase-director.js`
- Test: `tests/showcase-director.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ShowcaseDirector, SHOWCASE, PLAYABLE } from '../src/game/showcase-director.js';
import { G } from '../src/data/terrain.js';

const fighters = (d, s) => [...d.world.units.values()].filter((u) => u.house === d.houses[s] && u.isGround && u.type.weapon);
const EXTRA = { sonic: 2, deviator: 1, devastator: 1 };

test('two different houses on a 64×40 map: rock at both ends, no peaks in the middle lane', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const d = new ShowcaseDirector({ seed });
    assert.equal(new Set(d.houses).size, 2);
    for (const h of d.houses) assert.ok(PLAYABLE.includes(h));
    const m = d.world.map;
    assert.deepEqual([m.w, m.h], [SHOWCASE.w, SHOWCASE.h]);
    for (let y = 0; y < m.h; y++) {
      assert.equal(m.ground[m.idx(3, y)], G.ROCK);
      assert.equal(m.ground[m.idx(m.w - 4, y)], G.ROCK);
    }
    for (let x = 12; x < m.w - 12; x++) for (let y = 12; y <= 28; y++) assert.notEqual(m.ground[m.idx(x, y)], G.MOUNTAIN, `peak at ${x},${y} (seed ${seed})`);
  }
});

test('each side starts with 10–14 fighters on their own tiles, and its base behind them', () => {
  for (const seed of [2, 7, 13]) {
    const d = new ShowcaseDirector({ seed });
    for (const s of [0, 1]) {
      const n = fighters(d, s).length - (s === d.specialSide ? EXTRA[d.special] ?? 0 : 0);
      assert.ok(n >= 10 && n <= 14, `seed ${seed} side ${s}: ${n}`);
      const types = [...d.world.structures.values()].filter((b) => b.house === d.houses[s]).map((b) => b.typeId);
      assert.ok(types.includes('constructionYard') && types.includes('windtrap'));
      assert.equal(types.filter((t) => t === 'wall').length, 4);
    }
    for (const u of d.world.units.values()) assert.equal(d.world.map.unit[d.world.map.idx(u.tx, u.ty)], u.id);
  }
});

test('the armies meet within the lead time', () => {
  for (const seed of [3, 8]) {
    const d = new ShowcaseDirector({ seed });
    let shots = 0;
    d.run(SHOWCASE.lead, (e) => { if (e.type === 'fired') shots++; });
    assert.ok(shots > 0, `seed ${seed}: no shots in ${SHOWCASE.lead} s`);
  }
});

test('the same seed plays the same battle', () => {
  const a = new ShowcaseDirector({ seed: 42 }), b = new ShowcaseDirector({ seed: 42 });
  a.run(15);
  b.run(15);
  assert.deepEqual(a.houses, b.houses);
  assert.equal(a.special, b.special);
  const units = (d) => [...d.world.units.values()].map((u) => [u.typeId, u.tx, u.ty, u.hp]);
  assert.deepEqual(units(a), units(b));
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/showcase-director.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/game/showcase-director.js` (all of it; Tasks 7–8 add tests only)**

```js
// The battle behind the main menu (menu backdrop spec): a fresh 64 × 40 map, two random houses with
// armies, scenery at their backs, reinforcements whenever a side runs low, one house special per loop
// and a hotspot where the shooting is, for the camera. Simulation only: it runs under Node, and the
// menu draws it through a BattleStage.
import { Rng } from '../core/rng.js';
import { GameMap } from '../sim/map.js';
import { World } from '../sim/world.js';
import { G } from '../data/terrain.js';
import { UNITS, MOVE } from '../data/units.js';
import { STRUCTURES } from '../data/structures.js';
import { DT } from '../data/tuning.js';
import { palaceOf } from '../sim/palace.js';

export const SHOWCASE = {
  w: 64, h: 40,
  lead: 8,                  // seconds simulated before the battle is shown
  army: [10, 14],           // fighters per side at the start
  reinforceEvery: 8,        // seconds between reinforcement checks …
  reinforceBelow: 10,       // … for a side with fewer fighters than this …
  reinforceCount: [3, 4],   // … which gets this many more
  reorderEvery: 4,          // idle fighters are sent at the enemy this often (seconds)
  hotspotWindow: 3,         // seconds of shooting the hotspot averages …
  hotspotLag: 2,            // … and the seconds it takes to follow
};
export const PLAYABLE = ['atreides', 'harkonnen', 'ordos'];
/** The army mix, [unit type, weight]; each house draws from what it can build. */
const ARMY = [['combatTank', 4], ['quad', 2], ['trike', 2], ['raider', 2], ['infantry', 2], ['troopers', 2], ['missileTank', 1], ['siegeTank', 1]];
/** What each house can bring as the loop's special. */
const SPECIALS = { atreides: ['sonic', 'ornithopters'], harkonnen: ['devastator', 'deathHand'], ordos: ['deviator', 'ornithopters'] };
// The west side's layout; the east side mirrors it.
const BASE = [['constructionYard', 2, 18], ['windtrap', 2, 14], ['turret', 9, 19], ['wall', 9, 17], ['wall', 9, 18], ['wall', 9, 20], ['wall', 9, 21]];
const PALACE_AT = [2, 23];
const ARMY_BOX = { x: 14, w: 7, y: 12, h: 17 };   // where the west army stands at the start
const ARRIVE_X = 12;                               // reinforcements appear in this column
const HOME = { x: 3, y: 19 };                      // the heart of the west base

const W = SHOWCASE.w, H = SHOWCASE.h;
/** Column `x` of the west layout (for a thing `w` tiles wide) on side `s` (0 west, 1 east). */
const mirror = (s, x, w = 1) => (s === 0 ? x : W - x - w);

/** Smooth noise 0..1: a random grid every `cell` tiles, eased between the knots. */
function grid(rng, cell) {
  const cols = Math.ceil(W / cell) + 2, rows = Math.ceil(H / cell) + 2;
  const v = Array.from({ length: cols * rows }, () => rng.next());
  const ease = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / cell, gy = y / cell, ix = Math.floor(gx), iy = Math.floor(gy), fx = ease(gx - ix), fy = ease(gy - iy);
    const at = (i, j) => v[j * cols + i];
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx;
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
    return a + (b - a) * fy;
  };
}

/** Rock plateaus for the two bases, sand and dunes between with a few outcrops, peaks only off the middle lane, two spice fields. */
export function showcaseMap(rng) {
  const map = new GameMap(W, H);
  const wobble = grid(rng, 6), dunes = grid(rng, 5), rocks = grid(rng, 7);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = 11 + Math.round(wobble(x, y) * 2);
    const r = rocks(x, y);
    let g = G.SAND;
    if (x <= edge || x >= W - 1 - edge) g = G.ROCK;
    else if (r > 0.72) g = (y < 8 || y > H - 9) && r > 0.82 ? G.MOUNTAIN : G.ROCK;
    else if (dunes(x, y) > 0.58) g = G.DUNE;
    map.ground[map.idx(x, y)] = g;
  }
  for (const cy of [5, H - 6]) {
    const cx = 22 + rng.int(21);
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 4; x <= cx + 4; x++) {
      if (!map.inBounds(x, y) || Math.hypot((x - cx) / 4, (y - cy) / 3) > 1) continue;
      const i = map.idx(x, y);
      if (map.ground[i] === G.SAND || map.ground[i] === G.DUNE) map.setSpice(i, 250 + rng.int(400));
    }
  }
  return map;
}

export class ShowcaseDirector {
  constructor({ seed = 1 } = {}) {
    this.seed = seed;
    const rng = (this.rng = new Rng(seed));
    this.houses = rng.shuffle([...PLAYABLE]).slice(0, 2);   // [west, east]
    const map = showcaseMap(rng);
    map.seed = seed;
    const world = (this.world = new World({ map, seed }));
    world.fogOfWar = false;
    for (const h of this.houses) world.addHouse(h, { credits: 0 });
    this.special = rng.pick([...new Set(this.houses.flatMap((h) => SPECIALS[h]))]);
    this.specialSide = this.houses.findIndex((h) => SPECIALS[h].includes(this.special));
    this.specialSeen = false;
    this.pending = null;            // the special's timed step: { at, when?, run }
    this.center = { x: W / 2, z: H / 2 };
    this.hotspot = { ...this.center };
    this.shots = [];
    this.reinforced = 0;
    this.nextReinforce = SHOWCASE.reinforceEvery;
    this.nextReorder = SHOWCASE.reorderEvery;
    for (const s of [0, 1]) this.buildBase(s);
    const n = SHOWCASE.army[0] + rng.int(SHOWCASE.army[1] - SHOWCASE.army[0] + 1);
    for (const s of [0, 1]) for (let k = 0; k < n; k++) {
      this.spawn(this.pickUnit(this.houses[s]), s, mirror(s, ARMY_BOX.x + rng.int(ARMY_BOX.w)), ARMY_BOX.y + rng.int(ARMY_BOX.h));
    }
    this.prepareSpecial();
    for (const s of [0, 1]) this.charge(s, this.fighters(s), this.enemyHome(s));
  }

  buildBase(s) {
    const house = this.houses[s];
    for (const [id, x, y] of BASE) {
      const typeId = id === 'turret' && house === 'harkonnen' ? 'rocketTurret' : id;
      this.world.spawnStructure(typeId, house, mirror(s, x, STRUCTURES[typeId].w), y);
    }
    if (this.special === 'deathHand' && s === this.specialSide) this.world.spawnStructure('palace', house, mirror(s, PALACE_AT[0], 3), PALACE_AT[1]);
  }

  pickUnit(house) {
    const pool = ARMY.filter(([t]) => UNITS[t].houses.includes(house));
    let r = this.rng.next() * pool.reduce((sum, [, w]) => sum + w, 0);
    for (const [t, w] of pool) if ((r -= w) < 0) return t;
    return pool[0][0];
  }

  /** A unit of side `s` on the nearest free tile it can stand on near x, y (aircraft right there). */
  spawn(typeId, s, x, y) {
    const opts = { heading: s === 0 ? 0 : Math.PI };
    if (UNITS[typeId].move === MOVE.AIR) return this.world.spawnUnit(typeId, this.houses[s], x, y, opts);
    const at = this.freeTile(x, y, UNITS[typeId].move);
    return at ? this.world.spawnUnit(typeId, this.houses[s], at.x, at.y, opts) : null;
  }

  freeTile(x, y, move) {
    const map = this.world.map;
    for (let r = 0; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !map.inBounds(x + dx, y + dy)) continue;
      const i = map.idx(x + dx, y + dy);
      if (!map.unit[i] && !map.structure[i] && map.moveFactor(i, move) > 0) return { x: x + dx, y: y + dy };
    }
    return null;
  }

  /** Side s's armed ground units. */
  fighters(s) {
    const house = this.houses[s];
    return [...this.world.units.values()].filter((u) => u.house === house && u.isGround && !u.inside && u.type.weapon);
  }

  enemyHome(s) { return { x: mirror(1 - s, HOME.x), y: HOME.y }; }

  /** Where side s's enemies are: the middle of their army, or their base once the army is gone. */
  enemyFocus(s) {
    const foes = this.fighters(1 - s);
    if (!foes.length) return this.enemyHome(s);
    return { x: Math.round(foes.reduce((a, u) => a + u.x, 0) / foes.length), y: Math.round(foes.reduce((a, u) => a + u.y, 0) / foes.length) };
  }

  charge(s, units, goal) {
    if (units.length) this.world.issue(this.houses[s], { type: 'attackMove', ids: units.map((u) => u.id), x: goal.x, y: goal.y });
  }

  /** The loop's special: units that join the army now, or a step timed into the battle. */
  prepareSpecial() {
    const s = this.specialSide, house = this.houses[s], w = this.world, lead = SHOWCASE.lead;
    const col = (x) => mirror(s, x);
    switch (this.special) {
      case 'sonic':
        this.spawn('sonicTank', s, col(15), 16);
        this.spawn('sonicTank', s, col(15), 24);
        break;
      case 'deviator':
        this.spawn('deviator', s, col(15), 20);
        break;
      case 'devastator': {
        const dev = this.spawn('devastator', s, col(16), 20);
        // it goes off once badly hurt in view, or when the battle is well under way
        this.pending = dev && {
          at: lead + 20,
          when: () => w.time >= lead && w.units.has(dev.id) && dev.hp < dev.maxHp / 2,
          run: () => { if (w.units.has(dev.id)) w.issue(house, { type: 'destruct', ids: [dev.id] }); },
        };
        break;
      }
      case 'deathHand':
        this.pending = {
          at: lead + 14,
          run: () => {
            const palace = palaceOf(w, house);
            if (!palace) return;
            palace.readyAt = w.time;   // charged for the show
            const f = this.enemyFocus(s);
            w.issue(house, { type: 'palace', x: f.x, y: f.y });
          },
        };
        break;
      case 'ornithopters':
        this.pending = { at: lead + 6, run: () => { for (const y of [15, 20, 25]) this.spawn('ornithopter', s, col(1), y); } };
        break;
    }
  }

  /** One simulation tick plus the director's own timing. */
  step() {
    const w = this.world;
    w.step();
    if (w.time >= this.nextReinforce) { this.nextReinforce += SHOWCASE.reinforceEvery; for (const s of [0, 1]) this.reinforce(s); }
    if (w.time >= this.nextReorder) { this.nextReorder += SHOWCASE.reorderEvery; for (const s of [0, 1]) this.reorder(s); }
    const p = this.pending;
    if (p && (w.time >= p.at || p.when?.())) { this.pending = null; p.run(); }
    this.updateHotspot();
  }

  reinforce(s) {
    if (this.fighters(s).length >= SHOWCASE.reinforceBelow) return;
    const [a, b] = SHOWCASE.reinforceCount, n = a + this.rng.int(b - a + 1), fresh = [];
    for (let k = 0; k < n; k++) {
      const u = this.spawn(this.pickUnit(this.houses[s]), s, mirror(s, ARRIVE_X), 13 + this.rng.int(15));
      if (u) fresh.push(u);
    }
    this.reinforced += fresh.length;
    this.charge(s, fresh, this.enemyFocus(s));
  }

  reorder(s) {
    this.charge(s, this.fighters(s).filter((u) => u.order.type === 'idle'), this.enemyFocus(s));
  }

  /** Every drained event passes through here: shots for the hotspot, and whether the special has happened. */
  onEvent(e) {
    if (e.type === 'fired') this.shots.push({ x: e.x, z: e.y, t: this.world.time });
    if (!this.specialSeen) this.specialSeen = this.isSpecial(e);
  }

  isSpecial(e) {
    switch (this.special) {
      case 'sonic': return e.type === 'fired' && e.projectile === 'sonic';
      case 'deviator': return e.type === 'fired' && e.projectile === 'gas';
      case 'devastator': return e.type === 'unitDestroyed' && e.cause === 'destructed';
      case 'deathHand': return e.type === 'palaceFired';
      case 'ornithopters': return e.type === 'fired' && this.world.units.get(e.id)?.typeId === 'ornithopter';
      default: return false;
    }
  }

  updateHotspot() {
    const now = this.world.time;
    while (this.shots.length && this.shots[0].t < now - SHOWCASE.hotspotWindow) this.shots.shift();
    let goal = this.center;
    if (this.shots.length) {
      let x = 0, z = 0;
      for (const s of this.shots) { x += s.x; z += s.z; }
      goal = { x: x / this.shots.length, z: z / this.shots.length };
    }
    const k = 1 - Math.exp(-DT / SHOWCASE.hotspotLag);
    this.hotspot.x += (goal.x - this.hotspot.x) * k;
    this.hotspot.z += (goal.z - this.hotspot.z) * k;
  }

  /** Runs `seconds` of battle, handing every event to the director and then to `onEvent` (the stage). */
  run(seconds, onEvent = null) {
    for (let i = 0, n = Math.round(seconds / DT); i < n; i++) {
      this.step();
      for (const e of this.world.events.drain()) { this.onEvent(e); onEvent?.(e); }
    }
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/showcase-director.test.mjs`
Expected: 4 PASS. If "the armies meet within the lead time" fails, move `ARMY_BOX.x` from 14 to 16 (both armies start closer). Change nothing else, and rerun.

- [ ] **Step 5: Commit**

```bash
G add src/game/showcase-director.js tests/showcase-director.test.mjs
G -c user.name="Hassan Ilyas" -c user.email="hassan.ilyas0@gmail.com" commit -m "feat(menu): showcase director — map, bases, armies and the loop's special

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Director — the fight never runs dry, and the hotspot

**Files:**
- Test: `tests/showcase-director.test.mjs` (append)

- [ ] **Step 1: Append the tests**

```js
test('the fight never runs dry: both sides keep fighters for three minutes and reinforcements come', () => {
  const d = new ShowcaseDirector({ seed: 11 });
  for (let k = 0; k < 18; k++) {
    d.run(10);
    for (const s of [0, 1]) assert.ok(fighters(d, s).length > 0, `side ${s} empty at ${d.world.time.toFixed(0)} s`);
  }
  assert.ok(d.reinforced > 0);
});

test('the hotspot follows the shooting, among the armies, and stays on the map', () => {
  for (const seed of [5, 9]) {
    const d = new ShowcaseDirector({ seed });
    d.run(SHOWCASE.lead + 10);
    const { x, z } = d.hotspot;
    assert.ok(z >= 0 && z <= SHOWCASE.h, `z ${z}`);
    assert.ok(x > 12 && x < SHOWCASE.w - 12, `seed ${seed}: x ${x.toFixed(1)} sits at a base`);
  }
});
```

- [ ] **Step 2: Run them**

Run: `node --test tests/showcase-director.test.mjs`
Expected: 6 PASS. If a side empties, lower `reinforceEvery` to 6 in `SHOWCASE` and rerun. If the hotspot sits at a base, the armies are not meeting: check `charge` orders reach `world.issue`.

- [ ] **Step 3: Commit**

```bash
G add tests/showcase-director.test.mjs
G -c user.name="Hassan Ilyas" -c user.email="hassan.ilyas0@gmail.com" commit -m "test(menu): the showcase battle keeps going and the hotspot follows it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Director — every special happens

**Files:**
- Test: `tests/showcase-director.test.mjs` (append)

- [ ] **Step 1: Append the test**

```js
test('every house special turns up across seeds and happens within half a minute of the battle', () => {
  const seen = new Map();
  for (let seed = 1; seen.size < 5 && seed < 300; seed++) {
    const d = new ShowcaseDirector({ seed });
    if (seen.has(d.special)) continue;
    d.run(SHOWCASE.lead + 30);
    seen.set(d.special, d.specialSeen);
  }
  assert.deepEqual([...seen.keys()].sort(), ['deathHand', 'devastator', 'deviator', 'ornithopters', 'sonic']);
  for (const [special, ok] of seen) assert.ok(ok, `${special} did not happen`);
});
```

- [ ] **Step 2: Run it**

Run: `node --test tests/showcase-director.test.mjs`
Expected: 7 PASS. If one special does not happen:
- `devastator`: it died before its time; lower `at` to `lead + 16`.
- `ornithopters`: they were shot down first; spawn them at `col(4)`.
- `deathHand`: its Palace is gone; check that `buildBase` placed it (`palaceOf` not null right after construction).

- [ ] **Step 3: Full suite**

Run: `npm test 2>&1 | tail -8`
Expected: `# fail 0`; the suite takes at most a few seconds longer.

- [ ] **Step 4: Commit**

```bash
G add tests/showcase-director.test.mjs src/game/showcase-director.js
G -c user.name="Hassan Ilyas" -c user.email="hassan.ilyas0@gmail.com" commit -m "test(menu): every house special shows up in the menu battle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: PlanetShot

**Files:**
- Create: `src/render/planet.js`
- Test: `tests/planet.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanetShot, planetFraming } from '../src/render/planet.js';

test('the planet sits right of centre on wide screens and in the middle on tall ones', () => {
  const wide = planetFraming(16 / 9), tall = planetFraming(9 / 16);
  assert.ok(wide.offsetX > 0.5);
  assert.equal(tall.offsetX, 0);
  assert.ok(wide.distance > 2 && tall.distance > wide.distance);
});

test('the dive pushes the camera into the planet, centred', () => {
  const p = new PlanetShot({ seed: 1 });
  p.update(0.016, { aspect: 16 / 9 });
  const far = p.camera.position.clone();
  p.update(0.016, { aspect: 16 / 9, dive: 1 });
  assert.ok(p.camera.position.z < far.z && p.camera.position.z > 1.05);
  assert.ok(Math.abs(p.camera.position.x) < 1e-9);
  p.dispose();
});

test('the planet turns, slower under reduced motion; the stars stay within the particle budget', () => {
  const a = new PlanetShot({ seed: 1 }), b = new PlanetShot({ seed: 1 });
  const a0 = a.spin.rotation.y, b0 = b.spin.rotation.y;
  a.update(1, {});
  b.update(1, { reduced: true });
  assert.ok(a.spin.rotation.y - a0 > b.spin.rotation.y - b0 && b.spin.rotation.y > b0);
  assert.ok(a.stars.geometry.attributes.position.count <= 3000);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/planet.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/render/planet.js`**

```js
// Arrakis from space for the main menu (menu backdrop spec): a planet shaded in code — sand, rock and
// wind-drawn dune bands from 3D value noise on the sphere, lit from the upper left — a thin blue rim of
// atmosphere, stars and a faint nebula. Its own scene and camera; update(dt, { dive }) pushes the
// camera into the planet for the cut to the battle.
import * as THREE from 'three';
import { Rng } from '../core/rng.js';

const FOV = 38;
const SPIN = 0.035, SPIN_REDUCED = 0.012;   // radians per second
const STARS = 1500;                          // inside the 1,000–3,000 particle budget
const DIVE_TO = 1.3;                         // camera distance from the centre at the end of the dive (radius 1)
const ATMO_RADIUS = 1.12;
// on the back of the atmosphere shell -n.z runs from 0 at its outline to this where it meets the planet's limb
const ATMO_INNER = Math.sqrt(1 - 1 / (ATMO_RADIUS * ATMO_RADIUS));
const LIGHT = new THREE.Vector3(-0.75, 0.42, 0.52).normalize();   // view space: from the upper left, a little in front

const NOISE = /* glsl */ `
  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float s = 0.0, a = 0.5;
    for (int k = 0; k < 5; k++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.4); a *= 0.5; }
    return s;
  }`;

/**
 * Camera distance and sideways offset, in planet radii, for an aspect ratio. Wide screens: the planet
 * fills ~78 % of the height and sits well right of centre, past the menu, a little cut off by the edge.
 * Tall screens: centred, half the width.
 */
export function planetFraming(aspect, fov = FOV) {
  const t = Math.tan(((fov / 2) * Math.PI) / 180);
  if (aspect < 1) return { distance: 1 / (0.5 * aspect) / t, offsetX: 0 };
  const halfH = 1 / 0.78;
  return { distance: halfH / t, offsetX: halfH * aspect * 0.58 };
}

function planetMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uLight: { value: LIGHT.clone() } },
    vertexShader: /* glsl */ `
      varying vec3 vObj;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vObj = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLight;
      varying vec3 vObj;
      varying vec3 vNormal;
      varying vec3 vView;
      ${NOISE}
      void main() {
        vec3 p = normalize(vObj);
        float base = fbm(p * 2.2);
        float detail = fbm(p * 9.0 + base * 2.0);
        float bands = 0.5 + 0.5 * sin(p.y * 22.0 + base * 7.0 + detail * 3.0);
        vec3 dark = vec3(0.10, 0.035, 0.012), mid = vec3(0.55, 0.22, 0.065), light = vec3(0.86, 0.50, 0.20);
        vec3 col = mix(dark, mid, smoothstep(0.28, 0.52, base));
        col = mix(col, light, smoothstep(0.5, 0.78, base + bands * 0.1));
        col *= 0.78 + 0.4 * detail;
        col = mix(col, dark * 1.4, smoothstep(0.6, 0.7, fbm(p * 4.0 + 3.1)) * 0.55);
        vec3 n = normalize(vNormal), v = normalize(vView);
        float lit = smoothstep(-0.12, 0.65, dot(n, uLight));
        float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        col = col * (0.012 + 1.3 * lit) + vec3(0.18, 0.42, 1.0) * rim * (0.12 + 0.88 * lit);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function atmosphereMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uLight: { value: LIGHT.clone() }, uInner: { value: ATMO_INNER } },
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLight;
      uniform float uInner;
      varying vec3 vNormal;
      void main() {
        vec3 n = normalize(vNormal);
        float glow = pow(clamp(-n.z / uInner, 0.0, 1.0), 2.2);
        float side = dot(normalize(n.xy + vec2(1e-5)), normalize(uLight.xy));
        float lit = 0.2 + 0.8 * smoothstep(-0.6, 0.7, side);
        gl_FragColor = vec4(vec3(0.28, 0.55, 1.0) * glow * lit * 1.3, 1.0);
      }`,
  });
}

function starField(rng) {
  const pos = new Float32Array(STARS * 3), size = new Float32Array(STARS), tone = new Float32Array(STARS * 3), phase = new Float32Array(STARS);
  for (let i = 0; i < STARS; i++) {
    const u = rng.range(-1, 1), a = rng.range(0, Math.PI * 2), s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * 900, u * 900, Math.sin(a) * s * 900], i * 3);
    size[i] = 1 + Math.pow(rng.next(), 6) * 3.5;
    const warm = rng.next(), b = 0.35 + 0.65 * Math.pow(rng.next(), 2);
    tone.set([b * (0.85 + 0.15 * warm), b * 0.92, b * (1.05 - 0.2 * warm)], i * 3);
    phase[i] = rng.next();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aTone', new THREE.BufferAttribute(tone, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTwinkle: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 aTone;
      attribute float aPhase;
      uniform float uTime;
      uniform float uTwinkle;
      varying vec3 vTone;
      void main() {
        vTone = aTone * (1.0 - uTwinkle * 0.3 * (0.5 + 0.5 * sin(uTime * (0.6 + aPhase * 1.8) + aPhase * 6.2832)));
        gl_PointSize = aSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vTone;
      void main() {
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vTone * a, 1.0);
      }`,
  });
  const points = new THREE.Points(g, m);
  points.frustumCulled = false;
  return points;
}

function nebula() {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      ${NOISE}
      void main() {
        float fall = smoothstep(0.5, 0.05, length((vUv - 0.5) * vec2(1.0, 1.4)));
        float wisps = smoothstep(0.42, 0.8, fbm(vec3(vUv * 3.5, 1.7))) * fall;
        gl_FragColor = vec4(vec3(0.05, 0.14, 0.42) * wisps * 0.9, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1100, 700), m);
  mesh.position.set(420, -260, -700);   // the lower right, behind the planet
  return mesh;
}

export class PlanetShot {
  constructor({ seed = 1 } = {}) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.02, 2000);
    this.aspect = 0;
    this.time = 0;
    const tilt = new THREE.Group();
    tilt.rotation.z = 0.32;
    this.spin = new THREE.Group();
    this.spin.rotation.y = new Rng(seed).range(0, Math.PI * 2);   // another face of Arrakis every visit
    this.spin.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), planetMaterial()));
    tilt.add(this.spin);
    this.atmosphere = new THREE.Mesh(new THREE.SphereGeometry(ATMO_RADIUS, 96, 64), atmosphereMaterial());   // not spun: the glow follows the light
    this.stars = starField(new Rng(seed * 7 + 3));
    this.scene.add(tilt, this.atmosphere, this.stars, nebula());
  }

  /** dive 0..1 pushes the camera in; aspect frames the planet; reduced slows the turn and stills the stars. */
  update(dt, { dive = 0, aspect = 16 / 9, reduced = false } = {}) {
    this.time += dt;
    this.spin.rotation.y += dt * (reduced ? SPIN_REDUCED : SPIN);
    const u = this.stars.material.uniforms;
    u.uTime.value = this.time;
    u.uTwinkle.value = reduced ? 0 : 1;
    if (aspect !== this.aspect) {
      this.aspect = aspect;
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    const { distance, offsetX } = planetFraming(aspect);
    const e = Math.min(1, Math.max(0, dive));
    this.camera.position.set(-offsetX * (1 - e), 0, distance + (DIVE_TO - distance) * e);
    this.camera.updateMatrixWorld();
  }

  dispose() {
    this.scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  }
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `node --test tests/planet.test.mjs`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
G add src/render/planet.js tests/planet.test.mjs
G -c user.name="Hassan Ilyas" -c user.email="hassan.ilyas0@gmail.com" commit -m "feat(render): Arrakis from space — a planet, its atmosphere, stars and a nebula in shaders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: MenuBackdrop, styles and the menu wiring

**Files:**
- Create: `src/scenes/menu-backdrop.js`
- Modify: `src/scenes/menu.js`, `src/ui/menu.css`

- [ ] **Step 1: Create `src/scenes/menu-backdrop.js`**

```js
// The main menu's 3D backdrop (menu backdrop spec): Arrakis turning in space, a dive into the planet,
// a live battle between two random houses and a climb back out, on a loop and on one renderer. The
// next battle is built, compiled and simulated ahead while the planet is on screen, so the swap under
// the haze has nothing left to do.
import { Renderer3D } from '../render/renderer.js';
import { CameraRig } from '../render/camera-rig.js';
import { PlanetShot } from '../render/planet.js';
import { BattleStage } from '../game/battle-stage.js';
import { ShowcaseDirector, SHOWCASE } from '../game/showcase-director.js';
import { battleCamera, riseCamera, easeInCubic } from '../game/showcase-camera.js';
import { BackdropClock, fadeAt, captionAt, soundLevelAt, HAZE } from '../game/backdrop-timeline.js';
import { SoundEngine } from '../audio/engine.js';
import { FixedLoop } from '../core/loop.js';
import { DT } from '../data/tuning.js';

const SOUND_SHARE = 0.3;             // the battle behind the menu plays at this share of the Options volume
const PRESIM_TICKS_PER_FRAME = 16;   // simulation ticks run ahead per frame while the planet is on screen
export const CAPTION = 'The planet Arrakis, known as Dune.';

export class MenuBackdrop {
  constructor({ settings, seed = 1, hold = null }) {
    this.settings = settings;
    this.seed = seed;
    const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.reduced = !!motion?.matches;
    motion?.addEventListener?.('change', (e) => { this.reduced = e.matches; });
    const canvas = document.getElementById('gl');
    this.app = document.getElementById('app');
    this.r3d = new Renderer3D(canvas, settings.quality);
    this.planet = new PlanetShot({ seed });
    this.rig = new CameraRig(this.r3d.camera, SHOWCASE.w, SHOWCASE.h);
    this.clock = new BackdropClock({ hold });
    this.loop = new FixedLoop(DT);
    this.sound = new SoundEngine({ enabled: settings.sound, volume: 0 });
    this.next = null;      // the battle being prepared: { director, stage, ticksLeft, compiled, ready }
    this.battle = null;    // the battle on screen
    this.retired = null;   // the last battle: off the scene, disposed once the next one has compiled
    this.planetOnly = false;
    this.running = false;
    this.raf = 0;
    this.last = 0;
    this.shot = -1;
    this.riseFrom = null;
    this.fade = document.createElement('div');
    this.fade.className = 'mb-fade';
    canvas.after(this.fade);
    this.caption = document.createElement('div');
    this.caption.className = 'mb-caption';
    this.caption.textContent = CAPTION;
    this.caption.setAttribute('aria-hidden', 'true');   // decoration, repeated every loop
    document.getElementById('ui').appendChild(this.caption);
    if (this.clock.phase === 'battle') this.enter('battle');
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); else this.resume(); });
  }

  /** Shown (the first time, or back from a skirmish): the loop starts over in space. */
  start() {
    if (this.running) return;
    this.running = true;
    if (!this.clock.hold) {
      this.clock.restart();
      this.retire();
    }
    this.resume();
  }

  /** A skirmish opens over the menu: nothing more to draw or hear. */
  stop() {
    this.running = false;
    this.pause();
  }

  pause() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.sound.setMuted(true);
  }

  resume() {
    if (this.raf || !this.running || document.hidden) return;
    this.raf = requestAnimationFrame((now) => { this.last = now; this.frame(now); });
  }

  frame(now) {
    this.raf = requestAnimationFrame((t) => this.frame(t));
    try { this.tick(now); } catch (err) { this.fail(err); }
  }

  tick(now) {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const c = this.clock;
    if (!c.hold && (c.phase === 'planet' || c.phase === 'dive')) this.prepare();
    const entered = c.advance(dt, !!this.next?.ready);
    if (entered) this.enter(entered);
    if (c.phase === 'planet' || c.phase === 'dive' || !this.battle) this.drawPlanet(dt);
    else this.drawBattle(dt, now);
    this.overlays();
  }

  /** Background work while the planet is on screen: build the next battle, compile it, simulate it ahead. */
  prepare() {
    if (this.planetOnly) return;
    const n = this.next;
    if (!n) { this.next = this.build(); return; }
    if (!n.compiled) {
      this.r3d.renderer.compile(this.r3d.scene, this.r3d.camera);   // before the old battle's programs are released
      this.disposeRetired();
      n.compiled = true;
      return;
    }
    if (n.ticksLeft > 0) {
      const k = Math.min(PRESIM_TICKS_PER_FRAME, n.ticksLeft);
      n.director.run(k * DT, (e) => n.stage.onEvent(e));
      n.ticksLeft -= k;
      n.ready = n.ticksLeft === 0;
    }
  }

  build() {
    const director = new ShowcaseDirector({ seed: this.seed++ });
    const stage = new BattleStage({
      world: director.world, scene: this.r3d.scene, quality: this.r3d.quality, viewer: null, sound: this.sound, rig: this.rig,
      onShake: (amount) => { if (!this.reduced) this.rig.shake = Math.max(this.rig.shake, amount); },
    });
    return { director, stage, ticksLeft: Math.round(SHOWCASE.lead / DT), compiled: false, ready: false };
  }

  /** Everything at once, for a held battle and the debug skip. */
  ensureReady() {
    if (!this.next) this.next = this.build();
    const n = this.next;
    if (!n.compiled) { this.disposeRetired(); n.compiled = true; }
    if (n.ticksLeft > 0) { n.director.run(n.ticksLeft * DT, (e) => n.stage.onEvent(e)); n.ticksLeft = 0; }
    n.ready = true;
  }

  enter(phase) {
    if (phase === 'battle') {
      if (!this.next?.ready) this.ensureReady();
      this.battle = this.next;
      this.next = null;
      this.battle.stage.catchingUp = false;
      this.loop = new FixedLoop(DT);
      this.shot = -1;
    } else if (phase === 'rise') {
      const r = this.rig;
      this.riseFrom = { x: r.goal.x, z: r.goal.z, distance: r.goalDistance, pitch: r.goalPitch, yaw: r.goalYaw };
    } else if (phase === 'planet') this.retire();
  }

  /** The battle leaves the scene; it is disposed after the next one has compiled. */
  retire() {
    if (!this.battle) return;
    this.r3d.scene.remove(this.battle.stage.root);
    this.disposeRetired();
    this.retired = this.battle;
    this.battle = null;
  }

  disposeRetired() {
    this.retired?.stage.dispose();
    this.retired = null;
  }

  drawPlanet(dt) {
    const c = this.clock, r3d = this.r3d;
    const dive = c.phase === 'dive' && !this.reduced ? easeInCubic(c.k) : 0;
    this.planet.update(dt, { dive, aspect: r3d.width / r3d.height, reduced: this.reduced });
    r3d.render(this.planet.scene, this.planet.camera);
  }

  drawBattle(dt, now) {
    const b = this.battle, c = this.clock, r3d = this.r3d, rig = this.rig, d = b.director;
    const { steps, alpha } = this.loop.advance(dt);
    if (steps) d.run(steps * DT, (e) => b.stage.onEvent(e));
    const cam = c.phase === 'battle'
      ? battleCamera(c.t, this.reduced ? d.center : d.hotspot, { reduced: this.reduced, seed: d.seed })
      : riseCamera(this.reduced ? 0 : c.k, this.riseFrom);
    const cut = c.phase === 'battle' && cam.shot !== this.shot;
    if (c.phase === 'battle') this.shot = cam.shot;
    rig.lookAt(cam.x, cam.z, cut);
    rig.goalDistance = cam.distance;
    rig.goalPitch = cam.pitch;
    rig.goalYaw = cam.yaw;
    if (cut) { rig.distance = cam.distance; rig.pitch = cam.pitch; rig.yaw = cam.yaw; }
    rig.update(dt, b.stage.heightAt);
    r3d.follow(rig.target.x, rig.target.z, rig.distance * 1.1);
    const e = r3d.camera.matrixWorld.elements;
    this.sound.setListener(rig.target.x, rig.target.z, e[0], e[2], rig.distance);
    b.stage.sync(alpha, dt, now);
    r3d.render();
  }

  overlays() {
    const c = this.clock;
    const f = fadeAt(c.phase, c.t, { reduced: this.reduced });
    this.fade.style.background = f.color === 'haze' ? HAZE : '#000';
    this.fade.style.opacity = f.opacity.toFixed(3);
    this.caption.style.opacity = captionAt(c.phase, c.t).toFixed(3);
    this.app.classList.toggle('mb-battle', c.phase === 'battle' || c.phase === 'rise');
    const level = soundLevelAt(c.phase, c.t);
    this.sound.volume = this.settings.volume * SOUND_SHARE * level;
    this.sound.setMuted(!this.settings.sound || level === 0);
  }

  /** Straight on to the next phase (debug hook for tests and screenshots). */
  skip() {
    if (this.planetOnly) return;
    const c = this.clock;
    if (c.phase === 'planet' || c.phase === 'dive') this.ensureReady();
    this.enter(c.skip());
  }

  /** Something broke: carry on with the planet alone; if the planet broke, leave the menu on black. */
  fail(err) {
    console.warn('menu backdrop:', err);
    if (this.planetOnly) { this.stop(); return; }
    this.planetOnly = true;
    for (const b of [this.battle, this.next, this.retired]) { try { b?.stage.dispose(); } catch { /* already half gone */ } }
    this.battle = this.next = this.retired = null;
    this.clock = new BackdropClock({ hold: 'planet' });
  }

  debug() {
    const self = this;
    return {
      get phase() { return self.clock.phase; },
      get cycle() { return self.clock.cycle; },
      get running() { return self.running; },
      get reduced() { return self.reduced; },
      skip: () => self.skip(),
      battle: () => {
        const b = self.battle ?? self.next;
        if (!b) return null;
        const units = [...b.director.world.units.values()];
        return {
          houses: [...b.director.houses], special: b.director.special, units: units.length,
          byHouse: Object.fromEntries(b.director.houses.map((h) => [h, units.filter((u) => u.house === h).length])),
        };
      },
    };
  }
}
```

- [ ] **Step 2: Wire it into `src/scenes/menu.js`**

1. Replace the header comment (first three lines) with

```js
// Main menu (spec §5.8): Arrakis turning in space, then a live battle, behind the title and the menu
// screens (menu backdrop spec); the old flight over the dunes stays as the fallback. Each battle runs
// in a frame laid over the menu: full screen carries from the menu into the battle and back, and
// quitting simply throws the frame away.
```

2. Add `import { MenuBackdrop } from './menu-backdrop.js';` after the `toggleFullscreen` import.

3. In `start()`, replace

```js
  let backdrop = { start() {}, stop() {} };
  try { backdrop = flyover(settings, params.num('seed', 1 + Math.floor(Math.random() * 9999))); } catch (err) { console.warn('menu backdrop:', err); }
```

with

```js
  const seed = params.num('seed', 1 + Math.floor(Math.random() * 9999));
  let backdrop = { start() {}, stop() {} };
  try {
    backdrop = new MenuBackdrop({ settings, seed, hold: params.str('backdrop') });
  } catch (err) {
    console.warn('menu backdrop:', err);
    for (const el of document.querySelectorAll('.mb-fade, .mb-caption')) el.remove();
    try { backdrop = flyover(settings, seed); } catch (err2) { console.warn('menu flyover:', err2); }
  }
```

4. Replace the last line of `start()`

```js
  window.__dune = { ready: true, scene: 'menu', menu, launch, quit, get frame() { return frame; } };
```

with

```js
  window.__dune = { ready: true, scene: 'menu', menu, launch, quit, backdrop: backdrop.debug?.() ?? null, get frame() { return frame; } };
```

- [ ] **Step 3: Styles — append to `src/ui/menu.css`**

```css
/* main menu backdrop (menu backdrop spec): the fade between space and the battle, the planet's caption,
   and a deeper scrim behind the menu while the battle plays. The caption red #ee4630 on the black of
   space is 5.6:1 (WCAG AA needs 4.5:1). */
.mb-fade { position: absolute; inset: 0; pointer-events: none; background: #000; opacity: 1; }
.mb-caption { position: absolute; left: 50%; width: 50%; bottom: 6vh; z-index: 11; pointer-events: none; opacity: 0; text-align: center;
  font: bold clamp(18px, 2.3vw, 30px) Georgia, "Times New Roman", serif; letter-spacing: .03em; color: #ee4630; text-shadow: 0 2px 6px #000, 0 0 2px #000; }
#ui:not(:has(.mm-title-screen)) .mb-caption, #ui:has(> .main-menu[hidden]) .mb-caption { display: none; }
.main-menu::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 1.2s ease;
  background: linear-gradient(90deg, rgba(10,6,2,.55) 0%, rgba(10,6,2,.35) 42%, transparent 72%); }
#app.mb-battle .main-menu::before { opacity: 1; }
@media (max-width: 700px) { .mb-caption { left: 0; width: 100%; } }
@media (prefers-reduced-motion: reduce) { .main-menu::before { transition: none; } }
```

- [ ] **Step 4: Unit tests still pass**

Run: `npm test 2>&1 | tail -4`
Expected: `# fail 0`.

- [ ] **Step 5: Look at it (smoke shots of both held phases)**

Add to `SCENARIOS` in `scripts/scenarios.mjs` (after `boot`):

```js
  'menu-planet': { query: 'scene=menu&backdrop=planet&seed=5', settleMs: 2500 },
  'menu-battle': { query: 'scene=menu&backdrop=battle&seed=5', settleMs: 3500 },
```

Run: `SMOKE_PORT=8571 node scripts/smoke.mjs menu-planet menu-battle 2>&1 | tail -4`
Expected: `wrote screenshots/menu-planet.png` and `wrote screenshots/menu-battle.png`, no FAIL.

Open both PNGs with the Read tool and check:
- **menu-planet**: an orange-brown planet on the right, partly cut off by the edge, lit from the upper left, a blue rim, stars; the red caption under it; the menu readable on the left. If the planet is too dark or pale, adjust `mid`/`light` in `planetMaterial`. If the rim is too faint or strong, adjust the `1.3` factor in `atmosphereMaterial`. Only these constants change.
- **menu-battle**: units of two colours fighting on sand between rock plateaus, with shots and explosions; the menu readable over the deeper scrim. If the camera looks at empty ground, check `director.hotspot` via `window.__dune.backdrop.battle()`.

Re-run the smoke after each tweak until both look right.

- [ ] **Step 6: Commit**

```bash
G add src/scenes/menu-backdrop.js src/scenes/menu.js src/ui/menu.css scripts/scenarios.mjs
G -c user.name="Hassan Ilyas" -c user.email="hassan.ilyas0@gmail.com" commit -m "feat(menu): Arrakis from space, a dive, and a live battle behind the main menu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: End-to-end checks, full verification, docs

**Files:**
- Modify: `scripts/e2e-menu.mjs`, `README.md`, `docs/superpowers/specs/2026-09-30-menu-backdrop-design.md`

- [ ] **Step 1: Backdrop checks in `scripts/e2e-menu.mjs`**

After the line `check('the page wears the bronze arrow cursor', …);` insert

```js
  // the backdrop: Arrakis first, a battle after the dive, back to space after the rise
  const bd = (expr) => ev(`window.__dune.backdrop.${expr}`);
  check('the backdrop opens on the planet, with its caption', (await bd('phase')) === 'planet' && (await ev('!!document.querySelector(".mb-caption")')));
  await bd('skip()');
  await bd('skip()');
  await sleep(1500);
  const showcase = await bd('battle()');
  check('the dive lands in a battle between two houses', (await bd('phase')) === 'battle' && showcase?.houses.length === 2 && showcase.houses.every((h) => showcase.byHouse[h] > 0), JSON.stringify(showcase));
  await page.screenshot(path.join(shots, '01b-backdrop-battle.png'));
  await bd('skip()');
  await bd('skip()');
  check('the rise returns to the planet for another loop', (await bd('phase')) === 'planet' && (await bd('cycle')) === 1);
```

After `check('Start battle opens the battle in its frame, as the chosen house', …);` insert

```js
  check('the backdrop stops while a battle is open', (await bd('running')) === false);
```

After `check('Quit to main menu closes the battle and shows the menu', …);` insert

```js
  check('back in the menu the backdrop runs again, from the planet', (await bd('running')) === true && (await bd('phase')) === 'planet');
```

- [ ] **Step 2: Run the menu e2e**

Run: `E2E_MENU_PORT=8573 npm run e2e:menu 2>&1 | tail -30`
Expected: every line `ok`, ending `all menu and control checks passed`. Open `screenshots/e2e-menu/01b-backdrop-battle.png` and `01-title.png` with the Read tool.

- [ ] **Step 3: Everything else**

Run: `npm test 2>&1 | tail -8` → `# fail 0`.
Run: `E2E_PORT=8572 npm run e2e 2>&1 | tail -6` → all checks passed.
Run: `SMOKE_PORT=8571 npm run smoke 2>&1 | tail -6` → no FAIL.

- [ ] **Step 4: Docs**

`README.md`, Status paragraph: replace `full screen, over a slow flight across the dunes; Esc in battle opens the game menu.` with `full screen, over Arrakis turning in space and then a live battle between two houses; Esc in battle opens the game menu.`

`README.md`, Scenes line: after ``Scenes: `?scene=menu` (the default with no query)`` add `` (`&backdrop=planet` or `&backdrop=battle` holds one backdrop phase for screenshots)``.

Spec `docs/superpowers/specs/2026-09-30-menu-backdrop-design.md`:
- Change the heading `### \`MenuBackdrop\` — \`src/scenes/menu.js\`` to ``### `MenuBackdrop` — `src/scenes/menu-backdrop.js` (used by `src/scenes/menu.js`)``.
- In **Sound**, change `Space is silent; battle sound fades in during the dive.` to `Space is silent; battle sound fades in over the battle's first two seconds and out on the rise.`

- [ ] **Step 5: Commit**

```bash
G add scripts/e2e-menu.mjs README.md docs/superpowers/specs/2026-09-30-menu-backdrop-design.md
G -c user.name="Hassan Ilyas" -c user.email="hassan.ilyas0@gmail.com" commit -m "test(menu): end-to-end backdrop checks; README and spec follow the menu backdrop

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
