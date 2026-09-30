// The Death Hand: a long white ballistic missile with a red warhead, a house band and four fins; it
// lies along +x like every unit model (the flight view and the Palace weapon icon use it).
import { ModelBuilder, MAT, cyl, cone, box } from '../kit.js';
import { PAL } from '../palette.js';

export function deathHandMissile() {
  const b = new ModelBuilder('deathHandMissile');
  const along = [0, 0, -Math.PI / 2];   // cylinders stand on y: lay them along +x
  b.add(MAT.PAINT, cyl(0.07, 0.07, 0.62, 16, { r: along, color: PAL.white }));
  b.add(MAT.PAINT, cone(0.07, 0.2, 16, { p: [0.41, 0, 0], r: along, color: PAL.rocketRed }));
  b.add(MAT.HOUSE, cyl(0.072, 0.072, 0.08, 16, { p: [0.18, 0, 0], r: along }));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    b.add(MAT.PAINT, box(0.16, 0.012, 0.1, { p: [-0.27, Math.cos(a) * 0.1, Math.sin(a) * 0.1], r: [a - Math.PI / 2, 0, 0], color: PAL.steelDark }));
  }
  b.add(MAT.LIGHT, cyl(0.05, 0.035, 0.05, 12, { p: [-0.335, 0, 0], r: along, color: PAL.orangeGlow, glow: 3 }));
  return b.build({ radius: 0.5 });
}
