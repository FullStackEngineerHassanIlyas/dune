// Deviator: on the Genesis the Missile Tank sprite in Ordos green. Here it keeps that family's hull,
// round cab and traversing mount, but the launcher carries one big nerve-gas missile instead of the
// two pods: a white body with a bulbous lime gas warhead, dark hazard rings and cruciform tail fins,
// clamped into a house-colour cradle with side rails, raised a little on its trunnion.
import { ModelBuilder, MAT, cbox, cyl, cone, lathe, hull } from '../kit.js';
import { PAL } from '../palette.js';
import { launcherHull, launcherMount, ALONG, GUN, RECESS } from './tank-chassis.js';

const GAS = 0xb4dc28;   // chemical lime of the warhead

export function deviator() {
  const b = new ModelBuilder('deviator');
  const { deck } = launcherHull(b);
  const tx = -0.12, e = 0.12, yoke = launcherMount(b, { x: tx, deck, elevation: e, yoke: 0.092 });
  // cradle: a floor plate and two side rails with ribs
  b.add(MAT.HOUSE, cbox(0.42, 0.03, 0.2, 0.01, { p: [0.03, 0.012, 0], color: RECESS }), 'launcher');
  for (const s of [-1, 1]) {
    b.add(MAT.HOUSE, cbox(0.44, 0.09, 0.035, 0.012, { p: [0.03, 0.055, s * 0.09] }), 'launcher');
    for (const x of [-0.12, 0.03, 0.18]) b.add(MAT.HOUSE, cbox(0.03, 0.105, 0.045, 0.008, { p: [x, 0.057, s * 0.095], color: RECESS }), 'launcher');
  }
  b.add(MAT.METAL, cyl(0.016, 0.016, 0.26, 8, { r: [Math.PI / 2, 0, 0], color: PAL.machine }), 'launcher');
  // the gas missile: body, warhead, nose, hazard rings, fins, clamps
  const my = 0.085, r = 0.052;
  b.add(MAT.METAL, cyl(r, r, 0.34, 14, { p: [-0.01, my, 0], r: ALONG, color: GUN }), 'launcher');
  b.add(MAT.PAINT, lathe([[r, 0], [r * 1.22, 0.03], [r * 1.24, 0.08], [r * 1.05, 0.12], [r * 0.6, 0.16], [0, 0.18]], 14, { p: [0.16, my, 0], r: ALONG, color: GAS }), 'launcher');
  b.add(MAT.METAL, cone(0.014, 0.03, 8, { p: [0.35, my, 0], r: ALONG, color: GUN }), 'launcher');
  for (const x of [0.165, 0.2]) b.add(MAT.METAL, cyl(r * 1.25, r * 1.25, 0.01, 14, { p: [x + 0.012, my, 0], r: ALONG, color: 0x1a1a12 }), 'launcher');
  b.add(MAT.METAL, cyl(r * 1.04, r * 0.8, 0.04, 14, { p: [-0.2, my, 0], r: ALONG, color: PAL.machine }), 'launcher');
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    b.add(MAT.METAL, hull([[-0.21, 0, 0.045], [-0.1, 0, 0.045], [-0.2, 0, 0.1], [-0.15, 0, 0.1], [-0.21, 0.004, 0.045], [-0.1, 0.004, 0.045], [-0.2, 0.004, 0.1], [-0.15, 0.004, 0.1]], { p: [0, my, 0], r: [a, 0, 0], color: PAL.machineLight }), 'launcher');
  }
  for (const x of [-0.08, 0.08]) b.add(MAT.METAL, cyl(r * 1.08, r * 1.08, 0.018, 14, { p: [x, my, 0], r: ALONG, color: PAL.navy }), 'launcher');
  const fx = 0.365, fy = my;
  return b.build({ radius: 0.54, muzzle: [tx + fx * Math.cos(e) - fy * Math.sin(e), deck + yoke + fx * Math.sin(e) + fy * Math.cos(e), 0] });
}
