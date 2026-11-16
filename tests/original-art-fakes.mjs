// Made-up Dune II picture files for the tests (no game data): writers for the formats the readers take — Format80
// and Format40 packing, CPS, SHP (1.07 and 1.0), WSA (1.07 and 1.0), PAL and PAK — and a made-up Mentat room with
// his shapes at the original's places, drawn here from rectangles and ellipses in a palette of our own.
import { MENTATS, HERALD } from '../src/formats/dune2-pictures.js';

const u16 = (n) => [n & 255, (n >> 8) & 255];
const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/**
 * Format80-packs `bytes`, using every command: fills, short repeats from close behind, short and long repeats from
 * a position, literal runs; the end mark last. (A greedy packer: good enough for tests, not for size.)
 */
export function packFormat80(bytes, { end = true } = {}) {
  const b = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  const out = [], lit = [], heads = new Map();
  const flush = () => { while (lit.length) { const n = Math.min(63, lit.length); out.push(0x80 | n, ...lit.splice(0, n)); } };
  const key = (i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const remember = (i) => {
    if (i + 2 >= b.length) return;
    const k = key(i), list = heads.get(k) ?? [];
    list.push(i);
    if (list.length > 24) list.shift();
    heads.set(k, list);
  };
  let i = 0;
  while (i < b.length) {
    let run = 1;
    while (i + run < b.length && b[i + run] === b[i] && run < 0xffff) run++;
    let best = 0, from = -1;
    if (i + 2 < b.length) {
      for (const j of heads.get(key(i)) ?? []) {
        let L = 0;
        while (i + L < b.length && b[j + L] === b[i + L] && L < 0xffff) L++;
        if (L > best || (L === best && j > from)) { best = L; from = j; }
      }
    }
    if (run >= 4 && run >= best) {
      flush();
      out.push(0xfe, ...u16(run), b[i]);
      for (let k = 0; k < run; k++) remember(i + k);
      i += run;
    } else if (best >= 3) {
      flush();
      const back = i - from;
      if (back <= 4095 && best <= 10) out.push(((best - 3) << 4) | (back >> 8), back & 255);
      else if (best <= 64) out.push(0xc0 | (best - 3), ...u16(from));
      else out.push(0xff, ...u16(best), ...u16(from));
      for (let k = 0; k < best; k++) remember(i + k);
      i += best;
    } else {
      lit.push(b[i]);
      remember(i);
      i++;
    }
  }
  flush();
  if (end) out.push(0x80);
  return Uint8Array.from(out);
}

/** The Format40 change from `prev` to `next` (same length): skips, XOR runs of one value, XOR strings; the end mark. */
export function packFormat40(prev, next) {
  const out = [], n = next.length;
  const x = (k) => prev[k] ^ next[k];
  let i = 0;
  while (i < n) {
    let same = 0;
    while (i + same < n && x(i + same) === 0) same++;
    if (same) {
      if (i + same === n) break;   // the rest stays: nothing to say
      let left = same;
      while (left > 0) {
        const k = Math.min(left, 0x7fff);
        if (k <= 127) out.push(0x80 | k); else out.push(0x80, ...u16(k));
        left -= k;
      }
      i += same;
      continue;
    }
    let run = 1;
    while (i + run < n && x(i + run) === x(i) && x(i) !== 0 && run < 0x3fff) run++;
    if (run >= 3) {
      if (run <= 255) out.push(0, run, x(i)); else out.push(0x80, ...u16(0xc000 | run), x(i));
      i += run;
      continue;
    }
    let len = 0;
    while (i + len < n && x(i + len) !== 0 && len < 0x3fff) {
      if (i + len + 2 < n && x(i + len) === x(i + len + 1) && x(i + len) === x(i + len + 2)) break;   // a run comes
      len++;
    }
    len = Math.max(1, len);
    if (len <= 127) out.push(len); else out.push(0x80, ...u16(0x8000 | len));
    for (let k = 0; k < len; k++) out.push(x(i + k));
    i += len;
  }
  out.push(0x80, 0, 0);
  return Uint8Array.from(out);
}

/** A 6-bit palette (768 values 0..63) of our own: a ramp of greys, sand, blues, greens, reds and skin. */
export function fakePalette6() {
  const p = new Uint8Array(768);
  for (let i = 0; i < 256; i++) {
    const t = (i % 32) / 31, band = i >> 5;
    const rgb = [
      [t, t, t], [t, t * 0.8, t * 0.5], [t * 0.3, t * 0.5, t], [t * 0.3, t, t * 0.4],
      [t, t * 0.25, t * 0.2], [t, t * 0.75, t * 0.6], [t * 0.7, t * 0.4, t], [t, t, t * 0.3],
    ][band];
    for (let c = 0; c < 3; c++) p[i * 3 + c] = Math.round(rgb[c] * 63);
  }
  return p;
}

export const palFile = (p6 = fakePalette6()) => Uint8Array.from(p6);

/** A CPS file of `pixels` (320 wide): Format80-packed (packing 4) or not (0), with a 6-bit palette or none. */
export function cpsFile(pixels, { packing = 4, palette = null, sizeWord = null } = {}) {
  const data = packing === 4 ? packFormat80(pixels) : Uint8Array.from(pixels);
  const pal = palette ? Uint8Array.from(palette) : new Uint8Array(0);
  const body = [...u16(packing), ...u32(pixels.length), ...u16(pal.length), ...pal, ...data];
  return Uint8Array.from([...u16(sizeWord ?? body.length), ...body]);
}

/** The "0 n for n see-through pixels, else the pixel" rows of a shape (`indices`, 0 see-through). */
export function runShape({ width, height, indices }) {
  const out = [];
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const v = indices[y * width + x];
      if (v === 0) {
        let n = 0;
        while (x + n < width && indices[y * width + x + n] === 0 && n < 255) n++;
        out.push(0, n);
        x += n;
      } else { out.push(v); x++; }
    }
  }
  return Uint8Array.from(out);
}

/**
 * A shape file of `shapes` ([{ width, height, indices (0 see-through), table? } | null]): `version` '1.07' (32-bit
 * offsets from byte 2) or '1.0' (16-bit from the start); `packed` Format80 or plain pixels (flag 2).
 */
export function shpFile(shapes, { version = '1.07', packed = true } = {}) {
  const blobs = shapes.map((s) => {
    if (!s) return null;
    const stream = runShape(s), data = packed ? packFormat80(stream) : stream, table = s.table ? Uint8Array.from(s.table) : new Uint8Array(0);
    const flags = (s.table ? 1 : 0) | (packed ? 0 : 2), size = 10 + table.length + data.length;
    return Uint8Array.from([...u16(flags), s.height, ...u16(s.width), s.height, ...u16(size), ...u16(stream.length), ...table, ...data]);
  });
  const count = shapes.length, wide = version !== '1.0';
  const head = 2 + (wide ? 4 : 2) * (count + 1);
  const out = [...u16(count)];
  let at = head;
  const starts = blobs.map((blob) => { if (!blob) return 0; const s = at; at += blob.length; return s; });
  for (const s of [...starts, at]) out.push(...(wide ? u32(s ? s - 2 : 0) : u16(s)));
  for (const blob of blobs) if (blob) out.push(...blob);
  return Uint8Array.from(out);
}

/** A WSA animation of `frames` (Uint8Arrays of width x height indices); `loop` adds the change back to the first. */
export function wsaFile(frames, { width, height, palette = null, loop = false, version = '1.07' } = {}) {
  const zero = new Uint8Array(width * height);
  const steps = frames.map((f, i) => packFormat40(i ? frames[i - 1] : zero, f));
  if (loop) steps.push(packFormat40(frames[frames.length - 1], frames[0]));
  const datas = steps.map((d) => packFormat80(d));
  const newer = version !== '1.0', head = newer ? 10 : 8, count = frames.length;
  const pal = palette ? Uint8Array.from(palette) : new Uint8Array(0);
  const offsets = [];
  let at = head + 4 * (count + 2);
  for (const d of datas) { offsets.push(at); at += d.length; }
  offsets.push(at);
  if (!loop) offsets.push(0);
  const buffer = Math.max(...steps.map((s) => s.length)) + 64;
  return Uint8Array.from([...u16(count), ...u16(width), ...u16(height), ...u16(buffer), ...(newer ? u16(palette ? 1 : 0) : []),
    ...offsets.flatMap(u32), ...pal, ...datas.flatMap((d) => [...d])]);
}

/** A version-2 PAK archive of [[name, bytes]]. */
export function pakFile(entries) {
  const index = entries.reduce((s, [name]) => s + 4 + name.length + 1, 0) + 4;
  const out = [];
  let at = index;
  for (const [name, data] of entries) { out.push(...u32(at), ...ascii(name), 0); at += data.length; }
  out.push(0, 0, 0, 0);
  for (const [, data] of entries) out.push(...data);
  return Uint8Array.from(out);
}

// ——— a made-up Mentat (shapes of our own at the original's places) ———

const SAND = 32, BLUE = 64, GREEN = 96, RED = 128, SKIN = 160, GOLD = 224;   // palette bands of fakePalette6
const HOUSE_TONE = { atreides: BLUE, harkonnen: RED, ordos: GREEN };

function canvas(width, height, fill = 0) {
  const px = new Uint8Array(width * height).fill(fill);
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < width && y < height) px[y * width + x] = v; };
  return {
    px, set,
    rect(x, y, w, h, v) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, v); },
    ellipse(cx, cy, rx, ry, v) { for (let j = Math.floor(cy - ry); j <= cy + ry; j++) for (let i = Math.floor(cx - rx); i <= cx + rx; i++) if (((i - cx) / rx) ** 2 + ((j - cy) / ry) ** 2 <= 1) set(i, j, v); },
  };
}

export const EYES = [24, 8], MOUTH = [24, 10];

/** The room: a wall in the house's tone, the Mentat's robe and head under his parts' places. */
export function fakeRoom(house) {
  const m = MENTATS[house], tone = HOUSE_TONE[house], c = canvas(320, 200, tone + 6);
  for (let y = 0; y < 200; y += 8) c.rect(0, y, 320, 1, tone + 10);   // wall courses
  c.rect(128, 48, 184, 112, 0);                                       // the screen beside him
  c.rect(8, 21, 304, 14, SAND + 20);                                  // the words' strip
  const [ex, ey] = m.eyes, cx = ex + EYES[0] / 2;
  c.ellipse(cx + 8, 200, 70, 70, tone + 18);                          // robe
  c.ellipse(cx, ey + 12, 22, 30, SKIN + 22);                          // head
  c.rect(ex, ey, EYES[0], EYES[1], SKIN + 22);
  return c.px;
}

/** His 15 shapes: eyes (ahead, left, right, down, shut), mouth (shut, then wider), shoulder, the "other". */
export function fakeShapes(house) {
  const eyes = [0, 1, 2, 3, 4].map((k) => {
    const c = canvas(...EYES, SKIN + 22);
    for (const x0 of [2, 14]) {
      if (k === 4) { c.rect(x0, 4, 8, 1, SKIN + 8); continue; }
      c.rect(x0, 2, 8, 4, 31);                                         // whites
      const px = x0 + 3 + (k === 1 ? -2 : k === 2 ? 2 : 0), py = k === 3 ? 4 : 3;
      c.rect(px, py, 2, 2, 2);                                         // pupils
      if (k === 3) c.rect(x0, 2, 8, 2, SKIN + 12);                     // lids down
    }
    return { width: EYES[0], height: EYES[1], indices: c.px };
  });
  // the mouth: shut (a line of lip), then dark openings [width, height]: a slit, a round O, wide open, wide and low
  const mouth = [null, [10, 1], [6, 5], [12, 7], [18, 3]].map((open) => {
    const c = canvas(...MOUTH, SKIN + 22);
    if (!open) c.rect(6, 5, 12, 1, RED + 16);
    else c.rect((MOUTH[0] - open[0]) >> 1, 5 - (open[1] >> 1), open[0], open[1], 1);
    return { width: MOUTH[0], height: MOUTH[1], indices: c.px };
  });
  const tone = HOUSE_TONE[house];
  const sh = canvas(24, 40, 0);
  sh.ellipse(4, 30, 18, 26, tone + 18);
  const other = [0, 1, 2, 3].map((k) => {
    const c = canvas(16, 12, 0);
    c.rect(1, 2, 14, 9, GOLD + 10 + k * 4);
    c.rect(2 + k * 3, 3, 2, 7, GOLD + 28);
    return { width: 16, height: 12, indices: c.px };
  });
  return [...eyes, ...mouth, { width: 24, height: 40, indices: sh.px }, ...other];
}

/** The house selection screen: three framed emblems in their boxes. */
export function fakeHerald() {
  const c = canvas(320, 200, SAND + 4);
  for (const [house, [x, y, w, h]] of Object.entries(HERALD)) {
    c.rect(x, y, w, h, GOLD + 20);
    c.rect(x + 4, y + 4, w - 8, h - 8, HOUSE_TONE[house] + 12);
    c.ellipse(x + w / 2, y + h / 2 - 6, 26, 30, GOLD + 26);
  }
  return c.px;
}

/** A PAK with everything the pictures are made of (as DUNE.PAK has it), made up; `skip` leaves files out. */
export function fakeDunePak({ skip = [], version = '1.07', herald = 'HERALD.ENG' } = {}) {
  const entries = [['IBM.PAL', palFile()], [herald, cpsFile(fakeHerald())]];
  for (const [house, m] of Object.entries(MENTATS)) {
    entries.push([`MENTAT${m.letter}.CPS`, cpsFile(fakeRoom(house))], [`MENSHP${m.letter}.SHP`, shpFile(fakeShapes(house), { version })]);
  }
  entries.push(['SCREEN.CPS', cpsFile(new Uint8Array(64000))]);   // a picture the game does not show
  return pakFile(entries.filter(([n]) => !skip.includes(n)));
}

// ——— a made-up Mentat as detailed as the PC files' and as large (tests/picture-work.test.mjs, scripts/mentat-longtasks.mjs) ———

/** Value noise in 0..1, cells `cell` pixels wide. */
function noise(w, h, seed, cell) {
  const r = rng(seed), gw = Math.ceil(w / cell) + 2, g = Float32Array.from({ length: gw * (Math.ceil(h / cell) + 2) }, r);
  return (x, y) => {
    const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, i = y0 * gw + x0;
    return (g[i] * (1 - tx) + g[i + 1] * tx) * (1 - ty) + (g[i + gw] * (1 - tx) + g[i + gw + 1] * tx) * ty;
  };
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** A shade of fakePalette6 band `band` (32 shades a band), ordered-dithered as VGA art is; never index 0. */
const shade = (band, v, x, y) => band * 32 + Math.max(1, Math.min(31, Math.floor(v * 30 + BAYER[(y & 3) * 4 + (x & 3)] / 16)));
function painter(w, h, seed) {
  const a = noise(w, h, seed, 23), b = noise(w, h, seed + 1, 7), c = noise(w, h, seed + 2, 2);
  return (x, y) => 0.55 * a(x, y) + 0.3 * b(x, y) + 0.15 * c(x, y);
}
const BAND = { atreides: 2, harkonnen: 4, ordos: 3 }, SKIN_BAND = 5, GOLD_BAND = 7, SAND_BAND = 1;

/** The PC files' part sizes (notes 2026-10-05-original-art.md): eyes, mouth, shoulder, the "other" (Cyril's book
 *  twice and two 1 x 1 fillers, four 1 x 1 fillers for Radnor, Ammon's ring four times). */
export const REAL_SIZES = {
  atreides: { eyes: [48, 16], mouth: [48, 40], shoulder: [24, 32], other: [[96, 48], [96, 48], [1, 1], [1, 1]] },
  harkonnen: { eyes: [48, 24], mouth: [56, 40], shoulder: [16, 56], other: [[1, 1], [1, 1], [1, 1], [1, 1]] },
  ordos: { eyes: [56, 16], mouth: [64, 40], shoulder: [24, 32], other: [[16, 16], [16, 16], [16, 16], [16, 16]] },
};

/** A 320 x 200 room in dithered shades: the wall, the words' strip, the black screen beside him, his robe and head. */
export function detailedRoom(house, seed = 150) {
  const m = MENTATS[house], tone = BAND[house], v = painter(320, 200, seed), px = new Uint8Array(320 * 200);
  const s = REAL_SIZES[house], cx = m.eyes[0] + s.eyes[0] / 2, cy = m.eyes[1] + 10;
  for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) {
    if (x >= 128 && x < 312 && y >= 48 && y < 160) continue;   // the screen beside him: black
    let band = tone;
    if (y >= 21 && y < 35 && x >= 8 && x < 312) band = SAND_BAND;
    if (((x - cx - 8) / 78) ** 2 + ((y - 205) / 85) ** 2 <= 1) band = (tone + 4) % 8;   // robe
    if (((x - cx) / 30) ** 2 + ((y - cy) / 40) ** 2 <= 1) band = SKIN_BAND;            // head
    px[y * 320 + x] = shade(band, v(x, y), x, y);
  }
  return px;
}

/** A dithered shape of `w` x `h` in `band`; see-through (index 0) where `inside(x, y)` is false; `mark` paints over. */
function detailedShape(w, h, band, seed, inside = () => true, mark = () => null) {
  const v = painter(w, h, seed), indices = new Uint8Array(w * h);
  if (w * h > 1) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x, y)) indices[y * w + x] = mark(x, y) ?? shade(band, v(x, y), x, y);
  return { width: w, height: h, indices };
}

/** His 15 shapes at the PC files' sizes: eyes (ahead, left, right, down, shut), mouth (shut, then open), shoulder,
 *  the "other"; the shoulder, book and ring see-through around their edges. */
export function detailedShapes(house, seed = 200) {
  const s = REAL_SIZES[house], [ew, eh] = s.eyes, [mw, mh] = s.mouth;
  const eyes = [0, 1, 2, 3, 4].map((k) => detailedShape(ew, eh, SKIN_BAND, seed + k, undefined, (x, y) => {
    const lx = x % (ew / 2), ly = y - (eh >> 1);
    if (k === 4) return Math.abs(ly) < 1 && lx > 4 && lx < ew / 2 - 4 ? 4 * 32 + 8 : null;   // shut: a line of lid
    if (lx < 5 || lx > ew / 2 - 5 || Math.abs(ly) > eh / 4) return null;
    const pupil = ew / 4 + (k === 1 ? -4 : k === 2 ? 4 : 0), down = k === 3 ? 2 : 0;
    return Math.abs(lx - pupil) < 3 && Math.abs(ly - down) < 3 ? 2 : 31;            // pupil, white
  }));
  const opens = [null, [mw / 5, 2], [mw / 6, mh / 4], [mw / 3, mh / 3], [mw / 2, mh / 6]];
  const mouth = opens.map((o, k) => detailedShape(mw, mh, SKIN_BAND, seed + 10 + k, undefined, (x, y) => {
    const dx = Math.abs(x - mw / 2), dy = Math.abs(y - mh / 2);
    if (!o) return dx < mw / 4 && dy < 1 ? 4 * 32 + 16 : null;                         // shut: a line of lip
    return dx < o[0] / 2 && dy < o[1] / 2 ? 1 : null;                                    // the mouth's dark inside
  }));
  const [sw, sh] = s.shoulder;
  const shoulder = detailedShape(sw, sh, (BAND[house] + 4) % 8, seed + 20, (x, y) => ((x - sw * 0.2) / sw) ** 2 + ((y - sh) / sh) ** 2 <= 1);
  const other = s.other.map(([w, h], k) => detailedShape(w, h, GOLD_BAND, seed + 30 + k,
    (x, y) => (w > 20 ? x > 2 && y > 3 + k * 2 && x < w - 2 : ((x - w / 2 + 0.5) / (w / 2)) ** 2 + ((y - h / 2 + 0.5) / (h / 2)) ** 2 <= 1),
    (x, y) => (w > 20 && y % 6 === 0 && x > 8 && x < w - 8 ? 28 : w <= 20 && x === 4 + k * 2 && y < h / 2 ? 31 : null)));
  return [...eyes, ...mouth, shoulder, ...other];
}

/** The house selection screen in dithered shades: each emblem a shield in its house's band with a gold rim, the
 *  screen's black around it in its box (as the PC screen has it, for clearSurround to take away). */
export function detailedHerald(seed = 90) {
  const v = painter(320, 200, seed), px = new Uint8Array(320 * 200);
  for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) px[y * 320 + x] = shade(SAND_BAND, v(x, y), x, y);
  for (const [house, [bx, by, w, h]] of Object.entries(HERALD)) {
    for (let y = by; y < by + h; y++) for (let x = bx; x < bx + w; x++) {
      const dx = (x - bx - w / 2) / (w / 2 - 6), dy = (y - by - h / 2 + 4) / (h / 2 - 8);
      const r = dx * dx + (dy > 0 ? dy * dy * 1.6 : dy * dy * 0.3);   // a shield: square-ish above, pointed below
      px[y * 320 + x] = r > 1 ? 0 : r > 0.8 ? shade(GOLD_BAND, v(x, y), x, y) : shade(BAND[house], v(x, y), x, y);
    }
  }
  return px;
}

/** A DUNE.PAK whose Mentats and emblems are as detailed and as large as the PC files'. */
export function detailedDunePak() {
  const entries = [['IBM.PAL', palFile()], ['HERALD.ENG', cpsFile(detailedHerald())]];
  let seed = 100;
  for (const [house, m] of Object.entries(MENTATS)) {
    entries.push([`MENTAT${m.letter}.CPS`, cpsFile(detailedRoom(house, (seed += 50)))], [`MENSHP${m.letter}.SHP`, shpFile(detailedShapes(house, (seed += 50)))]);
  }
  return pakFile(entries);
}
