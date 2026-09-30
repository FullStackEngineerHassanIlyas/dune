// Palace (3x3), after the Genesis sprite: on the olive foundation, the great faceted gold dome on a
// dark bronze drum, a slit window near its crown and navy fins at its back; five smaller gold
// domes round it (north-west, north, east, south-east, south-west), each with its slit; the gatehouse
// on the dome's south side facing the camera, pale stone pylons and a zig-zag parapet round a golden
// arched door, with steps and a barred grate before it; the navy conduits, one from the round vent in
// the north-east down behind the east domes and south-west to an end block, the other down the dome's
// west side past a row of fins to its own end block; lavender guard posts at the edges, a control box
// in the north-west corner, marker lights along the south edge and the house orb in the south-west.
import { ModelBuilder, MAT, box, cbox, cyl, sphere, torus, ring, hull, prism, tube, place, frustum, geodesic } from '../kit.js';
import { PAL } from '../palette.js';
import { foundation, FOUNDATION_TOP as T, houseOrb, grille, bolts, rod, halfArc } from '../detail.js';

const GOLD = 0xefb00c, GOLD_DARK = 0x944a00, BRONZE = 0x5a2c06, KHAKI = 0xb5b594, KHAKI_DARK = 0x6e6e4c, NAVY = 0x1c2258;

/** Model x or z of a plan coordinate: tiles from the footprint's NW corner, as the sprite plan gives them. */
const m = (v) => v - 1.5;

/** A slit window running from near a dome's crown down its south-east side. */
function slit(b, x, y, z, r, from, to) {
  const mid = (from + to) / 2, len = (to - from) * r, h = Math.sqrt(Math.max(0, r * r - (mid * r) ** 2)), tilt = Math.atan2(mid * r, h);
  const d = Math.SQRT1_2 * mid * r;
  b.add(MAT.DARK, box(len, 0.03, 0.034, { p: [x + d, y + h - 0.004, z + d], r: [0, -Math.PI / 4, -tilt], color: 0x10102a }));
}

/** A navy fin (half-thickness t) standing out from (x, z) along the direction a: tall at the root, low at the tip, a lavender top edge. */
function fin(b, x, z, a, len, h = 0.24, t = 0.026) {
  const ux = Math.cos(a), uz = Math.sin(a), sx = -uz * t, sz = ux * t, tx = x + ux * len, tz = z + uz * len;
  b.add(MAT.PAINT, hull([[x - sx, T, z - sz], [x + sx, T, z + sz], [x - sx, T + h, z - sz], [x + sx, T + h, z + sz], [tx - sx * 0.6, T, tz - sz * 0.6], [tx + sx * 0.6, T, tz + sz * 0.6], [tx, T + 0.04, tz]], { color: NAVY }));
  b.add(MAT.PAINT, rod([x, T + h + 0.004, z], [tx, T + 0.044, tz], 0.008, 4, { color: PAL.machineLight }));
}

/** A small gold dome on a bronze drum, with its slit. */
function smallDome(b, x, z) {
  const px = m(x), pz = m(z), r = 0.27;
  b.add(MAT.PAINT, cyl(r * 0.96, r, 0.07, 20, { p: [px, T + 0.035, pz], color: BRONZE }));
  b.add(MAT.METAL, torus(r * 0.95, 0.014, 4, 22, { p: [px, T + 0.072, pz], r: [Math.PI / 2, 0, 0], color: GOLD_DARK }));
  b.add(MAT.METAL, sphere(r, 20, { p: [px, T + 0.13, pz], color: GOLD }));
  slit(b, px, T + 0.13, pz, r + 0.004, 0.15, 0.62);
}

/** A lavender guard post: bevelled block, sloped cap, dark lamp well. */
function post(b, x, z) {
  const px = m(x), pz = m(z);
  b.add(MAT.PAINT, cbox(0.2, 0.12, 0.2, 0.02, { p: [px, T + 0.06, pz], color: PAL.machine }));
  b.add(MAT.PAINT, frustum(0.2, 0.2, 0.1, 0.1, 0.06, { p: [px, T + 0.12, pz], color: PAL.machineLight }));
  b.add(MAT.DARK, box(0.07, 0.012, 0.07, { p: [px, T + 0.18, pz], color: NAVY }));
  b.add(MAT.LIGHT, sphere(0.018, 6, { p: [px, T + 0.19, pz], color: 0x9fdcff, glow: 1.2 }));
}

export function palace() {
  const b = new ModelBuilder('palace');
  foundation(b, 3, 3);

  // the great dome: bronze drum with window slits, faceted gold shell, slit window, finial, fins at its back
  const dx = m(1.18), dz = m(1.04), R = 0.74;
  b.add(MAT.PAINT, cyl(R + 0.02, R + 0.05, 0.1, 32, { p: [dx, T + 0.05, dz], color: BRONZE }));
  b.add(MAT.METAL, torus(R + 0.015, 0.025, 5, 36, { p: [dx, T + 0.1, dz], r: [Math.PI / 2, 0, 0], color: GOLD_DARK }));
  bolts(b, Array.from({ length: 24 }, (_, k) => { const a = (k / 24) * Math.PI * 2; return [dx + Math.cos(a) * (R + 0.045), T + 0.05, dz + Math.sin(a) * (R + 0.045)]; }), { r: 0.012, axis: 'y', h: 0.07, color: GOLD_DARK, mat: MAT.METAL });
  for (let k = 0; k < 10; k++) {   // window slits round the drum
    const a = (k / 10) * Math.PI * 2 + 0.3;
    b.add(MAT.DARK, box(0.07, 0.045, 0.01, { p: [dx + Math.cos(a) * (R + 0.042), T + 0.055, dz + Math.sin(a) * (R + 0.042)], r: [0, -a + Math.PI / 2, 0], color: 0x1a0c02 }));
  }
  b.add(MAT.METAL, geodesic(R, 3, { p: [dx, T + 0.1, dz], color: GOLD }));
  slit(b, dx, T + 0.1, dz, R + 0.004, 0.08, 0.3);
  b.add(MAT.METAL, cyl(0.05, 0.07, 0.04, 10, { p: [dx, T + 0.1 + R + 0.01, dz], color: GOLD_DARK }));
  b.add(MAT.METAL, sphere(0.04, 10, { p: [dx, T + 0.1 + R + 0.06, dz], color: GOLD }));
  b.add(MAT.METAL, cyl(0.004, 0.012, 0.12, 6, { p: [dx, T + 0.1 + R + 0.15, dz], color: GOLD }));
  for (const a of [-2.0, -1.62, -1.24]) fin(b, dx + Math.cos(a) * (R - 0.04), dz + Math.sin(a) * (R - 0.04), a, 0.24, 0.3, 0.05);

  for (const [x, z] of [[0.6, 0.34], [1.85, 0.34], [2.36, 0.85], [2.36, 1.85], [0.6, 2.1]]) smallDome(b, x, z);

  // the gatehouse, facing south: stone pylons, zig-zag parapet, golden arched door, steps and a grate
  const gx = m(1.22), gz = m(1.95);
  b.add(MAT.PAINT, cbox(0.56, 0.36, 0.26, 0.02, { p: [gx, T + 0.18, gz - 0.13], color: KHAKI }));
  for (const s of [-1, 1]) {
    b.add(MAT.PAINT, cbox(0.14, 0.44, 0.3, 0.025, { p: [gx + s * 0.32, T + 0.22, gz - 0.14], color: KHAKI }));
    b.add(MAT.PAINT, frustum(0.14, 0.3, 0.08, 0.2, 0.05, { p: [gx + s * 0.32, T + 0.44, gz - 0.14], color: KHAKI_DARK }));
    b.add(MAT.METAL, sphere(0.05, 10, { p: [gx + s * 0.32, T + 0.52, gz - 0.14], color: GOLD }));
  }
  for (let k = 0; k < 4; k++) b.add(MAT.PAINT, prism([[-0.07, 0], [0.07, 0], [0, 0.08]], 0.03, { p: [gx - 0.195 + k * 0.13, T + 0.36, gz - 0.015], color: KHAKI }));
  b.add(MAT.DARK, box(0.5, 0.012, 0.18, { p: [gx, T + 0.362, gz - 0.14], color: 0x2a2a14 }));
  b.add(MAT.PAINT, prism(halfArc(0.19, 0.32, 12), 0.02, { p: [gx, T, gz + 0.004], color: 0xe4e2c8 }));
  b.add(MAT.DARK, prism(halfArc(0.16, 0.29, 12), 0.02, { p: [gx, T, gz + 0.012], color: 0x1a1008 }));
  b.add(MAT.METAL, prism(halfArc(0.135, 0.265, 12), 0.02, { p: [gx, T, gz + 0.02], color: GOLD }));
  b.add(MAT.DARK, box(0.008, 0.25, 0.01, { p: [gx, T + 0.125, gz + 0.031], color: GOLD_DARK }));
  bolts(b, [-0.08, -0.04, 0.04, 0.08].flatMap((x) => [0.06, 0.13, 0.2].map((y) => [gx + x, T + y, gz + 0.03])), { r: 0.009, h: 0.008, axis: 'z', color: GOLD_DARK, mat: MAT.METAL });
  for (let k = 0; k < 3; k++) b.add(MAT.PAINT, cbox(0.44 - k * 0.04, 0.06 - k * 0.02, 0.05, 0.006, { p: [gx, T + 0.03 - k * 0.01, gz + 0.03 + k * 0.05], color: k % 2 ? KHAKI_DARK : KHAKI }));
  grille(b, { w: 0.46, d: 0.17, n: 6, at: { p: [m(1.25), T, m(2.255)] }, frame: KHAKI_DARK, bars: 0x2a2a14, back: 0x14140a });

  // the north-east vent: navy drum, lavender rim, white bars
  const vx = m(2.48), vz = m(0.31), vr = 0.19;
  b.add(MAT.PAINT, cyl(vr, vr + 0.02, 0.18, 20, { p: [vx, T + 0.09, vz], color: NAVY }));
  b.add(MAT.PAINT, ring(vr + 0.005, vr - 0.03, 0.02, 20, { p: [vx, T + 0.18, vz], color: PAL.machineLight }));
  b.add(MAT.DARK, cyl(vr - 0.03, vr - 0.03, 0.006, 20, { p: [vx, T + 0.176, vz], color: 0x0a0a18 }));
  for (let k = -2; k <= 2; k++) {
    const t = k * 0.05, l = 2 * Math.sqrt((vr - 0.03) ** 2 - t * t);
    b.add(MAT.PAINT, box(l, 0.014, 0.016, { p: [vx, T + 0.186, vz + t], color: PAL.white }));
  }

  // navy conduits with lavender top rails, ending in blocks with square mouths
  const duct = (pts) => {
    b.add(MAT.DARK, place(tube(pts.map(([x, z]) => [m(x), 0, m(z)]), 0.12, 10, { color: NAVY }), { p: [0, T + 0.07, 0], s: [1, 0.62, 1] }));
    b.add(MAT.PAINT, tube(pts.map(([x, z]) => [m(x) - 0.035, T + 0.14, m(z)]), 0.014, 5, { color: PAL.machineLight }));
    for (let i = 1; i < pts.length - 1; i++) {   // collars at the joints
      const [x0, z0] = pts[i - 1], [x1, z1] = pts[i + 1];
      b.add(MAT.PAINT, place(cyl(0.128, 0.128, 0.035, 12, { r: [Math.PI / 2, 0, 0], color: PAL.navyLight }), { r: [0, -Math.atan2(z1 - z0, x1 - x0) + Math.PI / 2, 0], p: [m(pts[i][0]), T + 0.07, m(pts[i][1])], s: [1, 0.66, 1] }));
    }
  };
  duct([[2.5, 0.48], [2.62, 0.66], [2.64, 1.15], [2.6, 1.6], [2.4, 2.02], [2.1, 2.3], [1.86, 2.38]]);
  duct([[0.62, 0.62], [0.47, 0.95], [0.45, 1.5], [0.5, 1.9], [0.66, 2.24], [0.76, 2.38]]);
  for (const x of [0.86, 1.72]) {
    b.add(MAT.DARK, cbox(0.24, 0.2, 0.23, 0.025, { p: [m(x), T + 0.1, m(2.39)], color: NAVY }));
    b.add(MAT.PAINT, box(0.2, 0.01, 0.19, { p: [m(x), T + 0.2, m(2.39)], color: PAL.navyLight }));
    b.add(MAT.DARK, box(0.08, 0.014, 0.08, { p: [m(x), T + 0.203, m(2.39)], color: 0x050510 }));
    b.add(MAT.PAINT, box(0.24, 0.012, 0.012, { p: [m(x), T + 0.198, m(2.39) - 0.11], color: PAL.machineLight }));
  }
  for (const z of [1.34, 1.5, 1.66, 1.82]) fin(b, m(0.5), m(z), Math.PI, 0.17);   // fins on the west conduit

  // guard posts, the control box, the south marker lights
  for (const [x, z] of [[0.115, 0.615], [0.115, 1.865], [2.85, 0.36], [2.615, 2.615]]) post(b, x, z);
  b.add(MAT.PAINT, cbox(0.19, 0.1, 0.13, 0.015, { p: [m(0.135), T + 0.1, m(0.32)], color: PAL.machineLight }));
  for (const x of [-0.05, 0.05]) b.add(MAT.PAINT, box(0.02, 0.06, 0.02, { p: [m(0.135) + x, T + 0.03, m(0.36)], color: BRONZE }));
  for (const x of [-0.05, 0, 0.05]) b.add(MAT.LIGHT, box(0.03, 0.01, 0.03, { p: [m(0.135) + x, T + 0.152, m(0.3)], color: PAL.orangeGlow, glow: 1.5 }));
  for (const x of [0.9, 1.39, 1.89, 2.38]) b.add(MAT.LIGHT, cyl(0.022, 0.022, 0.012, 8, { p: [m(x), T + 0.006, m(2.79)], color: 0xffffff, glow: 1.2 }));

  houseOrb(b, -1.25, T, 1.25);
  return b.build({ radius: 2.1 });
}
