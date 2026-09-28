// Trike / Raider Trike: two big rear wheels, front fork, house fairing, twin forward guns.
import { ModelBuilder, MAT, box, rbox, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';

export function trike() {
  const b = new ModelBuilder('trike');
  b.node('wheelL', { pivot: [-0.12, 0.09, 0.12], axis: 'z', param: 'wheel' });
  b.node('wheelR', { pivot: [-0.12, 0.09, -0.12], axis: 'z', param: 'wheel' });
  b.node('wheelF', { pivot: [0.2, 0.07, 0], axis: 'z', param: 'wheel' });
  for (const n of ['wheelL', 'wheelR']) {
    b.add(MAT.DARK, cyl(0.09, 0.09, 0.07, 14, { r: [Math.PI / 2, 0, 0], color: PAL.rubber }), n);
    b.add(MAT.METAL, cyl(0.04, 0.04, 0.074, 8, { r: [Math.PI / 2, 0, 0], color: PAL.steel }), n);
    b.add(MAT.DARK, box(0.03, 0.03, 0.075, { p: [0.065, 0, 0], color: PAL.gunmetal }), n);
  }
  b.add(MAT.DARK, cyl(0.07, 0.07, 0.05, 12, { r: [Math.PI / 2, 0, 0], color: PAL.rubber }), 'wheelF');
  b.add(MAT.METAL, cyl(0.03, 0.03, 0.054, 8, { r: [Math.PI / 2, 0, 0], color: PAL.steel }), 'wheelF');
  b.add(MAT.PAINT, rbox(0.3, 0.07, 0.17, 0.025, { p: [-0.03, 0.14, 0], color: PAL.sand }));
  b.add(MAT.HOUSE, prism([[0.02, 0.1], [0.19, 0.12], [0.16, 0.2], [0.02, 0.2]], 0.12));
  for (const z of [-0.045, 0.045]) b.add(MAT.METAL, box(0.2, 0.02, 0.02, { p: [0.12, 0.12, z], r: [0, 0, -0.35], color: PAL.steelDark }));
  b.add(MAT.DARK, rbox(0.1, 0.04, 0.1, 0.015, { p: [-0.06, 0.2, 0], color: PAL.clothDark }));
  b.add(MAT.GLASS, box(0.03, 0.05, 0.1, { p: [0.05, 0.22, 0], r: [0, 0, 0.5], color: PAL.glass }));
  for (const z of [-0.035, 0.035]) b.add(MAT.METAL, cyl(0.009, 0.009, 0.14, 6, { p: [0.08, 0.23, z], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }));
  return b.build({ radius: 0.3, muzzle: [0.16, 0.23, 0] });
}
