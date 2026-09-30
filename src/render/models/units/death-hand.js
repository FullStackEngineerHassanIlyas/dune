// The Death Hand, after the Genesis sprite: a slim white ballistic missile in metal and white, no
// house colour. An ogive nose with a dark tip, lavender stage bands and dark seams down the white
// body, a cable raceway along the top, four swept lavender fins in an X at the tail, a dark nozzle
// bell and an orange-yellow exhaust flame. It lies along +x like every unit model (the flight view
// and the Palace weapon icon use it).
import { ModelBuilder, MAT, box, cyl, cone, lathe, hull } from '../kit.js';
import { PAL } from '../palette.js';

const WHITE = 0xd8d8e0, LAV = PAL.machineLight, LAV_DARK = PAL.machine, NAVY = PAL.navy;
const along = [0, 0, -Math.PI / 2];   // cylinders stand on y: lay them along +x
const R = 0.075;

export function deathHandMissile() {
  const b = new ModelBuilder('deathHandMissile');
  b.add(MAT.PAINT, cyl(R, R, 0.58, 16, { p: [-0.05, 0, 0], r: along, color: WHITE }));
  b.add(MAT.PAINT, lathe([[R, 0], [0.074, 0.05], [0.068, 0.1], [0.057, 0.15], [0.041, 0.2], [0.024, 0.235], [0.012, 0.25]], 16, { p: [0.24, 0, 0], r: along, color: WHITE }));
  b.add(MAT.DARK, lathe([[0.013, 0], [0.006, 0.014], [0, 0.02]], 16, { p: [0.489, 0, 0], r: along, color: NAVY }));

  // stage bands, seams, raceway
  for (const [x, w] of [[0.245, 0.03], [-0.02, 0.05], [-0.25, 0.03]]) b.add(MAT.METAL, cyl(R + 0.004, R + 0.004, w, 16, { p: [x, 0, 0], r: along, color: LAV }));
  for (const x of [0.13, 0.09, -0.13]) b.add(MAT.DARK, cyl(R + 0.002, R + 0.002, 0.007, 16, { p: [x, 0, 0], r: along, color: NAVY }));
  b.add(MAT.METAL, box(0.4, 0.014, 0.022, { p: [0.0, R + 0.004, 0], color: LAV_DARK }));
  for (const x of [0.17, -0.18]) b.add(MAT.METAL, box(0.03, 0.016, 0.03, { p: [x, R + 0.006, 0], color: LAV_DARK }));

  // four swept fins in an X, their roots on a collar
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a), t = 0.006;
    const at = (x, r, d) => [x, r * c - d * s, r * s + d * c];
    b.add(MAT.PAINT, hull([at(-0.14, R - 0.01, -t), at(-0.14, R - 0.01, t), at(-0.37, R - 0.01, -t), at(-0.37, R - 0.01, t),
      at(-0.3, R + 0.14, -t), at(-0.3, R + 0.14, t), at(-0.39, R + 0.14, -t), at(-0.39, R + 0.14, t)], { color: LAV }));
    b.add(MAT.DARK, hull([at(-0.3, R + 0.14, -t * 1.4), at(-0.3, R + 0.14, t * 1.4), at(-0.39, R + 0.14, -t * 1.4), at(-0.39, R + 0.14, t * 1.4),
      at(-0.29, R + 0.125, -t * 1.4), at(-0.29, R + 0.125, t * 1.4), at(-0.385, R + 0.125, -t * 1.4), at(-0.385, R + 0.125, t * 1.4)], { color: NAVY }));
  }

  // nozzle bell and flame
  b.add(MAT.METAL, cyl(0.06, 0.072, 0.07, 16, { p: [-0.375, 0, 0], r: along, color: LAV_DARK }));
  b.add(MAT.DARK, cyl(0.055, 0.055, 0.006, 16, { p: [-0.408, 0, 0], r: along, color: 0x0a0a12 }));
  b.add(MAT.LIGHT, cone(0.058, 0.2, 12, { p: [-0.51, 0, 0], r: [0, 0, Math.PI / 2], color: 0xff5a18, glow: 1.9 }));
  b.add(MAT.LIGHT, cone(0.032, 0.13, 10, { p: [-0.47, 0, 0], r: [0, 0, Math.PI / 2], color: 0xffe08a, glow: 2.6 }));
  return b.build({ radius: 0.56, shade: false });
}
