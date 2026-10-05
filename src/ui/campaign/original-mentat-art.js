// A house's Mentat as the player's own Dune II PC files draw him (formats/dune2-pictures.js 'mentat:<house>'): his
// room cut to where he sits, his eyes, mouth, shoulder and "other" (Cyril's book, Ammon's ring) at the original's
// places. The pictures are enlarged 8 times by a pixel-art scaler (pixel-scale.js: Scale2x three times, which keeps
// the original's own colours and turns its staircases into smooth diagonals) once, when they are made, and the
// figure then fills the portrait at any size (figureSizeCss), drawn down smoothly from that large picture; each
// eye, mouth and book frame is enlarged in place, over the room, so it matches the enlarged head around it.
// He moves as the original moved him (gui/mentat.c, GUI_Mentat_Animation, as OpenDUNE reads it):
//   - his eyes, while he is not speaking, look ahead, to either side and down and now and then shut, on the
//     original's own rules and timings (60 ticks a second), played as a CSS animation of the eye frames;
//   - his book or ring moves through its frames and back, Cyril's every one to three seconds, Ammon's ring
//     glinting every ten to nineteen;
//   - his mouth follows OUR voice: the face engine (mentat-face.js) is given a rig (format v1, mentat-face-rig.js)
//     whose mouth sprites are the original's mouth frames, each of the voice's mouth shapes shown by the frame
//     that fits it best (mouthVisemes), and whose lids are the original's shut eyes, so he blinks with them as he
//     talks; nothing tilts, nods, warps or scales (pixel art does not bend).
// Pure: from a stored picture record to { figure (HTML markup for innerHTML), rig }; original-pictures.js keeps them.
import { RIG_VERSION, EXPRESSIONS, VISEMES } from './mentat-face-rig.js';
import { encodePng, encodeIndexedPng, pngDataUrl } from '../../formats/png.js';
import { MENTATS } from '../../formats/dune2-pictures.js';
import { scaleIndexed, rgbaWords, wordsRgba, REACH } from './pixel-scale.js';

export const SCALE = 4;             // the emblems' whole-pixel enlargement (crisp even where a browser smooths)
export const ENLARGE = 8;           // the Mentat's: Scale2x three times, larger than he is drawn on nearly any screen
export const TICKS = 60;            // the original's interface timer: ticks a second
export const FIGURE_ASPECT = 1.25;  // the figure is cut 4 wide by 5 high where the room allows (the portrait's frame)
const HOUSE_NAMES = { atreides: 'Atreides', harkonnen: 'Harkonnen', ordos: 'Ordos' };
const SEEDS = { atreides: 0x2a17, harkonnen: 0x4b31, ordos: 0x6c53 };

/** The original's random range (Tools_RandomLCG_Range): a whole number in lo..hi from a seeded generator of our own. */
export function rangeRandom(seed) {
  let s = seed >>> 0;
  return (lo, hi) => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return lo + ((s >>> 8) % (hi - lo + 1));
  };
}

/**
 * The eyes while he is not speaking, by the original's rules: [{ frame, from, to }] in ticks over one cycle that
 * starts and ends looking ahead (frame 0). Each change picks 0..7 at random — 6 and 7 look left (1), 5 shuts (4),
 * the rest as they are (0 ahead, 1 left, 2 right, 3 down, 4 shut); a look from one side to the other passes ahead
 * for 1-5 ticks; shutting or opening passes "down" (3) for a tick; then the eyes hold 15-180 ticks (shut: 6-60), and
 * after a passing frame 20-180 (shut: 12-30).
 */
export function eyeSchedule(seed, { ticks = 90 * TICKS } = {}) {
  const R = rangeRandom(seed), out = [];
  let t = 0, s = 0, next = 0;
  const hold = (frame, d) => {
    const last = out[out.length - 1];
    if (last && last.frame === frame) last.to += d; else out.push({ frame, from: t, to: t + d });
    t += d;
  };
  hold(0, R(15, 180));
  while (t < ticks || s !== 0 || next !== 0) {
    if (next) { s = next; next = 0; hold(s, s !== 4 ? R(20, 180) : R(12, 30)); continue; }
    let i = R(0, 7);
    if (i > 5) i = 1; else if (i === 5) i = 4;
    if ((i === 2 && s === 1) || (i === 1 && s === 2)) { next = i; s = 0; hold(0, R(1, 5)); }
    else if (i !== s && (i === 4 || s === 4)) { next = i; s = 3; hold(3, 1); }
    else { s = i; hold(i, i !== 4 ? R(15, 180) : R(6, 60)); }
  }
  return out;
}

/**
 * The book or ring: through its frames and back (0 1 2 3 2 1 0 …), each held as the original holds it — Cyril's
 * 1-3 seconds, Ammon's ring a tenth of a second, and 10-19 seconds between its glints. `real[k]`: frame k draws
 * something; the files fill unused places with 1 x 1 shapes, which leave the frame before on the screen, so the one
 * before is shown through them. [{ frame, from, to }] in ticks over one cycle that starts and ends on frame 0.
 */
export function otherSchedule(house, real, seed = SEEDS[house] ?? 1, { ticks = 90 * TICKS } = {}) {
  const count = real.length;
  if (count < 2 || real.filter(Boolean).length < 2 || (house !== 'atreides' && house !== 'ordos')) return [];
  const R = rangeRandom(seed ^ 0x5bd1), out = [];
  const holdOf = (frame) => (house === 'atreides' ? TICKS * R(1, 3) : frame !== 0 ? 6 : TICKS * R(10, 19));
  let t = 0, k = 0, step = 1, shown = 0;
  do {
    const d = holdOf(k), last = out[out.length - 1];
    if (real[k]) shown = k;
    if (last && last.frame === shown) last.to += d; else out.push({ frame: shown, from: t, to: t + d });
    t += d;
    if (k + step < 0 || k + step >= count) step = -step;
    k += step;
  } while (t < ticks || k !== 0);
  return out;
}

/** A shape that draws something: the files fill unused places with 1 x 1 ones. */
const drawn = (q) => !!q && q.width * q.height > 1;

const luma = (b, o) => b[o] * 0.299 + b[o + 1] * 0.587 + b[o + 2] * 0.114;

/**
 * How open each of the original's mouth frames is: the pixels darker than the shut mouth's (frame 0) at the same
 * place — the lips parted, the mouth's inside — counted, and the box they fill. [{ area, width, height }] per
 * frame (null for a frame that is not there; frame 0 has area 0).
 */
export function measureMouth(frames) {
  const shut = frames[0];
  return frames.map((f, k) => {
    if (!f) return null;
    if (!k || !shut || f.width !== shut.width || f.height !== shut.height) return { area: 0, width: 0, height: 0 };
    let area = 0, x0 = f.width, x1 = -1, y0 = f.height, y1 = -1;
    for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) {
      const o = (y * f.width + x) * 4;
      if (!f.rgba[o + 3]) continue;
      if (luma(f.rgba, o) < luma(shut.rgba, o) - 24) {
        area++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return area ? { area, width: x1 - x0 + 1, height: y1 - y0 + 1 } : { area: 0, width: 0, height: 0 };
  });
}

/**
 * The known files' mouths, chosen by eye where the measure misses them: it counts only what darkens, so lips pushed
 * forward or bright teeth read as less open than they are. Ammon (MENSHPO.SHP, five 64 x 40 frames): 1 lips
 * parted (F V), 2 teeth showing (E, L), 3 wide open (A), 4 lips pursed (O). Cyril's and Radnor's measure right.
 * Taken only for frames of that size, so another copy's frames go by the measure.
 */
export const KNOWN_MOUTHS = { ordos: { size: [64, 40], map: { FV: 1, A: 3, E: 2, O: 4, L: 2 } } };

/**
 * The voice's mouth shapes (VISEMES) to the original's mouth frames (indices; null: the shut mouth of the picture):
 * rest and M B P shut; A the most open frame; F V the least open; of the frames between, O the roundest (tallest
 * for its width), E the widest for its height, L the one nearest halfway between F V and A — each from the frames
 * not yet taken while there are any. Frames that open nothing by the measure are left out (so a frame of pursed lips
 * goes unused unless `known` names it); with none open, every shape is shut. `known` ({ viseme: frame }, as
 * KNOWN_MOUTHS has them) is taken as it is when every frame it names is there.
 */
export function mouthVisemes(frames, known = null) {
  const map = Object.fromEntries(VISEMES.map((v) => [v, null]));
  if (known && Object.values(known).every((k) => k > 0 && frames[k])) return Object.assign(map, known);
  const m = measureMouth(frames);
  const open = m.map((x, k) => (x && x.area > 0 ? { k, ...x } : null)).filter(Boolean);
  if (!open.length) return map;
  // the best by `score` of the frames not in `taken` (of all, when that leaves none); a tie goes to the more open
  const pick = (score, taken = []) => {
    const pool = open.filter((x) => !taken.includes(x.k));
    return (pool.length ? pool : open).reduce((best, x) => {
      const d = score(x) - score(best);
      return d > 1e-9 || (Math.abs(d) <= 1e-9 && x.area > best.area) ? x : best;
    });
  };
  const A = pick((x) => x.area), FV = pick((x) => -x.area, [A.k]);
  const O = pick((x) => x.height / x.width, [A.k, FV.k]);
  const E = pick((x) => x.width / x.height, [A.k, FV.k, O.k]);
  const mid = (A.area + FV.area) / 2;
  const L = pick((x) => -Math.abs(x.area - mid), [A.k, FV.k]);
  Object.assign(map, { FV: FV.k, A: A.k, E: E.k, O: O.k, L: L.k });
  return map;
}

/**
 * Where the figure is cut from the room: [x, y, width, height] — from the left edge to his shoulder or his book
 * (the screen beside him starts at x 128: what reaches into it is his), from the bottom up 5/4 of that width, or
 * the whole height.
 */
export function figureBox(record) {
  const p = record.parts ?? {};
  const parts = [p.shoulder, p.eyes?.[0], p.mouth?.[0], ...(p.other ?? [])].filter(drawn);
  const right = Math.min(record.width, Math.max(128, ...parts.map((q) => q.x + q.width)));
  const top = Math.max(0, record.height - Math.round(right * FIGURE_ASPECT));
  return [0, top, right, record.height - top];
}

/** `src` (rgba w x h, see-through where alpha is 0) drawn over `dst` (dw wide) at [x, y]. */
function blit(dst, dw, dh, src, sw, sh, x, y) {
  for (let r = 0; r < sh; r++) {
    const ty = y + r;
    if (ty < 0 || ty >= dh) continue;
    for (let c = 0; c < sw; c++) {
      const tx = x + c, o = (r * sw + c) * 4;
      if (tx < 0 || tx >= dw || !src[o + 3]) continue;
      dst.set(src.subarray(o, o + 4), (ty * dw + tx) * 4);
    }
  }
}

/** Frames drawn from one corner, each padded (see-through) to the largest's size, so one box holds them all. */
function sameBox(frames) {
  const live = frames.filter(Boolean);
  if (!live.length) return frames;
  const w = Math.max(...live.map((q) => q.width)), h = Math.max(...live.map((q) => q.height));
  return frames.map((q) => {
    if (!q || (q.width === w && q.height === h)) return q;
    const rgba = new Uint8Array(w * h * 4);
    blit(rgba, w, h, q.rgba, q.width, q.height, 0, 0);
    return { ...q, width: w, height: h, rgba };
  });
}

function cut(rgba, width, [x, y, w, h]) {
  const out = new Uint8Array(w * h * 4);
  for (let r = 0; r < h; r++) out.set(rgba.subarray(((y + r) * width + x) * 4, ((y + r) * width + x + w) * 4), r * w * 4);
  return out;
}

/** A PNG data: URL of `rgba`, enlarged SCALE times by whole pixels. */
export async function pictureUrl(rgba, width, height, scale = SCALE) {
  return pngDataUrl(await encodePng(rgba, width, height, { scale }));
}

/**
 * The figure's pictures for the pixel-art scaler (pixel-scale.js), in one palette: the room at rest (W x H RGBA,
 * the figure's top at `top` in the room) and the frames of its parts (eyes, mouth, book; `frames`) as colour
 * indices, index 0 see-through (as a colour word a pixel, 0 see-through, should they hold more than 255 colours).
 * Returns { head: the room enlarged `s` times, part(q, { pad }): frame q enlarged in place, as { values, box },
 * url(values, w, h): a PNG data: URL }; the PNGs are written straight from the indices, so no pixel of the large
 * pictures has its colour looked up.
 *
 * A part's frame is drawn over the room at rest, enlarged there with REACH pixels of the room around it (the
 * scaler's corners look at their neighbours) and cut to its box — the frame's own, `pad` pixels of the figure wider
 * on each side (as far as the figure goes) — see-through wherever it leaves the enlarged room as it was. Laid over
 * the enlarged head at that box ([x, y, w, h] in the figure's pixels) it shows what the whole picture enlarged with
 * this frame in it would, inside the box: a frame changes the enlarged picture up to REACH pixels beyond its own
 * edges, so with `pad` REACH it is that picture everywhere, and with no pad (a box the face's rig fixes, as the
 * mouth's) only inside the frame's box, the few pixels just outside keeping the head's at rest. A frame reaching out
 * of the figure is enlarged alone, in its own box.
 */
export function enlargeFigure(room, W, H, frames, top, s) {
  const colourAt = new Map([[0, 0]]);
  const note = (words) => {
    let last = 0;
    for (const c of words) if (c !== last) { last = c; if (!colourAt.has(c)) colourAt.set(c, colourAt.size); }
    return words;
  };
  const roomWords = note(rgbaWords(room));
  const frameWords = new Map(frames.filter(Boolean).map((q) => [q, note(rgbaWords(q.rgba))]));
  const colours = colourAt.size <= 256 ? Uint32Array.from(colourAt.keys()) : null;
  const values = (words) => {   // the colour words as indices (looked up once a run of one colour)
    if (!colours) return words;
    const out = new Uint8Array(words.length);
    for (let i = 0, last = 0, at = 0; i < words.length; i++) {
      const c = words[i];
      if (c !== last) { last = c; at = colourAt.get(c); }
      out[i] = at;
    }
    return out;
  };
  const rest = values(roomWords), head = scaleIndexed(rest, W, H, s);
  const part = (q, { pad = 0 } = {}) => {
    if (!frameWords.has(q)) throw new Error('enlargeFigure: a frame it was not given');
    const x = q.x, y = q.y - top, w = q.width, h = q.height, own = values(frameWords.get(q));
    if (x < 0 || y < 0 || x + w > W || y + h > H) return { values: scaleIndexed(own, w, h, s), box: [x, y, w, h] };
    const bx = Math.max(0, x - pad), by = Math.max(0, y - pad), bw = Math.min(W, x + w + pad) - bx, bh = Math.min(H, y + h + pad) - by;
    const x0 = Math.max(0, bx - REACH), y0 = Math.max(0, by - REACH);
    const ww = Math.min(W, bx + bw + REACH) - x0, wh = Math.min(H, by + bh + REACH) - y0;
    const win = new rest.constructor(ww * wh);
    for (let r = 0; r < wh; r++) win.set(rest.subarray((y0 + r) * W + x0, (y0 + r) * W + x0 + ww), r * ww);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (own[r * w + c]) win[(y - y0 + r) * ww + x - x0 + c] = own[r * w + c];
    const big = scaleIndexed(win, ww, wh, s);
    const ow = bw * s, oh = bh * s, out = new rest.constructor(ow * oh);   // 0: see-through
    for (let r = 0; r < oh; r++) {
      const from = (r + (by - y0) * s) * ww * s + (bx - x0) * s, at = (by * s + r) * W * s + bx * s;
      for (let c = 0; c < ow; c++) if (big[from + c] !== head[at + c]) out[r * ow + c] = big[from + c];
    }
    return { values: out, box: [bx, by, bw, bh] };
  };
  const url = async (v, w, h) => pngDataUrl(await (colours ? encodeIndexedPng(v, w, h, colours) : encodePng(wordsRgba(v), w, h)));
  return { colours, head, part, url };
}

/** Lets the page through (a frame drawn, a click taken) before the next part of the work: scheduler.yield() where
 *  the browser has it, else a timer. */
export const breathe = () => (typeof globalThis.scheduler?.yield === 'function' ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0)));

const pct = (t, cycle) => (Math.round((t / cycle) * 1e6) / 1e4).toString();

/** CSS keyframes that show `frame` while `schedule` holds it (opacity 1, else 0), stepping, over `cycle` ticks. */
export function frameKeyframes(name, schedule, frame, cycle) {
  const stops = [];
  let on = null;
  for (const seg of schedule) {
    const now = seg.frame === frame;
    if (now !== on) { stops.push(`${pct(seg.from, cycle)}%{opacity:${now ? 1 : 0}}`); on = now; }
  }
  return `@keyframes ${name}{${stops.join('')}}`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const share = (v, of) => `${+((v / of) * 100).toFixed(4)}%`;

/**
 * The figure's size, as CSS for `sel` (its own class) over a W x H picture: it fills the portrait's box as the
 * painting does (as large as fits, centred, standing on the bottom edge) at every size, drawn smoothly from the
 * pictures the scaler enlarged (ENLARGE times: on nearly every screen they are drawn down, never blown up much), so
 * he is never shrunk to a whole number of pixels a pixel and stays crisp.
 */
export function figureSizeCss(sel, W, H) {
  return `${sel} .cpo-frame{position:absolute;left:50%;bottom:0;transform:translateX(-50%);`
    + `width:min(100cqw,${+((W / H) * 100).toFixed(4)}cqh);height:min(${+((H / W) * 100).toFixed(4)}cqw,100cqh)}`
    + `${sel} img,${sel} image{image-rendering:auto}`;
}

/**
 * The house's original Mentat from his stored record: { figure, rig, info } — `figure` markup for the portrait, on
 * the HTML portrait's contract the face engine takes (portraits.js mentatSvg of the face-art step): the root
 * `.cp-mentat-art` (a size container) holding the frame, which holds `.cpm-sway` with the head <img> first, the book
 * or ring (`.cpo-other`) and the eyes (`.cpm-blink`), each placed in % of the frame; `rig` the face's rig (null when
 * the files hold no open mouth frame), `info` what was used (for tests and the debug hooks). The work is done in
 * steps, `pause()` awaited between them (by default breathe(): the page drawn and its input taken in between).
 */
export async function buildMentatArt(record, { scale = ENLARGE, pause = breathe } = {}) {
  const house = record.house, m = MENTATS[house];
  if (!m) throw new Error(`no Mentat for "${house}"`);
  const parts = record.parts ?? {}, eyes = parts.eyes ?? [], other = parts.other ?? [];
  const mouth = sameBox(parts.mouth ?? []);
  const box = figureBox(record), [, top, W, H] = box;
  // the head: the room with what the original draws over it at rest (eyes ahead, mouth shut, the book's first
  // frame, the shoulder in front of the screen), enlarged by the pixel-art scaler; every other frame of a part
  // enlarged in place over it (enlargeFigure), so it lines up with the head pixel for pixel — the eyes and the book
  // in a box REACH pixels wider, all the frame changes; the mouth in its own box, the one the face's rig draws it in
  const room = cut(record.rgba, record.width, box);
  for (const q of [eyes[0], mouth[0], other[0], parts.shoulder]) if (drawn(q)) blit(room, W, H, q.rgba, q.width, q.height, q.x, q.y - top);
  const fig = enlargeFigure(room, W, H, [...eyes, ...mouth, ...other], top, scale);
  await pause();
  const head = await fig.url(fig.head, W * scale, H * scale);
  // the frames a few at a time, the page let through between them (one long task would hold the menu still)
  const enlarged = async (frames, pad, want) => {
    await pause();
    return Promise.all(frames.map((q, k) => {
      if (!want(q, k)) return null;
      const { values, box: b } = fig.part(q, { pad });
      return fig.url(values, b[2] * scale, b[3] * scale).then((src) => ({ src, box: b }));
    }));
  };
  const eyeArt = await enlarged(eyes, REACH, (q, k) => q && k);
  const mouthUrls = (await enlarged(mouth, 0, (q, k) => q && k)).map((a) => a?.src ?? null);
  const otherArt = await enlarged(other, REACH, (q, k) => k && drawn(q));
  const at = (q) => [q.x, q.y - top, q.width, q.height];

  // the eyes and the book on the original's schedules, as CSS animations of their frames over the head
  const cls = `cpo-${house}`, seed = SEEDS[house] ?? 1;
  const eyeSched = eyes[0] ? eyeSchedule(seed) : [], eyeCycle = eyeSched.at(-1)?.to ?? 1;
  const otherSched = otherSchedule(house, other.map(drawn), seed), otherCycle = otherSched.at(-1)?.to ?? 1;
  const css = [], eyeImgs = [], otherImgs = [];
  const img = (src, b, extra = '') => `<img class="cpo-l${extra}" src="${src}" alt="" draggable="false" style="left:${share(b[0], W)};top:${share(b[1], H)};width:${share(b[2], W)};height:${share(b[3], H)}">`;
  eyeArt.forEach((a, k) => {
    if (!a || !eyeSched.some((s) => s.frame === k)) return;
    const name = `${cls}-eye${k}`;
    css.push(frameKeyframes(name, eyeSched, k, eyeCycle), `.${name}{opacity:0;animation:${name} ${(eyeCycle / TICKS).toFixed(3)}s step-end infinite}`);
    eyeImgs.push(img(a.src, a.box, ` cpo-anim ${name}`));
  });
  otherArt.forEach((a, k) => {
    if (!a || !otherSched.some((s) => s.frame === k)) return;
    const name = `${cls}-other${k}`;
    css.push(frameKeyframes(name, otherSched, k, otherCycle), `.${name}{opacity:0;animation:${name} ${(otherCycle / TICKS).toFixed(3)}s step-end infinite}`);
    otherImgs.push(img(a.src, a.box, ` cpo-anim ${name}`));
  });
  const label = `${record.mentat ?? m.name}, Mentat of House ${HOUSE_NAMES[house]}, from your copy of the original game`;
  // the boxes fill the frame and stay still (a painting's rules for the same classes, global in an older
  // portraits.js, do nothing here); the pictures are placed in % of the frame
  const sel = `.${cls}`;
  const style = `<style>${sel} .cpm-sway,${sel} .cpo-other,${sel} .cpm-blink{position:absolute;inset:0;animation:none;opacity:1;transform:none}`
    + `${sel} .cpo-l{position:absolute;display:block;max-width:none;margin:0;user-select:none;-webkit-user-drag:none}`
    + `${figureSizeCss(sel, W, H)}${css.join('')}@media (prefers-reduced-motion:reduce){.cpo .cpo-anim{animation:none;opacity:0}}</style>`;
  const figure = `<div class="cp-mentat-art cpo ${cls}" role="img" aria-label="${esc(label)}" style="filter:none;position:relative;overflow:hidden;container-type:size">${style}`
    + `<div class="cpm-frame cpo-frame"><div class="cpm-sway">${img(head, [0, 0, W, H])}<div class="cpo-other">${otherImgs.join('')}</div>`
    + `<div class="cpm-blink">${eyeImgs.join('')}</div></div></div></div>`;

  // the face's rig: the mouth frames for the voice's shapes, the shut eyes for its blinks
  const known = KNOWN_MOUTHS[house];
  const asKnown = known && mouth.length === 5 && mouth.every((q) => q && q.width === known.size[0] && q.height === known.size[1]);
  const visemes = mouthVisemes(mouth, asKnown ? known.map : null);
  const sprites = Object.fromEntries(VISEMES.map((v) => [v, visemes[v] === null ? null : mouthUrls[visemes[v]]]));
  let rig = null;
  if (mouth[0] && VISEMES.some((v) => sprites[v])) {
    const mb = at(mouth[0]);
    rig = {
      v: RIG_VERSION, house, name: record.mentat ?? m.name, frame: [W, H], original: true,
      head: { src: head, box: [0, 0, W, H], pivot: [W / 2, H] },
      mouth: { box: mb, hinge: mb[1] + mb[3] / 2, sprites, open: Object.fromEntries(VISEMES.map((v) => [v, 0])), jaw: [1, 1] },
      expressions: Object.fromEntries(EXPRESSIONS.map((e) => [e, {}])),
      motion: { mouthEase: 0.035, speakNod: 0, swayTilt: 0, swayNod: 0, flash: 0, blink: { min: 1.6, max: 4.4, double: 0.08, close: 0.02, hold: 0.22, open: 0.03, seed } },
    };
    if (eyes[4] && eyeArt[4]) {   // the shut eyes' picture in its wider box; each eye shown in its half of the frame's
      const [ex, ey, ew, eh] = at(eyes[4]), half = ew / 2;
      rig.lids = { src: eyeArt[4].src, box: eyeArt[4].box, soft: 0,
        left: { box: [ex, ey, half, eh], open: [ey, ey + eh] }, right: { box: [ex + half, ey, half, eh], open: [ey, ey + eh] } };
    }
  }
  return { figure, rig, info: { box, scale, visemes, eyeCycle, otherCycle, frames: { eyes: eyes.filter(drawn).length, mouth: mouth.filter(drawn).length, other: other.filter(drawn).length } } };
}

/**
 * The black of the screen around a picture made see-through: every pure black pixel reached from the edges through
 * pure black ones (black inside the picture stays), then the picture trimmed to what is left. Returns { rgba,
 * width, height }.
 */
export function clearSurround(rgba, width, height) {
  const out = rgba.slice(), seen = new Uint8Array(width * height), stack = [];
  const black = (i) => out[i * 4] === 0 && out[i * 4 + 1] === 0 && out[i * 4 + 2] === 0;
  const push = (x, y) => { const i = y * width + x; if (!seen[i] && black(i)) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % width, y = (i - x) / width;
    out[i * 4 + 3] = 0;
    if (x > 0) push(x - 1, y); if (x + 1 < width) push(x + 1, y); if (y > 0) push(x, y - 1); if (y + 1 < height) push(x, y + 1);
  }
  let x0 = width, x1 = -1, y0 = height, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!out[(y * width + x) * 4 + 3]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { rgba: out, width, height };
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  return { rgba: cut(out, width, [x0, y0, w, h]), width: w, height: h };
}

/**
 * A house emblem (formats/dune2-pictures.js 'emblem:<house>': the original's house selection piece — the banner,
 * its chains and its name plate) as SVG markup for the house selection's crest box, the screen's black around it
 * see-through. The piece names the house itself, so the card's own name plate steps aside while it is shown.
 */
export async function buildEmblemArt(record, { scale = SCALE } = {}) {
  const { rgba, width, height } = clearSurround(record.rgba, record.width, record.height);
  const src = await pictureUrl(rgba, width, height, scale);
  const label = `The emblem of House ${HOUSE_NAMES[record.house] ?? record.house}, from your copy of the original game`;
  return `<svg class="cp-crest-art cpo-emblem" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}">`
    + '<style>.cp-house:has(.cpo-emblem) .cp-plaque{display:none}</style>'
    + `<image href="${src}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" image-rendering="optimizeSpeed" style="image-rendering:pixelated"/></svg>`;
}
