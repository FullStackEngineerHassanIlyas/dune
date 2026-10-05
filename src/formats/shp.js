// Dune II shape files (.SHP): the small pictures drawn over the screens and the battlefield — the Mentats' eyes
// and mouths (MENSHPA/H/O.SHP), the mouse pointers, the units. Written from the published description of the
// format (ModdingWiki, "Dune II SHP Format"):
//   a count of shapes (16-bit), then their offsets: in the 1.07 releases 32-bit and counted from byte 2, with one
//   more giving the end; in 1.0 16-bit and counted from the file's start. (1.07's first offset is 4 + 4 x count.)
//   Each shape: flags (16-bit: 1 = a 16-colour table follows the header, 2 = the pixels are not Format80-packed),
//   height (8-bit), width (16-bit), height again, the shape's size with this header (16-bit), the unpacked size of
//   its pixels (16-bit), the table if any, then the pixels: row by row, a 0 byte and a count n for n see-through
//   pixels, any other byte one pixel (through the table when there is one: its value picks one of the 16).
// A shape whose offset is 0 is missing (null), as the original skips it.
import { PictureError, bytesOf } from './picture-error.js';
import { unpackFormat80 } from './format80.js';

const SHAPE_HEADER = 10, TABLE = 16;
const MAX_SHAPES = 4096;

/** The pixels of one shape (its "row by row, 0 n for n see-through" stream) into colour indices and an alpha mask. */
function unrun(stream, length, width, height, table, label, what, where) {
  const indices = new Uint8Array(width * height), alpha = new Uint8Array(width * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    let x = 0;
    const row = y * width;
    while (x < width) {
      if (p >= length) throw new PictureError(`${label}: ${what}'s pixels end in row ${y} of ${height} ${where(p)}`);
      const v = stream[p++];
      if (v === 0) {
        if (p >= length) throw new PictureError(`${label}: ${what}'s pixels end in row ${y} of ${height} ${where(p)}`);
        x += stream[p++];   // see-through; a run past the row's end ends the row, as the original draws it
      } else {
        indices[row + x] = table && v < TABLE ? table[v] : v;
        alpha[row + x] = 1;
        x++;
      }
    }
  }
  return { indices, alpha };
}

/**
 * Reads a shape file: { version: '1.0' | '1.07', shapes: [{ width, height, indices, alpha, table } | null] }:
 * colour indices row by row (through the shape's table already), `alpha` 1 where a pixel is drawn and 0 where the
 * screen shows through. A damaged file throws a PictureError naming `label`, the shape and the byte.
 */
export function readShp(data, label = 'shapes.shp') {
  const b = bytesOf(data, label), n = b.length;
  const u16 = (p) => b[p] | (b[p + 1] << 8);
  const u32 = (p) => (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;
  if (n < 2) throw new PictureError(`${label}: too short to be a shape file (${n} bytes)`);
  const count = u16(0);
  if (!count) throw new PictureError(`${label}: no shapes in it`);
  if (count > MAX_SHAPES) throw new PictureError(`${label}: ${count} shapes (byte 0) — not a shape file`);
  // 1.07: 32-bit offsets from byte 2, the first shape there starting right after them and their end offset (shape 0
  // may be missing: its offset is 0, so the first that is not is the one that tells)
  let first = 0;
  for (let i = 0; i < count && 6 + 4 * i <= n && !first; i++) first = u32(2 + 4 * i);
  const wide = first === 4 + 4 * count;
  const table = 2 + (wide ? 4 : 2) * count;   // 1.07 has one more offset (the end); 1.0 may not
  if (table > n) throw new PictureError(`${label}: the offsets of ${count} shapes run past the end of the file (${n} bytes)`);
  const shapes = [];
  for (let i = 0; i < count; i++) {
    const at = wide ? 2 + 4 * i : 2 + 2 * i;
    const offset = wide ? u32(at) : u16(at);
    if (offset === 0) { shapes.push(null); continue; }
    const start = wide ? offset + 2 : offset, what = `shape ${i}`;
    if (start < table || start + SHAPE_HEADER > n) throw new PictureError(`${label}: ${what}'s offset (byte ${at}) points outside the file`);
    const flags = u16(start), height = b[start + 2], width = u16(start + 3), size = u16(start + 6), unpacked = u16(start + 8);
    if (!width || !height) throw new PictureError(`${label}: ${what} is ${width} x ${height} pixels (byte ${start + 2})`);
    if (width > 2048) throw new PictureError(`${label}: ${what} is ${width} pixels wide (byte ${start + 3}) — not a shape`);
    const hasTable = (flags & 1) !== 0, packed = (flags & 2) === 0;
    let p = start + SHAPE_HEADER, colours = null;
    if (hasTable) {
      if (p + TABLE > n) throw new PictureError(`${label}: ${what}'s colour table at byte ${p} runs past the end of the file`);
      colours = b.slice(p, p + TABLE);
      p += TABLE;
    }
    const end = Math.min(n, size >= p - start ? start + size : n);
    let stream, length;
    const from = p;
    if (packed) {
      const r = unpackFormat80(b, { from, to: end, size: unpacked, label, what });
      stream = r.bytes; length = r.length;
    } else {
      stream = b.subarray(from, end); length = stream.length;
    }
    const where = (k) => (packed ? `(byte ${k} of what unpacks from byte ${from})` : `at byte ${from + k}`);
    const { indices, alpha } = unrun(stream, length, width, height, colours, label, what, where);
    shapes.push({ width, height, indices, alpha, table: colours });
  }
  return { version: wide ? '1.07' : '1.0', shapes };
}
