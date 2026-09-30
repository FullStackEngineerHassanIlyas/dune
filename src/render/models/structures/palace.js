// Palace (3x3): a sand-stone palace on a stepped plinth — a great golden onion dome over the hall, four
// corner towers with smaller domes, and an ornate gold gate between house banners (spec §5.3).
import { ModelBuilder, MAT, box, cyl, lathe } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

/** An onion dome of radius r: swelling out, then drawn up into a point (height 1.72 r). */
const onion = (r) => [[0, 0], [r * 0.82, 0], [r * 1.08, r * 0.38], [r, r * 0.78], [r * 0.62, r * 1.12], [r * 0.24, r * 1.42], [0.001, r * 1.72]];

export function palace() {
  const b = new ModelBuilder('palace');
  slab(b, 3, 3);
  b.add(MAT.PAINT, box(2.7, 0.14, 2.7, { p: [0, 0.12, 0], color: PAL.adobeDark }));
  b.add(MAT.PAINT, box(2.1, 0.5, 1.9, { p: [0, 0.44, -0.1], color: PAL.adobe }));
  b.add(MAT.PAINT, box(2.16, 0.06, 1.96, { p: [0, 0.72, -0.1], color: PAL.sandLight }));
  b.add(MAT.PAINT, cyl(0.5, 0.56, 0.24, 24, { p: [0, 0.87, -0.1], color: PAL.adobe }));
  b.add(MAT.METAL, lathe(onion(0.5), 24, { p: [0, 0.99, -0.1], color: PAL.gold }));
  b.add(MAT.METAL, cyl(0.012, 0.022, 0.22, 6, { p: [0, 1.96, -0.1], color: PAL.gold }));
  for (const [x, z] of [[-1.15, -1.15], [1.15, -1.15], [-1.15, 1.15], [1.15, 1.15]]) {
    b.add(MAT.PAINT, cyl(0.2, 0.24, 0.95, 16, { p: [x, 0.66, z], color: PAL.adobe }));
    b.add(MAT.PAINT, cyl(0.23, 0.23, 0.05, 16, { p: [x, 1.15, z], color: PAL.sandLight }));
    b.add(MAT.METAL, lathe(onion(0.19), 16, { p: [x, 1.17, z], color: PAL.gold }));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      b.add(MAT.LIGHT, box(0.05, 0.1, 0.012, { p: [x + Math.cos(a) * 0.215, 0.86, z + Math.sin(a) * 0.215], r: [0, -a + Math.PI / 2, 0], color: PAL.orangeGlow, glow: 1.4 }));
    }
  }
  b.add(MAT.METAL, box(0.52, 0.52, 0.08, { p: [0, 0.45, 0.86], color: PAL.gold }));
  b.add(MAT.DARK, box(0.34, 0.38, 0.09, { p: [0, 0.38, 0.87], color: PAL.gunmetal }));
  b.add(MAT.METAL, lathe(onion(0.15), 12, { p: [0, 0.71, 0.86], color: PAL.gold }));
  for (const x of [-0.42, 0.42]) b.add(MAT.HOUSE, box(0.14, 0.34, 0.02, { p: [x, 0.5, 0.87] }));
  for (const x of [-0.8, -0.55, 0.55, 0.8]) b.add(MAT.LIGHT, box(0.1, 0.14, 0.012, { p: [x, 0.5, 0.86], color: PAL.orangeGlow, glow: 1.2 }));
  beacon(b, 1.15, 1.53, 1.15);
  return b.build({ radius: 1.6 });
}
