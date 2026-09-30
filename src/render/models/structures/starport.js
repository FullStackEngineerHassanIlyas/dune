// Starport (3x3), after the Genesis sprite: a navy apron carrying three brass buildings with three big
// black glass lenses in gold rings. In the north-west, a control block with a sunken dark deck holding
// a faceted gold dome, its lens at the east end and a panelled annex on the west; in the north-east an
// L-shaped block with a round hatch, a maroon panel and the second lens; in the west the third lens on
// a brass collar; in the south-west the L-shaped terminal with its lit window, roof vent, T-slot, star
// emblem, maroon panel and door. A brass fuel capsule lies near the centre, which stays low: the
// Frigate comes down over it. The pale landing pad fills the south-east corner with its plus of
// sockets and chevrons; amber pad lights run in and out along it when a Frigate is due. The house orb
// sits in the south-west corner.
import { ModelBuilder, MAT, box, cbox, cyl, sphere, dome, torus, ring, hull, geodesic } from '../kit.js';
import { PAL } from '../palette.js';
import { foundation, FOUNDATION_TOP as T, houseOrb, bolts, louvres } from '../detail.js';

const BRASS = 0xa8843c, BRASS_LIGHT = 0xc8a45e, BRASS_DARK = 0x7a5a1c, BRASS_DEEP = 0x553400, GOLD = 0xc4952e, DOME = 0x9c7426;
const MAROON = 0x4c2626, MAROON_DARK = 0x2e0c1d, PAD = 0x7e7ea4, PAD_EDGE = 0x6e6e99, MARK = 0x55552a;

/** Model x or z of a plan coordinate: tiles from the footprint's NW corner, as the sprite plan gives them. */
const m = (v) => v - 1.5;

/** Chamfered block over the plan rectangle x0..x1, z0..z1, from y0 up by h. */
const block = (x0, z0, x1, z1, y0, h, color, c = 0.018) => cbox(x1 - x0, h, z1 - z0, c, { p: [m((x0 + x1) / 2), y0 + h / 2, m((z0 + z1) / 2)], color });

/** Light dashes along a plan line at height y: the sprite's white highlight pixels on the lit rims. */
function dashes(b, x0, z0, x1, z1, y, step = 0.1) {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step)), along = x1 - x0 > z1 - z0;
  for (let k = 0; k < n; k++) {
    if (k % 3 === 2) continue;
    const t = (k + 0.5) / n;
    b.add(MAT.PAINT, box(along ? step * 0.6 : 0.022, 0.006, along ? 0.022 : step * 0.6, { p: [m(x0 + (x1 - x0) * t), y + 0.003, m(z0 + (z1 - z0) * t)], color: PAL.white }));
  }
}

/** A black glass lens (the sprite's "eye") on a brass drum from y0 to y1: gold ring, navy bezel, glint and reflection. */
function lens(b, x, z, y0, y1, r = 0.19) {
  const px = m(x), pz = m(z), flat = 0.7;
  b.add(MAT.PAINT, cyl(r + 0.055, r + 0.07, y1 - y0, 28, { p: [px, (y0 + y1) / 2, pz], color: BRASS }));
  b.add(MAT.DARK, cyl(r + 0.074, r + 0.074, 0.016, 28, { p: [px, y0 + (y1 - y0) * 0.55, pz], color: BRASS_DEEP }));
  b.add(MAT.METAL, torus(r + 0.035, 0.028, 6, 32, { p: [px, y1 + 0.006, pz], r: [Math.PI / 2, 0, 0], color: GOLD }));
  b.add(MAT.PAINT, ring(r + 0.01, r - 0.02, 0.018, 28, { p: [px, y1, pz], color: PAL.navy }));
  b.add(MAT.GLASS, dome(r, 28, { p: [px, y1, pz], s: [1, flat, 1], color: 0x000000 }));
  const g = [-0.42, 0.8, -0.42], gl = Math.hypot(...g);
  b.add(MAT.LIGHT, sphere(0.024, 8, { p: [px + (r * g[0]) / gl, y1 + (r * flat * g[1]) / gl + 0.004, pz + (r * g[2]) / gl], color: 0xffffff, glow: 1.3 }));
  b.add(MAT.PAINT, torus(r * 0.86, 0.009, 4, 12, { p: [px, y1 + r * flat * 0.51 + 0.004, pz], r: [Math.PI / 2, 0, -0.1], color: PAL.machineLight }, Math.PI * 0.55));
  const studs = [];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; studs.push([px + Math.cos(a) * (r + 0.07), y1 - 0.03, pz + Math.sin(a) * (r + 0.07)]); }
  bolts(b, studs, { r: 0.011, axis: 'y', h: 0.05, color: BRASS_LIGHT, mat: MAT.PAINT });
}

/** A five-pointed gold star lying flat (the terminal's emblem). */
function star(b, x, y, z, r) {
  const geos = [cyl(r * 0.38, r * 0.38, 0.006, 5, { p: [x, y + 0.003, z], color: GOLD })];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    const pts = [[a, r], [a - 0.63, r * 0.38], [a + 0.63, r * 0.38]].map(([t, d]) => [x + Math.cos(t) * d, z + Math.sin(t) * d]);
    geos.push(hull(pts.flatMap(([u, v]) => [[u, y, v], [u, y + 0.006, v]]), { color: GOLD }));
  }
  b.add(MAT.METAL, geos);
}

/** Round hatch on a roof: maroon well, brass wheel with spokes. */
function hatch(b, x, z, y, r) {
  b.add(MAT.DARK, cyl(r, r, 0.012, 16, { p: [m(x), y + 0.006, m(z)], color: MAROON_DARK }));
  b.add(MAT.METAL, torus(r * 0.62, r * 0.14, 5, 16, { p: [m(x), y + 0.018, m(z)], r: [Math.PI / 2, 0, 0], color: BRASS_LIGHT }));
  for (const a of [0, Math.PI / 2]) b.add(MAT.METAL, box(r * 1.2, 0.01, r * 0.16, { p: [m(x), y + 0.018, m(z)], r: [0, a + 0.4, 0], color: BRASS_LIGHT }));
}

export function starport() {
  const b = new ModelBuilder('starport');
  foundation(b, 3, 3, { plate: PAL.navy, rim: PAL.machine });
  for (const v of [1, 2]) {   // apron plate seams
    b.add(MAT.DARK, box(0.012, 0.004, 2.8, { p: [m(v), T + 0.002, 0], color: 0x151537 }));
    b.add(MAT.DARK, box(2.8, 0.004, 0.012, { p: [0, T + 0.002, m(v)], color: 0x151537 }));
  }

  // north-west: the control block, a sunken dark deck inside brass walls, the gold dome on a toothed ring
  const deck = T + 0.1;
  b.add(MAT.PAINT, block(0.52, 0.25, 1.3, 1.0, T, 0.1, BRASS_DARK));
  b.add(MAT.DARK, block(0.6, 0.33, 1.26, 0.96, deck, 0.006, MAROON_DARK, 0.003));
  b.add(MAT.PAINT, [block(0.52, 0.25, 1.3, 0.33, T, 0.2, BRASS), block(0.52, 0.25, 0.6, 1.0, T, 0.2, BRASS), block(0.6, 0.94, 1.2, 1.0, T, 0.13, BRASS)]);
  dashes(b, 0.54, 0.26, 1.28, 0.26, T + 0.2);
  dashes(b, 0.53, 0.3, 0.53, 0.98, T + 0.2);
  const [gx, gz] = [m(0.9), m(0.66)];
  b.add(MAT.DARK, cyl(0.235, 0.25, 0.05, 24, { p: [gx, deck + 0.025, gz], color: MAROON }));
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    b.add(MAT.PAINT, box(0.05, 0.04, 0.035, { p: [gx + Math.cos(a) * 0.245, deck + 0.02, gz + Math.sin(a) * 0.245], r: [0, -a, 0], color: BRASS_DEEP }));
  }
  b.add(MAT.METAL, geodesic(0.215, 1, { p: [gx, deck + 0.05, gz], s: [1, 1.05, 1], color: DOME }));
  b.add(MAT.METAL, cyl(0.035, 0.035, 0.12, 8, { p: [gx, deck + 0.02, m(1.02)], r: [Math.PI / 2, 0, 0], color: BRASS_DEEP }));
  lens(b, 1.39, 0.6, T, T + 0.24);
  // the annex on the west: a panelled roof with a lavender vent
  b.add(MAT.PAINT, block(0.25, 0.5, 0.56, 1.0, T, 0.19, BRASS));
  b.add(MAT.DARK, block(0.3, 0.55, 0.51, 0.95, T + 0.19, 0.008, MAROON_DARK, 0.003));
  b.add(MAT.PAINT, block(0.32, 0.57, 0.49, 0.93, T + 0.19, 0.014, BRASS_DARK, 0.005));
  b.add(MAT.PAINT, block(0.38, 0.74, 0.49, 0.81, T + 0.2, 0.03, PAL.machineLight, 0.008));
  dashes(b, 0.26, 0.51, 0.26, 0.99, T + 0.19);
  b.add(MAT.DARK, box(0.14, 0.09, 0.012, { p: [m(0.4), T + 0.08, m(1.0) + 0.004], color: 0x0b0b1c }));
  b.add(MAT.LIGHT, box(0.1, 0.018, 0.006, { p: [m(0.4), T + 0.1, m(1.0) + 0.011], color: 0x3ad8ff, glow: 1.2 }));

  // north-east: the L-shaped block, its hatch, maroon panel, window and lens
  b.add(MAT.PAINT, [block(1.78, 0.23, 2.75, 0.5, T, 0.2, BRASS), block(2.27, 0.45, 2.75, 1.5, T, 0.2, BRASS)]);
  b.add(MAT.DARK, block(1.82, 0.28, 2.7, 0.31, T + 0.2, 0.006, MAROON_DARK, 0.002));
  b.add(MAT.PAINT, block(1.84, 0.36, 2.36, 0.42, T + 0.2, 0.018, BRASS_LIGHT, 0.006));
  b.add(MAT.DARK, block(2.66, 0.31, 2.7, 1.1, T + 0.2, 0.006, MAROON_DARK, 0.002));
  dashes(b, 1.8, 0.24, 2.73, 0.24, T + 0.2);
  dashes(b, 1.79, 0.26, 1.79, 0.48, T + 0.2);
  hatch(b, 2.5, 0.47, T + 0.2, 0.07);
  lens(b, 2.4, 0.9, T, T + 0.26);
  b.add(MAT.DARK, block(2.49, 1.12, 2.72, 1.47, T + 0.2, 0.008, MAROON_DARK, 0.003));
  b.add(MAT.PAINT, block(2.51, 1.14, 2.7, 1.45, T + 0.2, 0.016, MAROON, 0.005));
  b.add(MAT.PAINT, block(2.36, 1.22, 2.46, 1.32, T + 0.2, 0.025, PAL.machineLight, 0.008));
  louvres(b, { w: 0.3, d: 0.1, n: 3, at: { p: [m(2.51), T + 0.1, m(1.5) + 0.004], r: [Math.PI / 2, 0, 0] }, frame: BRASS_DARK, slats: BRASS_DEEP });
  louvres(b, { w: 0.26, d: 0.1, n: 3, at: { p: [m(2.0), T + 0.1, m(0.5) + 0.004], r: [Math.PI / 2, 0, 0] }, frame: BRASS_DARK, slats: BRASS_DEEP });
  for (const [x, z, w] of [[0.95, 0.25, 0.4], [2.25, 0.23, 0.5], [0.85, 1.76, 0.36]]) {   // quiet vents on the north faces
    louvres(b, { w, d: 0.08, n: 3, at: { p: [m(x), T + 0.1, m(z) - 0.004], r: [-Math.PI / 2, 0, 0] }, frame: BRASS_DARK, slats: BRASS_DEEP });
  }

  // the fuel capsule near the centre: a low brass pod, dark hatch at the west end, maroon cap at the east
  const cz = m(1.165);
  b.add(MAT.PAINT, [box(0.17, 0.11, 0.24, { p: [m(1.71), T + 0.055, cz], color: BRASS }), ...[1.625, 1.795].map((x) => cyl(0.12, 0.12, 0.11, 18, { p: [m(x), T + 0.055, cz], color: BRASS }))]);
  b.add(MAT.PAINT, cyl(0.09, 0.1, 0.03, 18, { p: [m(1.8), T + 0.12, cz], color: MAROON }));
  b.add(MAT.DARK, hull([[m(1.57), T + 0.11, cz + 0.05], [m(1.66), T + 0.11, cz + 0.05], [m(1.615), T + 0.11, cz - 0.05], [m(1.57), T + 0.116, cz + 0.05], [m(1.66), T + 0.116, cz + 0.05], [m(1.615), T + 0.116, cz - 0.05]], { color: 0x0b0b10 }));
  b.add(MAT.METAL, torus(0.12, 0.012, 4, 20, { p: [m(1.625), T + 0.11, cz], r: [Math.PI / 2, 0, Math.PI * 0.6], color: BRASS_LIGHT }, Math.PI));

  // west: the third lens on its collar, a brass wall down to the terminal
  lens(b, 0.64, 1.37, T, T + 0.16);
  b.add(MAT.PAINT, block(0.25, 1.36, 0.33, 1.78, T, 0.12, BRASS));

  // south-west: the terminal, an L of brass with a lit window, roof vent, T-slot, maroon panel, star and door
  b.add(MAT.PAINT, [block(0.25, 1.76, 0.8, 2.22, T, 0.2, BRASS), block(0.76, 1.76, 1.5, 2.74, T, 0.24, BRASS)]);
  b.add(MAT.DARK, block(0.31, 1.81, 0.74, 2.17, T + 0.2, 0.008, MAROON_DARK, 0.003));
  b.add(MAT.PAINT, block(0.33, 1.83, 0.72, 2.15, T + 0.2, 0.014, BRASS_DARK, 0.005));
  b.add(MAT.DARK, block(0.44, 1.9, 0.69, 2.12, T + 0.2, 0.018, 0x08080e, 0.004));
  b.add(MAT.PAINT, block(0.4, 1.99, 0.63, 2.05, T + 0.2, 0.026, PAL.machineLight, 0.006));
  dashes(b, 0.27, 1.77, 1.48, 1.77, T + 0.24);
  dashes(b, 0.26, 1.78, 0.26, 2.2, T + 0.2);
  dashes(b, 0.77, 2.24, 0.77, 2.72, T + 0.24);
  const top = T + 0.24;
  b.add(MAT.DARK, block(0.8, 1.81, 1.46, 2.7, top, 0.006, MAROON_DARK, 0.002));
  b.add(MAT.PAINT, [block(0.82, 1.83, 1.02, 2.3, top, 0.014, BRASS_DARK, 0.004), block(0.82, 2.3, 1.44, 2.68, top, 0.014, BRASS, 0.004)]);
  b.add(MAT.PAINT, block(1.02, 1.83, 1.44, 2.36, top, 0.018, MAROON, 0.005));
  b.add(MAT.DARK, [block(0.8, 1.91, 1.25, 1.96, top, 0.024, MAROON_DARK, 0.004), block(1.07, 1.96, 1.12, 2.3, top, 0.024, MAROON_DARK, 0.004)]);
  b.add(MAT.DARK, block(0.9, 1.83, 1.26, 1.88, top, 0.02, PAL.navy, 0.004));
  bolts(b, [0.93, 0.99, 1.05, 1.11, 1.17, 1.23].map((x) => [m(x), top + 0.02, m(1.855)]), { r: 0.012, h: 0.012, color: PAL.white, mat: MAT.PAINT });
  b.add(MAT.DARK, cyl(0.05, 0.05, 0.024, 12, { p: [m(1.33), top + 0.012, m(2.14)], color: 0x120610 }));
  star(b, m(1.33), top + 0.024, m(2.14), 0.04);
  b.add(MAT.DARK, block(0.88, 2.33, 1.17, 2.55, top, 0.012, 0x08080e, 0.003));
  b.add(MAT.PAINT, block(0.91, 2.35, 1.13, 2.5, top, 0.05, PAL.machineLight, 0.012));
  // its south face, toward the camera: a door, lit windows, and a window in the west wing
  b.add(MAT.DARK, box(0.16, 0.17, 0.012, { p: [m(1.24), T + 0.085, m(2.74) + 0.004], color: 0x0b0b1c }));
  b.add(MAT.PAINT, [box(0.2, 0.025, 0.02, { p: [m(1.24), T + 0.18, m(2.74) + 0.008], color: PAL.machineLight }), ...[1.15, 1.33].map((x) => box(0.022, 0.18, 0.02, { p: [m(x), T + 0.09, m(2.74) + 0.008], color: PAL.machineLight }))]);
  for (const x of [0.86, 0.98]) {
    b.add(MAT.DARK, box(0.08, 0.06, 0.012, { p: [m(x), T + 0.15, m(2.74) + 0.004], color: 0x0b0b1c }));
    b.add(MAT.LIGHT, box(0.06, 0.016, 0.006, { p: [m(x), T + 0.16, m(2.74) + 0.011], color: 0x3ad8ff, glow: 1.2 }));
  }
  b.add(MAT.DARK, box(0.22, 0.07, 0.012, { p: [m(0.5), T + 0.12, m(2.22) + 0.004], color: 0x0b0b1c }));
  b.add(MAT.LIGHT, box(0.18, 0.018, 0.006, { p: [m(0.5), T + 0.13, m(2.22) + 0.011], color: 0xfff2c0, glow: 1.2 }));

  // landing pad: pale plate, a plus of dark sockets, chevrons pointing their corners at the centre
  const c = m(2.38), py = T + 0.03;
  b.add(MAT.PAINT, block(1.76, 1.76, 2.99, 2.99, T, 0.022, PAD_EDGE, 0.012));
  b.add(MAT.PAINT, block(1.79, 1.79, 2.96, 2.96, T + 0.02, 0.01, PAD, 0.004));
  const sockets = [[0, 0], [0, -0.49], [0, -0.25], [0, 0.25], [0, 0.49], [-0.49, 0], [-0.25, 0], [0.25, 0], [0.49, 0]];
  for (const [x, z] of sockets) {
    b.add(MAT.DARK, ring(0.082, 0.064, 0.006, 16, { p: [c + x, py, c + z], color: 0x0d0d20 }));
    b.add(MAT.DARK, cyl(0.065, 0.065, 0.004, 16, { p: [c + x, py + 0.001, c + z], color: MARK }));
    b.add(MAT.PAINT, torus(0.08, 0.012, 3, 12, { p: [c + x, py + 0.004, c + z], r: [Math.PI / 2, 0, -0.55], color: PAL.white }, Math.PI * 0.95));
  }
  for (const [d, e] of [[0.5, 0.07], [0.25, 0.062]]) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = c + sx * d, z = c + sz * d;   // the right angle points at the pad centre
    const tri = (k, y0, y1, color) => hull([[x - sx * k, z - sz * k], [x + sx * k, z - sz * k], [x - sx * k, z + sz * k]].flatMap(([u, v]) => [[u, y0, v], [u, y1, v]]), { color });
    b.add(MAT.DARK, [tri(e + 0.014, py - 0.002, py + 0.003, 0x0d0d20), tri(e, py, py + 0.006, MARK)]);
  }
  b.node('padLights', { pivot: [c, py + 0.02, c], kind: 'scale' });
  for (const [x, z] of [[0, -0.37], [0.37, 0], [0, 0.37], [-0.37, 0], [-0.37, -0.37], [0.37, -0.37], [-0.37, 0.37], [0.37, 0.37]]) {
    b.add(MAT.LIGHT, sphere(0.026, 8, { p: [x, 0, z], color: PAL.amber, glow: 2 }), 'padLights');
  }
  b.add(MAT.LIGHT, cyl(0.035, 0.035, 0.008, 12, { p: [0, -0.012, 0], color: PAL.amber, glow: 2 }), 'padLights');
  for (const [x, z] of [[1.79, 1.79], [2.96, 1.79], [1.79, 2.96], [2.96, 2.96]]) b.add(MAT.METAL, cyl(0.02, 0.024, 0.03, 8, { p: [m(x), T + 0.03, m(z)], color: PAL.machineDark }));

  houseOrb(b, -1.25, T, 1.25);
  return b.build({ radius: 2.2 });
}
