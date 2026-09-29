// Starport (3x3): a landing pad with a house-colour X and a diamond of lights that pulse when a Frigate
// is due, two mushroom-shaped control towers on the west side and a glazed terminal along the north
// (spec §5.3). The Frigate lands on the pad.
import { ModelBuilder, MAT, box, rbox, cyl, sphere } from '../kit.js';
import { PAL } from '../palette.js';
import { slab, beacon } from './common.js';

export function starport() {
  const b = new ModelBuilder('starport');
  slab(b, 3, 3);
  b.add(MAT.DARK, box(2.0, 0.012, 2.0, { p: [0.3, 0.056, 0.35], color: 0x2e2d2b }));
  for (const r of [Math.PI / 4, -Math.PI / 4]) b.add(MAT.HOUSE, box(2.2, 0.008, 0.12, { p: [0.3, 0.066, 0.35], r: [0, r, 0] }));
  b.node('padLights', { pivot: [0.3, 0.075, 0.35], kind: 'scale' });
  for (const [x, z] of [[0, -0.9], [0.9, 0], [0, 0.9], [-0.9, 0], [0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]]) b.add(MAT.HOUSE_LIGHT, sphere(0.03, 8, { p: [x, 0, z], glow: 2.5 }), 'padLights');
  b.add(MAT.PAINT, rbox(2.7, 0.42, 0.5, 0.04, { p: [0, 0.26, -1.18], color: PAL.steel }));
  b.add(MAT.GLASS, box(2.5, 0.08, 0.51, { p: [0, 0.36, -1.18], color: PAL.glass }));
  b.add(MAT.HOUSE, box(2.72, 0.04, 0.52, { p: [0, 0.48, -1.18] }));
  for (const z of [-0.15, 1.0]) {
    b.add(MAT.PAINT, cyl(0.07, 0.1, 0.72, 12, { p: [-1.15, 0.41, z], color: PAL.steelDark }));
    b.add(MAT.PAINT, cyl(0.3, 0.2, 0.12, 20, { p: [-1.15, 0.83, z], color: PAL.white }));
    b.add(MAT.GLASS, cyl(0.29, 0.29, 0.05, 20, { p: [-1.15, 0.76, z], color: PAL.glass }));
    b.add(MAT.HOUSE_LIGHT, sphere(0.035, 8, { p: [-1.15, 0.92, z], glow: 2.5 }));
  }
  beacon(b, 1.3, 0.55, -1.18);
  return b.build({ radius: 2.2 });
}
