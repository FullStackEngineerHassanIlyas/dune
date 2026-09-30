// House of IX (2x2). The Genesis port has no IX, so this follows the Genesis-style proposal
// (docs/research/raw/visual-structures.md §2.13): the PC building's three stepped blue domes in Genesis
// colours on the olive foundation. North-west, north-east and south, each dome rises in saucer tiers
// from a slate plinth, the tiers blue with cyan lips and navy gaps, green lights round the middle
// tiers, a glassy crown and a white antenna fork. Navy conduits with lavender rails link the plinths, a
// hatch with a blue light opens in the south dome toward the camera, a lavender console with a whip
// antenna stands in the open south-east, bevelled white blocks sit in the north-west, north-east and
// south-east corners, and the house orb in the south-west.
import { ModelBuilder, MAT, box, cbox, cyl, sphere, dome, torus, hull, tube, place, lathe } from '../kit.js';
import { PAL } from '../palette.js';
import { foundation, FOUNDATION_TOP as T, houseOrb, bolts, rod, louvres } from '../detail.js';

const SLATE = 0x3a4180, BLUE_DEEP = 0x0a2c96, BLUE = 0x004ade, BLUE_LIGHT = 0x1a6af7, CYAN = 0x00e0ff, NAVY = 0x1f2558;

/** A stepped dome of base radius R and height H (to the crown) centred on (x, z). */
function steppedDome(b, x, z, R, H) {
  const k = H / 0.56;
  const tiers = [[1, 0.1, SLATE], [0.8, 0.11, BLUE_DEEP], [0.62, 0.1, BLUE], [0.44, 0.09, BLUE_LIGHT]];
  let y = T;
  tiers.forEach(([f, h, color], i) => {
    const r = R * f, hh = h * k;
    b.add(MAT.PAINT, lathe([[0, 0], [r * 0.93, 0], [r, hh * 0.3], [r * 0.98, hh * 0.62], [r * 0.9, hh], [0, hh]], 28, { p: [x, y, z], color }));
    b.add(MAT.PAINT, cyl(r * 0.95, r * 0.95, 0.018, 28, { p: [x, y + hh + 0.009, z], color: i ? BLUE_LIGHT : SLATE }));
    b.add(MAT.METAL, torus(r * 0.95, 0.009, 4, 28, { p: [x, y + hh + 0.012, z], r: [Math.PI / 2, 0, 0], color: i ? CYAN : PAL.machineLight }));
    if (i === 1 || i === 2) {
      const n = i === 1 ? 10 : 8;
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + i * 0.3, rr = r * 1.004;
        b.add(MAT.LIGHT, box(0.024, 0.016, 0.012, { p: [x + Math.cos(a) * rr, y + hh * 0.46, z + Math.sin(a) * rr], r: [0, -a + Math.PI / 2, 0], color: PAL.greenGlow, glow: 1.4 }));
      }
    }
    y += hh + 0.018;
    if (i < tiers.length - 1) { b.add(MAT.DARK, cyl(R * tiers[i + 1][0] * 0.92, R * tiers[i + 1][0] * 0.92, 0.02, 24, { p: [x, y + 0.01, z], color: NAVY })); y += 0.02; }
  });
  const cr = R * 0.3;
  b.add(MAT.GLASS, dome(cr, 20, { p: [x, y, z], s: [1, 0.8, 1], color: 0x2a8cff }));
  b.add(MAT.LIGHT, sphere(0.018, 6, { p: [x - cr * 0.45, y + cr * 0.6, z - cr * 0.4], color: 0xe0ffff, glow: 1.3 }));
  const top = y + cr * 0.8, tip = top + 0.16;
  b.add(MAT.PAINT, cyl(0.025, 0.035, 0.03, 8, { p: [x, top + 0.01, z], color: PAL.white }));
  b.add(MAT.PAINT, [rod([x, top, z], [x, tip, z], 0.009, 5, { color: PAL.white }), ...[-1, 1].map((s) => rod([x, top + 0.06, z], [x + s * 0.04, tip - 0.03, z + s * 0.012], 0.006, 4, { color: PAL.white }))]);
  b.add(MAT.LIGHT, sphere(0.013, 6, { p: [x, tip + 0.006, z], color: 0xe0ffff, glow: 1.6 }));
  const studs = [];
  for (let j = 0; j < 16; j++) { const a = (j / 16) * Math.PI * 2; studs.push([x + Math.cos(a) * R * 0.99, T + 0.05 * k, z + Math.sin(a) * R * 0.99]); }
  bolts(b, studs, { r: 0.012, h: 0.012, axis: 'y', color: PAL.machineLight, mat: MAT.PAINT });
}

/** A bevelled white block in a corner of the plate, its right angle in the corner (sx, sz give the corner). */
function cornerBlock(b, sx, sz) {
  const x = sx * 0.95, z = sz * 0.95, l = 0.27, cx = x - (sx * l) / 3, cz = z - (sz * l) / 3;
  const tri = [[x, z], [x - sx * l, z], [x, z - sz * l]];
  b.add(MAT.PAINT, hull([...tri.map(([u, v]) => [u, T, v]), ...tri.map(([u, v]) => [cx + (u - cx) * 0.5, T + 0.07, cz + (v - cz) * 0.5])], { color: PAL.white }));
}

export function houseOfIX() {
  const b = new ModelBuilder('houseOfIX');
  foundation(b, 2, 2);

  // navy conduits between the plinths, lavender rails on top
  const duct = (pts) => {
    b.add(MAT.PAINT, place(tube(pts, 0.07, 8, { color: NAVY }), { p: [0, T + 0.045, 0], s: [1, 0.6, 1] }));
    b.add(MAT.PAINT, tube(pts.map(([px, , pz]) => [px - 0.02, T + 0.087, pz]), 0.01, 4, { color: PAL.machineLight }));
  };
  duct([[-0.45, 0, -0.45], [0, 0, -0.38], [0.45, 0, -0.5]]);
  duct([[-0.45, 0, -0.45], [-0.3, 0, -0.05], [0, 0, 0.25]]);
  duct([[0.45, 0, -0.5], [0.34, 0, -0.1], [0, 0, 0.25]]);

  steppedDome(b, -0.45, -0.45, 0.36, 0.5);
  steppedDome(b, 0.45, -0.5, 0.39, 0.56);
  steppedDome(b, 0, 0.25, 0.43, 0.62);

  // hatch in the south dome's plinth, facing the camera
  const hz = 0.25 + 0.43 * 0.97;
  b.add(MAT.DARK, box(0.16, 0.1, 0.03, { p: [0, T + 0.05, hz], color: 0x0b0b1c }));
  b.add(MAT.PAINT, [box(0.2, 0.02, 0.04, { p: [0, T + 0.11, hz], color: PAL.machineLight }), ...[-1, 1].map((s) => box(0.02, 0.11, 0.04, { p: [s * 0.09, T + 0.055, hz], color: PAL.machineLight }))]);
  b.add(MAT.LIGHT, box(0.1, 0.018, 0.01, { p: [0, T + 0.075, hz + 0.017], color: 0x3ad8ff, glow: 1.3 }));

  // a lavender console in the open south-east corner: louvred top, a lamp and a whip antenna
  b.add(MAT.PAINT, cbox(0.2, 0.1, 0.14, 0.015, { p: [0.55, T + 0.05, 0.62], color: PAL.machine }));
  louvres(b, { w: 0.14, d: 0.09, n: 3, at: { p: [0.53, T + 0.1, 0.62] }, frame: PAL.machineDark, slats: PAL.machineLight });
  b.add(MAT.LIGHT, box(0.03, 0.02, 0.03, { p: [0.63, T + 0.11, 0.59], color: PAL.yellow, glow: 1.4 }));
  b.add(MAT.METAL, rod([0.62, T + 0.1, 0.66], [0.62, T + 0.36, 0.66], 0.006, 4, { color: PAL.machineLight }));
  b.add(MAT.LIGHT, sphere(0.014, 6, { p: [0.62, T + 0.365, 0.66], color: 0x3ad8ff, glow: 1.5 }));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1]]) cornerBlock(b, sx, sz);
  houseOrb(b, -0.75, T, 0.75);
  return b.build({ radius: 1.2 });
}
