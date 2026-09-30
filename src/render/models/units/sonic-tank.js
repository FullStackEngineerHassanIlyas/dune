// Sonic Tank, after the Genesis sprite: a Missile-Tank-sized hull carrying a wide dish across its
// front third (from above a white crescent rim round a dark mouth, facing forward and raised a few
// degrees), a lavender neck running back from its throat through a pivot collar, and the round
// resonator drum with its lit rim in the rear centre; four corner track nubs as on every tank.
import { ModelBuilder, MAT, cyl, lathe, torus, cone, cbox, sphere, place } from '../kit.js';
import { rod, louvres } from '../detail.js';
import { PAL } from '../palette.js';
import { tankHull, ringHatch, GUN, RECESS } from './tank-chassis.js';

export function sonicTank() {
  const b = new ModelBuilder('sonicTank');
  const { deck, hl } = tankHull(b, { length: 0.84, width: 0.64, trackW: 0.14, deck: 0.16, fender: 0.095, glacis: 0.09, nose: 0.125, notch: 0.065 });
  louvres(b, { w: 0.1, d: 0.3, n: 4, at: { p: [-hl + 0.085, deck, 0] }, frame: PAL.navy, slats: PAL.navyLight });
  // resonator drum: house cylinder, lit rim, dark core with a metal boss, cooling fins
  const rx = -0.14, rr = 0.125;
  b.add(MAT.HOUSE, cyl(rr, rr + 0.01, 0.07, 20, { p: [rx, deck + 0.035, 0] }));
  ringHatch(b, 'root', { p: [rx, deck + 0.07, 0], r: rr, h: 0.026, lid: false });
  b.add(MAT.METAL, cyl(0.045, 0.05, 0.03, 12, { p: [rx, deck + 0.08, 0], color: PAL.machineLight }));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    b.add(MAT.HOUSE, cbox(0.04, 0.05, 0.016, 0.005, { p: [rx + Math.cos(a) * (rr + 0.012), deck + 0.03, Math.sin(a) * (rr + 0.012)], r: [0, -a, 0], color: RECESS }));
  }
  // dish, built along +x from its throat and then raised: lavender shell, dark mouth, white rim, emitter
  const th = [0.3, deck + 0.11], pitch = 0.14, mouth = 0.1, squash = 0.62;
  const dish = { p: [th[0], th[1], 0], r: [0, 0, pitch] }, lie = [0, 0, -Math.PI / 2];
  const bell = [[0.04, -0.005], [0.1, 0.008], [0.15, 0.028], [0.185, 0.055], [0.203, 0.08], [0.208, mouth]];
  b.add(MAT.METAL, place(lathe(bell, 20, { r: lie, s: [squash, 1, 1], color: PAL.machine }), dish));
  b.add(MAT.DARK, place(lathe([...bell].reverse().map(([r, h]) => [r * 0.95, h + 0.004]), 20, { r: lie, s: [squash, 1, 1], color: 0x10101c }), dish));
  b.add(MAT.METAL, place(torus(0.205, 0.014, 6, 24, { p: [mouth, 0, 0], r: [0, Math.PI / 2, 0], s: [1, squash, 1], color: GUN }), dish));
  b.add(MAT.METAL, place([cyl(0.018, 0.026, 0.07, 8, { p: [0.03, 0, 0], r: lie, color: PAL.machineLight }), cone(0.026, 0.05, 8, { p: [0.09, 0, 0], r: lie, color: GUN })], dish));
  b.add(MAT.METAL, place(cyl(0.05, 0.05, 0.03, 10, { p: [-0.02, 0, 0], r: lie, color: PAL.navy }), dish));
  // pivot housing with its lit rim, the stout neck up to the dish throat, a conduit back to the drum
  const px = 0.11;
  b.add(MAT.HOUSE, lathe([[0.08, 0], [0.08, 0.035], [0.066, 0.05], [0.036, 0.055]], 14, { p: [px, deck, 0] }));
  b.add(MAT.METAL, cyl(0.04, 0.046, 0.03, 12, { p: [px, deck + 0.065, 0], color: PAL.navy }));
  b.add(MAT.METAL, rod([px, deck + 0.06, 0], [th[0] - 0.03, th[1] - 0.004, 0], 0.036, 10, { color: PAL.machine }));
  b.add(MAT.METAL, sphere(0.042, 10, { p: [th[0] - 0.03, th[1] - 0.004, 0], color: PAL.machineLight }));
  for (const s of [-1, 1]) b.add(MAT.METAL, rod([px - 0.02, deck + 0.02, s * 0.06], [th[0] - 0.05, th[1] - 0.03, s * 0.03], 0.012, 6, { color: PAL.machineLight }));
  b.add(MAT.METAL, rod([rx + 0.06, deck + 0.075, 0], [px - 0.05, deck + 0.035, 0], 0.022, 8, { color: PAL.machine }));
  const m = [th[0] + Math.cos(pitch) * mouth, th[1] + Math.sin(pitch) * mouth];
  return b.build({ radius: 0.54, muzzle: [m[0], m[1], 0] });
}
