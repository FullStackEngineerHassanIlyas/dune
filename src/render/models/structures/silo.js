// Spice Silo (2x2): two tall storage tanks with flattened domes, house bands, ladders and a pump house.
import { ModelBuilder, MAT, box, rbox, cyl, dome, tube } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

export function silo() {
  const b = new ModelBuilder('silo');
  slab(b, 2, 2);
  for (const x of [-0.45, 0.45]) {
    b.add(MAT.PAINT, cyl(0.4, 0.42, 0.72, 24, { p: [x, 0.41, -0.12], color: PAL.steel }));
    b.add(MAT.PAINT, dome(0.4, 24, { p: [x, 0.77, -0.12], s: [1, 0.45, 1], color: PAL.steel }));
    b.add(MAT.HOUSE, cyl(0.405, 0.415, 0.07, 24, { p: [x, 0.5, -0.12] }));
    b.add(MAT.METAL, box(0.05, 0.62, 0.02, { p: [x + 0.2, 0.4, 0.28], color: PAL.steelDark }));
    for (let k = 0; k < 6; k++) b.add(MAT.METAL, box(0.08, 0.01, 0.02, { p: [x + 0.2, 0.15 + k * 0.1, 0.29], color: PAL.steelDark }));
  }
  b.add(MAT.PAINT, rbox(0.5, 0.2, 0.3, 0.03, { p: [0, 0.16, 0.6], color: PAL.steelDark }));
  b.add(MAT.METAL, tube([[-0.45, 0.2, 0.3], [0, 0.25, 0.55], [0.45, 0.2, 0.3]], 0.04, 6, { color: PAL.gunmetal }));
  beacon(b, 0, 0.3, 0.6);
  return b.build({ radius: 1.0 });
}
