// Stand-ins for structures and units whose models arrive in plan 1b.
import { ModelBuilder, MAT, box } from '../kit.js';
import { PAL } from '../palette.js';

export function placeholderStructure(w, h) {
  const b = new ModelBuilder(`placeholder${w}x${h}`);
  b.add(MAT.PAINT, box(w * 0.94, 0.5, h * 0.94, { p: [0, 0.25, 0], color: PAL.steel }));
  b.add(MAT.HOUSE, box(w * 0.95, 0.08, h * 0.95, { p: [0, 0.4, 0] }));
  return b.build({ radius: Math.max(w, h) / 2 });
}

export function placeholderUnit() {
  const b = new ModelBuilder('placeholderUnit');
  b.add(MAT.PAINT, box(0.5, 0.2, 0.35, { p: [0, 0.1, 0], color: PAL.sand }));
  b.add(MAT.HOUSE, box(0.3, 0.05, 0.36, { p: [0, 0.22, 0] }));
  return b.build({ radius: 0.35 });
}
