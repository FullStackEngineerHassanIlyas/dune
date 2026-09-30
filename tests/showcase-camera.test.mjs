import test from 'node:test';
import assert from 'node:assert/strict';
import {
  battleCamera, riseCamera, shotYaw, descentBlend, CUT_EVERY, DESCENT, ENTRY, SHOT, WIDE, ORBIT_RATE,
} from '../src/game/showcase-camera.js';

const f = { x: 30, z: 20 };
const centre = { x: 32, z: 20 - 12 };   // where the dive landed, away from the fighting
const angle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} ≠ ${b} ± ${eps}`);
const H = 1e-5;   // finite-difference step, seconds (or k)

test('the descent starts at ENTRY, looking straight down over where the dive landed', () => {
  const a = battleCamera(0, f, { from: centre });
  near(a.distance, ENTRY.distance, 1e-9);
  near(a.pitch, ENTRY.pitch, 1e-12);
  assert.ok(ENTRY.pitch > (87 * Math.PI) / 180 && ENTRY.pitch < Math.PI / 2);   // top-down, but lookAt stays defined
  assert.deepEqual([a.x, a.z, a.shot], [centre.x, centre.z, 0]);
});

test('the descent opens at entryRate, the dive\'s own zoom rate, so the zoom carries on without a cut', () => {
  for (const entryRate of [1.7, 1.2, 2.2]) {
    const d = (t) => battleCamera(t, f, { entryRate }).distance;
    near((Math.log(d(0)) - Math.log(d(H))) / H, entryRate, 1e-3, `entryRate ${entryRate}`);
  }
});

test('the distance falls all through the descent and never undershoots SHOT', () => {
  // 1.0–2.4 covers the dive's plausible closing rates; above ~2.6 the push blending in wins for a moment
  for (const entryRate of [1, 1.7, 2.4]) {
    let last = Infinity;
    for (let t = 0; t <= DESCENT + 1e-9; t += 0.01) {
      const { distance } = battleCamera(t, f, { entryRate });
      assert.ok(distance < last, `rate ${entryRate}: rises at t = ${t}`);
      assert.ok(distance > SHOT.distance, `rate ${entryRate}: undershoots at t = ${t}`);
      last = distance;
    }
  }
});

test('the descent ends in the orbit with no kink in distance, pitch or yaw, nor in their rates', () => {
  const at = (t) => battleCamera(t, f, { from: centre, seed: 3 });
  const [l, m, r] = [at(DESCENT - H), at(DESCENT), at(DESCENT + H)];
  for (const key of ['distance', 'pitch', 'yaw']) {
    const left = (m[key] - l[key]) / H, right = (r[key] - m[key]) / H;
    near(left, right, 1e-3, `${key} rate`);
    near(r[key], l[key], 1e-4, key);
  }
  near(m.pitch, SHOT.pitch, 1e-12);
  near((r.yaw - m.yaw) / H, ORBIT_RATE, 1e-6);
  // the descent's tail (≈ 1 tile at DESCENT) and the push (+2.35 there) sit on top of SHOT, and fade by the first cut
  assert.ok(m.distance > SHOT.distance + 2 && m.distance < SHOT.distance + 4.5);
  near(at(CUT_EVERY - H).distance, SHOT.distance + 2.5 * Math.sin(CUT_EVERY * 0.35), 0.05);
});

test('the target drifts from where the dive landed to the fighting, in step with descentBlend', () => {
  assert.deepEqual([descentBlend(0), descentBlend(0.5), descentBlend(DESCENT - 1), descentBlend(DESCENT)], [0, 0, 1, 1]);
  const at = (t) => battleCamera(t, f, { from: centre });
  assert.deepEqual([at(0.5).x, at(0.5).z], [centre.x, centre.z]);
  assert.deepEqual([at(DESCENT - 1).x, at(DESCENT - 1).z], [f.x, f.z]);
  const mid = at((0.5 + DESCENT - 1) / 2);   // halfway through the blend: halfway there
  near(mid.x, (centre.x + f.x) / 2, 1e-9);
  near(mid.z, (centre.z + f.z) / 2, 1e-9);
  assert.deepEqual([at(DESCENT).x, at(DESCENT).z], [f.x, f.z]);
  // without `from`, the descent stays over the focus
  assert.deepEqual([battleCamera(0, f).x, battleCamera(0, f).z], [f.x, f.z]);
});

test('the battle opens high above and settles into a low orbit around the focus', () => {
  const a = battleCamera(0, f), b = battleCamera(DESCENT, f);
  // ENTRY is 240 tiles up at 88°; at DESCENT: SHOT 22 + tail ≈ 1.1 + push ≈ 2.35 ≈ 25.4
  assert.ok(a.distance > 200 && a.pitch > b.pitch);
  assert.ok(b.distance > 20 && b.distance < 32);
  assert.deepEqual([b.x, b.z], [30, 20]);
});

test('a cut to a new angle every CUT_EVERY seconds, a slow orbit in between', () => {
  const before = battleCamera(CUT_EVERY - 0.01, f), after = battleCamera(CUT_EVERY + 0.01, f);
  assert.equal(before.shot + 1, after.shot);
  assert.ok(angle(after.yaw, before.yaw) > 0.5);
  const s = battleCamera(CUT_EVERY + 1, f), t = battleCamera(CUT_EVERY + 5, f);
  assert.ok(t.yaw > s.yaw && t.yaw - s.yaw < 0.5);
  assert.deepEqual([after.distance > SHOT.distance, after.pitch, after.x], [true, SHOT.pitch, f.x]);
});

test('reduced motion holds one wide shot', () => {
  const a = battleCamera(0, f, { reduced: true, from: centre }), b = battleCamera(30, f, { reduced: true });
  assert.deepEqual(a, b);
  assert.deepEqual([a.distance, a.pitch, a.x, a.z], [WIDE.distance, WIDE.pitch, f.x, f.z]);
});

test('the rise tilts back to top-down and climbs to ENTRY over the last shot\'s target', () => {
  const from = battleCamera(40, f, { seed: 2 });
  const start = riseCamera(0, from);
  assert.deepEqual([start.distance, start.pitch], [from.distance, from.pitch]);
  const top = riseCamera(1, from);
  near(top.distance, ENTRY.distance, 1e-9);
  assert.equal(top.pitch, ENTRY.pitch);
  assert.deepEqual([top.x, top.z, top.yaw, top.shot], [from.x, from.z, from.yaw, from.shot]);
  // the tilt is done by k = 0.55, while the climb is still gathering pace
  assert.equal(riseCamera(0.55, from).pitch, ENTRY.pitch);
});

test('the rise leaves gently and ends at exitRate, the emerge\'s zoom-out rate', () => {
  for (const [exitRate, duration] of [[1.9, 3], [1.5, 3], [1.9, 2]]) {
    for (const distance of [SHOT.distance - 2.5, SHOT.distance, SHOT.distance + 2.5, WIDE.distance]) {
      const from = { x: 1, z: 2, distance, pitch: SHOT.pitch, yaw: 0.3, shot: 3 };
      const lnd = (k) => Math.log(riseCamera(k, from, { exitRate, duration }).distance);
      near((lnd(H) - lnd(0)) / (H * duration), 0, 1e-3, 'opening rate');
      // log-distance per second of real time: dk/dt = 1 / duration
      near((lnd(1) - lnd(1 - H)) / (H * duration), exitRate, 1e-3, `from ${distance}, rate ${exitRate}`);
    }
  }
});

test('the rise never overshoots ENTRY nor dips below the last shot; a high start clamps its final rate', () => {
  for (const distance of [19.5, 22, 32, 100, 200]) {
    const from = { x: 0, z: 0, distance, pitch: SHOT.pitch, yaw: 0, shot: 0 };
    let last = -Infinity;
    for (let k = 0; k <= 1 + 1e-9; k += 0.005) {
      const d = riseCamera(k, from).distance;
      assert.ok(d >= last && d >= distance - 1e-9 && d <= ENTRY.distance * (1 + 1e-12), `from ${distance} at k = ${k}`);
      last = d;
    }
  }
  // from 100: span = ln 2.4 ≈ 0.875, m = 1.9 · 3 / 0.875 ≈ 6.5 is clamped to 3, so the climb ends at 3 · 0.875 / 3
  const from = { x: 0, z: 0, distance: 100, pitch: SHOT.pitch, yaw: 0, shot: 0 };
  const lnd = (k) => Math.log(riseCamera(k, from).distance);
  near((lnd(1) - lnd(1 - H)) / (H * 3), Math.log(2.4), 1e-3);
});

test('consecutive battles do not replay the same bearings', () => {
  assert.ok(angle(shotYaw(1, 1), shotYaw(2, 2)) > 0.3);
});
