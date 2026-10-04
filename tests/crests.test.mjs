// The house crests (src/ui/campaign/crests.js): every house's crest is an <svg> carrying its picture as an image
// (the baked WebP, or the vector art as a data: URL); the vector art is well formed, every reference inside
// resolves, ids are unique, no filter wraps the relief light, and the markup stays small.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crestSvg, crestArt, svgDataUrl, CREST_HOUSES, CREST_STYLES, VIEWBOX } from '../src/ui/campaign/crests.js';
import { BAKED } from '../src/ui/campaign/crests-baked.js';
import { smooth, spiral, tube, sample, shade } from '../src/ui/campaign/crests-geometry.js';
import { PLAYABLE_HOUSES, SKIRMISH_HOUSES } from '../src/data/houses.js';

/** The SVG document inside a crest's data: URL. */
const artOf = (markup) => {
  const m = /<image href="data:image\/svg\+xml,([^"]*)"/.exec(markup);
  assert.ok(m, 'the crest carries its art as an image');
  return decodeURIComponent(m[1]);
};
/** A crest's vector art as it travels in a data: URL (single quotes), whether or not the game shows it baked. */
const art = (house, opts) => artOf(`<image href="${svgDataUrl(crestArt(house, opts))}"`);

/** Tags open and close in order (self-closing tags aside). */
function balanced(xml) {
  const stack = [];
  for (const [, close, name, self] of xml.matchAll(/<(\/?)([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g)) {
    if (self) continue;
    if (!close) stack.push(name);
    else if (stack.pop() !== name) return false;
  }
  return stack.length === 0;
}

test('the three Great Houses and the minor houses of a skirmish have crests; others none', () => {
  for (const house of [...PLAYABLE_HOUSES, ...SKIRMISH_HOUSES, 'fremen']) assert.ok(CREST_HOUSES.includes(house), house);
  assert.equal(crestSvg('nobody'), '');
  assert.equal(crestArt('nobody'), '');
  assert.match(CREST_STYLES.atreides.label, /hawk/);
  assert.match(CREST_STYLES.ordos.label, /serpent/);
  assert.match(CREST_STYLES.harkonnen.label, /ram/);
});

test('a crest is an <svg> with its class, role and label, the art inside as an image filling the view box', () => {
  for (const house of CREST_HOUSES) {
    const svg = crestSvg(house);
    assert.match(svg, /^<svg class="cp-crest-art" viewBox="0 0 400 400" xmlns="http:\/\/www\.w3\.org\/2000\/svg" role="img" aria-label="[^"]+">/, house);
    assert.match(svg, /<image href="[^"]+" x="0" y="0" width="400" height="400"\/><\/svg>$/, house);
    const small = crestSvg(house, { variant: 'shield' });
    assert.match(small, /class="cp-crest-art cp-crest-shield" viewBox="76 52 248 310"/, house);
    assert.deepEqual(VIEWBOX.shield, [76, 52, 248, 310]);
  }
});

test('the art is well formed: balanced tags, no NaN, every url(#id) and #id reference defined once', () => {
  for (const house of CREST_HOUSES) {
    for (const opts of [{}, { variant: 'shield' }, { variant: 'shield', detail: true }, { detail: false }]) {
      const doc = art(house, opts);
      const where = `${house} ${JSON.stringify(opts)}`;
      assert.ok(doc.startsWith("<svg xmlns='http://www.w3.org/2000/svg'"), where);
      assert.ok(balanced(doc), `${where}: tags balance`);
      assert.doesNotMatch(doc, /NaN|undefined|Infinity|null/, where);
      assert.doesNotMatch(doc, /"/, `${where}: no double quote inside the attribute`);
      const ids = [...doc.matchAll(/ id='([^']+)'/g)].map((m) => m[1]);
      assert.equal(new Set(ids).size, ids.length, `${where}: ids are unique`);
      const refs = [...doc.matchAll(/url\(#([^)]+)\)|href='#([^']+)'/g)].map((m) => m[1] ?? m[2]);
      assert.ok(refs.length > 10, where);
      for (const ref of refs) assert.ok(ids.includes(ref), `${where}: #${ref} is defined`);
    }
  }
});

test('the framed art has the frame, field, shield and the charge under its relief light; the bare shield only the shield', () => {
  const uses = (doc, part) => new RegExp(`(url\\(#|href='#)cr\\d+at-${part}[)']`).test(doc);
  const framed = art('atreides');
  for (const part of ['mould', 'corner', 'mid', 'field', 'diaper', 'rim', 'enamel', 'relief', 'drop', 'shade', 'charge']) assert.ok(uses(framed, part), part);
  const bare = art('atreides', { variant: 'shield' });
  assert.ok(!uses(bare, 'corner') && !uses(bare, 'diaper'), 'no frame or field round the bare shield');
  assert.ok(uses(bare, 'relief') && uses(bare, 'enamel'));
  // the fine engraving (breast scales, veins, rivets) is for the large crest only, unless asked for
  assert.ok(framed.length > bare.length);
  assert.ok(art('atreides', { variant: 'shield', detail: true }).length > bare.length);
});

test('no filter wraps another round the relief light: the charge casts its shadow as a separate blurred copy', () => {
  // Chrome's GPU raster drew rectangular smears over the crests on HiDPI screens and at large sizes when a drop
  // shadow filter wrapped the charge's relief filter; the shadow is now a copy of the charge beside it
  for (const house of CREST_HOUSES) {
    for (const opts of [{}, { variant: 'shield' }]) {
      const doc = art(house, opts), stack = [];
      let reliefs = 0;
      for (const [, close, name, attrs, self] of doc.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
        if (close) { stack.pop(); continue; }
        const filtered = / filter='url\(#[^)]+\)'/.test(attrs);
        if (/ filter='url\(#[^)]+-relief\)'/.test(attrs)) {
          reliefs++;
          assert.ok(!stack.some((f) => f), `${house} ${JSON.stringify(opts)}: the relief group sits under no other filter`);
        }
        if (!self) stack.push(filtered);
      }
      assert.equal(reliefs, 1, `${house}: one relief pass`);
      const charge = /<g id='(cr\d+\w\w-charge)'/.exec(doc)?.[1];
      assert.ok(charge, `${house}: the charge is defined once`);
      assert.match(doc, new RegExp(`<use href='#${charge}' transform='translate\\(3 5\\)' filter='url\\(#cr\\d+\\w\\w-shade\\)'/>`), `${house}: its shadow`);
      assert.match(doc, new RegExp(`filter='url\\(#cr\\d+\\w\\w-relief\\)'><use href='#${charge}'/>`), `${house}: its relief`);
    }
  }
});

test('the Harkonnen ram\'s eyes burn over the relief light; the other charges have no glow', () => {
  const doc = art('harkonnen');
  const after = doc.slice(doc.indexOf('-relief)\'><use'));
  assert.match(after, /filter='url\(#cr\d+ha-glow\)'/, 'the glow comes after the relief group');
  for (const house of CREST_HOUSES.filter((h) => h !== 'harkonnen')) assert.doesNotMatch(art(house), /-glow\)/, house);
});

test('each house shows its own colours: blue-green enamel for the hawk, a pale field for the serpent, crimson for the ram', () => {
  const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const [aTop] = CREST_STYLES.atreides.enamel;
  assert.ok(parseInt(aTop.slice(5, 7), 16) > parseInt(aTop.slice(1, 3), 16), 'Atreides enamel is blue-green');
  assert.ok(lum(CREST_STYLES.ordos.enamel[1]) > 200, 'Ordos field is pale');
  assert.ok(lum(CREST_STYLES.ordos.enamel[0]) < 250, 'but ivory, not a glaring white');
  const [hr, hg] = [1, 3].map((i) => parseInt(CREST_STYLES.harkonnen.enamel[1].slice(i, i + 2), 16));
  assert.ok(hr > 3 * hg, 'Harkonnen field is red');
  assert.ok(CREST_STYLES.harkonnen.bordure, 'and bordered in black');
  for (const house of CREST_HOUSES) assert.equal(CREST_STYLES[house].gem.length, 3, `${house} jewels`);
});

test('crests are made once and reused; standalone art gets fresh ids so two can share a page', () => {
  assert.equal(crestSvg('ordos'), crestSvg('ordos'));
  assert.notEqual(crestSvg('ordos'), crestSvg('ordos', { variant: 'shield' }));
  const a = crestArt('ordos'), b = crestArt('ordos');
  const prefix = (s) => /id="(cr\d+or)-/.exec(s)[1];
  assert.notEqual(prefix(a), prefix(b));
});

test('the vector art stays light: under 140 KB a framed crest, 60 KB a bare shield', () => {
  for (const house of CREST_HOUSES) {
    const framed = svgDataUrl(crestArt(house)).length, bare = svgDataUrl(crestArt(house, { variant: 'shield' })).length;
    assert.ok(framed < 140 * 1024, `${house} framed ${framed}`);
    assert.ok(bare < 60 * 1024, `${house} shield ${bare}`);
  }
});

test('the data: URL escapes only what it must and decodes back to the document', () => {
  const doc = '<svg xmlns="http://www.w3.org/2000/svg">\n  <path id="a" d="M0 0L1 1" fill="url(#a)" opacity="50%"/>\n</svg>';
  const url = svgDataUrl(doc);
  assert.ok(url.startsWith('data:image/svg+xml,'));
  assert.doesNotMatch(url, /[\n"#<>]/);
  assert.equal(decodeURIComponent(url.slice(19)), "<svg xmlns='http://www.w3.org/2000/svg'><path id='a' d='M0 0L1 1' fill='url(#a)' opacity='50%'/></svg>");
});

test('geometry helpers: smooth paths close, spirals shrink to their end radius, tubes outline both edges', () => {
  assert.match(smooth([[0, 0], [10, 0], [10, 10]], true), /^M0 0C.*Z$/);
  const s = spiral([0, 0], 50, 10, 0, 1, 16);
  assert.equal(s.length, 17);
  assert.ok(Math.abs(Math.hypot(...s[0]) - 50) < 1e-9 && Math.abs(Math.hypot(...s.at(-1)) - 10) < 1e-9);
  const spine = sample([[0, 0], [50, 0], [100, 0]], 5);
  assert.equal(spine.length, 11);
  assert.match(tube(spine, () => 10), /^M.*Z$/);
  assert.equal(shade('#808080', 0.5), '#404040');
  assert.equal(shade('#000000', 1, '#ffffff', 0.5), '#808080');
});
