// Spice Refinery (3x2), after the Genesis sprite: on the olive foundation, a navy header pipe along the
// north edge, elbowing down at its west end; three round centrifuges with radial fins and orange grilles
// down the west third, backed by a navy conduit that runs from the header to the processing machine,
// with valve knobs, a lamp console and a junction box beside them; a long ribbed storage cylinder on
// saddles in the north-east, tied up to the header, and a cable reel at its end; the gabled lavender
// processing machine with its single blue eye, white corner glint and arched door, three feed rams on
// its south face joined by a pipe that loops round from the last centrifuge; and the lavender docking
// pad in the east column with its cross of recessed sockets and corner triangles, where a Harvester
// drives in from the entrance south of it to unload. Amber chevrons point in from the corners and a
// centre pair glows (`padLights`: they converge on the pad while a Harvester is due and pulse while
// one unloads). While it unloads the refinery works (research: structures.md, the busy animation):
// the centrifuge rotors spin (`spin`), the feed rams pump (`ram`) and spice glows in the chute from
// the pad into the machine (`flow`, hidden at rest). The house orb sits in the south-west corner.
import { ModelBuilder, MAT, box, cbox, cyl, sphere, torus, hull, prism, ring } from '../kit.js';
import { PAL } from '../palette.js';
import { foundation, FOUNDATION_TOP as T, houseOrb, pipe, roundGrille, bolts, ladder, rod, halfArc } from '../detail.js';

const AMBER = PAL.amber, REEL = 0x6e3a10, SOCKET = 0x404020;

/** A round centrifuge housing: drum, rim, a rotor of twelve radial fins and a paddle cross (node `spin${i}`) round an orange grille, bolts. */
function centrifuge(b, x, z, i) {
  const r = 0.235, h = 0.2, top = T + h, rotor = `spin${i}`;
  b.add(MAT.PAINT, cyl(r, r + 0.012, h, 24, { p: [x, T + h / 2, z], color: PAL.machine }));
  b.add(MAT.PAINT, ring(r + 0.008, r - 0.035, 0.022, 24, { p: [x, top, z], color: PAL.machineLight }));
  b.add(MAT.DARK, cyl(r - 0.035, r - 0.035, 0.01, 24, { p: [x, top - 0.004, z], color: PAL.navy }));
  b.node(rotor, { pivot: [x, top, z], axis: 'y', kind: 'rot', param: 'spin' });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    b.add(MAT.PAINT, box(0.09, 0.03, 0.018, { p: [Math.cos(a) * 0.15, 0.008, Math.sin(a) * 0.15], r: [0, -a, 0], color: PAL.machineLight }), rotor);
  }
  b.add(MAT.PAINT, [box(0.2, 0.016, 0.026, { p: [0, 0.02, 0], color: PAL.grille }), box(0.026, 0.016, 0.2, { p: [0, 0.02, 0], color: PAL.grille })], rotor);
  roundGrille(b, { r: 0.1, n: 5, at: { p: [x, top + 0.004, z] }, rim: PAL.machineDark });
  const studs = [];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; studs.push([x + Math.cos(a) * (r + 0.004), T + h * 0.35, z + Math.sin(a) * (r + 0.004)]); }
  bolts(b, studs, { r: 0.012, axis: 'y', h: h * 0.5, color: PAL.machineDark });
}

/** A recessed pad socket as the sprite draws it: black rim to the north-west, white to the south-east, olive well. */
function socket(b, x, y, z, r) {
  b.add(MAT.DARK, cyl(r, r, 0.006, 16, { p: [x, y + 0.003, z], color: 0x08080c }));
  b.add(MAT.PAINT, cyl(r * 0.88, r * 0.88, 0.008, 16, { p: [x + r * 0.08, y + 0.004, z + r * 0.08], color: PAL.white }));
  b.add(MAT.DARK, cyl(r * 0.72, r * 0.72, 0.01, 16, { p: [x - r * 0.06, y + 0.005, z - r * 0.06], color: SOCKET }));
}

/** A flat right triangle on the pad, its right angle toward the pad centre (sx, sz pick the corner). */
const corner = (x, y, z, sx, sz, e, h, o) => hull([[x - sx * e, z - sz * e], [x + sx * e, z - sz * e], [x - sx * e, z + sz * e]].flatMap(([u, v]) => [[u, y, v], [u, y + h, v]]), o);

export function refinery() {
  const b = new ModelBuilder('refinery');
  foundation(b, 3, 2);

  // navy header pipe along the north edge on posts, elbowing down at the west end, a drop into the first centrifuge
  const py = 0.28, pz = -0.87;
  pipe(b, [[1.22, py, pz], [-1.15, py, pz], [-1.2, py - 0.05, pz + 0.05], [-1.2, T + 0.02, pz + 0.1]], { r: 0.06, seg: 10, color: PAL.navyLight, flangeColor: PAL.machineLight });
  pipe(b, [[-0.64, py, pz], [-0.64, py - 0.02, -0.8], [-0.64, T + 0.2, -0.74]], { r: 0.035, color: PAL.navyLight, flanges: 'none' });
  for (const x of [-0.95, 0.1, 1.05]) b.add(MAT.PAINT, cbox(0.07, py - T, 0.09, 0.012, { p: [x, T + (py - T) / 2, pz], color: PAL.machineDark }));
  for (const x of [-0.3, 0.45]) b.add(MAT.METAL, cyl(0.07, 0.07, 0.03, 10, { p: [x, py, pz], r: [0, 0, Math.PI / 2], color: PAL.machine }));

  // navy conduit from the header down the east side of the centrifuges into the machine
  b.add(MAT.PAINT, cbox(0.17, 0.22, 0.66, 0.025, { p: [-0.39, T + 0.11, -0.53], color: PAL.navy }));
  for (const z of [-0.72, -0.52, -0.32]) b.add(MAT.PAINT, box(0.176, 0.03, 0.02, { p: [-0.39, T + 0.2, z], color: PAL.navyLight }));

  [-0.66, -0.16, 0.34].forEach((z, i) => centrifuge(b, -0.64, z, i));

  // valve knobs, lamp console and a junction box on the west edge
  for (const z of [-0.67, -0.43]) {
    b.add(MAT.METAL, cyl(0.02, 0.025, 0.12, 8, { p: [-1.19, T + 0.06, z], color: PAL.machineDark }));
    b.add(MAT.PAINT, sphere(0.058, 12, { p: [-1.19, T + 0.15, z], color: PAL.machineLight }));
    b.add(MAT.METAL, torus(0.05, 0.008, 4, 12, { p: [-1.19, T + 0.13, z], r: [Math.PI / 2, 0, 0], color: PAL.machineDark }));
  }
  b.add(MAT.PAINT, cbox(0.18, 0.12, 0.2, 0.02, { p: [-1.39, T + 0.13, -0.39], color: PAL.machine }));
  for (const [x, z] of [[-1.45, -0.46], [-1.33, -0.46], [-1.45, -0.32], [-1.33, -0.32]]) b.add(MAT.METAL, cyl(0.012, 0.012, 0.07, 6, { p: [x, T + 0.035, z], color: PAL.machineDark }));
  for (const z of [-0.44, -0.34]) b.add(MAT.LIGHT, box(0.05, 0.02, 0.04, { p: [-1.39, T + 0.195, z], color: PAL.orangeGlow, glow: 1.4 }));
  b.add(MAT.METAL, cyl(0.006, 0.006, 0.2, 4, { p: [-1.45, T + 0.29, -0.46], color: PAL.gunmetal }));
  b.add(MAT.PAINT, cbox(0.14, 0.12, 0.2, 0.015, { p: [-0.97, T + 0.06, -0.12], color: PAL.navy }));
  b.add(MAT.METAL, rod([-0.9, T + 0.07, -0.12], [-0.86, T + 0.07, -0.14], 0.03, 8, { color: PAL.navyLight }));

  // storage cylinder on saddles, tied up to the header, a ladder and a cable reel at its east end
  const cx = 0.49, cy = T + 0.19, cz = -0.57, len = 1.2, cr = 0.11;
  const along = [0, 0, Math.PI / 2];
  b.add(MAT.PAINT, cyl(cr, cr, len, 20, { p: [cx, cy, cz], r: along, color: PAL.machineLight }));
  for (const s of [-1, 1]) {
    b.add(MAT.PAINT, sphere(cr, 16, { p: [cx + s * len / 2, cy, cz], s: [0.45, 1, 1], color: PAL.machineLight }));
    b.add(MAT.METAL, cyl(cr + 0.015, cr + 0.015, 0.035, 20, { p: [cx + s * (len / 2 - 0.03), cy, cz], r: along, color: PAL.navyLight }));
  }
  for (const dx of [-0.3, 0, 0.3]) b.add(MAT.METAL, cyl(cr + 0.006, cr + 0.006, 0.018, 20, { p: [cx + dx, cy, cz], r: along, color: PAL.machine }));
  for (const x of [0.09, 0.34, 0.59, 0.84]) {
    b.add(MAT.PAINT, prism([[-0.05, 0], [0.05, 0], [0.04, 0.12], [-0.04, 0.12]], 0.26, { p: [x, T, cz], color: PAL.navy }));
    b.add(MAT.METAL, rod([x, cy + 0.09, cz - 0.07], [x, py - 0.02, pz + 0.04], 0.014, 6, { color: PAL.machine }));
  }
  ladder(b, { h: cy + cr - T, at: { p: [cx + 0.5, T, cz + cr + 0.03] } });
  const rx = 1.34, ry = T + 0.12;
  for (const z of [-0.68, -0.4]) b.add(MAT.PAINT, cyl(0.1, 0.1, 0.03, 16, { p: [rx, ry, z], r: [Math.PI / 2, 0, 0], color: REEL }));
  b.add(MAT.PAINT, cyl(0.065, 0.065, 0.26, 14, { p: [rx, ry, -0.54], r: [Math.PI / 2, 0, 0], color: PAL.machineLight }));
  b.add(MAT.PAINT, cyl(0.068, 0.068, 0.05, 14, { p: [rx, ry, -0.54], r: [Math.PI / 2, 0, 0], color: PAL.white }));
  for (const z of [-0.68, -0.4]) b.add(MAT.PAINT, hull([[rx - 0.07, T, z - 0.015], [rx + 0.07, T, z - 0.015], [rx - 0.07, T, z + 0.015], [rx + 0.07, T, z + 0.015], [rx, ry, z - 0.015], [rx, ry, z + 0.015]], { color: 0x4a2100 }));

  // processing machine: navy body, gabled lavender housing (lit west slope, dark east slope) and east shoulder
  const x0 = -0.35, x1 = 0.2, z0 = -0.24, z1 = 0.46, xr = -0.03, y0 = T + 0.14, ye = T + 0.38, yr = T + 0.56;
  b.add(MAT.PAINT, cbox(0.8, 0.14, 0.78, 0.02, { p: [-0.08, T + 0.07, 0.13], color: PAL.navy }));
  for (const [a, c, color] of [[x0, xr, PAL.machine], [xr, x1, PAL.navyLight]]) {
    const out = a === x0 ? a : c;
    b.add(MAT.PAINT, hull([
      [a, y0, z0], [c, y0, z0], [a, y0, z1], [c, y0, z1],
      [out, ye, z0 + 0.03], [out, ye, z1], [xr, ye, z0], [xr, yr, z1], [xr, yr, z0 + 0.18],
    ], { color }));
  }
  b.add(MAT.PAINT, hull([[x0, ye, z0 + 0.03], [x0 + 0.1, ye, z0 + 0.03], [x0, ye, z0 + 0.12], [x0 + 0.05, ye + 0.06, z0 + 0.07]], { color: PAL.white }));
  b.add(MAT.PAINT, cbox(0.13, 0.3, 0.66, 0.02, { p: [0.265, T + 0.15, 0.12], color: PAL.navy }));
  b.add(MAT.PAINT, cbox(0.1, 0.02, 0.6, 0.008, { p: [0.265, T + 0.305, 0.12], color: PAL.navyLight }));
  // south face: blue eye in the gable, band, white trim, arched door
  b.add(MAT.DARK, box(0.13, 0.12, 0.012, { p: [-0.06, T + 0.43, z1 + 0.002], color: PAL.navy }));
  b.add(MAT.LIGHT, box(0.1, 0.09, 0.012, { p: [-0.06, T + 0.43, z1 + 0.006], color: 0x0a4ade, glow: 1.3 }));
  b.add(MAT.LIGHT, box(0.04, 0.035, 0.012, { p: [-0.08, T + 0.445, z1 + 0.01], color: 0x40ffff, glow: 1.3 }));
  b.add(MAT.DARK, box(x1 - x0 + 0.01, 0.022, 0.012, { p: [(x0 + x1) / 2, T + 0.34, z1 + 0.003], color: PAL.navy }));
  b.add(MAT.PAINT, box(0.022, 0.22, 0.012, { p: [-0.22, T + 0.24, z1 + 0.004], color: PAL.white }));
  b.add(MAT.DARK, prism(halfArc(0.065, 0.19, 10), 0.03, { p: [0.08, y0, z1], color: 0x0c0c16 }));
  b.add(MAT.PAINT, prism(halfArc(0.085, 0.21, 10), 0.02, { p: [0.08, y0, z1 - 0.004], color: PAL.machineLight }));
  // roof: vent stack on the dark slope, duct in from the conduit
  b.add(MAT.METAL, cyl(0.035, 0.045, 0.16, 10, { p: [0.08, T + 0.53, -0.02], color: PAL.gunmetal }));
  b.add(MAT.METAL, ring(0.05, 0.03, 0.02, 10, { p: [0.08, T + 0.61, -0.02], color: PAL.machineDark }));
  b.add(MAT.PAINT, hull([[-0.47, T + 0.14, -0.3], [-0.31, T + 0.14, -0.3], [-0.47, T + 0.22, -0.3], [-0.31, T + 0.22, -0.3], [-0.47, T + 0.14, -0.1], [-0.31, T + 0.14, -0.1], [-0.47, T + 0.3, -0.18], [-0.34, T + 0.36, -0.18]], { color: PAL.navy }));

  // feed rams on the south face (their piston rods and heads pump on `ram`), joined by a pipe that loops round from the last centrifuge
  b.node('ram', { pivot: [0, T, z1], axis: 'z', kind: 'trans' });
  for (const x of [-0.3, -0.07, 0.14]) {
    b.add(MAT.PAINT, cyl(0.04, 0.04, 0.2, 10, { p: [x, T + 0.075, z1 + 0.12], r: [Math.PI / 2, 0, 0], color: PAL.machine }));
    b.add(MAT.PAINT, cyl(0.048, 0.048, 0.03, 10, { p: [x, T + 0.075, z1 + 0.23], r: [Math.PI / 2, 0, 0], color: PAL.white }));
    b.add(MAT.METAL, cyl(0.018, 0.018, 0.12, 8, { p: [x, 0.075, 0.3], r: [Math.PI / 2, 0, 0], color: PAL.steel }), 'ram');
    b.add(MAT.PAINT, cbox(0.08, 0.06, 0.03, 0.008, { p: [x, 0.06, 0.37], color: PAL.white }), 'ram');
    b.add(MAT.PAINT, cbox(0.07, 0.035, 0.05, 0.008, { p: [x, T + 0.0175, z1 + 0.12], color: PAL.machineDark }));
  }
  pipe(b, [[-0.64, T + 0.12, 0.58], [-0.6, T + 0.13, 0.68], [-0.5, T + 0.14, 0.72], [0.2, T + 0.14, 0.72]], { r: 0.026, color: 0xd6d3e2, flangeColor: PAL.machineLight, mat: MAT.PAINT });

  // spice chute from the pad's west edge into the machine's east shoulder: a navy trough, glowing while a Harvester unloads
  b.add(MAT.PAINT, cbox(0.24, 0.06, 0.24, 0.012, { p: [0.43, T + 0.03, 0.14], color: PAL.navy }));
  b.add(MAT.DARK, box(0.2, 0.004, 0.18, { p: [0.43, T + 0.061, 0.14], color: 0x1c120e }));
  for (const z of [0.03, 0.25]) b.add(MAT.PAINT, box(0.24, 0.02, 0.02, { p: [0.43, T + 0.07, z], color: PAL.navyLight }));
  b.node('flow', { pivot: [0.43, T + 0.064, 0.14], kind: 'scale', value: 0.001 });
  b.add(MAT.LIGHT, box(0.2, 0.006, 0.16, { color: 0xff8a1a, glow: 1.8 }), 'flow');
  b.add(MAT.LIGHT, box(0.12, 0.008, 0.06, { p: [0.02, 0.002, 0], color: 0xffd080, glow: 1.6 }), 'flow');

  // docking pad: lavender deck, cross of recessed sockets, corner triangles
  const dx0 = 1.0, dz0 = 0.38, top = T + 0.05;
  b.add(MAT.PAINT, cbox(0.94, 0.05, 1.22, 0.02, { p: [dx0, T + 0.025, dz0], color: PAL.machine }));
  b.add(MAT.PAINT, box(0.88, 0.004, 1.16, { p: [dx0, top, dz0], color: PAL.machineLight }));
  const cols = [-0.37, -0.125, 0.125, 0.37], rows = [-0.5, -0.25, 0, 0.25, 0.5];
  rows.forEach((z, j) => cols.forEach((x, i) => { if (j === 2 || i === 1 || i === 2) socket(b, dx0 + x, top, dz0 + z, 0.08); }));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.add(MAT.DARK, corner(dx0 + sx * 0.37, top, dz0 + sz * 0.5, sx, sz, 0.065, 0.008, { color: SOCKET }));
  // pad lights: amber chevrons that slide in along the diagonals and a centre pair, pulsing on `padLights`
  b.node('padLights', { pivot: [dx0, top + 0.012, dz0], kind: 'scale' });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    b.add(MAT.LIGHT, corner(sx * 0.27, 0, sz * 0.37, sx, sz, 0.05, 0.006, { color: AMBER, glow: 1.8 }), 'padLights');
    b.add(MAT.LIGHT, corner(sx * 0.255, 0.002, sz * 0.355, sx, sz, 0.025, 0.006, { color: 0xfff0c0, glow: 1.4 }), 'padLights');
  }
  for (const x of [-0.125, 0.125]) {
    b.add(MAT.LIGHT, sphere(0.045, 12, { p: [x, 0, 0], s: [1, 0.45, 1], color: AMBER, glow: 1.8 }), 'padLights');
    b.add(MAT.LIGHT, sphere(0.02, 8, { p: [x - 0.008, 0.012, -0.008], s: [1, 0.5, 1], color: 0xfff0c0, glow: 1.5 }), 'padLights');
  }

  houseOrb(b, -1.25, T, 0.75);
  return b.build({ radius: 1.6 });
}
