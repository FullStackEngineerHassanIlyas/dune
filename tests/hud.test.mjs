import test from 'node:test';
import assert from 'node:assert/strict';
import { Hud } from '../src/ui/hud.js';

function fakeDoc() {
  return {
    createElement: () => {
      const classes = new Set();
      return { className: '', textContent: '', classes, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } };
    },
  };
}
const root = { appendChild() {} };

test('a held message outlasts passing ones', () => {
  const doc = fakeDoc();
  const hud = new Hud(root, doc);
  hud.hold('Paused');
  assert.equal(hud.el.textContent, 'Paused');
  hud.message('Unit lost.', 1);
  assert.equal(hud.el.textContent, 'Unit lost.');
  hud.update(1.1);
  assert.equal(hud.el.textContent, 'Paused');
  assert.ok(hud.el.classes.has('show'));
  hud.release();
  hud.update(0.1);
  assert.ok(!hud.el.classes.has('show'));
});
