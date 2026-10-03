// The atlas's region textures (src/render/atlas/raster.js): every texel names the region under its centre, and the
// border field measures the distance to the nearest border between regions (not to the map's outer edge).
import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, MAP, regionAt } from '../src/data/territory.js';
import { regionIds, borderField, BORDER_RANGE } from '../src/render/atlas/raster.js';

const TW = 800, TH = 400;
const ids = regionIds(REGIONS, MAP, TW, TH);
const field = borderField(REGIONS, MAP, TW, TH);

test('every texel holds the region under its centre', () => {
  assert.equal(ids.length, TW * TH);
  let wrong = 0;
  for (let j = 0; j < TH; j += 6) {
    for (let i = 0; i < TW; i += 6) {
      const id = ids[j * TW + i];
      assert.ok(id >= 1 && id <= 27, `texel ${i},${j} has id ${id}`);
      if (id !== regionAt(((i + 0.5) / TW) * MAP.w, ((j + 0.5) / TH) * MAP.h)) wrong++;
    }
  }
  assert.equal(wrong, 0);
  for (let k = 0; k < ids.length; k++) if (!ids[k]) assert.fail(`texel ${k} has no region`);
});

test('the border field is near zero where neighbouring texels differ and full deep inside a region', () => {
  const scale = 255 / BORDER_RANGE;
  let borders = 0;
  for (let j = 1; j < TH - 1; j++) {
    for (let i = 1; i < TW - 1; i++) {
      const k = j * TW + i;
      if (ids[k] !== ids[k + 1] || ids[k] !== ids[k + TW]) { borders++; assert.ok(field[k] <= 1.5 * scale, `texel ${i},${j}: ${field[k]}`); }
    }
  }
  assert.ok(borders > 1000);
  for (const r of REGIONS) {
    const i = Math.floor((r.centre[0] / MAP.w) * TW), j = Math.floor((r.centre[1] / MAP.h) * TH);
    assert.equal(field[j * TW + i], 255, `region ${r.id}'s centre`);
  }
  // the outer edge of the map is not a border: the middle of the top row of a polar region is far from any
  const top = Math.floor((REGIONS[3].centre[0] / MAP.w) * TW);
  assert.equal(field[top], 255);
});
