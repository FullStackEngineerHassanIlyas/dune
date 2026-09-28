// Infantry figures: stillsuit soldier with mask and red goggles; bulkier armoured trooper with a
// shoulder rocket launcher. Squads draw three figures per unit.
import { ModelBuilder, MAT, box, cyl, sphere } from '../kit.js';
import { PAL } from '../palette.js';

function figure(name, armour) {
  const b = new ModelBuilder(name);
  const k = armour ? 1.12 : 1;
  const hip = 0.085 * k, torso = 0.07 * k;
  const body = armour ? PAL.sand : PAL.cloth;
  b.node('legL', { pivot: [0, hip, 0.022 * k], axis: 'z' });
  b.node('legR', { pivot: [0, hip, -0.022 * k], axis: 'z' });
  for (const n of ['legL', 'legR']) {
    b.add(MAT.PAINT, box(0.03 * k, 0.075 * k, 0.028 * k, { p: [0, -0.04 * k, 0], color: armour ? PAL.sandDark : PAL.cloth }), n);
    b.add(MAT.DARK, box(0.04 * k, 0.014 * k, 0.03 * k, { p: [0.006, -0.08 * k, 0], color: PAL.clothDark }), n);
  }
  b.add(MAT.PAINT, box(0.045 * k, torso, 0.07 * k, { p: [0, hip + torso / 2, 0], color: body }));
  b.add(MAT.HOUSE, box(0.05 * k, torso * 0.55, 0.074 * k, { p: [0.002, hip + torso * 0.6, 0] }));
  b.add(MAT.PAINT, sphere(0.022 * k, 10, { p: [0.004, hip + torso + 0.022 * k, 0], color: armour ? PAL.sandDark : PAL.cloth }));
  b.add(MAT.DARK, box(0.016, 0.016, 0.03, { p: [0.022 * k, hip + torso + 0.016 * k, 0], color: PAL.mask }));
  b.add(MAT.LIGHT, box(0.004, 0.006, 0.026, { p: [0.025 * k, hip + torso + 0.027 * k, 0], color: PAL.redGlow, glow: 1.2 }));
  b.add(MAT.PAINT, box(0.03 * k, 0.05 * k, 0.05 * k, { p: [-0.032 * k, hip + torso * 0.55, 0], color: PAL.clothDark }));
  for (const side of [1, -1]) b.add(MAT.PAINT, box(0.05, 0.018, 0.018, { p: [0.025, hip + torso * 0.55, side * 0.04 * k], r: [0, side * 0.3, 0], color: body }));
  if (armour) {
    b.add(MAT.METAL, cyl(0.016, 0.016, 0.1, 8, { p: [0, hip + torso + 0.01, -0.045], r: [0, 0, Math.PI / 2], color: PAL.steelDark }));
    b.add(MAT.HOUSE, box(0.03, 0.03, 0.03, { p: [-0.05, hip + torso + 0.01, -0.045] }));
    b.add(MAT.METAL, cyl(0.008, 0.008, 0.07, 6, { p: [0.05, hip + torso * 0.5, 0.02], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }));
  } else {
    b.add(MAT.METAL, box(0.1, 0.012, 0.012, { p: [0.05, hip + torso * 0.5, 0.01], color: PAL.gunmetal }));
  }
  return b.build({ radius: 0.12 * k, muzzle: [0.1, hip + torso * 0.5, 0] });
}

export const soldier = () => figure('soldier', false);
export const trooper = () => figure('trooper', true);
