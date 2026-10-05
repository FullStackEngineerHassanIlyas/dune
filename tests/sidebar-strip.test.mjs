// The build strip scrolls by its own offset: an icon the keyboard reaches out of view is scrolled to, and the box
// the browser might scroll to show it stays put (sidebar.js reveal / scroll).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sidebar } from '../src/ui/sidebar.js';

function strip(n, shown) {
  const buttons = new Map(Array.from({ length: n }, (_, i) => [`t${i}`, { id: i }]));
  return { buttons, offset: 0, slots: { clientHeight: shown * 92 - 4, scrollTop: 0 }, list: { style: {} } };
}
const bar = () => ({ tooltip: { tracked: 0, track() { this.tracked++; } }, visible: Sidebar.prototype.visible, scroll: Sidebar.prototype.scroll, reveal: Sidebar.prototype.reveal });

test('tabbing to an icon below the strip scrolls just far enough to show it, and back up again', () => {
  const s = strip(13, 2), sb = bar();
  s.slots.scrollTop = 928;   // the browser scrolled the box to the focused icon
  sb.reveal(s, s.buttons.get('t12'));
  assert.deepEqual([s.offset, s.slots.scrollTop, s.list.style.transform], [11, 0, 'translateY(-1012px)']);
  sb.reveal(s, s.buttons.get('t11'));
  assert.equal(s.offset, 11, 'already in view: no scroll');
  sb.reveal(s, s.buttons.get('t0'));
  assert.deepEqual([s.offset, s.list.style.transform], [0, 'translateY(0px)']);
  assert.ok(sb.tooltip.tracked >= 2, 'the card follows the icon');
});

test('the arrows still reach every icon after a reveal', () => {
  const s = strip(13, 2), sb = bar();
  sb.reveal(s, s.buttons.get('t12'));
  for (let i = 0; i < 12; i++) sb.scroll(s, -1);
  assert.equal(s.offset, 0);
  for (let i = 0; i < 20; i++) sb.scroll(s, 1);
  assert.equal(s.offset, 11, 'never past the last icon');
});
