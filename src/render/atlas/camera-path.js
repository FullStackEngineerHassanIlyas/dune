// The territory map's camera (spec §5.8; research.md §6: the Sega map is tilted, and after the briefing the view
// closes in on the mission's region for about seven seconds). Poses are { tx, ty, tz, dist, elev, yaw }: the point
// looked at, the distance to it and the angles of the view (yaw 0 looks north from the south). The overview fits the
// whole map in the picture (or in an inset part of it), the zoom eases in and out onto a region, and an idle drift
// keeps the picture alive. Pure JS (no three, no DOM): testable under Node.
import { MAP } from '../../data/territory.js';

export const FOV = 34;                   // vertical, degrees
export const WORLD = { w: 20, h: 10 };   // the map's size in world units (x east, z south)
export const RELIEF = 1.0;               // world height of a relief value of 1
const DEG = Math.PI / 180;
const OVERVIEW_ELEV = 52 * DEG, REGION_ELEV = 63 * DEG;
const MARGIN = 0.93;                     // the overview keeps the map's corners this far in from the picture's edges (NDC)
const FILL = 0.72;                       // the zoom ends with the region's radius at this share of the half-picture
const LOOK_Y = 0.25;                     // look at the relief's middle height

export function mapToWorld(x, y, out = [0, 0]) {
  out[0] = (x / MAP.w - 0.5) * WORLD.w;
  out[1] = (y / MAP.h - 0.5) * WORLD.h;
  return out;
}

/** The camera's position for `pose`: { x, y, z }. */
export function posePosition(pose, out = {}) {
  const c = Math.cos(pose.elev) * pose.dist;
  out.x = pose.tx + Math.sin(pose.yaw) * c;
  out.y = pose.ty + Math.sin(pose.elev) * pose.dist;
  out.z = pose.tz + Math.cos(pose.yaw) * c;
  return out;
}

// The part of the picture the map is framed in, as the camera sees it: the inset's tangent of the half field of view
// and aspect, and its centre in NDC (the projection is shifted there).
function frame(aspect, inset) {
  const l = inset?.left ?? 0, r = inset?.right ?? 0, t = inset?.top ?? 0, b = inset?.bottom ?? 0;
  const sh = Math.max(0.1, 1 - t - b), sw = Math.max(0.1, 1 - l - r);
  return { tan: Math.tan((FOV * DEG) / 2) * sh, aspect: (aspect * sw) / sh, cx: l - r, cy: b - t, sw, sh };
}

const pos = {};
/** Where world point (x, y, z) lands in NDC ([-1, 1] across the picture) through `pose`. */
export function project(pose, aspect, fov, x, y, z, inset) {
  posePosition(pose, pos);
  // camera basis: forward f towards the target, right r = f × up, up u = r × f
  let fx = pose.tx - pos.x, fy = pose.ty - pos.y, fz = pose.tz - pos.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const dx = x - pos.x, dy = y - pos.y, dz = z - pos.z;
  const cx = dx * rx + dz * rz, cy = dx * ux + dy * uy + dz * uz, cz = dx * fx + dy * fy + dz * fz;
  const tan = Math.tan((fov * DEG) / 2), f = frame(aspect, inset);
  return [cx / (cz * tan * aspect) + f.cx, cy / (cz * tan) + f.cy];
}

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
function extent(pose, aspect, inset) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const f = frame(aspect, inset);
  for (const [x, z] of CORNERS) {
    let [nx, ny] = project(pose, aspect, FOV, (x * WORLD.w) / 2, 0.3, (z * WORLD.h) / 2, inset);
    nx = (nx - f.cx) / f.sw; ny = (ny - f.cy) / f.sh;   // in the inset's own NDC
    minX = Math.min(minX, nx); maxX = Math.max(maxX, nx); minY = Math.min(minY, ny); maxY = Math.max(maxY, ny);
  }
  return { minX, maxX, minY, maxY };
}

/** The pose that frames the whole map, centred in the picture (or in `inset`: { left, right, top, bottom } shares
 *  of the picture kept clear, say for a Mentat and his text). */
export function overviewPose(aspect, inset, out = {}) {
  Object.assign(out, { tx: 0, ty: LOOK_Y, tz: 0, dist: 20, elev: OVERVIEW_ELEV, yaw: 0 });
  let lo = 4, hi = 400;
  for (let i = 0; i < 40; i++) {
    out.dist = (lo + hi) / 2;
    // centre the map vertically: looking further south moves it up the picture
    let a = -WORLD.h, b = WORLD.h;
    for (let k = 0; k < 40; k++) {
      out.tz = (a + b) / 2;
      const e = extent(out, aspect, inset);
      if (e.minY + e.maxY > 0) b = out.tz; else a = out.tz;
    }
    const e = extent(out, aspect, inset);
    if (Math.max(-e.minX, e.maxX, -e.minY, e.maxY) <= MARGIN) hi = out.dist; else lo = out.dist;
  }
  out.dist = hi;
  let a = -WORLD.h, b = WORLD.h;
  for (let k = 0; k < 40; k++) {
    out.tz = (a + b) / 2;
    const e = extent(out, aspect, inset);
    if (e.minY + e.maxY > 0) b = out.tz; else a = out.tz;
  }
  return out;
}

/** The pose the zoom ends in: looking down at `region`'s centre from close enough that it fills the picture. */
export function regionPose(region, aspect, inset, out = {}) {
  const [x, z] = mapToWorld(region.centre[0], region.centre[1]);
  const f = frame(aspect, inset);
  const r = (Math.sqrt(region.area / Math.PI) * WORLD.w) / MAP.w;   // the region's radius, roughly, in world units
  const dist = Math.max(3, r / (f.tan * FILL), r / (f.tan * f.aspect * FILL));
  Object.assign(out, { tx: x, ty: LOOK_Y, tz: z, dist, elev: REGION_ELEV, yaw: 0 });
  // a region at the map's edge: slide the view inwards until the picture is all map (keeping the region in view)
  const fp = footprint(out, aspect, inset);
  if (!fp) return out;
  const slide = (lo, hi, half) => (hi - lo > 2 * half ? -(lo + hi) / 2 : Math.max(0, -half - lo) - Math.max(0, hi - half));
  const dx = slide(fp.minX, fp.maxX, WORLD.w / 2), dz = slide(fp.minZ, fp.maxZ, WORLD.h / 2);
  let lo = 0, hi = 1;
  const at = (k) => { out.tx = x + dx * k; out.tz = z + dz * k; const [nx, ny] = ndcIn(out, aspect, inset, x, z); return Math.max(Math.abs(nx), Math.abs(ny)); };
  if (at(1) <= KEEP) return out;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (at(m) <= KEEP) lo = m; else hi = m; }
  at(lo);
  return out;
}

const KEEP = 0.6;   // sliding off the edge, the region's centre stays this near the middle of the picture (NDC)

/** Where world point (x, LOOK_Y, z) lands in the NDC of the inset (or the whole picture). */
function ndcIn(pose, aspect, inset, x, z) {
  const f = frame(aspect, inset), [nx, ny] = project(pose, aspect, FOV, x, LOOK_Y, z, inset);
  return [(nx - f.cx) / f.sw, (ny - f.cy) / f.sh];
}

/** The ground (at LOOK_Y) the picture's corners see: { minX, maxX, minZ, maxZ }, or null if one sees the sky. */
export function footprint(pose, aspect, inset) {
  const p = posePosition(pose, {});
  let fx = pose.tx - p.x, fy = pose.ty - p.y, fz = pose.tz - p.z;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  const tan = Math.tan((FOV * DEG) / 2), f = frame(aspect, inset);
  const l = inset?.left ?? 0, r = inset?.right ?? 0, t = inset?.top ?? 0, b = inset?.bottom ?? 0;
  const out = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const nx of [-1 + 2 * l, 1 - 2 * r]) {
    for (const ny of [-1 + 2 * b, 1 - 2 * t]) {
      const a = (nx - f.cx) * tan * aspect, c = (ny - f.cy) * tan;
      const dx = rx * a + ux * c + fx, dy = uy * c + fy, dz = rz * a + uz * c + fz;
      if (dy >= -1e-6) return null;
      const k = (LOOK_Y - p.y) / dy, gx = p.x + dx * k, gz = p.z + dz * k;
      out.minX = Math.min(out.minX, gx); out.maxX = Math.max(out.maxX, gx);
      out.minZ = Math.min(out.minZ, gz); out.maxZ = Math.max(out.maxZ, gz);
    }
  }
  return out;
}

export function easeInOut(t) {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** The camera `t` (0–1) of the way from pose `from` to pose `to`: the view turns onto the region a little ahead
 *  of the dive, and the distance closes geometrically, so the descent feels even. */
export function zoomPose(from, to, t, out = {}) {
  const k = easeInOut(t), aim = easeInOut(t * 1.2);
  out.tx = from.tx + (to.tx - from.tx) * aim;
  out.ty = from.ty + (to.ty - from.ty) * aim;
  out.tz = from.tz + (to.tz - from.tz) * aim;
  out.dist = k >= 1 ? to.dist : from.dist * Math.pow(to.dist / from.dist, k);
  out.elev = from.elev + (to.elev - from.elev) * k;
  out.yaw = from.yaw + (to.yaw - from.yaw) * k;
  return out;
}

/** The idle drift at time `t` seconds: small offsets to add to a pose's yaw and elevation (radians) and to scale
 *  its distance by (1 + dist). Slow incommensurate waves, so the picture never visibly repeats. */
export function drift(t, out = {}) {
  out.yaw = 0.045 * Math.sin((t * 2 * Math.PI) / 41) + 0.012 * Math.sin((t * 2 * Math.PI) / 17 + 1.3);
  out.elev = 0.02 * Math.sin((t * 2 * Math.PI) / 53 + 0.7);
  out.dist = 0.02 * Math.sin((t * 2 * Math.PI) / 31 + 2.1);
  return out;
}
