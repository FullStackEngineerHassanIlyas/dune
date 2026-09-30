// High-Tech Factory (3x2), after the Genesis sprite, which is 2x2: its layout fills the west two tiles
// and the research's extension the east one. The lavender capsule of an aircraft pod lies north-south
// on cradles in the west, three blue windows along its canopy, held by white clamps; a see-through
// lattice deck (an L running on east under the beam) carries a second, smaller pod and a rivet ball;
// a canister and a finned radiator stand in the south-west. A long gantry beam crosses the north on
// three legs, white-striped with a row of dark slots, its west end sloped and its east end rounded.
// The east tile holds the round launch pad: a turntable with a white cross that turns slowly (node
// `crane`), landing lights round its rim. The house orb sits in the south-west corner.
import { ModelBuilder, MAT, box, cbox, cyl, sphere, hull, lathe, ring, prism, place } from '../kit.js';
import { PAL } from '../palette.js';
import { foundation, FOUNDATION_TOP as T, houseOrb, ladder, rod } from '../detail.js';

const BLUE = 0x0a5cff, CYAN = 0x40e8ff;

/**
 * A pod lying along z (or x when `ew`): a squashed round hull tapering to both ends (`taper` 2 for the
 * Genesis lozenge, 4 for a fuller capsule), two bands, two cradles, windows along its crown on a
 * canopy ridge, a docking nose at its far end.
 */
function pod(b, x, z, { len, r, y, sq = 0.65, taper = 2, ew = false, windows = [], canopy = 0, nose = false }) {
  const h = len / 2, rAt = (t) => r * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t) / h, taper)), 0.45);
  const prof = [-1, -0.97, -0.9, -0.8, -0.65, -0.45, -0.2, 0, 0.2, 0.45, 0.65, 0.8, 0.9, 0.97, 1].map((u) => [rAt(u * h), u * h]);
  const at = { p: [x, y, z], r: ew ? [0, 0, -Math.PI / 2] : [Math.PI / 2, 0, 0], s: ew ? [sq, 1, 1] : [1, 1, sq] };
  const along = (t, yy, u = 0) => (ew ? [x + t, yy, z + u] : [x + u, yy, z + t]);
  const crown = (t) => y + rAt(t) * sq;
  b.add(MAT.PAINT, lathe(prof, 20, { ...at, color: PAL.machineLight }));
  b.add(MAT.PAINT, place([-0.7, 0.7].map((u) => cyl(rAt(u * h) + 0.006, rAt(u * h) + 0.006, 0.03, 20, { p: [0, u * h, 0], color: PAL.navyLight })), at));
  if (nose) {
    const rot = ew ? [0, 0, -Math.PI / 2] : [Math.PI / 2, 0, 0];
    b.add(MAT.PAINT, cyl(0.06, 0.085, 0.03, 14, { p: along(h - 0.03, y), r: rot, color: PAL.navy }));
    b.add(MAT.METAL, cyl(0.035, 0.055, 0.05, 12, { p: along(h + 0.01, y), r: rot, color: PAL.machineDark }));
  }
  const ch = canopy ? 0.035 : 0;
  if (canopy) {
    const pts = [];
    for (const t of [-canopy / 2, canopy / 2]) for (const [u, v] of [[-0.09, -0.02], [0.09, -0.02], [-0.055, ch], [0.055, ch]]) pts.push(along(t, crown(t) + v, u));
    for (const t of [-canopy / 2 - 0.05, canopy / 2 + 0.05]) pts.push(along(t, crown(t) - 0.02));
    b.add(MAT.PAINT, hull(pts, { color: PAL.navyLight }));
  }
  const rr = ew ? [0, Math.PI / 2, 0] : [0, 0, 0];
  for (const [t, round] of windows) {
    const p = along(t, crown(t) + ch - 0.004);
    if (round) {
      b.add(MAT.PAINT, cyl(0.06, 0.066, 0.02, 12, { p, color: PAL.navy }));
      b.add(MAT.LIGHT, cyl(0.04, 0.04, 0.024, 12, { p, color: BLUE, glow: 1.5 }));
      b.add(MAT.LIGHT, box(0.014, 0.026, 0.05, { p: along(t, p[1], -0.02), r: rr, color: CYAN, glow: 1.3 }));
    } else {
      b.add(MAT.PAINT, cbox(0.1, 0.02, 0.15, 0.008, { p, r: rr, color: PAL.navy }));
      b.add(MAT.LIGHT, box(0.05, 0.024, 0.11, { p, r: rr, color: BLUE, glow: 1.5 }));
      b.add(MAT.LIGHT, box(0.016, 0.026, 0.08, { p: along(t, p[1], -0.012), r: rr, color: CYAN, glow: 1.3 }));
    }
  }
  for (const t of [-h * 0.5, h * 0.45]) {
    const lo = y - T - rAt(t) * sq * 0.5, hi = y - T - rAt(t) * sq * 0.1, w = rAt(t) * 0.8;
    b.add(MAT.PAINT, prism([[-w, 0], [w, 0], [w, lo], [w * 0.6, hi], [-w * 0.6, hi], [-w, lo]], 0.06, { p: along(t, T), r: ew ? [0, Math.PI / 2, 0] : [0, 0, 0], color: PAL.machineDark }));
  }
}

/** Open grating of lavender bars over the olive plate, x0..x1 by z0..z1, on corner posts. */
function lattice(b, x0, x1, z0, z1, y) {
  const bars = [], nx = Math.round((x1 - x0) / 0.114), nz = Math.round((z1 - z0) / 0.122);
  for (let i = 0; i <= nx; i++) bars.push(box(0.022, 0.02, z1 - z0 + 0.022, { p: [x0 + (i * (x1 - x0)) / nx, y, (z0 + z1) / 2], color: PAL.machine }));
  for (let j = 0; j <= nz; j++) bars.push(box(x1 - x0 + 0.022, 0.02, 0.022, { p: [(x0 + x1) / 2, y - 0.004, z0 + (j * (z1 - z0)) / nz], color: PAL.machine }));
  b.add(MAT.PAINT, bars);
  for (const x of [x0, (x0 + x1) / 2, x1]) for (const z of [z0, z1]) b.add(MAT.PAINT, cbox(0.05, y - T, 0.05, 0.008, { p: [x, (T + y) / 2, z], color: PAL.machineDark }));
}

export function hiTechFactory() {
  const b = new ModelBuilder('hiTechFactory');
  foundation(b, 3, 2);

  // the big pod, its clamps, the canister
  pod(b, -1.09, -0.24, { len: 1.32, r: 0.29, y: T + 0.2, windows: [[-0.26, false], [0, true], [0.26, false]], canopy: 0.62, nose: true });
  for (const z of [-0.64, 0.1]) {
    for (const dz of [-0.04, 0, 0.04]) b.add(MAT.PAINT, cbox(0.24, 0.03, 0.022, 0.006, { p: [-0.8, T + 0.2, z + dz], color: dz ? PAL.machineLight : PAL.white }));
    b.add(MAT.PAINT, cbox(0.05, 0.14, 0.14, 0.01, { p: [-0.68, T + 0.13, z], color: PAL.machineDark }));
  }
  b.add(MAT.PAINT, cyl(0.07, 0.075, 0.2, 14, { p: [-0.78, T + 0.1, 0.4], color: PAL.machine }));
  b.add(MAT.PAINT, cyl(0.075, 0.06, 0.03, 14, { p: [-0.78, T + 0.215, 0.4], color: PAL.machineLight }));
  b.add(MAT.METAL, rod([-0.84, T + 0.15, 0.36], [-0.98, T + 0.12, 0.3], 0.016, 6, { color: PAL.machineLight }));

  // finned radiator in the south-west
  b.add(MAT.PAINT, cbox(0.46, 0.05, 0.38, 0.012, { p: [-0.76, T + 0.025, 0.73], color: PAL.machineDark }));
  [[-0.94, 0.2], [-0.83, 0.27], [-0.72, 0.24], [-0.6, 0.18]].forEach(([x, h], k) => {
    const fin = [[-0.16, 0], [0.16, 0], [0.16, h * 0.55], [0.02, h], [-0.1, h * 0.8], [-0.16, h * 0.6]];
    b.add(MAT.PAINT, prism(fin, 0.045, { p: [x, T + 0.05, 0.73], r: [0, Math.PI / 2, 0], color: k % 2 ? PAL.machine : PAL.machineLight }));
  });

  // lattice deck on posts, in an L under the beam; the small pod and a rivet ball on it
  const ly = T + 0.07;
  lattice(b, -0.72, 0.42, -0.5, 0.6, ly);
  lattice(b, 0.42, 1.3, -0.5, -0.19, ly);
  pod(b, -0.2, 0.3, { len: 0.62, r: 0.14, y: ly + 0.16, sq: 0.8, taper: 4, ew: true, windows: [[0.08, false]] });
  b.add(MAT.METAL, cyl(0.05, 0.06, 0.03, 12, { p: [0.06, ly + 0.02, -0.18], color: PAL.machineDark }));
  b.add(MAT.PAINT, sphere(0.06, 14, { p: [0.06, ly + 0.08, -0.18], color: PAL.machineLight }));

  // gantry beam across the north on three legs
  const bz = -0.73, by = T + 0.42, bh = 0.13, bd = 0.32, bx0 = -0.56, bx1 = 1.16;
  b.add(MAT.PAINT, cbox(bx1 - bx0, bh, bd, 0.02, { p: [(bx0 + bx1) / 2, by + bh / 2, bz], color: PAL.machine }));
  b.add(MAT.PAINT, cyl(bd / 2, bd / 2, bh, 20, { p: [bx1, by + bh / 2, bz], color: PAL.navyLight }));
  b.add(MAT.PAINT, hull([[-0.56, by, bz - bd / 2], [-0.56, by, bz + bd / 2], [-0.56, by + 0.19, bz - bd / 2], [-0.56, by + 0.19, bz + bd / 2],
    [-0.74, by, bz - bd / 2], [-0.74, by, bz + bd / 2], [-0.66, by + 0.19, bz - bd / 2], [-0.66, by + 0.19, bz + bd / 2]], { color: PAL.machineLight }));
  b.add(MAT.PAINT, cbox(0.1, 0.06, bd - 0.02, 0.01, { p: [-0.5, by + bh + 0.03, bz], color: PAL.machineLight }));
  b.add(MAT.PAINT, box(bx1 - bx0 + 0.1, 0.006, 0.07, { p: [(bx0 + bx1) / 2 - 0.05, by + bh + 0.002, bz - 0.1], color: PAL.white }));
  const slots = [];
  for (let x = -0.36; x < bx1 - 0.08; x += 0.13) slots.push(box(0.06, 0.006, 0.05, { p: [x, by + bh + 0.002, bz + 0.02], color: PAL.navy }));
  b.add(MAT.DARK, slots);
  const ribs = [];
  for (let x = -0.46; x < bx1; x += 0.13) ribs.push(box(0.024, 0.05, bd - 0.04, { p: [x, by - 0.02, bz], color: PAL.navy }));
  b.add(MAT.PAINT, ribs);
  for (const x of [-0.5, 0.3, 1.06]) {
    for (const dz of [-0.11, 0.11]) b.add(MAT.PAINT, cbox(0.05, by - T, 0.05, 0.01, { p: [x, T + (by - T) / 2, bz + dz], color: PAL.machineDark }));
    b.add(MAT.METAL, rod([x, T + 0.04, bz - 0.11], [x, by - 0.05, bz + 0.11], 0.008, 4, { color: PAL.machineLight }));
  }
  ladder(b, { h: by - T, at: { p: [0.3, T, bz + 0.14] } });

  // launch pad: turntable with a white cross, landing lights round the rim
  const px = 0.9, pz = 0.3, pr = 0.42;
  b.add(MAT.PAINT, cyl(pr, pr + 0.02, 0.05, 32, { p: [px, T + 0.025, pz], color: PAL.machine }));
  b.add(MAT.PAINT, ring(pr, pr - 0.05, 0.01, 32, { p: [px, T + 0.05, pz], color: PAL.machineLight }));
  b.add(MAT.DARK, cyl(pr - 0.05, pr - 0.05, 0.006, 32, { p: [px, T + 0.051, pz], color: PAL.navy }));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    b.add(MAT.LIGHT, sphere(0.018, 8, { p: [px + Math.cos(a) * (pr - 0.025), T + 0.062, pz + Math.sin(a) * (pr - 0.025)], color: PAL.amber, glow: 1.8 }));
  }
  b.node('crane', { pivot: [px, T + 0.054, pz], param: 'crane' });
  const turntable = [
    ring(0.3, 0.2, 0.012, 28, { color: PAL.navyLight }),
    cyl(0.2, 0.2, 0.02, 28, { p: [0, 0.01, 0], color: PAL.machine }),
    ring(0.2, 0.17, 0.024, 28, { color: PAL.machineLight }),
    cyl(0.09, 0.09, 0.03, 20, { p: [0, 0.015, 0], color: PAL.navy }),
    box(0.13, 0.034, 0.03, { p: [0, 0.018, 0], color: PAL.white }),
    box(0.03, 0.034, 0.13, { p: [0, 0.018, 0], color: PAL.white }),
  ];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    turntable.push(box(0.05, 0.016, 0.014, { p: [Math.cos(a) * 0.25, 0.006, Math.sin(a) * 0.25], r: [0, -a, 0], color: 0x0b0b16 }));
  }
  b.add(MAT.PAINT, turntable, 'crane');

  houseOrb(b, -1.25, T, 0.75);
  return b.build({ radius: 1.6 });
}
