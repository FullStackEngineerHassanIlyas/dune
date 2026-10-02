import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, endTable, fightOn } from '../src/ui/end-screen.js';

test('game time reads as minutes and seconds', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(75), '1:15');
  assert.equal(formatTime(3601), '60:01');
});

test('the end table has a column per house, the player first, with who won and when each house fell', () => {
  const stats = {
    houses: [{ id: 'atreides', name: 'Atreides', color: 0x2f6fe0, you: true, winner: true, out: null },
      { id: 'harkonnen', name: 'Harkonnen', color: 0xc8261e, you: false, winner: false, out: 754 },
      { id: 'mercenary', name: 'Mercenary', color: 0xe1c814, you: false, winner: false, out: 1200 }],
    rows: [{ label: 'Spice harvested', you: 1400, enemy: 900, values: [1400, 700, 200] }],
  };
  const t = endTable(stats);
  assert.deepEqual(t.head.map((h) => [h.name, h.color, h.note]), [['Atreides', '#2f6fe0', 'you · winner'], ['Harkonnen', '#c8261e', 'out 12:34'], ['Mercenary', '#e1c814', 'out 20:00']]);
  assert.deepEqual(t.rows, [['Spice harvested', '1400', '700', '200']]);
});

test('who fights on after the player falls', () => {
  assert.equal(fightOn([]), '');
  assert.equal(fightOn(['Ordos']), 'Ordos fights on.');
  assert.equal(fightOn(['Harkonnen', 'Ordos']), 'Harkonnen and Ordos fight on.');
  assert.equal(fightOn(['Harkonnen', 'Ordos', 'Sardaukar']), 'Harkonnen, Ordos and Sardaukar fight on.');
});
