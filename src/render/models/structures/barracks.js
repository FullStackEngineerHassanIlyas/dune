// Barracks (2x2): walled compound (Mentat art) with a gate facing south, two low buildings, steps,
// and a flagpole flying the house flag.
import { ModelBuilder, MAT, box, rbox, cyl } from '../kit.js';
import { PAL } from '../palette.js';
import { slab } from './common.js';

export function barracks() {
  const b = new ModelBuilder('barracks');
  slab(b, 2, 2, PAL.beige);
  const wall = (x, z, w, d) => b.add(MAT.PAINT, box(w, 0.26, d, { p: [x, 0.18, z], color: PAL.sandLight }));
  wall(0, -0.9, 1.8, 0.1);
  wall(-0.9, 0, 0.1, 1.8);
  wall(0.9, 0, 0.1, 1.8);
  wall(-0.55, 0.9, 0.7, 0.1);
  wall(0.55, 0.9, 0.7, 0.1);
  b.add(MAT.PAINT, rbox(0.75, 0.34, 0.5, 0.03, { p: [-0.35, 0.22, -0.5], color: PAL.sand }));
  b.add(MAT.PAINT, rbox(0.55, 0.28, 0.62, 0.03, { p: [0.45, 0.19, -0.2], color: PAL.sandDark }));
  b.add(MAT.HOUSE, box(0.77, 0.04, 0.52, { p: [-0.35, 0.4, -0.5] }));
  for (let k = 0; k < 3; k++) b.add(MAT.PAINT, box(0.2, 0.05, 0.08, { p: [-0.35, 0.07 + k * 0.05, -0.2 + k * 0.07], color: PAL.sandDark }));
  b.add(MAT.DARK, box(0.18, 0.2, 0.02, { p: [0.45, 0.15, 0.11], color: PAL.gunmetal }));
  b.add(MAT.METAL, cyl(0.012, 0.015, 0.9, 6, { p: [0.62, 0.5, 0.55], color: PAL.steel }));
  b.node('flag', { pivot: [0.62, 0.88, 0.55] });
  b.add(MAT.HOUSE, box(0.26, 0.15, 0.012, { p: [0.14, 0, 0] }), 'flag');
  return b.build({ radius: 1.0 });
}
