// MCV, after the Genesis sprite: a long, narrow house-coloured carrier on four axles of big outboard
// wheels (each axle a `wheel*` node), the cab at the front with its windscreen, and the stowed crane
// in lavender metal on the rear half: a turntable and a crane house tapering to its counterweight,
// and the lattice boom lying forward along the centreline onto a rest behind the cab, its hook block
// stowed under the tip. Folded stabiliser legs at the rear corners, lockers beside the boom.
import { ModelBuilder, MAT, box, cbox, cyl, hull } from '../kit.js';
import { PAL } from '../palette.js';
import { rod, bolts } from '../detail.js';

const AXLES = [0.38, 0.14, -0.14, -0.38], WR = 0.085, WW = 0.1, WZ = 0.26, DECK = 0.2;

/** detail.js `wheel` made lighter for eight of them: lugged navy tyre, lavender rim and hub, studs on the outer face only. */
function axleWheel(b, node, s) {
  const z = s * WZ, axle = [Math.PI / 2, 0, 0], lugs = [];
  b.add(MAT.DARK, cyl(WR * 0.9, WR * 0.9, WW, 12, { p: [0, 0, z], r: axle, color: PAL.navy }), node);
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2;
    lugs.push(box(WR * 0.2, WR * 0.16, WW * 0.94, { p: [Math.cos(a) * WR * 0.9, Math.sin(a) * WR * 0.9, z], r: [0, 0, a], color: PAL.navy }));
  }
  b.add(MAT.DARK, lugs, node);
  b.add(MAT.METAL, cyl(WR * 0.52, WR * 0.52, WW + 0.006, 12, { p: [0, 0, z], r: axle, color: PAL.machine }), node);
  b.add(MAT.METAL, cyl(WR * 0.2, WR * 0.24, WW + 0.02, 8, { p: [0, 0, z], r: axle, color: PAL.machineLight }), node);
  const studs = [0, 1, 2, 3].map((k) => [Math.cos(k * Math.PI / 2 + 0.4) * WR * 0.36, Math.sin(k * Math.PI / 2 + 0.4) * WR * 0.36, z + s * (WW / 2 + 0.004)]);
  bolts(b, studs, { r: WR * 0.07, h: 0.006, axis: 'z', seg: 5, color: PAL.machineLight, node });
}

export function mcv() {
  const b = new ModelBuilder('mcv');

  AXLES.forEach((x, k) => {
    const n = `wheel${k}`;
    b.node(n, { pivot: [x, WR, 0], axis: 'z', param: 'wheel' });
    for (const s of [-1, 1]) axleWheel(b, n, s);
    b.add(MAT.METAL, cyl(0.02, 0.02, 0.42, 6, { p: [x, WR, 0], r: [Math.PI / 2, 0, 0], color: PAL.machineDark }));
  });

  // chassis frame and the house-coloured bed
  b.add(MAT.DARK, cbox(0.96, 0.07, 0.3, 0.015, { p: [-0.01, 0.1, 0], color: PAL.navy }));
  b.add(MAT.HOUSE, cbox(0.74, 0.07, 0.34, 0.025, { p: [-0.12, DECK - 0.035, 0] }));
  for (const s of [-1, 1]) {
    b.add(MAT.DARK, cbox(0.72, 0.04, 0.03, 0.008, { p: [-0.12, DECK - 0.05, s * 0.18], color: PAL.navy }));
    bolts(b, [-0.42, -0.26, 0, 0.16].map((x) => [x, DECK - 0.05, s * 0.196]), { r: 0.008, h: 0.006, axis: 'z', seg: 5, color: PAL.machine });
  }

  // cab: sloped windscreen, side windows, roof hatch, bumper
  b.add(MAT.HOUSE, hull([
    [0.23, 0.12, -0.19], [0.23, 0.12, 0.19], [0.5, 0.12, -0.19], [0.5, 0.12, 0.19],
    [0.5, 0.2, -0.19], [0.5, 0.2, 0.19], [0.44, 0.31, -0.17], [0.44, 0.31, 0.17],
    [0.23, 0.32, -0.18], [0.23, 0.32, 0.18], [0.41, 0.335, -0.15], [0.41, 0.335, 0.15], [0.25, 0.335, -0.16], [0.25, 0.335, 0.16],
  ]));
  const screen = (y, z, d) => [0.5 - ((y - 0.2) * 0.06) / 0.11 + d * 0.88, y + d * 0.48, z];   // on the windscreen slope, d off it
  b.add(MAT.GLASS, hull([[0.215, -0.16], [0.215, 0.16], [0.298, -0.14], [0.298, 0.14]].flatMap(([y, z]) => [screen(y, z, -0.002), screen(y, z, 0.004)]), { color: PAL.machine }));
  for (const s of [-1, 1]) {
    b.add(MAT.GLASS, box(0.11, 0.06, 0.006, { p: [0.33, 0.27, s * 0.186], color: PAL.machine }));
    b.add(MAT.GLASS, cbox(0.008, 0.026, 0.04, 0.003, { p: [0.502, 0.18, s * 0.15], color: PAL.machineLight }));
  }
  b.add(MAT.DARK, box(0.006, 0.03, 0.2, { p: [0.501, 0.18, 0], color: PAL.navy }));
  for (const y of [0.17, 0.18, 0.19]) b.add(MAT.METAL, box(0.008, 0.004, 0.19, { p: [0.503, y, 0], color: PAL.machineDark }));
  b.add(MAT.HOUSE, cbox(0.08, 0.012, 0.1, 0.004, { p: [0.31, 0.341, 0], color: 0x707070 }));
  b.add(MAT.METAL, cbox(0.03, 0.04, 0.4, 0.01, { p: [0.505, 0.14, 0], color: PAL.machineDark }));
  b.add(MAT.METAL, rod([0.27, 0.335, 0.13], [0.27, 0.42, 0.13], 0.004, 4, { color: PAL.machineDark }));

  // crane: turntable, crane house tapering aft to the counterweight, boom foot
  b.add(MAT.METAL, cyl(0.125, 0.13, 0.025, 20, { p: [-0.25, DECK + 0.012, 0], color: PAL.machineDark }));
  b.add(MAT.METAL, hull([
    [-0.1, DECK + 0.025, -0.1], [-0.1, DECK + 0.025, 0.1], [-0.1, 0.3, -0.09], [-0.1, 0.3, 0.09],
    [-0.36, DECK + 0.025, -0.1], [-0.36, DECK + 0.025, 0.1], [-0.36, 0.3, -0.09], [-0.36, 0.3, 0.09],
    [-0.46, DECK + 0.025, -0.05], [-0.46, DECK + 0.025, 0.05], [-0.44, 0.27, -0.04], [-0.44, 0.27, 0.04],
  ], { color: PAL.machineLight }));
  b.add(MAT.METAL, cbox(0.22, 0.014, 0.16, 0.005, { p: [-0.24, 0.305, 0], color: PAL.white }));
  b.add(MAT.GLASS, box(0.006, 0.04, 0.05, { p: [-0.097, 0.265, 0.055], color: PAL.glass }));
  for (const z of [-0.04, 0, 0.04]) b.add(MAT.DARK, box(0.05, 0.004, 0.012, { p: [-0.3, 0.312, z], color: PAL.navy }));
  b.add(MAT.METAL, cyl(0.022, 0.022, 0.12, 10, { p: [-0.1, 0.285, 0], r: [Math.PI / 2, 0, 0], color: PAL.machineLight }));

  // lattice boom lying forward onto its rest, hook block under the tip
  const x0 = -0.1, x1 = 0.2, y0 = 0.27, y1 = 0.31, hz = 0.028, chords = [];
  for (const z of [-hz, hz]) for (const y of [y0, y1]) chords.push(rod([x0, y, z], [x1, y, z], 0.007, 5, { color: PAL.machineLight }));
  b.add(MAT.METAL, chords);
  for (const z of [-hz, hz]) for (let k = 0; k < 6; k++) {
    const xa = x0 + ((x1 - x0) * k) / 6, xb = x0 + ((x1 - x0) * (k + 1)) / 6;
    b.add(MAT.METAL, rod([xa, k % 2 ? y1 : y0, z], [xb, k % 2 ? y0 : y1, z], 0.004, 4, { color: PAL.white }));
  }
  b.add(MAT.METAL, cyl(0.026, 0.026, 0.07, 10, { p: [x1, (y0 + y1) / 2, 0], r: [Math.PI / 2, 0, 0], color: PAL.machine }));
  b.add(MAT.METAL, hull([[0.1, DECK, -0.06], [0.1, DECK, 0.06], [0.14, DECK, -0.06], [0.14, DECK, 0.06], [0.115, y0 - 0.008, -0.04], [0.115, y0 - 0.008, 0.04], [0.125, y0 - 0.008, -0.04], [0.125, y0 - 0.008, 0.04]], { color: PAL.machineDark }));
  b.add(MAT.METAL, rod([x1, y0, 0], [x1, DECK + 0.045, 0], 0.003, 4, { color: PAL.gunmetal }));
  b.add(MAT.METAL, cbox(0.04, 0.035, 0.05, 0.008, { p: [x1, DECK + 0.03, 0], color: PAL.white }));

  // lockers beside the boom, stabiliser legs folded at the rear corners
  for (const s of [-1, 1]) {
    b.add(MAT.HOUSE, cbox(0.16, 0.05, 0.07, 0.012, { p: [0.03, DECK + 0.025, s * 0.13], color: 0xb0b0b0 }));
    b.add(MAT.DARK, box(0.12, 0.004, 0.004, { p: [0.03, DECK + 0.03, s * 0.166], color: PAL.navy }));
    b.add(MAT.METAL, cbox(0.05, 0.06, 0.05, 0.01, { p: [-0.48, 0.17, s * 0.19], color: PAL.machineDark }));
    b.add(MAT.METAL, cyl(0.03, 0.03, 0.012, 10, { p: [-0.48, 0.205, s * 0.19], color: PAL.machine }));
  }
  b.add(MAT.METAL, cbox(0.03, 0.035, 0.4, 0.01, { p: [-0.49, 0.13, 0], color: PAL.machineDark }));
  return b.build({ radius: 0.6, wheelRadius: WR });
}
