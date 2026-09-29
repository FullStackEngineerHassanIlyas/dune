import test from 'node:test';
import assert from 'node:assert/strict';
import { nearCamera } from '../src/render/near-camera.js';

test('ambient effects are only made near what the camera looks at', () => {
  assert.equal(nearCamera(10, 10, 10, 10, 16), true);
  assert.equal(nearCamera(30, 10, 10, 10, 16), true, 'within one and a half camera distances');
  assert.equal(nearCamera(40, 10, 10, 10, 16), false);
  assert.equal(nearCamera(40, 10, 10, 10, 40), true, 'zoomed out, more is near');
});
