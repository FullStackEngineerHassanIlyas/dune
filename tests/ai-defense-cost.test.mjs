import test from 'node:test';
import assert from 'node:assert/strict';
import { flatWorld } from './helpers.mjs';
import { createBrain, updateAI } from '../src/sim/ai.js';

test('base defence rejects distant enemies before Euclidean distance work', (t) => {
  const w = flatWorld(64, 64);
  w.spawnStructure('constructionYard', 'atreides', 2, 2);
  w.houses.get('atreides').credits = 0;
  const b = createBrain(w, 'atreides'); b.nextAttack = Infinity;
  for (let i = 0; i < 12; i++) w.spawnUnit('combatTank', 'harkonnen', 48 + i, 60);
  const hypot = Math.hypot; let distant = 0;
  t.mock.method(Math, 'hypot', (...args) => { if (Math.abs(args[0]) >= 40 && Math.abs(args[1]) >= 40) distant++; return hypot(...args); });
  updateAI(w);
  assert.equal(b.grudge, undefined);
  assert.equal(distant, 0, 'distant enemies do not need an exact base-threat distance');
});
