import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY, qualityPreset } from '../src/render/quality.js';

test('every preset defines the same settings and medium is the fallback', () => {
  const keys = Object.keys(QUALITY.medium).sort();
  for (const [name, q] of Object.entries(QUALITY)) assert.deepEqual(Object.keys(q).sort(), keys, name);
  assert.equal(qualityPreset('nonsense'), QUALITY.medium);
  assert.equal(qualityPreset('low').shadows, 0);
  assert.ok(QUALITY.high.shadows > QUALITY.medium.shadows);
});
