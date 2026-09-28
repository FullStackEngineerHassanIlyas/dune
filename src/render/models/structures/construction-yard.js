// Construction Yard (2x2): concrete apron, fence, assembly hall with a south-facing door and house
// band, glazed control tower with a beacon, bulldozer blade and girders, a slowly turning crane.
import { ModelBuilder, MAT, box, rbox, cyl, sphere, torus, prism } from '../kit.js';
import { PAL } from '../palette.js';

export function constructionYard() {
  const b = new ModelBuilder('constructionYard');
  b.add(MAT.PAINT, box(1.94, 0.11, 1.94, { p: [0, -0.005, 0], color: PAL.concrete }));
  for (const t of [-0.95, 0.95]) {
    b.add(MAT.DARK, box(1.94, 0.012, 0.02, { p: [0, 0.056, t], color: PAL.concreteDark }));
    b.add(MAT.DARK, box(0.02, 0.012, 1.94, { p: [t, 0.056, 0], color: PAL.concreteDark }));
  }
  for (let k = 0; k <= 6; k++) {
    const t = -0.94 + k * 0.313;
    b.add(MAT.METAL, cyl(0.012, 0.012, 0.18, 5, { p: [t, 0.14, -0.94], color: PAL.steelDark }));
    b.add(MAT.METAL, cyl(0.012, 0.012, 0.18, 5, { p: [-0.94, 0.14, t], color: PAL.steelDark }));
  }
  b.add(MAT.METAL, box(1.88, 0.012, 0.012, { p: [0, 0.22, -0.94], color: PAL.steel }));
  b.add(MAT.METAL, box(0.012, 0.012, 1.88, { p: [-0.94, 0.22, 0], color: PAL.steel }));
  b.add(MAT.PAINT, rbox(1.05, 0.42, 0.7, 0.04, { p: [-0.3, 0.26, -0.45], color: PAL.steel }));
  b.add(MAT.PAINT, prism([[-0.35, 0], [0.35, 0], [0.3, 0.12], [-0.3, 0.12]], 1.05, { p: [-0.3, 0.47, -0.45], r: [0, Math.PI / 2, 0], color: PAL.steelDark }));
  b.add(MAT.DARK, box(0.5, 0.3, 0.02, { p: [-0.3, 0.2, -0.09], color: PAL.gunmetal }));
  b.add(MAT.HOUSE, box(1.06, 0.06, 0.71, { p: [-0.3, 0.4, -0.45] }));
  b.add(MAT.PAINT, box(0.32, 0.6, 0.32, { p: [0.62, 0.33, 0.52], color: PAL.steel }));
  b.add(MAT.GLASS, box(0.34, 0.1, 0.34, { p: [0.62, 0.58, 0.52], color: PAL.glass }));
  b.add(MAT.PAINT, box(0.38, 0.03, 0.38, { p: [0.62, 0.645, 0.52], color: PAL.steelDark }));
  b.add(MAT.HOUSE_LIGHT, sphere(0.03, 8, { p: [0.62, 0.69, 0.52], glow: 2.5 }));
  b.add(MAT.PAINT, prism([[0, 0], [0.18, 0], [0.18, 0.04], [0.04, 0.16], [0, 0.16]], 0.36, { p: [-0.55, 0.05, 0.55], r: [0, -0.3, 0], color: PAL.yellow }));
  for (let k = 0; k < 3; k++) b.add(MAT.METAL, box(0.5, 0.03, 0.04, { p: [0.05, 0.065 + k * 0.035, 0.15 + (k % 2) * 0.03], color: PAL.steelDark }));
  b.node('crane', { pivot: [0.66, 0.05, -0.62] });
  b.add(MAT.PAINT, box(0.06, 1.0, 0.06, { p: [0, 0.5, 0], color: PAL.yellow }), 'crane');
  b.add(MAT.PAINT, box(0.95, 0.045, 0.06, { p: [-0.3, 1.0, 0], color: PAL.yellow }), 'crane');
  b.add(MAT.PAINT, box(0.14, 0.09, 0.09, { p: [0.18, 0.99, 0], color: PAL.concreteDark }), 'crane');
  b.add(MAT.METAL, cyl(0.004, 0.004, 0.42, 4, { p: [-0.68, 0.79, 0], color: PAL.gunmetal }), 'crane');
  b.add(MAT.METAL, torus(0.022, 0.006, 4, 8, { p: [-0.68, 0.57, 0], r: [Math.PI / 2, 0, 0], color: PAL.gunmetal }, Math.PI * 1.4), 'crane');
  b.add(MAT.HOUSE_LIGHT, sphere(0.02, 6, { p: [0, 1.04, 0], glow: 2.5 }), 'crane');
  return b.build({ radius: 1.0 });
}
