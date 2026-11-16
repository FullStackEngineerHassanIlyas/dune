import test from 'node:test';
import assert from 'node:assert/strict';
import { matrix, summarize, runGame } from '../scripts/measure-ai.mjs';

test('the measurement matrix freezes forty legal games including twelve default four-house seeds', () => {
  const games = matrix();
  assert.equal(games.length, 40);
  assert.equal(new Set(games.map(g => g.id)).size, 40);
  assert.equal(games.filter(g => g.group === 'default').length, 12);
  assert.deepEqual([...new Set(games.map(g => g.houses))].sort(), [2, 3, 4]);
  assert.deepEqual([...new Set(games.map(g => g.difficulty))].sort(), ['easy', 'hard', 'normal']);
  assert.ok(games.every(g => g.houses !== 4 || g.size >= 64));
});

test('censored games are not counted as completed wins or within the pacing window', () => {
  assert.deepEqual(summarize([{ endSeconds: 1199 }, { endSeconds: 1200 }, { endSeconds: 2400 }, { endSeconds: 2401 }, { endSeconds: null }]),
    { under20: 1, inside20to40: 2, over40: 1, censored: 1 });
});

test('headless runs repeat the same deterministic state and do not invent eliminations at the limit', () => {
  const settings = { id: 'tiny', seed: 7, size: 64, houses: 4, difficulty: 'normal' };
  const a = runGame(settings, 0.01), b = runGame(settings, 0.01);
  assert.equal(a.stateHash, b.stateHash);
  assert.equal(a.endSeconds, null);
  assert.equal(a.winner, null);
  assert.deepEqual(Object.values(a.eliminations), [null, null, null, null]);
});
