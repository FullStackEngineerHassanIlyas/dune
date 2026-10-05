// Westwood WSA animations, as Dune II keeps its moving pictures (the house emblems FARTR/FHARK/FORDOS.WSA, the
// Mentat's screens, the intro). Written from the published description of the format (ModdingWiki, "WSA Format"):
//   frames, width, height (16-bit each), the size of the buffer a frame unpacks in (16-bit), then — in the 1.07
//   releases — 16-bit flags (1: a palette follows the offsets); then frames + 2 offsets (32-bit), counted as if
//   the palette were not there. Frame i is the bytes from offset i to offset i + 1: Format80-packed Format40, the
//   change from the frame before (the first from an empty, all-zero frame). The last offset is 0, or — when the
//   animation loops — gives one more change, from the last frame back to the first. The 1.0 releases have no
//   flags word (their first frame starts at 8 + 4 x (frames + 2)); a first offset of 0 marks an animation that
//   carries on from another one, which this reader does not take.
import { PictureError, bytesOf } from './picture-error.js';
import { readPalette, PALETTE_BYTES } from './pal.js';
import { unpackFormat80 } from './format80.js';
import { xorFormat40 } from './format40.js';

const MAX_FRAMES = 1024;

/**
 * Reads an animation: { version, width, height, palette (8-bit RGB or null), loops, frames: [Uint8Array of
 * colour indices, row by row] } — every frame whole. A damaged file throws a PictureError naming `label`, the frame
 * and the byte.
 */
export function readWsa(data, label = 'animation.wsa') {
  const b = bytesOf(data, label), n = b.length;
  const u16 = (p) => b[p] | (b[p + 1] << 8);
  const u32 = (p) => (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;
  if (n < 16) throw new PictureError(`${label}: too short to be a WSA animation (${n} bytes)`);
  const count = u16(0) & 0x7fff, width = u16(2), height = u16(4), buffer = u16(6);
  if (!count || count > MAX_FRAMES) throw new PictureError(`${label}: ${count} frames (byte 0) — not an animation`);
  if (!width || !height || width > 640 || height > 480) throw new PictureError(`${label}: a frame of ${width} x ${height} pixels (byte 2) — not an animation`);
  const first = (head) => head + 4 * (count + 2);
  const newer = n >= 18 && (u32(10) === first(10) || u32(14) === first(10));
  const head = newer ? 10 : 8;
  const hasPalette = newer && (u16(8) & 1) === 1;
  if (first(head) > n) throw new PictureError(`${label}: the offsets of ${count} frames run past the end of the file (${n} bytes)`);
  const shift = hasPalette ? PALETTE_BYTES : 0;
  const palette = hasPalette ? readPalette(b, { from: first(head), label }) : null;
  const offsets = Array.from({ length: count + 2 }, (_, i) => u32(head + 4 * i));
  if (offsets[0] === 0) throw new PictureError(`${label}: it carries on from another animation (no first frame)`);
  const loops = offsets[count + 1] !== 0;
  const size = width * height, frame = new Uint8Array(size), frames = [];
  // a frame unpacks to at most this (the header's buffer, else what any change of this frame could need)
  const room = Math.max(buffer, size * 2 + 64);
  const change = (i) => {
    const from = offsets[i] + shift, to = offsets[i + 1] + shift, what = `frame ${i}`;
    if (offsets[i + 1] < offsets[i] || to > n) throw new PictureError(`${label}: ${what} (offset at byte ${head + 4 * i}) lies outside the file`);
    const delta = unpackFormat80(b, { from, to, size: room, label, what });
    xorFormat40(frame, delta.bytes, { to: delta.length, label, what: `${what} (unpacked from byte ${from})` });
  };
  for (let i = 0; i < count; i++) {
    change(i);
    frames.push(frame.slice());
  }
  return { version: newer ? '1.07' : '1.0', width, height, palette, loops, frames };
}
