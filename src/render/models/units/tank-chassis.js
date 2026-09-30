// The tank family's tracked hull, after the Genesis sprites (docs/research/raw/visual-units.md §1.5,
// §2.11–2.16): a house-colour deck with chamfered rims whose fenders stop short of the track ends, so
// that from above the four track drums stand out at the corners (the sprites' navy nubs with a lavender
// glint) while the glacis and tail run on between them; fender bolts dot its rims (the sprites' light
// dots), road wheels and hub caps line the tracks, and a dark rear plate with exhausts closes the back
// (the sprites' rear band). Also the pieces the tanks share: white gun barrels with fume extractors and
// muzzle brakes, ring hatches, and the launcher family's hull, round cab and traversing mount.
import { MAT, box, cbox, cyl, hull, dome, sphere, lathe, prism } from '../kit.js';
import { PAL } from '../palette.js';
import { bolts } from '../detail.js';

const AXLE = [Math.PI / 2, 0, 0];
export const ALONG = [0, 0, -Math.PI / 2];   // a cylinder lying along +x
export const RECESS = 0x9098a0;              // grey vertex colour on HOUSE: the ramp one step darker
export const SHADE = 0x6a7078;               // two steps: undersides and rear plates
export const GUN = 0xc9cbe0;                 // barrels and warheads: lavender white (bright metal blooms if pure white)

export const HUB = 0.014;                    // how far hub caps stand proud of a track's outer face

/** One track run along x at z: tread belt with round ends, road wheels on the outer face, corner drums with hub caps. */
export function trackRun(b, { length, h, w, z, outer, wheels = 5, node = 'root' }) {
  const r = h / 2, core = length - h, face = z + outer * w / 2;
  b.add(MAT.TREAD, box(core, h, w, { p: [0, r, z] }), node);
  for (const x of [-core / 2, core / 2]) b.add(MAT.TREAD, cyl(r, r, w, 12, { p: [x, r, z], r: AXLE }), node);
  const gap = core / wheels;
  for (let k = 0; k < wheels; k++) {
    const x = -core / 2 + gap * (k + 0.5);
    b.add(MAT.METAL, cyl(r * 0.74, r * 0.74, 0.008, 10, { p: [x, r * 0.86, face + outer * 0.003], r: AXLE, color: PAL.navy }), node);
    b.add(MAT.METAL, cyl(r * 0.3, r * 0.34, 0.01, 8, { p: [x, r * 0.86, face + outer * (HUB - 0.005)], r: AXLE, color: PAL.machine }), node);
  }
  for (const x of [-core / 2, core / 2]) {   // sprocket and idler: navy drum proud of the belt, lavender hub cap
    b.add(MAT.METAL, cyl(r * 0.84, r * 0.84, w + 0.01, 10, { p: [x, r, z], r: AXLE, color: PAL.navy }), node);
    b.add(MAT.METAL, cyl(r * 0.36, r * 0.42, 0.012, 8, { p: [x, r, face + outer * (HUB - 0.006)], r: AXLE, color: PAL.machineLight }), node);
  }
}

/**
 * Deck slab from a convex side profile [[x, y] …] (x forward), extruded across `width` with the top
 * edges chamfered by `c` so the rims catch the ramp's highlight. Points at y >= top - 1e-6 are the deck.
 */
export function slab(profile, width, { c = 0.03, color = 0xffffff, z = 0 } = {}) {
  const top = Math.max(...profile.map(([, y]) => y)), hw = width / 2, pts = [];
  for (const [x, y] of profile) for (const s of [-1, 1]) {
    if (y >= top - 1e-6) pts.push([x, y, z + s * (hw - c)], [x, y - c, z + s * hw]);
    else pts.push([x, y, z + s * hw]);
  }
  return hull(pts, { color });
}

/**
 * The shared tracked hull, `width` over the hub caps: two track runs, the full-width fender deck ending
 * `notch` short of the track ends, the hull between the tracks running out to the glacis and the tail,
 * the dark rear plate with exhausts, headlamps and the fender bolts. Returns the deck height and extents.
 */
export function tankHull(b, { length, width, trackW = 0.15, trackH = 0.12, deck = 0.17, fender = 0.1, notch = 0.07, glacis = 0.1, nose = 0.12, tail = 0.05, c = 0.03, wheels = 5, exhausts = true, lamps = true }) {
  const hl = length / 2, hw = width / 2 - HUB, tz = hw - trackW / 2, fl = hl - notch, inner = 2 * hw - 2 * trackW - 0.006;
  for (const s of [-1, 1]) trackRun(b, { length: length + 0.01, h: trackH, w: trackW, z: s * tz, outer: s, wheels });
  b.add(MAT.HOUSE, slab([[-fl, fender], [fl, fender], [fl, deck - c], [fl - c, deck], [-fl + c, deck], [-fl, deck - c]], 2 * hw, { c }));
  b.add(MAT.HOUSE, slab([[-hl + 0.03, 0.035], [hl - 0.07, 0.035], [hl, nose - 0.04], [hl, nose], [hl - glacis, deck], [-hl + tail, deck], [-hl, deck - 0.03], [-hl, 0.05]], inner, { c }));
  b.add(MAT.HOUSE, cbox(0.012, deck - 0.1, inner * 0.8, 0.004, { p: [-hl - 0.004, 0.055 + (deck - 0.1) / 2, 0], color: SHADE }));
  if (exhausts) for (const s of [-1, 1]) {
    b.add(MAT.METAL, cyl(0.02, 0.02, 0.04, 8, { p: [-hl - 0.02, deck - 0.075, s * inner * 0.28], r: ALONG, color: PAL.gunmetal }));
    b.add(MAT.DARK, cyl(0.013, 0.013, 0.042, 8, { p: [-hl - 0.021, deck - 0.075, s * inner * 0.28], r: ALONG, color: 0x0c0c12 }));
  }
  if (lamps) for (const s of [-1, 1]) b.add(MAT.METAL, cyl(0.017, 0.02, 0.016, 8, { p: [fl + 0.006, fender + 0.03, s * tz], r: ALONG, color: PAL.machineLight }));
  const studs = [];
  for (const s of [-1, 1]) for (const x of [-fl + 0.06, 0, fl - 0.06]) studs.push([x, deck + 0.002, s * (hw - 0.04)]);
  bolts(b, studs, { r: 0.013, h: 0.012, color: PAL.machineLight });
  return { deck, hl, hw, fl, inner };
}

/** A white gun barrel `len` long from the origin of `node` along +x (raised by `pitch`) at z: collar, taper, fume extractor, muzzle brake. */
export function barrel(b, node, { len, z = 0, r = 0.028, brake = 0.042, pitch = 0 }) {
  const at = (t) => [len * t * Math.cos(pitch), len * t * Math.sin(pitch), z], lie = [0, 0, pitch - Math.PI / 2];
  b.add(MAT.METAL, cyl(r * 0.88, r, len * 0.9, 10, { p: at(0.45), r: lie, color: GUN }), node);
  b.add(MAT.METAL, cyl(r * 1.32, r * 1.32, len * 0.16, 10, { p: at(0.5), r: lie, color: GUN }), node);
  b.add(MAT.METAL, cyl(r * 1.55, r * 1.55, len * 0.1, 10, { p: at(0.05), r: lie, color: PAL.navy }), node);
  b.add(MAT.METAL, cyl(brake, brake, len * 0.13, 8, { p: at(0.93), r: lie, color: PAL.machineLight }), node);
  b.add(MAT.DARK, cyl(brake * 1.02, brake * 1.02, len * 0.025, 8, { p: at(0.93), r: lie, color: 0x101018 }), node);
}

/** A raised ring hatch or cupola lying flat: house ring (its chamfer catches the highlight), dark well, metal lid boss. */
export function ringHatch(b, node, { p, r, h = 0.022, lid = true }) {
  b.add(MAT.HOUSE, lathe([[r * 0.62, 0], [r, 0], [r, h * 0.6], [r * 0.86, h], [r * 0.62, h], [r * 0.62, 0]], 14, { p }), node);
  b.add(MAT.DARK, cyl(r * 0.64, r * 0.64, h * 0.7, 14, { p: [p[0], p[1] + h * 0.35, p[2]], color: 0x0c0c16 }), node);
  if (lid) b.add(MAT.HOUSE, dome(r * 0.5, 10, { p: [p[0], p[1] + h * 0.5, p[2]], s: [1, 0.5, 1], color: RECESS }), node);
}

/** The launcher family's hull (Missile Tank, Deviator): the shared tracked hull and the rounded cab at the front. */
export function launcherHull(b) {
  const L = 0.84, W = 0.64, { deck } = tankHull(b, { length: L, width: W, trackW: 0.14, deck: 0.16, fender: 0.095, glacis: 0.09, nose: 0.125 });
  // cab: a glossy round canopy at the front, a dark visor across its face and a roof hatch; an aerial on the tail
  const cx = 0.25, cz = -0.03;
  b.add(MAT.HOUSE, cbox(0.24, 0.03, 0.3, 0.012, { p: [cx, deck + 0.005, cz], color: RECESS }));
  b.add(MAT.HOUSE, dome(0.15, 18, { p: [cx, deck + 0.012, cz], s: [0.86, 0.56, 1.08] }));
  b.add(MAT.GLASS, sphere(0.1, 14, { p: [cx + 0.075, deck + 0.045, cz], s: [0.42, 0.3, 1.26], color: PAL.glass }));
  ringHatch(b, 'root', { p: [cx - 0.035, deck + 0.083, cz - 0.02], r: 0.034, h: 0.012 });
  b.add(MAT.METAL, cyl(0.004, 0.004, 0.2, 4, { p: [-L / 2 + 0.06, deck + 0.12, W / 2 - 0.06], color: PAL.gunmetal }));
  b.add(MAT.METAL, cyl(0.012, 0.012, 0.02, 6, { p: [-L / 2 + 0.06, deck + 0.01, W / 2 - 0.06], color: PAL.navy }));
  return { deck, L, W };
}

/**
 * The launcher family's traversing mount: a low turntable over a dark turret ring, a trunnion yoke tall
 * enough for the rack to swing clear over the cab, the `turret` node (yaw) and the `launcher` node
 * (elevation about z) on the trunnion. Returns the trunnion height above the deck.
 */
export function launcherMount(b, { x = -0.12, deck, elevation = 0.24, yoke = 0.07 }) {
  b.add(MAT.DARK, cyl(0.165, 0.165, 0.014, 16, { p: [x, deck + 0.004, 0], color: 0x0c0c16 }));
  b.node('turret', { pivot: [x, deck, 0] });
  b.add(MAT.HOUSE, lathe([[0.16, 0], [0.16, 0.022], [0.14, 0.036], [0, 0.036]], 16), 'turret');
  for (const s of [-1, 1]) b.add(MAT.HOUSE, prism([[-0.07, 0.03], [0.05, 0.03], [0.025, yoke + 0.025], [-0.035, yoke + 0.025]], 0.022, { p: [0, 0, s * 0.021], color: RECESS }), 'turret');
  b.add(MAT.METAL, cyl(0.013, 0.016, yoke - 0.03, 8, { p: [0.06, yoke / 2 + 0.01, 0], r: [0, 0, 0.35], color: PAL.machine }), 'turret');   // elevation ram
  b.node('launcher', { parent: 'turret', pivot: [0, yoke, 0], axis: 'z', value: elevation });
  return yoke;
}
