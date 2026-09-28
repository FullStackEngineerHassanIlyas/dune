// Deviator: the launcher chassis carrying one large nerve-gas missile on a rail (green warhead).
import { ModelBuilder, MAT, box, cyl, cone } from '../kit.js';
import { PAL } from '../palette.js';
import { tankChassis } from './tank-chassis.js';

export function deviator() {
  const b = new ModelBuilder('deviator');
  const { top } = tankChassis(b);
  b.node('turret', { pivot: [-0.05, top, 0] });
  b.node('launcher', { parent: 'turret', pivot: [0, 0.07, 0], axis: 'z', value: 0.42 });
  b.add(MAT.PAINT, cyl(0.1, 0.11, 0.05, 12, { p: [0, 0.025, 0], color: PAL.sandDark }), 'turret');
  b.add(MAT.METAL, box(0.05, 0.08, 0.05, { p: [0, 0.07, 0], color: PAL.steelDark }), 'turret');
  b.add(MAT.METAL, box(0.36, 0.025, 0.08, { p: [0.04, 0, 0], color: PAL.steelDark }), 'launcher');
  b.add(MAT.PAINT, cyl(0.035, 0.035, 0.3, 10, { p: [0.05, 0.045, 0], r: [0, 0, Math.PI / 2], color: PAL.white }), 'launcher');
  b.add(MAT.LIGHT, cone(0.035, 0.08, 10, { p: [0.24, 0.045, 0], r: [0, 0, -Math.PI / 2], color: PAL.greenGlow, glow: 1.4 }), 'launcher');
  b.add(MAT.HOUSE, cyl(0.037, 0.037, 0.03, 10, { p: [-0.02, 0.045, 0], r: [0, 0, Math.PI / 2] }), 'launcher');
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    b.add(MAT.PAINT, box(0.05, 0.004, 0.035, { p: [-0.1, 0.045 + Math.sin(a) * 0.04, Math.cos(a) * 0.04], r: [a, 0, 0], color: PAL.steel }), 'launcher');
  }
  return b.build({ radius: 0.38, muzzle: [0.26, 0.045, 0] });
}
