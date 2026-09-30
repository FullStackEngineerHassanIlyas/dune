import test from 'node:test';
import assert from 'node:assert/strict';
import { BackdropClock, DURATIONS, HOLD_AT, fadeAt, captionAt, soundLevelAt } from '../src/game/backdrop-timeline.js';
import { CUT_EVERY, DESCENT } from '../src/game/showcase-camera.js';

const runFor = (clock, seconds, ready = true) => {
  const entered = [];
  for (let t = 0; t < seconds; t += 0.05) { const p = clock.advance(0.05, ready); if (p) entered.push(p); }
  return entered;
};
const total = DURATIONS.planet + DURATIONS.dive + DURATIONS.battle + DURATIONS.rise;

test('the loop runs planet → dive → battle → rise → planet', () => {
  const c = new BackdropClock();
  assert.equal(c.phase, 'planet');
  assert.deepEqual(runFor(c, total + 0.5), ['dive', 'battle', 'rise', 'planet']);
  assert.equal(c.cycle, 1);
});

test('the planet keeps turning until the next battle is ready', () => {
  const c = new BackdropClock();
  assert.deepEqual(runFor(c, DURATIONS.planet + 5, false), []);
  assert.deepEqual(runFor(c, 0.1, true), ['dive']);
});

test('a held phase stays put, starting past its opening fades; unknown holds are ignored', () => {
  const p = new BackdropClock({ hold: 'planet' }), b = new BackdropClock({ hold: 'battle' });
  assert.equal(b.t, HOLD_AT.battle);
  runFor(p, 100);
  runFor(b, 100);
  assert.deepEqual([p.phase, b.phase], ['planet', 'battle']);
  assert.equal(new BackdropClock({ hold: 'nonsense' }).hold, null);
});

test('a held planet keeps its caption; a held battle starts past the descent and its clock keeps running', () => {
  const p = new BackdropClock({ hold: 'planet' }), b = new BackdropClock({ hold: 'battle' });
  runFor(p, 100);
  runFor(b, 10);
  assert.equal(p.t, HOLD_AT.planet);
  assert.equal(captionAt(p.phase, p.t), 1);
  assert.ok(b.t > HOLD_AT.battle + 9);
  assert.ok(HOLD_AT.battle > DESCENT);
});

test('restart goes back to the planet', () => {
  const c = new BackdropClock();
  runFor(c, DURATIONS.planet + 1);
  c.restart();
  assert.deepEqual([c.phase, c.t], ['planet', 0]);
});

test('the fade: in from black, into haze at the end of the dive, out of it on the battle, dips at cuts, to black on the rise', () => {
  assert.equal(fadeAt('planet', 0).opacity, 1);
  assert.equal(fadeAt('planet', 1).opacity, 0);
  assert.equal(fadeAt('dive', 1).opacity, 0);
  assert.deepEqual(fadeAt('dive', DURATIONS.dive), { color: 'haze', opacity: 1 });
  assert.equal(fadeAt('battle', 0).opacity, 1);
  assert.equal(fadeAt('battle', 3).opacity, 0);
  assert.equal(fadeAt('battle', CUT_EVERY).opacity, 1);
  assert.equal(fadeAt('battle', CUT_EVERY + 1).opacity, 0);
  assert.equal(fadeAt('battle', 5 * CUT_EVERY).opacity, 1);   // a held battle keeps cutting past its 45 s
  assert.equal(fadeAt('battle', 5 * CUT_EVERY + 1).opacity, 0);
  assert.deepEqual(fadeAt('rise', DURATIONS.rise), { color: 'black', opacity: 1 });
});

test('reduced motion: plain crossfades and no dips at cuts', () => {
  assert.ok(fadeAt('dive', 1, { reduced: true }).opacity > 0.2);
  assert.equal(fadeAt('battle', CUT_EVERY, { reduced: true }).opacity, 0);
});

test('the caption shows on the planet only, once it has faded in and until the dive', () => {
  assert.equal(captionAt('planet', 0.5), 0);
  assert.equal(captionAt('planet', 5), 1);
  assert.equal(captionAt('planet', DURATIONS.planet), 0);
  assert.equal(captionAt('battle', 5), 0);
});

test('battle sound: silent in space, in as the battle appears, out on the rise', () => {
  assert.equal(soundLevelAt('planet', 5), 0);
  assert.equal(soundLevelAt('dive', 2), 0);
  assert.equal(soundLevelAt('battle', 0), 0);
  assert.equal(soundLevelAt('battle', 10), 1);
  assert.equal(soundLevelAt('rise', DURATIONS.rise), 0);
});
