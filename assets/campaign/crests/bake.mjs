// Bakes the house crests (src/ui/campaign/crests.js) to the WebP pictures the game shows, and lists them in
// src/ui/campaign/crests-baked.js with the fingerprint of the art each was baked from. Drawn in headless Chrome on a
// CPU-backed canvas: Chrome's GPU raster draws rectangular smears over the crests' SVG lighting filters on HiDPI
// screens and at large sizes, its software raster draws them right. Each is drawn at twice its size and scaled
// down (finer edges and engraving), then encoded. Every house, framed and shield, with its default engraving.
//   flock /tmp/dune-chrome.lock flock /tmp/dune-heavy.lock node assets/campaign/crests/bake.mjs
//   ... bake.mjs --only harkonnen                                   one house (the others keep their entries)
//   ... bake.mjs --preview <dir>                                     PNGs of the baked pictures, nothing written here
import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, openPage } from '../../../scripts/cdp.mjs';
import { crestArt, crestKey, CREST_HOUSES, VIEWBOX } from '../../../src/ui/campaign/crests.js';
import { BAKED } from '../../../src/ui/campaign/crests-baked.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1] ?? '']] : acc), []));
/** Pixels per crest unit: a house card is at most 300 CSS px (400 units), so 1.6 keeps it sharp on a 2x screen. */
const SCALE = 1.6, SUPER = 2, QUALITY = 0.9;

/** The fingerprint of a crest's art (the same in tests/crests-baked.test.mjs): its markup with fixed ids. */
const fingerprint = (house, variant) => createHash('sha256').update(crestArt(house, { variant, prefix: 'crest' })).digest('hex').slice(0, 16);

const PAGE = `
window.bakeCrest = async (svg, w, h, quality) => {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image(); img.src = url; await img.decode();
  const big = document.createElement('canvas'); big.width = w * ${SUPER}; big.height = h * ${SUPER};
  big.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, big.width, big.height);
  URL.revokeObjectURL(url);
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const g = out.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, w, h);
  return { webp: out.toDataURL('image/webp', quality).split(',')[1], png: out.toDataURL('image/png').split(',')[1] };
};`;

const houses = args.only ? args.only.split(',') : CREST_HOUSES;
const entries = { ...BAKED };
const chrome = await launchChrome({ width: 800, height: 600 });
try {
  const page = await openPage(chrome, 'about:blank');
  await page.eval(PAGE);
  for (const house of houses) {
    for (const variant of ['framed', 'shield']) {
      const [, , vw, vh] = VIEWBOX[variant];
      const w = Math.round(vw * SCALE), h = Math.round(vh * SCALE), file = `${house}-${variant}.webp`;
      const t0 = Date.now();
      const r = await page.eval(`window.bakeCrest(${JSON.stringify(crestArt(house, { variant }))}, ${w}, ${h}, ${QUALITY})`);
      if (!r?.webp) throw new Error(`${house} ${variant}: the bake drew nothing`);
      const webp = Buffer.from(r.webp, 'base64');
      if (args.preview) {
        await mkdir(args.preview, { recursive: true });
        await writeFile(path.join(args.preview, `${house}-${variant}.png`), Buffer.from(r.png, 'base64'));
      } else {
        await writeFile(path.join(here, file), webp);
        entries[crestKey(house, { variant })] = { file, w, h, art: fingerprint(house, variant) };
      }
      console.log(`${file} ${w}x${h} ${(webp.length / 1024).toFixed(0)} KB ${Date.now() - t0} ms`);
    }
  }
  page.close();
} finally {
  await chrome.close();
}

if (!args.preview) {
  const fmt = (e) => `{ file: '${e.file}', w: ${e.w}, h: ${e.h}, art: '${e.art}' }`;
  const lines = Object.keys(entries).sort().map((k) => `  '${k}': ${fmt(entries[k])},`);
  await writeFile(path.join(root, 'src/ui/campaign/crests-baked.js'), `// The house crests baked to WebP (written by assets/campaign/crests/bake.mjs; do not edit): for each crest look
// (crestKey), its file in assets/campaign/crests/, its size in pixels and the fingerprint of the art it was
// baked from (tests/crests-baked.test.mjs fails when a crest's art changes without a new bake).
export const BAKED = {
${lines.join('\n')}
};
`);
  console.log('wrote src/ui/campaign/crests-baked.js');
}
