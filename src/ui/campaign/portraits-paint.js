// The painter's kit for the Mentat portraits (portraits-cyril.js, portraits-radnor.js, portraits-ammon.js): each
// portrait is painted in layered SVG, the way a digital painter works: flat local colours, then soft shadow and light
// shapes (blurred, clipped to the form), tapered hair strands, cloth folds, a fine grain, and a light rig shared by all
// three (a warm key light from the upper left, a cool or coloured rim light from the right, the house's chamber behind).
// The paintings are baked once to WebP layers by assets/campaign/portraits/bake.mjs; the game shows those images
// (portraits.js). Everything here is our own drawing, after the descriptions in research.md §4.

export const VIEW_W = 400, VIEW_H = 500;
/** The layers a portrait is baked into: the chamber, the body, the head (it sways), the closed eyes (the blink). */
export const LAYERS = ['back', 'body', 'head', 'lids'];

export const r2 = (v) => Math.round(v * 100) / 100;

/** A small seeded random source (mulberry32), so a painting is the same every bake. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const stopsOf = (stops) => stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}"${a === 1 ? '' : ` stop-opacity="${a}"`}/>`).join('');

/**
 * One painting's drawing context: ids carry its prefix, and every gradient, clip and filter is defined once.
 * lin/rad return a url() for fill; blur(sd) a filter url (user-space region over the whole picture, so a large blur
 * never shows the filter's edge); clip(name, d) a clip-path url.
 */
export function canvas(prefix) {
  const defs = [];
  const seen = new Set();
  const def = (name, make) => {
    const id = `${prefix}-${name}`;
    if (!seen.has(id)) { seen.add(id); defs.push(make(id)); }
    return `url(#${id})`;
  };
  return {
    prefix,
    def,
    lin: (name, stops, [x1, y1, x2, y2] = [0, 0, 1, 0], user = false) => def(name, (id) =>
      `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${user ? ' gradientUnits="userSpaceOnUse"' : ''}>${stopsOf(stops)}</linearGradient>`),
    rad: (name, stops, { cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy, user = false, transform = '' } = {}) => def(name, (id) =>
      `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}"${user ? ' gradientUnits="userSpaceOnUse"' : ''}${transform ? ` gradientTransform="${transform}"` : ''}>${stopsOf(stops)}</radialGradient>`),
    blur: (sd) => def(`b${String(sd).replace('.', '_')}`, (id) =>
      `<filter id="${id}" filterUnits="userSpaceOnUse" x="-80" y="-80" width="560" height="660" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${sd}"/></filter>`),
    clip: (name, d) => def(`clip-${name}`, (id) => `<clipPath id="${id}"><path d="${d}"/></clipPath>`),
    /** A fine paint grain: monochrome fractal noise, laid over a form with an overlay blend. */
    grain: (freq = 0.9, seed = 3) => def(`grain${String(freq).replace('.', '_')}-${seed}`, (id) =>
      `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${seed}"/>` +
      '<feColorMatrix type="matrix" values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  1.6 0 0 0 -.3"/></filter>'),
    /** A streaky brush texture (long along x): canvas or cloth weave under the paint. */
    streaks: (fx = 0.012, fy = 0.6, seed = 5) => def(`streak-${seed}`, (id) =>
      `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${VIEW_W}" height="${VIEW_H}" color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="2" seed="${seed}"/>` +
      '<feColorMatrix type="matrix" values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  2.2 0 0 0 -.6"/></filter>'),
    defs: () => defs.join(''),
  };
}

/** A filled path. */
export const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
/** Shapes painted with a soft brush: the group blurred by `sd` user units. */
export const soft = (c, sd, inner, opacity = 1) => `<g filter="${c.blur(sd)}"${opacity === 1 ? '' : ` opacity="${opacity}"`}>${inner}</g>`;
/** Shapes kept inside a form (the clip applied after any blur, so the form's edge stays crisp). */
export const inside = (clipUrl, inner) => `<g clip-path="${clipUrl}">${inner}</g>`;
/** An ellipse, as a filled shape. */
export const E = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(rx)}" ry="${r2(ry)}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
/** A stroked path (no fill). */
export const S = (d, stroke, w, extra = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra ? ` ${extra}` : ''}/>`;
/** Grain laid over a form: a rect filtered to noise, clipped to the form, overlay-blended. */
export const grainOver = (c, clipUrl, opacity = 0.18, freq = 0.9, seed = 3, blend = 'overlay') =>
  `<g clip-path="${clipUrl}" style="mix-blend-mode:${blend}" opacity="${opacity}"><rect width="${VIEW_W}" height="${VIEW_H}" filter="${c.grain(freq, seed)}"/></g>`;

const bez = (P4, t) => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * P4[0][k] + 3 * u * u * t * P4[1][k] + 3 * u * t * t * P4[2][k] + t * t * t * P4[3][k]);
};
const dbez = (P4, t) => {
  const u = 1 - t;
  return [0, 1].map((k) => 3 * u * u * (P4[1][k] - P4[0][k]) + 6 * u * t * (P4[2][k] - P4[1][k]) + 3 * t * t * (P4[3][k] - P4[2][k]));
};

/**
 * A tapered stroke along a cubic Bezier (four points) from t0 to t1, `w` wide at its widest: thick at the root and
 * thin at the tip (`shape` 'tip'), or thin at both ends ('both').
 */
export function taper(P4, w, { t0 = 0, t1 = 1, shape = 'tip', steps = 12 } = {}) {
  const left = [], right = [];
  for (let s = 0; s <= steps; s++) {
    const f = s / steps, t = t0 + (t1 - t0) * f;
    const [x, y] = bez(P4, t);
    const [dx, dy] = dbez(P4, t);
    const len = Math.hypot(dx, dy) || 1;
    const prof = shape === 'both' ? Math.sin(Math.PI * f) ** 0.65 : Math.min(1, f * 6) ** 0.5 * (1 - f) ** 0.8;
    const h = (prof * w) / 2;
    left.push([x - (dy / len) * h, y + (dx / len) * h]);
    right.push([x + (dy / len) * h, y - (dx / len) * h]);
  }
  const pts = left.concat(right.reverse());
  return `M${pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}Z`;
}

/**
 * Hair (or fur, or brows): `count` tapered strands, each between two neighbouring guide curves (lists of four points),
 * jittered, trimmed at random, `w` wide, coloured by `color(R, along)` where along is 0..1 across the guides.
 */
export function strands(R, { guides, count, w = [0.6, 1.6], color, opacity = [0.55, 1], jitter = 2, trim = 0.15, shape = 'tip' }) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const g = R() * (guides.length - 1);
    const k = Math.min(Math.floor(g), guides.length - 2), f = g - k;
    const A = guides[k], B = guides[k + 1];
    const j = () => (R() - 0.5) * 2 * jitter;
    const P4 = A.map((p, n) => [p[0] + (B[n][0] - p[0]) * f + j(), p[1] + (B[n][1] - p[1]) * f + j()]);
    const t0 = R() * trim, t1 = 1 - R() * trim;
    const width = w[0] + R() * (w[1] - w[0]);
    const a = opacity[0] + R() * (opacity[1] - opacity[0]);
    out.push(`<path d="${taper(P4, width, { t0, t1, shape })}" fill="${color(R, g / (guides.length - 1))}" opacity="${r2(a)}"/>`);
  }
  return out.join('');
}

/**
 * Locks of hair, the way a painter blocks them in before the strands: each a tapered ribbon in a body colour, a dark
 * line along its shadowed edge (where it parts from the next lock) and a soft highlight along its lit edge (the key
 * light is up and to the left). Returns three strings to lay in order: bodies, darks (soft), lights (soft).
 */
export function locks(R, { guides, count, w = [8, 16], body, dark, light, jitter = 3, trim = 0.1, lit = [-0.6, -0.8] }) {
  const bodies = [], darks = [], lights = [], forms = [];
  const off = (P4, d) => P4.map(([x, y], n) => {
    const t = n / 3;
    const [dx, dy] = dbez(P4, Math.min(0.98, Math.max(0.02, t)));
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    if (nx * lit[0] + ny * lit[1] < 0) { nx = -nx; ny = -ny; }
    return [x + nx * d, y + ny * d];
  });
  for (let i = 0; i < count; i++) {
    const g = R() * (guides.length - 1);
    const k = Math.min(Math.floor(g), guides.length - 2), f = g - k;
    const A = guides[k], B = guides[k + 1];
    const j = () => (R() - 0.5) * 2 * jitter;
    const P4 = A.map((p, n) => [p[0] + (B[n][0] - p[0]) * f + j(), p[1] + (B[n][1] - p[1]) * f + j()]);
    const t0 = R() * trim, t1 = 1 - R() * trim;
    const width = w[0] + R() * (w[1] - w[0]);
    bodies.push(`<path d="${taper(P4, width, { t0, t1, shape: 'both' })}" fill="${body(R)}"/>`);
    forms.push({ t: 'ridge', bz: P4.map(([x, y]) => [r2(x), r2(y)]), w: r2(width * 0.38), h: r2(0.9 + R() * 1.3), taper: true });
    darks.push(`<path d="${taper(off(P4, -width * 0.42), width * 0.3, { t0: t0 + 0.05, t1: t1 - 0.02, shape: 'both' })}" fill="${dark(R)}"/>`);
    lights.push(`<path d="${taper(off(P4, width * 0.18), width * 0.34, { t0: t0 + 0.12 + R() * 0.1, t1: t1 - 0.2 - R() * 0.15, shape: 'both' })}" fill="${light(R)}" opacity="${r2(0.45 + R() * 0.5)}"/>`);
  }
  return { bodies: bodies.join(''), darks: darks.join(''), lights: lights.join(''), forms };
}

/**
 * A finger (or any limb segment): a capsule from a to b, `w` wide (`w1` at b), bowed by `bend` to its left as seen
 * going from a to b, with round ends. Returns its outline (M/C only, so the bake can inflate it).
 */
export function capsule([ax, ay], [bx, by], w, { w1 = w, bend = 0 } = {}) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const h0 = w / 2, h1 = w1 / 2, k = 0.5523;
  const c1 = [ax + dx / 3 + nx * bend, ay + dy / 3 + ny * bend], c2 = [ax + (2 * dx) / 3 + nx * bend, ay + (2 * dy) / 3 + ny * bend];
  const p = (x, y) => `${r2(x)} ${r2(y)}`;
  return `M${p(ax + nx * h0, ay + ny * h0)}`
    + ` C${p(c1[0] + nx * h0, c1[1] + ny * h0)} ${p(c2[0] + nx * h1, c2[1] + ny * h1)} ${p(bx + nx * h1, by + ny * h1)}`
    + ` C${p(bx + nx * h1 + ux * h1 * k, by + ny * h1 + uy * h1 * k)} ${p(bx + ux * h1 + nx * h1 * k, by + uy * h1 + ny * h1 * k)} ${p(bx + ux * h1, by + uy * h1)}`
    + ` C${p(bx + ux * h1 - nx * h1 * k, by + uy * h1 - ny * h1 * k)} ${p(bx - nx * h1 + ux * h1 * k, by - ny * h1 + uy * h1 * k)} ${p(bx - nx * h1, by - ny * h1)}`
    + ` C${p(c2[0] - nx * h1, c2[1] - ny * h1)} ${p(c1[0] - nx * h0, c1[1] - ny * h0)} ${p(ax - nx * h0, ay - ny * h0)}`
    + ` C${p(ax - nx * h0 - ux * h0 * k, ay - ny * h0 - uy * h0 * k)} ${p(ax - ux * h0 - nx * h0 * k, ay - uy * h0 - ny * h0 * k)} ${p(ax - ux * h0, ay - uy * h0)}`
    + ` C${p(ax - ux * h0 + nx * h0 * k, ay - uy * h0 + ny * h0 * k)} ${p(ax + nx * h0 - ux * h0 * k, ay + ny * h0 - uy * h0 * k)} ${p(ax + nx * h0, ay + ny * h0)}Z`;
}

/** Picks from a palette at random, weighted. */
export const pick = (pairs) => (R) => {
  const total = pairs.reduce((s, [, wgt]) => s + wgt, 0);
  let x = R() * total;
  for (const [c, wgt] of pairs) { x -= wgt; if (x <= 0) return c; }
  return pairs[pairs.length - 1][0];
};

/**
 * An eye, painted: the white shaded under the lid and at the corners, the iris (limbal ring, a lighter inner ring,
 * fibres, the pupil, a catch light), the lash line and lid, the lower lid's wet line, the crease above. Closed
 * (`closed`), the upper lid comes down to the lower one, the lashes drawn along it. `R` adds the iris fibres.
 */
export function eye(c, name, { cx, cy, w, open, tilt = 0, iris, irisDark, look = 0, lookY = 0, skin, lidShade, lash = '#2a170e',
  crease = 'rgba(90,45,28,.5)', heavy = 0, closed = false, R = rng(1), irisR = null, glints = true }) {
  const L = cx - w / 2, Rx = cx + w / 2;
  const yl = cy + tilt, yr = cy - tilt;   // outer corner up (tilt>0 for the right eye's outer corner) as given
  const top = `M${r2(L)} ${r2(yl)} C${r2(L + w * 0.18)} ${r2(cy - open * 0.95)} ${r2(Rx - w * 0.32)} ${r2(cy - open * 1.05)} ${r2(Rx)} ${r2(yr)}`;
  const bottom = `C${r2(Rx - w * 0.25)} ${r2(cy + open * 0.62)} ${r2(L + w * 0.22)} ${r2(cy + open * 0.6)} ${r2(L)} ${r2(yl)}`;
  const shape = `${top} ${bottom}Z`;
  const clip = c.clip(`eye-${name}`, shape);
  const rI = irisR ?? open * 0.76;
  const ix = cx + look, iy = cy + lookY + open * 0.05;
  const lidGrad = c.lin(`lid-${name}`, [[0, skin[0]], [1, skin[1]]], [0, 0, 0, 1]);
  if (closed) {
    const lidLine = `M${r2(L)} ${r2(yl)} C${r2(L + w * 0.25)} ${r2(cy + open * 0.55)} ${r2(Rx - w * 0.25)} ${r2(cy + open * 0.5)} ${r2(Rx)} ${r2(yr)}`;
    return `${P(`${top} ${bottom}Z`, lidGrad)}
      ${soft(c, 1.5, S(`M${r2(L + 2)} ${r2(cy - open * 0.55)} C${r2(L + w * 0.3)} ${r2(cy - open * 0.9)} ${r2(Rx - w * 0.3)} ${r2(cy - open * 0.95)} ${r2(Rx - 2)} ${r2(cy - open * 0.5)}`, lidShade, 2.2), 0.5)}
      ${soft(c, 0.6, S(lidLine, lash, 1.8))}
      ${S(lidLine, lash, 1.1)}
      ${soft(c, 1.2, S(`M${r2(L - 2)} ${r2(cy - open * 1.4 - heavy)} C${r2(L + w * 0.3)} ${r2(cy - open * 2 - heavy)} ${r2(Rx - w * 0.3)} ${r2(cy - open * 2 - heavy)} ${r2(Rx + 1)} ${r2(cy - open * 1.2 - heavy)}`, crease, 1.6))}`;
  }
  const fib = [];
  const RR = R;
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2 + RR() * 0.2;
    const r0 = rI * 0.42, r1 = rI * (0.82 + RR() * 0.12);
    fib.push(`M${r2(ix + Math.cos(a) * r0)} ${r2(iy + Math.sin(a) * r0)}L${r2(ix + Math.cos(a) * r1)} ${r2(iy + Math.sin(a) * r1)}`);
  }
  const irisFill = c.rad(`iris-${name}`, [[0, iris[0]], [0.45, iris[1]], [0.85, iris[2]], [1, irisDark]], { cx: 0.5, cy: 0.55, r: 0.5 });
  const white = c.rad(`white-${name}`, [[0, '#ece2d6'], [0.6, '#d8c8b8'], [1, '#a38a7a']], { cx: 0.48, cy: 0.62, r: 0.62 });
  return `${P(shape, white)}
    <g clip-path="${clip}">
      ${E(ix, iy, rI, rI, irisFill)}
      <path d="${fib.join('')}" stroke="${iris[0]}" stroke-width=".45" opacity=".55"/>
      ${E(ix, iy, rI, rI, 'none', `stroke="${irisDark}" stroke-width="${r2(rI * 0.16)}" opacity=".85"`)}
      ${E(ix, iy, rI * 0.4, rI * 0.4, '#0b0705')}
      ${soft(c, 1.6, `<path d="${top} L${r2(Rx + 4)} ${r2(cy - open * 3)} L${r2(L - 4)} ${r2(cy - open * 3)}Z" fill="${lidShade}" transform="translate(0 ${r2(open * 0.5 + heavy * 0.5)})"/>`, 0.85)}
      ${soft(c, 1.2, `${E(L + 1, yl, w * 0.16, open, 'rgba(150,70,60,.45)')}${E(Rx, yr, w * 0.12, open, 'rgba(110,60,50,.35)')}`)}
      ${glints ? eyeGlints({ ix, iy, rI }) : ''}
    </g>
    ${soft(c, 0.5, S(`M${r2(L + w * 0.12)} ${r2(cy + open * 0.48)} C${r2(L + w * 0.35)} ${r2(cy + open * 0.68)} ${r2(Rx - w * 0.3)} ${r2(cy + open * 0.66)} ${r2(Rx - w * 0.06)} ${r2(cy + open * 0.36)}`, 'rgba(255,225,205,.55)', 0.9))}
    ${soft(c, 0.8, S(`M${r2(L + w * 0.1)} ${r2(cy + open * 0.62)} C${r2(L + w * 0.35)} ${r2(cy + open * 0.85)} ${r2(Rx - w * 0.3)} ${r2(cy + open * 0.82)} ${r2(Rx - w * 0.04)} ${r2(cy + open * 0.5)}`, 'rgba(110,60,45,.5)', 1.2))}
    ${soft(c, 1, S(`M${r2(L + w * 0.08)} ${r2(cy - open * 1.05 - heavy * 0.3)} C${r2(L + w * 0.3)} ${r2(cy - open * 1.55 - heavy * 0.5)} ${r2(Rx - w * 0.35)} ${r2(cy - open * 1.6 - heavy * 0.5)} ${r2(Rx - w * 0.08)} ${r2(cy - open * 0.95 - heavy * 0.3)}`, skin[0], 2.2), 0.55)}
    ${soft(c, 0.5, S(top, lash, 2.6 + heavy * 0.4))}
    ${S(top, lash, 1.5 + heavy * 0.3)}
    ${soft(c, 0.4, S(`M${r2(Rx - w * 0.28)} ${r2(cy - open * 0.92)} l${r2(w * 0.12)} ${r2(-open * 0.18)} M${r2(Rx - w * 0.16)} ${r2(cy - open * 0.7)} l${r2(w * 0.12)} ${r2(-open * 0.12)} M${r2(Rx - w * 0.06)} ${r2(cy - open * 0.42)} l${r2(w * 0.1)} ${r2(-open * 0.06)}`, lash, 0.8), 0.8)}
    ${soft(c, 1.2, S(`M${r2(L - 2)} ${r2(cy - open * 1.4 - heavy)} C${r2(L + w * 0.3)} ${r2(cy - open * 2 - heavy)} ${r2(Rx - w * 0.3)} ${r2(cy - open * 2 - heavy)} ${r2(Rx + 1)} ${r2(cy - open * 1.2 - heavy)}`, crease, 1.6 + heavy * 0.3))}`;
}

/** The catch lights in an iris (painted over the lit picture, so the lighting does not dim them). */
export const eyeGlints = ({ ix, iy, rI }) => `${E(ix - rI * 0.32, iy - rI * 0.36, rI * 0.2, rI * 0.17, '#fff', 'opacity=".92"')}${E(ix + rI * 0.36, iy + rI * 0.34, rI * 0.09, rI * 0.07, '#fff', 'opacity=".45"')}`;

/** The upper and lower lid lines of an eye painted by eye() with the same numbers, as Bezier point lists. */
export function lidCurves({ cx, cy, w, open, tilt = 0 }) {
  const L = cx - w / 2, Rx = cx + w / 2, yl = cy + tilt, yr = cy - tilt;
  return {
    top: [[L, yl], [L + w * 0.18, cy - open * 0.95], [Rx - w * 0.32, cy - open * 1.05], [Rx, yr]].map((p) => p.map(r2)),
    bottom: [[Rx, yr], [Rx - w * 0.25, cy + open * 0.62], [L + w * 0.22, cy + open * 0.6], [L, yl]].map((p) => p.map(r2)),
    closed: [[L, yl], [L + w * 0.25, cy + open * 0.55], [Rx - w * 0.25, cy + open * 0.5], [Rx, yr]].map((p) => p.map(r2)),
  };
}

/** Wraps painted layers into one SVG document of the portrait's size (`scale` px per unit sets its pixel size). */
export function svgDoc(c, body, { scale = 1, label = '' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" width="${VIEW_W * scale}" height="${VIEW_H * scale}"${label ? ` aria-label="${label}"` : ''}><defs>${c.defs()}</defs>${body}</svg>`;
}
