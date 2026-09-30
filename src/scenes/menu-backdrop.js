// The main menu's 3D backdrop (menu backdrop spec): Arrakis turning in space, a dive into the planet,
// a live battle between two random houses and a climb back out, on a loop and on one renderer. The
// next battle is built, simulated ahead, primed and compiled while the planet is on screen, so the
// swap under the haze has nothing left to do.
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

const SOUND_SHARE = 0.3;      // the battle behind the menu plays at this share of the Options volume
const PRESIM_BUDGET_MS = 6;   // simulation run ahead per frame while the planet is on screen
const FOCUS_RIGHT = 0.25;     // wide screens: the fight sits this share of the half-width right of centre, clear of the menu
const CAPTION = 'The planet Arrakis, known as Dune.';

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
    this.next = null;      // the battle being prepared: { director, stage, ticksLeft, ready }
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
    this.overlays();   // fade, scrim and mute right before the first frame, which may take a while to build
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
    if (c.hold !== 'planet' && (c.phase === 'planet' || c.phase === 'dive')) this.prepare();
    const entered = c.advance(dt, !!this.next?.ready);
    if (entered) this.enter(entered);
    if (c.phase === 'planet' || c.phase === 'dive' || !this.battle) this.drawPlanet(dt);
    else this.drawBattle(dt, now);
    this.overlays();
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
    });
    return { director, stage, ticksLeft: Math.round(SHOWCASE.lead / DT), ready: false };
  }

  /**
   * Every view exists and every material is compiled for the composer's target (before the old battle's programs are
   * released); the old battle goes. Left for the first battle frame, under the opaque haze: the new battle's texture
   * uploads and, once per page, the shadow-depth programs.
   */
  finish(n) {
    n.stage.prime(performance.now());
    this.r3d.compile();
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
    this.battle.stage.root.removeFromParent();
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
    this.planet.update(dt, { dive, aspect: r3d.width / r3d.height, reduced: this.reduced, pixelRatio: r3d.renderer.getPixelRatio() });
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
    if (c.phase === 'battle') {
      this.shot = cam.shot;
      const aspect = r3d.width / r3d.height;
      if (aspect > 1) {   // wide screens: look a little left of the fighting, so it sits right of centre, clear of the menu
        const side = FOCUS_RIGHT * cam.distance * Math.tan((r3d.camera.fov * Math.PI) / 360) * aspect;
        cam.x -= Math.cos(cam.yaw) * side;
        cam.z += Math.sin(cam.yaw) * side;
      }
    }
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
    this.app.classList.toggle('mb-battle', c.phase !== 'planet');   // from the dive on: the planet close up and the haze are as bright as the battle
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
