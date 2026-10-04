// The painter's finish for the baked Mentat portraits (assets/campaign/portraits/bake.mjs): plain functions over
// RGBA bytes, no imports, so the bake runs them inside the page and the tests run them in Node.

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
