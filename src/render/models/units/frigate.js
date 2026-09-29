// Frigate: a big cargo ship — a long, deep hull with a rounded nose, a bridge on top, four thruster
// pods glowing underneath and landing legs, in neutral grey with a house band (spec §5.3). Faces +x.
import { ModelBuilder, MAT, box, rbox, cyl } from '../kit.js';
import { PAL } from '../palette.js';

export function frigate() {
  const b = new ModelBuilder('frigate');
  b.add(MAT.PAINT, rbox(1.9, 0.36, 0.8, 0.12, { p: [0, 0.3, 0], color: PAL.steel }));
  b.add(MAT.PAINT, rbox(0.5, 0.3, 0.7, 0.12, { p: [0.95, 0.27, 0], color: PAL.steel }));
  b.add(MAT.GLASS, box(0.2, 0.1, 0.5, { p: [1.12, 0.38, 0], color: PAL.glass }));
  b.add(MAT.PAINT, rbox(0.5, 0.18, 0.4, 0.05, { p: [-0.3, 0.55, 0], color: PAL.steelDark }));
  b.add(MAT.GLASS, box(0.51, 0.05, 0.41, { p: [-0.3, 0.6, 0], color: PAL.glass }));
  b.add(MAT.HOUSE, box(1.5, 0.04, 0.81, { p: [-0.1, 0.42, 0] }));
  for (const [x, z] of [[0.6, 0.45], [0.6, -0.45], [-0.7, 0.45], [-0.7, -0.45]]) {
    b.add(MAT.METAL, cyl(0.11, 0.13, 0.22, 12, { p: [x, 0.2, z], color: PAL.gunmetal }));
    b.add(MAT.LIGHT, cyl(0.08, 0.08, 0.02, 12, { p: [x, 0.085, z], color: PAL.orangeGlow, glow: 2 }));
    b.add(MAT.METAL, box(0.04, 0.2, 0.04, { p: [x * 0.9, 0.02, z * 0.7], color: PAL.gunmetal }));
  }
  return b.build({ radius: 1.1 });
}
