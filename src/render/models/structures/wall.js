// Wall pieces: a crenellated post on every wall tile, and an arm reaching towards each walled
// neighbour (the structure views add and turn the arms).
import { ModelBuilder, MAT, box } from '../kit.js';
import { PAL } from '../palette.js';

export function wallPost() {
  const b = new ModelBuilder('wallPost');
  b.add(MAT.PAINT, box(0.36, 0.38, 0.36, { p: [0, 0.17, 0], color: PAL.beige }));
  for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) b.add(MAT.PAINT, box(0.08, 0.08, 0.08, { p: [x, 0.4, z], color: PAL.beige }));
  return b.build({ radius: 0.5 });
}

export function wallArm() {
  const b = new ModelBuilder('wallArm');
  b.add(MAT.PAINT, box(0.34, 0.3, 0.26, { p: [0.33, 0.13, 0], color: PAL.sandLight }));
  for (const x of [0.22, 0.4]) b.add(MAT.PAINT, box(0.07, 0.07, 0.26, { p: [x, 0.315, 0], color: PAL.sandLight }));
  return b.build({ radius: 0.5 });
}
