// The territory map's region textures (spec §5.8, contract C5): which region each texel belongs to, filled scanline
// by scanline from the region polygons (src/data/territory.js), and how far each texel lies from the nearest border
// between two regions, measured to the polygons' own edges, so the shader draws smooth borders at any zoom.
// Pure JS (no three, no DOM): testable under Node.

/** Texels of distance the border field covers; beyond it a texel reads 255. */
export const BORDER_RANGE = 16;

/** A tw × th Uint8Array of region ids (row 0 = the map's north edge), each texel the region under its centre. */
export function regionIds(regions, map, tw, th) {
  const ids = new Uint8Array(tw * th), xs = [];
  const sx = tw / map.w;
  for (const r of regions) {
    const P = r.polygon;
    let y0 = Infinity, y1 = -Infinity;
    for (const p of P) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const j0 = Math.max(0, Math.floor((y0 / map.h) * th - 0.5)), j1 = Math.min(th - 1, Math.ceil((y1 / map.h) * th - 0.5));
    for (let j = j0; j <= j1; j++) {
      const y = ((j + 0.5) / th) * map.h;
      xs.length = 0;
      for (let k = 0, m = P.length - 1; k < P.length; m = k++) {
        const a = P[k], b = P[m];
        if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        // texel centres (i + 0.5) / sx in [xs[k], xs[k + 1])
        const i0 = Math.max(0, Math.ceil(xs[k] * sx - 0.5)), i1 = Math.min(tw - 1, Math.ceil(xs[k + 1] * sx - 0.5) - 1);
        ids.fill(r.id, j * tw + i0, j * tw + i1 + 1);
      }
    }
  }
  // a texel centre exactly on a border can fall between two fills: take its western (or northern) neighbour's
  for (let k = 0; k < ids.length; k++) if (!ids[k]) ids[k] = k % tw ? ids[k - 1] : ids[k - tw] || ids[k + 1];
  return ids;
}

const onEdge = (map, a, b) => (a[0] === b[0] && (a[0] === 0 || a[0] === map.w)) || (a[1] === b[1] && (a[1] === 0 || a[1] === map.h));

/** A tw × th Uint8Array: the distance in texels from each texel centre to the nearest border between regions,
 *  scaled so BORDER_RANGE texels or more read 255. The map's outer edge is not a border. */
export function borderField(regions, map, tw, th) {
  const dist = new Float32Array(tw * th).fill(BORDER_RANGE);
  const sx = tw / map.w, sy = th / map.h, R = BORDER_RANGE, drawn = new Set();
  for (const r of regions) {
    const P = r.polygon;
    for (let k = 0; k < P.length; k++) {
      const a = P[k], b = P[(k + 1) % P.length];
      if (onEdge(map, a, b)) continue;
      const key = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? `${a},${b}` : `${b},${a}`;   // both neighbours hold the edge
      if (drawn.has(key)) continue;
      drawn.add(key);
      // in texel units, texel centres at i + 0.5
      const ax = a[0] * sx, ay = a[1] * sy, bx = b[0] * sx, by = b[1] * sy, dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx) - R)), i1 = Math.min(tw - 1, Math.ceil(Math.max(ax, bx) + R));
      const j0 = Math.max(0, Math.floor(Math.min(ay, by) - R)), j1 = Math.min(th - 1, Math.ceil(Math.max(ay, by) + R));
      for (let j = j0; j <= j1; j++) {
        const py = j + 0.5;
        for (let i = i0; i <= i1; i++) {
          const px = i + 0.5;
          const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
          const ex = ax + dx * t - px, ey = ay + dy * t - py, d = Math.sqrt(ex * ex + ey * ey), n = j * tw + i;
          if (d < dist[n]) dist[n] = d;
        }
      }
    }
  }
  const out = new Uint8Array(tw * th);
  for (let n = 0; n < out.length; n++) out[n] = Math.min(255, Math.round((dist[n] / R) * 255));
  return out;
}
