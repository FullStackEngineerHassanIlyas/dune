import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../serve.mjs';

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
    const escape = await fetch(`http://localhost:${port}/..%2f..%2fetc%2fpasswd`);
    assert.notEqual(escape.status, 200);
    await escape.arrayBuffer();
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
