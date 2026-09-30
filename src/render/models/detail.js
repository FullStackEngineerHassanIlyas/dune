// Detail pieces shared by the models (the Genesis look, docs/research/raw/visual-*.md): foundation
// plates, house orbs, rods and flanged pipes, grilles, louvres, ladders, railings, hazard bands, stud
// grids, bolts, wheels and track units. Each adds merged geometry to a ModelBuilder; flat pieces lie
// in the x–z plane facing up and are positioned with `at` ({ p, r, s } as for primitives; r of
// [Math.PI / 2, 0, 0] turns a piece that faces up to face south, +z).
import * as THREE from 'three';
import { MAT, box, cbox, cyl, sphere, torus, ring, place } from './kit.js';
import { PAL } from './palette.js';

const UP = new THREE.Vector3(0, 1, 0);
const q = new THREE.Quaternion(), e = new THREE.Euler(), dv = new THREE.Vector3();

/** Rotation that turns +y onto the direction from a to b. */
function towards(a, b) {
  dv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
  e.setFromQuaternion(q.setFromUnitVectors(UP, dv));
  return [e.x, e.y, e.z];
}
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

/** A cylinder of radius r from point a to point b. */
export const rod = (a, b, r, seg, o = {}) => cyl(r, r, dist(a, b), seg, { ...o, p: lerp3(a, b, 0.5), r: towards(a, b) });

/** Points of a half-ellipse arch (width 2r, given height) for `prism` profiles: doors, arched windows, hangar ends. */
export function halfArc(r, height, steps = 14) {
  const pts = [];
  for (let k = 0; k <= steps; k++) { const a = (k / steps) * Math.PI; pts.push([Math.cos(a) * r, Math.sin(a) * height]); }
  return pts;
}

/** Pipe through points: straight runs, ball joints, flanges at the ends ('ends'), at every point ('all') or none. */
export function pipe(b, pts, { r = 0.03, seg = 8, color = PAL.steelDark, flangeColor = color, mat = MAT.METAL, node = 'root', flanges = 'ends' } = {}) {
  for (let i = 0; i < pts.length - 1; i++) b.add(mat, rod(pts[i], pts[i + 1], r, seg, { color }), node);
  for (let i = 1; i < pts.length - 1; i++) b.add(mat, sphere(r * 1.06, seg, { p: pts[i], color }), node);
  const at = flanges === 'all' ? pts.map((_, i) => i) : flanges === 'ends' ? [0, pts.length - 1] : [];
  for (const i of at) {
    const a = pts[i], n = pts[i === pts.length - 1 ? i - 1 : i + 1];
    const f = lerp3(a, n, Math.min(0.5, (r * 1.1) / dist(a, n)));
    b.add(mat, cyl(r * 1.45, r * 1.45, r * 0.7, seg, { p: f, r: towards(a, n), color: flangeColor }), node);
  }
}

/** Bolt heads at points, their axis along 'x', 'y' or 'z'. */
export function bolts(b, pts, { r = 0.011, h = 0.01, axis = 'y', seg = 6, color = PAL.steelDark, mat = MAT.METAL, node = 'root' } = {}) {
  const rot = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  for (const p of pts) b.add(mat, cyl(r, r, h, seg, { p, r: rot, color }), node);
}

/** Barred grille lying flat, w along x and d along z: dark well, frame and n bars (along z, or along x when `across`). */
export function grille(b, { w, d, n = 5, bar = 0.012, across = false, at = {}, frame = PAL.machineDark, bars = PAL.machine, back = 0x14141c, node = 'root' }) {
  const f = bar * 1.5, h = 0.018;
  b.add(MAT.DARK, place(box(w, 0.006, d, { color: back }), at), node);
  b.add(MAT.PAINT, place([
    box(w, h, f, { p: [0, h / 2, d / 2 - f / 2], color: frame }), box(w, h, f, { p: [0, h / 2, -d / 2 + f / 2], color: frame }),
    box(f, h, d, { p: [w / 2 - f / 2, h / 2, 0], color: frame }), box(f, h, d, { p: [-w / 2 + f / 2, h / 2, 0], color: frame }),
  ], at), node);
  for (let k = 1; k <= n; k++) {
    const t = -0.5 + k / (n + 1);
    b.add(MAT.METAL, place(across ? box(w - f, bar, bar, { p: [0, h * 0.6, t * d], color: bars }) : box(bar, bar, d - f, { p: [t * w, h * 0.6, 0], color: bars }), at), node);
  }
}

/** Round lattice grille lying flat (the Genesis refinery's orange ports): dark well, rim and crossed bars clipped to the circle. */
export function roundGrille(b, { r, n = 5, bar = 0.011, at = {}, rim = PAL.machineDark, bars = PAL.grille, back = 0x1c120e, seg = 20, node = 'root' }) {
  b.add(MAT.DARK, place(cyl(r, r, 0.008, seg, { color: back }), at), node);
  b.add(MAT.METAL, place(torus(r, bar * 1.4, 5, seg, { p: [0, 0.006, 0], r: [Math.PI / 2, 0, 0], color: rim }), at), node);
  for (let k = 1; k <= n; k++) {
    const t = (-1 + (2 * k) / (n + 1)) * r, l = 2 * Math.sqrt(Math.max(0, r * r - t * t)) * 0.98;
    b.add(MAT.PAINT, place([box(l, bar, bar, { p: [0, 0.006, t], color: bars }), box(bar, bar, l, { p: [t, 0.008, 0], color: bars })], at), node);
  }
}

/** Louvred vent lying flat, w along x and d along z: frame and n tilted slats over a dark well. */
export function louvres(b, { w, d, n = 5, at = {}, frame = PAL.machineDark, slats = PAL.machine, back = 0x14141c, node = 'root' }) {
  const f = 0.016, h = 0.02;
  b.add(MAT.DARK, place(box(w, 0.006, d, { color: back }), at), node);
  b.add(MAT.PAINT, place([
    box(w, h, f, { p: [0, h / 2, d / 2 - f / 2], color: frame }), box(w, h, f, { p: [0, h / 2, -d / 2 + f / 2], color: frame }),
    box(f, h, d, { p: [w / 2 - f / 2, h / 2, 0], color: frame }), box(f, h, d, { p: [-w / 2 + f / 2, h / 2, 0], color: frame }),
  ], at), node);
  const step = (d - 2 * f) / n;
  for (let k = 0; k < n; k++) b.add(MAT.PAINT, place(box(w - 2 * f, 0.004, step * 1.1, { p: [0, h * 0.55, -d / 2 + f + step * (k + 0.5)], r: [0.55, 0, 0], color: slats }), at), node);
}

/** Ladder of height h standing on y = 0 against a wall, rungs parallel to x; turn it with at.r. */
export function ladder(b, { h, w = 0.06, at = {}, color = PAL.steelDark, node = 'root' }) {
  const r = 0.0055, rungs = Math.max(2, Math.floor((h - 0.03) / 0.045) + 1);
  const geos = [cyl(r, r, h, 5, { p: [-w / 2, h / 2, 0], color }), cyl(r, r, h, 5, { p: [w / 2, h / 2, 0], color })];
  for (let k = 0; k < rungs; k++) geos.push(cyl(r * 0.8, r * 0.8, w, 4, { p: [0, 0.03 + k * 0.045, 0], r: [0, 0, Math.PI / 2], color }));
  b.add(MAT.METAL, place(geos, at), node);
}

/** Hand railing along a polyline of floor points: posts every `spacing`, a top rail and a mid rail. */
export function railing(b, pts, { h = 0.07, spacing = 0.12, color = PAL.yellow, mat = MAT.METAL, node = 'root' } = {}) {
  const r = 0.0045;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], c = pts[i + 1], n = Math.max(1, Math.round(dist(a, c) / spacing));
    for (let k = i ? 1 : 0; k <= n; k++) {
      const p = lerp3(a, c, k / n);
      b.add(mat, cyl(r, r, h, 4, { p: [p[0], p[1] + h / 2, p[2]], color }), node);
    }
    for (const y of [h, h * 0.5]) b.add(mat, rod([a[0], a[1] + y, a[2]], [c[0], c[1] + y, c[2]], r, 4, { color }), node);
  }
}

/** Yellow-and-black hazard band lying flat, w along x (split into n blocks) and d along z. */
export function hazard(b, { w, d, n = 6, h = 0.006, at = {}, node = 'root' }) {
  const step = w / n;
  for (let k = 0; k < n; k++) b.add(MAT.PAINT, place(box(step, h, d, { p: [-w / 2 + step * (k + 0.5), h / 2, 0], color: k % 2 ? 0x1c1b18 : PAL.yellow }), at), node);
}

/** nx × nz grid of round studs (or holes, with a dark colour) over a w × d area lying flat. */
export function studGrid(b, { w, d, nx, nz, r, h = 0.008, at = {}, color = PAL.navy, mat = MAT.DARK, seg = 10, node = 'root' }) {
  const geos = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    geos.push(cyl(r, r, h, seg, { p: [-w / 2 + (w * (i + 0.5)) / nx, h / 2, -d / 2 + (d * (j + 0.5)) / nz], color }));
  }
  b.add(mat, place(geos, at), node);
}

/**
 * Painted-on shading for unlit (LIGHT / HOUSE_LIGHT) spheres, which would otherwise read as flat
 * discs: brighter toward the upper south-west like the Genesis sprites' light, darker at the rim.
 */
export function shadeOrb(geo, { low = 0.35, high = 1.25 } = {}) {
  const n = geo.attributes.normal, c = geo.attributes.color;
  const lx = -0.45, ly = 0.75, lz = 0.48, len = Math.hypot(lx, ly, lz);
  for (let i = 0; i < n.count; i++) {
    const d = Math.max(0, (n.getX(i) * lx + n.getY(i) * ly + n.getZ(i) * lz) / len);
    const k = low + (high - low) * d * d;
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
  return geo;
}

/**
 * The Genesis house beacon every 2×2 and larger structure carries in its south-west corner: a glowing
 * house-colour orb in a dark collar, shaded like a glass ball, with a glint that circles its crown
 * (it turns with the `fan` param, as the sprite's glint runs round in eight frames). The only house
 * colour on a Genesis structure.
 */
export function houseOrb(b, x, y, z, { r = 0.16, post = 0.02, node = 'root' } = {}) {
  if (post > 0) b.add(MAT.METAL, cyl(r * 0.6, r * 0.8, post, 14, { p: [x, y + post / 2, z], color: PAL.machineDark }), node);
  b.add(MAT.METAL, ring(r * 1.12, r * 0.72, r * 0.4, 20, { p: [x, y + post, z], color: PAL.navy }), node);
  const cy = y + post + r * 0.85;
  b.add(MAT.HOUSE_LIGHT, shadeOrb(sphere(r, 20, { p: [x, cy, z], glow: 1.5 })), node);
  const glint = `${node}Glint`;
  b.node(glint, { parent: node, pivot: [x, cy, z], param: 'fan' });
  b.add(MAT.LIGHT, sphere(r * 0.17, 8, { p: [r * 0.62, r * 0.72, 0], color: 0xffffff, glow: 1.4 }), glint);
}

/**
 * Genesis concrete foundation under a structure: one dark olive plate with a light bevelled rim over
 * the whole footprint, on a dark base that dips below the ground to hide terrain seams. Its top is at
 * FOUNDATION_TOP.
 */
export function foundation(b, w, h, { plate = PAL.slab, rim = PAL.slabRim, base = PAL.slabSeam } = {}) {
  b.add(MAT.PAINT, box(w - 0.02, 0.1, h - 0.02, { p: [0, -0.02, 0], color: base }));
  b.add(MAT.PAINT, cbox(w - 0.03, 0.05, h - 0.03, 0.03, { p: [0, 0.03, 0], color: rim }));
  b.add(MAT.PAINT, box(w - 0.13, 0.008, h - 0.13, { p: [0, 0.054, 0], color: plate }));
}
export const FOUNDATION_TOP = 0.058;

/** A wheel on `node` with its axle along z: lugged tyre, rim, hub and bolts, centred on the node pivot. */
export function wheel(b, node, { r, w, lugs = 12, tyre = PAL.rubber, rim = PAL.steel, hub = PAL.steelDark, seg = 16 }) {
  const axle = [Math.PI / 2, 0, 0];
  b.add(MAT.DARK, cyl(r * 0.9, r * 0.9, w, seg, { r: axle, color: tyre }), node);
  const geos = [];
  for (let k = 0; k < lugs; k++) {
    const a = (k / lugs) * Math.PI * 2;
    geos.push(box(r * 0.2, r * 0.16, w * 0.94, { p: [Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, 0], r: [0, 0, a], color: tyre }));
  }
  b.add(MAT.DARK, geos, node);
  b.add(MAT.METAL, cyl(r * 0.52, r * 0.52, w + 0.006, seg, { r: axle, color: rim }), node);
  b.add(MAT.METAL, cyl(r * 0.2, r * 0.24, w + 0.02, 8, { r: axle, color: hub }), node);
  const studs = [];
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    studs.push([Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, s * (w / 2 + 0.004)]);
  }
  bolts(b, studs, { r: r * 0.06, h: 0.006, axis: 'z', color: hub, node });
}

/**
 * One track run along x centred on z: scrolling tread belt with rounded ends, road wheels showing on
 * the outside face, a toothed drive sprocket at the front and an idler at the back.
 * `outer` is the side (+1 or -1) facing away from the hull.
 */
export function trackUnit(b, { length, h, w, z, outer, wheels = 4, color = PAL.navy, node = 'root' }) {
  const r = h / 2, core = length - h, axle = [Math.PI / 2, 0, 0];
  b.add(MAT.TREAD, box(core, h, w, { p: [0, r, z] }), node);
  for (const x of [-core / 2, core / 2]) b.add(MAT.TREAD, cyl(r, r, w, 14, { p: [x, r, z], r: axle }), node);
  const face = z + outer * (w / 2 + 0.003);
  for (let k = 0; k < wheels; k++) {
    const x = -core / 2 + (core * (k + 0.5)) / wheels;
    b.add(MAT.DARK, cyl(r * 0.62, r * 0.62, 0.008, 12, { p: [x, r * 0.95, face], r: axle, color }), node);
    b.add(MAT.METAL, cyl(r * 0.22, r * 0.22, 0.012, 8, { p: [x, r * 0.95, face + outer * 0.002], r: axle, color: PAL.machine }), node);
  }
  for (const [x, rr] of [[core / 2, r * 0.8], [-core / 2, r * 0.72]]) {
    b.add(MAT.METAL, cyl(rr, rr, 0.01, 12, { p: [x, r, face], r: axle, color: PAL.navyLight }), node);
    b.add(MAT.METAL, cyl(rr * 0.35, rr * 0.35, 0.016, 8, { p: [x, r, face + outer * 0.003], r: axle, color: PAL.machine }), node);
  }
}
