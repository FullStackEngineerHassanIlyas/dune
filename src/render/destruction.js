// Death and destruction on the battlefield (spec §5.4: explosions with debris and scorch, burning and
// smoking structures; §5.3: destroyed structures collapse into burning rubble). Turns 'unitDestroyed'
// and 'structureDestroyed' into a fireball, secondary blasts, tumbling debris and a burning wreck for
// vehicles, a puff (and a stain when crushed) for infantry, and for buildings a staged collapse of
// blasts across the footprint, chunks, a dust cloud and fires over the rubble left behind
// (visual-structures.md "Destroyed"). Also the damage states (visual-units.md §1.1, structures.md
// FAQ): smoke past half health, flames and sparks past a quarter, from fixed points on each hull
// and roof. Render-only: the simulation never waits on any of it.
import { Color } from 'three';
import { Debris } from './debris.js';
import { Rubble } from './rubble.js';
import { Wrecks, modelTop } from './wrecks.js';
import { fireball, blast, fire, blackSmoke, greySmoke, sparks, spiceBurst, collapseDust } from './burn-fx.js';
import { modelDef, unitModelId, structureModelId } from './models/index.js';
import { UNITS, onFoot } from '../data/units.js';
import { STRUCTURES } from '../data/structures.js';
import { HOUSES } from '../data/houses.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const frac = (v) => v - Math.floor(v);
const tone = new Color();
const scorched = (hex) => tone.set(hex).multiplyScalar(0.5).getHex();   // house paint, blistered and sooted
const VEHICLE_BITS = [0x1c1a18, 0x2a2826, 0x3c3f46, 0x55504a, 0x201e1c];
const BUILDING_BITS = [0x8e8a84, 0x9c958b, 0x6e6a66, 0x3c3f46, 0xb0a898, 0x5c3c24];

export class Destruction {
  /**
   * effects: the Effects pools. hf: the Heightfield. decals: the terrain's DecalMap (or null).
   * seen(x, z): the viewer can see there. explored(x, z): the viewer has lifted the shroud there.
   * near(x, z): close enough to the camera to be worth smoke.
   */
  constructor(scene, quality, { effects, hf, decals = null, seen = () => true, explored = () => true, near = () => true, onShake = () => {} }) {
    Object.assign(this, { fx: effects, hf, decals, seen, explored, near, onShake });
    const budget = quality.particles ?? 4000, shadows = (quality.shadows ?? 0) > 0;
    this.density = clamp(budget / 4000, 0.45, 1.5);   // Low 0.45, Medium 1, High 1.5
    this.debris = new Debris(scene, { capacity: Math.round(budget / 25), castShadow: shadows });
    this.rubble = new Rubble(scene, { capacity: Math.round(budget / 8), castShadow: shadows });
    this.wrecks = new Wrecks(scene, hf, { cap: Math.round(6 + budget / 250), castShadow: shadows });
    this.heightAt = (x, z) => hf.heightAt(x, z);
    this.visible = (x, z) => this.near(x, z) && this.seen(x, z);
    // smoke that only lingers yields to fresh combat effects: it stops while the pools are over two-thirds full
    this.lingers = (x, z) => this.fx.smoke.n < this.fx.smoke.capacity * 0.68 && this.fx.glow.n < this.fx.glow.capacity * 0.8 && this.visible(x, z);
    this.crash = (w) => this.crashed(w);
    this.sites = [];     // burning ruins
    this.buried = [];    // ruins under the shroud: their rubble is laid once the viewer has explored the ground
    this.pending = [];   // blasts and dust still to come, in seconds of this.time
    this.roofs = new Map();
    this.time = 0;
    this.woundClock = 0;
  }

  /**
   * A unit died. pose: its view's last state ({ x, z, heading, turret, alt, visible, inside }) or null.
   * live: false while the battle is being simulated ahead (marks only, no fireworks).
   */
  unitDestroyed(e, pose, live = true) {
    const p = pose ?? { x: e.x, z: e.y, heading: 0, turret: 0, alt: 0, visible: true, inside: false };
    if (p.inside || p.visible === false || !this.seen(p.x, p.z)) return;   // in a building, or out of sight
    const type = UNITS[e.typeId], gy = this.hf.heightAt(p.x, p.z);
    if (onFoot(type?.move)) {
      if (e.cause === 'crushed') this.decals?.blob?.(p.x, p.z, 0.3, 'rgba(96,22,14,0.6)', 'rgba(80,40,26,0.28)');
      if (live && e.cause !== 'detonated') {
        this.fx.dust(p.x, gy + 0.04, p.z, e.cause === 'crushed' ? 1 : 0.6);
        this.fx.smokePuff(p.x, gy + 0.1, p.z);
      }
      return;
    }
    const id = unitModelId(e.typeId), k = clamp(((modelDef(id).radius ?? 0.5) - 0.3) / 0.25, 0.7, 1.4);
    const alt = p.alt ?? 0, air = alt > 0.12;
    if (!air) this.decals?.crater?.(p.x, p.z, 0.32 * k, 0.4);   // burnt oil under the wreck
    if (!live) return;
    const house = HOUSES[e.house]?.color ?? 0x777777, y = gy + alt + 0.15 * k;
    const destructed = e.cause === 'destructed';
    fireball(this.fx, p.x, y, p.z, air ? 0.8 * k : k);
    this.throwBits(p.x, y, p.z, destructed ? 1.6 : k, house, VEHICLE_BITS, Math.round((destructed ? 18 : 9 * k) * this.density), false);
    if (e.typeId === 'harvester') spiceBurst(this.fx, p.x, gy + 0.2, p.z);
    for (let i = 0, n = k >= 0.9 ? 2 : 1; i < n; i++) {   // fuel and ammunition cooking off
      this.pending.push({ at: this.time + (i ? rnd(0.5, 0.85) : rnd(0.18, 0.34)), kind: 'blast', x: p.x + rnd(-0.25, 0.25) * k, y: y - 0.05, z: p.z + rnd(-0.25, 0.25) * k, k: i && k > 1.2 ? 0.9 : 0.6, house });
    }
    if (k >= 1.2 && !air) this.onShake(0.25);
    if (destructed) return;   // a Devastator's own blast leaves nothing to burn
    const drift = air ? 1.1 : 0;
    this.wrecks.add({ modelId: id, x: p.x, z: p.z, heading: p.heading ?? 0, turret: p.turret ?? p.heading ?? 0, alt, vx: Math.cos(p.heading ?? 0) * drift, vz: Math.sin(p.heading ?? 0) * drift, size: k, life: 18 + 14 * k + rnd(0, 5), burn: 6 + 5 * k + rnd(0, 3) });
  }

  /** A falling wreck hits the ground. */
  crashed(w) {
    const gy = this.hf.heightAt(w.x, w.z);
    this.decals?.scorch?.(w.x, w.z, 0.9 * w.size);
    if (!this.visible(w.x, w.z)) return;
    blast(this.fx, w.x, gy + 0.2, w.z, 1.1);
    fireball(this.fx, w.x, gy + 0.1, w.z, 0.8 * w.size, false);
    this.throwBits(w.x, gy + 0.15, w.z, w.size, 0x55504a, VEHICLE_BITS, Math.round(6 * this.density), false);
    this.onShake(0.2);
  }

  /** Debris thrown from (x, y, z): n pieces, sized by k, some painted in the house colour, a few trailing fire. */
  throwBits(x, y, z, k, house, palette, n, building) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rnd(0.5, building ? 2.4 : 2.2) * (building ? 1 : k);
      const plate = Math.random() < 0.6, big = building ? rnd(0.09, 0.26) : rnd(0.05, 0.14) * k;
      const size = plate ? [big, big * rnd(0.12, 0.25), big * rnd(0.6, 1)] : [big * 0.7, big * rnd(0.5, 0.8), big * 0.7];
      const color = Math.random() < 0.25 ? scorched(house) : palette[Math.floor(Math.random() * palette.length)];
      this.debris.emit({ x: x + Math.cos(a) * 0.1, y, z: z + Math.sin(a) * 0.1, vx: Math.cos(a) * s, vy: rnd(2.2, building ? 5.5 : 4.8), vz: Math.sin(a) * s, size, color, rest: rnd(4, building ? 9 : 7), burn: Math.random() < 0.3 ? rnd(0.6, 1.5) : 0 });
    }
  }

  /**
   * A structure was destroyed. Rubble and scorch stay on the footprint for the battle (even when
   * simulated ahead; rubble under the shroud waits until the viewer explores it); when live and seen,
   * it goes down in a staged collapse over about 1.5 s.
   */
  structureDestroyed(e, live = true) {
    const { x, y, w, h } = e, cx = x + w / 2, cz = y + h / 2, area = w * h;
    const wall = !!STRUCTURES[e.typeId]?.isWall, house = HOUSES[e.house]?.color ?? 0x888888;
    this.roofs.delete(e.id);
    const ruin = { x, y, w, h, house, wall };
    if (this.uncovered(ruin)) this.ruins(ruin);
    else this.buried.push(ruin);
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) this.decals?.scorch?.(tx + rnd(0.3, 0.7), ty + rnd(0.3, 0.7), wall ? 0.5 : 0.8);
    if (area >= 4) this.decals?.crater?.(cx, cz, Math.max(w, h) * 0.5, 0.45);
    if (!live || !this.seen(cx, cz)) return;
    const gy = this.hf.heightAt(cx, cz), top = modelTop(modelDef(structureModelId(e.typeId, w, h)));
    fireball(this.fx, cx, gy + 0.3, cz, wall ? 0.6 : 1.1, false);   // the simulation's large blast is already at the centre
    this.throwBits(cx, gy + top * 0.5, cz, 1, house, BUILDING_BITS, Math.round((wall ? 4 : 6 + area * 2) * this.density), true);
    const n = wall ? 1 : clamp(area, 2, 7);
    for (let i = 0; i < n; i++) {   // blasts marching across the footprint as it comes down
      this.pending.push({ at: this.time + 0.15 + (i / n) * 1.45 + rnd(0, 0.1), kind: 'blast', x: x + rnd(0.2, w - 0.2), y: gy + rnd(0.15, 0.7) * top, z: y + rnd(0.2, h - 0.2), k: area >= 6 && i % 2 === 0 ? 1.1 : 0.75, house, building: true });
    }
    this.pending.push({ at: this.time + (wall ? 0.25 : 1.35), kind: 'dust', x: cx, y: gy, z: cz, w, h });
    if (area >= 6) this.onShake(0.35);
    else if (area >= 4) this.onShake(0.2);
    if (wall) return;
    const points = [];
    for (let i = 0, m = clamp(Math.round(area * 0.6), 2, 5); i < m; i++) points.push({ x: x + rnd(0.3, w - 0.3), z: y + rnd(0.3, h - 0.3) });
    this.sites.push({ x, y, w, h, cx, cz, points, age: 0, fireFor: 10 + area * 1.5 + rnd(0, 4), smokeFor: 26 + area * 2.5, clock: 0 });
  }

  /** Whether the viewer has explored every tile of a ruin's footprint (rubble drawn sooner would show on the black). */
  uncovered({ x, y, w, h }) {
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) if (!this.explored(tx + 0.5, ty + 0.5)) return false;
    return true;
  }

  ruins({ x, y, w, h, house, wall }) { this.rubble.site(x, y, w, h, this.heightAt, { house, wall, density: this.density }); }

  /** The shroud has lifted somewhere: ruins it hid now get their rubble. */
  uncover() {
    for (let i = 0; i < this.buried.length; i++) if (this.uncovered(this.buried[i])) this.ruins(this.buried.splice(i--, 1)[0]);
  }

  /** A new building (or concrete) on old ruins: the rubble, the wrecks and the fires there go. */
  structurePlaced(s) {
    const apart = (o) => o.x >= s.x + s.w || o.x + o.w <= s.x || o.y >= s.y + s.h || o.y + o.h <= s.y;
    this.rubble.clear(s.x, s.y, s.w, s.h);
    this.wrecks.clear(s.x, s.y, s.w, s.h);
    this.sites = this.sites.filter(apart);
    this.buried = this.buried.filter(apart);
  }

  /**
   * Damage states, every 0.1 s: vehicles past half health trail grey smoke from the engine deck, past
   * a quarter black smoke with flames and sparks; buildings smoke from one to three fixed points on
   * the roof as they weaken, and burn below a quarter. positionOf(u): the unit's drawn position.
   */
  wounded(world, dt, positionOf) {
    if ((this.woundClock += dt) < 0.1) return;
    this.woundClock = 0;
    const fx = this.fx, rate = Math.min(1, this.density);
    for (const u of world.units.values()) {
      if (u.inside || u.hp > u.maxHp / 2 || onFoot(u.move)) continue;
      const p = positionOf(u);
      if (!this.lingers(p.x, p.z)) continue;
      const r = modelDef(unitModelId(u.typeId)).radius ?? 0.5, crit = u.hp <= u.maxHp / 4;
      const x = p.x - Math.cos(u.heading) * r * 0.42, z = p.z - Math.sin(u.heading) * r * 0.42;   // the engine deck, behind any turret
      const y = this.hf.heightAt(x, z) + (u.alt ?? 0) + r * 0.62;
      if (Math.random() < 0.6 * rate) (crit ? blackSmoke : greySmoke)(fx, x, y, z, crit ? 0.55 : 0.7);
      if (crit && Math.random() < 0.7) fire(fx, x, y - 0.04, z, 0.5);
      if (crit && Math.random() < 0.1) sparks(fx, x, y, z, 3);
    }
    for (const s of world.structures.values()) {
      if (s.hp > s.maxHp / 2 || s.type.isWall || !this.lingers(s.x + s.w / 2, s.y + s.h / 2)) continue;
      const pts = this.roofPoints(s), f = s.hp / s.maxHp, crit = f <= 0.25;
      for (let i = 0, n = crit ? 3 : f <= 0.375 ? 2 : 1; i < n; i++) {
        const p = pts[i];
        if (Math.random() < 0.7 * rate) (crit ? blackSmoke : greySmoke)(fx, p.x, p.y + 0.08, p.z, crit ? 1 : 1.1);
        if (crit || Math.random() < 0.3) fire(fx, p.x, p.y, p.z, crit ? 0.85 : 0.55);
        if (crit && Math.random() < 0.06) sparks(fx, p.x, p.y, p.z, 4);
      }
    }
    if (this.roofs.size > world.structures.size + 32) for (const id of this.roofs.keys()) if (!world.structures.has(id)) this.roofs.delete(id);
  }

  /** Three fixed points on a building's roof, the same every time, where its fires and smoke come from. */
  roofPoints(s) {
    let pts = this.roofs.get(s.id);
    if (pts) return pts;
    const top = modelTop(modelDef(structureModelId(s.typeId, s.w, s.h))), base = this.hf.heightAt(s.x + s.w / 2, s.y + s.h / 2);
    pts = [0, 1, 2].map((k) => {
      const a = frac(Math.sin(s.id * 12.9898 + k * 78.233) * 43758.5), b = frac(Math.sin(s.id * 39.346 + k * 11.135) * 24634.6);
      return { x: s.x + s.w * (0.22 + 0.56 * a), z: s.y + s.h * (0.22 + 0.56 * b), y: base + top * (0.5 + 0.25 * frac(a + b)) };
    });
    this.roofs.set(s.id, pts);
    return pts;
  }

  /** Staged blasts, debris, wrecks and burning ruins, once a frame. */
  update(dt) {
    this.time += dt;
    const fx = this.fx;
    for (let i = 0; i < this.pending.length; i++) {
      const b = this.pending[i];
      if (b.at > this.time) continue;
      this.pending.splice(i--, 1);
      if (b.kind === 'dust') { collapseDust(fx, b.x, b.y, b.z, b.w, b.h); continue; }
      blast(fx, b.x, b.y, b.z, b.k);
      this.throwBits(b.x, b.y, b.z, b.k, b.house, b.building ? BUILDING_BITS : VEHICLE_BITS, Math.round((b.building ? 3 : 2) * this.density), !!b.building);
    }
    this.debris.update(dt, this.heightAt, fx);
    this.wrecks.update(dt, fx, this.lingers, this.crash, this.density);
    for (let i = 0; i < this.sites.length; i++) {
      const s = this.sites[i];
      if ((s.age += dt) >= s.smokeFor) { this.sites.splice(i--, 1); continue; }
      if ((s.clock -= dt) > 0) continue;
      s.clock = 0.1 / this.density;
      if (!this.lingers(s.cx, s.cz)) continue;
      const left = 1 - s.age / s.smokeFor;
      for (const p of s.points) {
        const gy = this.hf.heightAt(p.x, p.z) + 0.05;
        if (s.age < s.fireFor) {
          fire(fx, p.x, gy, p.z, 0.8 + 0.3 * left);
          if (Math.random() < 0.55) blackSmoke(fx, p.x, gy + 0.2, p.z, 1.2);
        } else if (Math.random() < 0.5 * left) greySmoke(fx, p.x, gy + 0.1, p.z, 1.3);
      }
    }
  }

  dispose() {
    this.debris.dispose();
    this.rubble.dispose();
    this.wrecks.dispose();
    this.sites = [];
    this.pending = [];
    this.buried = [];
  }
}
