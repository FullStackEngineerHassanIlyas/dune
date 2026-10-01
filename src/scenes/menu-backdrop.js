// The main menu's 3D backdrop (menu backdrop spec, revision 2): Arrakis turning in space, then one unbroken
// zoom down into a live battle between two random houses and back out again, on a loop and on one renderer.
// The dive ends looking straight down into a haze of the battlefield's own fog colour, with dust drifting in it that
// zooms on through the seam. On that frame the last planet picture is copied onto a 2D overlay that zooms with the
// new camera while it fades, over the battle's first frame, whose camera starts deep in its own fog and zooms in at
// the dive's closing rate; the battle shows through a clearing in a veil of dust, which lifts as the camera comes
// down. The way out mirrors it: the last battle frame zooms out and fades over the planet pulling back to its
// framing shot. The next battle is built, simulated ahead, primed and compiled while the planet stands still, so a
// seam has no work left to do. Only a cold start (the menu opening, or back from a skirmish) comes in from black.
// Reduced motion swaps the zooms for haze crossfades; paused, the picture holds still and silent.
import { Renderer3D } from '../render/renderer.js';
import { wakeCheck, WAKE_GAP_MS } from '../render/wake.js';
import { CameraRig } from '../render/camera-rig.js';
import { PlanetShot, SEAM_ALTITUDE, menuShare } from '../render/planet.js';
import { DustVeil } from '../render/dust-veil.js';
import { createDustPass } from '../render/dust-pass.js';
import { BattleStage } from '../game/battle-stage.js';
import { ShowcaseDirector, SHOWCASE } from '../game/showcase-director.js';
import { battleCamera, riseCamera, descentBlend, ENTRY } from '../game/showcase-camera.js';
import { BackdropClock, DURATIONS, HOLD_AT, fadeAt, captionAt, soundLevelAt, HAZE } from '../game/backdrop-timeline.js';
import { SoundEngine } from '../audio/engine.js';
import { FixedLoop } from '../core/loop.js';
import { DT } from '../data/tuning.js';

const SOUND_SHARE = 0.3;      // the battle behind the menu plays at this share of the Options volume
const PRESIM_BUDGET_MS = 6;   // simulation run ahead per frame while the planet is on screen
const FOCUS_RIGHT = 0.25;     // wide screens: the fight sits this share of the half-width right of centre, clear of the menu
const ZOOM_FADE = 0.6;        // seconds the last frame before a seam stays on the overlay, zooming on as it fades
const VEIL = { near: 32, far: 60 };   // camera distances (tiles) between which the dust veil lifts off the map's edges
const DUST = 0.8;             // how strongly the dust in the air shows, deep in the haze
const PLANET_SIDE = new Set(['planet', 'dive', 'emerge']);   // drawn in space; the battle and the rise draw the battle
const CAPTION = 'The planet Arrakis, known as Dune.';
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

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
    this.wake = wakeCheck(() => this.r3d.refresh());   // after the laptop sleeps (render/wake.js)
    this.vignette = this.r3d.grade.uniforms.uVignette.value;   // eased out in the haze, so a zooming copy of the frame keeps its corners
    this.veil = new DustVeil({ w: SHOWCASE.w, h: SHOWCASE.h, color: this.r3d.scene.fog.color });
    this.r3d.scene.add(this.veil.mesh);
    this.dust = createDustPass();
    this.dustLinked = false;
    this.r3d.composer.insertPass(this.dust, this.r3d.composer.passes.indexOf(this.r3d.grade));
    this.planet = new PlanetShot({ seed });
    this.rig = new CameraRig(this.r3d.camera, SHOWCASE.w, SHOWCASE.h);
    this.clock = new BackdropClock({ hold });
    this.loop = new FixedLoop(DT);
    this.sound = new SoundEngine({ enabled: settings.sound, volume: 0 });
    this.next = null;      // the battle being prepared: { director, stage, ticksLeft, ready }
    this.battle = null;    // the battle on screen
    this.retired = null;   // the last battle: off the scene, disposed once the next one has compiled
    this.planetOnly = false;
    this.running = false;
    this.frozen = false;   // paused by the viewer: the loop holds on its current frame
    this.stepping = false; // driven frame by frame by the debug hook: the real-time loop stays off
    this.raf = 0;
    this.last = 0;
    this.shot = -1;
    this.riseFrom = null;
    this.entryRate = this.exitRate = this.measuredRate = null;   // log-distance per second at the seams (see seamRate)
    this.lastDive = 0;
    this.fade = document.createElement('div');
    this.fade.className = 'mb-fade';
    canvas.after(this.fade);
    this.zoom = document.createElement('canvas');   // the seam overlay
    this.zoom.className = 'mb-zoom';
    this.zoom.hidden = true;
    this.fade.after(this.zoom);
    this.zoomCtx = this.zoom.getContext('2d', { alpha: false });
    this.zoomT = 0;      // seconds since the seam
    this.zoomFrom = 1;   // the new camera's distance at the seam
    this.zoomScale = 1;
    this.caption = document.createElement('div');
    this.caption.className = 'mb-caption';
    this.caption.textContent = CAPTION;
    this.caption.setAttribute('aria-hidden', 'true');   // decoration, repeated every loop
    document.getElementById('ui').appendChild(this.caption);
    if (this.clock.phase === 'battle') this.enter('battle');
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.halt(); else this.resume(); });
    // a resize clears the canvas: paused, draw the same moment again rather than leave it blank
    addEventListener('resize', () => { if (this.frozen && this.running) this.redraw(); });
    // paused, no frames run to notice a sleep: coming back to the page after a long time away rebuilds the
    // GPU side anyway, and a rebuilt context (or a real loss that came back) gets its still drawn again
    let away = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { away = Date.now(); return; }
      if (this.frozen && this.running && Date.now() - away > WAKE_GAP_MS) this.r3d.refresh();
    });
    this.r3d.onContextRestored = () => { if (this.frozen && this.running) this.redraw(); };
    this.app.classList.add('mb-on');   // last: the flyover fallback keeps its own scrim (menu.css)
  }

  /** Paused (the Pause background button, WCAG 2.2.2): the picture holds where it is and falls silent; unpaused, the loop carries on from that moment. */
  setPaused(paused) {
    this.frozen = !!paused;
    if (this.frozen) this.halt();
    else this.resume();
  }

  get paused() { return this.frozen; }

  /** Shown (the menu opening, or back from a skirmish): a cold start in space, in from black; paused, a still planet with its caption. */
  start() {
    if (this.running) return;
    this.running = true;
    this.r3d.reclaim();   // the GPU memory given back during the skirmish, rebuilt from scratch
    this.wake.reset();
    const c = this.clock;
    if (!c.hold) {
      c.restart();
      if (this.frozen) c.t = HOLD_AT.planet;   // past the black, caption up: a still worth looking at, not a fade stuck half-way
      this.retire();
    }
    this.hideZoom();
    try {
      if (c.phase === 'planet') this.planet.startPass(c.t);   // the moon's pass keeps time with the planet phase
      if (this.frozen) this.still();
    } catch (err) { this.fail(err); }
    this.overlays();   // fade, scrim and mute right before the first frame, which may take a while to build
    this.resume();
  }

  /** A skirmish opens over the menu: nothing more to draw or hear. */
  stop() {
    this.running = false;
    this.halt();
    this.r3d.release();   // the skirmish gets the laptop's shared graphics memory
  }

  /** The loop stops (a hidden tab, a skirmish, paused); the canvas keeps its last picture, and the sound (the wind loop) is held, not left running muted behind a battle. */
  halt() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.sound.setMuted(true);
    this.sound.setPaused(true);
  }

  resume() {
    if (this.raf || !this.running || this.frozen || this.stepping || document.hidden) return;
    this.sound.setPaused(false);
    this.raf = requestAnimationFrame((now) => { this.last = now; this.frame(now); });
  }

  frame(now) {
    this.raf = requestAnimationFrame((t) => this.frame(t));
    this.wake();
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    try { this.tick(dt, now); } catch (err) { this.fail(err); }
    this.wake.idle();
  }

  /** Debug only (window.__dune.backdrop.step): the real-time loop stops for good, and each call runs one frame exactly `dt` seconds on. */
  step(dt) {
    this.stepping = true;
    this.halt();
    this.last += dt * 1000;
    try { this.tick(dt, this.last); } catch (err) { this.fail(err); }
  }

  tick(dt, now) {
    const c = this.clock;
    // the next battle is built while the planet stands still, never during a zoom: its hitch would show there
    if (c.phase === 'planet' && c.hold !== 'planet') this.prepare();
    const entered = c.advance(dt, !!this.next?.ready);
    // A seam: the side being left draws its last frame (the planet at the bottom of the dive, the battle at the
    // top of the rise) and it is copied onto the overlay in this same task, while the drawing buffer is still
    // valid; then the other side draws its first frame under it.
    const seam = this.canZoom() && (entered === 'battle' || (entered === 'emerge' && !!this.battle));
    if (seam && entered === 'battle') {
      const alt = this.planet.altitude, from = this.lastDive;
      this.drawPlanet(dt, 1);
      // the closing rate the dive really had, to check the planet's own figure against (debug().rates)
      if (from < 1) this.measuredRate = Math.log(alt / this.planet.altitude) / ((1 - from) * DURATIONS.dive);
    } else if (seam) this.drawBattle(dt, now, 1);
    if (seam) this.capture();
    if (entered) this.enter(entered);
    this.draw(dt, now);
    if (seam) this.startZoom(entered === 'battle');
    else this.zoomStep(dt);
    this.overlays();
  }

  /** This frame's picture: the planet for the planet, the dive and the emerge; the battle for the battle and the rise. */
  draw(dt, now) {
    const c = this.clock;
    if (PLANET_SIDE.has(c.phase) || !this.battle) this.drawPlanet(dt, this.diveFor(c));
    else this.drawBattle(dt, now);
  }

  /** The picture where the loop stands, with no time passing: a paused start, or a skip or a resize while paused. */
  still() {
    this.draw(0, performance.now());
  }

  redraw() {
    try { this.still(); } catch (err) { this.fail(err); }
  }

  /** Background work while the planet is on screen: build the next battle, simulate it ahead in slices, then finish it. */
  prepare() {
    if (this.planetOnly) return;
    const n = this.next;
    if (!n) { this.next = this.build(); return; }
    if (n.ticksLeft > 0) {
      const until = performance.now() + PRESIM_BUDGET_MS;
      do { n.director.run(DT, (e) => n.stage.onEvent(e)); n.ticksLeft--; } while (n.ticksLeft > 0 && performance.now() < until);
      return;
    }
    if (!n.ready) this.finish(n);
  }

  build() {
    const director = new ShowcaseDirector({ seed: this.seed++ });
    const stage = new BattleStage({   // no muzzle lights: in a busy firefight they would flicker the sand faster than 3 times a second
      world: director.world, scene: this.r3d.scene, quality: { ...this.r3d.quality, flashLights: 0 }, viewer: null, sound: this.sound, rig: this.rig,
      onShake: (amount) => { if (!this.reduced) this.rig.shake = Math.max(this.rig.shake, amount); },
      plainApron: true,   // one desert all round, as seen coming down from space
    });
    return { director, stage, ticksLeft: Math.round(SHOWCASE.lead / DT), ready: false };
  }

  /**
   * Every view exists and every material is compiled for the composer's target (before the old battle's programs are
   * released), and one frame is drawn off screen from where the battle will open, so its textures are uploaded and the
   * shadow map's programs linked now, not on the seam's frame; the old battle goes.
   */
  finish(n) {
    n.stage.prime(performance.now());
    this.r3d.compile();
    this.r3d.warm(SHOWCASE.w / 2, SHOWCASE.h / 2, ENTRY.distance);
    this.disposeRetired();
    n.ready = true;
  }

  /** Everything at once, for a held battle and the debug skip. */
  ensureReady() {
    if (!this.next) this.next = this.build();
    const n = this.next;
    if (n.ticksLeft > 0) { n.director.run(n.ticksLeft * DT, (e) => n.stage.onEvent(e)); n.ticksLeft = 0; }
    if (!n.ready) this.finish(n);
  }

  enter(phase) {
    switch (phase) {
      case 'battle':
        if (!this.next?.ready) this.ensureReady();
        this.battle = this.next;
        this.next = null;
        this.battle.stage.catchingUp = false;
        this.loop = new FixedLoop(DT);
        this.shot = -1;
        this.entryRate = this.seamRate(DURATIONS.dive);   // the descent leaves the haze at the dive's closing rate
        break;
      case 'rise': {
        const r = this.rig;
        this.riseFrom = { x: r.goal.x, z: r.goal.z, distance: r.goalDistance, pitch: r.goalPitch, yaw: r.goalYaw };
        this.exitRate = this.seamRate(DURATIONS.emerge);   // and the climb ends at the emerge's opening rate
        break;
      }
      case 'emerge':
        this.retire();
        this.planet.startPass(-DURATIONS.emerge);   // the moon crosses on time in the planet phase that follows
        break;
      case 'planet':
        this.retire();
        break;
    }
  }

  /** The planet camera's zoom rate at the bottom of a dive or an emerge lasting `seconds`: log-altitude per second (null: the camera's own default). */
  seamRate(seconds) {
    const rate = this.planet.diveRate() / seconds;
    return rate > 0 && Number.isFinite(rate) ? rate : null;
  }

  /** The battle leaves the scene; it is disposed after the next one has compiled. */
  retire() {
    if (!this.battle) return;
    this.battle.stage.root.removeFromParent();
    this.disposeRetired();
    this.retired = this.battle;
    this.battle = null;
  }

  disposeRetired() {
    this.retired?.stage.dispose();
    this.retired = null;
  }

  /** How far down the planet camera is: the dive's k on the way in, its reverse on the way out; with reduced motion it stays put. */
  diveFor(c) {
    if (this.reduced) return 0;
    if (c.phase === 'dive') return c.k;
    if (c.phase === 'emerge') return 1 - c.k;
    return 0;
  }

  drawPlanet(dt, dive) {
    const r3d = this.r3d;
    this.planet.update(dt, { dive, aspect: r3d.width / r3d.height, menu: menuShare(r3d.width), reduced: this.reduced, pixelRatio: r3d.renderer.getPixelRatio() });
    this.lastDive = dive;
    this.air(this.planet.haze, Math.log(SEAM_ALTITUDE / this.planet.altitude));
    r3d.render(this.planet.scene, this.planet.camera);
  }

  /**
   * The picture's haze (0..1) and zoom (ln of the zoom from the seam: below 0 in space, above 0 in the battle; one
   * scale for both sides) set the post-processing: the dust in the air shows as the haze thickens, and the vignette
   * eases out, so the overlay zooming a copy of the frame at a seam does not carry dark corners inwards.
   */
  air(haze, zoom) {
    const r3d = this.r3d, u = this.dust.uniforms;
    u.uAmount.value = DUST * haze * haze;
    // off below a visible amount (the orbit's own light haze); on for the very first frame too, with nothing to
    // show, so its program is linked then and not mid-dive
    this.dust.enabled = (!this.reduced && u.uAmount.value > 0.004) || !this.dustLinked;
    this.dustLinked = true;
    u.uZoom.value = zoom;
    u.uAspect.value = r3d.width / r3d.height;
    r3d.grade.uniforms.uVignette.value = this.vignette * (1 - haze);
  }

  /** One battle frame; `riseK` draws the rise at that point instead of where the clock is (the top of the rise, for the seam out). */
  drawBattle(dt, now, riseK = null) {
    const b = this.battle, c = this.clock, r3d = this.r3d, rig = this.rig;
    const { steps, alpha } = this.loop.advance(dt);
    if (steps) b.director.run(steps * DT, (e) => b.stage.onEvent(e));
    const rising = riseK !== null || c.phase === 'rise';
    const cam = rising ? this.riseShot(riseK ?? c.k) : this.battleShot(c.t, b.director);
    const cut = !rising && cam.shot !== this.shot;
    if (!rising) this.shot = cam.shot;
    rig.lookAt(cam.x, cam.z, cut);
    if (cut) rig.target.y = b.stage.heightAt(rig.target.x, rig.target.z);
    // distance, pitch and yaw follow the shot exactly, never eased: at each seam the zoom rate has to be the planet's
    rig.distance = rig.goalDistance = cam.distance;
    rig.pitch = rig.goalPitch = cam.pitch;
    rig.yaw = rig.goalYaw = cam.yaw;
    rig.update(dt, b.stage.heightAt);
    // high up, the map's edges hide in the dust and the picture in the fog; both clear as the camera comes down
    this.veil.strength = smoothstep(VEIL.near, VEIL.far, rig.distance);
    this.air(1 - Math.exp(-((r3d.scene.fog.density * rig.distance) ** 2)), Math.log(ENTRY.distance / rig.distance));
    r3d.follow(rig.target.x, rig.target.z, rig.distance * 1.1);
    const e = r3d.camera.matrixWorld.elements;
    this.sound.setListener(rig.target.x, rig.target.z, e[0], e[2], rig.distance);
    b.stage.sync(alpha, dt, now);
    r3d.render();
  }

  /** The descent out of the haze, then the orbit; one still wide shot of the middle with reduced motion. */
  battleShot(t, d) {
    const reduced = this.reduced, r3d = this.r3d;
    const cam = battleCamera(t, reduced ? d.center : d.hotspot, { reduced, seed: d.seed, from: d.center, entryRate: this.entryRate ?? undefined });
    const aspect = r3d.width / r3d.height;
    if (aspect > 1) {
      // wide screens: look a little left of the fighting, so it sits right of centre, clear of the menu; blended in
      // with the descent, which starts over the middle of the map where the dive came down
      const side = FOCUS_RIGHT * (reduced ? 1 : descentBlend(t)) * cam.distance * Math.tan((r3d.camera.fov * Math.PI) / 360) * aspect;
      cam.x -= Math.cos(cam.yaw) * side;
      cam.z += Math.sin(cam.yaw) * side;
    }
    return cam;
  }

  /** The climb back into the haze, ending at the emerge's opening zoom rate; with reduced motion the last shot holds. */
  riseShot(k) {
    return riseCamera(this.reduced ? 0 : k, this.riseFrom, { exitRate: this.exitRate ?? undefined, duration: DURATIONS.rise });
  }

  canZoom() {
    return !this.reduced && !!this.zoomCtx && !this.r3d.lost;
  }

  /** Copies the frame just drawn onto the overlay, at the canvas's own resolution. */
  capture() {
    const src = this.r3d.canvas, z = this.zoom;
    if (z.width !== src.width || z.height !== src.height) { z.width = src.width; z.height = src.height; }
    this.zoomCtx.drawImage(src, 0, 0);
  }

  /** Shows the captured frame and sets it zooming with the camera now drawing: on in, into the battle; out, back to the planet. */
  startZoom(inwards) {
    this.zoomT = 0;
    this.zoomFrom = this.cameraDistance();
    this.zoom.classList.toggle('out', !inwards);   // shrinking, its edges show: they get soft
    this.zoom.hidden = false;
    this.zoomStyle();
  }

  zoomStep(dt) {
    if (this.zoom.hidden) return;
    this.zoomT += dt;
    if (this.zoomT >= ZOOM_FADE || this.reduced) this.hideZoom();
    else this.zoomStyle();
  }

  /** How far the camera now drawing is from the ground it looks at: the planet's altitude in radii, the battle's distance in tiles. */
  cameraDistance() {
    return PLANET_SIDE.has(this.clock.phase) || !this.battle ? this.planet.altitude : this.rig.distance;
  }

  /** Hides the overlay and lets its full-screen bitmap go until the next seam. */
  hideZoom() {
    this.zoom.hidden = true;
    this.zoom.width = this.zoom.height = 1;
  }

  /**
   * The overlay zooms exactly as the new camera does (both left the seam at the same rate), about the middle of the
   * frame where both cameras look, so the two pictures never drift apart; it fades out eased at both ends.
   */
  zoomStyle() {
    const u = this.zoomT / ZOOM_FADE, s = this.zoom.style;
    this.zoomScale = this.zoomFrom / this.cameraDistance();
    s.transform = `scale(${this.zoomScale.toFixed(4)})`;
    s.opacity = (1 - u * u * (3 - 2 * u)).toFixed(3);
  }

  overlays() {
    const c = this.clock;
    const f = fadeAt(c.phase, c.t, { reduced: this.reduced, cold: c.cold });
    this.fade.style.background = f.color === 'haze' ? HAZE : '#000';
    this.fade.style.opacity = f.opacity.toFixed(3);
    this.caption.style.opacity = captionAt(c.phase, c.t).toFixed(3);
    this.app.classList.toggle('mb-battle', c.phase !== 'planet');   // from the dive on: the planet close up and the haze are as bright as the battle
    const level = soundLevelAt(c.phase, c.t);
    this.sound.volume = this.settings.volume * SOUND_SHARE * level;
    this.sound.setMuted(this.frozen || this.stepping || !this.settings.sound || level === 0);
  }

  /** Straight on to the next phase, with no zoom (debug hook for tests and screenshots). */
  skip() {
    if (this.planetOnly) return;
    const c = this.clock;
    if (c.phase === 'planet' || c.phase === 'dive') this.ensureReady();
    this.hideZoom();
    this.enter(c.skip());
    if (this.frozen && this.running) {
      this.redraw();
      this.overlays();
    }
  }

  /** Something broke: carry on with the planet alone; if the planet broke, leave the menu on black. */
  fail(err) {
    console.warn('menu backdrop:', err);
    this.hideZoom();
    if (this.planetOnly) {
      this.fade.style.background = '#000';
      this.fade.style.opacity = '1';
      this.caption.style.opacity = '0';
      this.app.classList.remove('mb-battle');
      this.stop();
      return;
    }
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
      get paused() { return self.frozen; },
      /** The backdrop's own sound: its context's state (held while a battle or a pause stops the loop), muted or not. */
      get sound() { return { state: self.sound.ctx?.state ?? null, muted: self.sound.muted, held: self.sound.paused }; },
      /** The seam overlay while it shows: its age in seconds, its scale (above 1 zooming in, below 1 out) and its opacity. */
      get zoom() { return self.zoom.hidden ? null : { t: self.zoomT, scale: self.zoomScale, opacity: Number(self.zoom.style.opacity) }; },
      /** Zoom rates at the seams: the entry and exit rates in use, and the closing rate the last dive was measured at. */
      get rates() { return { entry: self.entryRate, exit: self.exitRate, measured: self.measuredRate }; },
      /** Where the camera stands this frame: the planet camera's altitude (planet radii) or the battle camera's distance (tiles). */
      get view() {
        const c = self.clock, space = PLANET_SIDE.has(c.phase) || !self.battle;
        return { phase: c.phase, t: c.t, altitude: space ? self.planet.altitude : null, distance: space ? null : self.rig.distance, pitch: space ? null : self.rig.pitch };
      },
      /** Frame-exact captures: stops the real-time loop and runs one frame `dt` seconds on. */
      step: (dt = 1 / 30) => self.step(dt),
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
