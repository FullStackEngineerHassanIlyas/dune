// Missile Tank / Rocket Launcher: tracked hull, turret with an elevated 2x3 rocket box, red warheads.
import { ModelBuilder, MAT, box, rbox, cyl, cone } from '../kit.js';
import { PAL } from '../palette.js';
import { tankChassis } from './tank-chassis.js';

export function missileTank() {
  const b = new ModelBuilder('missileTank');
  const { top } = tankChassis(b);
  b.node('turret', { pivot: [-0.06, top, 0] });
  b.node('launcher', { parent: 'turret', pivot: [0, 0.06, 0], axis: 'z', value: 0.38 });
  b.add(MAT.PAINT, cyl(0.1, 0.11, 0.05, 12, { p: [0, 0.025, 0], color: PAL.sandDark }), 'turret');
  b.add(MAT.METAL, box(0.06, 0.07, 0.05, { p: [0, 0.06, 0], color: PAL.steelDark }), 'turret');
  b.add(MAT.PAINT, rbox(0.3, 0.1, 0.22, 0.02, { p: [0.03, 0.04, 0], color: PAL.sand }), 'launcher');
  for (const z of [-0.112, 0.112]) b.add(MAT.HOUSE, box(0.2, 0.08, 0.005, { p: [0, 0.04, z] }), 'launcher');
  for (const y of [0.015, 0.065]) for (const z of [-0.065, 0, 0.065]) {
    b.add(MAT.DARK, cyl(0.026, 0.026, 0.02, 8, { p: [0.18, y, z], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }), 'launcher');
    b.add(MAT.PAINT, cone(0.018, 0.04, 8, { p: [0.2, y, z], r: [0, 0, -Math.PI / 2], color: PAL.rocketRed }), 'launcher');
  }
  return b.build({ radius: 0.38, muzzle: [0.22, 0.04, 0] });
}
