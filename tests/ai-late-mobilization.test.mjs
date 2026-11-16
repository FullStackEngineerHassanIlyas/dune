import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrain, updateAI, DIFFICULTY } from '../src/sim/ai.js';
import { flatWorld } from './helpers.mjs';
function wave(difficulty, seconds, mission = null, survivors = 0, moving = 0) {
  const w = flatWorld(64, 64), h = w.houses.get('harkonnen');
  w.spawnStructure('constructionYard', h.id, 2, 2);
  w.spawnStructure('constructionYard', 'atreides', 50, 50);
  h.credits = 0;
  const b = createBrain(w, h.id, difficulty, mission); b.waves = 30; b.nextAttack = 0;
  const cap = DIFFICULTY[difficulty].armyCap;
  for (let i = 0; i < cap; i++) {
    const u = w.spawnUnit('combatTank', h.id, 5 + i, 10);
    if (i >= cap - moving) u.order = { type: 'move', x: 40, y: 40 };
    if (i < survivors) { b.wave.push(u.id); b.waveFoe[u.id] = 'atreides'; u.order = { type: 'attackMove', x: 51, y: 51 }; }
  }
  w.time = seconds;
  updateAI(w);
  return w.pending.map(c => c.command).find(c => c.type === 'attackMove')?.ids.length ?? 0;
}
for (const difficulty of ['easy', 'normal', 'hard']) {
  test(`${difficulty} uses its calibrated late skirmish wave limit`, () => {
    assert.equal(wave(difficulty, 1200), difficulty === 'hard' ? DIFFICULTY.hard.waveMax : DIFFICULTY[difficulty].armyCap);
  });
  test(`${difficulty} keeps its ordinary wave limit before late mobilization`, () => {
    assert.equal(wave(difficulty, 1199), DIFFICULTY[difficulty].waveMax);
  });
}
test('late mobilization preserves authored campaign wave limits', () => {
  assert.equal(wave('normal', 2400, { firstAttack: 0 }), DIFFICULTY.normal.waveMax);
});
test('late mobilization counts survivors rather than waiting beyond the army cap', () => {
  assert.equal(wave('normal', 2400, null, 4), DIFFICULTY.normal.armyCap - 4);
});

test('late mobilization never delays a full ordinary wave for reinforcements still moving home', () => {
  assert.equal(wave('normal', 2400, null, 0, 6), DIFFICULTY.normal.waveMax);
  assert.equal(wave('hard', 2400, null, 0, 10), DIFFICULTY.hard.waveMax);
});
