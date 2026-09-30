// Carryall, after the Genesis sprite: a white airframe shaped like an anchor from above. At the nose
// a round cockpit hood — a thick white rim round dark glazing, split by a frame bar — backed by a
// house-colour crossbeam; a narrow spine with house bevels and a white ridge runs back to the tail;
// swept stub wings with house leading-edge stripes carry an engine drum on each side (intake ring
// and spinner, house band, lavender rings, black exhaust); at the rear a wide stepped tail plate
// between two wedge fins with house caps. Lavender grab claws hang under the belly at the front and
// back (clawF / clawB swing open fore and aft and close on a load hanging 0.35 below). Faces +x.
import * as THREE from 'three';
import { ModelBuilder, MAT, shape, box, cbox, cyl, cone, torus, hull } from '../kit.js';
import { PAL } from '../palette.js';
import { bolts, rod } from '../detail.js';

const WHITE = 0xcfd0d8, LAV = PAL.machineLight, LAV_DARK = PAL.machine, NAVY = PAL.navy, BLACK = 0x0c0c16;
const along = [0, 0, -Math.PI / 2];   // cylinders stand on y: lay them along +x

/** Plan-view "D" plate: straight back edge at x0, a half-ellipse reaching `len` forward, top edge chamfered by c. */
function dPlate(x0, len, hw, y0, y1, c, o, seg = 12) {
  const pts = [];
  for (let k = 0; k <= seg; k++) {
    const a = -Math.PI / 2 + (k / seg) * Math.PI, cx = Math.cos(a), sz = Math.sin(a);
    pts.push([x0 + len * cx, y0, hw * sz], [x0 + len * cx, y1 - c, hw * sz], [x0 + (len - c) * cx, y1, (hw - c) * sz]);
  }
  return hull(pts, o);
}

/** Front-upper quarter of an ellipsoid (x ≥ 0, y ≥ 0) centred at p: canopies and hoods. */
const quarterDome = (rx, ry, rz, seg, o) => shape(new THREE.SphereGeometry(1, seg, Math.max(3, seg / 3), Math.PI / 2, Math.PI, 0, Math.PI / 2), { ...o, s: [rx, ry, rz] });

/** A bent claw finger on a node: arm down from the pivot, knuckle, hook curling toward the load (dir −1 curls to −x). */
function claw(b, node, z, dir) {
  const t = 0.022, seg = [[0, 0.0], [0.012, -0.045], [0.006, -0.066], [-0.018, -0.078], [-0.038, -0.071]];
  for (let k = 0; k < seg.length - 1; k++) {
    const [x0, y0] = seg[k], [x1, y1] = seg[k + 1], w = t * (1 - k * 0.14);
    const pts = [];
    for (const [x, y] of [[x0, y0], [x1, y1]]) for (const s of [-1, 1]) for (const u of [-1, 1]) pts.push([-dir * x + u * w * 0.5, y + u * 0.004, z + s * w * 0.6]);
    b.add(MAT.METAL, hull(pts, { color: k < 2 ? LAV : LAV_DARK }), node);
  }
  b.add(MAT.METAL, cyl(0.016, 0.016, t * 1.5, 8, { p: [-dir * 0.012, -0.045, z], r: [Math.PI / 2, 0, 0], color: LAV_DARK }), node);
}

/** An engine drum along x at (x, y, z): cowl, intake lip, dark intake and spinner, house band, lavender rings, black exhaust. */
function pod(b, x, y, z) {
  const r = 0.14, front = x + 0.275, back = x - 0.275;
  b.add(MAT.PAINT, cyl(r, r, 0.4, 16, { p: [x - 0.025, y, z], r: along, color: WHITE }));
  b.add(MAT.PAINT, cyl(0.118, r, 0.075, 16, { p: [front - 0.0375, y, z], r: along, color: WHITE }));
  b.add(MAT.METAL, torus(0.108, 0.013, 4, 16, { p: [front, y, z], r: [0, Math.PI / 2, 0], color: LAV }));
  b.add(MAT.DARK, cyl(0.1, 0.1, 0.01, 16, { p: [front - 0.012, y, z], r: along, color: NAVY }));
  b.add(MAT.METAL, cone(0.045, 0.07, 10, { p: [front - 0.005, y, z], r: along, color: LAV }));
  b.add(MAT.HOUSE, cyl(r + 0.008, r + 0.008, 0.1, 16, { p: [x + 0.025, y, z], r: along }));
  for (const dx of [0.1, -0.075, -0.2]) b.add(MAT.METAL, cyl(r + 0.005, r + 0.005, 0.02, 16, { p: [x + dx, y, z], r: along, color: LAV }));
  b.add(MAT.METAL, cyl(r, 0.112, 0.06, 16, { p: [back + 0.03, y, z], r: along, color: LAV_DARK }));
  b.add(MAT.DARK, cyl(0.09, 0.09, 0.012, 16, { p: [back - 0.001, y, z], r: along, color: BLACK }));
  b.add(MAT.DARK, cone(0.05, 0.05, 10, { p: [back + 0.02, y, z], r: [0, 0, Math.PI / 2], color: NAVY }));
}

export function carryall() {
  const b = new ModelBuilder('carryall');

  // cockpit hood: D-shaped white tub, dark glazing inside its rim, frame bar over the top
  b.add(MAT.PAINT, dPlate(0.46, 0.33, 0.3, 0.03, 0.17, 0.065, { color: WHITE }));
  b.add(MAT.GLASS, quarterDome(0.2, 0.075, 0.17, 18, { p: [0.47, 0.168, 0], color: 0x141a38 }));
  b.add(MAT.PAINT, hull([[0.47, 0.252, -0.022], [0.47, 0.252, 0.022], [0.58, 0.236, -0.02], [0.58, 0.236, 0.02], [0.66, 0.19, -0.018], [0.66, 0.19, 0.018], [0.47, 0.2, 0], [0.66, 0.17, 0]], { color: WHITE }));
  b.add(MAT.DARK, box(0.03, 0.018, 0.14, { p: [0.78, 0.07, 0], color: NAVY }));
  // house crossbeam behind the hood, split by the spine
  for (const s of [-1, 1]) b.add(MAT.HOUSE, cbox(0.1, 0.16, 0.2, 0.03, { p: [0.435, 0.12, s * 0.2] }));

  // spine: white body, house bevels, white ridge; panel seams and an antenna
  b.add(MAT.PAINT, cbox(0.96, 0.13, 0.2, 0.025, { p: [-0.07, 0.095, 0], color: WHITE }));
  b.add(MAT.HOUSE, hull([[0.4, 0.155, -0.1], [0.4, 0.155, 0.1], [-0.52, 0.155, -0.1], [-0.52, 0.155, 0.1], [0.4, 0.205, -0.05], [0.4, 0.205, 0.05], [-0.52, 0.205, -0.05], [-0.52, 0.205, 0.05]]));
  b.add(MAT.PAINT, cbox(1.0, 0.04, 0.06, 0.014, { p: [-0.07, 0.215, 0], color: WHITE }));
  for (const x of [0.2, -0.1, -0.38]) b.add(MAT.DARK, box(0.012, 0.03, 0.205, { p: [x, 0.13, 0], color: NAVY }));
  b.add(MAT.METAL, rod([0.3, 0.23, 0], [0.26, 0.33, 0], 0.006, 5, { color: LAV }));
  b.add(MAT.METAL, cyl(0.016, 0.016, 0.008, 8, { p: [0.3, 0.237, 0], color: LAV_DARK }));

  // swept stub wings to the engine drums, house leading-edge stripes, ribs
  for (const s of [-1, 1]) {
    const zi = s * 0.1, zo = s * 0.4;
    b.add(MAT.PAINT, hull([[0.3, 0.1, zi], [0.3, 0.15, zi], [0.1, 0.1, zo], [0.1, 0.15, zo], [-0.17, 0.1, zi], [-0.17, 0.16, zi], [-0.17, 0.1, zo], [-0.17, 0.16, zo]], { color: WHITE }));
    b.add(MAT.HOUSE, hull([[0.25, 0.152, zi], [0.25, 0.166, zi], [0.06, 0.152, zo], [0.06, 0.166, zo], [0.19, 0.155, zi], [0.19, 0.168, zi], [0.0, 0.156, zo], [0.0, 0.169, zo]]));
    for (const x of [-0.06, -0.14]) b.add(MAT.DARK, box(0.012, 0.012, 0.28, { p: [x, 0.163, s * 0.25], color: NAVY }));
    bolts(b, [[-0.02, 0.162, s * 0.16], [-0.02, 0.162, s * 0.34], [-0.1, 0.162, s * 0.16], [-0.1, 0.162, s * 0.34]], { r: 0.008, h: 0.008, color: LAV_DARK });
    pod(b, -0.1, 0.135, s * 0.525);
  }

  // stepped tail plate between two wedge fins with house caps
  b.add(MAT.PAINT, hull([[-0.42, 0.09, -0.3], [-0.42, 0.09, 0.3], [-0.42, 0.15, -0.28], [-0.42, 0.15, 0.28],
    [-0.74, 0.09, -0.45], [-0.74, 0.09, 0.45], [-0.74, 0.17, -0.45], [-0.74, 0.17, 0.45], [-0.5, 0.17, -0.34], [-0.5, 0.17, 0.34]], { color: WHITE }));
  b.add(MAT.METAL, box(0.03, 0.014, 0.8, { p: [-0.585, 0.168, 0], color: LAV_DARK }));
  b.add(MAT.DARK, box(0.012, 0.01, 0.8, { p: [-0.6, 0.176, 0], color: NAVY }));
  bolts(b, [-0.34, -0.2, 0.2, 0.34].map((z) => [-0.7, 0.172, z]), { r: 0.009, h: 0.008, color: LAV_DARK });
  for (const s of [-1, 1]) {
    const z = s * 0.5;
    b.add(MAT.PAINT, hull([[-0.42, 0.0, z - 0.05], [-0.42, 0.0, z + 0.05], [-0.8, 0.0, z - 0.05], [-0.8, 0.0, z + 0.05],
      [-0.56, 0.26, z - 0.016], [-0.56, 0.26, z + 0.016], [-0.8, 0.26, z - 0.016], [-0.8, 0.26, z + 0.016]], { color: WHITE }));
    b.add(MAT.HOUSE, hull([[-0.55, 0.255, z - 0.024], [-0.55, 0.255, z + 0.024], [-0.81, 0.255, z - 0.024], [-0.81, 0.255, z + 0.024],
      [-0.57, 0.29, z - 0.012], [-0.57, 0.29, z + 0.012], [-0.81, 0.29, z - 0.012], [-0.81, 0.29, z + 0.012], [-0.5, 0.19, z]]));
    b.add(MAT.DARK, box(0.14, 0.03, 0.105, { p: [-0.73, 0.015, z], color: NAVY }));
  }

  // claw mounts on the belly; claws on clawF and clawB
  for (const x of [0.3, -0.3]) b.add(MAT.DARK, cbox(0.08, 0.04, 0.24, 0.01, { p: [x, 0.03, 0], color: NAVY }));
  b.node('clawF', { pivot: [0.3, 0.015, 0], axis: 'z', param: 'claws' });
  b.node('clawB', { pivot: [-0.3, 0.015, 0], axis: 'z', param: 'clawsB' });
  for (const [node, dir] of [['clawF', -1], ['clawB', 1]]) {
    b.add(MAT.METAL, cyl(0.014, 0.014, 0.3, 8, { r: [Math.PI / 2, 0, 0], color: LAV_DARK }), node);
    for (const z of [-0.12, 0.12]) claw(b, node, z, dir);
  }
  return b.build({ radius: 0.9, shade: false });
}
