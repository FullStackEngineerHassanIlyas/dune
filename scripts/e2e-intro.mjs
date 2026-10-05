// End-to-end checks of the opening before the title and of the campaign's ending (phase 3 intro stream; spec §5.8,
// scenes/menu-intro.js) in real Chrome: the gate shows and a key starts the opening, the music's context runs if the
// music is there, the opening hands over to the menu with no dip to black, a key or a click skips to the title without
// pressing a menu button, Esc at the gate goes straight to the title, ?intro=0 and an automated browser show the title at
// once, ?introAt holds a moment, reduced motion plays the short version, the ending dev scene plays and skips; and no
// console errors anywhere. Port: E2E_INTRO_PORT (8610 by default).
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launchChrome, openPage } from './cdp.mjs';
import { startServer } from './smoke.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.E2E_INTRO_PORT || 8610);
const shots = path.join(root, 'screenshots', 'e2e-intro');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
const url = (query) => `http://localhost:${PORT}/?${query}`;
const BASE = 'scene=menu&quality=low&seed=5';

await mkdir(shots, { recursive: true });
const server = await startServer(PORT);
const chrome = await launchChrome();
const problems = [];
let current = null;
/** Closes the page before (keeping its console problems: one WebGL page at a time) and opens the next. */
async function open(query) {
  await shut();
  current = await openPage(chrome, query === null ? 'about:blank' : url(query));
  if (query !== null) await current.waitFor('window.__dune && window.__dune.ready === true', 60000);
  return current;
}
async function shut() {
  if (!current) return;
  problems.push(...current.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[exception]')));
  try { await current.send('Page.close'); } catch { /* already gone */ }
  current.close();
  current = null;
}
const until = async (page, expr, ms = 10000) => { try { await page.waitFor(expr, ms); return true; } catch { return false; } };
const menuVisible = '(() => { const m = document.querySelector(".main-menu"); return !!m && !m.hidden && getComputedStyle(m).visibility !== "hidden" && !!document.querySelector(".mm-nav"); })()';

try {
  // the gate, a key, the opening, the hand-over
  let page = await open(`${BASE}&intro=1`);
  check('the opening waits at its gate', await until(page, 'window.__dune.intro && window.__dune.intro.phase === "gate" && !!document.querySelector(".intro-gate canvas")'));
  check('the menu is hidden behind the gate', await page.eval('document.querySelector(".main-menu").hidden === true'));
  await page.screenshot(path.join(shots, '01-gate.png'));
  await page.key('a');
  check('a key starts the opening', await until(page, 'window.__dune.intro.phase !== "gate" && window.__dune.intro.t > 0.3', 8000));
  const music = await page.eval('window.__dune.music ? (window.__dune.music.context ?? "none") : "absent"');
  if (music !== 'absent') check('the music\'s context runs from the gesture', await until(page, 'window.__dune.music.context === "running"', 5000), music);
  check('the menu stays hidden while it plays', await page.eval('document.querySelector(".main-menu").hidden === true'));
  check('it plays the ships at 19.6 s', (await page.eval('(window.__dune.intro.seek(19.6), window.__dune.intro.phase)')) === 'ships');
  await page.screenshot(path.join(shots, '02-ship.png'));
  await page.eval('window.__dune.intro.seek(29.4)');
  check('it hands over to the menu by itself at 30 s', await until(page, 'window.__dune.intro.done === true', 15000));
  const after = await page.eval(`(async () => { const out = []; for (const ms of [0, 120, 400]) { await new Promise((r) => setTimeout(r, ms)); out.push({ fade: getComputedStyle(document.querySelector(".mb-fade")).opacity, running: window.__dune.backdrop.running, phase: window.__dune.backdrop.phase }); } return out; })()`);
  check('the backdrop carries on warm: no dip to black at the hand-over', after.every((a) => Number(a.fade) < 0.01 && a.running && a.phase === 'planet'), JSON.stringify(after));
  check('the menu shows after it, on the title', await until(page, menuVisible, 3000) && (await page.eval('window.__dune.menu.screen')) === 'title');
  check('it was not skipped', (await page.eval('window.__dune.intro.skipped')) === false);
  await sleep(1200);
  check('the opening\'s layer is gone', await page.eval('!document.querySelector(".intro")'));
  await page.screenshot(path.join(shots, '03-handed-over.png'));

  // a key skips to the title and does not press the button the menu focuses
  page = await open(`${BASE}&intro=1`);
  await until(page, 'window.__dune.intro && window.__dune.intro.phase === "gate"');
  await page.key('a');
  await until(page, 'window.__dune.intro.t > 0.5', 8000);
  await page.key('Enter', { code: 'Enter' });
  check('Enter skips to the title', await until(page, 'window.__dune.intro.done === true && window.__dune.intro.skipped === true', 3000));
  await sleep(500);
  check('…and does not also press Skirmish', (await page.eval('window.__dune.menu.screen')) === 'title' && (await page.eval('!window.__dune.frame')));
  check('the menu shows', await until(page, menuVisible, 3000));

  // a click skips too, and its release does not reach the menu
  page = await open(`${BASE}&intro=1`);
  await until(page, 'window.__dune.intro && window.__dune.intro.phase === "gate"');
  await page.click(800, 450);
  check('a click starts the opening', await until(page, 'window.__dune.intro.phase !== "gate" && window.__dune.intro.t > 0.5', 8000));
  await page.click(220, 420);   // where the menu's buttons are, under the opening
  check('a click skips to the title', await until(page, 'window.__dune.intro.done === true', 3000));
  await sleep(500);
  check('…and its release presses nothing', (await page.eval('window.__dune.menu.screen')) === 'title');

  // Esc at the gate: straight to the title, no opening
  page = await open(`${BASE}&intro=1`);
  await until(page, 'window.__dune.intro && window.__dune.intro.phase === "gate"');
  await page.key('Escape', { code: 'Escape' });
  check('Esc at the gate goes straight to the title', await until(page, `window.__dune.intro.done === true && ${menuVisible}`, 3000));

  // no opening: ?intro=0, and an automated browser without ?intro=1
  for (const query of [`${BASE}&intro=0`, BASE]) {
    page = await open(query);
    await sleep(700);
    check(`${query.includes('intro=0') ? '?intro=0' : 'an automated browser'} shows the title at once`, (await page.eval(menuVisible)) && (await page.eval('!window.__dune.intro && !document.querySelector(".intro")')));
  }

  // ?introAt holds a moment
  page = await open(`${BASE}&introAt=21.2`);
  check('?introAt holds the opening at that moment', await until(page, 'window.__dune.intro && window.__dune.intro.frozen && window.__dune.intro.phase === "ships"', 8000));
  await sleep(600);
  check('…and stays there', Math.abs((await page.eval('window.__dune.intro.t')) - 21.2) < 1e-9);

  // reduced motion: the short still version
  page = await open(null);
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.send('Page.navigate', { url: url(`${BASE}&intro=1`) });
  await until(page, 'window.__dune && window.__dune.intro && window.__dune.intro.phase === "gate"', 60000);
  await page.key('a');
  check('reduced motion plays the short version', await until(page, 'window.__dune.intro.reduced === true && window.__dune.intro.t > 0.2', 8000));
  check('…and hands over within seconds', await until(page, 'window.__dune.intro.done === true', 12000));

  // the ending, on its own
  page = await open('scene=ending&house=ordos&quality=low&seed=5');
  check('the ending plays: the planet takes the victor\'s colour', await until(page, 'window.__dune.ending && window.__dune.ending.phase === "shimmer"', 8000));
  await page.eval('window.__dune.ending.seek(9)');
  await sleep(300);
  await page.screenshot(path.join(shots, '04-ending-shimmer.png'));
  await page.eval('window.__dune.ending.seek(16)');
  await sleep(300);
  check('then the credits roll', (await page.eval('window.__dune.ending.phase')) === 'credits' && (await page.eval('document.querySelectorAll(".ending-group").length')) > 2);
  await page.screenshot(path.join(shots, '05-ending-credits.png'));
  await page.key('x');
  check('any key ends it', await until(page, 'window.__dune.ending.done === true', 3000));
} catch (err) {
  failures++;
  console.log(`FAIL ${err.message}`);
} finally {
  await shut();
  check('no console errors', problems.length === 0, problems.join('\n'));
  await chrome.close();
  server.kill();
}
process.exit(failures ? 1 : 0);
