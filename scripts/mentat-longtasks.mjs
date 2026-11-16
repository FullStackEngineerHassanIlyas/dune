// The original Mentat's pictures made on the main menu, measured: headless Chrome (SwiftShader), the CPU throttled
// (DevTools Emulation.setCPUThrottlingRate, 6x by default, on the page and on any worker it starts), the page's long
// tasks (PerformanceObserver 'longtask') from the click on Campaign until every Mentat is made, while the hub makes
// them from a made-up copy of the player's files: a DUNE.PAK read by the game's own import (Options → Original Game
// Files does the same), with 320 x 200 rooms and the parts as large as the PC files have them (Cyril's eyes 48 x 16,
// mouth 48 x 40, book 96 x 48 …; notes 2026-10-05-original-art.md), drawn as dithered pixel art (no game data).
// A CPU profile of the page's thread says what ran in each long task: the share in the pictures' code
// (pixel-scale.js, png.js, picture-work.js, picture-jobs.js, original-mentat-art.js, original-pictures.js)
// and the busiest functions. A run with --control reads no files: the menu's own long tasks.
// Usage: node scripts/mentat-longtasks.mjs [--runs 3] [--rate 6] [--control] [--json]
// Port: SHOT_PORT (default 8500).
import { launchChrome } from './cdp.mjs';
import { startServer } from './smoke.mjs';
import { detailedDunePak } from '../tests/original-art-fakes.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : fallback; };
const RUNS = opt('runs', 3), RATE = opt('rate', 6), CONTROL = args.includes('--control'), JSON_OUT = args.includes('--json');
const PORT = Number(process.env.SHOT_PORT || 8500);
const URL = `http://localhost:${PORT}/?scene=menu&quality=low&seed=5&intro=0&backdrop=planet`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ——— a DevTools connection with sessions (the page's own and its workers') ———

async function connect(chrome, url) {
  const target = await (await fetch(`http://127.0.0.1:${chrome.port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 0;
  const pending = new Map(), handlers = new Map(), logs = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      return;
    }
    const who = msg.sessionId ? 'worker' : 'page';
    if (msg.method === 'Runtime.consoleAPICalled') logs.push(`[${who} ${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    if (msg.method === 'Runtime.exceptionThrown') logs.push(`[${who} exception] ${msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text}`);
    for (const fn of handlers.get(msg.method) ?? []) fn(msg.params, msg.sessionId);
  };
  const send = (method, params = {}, sessionId = undefined) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const on = (method, fn) => { if (!handlers.has(method)) handlers.set(method, []); handlers.get(method).push(fn); };
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const waitFor = async (expression, ms = 60000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      try { if (await ev(expression)) return; } catch { /* still loading */ }
      await sleep(100);
    }
    throw new Error(`timed out waiting for ${expression}\n${logs.join('\n')}`);
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: chrome.width, height: chrome.height, deviceScaleFactor: 1, mobile: false });
  return { send, on, ev, waitFor, logs, close: () => { ws.close(); return fetch(`http://127.0.0.1:${chrome.port}/json/close/${target.id}`).catch(() => {}); } };
}

// ——— what ran in a long task ———

const PICTURE_FILES = ['pixel-scale.js', 'png.js', 'picture-work.js', 'picture-jobs.js', 'original-mentat-art.js', 'original-pictures.js'];
const base = (url) => (url ? url.split('/').pop().split('?')[0] : '');

/** Samples of a CPU profile as { t (ms, the profile's clock), stack: [callFrame…] leaf first }. */
function samplesOf(profile) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n])), parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const stacks = new Map();
  const stackOf = (id) => {
    if (stacks.has(id)) return stacks.get(id);
    const out = [];
    for (let k = id; k !== undefined; k = parent.get(k)) out.push(nodes.get(k).callFrame);
    stacks.set(id, out);
    return out;
  };
  let t = profile.startTime;
  return profile.samples.map((id, i) => { t += profile.timeDeltas[i]; return { t: t / 1000, stack: stackOf(id) }; });
}

function breakdown(samples, from, to) {
  let n = 0, pictures = 0, idle = 0;
  const leaves = new Map();
  for (const s of samples) {
    if (s.t < from || s.t >= to) continue;
    const leaf = s.stack[0];
    if (leaf.functionName === '(idle)') { idle++; continue; }
    n++;
    if (s.stack.some((f) => PICTURE_FILES.includes(base(f.url)))) pictures++;
    const key = `${leaf.functionName || '(anonymous)'}${leaf.url ? ` ${base(leaf.url)}` : ''}`;
    leaves.set(key, (leaves.get(key) ?? 0) + 1);
  }
  const top = [...leaves].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, c]) => `${k} ${Math.round((c / Math.max(1, n)) * 100)}%`);
  return { samples: n, idle, pictures: n ? pictures / n : 0, top };
}

// ——— one run: a fresh browser ———

async function run(pak, k) {
  const chrome = await launchChrome();
  const page = await connect(chrome, URL);
  try {
    const menuUp = async () => {
      await page.waitFor('window.__dune && window.__dune.ready === true && window.__dune.scene === "menu" && !!document.querySelector(".mm-nav")');
      await page.waitFor('(() => { const m = document.querySelector(".main-menu"); return !!m && !m.hidden && getComputedStyle(m).visibility === "visible"; })()', 20000);
    };
    await menuUp();
    let files = null;
    if (pak) {
      // the game's own import, as Options → Original Game Files reads a picked DUNE.PAK; kept in the browser's store
      files = await page.ev(`(async () => {
        const b = Uint8Array.from(atob(${JSON.stringify(Buffer.from(pak).toString('base64'))}), (c) => c.charCodeAt(0));
        const f = await import('/src/core/user-files.js');
        const r = await f.importFiles([{ name: 'DUNE.PAK', data: b.buffer }]);
        const s = await f.pictureSummary();
        return { pictures: r.pictures, count: s.count, on: s.on, storage: s.storage };
      })()`);
      if (files.count !== 6 || !files.on) throw new Error(`the made-up files were not taken: ${JSON.stringify(files)}`);
    }
    await page.send('Page.reload');   // a fresh page: the menu as a player opens it, the files in its store
    await sleep(500);
    await menuUp();
    await sleep(2500);   // the backdrop compiled and running
    // the throttle on the page and on any worker it starts (DevTools applies it per target)
    const workers = [];
    page.on('Target.attachedToTarget', async ({ sessionId, targetInfo }) => {
      const w = { type: targetInfo.type, url: base(targetInfo.url), throttled: null };
      workers.push(w);
      try { await page.send('Runtime.enable', {}, sessionId); } catch { /* not every target has it */ }
      try { await page.send('Emulation.setCPUThrottlingRate', { rate: RATE }, sessionId); w.throttled = true; } catch (err) { w.throttled = err.message; }
      try { await page.send('Runtime.runIfWaitingForDebugger', {}, sessionId); } catch { /* not waiting */ }
    });
    await page.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
    await page.send('Emulation.setCPUThrottlingRate', { rate: RATE });
    await page.ev(`(() => {
      window.__mw = { lt: [] };
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__mw.lt.push({ start: e.startTime, dur: e.duration }); }).observe({ type: 'longtask' });
    })()`);
    await page.send('Profiler.enable');
    await page.send('Profiler.setSamplingInterval', { interval: 500 });
    await page.send('Profiler.start');
    // a mark both clocks see: this loop's first sample in the profile is at the page's performance.now() it returns
    const tCal = await page.ev('(function __mwCalibrate() { const t0 = performance.now(); while (performance.now() - t0 < 40) {} return t0; })()');
    await sleep(300);
    // Campaign on the title: the hub (the backdrop runs behind it) asks for the words and the pictures, the house on
    // the screen (Atreides on a new profile) first; the times the first Mentat and all of them are there
    const t0 = await page.ev(`(async () => {
      const m = await import('/src/ui/campaign/original-pictures.js');
      const t = performance.now();
      document.querySelector('[data-act="campaign"]').click();
      window.__mw.first = null; window.__mw.all = null;
      m.loadOriginalPicturesWithin(120000).then(() => { window.__mw.first = performance.now(); });
      m.loadOriginalPictures().then((v) => { window.__mw.all = performance.now(); window.__mw.made = v ? Object.keys(v.mentats).sort() : []; });
      return t;
    })()`);
    await page.waitFor('window.__mw.all !== null', 120000);
    const done = await page.ev('window.__mw.all');
    const end = Math.max(t0 + 4000, done + 1500);
    while ((await page.ev('performance.now()')) < end) await sleep(200);
    const { profile } = await page.send('Profiler.stop');
    await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const mw = await page.ev('({ lt: window.__mw.lt, first: window.__mw.first, all: window.__mw.all, made: window.__mw.made, words: !document.querySelector(".cp-loading") })');
    const samples = samplesOf(profile);
    const cal = samples.find((s) => s.stack.some((f) => f.functionName === '__mwCalibrate'));
    const offset = cal ? cal.t - tCal : null;
    const tasks = mw.lt.filter((e) => e.start + e.dur > t0 && e.start < end).map((e) => {
      const b = offset === null ? null : breakdown(samples, e.start + offset, e.start + e.dur + offset);
      return { at: Math.round(e.start - t0), ms: Math.round(e.dur), pictures: b ? Math.round(b.pictures * 100) : null, top: b?.top ?? [] };
    });
    const errors = page.logs.filter((l) => /error|exception/i.test(l));
    return { run: k, files, made: mw.made, first: mw.first && Math.round(mw.first - t0), all: Math.round(mw.all - t0), words: mw.words,
      workers, calibrated: offset !== null, tasks, errors };
  } finally {
    await page.close();
    await chrome.close();
  }
}

const server = await startServer(PORT);
try {
  const pak = CONTROL ? null : detailedDunePak();
  const results = [];
  for (let k = 1; k <= RUNS; k++) {
    const r = await run(pak, k);
    results.push(r);
    if (JSON_OUT) { console.log(JSON.stringify(r)); continue; }
    console.log(`run ${k}${CONTROL ? ' (control: no files)' : ''}: made ${r.made?.join(',') || 'nothing'}; first Mentat at ${r.first} ms, all at ${r.all} ms; workers ${JSON.stringify(r.workers)}`);
    for (const t of r.tasks) console.log(`  long task at +${t.at} ms: ${t.ms} ms, ${t.pictures}% in the pictures' code — ${t.top.join(', ')}`);
    if (!r.tasks.length) console.log('  no long task');
    for (const e of r.errors) console.log(`  ${e}`);
  }
  const big = (t) => t.pictures !== null && t.pictures >= 50;
  const theirs = results.flatMap((r) => r.tasks.filter(big)), all = results.flatMap((r) => r.tasks);
  console.log(`summary (${RUNS} runs, ${RATE}x): long tasks ${all.length} (max ${Math.max(0, ...all.map((t) => t.ms))} ms); mostly the pictures' code: ${theirs.length}`
    + ` (max ${Math.max(0, ...theirs.map((t) => t.ms))} ms, ${theirs.filter((t) => t.ms >= 50).length} of 50 ms or more); first Mentat ${results.map((r) => r.first).join('/')} ms, all ${results.map((r) => r.all).join('/')} ms`);
} finally {
  server.kill();
}
