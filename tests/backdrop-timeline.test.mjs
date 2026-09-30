import test from 'node:test';
import assert from 'node:assert/strict';
import { BackdropClock, DURATIONS, HOLD_AT, HAZE, fadeAt, captionAt, soundLevelAt } from '../src/game/backdrop-timeline.js';
import { CUT_EVERY, DESCENT } from '../src/game/showcase-camera.js';
import { FOG_COLOR } from '../src/render/renderer.js';
import { GradeShader } from '../src/render/grade-pass.js';

const runFor = (clock, seconds, ready = true) => {
  const entered = [];
  for (let t = 0; t < seconds; t += 0.05) { const p = clock.advance(0.05, ready); if (p) entered.push(p); }
  return entered;
};
const total = Object.values(DURATIONS).reduce((a, b) => a + b, 0);   // 10 + 4 + 45 + 3 + 3.5 = 65.5 s
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b} ± ${eps}`);
const opacity = (phase, t, opts) => fadeAt(phase, t, opts).opacity;

test('the durations of revision 2: a longer dive and rise, and the emerge', () => {
  assert.deepEqual(DURATIONS, { planet: 10, dive: 4, battle: 45, rise: 3, emerge: 3.5 });
});

test('the loop runs planet → dive → battle → rise → emerge → planet', () => {
  const c = new BackdropClock();
  assert.equal(c.phase, 'planet');
  assert.deepEqual(runFor(c, total + 0.5), ['dive', 'battle', 'rise', 'emerge', 'planet']);
  assert.equal(c.cycle, 1);
});

test('the cycle counts each return to the planet, from the emerge', () => {
  const c = new BackdropClock();
  assert.deepEqual([c.skip(), c.skip(), c.skip(), c.skip()], ['dive', 'battle', 'rise', 'emerge']);
  assert.equal(c.cycle, 0);   // the rise no longer lands on the planet
  assert.equal(c.skip(), 'planet');
  assert.equal(c.cycle, 1);
  runFor(c, total + 0.5);
  assert.deepEqual([c.phase, c.cycle], ['planet', 2]);
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
});

test('HOLD_AT.battle is half a second past the descent (DESCENT = 5.5 s in revision 2)', () => {
  assert.equal(DESCENT, 5.5);
  assert.equal(HOLD_AT.battle, DESCENT + 0.5);
});

test('restart goes back to the planet', () => {
  const c = new BackdropClock();
  runFor(c, DURATIONS.planet + 1);
  c.restart();
  assert.deepEqual([c.phase, c.t], ['planet', 0]);
});

test('cold: from a restart until the loop first moves on', () => {
  const c = new BackdropClock();
  assert.equal(c.cold, true);   // the menu opening
  runFor(c, DURATIONS.planet - 1);
  assert.equal(c.cold, true);   // still the first planet
  runFor(c, 1.5);
  assert.deepEqual([c.phase, c.cold], ['dive', false]);   // entered through advance()
  runFor(c, total - DURATIONS.planet);
  assert.deepEqual([c.phase, c.cold], ['planet', false]);   // back from the emerge: warm
  c.restart();
  assert.equal(c.cold, true);   // back from a skirmish
  c.skip();
  assert.equal(c.cold, false);   // entered through skip()
  const held = new BackdropClock({ hold: 'battle' });
  assert.equal(held.cold, true);
});

test('fade on the planet: in from black on a cold start only', () => {
  assert.deepEqual(fadeAt('planet', 0, { cold: true }), { color: 'black', opacity: 1 });
  near(opacity('planet', 0.4, { cold: true }), 0.5);
  assert.equal(opacity('planet', 0.8, { cold: true }), 0);
  assert.equal(opacity('planet', 0), 0);   // warm, out of the emerge: nothing covers the planet
  assert.equal(opacity('planet', 0, { reduced: true }), 0);
});

test('fade on the dive: none, the planet shader hazes itself; reduced motion rises into the haze', () => {
  for (const t of [0, 1, DURATIONS.dive - 0.1, DURATIONS.dive]) assert.deepEqual(fadeAt('dive', t), { color: 'haze', opacity: 0 });
  assert.equal(opacity('dive', 0, { reduced: true }), 0);
  near(opacity('dive', DURATIONS.dive / 2, { reduced: true }), 0.5);
  assert.deepEqual(fadeAt('dive', DURATIONS.dive, { reduced: true }), { color: 'haze', opacity: 1 });
});

test('fade on the battle: no opening fade, the zoom overlay covers the seam; reduced motion falls out of the haze over 1.5 s', () => {
  for (const t of [0, 0.5, 1, 3]) assert.deepEqual(fadeAt('battle', t), { color: 'haze', opacity: 0 });
  assert.deepEqual(fadeAt('battle', 0, { reduced: true }), { color: 'haze', opacity: 1 });
  near(opacity('battle', 0.75, { reduced: true }), 0.5);
  assert.equal(opacity('battle', 1.5, { reduced: true }), 0);
});

test('fade on the battle: a haze dip at every cut, in over 0.3 s and out over 0.45 s; none under reduced motion', () => {
  assert.equal(opacity('battle', CUT_EVERY - 0.3), 0);
  near(opacity('battle', CUT_EVERY - 0.15), 0.5);
  assert.equal(opacity('battle', CUT_EVERY), 1);
  near(opacity('battle', CUT_EVERY + 0.225), 0.5);
  near(opacity('battle', CUT_EVERY + 0.45), 0);   // 12.45 - 12 is a hair under 0.45 in floating point
  assert.equal(opacity('battle', CUT_EVERY + 1), 0);
  assert.equal(opacity('battle', CUT_EVERY * 1.5), 0);   // between cuts
  assert.equal(opacity('battle', 2 * CUT_EVERY), 1);
  assert.equal(opacity('battle', 5 * CUT_EVERY), 1);   // a held battle keeps cutting past its 45 s
  assert.equal(opacity('battle', 5 * CUT_EVERY + 1), 0);
  assert.equal(fadeAt('battle', CUT_EVERY).color, 'haze');
  for (const n of [1, 2, 5]) assert.equal(opacity('battle', n * CUT_EVERY, { reduced: true }), 0);
});

test('fade on the rise: none, the climb zooms out uncovered; reduced motion rises into the haze', () => {
  for (const t of [0, 1.5, DURATIONS.rise]) assert.deepEqual(fadeAt('rise', t), { color: 'haze', opacity: 0 });
  assert.equal(opacity('rise', 0, { reduced: true }), 0);
  near(opacity('rise', DURATIONS.rise / 2, { reduced: true }), 0.5);
  assert.deepEqual(fadeAt('rise', DURATIONS.rise, { reduced: true }), { color: 'haze', opacity: 1 });
});

test('fade on the emerge: none; reduced motion falls out of the haze over its first 1.5 s', () => {
  for (const t of [0, 1, DURATIONS.emerge]) assert.deepEqual(fadeAt('emerge', t), { color: 'haze', opacity: 0 });
  assert.deepEqual(fadeAt('emerge', 0, { reduced: true }), { color: 'haze', opacity: 1 });
  near(opacity('emerge', 0.75, { reduced: true }), 0.5);
  assert.equal(opacity('emerge', 1.5, { reduced: true }), 0);
  assert.equal(opacity('emerge', DURATIONS.emerge, { reduced: true }), 0);
});

test('reduced motion: an unbroken haze from the end of the dive to the battle, and from the rise to the emerge', () => {
  const r = { reduced: true };
  assert.equal(opacity('dive', DURATIONS.dive, r), opacity('battle', 0, r));
  assert.equal(opacity('rise', DURATIONS.rise, r), opacity('emerge', 0, r));
});

test('the caption shows on the planet only, once it has faded in and until the dive', () => {
  assert.equal(captionAt('planet', 0.5), 0);
  assert.equal(captionAt('planet', 5), 1);
  assert.equal(captionAt('planet', DURATIONS.planet), 0);
  assert.equal(captionAt('battle', 5), 0);
  assert.equal(captionAt('emerge', 2), 0);
});

test('battle sound: silent in space, in over the battle\'s first 2 s, out over the rise', () => {
  assert.equal(soundLevelAt('planet', 5), 0);
  assert.equal(soundLevelAt('dive', 2), 0);
  assert.equal(soundLevelAt('battle', 0), 0);
  near(soundLevelAt('battle', 1), 0.5);
  assert.equal(soundLevelAt('battle', 2), 1);
  assert.equal(soundLevelAt('battle', 10), 1);
  assert.equal(soundLevelAt('rise', 0), 1);
  near(soundLevelAt('rise', DURATIONS.rise / 2), 0.5);   // the rise is 3 s now, not 2
  assert.equal(soundLevelAt('rise', DURATIONS.rise), 0);
  assert.equal(soundLevelAt('emerge', 1), 0);
});

test('HAZE is the fog colour as the picture shows it: through the grade and ACES, within two levels', () => {
  // the fog is mixed in linear light; the grade pass tints and saturates it, OutputPass tone-maps (three.js
  // ACESFilmic, exposure 1) and encodes sRGB. A haze fade laid over the picture must meet it with no step.
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const srgb = (x) => { x = Math.min(1, Math.max(0, x)); return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055); };
  const mul = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  const IN = [[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]];
  const OUT = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
  const fit = (x) => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.432951) + 0.238081);
  const { uTint, uSaturation } = GradeShader.uniforms;
  let c = [(FOG_COLOR >> 16) & 255, (FOG_COLOR >> 8) & 255, FOG_COLOR & 255].map(lin).map((x, i) => x * uTint.value[i]);
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  c = c.map((x) => (l + (x - l) * uSaturation.value) / 0.6);
  const shown = mul(OUT, mul(IN, c).map(fit)).map(srgb);
  const haze = [1, 3, 5].map((i) => parseInt(HAZE.slice(i, i + 2), 16));
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(shown[i] - haze[i]) <= 2, `channel ${i}: ${haze[i]} against ${shown[i].toFixed(1)}`);
});
