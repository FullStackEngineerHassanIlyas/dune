// House of IX (2x2): stepped blue-glass domes on a round tiered base, green lights round the step and
// a spire — the Ixian research house (spec §5.3).
import { ModelBuilder, MAT, cyl, sphere, dome } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

export function houseOfIX() {
  const b = new ModelBuilder('houseOfIX');
  slab(b, 2, 2);
  b.add(MAT.PAINT, cyl(0.84, 0.88, 0.16, 28, { p: [0, 0.12, 0], color: PAL.steelDark }));
  b.add(MAT.PAINT, cyl(0.66, 0.7, 0.16, 28, { p: [0, 0.28, 0], color: PAL.steel }));
  b.add(MAT.HOUSE, cyl(0.705, 0.705, 0.04, 28, { p: [0, 0.35, 0] }));
  b.add(MAT.GLASS, dome(0.55, 28, { p: [0, 0.36, 0], color: 0x2c6cc4 }));
  for (const [x, z] of [[0.62, 0.62], [-0.62, 0.62]]) b.add(MAT.GLASS, dome(0.2, 20, { p: [x, 0.05, z], color: 0x2c6cc4 }));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    b.add(MAT.LIGHT, sphere(0.03, 8, { p: [Math.cos(a) * 0.78, 0.21, Math.sin(a) * 0.78], color: PAL.greenGlow, glow: 3 }));
  }
  b.add(MAT.METAL, cyl(0.02, 0.035, 0.5, 8, { p: [0, 1.12, 0], color: PAL.gunmetal }));
  b.add(MAT.LIGHT, sphere(0.04, 8, { p: [0, 1.39, 0], color: PAL.greenGlow, glow: 3 }));
  beacon(b, 0.72, 0.22, -0.72);
  return b.build({ radius: 1.0 });
}
