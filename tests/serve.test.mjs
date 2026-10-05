import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../serve.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('server serves the page, vendored three as JavaScript, 404s and blocks path escapes', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const page = await fetch(`http://localhost:${port}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<canvas id="gl">/);
    const three = await fetch(`http://localhost:${port}/vendor/three/three.module.js`);
    assert.equal(three.status, 200);
    assert.match(three.headers.get('content-type'), /javascript/);
    await three.arrayBuffer();
    const missing = await fetch(`http://localhost:${port}/nope.js`);
    assert.equal(missing.status, 404);
    await missing.arrayBuffer();
    const optional = await fetch(`http://localhost:${port}/original/no-such-copy.zip`);
    assert.equal(optional.status, 204, "the player's optional files are quietly absent, not a 404");
    await optional.arrayBuffer();
    assert.ok(Number(three.headers.get('content-length')) > 0 && three.headers.get('last-modified'), 'files say their size and date');
    const escape = await fetch(`http://localhost:${port}/..%2f..%2fetc%2fpasswd`);
    assert.notEqual(escape.status, 200);
    await escape.arrayBuffer();
  } finally {
    server.close();
  }
});

test('server names the type of the pictures, sounds and archives the game serves (any letter case)', async () => {
  const { TYPES, contentType } = await import('../serve.mjs');
  assert.equal(contentType('original/TRACKS.ZIP'), 'application/zip', 'a capital extension');
  assert.equal(contentType('original/dune2/DUNE.PAK'), 'application/octet-stream', 'an archive is plain bytes');
  const want = {
    '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.avif': 'image/avif', '.ico': 'image/x-icon', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav', '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.weba': 'audio/webm', '.zip': 'application/zip',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  };
  for (const [ext, type] of Object.entries(want)) assert.equal(TYPES[ext], type, ext);
  // every file the game itself ships is served as what it is, never as a download
  const exts = new Set();
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) e.isDirectory() ? walk(path.join(dir, e.name)) : exts.add(path.extname(e.name).toLowerCase()); };
  for (const dir of ['assets', 'src', 'vendor']) walk(path.join(root, dir));
  for (const ext of exts) if (ext) assert.ok(TYPES[ext], `${ext} has a type`);
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const crest = await fetch(`http://127.0.0.1:${port}/assets/campaign/crests/ordos-shield.webp`);
    assert.equal(crest.status, 200);
    assert.equal(crest.headers.get('content-type'), 'image/webp');
    await crest.arrayBuffer();
  } finally {
    server.close();
  }
});

test('server refuses dot-folders and the private reference images, and binds to localhost by default', async () => {
  const { HOST } = await import('../serve.mjs');
  assert.equal(HOST, process.env.HOST || '127.0.0.1');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    for (const p of ['/.git/HEAD', '/.superpowers/sdd/x', '/docs/research/refs/INDEX.md', '/docs/research/refs/genesis-boxart.png']) {
      const r = await fetch(`http://127.0.0.1:${port}${p}`);
      assert.equal(r.status, 403, p);
      await r.arrayBuffer();
    }
    const ok = await fetch(`http://127.0.0.1:${port}/docs/research/README.md`);
    assert.equal(ok.status, 200);
    await ok.arrayBuffer();
  } finally {
    server.close();
  }
});
