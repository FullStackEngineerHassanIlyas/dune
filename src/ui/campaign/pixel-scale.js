// Pixel art enlarged by Scale2x (Andrea Mazzoleni's AdvMAME2x, the EPX rule): each pixel becomes a 2 x 2 block, and
// a corner of the block takes the colour of the two neighbours that meet there when they agree (and the other two
// do not), so a staircase becomes a smooth diagonal while flat areas, straight edges and lone pixels stay as drawn.
// No colour is ever mixed: every output pixel is one of the picture's own, so a palette picture stays a palette
// picture, and the rule runs as well on its colour indices. Run k times it is Scale4x (AdvMAME4x) or Scale8x. The
// original Mentat (original-mentat-art.js) is enlarged so once, when his picture is made, and then shown at any
// size, smoothly, from the large picture.

/** How far (in the picture's own pixels) a change reaches in the enlarged picture, for any factor: under 2. */
export const REACH = 2;

/** One Scale2x pass over `p` (one value a pixel: indices or 32-bit colours), width x height: the picture twice as wide and high. */
function pass(p, width, height) {
  const w2 = width * 2, out = new p.constructor(w2 * height * 2);
  for (let y = 0; y < height; y++) {
    const row = y * width, o0 = y * 2 * w2, o1 = o0 + w2;
    for (let x = 0; x < width; x++) {
      const i = row + x, e = p[i];
      const up = y ? p[i - width] : e, down = y < height - 1 ? p[i + width] : e;   // beyond the edge: the pixel itself
      const left = x ? p[i - 1] : e, right = x < width - 1 ? p[i + 1] : e;
      let e0 = e, e1 = e, e2 = e, e3 = e;
      if (up !== down && left !== right) {
        if (left === up) e0 = left;
        if (up === right) e1 = right;
        if (left === down) e2 = left;
        if (down === right) e3 = right;
      }
      const o = 2 * x;
      out[o0 + o] = e0; out[o0 + o + 1] = e1; out[o1 + o] = e2; out[o1 + o + 1] = e3;
    }
  }
  return out;
}

const checkFactor = (factor) => {
  if (!(factor >= 1 && Number.isInteger(Math.log2(factor)))) throw new RangeError(`pixel-scale: ${factor} is not a power of two`);
};

/**
 * A picture of one value a pixel (colour indices, a Uint8Array, or any typed array), width x height, enlarged
 * `factor` times by Scale2x passes: factor 1, 2, 4, 8 … (a power of two). Returns a new array of the same kind,
 * (width * factor) x (height * factor).
 */
export function scaleIndexed(values, width, height, factor = 2) {
  checkFactor(factor);
  if (values.length !== width * height) throw new RangeError(`pixel-scale: ${values.length} values are not ${width} x ${height} pixels`);
  let p = values, w = width, h = height;
  for (let f = 1; f < factor; f *= 2) { p = pass(p, w, h); w *= 2; h *= 2; }
  return p === values ? values.slice() : p;
}

/** RGBA bytes as one 32-bit word a pixel (r | g << 8 | b << 16 | a << 24), every see-through pixel the same word, 0. */
export function rgbaWords(rgba) {
  const n = rgba.length >> 2, p = new Uint32Array(n);
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    p[i] = rgba[o + 3] ? (rgba[o] | (rgba[o + 1] << 8) | (rgba[o + 2] << 16) | (rgba[o + 3] << 24)) >>> 0 : 0;
  }
  return p;
}

/**
 * `rgba` (width x height, 4 bytes a pixel) enlarged `factor` times by Scale2x passes (a power of two). Returns new
 * RGBA bytes, (width * factor) x (height * factor); every see-through pixel comes out as 0, 0, 0, 0.
 */
export function scalePixelArt(rgba, width, height, factor = 2) {
  if (rgba.length !== width * height * 4) throw new RangeError(`pixel-scale: ${rgba.length} bytes are not ${width} x ${height} RGBA pixels`);
  return wordsRgba(scaleIndexed(rgbaWords(rgba), width, height, factor));
}

/** RGBA words (rgbaWords) back to RGBA bytes, 4 a word. */
export function wordsRgba(words) {
  const out = new Uint8Array(words.length * 4);
  for (let i = 0, o = 0; i < words.length; i++, o += 4) {
    const c = words[i];
    out[o] = c & 255; out[o + 1] = (c >>> 8) & 255; out[o + 2] = (c >>> 16) & 255; out[o + 3] = c >>> 24;
  }
  return out;
}
