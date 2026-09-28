import test from 'node:test';
import assert from 'node:assert/strict';
import { Rng, hashString } from '../src/core/rng.js';
import { EventQueue, Emitter } from '../src/core/events.js';
import { readParams } from '../src/core/params.js';
import { DEFAULTS, sanitize, loadSettings, saveSettings } from '../src/core/settings.js';
import { FixedLoop } from '../src/core/loop.js';

test('same seed gives the same sequence, different seeds diverge', () => {
  const a = new Rng(42), b = new Rng(42), c = new Rng(43);
  const sa = [], sb = [], sc = [];
  for (let i = 0; i < 50; i++) { sa.push(a.next()); sb.push(b.next()); sc.push(c.next()); }
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
});

test('int stays in range and covers it; seed 0 works', () => {
  const r = new Rng(0);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = r.int(6);
    assert.ok(v >= 0 && v < 6);
    seen.add(v);
  }
  assert.equal(seen.size, 6);
});

test('shuffle keeps every element', () => {
  const list = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = new Rng(5).shuffle([...list]);
  assert.deepEqual([...out].sort((x, y) => x - y), list);
});

test('hashString is stable and spreads', () => {
  assert.equal(hashString('dune'), hashString('dune'));
  assert.notEqual(hashString('dune'), hashString('dunf'));
});

test('event queue drains in order and empties', () => {
  const q = new EventQueue();
  q.push('a', { n: 1 });
  q.push('b');
  const out = q.drain();
  assert.deepEqual(out.map((e) => e.type), ['a', 'b']);
  assert.equal(out[0].n, 1);
  assert.equal(q.drain().length, 0);
});

test('emitter subscribes and unsubscribes', () => {
  const e = new Emitter();
  let n = 0;
  const off = e.on('x', (v) => { n += v; });
  e.emit('x', 2);
  off();
  e.emit('x', 5);
  assert.equal(n, 2);
});

test('params parse strings, numbers and booleans', () => {
  const p = readParams('?a=1&b=x&c=0&d=');
  assert.equal(p.num('a'), 1);
  assert.equal(p.str('b'), 'x');
  assert.equal(p.bool('c'), false);
  assert.equal(p.bool('missing', true), true);
  assert.equal(p.num('d', 7), 7);
  assert.equal(p.num('b', 3), 3);
});

test('settings sanitize rejects unknown keys and bad values', () => {
  const s = sanitize({ quality: 'ultra', scheme: 'modern', scrollSpeed: 99, edgeScroll: 'false', hacker: 1 });
  assert.equal(s.quality, DEFAULTS.quality);
  assert.equal(s.scheme, 'modern');
  assert.equal(s.scrollSpeed, DEFAULTS.scrollSpeed);
  assert.equal(s.edgeScroll, false);
  assert.equal('hacker' in s, false);
});

test('settings load merges URL over storage and tolerates broken JSON', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  saveSettings({ ...DEFAULTS, quality: 'high' }, storage);
  assert.equal(loadSettings(readParams(''), storage).quality, 'high');
  assert.equal(loadSettings(readParams('?quality=low'), storage).quality, 'low');
  store.set('dune2-3d.settings', '{broken');
  assert.equal(loadSettings(readParams(''), storage).quality, DEFAULTS.quality);
  assert.equal(loadSettings(readParams(''), null).quality, DEFAULTS.quality);
});

test('fixed loop runs whole steps and reports interpolation alpha', () => {
  const loop = new FixedLoop(0.05);
  assert.deepEqual(loop.advance(0.02), { steps: 0, alpha: 0.02 / 0.05 });
  const r = loop.advance(0.04);
  assert.equal(r.steps, 1);
  assert.ok(Math.abs(r.alpha - 0.2) < 1e-9);
});

test('fixed loop caps catch-up and drops the backlog after a stall', () => {
  const loop = new FixedLoop(0.05, { maxSteps: 5 });
  const r = loop.advance(3.0);          // a hidden tab or a long hitch
  assert.equal(r.steps, 5);
  assert.ok(r.alpha < 1);
  assert.equal(loop.advance(0.01).steps, 0);
});

test('fixed loop honours game speed', () => {
  const loop = new FixedLoop(0.05);
  assert.equal(loop.advance(0.1, 1.5).steps, 3);
});

test('settings survive a browser that blocks site storage', () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError: storage is blocked'); } });
  try {
    assert.equal(loadSettings(readParams('?quality=low')).quality, 'low');
    assert.doesNotThrow(() => saveSettings({ ...DEFAULTS, quality: 'high' }));
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc); else delete globalThis.localStorage;
  }
});
