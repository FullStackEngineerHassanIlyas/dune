// Carryall: a white long-fuselage lifter with a jet pod on each stub wing, a glazed nose, a house-colour
// tail and stripe, and grapple claws under the belly that close on its load (spec §5.3). Faces +x.
import { ModelBuilder, MAT, box, rbox, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';

export function carryall() {
  const b = new ModelBuilder('carryall');
  b.add(MAT.PAINT, rbox(0.95, 0.14, 0.24, 0.05, { p: [0, 0.12, 0], color: PAL.white }));
  b.add(MAT.GLASS, rbox(0.2, 0.08, 0.2, 0.035, { p: [0.4, 0.2, 0], color: PAL.glass }));
  b.add(MAT.HOUSE, box(0.6, 0.02, 0.245, { p: [-0.05, 0.19, 0] }));
  b.add(MAT.HOUSE, prism([[0, 0], [0.16, 0], [0, 0.2]], 0.03, { p: [-0.47, 0.19, 0] }));
  for (const s of [-1, 1]) {
    b.add(MAT.PAINT, box(0.16, 0.03, 0.2, { p: [-0.05, 0.14, s * 0.2], color: PAL.offWhite }));
    b.add(MAT.METAL, cyl(0.055, 0.06, 0.28, 12, { p: [-0.05, 0.14, s * 0.33], r: [0, 0, Math.PI / 2], color: PAL.steel }));
    b.add(MAT.DARK, cyl(0.042, 0.042, 0.02, 12, { p: [-0.2, 0.14, s * 0.33], r: [0, 0, Math.PI / 2], color: 0x1b1916 }));
  }
  b.node('clawF', { pivot: [0.16, 0.06, 0], axis: 'z', param: 'claws' });
  b.node('clawB', { pivot: [-0.16, 0.06, 0], axis: 'z', param: 'clawsB' });
  for (const [node, s] of [['clawF', 1], ['clawB', -1]]) {
    b.add(MAT.METAL, box(0.025, 0.14, 0.06, { p: [0, -0.07, 0], color: PAL.gunmetal }), node);
    b.add(MAT.METAL, box(0.07, 0.022, 0.06, { p: [-s * 0.03, -0.14, 0], color: PAL.gunmetal }), node);
  }
  return b.build({ radius: 0.55 });
}
