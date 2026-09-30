// Main menu (spec §5.8): a slow flight over generated dunes behind the title and the menu screens.
// Each battle runs in a frame laid over the menu: full screen carries from the menu into the battle
// and back, and quitting simply throws the frame away.
import * as THREE from 'three';
import { Renderer3D } from '../render/renderer.js';
import { terrainSubFor } from '../render/quality.js';
import { Heightfield } from '../render/heightfield.js';
import { TerrainView } from '../render/terrain.js';
import { CameraRig } from '../render/camera-rig.js';
import { generateMap } from '../sim/mapgen.js';
import { wakeCheck } from '../render/wake.js';
import { readParams } from '../core/params.js';
import { loadSettings } from '../core/settings.js';
import { MainMenu } from '../ui/main-menu.js';
import { toggleFullscreen, isFullscreen, onFullscreenChange } from '../ui/fullscreen.js';

const SIZE = 128;   // wide enough that the flight never shows the edge of the world

function flyover(settings, seed) {
  const r3d = new Renderer3D(document.getElementById('gl'), settings.quality);
  const { map } = generateMap({ w: SIZE, h: SIZE, seed, players: 2 });
  const hf = new Heightfield(map, { sub: terrainSubFor(SIZE, r3d.quality), seed });
  const terrain = new TerrainView(map, hf);
  r3d.scene.add(terrain.group);
  const rig = new CameraRig(r3d.camera, SIZE, SIZE);
  rig.minPitch = THREE.MathUtils.degToRad(22);
  rig.pitch = rig.goalPitch = THREE.MathUtils.degToRad(28);
  rig.distance = rig.goalDistance = 30;
  const heightAt = (x, z) => hf.heightAt(x, z);
  let raf = 0, last = 0, t = seed % 100;
  const place = () => {
    rig.lookAt(SIZE / 2 + Math.cos(t * 0.021) * 18, SIZE / 2 + Math.sin(t * 0.017) * 18, true);
    rig.yaw = rig.goalYaw = t * 0.035;
  };
  const wake = wakeCheck(() => r3d.refresh());
  const frame = (now) => {
    wake();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;
    place();
    rig.update(dt, heightAt);
    r3d.follow(rig.target.x, rig.target.z, rig.distance * 1.2);
    terrain.update(now);
    r3d.render();
    wake.idle();
    raf = requestAnimationFrame(frame);
  };
  place();
  rig.update(1, heightAt);
  return {
    // behind a battle the flight gives its GPU memory back, and comes back rebuilt from scratch
    start() { if (raf) return; r3d.reclaim(); wake.reset(); raf = requestAnimationFrame((now) => { last = now; frame(now); }); },
    stop() { cancelAnimationFrame(raf); raf = 0; r3d.release(); },
  };
}

export async function start({ search }) {
  const params = readParams(search);
  const settings = loadSettings(params);
  const app = document.getElementById('app');
  app.classList.add('in-menu');
  let backdrop = { start() {}, stop() {} };
  try { backdrop = flyover(settings, params.num('seed', 1 + Math.floor(Math.random() * 9999))); } catch (err) { console.warn('menu backdrop:', err); }
  let frame = null;

  const launch = (query) => {
    menu.hide();
    backdrop.stop();
    frame = document.createElement('iframe');
    frame.className = 'game-frame';
    frame.title = 'Battle';
    frame.allow = 'fullscreen; autoplay';
    frame.src = `${location.pathname}?${query}`;
    frame.addEventListener('load', () => frame?.contentWindow?.focus());
    app.appendChild(frame);
    app.classList.remove('in-menu');
    const loading = document.createElement('div');
    loading.className = 'mm-loading';
    loading.textContent = 'Preparing the battlefield…';
    app.appendChild(loading);
    const current = frame, t0 = performance.now();
    const wait = () => {
      let ready = false;
      try { ready = current.contentWindow?.__dune?.ready === true || !!current.contentDocument?.querySelector('.fatal'); } catch { ready = true; }
      if (ready || frame !== current || performance.now() - t0 > 120000) loading.remove();
      else setTimeout(wait, 100);
    };
    wait();
  };
  const quit = () => {
    frame?.remove();
    frame = null;
    Object.assign(settings, loadSettings(params));   // what the battle's own options changed
    app.classList.add('in-menu');
    backdrop.start();
    menu.show();
    window.focus();
  };

  const menu = new MainMenu(document.getElementById('ui'), { settings, onStart: launch, onFullscreen: () => toggleFullscreen(), isFullscreen: () => isFullscreen() });
  onFullscreenChange(() => menu.refresh());
  addEventListener('message', (e) => {
    if (e.origin === location.origin && frame && e.source === frame.contentWindow && e.data?.dune === 'quit') quit();
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.altKey && !e.repeat) { e.preventDefault(); toggleFullscreen(); }
  });
  window.__duneShell = { launch, quit };
  backdrop.start();
  window.__dune = { ready: true, scene: 'menu', menu, launch, quit, get frame() { return frame; } };
}
