import test from 'node:test';
import assert from 'node:assert/strict';
import { CameraControl, edgeScroll, dragScroll, compass } from '../src/input/camera-control.js';

test('edge scrolling works at every window edge', () => {
  assert.deepEqual(edgeScroll(3, 300, 1400, 800), [-1, 0]);
  assert.deepEqual(edgeScroll(1398, 300, 1400, 800), [1, 0]);
  assert.deepEqual(edgeScroll(700, 2, 1400, 800), [0, 1]);
  assert.deepEqual(edgeScroll(700, 797, 1400, 800), [0, -1]);
  assert.deepEqual(edgeScroll(700, 400, 1400, 800), [0, 0]);
});

function harness(settings = { edgeScroll: true }) {
  const listeners = {};
  const target = () => ({ addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); }, setPointerCapture() {}, clientWidth: 1128, clientHeight: 800 });
  const win = { ...target(), innerWidth: 1400, innerHeight: 800, document: target() };
  const pans = [], scrolls = [];
  const rig = { distance: 20, pan: (r, f) => pans.push([r, f]), zoom() {}, rotate() {} };
  const cc = new CameraControl(rig, target(), settings, { win, onScroll: (s) => scrolls.push(s) });
  const fire = (type, e = {}) => { for (const fn of listeners[type] ?? []) fn({ preventDefault() {}, ...e }); };
  const signs = () => pans.map(([r, f]) => [Math.sign(r), Math.sign(f)]);
  return { cc, fire, pans, scrolls, signs };
}

test('the camera pans while the pointer rests on the right window edge, over the sidebar', () => {
  const { cc, fire, signs, scrolls } = harness();
  fire('pointermove', { clientX: 1399, clientY: 400 });
  cc.update(0.016);
  assert.deepEqual(signs(), [[1, 0]]);
  assert.deepEqual(scrolls, [{ dir: 'e', anchor: null }], 'the cursor is told to show the east scroll arrow');
});

test('a pointer pushed out past an edge keeps scrolling until it comes back', () => {
  const { cc, fire, pans, signs, scrolls } = harness();
  fire('pointermove', { clientX: 700, clientY: 30 });
  fire('mouseout', { relatedTarget: null, clientX: 700, clientY: -4 });
  cc.update(0.016);
  cc.update(0.016);
  assert.deepEqual(signs(), [[0, 1], [0, 1]], 'still scrolling north with the pointer above the window');
  fire('pointermove', { clientX: 700, clientY: 300 });
  cc.update(0.016);
  assert.equal(pans.length, 2, 'back inside, away from the edge: no more scrolling');
  assert.equal(scrolls.at(-1), null);
});

test('leaving through a corner scrolls both ways; leaving far from any edge does not scroll', () => {
  const { cc, fire, pans, signs } = harness();
  fire('pointermove', { clientX: 1380, clientY: 790 });
  fire('mouseout', { relatedTarget: null });
  cc.update(0.016);
  assert.deepEqual(signs(), [[1, -1]]);
  fire('pointermove', { clientX: 700, clientY: 400 });
  fire('mouseout', { relatedTarget: null });
  cc.update(0.016);
  assert.equal(pans.length, 1);
});

test('losing focus or opening a menu stops edge scrolling', () => {
  const { cc, fire, pans } = harness();
  fire('pointermove', { clientX: 0, clientY: 400 });
  cc.suspended = true;
  cc.update(0.016);
  assert.equal(pans.length, 0, 'a menu is open');
  cc.suspended = false;
  fire('mouseout', { relatedTarget: null, clientX: -2, clientY: 400 });
  fire('blur');
  cc.update(0.016);
  assert.equal(pans.length, 0, 'the window lost focus');
});

test('edge scrolling can be switched off', () => {
  const { cc, fire, pans } = harness({ edgeScroll: false });
  fire('pointermove', { clientX: 1399, clientY: 400 });
  fire('mouseout', { relatedTarget: null, clientX: 1405, clientY: 400 });
  cc.update(0.016);
  assert.equal(pans.length, 0);
});

test('right-drag pull: dead zone, then faster the further it pulls, capped at three times', () => {
  assert.deepEqual(dragScroll(4, 3), [0, 0]);
  const [r1, f1] = dragScroll(126, 0);
  assert.ok(Math.abs(r1 - 1) < 1e-9 && f1 === 0, 'a 120 px pull past the dead zone scrolls at edge speed');
  const [, f2] = dragScroll(0, -66);
  assert.ok(Math.abs(f2 - 0.5) < 1e-9, 'pulling up scrolls forward (north)');
  assert.ok(Math.abs(Math.hypot(...dragScroll(900, 900)) - 3) < 1e-9);
});

test('holding the right button and pulling scrolls that way; the cursor gets the direction and the anchor', () => {
  const { cc, fire, pans, scrolls } = harness();
  fire('pointerdown', { button: 2, clientX: 500, clientY: 400 });
  fire('pointermove', { clientX: 503, clientY: 398 });
  cc.update(0.016);
  assert.equal(pans.length, 0, 'a few pixels is still a click');
  fire('pointermove', { clientX: 700, clientY: 400 });
  cc.update(0.016);
  assert.equal(pans.length, 1);
  assert.ok(pans[0][0] > 0 && pans[0][1] === 0, 'pulled right: scrolls right');
  assert.deepEqual(scrolls.at(-1), { dir: 'e', anchor: { x: 500, y: 400 } });
  fire('pointermove', { clientX: 400, clientY: 250 });
  cc.update(0.016);
  assert.ok(pans[1][0] < 0 && pans[1][1] > 0, 'up and left');
  assert.equal(scrolls.at(-1).dir, 'nw');
  fire('pointerup', { button: 2 });
  cc.update(0.016);
  assert.equal(pans.length, 2, 'released: stops');
  assert.equal(scrolls.at(-1), null);
});

test('right-drag scrolling can be switched off', () => {
  const { cc, fire, pans } = harness({ edgeScroll: true, rightDragScroll: false });
  fire('pointerdown', { button: 2, clientX: 500, clientY: 400 });
  fire('pointermove', { clientX: 800, clientY: 400 });
  cc.update(0.016);
  assert.equal(pans.length, 0);
});

test('compass names the eight scroll directions', () => {
  assert.equal(compass(0, 1), 'n');
  assert.equal(compass(1, 1), 'ne');
  assert.equal(compass(1, 0), 'e');
  assert.equal(compass(1, -1), 'se');
  assert.equal(compass(0, -1), 's');
  assert.equal(compass(-1, -1), 'sw');
  assert.equal(compass(-1, 0), 'w');
  assert.equal(compass(-1, 1), 'nw');
  assert.equal(compass(0, 0), null);
});
