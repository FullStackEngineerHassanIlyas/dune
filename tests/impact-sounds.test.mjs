// What a shot sounds like where it lands (src/audio/cues.js, the impact event's target from src/sim/combat.js): armour
// knocks dull and deep, a man takes a soft thwack, a building chips or bursts in concrete, sand swallows the rest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cueFor } from '../src/audio/cues.js';
import { RECIPES } from '../src/audio/synth.js';
import { flatWorld } from './helpers.mjs';

const seen = () => true;
const impact = (projectile, hit, target) => cueFor({ type: 'impact', projectile, hit, target, x: 1, y: 1 }, 'atreides', seen)?.id ?? null;

test('each kind of target has its own hit sound, and every one of them is synthesized', () => {
  assert.deepEqual(['vehicle', 'air', 'foot', 'structure'].map((t) => impact('bullet', true, t)), ['bulletHit', 'bulletHit', 'bulletSoft', 'bulletChip']);
  assert.deepEqual(['vehicle', 'foot', 'structure'].map((t) => impact('shell', true, t)), ['hit', 'sandHit', 'hitStructure']);
  assert.equal(impact('bullet', false, null), null);
  assert.equal(impact('shell', false, null), 'sandHit');
  assert.equal(impact('bullet', true, undefined), 'bulletHit', 'an older event without a target still sounds');
  for (const id of ['bulletHit', 'bulletSoft', 'bulletChip', 'hit', 'hitStructure', 'sandHit']) assert.ok(RECIPES[id], id);
});

test('an impact says what it struck', () => {
  const world = flatWorld(24, 24);
  world.spawnUnit('combatTank', 'atreides', 5, 5);
  const target = world.spawnUnit('soldier', 'harkonnen', 8, 5);
  world.spawnStructure('windtrap', 'harkonnen', 12, 12);
  const events = [];
  for (let i = 0; i < 400 && !events.some((e) => e.type === 'impact' && e.hit); i++) { world.step(); events.push(...world.events.drain()); }
  const hit = events.find((e) => e.type === 'impact' && e.hit);
  assert.ok(hit, 'the tank fired at the soldier');
  assert.equal(hit.target, target.isGround ? 'foot' : 'air');
});
