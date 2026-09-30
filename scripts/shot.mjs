// Screenshots of arbitrary scene URLs: `node scripts/shot.mjs <name> "<query>" [<name> "<query>" …]`
// writes screenshots/<name>.png, e.g. `node scripts/shot.mjs windtrap "scene=model&id=windtrap"`.
// Each run serves the game on its own port (SHOT_PORT, or a random one) so several can run at once.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, openPage } from './cdp.mjs';
import { startServer } from './smoke.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (!args.length || args.length % 2) {
  console.log('usage: node scripts/shot.mjs <name> "<query>" [<name> "<query>" …]');
  process.exit(2);
}
const port = Number(process.env.SHOT_PORT || 8500 + Math.floor(Math.random() * 1400));
const server = await startServer(port);
await mkdir(path.join(root, 'screenshots'), { recursive: true });
const chrome = await launchChrome();
let failed = 0;
try {
  for (let i = 0; i < args.length; i += 2) {
    const [name, query] = [args[i], args[i + 1]];
    const page = await openPage(chrome, `http://localhost:${port}/?${query}`);
    try {
      await page.waitFor('window.__dune && window.__dune.ready === true', 90000);
      await new Promise((r) => setTimeout(r, 500));
      const file = path.join(root, 'screenshots', `${name}.png`);
      await page.screenshot(file);
      const errors = page.logs.filter((l) => l.startsWith('[error]') || l.startsWith('[exception]'));
      if (errors.length) { failed++; console.log(`FAIL ${name}\n  ${errors.join('\n  ')}`); }
      else console.log(`wrote ${path.relative(root, file)}`);
    } catch (err) {
      failed++;
      console.log(`FAIL ${name}: ${err.message}`);
      for (const l of page.logs) console.log(`  ${l}`);
    } finally {
      page.close();
    }
  }
} finally {
  await chrome.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
