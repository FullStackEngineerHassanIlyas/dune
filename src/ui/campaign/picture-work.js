// The original pictures' pixel work, pure and apart from the page (no DOM, no window, no three.js): a Mentat's
// figure enlarged by the pixel-art scaler (pixel-scale.js) and written as PNGs, and a house emblem trimmed and
// enlarged by whole pixels. original-mentat-art.js builds the markup and the rig around what it makes. pictureWork()
// is the one function both places it runs call: a module Worker (picture-worker.js), so the page's thread does none
// of it, and, where there is no Worker or it fails, the page's thread itself, with pauses between the steps
// (picture-jobs.js). The same job gives the same pictures, byte for byte, in either place.
import { scaleIndexed, rgbaWords, wordsRgba, REACH } from './pixel-scale.js';
import { encodePng, encodeIndexedPng, pngDataUrl } from '../../formats/png.js';

/** A shape that draws something: the files fill unused places with 1 x 1 ones. */
export const drawn = (q) => !!q && q.width * q.height > 1;

/** `src` (rgba w x h, see-through where alpha is 0) drawn over `dst` (dw wide) at [x, y]. */
export function blit(dst, dw, dh, src, sw, sh, x, y) {
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

function cut(rgba, width, [x, y, w, h]) {
  const out = new Uint8Array(w * h * 4);
  for (let r = 0; r < h; r++) out.set(rgba.subarray(((y + r) * width + x) * 4, ((y + r) * width + x + w) * 4), r * w * 4);
  return out;
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
 * A Mentat's pictures: the room (`rgba`, `width` wide) cut to the figure's `box` ([0, top, W, H]) with what the
 * original draws over it at rest (eyes ahead, mouth shut, the book's first frame, the shoulder in front of the
 * screen), enlarged `scale` times by the pixel-art scaler; every other frame of a part enlarged in place over it
 * (enlargeFigure), so it lines up with the head pixel for pixel — the eyes and the book in a box REACH pixels wider,
 * all the frame changes; the mouth in its own box, the one the face's rig draws it in. Frames are { x, y, width,
 * height, rgba } at their places in the room. `pause()` is awaited between the steps.
 */
async function mentatPictures({ rgba, width, box, eyes, mouth, other, shoulder, scale }, pause) {
  const [, top, W, H] = box;
  const room = cut(rgba, width, box);
  for (const q of [eyes[0], mouth[0], other[0], shoulder]) if (drawn(q)) blit(room, W, H, q.rgba, q.width, q.height, q.x, q.y - top);
  const fig = enlargeFigure(room, W, H, [...eyes, ...mouth, ...other], top, scale);
  await pause();
  const head = await fig.url(fig.head, W * scale, H * scale);
  // the frames a few at a time, a pause between them (on the page's thread one long task would hold the menu still)
  const enlarged = async (frames, pad, want) => {
    await pause();
    return Promise.all(frames.map((q, k) => {
      if (!want(q, k)) return null;
      const { values, box: b } = fig.part(q, { pad });
      return fig.url(values, b[2] * scale, b[3] * scale).then((src) => ({ src, box: b }));
    }));
  };
  const eyeArt = await enlarged(eyes, REACH, (q, k) => q && k);
  const mouthArt = await enlarged(mouth, 0, (q, k) => q && k);
  const otherArt = await enlarged(other, REACH, (q, k) => k && drawn(q));
  return { head, eyes: eyeArt, mouth: mouthArt, other: otherArt };
}

const still = async () => {};

/**
 * One job of the original pictures' pixel work, a plain object (it crosses to a Worker as it is, its pixels as
 * transferred buffers); what it makes is plain too (PNG data: URLs and boxes), so it comes back as it is.
 *   - { kind: 'mentat', rgba, width, box, eyes, mouth, other, shoulder, scale } → { head: URL, eyes, mouth, other:
 *     [{ src, box } | null] }: the head, and each part's frames (but the first, at rest; null where not drawn);
 *   - { kind: 'emblem', rgba, width, height, scale } → { src, width, height }: the screen's black around it
 *     see-through (clearSurround), trimmed, enlarged `scale` times by whole pixels.
 * `pause()` is awaited between a Mentat's steps (the page's thread lets the page through there; a Worker need not).
 */
export async function pictureWork(job, { pause = still } = {}) {
  if (job?.kind === 'mentat') return mentatPictures(job, pause);
  if (job?.kind === 'emblem') {
    const { rgba, width, height } = clearSurround(job.rgba, job.width, job.height);
    return { src: pngDataUrl(await encodePng(rgba, width, height, { scale: job.scale })), width, height };
  }
  throw new Error(`pictureWork: no job of kind "${job?.kind}"`);
}
