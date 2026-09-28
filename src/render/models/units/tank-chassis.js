// Tracked hull shared by the tank family: scrolling treads, road wheels, fenders, a sloped hull
// extruded from a side profile, house stripes and an engine deck. Returns the deck height.
import { MAT, box, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';

export function tankChassis(b, { length = 0.64, width = 0.46, hull = 0.13, trackW = 0.12, trackH = 0.12, color = PAL.sand, stripe = true } = {}) {
  const hl = length / 2, hw = width / 2, base = 0.06;
  for (const side of [-1, 1]) {
    const z = side * (hw - trackW / 2);
    b.add(MAT.TREAD, box(length, trackH, trackW, { p: [0, trackH / 2 + 0.005, z] }));
    for (const x of [-hl + 0.055, hl - 0.055]) b.add(MAT.DARK, cyl(0.058, 0.058, trackW + 0.012, 12, { p: [x, 0.062, z], r: [Math.PI / 2, 0, 0], color: PAL.gunmetal }));
    b.add(MAT.PAINT, box(length + 0.03, 0.022, trackW + 0.02, { p: [0, trackH + 0.016, z], color }));
  }
  const top = base + hull;
  const profile = [[-hl + 0.01, base], [hl - 0.12, base], [hl + 0.02, base + hull * 0.45], [hl - 0.08, top], [-hl + 0.06, top], [-hl - 0.01, top - 0.035]];
  b.add(MAT.PAINT, prism(profile, width - 2 * trackW + 0.03, { color }));
  b.add(MAT.PAINT, box(length * 0.78, 0.03, width - 0.02, { p: [-0.03, top - 0.012, 0], color }));
  if (stripe) for (const side of [-1, 1]) b.add(MAT.HOUSE, box(length * 0.62, 0.03, 0.03, { p: [-0.04, top - 0.005, side * (hw - 0.03)] }));
  b.add(MAT.DARK, box(0.11, 0.012, width * 0.36, { p: [-hl + 0.12, top + 0.004, 0], color: PAL.gunmetal }));
  b.add(MAT.METAL, cyl(0.014, 0.014, 0.07, 6, { p: [-hl + 0.07, top + 0.03, hw - trackW - 0.02], color: PAL.steelDark }));
  return { top };
}
