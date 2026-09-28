// Heavy Factory (3x2): big vehicle hall with a sawtooth roof, a bay door on the south side that slides
// up when a vehicle rolls out, twin smokestacks with house bands, a roof crane and an office.
import { ModelBuilder, MAT, box, rbox, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

export function heavyFactory() {
  const b = new ModelBuilder('heavyFactory');
  slab(b, 3, 2);
  b.add(MAT.PAINT, box(2.7, 0.55, 1.35, { p: [0, 0.33, -0.2], color: PAL.steel }));
  for (let k = 0; k < 4; k++) b.add(MAT.PAINT, prism([[-0.3, 0], [0.3, 0], [0.3, 0.22]], 1.3, { p: [-1.0 + k * 0.66, 0.6, -0.2], color: PAL.steelDark }));
  b.add(MAT.DARK, box(1.1, 0.42, 0.04, { p: [0.3, 0.26, 0.48], color: 0x161513 }));
  b.node('door', { pivot: [0.3, 0.26, 0.5], axis: 'y', kind: 'trans' });
  b.add(MAT.PAINT, box(1.12, 0.42, 0.03, { color: PAL.steelDark }), 'door');
  for (let k = 0; k < 5; k++) b.add(MAT.DARK, box(1.12, 0.012, 0.035, { p: [0, -0.16 + k * 0.08, 0], color: PAL.gunmetal }), 'door');
  b.add(MAT.HOUSE, box(1.2, 0.06, 0.04, { p: [0.3, 0.52, 0.5] }));
  for (const x of [-1.1, -0.8]) {
    b.add(MAT.METAL, cyl(0.08, 0.1, 0.9, 12, { p: [x, 0.95, -0.65], color: PAL.gunmetal }));
    b.add(MAT.HOUSE, cyl(0.105, 0.105, 0.06, 12, { p: [x, 1.2, -0.65] }));
  }
  b.add(MAT.METAL, box(0.08, 0.35, 0.08, { p: [0.9, 0.78, -0.6], color: PAL.yellow }));
  b.add(MAT.METAL, box(0.7, 0.06, 0.08, { p: [0.65, 0.95, -0.6], color: PAL.yellow }));
  b.add(MAT.PAINT, rbox(0.4, 0.3, 0.35, 0.03, { p: [-1.05, 0.2, 0.55], color: PAL.steelDark }));
  b.add(MAT.GLASS, box(0.41, 0.07, 0.36, { p: [-1.05, 0.3, 0.55], color: PAL.glass }));
  beacon(b, -1.05, 0.4, 0.55);
  return b.build({ radius: 1.6 });
}
