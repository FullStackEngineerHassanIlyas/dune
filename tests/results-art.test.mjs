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
    assert.match(css, new RegExp(`\\.cp-score-art\\[data-subject="${subject}"\\] span \\{ background-image: url\\(\\.\\./\\.\\./assets/campaign/results/line-${subject}\\.webp\\)`));
  }
  // the house's own picture for every house other than the default (Atreides) one
  for (const house of HOUSES.slice(1)) {
    for (const sel of [`.cp-victory[data-house="${house}"] .cp-card-pic`, `.cp-defeat[data-house="${house}"] .cp-card-pic`, `.cp-password-reveal[data-house="${house}"]::before`,
      `.cp-mentat-stage.cp-win[data-house="${house}"]`, `.cp-mentat-stage.cp-defeat[data-house="${house}"]`]) assert.ok(css.includes(sel), sel);
  }
  assert.match(css, /prefers-reduced-motion[^}]*\.cp-card-pic, \.cp-card-title, \.cp-tiles span \{ animation: none/);
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

test('the score screen engraves a tank, a trooper or an ornithopter in turn, mission by mission', () => {
  assert.deepEqual(Array.from({ length: 9 }, (_, i) => scoreSubject(i + 1)), ['tank', 'trooper', 'ornithopter', 'tank', 'trooper', 'ornithopter', 'tank', 'trooper', 'ornithopter']);
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
