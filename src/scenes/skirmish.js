// Skirmish (plan 1a scope): generated map, both houses' opening forces, RTS camera, selection,
// movement and MCV deployment. Production, combat, fog and AI arrive in plan 1b.
import { Renderer3D } from '../render/renderer.js';
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
import { FixedLoop } from '../core/loop.js';
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { DT, GAME_SPEED } from '../data/tuning.js';
import { setupSkirmish } from '../game/setup.js';
import { createDebugApi } from '../game/debug.js';

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const house = params.str('house', 'atreides');
  const { world, starts } = setupSkirmish({ seed: params.num('seed', 1), size: params.num('size', 64), house, enemy: params.str('enemy') });
  for (let i = 0, n = params.num('ticks', 0); i < n; i++) world.step();

  const canvas = document.getElementById('gl');
  const r3d = new Renderer3D(canvas, settings.quality);
  const hf = new Heightfield(world.map, { sub: r3d.quality.terrainSub, seed: world.map.seed });
  const heightAt = (x, z) => hf.heightAt(x, z);
  const terrain = new TerrainView(world.map, hf);
  r3d.scene.add(terrain.group);
  const unitViews = new UnitViews(r3d.scene, hf);
  const structureViews = new StructureViews(r3d.scene, hf);

  const rig = new CameraRig(r3d.camera, world.map.w, world.map.h);
  const dist = params.num('dist');
  if (dist) rig.goalDistance = rig.distance = dist;
  rig.lookAt(starts[0].x + 0.5, starts[0].y + 2.5, true);
  const cameraControl = new CameraControl(rig, canvas, settings);
  const overlay = new Overlay(document.getElementById('overlay'));
  const hud = new Hud(document.getElementById('ui'));
  const selection = new Selection();
  const groups = new Groups();

  const project = (x, z, lift = 0) => {
    const y = heightAt(x, z) + lift;
    const s = worldToScreen(r3d.camera, x, y, z, r3d.width, r3d.height);
    s.pxPerUnit = pixelsPerUnit(r3d.camera, x, y, z, r3d.height);
    s.visible = s.visible && s.x > -60 && s.x < r3d.width + 60 && s.y > -60 && s.y < r3d.height + 60;
    return s;
  };
  const ground = (sx, sy) => screenToGround(r3d.camera, (sx / r3d.width) * 2 - 1, 1 - (sy / r3d.height) * 2, heightAt);
  const positionOf = (u) => unitViews.renderPos(u);
  const controller = new Controller({
    world, house, selection, groups, settings, project, ground, rig, positionOf,
    viewport: () => ({ left: 0, top: 0, right: r3d.width, bottom: r3d.height }),
    onCursor: makeCursorSetter(canvas),
    onMarker: (x, z) => overlay.marker(x, z),
    onDragBox: (box) => overlay.setDragBox(box),
  });
  new Pointer(canvas, controller);
  new Keyboard((key, code, mods) => controller.onKey(key, code, mods));

  const loop = new FixedLoop(DT);
  const speed = GAME_SPEED[settings.gameSpeed] ?? 1;
  let last = performance.now();
  let paused = document.hidden;
  document.addEventListener('visibilitychange', () => { paused = document.hidden; last = performance.now(); });
  r3d.onContextLost = () => hud.message('The graphics device was reset — reload the page to continue.', 3600);

  const handleEvents = () => {
    for (const e of world.events.drain()) {
      if (e.type === 'eva' && e.house === house) hud.message(e.text);
      else if (e.type === 'deployed' && e.house === house) hud.message('Construction Yard deployed.');
    }
  };

  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const { steps, alpha } = paused ? { steps: 0, alpha: 1 } : loop.advance(dt, speed);
    for (let i = 0; i < steps; i++) world.step();
    handleEvents();
    selection.prune((id) => world.units.has(id));
    cameraControl.update(dt);
    rig.update(dt, heightAt);
    r3d.follow(rig.target.x, rig.target.z, rig.distance * 1.1);
    unitViews.sync(world, alpha, dt);
    structureViews.sync(world, now);
    terrain.update(now);
    r3d.render();
    controller.frame();
    overlay.draw({ world, selection, hoverId: controller.hoverId, project, positionOf, groups, dt, healthBars: settings.healthBars });
    hud.update(dt);
    requestAnimationFrame(frame);
  };

  requestAnimationFrame((now) => {
    last = now;
    rig.update(1, heightAt);
    frame(now);
    window.__dune = createDebugApi({ world, house, selection, project, positionOf, rig });
    window.__dune.ready = true;
  });
}
