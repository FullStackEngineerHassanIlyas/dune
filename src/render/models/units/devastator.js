// Devastator: huge armoured tank with hull-fixed twin plasma cannons and glowing reactor vents.
import { ModelBuilder, MAT, box, rbox, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';
import { tankChassis } from './tank-chassis.js';

export function devastator() {
  const b = new ModelBuilder('devastator');
  const { top } = tankChassis(b, { length: 0.9, width: 0.64, hull: 0.18, trackW: 0.16, trackH: 0.15, color: PAL.sandDark });
  b.add(MAT.PAINT, rbox(0.5, 0.15, 0.46, 0.035, { p: [-0.08, top + 0.075, 0], color: PAL.sand }));
  b.add(MAT.PAINT, prism([[0.17, 0], [0.3, 0], [0.26, 0.1], [0.17, 0.13]], 0.4, { p: [0, top, 0], color: PAL.sand }));
  for (const z of [-0.235, 0.235]) b.add(MAT.HOUSE, box(0.42, 0.1, 0.012, { p: [-0.08, top + 0.075, z] }));
  b.add(MAT.HOUSE, box(0.3, 0.012, 0.3, { p: [-0.12, top + 0.152, 0] }));
  for (const z of [-0.09, 0.09]) {
    b.add(MAT.METAL, cyl(0.032, 0.038, 0.42, 12, { p: [0.36, top + 0.09, z], r: [0, 0, Math.PI / 2], color: PAL.steelDark }));
    b.add(MAT.METAL, cyl(0.045, 0.045, 0.06, 12, { p: [0.56, top + 0.09, z], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }));
  }
  for (const z of [-0.12, 0.12]) b.add(MAT.LIGHT, box(0.05, 0.04, 0.08, { p: [-0.34, top + 0.1, z], color: PAL.orangeGlow, glow: 1.6 }));
  b.add(MAT.DARK, box(0.1, 0.02, 0.36, { p: [-0.28, top + 0.155, 0], color: PAL.gunmetal }));
  return b.build({ radius: 0.52, muzzle: [0.6, top + 0.09, 0] });
}
