// Renders the pictures of the screens after a mission (src/ui/campaign/results-render.js) to the WebP files in
// this folder, in headless Chrome on the real GPU:
//   node assets/campaign/results/make.mjs [name …] [--ss 2] [--out <dir>] [--png]
// With no names it renders every picture. --out writes somewhere else (a preview), --png writes PNG instead.
// Each file must stay under 300 KB (the screens load them as they open).
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const { createServer } = await import(path.join(root, 'serve.mjs'));
const { openPage } = await import(path.join(root, 'scripts', 'cdp.mjs'));

const argv = process.argv.slice(2);
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : fallback; };
const flag = (name) => { const i = argv.indexOf(`--${name}`); if (i >= 0) argv.splice(i, 1); return i >= 0; };
const ss = Number(opt('ss', 2));
const outDir = path.resolve(opt('out', here));
const png = flag('png');
const QUALITY = { victory: 0.92, defeat: 0.92, line: 0.9 };
const SIZE = { victory: [1920, 1080], defeat: [1920, 1080], line: [1600, 1000] };
const LIMIT = 300 * 1024;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });

const server = createServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const cdp = await freePort();
const userDir = await mkdtemp(path.join(tmpdir(), 'dune-results-art-'));
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${cdp}`, `--user-data-dir=${userDir}`, '--no-first-run', '--enable-gpu', '--ignore-gpu-blocklist',
  '--use-angle=gl', '--hide-scrollbars', '--mute-audio', '--window-size=800,600', 'about:blank'], { stdio: 'ignore' });
let failed = 0;
try {
  for (let i = 0; i < 100; i++) { await sleep(100); try { await fetch(`http://127.0.0.1:${cdp}/json/version`); break; } catch { /* starting */ } }
  const page = await openPage({ port: cdp, width: 800, height: 600 }, `http://127.0.0.1:${port}/assets/campaign/results/make.html`);
  await page.waitFor('window.__ready === true', 60000);
  const names = argv.length ? argv : await page.eval('window.resultArtNames');
  await mkdir(outDir, { recursive: true });
  for (const name of names) {
    const kind = name.split('-')[0];
    const [width, height] = SIZE[kind];
    const t0 = Date.now();
    try {
      const url = await page.eval(`window.renderArt(${JSON.stringify({ name, width, height, ss })}, '${png ? 'image/png' : 'image/webp'}', ${QUALITY[kind]})`);
      const data = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
      const file = path.join(outDir, `${name}.${png ? 'png' : 'webp'}`);
      await writeFile(file, data);
      const big = !png && data.length > LIMIT;
      if (big) failed++;
      console.log(`${big ? 'TOO BIG ' : ''}${path.relative(root, file)} ${(data.length / 1024).toFixed(0)} KB, ${Date.now() - t0} ms`);
    } catch (err) {
      failed++;
      console.log(`FAIL ${name}: ${err.message}`);
    }
  }
  const problems = page.logs.filter((l) => /^\[(error|exception)\]/.test(l));
  if (problems.length) console.log(problems.join('\n'));
  page.close();
} finally {
  chrome.kill();
  server.close();
  await sleep(300);
  await rm(userDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
process.exit(failed ? 1 : 0);
