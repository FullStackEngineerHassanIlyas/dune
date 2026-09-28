// Gun Turret and Rocket Turret (1x1): round khaki bunker (Mentat art) with a rotating head — a long
// gun with a muzzle brake, or twin rocket pods with red warheads. Heads rest facing east (+x);
// views turn them north on placement.
import { ModelBuilder, MAT, box, rbox, cyl, cone } from '../kit.js';
import { PAL } from '../palette.js';
import { slab } from './common.js';

function bunker(b) {
  slab(b, 1, 1, PAL.concreteDark);
  b.add(MAT.PAINT, cyl(0.36, 0.44, 0.34, 20, { p: [0, 0.2, 0], color: PAL.olive }));
  b.add(MAT.HOUSE, cyl(0.365, 0.37, 0.05, 20, { p: [0, 0.3, 0] }));
  b.node('turret', { pivot: [0, 0.37, 0] });
}

export function gunTurret() {
  const b = new ModelBuilder('turret');
  bunker(b);
  b.node('barrel', { parent: 'turret', pivot: [0.14, 0.07, 0], axis: 'x', kind: 'trans' });
  b.add(MAT.PAINT, rbox(0.36, 0.14, 0.3, 0.04, { p: [0, 0.07, 0], color: PAL.oliveDark }), 'turret');
  b.add(MAT.METAL, cyl(0.022, 0.026, 0.42, 10, { p: [0.21, 0, 0], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }), 'barrel');
  b.add(MAT.METAL, box(0.06, 0.05, 0.06, { p: [0.43, 0, 0], color: PAL.gunmetal }), 'barrel');
  return b.build({ radius: 0.5, muzzle: [0.46, 0, 0] });
}

export function rocketTurret() {
  const b = new ModelBuilder('rocketTurret');
  bunker(b);
  b.add(MAT.PAINT, rbox(0.26, 0.14, 0.24, 0.04, { p: [0, 0.07, 0], color: PAL.oliveDark }), 'turret');
  for (const z of [-0.2, 0.2]) {
    b.add(MAT.METAL, box(0.3, 0.14, 0.13, { p: [0.03, 0.12, z], r: [0, 0, 0.2], color: PAL.steelDark }), 'turret');
    for (const y of [0.09, 0.15]) for (const dz of [-0.03, 0.03]) {
      b.add(MAT.PAINT, cone(0.02, 0.05, 6, { p: [0.2, y + 0.03, z + dz], r: [0, 0, -Math.PI / 2 + 0.2], color: PAL.rocketRed }), 'turret');
    }
  }
  return b.build({ radius: 0.5, muzzle: [0.22, 0.15, 0] });
}
