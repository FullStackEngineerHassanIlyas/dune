// Wind Trap (2x2), after the Genesis sprite: a red-brick floor laid in big square pads with small
// bricks between them, and three gold wind-catcher hoods in a triangle (north-west, east, south), each
// seated on a bolted bronze turntable collar. A hood is a ribbed parabolic dome whose back is to the
// north-west; its south-east side opens under a gold brow into a black louvred mouth, over an intake pit
// where a turbine turns (the `fan` nodes). Lavender clamps and a valve hold each collar; the house orb
// sits in the south-west corner.
import * as THREE from 'three';
import { ModelBuilder, MAT, box, cbox, cyl, ring, torus, shape, place } from '../kit.js';
import { PAL } from '../palette.js';
import { houseOrb, bolts } from '../detail.js';

const GOLD = 0xf0a412, GOLD_LIGHT = 0xffcf5a, BRONZE = 0x6b4a00, BRONZE_LIGHT = 0x946b21, MOUTH = 0x0a0806;
const BRICK = 0x5a2620, MORTAR = 0xc9a262, JOINT = 0x230806;
const T = 0.06;   // brick top
const SE = Math.PI / 4;   // yaw that turns a south-facing (+z) piece to face south-east
const BROW = 0.7;   // polar angle where the hood's crown ends above the mouth

/** Turn a shaped geometry inside out: reversed winding and normals, for the inner face of a shell. */
function inward(g) {
  for (const name of ['position', 'normal', 'uv', 'color']) {
    const a = g.attributes[name], n = a.itemSize;
    for (let t = 0; t < a.count; t += 3) for (let k = 0; k < n; k++) {
      const v = a.array[(t + 1) * n + k]; a.array[(t + 1) * n + k] = a.array[(t + 2) * n + k]; a.array[(t + 2) * n + k] = v;
    }
  }
  const nr = g.attributes.normal.array;
  for (let i = 0; i < nr.length; i++) nr[i] = -nr[i];
  return g;
}

/** Part of an ellipsoid of radius r and height h: its north-west half, or its south-east crown down to the brow. */
const shell = (r, h, p, color, front = false) => shape(front
  ? new THREE.SphereGeometry(r, 12, 3, 0.25 * Math.PI, Math.PI, 0, BROW)
  : new THREE.SphereGeometry(r, 20, 7, -0.75 * Math.PI - 0.1, Math.PI + 0.2, 0, Math.PI / 2), { p, s: [1, h / r, 1], color });

/** One wind-catcher: collar, intake pit and turbine, hood shell with ribs and lip, louvred mouth. */
function cowl(b, x, z, r, h, fan) {
  const rc = r + 0.045;
  b.add(MAT.PAINT, ring(rc, r - 0.02, 0.045, 24, { p: [x, T, z], color: BRONZE }));
  b.add(MAT.METAL, torus(rc - 0.004, 0.008, 4, 24, { p: [x, T + 0.045, z], r: [Math.PI / 2, 0, 0], color: BRONZE_LIGHT }));
  const studs = [];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; studs.push([x + Math.cos(a) * (rc - 0.03), T + 0.05, z + Math.sin(a) * (rc - 0.03)]); }
  bolts(b, studs, { r: 0.012, h: 0.012, color: 0x3a2600 });
  b.add(MAT.DARK, cyl(r - 0.02, r - 0.02, 0.02, 20, { p: [x, T + 0.01, z], color: MOUTH }));

  // turbine in the intake pit, in front of the mouth
  const fx = x + Math.cos(SE) * r * 0.42, fz = z + Math.sin(SE) * r * 0.42, fr = r * 0.4;
  b.add(MAT.METAL, ring(fr + 0.02, fr, 0.03, 16, { p: [fx, T + 0.02, fz], color: PAL.machineDark }));
  b.node(fan, { pivot: [fx, T + 0.035, fz], param: 'fan' });
  const blades = [cyl(0.03, 0.036, 0.03, 10, { color: PAL.machineLight })];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    blades.push(place(box(fr * 0.8, 0.008, 0.045, { r: [0.5, 0, 0], color: PAL.machine }), { p: [Math.cos(a) * fr * 0.5, 0, Math.sin(a) * fr * 0.5], r: [0, -a, 0] }));
  }
  b.add(MAT.METAL, blades, fan);

  // hood: gold outer shell (back half and crown), dark inner shell, ribs parallel to the mouth, lips round the mouth
  const hp = [x, T + 0.04, z], k = h / r, yb = h * Math.cos(BROW);
  for (const front of [false, true]) {
    b.add(MAT.PAINT, shell(r, h, hp, GOLD, front));
    b.add(MAT.DARK, inward(shell(r - 0.02, h - 0.02, hp, MOUTH, front)));
  }
  for (const [d, t] of [[-0.1, 0.014], [-0.2, 0.014], [-0.28, 0.012]]) {
    const rr = Math.sqrt(Math.max(0.001, r * r - d * d));
    b.add(MAT.METAL, torus(rr + 0.004, t, 5, 18, { p: [x + Math.cos(SE) * d, T + 0.04, z + Math.sin(SE) * d], r: [0, SE, 0], s: [1, k, 1], color: GOLD_LIGHT }, Math.PI));
  }
  for (const yaw of [SE, SE + Math.PI]) b.add(MAT.METAL, torus(r + 0.006, 0.024, 5, 6, { p: hp, r: [0, yaw, 0], s: [1, k, 1], color: BRONZE_LIGHT }, Math.PI / 2 - BROW));
  b.add(MAT.METAL, place(torus(r * Math.sin(BROW) + 0.01, 0.024, 5, 12, { r: [Math.PI / 2, 0, 0], color: BRONZE_LIGHT }, Math.PI), { p: [x, T + 0.04 + yb, z], r: [0, SE, 0] }));
  // mouth: louvre slats across the opening under the brow
  for (let i = 0; i < 5; i++) {
    const y = h * (0.12 + i * 0.15), w = 2 * r * Math.sqrt(Math.max(0, 1 - (y / h) ** 2)) * 0.86;
    b.add(MAT.PAINT, place(box(w, 0.01, 0.06, { r: [-0.7, 0, 0], color: 0x34343f }), { p: [x - Math.cos(SE) * 0.035, T + 0.04 + y, z - Math.sin(SE) * 0.035], r: [0, SE, 0] }));
  }
}

export function windtrap() {
  const b = new ModelBuilder('windtrap');
  // brick floor: a dark base below ground, mortar bed, raised bricks (big pads under the hoods)
  b.add(MAT.PAINT, box(1.98, 0.1, 1.98, { p: [0, -0.02, 0], color: JOINT }));
  b.add(MAT.PAINT, cbox(1.97, 0.04, 1.97, 0.02, { p: [0, 0.02, 0], color: MORTAR }));
  const bricks = [
    [0, 0, 1, 1], [1, 0, 1.5, 0.25], [1.5, 0, 2, 0.25], [1, 0.25, 2, 1], [0.5, 1, 1.5, 2],
    [0, 1, 0.5, 1.25], [0, 1.25, 0.25, 1.5], [0.25, 1.25, 0.5, 1.5], [0, 1.5, 0.5, 1.75], [0, 1.75, 0.25, 2], [0.25, 1.75, 0.5, 2],
    [1.5, 1, 2, 1.25], [1.5, 1.25, 1.75, 1.5], [1.75, 1.25, 2, 1.5], [1.5, 1.5, 2, 1.75], [1.5, 1.75, 1.75, 2], [1.75, 1.75, 2, 2],
  ];
  const f = 0.975;   // brick plan in sprite tiles from the north-west corner, pulled in off the rim
  bricks.forEach(([x0, z0, x1, z1], i) => b.add(MAT.PAINT, cbox((x1 - x0) * f - 0.022, 0.03, (z1 - z0) * f - 0.022, 0.008,
    { p: [((x0 + x1) / 2 - 1) * f, T - 0.015, ((z0 + z1) / 2 - 1) * f], color: i % 3 ? BRICK : 0x50211b })));

  cowl(b, -0.5, -0.5, 0.34, 0.54, 'fan');
  cowl(b, 0.47, -0.22, 0.37, 0.6, 'fan2');
  cowl(b, -0.03, 0.47, 0.36, 0.58, 'fan3');

  // lavender clamps: a valve on the north-east of each collar, an L-bracket on its south-east
  for (const [x, z, r] of [[-0.5, -0.5, 0.34], [0.47, -0.22, 0.37], [-0.03, 0.47, 0.36]]) {
    const vx = x + r * 0.8, vz = z - r * 0.8;
    b.add(MAT.PAINT, cbox(0.06, 0.1, 0.06, 0.01, { p: [vx, T + 0.05, vz], color: PAL.machine }));
    for (const dz of [-0.018, 0.018]) b.add(MAT.METAL, box(0.07, 0.016, 0.014, { p: [vx + 0.035, T + 0.07 + dz, vz], color: PAL.machineLight }));
    const lx = x + r * 0.78, lz = z + r * 0.78;
    b.add(MAT.PAINT, cbox(0.1, 0.05, 0.03, 0.008, { p: [lx, T + 0.025, lz + 0.04], color: PAL.machine }));
    b.add(MAT.PAINT, cbox(0.03, 0.05, 0.1, 0.008, { p: [lx + 0.04, T + 0.025, lz], color: PAL.machine }));
  }

  houseOrb(b, -0.75, T, 0.75);
  return b.build({ radius: 1.0 });
}
