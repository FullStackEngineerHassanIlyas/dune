import test from 'node:test';
import assert from 'node:assert/strict';
import { battleCamera, riseCamera, shotYaw, CUT_EVERY, DESCENT } from '../src/game/showcase-camera.js';

const f = { x: 30, z: 20 };
const angle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

test('the battle opens high above and settles into a low orbit around the focus', () => {
  const a = battleCamera(0, f), b = battleCamera(DESCENT, f);
  assert.ok(a.distance > 80 && a.pitch > b.pitch);
  assert.ok(b.distance > 20 && b.distance < 32);
  assert.deepEqual([b.x, b.z], [30, 20]);
});

test('a cut to a new angle every CUT_EVERY seconds, a slow orbit in between', () => {
  const before = battleCamera(CUT_EVERY - 0.01, f), after = battleCamera(CUT_EVERY + 0.01, f);
  assert.equal(before.shot + 1, after.shot);
  assert.ok(angle(after.yaw, before.yaw) > 0.5);
  const s = battleCamera(CUT_EVERY + 1, f), t = battleCamera(CUT_EVERY + 5, f);
  assert.ok(t.yaw > s.yaw && t.yaw - s.yaw < 0.5);
});

test('reduced motion holds one wide shot', () => {
  const a = battleCamera(0, f, { reduced: true }), b = battleCamera(30, f, { reduced: true });
  assert.deepEqual(a, b);
  assert.ok(a.distance > 30);
});

test('the rise climbs and tilts down from the last battle shot', () => {
  const from = battleCamera(40, f);
  assert.equal(riseCamera(0, from).distance, from.distance);
  const top = riseCamera(1, from);
  assert.ok(top.distance > from.distance + 40 && top.pitch > from.pitch);
});

test('consecutive battles do not replay the same bearings', () => {
  assert.ok(angle(shotYaw(1, 1), shotYaw(2, 2)) > 0.3);
});
