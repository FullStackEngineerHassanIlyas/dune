// Bakes the painted Mentat portraits (src/ui/campaign/portraits-*.js) to the WebP layers the game shows:
// <house>-back.webp (the chamber), -body, -head (it sways) and -lids (the closed eyes, for the blink), each cropped to
// what it paints, and writes their boxes to src/ui/campaign/portraits-layers.js. In headless Chrome: each layer's
// colour and material maps are rendered from SVG at twice the bake size, its height field is built from the
// painting's forms, it is lit (portraits-light.js), the painted overlay goes on top, and it is scaled down and encoded.
//   flock /tmp/dune-chrome.lock flock /tmp/dune-heavy.lock node assets/campaign/portraits/bake.mjs      bake all three
//   ... bake.mjs --only atreides                                       one Mentat (the boxes module is left alone)
//   ... bake.mjs --preview <dir> [--only house] [--scale 1.6]          composed PNG previews, nothing written here
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, openPage } from '../../../scripts/cdp.mjs';
import { MENTAT_PAINTINGS } from '../../../src/ui/campaign/portraits-mentats.js';
import { VIEW_W, VIEW_H, LAYERS } from '../../../src/ui/campaign/portraits-paint.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? '']] : acc), []));
/** Pixels per SVG unit: the portrait shows at most ~600 CSS px tall (500 units), so 2.4 keeps it sharp on a 2x
 *  screen; the chamber is blurred anyway and bakes at half that. */
const SCALE = 2.4, BACK_SCALE = 1.2, SUPER = 2;
const QUALITY = { back: 0.85, body: 0.9, head: 0.92, lids: 0.92 };

const PAGE = `
window.svgPixels = async (svg, w, h) => {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image(); img.src = url; await img.decode();
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  return ctx.getImageData(0, 0, w, h).data;
};
window.svgImage = async (svg) => { const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); const img = new Image(); img.src = url; await img.decode(); return img; };
window.rasterizePath = (d, bw, bh, scale, [x0, y0]) => {
  const cv = document.createElement('canvas'); cv.width = bw; cv.height = bh;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(scale, 0, 0, scale, -x0, -y0); ctx.fillStyle = '#fff'; ctx.fill(new Path2D(d));
  const px = ctx.getImageData(0, 0, bw, bh).data, out = new Float32Array(bw * bh);
  for (let i = 0; i < out.length; i++) out[i] = px[i * 4 + 3] / 255;
  return out;
};
const toCanvas = (rgba, w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0); return cv; };
const shrink = (src, w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(src, 0, 0, w, h); return cv; };
const encode = (cv, crop, fmt, q) => {
  let box = { x: 0, y: 0, w: cv.width, h: cv.height };
  if (crop) {
    const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (px[(y * cv.width + x) * 4 + 3] > 3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(cv.width - 1, x1 + 2); y1 = Math.min(cv.height - 1, y1 + 2);
    box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  const cut = document.createElement('canvas'); cut.width = box.w; cut.height = box.h;
  cut.getContext('2d').drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return { box, data: cut.toDataURL(fmt, q).split(',')[1] };
};
/** Units to pixels in a light rig (lengths are given in SVG units). */


window.bakeFigure = async (job) => {
  const S = job.scale * job.sup, w = Math.round(job.vw * S), h = Math.round(job.vh * S);
  const t0 = performance.now();
  const layer = async (L) => {
    const albedo = await svgPixels(L.albedo, w, h);
    const mat = L.mat ? await svgPixels(L.mat, w, h) : null;
    const f = field(w, h); addForms(f, L.forms, S, rasterizePath);
    return { albedo, mat, f, overlay: L.overlay };
  };
  const body = await layer(job.body), head = await layer(job.head), blink = await layer(job.blink);
  const sf = field(w, h);
  for (let i = 0; i < w * h; i++) { const a = head.albedo[i * 4 + 3] / 255, m = Math.max(body.f.d[i], head.f.d[i]); sf.d[i] = body.f.d[i] + (m - body.f.d[i]) * a; }
  const rig = rigToPx(job.rig, S);
  const lit = async (L) => {
    const rgba = shade({ w, h, albedo: L.albedo, height: L.f, shadowField: sf, mat: L.mat, rig });
    const cv = toCanvas(rgba, w, h);
    if (L.overlay) cv.getContext('2d').drawImage(await svgImage(L.overlay), 0, 0, w, h);
    return cv;
  };
  const fw = Math.round(job.vw * job.scale), fh = Math.round(job.vh * job.scale);
  const finish = (cv) => {
    if (!job.paint) return cv;
    const c = cv.getContext('2d', { willReadFrequently: true }), d = c.getImageData(0, 0, cv.width, cv.height);
    c.putImageData(new ImageData(painterly(d.data, cv.width, cv.height, Math.max(1, Math.round(job.paint.r * job.scale)), job.paint.mix), cv.width, cv.height), 0, 0);
    return cv;
  };
  const bodyCv = finish(shrink(await lit(body), fw, fh)), headCv = finish(shrink(await lit(head), fw, fh));
  const blinkFull = await lit(blink);
  const maskImg = await svgImage(job.lidsMask);
  const bctx = blinkFull.getContext('2d'); bctx.globalCompositeOperation = 'destination-in'; bctx.drawImage(maskImg, 0, 0, w, h);
  const lidsCv = finish(shrink(blinkFull, fw, fh));
  const bw = Math.round(job.vw * job.backScale), bh = Math.round(job.vh * job.backScale);
  const backCv = shrink(await (async () => { const cv = document.createElement('canvas'); cv.width = bw * job.sup; cv.height = bh * job.sup; cv.getContext('2d').drawImage(await svgImage(job.back), 0, 0, cv.width, cv.height); return cv; })(), bw, bh);
  const ms = Math.round(performance.now() - t0);
  if (job.preview) {
    const cv = document.createElement('canvas'); cv.width = fw; cv.height = fh; const c = cv.getContext('2d');
    c.drawImage(backCv, 0, 0, fw, fh); c.drawImage(bodyCv, 0, 0); c.drawImage(headCv, 0, 0);
    const blinkCv = document.createElement('canvas'); blinkCv.width = fw; blinkCv.height = fh; const bc = blinkCv.getContext('2d');
    bc.drawImage(cv, 0, 0); bc.drawImage(lidsCv, 0, 0);
    return { ms, full: encode(cv, false, 'image/png', 1).data, blink: encode(blinkCv, false, 'image/png', 1).data };
  }
  const q = job.quality;
  return { ms, layers: { back: encode(backCv, false, 'image/webp', q.back), body: encode(bodyCv, true, 'image/webp', q.body), head: encode(headCv, true, 'image/webp', q.head), lids: encode(lidsCv, true, 'image/webp', q.lids) } };
};`;

const light = (await readFile(path.join(root, 'src/ui/campaign/portraits-light.js'), 'utf8')).replace(/^export /gm, '');
const only = args.only ? [args.only] : Object.keys(MENTAT_PAINTINGS);
const preview = args.preview ? path.resolve(args.preview) : null;
const scale = preview ? Number(args.scale || 1.6) : SCALE;

const chrome = await launchChrome({ width: 800, height: 600 });
try {
  const page = await openPage(chrome, 'about:blank');
  await page.eval(`${light}\nwindow.field = field; window.addForms = addForms; window.shade = shade; window.rigToPx = rigToPx; window.painterly = painterly;`);
  await page.eval(PAGE);
  if (preview) await mkdir(preview, { recursive: true });
  const boxes = {};
  for (const house of only) {
    const m = MENTAT_PAINTINGS[house];
    const job = {
      vw: VIEW_W, vh: VIEW_H, scale, sup: SUPER, backScale: preview ? scale : BACK_SCALE, preview: !!preview, quality: QUALITY, rig: m.rig, paint: args.raw ? null : m.finish,
      back: m.paint('back'), lidsMask: m.paint('lidsmask'),
      body: m.layer('body'), head: m.layer('head'), blink: m.layer('head', { blink: true }),
    };
    const r = await page.eval(`window.bakeFigure(${JSON.stringify(job)})`);
    if (preview) {
      await writeFile(path.join(preview, `${house}.png`), Buffer.from(r.full, 'base64'));
      await writeFile(path.join(preview, `${house}-blink.png`), Buffer.from(r.blink, 'base64'));
      console.log('preview', house, `${r.ms} ms`);
      continue;
    }
    boxes[house] = {};
    for (const name of LAYERS) {
      const { box, data } = r.layers[name];
      const s = name === 'back' ? BACK_SCALE : SCALE;
      const bytes = Buffer.from(data, 'base64');
      await writeFile(path.join(here, `${house}-${name}.webp`), bytes);
      boxes[house][name] = [box.x / s, box.y / s, box.w / s, box.h / s].map((v) => Math.round(v * 100) / 100);
      console.log(`${house}-${name}.webp`, `${box.w}x${box.h}`, `${(bytes.length / 1024).toFixed(1)} KB`);
    }
    console.log(house, `${r.ms} ms`);
  }
  if (!preview && !args.only) {
    const body = Object.entries(boxes).map(([h, b]) => {
      const m = MENTAT_PAINTINGS[h];
      return `  ${h}: {\n    name: '${m.name}', pivot: [${m.pivot.join(', ')}],\n    layers: { ${LAYERS.map((l) => `${l}: [${b[l].join(', ')}]`).join(', ')} },\n  },`;
    }).join('\n');
    await writeFile(path.join(root, 'src/ui/campaign/portraits-layers.js'),
      `// Generated by assets/campaign/portraits/bake.mjs: each Mentat's name, the point his head turns about, and where\n// each baked layer sits in the portrait's 400 x 500 frame ([x, y, width, height] in SVG units). Bake again; do not\n// edit by hand.\nexport const PORTRAITS = {\n${body}\n};\n`);
    console.log('wrote src/ui/campaign/portraits-layers.js');
  }
  page.close();
} finally {
  await chrome.close();
}
