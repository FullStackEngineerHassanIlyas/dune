// The campaign's ending (src/game/ending-timeline.js): the planet eases to the middle and back with no jump, the
// victor's colour spreads all the way before the credits, the roll runs from below the window until it has gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ENDING, endingView, endingLength, rollAt, pageAt } from '../src/game/ending-timeline.js';

const H = 1e-4;

test('the planet eases into the middle and nearer, then back to the right for the roll, smoothly', () => {
  assert.equal(endingView(0).centred, 0);
  assert.equal(endingView(ENDING.centre[1]).centred, 1);
  assert.equal(endingView(ENDING.back[1]).centred, 0);
  assert.equal(endingView(ENDING.centre[1] + 1).z, -ENDING.nearer, 'nearer while in the middle');
  assert.equal(Math.abs(endingView(30).z), 0, 'back to the framing distance');
  for (let t = 0.01; t < 20; t += 0.01) {
    const a = endingView(t - H), b = endingView(t + H);
    assert.ok(Math.abs(b.centred - a.centred) < 3 * H, `centred jumps at ${t}`);
    assert.ok(Math.abs(b.z - a.z) < 3 * H, `distance jumps at ${t}`);
  }
});

test('the victor\'s colour spreads steadily and is all there before the credits', () => {
  assert.equal(endingView(ENDING.shimmer[0]).tint, 0);
  assert.equal(endingView(ENDING.shimmer[1]).tint, 1);
  assert.ok(ENDING.shimmer[1] <= ENDING.credits);
  let last = -1;
  for (let t = 0; t < 20; t += 0.1) { const k = endingView(t).tint; assert.ok(k >= last); last = k; }
  assert.equal(endingView(40).tint, 1, 'and stays');
});

test('the credits roll up from below the window until the last line has gone', () => {
  const view = 900, roll = 2400;
  assert.equal(rollAt(0, view), view);
  assert.equal(rollAt(ENDING.credits, view), view, 'it starts just below the window');
  assert.ok(rollAt(ENDING.credits + 1, view) < view);
  const end = endingLength({ rollHeight: roll, viewHeight: view });
  assert.ok(rollAt(end - ENDING.tail, view) + roll <= 1e-6, 'gone by the end, then the planet alone');
  assert.ok(end > ENDING.credits + 20 && end < 120, `${end} s in all`);
});

test('reduced motion: the credits show a group at a time, still, then it ends', () => {
  assert.deepEqual(pageAt(ENDING.credits - 1, 4), { index: -1, opacity: 0 });
  assert.equal(pageAt(ENDING.credits + ENDING.page * 0.5, 4).index, 0);
  assert.equal(pageAt(ENDING.credits + ENDING.page * 0.5, 4).opacity, 1);
  assert.equal(pageAt(ENDING.credits + ENDING.page * 2.5, 4).index, 2);
  assert.equal(pageAt(ENDING.credits + ENDING.page * 4.5, 4).index, -1);
  assert.equal(endingLength({ pages: 4, reduced: true }), ENDING.credits + 4 * ENDING.page + 1);
  assert.equal(endingView(5, { reduced: true }).centred, 1, 'no camera move: the planet simply in the middle');
});
