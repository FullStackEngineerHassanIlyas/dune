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
