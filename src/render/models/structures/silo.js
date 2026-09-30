// Spice Silo (2x2), after the Genesis sprite: on the olive foundation, a low navy tank plinth with a
// lavender lip, cut back in the south-west corner where the house orb stands; on it two squat lavender
// storage tanks set diagonally (north-west and south-east), each roofed with a raised rim, a navy gutter
// and a white dome, with a latch box on its east side, seams, stiffener bands, a spice gauge and a ladder
// on the south; a manifold of six valve balls in the north-east; and two combs of pointed radiator fins
// at the edges of the corner cut.
import * as THREE from 'three';
import { ModelBuilder, MAT, box, cbox, cyl, sphere, lathe, ring, prism, shape } from '../kit.js';
import { PAL } from '../palette.js';
import { foundation, FOUNDATION_TOP as T, houseOrb, ladder, pipe } from '../detail.js';

const P = T + 0.14;   // plinth top
const TANK_H = 0.4;

/** A plan outline of [x, z] points extruded up from the foundation by h; the chamfer c grows it outward. */
function plinth(outline, h, c, color) {
  const s = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * c, bevelEnabled: true, bevelSize: c, bevelThickness: c, bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, c);
  return shape(g, { p: [0, T, 0], r: [-Math.PI / 2, 0, 0], color });
}

function tank(b, x, z, r) {
  const top = P + TANK_H;
  b.add(MAT.PAINT, cyl(r, r + 0.01, TANK_H, 24, { p: [x, P + TANK_H / 2, z], color: PAL.machine }));
  for (const y of [P + 0.03, P + 0.21]) b.add(MAT.METAL, cyl(r + 0.012, r + 0.012, 0.025, 24, { p: [x, y, z], color: PAL.machineDark }));
  const seams = [];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + 0.13; seams.push(box(0.008, TANK_H - 0.06, 0.012, { p: [x + Math.cos(a) * (r + 0.003), P + TANK_H / 2, z + Math.sin(a) * (r + 0.003)], r: [0, -a, 0], color: PAL.machineDark })); }
  b.add(MAT.PAINT, seams);
  // roof: raised rim, navy gutter, white dome with a hatch
  b.add(MAT.PAINT, ring(r + 0.012, r - 0.06, 0.035, 24, { p: [x, top, z], color: PAL.machineLight }));
  b.add(MAT.DARK, cyl(r - 0.055, r - 0.055, 0.02, 24, { p: [x, top + 0.01, z], color: PAL.navy }));
  b.add(MAT.PAINT, ring(r * 0.7, r * 0.6, 0.022, 24, { p: [x, top + 0.01, z], color: PAL.machineLight }));
  b.add(MAT.PAINT, lathe([[r * 0.66, 0], [r * 0.64, 0.03], [r * 0.52, 0.06], [r * 0.3, 0.078], [0, 0.084]], 24, { p: [x, top + 0.012, z], color: PAL.white }));
  b.add(MAT.METAL, cyl(0.05, 0.055, 0.025, 12, { p: [x - r * 0.15, top + 0.09, z - r * 0.12], color: PAL.machineLight }));
  // latch box on the east rim
  b.add(MAT.PAINT, cbox(0.07, 0.1, 0.12, 0.012, { p: [x + r + 0.03, top - 0.05, z], color: PAL.machineLight }));
  b.add(MAT.DARK, box(0.02, 0.06, 0.07, { p: [x + r + 0.066, top - 0.05, z], color: PAL.navy }));
  // spice gauge and ladder on the south
  const ga = Math.PI / 2 - 0.35, gx = x + Math.cos(ga) * (r + 0.004), gz = z + Math.sin(ga) * (r + 0.004);
  b.add(MAT.DARK, box(0.05, TANK_H - 0.12, 0.012, { p: [gx, P + TANK_H / 2, gz], r: [0, -ga + Math.PI / 2, 0], color: PAL.navy }));
  b.add(MAT.LIGHT, box(0.028, (TANK_H - 0.14) * 0.55, 0.012, { p: [gx + Math.cos(ga) * 0.003, P + 0.07 + (TANK_H - 0.14) * 0.275, gz + Math.sin(ga) * 0.003], r: [0, -ga + Math.PI / 2, 0], color: PAL.grille, glow: 0.9 }));
  const la = Math.PI / 2 + 0.55;
  ladder(b, { h: TANK_H + 0.04, at: { p: [x + Math.cos(la) * (r + 0.03), P, z + Math.sin(la) * (r + 0.03)], r: [0, -la + Math.PI / 2, 0] }, color: PAL.machineDark });
}

/** A comb of gabled radiator fins on the plinth, white along their peaks, on a navy footing. */
function fins(b, x, z, heights) {
  const w = 0.07, gap = 0.088, x0 = x - ((heights.length - 1) * gap) / 2;
  b.add(MAT.PAINT, cbox(gap * heights.length + 0.02, 0.03, 0.07, 0.008, { p: [x, P + 0.015, z], color: PAL.navyLight }));
  heights.forEach((h, i) => {
    const fx = x0 + i * gap;
    b.add(MAT.PAINT, prism([[-w / 2, 0], [w / 2, 0], [w / 2, h * 0.7], [0, h], [-w / 2, h * 0.7]], 0.05, { p: [fx, P + 0.03, z], color: PAL.machine }));
    b.add(MAT.PAINT, prism([[-0.014, h * 0.9], [0.014, h * 0.9], [0.017, h * 0.93], [0, h + 0.006], [-0.017, h * 0.93]], 0.054, { p: [fx, P + 0.03, z], color: PAL.white }));
  });
}

export function silo() {
  const b = new ModelBuilder('silo');
  foundation(b, 2, 2);

  // navy plinth with its lavender lip, cut back in the south-west corner
  const L = [[-0.875, -0.875], [0.84, -0.875], [0.84, 0.84], [-0.5, 0.84], [-0.5, 0.47], [-0.875, 0.47]];
  b.add(MAT.PAINT, plinth(L, P - T, 0.02, PAL.navy));
  L.forEach((a, i) => {
    const c = L[(i + 1) % L.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]) + 0.04, along = a[1] === c[1];
    b.add(MAT.PAINT, cbox(along ? len : 0.045, 0.03, along ? 0.045 : len, 0.01, { p: [(a[0] + c[0]) / 2, P + 0.012, (a[1] + c[1]) / 2], color: PAL.machineLight }));
  });
  // quiet panel lines and a hatch on the south and east faces of the plinth
  for (const x of [-0.1, 0.35]) b.add(MAT.DARK, box(0.012, P - T - 0.05, 0.01, { p: [x, T + (P - T) / 2 - 0.005, 0.862], color: 0x10102a }));
  b.add(MAT.DARK, cbox(0.2, 0.08, 0.02, 0.008, { p: [0.6, T + 0.05, 0.86], color: PAL.navyLight }));
  for (const z of [-0.4, 0.1]) b.add(MAT.DARK, box(0.01, P - T - 0.05, 0.012, { p: [0.862, T + (P - T) / 2 - 0.005, z], color: 0x10102a }));

  tank(b, -0.4, -0.4, 0.385);
  tank(b, 0.09, 0.34, 0.385);

  // valve manifold: six balls on collars in the north-east, a pipe along their foot
  for (const [x, z] of [[0.33, -0.69], [0.58, -0.69], [0.33, -0.44], [0.58, -0.44], [0.58, -0.19], [0.58, 0.06]]) {
    b.add(MAT.METAL, cyl(0.045, 0.05, 0.03, 10, { p: [x, P + 0.015, z], color: PAL.machineDark }));
    b.add(MAT.PAINT, sphere(0.065, 12, { p: [x, P + 0.075, z], color: PAL.machineLight }));
  }
  pipe(b, [[0.72, P + 0.03, -0.69], [0.72, P + 0.03, 0.06]], { r: 0.022, color: PAL.machine, flangeColor: PAL.machineDark });
  for (const z of [-0.69, -0.44, -0.19, 0.06]) b.add(MAT.METAL, cyl(0.012, 0.012, 0.14, 6, { p: [0.65, P + 0.03, z], r: [0, 0, Math.PI / 2], color: PAL.machine }));

  // radiator fins either side of the corner cut
  fins(b, -0.69, 0.36, [0.25, 0.3, 0.27, 0.21]);
  fins(b, -0.3, 0.75, [0.3, 0.25, 0.2]);

  houseOrb(b, -0.75, T, 0.75);
  return b.build({ radius: 1.0 });
}
