// Siege Tank: longer, heavier hull, big turret with bustle, long heavy barrel with muzzle brake.
import { ModelBuilder, MAT, box, rbox, cyl } from '../kit.js';
import { PAL } from '../palette.js';
import { tankChassis } from './tank-chassis.js';

export function siegeTank() {
  const b = new ModelBuilder('siegeTank');
  const { top } = tankChassis(b, { length: 0.76, width: 0.52, hull: 0.15, trackW: 0.13, trackH: 0.13 });
  b.node('turret', { pivot: [-0.07, top, 0] });
  b.node('barrel', { parent: 'turret', pivot: [0.14, 0.07, 0], axis: 'x', kind: 'trans' });
  b.add(MAT.PAINT, rbox(0.34, 0.11, 0.3, 0.04, { p: [0, 0.055, 0], color: PAL.sand }), 'turret');
  b.add(MAT.PAINT, rbox(0.14, 0.05, 0.22, 0.02, { p: [-0.18, 0.05, 0], color: PAL.sandDark }), 'turret');
  b.add(MAT.HOUSE, box(0.28, 0.02, 0.305, { p: [-0.02, 0.075, 0] }), 'turret');
  for (const z of [-0.1, 0.1]) b.add(MAT.DARK, cyl(0.015, 0.015, 0.06, 6, { p: [0.06, 0.13, z], color: PAL.gunmetal }), 'turret');
  b.add(MAT.METAL, cyl(0.028, 0.034, 0.44, 12, { p: [0.22, 0, 0], r: [0, 0, Math.PI / 2], color: PAL.steelDark }), 'barrel');
  b.add(MAT.METAL, cyl(0.04, 0.04, 0.03, 12, { p: [0.16, 0, 0], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }), 'barrel');
  b.add(MAT.METAL, box(0.07, 0.05, 0.08, { p: [0.45, 0, 0], color: PAL.gunmetal }), 'barrel');
  return b.build({ radius: 0.44, muzzle: [0.49, 0, 0] });
}
