// Every module under src/ imports in Node, so a broken path or a syntax error in any scene shows up in
// `npm test` instead of first in a smoke run. New modules touch the DOM only inside functions, never at import.
// Browser-only entry points (the page script, workers and the audio worklet) are skipped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../src/', import.meta.url));
const BROWSER_ONLY = new Set(['main.js', 'audio/synth-worker.js', 'audio/music/worker.js', 'audio/music/worklet.js']);

function modules(dir) {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return modules(file);
    return name.endsWith('.js') || name.endsWith('.mjs') ? [file] : [];
  });
}

test('every src module imports in Node', async () => {
  const failed = [];
  for (const file of modules(ROOT)) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (BROWSER_ONLY.has(rel)) continue;
    try { await import(pathToFileURL(file).href); } catch (err) { failed.push(`${rel}: ${err.message}`); }
  }
  assert.deepEqual(failed, []);
});
