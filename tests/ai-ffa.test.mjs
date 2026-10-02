import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { createBrain } from '../src/sim/ai.js';
import { destroyStructure } from '../src/sim/combat.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

// Three bases on open rock: the Harkonnen (a computer) at the west end, the Ordos a little nearer to it than
// the Atreides. Every house is a rival of every other (free-for-all).
function threeBases() {
  const world = flatWorld(56, 26, G.ROCK);
  world.spawnStructure('constructionYard', 'harkonnen', 2, 10);
  world.spawnStructure('constructionYard', 'ordos', 24, 3);
  world.spawnStructure('constructionYard', 'atreides', 26, 18);
  for (let k = 0; k < 6; k++) world.spawnUnit('combatTank', 'harkonnen', 6, 6 + k * 2);
  const brain = createBrain(world, 'harkonnen', 'normal');
  world.houses.get('harkonnen').credits = 0;
  brain.nextAttack = 0;
  return { world, brain };
}

function firstWave(world, seconds = 60) {
  let wave = null;
  runUntil(world, () => { for (const e of world.events.drain()) if (e.type === 'aiAttack' && e.house === 'harkonnen') wave ??= e; return !!wave; }, seconds);
  return wave;
}

test('an AI wave goes for the nearer of two rivals, computer or not', () => {
  const { world } = threeBases();
  const wave = firstWave(world, 5);
  assert.ok(wave, 'a wave went out');
  assert.equal(wave.target, 'ordos');
  assert.ok(Math.hypot(wave.x - 25, wave.y - 4) < 4, `aimed at the Ordos yard (${wave.x},${wave.y})`);
});

test('a well guarded rival is passed over for a bare one not much further off', () => {
  const { world } = threeBases();
  for (let k = 0; k < 8; k++) world.spawnUnit('combatTank', 'ordos', 30 + (k % 4) * 2, 2 + Math.floor(k / 4) * 2);
  const wave = firstWave(world, 5);
  assert.equal(wave?.target, 'atreides');
});

test('a house that raided the base is paid back first', () => {
  const { world } = threeBases();
  const raider = world.spawnUnit('quad', 'atreides', 3, 20);   // inside the base, out of the tanks' reach at first
  const wave = firstWave(world);
  assert.ok(!world.units.has(raider.id), 'the raider was dealt with');
  assert.equal(wave?.target, 'atreides');
});

test('a wave whose rival is beaten turns on the next one', () => {
  const { world, brain } = threeBases();
  world.rules.victory = true;
  assert.equal(firstWave(world, 5).target, 'ordos');
  destroyStructure(world, [...world.structures.values()].find((s) => s.house === 'ordos'), null);
  run(world, 1);
  assert.ok(world.houses.get('ordos').defeated && !world.outcome);
  const onward = () => brain.wave.some((id) => { const o = world.units.get(id)?.order; return o?.type === 'attackMove' && Math.hypot(o.x - 27, o.y - 19) < 3; });
  assert.ok(runUntil(world, onward, 45) >= 0, 'the wave went on to the Atreides yard');
  run(world, 30);
  assert.equal(world.outcome?.winner, 'harkonnen');
});
