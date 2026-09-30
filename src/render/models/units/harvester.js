// Spice Harvester, after the Genesis sprite: the biggest ground unit, a long rounded capsule painted all
// over in the house colour. Its long edges are broad fillets, so the lit flank carries the highlight
// tone in one long band and the far one the shadow tone; the plan narrows to a rounded hood with a dark
// visor slot and two lamps, and a smaller rounded cowl juts out ahead of it over the intake, where a
// toothed drum spins (`drum`). The raised deck plate is cut with the sprite's key-shaped recess (a bar
// across, a stem running aft) and two vent slots behind it; three grab slots run along each upper
// flank. Low bolted skirts half hide the tracks and their road wheels; the square rear face has three
// dark ports.
import * as THREE from 'three';
import { ModelBuilder, MAT, shape, box, cbox, cyl, hull, prism } from '../kit.js';
import { PAL } from '../palette.js';
import { trackUnit, bolts } from '../detail.js';

const HW = 0.345, R = 0.14, TOP = 0.38, NOSE = 0.14, TIP = 0.48, REAR = -0.535;
const RECESS = 0x505050;   // grey on HOUSE parts: the dark house tone of recess floors

/** Half-width, top and bottom of the body at x: full width aft of NOSE, then the hood narrows and dips. */
function station(x) {
  if (x <= NOSE) return { hw: HW, top: TOP, bottom: 0.1 };
  const t = Math.min(1, (x - NOSE) / (TIP - NOSE));
  return { hw: HW * Math.sqrt(1 - 0.88 * t * t), top: TOP - 0.09 * t ** 1.6, bottom: 0.1 + 0.05 * Math.max(0, (x - 0.34) / (TIP - 0.34)) };
}

/** Cross-section at x: upright sides, then a fillet of R (narrowed with the plan) into the flat top. */
function section(x, { hw, top, bottom }, inset = 0) {
  hw -= inset; top -= inset; bottom += inset;
  const rz = R * Math.min(1, hw / HW), ry = Math.min(R, (top - bottom) * 0.7), pts = [];
  for (const s of [-1, 1]) {
    pts.push([x, bottom, s * hw]);
    for (let k = 0; k <= 4; k++) { const a = (k / 4) * Math.PI / 2; pts.push([x, top - ry + Math.sin(a) * ry, s * (hw - rz + Math.cos(a) * rz)]); }
  }
  return pts;
}

/** Flat plate of thickness t on y = 0 from an [x, z] outline with holes, every edge chamfered by c. */
function holedPlate(outline, holes, t, c, o) {
  const v = (pts) => pts.map(([x, z]) => new THREE.Vector2(x, -z));
  const cw = THREE.ShapeUtils.isClockWise(v(outline));   // holes must wind the other way, or their bevels undercut
  const s = new THREE.Shape(v(outline));
  s.holes = holes.map((h) => new THREE.Path(THREE.ShapeUtils.isClockWise(v(h)) === cw ? v(h).reverse() : v(h)));
  const g = new THREE.ExtrudeGeometry(s, { depth: t - 2 * c, bevelEnabled: true, bevelSize: c, bevelThickness: c, bevelSegments: 1, curveSegments: 4 });
  g.rotateX(-Math.PI / 2).translate(0, c, 0);
  return shape(g, o);
}
const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

export function harvester() {
  const b = new ModelBuilder('harvester');

  // tracks under the body, a dark belly between them
  for (const s of [-1, 1]) trackUnit(b, { length: 1.0, h: 0.12, w: 0.12, z: s * 0.272, outer: s, wheels: 5, color: PAL.navy });
  b.add(MAT.DARK, box(0.86, 0.06, 0.42, { p: [-0.07, 0.08, 0], color: PAL.navy }));

  // the capsule: stations from the bevelled rear to the tip of the hood
  const pts = [...section(REAR, station(REAR), 0.016), ...section(REAR + 0.018, station(0))];
  for (let k = 0; k <= 6; k++) { const x = NOSE + ((TIP - NOSE) * k) / 6; pts.push(...section(x, station(x))); }
  pts.push(...section(TIP + 0.012, station(TIP), 0.014));
  b.add(MAT.HOUSE, hull(pts));

  // raised deck plate with the key-shaped recess and two vent slots, dark floors under them
  const key = [[0.13, -0.125], [0.13, 0.105], [0.05, 0.105], [0.05, -0.025], [-0.15, -0.025], [-0.15, -0.125]];
  const vents = [-0.215, -0.315].map((x) => rect(x - 0.03, x + 0.03, -0.11, 0.07));
  b.add(MAT.HOUSE, holedPlate(rect(REAR + 0.035, NOSE, -HW + R + 0.012, HW - R - 0.012), [key, ...vents], 0.05, 0.018, { p: [0, TOP - 0.004, 0] }));
  b.add(MAT.HOUSE, box(0.3, 0.004, 0.25, { p: [-0.01, TOP + 0.002, -0.01], color: RECESS }));
  for (const x of [-0.215, -0.315]) b.add(MAT.HOUSE, box(0.07, 0.004, 0.2, { p: [x, TOP + 0.002, -0.02], color: RECESS }));

  // hood: dark visor slot across it, a seam running back to the key
  const vx = 0.41, { top: vt } = station(vx), slope = Math.atan2(station(vx + 0.01).top - station(vx - 0.01).top, 0.02);
  b.add(MAT.GLASS, cbox(0.05, 0.014, 0.18, 0.005, { p: [vx, vt + 0.001, 0], r: [0, 0, slope], color: PAL.glass }));
  for (const z of [-0.068, 0.068]) {
    b.add(MAT.DARK, cbox(0.008, 0.03, 0.056, 0.003, { p: [TIP + 0.013, 0.238, z], color: PAL.navy }));
    b.add(MAT.GLASS, cbox(0.008, 0.016, 0.042, 0.003, { p: [TIP + 0.016, 0.238, z], color: PAL.machineLight }));
  }
  b.add(MAT.HOUSE, cbox(0.18, 0.012, 0.03, 0.004, { p: [0.24, station(0.24).top - 0.002, -0.06], r: [0, 0, Math.atan2(station(0.3).top - station(0.18).top, 0.12)], color: RECESS }));

  // grab slots along the upper flanks
  const fz = HW - R + Math.cos(Math.PI * 3 / 16) * R, fy = TOP - R + Math.sin(Math.PI * 3 / 16) * R;
  for (const s of [-1, 1]) for (const x of [-0.36, -0.12, 0.1]) {
    b.add(MAT.HOUSE, cbox(0.07, 0.01, 0.034, 0.003, { p: [x, fy, s * fz], r: [s * (Math.PI / 2 - Math.PI * 3 / 16), 0, 0], color: 0x3a3a3a }));
  }

  // bolted skirts in four plates a side
  for (const s of [-1, 1]) {
    const heads = [];
    for (const x of [-0.4, -0.19, 0.02, 0.23]) {
      b.add(MAT.HOUSE, cbox(0.2, 0.085, 0.022, 0.008, { p: [x, 0.117, s * (HW + 0.003)] }));
      heads.push([x - 0.065, 0.14, s * (HW + 0.015)], [x + 0.065, 0.14, s * (HW + 0.015)]);
    }
    bolts(b, heads, { r: 0.009, h: 0.008, axis: 'z', color: PAL.machine });
  }

  // square rear with three dark ports
  for (const z of [-0.14, 0, 0.14]) {
    b.add(MAT.DARK, cbox(0.012, 0.07, 0.07, 0.004, { p: [REAR - 0.004, 0.26, z], color: PAL.navy }));
    b.add(MAT.METAL, cbox(0.006, 0.086, 0.086, 0.003, { p: [REAR - 0.001, 0.26, z], color: PAL.machineDark }));
  }

  // intake: dark throat, side cheeks, the rounded cowl over the drum
  b.add(MAT.DARK, box(0.08, 0.13, 0.25, { p: [0.4, 0.085, 0], color: PAL.navy }));
  for (const s of [-1, 1]) b.add(MAT.HOUSE, prism([[0.36, 0.014], [0.49, 0.014], [0.515, 0.04], [0.515, 0.1], [0.36, 0.16]], 0.02, { p: [0, 0, s * 0.128] }, 0.006));
  const cowl = [];
  for (const [z, r] of [[-0.125, 0.09], [-0.11, 0.105], [0.11, 0.105], [0.125, 0.09]]) {
    for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 0.62; cowl.push([0.445 + Math.cos(a) * r, 0.1 + Math.sin(a) * r, z]); }
    cowl.push([0.4, 0.1, z]);
  }
  b.add(MAT.HOUSE, hull(cowl));

  b.node('drum', { pivot: [0.465, 0.07, 0], axis: 'z' });
  b.add(MAT.METAL, cyl(0.042, 0.042, 0.25, 12, { r: [Math.PI / 2, 0, 0], color: PAL.machineDark }), 'drum');
  for (let k = 0; k < 6; k++) for (let j = 0; j < 4; j++) {
    const a = (k / 6) * Math.PI * 2 + j * 0.5, z = -0.09 + j * 0.06;
    b.add(MAT.METAL, box(0.03, 0.022, 0.04, { p: [Math.cos(a) * 0.05, Math.sin(a) * 0.05, z], r: [0, 0, a], color: PAL.machineLight }), 'drum');
  }
  return b.build({ radius: 0.66 });
}
