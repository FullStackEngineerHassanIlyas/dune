// The opening's gate and fall-backs (src/scenes/menu-intro.js): the pixel capitals cover every word it shows, the keys
// that count as the player's gesture, and runIntro's ways out to the title without it, in Node with stand-ins.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PIXEL_FONT, pixelRows, unlocksAudio, runIntro } from '../src/scenes/menu-intro.js';
import { CARDS } from '../src/game/intro-timeline.js';

test('the pixel capitals: 5 × 7, and every character the opening shows has a glyph', () => {
  for (const [ch, rows] of Object.entries(PIXEL_FONT)) {
    assert.equal(rows.length, 7, ch);
    assert.ok(rows.every((r) => Number.isInteger(r) && r >= 0 && r < 32), ch);
  }
  const words = ['PRESS ANY KEY', "AFTER WESTWOOD STUDIOS' 1992 GAME", ...CARDS.flatMap((c) => c.lines.map((l) => l.text))];
  for (const w of words) for (const ch of w) assert.ok(PIXEL_FONT[ch], `no glyph for ${JSON.stringify(ch)} in ${w}`);
  const distinct = new Set(Object.values(PIXEL_FONT).map((r) => r.join()));
  assert.equal(distinct.size, Object.keys(PIXEL_FONT).length, 'no two glyphs alike');
});

test('pixelRows lays the glyphs out a pixel apart', () => {
  const a = pixelRows('A');
  assert.deepEqual([a.width, a.height], [5, 7]);
  assert.equal(pixelRows('AB').width, 11);
  assert.equal(pixelRows('').width, 0);
  // the A's apex row: .###.
  assert.deepEqual([0, 1, 2, 3, 4].map((x) => a.on(x, 0)), [false, true, true, true, false]);
  const ab = pixelRows('ab');   // lower case shows in capitals
  assert.equal(ab.on(5, 3), false, 'the gap column');
  assert.equal(ab.on(6, 0), true, "B's first column");
});

test('Escape and a modifier alone do not count as the gesture that starts sound', () => {
  for (const key of ['a', 'Enter', ' ', 'ArrowUp', 'F1', 'Tab']) assert.equal(unlocksAudio(key), true, key);
  for (const key of ['Escape', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock']) assert.equal(unlocksAudio(key), false, key);
});

/** Stand-ins for runIntro's context. */
function fakes({ settings = {}, query = '', backdrop } = {}) {
  const calls = [];
  const p = new URLSearchParams(query);
  const params = { str: (k) => (p.has(k) ? p.get(k) : null), num: (k) => (p.has(k) ? Number(p.get(k)) : null) };
  const app = { classList: { add: (c) => calls.push(`app+${c}`), remove: () => {} } };
  const menu = { hide: () => calls.push('menu.hide'), show: () => calls.push('menu.show') };
  const music = { prime: () => calls.push('music.prime') };
  backdrop ??= { planet: {}, drawSpace() {}, lend: () => calls.push('backdrop.lend') };
  return { calls, ctx: { params, settings, app, backdrop, menu, music, startBackdrop: () => calls.push('startBackdrop'), debug: {} } };
}

test('without the opening the title stays as it is: Intro off, a held backdrop, a screen, no planet', async () => {
  for (const [settings, query, reason, backdrop] of [
    [{ intro: false }, '', 'setting'], [{}, 'backdrop=planet', 'backdrop'], [{}, 'screen=options', 'screen'], [{}, 'intro=1', 'no planet', { start() {} }],
  ]) {
    const { calls, ctx } = fakes({ settings, query, backdrop });
    const out = await runIntro(ctx);
    assert.deepEqual(out, { played: false, reason }, reason);
    assert.ok(calls.includes('music.prime'), 'the music is primed at load anyway');
    assert.ok(calls.includes('app+intro-checked'), 'the menu is let out of hiding');
    assert.ok(!calls.includes('menu.hide') && !calls.includes('menu.show'), `${reason}: the menu untouched`);
  }
});

test('if the opening breaks, it warns (never an error) and shows the title', async () => {
  const { calls, ctx } = fakes({ query: 'intro=1' });
  const warned = [], errors = [];
  const { warn, error } = console;
  console.warn = (...a) => warned.push(a.join(' '));
  console.error = (...a) => errors.push(a.join(' '));
  try {
    const out = await runIntro(ctx);   // no DOM in Node: building its layer throws
    assert.deepEqual(out, { played: false, reason: 'failed' });
  } finally { console.warn = warn; console.error = error; }
  assert.ok(warned.some((w) => w.startsWith('intro:')), warned.join('\n'));
  assert.deepEqual(errors, []);
  assert.ok(calls.indexOf('menu.hide') < calls.lastIndexOf('menu.show'), calls.join(' '));
});
