// Dune II's palettes (.PAL, such as IBM.PAL for the game's screens and BENE.PAL for the Bene Gesserit): 256
// colours as red, green and blue bytes in the VGA's 6-bit range (0..63), 768 bytes and nothing else. Read here
// into 8-bit colours, the 6 bits widened so 63 is full brightness (255).
import { PictureError, bytesOf } from './picture-error.js';

export const PALETTE_BYTES = 768;

/** A 6-bit VGA value (0..63) as an 8-bit one: the top bits repeat into the bottom two, so 63 → 255 and 0 → 0. */
export const widen6 = (v) => (v << 2) | (v >> 4);

/**
 * The 768 bytes at `from` in `data` as an 8-bit RGB palette (Uint8Array of 768). A byte past 63 is no VGA
 * colour: the file (or the picture holding the palette) is damaged, and a PictureError says which byte.
 */
export function readPalette(data, { from = 0, label = 'palette' } = {}) {
  const b = bytesOf(data, label);
  if (b.length - from < PALETTE_BYTES) throw new PictureError(`${label}: a palette needs ${PALETTE_BYTES} bytes, only ${Math.max(0, b.length - from)} from byte ${from}`);
  const out = new Uint8Array(PALETTE_BYTES);
  for (let i = 0; i < PALETTE_BYTES; i++) {
    const v = b[from + i];
    if (v > 63) throw new PictureError(`${label}: byte ${from + i} is ${v}, past the 0..63 of a VGA palette`);
    out[i] = widen6(v);
  }
  return out;
}

/** A .PAL file: exactly one palette of 768 bytes. */
export function readPal(data, label = 'palette.pal') {
  const b = bytesOf(data, label);
  if (b.length !== PALETTE_BYTES) throw new PictureError(`${label}: a .PAL file is ${PALETTE_BYTES} bytes, this one ${b.length}`);
  return readPalette(b, { label });
}

/**
 * Colour indices to RGBA (Uint8ClampedArray-ready Uint8Array, 4 bytes a pixel) through an 8-bit `palette`.
 * `alpha` (optional, one byte a pixel): 0 leaves the pixel transparent, as a shape's see-through pixels are.
 */
export function toRgba(indices, palette, alpha = null) {
  const out = new Uint8Array(indices.length * 4);
  for (let i = 0, o = 0; i < indices.length; i++, o += 4) {
    if (alpha && !alpha[i]) continue;
    const c = indices[i] * 3;
    out[o] = palette[c]; out[o + 1] = palette[c + 1]; out[o + 2] = palette[c + 2]; out[o + 3] = 255;
  }
  return out;
}
