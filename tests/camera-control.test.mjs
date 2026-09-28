import test from 'node:test';
import assert from 'node:assert/strict';
import { CameraControl, edgeScroll } from '../src/input/camera-control.js';

test('edge scrolling works at every window edge', () => {
  assert.deepEqual(edgeScroll(3, 300, 1400, 800), [-1, 0]);
  assert.deepEqual(edgeScroll(1398, 300, 1400, 800), [1, 0]);
  assert.deepEqual(edgeScroll(700, 2, 1400, 800), [0, 1]);
  assert.deepEqual(edgeScroll(700, 797, 1400, 800), [0, -1]);
  assert.deepEqual(edgeScroll(700, 400, 1400, 800), [0, 0]);
});

test('the camera pans while the pointer rests on the right window edge, over the sidebar', () => {
  const listeners = {};
  const target = () => ({ addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); }, setPointerCapture() {}, clientWidth: 1128, clientHeight: 800 });
  const win = { ...target(), innerWidth: 1400, innerHeight: 800, document: target() };
  const pans = [];
  const rig = { distance: 20, pan: (r, f) => pans.push([Math.sign(r), Math.sign(f)]), zoom() {}, rotate() {} };
  const cc = new CameraControl(rig, target(), { edgeScroll: true }, { win });
  for (const fn of listeners.pointermove) fn({ clientX: 1399, clientY: 400 });
  cc.update(0.016);
  assert.deepEqual(pans, [[1, 0]]);
  for (const fn of listeners.mouseout) fn({ relatedTarget: null });
  cc.update(0.016);
  assert.equal(pans.length, 1, 'no scrolling once the pointer left the window');
});
