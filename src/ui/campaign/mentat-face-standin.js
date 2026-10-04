// The Mentats' stand-in face rigs (notes docs/superpowers/notes/2026-10-05-mentat-face.md): built on today's
// painted portraits (portraits-layers.js, the bake of fb05319) so the face engine runs end to end before the
// face art is baked. The mouth's sprites are drawn here, in SVG, over the painted lips (lips, the mouth's inside,
// teeth and tongue for each viseme, in the colours measured off each painting, under a soft patch of skin); at
// rest the painting's own mouth shows. The brows, the mouth's corners and the chin are warps of the head painting;
// the lids are the baked closed eyes. Each Mentat's expressions are his own: Cyril's kindly concern, Radnor's
// sneer, Ammon's sly half-smile. The art step replaces all of this with rigs on the baked face sprites.
import { PORTRAITS } from './portraits-layers.js';
import { VISEMES, RIG_VERSION } from './mentat-face-rig.js';

const BASE = new URL('../../../assets/campaign/portraits/', import.meta.url).href;

/**
 * Where each painted Mentat's features are (frame units, read off the paintings and their bake): the mouth's
 * corners and the middle of the lip line, the lips' thickness at the middle, the colours of lips and skin there
 * (sampled from the baked head), and the boxes of brows, corners, chin and eyes.
 */
export const FACE_SPOTS = {
  atreides: {
    corners: [[193.5, 249.5], [239, 248.5]], mid: [216.25, 251.6], upper: 6, lower: 9.5,
    colors: { upL: '#af5949', upR: '#844742', loL: '#c67462', loR: '#7e4843', line: '#673026', skinL: '#eab491', skinR: '#a97561', above: '#ebb593', below: '#dfa88a' },
    brows: { left: { box: [155, 145, 53, 28], origin: [161, 164] }, right: { box: [221, 146, 49, 26], origin: [264, 160] } },
    cornerBoxes: [[186, 242, 15, 15], [231.5, 241, 15, 15]],
    chin: [194, 262, 44, 26],
    eyes: { left: { box: [150, 164, 57, 32], open: [174.5, 189.5] }, right: { box: [207, 164, 60, 30], open: [174, 188] } },
  },
  harkonnen: {
    corners: [[188.5, 284.5], [242, 269.5]], mid: [215, 284.6], upper: 5.5, lower: 9,
    colors: { upL: '#9a4b35', upR: '#793f2a', loL: '#af674f', loR: '#a7503b', line: '#4f2115', skinL: '#c58a62', skinR: '#c37756', above: '#c6a179', below: '#b98765' },
    brows: { left: { box: [146, 158, 66, 35], origin: [152, 178] }, right: { box: [218, 161, 62, 33], origin: [274, 179] } },
    cornerBoxes: [[181, 277, 15, 15], [234.5, 261.5, 15, 16]],
    chin: [192, 294, 48, 30],
    eyes: { left: { box: [147, 181, 61, 31], open: [192, 206] }, right: { box: [216, 181, 56, 30], open: [191, 205] } },
  },
  ordos: {
    corners: [[195.5, 256], [237, 250.5]], mid: [216, 258], upper: 5, lower: 8,
    colors: { upL: '#9c5e50', upR: '#997663', loL: '#ad7266', loR: '#8a594c', line: '#694031', skinL: '#d3ab89', skinR: '#a28067', above: '#cfa986', below: '#c19c7d' },
    brows: { left: { box: [156, 149, 51, 25], origin: [162, 166] }, right: { box: [219, 142, 48, 27], origin: [262, 158] } },
    cornerBoxes: [[188, 248.5, 15, 15], [229.5, 243, 15, 15]],
    chin: [195, 265, 42, 26],
    eyes: { left: { box: [153, 164, 53, 29], open: [174.5, 187.5] }, right: { box: [206, 164, 57, 28], open: [173.5, 186.5] } },
  },
};

/**
 * Each mouth shape as drawn: w the width (1 = the painted mouth's), up / down how far the lips part above and below
 * the lip line at the middle (units for a mouth 46 wide), tu / tl the lips' thickness, teethU / teethL how much of
 * the teeth shows, tongue (and tongueUp: its tip raised, for L), round the opening's roundness (O), press (M B P).
 */
export const SHAPES = {
  MBP: { w: 0.97, up: 0, down: 0, tu: 0.78, tl: 0.8, press: 1 },
  FV: { w: 1, up: 1.5, down: 0.5, tu: 0.9, tl: 0.72, teethU: 1 },
  A: { w: 0.95, up: 1.2, down: 6.5, tu: 0.88, tl: 0.85, teethU: 0.9, teethL: 0.3, tongue: 0.6, round: 0.25 },
  E: { w: 1.07, up: 1.1, down: 3, tu: 0.85, tl: 0.8, teethU: 1, teethL: 0.8 },
  O: { w: 0.72, up: 2, down: 5, tu: 1.15, tl: 1.1, teethU: 0.3, tongue: 0.3, round: 1 },
  L: { w: 0.93, up: 1.4, down: 4.5, tu: 0.9, tl: 0.85, teethU: 0.9, teethL: 0.4, tongue: 1, tongueUp: 1, round: 0.2 },
};

/** Each Mentat's expressions (mentat-face-rig.js PARAMS): his own face for each mood the voice tags a sentence with. */
export const EXPRESSION_SETS = {
  // Cyril: warm, unhurried, kindly concern; never angry nor sly in his lines (stern and knowing are there all the same)
  atreides: {
    neutral: { browL: 0.12, browR: 0.12, furrow: -0.15, cornerL: 0.12, cornerR: 0.12, tilt: 0.4 },
    grave: { browL: -0.15, browR: -0.15, furrow: 0.35, lidL: 0.18, lidR: 0.18, cornerL: -0.25, cornerR: -0.25, tilt: -0.6, nod: 0.9 },
    pleased: { browL: 0.3, browR: 0.3, furrow: -0.1, lidL: 0.22, lidR: 0.22, cornerL: 0.65, cornerR: 0.6, tilt: 1.2, nod: -0.4 },
    warning: { browL: 0.35, browR: 0.35, furrow: -0.55, cornerL: -0.15, cornerR: -0.15, tilt: -0.3, nod: 0.5 },
    angry: { browL: -0.4, browR: -0.4, furrow: 0.6, lidL: 0.15, lidR: 0.15, cornerL: -0.35, cornerR: -0.35, nod: 0.6 },
    sly: { browL: 0.1, browR: 0.3, lidL: 0.2, lidR: 0.15, cornerL: 0.2, cornerR: 0.45, tilt: 0.9 },
    sad: { browL: 0.15, browR: 0.15, furrow: -0.75, lidL: 0.3, lidR: 0.3, cornerL: -0.45, cornerR: -0.45, tilt: -1.4, nod: 1.3 },
  },
  // Radnor: heavy, flat, contemptuous; the sneer pulls up the smirking side of his mouth and one brow
  harkonnen: {
    neutral: { browL: -0.12, browR: -0.05, furrow: 0.25, lidL: 0.12, lidR: 0.1, cornerL: -0.1, cornerR: 0.2, nod: -0.2 },
    grave: { browL: -0.35, browR: -0.3, furrow: 0.5, lidL: 0.22, lidR: 0.2, cornerL: -0.3, cornerR: -0.1, nod: 0.6 },
    pleased: { browL: 0.05, browR: 0.3, furrow: 0.1, lidL: 0.3, lidR: 0.25, cornerL: 0.25, cornerR: 0.85, tilt: 1.2, nod: -0.6 },
    warning: { browL: -0.45, browR: 0.25, furrow: 0.55, lidL: 0.15, lidR: 0.05, cornerL: -0.3, cornerR: 0.25, tilt: -0.6, nod: 0.3 },
    angry: { browL: -0.75, browR: -0.7, furrow: 1, lidL: 0.25, lidR: 0.25, cornerL: -0.55, cornerR: -0.2, tilt: -0.8, nod: 0.7, jaw: 0.25 },
    sly: { browL: -0.3, browR: 0.4, furrow: 0.3, lidL: 0.38, lidR: 0.25, cornerL: -0.1, cornerR: 0.8, tilt: 1.6, nod: -0.5 },
    sad: { browL: -0.2, browR: -0.1, furrow: -0.3, lidL: 0.35, lidR: 0.3, cornerL: -0.4, cornerR: -0.2, nod: 0.8 },
  },
  // Ammon: smooth and cool; the raised brow and the half-smile on one side, the lids a little lowered
  ordos: {
    neutral: { browR: 0.2, lidL: 0.1, lidR: 0.08, cornerL: 0.1, cornerR: 0.3, tilt: 0.5 },
    grave: { browL: -0.3, browR: -0.1, furrow: 0.4, lidL: 0.2, lidR: 0.18, cornerL: -0.2, cornerR: -0.05, nod: 0.5 },
    pleased: { browL: 0.2, browR: 0.45, lidL: 0.25, lidR: 0.22, cornerL: 0.5, cornerR: 0.75, tilt: 1.1, nod: -0.3 },
    warning: { browL: -0.2, browR: 0.5, furrow: 0.4, lidL: 0.15, lidR: 0.05, cornerL: -0.15, cornerR: 0.2, tilt: -0.4, nod: 0.3 },
    angry: { browL: -0.6, browR: -0.4, furrow: 0.8, lidL: 0.3, lidR: 0.28, cornerL: -0.35, cornerR: -0.15, nod: 0.4 },
    sly: { browL: -0.15, browR: 0.6, furrow: 0.1, lidL: 0.35, lidR: 0.25, cornerL: 0.15, cornerR: 0.7, tilt: 1.7, nod: -0.25 },
    sad: { browL: 0.05, browR: 0.2, furrow: -0.4, lidL: 0.3, lidR: 0.28, cornerL: -0.3, cornerR: -0.15, tilt: -0.8, nod: 0.7 },
  },
};

/** Each Mentat's pace: Radnor blinks least and moves his heavy head least, Cyril is the liveliest. */
const MOTION = {
  atreides: { speakNod: 1, swayTilt: 0.4, blink: { min: 2.4, max: 5.2, seed: 11 } },
  harkonnen: { speakNod: 0.7, swayTilt: 0.25, blink: { min: 3, max: 6.5, double: 0.1, seed: 23 } },
  ordos: { speakNod: 0.85, swayTilt: 0.35, blink: { min: 2.6, max: 5.8, seed: 37 } },
};

const r2 = (v) => Math.round(v * 100) / 100;

/** The mouth's geometry for a shape: point(u) on its four edges (upper outer, upper inner, lower inner, lower outer). */
function mouthGeometry(spot, shape) {
  const [[lx, ly], [rx, ry]] = spot.corners, [mx, my] = spot.mid;
  const cx = 2 * mx - (lx + rx) / 2, cy = 2 * my - (ly + ry) / 2;   // the quadratic through both corners and the middle
  const dx = rx - lx, dy = ry - ly, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;   // "down", across the mouth
  const k = len / 2 / 23;
  const line = (u) => { const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; return [a * lx + b * cx + c * rx, a * ly + b * cy + c * ry]; };
  const edge = (which) => (u) => {
    const s = Math.sin(Math.PI * u), uw = 0.5 + (u - 0.5) * (shape.w ?? 1);
    const [px, py] = line(uw);
    const open = Math.pow(s, shape.round ? 0.8 - 0.35 * shape.round : 0.8);
    let d;
    if (which === 'ui') d = -(shape.up ?? 0) * k * open;
    else if (which === 'li') d = (shape.down ?? 0) * k * open;
    else if (which === 'uo') d = -(shape.up ?? 0) * k * open - spot.upper * (shape.tu ?? 1) * (0.3 + 0.7 * Math.pow(s, 0.6)) * (1 - 0.14 * Math.exp(-(((u - 0.5) / 0.07) ** 2)));
    else d = (shape.down ?? 0) * k * open + spot.lower * (shape.tl ?? 1) * (0.28 + 0.72 * Math.pow(s, 0.7));
    return [px + nx * d, py + ny * d];
  };
  return { k, nx, ny, line, uo: edge('uo'), ui: edge('ui'), li: edge('li'), lo: edge('lo') };
}

const N = 24;
const samples = (f, from = 0, to = 1) => Array.from({ length: N + 1 }, (_, i) => f(from + ((to - from) * i) / N));
// a smooth path through points (Catmull-Rom as cubic Béziers); `join` continues a path instead of starting one
function smooth(pts, join = false) {
  let d = join ? ` L${r2(pts[0][0])} ${r2(pts[0][1])}` : `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${r2(p1[0] + (p2[0] - p0[0]) / 6)} ${r2(p1[1] + (p2[1] - p0[1]) / 6)} ${r2(p2[0] - (p3[0] - p1[0]) / 6)} ${r2(p2[1] - (p3[1] - p1[1]) / 6)} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return d;
}
const band = (a, b) => `${smooth(samples(a))}${smooth(samples(b, 1, 0), true)}Z`;

/** The box a Mentat's mouth sprites are drawn in (frame units): the lips, the widest opening and the skin patch. */
export function mouthBox(spot) {
  const [[lx, ly], [rx, ry]] = spot.corners, [, my] = spot.mid;
  const half = Math.hypot(rx - lx, ry - ly) / 2;
  const k = half / 23, x0 = Math.min(lx, rx) - 16 * k, x1 = Math.max(lx, rx) + 16 * k;
  const y0 = Math.min(ly, ry, my) - spot.upper - 9, y1 = Math.max(ly, ry, my) + spot.lower + half * 0.3 + 10;
  return [r2(x0), r2(y0), r2(x1 - x0), r2(y1 - y0)];
}

/** One mouth sprite (SVG markup, drawn in frame units over the mouth's box) for `viseme` of a Mentat. */
export function mouthSpriteSvg(house, viseme) {
  const spot = FACE_SPOTS[house], shape = SHAPES[viseme];
  if (!spot || !shape) return null;
  const box = mouthBox(spot), [bx, by, bw, bh] = box, col = spot.colors;
  const g = mouthGeometry(spot, shape), k = g.k;
  const [mx, my] = spot.mid, half = Math.hypot(spot.corners[1][0] - spot.corners[0][0], spot.corners[1][1] - spot.corners[0][1]) / 2;
  const ang = r2(Math.atan2(spot.corners[1][1] - spot.corners[0][1], spot.corners[1][0] - spot.corners[0][0]) * 57.29578);
  const open = (shape.up ?? 0) + (shape.down ?? 0) > 0.05;
  const id = `m${viseme}`;
  const at = (f, u) => f(u).map(r2);
  const [cTop] = [at(g.ui, 0.5)], cBot = at(g.li, 0.5);
  const parts = [];
  // the skin patch over the painted lips
  parts.push(`<ellipse cx="${r2(mx)}" cy="${r2(my + 1)}" rx="${r2(half + 13 * k)}" ry="${r2((spot.upper + spot.lower) / 2 + 7 * k)}" transform="rotate(${ang} ${r2(mx)} ${r2(my)})" fill="url(#${id}s)" mask="url(#${id}f)"/>`);
  // a soft shadow under the lower lip
  const lo = at(g.lo, 0.5);
  parts.push(`<ellipse cx="${lo[0]}" cy="${r2(lo[1] + 1.6 * k)}" rx="${r2(half * 0.55 * (shape.w ?? 1))}" ry="${r2(2.2 * k)}" fill="${col.line}" opacity=".22" filter="url(#${id}b2)"/>`);
  if (open) {
    const inside = band(g.ui, g.li);
    parts.push(`<clipPath id="${id}c"><path d="${inside}"/></clipPath>`);
    parts.push(`<path d="${inside}" fill="url(#${id}i)"/>`);
    const teeth = [];
    if (shape.teethU) {
      const h = 2.3 * k * shape.teethU;
      teeth.push(`<path d="${band(g.ui, (u) => { const p = g.ui(u), s = Math.pow(Math.sin(Math.PI * u), 0.3); return [p[0] + g.nx * h * s, p[1] + g.ny * h * s]; })}" fill="url(#${id}t)"/>`);
    }
    if (shape.teethL) {
      const h = 1.7 * k * shape.teethL;
      teeth.push(`<path d="${band((u) => { const p = g.li(u), s = Math.pow(Math.sin(Math.PI * u), 0.3); return [p[0] - g.nx * h * s, p[1] - g.ny * h * s]; }, g.li)}" fill="url(#${id}t)" opacity=".85"/>`);
    }
    if (shape.tongue) {
      const ty = shape.tongueUp ? cTop[1] + (cBot[1] - cTop[1]) * 0.45 : cBot[1] - (cBot[1] - cTop[1]) * 0.22;
      teeth.push(`<ellipse cx="${r2(mx)}" cy="${r2(ty)}" rx="${r2(half * 0.5 * (shape.w ?? 1))}" ry="${r2((cBot[1] - cTop[1]) * (shape.tongueUp ? 0.4 : 0.3))}" fill="#93433d" opacity="${shape.tongue}"/>`);
    }
    parts.push(`<g clip-path="url(#${id}c)">${teeth.join('')}<path d="${smooth(samples(g.ui))}" fill="none" stroke="#1a0604" stroke-width="${r2(1.4 * k)}" opacity=".55" filter="url(#${id}b1)"/></g>`);
  }
  // the lips
  parts.push(`<path d="${band(g.uo, g.ui)}" fill="url(#${id}u)"/>`);
  parts.push(`<path d="${band(g.li, g.lo)}" fill="url(#${id}l)"/>`);
  // the lip line's crease (closed lips) or the inner edges' shade, and the corners
  if (!open) parts.push(`<path d="${smooth(samples(g.ui))}" fill="none" stroke="${col.line}" stroke-width="${r2((shape.press ? 1.5 : 1.1) * k)}" filter="url(#${id}b1)"/>`);
  else parts.push(`<path d="${smooth(samples(g.li))}" fill="none" stroke="${col.line}" stroke-width="${r2(0.7 * k)}" opacity=".6" filter="url(#${id}b1)"/>`);
  for (const u of [0, 1]) { const p = at(g.ui, u); parts.push(`<circle cx="${p[0]}" cy="${p[1]}" r="${r2(1.3 * k)}" fill="${col.line}" opacity=".5" filter="url(#${id}b1)"/>`); }
  // the lower lip's sheen and the upper lip's shade
  const hl = at(g.li, 0.38), hl2 = at(g.lo, 0.38);
  parts.push(`<ellipse cx="${r2((hl[0] + hl2[0]) / 2)}" cy="${r2((hl[1] + hl2[1]) / 2 - 0.4)}" rx="${r2(half * 0.28)}" ry="${r2(spot.lower * (shape.tl ?? 1) * 0.16)}" fill="#ffe2d0" opacity=".28" filter="url(#${id}b2)"/>`);

  const defs = `<defs>
<linearGradient id="${id}s" gradientUnits="userSpaceOnUse" x1="${r2(mx - half - 13 * k)}" y1="0" x2="${r2(mx + half + 13 * k)}" y2="0"><stop offset="0" stop-color="${col.skinL}"/><stop offset=".45" stop-color="${col.above}"/><stop offset=".62" stop-color="${col.below}"/><stop offset="1" stop-color="${col.skinR}"/></linearGradient>
<radialGradient id="${id}fg" cx=".5" cy=".5" r=".5"><stop offset=".68" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
<mask id="${id}f" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#${id}fg)"/></mask>
<linearGradient id="${id}u" gradientUnits="userSpaceOnUse" x1="${r2(mx - half)}" y1="0" x2="${r2(mx + half)}" y2="0"><stop offset=".15" stop-color="${col.upL}"/><stop offset=".9" stop-color="${col.upR}"/></linearGradient>
<linearGradient id="${id}l" gradientUnits="userSpaceOnUse" x1="${r2(mx - half)}" y1="0" x2="${r2(mx + half)}" y2="0"><stop offset=".15" stop-color="${col.loL}"/><stop offset=".9" stop-color="${col.loR}"/></linearGradient>
<radialGradient id="${id}i" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="#4a1915"/><stop offset="1" stop-color="#1e0705"/></radialGradient>
<linearGradient id="${id}t" gradientUnits="userSpaceOnUse" x1="${r2(mx - half)}" y1="0" x2="${r2(mx + half)}" y2="0"><stop offset="0" stop-color="#7d6c5e"/><stop offset=".35" stop-color="#e4d8c6"/><stop offset=".65" stop-color="#cbbca8"/><stop offset="1" stop-color="#6a5a4e"/></linearGradient>
<filter id="${id}b1" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${r2(0.45 * k)}"/></filter>
<filter id="${id}b2" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="${r2(1.2 * k)}"/></filter>
<filter id="${id}soft"><feGaussianBlur stdDeviation="${r2(0.22 * k)}"/></filter>
</defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bx} ${by} ${bw} ${bh}" width="${r2(bw * 4)}" height="${r2(bh * 4)}">${defs}<g filter="url(#${id}soft)">${parts.join('')}</g></svg>`;
}

const dataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** The stand-in rig of a house's Mentat (mentat-face-rig.js format), or null for a house without one. */
export function standInRig(house) {
  const p = PORTRAITS[house], spot = FACE_SPOTS[house];
  if (!p || !spot) return null;
  const box = mouthBox(spot);
  const [[lx, ly], [rx, ry]] = spot.corners;
  const half = Math.hypot(rx - lx, ry - ly) / 2;
  const sprites = Object.fromEntries(VISEMES.map((v) => [v, v === 'rest' ? null : dataUrl(mouthSpriteSvg(house, v))]));
  const lipFoot = spot.mid[1] + spot.lower;
  return structuredClone({
    v: RIG_VERSION, house, name: p.name, frame: [400, 500], standIn: true,
    head: { src: `${BASE}${house}-head.webp`, box: p.layers.head, pivot: p.pivot },
    mouth: { box, hinge: spot.mid[1], center: spot.mid[0], halfWidth: r2(half), sprites, jaw: [1, 1.3], lift: 2, widen: 0.05 },
    jaw: { box: spot.chin, feather: 0.6, drop: r2((lipFoot - spot.mid[1]) * 0.3) },
    brows: { left: { ...spot.brows.left, feather: 0.5 }, right: { ...spot.brows.right, feather: 0.5 }, raise: 3, furrow: 7, inward: 1.2 },
    corners: { left: { box: spot.cornerBoxes[0], feather: 0.55 }, right: { box: spot.cornerBoxes[1], feather: 0.55 }, lift: 2.2 },
    lids: { src: `${BASE}${house}-lids.webp`, box: p.layers.lids, left: spot.eyes.left, right: spot.eyes.right, soft: 0.12 },
    expressions: EXPRESSION_SETS[house],
    motion: MOTION[house],
  });   // a copy: the art step (or a test) may change its rig without touching these tables
}

/** The stand-in rigs by house (made on first use: the sprites are drawn then). */
export function standInRigs() {
  return Object.fromEntries(Object.keys(FACE_SPOTS).map((h) => [h, standInRig(h)]));
}
