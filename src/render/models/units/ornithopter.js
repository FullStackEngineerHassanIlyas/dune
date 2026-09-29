// Ornithopter: a white dragonfly-winged craft — slim fuselage, pointed nose, bubble canopy, tail boom
// with a house-colour fin — whose two pairs of long wings flap (spec §5.3). Faces +x.
import { ModelBuilder, MAT, box, cyl, cone, sphere, prism } from '../kit.js';
import { PAL } from '../palette.js';

export function ornithopter() {
  const b = new ModelBuilder('ornithopter');
  b.add(MAT.PAINT, cyl(0.065, 0.05, 0.5, 12, { p: [0.02, 0.12, 0], r: [0, 0, Math.PI / 2], color: PAL.white }));
  b.add(MAT.PAINT, cone(0.05, 0.16, 12, { p: [0.35, 0.12, 0], r: [0, 0, -Math.PI / 2], color: PAL.white }));
  b.add(MAT.GLASS, sphere(0.055, 10, { p: [0.17, 0.17, 0], s: [1.4, 0.8, 0.9], color: PAL.glass }));
  b.add(MAT.PAINT, cyl(0.024, 0.018, 0.3, 8, { p: [-0.36, 0.13, 0], r: [0, 0, Math.PI / 2], color: PAL.offWhite }));
  b.add(MAT.HOUSE, prism([[0, 0], [0.1, 0], [0, 0.13]], 0.02, { p: [-0.52, 0.14, 0] }));
  b.add(MAT.HOUSE, box(0.2, 0.02, 0.1, { p: [0.0, 0.185, 0] }));
  b.add(MAT.METAL, box(0.18, 0.04, 0.05, { p: [0.08, 0.055, 0], color: PAL.gunmetal }));
  b.node('wingL', { pivot: [0.04, 0.16, -0.05], axis: 'x', param: 'flap' });
  b.node('wingR', { pivot: [0.04, 0.16, 0.05], axis: 'x', param: 'flapR' });
  for (const [node, s] of [['wingL', -1], ['wingR', 1]]) {
    b.add(MAT.PAINT, box(0.12, 0.008, 0.46, { p: [0.05, 0, s * 0.23], color: 0xdfe8ec }), node);
    b.add(MAT.PAINT, box(0.1, 0.008, 0.4, { p: [-0.1, 0, s * 0.2], color: 0xdfe8ec }), node);
    b.add(MAT.HOUSE, box(0.02, 0.01, 0.44, { p: [0.11, 0, s * 0.23] }), node);
  }
  return b.build({ radius: 0.55 });
}
