// Quad: four balloon-tyred buggy with a dark canopy, bumper and twin guns.
import { ModelBuilder, MAT, box, rbox, cyl, dome } from '../kit.js';
import { PAL } from '../palette.js';

export function quad() {
  const b = new ModelBuilder('quad');
  [[0.15, 0.17], [0.15, -0.17], [-0.15, 0.17], [-0.15, -0.17]].forEach(([x, z], k) => {
    const n = `wheel${k}`;
    b.node(n, { pivot: [x, 0.09, z], axis: 'z', param: 'wheel' });
    b.add(MAT.DARK, cyl(0.09, 0.09, 0.09, 14, { r: [Math.PI / 2, 0, 0], color: PAL.rubber }), n);
    b.add(MAT.METAL, cyl(0.045, 0.045, 0.094, 8, { r: [Math.PI / 2, 0, 0], color: PAL.steel }), n);
    b.add(MAT.DARK, box(0.03, 0.03, 0.095, { p: [0.075, 0, 0], color: PAL.gunmetal }), n);
  });
  b.add(MAT.PAINT, rbox(0.42, 0.1, 0.26, 0.035, { p: [0, 0.15, 0], color: PAL.sand }));
  for (const z of [-0.132, 0.132]) b.add(MAT.HOUSE, box(0.3, 0.05, 0.01, { p: [-0.01, 0.15, z] }));
  b.add(MAT.GLASS, dome(0.11, 14, { p: [-0.02, 0.2, 0], s: [1.2, 0.7, 1], color: PAL.glass }));
  b.add(MAT.PAINT, box(0.05, 0.05, 0.28, { p: [0.21, 0.13, 0], color: PAL.sandDark }));
  for (const z of [-0.05, 0.05]) b.add(MAT.METAL, cyl(0.01, 0.01, 0.16, 6, { p: [0.14, 0.24, z], r: [0, 0, Math.PI / 2], color: PAL.gunmetal }));
  b.add(MAT.METAL, box(0.06, 0.03, 0.14, { p: [0.08, 0.235, 0], color: PAL.steelDark }));
  return b.build({ radius: 0.32, muzzle: [0.22, 0.24, 0] });
}
