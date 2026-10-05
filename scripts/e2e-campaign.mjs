// End-to-end check of the campaign in real Chrome (spec §5.8, §7; contracts C2 and C3): main menu -> Campaign ->
// new campaign -> house (by keyboard) -> the house's pages and yes -> the Mentat's briefing -> proceed -> the region
// zoom -> the mission in its frame (the placeholder or the real mission scene, as long as it reports ready) -> a
// result posted as the frame would post it -> victory, Mentat, score, password -> the next briefing -> a reload
// keeps the progress -> a password jumps to a mission -> a defeat and a retry -> quitting a mission returns to its
// briefing -> Esc back to the title. Port: E2E_CAMPAIGN_PORT (default 8620). Screenshots in screenshots/e2e-campaign.
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { launchChrome, openPage } from './cdp.mjs';
import { startServer } from './smoke.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.E2E_CAMPAIGN_PORT || 8620);
const shots = path.join(root, 'screenshots', 'e2e-campaign');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
const URL = `http://localhost:${PORT}/?scene=menu&quality=low&seed=5&intro=0&backdrop=planet`;
const RESULT = (house, mission, won) => ({ dune: 'missionEnd', house, mission, won, draw: false, seconds: 14 * 60 + 5,
  stats: { won, seconds: 845, rows: [{ label: 'Spice harvested', you: 7014, enemy: 1553 }, { label: 'Units destroyed', you: 35, enemy: 6 }, { label: 'Units lost', you: 6, enemy: 35 },
    { label: 'Buildings destroyed', you: 4, enemy: 0 }, { label: 'Buildings lost', you: 0, enemy: 4 }] },
  score: { minutes: 15, credits: 2712, survivingValue: 31, killedValue: 9, lostValue: 0 } });

await mkdir(shots, { recursive: true });
const server = await startServer(PORT);
const chrome = await launchChrome();
let page;
try {
  page = await openPage(chrome, URL);
  const ev = (expr) => page.eval(expr);
  const ready = () => page.waitFor('window.__dune && window.__dune.ready === true && window.__dune.scene === "menu" && !!document.querySelector(".mm-nav")', 60000);
  // the title is up and can take a click: after ready the intro's gate (#app.intro-checked) may still hide the menu
  const menuUp = async () => {
    await ready();
    await page.waitFor('(() => { const m = document.querySelector(".main-menu"); return !!m && !m.hidden && getComputedStyle(m).visibility === "visible"; })()', 20000);
    await sleep(300);
  };
  await menuUp();
  const screen = () => ev('window.__dune.menu.screen');
  const waitScreen = (name, ms = 20000) => page.waitFor(`window.__dune.menu.screen === ${JSON.stringify(name)} && !document.querySelector(".cp-loading")`, ms);
  const center = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  // the element itself is what a click at its centre hits (not hidden, not covered while a screen fades in)
  const hittable = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.width > 0 && !!hit && el.contains(hit); })()`;
  const clickOn = async (sel) => {
    if (!(await ev(`!!document.querySelector(${JSON.stringify(sel)})`))) throw new Error(`no ${sel} on ${await screen()}`);
    await center(sel);
    if (!(await page.waitFor(hittable(sel), 10000).then(() => true, () => false))) throw new Error(`${sel} cannot be clicked on ${await screen()}`);
    const p = await center(sel);
    await page.click(p.x, p.y);
    await sleep(200);
  };
  // a key as the keyboard sends it (Enter and Space carry their character, so a focused button activates)
  const key = async (k) => {
    const text = { Enter: '\r', ' ': ' ' }[k];
    const code = { Enter: 13, ' ': 32, Escape: 27, ArrowRight: 39, ArrowLeft: 37 }[k] ?? 0;
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k === ' ' ? 'Space' : k, windowsVirtualKeyCode: code, ...(text ? { text } : {}) });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k === ' ' ? 'Space' : k, windowsVirtualKeyCode: code });
    await sleep(200);
  };
  const spoken = () => ev('document.querySelector(".cp-sr")?.textContent ?? null');
  const saved = () => ev('JSON.parse(localStorage.getItem("dune2-3d.campaign") || "null")');
  const frameReady = 'window.__dune.frame && window.__dune.frame.contentWindow && window.__dune.frame.contentWindow.__dune && window.__dune.frame.contentWindow.__dune.ready === true';
  const fromFrame = (message) => ev(`window.__dune.frame.contentWindow.eval(${JSON.stringify(`parent.postMessage(${JSON.stringify(message)}, location.origin)`)})`);

  check('the title shows the Sega lockup and Campaign first', (await ev('document.querySelector(".mm-brand h1").textContent')) === 'Dune'
    && (await ev('document.querySelector(".mm-nav .mm-item").dataset.act')) === 'campaign');
  await clickOn('[data-act="campaign"]');
  await waitScreen('campaign');
  check('Campaign opens the hub with New campaign and Enter password', await ev('!!document.querySelector(\'[data-act="new"]\') && !!document.querySelector(\'[data-act="password"]\')'));
  await page.screenshot(path.join(shots, '01-hub.png'));

  await clickOn('[data-act="new"]');
  await waitScreen('campaign-house');
  check('the crests stand in the Sega order', (await ev('[...document.querySelectorAll(".cp-house")].map((b) => b.dataset.house).join()')) === 'atreides,ordos,harkonnen');
  await page.screenshot(path.join(shots, '02-houses.png'));
  await key('ArrowRight');
  check('an arrow key moves to the next crest', (await ev('document.activeElement?.dataset.house')) === 'ordos');
  await key('Enter');
  await waitScreen('campaign-join');
  check('Enter picks the house: its pages', (await ev('document.querySelector(".cp-stage").dataset.house')) === 'ordos', await spoken());
  for (let i = 0; i < 6 && !(await ev('!!document.querySelector(\'[data-act="join"]\')')); i++) await clickOn('[data-act="next"]');
  check('after the pages, the question to join', await ev('!!document.querySelector(\'[data-act="join"]\') && !!document.querySelector(\'[data-act="decline"]\')'), await spoken());
  await page.screenshot(path.join(shots, '03-join.png'));
  await clickOn('[data-act="join"]');
  await waitScreen('campaign-briefing');
  check('yes opens the briefing of mission 1, saved', (await saved())?.houses?.ordos?.mission === 1 && (await saved())?.house === 'ordos');
  await sleep(1500);
  await page.screenshot(path.join(shots, '04-briefing.png'));
  const briefingText = await spoken();
  await clickOn('[data-act="advice"]');
  check('Advice shows other words, and back', (await spoken()) !== briefingText);
  await clickOn('[data-act="advice"]');

  await clickOn('[data-act="proceed"]');
  await waitScreen('campaign-region');
  await sleep(1200);
  await page.screenshot(path.join(shots, '05-region.png'));
  await key('Enter');
  await page.waitFor(frameReady, 120000);
  const src = await ev('window.__dune.frame.src');
  check('the mission opens in the frame for the house and mission', /scene=mission&house=ordos&mission=1(&|$)/.test(src), src);
  await sleep(500);
  await page.screenshot(path.join(shots, '06-mission.png'));

  await fromFrame(RESULT('ordos', 1, true));
  await waitScreen('campaign-results');
  check('the result closes the frame and opens the results', !(await ev('!!window.__dune.frame')) && (await saved())?.houses?.ordos?.mission === 2);
  check('first the victory card', await ev('!!document.querySelector(".cp-victory")'));
  await sleep(900);
  await page.screenshot(path.join(shots, '07-victory.png'));
  await clickOn('[data-act="continue"]');
  check('then the Mentat\'s win lines over the map', await ev('!!document.querySelector(".cp-win .cp-mapbox")'), await spoken());
  await sleep(2500);
  await page.screenshot(path.join(shots, '08-win.png'));
  await clickOn('[data-act="continue"]');
  check('then the score and the rank', (await ev('document.querySelector(\'[data-field="rank"]\')?.textContent')) === 'Desert Mongoose'
    && (await ev('document.querySelector(\'[data-field="score"]\')?.textContent')) === String(9 + 31 + 27 + (45 - 15)));
  await sleep(3000);
  await page.screenshot(path.join(shots, '09-score.png'));
  await key('Escape');
  check('then (Esc moves on) the password for mission 2', (await ev('document.querySelector(\'[data-field="password"]\')?.getAttribute("aria-label")')) === 'DOMINATION');
  await page.screenshot(path.join(shots, '10-password.png'));
  await clickOn('[data-act="continue"]');
  await waitScreen('campaign-briefing');
  check('then the next briefing', /Mission 2 of 9/i.test(await ev('document.querySelector(".cp-kicker").textContent')));

  await ev('location.reload()');
  await sleep(500);
  await menuUp();
  await clickOn('[data-act="campaign"]');
  await waitScreen('campaign');
  const cont = await ev('(() => { const b = document.querySelector(\'[data-act="continue"]\'); return b && { house: b.dataset.house, text: b.textContent }; })()');
  check('after a reload the hub continues House Ordos at mission 2', cont?.house === 'ordos' && /Mission 2/.test(cont.text), JSON.stringify(cont));

  await clickOn('[data-act="password"]');
  await waitScreen('campaign-password');
  check('the password entry has the focus', await ev('document.activeElement?.dataset.act === "password-input"'));
  await clickOn('[data-letter="C"]');
  await ev('(() => { const i = document.querySelector(".cp-pass-input"); i.value += "old hunter!"; i.dispatchEvent(new Event("input")); })()');
  check('typing keeps letters only, in capitals', (await ev('document.querySelector(".cp-pass-input").value')) === 'COLDHUNTER');
  await page.screenshot(path.join(shots, '11-password-entry.png'));
  await ev('document.querySelector(".cp-pass-input").focus()');
  await key('Enter');
  await waitScreen('campaign-briefing');
  check('the password jumps to Ordos mission 5 and saves it', (await saved())?.houses?.ordos?.mission === 5 && /Mission 5 of 9/i.test(await ev('document.querySelector(".cp-kicker").textContent')));

  await clickOn('[data-act="proceed"]');
  await clickOn('[data-act="start"]');
  await page.waitFor(frameReady, 120000);
  await fromFrame(RESULT('ordos', 5, false));
  await waitScreen('campaign-defeat');
  check('a lost mission shows the Mentat\'s lose lines', await ev('!!document.querySelector(".cp-defeat")'));
  await page.screenshot(path.join(shots, '12-defeat.png'));
  await clickOn('[data-act="retry"]');
  await waitScreen('campaign-briefing');
  check('Try again: the same mission\'s briefing', /Mission 5 of 9/i.test(await ev('document.querySelector(".cp-kicker").textContent')) && (await saved())?.houses?.ordos?.mission === 5);

  await clickOn('[data-act="proceed"]');
  await clickOn('[data-act="start"]');
  await page.waitFor(frameReady, 120000);
  await fromFrame({ dune: 'quit', screen: 'campaign' });
  await waitScreen('campaign-briefing');
  check('quitting the mission returns to its briefing', !(await ev('!!window.__dune.frame')) && /Mission 5 of 9/i.test(await ev('document.querySelector(".cp-kicker").textContent')));

  await key('Escape');
  check('Esc: the briefing goes back to the hub', (await screen()) === 'campaign');
  await key('Escape');
  check('and the hub to the title', (await screen()) === 'title' && await ev('!!document.querySelector(".mm-nav")'));
  const errors = page.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[exception]'));
  check('no errors in the console', errors.length === 0, errors.join(' | '));
} catch (err) {
  failures++;
  console.log(`FAIL ${err.message.split('\n')[0]}`);
  try { await page?.screenshot(path.join(shots, 'failure.png')); } catch { /* no page */ }
} finally {
  page?.close?.();
  await chrome.close();
  server.kill();
}
console.log(failures ? `${failures} check(s) failed` : 'all campaign checks passed');
process.exit(failures ? 1 : 0);
