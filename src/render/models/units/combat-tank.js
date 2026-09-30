// Combat Tank, after the Genesis sprite: a near-square house-colour hull whose four track drums stick
// out at the corners, fender bolts dotting its rims; a big round dome turret, three quarters of the hull
// wide and a little aft of centre, flattened at the front by a wide mantlet, over a dark turret ring;
// one long white barrel with a fume extractor and a muzzle brake reaching well past the bow. Low
// cupola, periscope and whip aerial on the dome; engine louvres and exhausts at the back.
import { ModelBuilder, MAT, cyl, cbox, lathe, box } from '../kit.js';
import { PAL } from '../palette.js';
import { louvres } from '../detail.js';
import { tankHull, barrel, ringHatch, RECESS } from './tank-chassis.js';

export function combatTank() {
  const b = new ModelBuilder('combatTank');
  const { deck, hl } = tankHull(b, { length: 0.8, width: 0.66 });
  louvres(b, { w: 0.12, d: 0.34, n: 5, at: { p: [-hl + 0.1, deck, 0] }, frame: PAL.navy, slats: PAL.navyLight });
  ringHatch(b, 'root', { p: [0.27, deck, -0.13], r: 0.04, h: 0.014 });
  b.add(MAT.DARK, box(0.02, 0.018, 0.05, { p: [0.325, deck + 0.008, -0.13], color: 0x0c0c16 }));

  const tx = -0.04, R = 0.235, gy = 0.075;
  b.add(MAT.DARK, cyl(R + 0.018, R + 0.018, 0.014, 20, { p: [tx, deck + 0.004, 0], color: 0x0c0c16 }));
  b.node('turret', { pivot: [tx, deck, 0] });
  b.add(MAT.HOUSE, lathe([[R, 0], [R, 0.03], [R * 0.95, 0.07], [R * 0.8, 0.103], [R * 0.55, 0.124], [R * 0.25, 0.133], [0, 0.135]], 20, { p: [-0.015, 0.006, 0], s: [0.9, 1, 1] }), 'turret');
  b.add(MAT.HOUSE, cyl(0.05, 0.05, 0.26, 12, { p: [R - 0.05, gy - 0.004, 0], r: [Math.PI / 2, 0, 0] }), 'turret');   // mantlet roll across the front
  for (const s of [-1, 1]) b.add(MAT.HOUSE, cyl(0.052, 0.052, 0.014, 12, { p: [R - 0.05, gy - 0.004, s * 0.12], r: [Math.PI / 2, 0, 0], color: RECESS }), 'turret');
  b.add(MAT.HOUSE, cbox(0.07, 0.07, 0.1, 0.012, { p: [R - 0.01, gy, 0], color: RECESS }), 'turret');
  ringHatch(b, 'turret', { p: [-0.07, 0.122, -0.08], r: 0.055 });
  b.add(MAT.DARK, box(0.03, 0.028, 0.05, { p: [0.05, 0.14, 0.09], color: 0x0c0c16 }), 'turret');
  b.add(MAT.METAL, cyl(0.004, 0.004, 0.2, 4, { p: [-0.17, 0.2, 0.12], color: PAL.gunmetal }), 'turret');
  b.add(MAT.METAL, cyl(0.012, 0.012, 0.02, 6, { p: [-0.17, 0.105, 0.12], color: PAL.navy }), 'turret');

  b.node('barrel', { parent: 'turret', pivot: [R + 0.02, gy, 0], axis: 'x', kind: 'trans' });
  const len = 0.4;
  barrel(b, 'barrel', { len, r: 0.027, brake: 0.04 });
  return b.build({ radius: 0.52, muzzle: [tx + R + 0.02 + len, deck + gy, 0] });
}
