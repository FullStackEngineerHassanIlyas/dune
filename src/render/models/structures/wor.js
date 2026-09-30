// WOR trooper facility (2x2). No Genesis art: the Genesis-style design of visual-structures.md §2.8,
// with the Barracks' bunker kit on its navy yard but closed into a ring — a khaki bunker wall round
// the north, west and south with an arcade of dark arches facing the yard, two round crenellated
// towers at the north corners, and the trooper hall's gold dome (ribbed, with a slit window) filling
// the south-east beside the arched gatehouse. In the yard a lavender plant block carries a lattice mast
// with a small turning dish and an amber tip light, beside a munitions store of crates and a rack of
// rockets for the troopers' launchers. The house orb sits in the south-west corner.
import { ModelBuilder, MAT, box, cbox, cyl, cone, dome, sphere, lathe, prism, torus } from '../kit.js';
import { PAL } from '../palette.js';
import { foundation, FOUNDATION_TOP as T, houseOrb, bolts, louvres, rod, halfArc } from '../detail.js';
import { bunker, slits, KHAKI, KHAKI_DARK, OLIVE, SLIT } from './barracks.js';

const GOLD = 0xefb00c, BRONZE = 0x5a2c06;   // the Palace's gold

/** Round crenellated tower: battered khaki shaft, dark base course, slit windows, merlons round a sunken olive deck. */
function tower(b, x, z, h) {
  const r = 0.155, top = T + h;
  b.add(MAT.PAINT, lathe([[0, T], [r + 0.02, T], [r, top], [r - 0.045, top], [r - 0.045, top - 0.05], [0, top - 0.05]], 18, { p: [x, 0, z], color: KHAKI }));
  b.add(MAT.PAINT, cyl(r + 0.024, r + 0.03, 0.05, 18, { p: [x, T + 0.025, z], color: KHAKI_DARK }));
  b.add(MAT.PAINT, cyl(r - 0.045, r - 0.045, 0.004, 18, { p: [x, top - 0.048, z], color: OLIVE }));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    b.add(MAT.PAINT, cbox(0.07, 0.05, 0.05, 0.008, { p: [x + Math.cos(a) * (r - 0.02), top + 0.025, z + Math.sin(a) * (r - 0.02)], r: [0, -a, 0], color: KHAKI }));
  }
  for (const a of [0.9, 2.2, 3.6, 5.0]) b.add(MAT.DARK, box(0.016, 0.07, 0.03, { p: [x + Math.cos(a) * (r + 0.004), T + 0.25, z + Math.sin(a) * (r + 0.004)], r: [0, -a, 0], color: SLIT }));
  b.add(MAT.PAINT, dome(0.035, 10, { p: [x, top - 0.046, z], color: PAL.machineLight }));
}

export function wor() {
  const b = new ModelBuilder('wor');
  foundation(b, 2, 2, { plate: PAL.navy, rim: PAL.machine });
  const D = T + 0.2;

  // the bunker ring: west, north and east walls, and the south wall up to the gatehouse; the dome closes it
  bunker(b, [[-0.47, 0.5], [-0.47, -0.47], [0.47, -0.47], [0.47, 0.2], [0.75, 0.2], [0.75, -0.75], [-0.75, -0.75], [-0.75, 0.5]]);
  bunker(b, [[-0.5, 0.47], [0, 0.47], [0, 0.75], [-0.5, 0.75]]);
  slits(b, [-0.75, -0.75], [0.75, -0.75], 5, [0, -1]);
  slits(b, [-0.75, -0.75], [-0.75, 0.5], 4, [-1, 0]);
  slits(b, [0.75, -0.75], [0.75, 0.2], 3, [1, 0]);
  slits(b, [-0.5, 0.75], [0, 0.75], 2, [0, 1]);
  for (const [x, z] of [[-0.22, -0.61], [0.25, -0.61], [0.61, -0.2], [-0.61, 0.05], [-0.61, 0.33], [-0.25, 0.61]]) {
    const r = [0, Math.abs(x) > 0.55 ? Math.PI / 2 : 0, 0];
    b.add(MAT.DARK, box(0.07, 0.008, 0.035, { p: [x, D + 0.004, z], r, color: SLIT }));
    b.add(MAT.PAINT, box(0.086, 0.004, 0.05, { p: [x, D + 0.002, z], r, color: KHAKI_DARK }));
  }
  // arcade of arches along the yard faces of the north and west walls
  for (const x of [-0.3, -0.1, 0.1, 0.3]) {
    b.add(MAT.DARK, prism(halfArc(0.05, 0.16, 8), 0.012, { p: [x, T, -0.466], color: SLIT }));
    b.add(MAT.PAINT, prism(halfArc(0.068, 0.18, 8), 0.008, { p: [x, T, -0.47], color: KHAKI_DARK }));
  }
  for (const z of [-0.15, 0.15]) {
    b.add(MAT.DARK, prism(halfArc(0.05, 0.16, 8), 0.012, { p: [-0.466, T, z], r: [0, Math.PI / 2, 0], color: SLIT }));
    b.add(MAT.PAINT, prism(halfArc(0.068, 0.18, 8), 0.008, { p: [-0.47, T, z], r: [0, Math.PI / 2, 0], color: KHAKI_DARK }));
  }
  tower(b, -0.62, -0.62, 0.44);
  tower(b, 0.62, -0.62, 0.44);

  // gatehouse between the south wall and the dome: arched gate facing south, merlons on the roof
  const hx = 0.11;
  b.add(MAT.PAINT, cbox(0.24, 0.32, 0.27, 0.016, { p: [hx, T + 0.16, 0.615], color: KHAKI }));
  b.add(MAT.PAINT, cbox(0.25, 0.03, 0.28, 0.01, { p: [hx, T + 0.32, 0.615], color: KHAKI_DARK }));
  for (const [dx, dz] of [[-0.09, -0.1], [0.09, -0.1], [-0.09, 0.1], [0.09, 0.1]]) b.add(MAT.PAINT, cbox(0.05, 0.045, 0.05, 0.008, { p: [hx + dx, T + 0.355, 0.615 + dz], color: KHAKI }));
  b.add(MAT.PAINT, prism(halfArc(0.075, 0.22, 8), 0.012, { p: [hx, T, 0.752], color: KHAKI_DARK }));
  b.add(MAT.DARK, prism(halfArc(0.058, 0.2, 8), 0.012, { p: [hx, T, 0.757], color: SLIT }));
  b.add(MAT.DARK, prism(halfArc(0.058, 0.2, 8), 0.012, { p: [hx, T, 0.478], color: SLIT }));
  for (const dx of [-0.095, 0.095]) b.add(MAT.LIGHT, box(0.022, 0.03, 0.012, { p: [hx + dx, T + 0.24, 0.755], color: PAL.amber, glow: 1.5 }));

  // trooper hall: gold dome on a dark drum with doors to the yard, ribs, slit window, finial
  const gx = 0.46, gz = 0.44, gr = 0.27, gy = T + 0.1;
  b.add(MAT.PAINT, cyl(gr + 0.02, gr + 0.03, 0.1, 24, { p: [gx, T + 0.05, gz], color: BRONZE }));
  b.add(MAT.METAL, torus(gr + 0.012, 0.012, 5, 24, { p: [gx, gy, gz], r: [Math.PI / 2, 0, 0], color: PAL.brassDark }));
  b.add(MAT.METAL, dome(gr, 24, { p: [gx, gy, gz], s: [1, 1.05, 1], color: GOLD }));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    b.add(MAT.METAL, torus(gr + 0.002, 0.005, 4, 12, { p: [gx, gy, gz], r: [0, a, 0], s: [1, 1.05, 1], color: 0xc08a2a }, Math.PI / 2 * 0.9));
  }
  const onDome = (az, el) => [gx + (gr + 0.004) * Math.cos(el) * Math.cos(az), gy + 1.05 * (gr + 0.004) * Math.sin(el), gz + (gr + 0.004) * Math.cos(el) * Math.sin(az)];
  b.add(MAT.DARK, rod(onDome(0.85, 0.85), onDome(1.2, 0.85), 0.014, 6, { color: SLIT }));
  b.add(MAT.METAL, cyl(0.03, 0.045, 0.04, 10, { p: [gx, gy + gr * 1.05 + 0.01, gz], color: PAL.goldDark }));
  b.add(MAT.METAL, sphere(0.028, 10, { p: [gx, gy + gr * 1.05 + 0.045, gz], color: GOLD }));
  for (const a of [2.4, 3.4]) b.add(MAT.DARK, prism(halfArc(0.04, 0.075, 6), 0.012, { p: [gx + Math.cos(a) * (gr + 0.03), T, gz + Math.sin(a) * (gr + 0.03)], r: [0, -a - Math.PI / 2, 0], color: SLIT }));

  // munitions store: a crate stack and a rack of rockets for the troopers' launchers
  for (const [x, y, z, r] of [[-0.34, 0, 0.3, 0.1], [-0.22, 0, 0.33, -0.15], [-0.33, 0, 0.18, 0.05], [-0.33, 0.1, 0.27, 0.3]]) {
    b.add(MAT.PAINT, cbox(0.1, 0.1, 0.1, 0.012, { p: [x, T + y + 0.05, z], r: [0, r, 0], color: PAL.crate }));
    b.add(MAT.PAINT, box(0.104, 0.012, 0.03, { p: [x, T + y + 0.07, z], r: [0, r, 0], color: 0xc98a4a }));
  }
  for (const x of [0.08, 0.28]) b.add(MAT.PAINT, prism([[-0.07, 0], [0.07, 0], [0.03, 0.1], [-0.03, 0.1]], 0.025, { p: [x, T, -0.3], r: [0, Math.PI / 2, 0], color: PAL.machineDark }));
  for (const [dz, dy] of [[-0.045, 0], [0.045, 0], [0, 0.04]]) {
    b.add(MAT.PAINT, cyl(0.022, 0.022, 0.3, 8, { p: [0.18, T + 0.12 + dy, -0.3 + dz], r: [0, 0, Math.PI / 2], color: PAL.machineLight }));
    b.add(MAT.PAINT, cone(0.022, 0.05, 8, { p: [0.355, T + 0.12 + dy, -0.3 + dz], r: [0, 0, -Math.PI / 2], color: 0xc8701c }));
  }

  // plant block and lattice mast in the yard, dish turning on the `dish` param
  const mx = -0.08, mz = -0.02, mTop = T + 0.66;
  b.add(MAT.PAINT, cbox(0.34, 0.1, 0.3, 0.02, { p: [mx, T + 0.05, mz], color: PAL.machine }));
  louvres(b, { w: 0.14, d: 0.12, n: 4, at: { p: [mx - 0.07, T + 0.1, mz + 0.05] }, frame: PAL.navy, slats: PAL.machineDark });
  b.add(MAT.PAINT, cbox(0.1, 0.06, 0.08, 0.012, { p: [mx + 0.1, T + 0.13, mz + 0.07], color: PAL.machineLight }));
  for (const [dx, c] of [[-0.02, 0x33ccff], [0.02, PAL.amber]]) b.add(MAT.LIGHT, box(0.022, 0.02, 0.01, { p: [mx + 0.1 + dx, T + 0.13, mz + 0.112], color: c, glow: 1.4 }));
  const feet = [[-0.06, -0.06], [0.06, -0.06], [0.06, 0.06], [-0.06, 0.06]];
  for (const [dx, dz] of feet) b.add(MAT.METAL, rod([mx + dx, T + 0.1, mz + dz], [mx + dx * 0.25, mTop, mz + dz * 0.25], 0.008, 5, { color: PAL.machineLight }));
  const taper = (y) => 1 - (0.75 * (y - T - 0.1)) / (mTop - T - 0.1);
  for (let k = 0; k < 4; k++) {
    const y0 = T + 0.12 + k * 0.13, y1 = y0 + 0.13;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = feet[i], [cx, cz] = feet[(i + 1) % 4];
      b.add(MAT.METAL, rod([mx + ax * taper(y0), y0, mz + az * taper(y0)], [mx + cx * taper(y1), y1, mz + cz * taper(y1)], 0.004, 4, { color: PAL.machine }));
    }
  }
  bolts(b, feet.map(([dx, dz]) => [mx + dx, T + 0.104, mz + dz]), { r: 0.012, color: PAL.navy });
  b.node('dish', { pivot: [mx, mTop, mz] });
  b.add(MAT.METAL, cyl(0.012, 0.012, 0.06, 6, { p: [0, 0.03, 0], color: PAL.steel }), 'dish');
  b.add(MAT.PAINT, lathe([[0.004, 0], [0.05, 0.012], [0.09, 0.035], [0.1, 0.045], [0.093, 0.045], [0.045, 0.02], [0.004, 0.008]], 14, { p: [0.03, 0.08, 0], r: [0, 0, -1.1], color: PAL.machineLight }), 'dish');
  b.add(MAT.METAL, rod([0.03, 0.08, 0], [0.1, 0.12, 0], 0.004, 4, { color: PAL.steel }), 'dish');
  b.add(MAT.LIGHT, sphere(0.018, 8, { p: [0, 0.075, 0], color: PAL.amber, glow: 2 }), 'dish');

  houseOrb(b, -0.75, T, 0.75);
  return b.build({ radius: 1.1 });
}
