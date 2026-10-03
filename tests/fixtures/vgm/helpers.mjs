// Helpers for the VGM tests: CRC32, a builder for made-up VGM files (header, commands, data blocks, GD3), and
// a tiny zip writer. Every file the tests play is made here, from nothing: no game data.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes, crc = 0) {
  let c = ~crc >>> 0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

/** CRC32 (hex) of each `chunk`-sample piece of interleaved Int16 stereo. */
export function chunkCrcs(pcm, chunk = 8192) {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const out = [];
  for (let i = 0; i < bytes.length; i += chunk * 4) out.push(crc32(bytes.subarray(i, i + chunk * 4)).toString(16).padStart(8, '0'));
  return out;
}

const le = (n, bytes = 4) => Array.from({ length: bytes }, (_, i) => (n >>> (8 * i)) & 0xff);
const utf16 = (s) => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i)).flatMap((c) => [c & 0xff, c >> 8]).concat([0, 0]);

/** A GD3 tag: 'Gd3 ', version 1.00, length, eleven strings. */
export function gd3Bytes(tags = {}) {
  const fields = ['track', 'trackJp', 'game', 'gameJp', 'system', 'systemJp', 'author', 'authorJp', 'date', 'ripper', 'notes'];
  const body = fields.flatMap((k) => utf16(tags[k] ?? ''));
  return [0x47, 0x64, 0x33, 0x20, ...le(0x100), ...le(body.length), ...body];
}

/**
 * A VGM file from a command list. commands: arrays of bytes (or the helpers below); `loop` is the index of the
 * command where the loop begins. Header fields can be overridden; samples and loop samples are counted.
 */
export function vgmFile({ version = 0x150, ym = 7670453, sn = 3579545, commands = [], loop = -1, gd3 = null, header = {}, headerSize = 0x40, end = true } = {}) {
  const body = [];
  let loopAt = -1, samples = 0, loopSamples = 0;
  commands.forEach((c, i) => {
    if (i === loop) loopAt = body.length;
    body.push(...c);
    const w = waitOf(c);
    samples += w;
    if (loopAt >= 0) loopSamples += w;
  });
  if (end) body.push(0x66);
  const h = new Array(headerSize).fill(0);
  const put = (o, v, n = 4) => le(v, n).forEach((b, i) => { h[o + i] = b; });
  h[0] = 0x56; h[1] = 0x67; h[2] = 0x6d; h[3] = 0x20;
  put(0x08, version);
  put(0x0c, sn);
  if (version < 0x110) put(0x10, ym); else put(0x2c, ym);
  if (version >= 0x110) { put(0x28, 0x0009, 2); h[0x2a] = 16; }
  put(0x18, samples);
  if (loopAt >= 0) { put(0x1c, headerSize + loopAt - 0x1c); put(0x20, loopSamples); }
  if (version >= 0x150) put(0x34, headerSize - 0x34);
  for (const [o, v] of Object.entries(header)) put(Number(o), v.bytes ? v.value : v, v.bytes ?? 4);
  const tag = gd3 ? gd3Bytes(gd3) : [];
  if (gd3) put(0x14, headerSize + body.length - 0x14);
  const all = [...h, ...body, ...tag];
  put(0x04, all.length - 4);
  le(all.length - 4).forEach((b, i) => { all[4 + i] = b; });
  return new Uint8Array(all);
}

function waitOf(c) {
  const op = c[0];
  if (op === 0x61) return c[1] | (c[2] << 8);
  if (op === 0x62) return 735;
  if (op === 0x63) return 882;
  if (op >= 0x70 && op <= 0x7f) return (op & 15) + 1;
  if (op >= 0x80 && op <= 0x8f) return op & 15;
  return 0;
}

// command helpers
export const ym = (part, reg, data) => [part ? 0x53 : 0x52, reg, data];
export const psg = (data) => [0x50, data];
export const wait = (n) => [0x61, n & 0xff, (n >> 8) & 0xff];
export const block = (type, bytes) => [0x67, 0x66, type, ...le(bytes.length), ...bytes];
export const seek = (offset) => [0xe0, ...le(offset)];
export const dacWait = (n) => [0x80 | n];

/** A stored (uncompressed) or deflated zip of files: [{ name, bytes, deflated? (Uint8Array raw deflate) }]. */
export function zipFile(files) {
  const locals = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = [...f.name].map((c) => c.charCodeAt(0));
    const data = f.deflated ?? f.bytes;
    const method = f.deflated ? 8 : 0;
    const crc = crc32(f.bytes);
    const local = [0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, ...le(method, 2), 0, 0, 0, 0, ...le(crc), ...le(data.length), ...le(f.bytes.length), ...le(name.length, 2), 0, 0, ...name];
    central.push([0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, ...le(method, 2), 0, 0, 0, 0, ...le(crc), ...le(data.length), ...le(f.bytes.length), ...le(name.length, 2), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...le(offset), ...name]);
    locals.push(...local, ...data);
    offset += local.length + data.length;
  }
  const cd = central.flat();
  const eocd = [0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, ...le(files.length, 2), ...le(files.length, 2), ...le(cd.length), ...le(offset), 0, 0];
  return new Uint8Array([...locals, ...cd, ...eocd]);
}
