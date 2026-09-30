// Construction Yard (2x2), after the Genesis sprite: an open navy service yard with a lavender rim. In
// the north-west lie prefab parts — orange I-beams (an L, a bar, a post) and thin gold frames. The
// yellow crane stands on an olive plinth in the north-east: a round slewing cab with a big porthole
// window, counterweight and A-frame, and a lattice boom reaching south-west with an orange girder
// swinging on its cable (the `crane` node turns, the load sways on `flag`). Under the boom a scaffold
// heap lies under olive netting; crates stand stacked in the west; the yellow bulldozer faces east in the
// south with its blue cab glass and tall blade; a kerb with a low fence runs along the south and east
// edges; lavender bollards stand about, and the house orb sits in the south-west corner.
import { ModelBuilder, MAT, box, cbox, cyl, sphere, torus, hull, prism, place } from '../kit.js';
import { PAL } from '../palette.js';
import { foundation, FOUNDATION_TOP as T, houseOrb, rod, railing, bolts } from '../detail.js';

const YELLOW = 0xf2b418, YELLOW_DARK = 0xb56b00, ORANGE = 0xde6b00, RED = 0x9c2000, GOLD = 0xf0b020;
const NET = 0x3b3b1c, NET_LIGHT = 0x5a5a2c, KERB = 0x55552c, KHAKI = 0xb5b594;

/** An I-beam lying on its side between two floor points: orange flanges either side of a dark red web. */
function beam(b, x0, z0, x1, z1, w = 0.1) {
  const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const at = { p: [cx, T, cz], r: [0, -a, 0] };
  b.add(MAT.PAINT, place([
    cbox(len, 0.05, 0.028, 0.008, { p: [0, 0.025, -w / 2 + 0.014], color: ORANGE }),
    cbox(len, 0.05, 0.028, 0.008, { p: [0, 0.025, w / 2 - 0.014], color: ORANGE }),
    box(len - 0.01, 0.012, w - 0.05, { p: [0, 0.022, 0], color: RED }),
  ], at));
  const ribs = [];
  for (let k = 1; k < Math.round(len / 0.08); k++) ribs.push(box(0.012, 0.03, w - 0.05, { p: [-len / 2 + k * 0.08, 0.03, 0], color: ORANGE }));
  if (ribs.length) b.add(MAT.PAINT, place(ribs, at));
}

/** A thin gold steel frame lying on the yard, through [x, z] points. */
function frame(b, pts) {
  const y = T + 0.014;
  for (let i = 0; i < pts.length - 1; i++) {
    if (!pts[i] || !pts[i + 1]) continue;
    b.add(MAT.METAL, rod([pts[i][0], y, pts[i][1]], [pts[i + 1][0], y, pts[i + 1][1]], 0.013, 4, { color: GOLD }));
  }
}

function crate(b, x, z, s, h, y = T) {
  b.add(MAT.PAINT, cbox(s, h, s, 0.014, { p: [x, y + h / 2, z], color: PAL.crate }));
  b.add(MAT.PAINT, cbox(s * 0.72, 0.01, s * 0.72, 0.004, { p: [x, y + h + 0.002, z], color: 0x6e3400 }));
  for (const d of [-1, 1]) b.add(MAT.PAINT, box(s + 0.004, 0.018, 0.02, { p: [x, y + h / 2 + d * h * 0.28, z + s / 2 - 0.004], color: 0x4a2100 }));
  b.add(MAT.PAINT, box(0.03, 0.012, 0.03, { p: [x - s / 2 + 0.02, y + h + 0.004, z - s / 2 + 0.02], color: 0xffdeb5 }));
}

/** The bulldozer, facing east: two tracks, a round yellow engine hood, blue cab glass, push arms and blade. */
function bulldozer(b, x, z) {
  for (const s of [-1, 1]) {
    const tz = z + s * 0.14, len = 0.42, h = 0.08;
    b.add(MAT.DARK, box(len - h, h, 0.07, { p: [x, T + h / 2, tz], color: 0x1c1b18 }));
    for (const e of [-1, 1]) b.add(MAT.DARK, cyl(h / 2, h / 2, 0.07, 10, { p: [x + e * (len - h) / 2, T + h / 2, tz], r: [Math.PI / 2, 0, 0], color: 0x1c1b18 }));
    const links = [];
    for (let k = 0; k < 6; k++) links.push(box(0.022, 0.008, 0.06, { p: [x - 0.15 + k * 0.06, T + h + 0.002, tz], color: PAL.machineLight }));
    b.add(MAT.PAINT, links);
    for (let k = 0; k < 3; k++) b.add(MAT.METAL, cyl(0.026, 0.026, 0.012, 8, { p: [x - 0.11 + k * 0.11, T + h / 2, tz + s * 0.037], r: [Math.PI / 2, 0, 0], color: PAL.steelDark }));
  }
  b.add(MAT.PAINT, cbox(0.36, 0.05, 0.2, 0.012, { p: [x, T + 0.085, z], color: YELLOW_DARK }));
  b.add(MAT.PAINT, cyl(0.085, 0.085, 0.3, 14, { p: [x - 0.04, T + 0.15, z], r: [0, 0, Math.PI / 2], color: YELLOW }));
  for (const dx of [-0.16, -0.04, 0.08]) b.add(MAT.METAL, cyl(0.088, 0.088, 0.014, 14, { p: [x + dx, T + 0.15, z], r: [0, 0, Math.PI / 2], color: YELLOW_DARK }));
  b.add(MAT.PAINT, hull([[x + 0.11, T + 0.11, z - 0.09], [x + 0.11, T + 0.11, z + 0.09], [x + 0.11, T + 0.25, z - 0.08], [x + 0.11, T + 0.25, z + 0.08],
    [x + 0.18, T + 0.11, z - 0.09], [x + 0.18, T + 0.11, z + 0.09], [x + 0.16, T + 0.25, z - 0.08], [x + 0.16, T + 0.25, z + 0.08]], { color: YELLOW }));
  b.add(MAT.LIGHT, hull([[x + 0.181, T + 0.14, z - 0.07], [x + 0.181, T + 0.14, z + 0.07], [x + 0.164, T + 0.23, z - 0.065], [x + 0.164, T + 0.23, z + 0.065],
    [x + 0.175, T + 0.14, z - 0.07], [x + 0.175, T + 0.14, z + 0.07], [x + 0.158, T + 0.23, z - 0.065], [x + 0.158, T + 0.23, z + 0.065]], { color: 0x0a4ade, glow: 1.2 }));
  b.add(MAT.LIGHT, box(0.01, 0.03, 0.03, { p: [x + 0.178, T + 0.2, z - 0.035], color: 0x40ffff, glow: 1.4 }));
  for (const s of [-1, 1]) b.add(MAT.LIGHT, box(0.05, 0.07, 0.006, { p: [x + 0.14, T + 0.19, z + s * 0.083], color: 0x0a4ade, glow: 1.1 }));
  b.add(MAT.PAINT, cbox(0.1, 0.02, 0.2, 0.006, { p: [x + 0.135, T + 0.26, z], color: YELLOW_DARK }));
  b.add(MAT.METAL, cyl(0.012, 0.014, 0.1, 6, { p: [x - 0.1, T + 0.27, z - 0.04], color: PAL.gunmetal }));
  for (const s of [-1, 1]) b.add(MAT.PAINT, rod([x + 0.1, T + 0.08, z + s * 0.13], [x + 0.24, T + 0.07, z + s * 0.16], 0.016, 6, { color: YELLOW_DARK }));
  b.add(MAT.PAINT, prism([[0, 0], [0.035, 0], [0.05, 0.22], [0.012, 0.22], [-0.012, 0.06]], 0.4, { p: [x + 0.24, T, z], color: YELLOW }));
  b.add(MAT.METAL, box(0.012, 0.02, 0.4, { p: [x + 0.25, T + 0.01, z], color: PAL.steel }));
}

export function constructionYard() {
  const b = new ModelBuilder('constructionYard');
  foundation(b, 2, 2, { plate: PAL.navy, rim: PAL.machine });

  // prefab parts laid out in the north-west: I-beams and thin gold frames
  beam(b, -0.9, -0.885, -0.64, -0.885);
  beam(b, -0.855, -0.84, -0.855, -0.66);
  beam(b, -0.34, -0.885, -0.04, -0.885);
  beam(b, -0.855, -0.33, -0.855, -0.06);
  frame(b, [[-0.6, -0.94], [-0.6, -0.72], null, [-0.44, -0.94], [-0.44, -0.72], null, [-0.6, -0.84], [-0.44, -0.84]]);
  frame(b, [[-0.9, -0.63], [-0.72, -0.63], [-0.72, -0.47], [-0.9, -0.47], [-0.9, -0.63]]);
  frame(b, [[-0.3, -0.63], [-0.14, -0.63], [-0.14, -0.47], [-0.3, -0.47], [-0.3, -0.63], null, [-0.22, -0.63], [-0.22, -0.47]]);
  frame(b, [[-0.6, -0.12], [-0.52, -0.34], [-0.44, -0.12], null, [-0.57, -0.2], [-0.47, -0.2]]);

  // lavender bollards
  for (const [x, z] of [[0.06, -0.69], [-0.22, -0.19], [0.67, -0.33], [0.83, -0.33], [0.75, -0.19]]) {
    b.add(MAT.METAL, cyl(0.04, 0.05, 0.03, 10, { p: [x, T + 0.015, z], color: PAL.machineDark }));
    b.add(MAT.PAINT, sphere(0.06, 12, { p: [x, T + 0.075, z], color: PAL.machineLight }));
  }

  // scaffold heap under netting, below the boom
  const heap = [[-0.02, 0.1], [0.3, -0.04], [0.62, 0.12], [0.72, 0.4], [0.6, 0.68], [0.3, 0.7], [0.08, 0.5]];
  b.add(MAT.DARK, hull([...heap.map(([x, z]) => [x, T, z]), [0.3, T + 0.14, 0.3], [0.5, T + 0.12, 0.2], [0.45, T + 0.1, 0.55], [0.18, T + 0.08, 0.35]], { color: NET }));
  b.add(MAT.DARK, hull([[0.05, T, 0.02], [0.3, T, -0.06], [0.42, T, 0.14], [0.14, T, 0.26], [0.25, T + 0.16, 0.08]], { color: NET_LIGHT }));
  b.add(MAT.DARK, hull([[0.42, T, 0.46], [0.7, T, 0.5], [0.62, T, 0.72], [0.38, T, 0.7], [0.55, T + 0.13, 0.6]], { color: NET_LIGHT }));
  const sc = [[0.24, 0.2], [0.48, 0.2], [0.48, 0.42], [0.24, 0.42]];
  for (const [x, z] of sc) b.add(MAT.METAL, cyl(0.011, 0.011, 0.26, 5, { p: [x, T + 0.13, z], color: KHAKI }));
  for (const y of [0.16, 0.25]) sc.forEach(([x, z], i) => b.add(MAT.METAL, rod([x, T + y, z], [sc[(i + 1) % 4][0], T + y, sc[(i + 1) % 4][1]], 0.008, 4, { color: KHAKI })));

  crate(b, -0.67, 0.06, 0.17, 0.12);
  crate(b, -0.42, 0.06, 0.17, 0.14);
  crate(b, -0.89, 0.23, 0.16, 0.12);
  crate(b, -0.67, 0.33, 0.17, 0.12);
  crate(b, -0.66, 0.07, 0.12, 0.09, T + 0.12);

  bulldozer(b, -0.1, 0.43);

  // kerb blocks with a low fence along the south and east edges
  for (let k = 0; k < 6; k++) {
    const x = -0.39 + k * 0.24;
    b.add(MAT.PAINT, cbox(0.22, 0.09, 0.1, 0.015, { p: [x, T + 0.045, 0.86], color: KERB }));
    b.add(MAT.PAINT, box(0.2, 0.01, 0.018, { p: [x, T + 0.091, 0.82], color: KHAKI }));
  }
  for (let k = 0; k < 4; k++) {
    const z = 0.11 + k * 0.24;
    b.add(MAT.PAINT, cbox(0.1, 0.09, 0.22, 0.015, { p: [0.86, T + 0.045, z], color: KERB }));
    b.add(MAT.PAINT, box(0.018, 0.01, 0.2, { p: [0.82, T + 0.091, z], color: KHAKI }));
  }
  railing(b, [[-0.49, T + 0.095, 0.875], [0.875, T + 0.095, 0.875], [0.875, T + 0.095, 0.0]], { h: 0.09, spacing: 0.24, color: PAL.steelDark });

  // crane: olive plinth (root), slewing cab and lattice boom on the `crane` node
  const cx = 0.64, cz = -0.72;
  b.add(MAT.PAINT, cbox(0.44, 0.07, 0.42, 0.02, { p: [cx - 0.02, T + 0.035, cz + 0.02], color: KERB }));
  b.add(MAT.PAINT, cbox(0.4, 0.012, 0.38, 0.006, { p: [cx - 0.02, T + 0.072, cz + 0.02], color: 0x4a4a21 }));
  bolts(b, [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [cx - 0.02 + sx * 0.17, T + 0.078, cz + 0.02 + sz * 0.16]), { r: 0.014, color: KHAKI });
  b.node('crane', { pivot: [cx, T + 0.07, cz] });
  const C = 'crane', geo = [], met = [];
  geo.push(cyl(0.13, 0.15, 0.05, 16, { p: [0, 0.025, 0], color: YELLOW_DARK }));
  geo.push(cyl(0.16, 0.16, 0.16, 18, { p: [0, 0.13, 0], color: YELLOW }));
  geo.push(sphere(0.16, 18, { p: [0, 0.21, 0], s: [1, 0.45, 1], color: YELLOW }));
  geo.push(cbox(0.2, 0.14, 0.14, 0.02, { p: [0.14, 0.13, -0.14], r: [0, Math.PI / 4, 0], color: YELLOW_DARK }));
  // porthole window facing along the boom (south-west)
  const sw = [-Math.SQRT1_2, 0, Math.SQRT1_2];
  const win = (d, y) => [sw[0] * d, y, sw[2] * d];
  met.push(torus(0.07, 0.018, 6, 16, { p: win(0.155, 0.16), r: [0, -Math.PI / 4, 0], color: PAL.white }));
  b.add(MAT.GLASS, place(cyl(0.06, 0.06, 0.02, 14, { r: [Math.PI / 2, 0, 0], color: 0x10202c }), { p: win(0.15, 0.16), r: [0, -Math.PI / 4, 0] }), C);
  // lattice boom rising to the south-west: four chords, zigzag sides, diamond bracing on top; A-frame and cable
  const L = 0.84, rise = 0.66, N = 6, root = win(0.1, 0.22);
  const dir = [sw[0] * Math.cos(rise), Math.sin(rise), sw[2] * Math.cos(rise)], up = [-sw[0] * Math.sin(rise), Math.cos(rise), -sw[2] * Math.sin(rise)];
  const pt = (t, side, top) => {
    const f = t / L, w = 0.085 * (1 - 0.4 * f) * side, h = 0.09 * (1 - 0.5 * f) * top;
    return [0, 1, 2].map((i) => root[i] + dir[i] * t + [-sw[2], 0, sw[0]][i] * w + up[i] * h);
  };
  const ts = Array.from({ length: N + 1 }, (_, k) => (k / N) * L);
  for (const sd of [-1, 1]) for (const tp of [0, 1]) geo.push(rod(pt(0, sd, tp), pt(L, sd, tp), 0.018, 4, { color: YELLOW }));
  for (let k = 0; k < N; k++) {
    for (const sd of [-1, 1]) geo.push(rod(pt(ts[k], sd, k % 2), pt(ts[k + 1], sd, (k + 1) % 2), 0.008, 4, { color: YELLOW_DARK }));
    geo.push(rod(pt(ts[k], -1, 1), pt(ts[k + 1], 1, 1), 0.008, 4, { color: YELLOW_DARK }), rod(pt(ts[k], 1, 1), pt(ts[k + 1], -1, 1), 0.008, 4, { color: YELLOW_DARK }));
    geo.push(rod(pt(ts[k], -1, 0), pt(ts[k], 1, 0), 0.007, 4, { color: YELLOW_DARK }));
  }
  const tip = pt(L, 0, 0.5);
  geo.push(cyl(0.032, 0.032, 0.09, 8, { p: tip, r: [0, Math.PI / 4, Math.PI / 2], color: YELLOW_DARK }));
  const apex = [0.05, 0.44, -0.05];
  for (const d of [-1, 1]) geo.push(rod([0.07 - d * 0.064, 0.25, -0.07 - d * 0.064], apex, 0.012, 5, { color: YELLOW_DARK }));
  met.push(rod(apex, tip, 0.005, 4, { color: PAL.gunmetal }), rod(apex, pt(L * 0.45, 0, 1), 0.005, 4, { color: PAL.gunmetal }));
  b.add(MAT.PAINT, geo, C);
  b.add(MAT.METAL, met, C);

  // the load: an orange girder hanging on its cable, swaying on `flag`
  b.node('hook', { parent: C, pivot: tip, axis: 'x', param: 'flag' });
  const drop = 0.26;
  b.add(MAT.METAL, [
    cyl(0.004, 0.004, drop, 4, { p: [0, -drop / 2, 0], color: PAL.gunmetal }),
    torus(0.022, 0.006, 4, 8, { p: [0, -drop - 0.015, 0], color: PAL.gunmetal }, Math.PI * 1.5),
    rod([0, -drop - 0.03, 0], [-0.1, -drop - 0.08, 0.1], 0.003, 3, { color: PAL.gunmetal }),
    rod([0, -drop - 0.03, 0], [0.1, -drop - 0.08, -0.1], 0.003, 3, { color: PAL.gunmetal }),
    ...place([
      box(0.32, 0.018, 0.06, { p: [0, 0.03, 0], color: ORANGE }), box(0.32, 0.018, 0.06, { p: [0, -0.03, 0], color: ORANGE }), box(0.3, 0.05, 0.014, { color: RED }),
    ], { p: [0, -drop - 0.11, 0], r: [0, Math.PI / 4, 0] }),
  ], 'hook');

  houseOrb(b, -0.75, T, 0.75);
  return b.build({ radius: 1.0 });
}
