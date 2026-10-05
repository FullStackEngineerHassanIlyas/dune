// The original game's picture formats (src/formats: Format80, Format40, PAL, CPS, SHP, WSA, and the PNG writer
// they are shown through). Every file here is made up inside the test (original-art-fakes.mjs) — no game data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { unpackFormat80 } from '../src/formats/format80.js';
import { xorFormat40 } from '../src/formats/format40.js';
import { readPal, readPalette, widen6, toRgba } from '../src/formats/pal.js';
import { readCps } from '../src/formats/cps.js';
import { readShp } from '../src/formats/shp.js';
import { readWsa } from '../src/formats/wsa.js';
import { encodePng, encodePngSync, scaleNearest, pngDataUrl, storedZlib } from '../src/formats/png.js';
import { PictureError } from '../src/formats/picture-error.js';
import { packFormat80, packFormat40, fakePalette6, palFile, cpsFile, shpFile, wsaFile, rng } from './original-art-fakes.mjs';

const sameBytes = (a, b, msg) => assert.ok(a.length === b.length && a.every((v, i) => v === b[i]), msg);
const throwsAt = (fn, label, pattern) => assert.throws(fn, (e) => e instanceof PictureError && e.message.startsWith(`${label}: `) && pattern.test(e.message), `${pattern}`);

/** A made-up picture: flat areas, gradients, repeats and noise, so every packing command is used. */
function picture(seed, n = 64000) {
  const r = rng(seed), b = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const zone = Math.floor(i / 3000) % 4;
    b[i] = zone === 0 ? 17 : zone === 1 ? (i >> 4) & 255 : zone === 2 ? b[Math.max(0, i - 640)] ^ (r() < 0.02 ? 1 : 0) : Math.floor(r() * 256);
  }
  return b;
}

// ——— Format80 ———

/** The kinds of command in a packed stream, walked command by command. */
function commands(packed) {
  const kinds = new Set();
  for (let p = 0; p < packed.length;) {
    const c = packed[p];
    if (c === 0x80) { kinds.add('end'); break; }
    if (c < 0x80) { kinds.add('near'); p += 2; } else if (c < 0xc0) { kinds.add('literal'); p += 1 + (c & 0x3f); } else if (c === 0xfe) { kinds.add('fill'); p += 4; } else if (c === 0xff) { kinds.add('long'); p += 5; } else { kinds.add('from'); p += 3; }
  }
  return kinds;
}

test('Format80: what is packed unpacks to the same bytes, every command used', () => {
  const used = new Set();
  for (const seed of [1, 2, 3]) {
    const b = picture(seed, 20000), packed = packFormat80(b);
    for (const k of commands(packed)) used.add(k);
    const r = unpackFormat80(packed, { size: b.length });
    sameBytes(r.bytes, b);
    assert.equal(r.length, b.length);
  }
  const long = new Uint8Array(400);
  for (let i = 0; i < 400; i++) long[i] = (i * 7) % 200;   // a 200-byte pattern repeated: one long repeat
  for (const k of commands(packFormat80(long))) used.add(k);
  sameBytes(unpackFormat80(packFormat80(long), { size: 400 }).bytes, long);
  assert.deepEqual([...used].sort(), ['end', 'fill', 'from', 'literal', 'long', 'near']);
});

test('Format80: a repeat overlapping what it writes makes a run, and unpacking stops when the output is full', () => {
  // literal "ab", then 0x00-form: 8 bytes from 2 back → "ababababab"
  const r = unpackFormat80(Uint8Array.from([0x82, 97, 98, (5 << 4) | 0, 2, 0x80]), { size: 10 });
  assert.equal(String.fromCharCode(...r.bytes), 'ababababab');
  // the same from an absolute position (0xC0 form), cut at the size: "abababa"
  const c = unpackFormat80(Uint8Array.from([0x82, 97, 98, 0xc0 | 5, 0, 0]), { size: 7 });
  assert.equal(String.fromCharCode(...c.bytes), 'abababa');
  assert.equal(c.length, 7);
  // an end mark before the size: the length says how far it got
  assert.equal(unpackFormat80(Uint8Array.from([0x81, 9, 0x80]), { size: 5 }).length, 1);
});

test('Format80: damaged data is refused, naming the file and the byte', () => {
  const at = (bytes, pattern, size = 16) => throwsAt(() => unpackFormat80(Uint8Array.from(bytes), { size, label: 'X.CPS' }), 'X.CPS', pattern);
  at([0x83, 1, 2], /cut short in the command at byte 0/);
  at([0x81, 1, 0x00], /cut short in the command at byte 2/);
  at([0x81, 1, 0x10, 5], /repeats from before its start, in the command at byte 2/);
  at([0x81, 1, 0x00, 0], /repeats output byte 1 before it is written, in the command at byte 2/);
  at([0x81, 1, 0xc2, 9, 0], /repeats output byte 9 before it is written, in the command at byte 2/);
  at([0x81, 1, 0xff, 3, 0], /cut short in the command at byte 2/);
  at([0x81, 1, 0xfe, 3], /cut short/);
  at([0x81, 1], /ends at byte 2 without its end mark \(1 of 16 bytes unpacked\)/);
  assert.throws(() => unpackFormat80('text', { size: 1, label: 'T' }), PictureError);
});

test('Format80: random bytes give a PictureError or bytes, never anything else', () => {
  const r = rng(11);
  for (let k = 0; k < 600; k++) {
    const b = Uint8Array.from({ length: Math.floor(r() * 80) }, () => Math.floor(r() * 256));
    try {
      const out = unpackFormat80(b, { size: 200 });
      assert.ok(out.length <= 200 && out.bytes.length === 200);
    } catch (e) { assert.ok(e instanceof PictureError, `${e}`); }
  }
});

// ——— Format40 ———

test('Format40: the change from one frame to the next makes the next, with skips, runs and strings long and short', () => {
  const r = rng(5), a = picture(4, 50000), b = a.slice();
  for (let i = 0; i < 300; i++) b[i] ^= 0x5a;                       // a run of one XOR value, longer than 255
  for (let i = 1000; i < 1200; i++) b[i] = Math.floor(r() * 256);   // a string longer than 127
  b[40000] ^= 1; b[40002] ^= 2;                                       // short strings after a skip longer than 127
  const delta = packFormat40(a, b);
  const f = a.slice();
  const end = xorFormat40(f, delta, { label: 'F.WSA' });
  sameBytes(f, b);
  assert.equal(end, delta.length);
  // the short forms
  const s = Uint8Array.from([0, 3, 0xff, 2, 1, 2, 0x81, 1, 7, 0x80, 0, 0]), g = new Uint8Array(8);
  xorFormat40(g, s);
  assert.deepEqual([...g], [255, 255, 255, 1, 2, 0, 7, 0]);
});

test('Format40: damaged changes are refused, naming the file and the byte', () => {
  const at = (bytes, pattern, size = 8) => throwsAt(() => xorFormat40(new Uint8Array(size), Uint8Array.from(bytes), { label: 'F.WSA' }), 'F.WSA', pattern);
  at([5, 1, 2], /cut short in the command at byte 0/);
  at([0x89], /runs past the frame's 8 bytes in the command at byte 0/);
  at([0x80, 0xff, 0x7f], /runs past the frame/);
  at([0, 9, 1], /runs past the frame/);
  at([0x80, 0x05, 0xc0], /cut short in the command at byte 0/);
  at([0x82], /ends at byte 1 without its end mark/);
  const r = rng(12);
  for (let k = 0; k < 600; k++) {
    const b = Uint8Array.from({ length: Math.floor(r() * 40) }, () => Math.floor(r() * 256));
    try { xorFormat40(new Uint8Array(64), b); } catch (e) { assert.ok(e instanceof PictureError, `${e}`); }
  }
});

// ——— PAL ———

test('a palette is 256 VGA colours of 6 bits, widened so 63 is full brightness', () => {
  assert.deepEqual([0, 1, 32, 62, 63].map(widen6), [0, 4, 130, 251, 255]);
  const p6 = fakePalette6(), p = readPal(palFile(p6), 'IBM.PAL');
  assert.equal(p.length, 768);
  for (let i = 0; i < 768; i++) assert.equal(p[i], widen6(p6[i]));
  throwsAt(() => readPal(new Uint8Array(767), 'IBM.PAL'), 'IBM.PAL', /768 bytes, this one 767/);
  const bad = palFile(p6); bad[100] = 64;
  throwsAt(() => readPal(bad, 'IBM.PAL'), 'IBM.PAL', /byte 100 is 64/);
  throwsAt(() => readPalette(new Uint8Array(10), { from: 4, label: 'A.CPS' }), 'A.CPS', /only 6 from byte 4/);
  const rgba = toRgba(Uint8Array.from([1, 2]), p, Uint8Array.from([1, 0]));
  assert.deepEqual([...rgba], [p[3], p[4], p[5], 255, 0, 0, 0, 0], 'a see-through pixel is left clear');
});

// ——— CPS ———

test('a CPS picture: packed or not, with its own palette or none', () => {
  const px = picture(9);
  const a = readCps(cpsFile(px), 'MENTATA.CPS');
  assert.deepEqual([a.width, a.height, a.palette], [320, 200, null]);
  sameBytes(a.pixels, px);
  const b = readCps(cpsFile(px, { packing: 0, palette: fakePalette6() }), 'HERALD.ENG');
  sameBytes(b.pixels, px);
  assert.equal(b.palette[3 * 255], 255);
  const trailing = Uint8Array.from([...cpsFile(px), 1, 2, 3]);   // bytes past the size word are not the picture's
  sameBytes(readCps(trailing).pixels, px);
});

test('a damaged CPS picture is refused, naming the file and the byte', () => {
  const good = cpsFile(picture(3));
  const set = (k, v) => { const b = good.slice(); b[k] = v; return b; };
  throwsAt(() => readCps(good.slice(0, 7), 'M.CPS'), 'M.CPS', /too short to be a CPS picture \(7 bytes\)/);
  throwsAt(() => readCps(set(2, 3), 'M.CPS'), 'M.CPS', /packing 3 at byte 2/);
  throwsAt(() => readCps(set(4, 1), 'M.CPS'), 'M.CPS', /64001 bytes \(byte 4\) is not rows of 320/);
  throwsAt(() => readCps(set(8, 5), 'M.CPS'), 'M.CPS', /palette of 5 bytes \(byte 8\)/);
  throwsAt(() => readCps(good.slice(0, good.length - 40), 'M.CPS'), 'M.CPS', /without its end mark|cut short/);
  throwsAt(() => readCps(cpsFile(picture(3), { packing: 0 }).slice(0, 5000), 'M.CPS'), 'M.CPS', /run past the end of the file/);
  const short = cpsFile(picture(3).slice(0, 100)); short.set([0x00, 0xfa, 0, 0], 4);   // says 64000, has 1
  throwsAt(() => readCps(Uint8Array.from([...short.slice(0, 10), 0x81, 1, 0x80]), 'M.CPS'), 'M.CPS', /ends at byte \d+ after 1 of its 64000 pixels/);
  const r = rng(21);
  for (let k = 0; k < 300; k++) {
    const b = good.slice(0, 10 + Math.floor(r() * 400));
    for (let i = 0; i < 4; i++) b[Math.floor(r() * b.length)] = Math.floor(r() * 256);
    try { readCps(b); } catch (e) { assert.ok(e instanceof PictureError, `${e}`); }
  }
});

// ——— SHP ———

const shape = (w, h, seed, { table = false, holes = true } = {}) => {
  const r = rng(seed);
  return { width: w, height: h, indices: Uint8Array.from({ length: w * h }, (_, i) => (holes && (i % 7 === 0 || i % w > w - 3) ? 0 : 1 + Math.floor(r() * (table ? 15 : 254)))), table: table ? Uint8Array.from({ length: 16 }, (_, k) => 200 + k) : undefined };
};

test('a shape file, 1.07 or 1.0, packed or plain, with see-through pixels and colour tables', () => {
  const shapes = [shape(24, 8, 1), shape(16, 10, 2, { table: true }), null, shape(300, 3, 3)];
  for (const version of ['1.07', '1.0']) for (const packed of [true, false]) {
    const s = readShp(shpFile(shapes, { version, packed }), 'MENSHPA.SHP');
    assert.equal(s.version, version);
    assert.equal(s.shapes.length, 4);
    assert.equal(s.shapes[2], null, 'a shape with no offset is missing');
    for (const k of [0, 1, 3]) {
      const want = shapes[k], got = s.shapes[k];
      assert.deepEqual([got.width, got.height], [want.width, want.height]);
      for (let i = 0; i < want.indices.length; i++) {
        const v = want.indices[i];
        assert.equal(got.alpha[i], v ? 1 : 0);
        if (v) assert.equal(got.indices[i], want.table ? want.table[v] : v, `${version} ${packed} shape ${k} pixel ${i}`);
      }
    }
    assert.ok(s.shapes[1].table instanceof Uint8Array);
  }
  // the first shape missing: the version is told by the first shape that is there
  for (const version of ['1.07', '1.0']) {
    const s = readShp(shpFile([null, shapes[0], shapes[1]], { version }), 'S.SHP');
    assert.equal(s.version, version, `${version} without its first shape`);
    assert.equal(s.shapes[0], null);
    assert.deepEqual([s.shapes[1].width, s.shapes[1].height, s.shapes[2].width], [24, 8, 16]);
  }
});

test('a damaged shape file is refused, naming the file, the shape and the byte', () => {
  const good = shpFile([shape(24, 8, 1), shape(16, 10, 2)]);
  const set = (k, v) => { const b = good.slice(); b[k] = v; return b; };
  throwsAt(() => readShp(new Uint8Array(1), 'S.SHP'), 'S.SHP', /too short/);
  throwsAt(() => readShp(new Uint8Array(4), 'S.SHP'), 'S.SHP', /no shapes/);
  throwsAt(() => readShp(Uint8Array.from([0xff, 0xff, 0, 0]), 'S.SHP'), 'S.SHP', /65535 shapes \(byte 0\)/);
  throwsAt(() => readShp(Uint8Array.from([50, 0, 0, 0]), 'S.SHP'), 'S.SHP', /offsets of 50 shapes run past the end/);
  throwsAt(() => readShp((() => { const b = good.slice(); b.set([0x60, 0xea, 0, 0], 6); return b; })(), 'S.SHP'), 'S.SHP', /shape 1's offset \(byte 6\) points outside the file/);
  const first = 2 + 4 * 3;   // where shape 0's header starts
  throwsAt(() => readShp(set(first + 2, 0), 'S.SHP'), 'S.SHP', /shape 0 is 24 x 0 pixels/);
  throwsAt(() => readShp(good.slice(0, good.length - 6), 'S.SHP'), 'S.SHP', /shape 1/);
  const plain = shpFile([shape(24, 8, 1)], { packed: false });
  throwsAt(() => readShp(plain.slice(0, plain.length - 5), 'S.SHP'), 'S.SHP', /shape 0's pixels end in row 7 of 8 at byte \d+/);
  const r = rng(31);
  for (let k = 0; k < 400; k++) {
    const b = good.slice();
    for (let i = 0; i < 3; i++) b[Math.floor(r() * b.length)] = Math.floor(r() * 256);
    try { readShp(b.slice(0, Math.floor(r() * b.length) + 1)); } catch (e) { assert.ok(e instanceof PictureError, `${e}`); }
  }
});

// ——— WSA ———

function frames(n, w, h) {
  const r = rng(n), out = [];
  let f = new Uint8Array(w * h);
  for (let k = 0; k < n; k++) {
    f = f.slice();
    for (let i = 0; i < w * h / 6; i++) f[Math.floor(r() * f.length)] = Math.floor(r() * 256);
    for (let i = k * 30; i < k * 30 + 400 && i < f.length; i++) f[i] = k + 1;   // a moving band (runs)
    out.push(f);
  }
  return out;
}

test('a WSA animation: every frame whole, from 1.07 (with a palette, looping) and 1.0 files', () => {
  const fs = frames(6, 184, 112);
  const a = readWsa(wsaFile(fs, { width: 184, height: 112, palette: fakePalette6(), loop: true }), 'FARTR.WSA');
  assert.deepEqual([a.version, a.width, a.height, a.loops, a.frames.length], ['1.07', 184, 112, true, 6]);
  a.frames.forEach((f, k) => sameBytes(f, fs[k], `frame ${k}`));
  assert.equal(a.palette[3 * 255 + 2], widen6(fakePalette6()[3 * 255 + 2]));
  const b = readWsa(wsaFile(fs.slice(0, 3), { width: 184, height: 112, version: '1.0' }), 'OLD.WSA');
  assert.deepEqual([b.version, b.loops, b.palette], ['1.0', false, null]);
  b.frames.forEach((f, k) => sameBytes(f, fs[k]));
});

test('a damaged WSA animation is refused, naming the file, the frame and the byte', () => {
  const good = wsaFile(frames(3, 40, 30), { width: 40, height: 30 });
  const set = (k, v) => { const b = good.slice(); b[k] = v; return b; };
  throwsAt(() => readWsa(good.slice(0, 12), 'W.WSA'), 'W.WSA', /too short/);
  throwsAt(() => readWsa(set(0, 0), 'W.WSA'), 'W.WSA', /0 frames \(byte 0\)/);
  throwsAt(() => readWsa(set(2, 0), 'W.WSA'), 'W.WSA', /0 x 30 pixels/);
  const noFirst = good.slice(); noFirst.set([0, 0, 0, 0], 10);
  throwsAt(() => readWsa(noFirst, 'W.WSA'), 'W.WSA', /carries on from another animation/);
  throwsAt(() => readWsa(good.slice(0, good.length - 10), 'W.WSA'), 'W.WSA', /frame 2/);
  const r = rng(41);
  for (let k = 0; k < 300; k++) {
    const b = good.slice();
    for (let i = 0; i < 3; i++) b[10 + Math.floor(r() * (b.length - 10))] = Math.floor(r() * 256);
    try { readWsa(b); } catch (e) { assert.ok(e instanceof PictureError, `${e}`); }
  }
});

// ——— PNG ———

/** The pixels of a PNG this module wrote (palette or RGBA, filter 0), read back with zlib. */
function decodePng(png) {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let p = 8, width = 0, height = 0, type = 0, plte = null, trns = null;
  const idat = [];
  while (p < png.length) {
    const len = dv.getUint32(p), name = String.fromCharCode(...png.subarray(p + 4, p + 8)), body = png.subarray(p + 8, p + 8 + len);
    if (name === 'IHDR') { width = dv.getUint32(p + 8); height = dv.getUint32(p + 12); type = body[9]; }
    if (name === 'PLTE') plte = body;
    if (name === 'tRNS') trns = body;
    if (name === 'IDAT') idat.push(body);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat.map((b) => Buffer.from(b)))), out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const o = (y * width + x) * 4;
    if (type === 3) {
      const k = raw[y * (width + 1) + 1 + x];
      out.set(plte.subarray(k * 3, k * 3 + 3), o); out[o + 3] = trns && k < trns.length ? trns[k] : 255;
    } else out.set(raw.subarray(y * (width * 4 + 1) + 1 + x * 4, y * (width * 4 + 1) + 5 + x * 4), o);
  }
  return { width, height, type, rgba: out };
}

test('PNG: the pixels come back exactly, as a palette picture up to 256 colours, RGBA past that, packed or stored', async () => {
  const p = readPal(palFile());
  const few = toRgba(Uint8Array.from({ length: 30 * 20 }, (_, i) => (i * 7) % 40), p, Uint8Array.from({ length: 600 }, (_, i) => (i % 9 ? 1 : 0)));
  for (const png of [encodePngSync(few, 30, 20), await encodePng(few, 30, 20)]) {
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    const d = decodePng(png);
    assert.deepEqual([d.width, d.height, d.type], [30, 20, 3]);
    sameBytes(d.rgba, few);
  }
  const rr = rng(77), many = Uint8Array.from({ length: 40 * 40 * 4 }, (_, i) => (i % 4 === 3 ? 255 : Math.floor(rr() * 256)));
  const d = decodePng(await encodePng(many, 40, 40));
  assert.equal(d.type, 6);
  sameBytes(d.rgba, many);
  const big = scaleNearest(few, 30, 20, 3);
  const db = decodePng(encodePngSync(big, 90, 60));
  for (const [x, y] of [[0, 0], [5, 7], [29, 19]]) for (const [dx, dy] of [[0, 0], [2, 1], [1, 2]]) {
    const a = (y * 30 + x) * 4, b = ((y * 3 + dy) * 90 + x * 3 + dx) * 4;
    assert.deepEqual([...db.rgba.subarray(b, b + 4)], [...few.subarray(a, a + 4)], 'each pixel a 3 x 3 block');
  }
  sameBytes(decodePng(await encodePng(few, 30, 20, { scale: 3 })).rgba, db.rgba, 'enlarged while written: the same blocks');
  sameBytes(decodePng(encodePngSync(many, 40, 40, { scale: 2 })).rgba, scaleNearest(many, 40, 40, 2), 'RGBA too');
  assert.match(pngDataUrl(encodePngSync(few, 30, 20)), /^data:image\/png;base64,iVBORw0KGgo/);
  assert.deepEqual([...inflateSync(Buffer.from(storedZlib(new Uint8Array(70000).fill(3))))].length, 70000, 'stored blocks past 64 KB');
  assert.throws(() => encodePngSync(new Uint8Array(10), 2, 2), RangeError);
});
