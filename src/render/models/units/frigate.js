// Frigate, after the PC card (the Genesis has no art for it): a big CHOAM cargo ship in the Carryall's
// white, lavender and navy. A lavender belt with round ports and ribs carries a white hipped roof with
// a long sloping nose, bridge glazing, vents and a raised hatch with two red lamps and a small house
// delivery stripe; the cargo ramp is outlined on the bow. Two ribbed main engines glow at the stern
// and four lift thrusters under the belly; four jointed landing legs with knee hubs, hydraulic rams
// and foot pads reach the ground when it hovers 0.45 over the Starport. Faces +x.
import { ModelBuilder, MAT, box, cbox, cyl, sphere, torus, hull } from '../kit.js';
import { PAL } from '../palette.js';
import { louvres, rod, bolts } from '../detail.js';

const WHITE = 0xcfd0d8, LAV = PAL.machineLight, LAV_DARK = PAL.machine, NAVY = PAL.navy, BLACK = 0x0a0a12;
const along = [0, 0, -Math.PI / 2], across = [Math.PI / 2, 0, 0];
const L = 1.2, W = 0.72, BOW = 0.4, MID = 0.3, BELT = 0.3, TOP = 0.6, PX0 = -0.78, PZ = 0.38;

export function frigate() {
  const b = new ModelBuilder('frigate');

  // plan: straight sides aft of MID, the bow tapering to half-width BOW; the roof rises to a plateau
  const side = (x) => (x <= MID ? W : W - ((x - MID) * (W - BOW)) / (L - MID));
  const ring = (t, grow = 0) => {   // roof cross-section at fraction t of its height
    const y = BELT + t * (TOP - BELT), zs = W - t * (W - PZ) + grow, zb = BOW - t * (BOW - PZ) + grow;
    return [[-L + t * (L + PX0) - grow, y, -zs], [-L + t * (L + PX0) - grow, y, zs], [MID, y, -zs], [MID, y, zs], [L - t * (L - MID) + grow, y, -zb], [L - t * (L - MID) + grow, y, zb]];
  };

  // lavender belt: ports, ribs, seam, bolts
  b.add(MAT.PAINT, hull([...ring(0).map(([x, , z]) => [x * 0.97, 0.02, z * 0.95]), ...ring(0).map(([x, , z]) => [x, 0.07, z]), ...ring(0)], { color: LAV }));
  b.add(MAT.DARK, hull([...ring(0, 0.004).map(([x, , z]) => [x, BELT - 0.036, z]), ...ring(0, 0.004).map(([x, , z]) => [x, BELT - 0.024, z])], { color: NAVY }));
  for (const s of [-1, 1]) {
    for (const x of [-0.72, -0.24, 0.24]) {
      b.add(MAT.DARK, cyl(0.075, 0.075, 0.01, 14, { p: [x, 0.15, s * (W + 0.002)], r: across, color: BLACK }));
      b.add(MAT.METAL, torus(0.08, 0.016, 4, 14, { p: [x, 0.15, s * (W + 0.004)], color: LAV_DARK }));
    }
    for (const x of [-0.96, -0.48, 0, 0.44]) b.add(MAT.METAL, box(0.04, 0.2, 0.02, { p: [x, 0.16, s * (side(x) + 0.005)], r: [0, x > MID ? s * Math.atan((W - BOW) / (L - MID)) : 0, 0], color: LAV_DARK }));
    bolts(b, [-1.05, -0.84, -0.6, -0.36, -0.12, 0.12].map((x) => [x, 0.235, s * (W + 0.004)]), { axis: 'z', r: 0.012, h: 0.01, color: LAV_DARK });
  }

  // white hipped roof: seam bands, bridge glazing on the bow slope, vents, hatch and lamps, house stripe
  b.add(MAT.PAINT, hull([...ring(0), ...ring(0.94), ...ring(1, -0.03)], { color: WHITE }));
  for (const t of [0.32, 0.66]) b.add(MAT.DARK, hull([...ring(t, 0.005), ...ring(t + 0.035, 0.005)], { color: NAVY }));
  const slope = (x) => TOP - ((x - MID) * (TOP - BELT)) / (L - MID), half = (y) => PZ + ((TOP - y) * (BOW - PZ)) / (TOP - BELT);
  const gl = [];
  for (const x of [0.43, 0.6]) { const y = slope(x), z = half(y) - 0.07; gl.push([x, y + 0.008, -z], [x, y + 0.008, z], [x, y - 0.02, -z], [x, y - 0.02, z]); }
  b.add(MAT.GLASS, hull(gl, { color: 0x10183a }));
  for (const z of [-0.14, 0, 0.14]) b.add(MAT.PAINT, hull([[0.42, slope(0.42) + 0.012, z - 0.012], [0.42, slope(0.42) + 0.012, z + 0.012], [0.61, slope(0.61) + 0.012, z - 0.012], [0.61, slope(0.61) + 0.012, z + 0.012], [0.42, slope(0.42) - 0.02, z], [0.61, slope(0.61) - 0.02, z]], { color: WHITE }));
  b.add(MAT.PAINT, cbox(0.8, 0.06, 0.44, 0.02, { p: [-0.25, TOP + 0.03, 0], color: LAV }));
  b.add(MAT.PAINT, cbox(0.52, 0.04, 0.28, 0.015, { p: [-0.29, TOP + 0.075, 0], color: WHITE }));
  b.add(MAT.DARK, box(0.012, 0.006, 0.28, { p: [-0.29, TOP + 0.096, 0], color: NAVY }));
  b.add(MAT.HOUSE, box(0.07, 0.014, 2 * PZ - 0.08, { p: [0.2, TOP + 0.006, 0] }));
  for (const z of [-0.12, 0.12]) {
    b.add(MAT.METAL, cyl(0.03, 0.034, 0.02, 10, { p: [0.09, TOP + 0.07, z], color: LAV_DARK }));
    b.add(MAT.LIGHT, sphere(0.024, 8, { p: [0.09, TOP + 0.09, z], color: PAL.redGlow, glow: 1.8 }));
  }
  for (const z of [-0.29, 0.29]) louvres(b, { w: 0.34, d: 0.1, n: 4, at: { p: [-0.55, TOP, z] }, frame: LAV_DARK, slats: LAV });
  b.add(MAT.METAL, rod([-0.72, TOP, 0], [-0.72, TOP + 0.2, 0], 0.012, 6, { color: LAV_DARK }));
  b.add(MAT.METAL, cyl(0.05, 0.02, 0.025, 10, { p: [-0.72, TOP + 0.2, 0], r: [0.5, 0, 0], color: LAV }));

  // bow: cargo ramp outline and hinges; stern: two ribbed main engines
  b.add(MAT.PAINT, cbox(0.03, 0.2, 0.56, 0.01, { p: [L + 0.006, 0.14, 0], color: LAV_DARK }));
  for (const [y, h, z, d] of [[0.245, 0.012, 0, 0.58], [0.035, 0.012, 0, 0.58], [0.14, 0.21, -0.29, 0.012], [0.14, 0.21, 0.29, 0.012]]) b.add(MAT.DARK, box(0.034, h, d, { p: [L + 0.008, y, z], color: NAVY }));
  for (const z of [-0.18, 0.18]) b.add(MAT.METAL, cyl(0.022, 0.022, 0.1, 8, { p: [L + 0.02, 0.04, z], r: across, color: LAV }));
  for (const z of [-0.4, 0.4]) {
    b.add(MAT.METAL, cyl(0.13, 0.15, 0.16, 16, { p: [-L - 0.07, 0.16, z], r: along, color: LAV_DARK }));
    for (const dx of [-0.02, -0.07, -0.12]) b.add(MAT.METAL, cyl(0.152, 0.152, 0.018, 16, { p: [-L + dx, 0.16, z], r: along, color: LAV }));
    b.add(MAT.DARK, cyl(0.105, 0.105, 0.01, 16, { p: [-L - 0.152, 0.16, z], r: along, color: BLACK }));
    b.add(MAT.LIGHT, cyl(0.07, 0.07, 0.01, 12, { p: [-L - 0.156, 0.16, z], r: along, color: PAL.orangeGlow, glow: 1.6 }));
  }

  // lift thrusters under the belly
  for (const [x, z] of [[0.55, 0.3], [0.55, -0.3], [-0.6, 0.42], [-0.6, -0.42]]) {
    b.add(MAT.METAL, cyl(0.1, 0.12, 0.07, 14, { p: [x, -0.015, z], color: LAV_DARK }));
    b.add(MAT.LIGHT, cyl(0.075, 0.075, 0.01, 12, { p: [x, -0.052, z], color: PAL.orangeGlow, glow: 1.8 }));
  }

  // jointed landing legs: upper strut, knee hub, lower strut, hydraulic ram, foot pad
  for (const sx of [-1, 1]) for (const s of [-1, 1]) {
    const x = sx > 0 ? 0.5 : -0.8, e = side(x), hip = [x, 0.14, s * (e - 0.02)], knee = [x, -0.08, s * (e + 0.2)], foot = [x, -0.38, s * (e + 0.22)];
    b.add(MAT.PAINT, hull([[x - 0.065, hip[1] + 0.05, hip[2]], [x + 0.065, hip[1] + 0.05, hip[2]], [x - 0.065, hip[1] - 0.07, hip[2]], [x + 0.065, hip[1] - 0.07, hip[2]],
      [x - 0.05, knee[1] + 0.045, knee[2]], [x + 0.05, knee[1] + 0.045, knee[2]], [x - 0.05, knee[1] - 0.04, knee[2] - s * 0.03], [x + 0.05, knee[1] - 0.04, knee[2] - s * 0.03]], { color: WHITE }));
    b.add(MAT.METAL, cyl(0.075, 0.075, 0.13, 14, { p: knee, r: along, color: LAV }));
    b.add(MAT.METAL, cyl(0.036, 0.036, 0.138, 10, { p: knee, r: along, color: LAV_DARK }));
    b.add(MAT.METAL, rod(knee, foot, 0.04, 10, { color: LAV }));
    b.add(MAT.METAL, cyl(0.048, 0.048, 0.06, 10, { p: [x, knee[1] - 0.12, foot[2] - s * 0.01], color: LAV_DARK }));
    b.add(MAT.METAL, rod([x, 0.02, s * (e - 0.1)], [x, -0.24, s * (e + 0.205)], 0.014, 6, { color: LAV_DARK }));
    b.add(MAT.METAL, cyl(0.035, 0.045, 0.05, 10, { p: [x, foot[1] + 0.015, foot[2]], color: LAV_DARK }));
    b.add(MAT.DARK, cbox(0.2, 0.035, 0.15, 0.01, { p: [x, foot[1] - 0.0225, foot[2]], color: NAVY }));
  }
  return b.build({ radius: 1.35, shade: false });
}
