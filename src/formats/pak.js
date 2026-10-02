// Westwood .PAK archives, as Dune II (1992) ships its data (spec §6 Original files; research
// audio-ui-controls.md §A.3 "Westwood PAK archive"): no magic number, an index of little-endian uint32
// offsets each followed by a NUL-terminated 8.3 name, ended by a zero offset (the "version 2" layout);
// a file runs from its offset to the next one's, the last to the end of the archive. Flat and
// uncompressed. Read from the player's own copy in the browser; a damaged archive throws a PakError
// that says what is wrong and where, rather than handing back garbage.

export class PakError extends Error {
  constructor(message) { super(message); this.name = 'PakError'; }
}

const MAX_FILES = 65536;   // the format's own limit (moddingwiki)
const MAX_NAME = 64;       // Dune II's names are 8.3; anything this long is not an index

const bytesOf = (data) => (data instanceof Uint8Array ? data : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data));

/**
 * The archive's index: { entries: [{ name, offset, size }], file(name) → Uint8Array | null } — `file`
 * looks a name up without regard to case and returns a view into `data`, not a copy.
 */
export function readPak(data, label = 'archive') {
  if (!(data instanceof ArrayBuffer || ArrayBuffer.isView(data))) throw new PakError(`${label}: not binary data`);
  const b = bytesOf(data), n = b.length;
  const u32 = (p) => (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;
  if (n < 4) throw new PakError(`${label}: too short to be a PAK archive (${n} bytes)`);
  const entries = [];
  let pos = 0, dataStart = n;   // the index may not run into the first file's data
  for (;;) {
    if (pos + 4 > Math.min(n, dataStart)) throw new PakError(`${label}: the index runs into the data at byte ${pos} without its closing zero`);
    const offset = u32(pos);
    pos += 4;
    if (offset === 0) break;
    if (entries.length >= MAX_FILES) throw new PakError(`${label}: more than ${MAX_FILES} entries — not a PAK archive`);
    if (offset > n) throw new PakError(`${label}: entry ${entries.length + 1} points past the end (offset ${offset}, size ${n})`);
    const prev = entries[entries.length - 1];
    if (prev && offset < prev.offset) throw new PakError(`${label}: entry ${entries.length + 1} starts before the one ahead of it`);
    dataStart = Math.min(dataStart, offset);
    let end = pos;
    while (end < n && b[end] !== 0 && end - pos <= MAX_NAME) end++;
    if (end >= n || b[end] !== 0) throw new PakError(`${label}: the name of entry ${entries.length + 1} (byte ${pos}) is not terminated`);
    if (end === pos) throw new PakError(`${label}: entry ${entries.length + 1} has an empty name`);
    let name = '';
    for (let i = pos; i < end; i++) {
      if (b[i] < 0x20 || b[i] > 0x7e) throw new PakError(`${label}: the name of entry ${entries.length + 1} holds a non-printable byte — not a PAK archive`);
      name += String.fromCharCode(b[i]);
    }
    entries.push({ name, offset, size: 0 });
    pos = end + 1;
  }
  if (!entries.length) throw new PakError(`${label}: the archive is empty`);
  if (pos > dataStart) throw new PakError(`${label}: the index (${pos} bytes) overlaps the first file at byte ${dataStart}`);
  for (let i = 0; i < entries.length; i++) entries[i].size = (i + 1 < entries.length ? entries[i + 1].offset : n) - entries[i].offset;
  const byName = new Map(entries.map((e) => [e.name.toUpperCase(), e]));
  return {
    entries,
    file(name) {
      const e = byName.get(String(name).toUpperCase());
      return e ? b.subarray(e.offset, e.offset + e.size) : null;
    },
  };
}
