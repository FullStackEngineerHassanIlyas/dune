// Quad, after the Genesis sprite: a square buggy with four big knobbly wheels (wheel0–wheel3) standing
// out past the corners on suspension arms. The low house-coloured tub has a sloped nose and a boxy,
// ribbed tail; the raised cab in the middle carries a pale windscreen in a light frame and the dark
// rounded roof; twin white guns ride at the front corners of the cab, pointing past the nose. A dark
// engine grille and two exhausts sit on the rear deck.
import { ModelBuilder, MAT, box, cbox, cyl, hull } from '../kit.js';
import { PAL } from '../palette.js';
import { wheel, rod } from '../detail.js';

const WR = 0.1, WZ = 0.268, AXLES = [0.13, -0.2];
const DARK_ROOF = 0x454545;

export function quad() {
  const b = new ModelBuilder('quad');
  [[AXLES[0], WZ], [AXLES[0], -WZ], [AXLES[1], WZ], [AXLES[1], -WZ]].forEach(([x, z], k) => {
    const n = `wheel${k}`;
    b.node(n, { pivot: [x, WR, z], axis: 'z', param: 'wheel' });
    wheel(b, n, { r: WR, w: 0.12, lugs: 12, seg: 14, tyre: PAL.navy, rim: PAL.machine, hub: PAL.machineLight });
    const s = Math.sign(z);
    for (const [y0, y1] of [[0.085, WR - 0.02], [0.15, WR + 0.02]]) b.add(MAT.METAL, rod([x - 0.05, y0, s * 0.15], [x, y1, s * 0.21], 0.009, 5, { color: PAL.machineDark }));
  });

  // tub: sloped nose, boxy tail
  b.add(MAT.HOUSE, hull([
    [-0.335, 0.075, -0.16], [-0.335, 0.075, 0.16], [-0.335, 0.2, -0.16], [-0.335, 0.2, 0.16], [-0.315, 0.215, -0.15], [-0.315, 0.215, 0.15],
    [0.1, 0.215, -0.165], [0.1, 0.215, 0.165], [0.12, 0.2, -0.17], [0.12, 0.2, 0.17], [0.25, 0.065, -0.15], [0.25, 0.065, 0.15],
    [0.24, 0.165, -0.16], [0.24, 0.165, 0.16], [0.34, 0.115, -0.14], [0.34, 0.115, 0.14], [0.34, 0.085, -0.14], [0.34, 0.085, 0.14],
    [-0.3, 0.06, -0.15], [-0.3, 0.06, 0.15],
  ]));
  b.add(MAT.METAL, cbox(0.025, 0.035, 0.26, 0.008, { p: [0.338, 0.085, 0], color: PAL.machineDark }));
  for (const s of [-1, 1]) b.add(MAT.HOUSE, cbox(0.19, 0.03, 0.022, 0.008, { p: [(AXLES[0] + AXLES[1]) / 2, 0.125, s * 0.172] }));
  b.add(MAT.DARK, box(0.008, 0.08, 0.24, { p: [-0.338, 0.14, 0], color: PAL.navy }));
  for (let k = 0; k < 5; k++) b.add(MAT.METAL, box(0.012, 0.07, 0.012, { p: [-0.342, 0.14, -0.096 + k * 0.048], color: PAL.machineDark }));

  // cab: house sides, pale windscreen in a light frame, dark rounded roof
  b.add(MAT.HOUSE, hull([
    [-0.18, 0.2, -0.13], [-0.18, 0.2, 0.13], [0.11, 0.2, -0.13], [0.11, 0.2, 0.13],
    [-0.15, 0.265, -0.12], [-0.15, 0.265, 0.12], [0.04, 0.265, -0.12], [0.04, 0.265, 0.12],
  ]));
  b.add(MAT.HOUSE, hull([
    [-0.15, 0.262, -0.125], [-0.15, 0.262, 0.125], [0.045, 0.262, -0.125], [0.045, 0.262, 0.125],
    [-0.12, 0.29, -0.1], [-0.12, 0.29, 0.1], [0.02, 0.29, -0.1], [0.02, 0.29, 0.1], [-0.1, 0.298, -0.06], [-0.1, 0.298, 0.06], [0, 0.298, -0.06], [0, 0.298, 0.06],
  ], { color: DARK_ROOF }));
  b.add(MAT.GLASS, hull([[0.103, 0.205, -0.105], [0.103, 0.205, 0.105], [0.046, 0.262, -0.1], [0.046, 0.262, 0.1], [0.08, 0.235, 0]].map(([x, y, z]) => [x + 0.004, y + 0.002, z]), { color: PAL.machine }));
  for (const s of [-1, 1]) b.add(MAT.METAL, rod([0.112, 0.2, s * 0.115], [0.05, 0.268, s * 0.11], 0.007, 5, { color: PAL.machineLight }));
  b.add(MAT.METAL, rod([0.05, 0.268, -0.11], [0.05, 0.268, 0.11], 0.007, 5, { color: PAL.machineLight }));

  // twin guns at the front corners of the cab
  for (const s of [-1, 1]) {
    b.add(MAT.METAL, cbox(0.07, 0.04, 0.04, 0.008, { p: [0.08, 0.225, s * 0.145], color: PAL.machineDark }));
    b.add(MAT.METAL, cyl(0.011, 0.011, 0.23, 8, { p: [0.225, 0.228, s * 0.145], r: [0, 0, Math.PI / 2], color: PAL.white }));
    b.add(MAT.METAL, cyl(0.015, 0.015, 0.025, 8, { p: [0.335, 0.228, s * 0.145], r: [0, 0, Math.PI / 2], color: PAL.machineDark }));
  }

  // rear deck: engine grille and exhausts
  b.add(MAT.DARK, box(0.11, 0.006, 0.2, { p: [-0.25, 0.216, 0], color: PAL.navy }));
  for (const z of [-0.07, -0.035, 0, 0.035, 0.07]) b.add(MAT.METAL, box(0.1, 0.01, 0.012, { p: [-0.25, 0.221, z], color: PAL.machineDark }));
  for (const s of [-1, 1]) b.add(MAT.METAL, cyl(0.014, 0.016, 0.06, 8, { p: [-0.305, 0.24, s * 0.125], color: PAL.machine }));
  return b.build({ radius: 0.48, muzzle: [0.35, 0.228, 0], wheelRadius: WR });
}
