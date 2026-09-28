import test from 'node:test';
import assert from 'node:assert/strict';
import { Selection, pickAt, inBox } from '../src/input/selection.js';
import { Groups } from '../src/input/groups.js';

const c = (id, sx, sy, own = true, r = 12) => ({ id, sx, sy, own, r });

test('pickAt returns the nearest candidate inside its radius and prefers own units', () => {
  const list = [c(1, 100, 100), c(2, 108, 100, false), c(3, 300, 300)];
  assert.equal(pickAt(list, 104, 100).id, 1);
  assert.equal(pickAt(list, 200, 200), null);
  assert.equal(pickAt([c(4, 100, 100, false), c(5, 103, 100, true)], 100, 100).id, 5);
});

test('inBox selects centres inside any-direction rectangles', () => {
  const list = [c(1, 10, 10), c(2, 50, 50), c(3, 90, 10)];
  assert.deepEqual(inBox(list, 60, 60, 0, 0), [1, 2]);
});

test('selection set, toggle, prune and version', () => {
  const s = new Selection();
  s.set([1, 2]);
  s.toggle(2);
  s.toggle(3);
  assert.deepEqual(s.list(), [1, 3]);
  const v = s.version;
  s.prune((id) => id !== 3);
  assert.deepEqual(s.list(), [1]);
  assert.ok(s.version > v);
});

test('groups assign, recall live members and detect double taps', () => {
  const g = new Groups();
  g.assign(1, [5, 6]);
  assert.deepEqual(g.get(1, (id) => id !== 6), [5]);
  assert.equal(g.tap(1, 1000), 'select');
  assert.equal(g.tap(1, 1200), 'center');
  assert.equal(g.tap(1, 1300), 'select');
  assert.equal(g.tap(2, 1400), 'select');
  assert.equal(g.groupOf(5), 1);
});

test('selecting a structure drops the units and back; prune drops dead structures', () => {
  const s = new Selection();
  s.set([1, 2]);
  s.setStructure(7);
  assert.deepEqual([s.list(), s.structureId], [[], 7]);
  s.set([3]);
  assert.equal(s.structureId, 0);
  s.setStructure(7);
  const v = s.version;
  s.prune(() => true, (id) => id !== 7);
  assert.equal(s.structureId, 0);
  assert.ok(s.version > v);
  s.setStructure(8);
  s.clear();
  assert.equal(s.structureId, 0);
});
