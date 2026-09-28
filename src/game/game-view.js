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
import { PlacementGhost } from '../render/placement-ghost.js';
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
    this.ghost = new PlacementGhost(r3d.scene, hf);
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
      onGhost: (p) => this.ghost.show(p),
      onNotice: (text) => this.hud.message(text),
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
    const raw = Math.max(0, (now - this.last) / 1000);
    const dt = Math.min(0.1, raw);   // camera, HUD and animation step
    this.last = now;
    // the loop gets the real interval: it caps a stall at 0.25 s itself, so slow devices do not play in slow motion
    const { steps, alpha } = this.paused ? { steps: 0, alpha: 1 } : this.loop.advance(raw, this.speed);
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
    this.fps?.frame();
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
