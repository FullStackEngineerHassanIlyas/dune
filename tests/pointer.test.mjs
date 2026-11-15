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

// A button let go while another is still held arrives as a pointermove with fewer `buttons`, never as a pointerup.
function chordHarness() {
  const listeners = {};
  const el = { addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); }, setPointerCapture() {} };
  const log = [];
  new Pointer(el, { onClick: (x, y, button) => log.push(['click', button]), onDrag: () => log.push(['drag']), onDragEnd: (x0, y0, x1, y1) => log.push(['end', x0, y0, x1, y1]), onDragCancel: () => log.push(['cancel']) });
  const fire = (type, e) => { for (const fn of listeners[type] ?? []) fn({ preventDefault() {}, pointerId: 1, ...e }); };
  return { fire, log };
}

test('a selection box whose left button is let go while the right is held is finished, not left on screen', () => {
  const { fire, log } = chordHarness();
  fire('pointerdown', { button: 0, buttons: 1, clientX: 100, clientY: 100 });
  fire('pointermove', { button: -1, buttons: 1, clientX: 140, clientY: 140 });
  fire('pointermove', { button: 2, buttons: 3, clientX: 140, clientY: 140 });   // the right goes down too
  fire('pointermove', { button: 0, buttons: 2, clientX: 150, clientY: 150 });   // the left comes up: no pointerup for it
  assert.deepEqual(log.at(-1), ['end', 100, 100, 150, 150]);
  fire('pointerup', { button: 2, buttons: 0, clientX: 150, clientY: 150 });
  assert.deepEqual(log.filter((l) => l[0] !== 'drag'), [['end', 100, 100, 150, 150]], 'and the right button\'s release is not a click');
});

test('a pointerup for another button than the one that drew the box cancels the box', () => {
  const { fire, log } = chordHarness();
  fire('pointerdown', { button: 0, clientX: 100, clientY: 100 });   // an event source without `buttons`
  fire('pointermove', { clientX: 140, clientY: 140 });
  fire('pointerup', { button: 2, clientX: 140, clientY: 140 });
  assert.deepEqual(log.at(-1), ['cancel']);
});
