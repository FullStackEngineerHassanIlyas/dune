// Light Factory (2x2): no Genesis art, so a cut-down sibling of the Genesis Vehicle Factory (the Heavy
// Factory), after the research proposal: the same lavender block with the square concentric-ring fan
// housing, blue slit lights, a finned north vent, three prongs on the west and a stepped stack on its
// short south leg, but no long pointed hall. A narrow annex stands in the north-east instead, and a
// gold jib crane (after the PC art) hangs its hook over the small open navy bay, where one trike
// stands on the line in front of the open doorway. The house orb sits in the south-west corner.
import { ModelBuilder, MAT, box, cbox, cyl, torus, hull } from '../kit.js';
import { PAL } from '../palette.js';
import { foundation, FOUNDATION_TOP as T, houseOrb, bolts, ladder, hazard, louvres, rod } from '../detail.js';
import { fanHousing, slitLight, prong, steppedStack, chassis } from './heavy-factory.js';

const WELL = 0x0b0b16;

export function lightFactory() {
  const b = new ModelBuilder('lightFactory');
  foundation(b, 2, 2);

  // main block: fan housing, slit lights, north vent, prongs
  b.add(MAT.PAINT, cbox(0.98, 0.42, 0.88, 0.025, { p: [-0.03, T + 0.21, -0.42], color: PAL.machine }));
  fanHousing(b, -0.05, -0.36, { w: 0.8, d: 0.64, r: 0.25, base: T + 0.42 });
  bolts(b, [[-0.41, T + 0.5, -0.64], [0.31, T + 0.5, -0.64], [-0.41, T + 0.5, -0.08], [0.31, T + 0.5, -0.08]], { r: 0.014, h: 0.012, color: PAL.machineDark });
  slitLight(b, -0.37, T + 0.42, -0.765);
  b.add(MAT.PAINT, box(0.46, 0.14, 0.08, { p: [0.02, T + 0.39, -0.88], color: PAL.navy }));
  for (let k = 0; k < 4; k++) b.add(MAT.PAINT, cbox(0.036, 0.1, 0.17, 0.008, { p: [-0.15 + k * 0.11, T + 0.44, -0.84], color: PAL.machineLight }));
  for (const z of [-0.7, -0.44, -0.18]) prong(b, -0.52, z, { len: 0.32 });
  b.add(MAT.DARK, box(0.14, 0.2, 0.012, { p: [-0.34, T + 0.1, -0.862], color: PAL.navy }));
  b.add(MAT.PAINT, box(0.17, 0.225, 0.008, { p: [-0.34, T + 0.112, -0.86], color: PAL.machineDark }));

  // short south leg with a slit light and the stepped, ribbed stack
  b.add(MAT.PAINT, cbox(0.5, 0.36, 0.5, 0.02, { p: [-0.27, T + 0.18, 0.24], color: PAL.machine }));
  slitLight(b, -0.3, T + 0.36, 0.2);
  b.add(MAT.PAINT, cbox(0.13, 0.014, 0.13, 0.004, { p: [-0.12, T + 0.365, 0.33], color: PAL.machineDark }));
  b.add(MAT.DARK, box(0.09, 0.006, 0.09, { p: [-0.12, T + 0.372, 0.33], color: PAL.navy }));
  b.add(MAT.METAL, box(0.05, 0.012, 0.01, { p: [-0.12, T + 0.378, 0.36], color: PAL.machineLight }));
  steppedStack(b, -0.27, 0.42, [[0.49, 0.63, 0.26], [0.63, 0.76, 0.16]], 0.36);

  // open doorway into the bay, its shutter rolled up on a drum
  b.add(MAT.DARK, box(0.34, 0.24, 0.01, { p: [0.24, T + 0.12, 0.022], color: WELL }));
  b.add(MAT.PAINT, [
    box(0.024, 0.26, 0.02, { p: [0.058, T + 0.13, 0.025], color: PAL.machineDark }),
    box(0.024, 0.26, 0.02, { p: [0.422, T + 0.13, 0.025], color: PAL.machineDark }),
    box(0.39, 0.024, 0.02, { p: [0.24, T + 0.25, 0.025], color: PAL.machineDark }),
  ]);
  b.add(MAT.METAL, cyl(0.035, 0.035, 0.36, 12, { p: [0.24, T + 0.3, 0.05], r: [0, 0, Math.PI / 2], color: PAL.machineLight }));
  for (const x of [0.06, 0.42]) b.add(MAT.PAINT, box(0.02, 0.07, 0.06, { p: [x, T + 0.3, 0.045], color: PAL.machineDark }));

  // north-east annex with a louvred roof and a ladder
  b.add(MAT.PAINT, cbox(0.28, 0.56, 0.62, 0.02, { p: [0.6, T + 0.28, -0.57], color: PAL.machine }));
  louvres(b, { w: 0.18, d: 0.3, n: 4, at: { p: [0.6, T + 0.56, -0.62] }, frame: PAL.machineDark, slats: PAL.machineLight });
  b.add(MAT.PAINT, box(0.26, 0.006, 0.018, { p: [0.6, T + 0.563, -0.855], color: PAL.white }));
  ladder(b, { h: 0.56, at: { p: [0.53, T, -0.25] } });
  b.add(MAT.PAINT, box(0.012, 0.44, 0.008, { p: [0.68, T + 0.26, -0.256], color: PAL.machineDark }));

  // navy bay with the trike on the line
  b.add(MAT.PAINT, box(0.78, 0.012, 1.02, { p: [0.37, T - 0.002, 0.25], color: PAL.navy }));
  b.add(MAT.PAINT, [
    box(0.012, 0.004, 0.72, { p: [0.12, T + 0.005, 0.38], color: PAL.navyLight }),
    box(0.03, 0.02, 1.02, { p: [0.745, T + 0.01, 0.25], color: PAL.machineDark }),
    box(0.78, 0.02, 0.03, { p: [0.37, T + 0.01, 0.755], color: PAL.machineDark }),
  ]);
  hazard(b, { w: 0.34, d: 0.04, n: 5, at: { p: [0.24, T + 0.004, 0.06] } });
  chassis(b, 0.33, 0.44, { l: 0.34, w: 0.26, trike: true });

  // gold jib crane: mast in the bay's north-east corner, jib over the trike, hook on a cable
  const mx = 0.63, mz = -0.13, top = T + 0.62, hx = 0.33, hz = 0.4;
  b.add(MAT.PAINT, cbox(0.14, 0.04, 0.14, 0.01, { p: [mx, T + 0.02, mz], color: PAL.brassDark }));
  b.add(MAT.PAINT, cbox(0.07, top - T, 0.07, 0.012, { p: [mx, (T + top) / 2, mz], color: PAL.gold }));
  for (let k = 0; k < 4; k++) b.add(MAT.METAL, rod([mx - 0.037, T + 0.06 + k * 0.13, mz + 0.037], [mx + 0.037, T + 0.13 + k * 0.13, mz + 0.037], 0.006, 4, { color: PAL.brassDark }));
  b.add(MAT.METAL, cyl(0.06, 0.06, 0.03, 12, { p: [mx, top + 0.015, mz], color: PAL.brassDark }));
  const a = Math.atan2(hz - mz, hx - mx), len = Math.hypot(hx - mx, hz - mz) + 0.06, back = 0.18;
  const jib = (d, y) => [mx + Math.cos(a) * d, y, mz + Math.sin(a) * d];
  const side = (p, s) => [p[0] - Math.sin(a) * s, p[1], p[2] + Math.cos(a) * s];
  b.add(MAT.PAINT, hull([side(jib(-back, top + 0.03), -0.03), side(jib(-back, top + 0.03), 0.03), side(jib(len, top + 0.03), -0.02), side(jib(len, top + 0.03), 0.02),
    side(jib(-back, top + 0.07), -0.03), side(jib(-back, top + 0.07), 0.03), side(jib(len, top + 0.05), -0.02), side(jib(len, top + 0.05), 0.02)], { color: PAL.gold }));
  b.add(MAT.METAL, rod(jib(0, top + 0.2), jib(len - 0.02, top + 0.06), 0.006, 4, { color: PAL.brassDark }));
  b.add(MAT.METAL, rod(jib(0, top + 0.2), jib(-back + 0.02, top + 0.07), 0.006, 4, { color: PAL.brassDark }));
  b.add(MAT.PAINT, cbox(0.03, 0.2, 0.03, 0.006, { p: jib(0, top + 0.12), color: PAL.gold }));
  b.add(MAT.PAINT, cbox(0.1, 0.08, 0.1, 0.012, { p: jib(-back + 0.03, top + 0.1), r: [0, -a, 0], color: PAL.machineDark }));
  const hook = jib(len - 0.04, 0);
  b.add(MAT.METAL, cyl(0.004, 0.004, top - T - 0.3, 4, { p: [hook[0], (top + T + 0.3) / 2 + 0.01, hook[2]], color: PAL.gunmetal }));
  b.add(MAT.PAINT, cbox(0.05, 0.04, 0.04, 0.008, { p: [hook[0], T + 0.3, hook[2]], color: PAL.brassDark }));
  b.add(MAT.METAL, torus(0.022, 0.006, 4, 10, { p: [hook[0], T + 0.26, hook[2]], color: PAL.steelDark }, Math.PI * 1.5));

  houseOrb(b, -0.75, T, 0.75);
  return b.build({ radius: 1.0 });
}
