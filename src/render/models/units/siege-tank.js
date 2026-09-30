// Siege Tank, after the Genesis sprite: bigger and squarer than the Combat Tank, with stabiliser
// outriggers at all four corners standing out sideways past the hull (their jack caps are the sprite's
// grey tips) beside the corner track drums; a raised front deck whose rear edge is the lit ledge, and
// behind it the lower engine block cut by three open slots (the notched rear); a wide oval dome turret
// with a sight ring in the middle (the sprite's cyan "eye") and dark vision blocks either side; twin
// white barrels on a dark bridge, raised a few degrees, recoiling together.
import { ModelBuilder, MAT, box, cbox, cyl, lathe, dome } from '../kit.js';
import { PAL } from '../palette.js';
import { tankHull, slab, barrel, ringHatch, GUN, RECESS, SHADE } from './tank-chassis.js';

export function siegeTank() {
  const b = new ModelBuilder('siegeTank');
  const { deck, hl, hw } = tankHull(b, { length: 0.94, width: 0.7, trackH: 0.13, deck: 0.15, fender: 0.095, notch: 0.075, glacis: 0.08, wheels: 6 });
  const top = 0.195;
  b.add(MAT.HOUSE, slab([[-0.1, deck - 0.01], [0.39, deck - 0.01], [0.31, top], [-0.07, top], [-0.1, top - 0.03]], 0.62, { c: 0.028 }));
  ringHatch(b, 'root', { p: [0.24, top, -0.17], r: 0.04, h: 0.014 });
  b.add(MAT.DARK, box(0.02, 0.018, 0.05, { p: [0.295, top + 0.008, -0.17], color: 0x0c0c16 }));
  // engine block: four ribs round three open slots running out through the tail
  for (const [z, w] of [[-0.232, 0.135], [-0.074, 0.112], [0.074, 0.112], [0.232, 0.135]]) b.add(MAT.HOUSE, cbox(0.3, 0.03, w, 0.01, { p: [-0.28, deck + 0.012, z] }));
  for (const z of [-0.148, 0, 0.148]) b.add(MAT.DARK, box(0.34, 0.012, 0.042, { p: [-0.29, deck + 0.004, z], color: 0x0c0c16 }));
  // corner outriggers: bracket, jack with a pale cap, foot pad
  for (const x of [-0.31, 0.3]) for (const s of [-1, 1]) {
    b.add(MAT.HOUSE, cbox(0.1, 0.05, 0.07, 0.012, { p: [x, deck - 0.02, s * (hw + 0.02)], color: RECESS }));
    b.add(MAT.METAL, cyl(0.02, 0.02, 0.13, 8, { p: [x, 0.11, s * (hw + 0.034)], color: PAL.machine }));
    b.add(MAT.METAL, cyl(0.027, 0.027, 0.026, 8, { p: [x, deck + 0.024, s * (hw + 0.034)], color: GUN }));
    b.add(MAT.METAL, cyl(0.024, 0.026, 0.012, 8, { p: [x, 0.044, s * (hw + 0.034)], color: PAL.navy }));
  }

  const tx = 0, R = 0.265, gy = 0.064;
  b.add(MAT.DARK, cyl(0.2, 0.2, 0.014, 20, { p: [tx, top + 0.004, 0], color: 0x0c0c16 }));   // turret ring, round so it stays hidden as the oval turret turns
  b.node('turret', { pivot: [tx, top, 0] });
  b.add(MAT.HOUSE, lathe([[R, 0], [R, 0.03], [R * 0.95, 0.066], [R * 0.8, 0.096], [R * 0.52, 0.114], [0, 0.12]], 20, { p: [-0.02, 0.006, 0], s: [0.78, 1, 1] }), 'turret');
  ringHatch(b, 'turret', { p: [0.0, 0.106, 0], r: 0.085, h: 0.026, lid: false });   // the sight: the sprite's cyan eye
  b.add(MAT.METAL, dome(0.036, 12, { p: [0.0, 0.114, 0], s: [1, 0.8, 1], color: GUN }), 'turret');
  for (const s of [-1, 1]) b.add(MAT.DARK, cbox(0.07, 0.03, 0.035, 0.008, { p: [0.02, 0.08, s * 0.2], r: [s * 0.5, 0, 0], color: 0x0c0c16 }), 'turret');
  b.add(MAT.METAL, cbox(0.08, 0.072, 0.34, 0.016, { p: [0.19, gy, 0], color: PAL.navy }), 'turret');   // the bridge carrying both guns
  b.add(MAT.HOUSE, cbox(0.1, 0.03, 0.16, 0.01, { p: [-0.21, 0.035, 0], color: SHADE }), 'turret');
  b.add(MAT.METAL, cyl(0.004, 0.004, 0.2, 4, { p: [-0.15, 0.2, -0.13], color: PAL.gunmetal }), 'turret');

  b.node('barrel', { parent: 'turret', pivot: [0.22, gy, 0], axis: 'x', kind: 'trans' });
  const len = 0.46, pitch = 0.14, tip = [tx + 0.22 + len * Math.cos(pitch), top + gy + len * Math.sin(pitch)];
  for (const s of [-1, 1]) barrel(b, 'barrel', { len, z: s * 0.12, r: 0.026, brake: 0.038, pitch });
  return b.build({ radius: 0.62, muzzle: [tip[0], tip[1], 0], muzzles: [[tip[0], tip[1], -0.12], [tip[0], tip[1], 0.12]] });
}
