// Westwood CPS pictures, as Dune II keeps its full screens (the Mentats' rooms MENTATA/H/O.CPS, the house
// selection HERALD.CPS, the score screen FAME.CPS, the maps…): a 10-byte header — the file's size less these two
// bytes, the packing (0 none, 4 Format80; the other Westwood packings are not used by Dune II), the picture's
// unpacked size (64000: 320 x 200 pixels, one colour index each), the size of a palette that follows (0, or 768) —
// then the palette if any (6-bit VGA colours, pal.js), then the pixels. Written from the published description of
// the format (ModdingWiki, "CPS Format").
import { PictureError, bytesOf } from './picture-error.js';
import { readPalette, PALETTE_BYTES } from './pal.js';
import { unpackFormat80 } from './format80.js';

export const CPS_WIDTH = 320;
const HEADER = 10;

/**
 * Reads a CPS picture: { width: 320, height, pixels: Uint8Array of colour indices (row by row), palette: an 8-bit
 * RGB palette (768 bytes) when the file holds one, else null }. A damaged file throws a PictureError naming
 * `label` and the byte.
 */
export function readCps(data, label = 'picture.cps') {
  const b = bytesOf(data, label), n = b.length;
  if (n < HEADER) throw new PictureError(`${label}: too short to be a CPS picture (${n} bytes)`);
  const u16 = (p) => b[p] | (b[p + 1] << 8);
  // the size word is the file's size less its own two bytes; trailing bytes past it are not the picture's. A file cut
  // short is found by the pixels running out (the size word alone is not trusted to say so).
  const told = Math.min(u16(0) + 2, n);
  const packing = u16(2);
  if (packing !== 0 && packing !== 4) throw new PictureError(`${label}: packing ${packing} at byte 2 is not one Dune II uses (0 or 4)`);
  const size = (b[4] | (b[5] << 8) | (b[6] << 16) | (b[7] << 24)) >>> 0;
  if (!size || size % CPS_WIDTH || size > CPS_WIDTH * 400) throw new PictureError(`${label}: a picture of ${size} bytes (byte 4) is not rows of ${CPS_WIDTH} pixels`);
  const paletteSize = u16(8);
  if (paletteSize !== 0 && paletteSize !== PALETTE_BYTES) throw new PictureError(`${label}: a palette of ${paletteSize} bytes (byte 8) is not one of 256 colours`);
  if (HEADER + paletteSize > told) throw new PictureError(`${label}: the palette from byte ${HEADER} runs past the end of the file (${told} bytes)`);
  const palette = paletteSize ? readPalette(b, { from: HEADER, label }) : null;
  const from = HEADER + paletteSize;
  let pixels;
  if (packing === 0) {
    if (from + size > told) throw new PictureError(`${label}: ${size} pixels from byte ${from} run past the end of the file`);
    pixels = b.slice(from, from + size);
  } else {
    const r = unpackFormat80(b, { from, to: told, size, label, what: 'the picture' });
    if (r.length < size) throw new PictureError(`${label}: the picture ends at byte ${r.end} after ${r.length} of its ${size} pixels`);
    pixels = r.bytes;
  }
  return { width: CPS_WIDTH, height: size / CPS_WIDTH, pixels, palette };
}
