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

import { terrainSubFor } from '../src/render/quality.js';

test('large maps use at most three terrain vertices per tile side', () => {
  assert.equal(terrainSubFor(128, QUALITY.high), 3);
  assert.equal(terrainSubFor(96, QUALITY.medium), 3);
  assert.equal(terrainSubFor(64, QUALITY.medium), 4);
  assert.equal(terrainSubFor(128, QUALITY.low), 3);
});
