// Everything between the simulation and the screen (spec §3): renderer, terrain, unit and structure
// views, RTS camera, input, overlay, HUD and the frame loop. Scenes build a World and hand it over.
import { Renderer3D } from '../render/renderer.js';
import { terrainSubFor } from '../render/quality.js';
import { Heightfield } from '../render/heightfield.js';
import { TerrainView } from '../render/terrain.js';
import { CameraRig } from '../render/camera-rig.js';
import { screenToGround, screenToPlane, worldToScreen, pixelsPerUnit } from '../render/picking.js';
import { UnitViews } from '../render/views/unit-views.js';
import { StructureViews } from '../render/views/structure-views.js';
import { PlacementGhost } from '../render/placement-ghost.js';
import { ShroudSync } from '../render/shroud.js';
import { Effects } from '../render/effects.js';
import { SoundEngine } from '../audio/engine.js';
import { cueFor } from '../audio/cues.js';
import { EndScreen } from '../ui/end-screen.js';
import { endStats } from '../sim/victory.js';
import { UNITS } from '../data/units.js';
import { G } from '../data/terrain.js';
import { nearCamera } from '../render/near-camera.js';
import { Overlay } from '../render/overlay.js';
import { CameraControl } from '../input/camera-control.js';
import { Pointer } from '../input/pointer.js';
import { Keyboard } from '../input/keyboard.js';
import { Selection } from '../input/selection.js';
import { Groups } from '../input/groups.js';
import { Controller } from '../input/controller.js';
import { makeCursorSetter } from '../ui/cursors.js';
import { Hud } from '../ui/hud.js';
import { Sidebar } from '../ui/sidebar.js';
import { Radar } from '../ui/radar.js';
import { SelectionPanel, selectionPanelModel } from '../ui/selection-panel.js';
import { unitVisibleTo, structureVisibleTo, isVisible } from '../sim/fog.js';
import { sidebarModel } from '../ui/sidebar-model.js';
import { IconFactory } from '../render/icons.js';
import { HOUSES } from '../data/houses.js';
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
    document.getElementById('app').classList.add('has-sidebar');   // before the renderer measures the canvas
    const canvas = (this.canvas = document.getElementById('gl'));
    const r3d = (this.r3d = new Renderer3D(canvas, settings.quality));
    r3d.renderer.info.autoReset = false;
    const hf = (this.hf = new Heightfield(world.map, { sub: terrainSubFor(world.map.w, r3d.quality), seed: world.map.seed }));
    this.heightAt = (x, z) => hf.heightAt(x, z);
    this.terrain = new TerrainView(world.map, hf);
    r3d.scene.add(this.terrain.group);
    this.unitViews = new UnitViews(r3d.scene, hf, { viewer: house });
    this.structureViews = new StructureViews(r3d.scene, hf, { viewer: house });
    this.shroud = new ShroudSync(world.map.w * world.map.h);
    this.ghost = new PlacementGhost(r3d.scene, hf);
    this.effects = new Effects(r3d.scene, r3d.quality);
    this.smokeClock = 0;
    this.dustClock = 0;
    this.weldClock = 0;
    this.trackFrom = new Map();
    this.catchingUp = true;   // the first frame drains everything a scene simulated ahead: marks yes, fireworks no
    this.rig = new CameraRig(r3d.camera, world.map.w, world.map.h);
    const dist = params.num('dist');
    if (dist) this.rig.goalDistance = this.rig.distance = dist;
    this.rig.lookAt(focus.x, focus.z, true);
    this.cameraControl = new CameraControl(this.rig, canvas, settings);
    this.overlay = new Overlay(document.getElementById('overlay'));
    this.hud = new Hud(document.getElementById('ui'));
    this.sound = new SoundEngine({ enabled: settings.sound, volume: settings.volume });
    const click = (fn) => (...args) => { this.sound.play('click'); return fn(...args); };
    this.icons = new IconFactory(r3d.renderer, { environment: r3d.scene.environment });
    this.sidebar = new Sidebar(document.getElementById('ui'), {
      iconFor: (typeId) => this.icons.forItem(typeId, house),
      onCommand: click((cmd) => world.issue(house, cmd)),
      onPlace: click((typeId) => this.controller.startPlacement(typeId)),
      onTool: click((tool) => this.controller.setMode(this.controller.mode?.kind === tool ? null : { kind: tool })),
    });
    this.sidebar.el.style.setProperty('--house', `#${(HOUSES[house]?.color ?? 0xd9a52e).toString(16).padStart(6, '0')}`);
    this.radar = new Radar(this.sidebar.radarEl, {
      world, house,
      onJump: (x, z) => this.rig.lookAt(x, z, true),
      onOrder: (tx, ty) => this.controller.orderTile(tx, ty),
      ordersOnLeft: () => settings.scheme !== 'modern' && this.controller.ownSelected().length > 0,
      ordersOnRight: () => settings.scheme === 'modern',
    });
    this.panel = new SelectionPanel(document.getElementById('ui'), {
      iconFor: (typeId, houseId) => this.icons.forItem(typeId, houseId),
      onButton: click((id) => this.panelAction(id)),
    });
    this.endScreen = new EndScreen(document.getElementById('ui'), {
      onReplay: () => {
        const q = new URLSearchParams(location.search);
        q.set('seed', String((Number(q.get('seed')) || 1) + 1));
        location.search = q.toString();
      },
    });
    this.endAt = 0;
    this.userPaused = false;


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
      onMode: (mode) => this.sidebar.setTool(mode?.kind ?? null),
      canSee: (u) => unitVisibleTo(world, house, u),
      canSeeStructure: (s) => structureVisibleTo(world, house, s),
    });
    new Pointer(canvas, this.controller);
    new Keyboard((key, code, mods) => this.onKey(key, code, mods));
    this.loop = new FixedLoop(DT);
    this.speed = GAME_SPEED[settings.gameSpeed] ?? 1;
    this.paused = document.hidden;
    this.lost = false;
    this.last = performance.now();
    document.addEventListener('visibilitychange', () => { this.paused = document.hidden || this.lost || this.userPaused; this.last = performance.now(); });
    r3d.onContextLost = () => {
      this.lost = true;
      this.paused = true;
      this.hud.message('The graphics device was reset — restoring…', 3600);
      setTimeout(() => { if (this.lost) showCrash(new Error('The graphics device was lost and did not come back.')); }, 5000);
    };
    r3d.onContextRestored = () => location.reload();
    this.onFrame = null;
    this.nextInvariantCheck = 0;
  }

  handleEvents() {
    for (const e of this.world.events.drain()) this.onEvent(e);
    this.catchingUp = false;
  }

  onEvent(e) {
    if (!this.catchingUp) {
      const cue = cueFor(e, this.house, (x, z) => this.seen(x, z));
      if (cue) this.sound.play(cue.id, { x: cue.x ?? null, z: cue.z ?? null, rate: 0.94 + Math.random() * 0.12 });
    }
    if (e.type === 'eva' && e.house === this.house) this.hud.message(e.text);
    else if (e.type === 'deployed' && e.house === this.house) this.hud.message('Construction Yard deployed.');
    else if (e.type === 'sold' && e.house === this.house) this.hud.message('Structure sold.');
    if (e.type === 'unitBuilt') this.structureViews.notify(e, performance.now());
    if (e.type === 'structurePlaced') {
      const s = this.world.structures.get(e.id);
      if (s) this.terrain.flattenFootprint(s.x, s.y, s.w, s.h);
      if (s && !this.catchingUp && this.seen(s.x + s.w / 2, s.y + s.h / 2)) this.constructionDust(s);
    }
    switch (e.type) {
      case 'fired': if (!this.catchingUp) this.onFired(e); break;
      case 'gameOver': this.endAt = performance.now() + 2500; break;
      case 'impact': if (!this.catchingUp && this.seen(e.x, e.y)) this.effects.impact(e.x, this.heightAt(e.x, e.y) + 0.12, e.y, e.projectile, e.hit); break;
      case 'explosion':
        if (!this.seen(e.x, e.y)) break;
        if (!this.catchingUp) this.effects.explosion(e.x, this.heightAt(e.x, e.y) + 0.25, e.y, e.size);
        this.terrain.decals?.scorch(e.x, e.y, e.size === 'large' ? 1.8 : e.size === 'medium' ? 1 : 0.6);
        break;
      case 'unitDestroyed':
        if (!this.catchingUp && UNITS[e.typeId]?.move === 'foot' && this.seen(e.x, e.y)) this.effects.smokePuff(e.x, this.heightAt(e.x, e.y) + 0.1, e.y);
        break;
    }
  }

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

  /** Dust behind vehicles on sand, tread marks and harvest dust (spec §5.4). */
  ambient(dt) {
    const w = this.world, map = w.map;
    this.dustClock += dt;
    const puff = this.dustClock >= 0.09;
    if (puff) this.dustClock = 0;
    for (const u of w.units.values()) {
      if (u.move === 'foot') continue;
      const i = map.idx(u.tx, u.ty);
      const soft = (map.ground[i] === G.SAND || map.ground[i] === G.DUNE) && !map.concrete[i];
      const p = this.unitViews.renderPos(u);
      if (!nearCamera(p.x, p.z, this.rig.target.x, this.rig.target.z, this.rig.distance)) continue;
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
    if (this.weldClock >= 0.12) {   // welding sparks over occupied repair pads the player can see
      this.weldClock = 0;
      for (const s of w.structures.values()) {
        if (!s.bay || !nearCamera(s.x + s.w / 2, s.y + s.h / 2, this.rig.target.x, this.rig.target.z, this.rig.distance) || !this.seen(s.x + s.w / 2, s.y + s.h / 2)) continue;
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

  onKey(key, code, mods) {
    if (key === 'p' && !mods.ctrl) {
      if (!mods.repeat) this.togglePause();
      return true;
    }
    if (key === 'm' && !mods.ctrl) {
      if (!mods.repeat) this.hud.message(!this.sound.available ? 'Sound is not available in this browser' : this.sound.toggleMute() ? 'Sound off' : 'Sound on', 1.5);
      return true;
    }
    return this.controller.onKey(key, code, mods);
  }

  togglePause() {
    this.userPaused = !this.userPaused;
    this.paused = document.hidden || this.lost || this.userPaused;
    if (this.userPaused) this.hud.hold('Paused — press P to continue');
    else { this.hud.release(); this.hud.message('Resumed', 1.5); }
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
    if (world.fogOfWar && this.shroud.update(world.houses.get(this.house)?.fog)) this.terrain.setShroud(this.shroud.explored, this.shroud.visible);
    this.selection.prune((id) => { const u = world.units.get(id); return !!u && !u.inside && unitVisibleTo(world, this.house, u); }, (id) => { const s = world.structures.get(id); return !!s && structureVisibleTo(world, this.house, s); });
    this.onFrame?.(dt);
    this.cameraControl.update(dt);
    this.rig.update(dt, this.heightAt);
    r3d.follow(this.rig.target.x, this.rig.target.z, this.rig.distance * 1.1);
    const e = r3d.camera.matrixWorld.elements;
    this.sound.setListener(this.rig.target.x, this.rig.target.z, e[0], e[2], this.rig.distance);
    this.unitViews.sync(world, alpha, dt);
    this.structureViews.sync(world, now);
    this.combatEffects(dt, alpha);
    this.ambient(dt);
    this.effects.update(dt);
    this.terrain.update(now);
    r3d.renderer.info.reset();
    r3d.render();
    this.controller.frame();
    this.overlay.draw({
      world, selection: this.selection, hoverId: this.controller.hoverId, hoverStructureId: this.controller.hoverStructureId,
      project: this.project, positionOf: this.positionOf, groups: this.groups, dt, healthBars: this.settings.healthBars,
      canSee: (u) => unitVisibleTo(world, this.house, u),
      canSeeStructure: (s) => structureVisibleTo(world, this.house, s),
    });
    this.panel.update(selectionPanelModel(world, this.selection, this.house));
    this.hud.update(dt);
    const sidebar = sidebarModel(world, this.house);
    this.sidebar.update(sidebar, dt);
    this.radar.update(dt, { online: sidebar.radar, view: this.viewQuad() });
    if (this.radarWas !== undefined && sidebar.radar !== this.radarWas) this.sound.play('static');
    this.radarWas = sidebar.radar;
    if (this.endAt && now >= this.endAt) { this.endAt = 0; this.endScreen.show(endStats(world, this.house)); }
    this.fps?.frame();
  }

  start() {
    const tick = guardFrame((now) => this.frame(now), showCrash);
    const loop = (now) => { if (tick(now)) requestAnimationFrame(loop); };
    requestAnimationFrame((now) => {
      this.last = now;
      this.rig.update(1, this.heightAt);
      if (!tick(now)) return;
      window.__dune = createDebugApi({ world: this.world, house: this.house, selection: this.selection, project: this.project, positionOf: this.positionOf, rig: this.rig, controller: this.controller, view: this });
      window.__dune.ready = true;
      requestAnimationFrame(loop);
    });
  }
}
