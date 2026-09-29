// Hi-Tech Factory (3x2): a white curved hangar opening south on the west two thirds, and a landing
// apron with a painted ring and house chevrons between two tall pylons with warning lights (spec §5.3).
import { ModelBuilder, MAT, box, cyl, sphere, torus, prism } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon, halfArc } from './common.js';

export function hiTechFactory() {
  const b = new ModelBuilder('hiTechFactory');
  slab(b, 3, 2);
  const arc = halfArc(0.62, 0.66);
  b.add(MAT.PAINT, prism(arc, 1.5, { p: [-0.55, 0.05, 0], color: PAL.white }));
  b.add(MAT.DARK, prism(arc.map(([x, y]) => [x * 0.82, y * 0.82]), 0.02, { p: [-0.55, 0.05, 0.76], color: 0x1b1916 }));
  for (const z of [-0.45, 0, 0.45]) b.add(MAT.HOUSE, box(1.26, 0.02, 0.05, { p: [-0.55, 0.05, z], r: [0, 0, 0] }));
  for (const z of [-0.45, 0.45]) b.add(MAT.HOUSE, torus(0.63, 0.012, 4, 24, { p: [-0.55, 0.05, z] }, Math.PI));
  b.add(MAT.DARK, box(0.92, 0.012, 1.7, { p: [0.95, 0.056, 0], color: 0x2e2d2b }));
  b.add(MAT.PAINT, torus(0.3, 0.02, 4, 28, { p: [0.95, 0.068, 0], r: [Math.PI / 2, 0, 0], color: PAL.white }));
  for (const side of [-1, 1]) b.add(MAT.HOUSE, box(0.26, 0.008, 0.06, { p: [0.95 + side * 0.12, 0.066, 0.72], r: [0, side * 0.55, 0] }));
  for (const z of [-0.72, 0.72]) {
    b.add(MAT.METAL, box(0.07, 1.25, 0.07, { p: [1.36, 0.67, z], color: PAL.steel }));
    b.add(MAT.METAL, box(0.2, 0.04, 0.04, { p: [1.3, 1.1, z], color: PAL.steelDark }));
    b.add(MAT.LIGHT, sphere(0.035, 8, { p: [1.36, 1.32, z], color: PAL.redGlow, glow: 3 }));
  }
  b.add(MAT.METAL, cyl(0.02, 0.02, 0.5, 6, { p: [-1.1, 0.9, -0.5], color: PAL.gunmetal }));
  beacon(b, -1.05, 0.62, 0.62);
  return b.build({ radius: 1.6 });
}
