// Small vector helpers for the house crests (crests.js): the creatures and the frame are drawn procedurally, so a
// wing is a fan of feathers, a horn a tapering spiral with growth rings and a serpent a tapering tube along a
// smooth spine. Everything returns SVG path data or markup strings with coordinates rounded to 0.1 unit.

/** A number for path data: one decimal, no trailing zeros. */
export const f = (v) => String(Math.round(v * 10) / 10);
/** "x y" of a point. */
export const pt = ([x, y]) => `${f(x)} ${f(y)}`;

export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, s) => [a[0] * s, a[1] * s];
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const len = (a) => Math.hypot(a[0], a[1]);
export const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
/** The left-hand normal of a direction (y down: a quarter turn anticlockwise on screen). */
export const normal = (a) => { const u = unit(a); return [u[1], -u[0]]; };
export const rad = (deg) => (deg * Math.PI) / 180;
/** Point `p` turned by `deg` degrees about `c` (clockwise on screen, y down). */
export function turn(p, deg, c = [0, 0]) {
  const a = rad(deg), s = Math.sin(a), co = Math.cos(a), x = p[0] - c[0], y = p[1] - c[1];
  return [c[0] + x * co - y * s, c[1] + x * s + y * co];
}

/** A smooth path through `points` (Catmull-Rom as cubic Béziers); closed adds the last-to-first span and Z. */
export function smooth(points, closed = false, tension = 1 / 6) {
  const n = points.length;
  if (n < 2) return '';
  const at = (i) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(points[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) * tension, p1[1] + (p2[1] - p0[1]) * tension];
    const c2 = [p2[0] - (p3[0] - p1[0]) * tension, p2[1] - (p3[1] - p1[1]) * tension];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return closed ? `${d}Z` : d;
}

/** A straight-segment path through `points`. */
export const poly = (points, closed = true) => `M${points.map(pt).join('L')}${closed ? 'Z' : ''}`;

/** Points sampled along a Catmull-Rom spline through `points` (`per` samples per span), for spines and rims. */
export function sample(points, per = 12, closed = false) {
  const n = points.length, out = [];
  const at = (i) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  const spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
        + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  if (!closed) out.push(points[n - 1]);
  return out;
}

/** Cumulative arc lengths of a polyline, normalised to 0..1. */
export function arcs(points) {
  const acc = [0];
  for (let i = 1; i < points.length; i++) acc.push(acc[i - 1] + len(sub(points[i], points[i - 1])));
  const total = acc.at(-1) || 1;
  return acc.map((a) => a / total);
}

/** Tangent of a polyline at index i (central difference). */
export function tangent(points, i) {
  const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
  return unit(sub(b, a));
}

/** The two edges of a tube of width `width(s)` (s = 0..1 along the spine): { left, right } point lists. */
export function edges(spine, width) {
  const s = arcs(spine), left = [], right = [];
  spine.forEach((p, i) => {
    const nrm = normal(tangent(spine, i)), w = width(s[i]) / 2;
    left.push(add(p, mul(nrm, w)));
    right.push(add(p, mul(nrm, -w)));
  });
  return { left, right, s };
}

/** Closed outline of a tube along `spine` (every other sample smoothed, so the path stays short). */
export function tube(spine, width, step = 2) {
  const { left, right } = edges(spine, width);
  const pick = (list) => list.filter((_, i) => i % step === 0 || i === list.length - 1);
  return smooth([...pick(left), ...pick(right).reverse()], true);
}

/**
 * A feather: base at `base`, pointing at `deg` (0 = right, 90 = down), `length` long, the inner vane `wide`
 * and the outer vane `narrow` wide, the tip rounded. Returns { d, rachis } path data.
 */
export function feather(base, deg, length, wide, narrow = wide * 0.6, tipRound = 0.5) {
  const L = length, local = [
    [0, 0], [L * 0.2, -narrow * 0.9], [L * 0.62, -narrow], [L * (1 - tipRound * 0.12), -narrow * 0.55], [L, 0],
    [L * (1 - tipRound * 0.1), wide * 0.6], [L * 0.6, wide], [L * 0.18, wide * 0.85],
  ];
  const w = local.map((p) => add(turn(p, deg), base));
  const rachis = `M${pt(base)}L${pt(add(turn([L * 0.92, 0], deg), base))}`;
  return { d: smooth(w, true, 0.18), rachis };
}

/** A logarithmic spiral from radius r0 at angle a0 (degrees) turning `turns` times to radius r1 about c. */
export function spiral(c, r0, r1, a0, turns, per = 64, dir = 1) {
  const n = Math.max(8, Math.round(per * turns)), out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = rad(a0 + dir * 360 * turns * t), r = r0 * Math.pow(r1 / r0, t);
    out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return out;
}

/** Markup mirrored left-right about x = cx. */
export const mirror = (markup, cx = 200) => `<g transform="matrix(-1 0 0 1 ${f(2 * cx)} 0)">${markup}</g>`;

/** A colour (#rrggbb) scaled by `k` (darker below 1), optionally mixed towards `toward` by `t`. */
export function shade(hex, k = 1, toward = null, t = 0) {
  const c = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  let [r, g, b] = c(hex).map((v) => v * k);
  if (toward) { const o = c(toward); r += (o[0] - r) * t; g += (o[1] - g) * t; b += (o[2] - b) * t; }
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}
