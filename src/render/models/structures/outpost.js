// Radar Outpost (2x2): olive command bunker with slit windows, a mast with a rotating radar dish,
// and whip antennas.
import { ModelBuilder, MAT, box, rbox, cyl, prism, lathe } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

export function outpost() {
  const b = new ModelBuilder('outpost');
  slab(b, 2, 2);
  b.add(MAT.PAINT, rbox(1.5, 0.38, 1.2, 0.05, { p: [0, 0.24, 0.1], color: PAL.olive }));
  b.add(MAT.PAINT, prism([[-0.75, 0], [0.75, 0], [0.62, 0.14], [-0.62, 0.14]], 1.1, { p: [0, 0.43, 0.1], color: PAL.oliveDark }));
  for (const x of [-0.45, 0, 0.45]) b.add(MAT.GLASS, box(0.3, 0.06, 0.02, { p: [x, 0.3, 0.71], color: PAL.glass }));
  b.add(MAT.HOUSE, box(1.52, 0.05, 1.22, { p: [0, 0.39, 0.1] }));
  b.add(MAT.METAL, cyl(0.04, 0.06, 0.75, 8, { p: [0.45, 0.8, -0.35], color: PAL.steelDark }));
  b.node('dish', { pivot: [0.45, 1.15, -0.35] });
  const bowl = [[0.01, 0], [0.12, 0.03], [0.26, 0.11], [0.3, 0.15]];
  b.add(MAT.METAL, lathe(bowl, 20, { r: [1.2, 0, 0], color: PAL.steel }), 'dish');
  b.add(MAT.METAL, lathe([...bowl].reverse(), 20, { r: [1.2, 0, 0], color: PAL.steelDark }), 'dish');
  b.add(MAT.METAL, cyl(0.012, 0.012, 0.2, 6, { p: [0, 0.05, 0.1], r: [1.2, 0, 0], color: PAL.gunmetal }), 'dish');
  for (const [x, z, h] of [[-0.6, -0.4, 0.5], [-0.45, -0.45, 0.35]]) b.add(MAT.METAL, cyl(0.008, 0.01, h, 5, { p: [x, 0.43 + h / 2, z], color: PAL.gunmetal }));
  beacon(b, -0.6, 0.7, -0.4);
  return b.build({ radius: 1.0 });
}
