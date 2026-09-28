// MCV: long eight-wheeled carrier with the folded Construction Yard module and crane on top.
import { ModelBuilder, MAT, box, rbox, cyl, sphere } from '../kit.js';
import { PAL } from '../palette.js';

export function mcv() {
  const b = new ModelBuilder('mcv');
  for (const x of [-0.33, -0.11, 0.11, 0.33]) for (const z of [-0.2, 0.2]) {
    b.add(MAT.DARK, cyl(0.075, 0.075, 0.07, 14, { p: [x, 0.075, z], r: [Math.PI / 2, 0, 0], color: PAL.rubber }));
    b.add(MAT.METAL, cyl(0.035, 0.035, 0.074, 8, { p: [x, 0.075, z], r: [Math.PI / 2, 0, 0], color: PAL.steelDark }));
  }
  b.add(MAT.PAINT, rbox(0.9, 0.12, 0.36, 0.03, { p: [0, 0.16, 0], color: PAL.sand }));
  b.add(MAT.PAINT, rbox(0.62, 0.14, 0.34, 0.03, { p: [-0.12, 0.29, 0], color: PAL.sandLight }));
  b.add(MAT.PAINT, rbox(0.2, 0.16, 0.34, 0.04, { p: [0.34, 0.3, 0], color: PAL.sand }));
  b.add(MAT.GLASS, box(0.02, 0.07, 0.28, { p: [0.44, 0.33, 0], color: PAL.glass }));
  for (const z of [-0.176, 0.176]) b.add(MAT.HOUSE, box(0.5, 0.05, 0.01, { p: [-0.12, 0.3, z] }));
  b.add(MAT.PAINT, box(0.52, 0.04, 0.05, { p: [-0.1, 0.39, 0.07], color: PAL.yellow }));
  b.add(MAT.PAINT, box(0.06, 0.08, 0.06, { p: [0.14, 0.4, 0.07], color: PAL.yellow }));
  b.add(MAT.METAL, cyl(0.006, 0.006, 0.1, 4, { p: [-0.34, 0.35, 0.07], color: PAL.gunmetal }));
  b.add(MAT.HOUSE_LIGHT, sphere(0.018, 8, { p: [0.36, 0.4, -0.12], glow: 2.5 }));
  return b.build({ radius: 0.48 });
}
