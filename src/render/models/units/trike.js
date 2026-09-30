// Trike / Raider Trike (the same sprite in Ordos green), after the Genesis sprite: a Y from above, one
// small front wheel under a pale fender on a raked fork, a narrow house-coloured spine and two big rear
// wheels set far outboard on the axle. The engine box over the axle slopes down at the back; mid-body
// the light canopy over the seat is the sprite's white spot; a short twin gun on a mount over the fork
// points past the front wheel. Wheels (wheelL, wheelR, wheelF) spin with `wheel`.
import { ModelBuilder, MAT, box, cbox, cyl, hull } from '../kit.js';
import { PAL } from '../palette.js';
import { wheel, rod, bolts } from '../detail.js';

const RX = -0.235, RR = 0.11, RZ = 0.25, FX = 0.25, FR = 0.078;
const TYRE = { tyre: PAL.navy, rim: PAL.machine, hub: PAL.machineLight };

export function trike() {
  const b = new ModelBuilder('trike');
  b.node('wheelL', { pivot: [RX, RR, RZ], axis: 'z', param: 'wheel' });
  b.node('wheelR', { pivot: [RX, RR, -RZ], axis: 'z', param: 'wheel' });
  b.node('wheelF', { pivot: [FX, FR, 0], axis: 'z', param: 'wheel' });
  for (const n of ['wheelL', 'wheelR']) wheel(b, n, { r: RR, w: 0.13, lugs: 12, seg: 16, ...TYRE });
  wheel(b, 'wheelF', { r: FR, w: 0.062, lugs: 10, seg: 14, ...TYRE });

  // rear axle and swing arms, fork and front fender
  b.add(MAT.METAL, cyl(0.022, 0.022, 2 * RZ - 0.05, 8, { p: [RX, RR, 0], r: [Math.PI / 2, 0, 0], color: PAL.machineDark }));
  for (const s of [-1, 1]) {
    b.add(MAT.METAL, rod([RX, RR, s * 0.16], [-0.06, 0.1, s * 0.07], 0.013, 6, { color: PAL.machineDark }));
    b.add(MAT.METAL, rod([FX, FR, s * 0.04], [0.18, 0.205, s * 0.04], 0.011, 6, { color: PAL.machineLight }));
  }
  b.add(MAT.METAL, cyl(0.012, 0.012, 0.1, 6, { p: [FX, FR, 0], r: [Math.PI / 2, 0, 0], color: PAL.machineDark }));
  b.add(MAT.METAL, hull([[0.18, 0.162, -0.038], [0.18, 0.162, 0.038], [0.22, 0.19, -0.04], [0.22, 0.19, 0.04], [0.29, 0.186, -0.038], [0.29, 0.186, 0.038], [0.345, 0.14, -0.032], [0.345, 0.14, 0.032], [0.32, 0.176, 0]], { color: PAL.machineLight }));

  // engine box over the axle, sloping down at the back; spine to the nose
  b.add(MAT.HOUSE, hull([
    [-0.34, 0.1, -0.105], [-0.34, 0.1, 0.105], [-0.34, 0.16, -0.095], [-0.34, 0.16, 0.095], [-0.3, 0.21, -0.09], [-0.3, 0.21, 0.09],
    [-0.1, 0.1, -0.11], [-0.1, 0.1, 0.11], [-0.1, 0.22, -0.1], [-0.1, 0.22, 0.1], [-0.12, 0.23, -0.085], [-0.12, 0.23, 0.085], [-0.28, 0.225, -0.075], [-0.28, 0.225, 0.075],
  ]));
  b.add(MAT.HOUSE, hull([
    [-0.12, 0.09, -0.075], [-0.12, 0.09, 0.075], [-0.12, 0.2, -0.075], [-0.12, 0.2, 0.075], [-0.1, 0.21, -0.06], [-0.1, 0.21, 0.06],
    [0.16, 0.12, -0.05], [0.16, 0.12, 0.05], [0.19, 0.19, -0.045], [0.19, 0.19, 0.045], [0.16, 0.205, -0.035], [0.16, 0.205, 0.035],
  ]));
  b.add(MAT.DARK, box(0.12, 0.004, 0.1, { p: [-0.21, 0.226, 0], color: PAL.navy }));
  for (const z of [-0.035, 0, 0.035]) b.add(MAT.METAL, box(0.11, 0.008, 0.01, { p: [-0.21, 0.229, z], color: PAL.machineDark }));
  for (const s of [-1, 1]) b.add(MAT.METAL, rod([-0.33, 0.16, s * 0.06], [-0.37, 0.19, s * 0.06], 0.012, 6, { color: PAL.machineDark }));
  bolts(b, [[-0.3, 0.15, 0.11], [-0.16, 0.15, 0.11], [-0.3, 0.15, -0.11], [-0.16, 0.15, -0.11]], { r: 0.008, h: 0.006, axis: 'z', color: PAL.machine });

  // light canopy over the seat, dark visor
  b.add(MAT.METAL, hull([
    [-0.1, 0.2, -0.068], [-0.1, 0.2, 0.068], [0.04, 0.19, -0.06], [0.04, 0.19, 0.06],
    [-0.08, 0.26, -0.055], [-0.08, 0.26, 0.055], [0, 0.255, -0.05], [0, 0.255, 0.05], [-0.04, 0.268, 0],
  ], { color: PAL.white }));
  b.add(MAT.GLASS, hull([[0.01, 0.2, -0.05], [0.01, 0.2, 0.05], [0.042, 0.195, 0], [-0.005, 0.25, -0.042], [-0.005, 0.25, 0.042], [0.012, 0.248, 0]], { color: PAL.glass }));

  // twin gun on its mount over the fork
  b.add(MAT.METAL, cbox(0.07, 0.035, 0.07, 0.01, { p: [0.12, 0.222, 0], color: PAL.machineDark }));
  for (const z of [-0.022, 0.022]) {
    b.add(MAT.METAL, cyl(0.011, 0.011, 0.17, 8, { p: [0.215, 0.232, z], r: [0, 0, Math.PI / 2], color: PAL.white }));
    b.add(MAT.METAL, cyl(0.015, 0.015, 0.02, 8, { p: [0.3, 0.232, z], r: [0, 0, Math.PI / 2], color: PAL.machineDark }));
  }
  return b.build({ radius: 0.48, muzzle: [0.31, 0.232, 0], wheelRadius: RR });
}
