// A house's Mentat as the player's own Dune II PC files draw him (formats/dune2-pictures.js 'mentat:<house>'): his
// room cut to where he sits, his eyes, mouth, shoulder and "other" (Cyril's book, Ammon's ring) at the original's
// places, the picture enlarged by whole pixels and shown without smoothing, so it stays the original's pixel art.
// He moves as the original moved him (gui/mentat.c, GUI_Mentat_Animation, as OpenDUNE reads it):
//   - his eyes, while he is not speaking, look ahead, to either side and down and now and then shut, on the
//     original's own rules and timings (60 ticks a second), played as a CSS animation of the eye frames;
//   - his book or ring moves through its frames and back, Cyril's every one to three seconds, Ammon's ring
//     glinting every ten to nineteen;
//   - his mouth follows OUR voice: the face engine (mentat-face.js) is given a rig (format v1, mentat-face-rig.js)
//     whose mouth sprites are the original's mouth frames, each of the voice's mouth shapes shown by the frame
//     that fits it best (mouthVisemes), and whose lids are the original's shut eyes, so he blinks with them as he
//     talks; nothing tilts, nods, warps or scales (pixel art does not bend).
// Pure: from a stored picture record to { figure (SVG markup for innerHTML), rig }; original-pictures.js keeps them.
import { RIG_VERSION, EXPRESSIONS, VISEMES } from './mentat-face-rig.js';
import { encodePng, pngDataUrl } from '../../formats/png.js';
import { MENTATS } from '../../formats/dune2-pictures.js';

export const SCALE = 4;             // the pictures' whole-pixel enlargement (crisp even where a browser smooths)
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
 * The voice's mouth shapes (VISEMES) to the original's mouth frames (indices; null: the shut mouth of the picture):
 * rest and M B P shut; A the most open frame; F V the least open; of the frames between, O the roundest (tallest
 * for its width), E the widest for its height, L the one nearest halfway between F V and A — each from the frames
 * not yet taken while there are any, so the four open frames are all used. Frames that open nothing are left out;
 * with none open, every shape is shut.
 */
export function mouthVisemes(frames) {
  const m = measureMouth(frames);
  const open = m.map((x, k) => (x && x.area > 0 ? { k, ...x } : null)).filter(Boolean);
  const map = Object.fromEntries(VISEMES.map((v) => [v, null]));
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

/**
 * The house's original Mentat from his stored record: { figure, rig, info } — `figure` SVG markup for the
 * portrait (as portraits.js mentatSvg: a `.cpm-sway` group holding the head <image> and a `.cpm-blink` group, so
 * the face engine can take it), `rig` the face's rig (null when the files hold no open mouth frame), `info` what
 * was used (for tests and the debug hooks).
 */
export async function buildMentatArt(record, { scale = SCALE } = {}) {
  const house = record.house, m = MENTATS[house];
  if (!m) throw new Error(`no Mentat for "${house}"`);
  const parts = record.parts ?? {}, eyes = parts.eyes ?? [], other = parts.other ?? [];
  const mouth = sameBox(parts.mouth ?? []);
  const box = figureBox(record), [, top, W, H] = box;
  // the head: the room with what the original draws over it at rest (eyes ahead, mouth shut, the book's first
  // frame, the shoulder in front of the screen)
  const room = cut(record.rgba, record.width, box);
  for (const q of [eyes[0], mouth[0], other[0], parts.shoulder]) if (drawn(q)) blit(room, W, H, q.rgba, q.width, q.height, q.x, q.y - top);
  const url = (q) => pictureUrl(q.rgba, q.width, q.height, scale);
  const head = await pictureUrl(room, W, H, scale);
  const eyeUrls = await Promise.all(eyes.map((q, k) => (q && k ? url(q) : null)));
  const mouthUrls = await Promise.all(mouth.map((q, k) => (q && k ? url(q) : null)));
  const otherUrls = await Promise.all(other.map((q, k) => (k && drawn(q) ? url(q) : null)));
  const at = (q) => [q.x, q.y - top, q.width, q.height];

  // the eyes and the book on the original's schedules, as CSS animations of their frames over the head
  const cls = `cpo-${house}`, seed = SEEDS[house] ?? 1;
  const eyeSched = eyes[0] ? eyeSchedule(seed) : [], eyeCycle = eyeSched.at(-1)?.to ?? 1;
  const otherSched = otherSchedule(house, other.map(drawn), seed), otherCycle = otherSched.at(-1)?.to ?? 1;
  const css = [], eyeImgs = [], otherImgs = [];
  const img = (href, b, extra = '') => `<image href="${href}" x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" preserveAspectRatio="none" image-rendering="optimizeSpeed"${extra}/>`;
  eyeUrls.forEach((u, k) => {
    if (!u || !eyeSched.some((s) => s.frame === k)) return;
    const name = `${cls}-eye${k}`;
    css.push(frameKeyframes(name, eyeSched, k, eyeCycle), `.${name}{opacity:0;animation:${name} ${(eyeCycle / TICKS).toFixed(3)}s step-end infinite}`);
    eyeImgs.push(img(u, at(eyes[k]), ` class="cpo-anim ${name}"`));
  });
  otherUrls.forEach((u, k) => {
    if (!u || !otherSched.some((s) => s.frame === k)) return;
    const name = `${cls}-other${k}`;
    css.push(frameKeyframes(name, otherSched, k, otherCycle), `.${name}{opacity:0;animation:${name} ${(otherCycle / TICKS).toFixed(3)}s step-end infinite}`);
    otherImgs.push(img(u, at(other[k]), ` class="cpo-anim ${name}"`));
  });
  const label = `${record.mentat ?? m.name}, Mentat of House ${HOUSE_NAMES[house]}, from your copy of the original game`;
  // portraits.js's rules for its own classes are global once a painting is on the page: here they do nothing
  const style = `<style>.cpo image{image-rendering:pixelated}.cpo .cpm-sway,.cpo .cpm-blink{animation:none;opacity:1;transform:none}${css.join('')}`
    + '@media (prefers-reduced-motion:reduce){.cpo .cpo-anim{animation:none;opacity:0}}</style>';
  const figure = `<svg class="cp-mentat-art cpo ${cls}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMax meet" style="filter:none">${style}`
    + `<g class="cpm-sway">${img(head, [0, 0, W, H])}<g class="cpo-other">${otherImgs.join('')}</g><g class="cpm-blink">${eyeImgs.join('')}</g></g></svg>`;

  // the face's rig: the mouth frames for the voice's shapes, the shut eyes for its blinks
  const visemes = mouthVisemes(mouth);
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
    if (eyes[4] && eyeUrls[4]) {
      const [ex, ey, ew, eh] = at(eyes[4]), half = ew / 2;
      rig.lids = { src: eyeUrls[4], box: [ex, ey, ew, eh], soft: 0,
        left: { box: [ex, ey, half, eh], open: [ey, ey + eh] }, right: { box: [ex + half, ey, half, eh], open: [ey, ey + eh] } };
    }
  }
  return { figure, rig, info: { box, visemes, eyeCycle, otherCycle, frames: { eyes: eyes.filter(drawn).length, mouth: mouth.filter(drawn).length, other: other.filter(drawn).length } } };
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
