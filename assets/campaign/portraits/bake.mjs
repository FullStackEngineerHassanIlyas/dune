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
window.renderPass = async ({ frag, vert, w, h, frame, cam, pass, closed = 0 }) => {
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
const finish = (cv, paint) => {
  if (!paint) return cv;
  const c = cv.getContext('2d', { willReadFrequently: true }), d = c.getImageData(0, 0, cv.width, cv.height);
  c.putImageData(new ImageData(painterly(d.data, cv.width, cv.height, paint.r, paint.mix), cv.width, cv.height), 0, 0);
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

const finishSrc = (await readFile(path.join(root, 'src/ui/campaign/portraits-finish.js'), 'utf8')).replace(/^export /gm, '');
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
  await page.eval(`${finishSrc}\nwindow.painterly = painterly;`);
  await page.eval(PAGE);
  if (preview) await mkdir(preview, { recursive: true });
  const boxes = {}, seams = {};
  for (const house of only) {
    const m = MENTATS[house];
    const job = {
      frag: fragmentShader(m.scene).replace('out vec4 fragColor;', `out vec4 fragColor;\n${[...(args.defines || '').split(',').filter(Boolean), ...(args.turn ? [`TURN ${(Number(args.turn) * Math.PI / 180).toFixed(4)}`] : [])].map((d) => `#define ${d}`).join('\n')}`), vert: VERTEX_SHADER, frame: m.frame, eyeBoxes: [m.features.eyeL, m.features.eyeR], neckId: 25,
      scale, sup: args.sup ? Number(args.sup) : SUPER, backScale: preview ? scale : BACK_SCALE, preview: !!preview, quality: QUALITY,
      paint: args.raw ? null : { r: Math.max(1, Math.round(2.2 * scale)), mix: 0.8 }, back: chamber(house), crop, passes: args.passes ? args.passes.split(',') : null,
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
