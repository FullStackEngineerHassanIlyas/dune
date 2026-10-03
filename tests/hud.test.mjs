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

function styledDoc() {
  return {
    createElement: () => {
      const classes = new Set();
      return { className: '', textContent: '', classes, style: { cssText: '', display: '' }, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } };
    },
  };
}

test('a mission\'s objective line has its own slot: pause, resume and passing messages leave it alone', () => {
  const kids = [];
  const hud = new Hud({ appendChild: (e) => kids.push(e) }, styledDoc());
  assert.equal(kids.length, 1, 'a skirmish gets no objective line');
  hud.objective('Destroy the Harkonnen base · 5 enemy buildings left');
  const line = kids[1];
  assert.equal(line.className, 'objective-line');
  assert.match(line.style.cssText, /position: absolute/);
  hud.hold('Paused — press P to continue');
  hud.update(0.1);
  hud.release();
  hud.message('Resumed', 1.5);
  hud.update(2);
  assert.equal(line.textContent, 'Destroy the Harkonnen base · 5 enemy buildings left');
  assert.equal(line.style.display, '');
  hud.objective('Destroy the Harkonnen base · 4 enemy buildings left');
  assert.equal(line.textContent, 'Destroy the Harkonnen base · 4 enemy buildings left');
  hud.objective(null);
  assert.equal(line.style.display, 'none');
  assert.equal(kids.length, 2, 'one line, reused');
});
