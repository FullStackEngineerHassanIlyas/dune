// Starts the dev server and headless Chrome, captures screenshots/<name>.png for every scenario and
// fails if a scene does not become ready or logs an error/exception.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, openPage } from './cdp.mjs';
import { SCENARIOS } from './scenarios.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.SMOKE_PORT || 8471);
const only = process.argv.slice(2);
const list = Object.entries(SCENARIOS).filter(([name]) => !only.length || only.includes(name));

export async function startServer(port = PORT) {
  const server = spawn(process.execPath, ['serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try { if ((await fetch(`http://localhost:${port}/index.html`)).ok) return server; } catch { /* not up yet */ }
  }
  server.kill();
  throw new Error(`port ${port} is not serving the game (in use?) — set SMOKE_PORT`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer();
  await mkdir(path.join(root, 'screenshots'), { recursive: true });
  const chrome = await launchChrome();
  let failed = 0;
  try {
    for (const [name, sc] of list) {
      const page = await openPage(chrome, `http://localhost:${PORT}/?${sc.query}`);
      try {
        await page.waitFor('window.__dune && window.__dune.ready === true', sc.timeoutMs ?? 90000);
        await new Promise((r) => setTimeout(r, sc.settleMs ?? 400));
        await page.screenshot(path.join(root, 'screenshots', `${name}.png`));
        const errors = page.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[exception]'));
        if (errors.length) { failed++; console.log(`FAIL ${name}\n  ${errors.join('\n  ')}`); }
        else console.log(`wrote screenshots/${name}.png`);
      } catch (err) {
        failed++;
        console.log(`FAIL ${name}: ${err.message}`);
      } finally {
        page.close();
      }
    }
  } finally {
    await chrome.close();
    server.kill();
  }
  process.exit(failed ? 1 : 0);
}
