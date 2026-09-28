// WOR trooper facility (2x2): adobe fortress (Mentat art) with arched windows, four crenellated
// corner towers, a central dome and a house banner over the gate.
import { ModelBuilder, MAT, box, rbox, cyl, dome, sphere } from '../kit.js';
import { PAL } from '../palette.js';
import { slab } from './common.js';

export function wor() {
  const b = new ModelBuilder('wor');
  slab(b, 2, 2, PAL.beige);
  b.add(MAT.PAINT, rbox(1.4, 0.42, 1.3, 0.04, { p: [0, 0.26, 0], color: PAL.adobe }));
  for (const x of [-0.45, -0.15, 0.15, 0.45]) {
    b.add(MAT.DARK, box(0.12, 0.16, 0.02, { p: [x, 0.3, 0.655], color: 0x2b211a }));
    b.add(MAT.DARK, cyl(0.06, 0.06, 0.02, 10, { p: [x, 0.38, 0.655], r: [Math.PI / 2, 0, 0], color: 0x2b211a }));
  }
  for (const [x, z] of [[-0.72, -0.66], [0.72, -0.66], [-0.72, 0.66], [0.72, 0.66]]) {
    b.add(MAT.PAINT, cyl(0.16, 0.19, 0.66, 12, { p: [x, 0.38, z], color: PAL.adobeDark }));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      b.add(MAT.PAINT, box(0.07, 0.07, 0.07, { p: [x + Math.cos(a) * 0.14, 0.74, z + Math.sin(a) * 0.14], color: PAL.adobeDark }));
    }
  }
  b.add(MAT.PAINT, dome(0.34, 20, { p: [0, 0.47, -0.1], color: PAL.adobeDark }));
  b.add(MAT.HOUSE, box(0.3, 0.36, 0.02, { p: [0, 0.3, 0.665] }));
  b.add(MAT.HOUSE_LIGHT, sphere(0.03, 8, { p: [0, 0.82, -0.1], glow: 2.5 }));
  return b.build({ radius: 1.0 });
}
