import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime } from '../src/ui/end-screen.js';

test('game time reads as minutes and seconds', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(75), '1:15');
  assert.equal(formatTime(3601), '60:01');
});
