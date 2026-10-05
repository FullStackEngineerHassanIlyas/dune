// The pixel-art scaler (src/ui/campaign/pixel-scale.js: Scale2x, run once, twice or three times), the palette PNG
// written straight from its indices (src/formats/png.js encodeIndexedPng), and the original Mentat's frames enlarged
// in place (original-mentat-art.js enlargeFigure): laid over the enlarged head, each shows what the whole picture
// enlarged with that frame in it would — everywhere when cut REACH pixels wider than the frame, inside the frame's
// own box when not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { scaleIndexed, scalePixelArt, rgbaWords, wordsRgba, REACH } from '../src/ui/campaign/pixel-scale.js';
import { encodeIndexedPng } from '../src/formats/png.js';
import { enlargeFigure } from '../src/ui/campaign/original-mentat-art.js';
import { rng } from './original-art-fakes.mjs';

/** Scale2x as its author first wrote it (AdvMAME2x: B up, D left, F right, H down), to check the fast form by. */
function reference(p, w, h) {
  const out = new p.constructor(w * h * 4), at = (x, y) => p[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const E = at(x, y), B = at(x, y - 1), D = at(x - 1, y), F = at(x + 1, y), H = at(x, y + 1);
    const e = [D === B && B !== F && D !== H ? D : E, B === F && B !== D && F !== H ? F : E, D === H && D !== B && H !== F ? D : E, H === F && D !== H && B !== F ? F : E];
    out[(2 * y) * 2 * w + 2 * x] = e[0]; out[(2 * y) * 2 * w + 2 * x + 1] = e[1];
    out[(2 * y + 1) * 2 * w + 2 * x] = e[2]; out[(2 * y + 1) * 2 * w + 2 * x + 1] = e[3];
  }
  return out;
}
const picture = (w, h, colours, seed) => { const r = rng(seed); return Uint8Array.from({ length: w * h }, () => Math.floor(r() * colours)); };

test('Scale2x rounds a staircase off and leaves flat ground, straight edges and a lone pixel as drawn', () => {
  // . X .      the corner where two X meet fills in: the middle pixel's top-left quarter turns X
  // X . .
  // . . .
  const stair = Uint8Array.from([0, 1, 0, 1, 0, 0, 0, 0, 0]);
  const big = scaleIndexed(stair, 3, 3, 2);
  assert.deepEqual([big[2 * 6 + 2], big[2 * 6 + 3], big[3 * 6 + 2], big[3 * 6 + 3]], [1, 0, 0, 0]);
  assert.ok(scaleIndexed(new Uint8Array(16).fill(5), 4, 4, 8).every((v) => v === 5), 'flat stays flat');
  const lone = new Uint8Array(25); lone[12] = 7;
  const l = scaleIndexed(lone, 5, 5, 2);
  assert.deepEqual([...l].map((v, i) => (v ? i : -1)).filter((i) => i >= 0), [44, 45, 54, 55], 'a lone pixel is a 2 x 2 block');
  const edge = Uint8Array.from({ length: 36 }, (_, i) => (i % 6 < 3 ? 1 : 2));
  assert.deepEqual([...scaleIndexed(edge, 6, 6, 2)], [...Uint8Array.from({ length: 144 }, (_, i) => (i % 12 < 6 ? 1 : 2))], 'a straight edge stays straight');
});

test('the fast Scale2x is the reference rule pixel for pixel; 4x and 8x are two and three passes; no colour is ever new', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const [w, h] = [3 + (seed % 7), 2 + (seed % 5)], p = picture(w, h, 2 + (seed % 3), seed);
    assert.deepEqual([...scaleIndexed(p, w, h, 2)], [...reference(p, w, h)], `seed ${seed}`);
    const twice = reference(reference(p, w, h), 2 * w, 2 * h);
    assert.deepEqual([...scaleIndexed(p, w, h, 4)], [...twice]);
    assert.deepEqual([...scaleIndexed(p, w, h, 8)], [...reference(twice, 4 * w, 4 * h)]);
    const before = new Set(p);
    assert.ok(scaleIndexed(p, w, h, 8).every((v) => before.has(v)));
  }
  const p = picture(4, 3, 3, 9);
  assert.deepEqual([...scaleIndexed(p, 4, 3, 1)], [...p], 'factor 1 is a copy');
  assert.notEqual(scaleIndexed(p, 4, 3, 1), p);
  for (const bad of [3, 0, 6, 2.5]) assert.throws(() => scaleIndexed(p, 4, 3, bad), RangeError, String(bad));
  assert.throws(() => scaleIndexed(p, 5, 3, 2), RangeError, 'the wrong size');
});

test('on RGBA every see-through pixel is one colour, whatever its RGB, and comes out 0, 0, 0, 0', () => {
  const red = [200, 0, 0, 255], clear1 = [9, 9, 9, 0], clear2 = [50, 60, 70, 0];
  // red on the diagonal, see-through around it in two different RGBs: they agree, so the corners fill with them
  const rgba = Uint8Array.from([...red, ...clear1, ...clear2, ...red]);
  const big = scalePixelArt(rgba, 2, 2, 2);
  const words = rgbaWords(big);
  assert.ok(words.every((c) => c === 0 || c === rgbaWords(Uint8Array.from(red))[0]));
  assert.deepEqual([...big.subarray(20, 24)], [0, 0, 0, 0], 'the red pixel\'s corner between its two see-through neighbours is see-through: they agree');
  assert.deepEqual([...big.subarray(8, 12)], [0, 0, 0, 0], 'see-through as 0, 0, 0, 0');
  assert.deepEqual([...wordsRgba(rgbaWords(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 0])))], [1, 2, 3, 4, 0, 0, 0, 0]);
  assert.throws(() => scalePixelArt(rgba, 3, 2, 2), RangeError);
});

/** The pixels of a palette PNG (filter 0 rows), read back with zlib. */
function readPalettePng(png) {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength), idat = [];
  let p = 8, width = 0, height = 0, type = 0, plte = null, trns = new Uint8Array(0);
  while (p < png.length) {
    const len = dv.getUint32(p), name = String.fromCharCode(...png.subarray(p + 4, p + 8)), body = png.subarray(p + 8, p + 8 + len);
    if (name === 'IHDR') { width = dv.getUint32(p + 8); height = dv.getUint32(p + 12); type = body[9]; }
    if (name === 'PLTE') plte = body;
    if (name === 'tRNS') trns = body;
    if (name === 'IDAT') idat.push(Buffer.from(body));
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * (width + 1)], 0, 'filter 0');
    for (let x = 0; x < width; x++) {
      const k = raw[y * (width + 1) + 1 + x], o = (y * width + x) * 4;
      rgba.set(plte.subarray(k * 3, k * 3 + 3), o); rgba[o + 3] = k < trns.length ? trns[k] : 255;
    }
  }
  return { width, height, type, rgba };
}

test('a palette PNG is written straight from indices: the colours come back exactly, see-through included', async () => {
  const colours = rgbaWords(Uint8Array.from([0, 0, 0, 0, 255, 128, 0, 255, 10, 20, 30, 255]));
  const index = scaleIndexed(picture(5, 4, 3, 4), 5, 4, 8);
  const png = await encodeIndexedPng(index, 40, 32, colours);
  const back = readPalettePng(png);
  assert.deepEqual([back.width, back.height, back.type], [40, 32, 3]);
  assert.deepEqual([...back.rgba], [...wordsRgba(Uint32Array.from(index, (k) => colours[k]))]);
  await assert.rejects(encodeIndexedPng(index, 40, 31, colours), RangeError);
  await assert.rejects(encodeIndexedPng(index, 40, 32, new Uint32Array(257)), RangeError);
});

/** A room of a few colours with three parts on it, each with a few frames, some pixels of them see-through. */
function scene(seed) {
  const r = rng(seed), W = 40, H = 36, top = 4, pal = [[30, 40, 50], [200, 150, 90], [90, 60, 40], [240, 230, 200], [10, 10, 10]];
  const px = (k) => [...pal[k], 255];
  const room = Uint8Array.from({ length: W * H }, () => Math.floor(r() * 3)).reduce((out, k, i) => (out.set(px(k), i * 4), out), new Uint8Array(W * H * 4));
  const frame = (x, y, w, h, hole) => ({ x, y: y + top, width: w, height: h,
    rgba: Uint8Array.from({ length: w * h }).reduce((out, _, i) => (r() < hole ? out : (out.set(px(1 + Math.floor(r() * 4)), i * 4), out)), new Uint8Array(w * h * 4)) });
  const parts = [frame(6, 8, 10, 4, 0.2), frame(6, 8, 10, 4, 0.5), frame(8, 12, 12, 6, 0.3), frame(0, 0, 5, 7, 0), frame(30, 28, 10, 8, 0.4), frame(36, 30, 8, 4, 0)];
  return { room, W, H, top, parts };
}

test('each frame enlarged in place, over the enlarged head, is the whole picture enlarged with it: everywhere with REACH of padding, inside its box without', () => {
  for (const seed of [1, 2, 3]) {
    const { room, W, H, top, parts } = scene(seed), s = 4;
    const fig = enlargeFigure(room, W, H, parts, top, s);
    assert.ok(fig.colours && fig.colours[0] === 0 && fig.colours.length <= 256, 'one palette, see-through first');
    const code = (rgba) => Uint8Array.from(rgbaWords(rgba), (c) => fig.colours.indexOf(c));
    assert.deepEqual([...fig.head], [...scaleIndexed(code(room), W, H, s)], 'the head is the room enlarged');
    let outside = 0;
    for (const q of parts) {
      const [x, y, w, h] = [q.x, q.y - top, q.width, q.height];
      if (x + w > W || y + h > H) {   // reaching out of the figure: enlarged alone, in its own box
        const { values, box } = fig.part(q, { pad: REACH });
        assert.deepEqual(box, [x, y, w, h]);
        assert.deepEqual([...values], [...scaleIndexed(code(q.rgba), w, h, s)]);
        continue;
      }
      const whole = room.slice();
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        const o = (r * w + c) * 4;
        if (q.rgba[o + 3]) whole.set(q.rgba.subarray(o, o + 4), ((y + r) * W + x + c) * 4);
      }
      const truth = scaleIndexed(code(whole), W, H, s);
      for (const pad of [0, REACH]) {
        const { values, box: [bx, by, bw, bh] } = fig.part(q, { pad });
        const want = [Math.max(0, x - pad), Math.max(0, y - pad)];
        assert.deepEqual([bx, by, bw, bh], [...want, Math.min(W, x + w + pad) - want[0], Math.min(H, y + h + pad) - want[1]], 'its box, as far as the figure goes');
        assert.equal(values.length, bw * s * bh * s);
        // over the whole picture: the part where its box is, the head elsewhere
        for (let r = 0; r < H * s; r++) for (let c = 0; c < W * s; c++) {
          const i = r * W * s + c, under = fig.head[i];
          const inBox = c >= bx * s && c < (bx + bw) * s && r >= by * s && r < (by + bh) * s;
          const v = inBox ? values[(r - by * s) * bw * s + c - bx * s] : 0;
          if (v) assert.notEqual(v, under, 'only what differs from the head is drawn');
          if (pad === REACH) assert.equal(v || under, truth[i], `seed ${seed}, frame at ${x},${y}, padded: pixel ${c},${r}`);
          else if (inBox) assert.equal(v || under, truth[i], `seed ${seed}, frame at ${x},${y}: pixel ${c},${r}`);
          else if (under !== truth[i]) outside++;
        }
      }
    }
    if (seed === 1) assert.ok(outside > 0, 'without padding a frame changes a few pixels just outside its box (the test sees them)');
  }
  assert.ok(REACH >= 2, 'the room around a frame reaches as far as the scaler looks');
  const { room, W, H, top, parts } = scene(4);
  assert.throws(() => enlargeFigure(room, W, H, parts.slice(1), top, 2).part(parts[0]), /not given/);
});
