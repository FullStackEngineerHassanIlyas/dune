// The player's own Sega soundtrack kept in the game's git-ignored original/ folder is imported once by itself
// (src/core/user-files.js importLocalMusic); nothing happens without it, and a changed file comes in again.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as files from '../src/core/user-files.js';
import { fakeIndexedDB } from './fake-indexeddb.mjs';
import { fakeVgmFormat, vgmFile, zip } from './music-fakes.mjs';

const format = async () => fakeVgmFormat;
const pack = () => zip([['01 - Opening.vgm', vgmFile({ track: 'Opening', total: 44100 * 70, loop: 44100 * 16 })],
  ['13 - Conquest.vgm', vgmFile({ track: 'Conquest', total: 44100 * 24, loop: 44100 * 23 })]]);
const answer = (status, body = null, stamp = 'a') => async () => ({
  status, ok: status >= 200 && status < 300,
  headers: { get: (k) => (k === 'content-length' ? String(body?.byteLength ?? 0) : k === 'last-modified' ? stamp : null) },
  arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
});

test('a soundtrack in original/ is imported once, by itself, into the slots the Sega game played it in', async () => {
  files.openStorage(fakeIndexedDB());
  const bytes = pack();
  const first = await files.importLocalMusic({ fetch: answer(200, bytes), format });
  assert.equal(first.added, 2);
  assert.deepEqual((await files.playlistTracks('intro')).map((t) => t.name), ['01 - Opening.vgm']);
  assert.deepEqual((await files.playlistTracks('victory-atreides')).map((t) => t.name), ['13 - Conquest.vgm']);
  assert.equal(await files.importLocalMusic({ fetch: answer(200, bytes), format }), null, 'the same file is not read again');
  const again = await files.importLocalMusic({ fetch: answer(200, bytes, 'b'), format });
  assert.equal(again.added, 0, 'a changed file is read again; tracks already here are not added twice');
});

test('without a copy in original/ nothing happens', async () => {
  files.openStorage(fakeIndexedDB());
  assert.equal(await files.importLocalMusic({ fetch: answer(204), format }), null);
  assert.equal(await files.importLocalMusic({ fetch: answer(404), format }), null);
  assert.equal(await files.importLocalMusic({ fetch: async () => { throw new Error('offline'); }, format }), null);
  assert.equal(await files.importLocalMusic({ fetch: null, format }), null);
  assert.deepEqual(await files.playlistTracks('intro'), []);
});
