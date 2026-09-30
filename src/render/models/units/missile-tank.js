// Missile Tank, after the Genesis sprite: a compact hull almost filled by the launcher rack, two long
// house-colour missile pods side by side with a dark gap between them and the white warheads of their
// top missiles showing at mid-hull, and the glossy round cab at the front. On the Genesis the rack is
// fixed; here it sits on a low traversing mount (the `turret`) and rides at a few degrees' elevation
// on the `launcher` trunnion, lying along the hull like the sprite's rack when at rest.
import { ModelBuilder, MAT, box, cbox, cyl, cone } from '../kit.js';
import { PAL } from '../palette.js';
import { launcherHull, launcherMount, ALONG, GUN } from './tank-chassis.js';

/** One launcher pod on the `launcher` node: house box ridged by its top tubes, 2 × 2 white warheads, dark back. */
function pod(b, z, { x0 = -0.16, x1 = 0.24, y = 0.05, w = 0.17, h = 0.1 } = {}) {
  const len = x1 - x0, cx = (x0 + x1) / 2;
  b.add(MAT.HOUSE, cbox(len, h, w, 0.016, { p: [cx, y, z] }), 'launcher');
  for (const dz of [-0.043, 0.043]) b.add(MAT.HOUSE, cyl(0.03, 0.03, len - 0.03, 10, { p: [cx - 0.01, y + h / 2 - 0.012, z + dz], r: ALONG }), 'launcher');
  b.add(MAT.DARK, box(0.008, h * 0.84, w * 0.86, { p: [x0 - 0.002, y, z], color: 0x0c0c16 }), 'launcher');
  for (const dy of [-0.025, 0.025]) for (const dz of [-0.043, 0.043]) {
    b.add(MAT.DARK, cyl(0.025, 0.025, 0.01, 10, { p: [x1 + 0.002, y + dy, z + dz], r: ALONG, color: 0x0c0c16 }), 'launcher');
    b.add(MAT.METAL, cyl(0.02, 0.02, 0.03, 8, { p: [x1 + 0.012, y + dy, z + dz], r: ALONG, color: GUN }), 'launcher');
    b.add(MAT.METAL, cone(0.02, 0.05, 8, { p: [x1 + 0.052, y + dy, z + dz], r: ALONG, color: GUN }), 'launcher');
  }
}

export function missileTank() {
  const b = new ModelBuilder('missileTank');
  const { deck } = launcherHull(b);
  const tx = -0.12, e = 0.1, yoke = launcherMount(b, { x: tx, deck, elevation: e, yoke: 0.092 });
  for (const s of [-1, 1]) pod(b, s * 0.12);
  b.add(MAT.METAL, cyl(0.016, 0.016, 0.3, 8, { r: [Math.PI / 2, 0, 0], color: PAL.machine }), 'launcher');   // trunnion axle through both pods
  const fx = 0.24 + 0.077, fy = 0.05, x = tx + fx * Math.cos(e) - fy * Math.sin(e), y = deck + yoke + fx * Math.sin(e) + fy * Math.cos(e);
  return b.build({ radius: 0.54, muzzle: [x, y, 0], muzzles: [[x, y, -0.12], [x, y, 0.12]] });
}
