// The territory map's shapes (src/data/territory.js): 27 simple polygons that tile the map with no gaps or overlaps,
// polar regions along both edges, and a centre inside each region for the zoom to aim at.
import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, MAP, regionAt, insidePolygon, ownerOf } from '../src/data/territory.js';

function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
function segmentsCross(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1), d2 = cross(p3, p4, p2), d3 = cross(p1, p2, p3), d4 = cross(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function signedArea(poly) {
  let a = 0;
  for (let k = 0; k < poly.length; k++) { const p = poly[k], q = poly[(k + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}

test('every region is a simple polygon of sensible size inside the map', () => {
  for (const r of REGIONS) {
    const P = r.polygon;
    assert.ok(P.length >= 8, `region ${r.id}: ${P.length} points`);
    for (const [x, y] of P) assert.ok(x >= 0 && x <= MAP.w && y >= 0 && y <= MAP.h, `region ${r.id}: (${x}, ${y}) off the map`);
    for (let k = 0; k < P.length; k++) {
      const q = P[(k + 1) % P.length];
      assert.ok(Math.hypot(q[0] - P[k][0], q[1] - P[k][1]) > 1e-4, `region ${r.id}: repeated point ${k}`);
    }
    for (let i = 0; i < P.length; i++) {
      for (let j = i + 2; j < P.length; j++) {
        if (i === 0 && j === P.length - 1) continue;
        assert.ok(!segmentsCross(P[i], P[(i + 1) % P.length], P[j], P[(j + 1) % P.length]), `region ${r.id}: edges ${i} and ${j} cross`);
      }
    }
    assert.ok(r.area > 0.012 * MAP.w * MAP.h, `region ${r.id} is a sliver (${r.area.toFixed(1)})`);
    assert.ok(r.area < 0.09 * MAP.w * MAP.h, `region ${r.id} is too big (${r.area.toFixed(1)})`);
    assert.ok(Math.abs(Math.abs(signedArea(P)) - r.area) < 1e-6);
  }
});

test('the regions tile the map: areas add up and every point lies in exactly one region', () => {
  const total = REGIONS.reduce((s, r) => s + r.area, 0);
  assert.ok(Math.abs(total - MAP.w * MAP.h) < 1e-3, `areas add up to ${total}`);
  for (let y = 0.37; y < MAP.h; y += 1.73) {
    for (let x = 0.29; x < MAP.w; x += 1.91) {
      const hits = REGIONS.filter((r) => insidePolygon(r.polygon, x, y)).length;
      assert.equal(hits, 1, `(${x.toFixed(2)}, ${y.toFixed(2)}) is in ${hits} regions`);
    }
  }
  assert.equal(regionAt(-1, 5), 0);
  assert.equal(regionAt(5, MAP.h + 1), 0);
});

test('each region’s centre lies inside it, clear of its border', () => {
  for (const r of REGIONS) {
    assert.equal(regionAt(...r.centre), r.id, `region ${r.id}'s centre`);
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) assert.equal(regionAt(r.centre[0] + dx, r.centre[1] + dy), r.id, `region ${r.id}: centre too near the border`);
  }
});

test('neighbours are mutual, and the polar regions run along both edges of the map', () => {
  for (const r of REGIONS) for (const n of r.neighbours) assert.ok(REGIONS[n - 1].neighbours.includes(r.id), `${r.id} ~ ${n}`);
  assert.deepEqual(REGIONS.filter((r) => r.pole === 'north').map((r) => r.id), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(REGIONS.filter((r) => r.pole === 'south').map((r) => r.id), [20, 21, 22, 23, 24, 26, 27]);
});

test('every region the player takes borders land the player held or took at the same step', () => {
  for (const house of ['atreides', 'harkonnen', 'ordos']) {
    for (let step = 2; step <= 8; step++) {
      const held = REGIONS.filter((r) => ownerOf(house, step, r.id) === house).map((r) => r.id);
      for (const id of held) {
        if (ownerOf(house, step - 1, id) === house) continue;
        assert.ok(REGIONS[id - 1].neighbours.some((n) => held.includes(n)), `${house} step ${step}: region ${id} is cut off`);
      }
    }
  }
});
