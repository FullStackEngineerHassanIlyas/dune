// VGM files (research music.md §2.2): header versions, loops, the volume modifier, GD3 tags, gzip and zip
// containers, and damaged or hostile input. Every file here is made up inside the test (fixtures/vgm/helpers.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync, deflateRawSync } from 'node:zlib';
import { isGzip, isVgm, inflateVgm, parseVgm, readHeader, scanVgm, readVgmZip, commandLength, VgmError, MAX_VGM_BYTES } from '../src/formats/vgm.js';
import { vgmFile, ym, psg, wait, block, seek, dacWait, zipFile } from './fixtures/vgm/helpers.mjs';

const SONG = [ym(0, 0x22, 0x08), psg(0x9f), wait(1000), ym(1, 0xb4, 0xc0), [0x62], [0x63], [0x75], wait(500)];

test('a v1.50 header: clocks, samples, the loop point as a file offset, the data offset', () => {
  const f = vgmFile({ commands: SONG, loop: 3 });
  const h = parseVgm(f);
  assert.equal(h.version, 0x150);
  assert.deepEqual(h.clocks, { ym2612: 7670453, sn76489: 3579545 });
  assert.equal(h.totalSamples, 1000 + 735 + 882 + 6 + 500);
  assert.equal(h.loopSamples, 735 + 882 + 6 + 500);
  assert.equal(h.loopOffset, 0x40 + 3 + 2 + 3);   // after two writes and a wait
  assert.equal(h.dataOffset, 0x40);
  assert.equal(h.gain, 1);
  assert.equal(h.ym3438, false);
  assert.deepEqual(h.sn, { feedback: 9, width: 16, flags: 0 });
  assert.deepEqual(h.unsupported, []);
  assert.deepEqual(h.warnings, []);
  assert.ok(Math.abs(h.seconds - h.totalSamples / 44100) < 1e-9);
});

test('version 1.01 keeps the YM2612 clock in the YM2413 field and its data at 0x40', () => {
  const f = vgmFile({ version: 0x101, commands: SONG });
  const h = parseVgm(f);
  assert.equal(h.clocks.ym2612, 7670453);
  assert.deepEqual(h.sn, { feedback: 9, width: 16, flags: 0 });   // assumed for old files
  assert.equal(h.dataOffset, 0x40);
  assert.deepEqual(h.unsupported, []);
});

test('the volume modifier: 2^(v/32), -63 read as -64; loop base and modifier are signed and plain', () => {
  const gainOf = (v) => readHeader(vgmFile({ version: 0x160, headerSize: 0x80, commands: SONG, header: { 0x7c: { value: v, bytes: 1 } } })).gain;
  assert.equal(gainOf(0x00), 1);
  assert.equal(gainOf(0x20), 2);
  assert.equal(gainOf(0xe0), 0.5);
  assert.equal(gainOf(0xc1), 0.25);   // -63 -> -64
  assert.equal(gainOf(0xc0), 64);     // 192
  const h = readHeader(vgmFile({ version: 0x160, headerSize: 0x80, commands: SONG, header: { 0x7e: { value: 0xff, bytes: 1 }, 0x7f: { value: 0x20, bytes: 1 } } }));
  assert.equal(h.loopBase, -1);
  assert.equal(h.loopModifier, 0x20);
});

test('header bytes at or past the data offset read as zero', () => {
  // a 1.60 file whose data starts at 0x40: the volume modifier's place (0x7C) is music, not header
  const f = vgmFile({ version: 0x160, commands: [...SONG, ...Array(40).fill([0x50, 0x90])] });
  assert.equal(readHeader(f).gain, 1);
});

test('YM3438, second chips and other chips are reported', () => {
  const ym3438 = readHeader(vgmFile({ version: 0x171, headerSize: 0x100, ym: 0x80000000 | 7670453, commands: SONG }));
  assert.equal(ym3438.ym3438, true);
  assert.equal(ym3438.clocks.ym2612, 7670453);
  const dual = parseVgm(vgmFile({ version: 0x171, headerSize: 0x100, ym: 0x40000000 | 7670453, sn: 0x40000000 | 3579545, commands: SONG, header: { 0x30: 3579545, 0x74: 1789773 } }));
  for (const name of ['second YM2612', 'second SN76489', 'YM2151', 'AY8910']) assert.ok(dual.unsupported.includes(name), name);
  const t6w28 = readHeader(vgmFile({ version: 0x171, headerSize: 0x100, sn: 0xc0000000 | 3072000, commands: SONG }));
  assert.ok(t6w28.unsupported.includes('T6W28 PSG'));
});

test('GD3 tags are read by hand from UTF-16LE, beyond Latin script too', () => {
  const tags = { track: 'Desert Wind', trackJp: 'デューン', game: 'Made-up Game', system: 'Sega Mega Drive', author: 'Nobody Ünique', date: '2026', ripper: 'test', notes: 'line one\nline two 🜂' };
  const h = parseVgm(vgmFile({ commands: SONG, gd3: tags }));
  for (const [k, v] of Object.entries(tags)) assert.equal(h.gd3[k], v, k);
  assert.equal(h.gd3.gameJp, '');
  // no tag, or a tag offset into nowhere: empty strings, not an error
  assert.equal(parseVgm(vgmFile({ commands: SONG })).gd3.track, '');
  assert.equal(parseVgm(vgmFile({ commands: SONG, header: { 0x14: 0x7fff0000 } })).gd3.track, '');
});

test('the command scan: histogram, waits counted, data blocks with their place in the bank, DAC use', () => {
  const pcm1 = new Uint8Array(100).fill(0x80), pcm2 = new Uint8Array(50).fill(0x90);
  const f = vgmFile({ commands: [block(0, pcm1), block(0, pcm2), seek(10), ym(0, 0x2b, 0x80), dacWait(3), dacWait(0), dacWait(15), wait(100)] });
  const h = readHeader(f), s = scanVgm(f, h);
  assert.equal(s.samples, 118);
  assert.equal(s.histogram[0x67], 2);
  assert.equal(s.dacWrites, 3);
  assert.deepEqual(s.blocks.map((b) => [b.type, b.size, b.bankOffset]), [[0, 100, 0], [0, 50, 100]]);
  assert.equal(s.bankSize.get(0), 150);
  assert.equal(s.stop, 'end');
  assert.equal(parseVgm(f).pcmBytes, 150);
});

test('what this player leaves out is listed: compressed PCM, other chips\' commands, unknown commands, a cut-short file', () => {
  const comp = parseVgm(vgmFile({ commands: [block(0x40, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), wait(10)] }));
  assert.ok(comp.unsupported.some((u) => /compressed PCM/.test(u)));
  const other = parseVgm(vgmFile({ commands: [[0x54, 0x20, 0x01], [0xa0, 0x07, 0x38], wait(10)] }));
  assert.ok(other.unsupported.includes('YM2151 (commands skipped)'));
  const unknown = parseVgm(vgmFile({ commands: [[0x01], [0x32, 0x00], [0xe5, 1, 2, 3, 4], wait(10)] }));
  assert.ok(unknown.unsupported.some((u) => /unknown commands 0x01, 0x32, 0xe5/.test(u)), unknown.unsupported.join());
  const undefinedCmd = scanVgm(vgmFile({ commands: [wait(10), [0x64], wait(10)] }));
  assert.equal(undefinedCmd.stop, 'undefined');
  assert.equal(undefinedCmd.samples, 10);
  const cut = vgmFile({ commands: [wait(10), ym(0, 0x28, 0xf0)], end: false });
  const short = cut.slice(0, cut.length - 1);
  assert.ok(parseVgm(short).unsupported.includes('the music data is cut short'));
});

test('reserved commands 0x40-0x4E take one operand before 1.60 and two from then on', () => {
  const b = new Uint8Array([0x41, 0, 0, 0x66]);
  assert.equal(commandLength(b, 0, 4, 0x150), 2);
  assert.equal(commandLength(b, 0, 4, 0x160), 3);
  assert.equal(commandLength(new Uint8Array([0x52, 0x28]), 0, 2, 0x150), -1);   // runs past the end
});

test('damaged headers throw a VgmError that says what is wrong', () => {
  assert.throws(() => parseVgm(new Uint8Array(10)), VgmError);
  assert.throws(() => parseVgm(new TextEncoder().encode('RIFF....WAVEfmt '.repeat(8))), /not a VGM/);
  assert.throws(() => parseVgm(gzipSync(vgmFile({ commands: SONG }))), /VGZ must be unpacked/);
  const badData = vgmFile({ commands: SONG });
  new DataView(badData.buffer).setUint32(0x34, 0x7ffffff0, true);
  assert.throws(() => parseVgm(badData), /data offset/);
  const badLoop = vgmFile({ commands: SONG });
  new DataView(badLoop.buffer).setUint32(0x1c, 0x7ffffff0, true);
  const h = parseVgm(badLoop);
  assert.equal(h.loopOffset, 0);
  assert.ok(h.warnings.some((w) => /loop point/.test(w)));
});

test('hostile input: random bytes after a header never hang and only ever throw VgmError', () => {
  let seed = 12345;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed >>> 16; };
  for (let k = 0; k < 300; k++) {
    const f = vgmFile({ commands: [] , end: false });
    const junk = new Uint8Array(f.length + 200 + (rnd() % 400));
    junk.set(f);
    for (let i = f.length; i < junk.length; i++) junk[i] = rnd() & 0xff;
    if (k % 3 === 0) for (let i = 4; i < 0x40; i++) if (rnd() % 8 === 0) junk[i] = rnd() & 0xff;
    try {
      const h = parseVgm(junk);
      assert.ok(Array.isArray(h.unsupported));
    } catch (err) { assert.ok(err instanceof VgmError, String(err)); }
  }
});

test('isGzip and isVgm look at the magic bytes', () => {
  const f = vgmFile({ commands: SONG });
  assert.equal(isVgm(f), true);
  assert.equal(isGzip(f), false);
  assert.equal(isGzip(gzipSync(f)), true);
  assert.equal(isVgm(new Uint8Array([0x56, 0x67])), false);
});

test('inflateVgm: a .vgz round trip, a plain .vgm as it is, and refusals', async () => {
  const f = vgmFile({ commands: SONG, gd3: { track: 'Round trip' } });
  const out = await inflateVgm(gzipSync(f));
  assert.deepEqual(out, f);
  assert.equal(parseVgm(out).gd3.track, 'Round trip');
  assert.equal(await inflateVgm(f), f);
  await assert.rejects(inflateVgm(gzipSync(new Uint8Array(100))), /does not hold a VGM/);
  await assert.rejects(inflateVgm(new Uint8Array([1, 2, 3, 4])), /not a VGM or VGZ/);
  const broken = gzipSync(f);
  broken.fill(0xaa, 20, 60);
  await assert.rejects(inflateVgm(broken), VgmError);
});

test('inflateVgm stops a gzip that unpacks past 32 MB (a bomb), without unpacking it all', async () => {
  const big = new Uint8Array(MAX_VGM_BYTES + 1024);
  big.set(vgmFile({ commands: SONG }));
  await assert.rejects(inflateVgm(gzipSync(big)), /more than 32 MB/);
});

test('readVgmZip: stored and deflated .vgm/.vgz entries, other files and resource forks skipped', async () => {
  const a = vgmFile({ commands: SONG, gd3: { track: 'A' } }), b = vgmFile({ commands: SONG, gd3: { track: 'B' } });
  const bz = new Uint8Array(gzipSync(b));
  const zip = zipFile([
    { name: 'pack/01 A.vgm', bytes: a, deflated: deflateRawSync(a) },
    { name: 'pack/02 B.vgz', bytes: bz },
    { name: 'pack/readme.txt', bytes: new TextEncoder().encode('hello') },
    { name: '__MACOSX/pack/._01 A.vgm', bytes: new Uint8Array(10) },
    { name: 'pack/playlist.m3u', bytes: new TextEncoder().encode('01 A.vgm') },
  ]);
  const files = await readVgmZip(zip);
  assert.deepEqual(files.map((f) => f.name), ['01 A.vgm', '02 B.vgz']);
  assert.deepEqual(files[0].bytes, a);
  assert.deepEqual(files[1].bytes, bz);
  assert.equal(parseVgm(await inflateVgm(files[1].bytes)).gd3.track, 'B');
});

test('readVgmZip refuses what is not a usable zip', async () => {
  await assert.rejects(readVgmZip(new Uint8Array(100)), /not a zip/);
  const zip = zipFile([{ name: 'a.vgm', bytes: vgmFile({ commands: SONG }) }]);
  const cut = zip.slice();
  // point the directory past the end
  const eocd = cut.length - 22;
  new DataView(cut.buffer).setUint32(eocd + 16, 0x7fffffff, true);
  await assert.rejects(readVgmZip(cut), VgmError);
  const damaged = zipFile([{ name: 'a.vgm', bytes: vgmFile({ commands: SONG }), deflated: new Uint8Array([0xff, 0xff, 0xff, 0xff]) }]);
  await assert.rejects(readVgmZip(damaged), VgmError);
});
