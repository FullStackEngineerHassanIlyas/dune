// Bakes the Mentat portraits (src/ui/campaign/portraits-cyril.js, -radnor.js, -ammon.js: each a 3D figure sculpted
// in signed distance fields) to the WebP layers the game shows: <house>-back.webp (the chamber, painted in SVG,
// portraits-chambers.js), -body, -head (it sways) and -lids (the closed eyes, for the blink). In headless Chrome on
// the GPU (WebGL2): each pass is raymarched at twice the bake size, scaled down, given the painter's finish
// (portraits-finish.js), cropped and encoded. Writes the layer boxes and head pivots to
// src/ui/campaign/portraits-layers.js and the seam masks (decoded back from the WebP files) to seams.json.
//   flock /tmp/dune-chrome.lock flock /tmp/dune-heavy.lock node assets/campaign/portraits/bake.mjs      bake all three
//   ... bake.mjs --only atreides                                       one Mentat (the boxes module is left alone)
//   ... bake.mjs --preview <dir> [--only house] [--scale 1.6]          composed PNG previews, nothing written here
//   ... bake.mjs --preview <dir> --only house --crop x,y,w,h --scale 6 a close-up of part of the frame (SVG units)
//   ... bake.mjs --mouth [--only house] [--visemes A,E]               the face art the talking Mentat needs, from the very same
//                                                                      sculpt: the mouth sprites (<house>-mouth-<viseme>.webp),
//                                                                      the brows as cut-outs (-brow-<side>, -browbase-<side>) and
//                                                                      the shut eyes (-lid-<side>), and where they lie:
//                                                                      src/ui/campaign/mentat-face-art.js (all three houses)
//   ... bake.mjs --mouth --preview <dir> [--scale 6] [--visemes ...]    the sprites' crops as opaque PNGs, nothing written here
//   ... bake.mjs --mouth --out <dir> [--only house]                    the same files in <dir>, to compare with the committed ones
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage } from '../../../scripts/cdp.mjs';
import { MENTATS } from '../../../src/ui/campaign/portraits-mentats.js';
import { chamber } from '../../../src/ui/campaign/portraits-chambers.js';
import { fragmentShader, VERTEX_SHADER, VIEW_W, VIEW_H, LAYERS } from '../../../src/ui/campaign/portraits-sdf.js';
import { FINISH } from '../../../src/ui/campaign/portraits-finish.js';
import { mouthPose, mouthRegion, SHAPES, SPRITE_VISEMES } from '../../../src/ui/campaign/portraits-mouth.js';
import { browRegion } from '../../../src/ui/campaign/portraits-brows.js';
import { lidsRegion } from '../../../src/ui/campaign/portraits-lids.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? '']] : acc), []));
/** Pixels per SVG unit: the portrait shows at most ~600 CSS px tall (500 units), so 2.4 keeps it sharp on a 2x
 *  screen; the chamber is blurred anyway and bakes at half that. */
const SCALE = 2.4, BACK_SCALE = 1.2, SUPER = 2;
const QUALITY = { back: 0.85, body: 0.9, head: 0.92, lids: 0.92 };

const PAGE = String.raw`
const gl = (() => { const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16; return cv.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false }); })();
const programs = new Map();
function program(frag, vert) {
  if (programs.has(frag)) return programs.get(frag);
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vert)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  programs.set(frag, p);
  return p;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Raymarches one pass into a canvas of w x h px. */
window.renderPass = async ({ frag, vert, w, h, frame, cam, pass, closed = 0, mouth = null, off = [0, 0] }) => {
  const p = program(frag, vert);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.useProgram(p);
  gl.uniform2f(gl.getUniformLocation(p, 'uSize'), w, h);
  gl.uniform3f(gl.getUniformLocation(p, 'uCam'), ...cam);
  gl.uniform4f(gl.getUniformLocation(p, 'uFrame'), ...frame);
  gl.uniform1i(gl.getUniformLocation(p, 'uPass'), pass);
  gl.uniform1f(gl.getUniformLocation(p, 'uClosed'), closed);
  gl.uniform2f(gl.getUniformLocation(p, 'uPixOff'), off[0], off[1]);
  if (mouth) ['uMouthA', 'uMouthB', 'uMouthC'].forEach((n, i) => gl.uniform4f(gl.getUniformLocation(p, n), ...mouth[i]));
  gl.viewport(0, 0, w, h);
  gl.enable(gl.SCISSOR_TEST);
  const T = 192, px = new Uint8Array(w * h * 4), tile = new Uint8Array(T * T * 4);
  for (let y = 0; y < h; y += T) {
    for (let x = 0; x < w; x += T) {
      const tw = Math.min(T, w - x), th = Math.min(T, h - y);
      gl.scissor(x, y, tw, th);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(x, y, tw, th, gl.RGBA, gl.UNSIGNED_BYTE, tile);
      for (let r = 0; r < th; r++) px.set(tile.subarray(r * tw * 4, (r + 1) * tw * 4), ((h - 1 - (y + r)) * w + x) * 4);
    }
    await sleep(0);
  }
  gl.disable(gl.SCISSOR_TEST);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fb); gl.deleteTexture(tex);
  const err = gl.getError();
  if (err) throw new Error('GL error ' + err);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer), w, h), 0, 0);
  return cv;
};
const shrink = (src, w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(src, 0, 0, w, h); return cv; };
/** The painter's finish (portraits-finish.js): an anisotropic Kuwahara filter, on the GPU, in place. */
const finish = (cv, paint) => {
  if (!paint) return cv;
  gl.getExtension('EXT_color_buffer_float');
  const w = cv.width, h = cv.height;
  const tex = (fmt, data) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (data) { gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, data); }
    else gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
    return t;
  };
  const fbs = [];
  const run = (frag, inputs, out, uni = {}, read = false) => {
    const p = program(frag, FINISH_VERT);
    gl.useProgram(p);
    const fb = gl.createFramebuffer(); fbs.push(fb);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, out, 0);
    Object.entries(inputs).forEach(([name, t], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(gl.getUniformLocation(p, name), i); });
    for (const [name, v] of Object.entries(uni)) {
      const loc = gl.getUniformLocation(p, name);
      if (Array.isArray(v)) gl.uniform2i(loc, v[0], v[1]); else gl.uniform1f(loc, v);
    }
    gl.viewport(0, 0, w, h);
    gl.enable(gl.SCISSOR_TEST);
    const T = 256, px = read ? new Uint8Array(w * h * 4) : null, tile = read ? new Uint8Array(T * T * 4) : null;
    for (let y = 0; y < h; y += T) for (let x = 0; x < w; x += T) {
      const tw = Math.min(T, w - x), th = Math.min(T, h - y);
      gl.scissor(x, y, tw, th); gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (read) { gl.readPixels(x, y, tw, th, gl.RGBA, gl.UNSIGNED_BYTE, tile); for (let r = 0; r < th; r++) px.set(tile.subarray(r * tw * 4, (r + 1) * tw * 4), ((y + r) * w + x) * 4); }
    }
    gl.disable(gl.SCISSOR_TEST);
    return px;
  };
  const src = tex(0, cv), sst = tex(gl.RGBA16F), tmp = tex(gl.RGBA16F), sst2 = tex(gl.RGBA16F), out = tex(gl.RGBA8);
  run(FINISH_SST, { uSrc: src }, sst);
  run(FINISH_BLUR, { uSrc: sst }, tmp, { uDir: [1, 0], uSigma: paint.sigma });
  run(FINISH_BLUR, { uSrc: tmp }, sst2, { uDir: [0, 1], uSigma: paint.sigma });
  const px = run(FINISH_AKF, { uSrc: src, uTensor: sst2 }, out, { uRadius: paint.radius, uQ: paint.q, uAlpha: paint.alpha }, true);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  fbs.forEach((f) => gl.deleteFramebuffer(f)); [src, sst, tmp, sst2, out].forEach((t) => gl.deleteTexture(t));
  const err = gl.getError();
  if (err) throw new Error('GL error in the finish ' + err);
  cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer), w, h), 0, 0);
  return cv;
};
/** The body melts into the stage toward the frame's sides and bottom edge (no hard cut where the frame ends). */
const fade = (cv, cx, cy, scale) => {
  const m = document.createElement('canvas'); m.width = cv.width; m.height = cv.height;
  const c = m.getContext('2d');
  const W = ${VIEW_W} * scale, H = ${VIEW_H} * scale, ox = -cx * scale, oy = -cy * scale;
  const gx = c.createLinearGradient(ox, 0, ox + W, 0);
  gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(0.1, 'rgba(0,0,0,0.75)'); gx.addColorStop(0.2, '#000');
  gx.addColorStop(0.8, '#000'); gx.addColorStop(0.9, 'rgba(0,0,0,0.75)'); gx.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gx; c.fillRect(0, 0, m.width, m.height);
  const gy = c.createLinearGradient(0, oy, 0, oy + H);
  gy.addColorStop(0, '#000'); gy.addColorStop(0.9, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0.25)');
  c.globalCompositeOperation = 'destination-in'; c.fillStyle = gy; c.fillRect(0, 0, m.width, m.height);
  const k = cv.getContext('2d'); k.globalCompositeOperation = 'destination-in'; k.drawImage(m, 0, 0); k.globalCompositeOperation = 'source-over';
  return cv;
};
const box = (cv) => {
  const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (px[(y * cv.width + x) * 4 + 3] > 3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { x: 0, y: 0, w: 1, h: 1 };
  x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(cv.width - 1, x1 + 2); y1 = Math.min(cv.height - 1, y1 + 2);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};
const cut = (cv, b) => { const o = document.createElement('canvas'); o.width = b.w; o.height = b.h; o.getContext('2d').drawImage(cv, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h); return o; };
const b64 = (cv, fmt, q) => cv.toDataURL(fmt, q).split(',')[1];
const svgImage = async (svg) => { const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); const img = new Image(); img.src = url; await img.decode(); URL.revokeObjectURL(url); return img; };
const loadImage = async (data, type) => { const img = new Image(); img.src = 'data:' + type + ';base64,' + data; await img.decode(); return img; };
/** A mask (alpha above half, or a material id) of a decoded image, run-length encoded by rows: [w, h, runs...]. */
const rle = (w, h, on) => { const runs = []; let cur = 0, n = 0; for (let i = 0; i < w * h; i++) { const v = on(i) ? 1 : 0; if (v === cur) n++; else { runs.push(n); cur = v; n = 1; } } runs.push(n); return [w, h, ...runs]; };

/** One Mentat: the four layers (or a preview). */
window.bakeMentat = async (job) => {
  const t0 = performance.now();
  const S = job.scale * job.sup;
  const [cx, cy, cw, ch] = job.crop ?? [0, 0, ${VIEW_W}, ${VIEW_H}];
  const W = Math.round(cw * S), H = Math.round(ch * S);
  const F = job.frame;
  const win = [F.x0 + (cx / ${VIEW_W}) * F.w, F.y0 - (cy / ${VIEW_H}) * F.h, (cw / ${VIEW_W}) * F.w, (ch / ${VIEW_H}) * F.h];
  const pass = (n, closed = 0) => renderPass({ frag: job.frag, vert: job.vert, w: W, h: H, frame: win, cam: F.cam, pass: n, closed });
  const fw = Math.round(cw * job.scale), fh = Math.round(ch * job.scale);
  const want = (n) => !job.passes || job.passes.includes(n);
  const blank = () => { const cv = document.createElement('canvas'); cv.width = fw; cv.height = fh; return cv; };
  const body = want('body') ? fade(finish(shrink(await pass(0), fw, fh), job.paint), cx, cy, job.scale) : blank();
  const head = want('head') ? finish(shrink(await pass(1), fw, fh), job.paint) : blank();
  // the closed eyes: the head rendered with the lids down, kept only round the eyes (a soft-edged mask), so it melts
  // into the open head's own pixels
  const shut = want('lids') ? finish(shrink(await pass(2, 1), fw, fh), job.paint) : blank();
  const mask = document.createElement('canvas'); mask.width = fw; mask.height = fh;
  const mc = mask.getContext('2d');
  mc.filter = 'blur(' + (job.scale * 2.0) + 'px)';
  mc.fillStyle = '#fff';
  for (const [ex, ey, ew, eh] of job.eyeBoxes) { mc.beginPath(); mc.ellipse((ex + ew / 2 - cx) * job.scale, (ey + eh / 2 - cy) * job.scale, ew * 0.58 * job.scale, eh * 0.62 * job.scale, 0, 0, Math.PI * 2); mc.fill(); }
  const lids = document.createElement('canvas'); lids.width = fw; lids.height = fh;
  const lc = lids.getContext('2d'); lc.drawImage(shut, 0, 0); lc.globalCompositeOperation = 'destination-in'; lc.drawImage(mask, 0, 0);
  const back = shrink(await (async () => { const cv = document.createElement('canvas'); cv.width = ${VIEW_W} * job.backScale * job.sup; cv.height = ${VIEW_H} * job.backScale * job.sup; cv.getContext('2d').drawImage(await svgImage(job.back), 0, 0, cv.width, cv.height); return cv; })(), ${VIEW_W} * job.backScale, ${VIEW_H} * job.backScale);
  const ms = Math.round(performance.now() - t0);
  if (job.preview) {
    const cv = document.createElement('canvas'); cv.width = fw; cv.height = fh; const c = cv.getContext('2d');
    c.fillStyle = '#07070a'; c.fillRect(0, 0, fw, fh);
    c.drawImage(back, cx * job.backScale, cy * job.backScale, cw * job.backScale, ch * job.backScale, 0, 0, fw, fh);
    c.drawImage(body, 0, 0); c.drawImage(head, 0, 0);
    const bl = document.createElement('canvas'); bl.width = fw; bl.height = fh; const bc = bl.getContext('2d');
    bc.drawImage(cv, 0, 0); bc.drawImage(lids, 0, 0);
    const layers = {};
    for (const [k, v] of Object.entries({ body, head, lids })) layers[k] = b64(v, 'image/png');
    return { ms, full: b64(cv, 'image/png'), blink: b64(bl, 'image/png'), layers };
  }
  // the body's material ids (the neck's root), for the seam check
  // (scaled down by taking one sample in each block: an average of two ids would be a third id)
  const ids = (() => { const cv = document.createElement('canvas'); cv.width = fw; cv.height = fh; return cv; })();
  { const c = ids.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(await pass(3), 0, 0, fw, fh); }
  const out = { ms, layers: {} };
  for (const [name, cv] of Object.entries({ back, body, head, lids })) {
    const b = name === 'back' ? { x: 0, y: 0, w: cv.width, h: cv.height } : box(cv);
    const data = b64(cut(cv, b), 'image/webp', job.quality[name]);
    out.layers[name] = { box: b, data };
  }
  // decode the WebP files back and record what the seam test needs: where the body shows the neck's skin, and where
  // the head covers (alpha over half), each over the whole frame
  const full = async (name) => {
    const { box: b, data } = out.layers[name];
    const img = await loadImage(data, 'image/webp');
    const cv = document.createElement('canvas'); cv.width = fw; cv.height = fh; cv.getContext('2d').drawImage(img, b.x, b.y);
    return cv.getContext('2d').getImageData(0, 0, fw, fh).data;
  };
  const headPx = await full('head'), bodyPx = await full('body');
  const idPx = ids.getContext('2d').getImageData(0, 0, fw, fh).data;
  out.seams = {
    neck: rle(fw, fh, (i) => bodyPx[i * 4 + 3] > 127 && Math.abs(idPx[i * 4] - job.neckId) < 0.5 && idPx[i * 4 + 3] > 250),
    head: rle(fw, fh, (i) => headPx[i * 4 + 3] > 127),
  };
  return out;
};`;

/**
 * The mouth sprites of one Mentat (the poses of portraits-mouth.js): his head (pass 1) rendered only over a crop round
 * the mouth, on the very pixel grid and with the very film grain of the full head's bake (uPixOff), finished the same
 * way, then cut to the sprite's box. A sprite is opaque in the middle of an ellipse inscribed in its box and fades to
 * nothing toward the edge, where it is the painting's own picture anyway (the head layer is drawn under it).
 */
const MOUTH_PAGE = String.raw`
window.bakeMouth = async (job) => {
  const S = job.scale * job.sup;
  const [cx, cy, cw, ch] = job.render;
  const W = Math.round(cw * S), H = Math.round(ch * S);
  const F = job.frame;
  const win = [F.x0 + (cx / ${VIEW_W}) * F.w, F.y0 - (cy / ${VIEW_H}) * F.h, (cw / ${VIEW_W}) * F.w, (ch / ${VIEW_H}) * F.h];
  const off = [Math.round(cx * S), Math.round((${VIEW_H} - cy - ch) * S)];
  const fw = Math.round(cw * job.scale), fh = Math.round(ch * job.scale);
  const [bx, by, bw, bh] = job.box;
  const cut = { x: Math.round((bx - cx) * job.scale), y: Math.round((by - cy) * job.scale), w: Math.round(bw * job.scale), h: Math.round(bh * job.scale) };
  const out = [];
  for (const pz of job.poses) {
    const t0 = performance.now();
    const raw = await renderPass({ frag: job.frag, vert: job.vert, w: W, h: H, frame: win, cam: F.cam, pass: 1, closed: 0, mouth: pz.mouth, off });
    const img = finish(shrink(raw, fw, fh), job.paint);
    const sprite = document.createElement('canvas'); sprite.width = cut.w; sprite.height = cut.h;
    const sc = sprite.getContext('2d');
    sc.drawImage(img, cut.x, cut.y, cut.w, cut.h, 0, 0, cut.w, cut.h);
    const entry = { name: pz.name, ms: Math.round(performance.now() - t0) };
    if (job.preview) {
      // the render crop whole, over a dark ground, and the sprite alone
      const bg = document.createElement('canvas'); bg.width = fw; bg.height = fh; const bc = bg.getContext('2d');
      bc.fillStyle = '#16161c'; bc.fillRect(0, 0, fw, fh); bc.drawImage(img, 0, 0);
      entry.full = b64(bg, 'image/png');
    } else {
      const id = sc.getImageData(0, 0, cut.w, cut.h), d = id.data;
      for (let y = 0; y < cut.h; y++) for (let x = 0; x < cut.w; x++) {
        const r = Math.hypot((x + 0.5 - cut.w / 2) / (cut.w / 2), (y + 0.5 - cut.h / 2) / (cut.h / 2));
        const t = Math.min(1, Math.max(0, (r - job.fade[0]) / (job.fade[1] - job.fade[0])));
        d[(y * cut.w + x) * 4 + 3] = Math.round(d[(y * cut.w + x) * 4 + 3] * (1 - t * t * (3 - 2 * t)));
      }
      sc.putImageData(id, 0, 0);
      entry.webp = b64(sprite, 'image/webp', job.quality);
      entry.size = [cut.w, cut.h];
      // the same crop's pixels as rendered (before the mask), for the checks against the head layer
      entry.png = b64(sprite, 'image/png');
    }
    out.push(entry);
  }
  return out;
};`;

/**
 * The brows of one Mentat as cut-outs: his head rendered with the hair of the brows and without it (uMouthC.w), on the
 * mouth sprites' grid and finish. Where the two differ is the brow: its alpha (from the difference, softened) and its
 * own colour (the hair with the skin under it taken out); the head without it, faded at the edges, is the patch the
 * brow moves over.
 */
const BROWS_PAGE = String.raw`
window.bakeBrows = async (job) => {
  const S = job.scale * job.sup;
  const [cx, cy, cw, ch] = job.render;
  const W = Math.round(cw * S), H = Math.round(ch * S);
  const F = job.frame;
  const win = [F.x0 + (cx / ${VIEW_W}) * F.w, F.y0 - (cy / ${VIEW_H}) * F.h, (cw / ${VIEW_W}) * F.w, (ch / ${VIEW_H}) * F.h];
  const off = [Math.round(cx * S), Math.round((${VIEW_H} - cy - ch) * S)];
  const fw = Math.round(cw * job.scale), fh = Math.round(ch * job.scale);
  const rend = async (browsOff) => {
    const raw = await renderPass({ frag: job.frag, vert: job.vert, w: W, h: H, frame: win, cam: F.cam, pass: 1, closed: 0, mouth: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, browsOff]], off });
    return finish(shrink(raw, fw, fh), job.paint);
  };
  const A = await rend(0), B = await rend(1);
  const ad = A.getContext('2d').getImageData(0, 0, fw, fh).data, bd = B.getContext('2d').getImageData(0, 0, fw, fh).data;
  const step = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // the brow's alpha: where the two heads differ, a little softened
  const raw = new Float32Array(fw * fh);
  for (let i = 0; i < fw * fh; i++) raw[i] = step(job.t0, job.t1, Math.max(Math.abs(ad[i * 4] - bd[i * 4]), Math.abs(ad[i * 4 + 1] - bd[i * 4 + 1]), Math.abs(ad[i * 4 + 2] - bd[i * 4 + 2])));
  const al = new Float32Array(fw * fh);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < fw && yy < fh) { const w = dx === 0 && dy === 0 ? 4 : 1; s += raw[yy * fw + xx] * w; n += w; } }
    al[y * fw + x] = s / n;
  }
  const out = {};
  for (const [side, sb] of Object.entries(job.sides)) {
    const [sx, sy, sw, sh] = sb;
    let x0 = sx + sw, y0 = sy + sh, x1 = sx, y1 = sy;
    for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) if (al[y * fw + x] > 0.06) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < x0) throw new Error('no brow found on the ' + side);
    // the sprite's box: the brow with a margin; the patch's: that with room for the brow's moves
    const pad = job.pad, room = job.room;
    const spr = { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 1 + 2 * pad, h: y1 - y0 + 1 + 2 * pad };
    const pat = { x: spr.x - room, y: spr.y - room, w: spr.w + 2 * room, h: spr.h + 2 * room };
    for (const b of [spr, pat]) if (b.x < 0 || b.y < 0 || b.x + b.w > fw || b.y + b.h > fh) throw new Error('the ' + side + ' brow box leaves the render');
    const sc = document.createElement('canvas'); sc.width = spr.w; sc.height = spr.h;
    const sctx = sc.getContext('2d'), sid = sctx.createImageData(spr.w, spr.h);
    for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) {
      const i = (spr.y + y) * fw + spr.x + x, o = (y * spr.w + x) * 4, a = al[i];
      sid.data[o + 3] = Math.round(255 * a);
      for (let c = 0; c < 3; c++) {
        // the hair's own colour: the head with the brow, less the head without it showing through (1 - a)
        const v = a > 0.02 ? (ad[i * 4 + c] - (1 - a) * bd[i * 4 + c]) / a : bd[i * 4 + c];
        sid.data[o + c] = Math.max(0, Math.min(255, Math.round(v)));
      }
    }
    sctx.putImageData(sid, 0, 0);
    const pc = document.createElement('canvas'); pc.width = pat.w; pc.height = pat.h;
    const pctx = pc.getContext('2d'), pid = pctx.createImageData(pat.w, pat.h);
    for (let y = 0; y < pat.h; y++) for (let x = 0; x < pat.w; x++) {
      const i = (pat.y + y) * fw + pat.x + x, o = (y * pat.w + x) * 4;
      // faded toward the box's edge over the room the moves need (where the painting is the same anyway)
      const e = Math.min(x, y, pat.w - 1 - x, pat.h - 1 - y);
      pid.data[o] = bd[i * 4]; pid.data[o + 1] = bd[i * 4 + 1]; pid.data[o + 2] = bd[i * 4 + 2];
      pid.data[o + 3] = Math.round(bd[i * 4 + 3] * step(0, job.fade, e));
    }
    pctx.putImageData(pid, 0, 0);
    out[side] = { sprite: { box: spr, webp: b64(sc, 'image/webp', job.quality) }, base: { box: pat, webp: b64(pc, 'image/webp', job.quality) } };
    if (job.preview) { out[side].spritePng = b64(sc, 'image/png'); out[side].basePng = b64(pc, 'image/png'); }
  }
  return out;
};`;

/**
 * The shut eyes of one Mentat, one sprite per eye: the head rendered with the lids closed and the brows off (so a brow
 * that has moved leaves no ghost of itself in them), on the mouth sprites' grid and finish, kept only in a soft ellipse
 * round each eye (as the portrait's own lids layer is). The face draws one down over its eye for a lowered lid or a blink.
 */
const LIDS_PAGE = String.raw`
window.bakeLids = async (job) => {
  const S = job.scale * job.sup;
  const [cx, cy, cw, ch] = job.render;
  const W = Math.round(cw * S), H = Math.round(ch * S);
  const F = job.frame;
  const win = [F.x0 + (cx / ${VIEW_W}) * F.w, F.y0 - (cy / ${VIEW_H}) * F.h, (cw / ${VIEW_W}) * F.w, (ch / ${VIEW_H}) * F.h];
  const off = [Math.round(cx * S), Math.round((${VIEW_H} - cy - ch) * S)];
  const fw = Math.round(cw * job.scale), fh = Math.round(ch * job.scale);
  const raw = await renderPass({ frag: job.frag, vert: job.vert, w: W, h: H, frame: win, cam: F.cam, pass: 2, closed: 1, mouth: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1]], off });
  const img = finish(shrink(raw, fw, fh), job.paint);
  const out = {};
  for (const [side, e] of Object.entries(job.eyes)) {
    const b = e.box;
    const sc = document.createElement('canvas'); sc.width = b[2]; sc.height = b[3];
    const c = sc.getContext('2d');
    c.drawImage(img, b[0], b[1], b[2], b[3], 0, 0, b[2], b[3]);
    const mask = document.createElement('canvas'); mask.width = b[2]; mask.height = b[3];
    const mc = mask.getContext('2d');
    mc.filter = 'blur(' + job.blur + 'px)';
    mc.fillStyle = '#fff';
    mc.beginPath(); mc.ellipse(e.ellipse[0] - b[0], e.ellipse[1] - b[1], e.ellipse[2], e.ellipse[3], 0, 0, Math.PI * 2); mc.fill();
    c.globalCompositeOperation = 'destination-in'; c.drawImage(mask, 0, 0);
    out[side] = { webp: b64(sc, 'image/webp', job.quality) };
    if (job.preview) out[side].png = b64(sc, 'image/png');
  }
  return out;
};`;

const finishSrc = (await readFile(path.join(root, 'src/ui/campaign/portraits-finish.js'), 'utf8')).replace(/^export const (\w+)/gm, 'window.$1');
const only = args.only ? [args.only] : Object.keys(MENTATS);
const preview = args.preview ? path.resolve(args.preview) : null;
const scale = preview ? Number(args.scale || 1.6) : SCALE;
const crop = args.crop ? args.crop.split(',').map(Number) : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });

/** Chrome on the GPU (ANGLE over GL): the raymarch is far too slow in software. */
async function gpuChrome() {
  const port = await freePort();
  const userDir = await mkdtemp(path.join(tmpdir(), 'dune-bake-'));
  const proc = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${userDir}`, '--no-first-run',
    '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=gl', '--disable-gpu-watchdog', '--hide-scrollbars', '--mute-audio', '--window-size=800,600', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { await sleep(100); try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { /* starting */ } }
  return { port, width: 800, height: 600, async close() { proc.kill(); await sleep(500); await rm(userDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } };
}

const chrome = await gpuChrome();
try {
  const page = await openPage(chrome, 'about:blank');
  await page.eval(finishSrc);
  await page.eval(PAGE);
  await page.eval(MOUTH_PAGE);
  await page.eval(BROWS_PAGE);
  await page.eval(LIDS_PAGE);
  if (preview) await mkdir(preview, { recursive: true });
  const boxes = {}, seams = {};
  if ('mouth' in args) {
    // the mouth sprites: each viseme of each Mentat, the head's own sculpt with its mouth posed (portraits-mouth.js)
    const shapes = { ...SHAPES, ...(args.shapes ? JSON.parse(args.shapes) : {}) };   // --shapes '{"O2":{"open":1,"round":0.5}}': tries shapes out
    const dest = args.out ? path.resolve(args.out) : here;   // --out <dir>: the files go there (and no module is written): a check
    if (args.out) await mkdir(dest, { recursive: true });
    const visemes = args.visemes ? args.visemes.split(',') : SPRITE_VISEMES;
    const art = {};
    for (const house of only) {
      const m = MENTATS[house], region = mouthRegion(house);
      const job = {
        frag: fragmentShader(m.scene), vert: VERTEX_SHADER, frame: m.frame, render: region.render, box: region.box, scale, sup: args.sup ? Number(args.sup) : SUPER,
        paint: args.raw ? null : { ...FINISH, radius: FINISH.radius * (scale / SCALE) }, preview: !!preview, quality: 0.95, fade: [0.74, 1],
        poses: ['rest', ...visemes].map((name) => ({ name, mouth: mouthPose(house, name, shapes) })),
      };
      const r = await page.eval(`window.bakeMouth(${JSON.stringify(job)})`);
      art[house] = { box: region.box, hinge: region.hinge, center: region.center, halfWidth: region.halfWidth, sprites: {} };
      for (const e of r) {
        if (preview) { await writeFile(path.join(preview, `${house}-mouth-${e.name}${args.tag ? `-${args.tag}` : ''}.png`), Buffer.from(e.full, 'base64')); continue; }
        if (args.keep) await writeFile(path.join(args.keep, `${house}-mouth-${e.name}.png`), Buffer.from(e.png, 'base64'));
        if (e.name === 'rest') continue;
        const bytes = Buffer.from(e.webp, 'base64');
        await writeFile(path.join(dest, `${house}-mouth-${e.name}.webp`), bytes);
        art[house].sprites[e.name] = { size: e.size, bytes: bytes.length, hash: createHash('sha256').update(bytes).digest('hex').slice(0, 16) };
        console.log(`${house}-mouth-${e.name}.webp`, `${e.size[0]}x${e.size[1]}`, `${(bytes.length / 1024).toFixed(1)} KB`, `${e.ms} ms`);
      }
      console.log('mouth', house, `${r.reduce((a, e) => a + e.ms, 0)} ms`);
      if (!args.visemes && scale === SCALE) {
        // the brows, cut out
        const br = browRegion(house), k = SCALE;
        const bjob = {
          frag: job.frag, vert: VERTEX_SHADER, frame: m.frame, render: br.render, sides: br.sides, scale, sup: job.sup, paint: job.paint, quality: 0.95,
          t0: 3, t1: 24, pad: 3, room: 10, fade: 8, preview: !!preview,
        };
        const bb = await page.eval(`window.bakeBrows(${JSON.stringify(bjob)})`);
        art[house].brows = {};
        for (const [side, e] of Object.entries(bb)) {
          const toUnits = (b) => [br.origin[0] + b.x, br.origin[1] + b.y, b.w, b.h].map((v, i) => Math.round((v / k) * 1e3) / 1e3);
          if (preview) {
            await writeFile(path.join(preview, `${house}-brow-${side}.png`), Buffer.from(e.spritePng, 'base64'));
            await writeFile(path.join(preview, `${house}-browbase-${side}.png`), Buffer.from(e.basePng, 'base64'));
            continue;
          }
          const sp = Buffer.from(e.sprite.webp, 'base64'), ba = Buffer.from(e.base.webp, 'base64');
          await writeFile(path.join(dest, `${house}-brow-${side}.webp`), sp);
          await writeFile(path.join(dest, `${house}-browbase-${side}.webp`), ba);
          art[house].brows[side] = {
            box: toUnits(e.sprite.box), base: toUnits(e.base.box), bytes: [sp.length, ba.length],
            hash: [createHash('sha256').update(sp).digest('hex').slice(0, 16), createHash('sha256').update(ba).digest('hex').slice(0, 16)],
          };
          console.log(`${house}-brow-${side}.webp`, `${e.sprite.box.w}x${e.sprite.box.h}`, `${(sp.length / 1024).toFixed(1)} KB`, `base ${e.base.box.w}x${e.base.box.h}`, `${(ba.length / 1024).toFixed(1)} KB`);
        }
        // the shut eyes, one sprite each (brows off), kept in a soft ellipse round the eye as the portrait's lids layer is
        const lr = lidsRegion(house);
        const ljob = { frag: job.frag, vert: VERTEX_SHADER, frame: m.frame, render: lr.render, eyes: lr.eyes, scale, sup: job.sup, paint: job.paint, quality: 0.95, blur: scale * 2.0, preview: !!preview };
        const lb = await page.eval(`window.bakeLids(${JSON.stringify(ljob)})`);
        art[house].lids = {};
        for (const [side, e] of Object.entries(lb)) {
          if (preview) { await writeFile(path.join(preview, `${house}-lid-${side}.png`), Buffer.from(e.png, 'base64')); continue; }
          const bytes = Buffer.from(e.webp, 'base64');
          await writeFile(path.join(dest, `${house}-lid-${side}.webp`), bytes);
          art[house].lids[side] = { box: lr.eyes[side].unitBox, bytes: bytes.length, hash: createHash('sha256').update(bytes).digest('hex').slice(0, 16) };
          console.log(`${house}-lid-${side}.webp`, `${lr.eyes[side].box[2]}x${lr.eyes[side].box[3]}`, `${(bytes.length / 1024).toFixed(1)} KB`);
        }
      }
    }
    if (!preview && !args.visemes && !args.only && !args.out) {
      await writeFile(path.join(root, 'src/ui/campaign/mentat-face-art.js'),
        `// Generated by assets/campaign/portraits/bake.mjs --mouth: where each Mentat's mouth sprites (<house>-mouth-<viseme>.webp)\n// lie on the portrait ([x, y, width, height] in frame units, 400 x 500), the lip line (hinge), the mouth's middle (center) and\n// half width, and each sprite's pixel size, bytes and hash. Bake again; do not edit by hand.\nexport const FACE_ART = {\n${Object.entries(art).map(([h, a]) => `  ${h}: {\n    box: ${JSON.stringify(a.box)}, hinge: ${a.hinge}, center: ${a.center}, halfWidth: ${a.halfWidth},\n    sprites: {\n${Object.entries(a.sprites).map(([v, e]) => `      ${v}: { size: ${JSON.stringify(e.size)}, bytes: ${e.bytes}, hash: '${e.hash}' },`).join('\n')}\n    },\n    lids: {\n${Object.entries(a.lids ?? {}).map(([side, e]) => `      ${side}: { box: ${JSON.stringify(e.box)}, bytes: ${e.bytes}, hash: '${e.hash}' },`).join('\n')}\n    },\n    brows: {\n${Object.entries(a.brows ?? {}).map(([side, e]) => `      ${side}: { box: ${JSON.stringify(e.box)}, base: ${JSON.stringify(e.base)}, bytes: ${JSON.stringify(e.bytes)}, hash: ${JSON.stringify(e.hash)} },`).join('\n')}\n    },\n  },`).join('\n')}\n};\n`);
      console.log('wrote src/ui/campaign/mentat-face-art.js');
    }
    page.close();
    await chrome.close();
    process.exit(0);
  }
  for (const house of only) {
    const m = MENTATS[house];
    const job = {
      frag: fragmentShader(m.scene).replace('out vec4 fragColor;', `out vec4 fragColor;\n${[...(args.defines || '').split(',').filter(Boolean), ...(args.turn ? [`TURN ${(Number(args.turn) * Math.PI / 180).toFixed(4)}`] : [])].map((d) => `#define ${d}`).join('\n')}`), vert: VERTEX_SHADER, frame: m.frame, eyeBoxes: [m.features.eyeL, m.features.eyeR], neckId: 25,
      scale, sup: args.sup ? Number(args.sup) : SUPER, backScale: preview ? scale : BACK_SCALE, preview: !!preview, quality: QUALITY,
      paint: args.raw ? null : { ...FINISH, radius: FINISH.radius * (scale / SCALE) * (Number(args.stroke) || 1) }, back: chamber(house), crop, passes: args.passes ? args.passes.split(',') : null,
    };
    const r = await page.eval(`window.bakeMentat(${JSON.stringify(job)})`);
    if (preview) {
      const tag = args.tag ? `-${args.tag}` : '';
      await writeFile(path.join(preview, `${house}${tag}.png`), Buffer.from(r.full, 'base64'));
      if (!crop) await writeFile(path.join(preview, `${house}${tag}-blink.png`), Buffer.from(r.blink, 'base64'));
      if (args.layers) for (const [k, v] of Object.entries(r.layers)) await writeFile(path.join(preview, `${house}${tag}-${k}.png`), Buffer.from(v, 'base64'));
      console.log('preview', house, `${r.ms} ms`);
      continue;
    }
    boxes[house] = {};
    const hashes = {};
    for (const name of LAYERS) {
      const { box, data } = r.layers[name];
      const s = name === 'back' ? BACK_SCALE : SCALE;
      const bytes = Buffer.from(data, 'base64');
      await writeFile(path.join(here, `${house}-${name}.webp`), bytes);
      hashes[name] = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
      boxes[house][name] = [box.x / s, box.y / s, box.w / s, box.h / s].map((v) => Math.round(v * 100) / 100);
      console.log(`${house}-${name}.webp`, `${box.w}x${box.h}`, `${(bytes.length / 1024).toFixed(1)} KB`);
    }
    seams[house] = { scale: SCALE, hashes, ...r.seams };
    console.log(house, `${r.ms} ms`);
  }
  if (!preview && !args.only) {
    const body = Object.entries(boxes).map(([h, b]) => {
      const m = MENTATS[h];
      const f = Object.entries(m.features).map(([k, v]) => `${k}: [${v.join(', ')}]`).join(', ');
      return `  ${h}: {\n    name: '${m.name}', pivot: [${m.pivot.join(', ')}],\n    layers: { ${LAYERS.map((l) => `${l}: [${b[l].join(', ')}]`).join(', ')} },\n    features: { ${f} },\n  },`;
    }).join('\n');
    await writeFile(path.join(root, 'src/ui/campaign/portraits-layers.js'),
      `// Generated by assets/campaign/portraits/bake.mjs: each Mentat's name, the point his head turns about, where each\n// baked layer sits in the portrait's 400 x 500 frame, and where the face's moving parts fall in it (the mouth, the\n// brows and the eyes with their lids, left and right as seen), all [x, y, width, height] in frame units. Bake\n// again; do not edit by hand.\nexport const PORTRAITS = {\n${body}\n};\n`);
    await writeFile(path.join(here, 'seams.json'), `${JSON.stringify(seams)}\n`);
    console.log('wrote src/ui/campaign/portraits-layers.js and seams.json');
  }
  page.close();
} finally {
  await chrome.close();
}
