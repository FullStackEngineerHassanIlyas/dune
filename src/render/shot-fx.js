// Shots in flight (spec §5.4): each frame, every projectile the viewer can see leaves its trace along the
// one path it shares with its body (views/missile-views.js shotPoint) — a tracer for bullets, a glowing
// streak for shells, the sonic ripple — and rockets, Deviator gas and the Death Hand an exhaust flare and a
// smoke trail laid evenly from the launcher on, whatever the frame rate, that lingers for seconds,
// spreading and drifting (docs/research/raw/units.md "Projectiles": the rocket family's smoke-trail frames).
// Trail records are pooled, so a shot allocates nothing.
import { shotPoint, launchLift } from './views/missile-views.js';

const SMOKY = new Set(['rocket', 'gas', 'deathHand']);
const TRAIL_SCALE = { miniRocket: 0.65, trooperRocket: 0.65 };

export class ShotFx {
  constructor(effects) {
    this.effects = effects;
    this.trails = new Map();   // projectile id → how far its smoke trail has been laid
    this.spare = [];
    this.frame = 0;
    this.pt = { x: 0, y: 0, z: 0, dx: 1, dy: 0, dz: 0, speed: 0, travelled: 0 };
  }

  /** alpha: between the last two ticks; heightAt(x, z): the ground; seen(x, z): whether the viewer sees that spot. */
  update(world, alpha, heightAt, seen) {
    const fx = this.effects, s = this.pt, frame = ++this.frame;
    for (const p of world.projectiles.values()) {
      shotPoint(p, alpha, heightAt, s);
      const visible = seen(s.x, s.z);
      if (p.projectile === 'sonic') {
        if (visible) fx.sonic(s.x, s.y, s.z, Math.atan2(s.dz, s.dx));
        continue;
      }
      if (!SMOKY.has(p.projectile)) {
        if (visible) fx.tracer(s.x, s.y, s.z, s.dx * s.speed, s.dy * s.speed, s.dz * s.speed, p.weapon, p.projectile);
        continue;
      }
      let r = this.trails.get(p.id);
      if (!r) {   // the trail starts at the launcher
        r = this.spare.pop() ?? { x: 0, y: 0, z: 0, frame: 0 };
        r.x = p.sx;
        r.z = p.sy;
        r.y = heightAt(p.sx, p.sy) + launchLift(p);
        this.trails.set(p.id, r);
      }
      r.frame = frame;
      if (!visible) { r.x = s.x; r.y = s.y; r.z = s.z; continue; }   // out of sight: the trail resumes where it comes back into view
      const d = Math.hypot(s.x - r.x, s.y - r.y, s.z - r.z);
      const laid = fx.rocketTrail(p.projectile, r.x, r.y, r.z, s.x, s.y, s.z, s.dx, s.dy, s.dz, s.speed, TRAIL_SCALE[p.weapon] ?? 1);
      const f = d > 0 ? Math.min(1, laid / d) : 0;
      r.x += (s.x - r.x) * f;
      r.y += (s.y - r.y) * f;
      r.z += (s.z - r.z) * f;
    }
    for (const [id, r] of this.trails) if (r.frame !== frame) { this.trails.delete(id); this.spare.push(r); }
  }
}
