// A Great House's spacecraft for the opening (spec §5.8; phase 3 research §8, after the Mega Drive intro's sprite, which
// the three houses share in their own lamp colour): a flat oval saucer in light grey panelled armour, a raised dorsal
// plate and curved blades along its sides. Its open stern faces the viewer as it flies away towards the planet: two
// large round lamps glowing in the house colour, a dark grille of crossed bars between them, two small twin lights above
// the centre; ribbed vents on the shoulders. The lamps and a thin edge on each blade take the instance's house colour.
// Faces +x; about 1 wide across the blades (SHIP_SPAN in game/intro-timeline.js). Painted parts only, no bare metal:
// space has no surroundings for metal to mirror.
import { ModelBuilder, MAT, box, cyl, dome, torus, hull, prism, tube } from '../kit.js';

const HULL = 0xa5a5a6, HULL_LOW = 0x76777c, PLATE = 0xc2c3c7, BLADE = 0xb3b4b8, SEAM = 0x2a2b31, FRAME = 0x5c5d63, RING = 0x8c8d93, BLACK = 0x0c0c10;
const RX = 0.4, RY = 0.12, RZ = 0.34;   // the saucer's half-length, height of its upper shell and half-width
const STERN = -0.39;                    // the stern face's plane
const facingAft = [0, 0, Math.PI / 2];  // a cylinder's axis turned along x

export function houseShip() {
  const b = new ModelBuilder('houseShip');

  // the saucer: a domed upper shell, a shallower lower one, a dark seam round the rim
  b.add(MAT.PAINT, dome(1, 32, { s: [RX, RY, RZ], color: HULL }));
  b.add(MAT.PAINT, dome(1, 32, { r: [Math.PI, 0, 0], s: [RX, 0.07, RZ], color: HULL_LOW }));
  b.add(MAT.DARK, torus(1, 0.022, 5, 48, { r: [Math.PI / 2, 0, 0], s: [RX + 0.004, RZ + 0.004, 1], color: SEAM }));
  b.add(MAT.DARK, cyl(0.15, 0.15, 0.012, 24, { p: [-0.02, -0.07, 0], color: SEAM }));

  // the dorsal armour plate, its panel lines, and a small canopy forward
  const plate = [];
  for (const s of [-1, 1]) plate.push([0.24, 0.07, s * 0.09], [0.06, 0.08, s * 0.17], [-0.2, 0.07, s * 0.17], [-0.3, 0.05, s * 0.11],
    [0.2, 0.118, s * 0.07], [0.05, 0.138, s * 0.13], [-0.19, 0.136, s * 0.13], [-0.27, 0.112, s * 0.08]);
  b.add(MAT.PAINT, hull(plate, { color: PLATE }));
  for (const x of [0.12, -0.04, -0.17]) b.add(MAT.DARK, box(0.008, 0.008, x > 0 ? 0.2 : 0.26, { p: [x, 0.14, 0], color: SEAM }));
  b.add(MAT.DARK, box(0.36, 0.008, 0.008, { p: [-0.04, 0.142, 0], color: SEAM }));
  b.add(MAT.GLASS, dome(1, 16, { p: [0.25, 0.085, 0], s: [0.07, 0.045, 0.07], color: 0x1a2a40 }));

  // curved blades along the sides, each with a thin edge in the house colour, and ribbed vents on the shoulders
  for (const s of [-1, 1]) {
    const blade = [[0.3, 0.21], [0.2, 0.36], [0.04, 0.47], [-0.16, 0.5], [-0.33, 0.44], [-0.43, 0.32], [-0.37, 0.27], [-0.2, 0.33], [0.02, 0.33], [0.2, 0.26]];
    b.add(MAT.PAINT, prism(blade.map(([x, z]) => [x, s * z]), 0.022, { r: [Math.PI / 2, 0, 0], p: [0, 0.005, 0], color: BLADE }));
    b.add(MAT.HOUSE, tube(blade.slice(0, 6).map(([x, z]) => [x, 0.005, s * (z + 0.004)]), 0.011, 5, {}));
    for (let i = 0; i < 4; i++) b.add(MAT.DARK, box(0.012, 0.014, 0.075, { p: [-0.07 - i * 0.04, 0.088 - i * 0.008, s * 0.2], r: [s * 0.35, 0, 0], color: SEAM }));
  }

  // the open stern: a dark frame, two great lamps in rimmed housings, the crossed-bar grille between, twin lights above
  b.add(MAT.PAINT, hull([[-0.27, 0.075, -0.25], [-0.27, 0.075, 0.25], [-0.27, -0.06, -0.25], [-0.27, -0.06, 0.25],
    [STERN, 0.065, -0.235], [STERN, 0.065, 0.235], [STERN, -0.05, -0.235], [STERN, -0.05, 0.235]], { color: FRAME }));
  for (const s of [-1, 1]) {
    const z = s * 0.135;
    b.add(MAT.PAINT, cyl(0.085, 0.085, 0.03, 24, { p: [STERN - 0.005, 0.005, z], r: facingAft, color: RING }));
    b.add(MAT.DARK, cyl(0.072, 0.072, 0.01, 24, { p: [STERN - 0.016, 0.005, z], r: facingAft, color: BLACK }));
    b.add(MAT.HOUSE_LIGHT, cyl(0.066, 0.066, 0.01, 24, { p: [STERN - 0.022, 0.005, z], r: facingAft, glow: 2.2 }));
    b.add(MAT.HOUSE_LIGHT, cyl(0.034, 0.034, 0.01, 16, { p: [STERN - 0.027, 0.005, z], r: facingAft, glow: 3.4 }));
  }
  b.add(MAT.DARK, box(0.012, 0.085, 0.1, { p: [STERN - 0.004, 0, 0], color: BLACK }));
  for (const z of [-0.033, 0, 0.033]) for (const a of [-0.62, 0.62]) b.add(MAT.PAINT, box(0.008, 0.08, 0.009, { p: [STERN - 0.012, 0, z], r: [a, 0, 0], color: RING }));
  for (const z of [-0.022, 0.022]) b.add(MAT.LIGHT, cyl(0.012, 0.012, 0.01, 10, { p: [STERN - 0.008, 0.052, z], r: facingAft, color: 0xfff1cc, glow: 2.2 }));

  return b.build({ radius: 0.6, shade: false });
}
