// Sonic Tank: hull-fixed golden horn emitter (Mentat art) with a glowing core; no turret.
import { ModelBuilder, MAT, box, rbox, cyl, lathe } from '../kit.js';
import { PAL } from '../palette.js';
import { tankChassis } from './tank-chassis.js';

export function sonicTank() {
  const b = new ModelBuilder('sonicTank');
  const { top } = tankChassis(b, { length: 0.66 });
  const y = top + 0.1;
  b.add(MAT.PAINT, rbox(0.2, 0.08, 0.2, 0.02, { p: [-0.08, top + 0.04, 0], color: PAL.sandDark }));
  b.add(MAT.HOUSE, box(0.18, 0.02, 0.205, { p: [-0.08, top + 0.075, 0] }));
  b.add(MAT.METAL, cyl(0.035, 0.05, 0.1, 10, { p: [0, y, 0], r: [0, 0, -Math.PI / 2], color: PAL.steelDark }));
  const flare = [[0.03, 0], [0.035, 0.06], [0.05, 0.12], [0.085, 0.18], [0.13, 0.22], [0.16, 0.235]];
  b.add(MAT.METAL, lathe(flare, 20, { p: [0.04, y, 0], r: [0, 0, -Math.PI / 2], color: PAL.brass }));
  b.add(MAT.DARK, lathe([...flare].reverse().map(([r, h]) => [r * 0.9, h]), 20, { p: [0.04, y, 0], r: [0, 0, -Math.PI / 2], color: 0x3b2c18 }));
  b.add(MAT.LIGHT, cyl(0.028, 0.028, 0.01, 12, { p: [0.05, y, 0], r: [0, 0, Math.PI / 2], color: PAL.blueGlow, glow: 1.5 }));
  return b.build({ radius: 0.38, muzzle: [0.3, y, 0] });
}
