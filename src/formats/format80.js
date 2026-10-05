// Westwood's "Format80" packing (also called LCW), as Dune II packs its pictures: CPS screens, the shapes in SHP
// files and the frames of WSA animations. The packed bytes are a list of commands, each one byte (with up to four
// after it), that build the output from the front:
//   0x80              the end
//   0b10nnnnnn        n bytes (1..63) follow in the input, copied as they are
//   0b0nnndddd dddddddd   n+3 bytes (3..10) repeated from d bytes back in the output (d 1..4095)
//   0b11nnnnnn pppp   n+3 bytes (3..64) repeated from position p of the output (a 16-bit little-endian word)
//   0xFE nnnn v       n bytes of the value v
//   0xFF nnnn pppp    n bytes repeated from position p of the output
// A repeat may overlap what it writes (a run of a short pattern), so it goes a byte at a time. Written from the
// published description of the format (ModdingWiki, "Westwood LCW"); as the original's own reader, a command that
// would write past the size given stops at it, and unpacking stops once the output is full.
import { PictureError, bytesOf } from './picture-error.js';

/**
 * Unpacks `data` from byte `from` (up to `to`) into `size` bytes. Returns { bytes, length, end }: `length` the
 * bytes written (less than `size` when the end mark comes first), `end` the input byte after the last command read.
 * A command cut short by the end of the input, a repeat from before the start or from output not yet written, and
 * input that runs out without its end mark throw a PictureError naming `label` and the byte of the input (counted
 * in `data`, so in the file when `data` is the whole file).
 */
export function unpackFormat80(data, { from = 0, to, size, label = 'data', what = 'packed data' } = {}) {
  const b = bytesOf(data, label);
  const stop = Math.min(to ?? b.length, b.length);
  if (!Number.isInteger(size) || size < 0) throw new PictureError(`${label}: ${what} has no size to unpack to`);
  const out = new Uint8Array(size);
  let p = from, w = 0;
  const need = (k, at) => { if (p + k > stop) throw new PictureError(`${label}: ${what} is cut short in the command at byte ${at}`); };
  const word = () => { const v = b[p] | (b[p + 1] << 8); p += 2; return v; };
  const repeat = (src, count, at) => {
    if (src < 0) throw new PictureError(`${label}: ${what} repeats from before its start, in the command at byte ${at}`);
    if (src >= w) throw new PictureError(`${label}: ${what} repeats output byte ${src} before it is written, in the command at byte ${at}`);
    const n = Math.min(count, size - w);
    for (let i = 0; i < n; i++) out[w++] = out[src + i];
  };
  while (w < size) {
    if (p >= stop) throw new PictureError(`${label}: ${what} ends at byte ${p} without its end mark (${w} of ${size} bytes unpacked)`);
    const at = p, c = b[p++];
    if (c === 0x80) break;
    if ((c & 0x80) === 0) {                 // a short repeat from a little way back
      need(1, at);
      const back = ((c & 0x0f) << 8) | b[p++];
      repeat(w - back, (c >> 4) + 3, at);
    } else if ((c & 0x40) === 0) {          // literal bytes
      const n = c & 0x3f;
      need(n, at);
      const k = Math.min(n, size - w);
      out.set(b.subarray(p, p + k), w);
      w += k; p += n;
    } else if (c === 0xfe) {                // a fill
      need(3, at);
      const n = word(), v = b[p++], k = Math.min(n, size - w);
      out.fill(v, w, w + k);
      w += k;
    } else if (c === 0xff) {                // a long repeat from a position
      need(4, at);
      const n = word();
      repeat(word(), n, at);
    } else {                                // a short repeat from a position
      need(2, at);
      repeat(word(), (c & 0x3f) + 3, at);
    }
  }
  return { bytes: out, length: w, end: p };
}
