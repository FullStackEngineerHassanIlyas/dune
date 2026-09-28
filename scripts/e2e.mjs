// End-to-end: plays the opening of a skirmish with real mouse and keyboard input in headless Chrome
// and checks the simulation through window.__dune.
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launchChrome, openPage, MODIFIERS } from './cdp.mjs';
import { startServer } from './smoke.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.E2E_PORT || 8472);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); };

const server = await startServer(PORT);
const chrome = await launchChrome({ width: 1400, height: 800 });
let page;
try {
  page = await openPage(chrome, `http://localhost:${PORT}/?scene=skirmish&seed=11&house=atreides&quality=low`);
  await page.waitFor('window.__dune && window.__dune.ready === true', 120000);
  await sleep(600);
  const ev = (expr) => page.eval(expr);
  const deselect = async () => { await page.click(8, 400, { button: 'right' }); await sleep(120); };

  const [tank] = await ev(`__dune.units('combatTank')`);
  let s = await ev(`__dune.screenOfUnit(${tank.id})`);
  await page.click(s.x, s.y);
  await sleep(150);
  check('click selects a tank', JSON.stringify(await ev('__dune.selection()')) === JSON.stringify([tank.id]));

  const target = await ev(`__dune.freeTileNear(${tank.tx + 4}, ${tank.ty + 1})`);
  const ts = await ev(`__dune.screenOfTile(${target.x}, ${target.y})`);
  await sleep(350);
  await page.click(ts.x, ts.y);
  let arrived = false;
  for (let i = 0; i < 120 && !arrived; i++) {
    await sleep(200);
    const u = await ev(`__dune.unit(${tank.id})`);
    arrived = Math.max(Math.abs(u.tx - target.x), Math.abs(u.ty - target.y)) <= 1 && u.order === 'idle';
  }
  check('clicking the ground moves the selected tank there', arrived);

  await deselect();
  check('right click deselects', (await ev('__dune.selection()')).length === 0);

  const own = await ev('__dune.units()');
  const pts = (await Promise.all(own.map((u) => ev(`__dune.screenOfUnit(${u.id})`)))).filter((p) => p.visible);
  await page.drag(Math.min(...pts.map((p) => p.x)) - 30, Math.min(...pts.map((p) => p.y)) - 30, Math.max(...pts.map((p) => p.x)) + 30, Math.max(...pts.map((p) => p.y)) + 30);
  await sleep(150);
  const boxed = await ev('__dune.selection()');
  check('drag box selects several units', boxed.length >= 3, `${boxed.length} selected`);

  await page.key('1', { code: 'Digit1', modifiers: MODIFIERS.ctrl });
  await deselect();
  await page.key('1', { code: 'Digit1' });
  await sleep(120);
  check('control group 1 recalls the selection', (await ev('__dune.selection()')).length === boxed.length);

  await deselect();
  const [mcv] = await ev(`__dune.units('mcv')`);
  s = await ev(`__dune.screenOfUnit(${mcv.id})`);
  await page.click(s.x, s.y);
  await sleep(400);
  await page.click(s.x, s.y);
  let deployed = false;
  for (let i = 0; i < 25 && !deployed; i++) {
    await sleep(200);
    deployed = (await ev(`__dune.structures('constructionYard')`)).some((c) => c.house === 'atreides');
  }
  check('clicking the selected MCV again deploys a Construction Yard', deployed);

  await sleep(1500);
  await mkdir(path.join(root, 'screenshots'), { recursive: true });
  await page.screenshot(path.join(root, 'screenshots', 'e2e-final.png'));
  const errors = page.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[exception]'));
  check('no console errors or exceptions', errors.length === 0, errors.join(' | '));
} catch (err) {
  check('end-to-end run completed', false, err.message);
} finally {
  page?.close();
  await chrome.close();
  server.kill();
}
const failed = results.filter((ok) => !ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
