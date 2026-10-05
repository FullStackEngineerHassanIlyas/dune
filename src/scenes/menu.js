// Main menu (spec §5.8): Arrakis turning in space, then a live battle, behind the title and the menu
// screens (menu backdrop spec); the old flight over the dunes stays as the fallback. Each battle runs
// in a frame laid over the menu: full screen carries from the menu into the battle and back, and
// quitting simply throws the frame away. The title theme (spec §6 Music) plays from the first click or
// key and rests while a battle is in the frame.
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
import { changeSetting } from '../ui/options.js';
import { toggleFullscreen, isFullscreen, onFullscreenChange } from '../ui/fullscreen.js';
import { MenuBackdrop } from './menu-backdrop.js';
import { MenuMusic } from '../audio/music/music.js';

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
  const seed = params.num('seed', 1 + Math.floor(Math.random() * 9999));
  let backdrop = { start() {}, stop() {} };
  try {
    backdrop = new MenuBackdrop({ settings, seed, hold: params.str('backdrop') });
  } catch (err) {
    console.warn('menu backdrop:', err);
    for (const el of document.querySelectorAll('.mb-fade, .mb-zoom, .mb-caption')) el.remove();
    try { backdrop = flyover(settings, seed); } catch (err2) { console.warn('menu flyover:', err2); }
  }
  let frame = null;
  // the title theme from the first click or key (spec §6 Music); ?music=<track id> plays any track instead
  const music = new MenuMusic({ settings, track: params.str('music') });
  // the player's own Sega soundtrack, kept beside the game in its git-ignored original/ folder, joins their music by
  // itself on a local server (not in automated runs, which start from an empty browser on purpose)
  const automated = navigator.webdriver || /HeadlessChrome/.test(navigator.userAgent);
  if (!automated && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    import('../core/user-files.js').then((m) => Promise.all([
      m.importLocalMusic().catch((err) => console.warn('local music:', err)),
      m.importLocalPaks().catch((err) => console.warn('local game files:', err)),
    ])).catch((err) => console.warn('local files:', err));
  }

  const launch = (query) => {
    menu.hide();
    backdrop.stop();
    music.leave();   // the battle in the frame has music of its own
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
  // back from a battle: to the title, or to the screen the battle asked for (a campaign screen)
  const quit = (screen) => {
    frame?.remove();
    frame = null;
    Object.assign(settings, loadSettings(params));   // what the battle's own options changed
    app.classList.add('in-menu');
    // the campaign's results and defeat screens hold the backdrop still, but its GPU context must be back for
    // what follows them (the ending draws the planet on it): start it paused there, a still frame and no loop
    const hold = screen === 'campaign-results' || screen === 'campaign-defeat';
    backdrop.setPaused?.(hold || !settings.menuMotion);
    backdrop.start();
    music.enter();
    menu.show(screen);
    window.focus();
  };
  // Messages from the battle in the frame: { dune: '<type>', ... } goes to the handler registered for the type.
  // 'quit' is the shell's own; the campaign screens register theirs through shell.on (e.g. a mission's result).
  const handlers = new Map([['quit', (data) => quit(data?.screen)]]);
  const shell = { launch, quit, on: (type, handler) => { handlers.set(type, handler); } };

  const menu = new MainMenu(document.getElementById('ui'), { settings, music, shell, backdrop, onStart: launch, onFullscreen: () => toggleFullscreen(), isFullscreen: () => isFullscreen(),
    // Pause background (WCAG 2.2.2), remembered; the flyover fallback cannot pause
    isBackdropPaused: () => !settings.menuMotion,
    onBackdropPause: (paused) => { changeSetting(settings, 'menuMotion', !paused); backdrop.setPaused?.(paused); menu.refresh(); } });
  onFullscreenChange(() => menu.refresh());
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow) return;
    handlers.get(e.data?.dune)?.(e.data);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.altKey && !e.repeat) { e.preventDefault(); toggleFullscreen(); }
  });
  window.__duneShell = shell;
  let started = false;
  const startBackdrop = (opts) => {
    if (started) return;
    started = true;
    backdrop.setPaused?.(!settings.menuMotion);
    backdrop.start(opts);
  };
  window.__dune = { ready: true, scene: 'menu', menu, launch, quit, backdrop: backdrop.debug?.() ?? null, music: music.debug(), get frame() { return frame; } };
  // The opening (scenes/menu-intro.js) plays before the title; it hides the menu while it runs and starts the
  // backdrop when it wants it. Whatever happens, the backdrop and the menu end up running. ?screen=<name> then
  // opens a menu screen straight away (screenshots, development).
  (async () => {
    try { await (await import('./menu-intro.js')).runIntro({ params, settings, app, backdrop, menu, music, startBackdrop, debug: window.__dune }); }
    catch (err) { console.warn('intro:', err); menu.show(); }
    startBackdrop();
    const screen = params.str('screen');
    if (screen) menu.go(screen);
  })();
}
