// Devastator, after the Genesis sprite: the biggest, darkest tank. A wide hull on broad tracks whose
// big corner drums stand out at all four corners; tall house-colour sponsons down both sides with lit
// top edges; between them, low at the front, the dark gun housing with two long white barrels fixed
// forward (they recoil on `barrel`); the raised rear superstructure with its square hatch, periscopes
// and exhaust stacks, a louvred engine grille behind it. A red beacon on the superstructure and a lamp
// on each sponson nose light up and pulse (`warn`, hidden until the Destruct countdown).
import { ModelBuilder, MAT, box, cbox, cyl, sphere, dome } from '../kit.js';
import { PAL } from '../palette.js';
import { louvres } from '../detail.js';
import { tankHull, slab, barrel, ringHatch, RECESS, SHADE } from './tank-chassis.js';

export function devastator() {
  const b = new ModelBuilder('devastator');
  const { deck, hl, hw } = tankHull(b, { length: 0.92, width: 0.79, trackW: 0.19, trackH: 0.15, deck: 0.2, fender: 0.12, notch: 0.1, glacis: 0.1, nose: 0.15, wheels: 6 });
  // sponsons along both sides
  for (const s of [-1, 1]) {
    b.add(MAT.HOUSE, slab([[-0.2, deck - 0.01], [0.35, deck - 0.01], [0.35, 0.27], [0.29, 0.305], [-0.16, 0.305], [-0.2, 0.28]], 0.18, { c: 0.028, z: s * (hw - 0.09) }));
    for (const x of [0.17, 0.23]) b.add(MAT.HOUSE, cbox(0.03, 0.02, 0.13, 0.006, { p: [x, 0.31, s * (hw - 0.09)], color: RECESS }));
    for (const x of [-0.1, 0.02, 0.14]) b.add(MAT.DARK, box(0.07, 0.014, 0.006, { p: [x, 0.265, s * (hw + 0.001)], color: 0x0c0c16 }));
  }
  louvres(b, { w: 0.2, d: 0.11, n: 4, at: { p: [-0.02, 0.305, hw - 0.09] }, frame: PAL.navy, slats: PAL.navyLight });
  ringHatch(b, 'root', { p: [-0.02, 0.305, 0.09 - hw], r: 0.045, h: 0.016 });
  // gun housing between the sponsons
  b.add(MAT.METAL, cbox(0.24, 0.1, 0.36, 0.02, { p: [0.02, deck + 0.05, 0], color: PAL.navy }));
  b.add(MAT.HOUSE, cbox(0.2, 0.025, 0.3, 0.01, { p: [0.0, deck + 0.105, 0], color: SHADE }));
  // superstructure: raised block, square hatch, periscopes, stacks
  const sx = -0.19, top = 0.365;
  b.add(MAT.HOUSE, slab([[sx - 0.14, deck - 0.01], [sx + 0.15, deck - 0.01], [sx + 0.15, top - 0.02], [sx + 0.12, top], [sx - 0.11, top], [sx - 0.14, top - 0.03]], 0.4, { c: 0.03 }));
  b.add(MAT.HOUSE, cbox(0.13, 0.018, 0.13, 0.008, { p: [sx + 0.03, top + 0.004, 0] }));
  b.add(MAT.HOUSE, cbox(0.09, 0.02, 0.09, 0.006, { p: [sx + 0.03, top + 0.006, 0], color: RECESS }));
  for (const z of [-0.12, 0.12]) b.add(MAT.DARK, box(0.03, 0.03, 0.04, { p: [sx + 0.1, top + 0.012, z], color: 0x0c0c16 }));
  for (const s of [-1, 1]) {
    b.add(MAT.METAL, cyl(0.022, 0.026, 0.16, 8, { p: [sx - 0.15, deck + 0.07, s * 0.14], color: PAL.gunmetal }));
    b.add(MAT.DARK, cyl(0.015, 0.015, 0.162, 8, { p: [sx - 0.15, deck + 0.071, s * 0.14], color: 0x0c0c12 }));
  }
  louvres(b, { w: 0.08, d: 0.26, n: 4, at: { p: [-hl + 0.07, deck, 0] }, frame: PAL.navy, slats: PAL.navyLight });
  // Destruct lamps: a beacon on the superstructure and one on each sponson's nose, each scaling about its own lens
  const lamps = [['warn', [sx - 0.075, top + 0.03, 0], 0.03], ['warnL', [0.3, 0.325, 0.09 - hw], 0.02], ['warnR', [0.3, 0.325, hw - 0.09], 0.02]];
  for (const [name, [x, y, z], r] of lamps) {
    b.add(MAT.METAL, cyl(r * 1.35, r * 1.5, 0.02, 10, { p: [x, y - r * 0.9, z], color: PAL.navy }));
    b.add(MAT.PAINT, dome(r, 10, { p: [x, y - r * 0.8, z], color: 0x6a1410 }));
    b.node(name, { pivot: [x, y - r * 0.4, z], kind: 'scale', param: 'warn', value: 0 });   // hidden until the countdown
    b.add(MAT.LIGHT, sphere(r * 0.95, 10, { color: 0xff0e06, glow: 2.2 }), name);
  }
  // twin heavy guns, fixed forward, recoiling together
  const gy = deck + 0.075, len = 0.62;
  b.node('barrel', { pivot: [0.12, gy, 0], axis: 'x', kind: 'trans' });
  for (const s of [-1, 1]) barrel(b, 'barrel', { len, z: s * 0.11, r: 0.033, brake: 0.046 });
  const tip = 0.12 + len;
  return b.build({ radius: 0.66, muzzle: [tip, gy, 0], muzzles: [[tip, gy, -0.11], [tip, gy, 0.11]] });
}
