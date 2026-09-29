import test from 'node:test';
import assert from 'node:assert/strict';
import { Pointer } from '../src/input/pointer.js';

function harness(rightDrag) {
  const listeners = {};
  const el = { addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); }, setPointerCapture() {} };
  const clicks = [], drags = [];
  new Pointer(el, { onClick: (x, y, button) => clicks.push([x, y, button]), onDrag: (...a) => drags.push(a), onDragEnd: () => drags.push('end') }, rightDrag ? { rightDrag } : undefined);
  const fire = (type, e) => { for (const fn of listeners[type] ?? []) fn({ preventDefault() {}, pointerId: 1, ...e }); };
  return { fire, clicks, drags };
}

test('a right-button drag scrolls instead of clicking; a still right click still clicks', () => {
  const { fire, clicks, drags } = harness();
  fire('pointerdown', { button: 2, clientX: 100, clientY: 100 });
  fire('pointermove', { clientX: 200, clientY: 120 });
  fire('pointerup', { button: 2, clientX: 200, clientY: 120 });
  assert.equal(clicks.length, 0, 'no deselect or order after scrolling');
  assert.equal(drags.length, 0, 'and no selection box');
  fire('pointerdown', { button: 2, clientX: 100, clientY: 100 });
  fire('pointermove', { clientX: 103, clientY: 101 });
  fire('pointerup', { button: 2, clientX: 103, clientY: 101 });
  assert.deepEqual(clicks, [[103, 101, 2]]);
});

test('with right-drag scrolling off, a moved right press is still a click', () => {
  const { fire, clicks } = harness(() => false);
  fire('pointerdown', { button: 2, clientX: 100, clientY: 100 });
  fire('pointermove', { clientX: 200, clientY: 120 });
  fire('pointerup', { button: 2, clientX: 200, clientY: 120 });
  assert.equal(clicks.length, 1);
});

test('a left drag still draws the selection box', () => {
  const { fire, clicks, drags } = harness();
  fire('pointerdown', { button: 0, clientX: 100, clientY: 100 });
  fire('pointermove', { clientX: 160, clientY: 150 });
  fire('pointerup', { button: 0, clientX: 160, clientY: 150 });
  assert.equal(clicks.length, 0);
  assert.equal(drags.at(-1), 'end');
});
