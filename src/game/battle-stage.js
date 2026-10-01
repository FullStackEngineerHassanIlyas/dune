// Everything between a World and the picture that is not input or HUD (menu backdrop spec): terrain,
// unit, structure and missile views, particle effects, tracks and dust, and the sound cues of
// simulation events. The game view and the main menu's battle both draw through one. All of its
// scene objects hang under `root`, so dispose() can take a finished battle off the GPU.
// `catchingUp` gates only onEvent's effects and sounds; sync() always draws.
import * as THREE from 'three';
import { terrainSubFor } from '../render/quality.js';
import { Heightfield } from '../render/heightfield.js';
import { TerrainView } from '../render/terrain.js';
import { UnitViews } from '../render/views/unit-views.js';
import { modelDef, unitModelId } from '../render/models/index.js';
import { StructureViews } from '../render/views/structure-views.js';
import { ShroudSync } from '../render/shroud.js';
import { Effects } from '../render/effects.js';
import { Destruction } from '../render/destruction.js';
import { MissileViews } from '../render/views/missile-views.js';
import { ShotFx } from '../render/shot-fx.js';
import { nearCamera } from '../render/near-camera.js';
import { cueFor } from '../audio/cues.js';
import { isVisible } from '../sim/fog.js';
import { UNITS, onFoot } from '../data/units.js';
import { G } from '../data/terrain.js';

const GROUND_NAME = { [G.SAND]: 'sand', [G.DUNE]: 'dune', [G.ROCK]: 'rock', [G.MOUNTAIN]: 'mountain' };
const BLAST_RADIUS = { small: 0.6, medium: 1, large: 1.8 };
/** How big a rocket's launch and its mark are, by weapon: Troopers' and Ornithopters' mini-rockets are smaller. */
const LAUNCH_SCALE = { miniRocket: 0.5, trooperRocket: 0.5 };
const MARK_SCALE = { miniRocket: 0.65, trooperRocket: 0.65, turretRocket: 0.9 };

export class BattleStage {
  /**
   * world: the simulation. scene: where `root` goes. quality: the renderer's preset. viewer: the house
   * whose fog decides what shows (null: everything). sound: a SoundEngine, or null for silence.
   * rig: required; only its `target` and `distance` are read, to keep dust and tracks near the camera.
   * onShake(amount): big blasts. plainApron: the ground past the map's edge as bright as the map (the menu).
   */
  constructor({ world, scene, quality, viewer = null, sound = null, rig, onShake = () => {}, plainApron = false }) {
    Object.assign(this, { world, scene, viewer, sound, rig, onShake });
    this.root = new THREE.Group();
    const hf = (this.hf = new Heightfield(world.map, { sub: terrainSubFor(world.map.w, quality), seed: world.map.seed }));
    this.heightAt = (x, z) => hf.heightAt(x, z);
    this.positionOf = (u) => this.unitViews.renderPos(u);
    this.terrain = new TerrainView(world.map, hf, { plainApron });
    this.root.add(this.terrain.group);
    this.unitViews = new UnitViews(this.root, hf, { viewer });
    this.structureViews = new StructureViews(this.root, hf, { viewer });
    this.shroud = new ShroudSync(world.map.w * world.map.h);
    this.effects = new Effects(this.root, quality);
    this.missiles = new MissileViews(this.root);
    this.shotFx = new ShotFx(this.effects);
    this.seenAt = (x, z) => this.seen(x, z);
    this.volley = new Map();   // unit id → shots fired, to alternate twin barrels
    this.destruction = new Destruction(this.root, quality, {
      effects: this.effects, hf, decals: this.terrain.decals, onShake,
      seen: (x, z) => this.seen(x, z), near: (x, z) => nearCamera(x, z, rig.target.x, rig.target.z, rig.distance),
    });
    this.dustClock = 0;
    this.weldClock = 0;
    this.weldSound = 0;   // seconds until the repair weld may sound again
    this.trackFrom = new Map();
    this.catchingUp = true;   // events simulated ahead: marks yes, fireworks and sound no — cleared when the battle goes live
    this.disposed = false;
    scene.add(this.root);   // last, so a constructor that throws leaves nothing in the caller's scene
  }

  /** One simulation event: its sound, its effect, and what it changes on the ground. */
  onEvent(e, now = performance.now()) {
    if (this.disposed) return;
    if (!this.catchingUp && this.sound) {
      const cue = cueFor(e, this.viewer, (x, z) => this.seen(x, z));
      if (cue) this.sound.play(cue.id, { x: cue.x ?? null, z: cue.z ?? null });   // the engine varies each effect's pitch itself
    }
    if (e.type === 'unitBuilt') this.structureViews.notify(e, now);
    if (e.type === 'structurePlaced') {
      const s = this.world.structures.get(e.id);
      if (s) { this.terrain.flattenFootprint(s.x, s.y, s.w, s.h); this.destruction.structurePlaced(s); }
      if (s && !this.catchingUp && this.seen(s.x + s.w / 2, s.y + s.h / 2)) this.constructionDust(s);
    }
    switch (e.type) {
      case 'fired': if (!this.catchingUp) this.onFired(e); break;
      case 'impact': this.onImpact(e); break;
      case 'explosion': {
        if (!this.seen(e.x, e.y)) break;
        const surface = e.alt ? null : this.surfaceAt(e.x, e.y);
        if (!this.catchingUp) this.effects.explosion(e.x, this.heightAt(e.x, e.y) + 0.25 + (e.alt ?? 0), e.y, e.size, surface);
        if (surface) this.terrain.decals?.blast?.(e.x, e.y, BLAST_RADIUS[e.size] ?? 1, surface);
        break;
      }
      case 'deathHandBlast':
        if (!this.catchingUp && this.seen(e.x, e.y)) { this.effects.shockwave(e.x, this.heightAt(e.x, e.y) + 0.2, e.y); this.onShake(1.2); }
        break;
      case 'fremenRose': if (!this.catchingUp && this.seen(e.x, e.y)) this.effects.rise(e.x, this.heightAt(e.x, e.y) + 0.05, e.y); break;
      case 'unitReverted': if (!this.catchingUp && this.seen(e.x, e.y)) this.effects.gasCloud(e.x, this.heightAt(e.x, e.y) + 0.3, e.y); break;
      case 'unitDestroyed':
        if (!this.catchingUp && e.cause === 'destructed' && this.seen(e.x, e.y)) this.onShake(0.6);
        this.volley.delete(e.id);
        this.destruction.unitDestroyed(e, this.unitViews.notifyDeath(e), !this.catchingUp);
        break;
      case 'structureDestroyed':
        this.structureViews.notify(e, now);
        this.destruction.structureDestroyed(e, !this.catchingUp);
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

  /** What the ground is at (x, z) for dust and marks: 'concrete', 'sand', 'dune', 'rock' or 'mountain'. */
  surfaceAt(x, z) {
    const map = this.world.map, tx = Math.floor(x), ty = Math.floor(z);
    if (!map.inBounds(tx, ty)) return 'sand';
    const i = map.idx(tx, ty);
    return map.concrete[i] ? 'concrete' : GROUND_NAME[map.ground[i]] ?? 'sand';
  }

  /** Whether a shot landing at (x, z) that hit something struck metal — a vehicle or a building — rather than a soldier on the ground. */
  struckMetal(x, z) {
    const map = this.world.map, tx = Math.floor(x), ty = Math.floor(z);
    if (!map.inBounds(tx, ty)) return true;
    const i = map.idx(tx, ty), u = this.world.units.get(map.unit[i]);
    return map.structure[i] ? true : u ? !onFoot(u.move) : true;
  }

  /**
   * A shot fired: the flash at the gun's muzzle (twin barrels take turns), a jet of flame along the shot; for a
   * cannon a kick of dust off the ground beneath; for a rocket its launch — flash, backblast and dust.
   */
  onFired(e) {
    if (!this.seen(e.x, e.y)) return;
    const dir = Math.atan2(e.ty - e.y, e.tx - e.x);
    const big = e.projectile !== 'bullet';
    let x = e.x, z = e.y, lift = 0.45, reach = 0.45, side = 0, alt = 0;
    if (e.kind === 'unit') {
      const u = this.world.units.get(e.id);
      reach = 0.38;
      if (u) {
        const p = this.unitViews.renderPos(u), def = modelDef(unitModelId(u.typeId)), m = def.muzzle;   // the model's gun tip, turned toward the target
        x = p.x; z = p.z;
        alt = u.alt ?? 0;
        lift = alt + (m ? m[1] : onFoot(u.move) ? 0.2 : 0.34);
        if (m) reach = Math.hypot(m[0], m[2]);
        if (def.muzzles) {
          const k = this.volley.get(e.id) ?? 0;
          this.volley.set(e.id, k + 1);
          side = def.muzzles[k % def.muzzles.length][2];
        }
      }
      this.unitViews.recoil(e.id);
    }
    const c = Math.cos(dir), s = Math.sin(dir);
    x += c * reach - s * side;
    z += s * reach + c * side;
    const ground = this.heightAt(x, z), y = ground + lift, surface = alt > 0.3 ? null : this.surfaceAt(x, z);
    if (e.projectile === 'sonic') this.effects.sonic(x, y, z, dir);
    else if (e.projectile === 'rocket' || e.projectile === 'gas') this.effects.launch(x, y, z, dir, ground, surface, LAUNCH_SCALE[e.weapon] ?? 1);
    else if (e.projectile === 'deathHand') this.effects.launch(x, y, z, dir, ground, surface, 2);
    else {
      this.effects.muzzle(x, y, z, big, dir);
      if (big && surface) this.effects.groundBlast(x, ground, z, dir, surface);
    }
  }

  /**
   * A shot landing: sparks off metal or a spray of the ground it hit, and the mark it leaves there — a pock, a
   * crater, a scorch (terrain marks show even while catching up, like the scorch of an explosion). A hit on a
   * vehicle or building marks the ground beside it now and then: near misses and the blast's soot.
   */
  onImpact(e) {
    if (!this.seen(e.x, e.y)) return;
    const surface = this.surfaceAt(e.x, e.y), metal = e.hit && this.struckMetal(e.x, e.y);
    if (!this.catchingUp) this.effects.impact(e.x, this.heightAt(e.x, e.y) + 0.12 + (e.alt ?? 0), e.y, e.projectile, metal, e.weapon, surface);
    const decals = this.terrain.decals;
    if (e.alt || e.projectile === 'gas' || !decals?.mark) return;   // a burst in the air, or gas, leaves nothing
    const scale = MARK_SCALE[e.weapon] ?? 1, spread = e.projectile === 'bullet' ? 0.2 : e.projectile === 'shell' ? 0.1 : 0;   // guns that always hit their aim still scatter their marks
    if (!metal || e.projectile === 'rocket') { decals.mark(e.x + (Math.random() - 0.5) * 2 * spread, e.y + (Math.random() - 0.5) * 2 * spread, e.projectile, surface, scale); return; }
    if (Math.random() > (e.projectile === 'bullet' ? 0.35 : 0.6)) return;
    const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 0.3, x = e.x + Math.cos(a) * r, z = e.y + Math.sin(a) * r;
    if (e.projectile === 'bullet') decals.pock(x, z, this.surfaceAt(x, z));
    else decals.stamp('scorch', x, z, 0.5, 0.4);
  }

  /**
   * The per-frame view update: fog shroud, views, shots in flight, dust and tracks, particles, ground. A paused
   * battle passes dt 0 and a `now` that stands still: everything holds, and shots in flight lay no new traces
   * (a tracer is laid every frame and lives for one, so frozen frames would pile them up on the spot).
   */
  sync(alpha, dt, now) {
    if (this.disposed) return;
    const world = this.world;
    if (world.fogOfWar && this.shroud.update(world.houses.get(this.viewer)?.fog)) this.terrain.setShroud(this.shroud.explored, this.shroud.visible);
    this.unitViews.sync(world, alpha, dt);
    this.structureViews.sync(world, now);
    if (dt > 0) this.combatEffects(dt, alpha);
    this.missiles.sync(world, alpha, this.heightAt, this.seenAt);
    this.ambient(dt, now);
    this.destruction.update(dt);
    this.effects.update(dt);
    this.terrain.update(now);
  }

  /** Creates every unit, structure and missile view now, drawing no effects: a caller can then compile the battle's shaders ahead. */
  prime(now) {
    if (this.disposed) return;
    this.unitViews.sync(this.world, 1, 0);
    this.structureViews.sync(this.world, now);
    this.missiles.sync(this.world, 1, this.heightAt, this.seenAt);
  }

  /** Tracers and trails for shots in flight (interpolated between ticks; rockets arc), and smoke and fire from the wounded. */
  combatEffects(dt, alpha) {
    const w = this.world;
    this.shotFx.update(w, alpha, this.heightAt, this.seenAt);
    this.destruction.wounded(w, dt, this.positionOf);
  }

  /** Dust behind vehicles on sand, tread marks and harvest dust (spec §5.4). */
  ambient(dt, now) {
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
    this.weldSound -= dt;
    if (this.weldClock >= 0.12) {   // welding sparks over occupied repair pads the viewer can see, and now and then their crackle
      this.weldClock = 0;
      for (const s of w.structures.values()) {
        if (!s.bay || !nearCamera(s.x + s.w / 2, s.y + s.h / 2, rig.target.x, rig.target.z, rig.distance) || !this.seen(s.x + s.w / 2, s.y + s.h / 2)) continue;
        const p = this.structureViews.weldPoint(s.id, now);
        if (p) this.effects.weld(p.x, p.y, p.z);
        if (p && this.weldSound <= 0 && !this.catchingUp) { this.sound?.play('weld', { x: p.x, z: p.z }); this.weldSound = 0.9 + Math.random() * 0.8; }
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
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.unitViews.dispose();
    this.structureViews.dispose();
    this.missiles.dispose();
    this.destruction.dispose();
    this.effects.dispose();
    this.terrain.dispose();
  }
}
