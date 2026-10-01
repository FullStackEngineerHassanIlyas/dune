import test from 'node:test';
import assert from 'node:assert/strict';
import { wakeCheck, WAKE_GAP_MS } from '../src/render/wake.js';

function clock() {
  const c = { t: 1000, woke: [] };
  c.check = wakeCheck((gap) => c.woke.push(gap), { now: () => c.t });
  c.frame = (busy = 5, idle = 11) => { c.check(); c.t += busy; c.check.idle(); c.t += idle; };
  return c;
}

test('drawing that resumes after a long idle stretch (the laptop slept) asks for a GPU refresh, once', () => {
  const c = clock();
  for (let i = 0; i < 100; i++) c.frame();
  assert.equal(c.woke.length, 0, 'ordinary frames');
  c.t += 6 * 3600 * 1000;
  c.frame();
  c.frame();
  assert.equal(c.woke.length, 1);
  assert.ok(c.woke[0] > WAKE_GAP_MS);
});

test('a frame that is itself slow is not sleep', () => {
  const c = clock();
  c.frame();
  c.frame(45000, 10);   // a weak machine compiling shaders for 45 s
  c.frame();
  assert.equal(c.woke.length, 0);
});

test('a second long pause right after a refresh waits for the cooldown', () => {
  const c = clock();
  c.frame();
  c.t += 30000; c.frame();
  c.t += 30000; c.frame();
  assert.equal(c.woke.length, 1);
  c.t += 90000; c.frame();
  assert.equal(c.woke.length, 2);
});

test('reset forgets the idle stretch, so a planned pause is not mistaken for sleep', () => {
  const c = clock();
  c.frame();
  c.t += 60000;
  c.check.reset();
  c.frame();
  assert.equal(c.woke.length, 0);
});
