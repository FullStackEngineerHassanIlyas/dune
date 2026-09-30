// Repair Facility (3x2), after the Genesis sprite: the white L of the tall gantry down the east side
// (a portal on A-frame legs, its girder white-striped with two tool sockets) and the long white front
// beam running west from its foot over the bay entrance, four yellow lights under it. The repair pad
// sits in the middle column (vehicles drive onto it from the entrance south of it; its amber lights
// pulse while one stands there), and a hoist runs up and down the gantry (node `arm`) with a twin
// white boom reaching over the pad and the welding head hanging from it. The navy workshop floor in
// the north-west is strewn with crates, gold bar stacks, wrenches, a shaft, a box and a hex nut; three
// hydraulic rams stand south of it, with a pump and its piping by the house orb in the south-west.
import { ModelBuilder, MAT, box, cbox, cyl, cone, sphere, hull, torus } from '../kit.js';
import { PAL } from '../palette.js';
import { foundation, FOUNDATION_TOP as T, houseOrb, bolts, ladder, hazard, studGrid, pipe, rod } from '../detail.js';

const PAD = 0.066, WELL = 0x0b0b16, CREAM = 0xffdeb5;

/** Three gold bars lying side by side along x, each with two orange bands. */
function barStack(b, x, z) {
  for (const dz of [-0.05, 0, 0.05]) {
    b.add(MAT.PAINT, cyl(0.026, 0.026, 0.4, 10, { p: [x, T + 0.03, z + dz], r: [0, 0, Math.PI / 2], color: PAL.gold }));
    for (const dx of [-0.12, 0.12]) b.add(MAT.PAINT, cyl(0.028, 0.028, 0.035, 10, { p: [x + dx, T + 0.03, z + dz], r: [0, 0, Math.PI / 2], color: PAL.grille }));
  }
  b.add(MAT.PAINT, cyl(0.026, 0.026, 0.38, 10, { p: [x, T + 0.075, z - 0.025], r: [0, 0, Math.PI / 2], color: PAL.gold }));
}

/** A flat wrench lying on the floor, turned by a. */
function wrench(b, x, z, a) {
  const y = T + 0.012, c = Math.cos(a), s = Math.sin(a);
  b.add(MAT.METAL, box(0.2, 0.012, 0.03, { p: [x, y, z], r: [0, -a, 0], color: PAL.machineLight }));
  for (const d of [-0.1, 0.1]) b.add(MAT.METAL, torus(0.028, 0.01, 4, 8, { p: [x + c * d, y, z + s * d], r: [Math.PI / 2, 0, 0], color: PAL.white }, Math.PI * (d > 0 ? 1.6 : 2)));
}

export function repairFacility() {
  const b = new ModelBuilder('repairFacility');
  foundation(b, 3, 2);

  // navy workshop floor with its clutter
  b.add(MAT.PAINT, cbox(1.76, 0.01, 0.8, 0.004, { p: [-0.4, T + 0.001, -0.38], color: PAL.navy }));
  b.add(MAT.PAINT, [box(1.76, 0.004, 0.012, { p: [-0.4, T + 0.006, -0.78], color: PAL.machineLight }), box(0.012, 0.004, 0.8, { p: [-1.28, T + 0.006, -0.38], color: PAL.machineLight })]);
  for (const x of [-1.14, -0.93]) {
    b.add(MAT.PAINT, cbox(0.17, 0.12, 0.16, 0.012, { p: [x, T + 0.06, -0.66], color: PAL.crate }));
    b.add(MAT.PAINT, box(0.13, 0.008, 0.12, { p: [x, T + 0.121, -0.66], color: 0x6b3000 }));
    b.add(MAT.PAINT, [box(0.17, 0.012, 0.02, { p: [x, T + 0.121, -0.735], color: CREAM }), box(0.02, 0.012, 0.16, { p: [x - 0.075, T + 0.121, -0.66], color: CREAM })]);
  }
  barStack(b, -1.03, -0.42);
  barStack(b, -0.02, -0.66);
  wrench(b, -0.66, -0.64, 0.7);
  wrench(b, -1.12, -0.18, -0.5);
  b.add(MAT.METAL, rod([-0.78, T + 0.02, -0.5], [-0.56, T + 0.02, -0.14], 0.018, 8, { color: PAL.machineLight }));
  for (const t of [0, 1]) b.add(MAT.METAL, cyl(0.035, 0.035, 0.02, 10, { p: [-0.78 + t * 0.22, T + 0.02, -0.5 + t * 0.36], r: [Math.PI / 2, 0.55, 0], color: PAL.machine }));
  b.add(MAT.PAINT, cbox(0.1, 0.08, 0.14, 0.012, { p: [-0.62, T + 0.04, -0.34], r: [0, 0.2, 0], color: PAL.grille }));
  b.add(MAT.PAINT, cyl(0.055, 0.055, 0.04, 6, { p: [-0.6, T + 0.02, -0.08], color: PAL.grille }));
  b.add(MAT.DARK, cyl(0.025, 0.025, 0.042, 10, { p: [-0.6, T + 0.021, -0.08], color: WELL }));

  // repair pad: steel deck with a lavender rim, studs and an entry band; its lights pulse while in use
  b.add(MAT.PAINT, box(0.88, 0.012, 1.18, { p: [0, PAD - 0.006, 0.02], color: PAL.navyLight }));
  b.add(MAT.PAINT, [
    box(0.03, 0.016, 1.18, { p: [-0.425, PAD - 0.002, 0.02], color: PAL.machineLight }), box(0.03, 0.016, 1.18, { p: [0.425, PAD - 0.002, 0.02], color: PAL.machine }),
    box(0.82, 0.016, 0.03, { p: [0, PAD - 0.002, -0.555], color: PAL.machineLight }),
  ]);
  studGrid(b, { w: 0.66, d: 0.96, nx: 4, nz: 6, r: 0.02, h: 0.004, seg: 6, at: { p: [0, PAD, 0] }, color: PAL.navy });
  hazard(b, { w: 0.82, d: 0.05, n: 9, h: 0.004, at: { p: [0, PAD, 0.585] } });
  b.node('padLights', { pivot: [0, PAD + 0.01, 0.02], kind: 'scale' });
  for (const z of [-0.46, 0.02, 0.5]) for (const x of [-0.48, 0.48]) b.add(MAT.LIGHT, sphere(0.02, 8, { p: [x, 0, z], color: PAL.amber, glow: 2 }), 'padLights');

  // three hydraulic rams and the pump by the orb
  for (const x of [-1.13, -0.88, -0.64]) {
    b.add(MAT.PAINT, cbox(0.12, 0.05, 0.12, 0.01, { p: [x, T + 0.025, 0.2], color: PAL.machineDark }));
    b.add(MAT.PAINT, cyl(0.045, 0.05, 0.18, 12, { p: [x, T + 0.14, 0.2], color: PAL.machine }));
    b.add(MAT.METAL, cyl(0.022, 0.022, 0.1, 8, { p: [x, T + 0.27, 0.2], color: PAL.steel }));
    b.add(MAT.PAINT, cbox(0.1, 0.03, 0.08, 0.008, { p: [x, T + 0.33, 0.2], color: PAL.white }));
  }
  b.add(MAT.PAINT, cbox(0.62, 0.03, 0.06, 0.008, { p: [-0.885, T + 0.36, 0.2], color: PAL.machineLight }));
  pipe(b, [[-0.64, T + 0.06, 0.27], [-0.64, T + 0.06, 0.46], [-0.72, T + 0.06, 0.62]], { r: 0.02, color: PAL.machine, flangeColor: PAL.machineDark, flanges: 'none' });
  b.add(MAT.PAINT, cbox(0.3, 0.05, 0.16, 0.01, { p: [-0.75, T + 0.025, 0.7], color: PAL.machineDark }));
  b.add(MAT.METAL, cyl(0.035, 0.035, 0.28, 10, { p: [-0.75, T + 0.1, 0.7], r: [0, 0, Math.PI / 2], color: PAL.machineLight }));
  for (const x of [-0.87, -0.63]) b.add(MAT.PAINT, cyl(0.065, 0.065, 0.03, 14, { p: [x, T + 0.1, 0.7], r: [0, 0, Math.PI / 2], color: PAL.white }));
  pipe(b, [[-0.6, T + 0.1, 0.7], [-0.52, T + 0.1, 0.7], [-0.52, T + 0.02, 0.8]], { r: 0.018, color: PAL.machine, flanges: 'none' });

  // gantry down the east side: girder on two A-frames, white stripe, tool sockets, a ladder
  const gx = 0.75, gy = T + 0.66, gh = 0.14;
  b.add(MAT.PAINT, cbox(0.48, gh, 1.56, 0.02, { p: [gx, gy + gh / 2, 0], color: PAL.machine }));
  b.add(MAT.PAINT, box(0.2, 0.006, 1.54, { p: [gx - 0.13, gy + gh + 0.002, 0], color: PAL.white }));
  b.add(MAT.PAINT, box(0.05, 0.006, 1.54, { p: [gx + 0.2, gy + gh + 0.002, 0], color: PAL.navyLight }));
  for (const z of [-0.12, 0.38]) {
    b.add(MAT.PAINT, cbox(0.18, 0.02, 0.2, 0.006, { p: [gx + 0.02, gy + gh + 0.004, z], color: PAL.white }));
    b.add(MAT.DARK, box(0.12, 0.01, 0.14, { p: [gx + 0.02, gy + gh + 0.012, z], color: PAL.navy }));
    b.add(MAT.PAINT, box(0.07, 0.012, 0.018, { p: [gx + 0.02, gy + gh + 0.016, z], r: [0, 0.7, 0], color: PAL.crate }));
  }
  for (const z of [-0.7, 0.7]) {
    b.add(MAT.PAINT, hull([[0.53, gy, z - 0.05], [0.53, gy, z + 0.05], [0.62, gy, z - 0.05], [0.62, gy, z + 0.05], [0.55, T, z - 0.06], [0.55, T, z + 0.06], [0.65, T, z - 0.06], [0.65, T, z + 0.06]], { color: PAL.machineLight }));
    b.add(MAT.PAINT, hull([[0.88, gy, z - 0.05], [0.88, gy, z + 0.05], [0.97, gy, z - 0.05], [0.97, gy, z + 0.05], [1.16, T, z - 0.06], [1.16, T, z + 0.06], [1.26, T, z - 0.06], [1.26, T, z + 0.06]], { color: PAL.machine }));
    b.add(MAT.PAINT, cbox(0.62, 0.04, 0.05, 0.008, { p: [0.9, T + 0.22, z], color: PAL.machineDark }));
    for (const x of [0.6, 1.21]) b.add(MAT.PAINT, cbox(0.14, 0.03, 0.14, 0.008, { p: [x, T + 0.015, z], color: PAL.machineDark }));
  }
  bolts(b, [[0.6, T + 0.034, -0.7], [1.21, T + 0.034, -0.7], [0.6, T + 0.034, 0.7], [1.21, T + 0.034, 0.7]], { r: 0.016, h: 0.012, color: PAL.steelDark });
  b.add(MAT.METAL, box(0.014, 0.02, 1.5, { p: [gx - 0.246, gy + 0.05, 0], color: PAL.steel }));
  ladder(b, { h: gy - T, at: { p: [0.61, T, -0.635] } });
  pipe(b, [[0.99, gy + 0.05, -0.76], [1.02, gy - 0.1, -0.76], [1.02, T + 0.05, -0.76], [1.2, T + 0.05, -0.76]], { r: 0.018, color: PAL.gunmetal, mat: MAT.DARK, flanges: 'none' });
  b.add(MAT.PAINT, cbox(0.14, 0.2, 0.12, 0.012, { p: [1.28, T + 0.1, -0.76], color: PAL.machineDark }));
  b.add(MAT.LIGHT, box(0.06, 0.03, 0.006, { p: [1.28, T + 0.15, -0.698], color: 0x40e8ff, glow: 1.3 }));

  // front beam over the bay entrance, west post, four yellow lights under it
  const fz = 0.76, fd = 0.2, fy = T + 0.62, fh = 0.07, fs = fz + fd / 2;
  b.add(MAT.PAINT, cbox(1.1, fh, fd, 0.018, { p: [0.0, fy + fh / 2, fz], color: PAL.machine }));
  b.add(MAT.PAINT, cbox(1.08, 0.014, fd * 0.55, 0.005, { p: [0.0, fy + fh + 0.005, fs - fd * 0.3], color: PAL.white }));
  b.add(MAT.PAINT, box(1.08, 0.006, 0.014, { p: [0.0, fy + fh + 0.003, fz - fd / 2 + 0.02], color: PAL.machineLight }));
  b.add(MAT.PAINT, cbox(0.1, fy - T + fh, 0.14, 0.016, { p: [-0.54, T + (fy - T + fh) / 2, fz], color: PAL.machineLight }));
  b.add(MAT.PAINT, cbox(0.16, 0.04, 0.18, 0.01, { p: [-0.54, T + 0.02, fz], color: PAL.machineDark }));
  b.add(MAT.DARK, box(0.98, 0.04, 0.012, { p: [0.0, fy + 0.03, fs + 0.001], color: WELL }));
  for (const x of [-0.35, -0.11, 0.14, 0.39]) b.add(MAT.LIGHT, box(0.07, 0.026, 0.012, { p: [x, fy + 0.03, fs + 0.006], color: PAL.yellow, glow: 1.9 }));
  pipe(b, [[-0.54, T + 0.3, fz - 0.09], [-0.54, T + 0.3, 0.1], [-0.54, T + 0.04, 0.02]], { r: 0.02, color: PAL.white, flangeColor: PAL.machineDark });

  // hoist: trolley on the girder, twin white boom over the pad, welding head down to 0.37
  const ay = T + 0.64;
  b.node('arm', { pivot: [0, ay, 0.1], axis: 'z', kind: 'trans' });
  b.add(MAT.PAINT, [
    cbox(0.08, 0.16, 0.22, 0.012, { p: [0.49, 0.03, 0], color: PAL.machineDark }),
    cbox(0.14, 0.07, 0.2, 0.012, { p: [0, -0.02, 0], color: PAL.machine }),
    ...[-0.07, 0.07].map((dz) => cyl(0.022, 0.022, 0.6, 10, { p: [0.17, 0, dz], r: [0, 0, Math.PI / 2], color: PAL.white })),
    cyl(0.012, 0.012, 0.2, 6, { p: [0, -0.15, 0], color: PAL.steel }),
    cbox(0.07, 0.07, 0.07, 0.01, { p: [0, -0.27, 0], color: PAL.machineLight }),
    cone(0.022, 0.05, 8, { p: [0, -0.3, 0], r: [Math.PI, 0, 0], color: PAL.gunmetal }),
  ], 'arm');
  b.add(MAT.LIGHT, sphere(0.014, 8, { p: [0, 0.37 - ay, 0], color: 0x9fe6ff, glow: 2.4 }), 'arm');

  houseOrb(b, -1.25, T, 0.75);
  return b.build({ radius: 1.6 });
}
