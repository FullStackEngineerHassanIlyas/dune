// VGM register logs (spec §6 Original files; research music.md §2.2, research.md §9): the format the Sega
// Mega Drive soundtrack is ripped in. A VGM is a 44,100 Hz log of chip writes and waits after a header of
// clocks, loop point and tags; a .vgz is the same file gzipped, and rip packs come as zips of either.
// Read from the player's own files in the browser, never shipped. Everything here is pure: the inflating
// helpers use DecompressionStream (browsers, Node 18+) and run on the main thread at import; parseVgm,
// readHeader and scanVgm also load in the AudioWorkletGlobalScope (no TextDecoder, no DOM). Spec: VGM 1.71
// (vgmrips), GD3 1.00; a damaged file throws a VgmError that says what is wrong.

export class VgmError extends Error {
  constructor(message) { super(message); this.name = 'VgmError'; }
}

export const VGM_RATE = 44100;         // the log's own time base
export const MAX_VGM_BYTES = 32 << 20; // a soundtrack file is at most a few MB; anything this big is not one
const MAX_ZIP_ENTRIES = 4096;
const MAX_ZIP_TOTAL = 256 << 20;

const bytesOf = (data) => (data instanceof Uint8Array ? data : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data));
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** A gzip stream (a .vgz)? */
export function isGzip(data) {
  const b = bytesOf(data);
  return b.length >= 3 && b[0] === 0x1f && b[1] === 0x8b && b[2] === 0x08;
}

/** Starts with the 'Vgm ' identifier? */
export function isVgm(data) {
  const b = bytesOf(data);
  return b.length >= 4 && b[0] === 0x56 && b[1] === 0x67 && b[2] === 0x6d && b[3] === 0x20;
}

/** Inflates with DecompressionStream, refusing anything that grows past `cap` bytes (a zip bomb stops early). */
async function inflate(bytes, format, cap, what) {
  if (typeof DecompressionStream !== 'function') throw new VgmError(`this browser cannot unpack ${what} files (no DecompressionStream)`);
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  const reader = ds.readable.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > cap) { reader.cancel().catch(() => {}); throw new VgmError(`${what} unpacks to more than ${cap >> 20} MB`); }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof VgmError) throw err;
    throw new VgmError(`${what} is damaged (${err.message || err})`);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

/** Plain VGM bytes from a .vgm or a .vgz: a gzip is inflated (at most 32 MB) and must hold a VGM. */
export async function inflateVgm(data) {
  const b = bytesOf(data);
  if (isVgm(b)) return b;
  if (!isGzip(b)) throw new VgmError('not a VGM or VGZ file');
  const out = await inflate(b, 'gzip', MAX_VGM_BYTES, 'the VGZ file');
  if (!isVgm(out)) throw new VgmError('the VGZ file does not hold a VGM');
  return out;
}

// ---- header ---------------------------------------------------------------------------------------------

// Other chips' clock fields (offset, name, first version): any of them set means sound this player leaves out.
const OTHER_CHIPS = [
  [0x10, 'YM2413', 0x110], [0x30, 'YM2151', 0x110], [0x38, 'SegaPCM', 0x151], [0x40, 'RF5C68', 0x151],
  [0x44, 'YM2203', 0x151], [0x48, 'YM2608', 0x151], [0x4c, 'YM2610', 0x151], [0x50, 'YM3812', 0x151],
  [0x54, 'YM3526', 0x151], [0x58, 'Y8950', 0x151], [0x5c, 'YMF262', 0x151], [0x60, 'YMF278B', 0x151],
  [0x64, 'YMF271', 0x151], [0x68, 'YMZ280B', 0x151], [0x6c, 'RF5C164', 0x151], [0x70, 'PWM', 0x151],
  [0x74, 'AY8910', 0x151], [0x80, 'GameBoy DMG', 0x161], [0x84, 'NES APU', 0x161], [0x88, 'MultiPCM', 0x161],
  [0x8c, 'uPD7759', 0x161], [0x90, 'OKIM6258', 0x161], [0x98, 'OKIM6295', 0x161], [0x9c, 'K051649', 0x161],
  [0xa0, 'K054539', 0x161], [0xa4, 'HuC6280', 0x161], [0xa8, 'C140', 0x161], [0xac, 'K053260', 0x161],
  [0xb0, 'Pokey', 0x161], [0xb4, 'QSound', 0x161], [0xb8, 'SCSP', 0x171], [0xc0, 'WonderSwan', 0x171],
  [0xc4, 'VSU', 0x171], [0xc8, 'SAA1099', 0x171], [0xcc, 'ES5503', 0x171], [0xd0, 'ES5506', 0x171],
  [0xd8, 'X1-010', 0x171], [0xdc, 'C352', 0x171], [0xe0, 'GA20', 0x171],
];

/**
 * The header alone (cheap; the deck uses it): offsets made absolute, fields a version does not have read as
 * zero, header bytes at or past the data offset read as zero (spec). Throws a VgmError for a file that is not
 * a VGM at all; oddities that still play are listed in `warnings`.
 */
export function readHeader(data) {
  const b = bytesOf(data);
  if (b.length < 0x40 || !isVgm(b)) throw new VgmError(b.length >= 3 && isGzip(b) ? 'a VGZ must be unpacked first (inflateVgm)' : 'not a VGM file');
  const warnings = [];
  const version = u32(b, 0x08);
  const eofField = u32(b, 0x04);
  let end = b.length;
  if (eofField + 4 <= b.length) end = eofField + 4;
  else warnings.push(`the header says ${eofField + 4} bytes, the file has ${b.length}`);
  let dataOffset = 0x40;
  if (version >= 0x150) {
    const rel = u32(b, 0x34);
    if (rel) dataOffset = 0x34 + rel;
  }
  if (dataOffset < 0x40 || dataOffset > end) throw new VgmError(`the music data offset ${dataOffset} lies outside the file`);
  const field = (o, size = 4, from = 0) => (version >= from && o + size <= dataOffset ? (size === 4 ? u32(b, o) : size === 2 ? u16(b, o) : b[o]) : 0);

  const snRaw = field(0x0c);
  const ymRaw = version < 0x110 ? field(0x10) : field(0x2c);
  const unsupported = [];
  if (snRaw & 0x40000000) unsupported.push(snRaw & 0x80000000 ? 'T6W28 PSG' : 'second SN76489');
  if (version >= 0x151 && ymRaw & 0x40000000) unsupported.push('second YM2612');
  const ym3438 = version >= 0x151 && !!(ymRaw & 0x80000000);
  const ym2612 = ymRaw & 0x3fffffff;
  const sn76489 = snRaw & 0x3fffffff;
  for (const [o, name, from] of OTHER_CHIPS) if (field(o, 4, from) & 0x3fffffff) unsupported.push(name);

  let feedback = 0x0009, width = 16, snFlags = 0;
  if (version >= 0x110) {
    feedback = field(0x28, 2) || 0x0009;
    width = field(0x2a, 1) || 16;
    snFlags = field(0x2b, 1, 0x151);
  }
  // volume: 2^(v/32) for signed v, -63 read as -64 (spec 0x7C; players apply it from 1.50 on)
  let vm = field(0x7c, 1, 0x150);
  if (vm > 0xc0) vm -= 0x100;
  if (vm === -63) vm = -64;
  let loopBase = field(0x7e, 1, 0x150);
  if (loopBase > 127) loopBase -= 256;
  const loopModifier = field(0x7f, 1, 0x151);

  const totalSamples = u32(b, 0x18);
  let loopOffset = u32(b, 0x1c) ? 0x1c + u32(b, 0x1c) : 0;
  let loopSamples = loopOffset ? u32(b, 0x20) : 0;
  if (loopOffset && (loopOffset < dataOffset || loopOffset >= end)) {
    warnings.push(`the loop point ${loopOffset} lies outside the music data; played without a loop`);
    loopOffset = 0; loopSamples = 0;
  }
  return {
    version, eof: end, dataOffset,
    clocks: { ym2612, sn76489 },
    ym3438,
    sn: { feedback, width, flags: snFlags },
    rate: field(0x24, 4, 0x101),
    totalSamples, loopOffset, loopSamples,
    seconds: totalSamples / VGM_RATE,
    loopSeconds: loopSamples / VGM_RATE,
    volumeModifier: vm,
    gain: Math.pow(2, vm / 32),
    loopBase, loopModifier,
    gd3Offset: u32(b, 0x14) ? 0x14 + u32(b, 0x14) : 0,
    unsupported, warnings,
  };
}

// ---- GD3 tags -------------------------------------------------------------------------------------------

const GD3_FIELDS = ['track', 'trackJp', 'game', 'gameJp', 'system', 'systemJp', 'author', 'authorJp', 'date', 'ripper', 'notes'];
const MAX_TAG = 4096;   // code units per string: tags are short

/** The GD3 tag at `offset` ('Gd3 ', version, length, eleven NUL-ended UTF-16LE strings), by hand. */
export function readGd3(data, offset) {
  const b = bytesOf(data);
  const tags = Object.fromEntries(GD3_FIELDS.map((k) => [k, '']));
  if (!offset || offset + 12 > b.length || u32(b, offset) !== 0x20336447) return tags;   // 'Gd3 '
  const len = u32(b, offset + 8);
  const end = Math.min(b.length, offset + 12 + len);
  let at = offset + 12;
  for (const key of GD3_FIELDS) {
    const units = [];
    while (at + 1 < end) {
      const c = u16(b, at);
      at += 2;
      if (c === 0) break;
      if (units.length < MAX_TAG) units.push(c);
    }
    let s = '';
    for (let i = 0; i < units.length; i += 1024) s += String.fromCharCode.apply(null, units.slice(i, i + 1024));
    tags[key] = s;
    if (at + 1 >= end) break;
  }
  return tags;
}

// ---- the command stream ---------------------------------------------------------------------------------

// Bytes each command takes, operands included (0 = special: data blocks, PCM RAM writes; -1 = undefined).
// 0x00-0x2F are skipped as one byte (no file should hold them; VGMPlay does the same); 0x60-0x6F undefined
// codes end the stream (spec).
export const COMMAND_LENGTH = (() => {
  const t = new Int8Array(256);
  for (let c = 0; c < 256; c++) {
    if (c <= 0x2f) t[c] = 1;
    else if (c <= 0x3f) t[c] = 2;                 // 0x30 2nd PSG, 0x31 AY stereo, 0x32-0x3E reserved, 0x3F 2nd GG stereo
    else if (c <= 0x4e) t[c] = 3;                 // reserved: two operands from 1.60 (one before; see commandLength)
    else if (c === 0x4f || c === 0x50) t[c] = 2;
    else if (c <= 0x5f) t[c] = 3;
    else if (c === 0x61) t[c] = 3;
    else if (c === 0x62 || c === 0x63 || c === 0x66) t[c] = 1;
    else if (c === 0x67 || c === 0x68) t[c] = 0;
    else if (c <= 0x6f) t[c] = -1;
    else if (c <= 0x8f) t[c] = 1;
    else if (c === 0x90 || c === 0x91 || c === 0x95) t[c] = 5;
    else if (c === 0x92) t[c] = 6;
    else if (c === 0x93) t[c] = 11;
    else if (c === 0x94) t[c] = 2;
    else if (c <= 0x9f) t[c] = -1;
    else if (c <= 0xbf) t[c] = 3;
    else if (c <= 0xdf) t[c] = 4;
    else t[c] = 5;
  }
  return t;
})();

/** Length of the command at `at`, or -1 when it is undefined or runs past `end`. */
export function commandLength(b, at, end, version) {
  const c = b[at];
  let n = COMMAND_LENGTH[c];
  if (c >= 0x40 && c <= 0x4e && version < 0x160) n = 2;
  if (n === 0) {
    if (c === 0x67) n = at + 7 <= end ? 7 + (u32(b, at + 3) & 0x7fffffff) : -1;
    else n = 12;   // 0x68 0x66 cc oo oo oo dd dd dd ss ss ss
  }
  return n > 0 && at + n <= end ? n : -1;
}

const COMMAND_CHIP = (c) => (c === 0x51 ? 'YM2413' : c === 0x54 ? 'YM2151' : c >= 0x55 && c <= 0x5f ? 'other FM chips'
  : c === 0x30 || c === 0x3f ? 'second SN76489' : c >= 0xa0 && c <= 0xaf ? 'second chips' : c >= 0xb0 && c <= 0xdf || c === 0x68 || c === 0xe1 ? 'other PCM chips' : '');

/**
 * Walks the commands once: an opcode histogram, the data blocks (by bank type, with their place in the
 * bank), DAC stream use, the waits counted, and what this player leaves out. `header` from readHeader.
 */
export function scanVgm(data, header = readHeader(data)) {
  const b = bytesOf(data);
  const end = header.eof, version = header.version;
  const histogram = new Uint32Array(256);
  const blocks = [];                 // { at (file offset of the data), type, size, bankOffset }
  const bankSize = new Map();        // type -> bytes so far
  const unknown = new Set(), chips = new Set();
  let compressed = 0, samples = 0, loopAt = -1, loopSamples = 0, stop = 'end', ymWrites = 0, psgWrites = 0, dacWrites = 0, streams = 0;
  let at = header.dataOffset;
  for (;;) {
    if (at === header.loopOffset) { loopAt = samples; }
    if (at >= end) { stop = 'truncated'; break; }
    const c = b[at];
    const n = commandLength(b, at, end, version);
    if (n < 0) { stop = COMMAND_LENGTH[c] < 0 ? 'undefined' : 'truncated'; if (COMMAND_LENGTH[c] < 0) unknown.add(c); break; }
    histogram[c]++;
    if (c === 0x66) break;
    if (c === 0x61) samples += u16(b, at + 1);
    else if (c === 0x62) samples += 735;
    else if (c === 0x63) samples += 882;
    else if (c >= 0x70 && c <= 0x7f) samples += (c & 15) + 1;
    else if (c >= 0x80 && c <= 0x8f) { samples += c & 15; dacWrites++; }
    else if (c === 0x52 || c === 0x53) ymWrites++;
    else if (c === 0x50) psgWrites++;
    else if (c === 0x67) {
      const type = b[at + 2], size = u32(b, at + 3) & 0x7fffffff;
      if (type < 0x40) {
        const off = bankSize.get(type) || 0;
        blocks.push({ at: at + 7, type, size, bankOffset: off });
        bankSize.set(type, off + size);
      } else if (type < 0x7f) { compressed++; blocks.push({ at: at + 7, type, size, bankOffset: -1 }); }
    } else if (c >= 0x90 && c <= 0x95) streams++;
    else if (c <= 0x2f && c !== 0) unknown.add(c);
    else if (c >= 0x32 && c <= 0x3e || c >= 0x40 && c <= 0x4e || c >= 0xc9 && c <= 0xcf || c >= 0xd7 && c <= 0xdf || c >= 0xe2) unknown.add(c);
    const chip = COMMAND_CHIP(c);
    if (chip) chips.add(chip);
    at += n;
  }
  if (loopAt >= 0) loopSamples = samples - loopAt;
  const unsupported = [];
  if (compressed) unsupported.push(`${compressed} compressed PCM block${compressed > 1 ? 's' : ''}`);
  for (const chip of chips) unsupported.push(`${chip} (commands skipped)`);
  if (unknown.size) unsupported.push(`unknown commands ${[...unknown].map((c) => '0x' + c.toString(16).padStart(2, '0')).join(', ')}`);
  if (stop === 'truncated') unsupported.push('the music data is cut short');
  return { histogram, blocks, bankSize, samples, loopSamples, stop, ymWrites, psgWrites, dacWrites, streams, unsupported, endAt: at };
}

/**
 * Everything about a plain VGM (contract C8): { version, clocks: { ym2612, sn76489 }, totalSamples, loopOffset,
 * loopSamples, gain, gd3: { track, game, system, author, date, notes, ... }, unsupported: [], ... }.
 * `unsupported` lists other or second chips, compressed PCM, unknown commands and a cut-short file.
 */
export function parseVgm(data) {
  const b = bytesOf(data);
  const header = readHeader(b);
  const scan = scanVgm(b, header);
  const warnings = [...header.warnings];
  if (scan.samples !== header.totalSamples) warnings.push(`the header says ${header.totalSamples} samples, the commands add up to ${scan.samples}`);
  if (header.loopOffset && scan.loopSamples !== header.loopSamples) warnings.push(`the header loop is ${header.loopSamples} samples, the commands give ${scan.loopSamples}`);
  const unsupported = [...header.unsupported, ...scan.unsupported];
  if (!header.clocks.ym2612 && !header.clocks.sn76489) unsupported.push('no YM2612 or SN76489: nothing this player can sound');
  const { gd3Offset, ...rest } = header;
  return {
    ...rest,
    gd3: readGd3(b, gd3Offset),
    dacStreams: scan.streams > 0,
    dataBlocks: scan.blocks.length,
    pcmBytes: scan.bankSize.get(0) || 0,
    unsupported,
    warnings,
  };
}

// ---- zip packs ------------------------------------------------------------------------------------------

/**
 * The .vgm/.vgz files in a zip (rip packs): read from the central directory, stored or deflated entries.
 * Returns [{ name, bytes }] with each file's bytes as stored in it (a .vgz stays gzipped: inflateVgm takes both).
 */
export async function readVgmZip(data) {
  const b = bytesOf(data);
  // end of central directory: the last 'PK\5\6' within the final 64 KB + 22 bytes
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) throw new VgmError('not a zip file');
  const count = u16(b, eocd + 10), cdSize = u32(b, eocd + 12), cdOffset = u32(b, eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) throw new VgmError('ZIP64 archives are not supported');
  if (count > MAX_ZIP_ENTRIES) throw new VgmError(`the zip lists ${count} files`);
  if (cdOffset + cdSize > eocd) throw new VgmError('the zip directory lies outside the file');
  const out = [];
  let at = cdOffset, total = 0;
  for (let k = 0; k < count; k++) {
    if (at + 46 > eocd || u32(b, at) !== 0x02014b50) throw new VgmError('the zip directory is damaged');
    const flags = u16(b, at + 8), method = u16(b, at + 10);
    const csize = u32(b, at + 20), usize = u32(b, at + 24);
    const nameLen = u16(b, at + 28), extraLen = u16(b, at + 30), commentLen = u16(b, at + 32);
    const local = u32(b, at + 42);
    let name = '';
    for (let i = 0; i < nameLen; i++) name += String.fromCharCode(b[at + 46 + i]);
    at += 46 + nameLen + extraLen + commentLen;
    const base = name.split('/').pop();
    if (!/\.vg[mz]$/i.test(base) || name.startsWith('__MACOSX/') || base.startsWith('._')) continue;
    if (flags & 1) throw new VgmError(`${base} is encrypted`);
    if (local + 30 > b.length || u32(b, local) !== 0x04034b50) throw new VgmError(`${base}: the zip entry is damaged`);
    const start = local + 30 + u16(b, local + 26) + u16(b, local + 28);
    if (start + csize > b.length) throw new VgmError(`${base}: the zip entry runs past the end`);
    if (usize > MAX_VGM_BYTES) throw new VgmError(`${base} is larger than ${MAX_VGM_BYTES >> 20} MB`);
    total += usize;
    if (total > MAX_ZIP_TOTAL) throw new VgmError(`the zip unpacks to more than ${MAX_ZIP_TOTAL >> 20} MB`);
    const raw = b.subarray(start, start + csize);
    let bytes;
    if (method === 0) bytes = raw.slice();
    else if (method === 8) bytes = await inflate(raw, 'deflate-raw', MAX_VGM_BYTES, base);
    else throw new VgmError(`${base}: zip compression method ${method} is not supported`);
    out.push({ name: base, bytes });
  }
  return out;
}
