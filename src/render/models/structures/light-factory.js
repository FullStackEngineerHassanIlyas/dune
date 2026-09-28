// Light Factory (2x2): vehicle hangar with a curved roof and an open bay facing south, a gantry
// crane over the yard, and a glazed control booth.
import { ModelBuilder, MAT, box, rbox, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon, halfArc } from './common.js';

export function lightFactory() {
  const b = new ModelBuilder('lightFactory');
  slab(b, 2, 2);
  const arc = halfArc(0.55, 0.45);
  b.add(MAT.PAINT, prism(arc, 1.1, { p: [-0.25, 0.05, -0.3], color: PAL.steel }));
  b.add(MAT.DARK, prism(arc.map(([x, y]) => [x * 0.8, y * 0.8]), 0.02, { p: [-0.25, 0.05, 0.26], color: 0x1b1916 }));
  b.add(MAT.HOUSE, box(0.06, 0.06, 1.12, { p: [-0.25, 0.5, -0.3] }));
  for (const x of [0.45, 0.85]) b.add(MAT.METAL, box(0.05, 0.62, 0.05, { p: [x, 0.36, 0.55], color: PAL.yellow }));
  b.add(MAT.METAL, box(0.5, 0.06, 0.06, { p: [0.65, 0.68, 0.55], color: PAL.yellow }));
  b.add(MAT.METAL, cyl(0.004, 0.004, 0.3, 4, { p: [0.62, 0.52, 0.55], color: PAL.gunmetal }));
  b.add(MAT.PAINT, rbox(0.32, 0.36, 0.3, 0.03, { p: [0.65, 0.23, -0.55], color: PAL.steelDark }));
  b.add(MAT.GLASS, box(0.33, 0.07, 0.31, { p: [0.65, 0.35, -0.55], color: PAL.glass }));
  beacon(b, 0.65, 0.46, -0.55);
  return b.build({ radius: 1.0 });
}
