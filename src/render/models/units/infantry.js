// Infantry figures: stillsuit soldier with mask and red goggles; bulkier armoured trooper with a
// shoulder rocket launcher; the Ordos Saboteur, slim and dark with a satchel charge; robed Fremen with
// the blue-within-blue eyes. Squads draw three figures per unit.
import { ModelBuilder, MAT, box, cyl, sphere } from '../kit.js';
import { PAL } from '../palette.js';

function figure(name, { scale = 1, body = PAL.cloth, legs = PAL.cloth, head = PAL.cloth, pack = PAL.clothDark, eyes = PAL.redGlow, gear = 'rifle', robe = null } = {}) {
  const b = new ModelBuilder(name);
  const k = scale * 1.35;   // exaggerated like every RTS so figures read at battle zoom
  const hip = 0.085 * k, torso = 0.07 * k;
  b.node('legL', { pivot: [0, hip, 0.022 * k], axis: 'z' });
  b.node('legR', { pivot: [0, hip, -0.022 * k], axis: 'z' });
  for (const n of ['legL', 'legR']) {
    b.add(MAT.PAINT, box(0.03 * k, 0.075 * k, 0.028 * k, { p: [0, -0.04 * k, 0], color: legs }), n);
    b.add(MAT.DARK, box(0.04 * k, 0.014 * k, 0.03 * k, { p: [0.006, -0.08 * k, 0], color: PAL.clothDark }), n);
  }
  if (robe) b.add(MAT.PAINT, cyl(0.032 * k, 0.05 * k, 0.07 * k, 10, { p: [0, hip - 0.012 * k, 0], color: robe }));   // a robe over the hips
  b.add(MAT.PAINT, box(0.045 * k, torso, 0.07 * k, { p: [0, hip + torso / 2, 0], color: body }));
  b.add(MAT.HOUSE, box(0.05 * k, torso * 0.55, 0.074 * k, { p: [0.002, hip + torso * 0.6, 0] }));
  b.add(MAT.PAINT, sphere(0.022 * k, 10, { p: [0.004, hip + torso + 0.022 * k, 0], color: head }));
  b.add(MAT.DARK, box(0.016, 0.016, 0.03, { p: [0.022 * k, hip + torso + 0.016 * k, 0], color: PAL.mask }));
  b.add(MAT.LIGHT, box(0.004, 0.006, 0.026, { p: [0.025 * k, hip + torso + 0.027 * k, 0], color: eyes, glow: 1.2 }));
  b.add(MAT.PAINT, box(0.03 * k, 0.05 * k, 0.05 * k, { p: [-0.032 * k, hip + torso * 0.55, 0], color: pack }));
  for (const side of [1, -1]) b.add(MAT.PAINT, box(0.05, 0.018, 0.018, { p: [0.025, hip + torso * 0.55, side * 0.04 * k], r: [0, side * 0.3, 0], color: body }));
  if (gear === 'launcher') {
    b.add(MAT.METAL, cyl(0.016, 0.016, 0.1, 8, { p: [0, hip + torso + 0.01, -0.045], r: [0, 0, Math.PI / 2], color: PAL.steelDark }));
    b.add(MAT.HOUSE, box(0.03, 0.03, 0.03, { p: [-0.05, hip + torso + 0.01, -0.045] }));
    b.add(MAT.METAL, cyl(0.008, 0.008, 0.07, 6, { p: [0.05, hip + torso * 0.5, 0.02], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }));
  } else if (gear === 'charge') {
    b.add(MAT.METAL, box(0.05, 0.012, 0.012, { p: [0.04, hip + torso * 0.5, 0.01], color: PAL.gunmetal }));   // a pistol
    b.add(MAT.DARK, box(0.024 * k, 0.03 * k, 0.04 * k, { p: [-0.048 * k, hip + torso * 0.3, 0], color: PAL.oliveDark }));   // the satchel charge
    b.add(MAT.LIGHT, sphere(0.006, 6, { p: [-0.06 * k, hip + torso * 0.45, 0], color: PAL.redGlow, glow: 3 }));
  } else {
    b.add(MAT.METAL, box(0.1, 0.012, 0.012, { p: [0.05, hip + torso * 0.5, 0.01], color: PAL.gunmetal }));
  }
  return b.build({ radius: 0.12 * k, muzzle: [0.1, hip + torso * 0.5, 0] });
}

export const soldier = () => figure('soldier');
export const trooper = () => figure('trooper', { scale: 1.12, body: PAL.sand, legs: PAL.sandDark, head: PAL.sandDark, gear: 'launcher' });
export const saboteur = () => figure('saboteur', { scale: 0.95, body: 0x2c2f36, legs: 0x23252b, head: 0x23252b, pack: 0x3a2e24, eyes: PAL.greenGlow, gear: 'charge' });
export const fremen = () => figure('fremen', { scale: 1.06, body: 0x9a7b52, legs: 0x7b6143, head: 0x8a6d49, eyes: PAL.blueGlow, gear: 'launcher', robe: 0x8e7048 });
