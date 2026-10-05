// Westwood's "Format40": the change from one frame of an animation to the next, as Dune II's WSA files keep it
// (each frame's Format40 is itself packed with Format80). It walks the frame from its first byte, skipping what
// stays and XOR-ing what changes:
//   0x00 n v          n bytes XOR the value v
//   0b0nnnnnnn        n bytes (1..127) XOR the n bytes that follow
//   0b1nnnnnnn        skip n bytes (1..127)
//   0x80 wwww         a 16-bit little-endian word w: 0 is the end; below 0x8000 skip w bytes; 0x8000 + n: n bytes
//                     XOR the n bytes that follow; 0xC000 + n: n bytes XOR the value that follows
// Written from the published description of the format (ModdingWiki, "Westwood XOR Delta").
import { PictureError, bytesOf } from './picture-error.js';

/**
 * XORs the change in `data` (from byte `from`, up to `to`) into `frame` (a Uint8Array, changed in place). Returns
 * the input byte after the end mark. A change that runs past the frame, a command cut short and input without its
 * end mark throw a PictureError naming `label` and the byte of the input.
 */
export function xorFormat40(frame, data, { from = 0, to, label = 'data', what = 'frame change' } = {}) {
  const b = bytesOf(data, label);
  const stop = Math.min(to ?? b.length, b.length), size = frame.length;
  let p = from, w = 0;
  const need = (k, at) => { if (p + k > stop) throw new PictureError(`${label}: ${what} is cut short in the command at byte ${at}`); };
  const room = (n, at) => { if (w + n > size) throw new PictureError(`${label}: ${what} runs past the frame's ${size} bytes in the command at byte ${at}`); };
  const xorBytes = (n, at) => { need(n, at); room(n, at); for (let i = 0; i < n; i++) frame[w++] ^= b[p++]; };
  const xorValue = (n, v, at) => { room(n, at); for (let i = 0; i < n; i++) frame[w++] ^= v; };
  const skip = (n, at) => { room(n, at); w += n; };
  for (;;) {
    if (p >= stop) throw new PictureError(`${label}: ${what} ends at byte ${p} without its end mark`);
    const at = p, c = b[p++];
    if (c === 0) { need(2, at); const n = b[p++]; xorValue(n, b[p++], at); }
    else if (c < 0x80) xorBytes(c, at);
    else if (c > 0x80) skip(c & 0x7f, at);
    else {
      need(2, at);
      const v = b[p] | (b[p + 1] << 8);
      p += 2;
      if (v === 0) return p;
      if (v < 0x8000) skip(v, at);
      else if (v < 0xc000) xorBytes(v & 0x3fff, at);
      else { need(1, at); xorValue(v & 0x3fff, b[p++], at); }
    }
  }
}
