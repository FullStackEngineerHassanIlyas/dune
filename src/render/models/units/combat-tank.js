// Combat Tank (Mentat art: low tracked hull, rounded turret, single long barrel).
import { ModelBuilder, MAT, box, rbox, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';
import { tankChassis } from './tank-chassis.js';

export function combatTank() {
  const b = new ModelBuilder('combatTank');
  const { top } = tankChassis(b);
  b.node('turret', { pivot: [-0.04, top, 0] });
  b.node('barrel', { parent: 'turret', pivot: [0.11, 0.055, 0], axis: 'x', kind: 'trans' });
  b.add(MAT.PAINT, rbox(0.26, 0.09, 0.24, 0.035, { p: [0, 0.045, 0], color: PAL.sand }), 'turret');
  b.add(MAT.PAINT, prism([[0.06, 0], [0.15, 0.015], [0.15, 0.07], [0.06, 0.085]], 0.14, { p: [0, 0.005, 0], color: PAL.sandDark }), 'turret');
  b.add(MAT.HOUSE, box(0.21, 0.018, 0.245, { p: [-0.015, 0.06, 0] }), 'turret');
  b.add(MAT.DARK, cyl(0.04, 0.045, 0.022, 10, { p: [-0.06, 0.1, 0.05], color: PAL.gunmetal }), 'turret');
  b.add(MAT.METAL, cyl(0.02, 0.024, 0.3, 10, { p: [0.15, 0, 0], r: [0, 0, Math.PI / 2], color: PAL.steelDark }), 'barrel');
  b.add(MAT.METAL, cyl(0.03, 0.03, 0.05, 10, { p: [0.3, 0, 0], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }), 'barrel');
  return b.build({ radius: 0.36, muzzle: [0.33, 0, 0] });
}
