import test from 'node:test';
import assert from 'node:assert/strict';
import { flatWorld } from './helpers.mjs';
import { findTarget } from '../src/sim/combat.js';

test('local target scans skip Euclidean distance work for distant enemies', (t) => {
  const w = flatWorld(64, 64); w.houses.get('atreides').isAI = true;
  for (let i = 0; i < 30; i++) w.spawnUnit('combatTank', 'harkonnen', 30 + i, 40);
  for (let i = 0; i < 5; i++) w.spawnStructure('windtrap', 'harkonnen', 30 + i * 3, 50);
  const near = w.spawnUnit('combatTank', 'harkonnen', 6, 5);
  const hypot = Math.hypot; let calls = 0;
  t.mock.method(Math, 'hypot', (...args) => { calls++; return hypot(...args); });
  assert.deepEqual(findTarget(w, 'atreides', 5.5, 5.5, 3), { kind: 'unit', id: near.id });
  assert.ok(calls <= 2, `local scan computed ${calls} Euclidean distances for distant targets`);
});

test('target scans keep exact radius boundaries, insertion ties and unlimited searches', () => {
  const w = flatWorld(64, 64); w.houses.get('atreides').isAI = true;
  const first = w.spawnUnit('combatTank', 'harkonnen', 8, 9);
  w.spawnUnit('combatTank', 'harkonnen', 2, 9);
  assert.deepEqual(findTarget(w, 'atreides', 5.5, 5.5, 5), { kind: 'unit', id: first.id });
  assert.equal(findTarget(w, 'atreides', 5.5, 5.5, 5 - 1e-10), null);
  assert.deepEqual(findTarget(w, 'atreides', 5.5, 5.5, Infinity), { kind: 'unit', id: first.id });
});

test('target scans measure footprint edges and retain the half-tile unit preference', () => {
  const w = flatWorld(64, 64); w.houses.get('atreides').isAI = true;
  const s = w.spawnStructure('windtrap', 'harkonnen', 10, 5);
  assert.deepEqual(findTarget(w, 'atreides', 5.5, 5.5, 5), { kind: 'structure', id: s.id });
  assert.equal(findTarget(w, 'atreides', 5.5, 5.5, 5 - 1e-10), null);
  const u = w.spawnUnit('combatTank', 'harkonnen', 5, 11); u.y = 11;
  assert.deepEqual(findTarget(w, 'atreides', 5.5, 5.5, 6), { kind: 'unit', id: u.id });
  u.y += 1e-10;
  assert.deepEqual(findTarget(w, 'atreides', 5.5, 5.5, 6), { kind: 'structure', id: s.id });
});
