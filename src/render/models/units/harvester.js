// Spice Harvester: wedge-shaped armoured hopper on wide tracks, cab, exhaust and a spinning intake drum.
import { ModelBuilder, MAT, box, rbox, cyl, prism } from '../kit.js';
import { PAL } from '../palette.js';
import { tankChassis } from './tank-chassis.js';

export function harvester() {
  const b = new ModelBuilder('harvester');
  const { top } = tankChassis(b, { length: 0.8, width: 0.58, hull: 0.08, trackW: 0.14, trackH: 0.13, stripe: false });
  b.add(MAT.PAINT, prism([[-0.4, top - 0.02], [0.24, top - 0.02], [0.4, top + 0.1], [0.3, top + 0.3], [-0.36, top + 0.3], [-0.42, top + 0.22]], 0.52, { color: PAL.sand }));
  b.add(MAT.DARK, box(0.5, 0.012, 0.36, { p: [-0.06, top + 0.305, 0], color: PAL.gunmetal }));
  for (const z of [-0.262, 0.262]) b.add(MAT.HOUSE, prism([[-0.3, top + 0.06], [0.2, top + 0.06], [0.27, top + 0.16], [0.2, top + 0.24], [-0.3, top + 0.24]], 0.012, { p: [0, 0, z] }));
  b.add(MAT.PAINT, rbox(0.14, 0.1, 0.16, 0.02, { p: [0.2, top + 0.34, 0.14], color: PAL.sandLight }));
  b.add(MAT.GLASS, box(0.02, 0.05, 0.12, { p: [0.275, top + 0.35, 0.14], color: PAL.glass }));
  b.add(MAT.METAL, cyl(0.018, 0.018, 0.14, 6, { p: [-0.3, top + 0.37, -0.18], color: PAL.steelDark }));
  b.node('drum', { pivot: [0.42, 0.11, 0], axis: 'z' });
  b.add(MAT.METAL, cyl(0.07, 0.07, 0.46, 12, { r: [Math.PI / 2, 0, 0], color: PAL.steel }), 'drum');
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.add(MAT.DARK, box(0.03, 0.02, 0.46, { p: [Math.cos(a) * 0.075, Math.sin(a) * 0.075, 0], r: [0, 0, a], color: PAL.gunmetal }), 'drum');
  }
  return b.build({ radius: 0.48 });
}
