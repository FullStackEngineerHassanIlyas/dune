// Ornithopter, after the Genesis sprite: a straight-winged plane painted in the house colour. A
// lavender ball cockpit with a dark visor slit sits at the nose between two short rocket tubes on
// house pylons; the long straight wing rides on top of a tapered house fuselage, its deep centre
// section fixed and its ribbed outer panels hinged on lavender knuckles at the chord step so they
// flap (wingL / wingR); darker flaps along the trailing edge and squared tip caps. Behind the wing,
// twin exhausts, a slim boom and a small T-tail; thin skids underneath. Faces +x.
import * as THREE from 'three';
import { ModelBuilder, MAT, shape, box, cyl, cone, sphere, torus, hull } from '../kit.js';
import { PAL } from '../palette.js';
import { rod } from '../detail.js';

const LAV = PAL.machineLight, LAV_DARK = PAL.machine, NAVY = PAL.navy;
const along = [0, 0, -Math.PI / 2];
const WING = { glow: 1.7 }, FLAP = 0xa8a8a8, TIP = 0x9a9a9a;
const WING_Y = 0.19, HINGE = 0.27, SPAN = 0.6;

/** Airfoil slab from z0 to z1 (leading edge at xl, trailing edge at xt, thickness t on y0), optionally tapered to the tip. */
function airfoil(xl, xt, z0, z1, y0, t, o, { tipChord = 1, tipT = 1 } = {}) {
  const pts = [];
  for (const [z, k, kt] of [[z0, 1, 1], [z1, tipChord, tipT]]) {
    const c = (xl - xt) * k, tt = t * kt, x0 = xl;
    for (const [u, v] of [[0, 0.35], [0.06, 0.8], [0.3, 1], [1, 0.3], [1, 0], [0.3, -0.05], [0.04, 0.05]]) pts.push([x0 - u * c, y0 + v * tt, z]);
  }
  return hull(pts, o);
}

/** A raised rib across an airfoil at z: follows the upper surface from near the leading edge to the flap line. */
function rib(xl, xt, z, y0, t, o) {
  const c = xl - xt, pts = [];
  for (const [u, v] of [[0.06, 0.8], [0.3, 1], [0.85, 0.42]]) for (const dz of [-0.004, 0.004]) pts.push([xl - u * c, y0 + v * t + 0.005, z + dz], [xl - u * c, y0 + v * t - 0.004, z + dz]);
  return hull(pts, o);
}

export function ornithopter() {
  const b = new ModelBuilder('ornithopter');

  // ball cockpit: lavender sphere, visor slit, seam ring, nose probe
  b.add(MAT.PAINT, sphere(0.11, 16, { p: [0.32, 0.13, 0], color: LAV }));
  b.add(MAT.GLASS, shape(new THREE.SphereGeometry(0.113, 14, 4, Math.PI * 0.62, Math.PI * 0.76, Math.PI * 0.3, Math.PI * 0.2), { p: [0.32, 0.13, 0], color: 0x10183a }));
  b.add(MAT.METAL, torus(0.109, 0.007, 4, 16, { p: [0.32, 0.13, 0], r: [Math.PI / 2, 0, 0], color: LAV_DARK }));
  b.add(MAT.DARK, cone(0.016, 0.06, 6, { p: [0.455, 0.13, 0], r: along, color: NAVY }));

  // rocket tubes on house pylons either side of the ball
  for (const s of [-1, 1]) {
    b.add(MAT.HOUSE, hull([[0.3, 0.08, s * 0.06], [0.3, 0.12, s * 0.06], [0.18, 0.08, s * 0.06], [0.18, 0.13, s * 0.06], [0.28, 0.09, s * 0.145], [0.28, 0.115, s * 0.145], [0.2, 0.09, s * 0.145], [0.2, 0.115, s * 0.145]], { color: 0xc8c8c8 }));
    b.add(MAT.METAL, cyl(0.022, 0.022, 0.19, 10, { p: [0.325, 0.1, s * 0.15], r: along, color: LAV }));
    b.add(MAT.PAINT, cyl(0.024, 0.024, 0.03, 10, { p: [0.4, 0.1, s * 0.15], r: along, color: PAL.white }));
    b.add(MAT.DARK, cyl(0.014, 0.014, 0.006, 8, { p: [0.418, 0.1, s * 0.15], r: along, color: 0x08080e }));
  }

  // tapered house fuselage under the wing, twin exhausts behind it
  b.add(MAT.HOUSE, hull([
    [0.3, 0.075, -0.06], [0.3, 0.075, 0.06], [0.3, 0.18, -0.06], [0.3, 0.18, 0.06],
    [0.12, 0.06, -0.085], [0.12, 0.06, 0.085], [0.12, 0.195, -0.085], [0.12, 0.195, 0.085], [0.12, 0.045, 0],
    [-0.1, 0.09, -0.06], [-0.1, 0.09, 0.06], [-0.1, 0.19, -0.06], [-0.1, 0.19, 0.06],
  ]));
  for (const s of [-1, 1]) {
    b.add(MAT.METAL, cyl(0.03, 0.026, 0.05, 10, { p: [-0.115, 0.12, s * 0.055], r: along, color: LAV_DARK }));
    b.add(MAT.DARK, cyl(0.02, 0.02, 0.006, 8, { p: [-0.141, 0.12, s * 0.055], r: along, color: 0x08080e }));
  }

  // boom and T-tail
  b.add(MAT.HOUSE, cyl(0.042, 0.026, 0.34, 10, { p: [-0.27, 0.155, 0], r: along, ...WING }));
  b.add(MAT.HOUSE, hull([[-0.3, 0.16, -0.012], [-0.3, 0.16, 0.012], [-0.44, 0.16, -0.012], [-0.44, 0.16, 0.012], [-0.37, 0.3, -0.01], [-0.37, 0.3, 0.01], [-0.45, 0.3, -0.01], [-0.45, 0.3, 0.01]]));
  b.add(MAT.HOUSE, airfoil(-0.35, -0.45, -0.15, 0.15, 0.295, 0.018, WING));
  for (const s of [-1, 1]) b.add(MAT.HOUSE, box(0.1, 0.026, 0.03, { p: [-0.4, 0.304, s * 0.165], color: TIP }));

  // wing centre section on top of the fuselage, its dark centre seam and flaps
  b.add(MAT.HOUSE, airfoil(0.21, -0.03, -HINGE, HINGE, WING_Y, 0.034, WING));
  b.add(MAT.HOUSE, hull([[0.215, WING_Y + 0.014, 0], [0.13, WING_Y + 0.04, -0.01], [0.13, WING_Y + 0.04, 0.01], [-0.04, WING_Y + 0.03, -0.01], [-0.04, WING_Y + 0.03, 0.01], [0.13, WING_Y + 0.025, -0.016], [0.13, WING_Y + 0.025, 0.016], [-0.06, WING_Y + 0.008, 0]], { color: 0x5a5a5a }));
  for (const s of [-1, 1]) b.add(MAT.HOUSE, box(0.05, 0.012, 0.19, { p: [-0.045, WING_Y + 0.008, s * 0.155], color: FLAP }));

  // outer panels: hinged at the chord step, ribbed, flap strip and squared tip cap
  for (const [node, param, s] of [['wingL', 'flap', -1], ['wingR', 'flapR', 1]]) {
    b.node(node, { pivot: [0.12, WING_Y + 0.012, s * HINGE], axis: 'x', param });
    const len = SPAN - HINGE;
    b.add(MAT.HOUSE, airfoil(0.08, -0.08, 0, s * (len - 0.03), -0.012, 0.026, WING, { tipChord: 0.94, tipT: 0.7 }), node);
    b.add(MAT.HOUSE, box(0.04, 0.01, len - 0.05, { p: [-0.098, -0.008, s * (len / 2 - 0.01)], color: FLAP }), node);
    b.add(MAT.HOUSE, box(0.18, 0.03, 0.035, { p: [-0.01, -0.001, s * (len - 0.016)], color: TIP }), node);
    for (const k of [0.3, 0.55, 0.8]) b.add(MAT.HOUSE, rib(0.08, -0.08, s * len * k, -0.012, 0.026 * (1 - 0.3 * k), { color: 0xc4c4c4 }), node);
    for (const x of [0.015, -0.075]) b.add(MAT.METAL, cyl(0.016, 0.016, 0.045, 8, { p: [x, 0, 0], r: along, color: LAV }), node);
  }
  for (const s of [-1, 1]) for (const x of [0.185, 0.09]) b.add(MAT.METAL, cyl(0.013, 0.013, 0.04, 8, { p: [x, WING_Y + 0.012, s * (HINGE - 0.01)], r: along, color: LAV_DARK }));

  // skids
  for (const s of [-1, 1]) {
    b.add(MAT.METAL, rod([0.2, 0.012, s * 0.08], [-0.12, 0.012, s * 0.08], 0.008, 5, { color: LAV_DARK }));
    for (const x of [0.13, -0.06]) b.add(MAT.METAL, rod([x, 0.012, s * 0.08], [x, 0.08, s * 0.05], 0.007, 5, { color: LAV_DARK }));
  }
  return b.build({ radius: 0.62, shade: false, muzzle: [0.42, 0.1, 0.15] });
}
