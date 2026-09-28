// Spice Refinery (3x2): domed processing tanks, a processing tower and stack on the west two thirds,
// and the harvester docking pad (house chevrons, pulsing pad lights, gantry) in the east column.
// Harvesters dock on the tile just south of the pad.
import { ModelBuilder, MAT, box, cyl, dome, sphere, tube } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

export function refinery() {
  const b = new ModelBuilder('refinery');
  slab(b, 3, 2);
  const tank = (x, z, r, h) => {
    b.add(MAT.PAINT, cyl(r, r, h, 20, { p: [x, 0.05 + h / 2, z], color: PAL.steel }));
    b.add(MAT.PAINT, dome(r, 20, { p: [x, 0.05 + h, z], color: PAL.steel }));
    b.add(MAT.HOUSE, cyl(r + 0.005, r + 0.005, 0.05, 20, { p: [x, 0.05 + h * 0.7, z] }));
  };
  tank(-1.05, -0.45, 0.3, 0.5);
  tank(-0.4, -0.5, 0.26, 0.42);
  tank(-0.75, 0.38, 0.28, 0.36);
  b.add(MAT.PAINT, box(0.34, 0.95, 0.34, { p: [0.05, 0.5, 0.35], color: PAL.steelDark }));
  b.add(MAT.GLASS, box(0.35, 0.08, 0.35, { p: [0.05, 0.75, 0.35], color: PAL.glass }));
  b.add(MAT.METAL, cyl(0.07, 0.08, 0.5, 10, { p: [0.05, 1.2, 0.35], color: PAL.gunmetal }));
  b.add(MAT.METAL, tube([[-1.05, 0.35, -0.45], [-0.4, 0.4, -0.45], [0.2, 0.35, -0.3], [0.55, 0.3, -0.3]], 0.035, 6, { color: PAL.steelDark }));
  b.add(MAT.METAL, tube([[-0.75, 0.3, 0.38], [-0.3, 0.3, 0.1], [0.55, 0.25, 0.1]], 0.03, 6, { color: PAL.steelDark }));
  b.add(MAT.DARK, box(0.88, 0.07, 1.86, { p: [1.0, 0.085, 0], color: 0x2e2d2b }));
  for (const z of [-0.55, 0, 0.55]) for (const side of [-1, 1]) b.add(MAT.HOUSE, box(0.3, 0.012, 0.07, { p: [1.0 + side * 0.13, 0.126, z], r: [0, side * 0.55, 0] }));
  b.node('padLights', { pivot: [1.0, 0.13, 0], kind: 'scale' });
  for (const z of [-0.85, -0.3, 0.3, 0.85]) for (const x of [-0.4, 0.4]) b.add(MAT.HOUSE_LIGHT, sphere(0.028, 8, { p: [x, 0, z], glow: 2.5 }), 'padLights');
  for (const z of [-0.8, 0.8]) b.add(MAT.METAL, box(0.06, 0.6, 0.06, { p: [1.42, 0.35, z], color: PAL.steelDark }));
  b.add(MAT.METAL, box(0.08, 0.06, 1.68, { p: [1.42, 0.66, 0], color: PAL.steel }));
  b.add(MAT.METAL, box(0.5, 0.05, 0.08, { p: [1.18, 0.62, -0.2], color: PAL.steelDark }));
  beacon(b, 0.05, 1.47, 0.35);
  return b.build({ radius: 1.6 });
}
