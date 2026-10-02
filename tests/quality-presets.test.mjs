import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY, QUALITY_ORDER, qualityPreset, lowerQuality, pixelRatioFor, bloomSize } from '../src/render/quality.js';

// spec §8: Preset | Shadows | Anti-aliasing | Bloom | Particles | Pixel ratio
test('the presets follow the spec §8 table', () => {
  const { low, medium, high } = QUALITY;
  assert.equal(low.shadows, 0, 'Low: shadows off');
  assert.ok(low.fxaa && !low.msaa, 'Low: FXAA');
  assert.equal(low.bloom, false, 'Low: bloom off');
  assert.equal(low.particles, 1500);
  assert.equal(low.pixelRatio, 0.75);

  assert.equal(medium.shadows, 1024, 'Medium: 1024 shadows');
  assert.equal(medium.shadowCascades, 1, 'Medium: one cascade');
  assert.ok(medium.fxaa && !medium.msaa, 'Medium: FXAA');
  assert.equal(medium.bloom, true);
  assert.equal(medium.bloomRes, 0.5, 'Medium: bloom at half resolution');
  assert.equal(medium.particles, 4000);
  assert.equal(medium.pixelRatio, 1);

  assert.equal(high.shadows, 2048, 'High: 2048 shadows');
  assert.ok(high.shadowRadius > medium.shadowRadius, 'High: soft shadows, softer than Medium');
  assert.equal(high.msaa, 4, 'High: MSAA 4x');
  assert.equal(high.fxaa, false, 'High: no FXAA on top of MSAA');
  assert.equal(high.bloom, true);
  assert.equal(high.bloomRes, 1, 'High: bloom at full resolution');
  assert.equal(high.particles, 8000);
  assert.equal(high.pixelRatio, 2, 'High: the device pixel ratio, at most 2');
});

test('pixel ratio: Low 0.75, Medium 1, High the device ratio up to 2', () => {
  for (const [dpr, low, medium, high] of [[1, 0.75, 1, 1], [1.25, 0.75, 1, 1.25], [2, 0.75, 1, 2], [3, 0.75, 1, 2], [undefined, 0.75, 1, 1], [0, 0.75, 1, 1]]) {
    assert.equal(pixelRatioFor(QUALITY.low, dpr), low, `low @${dpr}`);
    assert.equal(pixelRatioFor(QUALITY.medium, dpr), medium, `medium @${dpr}`);
    assert.equal(pixelRatioFor(QUALITY.high, dpr), high, `high @${dpr}`);
  }
});

test('bloom size: the pass halves what it is given, so Medium feeds it the frame and High twice the frame', () => {
  // UnrealBloomPass blurs from half of the size it is set to: the size handed over is 2 × bloomRes × the frame
  assert.deepEqual(bloomSize(QUALITY.medium, 1920, 1080), [1920, 1080]);   // → 960×540 bright pass: half resolution
  assert.deepEqual(bloomSize(QUALITY.high, 1920, 1080), [3840, 2160]);     // → 1920×1080: full resolution
  assert.deepEqual(bloomSize(QUALITY.medium, 1, 1), [2, 2], 'never below two pixels');
});

test('each preset has a lower one but Low, in order', () => {
  assert.deepEqual(QUALITY_ORDER, ['low', 'medium', 'high']);
  assert.equal(lowerQuality('high'), 'medium');
  assert.equal(lowerQuality('medium'), 'low');
  assert.equal(lowerQuality('low'), null);
  assert.equal(lowerQuality('ultra'), null);
  assert.equal(qualityPreset('ultra'), QUALITY.medium, 'unknown names fall back to Medium');
});

test('cost falls from High to Low on every axis', () => {
  const [low, medium, high] = QUALITY_ORDER.map((n) => QUALITY[n]);
  for (const key of ['shadows', 'particles', 'pixelRatio', 'bloomRes', 'flashLights', 'shadowRadius']) {
    assert.ok(low[key] <= medium[key] && medium[key] <= high[key], key);
  }
});
