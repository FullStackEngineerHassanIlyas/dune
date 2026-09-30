// Everything between the simulation and the screen (spec §3): renderer, the BattleStage (terrain, views,
// effects, event effects), RTS camera, input, overlay, HUD and the frame loop. Scenes build a World and hand it over.
import { Renderer3D } from '../render/renderer.js';
import { CameraRig } from '../render/camera-rig.js';
import { screenToGround, screenToPlane, worldToScreen, pixelsPerUnit } from '../render/picking.js';
import { PlacementGhost } from '../render/placement-ghost.js';
import { SoundEngine } from '../audio/engine.js';
import { VoicePlayer, WebVoiceOutput } from '../audio/voice.js';
import { EndScreen } from '../ui/end-screen.js';
import { endStats } from '../sim/victory.js';
import { Overlay } from '../render/overlay.js';
import { CameraControl } from '../input/camera-control.js';
import { Pointer } from '../input/pointer.js';
import { Keyboard } from '../input/keyboard.js';
import { Selection } from '../input/selection.js';
import { Groups } from '../input/groups.js';
import { Controller } from '../input/controller.js';
import { makeCursorSetter, makeScrollCursor } from '../ui/cursors.js';
import { GameMenu } from '../ui/game-menu.js';
import { toggleFullscreen, isFullscreen } from '../ui/fullscreen.js';
import { quitToMenu } from '../core/shell.js';
import { Hud } from '../ui/hud.js';
import { Sidebar } from '../ui/sidebar.js';
import { Radar } from '../ui/radar.js';
import { SelectionPanel, selectionPanelModel } from '../ui/selection-panel.js';
import { unitVisibleTo, structureVisibleTo } from '../sim/fog.js';
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
import { BattleStage } from './battle-stage.js';
import { Announcer } from './announcer.js';

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
    const anchor = document.createElement('div');
    anchor.className = 'pull-anchor';
    document.getElementById('ui').appendChild(anchor);
    this.cameraControl = new CameraControl(this.rig, canvas, settings, { onScroll: makeScrollCursor(document.getElementById('app'), anchor) });
    this.overlay = new Overlay(document.getElementById('overlay'));
    this.hud = new Hud(document.getElementById('ui'));
    this.announcer = new Announcer({   // voiced lines for the player's house; the message bar keeps the text
      world, house, player: new VoicePlayer({ output: new WebVoiceOutput(this.sound, house), volume: settings.voiceVolume }),
      onMessage: (text) => this.hud.message(text),
    });
    const click = (fn) => (...args) => { this.sound.play('click'); return fn(...args); };
    this.icons = new IconFactory(r3d.renderer, { environment: r3d.scene.environment });
    this.sidebar = new Sidebar(document.getElementById('ui'), {
      iconFor: (typeId) => this.icons.forItem(typeId, house),
      onCommand: click((cmd) => world.issue(house, cmd)),
      onPlace: click((typeId) => this.controller.startPlacement(typeId)),
      onTool: click((tool) => this.controller.setMode(this.controller.mode?.kind === tool ? null : { kind: tool })),
      onSpecial: click((special) => {
        if (!special.aim) return world.issue(house, { type: 'palace' });
        this.announcer.say('selectTarget', performance.now() / 1000);
        return this.controller.setMode({ kind: 'palace' });
      }),
      onMenu: click(() => this.openMenu()),
      onFullscreen: click(() => toggleFullscreen()),
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
      onMenu: () => quitToMenu(),
    });
    this.endAt = 0;
    this.userPaused = false;
    this.menu = new GameMenu(document.getElementById('ui'), {
      settings,
      onClose: () => this.setMenuOpen(false),
      onRestart: () => location.reload(),
      onQuit: () => quitToMenu(),
      onFullscreen: () => toggleFullscreen(),
      isFullscreen: () => isFullscreen(),
      onSettings: (key, value) => this.applySetting(key, value),
    });


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
    this.positionOf = (u) => this.stage.unitViews.renderPos(u);
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
    new Pointer(canvas, this.controller, { rightDrag: () => settings.rightDragScroll });
    new Keyboard((key, code, mods) => this.onKey(key, code, mods));
    this.loop = new FixedLoop(DT);
    this.speed = GAME_SPEED[settings.gameSpeed] ?? 1;
    this.paused = document.hidden;
    this.lost = false;
    this.last = performance.now();
    document.addEventListener('visibilitychange', () => { this.updatePaused(); this.last = performance.now(); });
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
    this.stage.catchingUp = false;
  }

  onEvent(e) {
    this.stage.onEvent(e);
    this.announcer.onEvent(e, performance.now() / 1000);
    if (e.type === 'eva' && e.house === this.house) this.hud.message(e.text);
    else if (e.type === 'deployed' && e.house === this.house) this.hud.message('Construction Yard deployed.');
    else if (e.type === 'sold' && e.house === this.house) this.hud.message('Structure sold.');
    if (e.type === 'gameOver') this.endAt = performance.now() + 2500;
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
    if (['stop', 'guard', 'scatter', 'deploy', 'destruct'].includes(id) && units.length) issue({ type: id, ids: units.map((u) => u.id) });
    else if (id === 'return') issue({ type: 'returnToBase', ids: units.filter((u) => u.harvest).map((u) => u.id) });
    else if (s && id === 'repair') issue({ type: 'repair', structureId: s.id });
    else if (s && id === 'sell') issue({ type: 'sell', structureId: s.id });
    else if (s && id === 'primary') issue({ type: 'setPrimary', structureId: s.id });
  }

  onKey(key, code, mods) {
    if (this.menu.isOpen) return this.menu.onKey(key);
    if (key === 'F10' || (key === 'Escape' && !this.controller.mode)) { this.openMenu(); return true; }   // spec §5.7: Esc is the menu once no mode is left to cancel
    if (key === 'Enter' && mods.alt) { if (!mods.repeat) toggleFullscreen(); return true; }
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
    this.updatePaused();
    if (this.userPaused) this.hud.hold('Paused — press P to continue');
    else { this.hud.release(); this.hud.message('Resumed', 1.5); }
  }

  updatePaused() { this.paused = document.hidden || this.lost || this.userPaused || this.menu.isOpen; }

  openMenu() {
    if (this.menu.isOpen) return;
    this.menu.open();
    this.setMenuOpen(true);
  }

  /** The menu stops the battle, the scrolling and any half-drawn selection box. */
  setMenuOpen(open) {
    this.cameraControl.suspended = open;
    if (open) { this.controller.setMode(null); this.overlay.setDragBox(null); }
    this.updatePaused();
    this.last = performance.now();
  }

  /** Options changed in the in-game menu: most are read live from `settings`; these need a nudge. */
  applySetting(key, value) {
    if (key === 'gameSpeed') this.speed = GAME_SPEED[value] ?? 1;
    else if (key === 'volume') { this.sound.volume = value; this.sound.setMuted(this.sound.muted); }
    else if (key === 'sound') this.sound.setMuted(!value);
    else if (key === 'voiceVolume') this.announcer.player.setVolume(value);
  }

  frame(now) {
    const { world, r3d } = this;
    const raw = Math.max(0, (now - this.last) / 1000);
    const dt = Math.min(0.1, raw);   // camera, HUD and animation step
    this.last = now;
    // the loop gets the real interval: it caps a stall at 0.25 s itself, so slow devices do not play in slow motion
    const { steps, alpha } = this.paused ? { steps: 0, alpha: 1 } : this.loop.advance(raw, this.speed);
    this.announcer.frame(now / 1000, this.selection, this.radarWas);   // before the step takes the new orders
    for (let i = 0; i < steps; i++) world.step();
    if (this.debug && world.time >= this.nextInvariantCheck) {
      this.nextInvariantCheck = world.time + 1;
      const problems = checkInvariants(world);
      if (problems.length) console.error('invariants:', problems.slice(0, 5).join('; '));
    }
    this.handleEvents();
    this.selection.prune((id) => { const u = world.units.get(id); return !!u && !u.inside && unitVisibleTo(world, this.house, u); }, (id) => { const s = world.structures.get(id); return !!s && structureVisibleTo(world, this.house, s); });
    this.onFrame?.(dt);
    this.cameraControl.update(dt);
    this.rig.update(dt, this.heightAt);
    r3d.follow(this.rig.target.x, this.rig.target.z, this.rig.distance * 1.1);
    const e = r3d.camera.matrixWorld.elements;
    this.sound.setListener(this.rig.target.x, this.rig.target.z, e[0], e[2], this.rig.distance);
    this.stage.sync(alpha, dt, now);
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
