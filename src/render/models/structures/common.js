// Shared structure pieces: the concrete apron (dips below ground to hide terrain seams) and a house beacon.
import { MAT, box, sphere } from '../kit.js';
import { PAL } from '../palette.js';

export function slab(b, w, h, color = PAL.concrete) {
  b.add(MAT.PAINT, box(w - 0.06, 0.11, h - 0.06, { p: [0, -0.005, 0], color }));
  for (let k = 1; k < w; k++) b.add(MAT.DARK, box(0.02, 0.012, h - 0.1, { p: [-w / 2 + k, 0.052, 0], color: PAL.concreteDark }));
  for (let k = 1; k < h; k++) b.add(MAT.DARK, box(w - 0.1, 0.012, 0.02, { p: [0, 0.052, -h / 2 + k], color: PAL.concreteDark }));
}

export function beacon(b, x, y, z, node = 'root') {
  b.add(MAT.HOUSE_LIGHT, sphere(0.03, 8, { p: [x, y, z], glow: 2.5 }), node);
}

export function halfArc(r, height, steps = 14) {
  const pts = [];
  for (let k = 0; k <= steps; k++) { const a = (k / steps) * Math.PI; pts.push([Math.cos(a) * r, Math.sin(a) * height]); }
  return pts;
}
