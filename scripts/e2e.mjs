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
  page = await openPage(chrome, `http://localhost:${PORT}/?scene=skirmish&seed=11&house=atreides&quality=low&gameSpeed=fastest`);
  await page.waitFor('window.__dune && window.__dune.ready === true', 120000);
  await sleep(600);
  const ev = (expr) => page.eval(expr);
  const deselect = async () => { await page.click(8, 400, { button: 'right' }); await sleep(120); };

  const [tank] = await ev(`__dune.units('combatTank')`);
  let s = await ev(`__dune.screenOfUnit(${tank.id})`);
  await page.click(s.x, s.y);
  await sleep(150);
  check('click selects a tank', JSON.stringify(await ev('__dune.selection()')) === JSON.stringify([tank.id]));
  const snd = await ev('__dune.sound()');
  check('the first click starts the sound engine with every effect ready', snd.ready && snd.buffers >= 18, JSON.stringify(snd));

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

  let wt = null;
  for (let i = 0; i < 25 && !wt?.visible; i++) { await sleep(200); wt = await ev(`__dune.buttonRect('windtrap')`); }
  check('the deployed yard fills the structure strip', !!wt?.visible);
  const creditsBefore = await ev('__dune.credits()');
  await page.click(wt.x, wt.y);
  let ready = false;
  for (let i = 0; i < 600 && !ready; i++) {   // headless software GL runs ~2 fps; the sim catches up at most 0.25 s per frame
    await sleep(200);
    ready = (await ev(`__dune.sidebar().structures.find((i) => i.typeId === 'windtrap').state`)) === 'ready';
  }
  check('clicking the Wind Trap icon builds it and pays for it', ready && (await ev('__dune.credits()')) <= creditsBefore - 290);
  await page.click(wt.x, wt.y);
  await sleep(200);
  check('clicking a READY icon starts placement', (await ev('__dune.mode()')) === 'place');
  const spot = await ev(`__dune.findPlacement('windtrap')`);
  const ps = await ev(`__dune.screenOfFootprint('windtrap', ${spot.x}, ${spot.y})`);
  await page.mouse('mouseMoved', ps.x, ps.y, { button: 'none', held: 'none' });
  await sleep(250);
  await page.click(ps.x, ps.y);
  let trap = null;
  for (let i = 0; i < 25 && !trap; i++) { await sleep(150); trap = (await ev(`__dune.structures('windtrap')`)).find((s) => s.house === 'atreides') ?? null; }
  check('clicking the ground places the Wind Trap next to the yard', !!trap && trap.x === spot.x && trap.y === spot.y);
  check('the radar stays offline without an Outpost', (await ev('__dune.sidebar().radar')) === false);
  const sell = await ev(`__dune.toolRect('sell')`);
  await page.click(sell.x, sell.y);
  await sleep(150);
  const credits = await ev('__dune.credits()');
  const ts2 = await ev(`__dune.screenOfFootprint('windtrap', ${trap.x}, ${trap.y})`);
  await page.click(ts2.x, ts2.y);
  let sold = false;
  for (let i = 0; i < 25 && !sold; i++) { await sleep(150); sold = !(await ev(`__dune.structures('windtrap')`)).some((s) => s.house === 'atreides'); }
  check('sell mode sells the Wind Trap for a refund', sold && (await ev('__dune.credits()')) > credits);
  await deselect();
  check('right click leaves sell mode', (await ev('__dune.mode()')) === null);
  await page.key('p', { code: 'KeyP' });
  await sleep(300);
  const pausedAt = await ev('__dune.tick()');
  await sleep(1200);
  check('P pauses the simulation', (await ev('__dune.paused()')) && (await ev('__dune.tick()')) === pausedAt);
  await page.key('p', { code: 'KeyP' });
  await sleep(1200);
  check('P again resumes it', (await ev('__dune.tick()')) > pausedAt);

  const battle = await openPage(chrome, `http://localhost:${PORT}/?scene=battle&idle=1&quality=low&dist=24&gameSpeed=fastest`);
  await battle.waitFor('window.__dune && window.__dune.ready === true', 120000);
  await sleep(600);
  const bev = (expr) => battle.eval(expr);
  const [mine] = await bev(`__dune.units('combatTank')`);
  const foes = await bev(`__dune.units('combatTank', 'harkonnen')`);
  const foe = foes.sort((a, b) => Math.abs(a.ty - mine.ty) - Math.abs(b.ty - mine.ty))[0];
  await bev(`__dune.lookAt(${mine.x}, ${mine.y})`);   // click each unit in mid-screen, clear of the scrolling edges
  await sleep(500);
  const ms = await bev(`__dune.screenOfUnit(${mine.id})`);
  await battle.click(ms.x, ms.y);
  await sleep(300);
  await bev(`__dune.lookAt(${foe.x}, ${foe.y})`);
  await sleep(500);
  const fs = await bev(`__dune.screenOfUnit(${foe.id})`);
  await battle.click(fs.x, fs.y);
  let hurt = false;
  for (let i = 0; i < 600 && !hurt; i++) {   // the tanks start 26 tiles apart; headless GL runs ~2 fps
    await sleep(200);
    const f = await bev(`__dune.unit(${foe.id})`);
    hurt = !f || f.hp < 200;
  }
  check('a tank sent at an enemy tank drives up and hits it', hurt);
  const battleErrors = battle.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[exception]'));
  check('no console errors in the battle', battleErrors.length === 0, battleErrors.join(' | '));
  battle.close();
  const base = await openPage(chrome, `http://localhost:${PORT}/?scene=base&house=atreides&fog=0&damaged=1&capture=1&quality=low&gameSpeed=fastest`);
  await base.waitFor('window.__dune && window.__dune.ready === true', 120000);
  await sleep(600);
  const bv = (expr) => base.eval(expr);
  let up = await bv(`__dune.buttonRect('upgrade:heavyFactory')`);
  for (let i = 0; i < 24 && up && !up.visible; i++) {   // scroll the structure strip down to the upgrades
    const down = await bv(`__dune.arrowRect('structures', 1)`);
    await base.click(down.x, down.y);
    await sleep(150);
    up = await bv(`__dune.buttonRect('upgrade:heavyFactory')`);
  }
  if (up?.visible) await base.click(up.x, up.y);
  let level = 0;
  for (let i = 0; i < 300 && level < 1; i++) { await sleep(200); level = await bv(`__dune.upgradeLevel('heavyFactory')`); }
  check('clicking the Heavy Factory upgrade icon upgrades it', level === 1, `level ${level}`);

  const [bayS] = (await bv(`__dune.structures('repair')`)).filter((s) => s.house === 'atreides');
  const worn = (await bv(`__dune.units('combatTank')`)).find((u) => u.hp < 200);
  await bv(`__dune.lookAt(${bayS.x + 1.5}, ${bayS.y + 2.5})`);
  await sleep(500);
  const ws = await bv(`__dune.screenOfUnit(${worn.id})`);
  await base.click(ws.x, ws.y);
  await sleep(300);
  const bs = await bv(`__dune.screenOfFootprint('repair', ${bayS.x}, ${bayS.y})`);
  await base.click(bs.x, bs.y);
  let wentIn = false, fixed = false;
  for (let i = 0; i < 600 && !fixed; i++) {
    await sleep(200);
    const u = await bv(`__dune.unit(${worn.id})`);
    wentIn ||= !!u?.inside;
    fixed = !!u && u.hp === 200 && !u.inside;
  }
  check('a damaged tank clicked onto the Repair Facility goes in and comes out repaired', wentIn && fixed);

  const silo = (await bv(`__dune.structures('silo')`)).find((s) => s.house !== 'atreides');
  const squad = (await bv(`__dune.units('infantry')`)).sort((a, b) => b.id - a.id)[0];
  await bv(`__dune.lookAt(${silo.x + 1}, ${silo.y + 3})`);
  await sleep(500);
  const qs = await bv(`__dune.screenOfUnit(${squad.id})`);
  await base.click(qs.x, qs.y);
  await sleep(300);
  const ss = await bv(`__dune.screenOfFootprint('silo', ${silo.x}, ${silo.y})`);
  await base.click(ss.x, ss.y);
  let taken = false;
  for (let i = 0; i < 600 && !taken; i++) { await sleep(200); taken = (await bv(`__dune.structures('silo')`)).some((s) => s.id === silo.id && s.house === 'atreides'); }
  check('infantry clicked onto a ruined enemy silo capture it', taken);
  const baseErrors = base.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[exception]'));
  check('no console errors in the base', baseErrors.length === 0, baseErrors.join(' | '));
  base.close();
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
