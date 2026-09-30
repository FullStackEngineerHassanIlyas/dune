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
   * rig: required; only its `target` and `distance` are read, to keep dust and tracks near the camera.
   * onShake(amount): big blasts. plainApron: the ground past the map's edge as bright as the map (the menu).
   */
  constructor({ world, scene, quality, viewer = null, sound = null, rig, onShake = () => {}, plainApron = false }) {
    Object.assign(this, { world, scene, viewer, sound, rig, onShake });
    this.root = new THREE.Group();
    const hf = (this.hf = new Heightfield(world.map, { sub: terrainSubFor(world.map.w, quality), seed: world.map.seed }));
    this.heightAt = (x, z) => hf.heightAt(x, z);
    this.terrain = new TerrainView(world.map, hf, { plainApron });
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
    this.catchingUp = true;   // events simulated ahead: marks yes, fireworks and sound no — cleared when the battle goes live
    this.disposed = false;
    scene.add(this.root);   // last, so a constructor that throws leaves nothing in the caller's scene
  }

  /** One simulation event: its sound, its effect, and what it changes on the ground. */
  onEvent(e, now = performance.now()) {
    if (this.disposed) return;
    if (!this.catchingUp && this.sound) {
      const cue = cueFor(e, this.viewer, (x, z) => this.seen(x, z));
      if (cue) this.sound.play(cue.id, { x: cue.x ?? null, z: cue.z ?? null, rate: 0.94 + Math.random() * 0.12 });
    }
    if (e.type === 'unitBuilt') this.structureViews.notify(e, now);
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
    let x = e.x, z = e.y, lift = 0.45, reach = 0.45;
    if (e.kind === 'unit') {
      const u = this.world.units.get(e.id);
      reach = 0.38;
      if (u) {
        const p = this.unitViews.renderPos(u), m = modelDef(unitModelId(u.typeId)).muzzle;   // the model's gun tip, turned toward the target
        x = p.x; z = p.z;
        lift = (u.alt ?? 0) + (m ? m[1] : onFoot(u.move) ? 0.2 : 0.34);
        if (m) reach = Math.hypot(m[0], m[2]);
      }
      this.unitViews.recoil(e.id);
    }
    x += Math.cos(dir) * reach;
    z += Math.sin(dir) * reach;
    if (e.projectile === 'sonic') this.effects.sonic(x, this.heightAt(x, z) + lift, z, dir);
    else this.effects.muzzle(x, this.heightAt(x, z) + lift, z, big);
  }

  /** The per-frame view update: fog shroud, views, shots in flight, dust and tracks, particles, ground. */
  sync(alpha, dt, now) {
    if (this.disposed) return;
    const world = this.world;
    if (world.fogOfWar && this.shroud.update(world.houses.get(this.viewer)?.fog)) this.terrain.setShroud(this.shroud.explored, this.shroud.visible);
    this.unitViews.sync(world, alpha, dt);
    this.structureViews.sync(world, now);
    this.combatEffects(dt, alpha);
    this.missiles.sync(world, alpha, this.heightAt, (x, z) => this.seen(x, z));
    this.ambient(dt, now);
    this.effects.update(dt);
    this.terrain.update(now);
  }

  /** Creates every unit, structure and missile view now, drawing no effects: a caller can then compile the battle's shaders ahead. */
  prime(now) {
    if (this.disposed) return;
    this.unitViews.sync(this.world, 1, 0);
    this.structureViews.sync(this.world, now);
    this.missiles.sync(this.world, 1, this.heightAt, (x, z) => this.seen(x, z));
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
    if (this.weldClock >= 0.12) {   // welding sparks over occupied repair pads the viewer can see
      this.weldClock = 0;
      for (const s of w.structures.values()) {
        if (!s.bay || !nearCamera(s.x + s.w / 2, s.y + s.h / 2, rig.target.x, rig.target.z, rig.distance) || !this.seen(s.x + s.w / 2, s.y + s.h / 2)) continue;
        const p = this.structureViews.weldPoint(s.id, now);
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
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.unitViews.dispose();
    this.structureViews.dispose();
    this.missiles.dispose();
    this.effects.dispose();
    this.terrain.dispose();
  }
}
