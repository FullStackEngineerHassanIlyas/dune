// The relief lighting the Mentat portraits are baked with (assets/campaign/portraits/bake.mjs): each figure is a
// painted colour map (albedo) over a height field built from simple forms (domes, soft bumps, ridges along a line, and
// any SVG outline "inflated" into a rounded slab), and this lights it like a sculpture: a key light with soft wrap and
// a warm subsurface band at the terminator for skin, cast shadows marched through the height field, ambient occlusion
// from its hollows, a fill light, a rim light, specular sheen where the material map asks for it.
// Plain functions over typed arrays, no imports: the bake runs them inside the page; the tests run them in Node.

/** A Float32Array height field of w x h px, all zero. */
export function field(w, h) { return { w, h, d: new Float32Array(w * h) }; }

/** Blurs a float field in place: three box passes each way (about a Gaussian of sigma `r` px). */
export function blurField(f, r, x0 = 0, y0 = 0, x1 = f.w, y1 = f.h) {
  r = Math.max(1, Math.round(r));
  const { w, d } = f;
  const tmp = new Float32Array(Math.max(x1 - x0, y1 - y0) + 1);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = y0; y < y1; y++) {
      const n = x1 - x0;
      for (let i = 0; i < n; i++) tmp[i] = d[y * w + x0 + i];
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += tmp[Math.min(n - 1, Math.max(0, i))];
      for (let i = 0; i < n; i++) {
        d[y * w + x0 + i] = acc / (2 * r + 1);
        acc += tmp[Math.min(n - 1, i + r + 1)] - tmp[Math.max(0, i - r)];
      }
    }
    for (let x = x0; x < x1; x++) {
      const n = y1 - y0;
      for (let i = 0; i < n; i++) tmp[i] = d[(y0 + i) * w + x];
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += tmp[Math.min(n - 1, Math.max(0, i))];
      for (let i = 0; i < n; i++) {
        d[(y0 + i) * w + x] = acc / (2 * r + 1);
        acc += tmp[Math.min(n - 1, i + r + 1)] - tmp[Math.max(0, i - r)];
      }
    }
  }
  return f;
}

/** Lays a value into the field: added, subtracted, the higher of the two, or the higher with the seam rounded off
 *  over k px (a smooth union, so two forms grow into each other without a crease). */
const combine = (d, i, v, op, k = 0) => {
  if (op === 'max') { if (v > d[i]) d[i] = v; } else if (op === 'smax') {
    const a = d[i], hh = Math.max(k - Math.abs(a - v), 0) / (k || 1);
    d[i] = Math.max(a, v) + hh * hh * k * 0.25;
  } else if (op === 'sub') d[i] -= v; else if (op === 'min') { if (v < d[i]) d[i] = v; } else d[i] += v;
};

/** A form's mask: the outline's coverage over the box, blurred by r px (null without one). */
const maskOf = (form, X0, Y0, X1, Y1, scale, rasterize) => {
  if (!form.mask || !rasterize || X1 <= X0 || Y1 <= Y0) return null;
  const g = { w: X1 - X0, h: Y1 - Y0, d: Float32Array.from(rasterize(form.mask, X1 - X0, Y1 - Y0, scale, [X0, Y0])) };
  if (form.maskOut) {
    const out = rasterize(form.maskOut, X1 - X0, Y1 - Y0, scale, [X0, Y0]);
    for (let i = 0; i < g.d.length; i++) g.d[i] *= 1 - Math.min(1, out[i]);
  }
  if (form.maskR) blurField(g, form.maskR * scale);
  return g;
};

/** Points along a cubic Bezier (four points), or the polyline as given. */
function polyline(form) {
  if (!form.bz) return form.pts;
  const [p0, p1, p2, p3] = form.bz, out = [];
  for (let s = 0; s <= 16; s++) {
    const t = s / 16, u = 1 - t;
    out.push([0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]));
  }
  return out;
}

/** The outline's bounds, from the numbers in its path (M/L/C/Q/Z only), in SVG units. */
export function pathBounds(d) {
  const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]); y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]);
  }
  return [x0, y0, x1, y1];
}

/**
 * Adds forms to the field `f` (px), drawn at `scale` px per unit. Forms (units):
 *   { t: 'dome', cx, cy, rx, ry, h, e = 0.5, rot = 0, op }     a cap: h * (1 - q)^e inside the ellipse
 *   { t: 'bump', cx, cy, rx, ry, h, rot = 0, op }               a soft Gaussian bump (rx, ry about two sigmas)
 *   { t: 'ridge', pts | bz, w, h, op }                          a soft ridge (or groove, h < 0) along a line
 *   { t: 'slab', d, h, r, base = 0, round = true, cut = true }  an outline inflated: blurred by r, rounded, set on base
 *   { t: 'noise', mask, h, cell = 3, stretch = [1, 1], seed }      a fine texture (cloth weave, leather) inside mask
 * op: 'add' (default), 'max', 'smax' (a smooth union over k units), 'sub', 'min'. A dome, bump or ridge with
 * mask (an outline; maskOut, one to leave out) and maskR is kept inside that outline, its edge softened by maskR units. `rasterize(d, w, h, scale, bounds)` returns the outline's coverage as a
 * Float32Array (0..1) of the bounds' size; only slabs need it (the page passes one built on a canvas).
 */
export function addForms(f, forms, scale, rasterize = null) {
  const { w, h: H, d } = f;
  for (const form of forms) {
    const op = form.op ?? 'add';
    if (form.t === 'dome' || form.t === 'bump') {
      const { cx, cy, rx, ry, rot = 0 } = form;
      const hh = form.h * scale, e = form.e ?? 0.5;
      const c = Math.cos(-rot * Math.PI / 180), s = Math.sin(-rot * Math.PI / 180);
      const reach = form.t === 'bump' ? 1.6 : 1;
      const R = Math.max(rx, ry) * reach;
      const X0 = Math.max(0, Math.floor((cx - R) * scale)), X1 = Math.min(w, Math.ceil((cx + R) * scale));
      const Y0 = Math.max(0, Math.floor((cy - R) * scale)), Y1 = Math.min(H, Math.ceil((cy + R) * scale));
      const mk = maskOf(form, X0, Y0, X1, Y1, scale, rasterize), K = (form.k ?? 0) * scale;
      for (let y = Y0; y < Y1; y++) {
        for (let x = X0; x < X1; x++) {
          const ux = (x + 0.5) / scale - cx, uy = (y + 0.5) / scale - cy;
          const lx = (ux * c - uy * s) / rx, ly = (ux * s + uy * c) / ry;
          const q = lx * lx + ly * ly;
          let v;
          if (form.t === 'dome') { if (q >= 1) continue; v = hh * (1 - q) ** e; } else { if (q > reach * reach) continue; v = hh * Math.exp(-2 * q); }
          if (mk) { v *= mk.d[(y - Y0) * mk.w + x - X0]; if (op === 'smax' && v <= 0) continue; }
          combine(d, y * w + x, v, op, K);
        }
      }
    } else if (form.t === 'ridge') {
      const pts = polyline(form);
      const ww = form.w, hh = form.h * scale;
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const [x, y] of pts) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
      const X0 = Math.max(0, Math.floor((bx0 - ww * 1.6) * scale)), X1 = Math.min(w, Math.ceil((bx1 + ww * 1.6) * scale));
      const Y0 = Math.max(0, Math.floor((by0 - ww * 1.6) * scale)), Y1 = Math.min(H, Math.ceil((by1 + ww * 1.6) * scale));
      const mk = maskOf(form, X0, Y0, X1, Y1, scale, rasterize);
      for (let y = Y0; y < Y1; y++) {
        for (let x = X0; x < X1; x++) {
          const px = (x + 0.5) / scale, py = (y + 0.5) / scale;
          let best = Infinity, along = 0;
          for (let k = 0; k + 1 < pts.length; k++) {
            const [ax, ay] = pts[k], [bx, by] = pts[k + 1];
            const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
            const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2));
            const dx = px - ax - vx * t, dy = py - ay - vy * t, dd = dx * dx + dy * dy;
            if (dd < best) { best = dd; along = (k + t) / (pts.length - 1); }
          }
          const taper = form.taper ? Math.sin(Math.PI * Math.min(1, Math.max(0, along))) ** 0.5 : 1;
          const q = best / (ww * ww);
          if (q > 2.6) continue;
          combine(d, y * w + x, hh * taper * Math.exp(-2 * q) * (mk ? mk.d[(y - Y0) * mk.w + x - X0] : 1), op);
        }
      }
    } else if (form.t === 'noise' && rasterize) {
      // value noise on a lattice of `cell` units (two octaves, the second stretched along `stretch`), kept inside mask
      const [bx0, by0, bx1, by1] = pathBounds(form.mask);
      const X0 = Math.max(0, Math.floor(bx0 * scale)), X1 = Math.min(w, Math.ceil(bx1 * scale));
      const Y0 = Math.max(0, Math.floor(by0 * scale)), Y1 = Math.min(H, Math.ceil(by1 * scale));
      if (X1 <= X0 || Y1 <= Y0) continue;
      const cover = rasterize(form.mask, X1 - X0, Y1 - Y0, scale, [X0, Y0]);
      const hash = (i, j) => { let n = (i * 374761393 + j * 668265263 + (form.seed ?? 1) * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
      const smooth = (t) => t * t * (3 - 2 * t);
      const vnoise = (u, v) => {
        const i = Math.floor(u), j = Math.floor(v), fu = smooth(u - i), fv = smooth(v - j);
        const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), e = hash(i + 1, j + 1);
        return a + (b - a) * fu + (c - a) * fv + (a - b - c + e) * fu * fv;
      };
      const cell = form.cell ?? 3, [sx, sy] = form.stretch ?? [1, 1], hh = form.h * scale;
      for (let y = Y0; y < Y1; y++) {
        for (let x = X0; x < X1; x++) {
          const m = cover[(y - Y0) * (X1 - X0) + x - X0];
          if (m <= 0) continue;
          const u = (x + 0.5) / scale / cell, v = (y + 0.5) / scale / cell;
          const n = vnoise(u, v) * 0.65 + vnoise(u * 2.3 * sx + 17, v * 2.3 * sy + 5) * 0.35 - 0.5;
          d[y * w + x] += hh * n * m;
        }
      }
    } else if (form.t === 'slab' && rasterize) {
      const pad = (form.r ?? 4) * 2.2;
      const [bx0, by0, bx1, by1] = pathBounds(form.d);
      const X0 = Math.max(0, Math.floor((bx0 - pad) * scale)), X1 = Math.min(w, Math.ceil((bx1 + pad) * scale));
      const Y0 = Math.max(0, Math.floor((by0 - pad) * scale)), Y1 = Math.min(H, Math.ceil((by1 + pad) * scale));
      const bw = X1 - X0, bh = Y1 - Y0;
      if (bw <= 0 || bh <= 0) continue;
      const cover = rasterize(form.d, bw, bh, scale, [X0, Y0]);
      const g = { w: bw, h: bh, d: Float32Array.from(cover) };
      blurField(g, (form.r ?? 4) * scale);
      const hh = form.h * scale, base = (form.base ?? 0) * scale, round = form.round ?? true, cut = form.cut ?? true;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const m = g.d[y * bw + x], c0 = cover[y * bw + x];
          if (cut && c0 <= 0.001) continue;
          // inside the outline the blurred coverage climbs from 1/2 to 1: stretched to 0..1 and, for a round form,
          // taken through a quarter circle, the slab rises from its edge like a cylinder seen end on
          const m2 = cut ? Math.min(1, Math.max(0, 2 * m - 1)) : Math.min(1, Math.max(0, m));
          let v = base + hh * (round ? Math.sqrt(m2) : m2);
          if (cut && op !== 'max') v *= c0;
          const i = (Y0 + y) * w + X0 + x;
          if (op === 'max' && cut) { const cur = d[i]; const nv = cur + (Math.max(cur, v) - cur) * c0; d[i] = nv; } else combine(d, i, v, op);
        }
      }
    }
  }
  return f;
}

/**
 * A plain-JS stand-in for a canvas fill: an SVG outline (absolute M, L, H, V, C, Q, Z) rasterized as coverage 0..1 over
 * a bw x bh box whose corner is at px (x0, y0), at `scale` px per unit; nonzero winding, 4 sub-rows per row.
 */
export function rasterizePathJS(d, bw, bh, scale, [x0, y0]) {
  const polys = [];
  let cur = [], px = 0, py = 0, sx = 0, sy = 0;
  const toks = d.match(/[MLHVCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  let i = 0, cmd = 'M';
  const num = () => Number(toks[i++]);
  const pt = (x, y) => cur.push([x * scale - x0, y * scale - y0]);
  while (i < toks.length) {
    if (/[A-Z]/i.test(toks[i])) cmd = toks[i++].toUpperCase();
    if (cmd === 'Z') { if (cur.length) polys.push(cur); cur = []; px = sx; py = sy; continue; }
    if (cmd === 'M') { if (cur.length) polys.push(cur); cur = []; px = num(); py = num(); sx = px; sy = py; pt(px, py); cmd = 'L'; continue; }
    if (cmd === 'L') { px = num(); py = num(); pt(px, py); continue; }
    if (cmd === 'H') { px = num(); pt(px, py); continue; }
    if (cmd === 'V') { py = num(); pt(px, py); continue; }
    if (cmd === 'C' || cmd === 'Q') {
      const c = cmd === 'C' ? [num(), num(), num(), num(), num(), num()] : [num(), num(), num(), num()];
      const p0 = [px, py];
      for (let s = 1; s <= 12; s++) {
        const t = s / 12, u = 1 - t;
        const x = cmd === 'C' ? u * u * u * p0[0] + 3 * u * u * t * c[0] + 3 * u * t * t * c[2] + t * t * t * c[4] : u * u * p0[0] + 2 * u * t * c[0] + t * t * c[2];
        const y = cmd === 'C' ? u * u * u * p0[1] + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5] : u * u * p0[1] + 2 * u * t * c[1] + t * t * c[3];
        pt(x, y);
      }
      px = cmd === 'C' ? c[4] : c[2]; py = cmd === 'C' ? c[5] : c[3];
      continue;
    }
    i++;
  }
  if (cur.length) polys.push(cur);
  const out = new Float32Array(bw * bh);
  const SUB = 4;
  for (let row = 0; row < bh; row++) {
    for (let sub = 0; sub < SUB; sub++) {
      const y = row + (sub + 0.5) / SUB;
      const xs = [];
      for (const poly of polys) {
        for (let k = 0; k < poly.length; k++) {
          const [ax, ay] = poly[k], [bx, by] = poly[(k + 1) % poly.length];
          if ((ay <= y) !== (by <= y)) xs.push([ax + ((y - ay) / (by - ay)) * (bx - ax), by > ay ? 1 : -1]);
        }
      }
      xs.sort((a, b) => a[0] - b[0]);
      let wind = 0;
      for (let k = 0; k + 1 < xs.length; k++) {
        wind += xs[k][1];
        if (wind === 0) continue;
        const a = Math.max(0, xs[k][0]), b = Math.min(bw, xs[k + 1][0]);
        if (b <= a) continue;
        const ia = Math.floor(a), ib = Math.floor(b);
        for (let x = ia; x <= Math.min(bw - 1, ib); x++) {
          const cov = Math.min(b, x + 1) - Math.max(a, x);
          if (cov > 0) out[row * bw + x] += cov / SUB;
        }
      }
    }
  }
  return out;
}

/** A light rig's lengths (given in SVG units) in pixels, at `s` px per unit. */
export const rigToPx = (rig, s) => ({ ...rig, ao: { r: rig.ao.r * s, k: rig.ao.k / s },
  shadow: { ...rig.shadow, len: rig.shadow.len * s, soft: rig.shadow.soft * s, bias: rig.shadow.bias * s, blur: (rig.shadow.blur ?? rig.shadow.soft * 0.6) * s } });

const toLin = new Float32Array(256);
for (let i = 0; i < 256; i++) toLin[i] = (i / 255) ** 2.2;
const toSrgb = (v) => 255 * Math.min(1, Math.max(0, v)) ** (1 / 2.2);
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/**
 * Lights a layer. albedo: RGBA bytes (w x h); height: the layer's own field (px), for its normals; shadowField: the
 * field shadows are cast through (the whole figure; defaults to height); mat: RGBA bytes or null (R specular
 * strength, G gloss, B skin: the subsurface band and wrap). rig (colours linear 0..1):
 *   key { dir, color, i, wrap }, fill { dir, color, i }, rim { dir, color, i, power }, sky, ground (ambient),
 *   sss [r, g, b], ao { r (px), k }, shadow { len (px), soft, bias (px) }, spec { power, i }, exposure
 * Returns RGBA bytes (alpha from the albedo).
 */
export function shade({ w, h, albedo, height, shadowField = height, mat = null, rig }) {
  const out = new Uint8ClampedArray(w * h * 4);
  const H = height.d, SH = shadowField.d;
  const key = norm3(rig.key.dir), fill = norm3(rig.fill.dir), rim = norm3(rig.rim.dir);
  const half = norm3([key[0], key[1], key[2] + 1]);
  const aoF = { w, h, d: Float32Array.from(H) };
  blurField(aoF, rig.ao.r);
  const aoF2 = { w, h, d: Float32Array.from(H) };
  blurField(aoF2, rig.ao.r * 0.35);
  const lxy = Math.hypot(key[0], key[1]) || 1;
  const sdx = key[0] / lxy, sdy = key[1] / lxy, slope = key[2] / lxy;
  const { len = 120, soft = 6, bias = 0.6 } = rig.shadow;
  const wrapK = rig.key.wrap ?? 0.15;
  const exposure = rig.exposure ?? 1;
  // the key light's shadow, marched toward the light through the figure's field, its penumbra widening with the
  // distance to the occluder, then softened
  const litF = { w, h, d: new Float32Array(w * h).fill(1) };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (albedo[i * 4 + 3] === 0) continue;
      let lit = 1;
      const h0 = SH[i] + bias;
      for (let t = 1.5; t < len; t += 1 + t * 0.08) {
        const sx = Math.round(x + sdx * t), sy = Math.round(y + sdy * t);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) break;
        const over = SH[sy * w + sx] - (h0 + t * slope);
        if (over > 0) { lit = Math.min(lit, Math.max(0, 1 - over / (soft * (1 + t * 0.06)))); if (lit <= 0) break; }
      }
      litF.d[i] = lit;
    }
  }
  blurField(litF, rig.shadow.blur ?? soft * 0.6);
  // the rim light comes from behind: a surface catches it only where nothing of the figure stands between, so it
  // stays on the silhouette's edge and off the slopes within the form (a nose, a cheek)
  const rxy = Math.hypot(rim[0], rim[1]) || 1;
  const rdx = rim[0] / rxy, rdy = rim[1] / rxy, rslope = Math.min(-0.15, rim[2]) / rxy;
  const rimF = { w, h, d: new Float32Array(w * h) };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (albedo[i * 4 + 3] === 0) continue;
      let seen = 1;
      const h0 = SH[i];
      for (let t = 1; t < len * 0.5; t += 1 + t * 0.1) {
        const sx = Math.round(x + rdx * t), sy = Math.round(y + rdy * t);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) break;
        const over = SH[sy * w + sx] - (h0 + t * rslope);
        if (over > 0) { seen = Math.min(seen, Math.max(0, 1 - over / soft)); if (seen <= 0) break; }
      }
      rimF.d[i] = seen;
    }
  }
  blurField(rimF, (rig.shadow.blur ?? soft * 0.6) * 0.5);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, p = i * 4;
      const a = albedo[p + 3];
      if (a === 0) continue;
      const xl = x > 0 ? i - 1 : i, xr = x < w - 1 ? i + 1 : i, yu = y > 0 ? i - w : i, yd = y < h - 1 ? i + w : i;
      const nx0 = -(H[xr] - H[xl]) / (xr - xl || 1), ny0 = -(H[yd] - H[yu]) / ((yd - yu) / w || 1);
      const nl = Math.hypot(nx0, ny0, 1);
      const nx = nx0 / nl, ny = ny0 / nl, nz = 1 / nl;
      const sk = mat ? mat[p + 2] / 255 : 0, spS = mat ? mat[p] / 255 : 0, gloss = mat ? mat[p + 1] / 255 : 0;
      const lit = 1 - (rig.shadow.depth ?? 0.85) * (1 - litF.d[i]);
      const ndl = nx * key[0] + ny * key[1] + nz * key[2];
      const wrap = wrapK + sk * 0.25;
      const diff = Math.max(0, (ndl + wrap) / (1 + wrap)) * lit;
      const band = sk * Math.max(0, 1 - Math.abs(ndl - 0.05) / 0.35) * (0.4 + 0.6 * lit);
      const nf = Math.max(0, nx * fill[0] + ny * fill[1] + nz * fill[2]);
      const rimAmt = Math.max(0, 1 - nz) ** (rig.rim.power ?? 2) * Math.max(0, (nx * rdx + ny * rdy) * 0.8 + 0.2) * rimF.d[i];
      const up = 0.5 - 0.5 * ny;
      const cav = Math.max(0, aoF.d[i] - H[i]) + 0.6 * Math.max(0, aoF2.d[i] - H[i]);
      const ao = Math.exp(-cav * rig.ao.k);
      const spec = spS * Math.max(0, nx * half[0] + ny * half[1] + nz * half[2]) ** ((rig.spec.power ?? 30) * (0.35 + gloss * 2.2)) * lit * rig.spec.i;
      for (let ch = 0; ch < 3; ch++) {
        const alb = toLin[albedo[p + ch]];
        const amb = (rig.ground[ch] + (rig.sky[ch] - rig.ground[ch]) * up) * ao * (1 + sk * ((rig.skinAmb ?? [1, 1, 1])[ch] - 1));
        // skin in a cast shadow still glows warm where it faces the light (light scattered through it, and bounced)
        const warm = rig.sss[ch] * sk * (1 - litF.d[i]) * Math.max(0, ndl + 0.2) * 0.9;
        let v = alb * (amb + rig.key.color[ch] * rig.key.i * diff + rig.fill.color[ch] * rig.fill.i * nf * (0.55 + 0.45 * ao) + rig.sss[ch] * band + warm)
          + rig.rim.color[ch] * rig.rim.i * rimAmt * (0.35 + alb) * ao
          + rig.key.color[ch] * spec * (spS > 0.85 ? 0.4 + alb * 1.6 : 1);
        v *= exposure;
        out[p + ch] = toSrgb(v / (1 + v * 0.18));
      }
      out[p + 3] = a;
    }
  }
  return out;
}

/**
 * A painter's finish (a Kuwahara filter): each pixel takes the average colour of whichever of the four r x r boxes
 * around it is the most even, so smooth gradients break into small flat strokes while edges stay sharp; the result
 * is mixed back over the picture by `mix`. Works on premultiplied colour, so transparent edges do not fringe.
 */
export function painterly(rgba, w, h, r = 3, mix = 0.7) {
  const W1 = w + 1;
  const sums = Array.from({ length: 6 }, () => new Float64Array(W1 * (h + 1)));
  const [sR, sG, sB, sA, sL, sL2] = sums;
  for (let y = 0; y < h; y++) {
    let aR = 0, aG = 0, aB = 0, aA = 0, aL = 0, aL2 = 0;
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4, a = rgba[p + 3] / 255;
      const R = rgba[p] * a, G = rgba[p + 1] * a, B = rgba[p + 2] * a, L = 0.3 * R + 0.59 * G + 0.11 * B;
      aR += R; aG += G; aB += B; aA += rgba[p + 3]; aL += L; aL2 += L * L;
      const k = (y + 1) * W1 + x + 1, up = y * W1 + x + 1;
      sR[k] = sR[up] + aR; sG[k] = sG[up] + aG; sB[k] = sB[up] + aB; sA[k] = sA[up] + aA; sL[k] = sL[up] + aL; sL2[k] = sL2[up] + aL2;
    }
  }
  const box = (s, x0, y0, x1, y1) => s[y1 * W1 + x1] - s[y0 * W1 + x1] - s[y1 * W1 + x0] + s[y0 * W1 + x0];
  const out = new Uint8ClampedArray(rgba.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      if (rgba[p + 3] === 0) continue;
      let best = Infinity, bx0 = 0, by0 = 0, bx1 = 0, by1 = 0;
      for (const [qx, qy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const x0 = Math.max(0, qx < 0 ? x - r : x), x1 = Math.min(w, qx < 0 ? x + 1 : x + r + 1);
        const y0 = Math.max(0, qy < 0 ? y - r : y), y1 = Math.min(h, qy < 0 ? y + 1 : y + r + 1);
        const n = (x1 - x0) * (y1 - y0);
        const m = box(sL, x0, y0, x1, y1) / n, v = box(sL2, x0, y0, x1, y1) / n - m * m;
        if (v < best) { best = v; bx0 = x0; by0 = y0; bx1 = x1; by1 = y1; }
      }
      const n = (bx1 - bx0) * (by1 - by0);
      const A = box(sA, bx0, by0, bx1, by1) / n;
      const a = rgba[p + 3];
      if (A <= 0) { for (let c = 0; c < 4; c++) out[p + c] = rgba[p + c]; continue; }
      const k = 255 / A;
      const cols = [box(sR, bx0, by0, bx1, by1) / n * k, box(sG, bx0, by0, bx1, by1) / n * k, box(sB, bx0, by0, bx1, by1) / n * k];
      for (let c = 0; c < 3; c++) out[p + c] = rgba[p + c] + (cols[c] - rgba[p + c]) * mix;
      out[p + 3] = a;
    }
  }
  return out;
}
