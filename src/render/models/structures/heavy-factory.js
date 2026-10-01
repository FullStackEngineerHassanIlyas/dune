// Heavy Factory (3x2), after the Genesis "Vehicle Factory" sprite: an L-shaped lavender hall on the
// olive foundation. The west block carries the square raised housing of the concentric-ring fan (a
// turbine turns under its ring guard), blue slit lights at the housing's north-west and south-west
// corners, a finned vent on the north edge and four prongs cantilevered out of the west wall; a
// stepped, ribbed stack runs down its south leg. The taller assembly hall to the east has a radiator
// bank on its north strip and ends in a pointed prow; its roof overhangs the south wall, where a
// roll-up door slides up as a vehicle rolls out onto the open navy bay, where a four-wheeled chassis
// and a trike stand on the line: the one vehicle factory builds light and heavy alike. The house orb
// sits in the south-west corner.
import * as THREE from 'three';
import { ModelBuilder, MAT, shape, box, cbox, cyl, sphere, hull, ring } from '../kit.js';
import { PAL } from '../palette.js';
import { foundation, FOUNDATION_TOP as T, houseOrb, bolts, ladder, hazard, louvres, pipe, rod } from '../detail.js';

const BLUE = 0x0a5cff, CYAN = 0x40e8ff, WELL = 0x0b0b16, MAROON = 0x4a2121, OCHRE = 0x6b4a00, TAN = 0xdeb56b;

/** A flat plate w × d with a round hole of radius r at its centre, h thick with chamfer c, standing on y = 0. */
export function holedPlate(w, d, r, h, c, o) {
  const s = new THREE.Shape(), hw = w / 2 - c, hd = d / 2 - c;
  s.moveTo(-hw, -hd); s.lineTo(hw, -hd); s.lineTo(hw, hd); s.lineTo(-hw, hd); s.lineTo(-hw, -hd);
  s.holes.push(new THREE.Path().absarc(0, 0, r + c, 0, Math.PI * 2, true));
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * c, bevelEnabled: true, bevelSize: c, bevelThickness: c, bevelSegments: 1, curveSegments: 28 });
  g.translate(0, 0, c);
  g.rotateX(-Math.PI / 2);
  return shape(g, o);
}

/**
 * The factory fan: a square raised housing (white inner edge on the north and west) round a recessed
 * guard of concentric navy rings over a black well, with a turbine (node `fan`) turning under the rings.
 */
export function fanHousing(b, cx, cz, { w, d, r, base, h = 0.08 }) {
  const top = base + h;
  b.add(MAT.PAINT, box(w + 0.03, 0.006, d + 0.03, { p: [cx, base + 0.002, cz], color: PAL.navy }));
  b.add(MAT.PAINT, holedPlate(w, d, r + 0.03, h, 0.014, { p: [cx, base, cz], color: PAL.machine }));
  b.add(MAT.PAINT, [
    box(w - 0.09, 0.004, 0.018, { p: [cx + 0.01, top + 0.001, cz - d / 2 + 0.04], color: PAL.white }),
    box(0.018, 0.004, d - 0.09, { p: [cx - w / 2 + 0.04, top + 0.001, cz + 0.01], color: PAL.white }),
  ]);
  b.add(MAT.METAL, ring(r + 0.032, r - 0.004, h + 0.008, 28, { p: [cx, base, cz], color: PAL.machineDark }));
  b.add(MAT.DARK, cyl(r, r, 0.004, 28, { p: [cx, base + 0.004, cz], color: WELL }));
  [[r, r - 0.04, 0.012], [r - 0.07, r - 0.105, 0.026], [r - 0.135, r - 0.17, 0.04], [r - 0.2, r - 0.232, 0.054]].forEach(([ro, ri, dy]) => {
    b.add(MAT.PAINT, ring(ro, ri, 0.008, 28, { p: [cx, top - dy, cz], color: PAL.navyLight }));
  });
  b.add(MAT.PAINT, cyl(0.03, 0.036, 0.02, 12, { p: [cx, top - 0.06, cz], color: PAL.machineLight }));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    b.add(MAT.PAINT, rod([cx + c * 0.03, top - 0.058, cz + s * 0.03], [cx + c * r, top - 0.01, cz + s * r], 0.007, 4, { color: PAL.navy }));
  }
  b.node('fan', { pivot: [cx, base + 0.012, cz], param: 'fan' });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.add(MAT.PAINT, box(r - 0.06, 0.006, 0.07, { p: [Math.cos(a) * (r / 2 + 0.015), 0, Math.sin(a) * (r / 2 + 0.015)], r: [0.45, -a, 0], color: PAL.machineDark }), 'fan');
  }
}

/** A blue slit light: a diagonal slot glowing blue with a cyan core, in a navy recess lying on a roof at y. */
export function slitLight(b, x, y, z) {
  const r = [0, -Math.PI / 4, 0];
  b.add(MAT.PAINT, cbox(0.2, 0.01, 0.07, 0.004, { p: [x, y + 0.004, z], r, color: PAL.navy }));
  b.add(MAT.LIGHT, box(0.15, 0.012, 0.028, { p: [x, y + 0.006, z], r, color: BLUE, glow: 1.5 }));
  b.add(MAT.LIGHT, box(0.07, 0.014, 0.012, { p: [x - 0.01, y + 0.007, z - 0.01], r, color: CYAN, glow: 1.3 }));
}

/** A prong cantilevered west out of the wall at x0: chamfered beam with a bolt hole near its tip, a collar at the wall and a web under it. */
export function prong(b, x0, z, { len = 0.34, y = T + 0.15, w = 0.14, h = 0.11 } = {}) {
  b.add(MAT.PAINT, cbox(len, h, w, 0.026, { p: [x0 - len / 2, y, z], color: PAL.machineLight }));
  b.add(MAT.PAINT, cbox(0.06, h + 0.05, w + 0.05, 0.012, { p: [x0 - 0.025, y, z], color: PAL.machineDark }));
  b.add(MAT.DARK, cyl(0.024, 0.024, 0.012, 10, { p: [x0 - len + 0.08, y + h / 2, z], color: WELL }));
  const lo = y - h / 2;
  b.add(MAT.PAINT, hull([-0.025, 0.025].flatMap((dz) => [[x0 - 0.05, T, z + dz], [x0 - 0.05, lo, z + dz], [x0 - 0.2, lo, z + dz]]), { color: PAL.machineDark }));
}

/** A stepped stack running south, tiers [z0, z1, h] w wide at x, white-capped ribs against each riser (the first rises to `from`). */
export function steppedStack(b, x, w, tiers, from) {
  let prev = from;
  for (const [z0, z1, h] of tiers) {
    b.add(MAT.PAINT, cbox(w, h, z1 - z0 + 0.01, 0.014, { p: [x, T + h / 2, (z0 + z1) / 2 - 0.005], color: PAL.machine }));
    for (const dx of [-0.33, 0, 0.33]) {
      b.add(MAT.PAINT, cbox(0.036, prev - h + 0.02, 0.03, 0.006, { p: [x + dx * w, T + (prev + h + 0.02) / 2, z0 + 0.016], color: PAL.machineLight }));
      b.add(MAT.PAINT, box(0.036, 0.006, 0.03, { p: [x + dx * w, T + prev + 0.023, z0 + 0.016], color: PAL.white }));
    }
    prev = h;
  }
}

/** A small wheeled chassis on the assembly line, facing east, in the sprite's neutral browns and cream. */
export function chassis(b, x, z, { l = 0.38, w = 0.3, trike = false } = {}) {
  const y = T + 0.004, rw = 0.056, axle = [Math.PI / 2, 0, 0], sx = l * 0.3, sz = w / 2 - 0.03;
  const wheels = trike ? [[l * 0.36, 0], [-sx, -sz], [-sx, sz]] : [[sx, -sz], [sx, sz], [-sx, -sz], [-sx, sz]];
  for (const [dx, dz] of wheels) {
    b.add(MAT.DARK, cyl(rw, rw, 0.05, 12, { p: [x + dx, y + rw, z + dz], r: axle, color: PAL.rubber }));
    b.add(MAT.METAL, cyl(rw * 0.45, rw * 0.45, 0.056, 8, { p: [x + dx, y + rw, z + dz], r: axle, color: PAL.machineLight }));
  }
  const bw = trike ? w * 0.4 : w - 0.13;
  b.add(MAT.PAINT, cbox(l * 0.86, 0.04, bw, 0.01, { p: [x, y + 0.06, z], color: MAROON }));
  b.add(MAT.PAINT, hull([-1, 1].flatMap((s) => [
    [x - l * 0.4, y + 0.08, z + s * bw * 0.55], [x + l * 0.3, y + 0.08, z + s * bw * 0.5],
    [x - l * 0.34, y + 0.14, z + s * bw * 0.45], [x + l * 0.08, y + 0.15, z + s * bw * 0.4], [x + l * 0.3, y + 0.11, z + s * bw * 0.4],
  ]), { color: OCHRE }));
  b.add(MAT.PAINT, cbox(0.07, 0.03, bw * 0.7, 0.008, { p: [x + l * 0.02, y + 0.16, z], color: TAN }));
  b.add(MAT.METAL, box(0.02, 0.02, bw * 0.9, { p: [x + l * 0.36, y + 0.09, z], color: PAL.white }));
}

export function heavyFactory() {
  const b = new ModelBuilder('heavyFactory');
  foundation(b, 3, 2);

  // west block: fan housing, slit lights, north vent, prongs, south leg
  b.add(MAT.PAINT, cbox(0.98, 0.42, 1.13, 0.025, { p: [-0.51, T + 0.21, -0.295], color: PAL.machine }));
  fanHousing(b, -0.5, -0.28, { w: 0.82, d: 0.7, r: 0.27, base: T + 0.42 });
  for (const z of [-0.55, -0.01]) b.add(MAT.PAINT, cbox(0.07, 0.03, 0.06, 0.008, { p: [-0.155, T + 0.51, z], color: PAL.machineLight }));
  bolts(b, [[-0.88, T + 0.5, -0.6], [-0.12, T + 0.5, -0.6], [-0.88, T + 0.5, 0.04], [-0.12, T + 0.5, 0.04]], { r: 0.014, h: 0.012, color: PAL.machineDark });
  slitLight(b, -0.8, T + 0.42, -0.73);
  slitLight(b, -0.72, T + 0.42, 0.17);
  b.add(MAT.PAINT, box(0.52, 0.14, 0.08, { p: [-0.34, T + 0.39, -0.88], color: PAL.navy }));
  for (let k = 0; k < 5; k++) b.add(MAT.PAINT, cbox(0.036, 0.1, 0.17, 0.008, { p: [-0.56 + k * 0.11, T + 0.44, -0.84], color: PAL.machineLight }));
  for (const z of [-0.68, -0.43, -0.17, 0.08]) prong(b, -1.0, z);
  for (const [x, z] of [[-0.8, 0.272], [-0.82, -0.862]]) {
    b.add(MAT.DARK, box(0.16, 0.2, 0.012, { p: [x, T + 0.1, z], color: PAL.navy }));
    b.add(MAT.PAINT, box(0.19, 0.225, 0.008, { p: [x, T + 0.112, z - Math.sign(z) * 0.002], color: PAL.machineDark }));
  }
  b.add(MAT.PAINT, [
    box(0.5, 0.012, 0.008, { p: [-0.74, T + 0.3, 0.27], color: PAL.machineDark }),
    box(0.012, 0.3, 0.008, { p: [-0.62, T + 0.15, 0.27], color: PAL.machineDark }),
    box(0.012, 0.36, 0.008, { p: [-0.68, T + 0.2, -0.862], color: PAL.machineDark }),
  ]);

  steppedStack(b, -0.25, 0.46, [[0.27, 0.4, 0.34], [0.4, 0.52, 0.27], [0.52, 0.64, 0.2], [0.64, 0.76, 0.13]], 0.42);

  // assembly hall: roof overhanging the south wall on two columns, pointed prow to the east
  const H = T + 0.56, R = T + 0.66;
  b.add(MAT.PAINT, cbox(1.02, 0.56, 0.36, 0.02, { p: [0.49, T + 0.28, -0.68], color: PAL.machine }));
  b.add(MAT.PAINT, cbox(0.14, 0.56, 0.15, 0.014, { p: [0.05, T + 0.28, -0.435], color: PAL.machine }));
  b.add(MAT.PAINT, cbox(0.16, 0.56, 0.15, 0.014, { p: [0.92, T + 0.28, -0.435], color: PAL.machine }));
  b.add(MAT.PAINT, cbox(0.72, 0.3, 0.15, 0.01, { p: [0.48, T + 0.41, -0.435], color: PAL.machine }));
  b.add(MAT.PAINT, [
    box(0.018, 0.27, 0.012, { p: [0.126, T + 0.135, -0.356], color: PAL.machineDark }),
    box(0.018, 0.27, 0.012, { p: [0.834, T + 0.135, -0.356], color: PAL.machineDark }),
    box(0.72, 0.018, 0.012, { p: [0.48, T + 0.268, -0.356], color: PAL.machineDark }),
  ]);
  b.add(MAT.DARK, box(0.72, 0.26, 0.01, { p: [0.48, T + 0.13, -0.495], color: WELL }));
  b.add(MAT.PAINT, hull([[1.0, T, -0.86], [1.0, H, -0.86], [1.0, T, -0.36], [1.0, H, -0.36], [1.2, T, -0.56], [1.2, H - 0.04, -0.52]], { color: PAL.navyLight }));
  b.add(MAT.METAL, rod([1.203, T + 0.01, -0.56], [1.203, H - 0.05, -0.52], 0.012, 6, { color: PAL.machineLight }));
  for (const s of [-1, 1]) b.add(MAT.PAINT, box(0.24, 0.014, 0.012, { p: [1.1, T + 0.3, -0.54 + s * 0.12], r: [0, s * 0.92, 0], color: PAL.navy }));
  const roof = [];
  for (const y of [H, R]) roof.push([-0.04, y, -0.66], [-0.04, y, -0.24], [1.0, y, -0.66], [1.0, y, -0.24], [1.22, y, -0.45]);
  b.add(MAT.PAINT, hull(roof, { color: PAL.machine }));
  b.add(MAT.PAINT, box(1.02, 0.006, 0.02, { p: [0.47, R + 0.003, -0.64], color: PAL.white }));
  for (const x of [0.36, 0.86]) b.add(MAT.DARK, box(0.016, 0.006, 0.42, { p: [x, R + 0.002, -0.45], color: PAL.navy }));
  for (const x of [0.12, 0.61]) {
    b.add(MAT.PAINT, cbox(0.2, 0.05, 0.15, 0.012, { p: [x, R + 0.025, -0.5], color: PAL.machineLight }));
    b.add(MAT.PAINT, box(0.012, 0.006, 0.13, { p: [x - 0.09, R + 0.052, -0.5], color: PAL.white }));
  }
  for (const x of [0.05, 0.3, 0.66, 0.92]) {
    b.add(MAT.PAINT, hull([-0.02, 0.02].flatMap((dx) => [[x + dx, H, -0.36], [x + dx, H, -0.25], [x + dx, H - 0.1, -0.36]]), { color: PAL.machineDark }));
  }
  for (const x of [0.02, 0.95]) b.add(MAT.METAL, cyl(0.018, 0.022, 0.56, 8, { p: [x, T + 0.28, -0.265], color: PAL.machineLight }));
  for (const x of [0.16, 0.8]) b.add(MAT.LIGHT, sphere(0.018, 8, { p: [x, T + 0.3, -0.355], color: PAL.amber, glow: 1.8 }));
  for (const x of [0.02, 0.08, 0.88, 0.96]) b.add(MAT.PAINT, box(0.014, 0.44, 0.012, { p: [x, T + 0.28, -0.357], color: PAL.machineDark }));
  louvres(b, { w: 0.46, d: 0.09, n: 4, at: { p: [0.48, T + 0.375, -0.357], r: [Math.PI / 2, 0, 0] }, frame: PAL.machineDark, slats: PAL.machine });
  ladder(b, { h: 0.25, at: { p: [-0.036, T + 0.42, -0.78], r: [0, Math.PI / 2, 0] } });
  for (const x of [0.2, 0.5, 0.8]) b.add(MAT.PAINT, cbox(0.05, 0.52, 0.03, 0.008, { p: [x, T + 0.26, -0.868], color: PAL.machineDark }));
  pipe(b, [[0.03, T + 0.18, -0.9], [0.97, T + 0.18, -0.9]], { r: 0.024, color: PAL.machineLight, flangeColor: PAL.machineDark });

  // radiator bank on the north strip: a pipe through two pairs of discs and two white boxes
  const ry = H + 0.07, rz = -0.77, along = [0, 0, Math.PI / 2];
  b.add(MAT.METAL, cyl(0.028, 0.028, 0.96, 10, { p: [0.48, ry, rz], r: along, color: PAL.machineLight }));
  for (const x of [0.07, 0.18, 0.55, 0.66]) b.add(MAT.PAINT, cyl(0.075, 0.075, 0.036, 16, { p: [x, ry, rz], r: along, color: PAL.machine }));
  for (const x of [0.34, 0.83]) b.add(MAT.PAINT, cbox(0.14, 0.09, 0.13, 0.016, { p: [x, H + 0.045, rz], color: PAL.machineLight }));

  // the door rolls up into the lintel when a vehicle comes out
  b.node('door', { pivot: [0.48, T + 0.13, -0.39], axis: 'y', kind: 'trans' });
  b.add(MAT.PAINT, box(0.72, 0.25, 0.018, { color: PAL.machineDark }), 'door');
  for (let k = 0; k < 6; k++) b.add(MAT.PAINT, box(0.72, 0.012, 0.026, { p: [0, -0.1 + k * 0.04, 0], color: PAL.machine }), 'door');
  b.add(MAT.PAINT, box(0.72, 0.02, 0.03, { p: [0, -0.115, 0], color: PAL.navy }), 'door');

  // open navy bay with a chassis and a trike on the line
  b.add(MAT.PAINT, box(1.24, 0.012, 1.26, { p: [0.61, T - 0.002, 0.14], color: PAL.navy }));
  b.add(MAT.PAINT, [
    ...[0.3, 0.92].map((x) => box(0.012, 0.004, 0.9, { p: [x, T + 0.005, 0.32], color: PAL.navyLight })),
    box(1.2, 0.004, 0.012, { p: [0.61, T + 0.005, -0.12], color: PAL.navyLight }),
    box(0.03, 0.02, 1.26, { p: [1.225, T + 0.01, 0.14], color: PAL.machineDark }),
    box(1.24, 0.02, 0.03, { p: [0.61, T + 0.01, 0.765], color: PAL.machineDark }),
  ]);
  hazard(b, { w: 0.72, d: 0.04, n: 8, at: { p: [0.48, T + 0.004, -0.33] } });
  chassis(b, 0.49, 0.43);
  chassis(b, 1.0, 0.2, { l: 0.34, w: 0.26, trike: true });

  houseOrb(b, -1.25, T, 0.75);
  return b.build({ radius: 1.6 });
}
