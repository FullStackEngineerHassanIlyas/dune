// The atlas's camera (src/render/atlas/camera-path.js): the overview frames the whole map, the zoom onto a mission's
// region is a continuous ease-in-out dive that ends looking straight at that region's centre, and the idle drift
// stays gentle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, targetRegion } from '../src/data/territory.js';
import { overviewPose, regionPose, zoomPose, posePosition, project, footprint, mapToWorld, drift, easeInOut, WORLD, FOV } from '../src/render/atlas/camera-path.js';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('the overview shows the whole map, centred, at any window shape', () => {
  for (const aspect of [16 / 9, 4 / 3, 21 / 9, 1, 0.6]) {
    const pose = overviewPose(aspect);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const [nx, ny] = project(pose, aspect, FOV, (x * WORLD.w) / 2, 0.3, (z * WORLD.h) / 2);
      minX = Math.min(minX, nx); maxX = Math.max(maxX, nx); minY = Math.min(minY, ny); maxY = Math.max(maxY, ny);
    }
    assert.ok(minX >= -0.95 && maxX <= 0.95 && minY >= -0.95 && maxY <= 0.95, `aspect ${aspect}: corners at ${[minX, maxX, minY, maxY]}`);
    assert.ok(Math.max(maxX - minX, maxY - minY) > 1.6, `aspect ${aspect}: the map is too small`);
    assert.ok(close(minY + maxY, 0, 0.01), `aspect ${aspect}: not centred vertically`);
  }
});

test('an inset fits the map inside the rest of the picture', () => {
  const inset = { left: 0.3, right: 0, top: 0.2, bottom: 0 }, aspect = 16 / 9;
  const pose = overviewPose(aspect, inset);
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const [nx, ny] = project(pose, aspect, FOV, (x * WORLD.w) / 2, 0.3, (z * WORLD.h) / 2, inset);
    assert.ok(nx >= -1 + 2 * inset.left - 0.01 && nx <= 1 && ny >= -1 && ny <= 1 - 2 * inset.top + 0.01, `corner ${x},${z}: ${nx}, ${ny}`);
  }
});

test('the zoom eases from the overview onto the mission’s region without a jump', () => {
  for (const house of ['atreides', 'harkonnen', 'ordos']) {
    for (let mission = 1; mission <= 9; mission++) {
      const region = REGIONS[targetRegion(house, mission) - 1], aspect = 16 / 9;
      const from = overviewPose(aspect), to = regionPose(region, aspect), pose = {};
      const at0 = posePosition(zoomPose(from, to, 0, pose));
      assert.ok(close(at0.x, posePosition(from).x) && close(at0.y, posePosition(from).y) && close(at0.z, posePosition(from).z));
      let prev = { ...at0 }, prevDist = from.dist, worst = 0;
      for (let k = 1; k <= 2000; k++) {
        const p = posePosition(zoomPose(from, to, k / 2000, pose));
        worst = Math.max(worst, Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z));
        assert.ok(pose.dist <= prevDist + 1e-9, 'the camera only comes closer');
        prev = { ...p }; prevDist = pose.dist;
      }
      assert.ok(worst < 0.05, `${house} ${mission}: a step of ${worst}`);
      const end = zoomPose(from, to, 1, pose), [wx, wz] = mapToWorld(...region.centre);
      assert.deepEqual({ ...end }, { ...to }, 'the dive ends on the region’s pose');
      assert.ok(end.dist < from.dist / 2, 'the dive ends close');
      const [nx, ny] = project(end, aspect, FOV, wx, end.ty, wz);
      assert.ok(Math.abs(nx) <= 0.601 && Math.abs(ny) <= 0.601, `${house} ${mission}: the region's centre is off to ${nx}, ${ny}`);
      assert.deepEqual(zoomPose(from, to, 1.5, {}), zoomPose(from, to, 1, {}));
    }
  }
});

test('the zoom aims at the region’s centre, sliding inwards only as far as keeps the picture on the map', () => {
  const aspect = 16 / 9;
  const onMap = (pose) => {
    const fp = footprint(pose, aspect);
    return fp.minX >= -WORLD.w / 2 - 1e-6 && fp.maxX <= WORLD.w / 2 + 1e-6 && fp.minZ >= -WORLD.h / 2 - 1e-6 && fp.maxZ <= WORLD.h / 2 + 1e-6;
  };
  let slid = 0;
  for (const region of REGIONS) {
    const to = regionPose(region, aspect), [wx, wz] = mapToWorld(...region.centre);
    const [nx, ny] = project(to, aspect, FOV, wx, to.ty, wz);
    if (close(to.tx, wx) && close(to.tz, wz)) { assert.ok(onMap(to), `region ${region.id}: the picture runs off the map`); continue; }
    slid++;
    assert.ok(!onMap({ ...to, tx: wx, tz: wz }), `region ${region.id}: slid without need`);
    assert.ok(onMap(to) || Math.max(Math.abs(nx), Math.abs(ny)) >= 0.599, `region ${region.id}: slid too little`);
  }
  assert.ok(slid > 0 && slid < REGIONS.length, `${slid} regions slid`);
  // a region in the middle of the map needs no slide
  const mid = REGIONS[16 - 1], to = regionPose(mid, aspect), [mx, mz] = mapToWorld(...mid.centre);
  assert.ok(close(to.tx, mx) && close(to.tz, mz));
});

test('ease-in-out starts and ends slowly', () => {
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.ok(close(easeInOut(0.5), 0.5));
  assert.ok(easeInOut(0.05) < 0.01 && easeInOut(0.95) > 0.99);
});

test('the drift is gentle and continuous', () => {
  const d = {};
  let prev = null;
  for (let t = 0; t < 120; t += 0.05) {
    drift(t, d);
    assert.ok(Math.abs(d.yaw) < 0.06 && Math.abs(d.elev) < 0.03 && Math.abs(d.dist) < 0.03);
    if (prev) assert.ok(Math.abs(d.yaw - prev.yaw) < 0.002 && Math.abs(d.dist - prev.dist) < 0.002);
    prev = { ...d };
  }
});
