// Barracks (2x2), after the Genesis sprite: a navy drill yard ringed by five open-topped concrete
// bunkers — an L in the north-west, a long reversed L in the north-east, an L in the south-east and two
// pillboxes to the west and south. Each is a bevelled khaki parapet round a sunken olive roof deck with
// a lavender periscope cupola in its north-west corner; roof hatches run down the long arms, a finned
// vent sits on the north-east bunker and firing slits pierce the outer walls. Doors, steps and a ladder
// face the yard, painted with drill lines, where a flagpole flies the house flag (the one PC-style
// accent the Genesis art leaves room for). The house orb sits in the south-west corner.
import * as THREE from 'three';
import { ModelBuilder, MAT, shape, box, cbox, cyl, dome, sphere } from '../kit.js';
import { PAL } from '../palette.js';
import { foundation, FOUNDATION_TOP as T, houseOrb, ladder, bolts } from '../detail.js';

export const KHAKI = 0x9a9c80, KHAKI_DARK = 0x77795f, OLIVE = 0x4c4c28, SLIT = 0x0d0d08;

/** Extrude a plan polygon [[x, z], …] (with optional holes) from y up by h; `bevel` chamfers the top and bottom edges. */
export function extrude(poly, holes, h, y, color, bevel = 0) {
  const v = (pts) => pts.map(([x, z]) => new THREE.Vector2(x, -z));
  const s = new THREE.Shape(v(poly));
  for (const hole of holes) s.holes.push(new THREE.Path(v(hole)));
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelOffset: -bevel, bevelSegments: 1 });
  return shape(g, { p: [0, y + bevel, 0], r: [-Math.PI / 2, 0, 0], color });
}

/** A rectilinear plan polygon moved inward by t on every side. */
export function inset(poly, t) {
  const n = poly.length;
  const s = Math.sign(poly.reduce((a, [x, z], i) => a + x * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * z, 0));
  const nrm = (a, c) => [-Math.sign(c[1] - a[1]) * s, Math.sign(c[0] - a[0]) * s];
  return poly.map((p, i) => {
    const a = nrm(poly[(i + n - 1) % n], p), c = nrm(p, poly[(i + 1) % n]);
    return [p[0] + t * (a[0] + c[0]), p[1] + t * (a[1] + c[1])];
  });
}

/** Genesis bunker: a bevelled khaki parapet ring round a sunken olive deck (plan polygon, parapet t thick), with a base skirt and a string course at deck level. */
export function bunker(b, poly, { h = 0.27, deck = 0.2, t = 0.08, y = T } = {}) {
  const inner = inset(poly, t), band = (out, hh, yy) => extrude(inset(poly, -out), [inset(poly, 0.02)], hh, yy, KHAKI_DARK);
  b.add(MAT.PAINT, [extrude(poly, [inner], h, y, KHAKI, 0.014), extrude(inner, [], deck, y, OLIVE), band(0.012, 0.04, y), band(0.004, 0.014, y + deck - 0.03)]);
  return inner;
}

/** Lavender periscope cupola with a dark vision slot across it, standing on a deck at y. */
function cupola(b, x, y, z) {
  b.add(MAT.PAINT, cyl(0.058, 0.062, 0.014, 12, { p: [x, y + 0.007, z], color: PAL.machineDark }));
  b.add(MAT.PAINT, cyl(0.05, 0.052, 0.03, 12, { p: [x, y + 0.029, z], color: PAL.machine }));
  b.add(MAT.PAINT, dome(0.05, 12, { p: [x, y + 0.044, z], s: [1, 0.75, 1], color: PAL.machine }));
  b.add(MAT.DARK, box(0.09, 0.02, 0.022, { p: [x, y + 0.066, z], r: [0, Math.PI / 4, 0], color: PAL.navy }));
}

/** Firing slits along an outer wall face: n dark slots with a sill, from (x0, z0) to (x1, z1), facing `dir` (unit x/z). */
export function slits(b, [x0, z0], [x1, z1], n, [dx, dz]) {
  for (let k = 0; k < n; k++) {
    const f = (k + 0.5) / n, x = x0 + (x1 - x0) * f + dx * 0.004, z = z0 + (z1 - z0) * f + dz * 0.004;
    const along = dz !== 0;
    b.add(MAT.DARK, box(along ? 0.07 : 0.012, 0.024, along ? 0.012 : 0.07, { p: [x, T + 0.19, z], color: SLIT }));
    b.add(MAT.PAINT, box(along ? 0.09 : 0.02, 0.012, along ? 0.02 : 0.09, { p: [x + dx * 0.004, T + 0.172, z + dz * 0.004], color: KHAKI }));
  }
}

/** A dark doorway with a khaki lintel on a wall face at (x, z), facing `dir`. */
function door(b, x, z, [dx, dz]) {
  const along = dz !== 0;
  b.add(MAT.DARK, box(along ? 0.09 : 0.012, 0.13, along ? 0.012 : 0.09, { p: [x + dx * 0.004, T + 0.065, z + dz * 0.004], color: SLIT }));
  b.add(MAT.PAINT, cbox(along ? 0.13 : 0.03, 0.025, along ? 0.03 : 0.13, 0.006, { p: [x + dx * 0.01, T + 0.142, z + dz * 0.01], color: KHAKI_DARK }));
}

export function barracks() {
  const b = new ModelBuilder('barracks');
  foundation(b, 2, 2, { plate: PAL.navy, rim: PAL.machine });
  const D = T + 0.2;

  bunker(b, [[-0.75, -0.75], [-0.156, -0.75], [-0.156, -0.406], [-0.406, -0.406], [-0.406, -0.156], [-0.75, -0.156]]);
  bunker(b, [[0, -0.75], [0.844, -0.75], [0.844, 0.094], [0.5, 0.094], [0.5, -0.406], [0, -0.406]]);
  bunker(b, [[-0.75, 0], [-0.406, 0], [-0.406, 0.344], [-0.75, 0.344]]);
  bunker(b, [[0.5, 0.25], [0.844, 0.25], [0.844, 0.844], [0.25, 0.844], [0.25, 0.5], [0.5, 0.5]]);
  bunker(b, [[-0.25, 0.5], [0.094, 0.5], [0.094, 0.844], [-0.25, 0.844]]);

  // drill lines on the yard
  for (const [x, z, w, d] of [[0.06, -0.3, 0.62, 0.014], [0.06, 0.4, 0.62, 0.014], [-0.25, 0.05, 0.014, 0.7], [0.37, 0.05, 0.014, 0.7]]) b.add(MAT.PAINT, box(w, 0.004, d, { p: [x, T + 0.002, z], color: PAL.navyLight }));
  for (const [x, z] of [[-0.61, -0.61], [0.14, -0.61], [-0.61, 0.14], [0.64, 0.39], [0.39, 0.64], [-0.14, 0.64]]) cupola(b, x, D, z);
  // roof hatches down the long arms
  for (const [x, z] of [[-0.58, -0.45], [-0.58, -0.33], [0.672, -0.45], [0.672, -0.33], [0.672, -0.2], [0.672, -0.08]]) {
    b.add(MAT.DARK, box(0.07, 0.008, 0.035, { p: [x, D + 0.004, z], color: SLIT }));
    b.add(MAT.PAINT, box(0.086, 0.004, 0.05, { p: [x, D + 0.002, z], color: KHAKI_DARK }));
  }
  // finned vent on the north-east bunker
  b.add(MAT.PAINT, cbox(0.17, 0.05, 0.05, 0.01, { p: [0.61, D + 0.025, -0.6], color: PAL.machine }));
  for (const dx of [-0.06, 0, 0.06]) b.add(MAT.PAINT, cbox(0.03, 0.05, 0.04, 0.006, { p: [0.61 + dx, D + 0.05, -0.64], color: PAL.machineLight }));

  // firing slits in the outer walls, doors and steps on the yard side
  slits(b, [-0.75, -0.75], [-0.156, -0.75], 3, [0, -1]);
  slits(b, [0, -0.75], [0.844, -0.75], 4, [0, -1]);
  slits(b, [-0.75, -0.75], [-0.75, -0.156], 2, [-1, 0]);
  slits(b, [-0.75, 0], [-0.75, 0.344], 1, [-1, 0]);
  slits(b, [0.844, -0.75], [0.844, 0.094], 4, [1, 0]);
  slits(b, [0.844, 0.25], [0.844, 0.844], 3, [1, 0]);
  slits(b, [0.25, 0.844], [0.844, 0.844], 3, [0, 1]);
  slits(b, [-0.25, 0.844], [0.094, 0.844], 2, [0, 1]);
  door(b, -0.3, -0.406, [0, 1]);
  door(b, 0.36, -0.406, [0, 1]);
  door(b, -0.406, 0.17, [1, 0]);
  door(b, 0.5, -0.12, [-1, 0]);
  for (let k = 0; k < 4; k++) b.add(MAT.PAINT, cbox(0.1 - k * 0.012, 0.05 * (k + 1), 0.07, 0.006, { p: [0.12 + k * 0.05, T + 0.025 * (k + 1), -0.37], color: KHAKI_DARK }));
  ladder(b, { h: 0.27, at: { p: [0.49, T, 0.03], r: [0, Math.PI / 2, 0] } });

  // flagpole on a stepped plinth in the yard
  const fx = 0.12, fz = 0.12, top = T + 0.72;
  b.add(MAT.PAINT, cbox(0.14, 0.03, 0.14, 0.008, { p: [fx, T + 0.015, fz], color: KHAKI_DARK }));
  b.add(MAT.PAINT, cbox(0.09, 0.03, 0.09, 0.008, { p: [fx, T + 0.045, fz], color: KHAKI }));
  b.add(MAT.METAL, cyl(0.008, 0.011, top - T, 6, { p: [fx, (top + T) / 2, fz], color: PAL.steel }));
  b.add(MAT.METAL, sphere(0.016, 8, { p: [fx, top + 0.01, fz], color: PAL.gold }));
  bolts(b, [[fx - 0.03, T + 0.061, fz - 0.03], [fx + 0.03, T + 0.061, fz - 0.03], [fx - 0.03, T + 0.061, fz + 0.03], [fx + 0.03, T + 0.061, fz + 0.03]], { r: 0.008 });
  b.node('flag', { pivot: [fx, top - 0.06, fz] });
  b.add(MAT.HOUSE, [box(0.11, 0.11, 0.008, { p: [0.054, 0, -0.011], r: [0, 0.2, 0] }), box(0.1, 0.1, 0.008, { p: [0.157, -0.004, -0.012], r: [0, -0.2, 0], color: 0xd0d0d0 })], 'flag');

  houseOrb(b, -0.75, T, 0.75);
  return b.build({ radius: 1.1 });
}
