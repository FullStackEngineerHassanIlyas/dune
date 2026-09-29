// Repair Facility (3x2): an open steel gantry over the repair pad in the middle, a hoist that runs
// along it with a welding head, a glazed control block on the east and a parts store with gas
// bottles on the west. Vehicles drive onto the pad from the entrance south of it (spec §5.3).
import { ModelBuilder, MAT, box, rbox, cyl, sphere } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

export function repairFacility() {
  const b = new ModelBuilder('repairFacility');
  slab(b, 3, 2);
  b.add(MAT.DARK, box(1.0, 0.012, 1.5, { p: [0, 0.056, 0.2], color: 0x2e2d2b }));
  for (let k = 0; k < 6; k++) for (const x of [-0.46, 0.46]) b.add(MAT.PAINT, box(0.06, 0.008, 0.13, { p: [x, 0.066, -0.45 + k * 0.26], color: k % 2 ? 0x1b1a18 : PAL.yellow }));
  for (const side of [-1, 1]) b.add(MAT.HOUSE, box(0.28, 0.008, 0.06, { p: [side * 0.13, 0.066, 0.86], r: [0, side * 0.55, 0] }));
  b.node('padLights', { pivot: [0, 0.075, 0.2], kind: 'scale' });
  for (const z of [-0.5, 0.2, 0.9]) for (const x of [-0.5, 0.5]) b.add(MAT.HOUSE_LIGHT, sphere(0.024, 8, { p: [x, 0, z], glow: 2.5 }), 'padLights');
  for (const x of [-0.56, 0.56]) {
    for (const z of [-0.55, 0.75]) b.add(MAT.METAL, box(0.07, 0.8, 0.07, { p: [x, 0.45, z], color: PAL.yellow }));
    b.add(MAT.METAL, box(0.08, 0.08, 1.42, { p: [x, 0.86, 0.1], color: PAL.yellow }));
  }
  b.add(MAT.METAL, box(1.2, 0.06, 0.08, { p: [0, 0.86, -0.55], color: PAL.steelDark }));
  b.node('arm', { pivot: [0, 0.86, 0.1], axis: 'z', kind: 'trans' });
  b.add(MAT.METAL, box(1.18, 0.07, 0.16, { color: PAL.steelDark }), 'arm');
  b.add(MAT.METAL, cyl(0.008, 0.008, 0.36, 4, { p: [0, -0.21, 0], color: PAL.gunmetal }), 'arm');
  b.add(MAT.PAINT, box(0.12, 0.1, 0.12, { p: [0, -0.43, 0], color: PAL.steel }), 'arm');
  b.add(MAT.LIGHT, sphere(0.025, 8, { p: [0, -0.49, 0], color: PAL.blueGlow, glow: 3 }), 'arm');
  b.add(MAT.PAINT, rbox(0.62, 0.5, 1.5, 0.04, { p: [1.08, 0.3, -0.1], color: PAL.steel }));
  b.add(MAT.GLASS, box(0.63, 0.08, 1.2, { p: [1.08, 0.43, -0.1], color: PAL.glass }));
  b.add(MAT.HOUSE, box(0.64, 0.05, 1.52, { p: [1.08, 0.56, -0.1] }));
  b.add(MAT.METAL, cyl(0.02, 0.02, 0.4, 6, { p: [1.25, 0.75, -0.6], color: PAL.gunmetal }));
  b.add(MAT.PAINT, box(0.6, 0.36, 0.9, { p: [-1.08, 0.23, -0.45], color: PAL.steelDark }));
  b.add(MAT.HOUSE, box(0.61, 0.05, 0.91, { p: [-1.08, 0.38, -0.45] }));
  for (const [x, z] of [[-1.25, 0.35], [-1.08, 0.55], [-0.91, 0.35]]) b.add(MAT.PAINT, cyl(0.07, 0.07, 0.42, 12, { p: [x, 0.26, z], color: PAL.rocketRed }));
  beacon(b, 1.3, 0.62, 0.55);
  return b.build({ radius: 1.6 });
}
