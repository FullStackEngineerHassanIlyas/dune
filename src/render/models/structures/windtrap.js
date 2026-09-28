// Wind Trap (2x2): two ribbed half-dome air intakes with dark louvred mouths facing south (Mentat
// art), a machinery block behind them with a spinning turbine vent, and pipes between.
import { ModelBuilder, MAT, box, rbox, cyl, prism, torus } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon, halfArc } from './common.js';

export function windtrap() {
  const b = new ModelBuilder('windtrap');
  slab(b, 2, 2);
  for (const x of [-0.47, 0.47]) {
    b.add(MAT.PAINT, prism(halfArc(0.42, 0.5), 1.0, { p: [x, 0.05, 0.08], color: PAL.steel }));
    b.add(MAT.DARK, prism(halfArc(0.34, 0.41), 0.02, { p: [x, 0.05, 0.59], color: 0x1b1916 }));
    for (let k = 0; k < 4; k++) {
      const y = 0.12 + k * 0.08;
      const half = 0.34 * Math.sqrt(Math.max(0, 1 - ((y - 0.05) / 0.41) ** 2));
      b.add(MAT.METAL, box(half * 1.9, 0.018, 0.03, { p: [x, y, 0.605], color: PAL.steelDark }));
    }
    for (const z of [-0.3, 0.05, 0.4]) b.add(MAT.METAL, torus(0.425, 0.014, 4, 16, { p: [x, 0.05, z], s: [1, 1.18, 1], color: PAL.steelDark }, Math.PI));
    b.add(MAT.METAL, cyl(0.05, 0.05, 0.36, 8, { p: [x, 0.2, -0.46], r: [Math.PI / 2, 0, 0], color: PAL.gunmetal }));
  }
  b.add(MAT.PAINT, rbox(1.7, 0.3, 0.42, 0.03, { p: [0, 0.2, -0.72], color: PAL.steelDark }));
  b.add(MAT.HOUSE, box(1.72, 0.05, 0.43, { p: [0, 0.3, -0.72] }));
  b.add(MAT.METAL, cyl(0.2, 0.22, 0.12, 18, { p: [0.45, 0.4, -0.72], color: PAL.steel }));
  b.node('fan', { pivot: [0.45, 0.47, -0.72] });
  b.add(MAT.DARK, cyl(0.04, 0.04, 0.03, 8, { color: PAL.gunmetal }), 'fan');
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    b.add(MAT.METAL, box(0.17, 0.012, 0.05, { p: [Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09], r: [0, -a, 0], color: PAL.steelDark }), 'fan');
  }
  beacon(b, -0.8, 0.4, -0.72);
  return b.build({ radius: 1.0 });
}
