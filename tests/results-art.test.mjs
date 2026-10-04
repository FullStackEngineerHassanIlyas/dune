// The pictures of the screens after a mission (src/ui/campaign/results-render.js → assets/campaign/results/): every
// picture the renderer knows is in the repo, real WebP at its size and small enough to load as a screen opens; the
// stylesheet puts each house's pictures and each score-screen subject in place; and the cards, the score screen and
// the password build the elements the stylesheet dresses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installDom } from './campaign-dom.mjs';

installDom();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { RESULT_ART } = await import('../src/ui/campaign/results-render.js');
const { victoryCard, defeatCard, scoreScreen, scoreSubject, SCORE_SUBJECTS, passwordReveal } = await import('../src/ui/campaign/results.js');
const { readResult } = await import('../src/campaign/result.js');

const DIR = path.join(root, 'assets/campaign/results');
const css = readFileSync(path.join(root, 'src/ui/campaign.css'), 'utf8');
const HOUSES = ['atreides', 'ordos', 'harkonnen'];

/** Splits `text` on `sep` outside parentheses and quotes (a data URI or a gradient keeps its commas and colons). */
function split(text, sep) {
  const out = [];
  let depth = 0, quote = null, start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === sep && depth === 0) { out.push(text.slice(start, i)); start = i + 1; }
  }
  out.push(text.slice(start));
  return out.map((t) => t.trim()).filter(Boolean);
}

/** The stylesheet's rules: { media, selectors, decl } with `media` the @media prelude around a rule ('' at the top). */
function cssRules(text) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const walk = (from, to, media) => {
    let i = from;
    while (i < to) {
      const open = src.indexOf('{', i);
      if (open < 0 || open >= to) break;
      const prelude = src.slice(i, open).trim();
      let depth = 1, j = open + 1;
      for (; j < to && depth; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; }
      const body = src.slice(open + 1, j - 1);
      if (prelude.startsWith('@media')) walk(open + 1, j - 1, prelude);
      else if (!prelude.startsWith('@')) {
        const decl = new Map(split(body, ';').map((d) => { const k = d.indexOf(':'); return [d.slice(0, k).trim(), d.slice(k + 1).trim()]; }));
        rules.push({ media, selectors: split(prelude, ','), decl });
      }
      i = j;
    }
  };
  walk(0, src.length, '');
  return rules;
}
const RULES = cssRules(css);
/** The declarations given to `selector` (merged in order), under `media` ('' the top level; a RegExp to match). */
function style(selector, media = '') {
  const out = new Map();
  for (const r of RULES) {
    if (!r.selectors.includes(selector)) continue;
    if (media instanceof RegExp ? !media.test(r.media) : r.media !== media) continue;
    for (const [k, v] of r.decl) out.set(k, v);
  }
  return out;
}

/** Width and height of a WebP file (simple lossy, lossless or extended). */
function webpSize(buf) {
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF');
  assert.equal(buf.toString('ascii', 8, 12), 'WEBP');
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  if (chunk === 'VP8L') { const b = buf.readUInt32LE(21); return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; }
  if (chunk === 'VP8X') return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  throw new Error(`unknown WebP chunk ${chunk}`);
}

test('every picture the renderer makes is in the repo: WebP at its size, each under 300 KB, under 2 MB together', () => {
  let total = 0;
  for (const [name, job] of Object.entries(RESULT_ART)) {
    const file = path.join(DIR, `${name}.webp`);
    assert.ok(existsSync(file), `${name}.webp is missing: node assets/campaign/results/make.mjs`);
    const { size } = statSync(file);
    total += size;
    assert.ok(size < 300 * 1024, `${name}.webp is ${Math.round(size / 1024)} KB`);
    assert.deepEqual(webpSize(readFileSync(file)), job.kind === 'line' ? [1600, 1000] : [1920, 1080], name);
  }
  assert.ok(total < 2 * 1024 * 1024, `${Math.round(total / 1024)} KB in all`);
});

test('the stylesheet points only at pictures that exist, and gives every house and subject its own', () => {
  const urls = [...css.matchAll(/url\(\.\.\/\.\.\/assets\/campaign\/results\/([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(urls.length > 0);
  for (const file of urls) assert.ok(existsSync(path.join(DIR, file)), `campaign.css names ${file}, which is not there`);
  for (const house of HOUSES) {
    for (const kind of ['victory', 'defeat']) assert.ok(urls.includes(`${kind}-${house}.webp`), `no ${kind} picture for ${house}`);
  }
  for (const subject of SCORE_SUBJECTS) {
    assert.ok(RESULT_ART[`line-${subject}`], `the renderer makes no line art of a ${subject}`);
    assert.equal(style(`.cp-score-art[data-subject="${subject}"] span`).get('background-image'), `url(../../assets/campaign/results/line-${subject}.webp)`);
  }
  // the house's own picture for every house other than the default (Atreides) one
  for (const house of HOUSES.slice(1)) {
    for (const sel of [`.cp-victory[data-house="${house}"] .cp-card-pic`, `.cp-defeat[data-house="${house}"] .cp-card-pic`, `.cp-password-reveal[data-house="${house}"]::before`,
      `.cp-mentat-stage.cp-win[data-house="${house}"]`, `.cp-mentat-stage.cp-defeat[data-house="${house}"]`]) assert.ok(css.includes(sel), sel);
  }
  assert.match(css, /prefers-reduced-motion[^}]*\.cp-card-pic, \.cp-card-title, \.cp-tiles span \{ animation: none/);
  // the gradient letters: a background shorthand on them would reset the text clip and paint a bar across the card
  for (const rule of css.match(/\.cp-card-title::after \{[^}]*\}/g)) {
    const at = rule.search(/[{;]\s*background:[^;]*;(?![\s\S]*[{;]\s*background:)/);
    if (at >= 0) assert.match(rule.slice(at + 1), /background-clip: text/, rule);
  }
});

test('the victory and defeat cards: their picture, title and line, and Continue', () => {
  let done = 0;
  for (const [build, kind, title, word] of [[victoryCard, 'victory', 'Victory', 'accomplished'], [defeatCard, 'defeat', 'Defeat', 'failed']]) {
    const el = build('ordos', 5, { onContinue: () => done++ });
    assert.deepEqual(el.className.split(' '), ['cp-stage', 'cp-card', `cp-${kind}`]);
    assert.equal(el.dataset.house, 'ordos');
    assert.ok(el.find((e) => e.className === 'cp-card-pic'), 'the picture');
    const h2 = el.find((e) => e.tagName === 'H2');
    assert.equal(h2.textContent, title);
    assert.equal(h2.dataset.text, title, 'the gradient letters copy the title');
    assert.equal(el.find((e) => e.tagName === 'P').textContent, `House Ordos · mission 5 ${word}`);
    el.find((e) => e.dataset?.act === 'continue').click();
  }
  assert.equal(done, 2);
});

test('the score screen engraves a tank, a soldier or an ornithopter in turn, mission by mission', () => {
  assert.deepEqual(Array.from({ length: 9 }, (_, i) => scoreSubject(i + 1)), ['tank', 'soldier', 'ornithopter', 'tank', 'soldier', 'ornithopter', 'tank', 'soldier', 'ornithopter']);
  assert.equal(scoreSubject(0), 'tank', 'a mission number out of range still draws something');
  const r = readResult({ dune: 'missionEnd', house: 'harkonnen', mission: 3, won: true, seconds: 600, stats: { rows: [] } });
  const el = scoreScreen(r, { later() {}, instant: true, onContinue() {} });
  const art = el.find((e) => e.className === 'cp-score-art');
  assert.equal(art.dataset.subject, 'ornithopter');
  assert.equal(art.getAttribute('aria-hidden'), 'true');
  assert.deepEqual(art.children.map((c) => c.className), ['cp-etch', 'cp-etch-lit'], 'the ink and the lit edge of the grooves');
});

test('the password tiles turn over one after another: each knows its place', () => {
  const el = passwordReveal('atreides', 4, 'DEFTHUNTER', { onContinue() {} });
  const tiles = el.find((e) => e.dataset?.field === 'password');
  assert.equal(tiles.getAttribute('aria-label'), 'DEFTHUNTER');
  assert.deepEqual(tiles.children.map((t) => t.style.cssText), Array.from({ length: 10 }, (_, i) => `--i: ${i}`));
  assert.deepEqual(tiles.children.map((t) => t.getAttribute('aria-hidden')), Array(10).fill('true'));
});

test('the Mentat\'s stages after a mission: the map\'s box fades into the picture, and the picture is set off his head', () => {
  for (const cls of ['cp-win', 'cp-defeat']) {
    const map = style(`.cp-mentat-stage.${cls} .cp-map`);
    const layers = split(map.get('--fade') ?? '', ',');
    assert.ok(layers.length === 2 && layers.every((l) => /^linear-gradient\(/.test(l) && /transparent/.test(l)), `${cls}: the map's edges fade both ways`);
    for (const prop of ['mask-image', '-webkit-mask-image']) assert.equal(map.get(prop), 'var(--fade)', prop);
    assert.equal(map.get('mask-composite'), 'intersect', 'both fades at once');
    const stage = style(`.cp-mentat-stage.${cls}`);
    const sizes = split(stage.get('background-size'), ','), at = split(stage.get('background-position'), ',');
    assert.equal(sizes.length, 3, 'two scrims and the picture');
    assert.match(sizes[2], /max\(100%, \d+vw\)/, 'the picture enlarged beyond the window');
    assert.match(at[2], /^100% /, 'and set to the right');
  }
});

test('the score screen\'s art stays inside the engraved frame, each subject in its own place, the numbers burnished over', () => {
  const art = style('.cp-score-art');
  assert.equal(art.get('overflow'), 'hidden', 'clipped (not a clip-path: that would isolate the blend modes)');
  assert.ok(!art.has('z-index') && !art.has('clip-path') && !art.has('mask-image') && !art.has('filter'), 'no stacking context on the art box');
  const frame = parseFloat(style('.cp-score::before').get('inset')) + parseFloat(style('.cp-score::before').get('border'));
  assert.ok(parseFloat(art.get('inset')) >= frame, `the art (inset ${art.get('inset')}) inside the frame line (${frame}px)`);
  const places = SCORE_SUBJECTS.map((subject) => {
    const own = style(`.cp-score-art[data-subject="${subject}"]`);
    assert.ok(own.get('--art-size') && own.get('--art-at'), `${subject} has its own size and place`);
    return `${own.get('--art-size')} ${own.get('--art-at')}`;
  });
  assert.equal(new Set(places).size, SCORE_SUBJECTS.length, 'no two subjects share a placement');
  const span = style('.cp-score-art span');
  assert.equal(span.get('background-size'), 'var(--art-size)');
  assert.equal(span.get('mask-image'), 'var(--art-fade)', 'faded toward the card');
  // the burnish is a solid field over the whole card (a radial fade would leave the number column bare)
  const burnish = style('.cp-score-card::before');
  assert.match(burnish.get('background'), /^rgba\(236,196,104,var\(--burnish\)\)$/);
  assert.ok(parseFloat(burnish.get('inset').split(' ')[1]) < 0, 'it reaches past the numbers at the right');
  // narrower than a wide screen: drawn whole and faint behind the card
  const narrow = style('.cp-score-art', /max-width: 1719px/);
  assert.equal(narrow.get('--art-size'), 'contain');
});

test('a short window: the score card compact, no sideways scroll, room kept under Continue', () => {
  const short = /max-height: 560px/;
  const score = style('.cp-score', short);
  assert.match(score.get('overflow'), /^hidden /, 'no sideways scroll');
  assert.ok(parseFloat(score.get('padding-bottom')) >= 44 + 20, 'the last row can clear the 44 px button');
  assert.equal(style('.cp-score-art', short).get('display'), 'none');
  assert.match(style('.cp-score-head b', short).get('font-size'), /min\(32px/);
});
