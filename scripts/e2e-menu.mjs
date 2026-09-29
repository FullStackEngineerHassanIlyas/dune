// End-to-end check of the main menu, the in-game menu and the scrolling controls in real Chrome:
// menu → skirmish set-up → battle in its frame; edge scrolling past the window edge; right-drag
// scrolling that neither clicks nor deselects; Esc and the Menu button; quitting back to the menu.
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launchChrome, openPage } from './cdp.mjs';
import { startServer } from './smoke.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.E2E_MENU_PORT || 8473);
const shots = path.join(root, 'screenshots', 'e2e-menu');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };

await mkdir(shots, { recursive: true });
const server = await startServer(PORT);
const chrome = await launchChrome();
let page;
try {
  await page?.close?.();
  page = await openPage(chrome, `http://localhost:${PORT}/?scene=menu&quality=low&seed=5`);
  await page.waitFor('window.__dune && window.__dune.ready === true && window.__dune.scene === "menu"', 60000);
  await sleep(400);
  const ev = (expr) => page.eval(expr);
  const center = (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r && { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  const clickOn = async (sel) => { const p = await center(sel); if (!p) throw new Error(`no ${sel}`); await page.click(p.x, p.y); await sleep(150); };
  await page.screenshot(path.join(shots, '01-title.png'));
  check('the address without a query opens the main menu', (await ev('!!document.querySelector(".mm-nav")')));
  check('the page wears the bronze arrow cursor', (await ev('getComputedStyle(document.body).cursor')).includes('data:image/svg'));

  await clickOn('[data-act="options"]');
  await page.screenshot(path.join(shots, '02-options.png'));
  await clickOn('.dm-seg [data-key="scheme"]:nth-child(2)');
  check('options change and are saved', (await ev('JSON.parse(localStorage.getItem("dune2-3d.settings")).scheme')) === 'modern');
  await clickOn('.dm-seg [data-key="scheme"]:nth-child(1)');
  await page.key('Escape');
  await sleep(150);
  check('Esc goes back to the title', await ev('!!document.querySelector(".mm-nav")'));

  await clickOn('[data-act="controls"]');
  await page.screenshot(path.join(shots, '03-controls.png'));
  await page.key('Escape');
  await sleep(100);

  await clickOn('[data-act="skirmish"]');
  await clickOn('[data-house="ordos"]');
  await page.screenshot(path.join(shots, '04-skirmish.png'));
  await clickOn('[data-act="start"]');
  await page.waitFor('window.__dune.frame && window.__dune.frame.contentWindow.__dune && window.__dune.frame.contentWindow.__dune.ready === true', 120000);
  await sleep(800);
  const g = (expr) => ev(`window.__dune.frame.contentWindow.__dune.${expr}`);
  check('Start battle opens the battle in its frame, as the chosen house', (await g('house')) === 'ordos');
  const src = await ev('window.__dune.frame.src');
  check('the set-up reaches the battle', /size=64/.test(src) && /ai=normal/.test(src) && /credits=3000/.test(src), src);
  await page.screenshot(path.join(shots, '05-battle.png'));
  check('the battlefield has a game cursor', (await g('cursor()')).canvas.includes('data:image/svg'));

  // edge scrolling past the top edge of the window keeps going
  await g('lookAt(32, 32)');
  await sleep(300);
  let cam0 = await g('camera()');
  await page.mouse('mouseMoved', 700, 2, { button: 'none', held: 'none' });
  await sleep(150);
  check('at the edge the cursor turns into a scroll arrow', (await g('cursor()')).scrolling);
  await page.mouse('mouseMoved', 700, -30, { button: 'none', held: 'none' });
  await sleep(600);
  let cam1 = await g('camera()');
  await sleep(400);
  const cam2 = await g('camera()');
  check('the pointer pushed out past the top edge keeps the map scrolling north', cam1.z < cam0.z - 1 && cam2.z < cam1.z - 0.5, `${cam0.z.toFixed(1)} → ${cam1.z.toFixed(1)} → ${cam2.z.toFixed(1)}`);
  await page.mouse('mouseMoved', 700, 400, { button: 'none', held: 'none' });
  await sleep(300);
  cam0 = await g('camera()');
  await sleep(300);
  cam1 = await g('camera()');
  check('back inside, the scrolling stops', Math.abs(cam1.z - cam0.z) < 0.05 && !(await g('cursor()')).scrolling);

  // right-drag scrolling: no click, no deselect
  const [tank] = await g('units("combatTank")');
  await g(`lookAt(${tank.x}, ${tank.y})`);
  await sleep(500);
  const ts = await g(`screenOfUnit(${tank.id})`);
  await page.click(ts.x, ts.y);
  await sleep(150);
  check('a tank is selected', (await g('selection()')).includes(tank.id));
  cam0 = await g('camera()');
  await page.mouse('mouseMoved', 600, 450, { button: 'none', held: 'none' });
  await page.mouse('mousePressed', 600, 450, { button: 'right' });
  for (let i = 1; i <= 8; i++) { await page.mouse('mouseMoved', 600 + i * 30, 450, { button: 'right', held: 'right' }); await sleep(30); }
  await sleep(400);
  check('while pulling, the anchor shows and the cursor points the way', (await g('cursor()')).scrolling && (await ev('getComputedStyle(window.__dune.frame.contentDocument.querySelector(".pull-anchor")).display')) === 'block');
  await page.screenshot(path.join(shots, '06-right-drag.png'));
  await page.mouse('mouseReleased', 840, 450, { button: 'right' });
  await sleep(200);
  cam1 = await g('camera()');
  check('holding the right button and pulling right scrolls east', cam1.x > cam0.x + 1, `${cam0.x.toFixed(1)} → ${cam1.x.toFixed(1)}`);
  check('the right-drag neither deselected nor ordered', (await g('selection()')).includes(tank.id) && (await g(`unit(${tank.id})`)).order === 'idle');

  // the in-game menu
  await page.key('Escape');
  await sleep(200);
  check('Esc opens the game menu and pauses', (await g('menuOpen()')) && (await g('paused()')));
  const t0 = await g('tick()');
  await sleep(500);
  check('the battle stands still under the menu', (await g('tick()')) === t0);
  await page.screenshot(path.join(shots, '07-game-menu.png'));
  await page.key('Escape');
  await sleep(200);
  check('Esc resumes', !(await g('menuOpen()')) && !(await g('paused()')));
  const menuBtn = await ev('(() => { const r = window.__dune.frame.contentDocument.querySelector(".sb-menu").getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()');
  await page.click(menuBtn.x, menuBtn.y);
  await sleep(200);
  check('the sidebar Menu button opens the menu', await g('menuOpen()'));
  const inFrame = async (sel) => {
    const p = await ev(`(() => { const r = window.__dune.frame.contentDocument.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    await page.click(p.x, p.y);
    await sleep(200);
  };
  await inFrame('[data-act="options"]');
  await page.screenshot(path.join(shots, '08-game-options.png'));
  await page.key('Escape');
  await sleep(150);
  await inFrame('[data-act="quit"]');
  await inFrame('[data-act="confirm-quit"]');
  await sleep(500);
  check('Quit to main menu closes the battle and shows the menu', (await ev('window.__dune.frame === null')) && (await ev('!document.querySelector(".main-menu").hidden')));
  await page.screenshot(path.join(shots, '09-back.png'));

  // full screen carries from the menu into the battle, and the battle can leave it
  await clickOn('.mm-fs');
  await sleep(400);
  check('the Full screen button makes the page full screen', await ev('!!document.fullscreenElement'));
  await ev(`window.__dune.launch('scene=skirmish&seed=3&house=atreides&size=48')`);
  await page.waitFor('window.__dune.frame && window.__dune.frame.contentWindow.__dune && window.__dune.frame.contentWindow.__dune.ready === true', 120000);
  await sleep(500);
  check('the battle starts still in full screen', await ev('!!document.fullscreenElement'));
  await page.key('F10');
  await sleep(200);
  const label = await ev('window.__dune.frame.contentDocument.querySelector(\'[data-act="fullscreen"]\')?.textContent');
  check('the game menu offers to leave full screen', label === 'Leave full screen', label);
  await inFrame('[data-act="fullscreen"]');
  await sleep(400);
  check('and leaves it', await ev('!document.fullscreenElement'));
  const errors = page.logs.filter((l) => /exception|error/i.test(l));
  check('no errors in the console', errors.length === 0, errors.join('\n'));
} catch (err) {
  failures++;
  console.error(err);
  if (page) console.error(page.logs.join('\n'));
} finally {
  page?.close();
  await chrome.close();
  server.kill();
}
console.log(failures ? `${failures} check(s) failed` : 'all menu and control checks passed');
process.exit(failures ? 1 : 0);
