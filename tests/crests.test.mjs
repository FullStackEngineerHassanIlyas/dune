// The house crests (src/ui/campaign/crests.js): every house's crest is a well-formed SVG whose art travels as an
// image (so its lighting filters are rasterised once), every reference inside resolves, ids are unique, and the
// markup stays small enough for the house selection to build quickly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crestSvg, crestArt, svgDataUrl, CREST_HOUSES, CREST_STYLES, VIEWBOX } from '../src/ui/campaign/crests.js';
import { smooth, spiral, tube, sample, shade } from '../src/ui/campaign/crests-geometry.js';
import { PLAYABLE_HOUSES, SKIRMISH_HOUSES } from '../src/data/houses.js';

/** The SVG document inside a crest's data: URL. */
const artOf = (markup) => {
  const m = /<image href="data:image\/svg\+xml,([^"]*)"/.exec(markup);
  assert.ok(m, 'the crest carries its art as an image');
  return decodeURIComponent(m[1]);
};

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
    assert.match(svg, /<image href="data:image\/svg\+xml,[^"]+" x="0" y="0" width="400" height="400"\/><\/svg>$/, house);
    const small = crestSvg(house, { variant: 'shield' });
    assert.match(small, /class="cp-crest-art cp-crest-shield" viewBox="76 52 248 310"/, house);
    assert.deepEqual(VIEWBOX.shield, [76, 52, 248, 310]);
  }
});

test('the art is well formed: balanced tags, no NaN, every url(#id) and #id reference defined once', () => {
  for (const house of CREST_HOUSES) {
    for (const opts of [{}, { variant: 'shield' }, { variant: 'shield', detail: true }, { detail: false }]) {
      const art = artOf(crestSvg(house, opts));
      const where = `${house} ${JSON.stringify(opts)}`;
      assert.ok(art.startsWith("<svg xmlns='http://www.w3.org/2000/svg'"), where);
      assert.ok(balanced(art), `${where}: tags balance`);
      assert.doesNotMatch(art, /NaN|undefined|Infinity|null/, where);
      assert.doesNotMatch(art, /"/, `${where}: no double quote inside the attribute`);
      const ids = [...art.matchAll(/ id='([^']+)'/g)].map((m) => m[1]);
      assert.equal(new Set(ids).size, ids.length, `${where}: ids are unique`);
      const refs = [...art.matchAll(/url\(#([^)]+)\)|href='#([^']+)'/g)].map((m) => m[1] ?? m[2]);
      assert.ok(refs.length > 10, where);
      for (const ref of refs) assert.ok(ids.includes(ref), `${where}: #${ref} is defined`);
    }
  }
});

test('the framed art has the frame, field, shield and the charge under its relief light; the bare shield only the shield', () => {
  const uses = (art, part) => new RegExp(`(url\\(#|href='#)cr\\d+at-${part}[)']`).test(art);
  const framed = artOf(crestSvg('atreides'));
  for (const part of ['mould', 'corner', 'mid', 'field', 'diaper', 'rim', 'enamel', 'relief', 'drop']) assert.ok(uses(framed, part), part);
  const bare = artOf(crestSvg('atreides', { variant: 'shield' }));
  assert.ok(!uses(bare, 'corner') && !uses(bare, 'diaper'), 'no frame or field round the bare shield');
  assert.ok(uses(bare, 'relief') && uses(bare, 'enamel'));
  // the fine engraving (breast scales, veins, rivets) is for the large crest only, unless asked for
  assert.ok(framed.length > bare.length);
  assert.ok(artOf(crestSvg('atreides', { variant: 'shield', detail: true })).length > bare.length);
});

test('each house shows its own colours: blue-green enamel for the hawk, a pale field for the serpent, crimson for the ram', () => {
  const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const [aTop] = CREST_STYLES.atreides.enamel;
  assert.ok(parseInt(aTop.slice(5, 7), 16) > parseInt(aTop.slice(1, 3), 16), 'Atreides enamel is blue-green');
  assert.ok(lum(CREST_STYLES.ordos.enamel[1]) > 200, 'Ordos field is pale');
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

test('the markup stays light: under 140 KB a framed crest, 60 KB a bare shield', () => {
  for (const house of CREST_HOUSES) {
    assert.ok(crestSvg(house).length < 140 * 1024, `${house} framed ${crestSvg(house).length}`);
    assert.ok(crestSvg(house, { variant: 'shield' }).length < 60 * 1024, `${house} shield`);
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
