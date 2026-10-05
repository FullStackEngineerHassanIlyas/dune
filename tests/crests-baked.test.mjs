// The house crests baked to WebP (assets/campaign/crests/bake.mjs, listed in src/ui/campaign/crests-baked.js): every
// house has its framed crest and its shield baked, the pictures are real WebP files within the size budget, each
// was baked from the art the code draws now, and the crests the game shows use them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { crestSvg, crestArt, crestKey, CREST_HOUSES, VIEWBOX } from '../src/ui/campaign/crests.js';
import { BAKED } from '../src/ui/campaign/crests-baked.js';

const file = (name) => new URL(`../assets/campaign/crests/${name}`, import.meta.url);
/** The art's fingerprint, as bake.mjs takes it: its markup with fixed ids. */
const fingerprint = (house, variant) => createHash('sha256').update(crestArt(house, { variant, prefix: 'crest' })).digest('hex').slice(0, 16);

test('every house has its framed crest and its bare shield baked, at 1.6 px a unit', () => {
  for (const house of CREST_HOUSES) {
    for (const variant of ['framed', 'shield']) {
      const entry = BAKED[crestKey(house, { variant })];
      assert.ok(entry, `${house} ${variant} is baked`);
      assert.equal(entry.file, `${house}-${variant}.webp`);
      const [, , w, h] = VIEWBOX[variant];
      assert.deepEqual([entry.w, entry.h], [Math.round(w * 1.6), Math.round(h * 1.6)], `${house} ${variant} size`);
    }
  }
  assert.equal(Object.keys(BAKED).length, CREST_HOUSES.length * 2, 'nothing else');
});

test('each picture was baked from the art the code draws now (run assets/campaign/crests/bake.mjs after a change)', () => {
  for (const [key, entry] of Object.entries(BAKED)) {
    const [house, variant] = key.split('/');
    assert.equal(entry.art, fingerprint(house, variant), `${key} is stale: bake it again`);
  }
});

test('the pictures are WebP files, each under 300 KB and all under 2 MB', () => {
  let total = 0;
  for (const entry of Object.values(BAKED)) {
    const bytes = readFileSync(file(entry.file));
    assert.equal(bytes.subarray(0, 4).toString('latin1'), 'RIFF', entry.file);
    assert.equal(bytes.subarray(8, 12).toString('latin1'), 'WEBP', entry.file);
    const size = statSync(file(entry.file)).size;
    assert.ok(size < 300 * 1024, `${entry.file} ${size} bytes`);
    total += size;
  }
  assert.ok(total < 2 * 1024 * 1024, `${total} bytes in all`);
});

test('the game shows the baked pictures; a look that is not baked shows the vector art', () => {
  for (const house of CREST_HOUSES) {
    assert.match(crestSvg(house, { narrow: false }), new RegExp(`<image href="[^"]*/assets/campaign/crests/${house}-framed\\.webp" x="0" y="0" width="400" height="400"/></svg>$`), house);
    assert.match(crestSvg(house), new RegExp(`<image href="[^"]*/assets/campaign/crests/${house}-framed\\.webp" x="0" y="0" width="400" height="400"/></svg><svg [^>]*><image href="[^"]*/assets/campaign/crests/${house}-shield\\.webp" x="76" y="52" width="248" height="310"/></svg>$`), `${house}: both baked, for wide and narrow screens`);
    assert.match(crestSvg(house, { variant: 'shield' }), new RegExp(`<image href="[^"]*/assets/campaign/crests/${house}-shield\\.webp" x="76" y="52" width="248" height="310"/></svg>$`), house);
    assert.match(crestSvg(house, { detail: false }), /<image href="data:image\/svg\+xml,/, `${house} without engraving`);
  }
  assert.equal(crestKey('ordos'), 'ordos/framed/true');
  assert.equal(crestKey('ordos', { variant: 'shield' }), 'ordos/shield/false');
});
