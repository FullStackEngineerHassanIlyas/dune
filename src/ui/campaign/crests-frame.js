// The parts every house crest shares (crests.js): the lighting filters and gradients, the carved gold frame (a
// moulding with a cable twist and pearls, shell-and-scroll corners, cartouches with jewels in the house colour),
// the enamelled field and the steel-rimmed heater shield with engine-turned (guilloché) enamel. All in a 400-unit
// square, lit from the top left. `p` prefixes every id so several crests can share a page.
import { f, pt, add, mul, smooth, sample, arcs, tube, spiral, turn, rad } from './crests-geometry.js';

export const SIZE = 400;
const C = SIZE / 2;
/** The frame's outer edge and its sight edge (where the field starts). */
const OUT = 4, IN = 50;

/** The frame's gold, from its brightest highlight to its deepest shadow. */
export const GOLD = { hi: '#fff8d6', light: '#ffe08a', mid: '#e3aa40', deep: '#a3661a', dark: '#5c3606', ink: '#241302' };

const stops = (list) => list.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a < 1 ? ` stop-opacity="${a}"` : ''}/>`).join('');
const even = (colours) => stops(colours.map((c, i) => [Math.round((i / (colours.length - 1)) * 100) / 100, c]));

/**
 * Filters: `relief` raises a charge as cast metal (height from its brightness and its outline, so engraved lines
 * read as grooves; diffuse plus specular light from the top left), `soft` a gentler relief for the frame's
 * ornaments and the shield's rim, `drop` a contact shadow, `grain` a fine metal grain, `blur` a soft shadow.
 */
export function filters(p) {
  return `
  <filter id="${p}-relief" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
    <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="lum"/>
    <feGaussianBlur in="lum" stdDeviation="1" result="lb"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="ab"/>
    <feComposite in="lb" in2="ab" operator="arithmetic" k2=".6" k3=".7" result="h"/>
    <feDiffuseLighting in="h" surfaceScale="4.5" diffuseConstant="1.25" lighting-color="#fff" result="d"><feDistantLight azimuth="225" elevation="48"/></feDiffuseLighting>
    <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1.2" result="lit"/>
    <feSpecularLighting in="h" surfaceScale="4.5" specularConstant="1.1" specularExponent="30" lighting-color="#fff" result="sp"><feDistantLight azimuth="225" elevation="34"/></feSpecularLighting>
    <feComposite in="sp" in2="SourceAlpha" operator="in" result="spc"/>
    <feComposite in="lit" in2="spc" operator="arithmetic" k2="1" k3=".85"/>
    <feComposite in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="${p}-soft" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
    <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="lum"/>
    <feGaussianBlur in="lum" stdDeviation=".7" result="lb"/>
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="ab"/>
    <feComposite in="lb" in2="ab" operator="arithmetic" k2=".35" k3=".85" result="h"/>
    <feDiffuseLighting in="h" surfaceScale="3.2" diffuseConstant="1.15" lighting-color="#fff" result="d"><feDistantLight azimuth="225" elevation="50"/></feDiffuseLighting>
    <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="1.2" result="lit"/>
    <feSpecularLighting in="h" surfaceScale="3.2" specularConstant="1.05" specularExponent="18" lighting-color="#fff4d0" result="sp"><feDistantLight azimuth="225" elevation="34"/></feSpecularLighting>
    <feComposite in="sp" in2="SourceAlpha" operator="in" result="spc"/>
    <feComposite in="lit" in2="spc" operator="arithmetic" k2="1" k3=".8"/>
    <feComposite in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="${p}-drop" x="-10%" y="-10%" width="125%" height="125%" color-interpolation-filters="sRGB">
    <feDropShadow dx="3" dy="5" stdDeviation="3.5" flood-color="#000" flood-opacity=".75"/>
  </filter>
  <filter id="${p}-grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  1.6 0 0 0 -.55" result="g"/>
    <feComposite in="g" in2="SourceAlpha" operator="in" result="gc"/>
    <feBlend in="gc" in2="SourceGraphic" mode="overlay"/>
  </filter>
  <filter id="${p}-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3"/></filter>`;
}

/** Gradients shared by every crest: the moulding's profile, polished gold, the rim, the enamels, the jewels. */
export function gradients(p, s) {
  const g = GOLD;
  const at = (k) => OUT + k * (IN - OUT);
  return `
  <linearGradient id="${p}-mould" gradientUnits="userSpaceOnUse" x1="0" y1="${OUT}" x2="0" y2="${IN}">${stops([
    [0, g.ink], [0.03, g.light], [0.07, g.hi], [0.13, g.mid], [0.18, g.dark], [0.22, g.deep], [0.27, g.mid], [0.36, g.light], [0.44, g.hi],
    [0.52, g.light], [0.62, g.deep], [0.68, g.dark], [0.74, g.deep], [0.8, g.light], [0.86, g.hi], [0.9, g.mid], [0.95, g.dark], [1, g.ink]])}</linearGradient>
  <linearGradient id="${p}-gold" x1="0" y1="0" x2=".6" y2="1">${stops([[0, g.hi], [0.25, g.light], [0.5, g.mid], [0.8, g.deep], [1, g.dark]])}</linearGradient>
  <linearGradient id="${p}-goldv" x1="0" y1="0" x2="0" y2="1">${stops([[0, g.hi], [0.35, g.light], [0.65, g.mid], [1, g.deep]])}</linearGradient>
  <radialGradient id="${p}-boss" cx=".36" cy=".32" r=".75">${stops([[0, g.hi], [0.3, g.light], [0.62, g.mid], [0.86, g.deep], [1, g.dark]])}</radialGradient>
  <linearGradient id="${p}-rim" x1="0" y1="0" x2=".85" y2="1">${even(s.rim)}</linearGradient>
  <radialGradient id="${p}-field" cx=".42" cy=".38" r=".8">${stops([[0, s.field[0]], [0.55, s.field[1]], [1, s.field[2]]])}</radialGradient>
  <radialGradient id="${p}-enamel" cx=".4" cy=".3" r=".85">${stops([[0, s.enamel[0]], [0.5, s.enamel[1]], [1, s.enamel[2]]])}</radialGradient>
  <linearGradient id="${p}-sheen" x1="0" y1="0" x2="1" y2="1">${stops([[0, '#fff', 0.38], [0.22, '#fff', 0.08], [0.4, '#fff', 0], [0.75, '#000', 0], [1, '#000', 0.3]])}</linearGradient>
  <radialGradient id="${p}-gem" cx=".36" cy=".3" r=".8">${stops([[0, s.gem[0]], [0.35, s.gem[1]], [0.78, s.gem[2]], [1, '#000']])}</radialGradient>
  <radialGradient id="${p}-gemglow" cx=".64" cy=".74" r=".42">${stops([[0, s.gem[0], 0.8], [1, s.gem[0], 0]])}</radialGradient>
  <radialGradient id="${p}-vignette" cx=".5" cy=".46" r=".64">${stops([[0, '#000', 0], [0.7, '#000', 0.2], [1, '#000', 0.75]])}</radialGradient>
  <pattern id="${p}-diaper" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45 200 200)">
    <path d="M0 0H22M0 0V22" stroke="${s.diaper}" stroke-width=".6" opacity=".3"/><circle cx="11" cy="11" r="1.2" fill="${s.diaper}" opacity=".4"/>
  </pattern>`;
}

/** A cabochon jewel in a beaded gold bezel. */
export function jewel(p, cx, cy, rx, ry = rx) {
  const n = Math.round((rx + ry) * 0.8);
  const beads = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return `<circle cx="${f(cx + Math.cos(a) * (rx + 3))}" cy="${f(cy + Math.sin(a) * (ry + 3))}" r="1.35"/>`;
  }).join('');
  const hx = cx - rx * 0.32, hy = cy - ry * 0.38;
  return `<g>
    <ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx + 4.6)}" ry="${f(ry + 4.6)}" fill="url(#${p}-boss)" stroke="${GOLD.ink}" stroke-width=".9"/>
    <g fill="${GOLD.hi}" stroke="${GOLD.dark}" stroke-width=".4">${beads}</g>
    <ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="url(#${p}-gem)" stroke="${GOLD.ink}" stroke-width="1"/>
    <ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="url(#${p}-gemglow)"/>
    <ellipse cx="${f(hx)}" cy="${f(hy)}" rx="${f(rx * 0.38)}" ry="${f(ry * 0.2)}" fill="#fff" opacity=".9" transform="rotate(-35 ${f(hx)} ${f(hy)})"/>
    <circle cx="${f(cx + rx * 0.4)}" cy="${f(cy + ry * 0.44)}" r="${f(Math.min(rx, ry) * 0.1)}" fill="#fff" opacity=".55"/>
  </g>`;
}

/** An acanthus leaf: base at (0,0), pointing up (-y), `l` long and `w` wide, with lobed edges. */
function leaf(l, w) {
  const pts = [[0, 0], [-w * 0.55, -l * 0.18], [-w * 0.9, -l * 0.42], [-w * 0.5, -l * 0.5], [-w * 0.72, -l * 0.72], [-w * 0.28, -l * 0.8],
    [0, -l], [w * 0.28, -l * 0.8], [w * 0.72, -l * 0.72], [w * 0.5, -l * 0.5], [w * 0.9, -l * 0.42], [w * 0.55, -l * 0.18]];
  return smooth(pts, true, 0.14);
}

/** A tendril scroll: from (0,0) heading right `l` long, tapering, its end curled down into a spiral. */
function scroll(l, w0 = 9) {
  const r0 = l * 0.13, c = [l * 0.8, r0];
  const curl = spiral(c, r0, r0 * 0.28, -90, 0.95, 26);
  const spine = [...sample([[0, 0], [l * 0.3, -l * 0.04], [l * 0.6, -l * 0.02]], 6), ...curl];
  return tube(spine, (s) => Math.max(1.4, w0 * (1 - s) ** 0.8), 2);
}

/** A scallop shell: `n` ribbed lobes from a hinge at (0,0) opening upwards over `spread` degrees, `r` long. */
function shell(p, r, n = 9, spread = 120) {
  const P = (deg, rr) => [rr * Math.sin(rad(deg)), -rr * Math.cos(rad(deg))];
  const step = spread / n, ribs = [];
  for (let i = 0; i < n; i++) {
    const a = -spread / 2 + step * (i + 0.5), rr = r * (0.88 + 0.12 * Math.cos(rad(a)));
    ribs.push(`<path d="M0 0L${pt(P(a - step / 2, rr))}Q${pt(P(a, rr * 1.18))} ${pt(P(a + step / 2, rr))}Z" fill="url(#${p}-${i % 2 ? 'gold' : 'goldv'})"/>`);
  }
  // the shell's ears at the hinge
  ribs.push(`<path d="M0 2L${f(-r * 0.36)} 0L${f(-r * 0.3)} ${f(-r * 0.2)}L0 ${f(-r * 0.12)}L${f(r * 0.3)} ${f(-r * 0.2)}L${f(r * 0.36)} 0Z"/>`);
  return ribs.join('');
}

/** The top-left corner piece: a scallop shell opening into the corner, a C-scroll along each side. */
function cornerArt(p) {
  const sc = scroll(56, 11);
  return `<path d="${sc}" transform="translate(40 15)"/><path d="${sc}" transform="matrix(0 1 1 0 15 40)"/>
    <g transform="translate(40 40) rotate(-45)">${shell(p, 36, 11, 140)}</g>`;
}

/** The top cartouche: a small shell opening outwards, C-scrolls either way along the side. */
function midArt(p) {
  const sc = scroll(48, 9);
  return `<path d="${sc}" transform="translate(${C + 16} 19)"/><path d="${sc}" transform="translate(${C - 16} 19) scale(-1 1)"/>
    <g transform="translate(${C} 30)">${shell(p, 26, 9, 130)}</g>`;
}

/** The four rotations of a part, as uses. */
const round = (id) => [0, 90, 180, 270].map((a) => `<use href="#${id}"${a ? ` transform="rotate(${a} ${C} ${C})"` : ''}/>`).join('');

/** The carved gold frame around the field: four mitred sides, shell-and-scroll corners and cartouches, jewels. */
export function frame(p) {
  const rope = [], pearls = [];
  const ropeY = OUT + 0.44 * (IN - OUT), pearlY = OUT + 0.84 * (IN - OUT);
  for (let x = 48; x <= 352; x += 7.6) rope.push(`<ellipse cx="${f(x)}" cy="${f(ropeY)}" rx="5.2" ry="2.5" transform="rotate(-40 ${f(x)} ${f(ropeY)})"/>`);
  for (let x = IN; x <= SIZE - IN; x += 6.2) pearls.push(`<circle cx="${f(x)}" cy="${f(pearlY)}" r="1.9"/>`);
  // the light falls from the top left: the right and bottom sides face away from it, the left a little. The band is
  // shaded whole; over the ornaments the shade fades out towards the corners, whose bosses stand proud
  const sides = [[`M${OUT} ${OUT}L${IN} ${IN}V${SIZE - IN}L${OUT} ${SIZE - OUT}Z`, 0.1, 'v'], [`M${SIZE - OUT} ${OUT}L${SIZE - IN} ${IN}V${SIZE - IN}L${SIZE - OUT} ${SIZE - OUT}Z`, 0.32, 'v'],
    [`M${OUT} ${SIZE - OUT}L${IN} ${SIZE - IN}H${SIZE - IN}L${SIZE - OUT} ${SIZE - OUT}Z`, 0.42, 'h']];
  const fade = (id, horizontal) => `<linearGradient id="${id}" x1="0" y1="0" x2="${horizontal ? 1 : 0}" y2="${horizontal ? 0 : 1}">
    <stop offset=".2" stop-color="#140800" stop-opacity="0"/><stop offset=".3" stop-color="#140800"/><stop offset=".7" stop-color="#140800"/><stop offset=".8" stop-color="#140800" stop-opacity="0"/></linearGradient>`;
  const corners = [[38, 38], [SIZE - 38, 38], [38, SIZE - 38], [SIZE - 38, SIZE - 38]];
  const mids = [[C, 21, 0], [C, SIZE - 21, 0], [21, C, 90], [SIZE - 21, C, 90]];
  return `
  <defs>
    <path id="${p}-band" d="M${OUT} ${OUT}H${SIZE - OUT}L${SIZE - IN} ${IN}H${IN}Z" fill="url(#${p}-mould)" stroke="${GOLD.ink}" stroke-width="1"/>
    <g id="${p}-orn"><g fill="url(#${p}-goldv)" stroke="${GOLD.dark}" stroke-width=".6">${rope.join('')}</g>
      <g fill="${GOLD.light}" stroke="${GOLD.dark}" stroke-width=".5">${pearls.join('')}</g></g>
    <g id="${p}-corner">${cornerArt(p)}</g>
    <g id="${p}-mid">${midArt(p)}</g>
    ${fade(`${p}-fadev`, false)}${fade(`${p}-fadeh`, true)}
  </defs>
  <g filter="url(#${p}-grain)">${round(`${p}-band`)}</g>
  <g fill="#140800">${sides.map(([d, o]) => `<path d="${d}" opacity="${o}"/>`).join('')}</g>
  <g filter="url(#${p}-soft)">${round(`${p}-orn`)}<g fill="url(#${p}-gold)" stroke="${GOLD.ink}" stroke-width=".8">${round(`${p}-mid`)}${round(`${p}-corner`)}</g></g>
  ${sides.map(([d, o, dir]) => `<path d="${d}" fill="url(#${p}-fade${dir})" opacity="${o * 0.85}"/>`).join('')}
  ${corners.map(([x, y]) => jewel(p, x, y, 7.5)).join('')}
  ${mids.map(([x, y, a]) => (a ? jewel(p, x, y, 6, 8.5) : jewel(p, x, y, 8.5, 6))).join('')}`;
}

/** The field inside the frame: house enamel with a diaper of fine lines, its edges in the frame's shadow. */
export function field(p) {
  const w = SIZE - 2 * IN;
  return `
  <rect x="${IN}" y="${IN}" width="${w}" height="${w}" fill="url(#${p}-field)"/>
  <rect x="${IN}" y="${IN}" width="${w}" height="${w}" fill="url(#${p}-diaper)"/>
  <rect x="${IN}" y="${IN}" width="${w}" height="${w}" fill="url(#${p}-vignette)"/>
  <rect x="${IN - 4}" y="${IN - 4}" width="${w + 8}" height="${w + 8}" fill="none" stroke="#000" stroke-width="14" opacity=".6" filter="url(#${p}-blur)"/>`;
}

/** The heater shield's box: inside the frame's sight edge with room for its shadow. */
export const SHIELD_BOX = { l: 86, r: 314, t: 70, m: 196, b: 344 };

/**
 * The heater shield's outline inset by `d`: points round it (top arched, straight flanks, ogee to the point),
 * for the rim, the field and the rivets.
 */
export function shieldPoints(d = 0, box = SHIELD_BOX) {
  const l = box.l + d, r = box.r - d, t = box.t + d, m = box.m, b = box.b - d * 1.9, cx = (l + r) / 2, w = (r - l) / 2;
  const right = [[cx, t - 9 + d * 0.15], [cx + w * 0.55, t - 5], [r, t], [r, t + 30], [r, m - 40], [r - w * 0.02, m], [r - w * 0.12, m + 50],
    [cx + w * 0.42, b - 50], [cx + w * 0.16, b - 15], [cx, b]];
  const left = right.slice(1, -1).reverse().map(([x, y]) => [2 * cx - x, y]);
  return [...right, ...left];
}

/** Engine-turned lines under the enamel: 'rays' (a sunburst), 'rosette' (circles round a ring) or 'rings'. */
function guilloche(kind, colour) {
  const [cx, cy] = [C, 190], attrs = `fill="none" stroke="${colour}" stroke-width=".8" opacity="${kind === 'rosette' ? 0.15 : 0.22}"`;
  if (kind === 'rays') {
    let d = '';
    for (let i = 0; i < 96; i++) d += `M${pt(add([cx, cy], mul(turn([1, 0], i * 3.75), 14)))}L${pt(add([cx, cy], mul(turn([1, 0], i * 3.75), 220)))}`;
    return `<path d="${d}" ${attrs}/>`;
  }
  const circles = kind === 'rosette'
    ? Array.from({ length: 40 }, (_, i) => `<circle cx="${f(cx + Math.cos(i * Math.PI / 20) * 58)}" cy="${f(cy + Math.sin(i * Math.PI / 20) * 58)}" r="96"/>`)
    : Array.from({ length: 30 }, (_, i) => `<circle cx="${cx}" cy="${cy}" r="${10 + i * 7}"/>`);
  return `<g ${attrs}>${circles.join('')}</g>`;
}

/**
 * The shield: a drop shadow, the rim (brushed steel or iron, bevelled), a gold fillet, the enamelled field over
 * engine turning, recessed in the rim, its glassy sheen, and rivets round the rim.
 */
export function shield(p, s, { rivets = true, engraving = true } = {}) {
  const outer = smooth(shieldPoints(0), true, 0.16), inner = smooth(shieldPoints(13), true, 0.16), fillet = smooth(shieldPoints(10.5), true, 0.16);
  let studs = '';
  if (rivets) {
    const ring = sample(shieldPoints(5.4), 6, true), at = arcs([...ring, ring[0]]);
    const pick = [];
    for (let k = 0; k < 24; k++) { const i = at.findIndex((a) => a >= k / 24); pick.push(ring[Math.max(0, i) % ring.length]); }
    studs = `<g fill="url(#${p}-boss)" stroke="${GOLD.dark}" stroke-width=".5">${pick.map((q) => `<circle cx="${f(q[0])}" cy="${f(q[1])}" r="2.3"/>`).join('')}</g>`;
  }
  return `
  <clipPath id="${p}-inner"><path d="${inner}"/></clipPath>
  <path d="${outer}" fill="#000" opacity=".8" filter="url(#${p}-drop)"/>
  <g filter="url(#${p}-soft)"><path d="${outer}" fill="url(#${p}-rim)"/>${studs}</g>
  <path d="${outer}" fill="none" stroke="${GOLD.ink}" stroke-width="1.3"/>
  <path d="${fillet}" fill="url(#${p}-goldv)" stroke="${GOLD.ink}" stroke-width=".8"/>
  <g filter="url(#${p}-grain)"><path d="${inner}" fill="url(#${p}-enamel)"/></g>
  <g clip-path="url(#${p}-inner)">
    ${engraving && s.engine ? guilloche(s.engine, s.diaper) : ''}
    ${s.bordure ? `<path d="${inner}" fill="none" stroke="${s.bordure}" stroke-width="22" opacity=".92"/><path d="${smooth(shieldPoints(24), true, 0.16)}" fill="none" stroke="${GOLD.mid}" stroke-width="1.4"/>` : ''}
    <path d="${inner}" fill="none" stroke="#000" stroke-width="7" opacity=".55" filter="url(#${p}-blur)" transform="translate(1.5 2.5)"/>
  </g>
  <path d="${inner}" fill="url(#${p}-sheen)"/>
  <path d="${inner}" fill="none" stroke="${GOLD.ink}" stroke-width="1"/>`;
}
