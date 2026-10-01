// A rocket in flight, after the Genesis projectile sprites (docs/research/raw/visual-units.md, Missile
// Tank "Rockets (projectile)"; visual-structures.md rocket-tip ramp #402000 · #a06000 · #e0c0a0): a slim
// orange body with a white conical nose, a house-colour band behind the nose, four small dark fins in an
// X at the tail, a dark nozzle and a short glowing exhaust. It lies along +x, nose forward, 0.34 long; the
// flight view scales it down for Troopers' and Ornithopters' mini-rockets.
import { ModelBuilder, MAT, cyl, cone, lathe, hull } from '../kit.js';
import { PAL } from '../palette.js';

const ORANGE = 0xc86a14, ORANGE_DARK = 0x7a3c08, NOSE = 0xece2cc;
const along = [0, 0, -Math.PI / 2];   // cylinders stand on y: lay them along +x
const R = 0.024;

export function rocket() {
  const b = new ModelBuilder('rocket');
  b.add(MAT.PAINT, cyl(R, R, 0.2, 10, { p: [-0.02, 0, 0], r: along, color: ORANGE }));
  b.add(MAT.PAINT, lathe([[R, 0], [0.022, 0.03], [0.016, 0.06], [0.008, 0.085], [0.002, 0.1]], 10, { p: [0.08, 0, 0], r: along, color: NOSE }));
  b.add(MAT.HOUSE, cyl(R + 0.002, R + 0.002, 0.028, 10, { p: [0.062, 0, 0], r: along }));
  b.add(MAT.DARK, cyl(R + 0.001, R + 0.001, 0.006, 10, { p: [-0.06, 0, 0], r: along, color: ORANGE_DARK }));
  for (let k = 0; k < 4; k++) {   // four swept fins in an X
    const a = Math.PI / 4 + (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a), t = 0.004;
    const at = (x, r, d) => [x, r * c - d * s, r * s + d * c];
    b.add(MAT.DARK, hull([at(-0.07, R - 0.004, -t), at(-0.07, R - 0.004, t), at(-0.125, R - 0.004, -t), at(-0.125, R - 0.004, t),
      at(-0.115, R + 0.036, -t), at(-0.115, R + 0.036, t), at(-0.135, R + 0.036, -t), at(-0.135, R + 0.036, t)], { color: PAL.navy }));
  }
  b.add(MAT.METAL, cyl(0.018, 0.022, 0.02, 10, { p: [-0.13, 0, 0], r: along, color: PAL.gunmetal }));
  b.add(MAT.LIGHT, cone(0.02, 0.07, 8, { p: [-0.175, 0, 0], r: [0, 0, Math.PI / 2], color: 0xff7a22, glow: 2.2 }));
  b.add(MAT.LIGHT, cone(0.011, 0.045, 8, { p: [-0.16, 0, 0], r: [0, 0, Math.PI / 2], color: 0xffe6a0, glow: 2.8 }));
  return b.build({ radius: 0.2, shade: false });
}
