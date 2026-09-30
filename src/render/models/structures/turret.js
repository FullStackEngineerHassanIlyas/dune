// Gun Turret and Rocket Turret (1x1), after the Genesis sprites: on an olive concrete plate, a squat
// battered olive drum under a khaki collar studded all round, an olive armoured cupola, and on its
// turret ring a faceted head split by a dark mantlet gap with a vision slot running aft, a hatch and a
// periscope. The Gun Turret's long lavender gun (breech sleeve, jacket band, muzzle brake) recoils on
// its own node; the Rocket Turret keeps the gun and adds two lavender rocket pods on pylons, each with a
// jacket band and three orange warheads. Heads rest facing east (+x); the views turn them.
import { ModelBuilder, MAT, box, cbox, cyl, dome, cone, hull, lathe } from '../kit.js';
import { PAL } from '../palette.js';
import { foundation, FOUNDATION_TOP as T, bolts } from '../detail.js';

const OLIVE = 0x51512f, OLIVE_HEAD = 0x595933, OLIVE_DARK = 0x3d3d25, KHAKI = 0x9c9c7a, PALE = 0xd2d2b4, SLOT = 0x121208, WARHEAD = 0xc8701c;
const HEAD_Y = 0.37, AXIS = 0.07;   // turret node pivot height; gun axis above it (0.44 up)

/** The fixed base: plate, battered drum, studded khaki collar, cupola and turret ring. */
function base(b) {
  foundation(b, 1, 1);
  b.add(MAT.PAINT, lathe([[0, T], [0.35, T], [0.318, 0.2], [0, 0.2]], 20, { color: OLIVE_DARK }));
  b.add(MAT.PAINT, lathe([[0.28, 0.195], [0.332, 0.195], [0.332, 0.22], [0.317, 0.235], [0.28, 0.235]], 20, { color: KHAKI }));
  const studs = [];
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; studs.push([Math.cos(a) * 0.31, 0.238, Math.sin(a) * 0.31]); }
  bolts(b, studs, { r: 0.014, h: 0.012, color: PALE, mat: MAT.PAINT });
  b.add(MAT.PAINT, dome(0.295, 20, { p: [0, 0.225, 0], s: [1, 0.55, 1], color: OLIVE }));
  b.add(MAT.PAINT, lathe([[0.17, HEAD_Y - 0.035], [0.215, HEAD_Y - 0.035], [0.205, HEAD_Y + 0.005], [0.17, HEAD_Y + 0.005]], 20, { color: KHAKI }));
  for (const a of [0.5, 2.6, 3.9, 5.4]) b.add(MAT.DARK, box(0.07, 0.02, 0.012, { p: [Math.cos(a) * 0.336, 0.14, Math.sin(a) * 0.336], r: [0, -a + Math.PI / 2, 0], color: SLOT }));
  b.add(MAT.DARK, box(0.08, 0.1, 0.012, { p: [0, T + 0.05, 0.338], r: [-0.21, 0, 0], color: SLOT }));
  b.add(MAT.PAINT, box(0.11, 0.02, 0.03, { p: [0, T + 0.108, 0.326], r: [-0.21, 0, 0], color: KHAKI }));
  b.node('turret', { pivot: [0, HEAD_Y, 0] });
}

/** The rotating head: low faceted cap, dark mantlet gap across it and a slot aft with khaki ribs, hatch, periscope, mantlet. */
function head(b) {
  const hi = 0.085, pts = [];
  for (let k = 0; k < 10; k++) {
    const a = ((k + 0.5) / 10) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    pts.push([c * 0.215, 0, s * 0.2], [c * 0.155 - 0.01, hi, s * 0.14]);
  }
  b.add(MAT.PAINT, hull(pts, { color: OLIVE_HEAD }), 'turret');
  b.add(MAT.DARK, [box(0.04, 0.01, 0.25, { p: [0.035, hi, 0], color: SLOT }), box(0.15, 0.01, 0.04, { p: [-0.075, hi, 0], color: SLOT })], 'turret');
  b.add(MAT.PAINT, [box(0.02, 0.012, 0.25, { p: [0.005, hi + 0.004, 0], color: KHAKI }), box(0.15, 0.012, 0.02, { p: [-0.075, hi + 0.004, -0.03], color: KHAKI })], 'turret');
  b.add(MAT.PAINT, cyl(0.034, 0.038, 0.016, 10, { p: [-0.09, hi + 0.006, 0.07], color: KHAKI }), 'turret');
  b.add(MAT.METAL, cbox(0.032, 0.04, 0.032, 0.006, { p: [-0.08, hi + 0.018, -0.08], color: PAL.gunmetal }), 'turret');
  b.add(MAT.PAINT, cbox(0.08, 0.1, 0.13, 0.02, { p: [0.16, AXIS, 0], color: PAL.machine }), 'turret');
  b.add(MAT.DARK, cyl(0.042, 0.042, 0.012, 10, { p: [0.202, AXIS, 0], r: [0, 0, Math.PI / 2], color: PAL.navy }), 'turret');
}

/** Lavender gun along +x from x0 (on `node`, axis at y): breech sleeve, jacket band, muzzle brake. */
function gun(b, node, x0, y, len) {
  const along = [0, 0, Math.PI / 2], x = (f) => x0 + len * f;
  b.add(MAT.PAINT, cyl(0.042, 0.042, len * 0.28, 12, { p: [x(0.14), y, 0], r: along, color: PAL.machine }), node);
  b.add(MAT.PAINT, cyl(0.03, 0.032, len * 0.6, 12, { p: [x(0.58), y, 0], r: along, color: PAL.machineLight }), node);
  b.add(MAT.METAL, cyl(0.037, 0.037, 0.022, 12, { p: [x(0.64), y, 0], r: along, color: PAL.navyLight }), node);
  b.add(MAT.PAINT, cyl(0.041, 0.038, len * 0.14, 12, { p: [x(0.93), y, 0], r: along, color: PAL.machine }), node);
  b.add(MAT.DARK, cyl(0.024, 0.024, 0.004, 10, { p: [x(1) + 0.001, y, 0], r: along, color: SLOT }), node);
  for (const s of [-1, 1]) b.add(MAT.PAINT, box(0.03, 0.024, 0.018, { p: [x(0.95), y, s * 0.04], color: PAL.machineLight }), node);
}

/** A lavender rocket pod along x at (z, y) on its pylon: jacket bands, end rings and three orange warheads in dark tubes. */
function pod(b, z, y) {
  const along = [0, 0, Math.PI / 2], r = 0.085, t = 'turret';
  b.add(MAT.PAINT, cbox(0.1, 0.05, 0.19, 0.012, { p: [-0.03, y, z - Math.sign(z) * 0.16], color: PAL.machine }), t);
  b.add(MAT.PAINT, cyl(r, r, 0.38, 12, { p: [-0.01, y, z], r: along, color: PAL.machineLight }), t);
  b.add(MAT.PAINT, cyl(r - 0.012, r, 0.03, 12, { p: [-0.215, y, z], r: along, color: PAL.machine }), t);
  b.add(MAT.PAINT, cyl(r + 0.003, r, 0.022, 12, { p: [0.19, y, z], r: along, color: PAL.machine }), t);
  for (const x of [0.09, -0.12]) b.add(MAT.METAL, cyl(r + 0.004, r + 0.004, 0.02, 12, { p: [x, y, z], r: along, color: PAL.navyLight }), t);
  for (const [dy, dz] of [[0.03, -0.034], [0.03, 0.034], [-0.034, 0]]) {
    b.add(MAT.DARK, cyl(0.028, 0.028, 0.01, 8, { p: [0.203, y + dy, z + dz], r: along, color: SLOT }), t);
    b.add(MAT.PAINT, cone(0.023, 0.055, 8, { p: [0.232, y + dy, z + dz], r: [0, 0, -Math.PI / 2], color: WARHEAD }), t);
  }
}

export function gunTurret() {
  const b = new ModelBuilder('turret');
  base(b);
  head(b);
  b.node('barrel', { parent: 'turret', pivot: [0.14, AXIS, 0], axis: 'x', kind: 'trans' });
  gun(b, 'barrel', 0, 0, 0.44);
  return b.build({ radius: 0.58, muzzle: [0.44, 0, 0] });
}

export function rocketTurret() {
  const b = new ModelBuilder('rocketTurret');
  base(b);
  head(b);
  gun(b, 'turret', 0.14, AXIS, 0.36);
  const py = 0.035;
  for (const side of [-1, 1]) pod(b, side * 0.37, py);
  return b.build({ radius: 0.58, muzzle: [0.26, py, 0] });
}
