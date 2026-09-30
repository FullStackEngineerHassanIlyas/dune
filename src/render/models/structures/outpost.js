// Radar Outpost (2x2), after the Genesis sprite: on the olive foundation, the octagonal radome in the
// north-east, split into four riveted lavender petals by navy seams, on a short drum; a neck block joins
// it to the west side, where the tilted radar dish with its yellow feed tripod turns on a pedestal (the
// `dish` node) beside two cable boxes. A white pipe runs from the pedestal round to the equipment
// housing south of the dome, whose south face carries a porthole, two dials with yellow needles and a
// vent; two hydraulic jacks, a yellow bar and a valve ball stand in the south-west, the house orb in its
// corner.
import { ModelBuilder, MAT, box, cbox, cyl, sphere, torus, hull, lathe, ring, place } from '../kit.js';
import { PAL } from '../palette.js';
import { foundation, FOUNDATION_TOP as T, houseOrb, pipe, rod, louvres } from '../detail.js';

const OCT = [22.5, 67.5].map((d) => (d * Math.PI) / 180);
const PROFILE = [[1, 0], [0.93, 0.4], [0.72, 0.75], [0.38, 0.96]];   // radome rings: radius and height as fractions of R and H

/** One quarter of the octagonal radome (sx, sz pick the quadrant), cut back from the seams by g. */
function petal(cx, y0, cz, R, H, sx, sz, g, color) {
  const pts = [[cx + sx * g, y0 + H, cz + sz * g]];
  for (const [fr, fh] of PROFILE) {
    const r = R * fr, y = y0 + H * fh, flat = r * Math.cos(Math.PI / 8);
    const oct = [[flat, 0], ...OCT.map((a) => [r * Math.cos(a), r * Math.sin(a)]), [0, flat], [0, 0]];
    for (const [u, v] of oct) pts.push([cx + sx * Math.max(g, u), y, cz + sz * Math.max(g, v)]);
  }
  return hull(pts, { color });
}

export function outpost() {
  const b = new ModelBuilder('outpost');
  foundation(b, 2, 2);

  // radome: drum, navy under-shell showing in the seams, four petals with rivets, a cap
  const dx = 0.44, dz = -0.45, R = 0.44, H = 0.5, y0 = T + 0.08;
  b.add(MAT.PAINT, cyl(R + 0.01, R + 0.02, 0.08, 8, { p: [dx, T + 0.04, dz], r: [0, Math.PI / 8, 0], color: PAL.machineDark }));
  b.add(MAT.PAINT, cyl(R + 0.02, R + 0.02, 0.014, 8, { p: [dx, y0 - 0.004, dz], r: [0, Math.PI / 8, 0], color: PAL.machineLight }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(MAT.DARK, petal(dx, y0, dz, R * 0.97, H * 0.97, sx, sz, 0, PAL.navy));
  const studs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.add(MAT.PAINT, petal(dx, y0, dz, R, H, sx, sz, 0.026, PAL.machine));
    for (const [fr, fh] of [[0.83, 0.575], [0.56, 0.85]]) for (const a of [0.52, 1.05]) {
      const r = R * fr * 0.99 + 0.006;
      studs.push(sphere(0.017, 6, { p: [dx + sx * r * Math.cos(a), y0 + H * fh + 0.01, dz + sz * r * Math.sin(a)], color: PAL.navy }));
    }
  }
  b.add(MAT.METAL, studs);
  b.add(MAT.METAL, cyl(0.045, 0.06, 0.03, 8, { p: [dx, y0 + H + 0.005, dz], color: PAL.navy }));

  // neck block from the dish side into the drum
  b.add(MAT.PAINT, cbox(0.4, 0.26, 0.22, 0.025, { p: [-0.03, T + 0.13, -0.73], color: PAL.machine }));
  b.add(MAT.PAINT, cbox(0.3, 0.03, 0.14, 0.01, { p: [-0.06, T + 0.27, -0.73], color: PAL.machineLight }));
  for (const x of [-0.15, 0.05]) b.add(MAT.DARK, box(0.012, 0.18, 0.01, { p: [x, T + 0.12, -0.617], color: PAL.navy }));

  // equipment housing south of the dome: chamfered block, roof plate, dials, porthole and vent facing south
  const hx0 = 0.02, hx1 = 0.84, hz0 = -0.02, hz1 = 0.52, hy = T + 0.27, c = 0.09;
  const plan = (i) => [[hx0 + i, hz0 + i], [hx1 - i, hz0 + i], [hx1 - i, hz1 - c - i], [hx1 - c - i, hz1 - i], [hx0 + c + i, hz1 - i], [hx0 + i, hz1 - c - i]];
  b.add(MAT.PAINT, hull([...plan(0).map(([x, z]) => [x, T, z]), ...plan(0.03).map(([x, z]) => [x, hy, z])], { color: PAL.machine }));
  b.add(MAT.PAINT, hull([...plan(0.06).map(([x, z]) => [x, hy, z]), ...plan(0.09).map(([x, z]) => [x, hy + 0.03, z])], { color: PAL.machineLight }));
  b.add(MAT.PAINT, ring(0.085, 0.06, 0.03, 14, { p: [0.24, hy + 0.03, 0.28], color: PAL.machine }));
  b.add(MAT.DARK, cyl(0.062, 0.062, 0.02, 14, { p: [0.24, hy + 0.035, 0.28], color: PAL.navy }));
  b.add(MAT.METAL, box(0.1, 0.012, 0.016, { p: [0.24, hy + 0.05, 0.28], color: PAL.machineLight }));
  louvres(b, { w: 0.2, d: 0.14, n: 4, at: { p: [0.6, hy + 0.03, 0.3] }, frame: PAL.machineDark, slats: PAL.machine });
  b.add(MAT.PAINT, cbox(0.16, 0.05, 0.08, 0.012, { p: [0.62, hy + 0.055, 0.1], color: PAL.machineDark }));
  const face = hz1 - 0.012, south = [Math.PI / 2, 0, 0];
  b.add(MAT.DARK, cyl(0.065, 0.065, 0.02, 14, { p: [0.2, T + 0.17, face], r: south, color: PAL.navy }));
  b.add(MAT.METAL, torus(0.07, 0.014, 5, 14, { p: [0.2, T + 0.17, face + 0.012], color: PAL.machineLight }));
  for (const x of [0.42, 0.63]) {
    b.add(MAT.METAL, cyl(0.075, 0.075, 0.024, 14, { p: [x, T + 0.17, face], r: south, color: PAL.navy }));
    b.add(MAT.PAINT, cyl(0.058, 0.058, 0.03, 14, { p: [x, T + 0.17, face + 0.004], r: south, color: PAL.white }));
    b.add(MAT.DARK, box(0.07, 0.03, 0.012, { p: [x, T + 0.155, face + 0.021], color: 0x15151c }));
    b.add(MAT.PAINT, box(0.012, 0.05, 0.01, { p: [x, T + 0.18, face + 0.028], r: [0, 0, 0.3], color: PAL.yellow }));
  }
  louvres(b, { w: 0.12, d: 0.08, n: 3, at: { p: [0.21, T + 0.07, face + 0.004], r: south }, frame: PAL.machineDark, slats: PAL.machineLight });
  b.add(MAT.PAINT, cbox(0.1, 0.12, 0.03, 0.01, { p: [0.84, T + 0.08, 0.3], r: [0, Math.PI / 2, 0], color: PAL.machineDark }));

  // dish pedestal, cable boxes, the white pipe round to the housing
  const px = -0.55, pz = -0.46, py = T + 0.3;
  b.add(MAT.PAINT, cbox(0.18, 0.06, 0.18, 0.02, { p: [px, T + 0.03, pz], color: PAL.machineDark }));
  b.add(MAT.PAINT, cyl(0.05, 0.07, py - T - 0.06, 10, { p: [px, T + 0.06 + (py - T - 0.06) / 2, pz], color: PAL.machine }));
  for (const z of [-0.375, -0.125]) {
    b.add(MAT.PAINT, cbox(0.13, 0.12, 0.18, 0.02, { p: [-0.875, T + 0.06, z], color: PAL.machine }));
    b.add(MAT.PAINT, cbox(0.09, 0.02, 0.14, 0.006, { p: [-0.875, T + 0.125, z], color: PAL.machineLight }));
  }
  pipe(b, [[-0.81, T + 0.05, -0.375], [-0.64, T + 0.05, -0.43]], { r: 0.014, color: PAL.machineDark, flanges: 'none' });
  pipe(b, [[px - 0.03, T + 0.13, pz + 0.05], [-0.66, T + 0.05, -0.24], [-0.66, T + 0.05, -0.02], [-0.6, T + 0.05, 0.03], [hx0 + 0.01, T + 0.05, 0.03]], { r: 0.042, color: 0xd6d3e2, flangeColor: PAL.machineLight, mat: MAT.PAINT });

  // hydraulic jacks, yellow bar, valve ball
  for (const x of [-0.39, -0.15]) {
    b.add(MAT.PAINT, cbox(0.1, 0.03, 0.1, 0.01, { p: [x, T + 0.015, 0.33], color: PAL.white }));
    b.add(MAT.PAINT, cyl(0.036, 0.036, 0.13, 10, { p: [x, T + 0.095, 0.33], color: PAL.machine }));
    b.add(MAT.METAL, cyl(0.018, 0.018, 0.1, 8, { p: [x, T + 0.2, 0.33], color: PAL.steel }));
    b.add(MAT.PAINT, cyl(0.04, 0.04, 0.025, 10, { p: [x, T + 0.25, 0.33], color: PAL.white }));
    pipe(b, [[x, T + 0.05, 0.27], [x, T + 0.05, 0.07]], { r: 0.016, color: PAL.machineLight, flanges: 'none' });
  }
  b.add(MAT.PAINT, cbox(0.24, 0.035, 0.035, 0.008, { p: [-0.64, T + 0.07, 0.2], color: PAL.yellow }));
  for (const x of [-0.74, -0.54]) b.add(MAT.METAL, cyl(0.01, 0.01, 0.06, 6, { p: [x, T + 0.03, 0.2], color: PAL.machineDark }));
  b.add(MAT.METAL, cyl(0.04, 0.045, 0.03, 10, { p: [-0.19, T + 0.015, 0.58], color: PAL.machineDark }));
  b.add(MAT.PAINT, sphere(0.06, 12, { p: [-0.19, T + 0.08, 0.58], color: PAL.machineLight }));

  // the dish: navy-faced paraboloid with a white rim, tilted west on its yoke, yellow feed tripod
  b.node('dish', { pivot: [px, py, pz] });
  const tilt = 0.9, bowl = [[0.012, 0], [0.1, 0.012], [0.18, 0.042], [0.25, 0.085], [0.265, 0.095]];
  const at = { p: [-0.03, 0.08, 0], r: [0, 0, tilt] };
  b.add(MAT.PAINT, place(lathe([...bowl].reverse(), 20, { color: PAL.navyLight }), at), 'dish');
  b.add(MAT.PAINT, place(lathe(bowl.map(([r, y]) => [r, y - 0.012]), 20, { color: PAL.machine }), at), 'dish');
  b.add(MAT.PAINT, place(torus(0.265, 0.012, 5, 20, { p: [0, 0.092, 0], r: [Math.PI / 2, 0, 0], color: PAL.white }), at), 'dish');
  b.add(MAT.PAINT, place(ring(0.05, 0.02, 0.02, 10, { p: [0, 0.005, 0], color: PAL.machineLight }), at), 'dish');
  const focus = [0, 0.25, 0], struts = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    struts.push(rod([Math.cos(a) * 0.24, 0.08, Math.sin(a) * 0.24], focus, 0.009, 5, { color: PAL.yellow }));
  }
  struts.push(cyl(0.022, 0.03, 0.06, 8, { p: [0, 0.25, 0], color: PAL.yellow }));
  b.add(MAT.PAINT, place(struts, at), 'dish');
  b.add(MAT.METAL, [cbox(0.1, 0.07, 0.12, 0.012, { p: [0, 0.02, 0], color: PAL.machineDark }), cyl(0.02, 0.02, 0.16, 8, { p: [0, 0.05, 0], r: [Math.PI / 2, 0, 0], color: PAL.steel })], 'dish');

  houseOrb(b, -0.75, T, 0.75);
  return b.build({ radius: 1.0 });
}
