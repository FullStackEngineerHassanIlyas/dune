// The opening's near stars (src/render/space-travel.js) drift past at the Mega Drive's pace: phase 3 research §8
// measures 150-230 px/s on its 320 px wide screen, 0.47-0.72 screen widths a second, and every star on it moves. Here
// each near star in view is projected through the travelling camera (render/planet.js's framing shot, offset by
// game/intro-timeline.js's travelOffset) at moments of the steady drift, on the window shapes of a laptop.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SpaceTravel } from '../src/render/space-travel.js';
import { planetFraming, menuShare } from '../src/render/planet.js';
import { travelCorridor, travelOffset, INTRO_MARKS } from '../src/game/intro-timeline.js';

const T = Math.tan((38 / 2) * (Math.PI / 180));   // the planet camera's half field of view

/** Screen widths per second of every near star in view at t, the camera framed for a width × height window. */
export function starSpeeds({ width, height, seed, t }) {
  const aspect = width / height, f = planetFraming(aspect, undefined, menuShare(width));
  const pos = new SpaceTravel({ seed, corridor: travelCorridor(f.distance) }).stars.geometry.attributes.position.array;
  const cam = (at) => { const o = travelOffset(at); return [o.x, o.y, f.distance + o.z]; };
  const c0 = cam(t), c1 = cam(t + 0.01), out = [];
  const ndc = (c, i) => { const dz = c[2] - pos[i + 2]; return dz > 0.1 ? [(pos[i] - c[0]) / (dz * T * aspect) + f.shiftX, (pos[i + 1] - c[1]) / (dz * T) + f.shiftY] : null; };
  for (let i = 0; i < pos.length; i += 3) {
    const a = ndc(c0, i), b = ndc(c1, i);
    if (a && b && Math.abs(a[0]) <= 1 && Math.abs(a[1]) <= 1) out.push(Math.abs(b[0] - a[0]) / 0.01 / 2);
  }
  return out.sort((x, y) => x - y);
}
const at = (sorted, q) => sorted[Math.floor(q * (sorted.length - 1))];

test('the near stars cross the screen at the Sega\'s pace through the empty stars, a sparse field of them', () => {
  for (const [width, height] of [[1600, 900], [1920, 1080], [1366, 768], [1280, 800]]) {
    for (const seed of [1, 5, 77]) {
      for (const t of [1, 5, 9, 13, INTRO_MARKS.planet - 0.5]) {
        const s = starSpeeds({ width, height, seed, t }), where = `${width}×${height} seed ${seed} t ${t}`;
        assert.ok(s.length >= 20 && s.length <= 140, `${where}: ${s.length} near stars in view`);
        const median = at(s, 0.5);
        assert.ok(median >= 0.47 && median <= 0.72, `${where}: median ${median.toFixed(3)} widths/s`);
        assert.ok(at(s, 0.1) >= 0.3, `${where}: a tenth of them crawl at ${at(s, 0.1).toFixed(3)} widths/s or less`);
        assert.ok(at(s, 1) <= 1.4, `${where}: the fastest streaks past at ${at(s, 1).toFixed(3)} widths/s`);
      }
    }
  }
});

test('they stand still once the camera has stopped at the planet, none of them nearer than its far side there', () => {
  for (const t of [INTRO_MARKS.stop, INTRO_MARKS.ships[1], INTRO_MARKS.menu]) {
    const s = starSpeeds({ width: 1600, height: 900, seed: 5, t });
    assert.ok(s.length > 0 && at(s, 1) < 1e-9, `t ${t}: ${at(s, 1)}`);
  }
  for (const [width, height] of [[1600, 900], [2560, 1080], [900, 1200]]) {
    const aspect = width / height, f = planetFraming(aspect, undefined, menuShare(width));
    const pos = new SpaceTravel({ seed: 5, corridor: travelCorridor(f.distance) }).stars.geometry.attributes.position.array;
    let shown = 0;
    for (let i = 0; i < pos.length; i += 3) {
      const dz = f.distance - pos[i + 2], x = pos[i] / (dz * T * aspect) + f.shiftX, y = pos[i + 1] / (dz * T) + f.shiftY;
      if (dz <= 0 || Math.abs(x) > 1.05 || Math.abs(y) > 1.05) continue;
      shown++;
      assert.ok(pos[i + 2] < -1.5, `${width}×${height}: a star at z ${pos[i + 2].toFixed(2)} in the planet's shot`);
    }
    assert.ok(shown >= 10, `${width}×${height}: ${shown} near stars around the planet`);
  }
});
