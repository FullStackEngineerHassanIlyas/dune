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

test('independent first waves do not both pile onto the same exposed fourth-house base', () => {
  const world = flatWorld(72, 48, G.ROCK);
  world.addHouse('sardaukar');
  for (const [house, x, y] of [['harkonnen', 3, 20], ['sardaukar', 62, 20], ['ordos', 32, 8], ['atreides', 32, 36]]) {
    world.spawnStructure('constructionYard', house, x, y);
  }
  for (let k = 0; k < 8; k++) world.spawnUnit('combatTank', 'atreides', 30 + k * 2, 42);
  for (const [house, x] of [['harkonnen', 6], ['sardaukar', 60]]) {
    for (let k = 0; k < 6; k++) world.spawnUnit('combatTank', house, x, 16 + k * 2);
    createBrain(world, house, 'normal').nextAttack = 0;
    world.houses.get(house).credits = 0;
  }
  const waves = [];
  runUntil(world, () => {
    waves.push(...world.events.drain().filter(e => e.type === 'aiAttack'));
    return waves.length >= 2;
  }, 5);
  assert.equal(waves.length, 2);
  assert.equal(waves[0].target, 'ordos', 'the first house still finds the nearby exposed base');
  assert.notEqual(waves[1].target, waves[0].target, 'the next independent wave finds a different front');
});

test('a house that raided the base is paid back first', () => {
  const { world } = threeBases();
  const raider = world.spawnUnit('quad', 'atreides', 3, 20);   // inside the base, out of the tanks' reach at first
  const wave = firstWave(world);
  assert.ok(!world.units.has(raider.id), 'the raider was dealt with');
  assert.equal(wave?.target, 'atreides');
});

test('a four-house army answers an incoming rival wave instead of leaving for a weaker bystander', () => {
  const { world } = threeBases();
  world.addHouse('sardaukar');
  world.spawnStructure('constructionYard', 'sardaukar', 49, 12);
  const invader = world.spawnUnit('combatTank', 'sardaukar', 45, 18);
  const brain = createBrain(world, 'sardaukar', 'normal');
  brain.nextAttack = Infinity;
  world.houses.get('sardaukar').credits = 0;
  brain.wave = [invader.id];
  brain.waveFoe[invader.id] = 'harkonnen';
  world.issue('sardaukar', { type: 'attackMove', ids: [invader.id], x: 3, y: 12 });
  assert.equal(firstWave(world, 5)?.target, 'sardaukar');
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

test('a wave keeps its own foe: a later wave going for another house does not pull it off a half-razed base', () => {
  const world = flatWorld(64, 34, G.ROCK);
  world.spawnStructure('constructionYard', 'harkonnen', 2, 12);
  for (const [t, x, y] of [['constructionYard', 24, 3], ['windtrap', 30, 3], ['refinery', 36, 3], ['heavyFactory', 44, 3], ['refinery', 50, 3], ['heavyFactory', 56, 3], ['windtrap', 44, 9], ['windtrap', 50, 9]]) {
    world.spawnStructure(t, 'ordos', x, y);
  }
  world.spawnStructure('constructionYard', 'atreides', 28, 26);
  for (let k = 0; k < 4; k++) world.spawnUnit('combatTank', 'harkonnen', 6, 8 + k * 2);
  const brain = createBrain(world, 'harkonnen', 'normal');
  world.houses.get('harkonnen').credits = 0;
  brain.nextAttack = 0;
  assert.equal(firstWave(world, 10)?.target, 'ordos');
  const first = [...brain.wave];
  run(world, 40);
  world.spawnUnit('quad', 'atreides', 3, 22);   // a raid on the Harkonnen base: the next wave pays the Atreides back
  for (let k = 0; k < 6; k++) world.spawnUnit('combatTank', 'harkonnen', 8, 6 + k * 2);
  run(world, 15);
  world.events.drain();
  brain.nextAttack = world.time;
  assert.equal(firstWave(world, 30)?.target, 'atreides');
  const ordosLeft = () => [...world.structures.values()].some((s) => s.house === 'ordos');
  for (let k = 0; k < 8 && ordosLeft(); k++) {
    run(world, 5);
    for (const u of first.map((id) => world.units.get(id)).filter(Boolean)) {
      assert.ok(u.y < 16, `wave 1 tank ${u.id} left the Ordos base for the Atreides (${Math.round(u.x)},${Math.round(u.y)} ${u.order.type})`);
    }
  }
});

test('a sandworm is no house: the AI sends nobody at it and bears it no grudge', () => {
  const { world, brain } = threeBases();
  const worm = world.spawnUnit('sandworm', 'worm', 5, 20);   // a worm of no house surfacing beside the Harkonnen yard
  const aimed = [];
  const issue = world.issue.bind(world);
  world.issue = (house, cmd) => { if (cmd.targetId === worm.id || (cmd.type === 'attackMove' && Math.hypot(cmd.x - worm.tx, cmd.y - worm.ty) < 1)) aimed.push(cmd.type); return issue(house, cmd); };
  run(world, 20);
  assert.deepEqual(aimed, []);
  assert.notEqual(brain.grudge?.house, 'worm');
});
