// The end hand-off (C2): the score inputs a mission keeps (research §5: a hundredth of each building's price —
// enemy buildings destroyed, the player's lost and still standing — the credits and the minutes) and the
// 'missionEnd' message the battle posts to the menu shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { destroyStructure } from '../src/sim/combat.js';
import { setup, razeBase } from './missions-helpers.mjs';
import { run, runUntil } from './helpers.mjs';

const by = (house) => ({ house, id: 0, kind: 'unit' });
const find = (world, house, type) => [...world.structures.values()].find((s) => s.house === house && s.typeId === type);

test('score inputs: buildings destroyed and lost at a hundredth of their price, walls left out, the base still standing', () => {
  const { world } = setup();
  const wall = world.spawnStructure('wall', 'harkonnen', 27, 12);
  world.spawnStructure('wall', 'atreides', 13, 26);
  const silo = world.spawnStructure('silo', 'atreides', 12, 27);
  world.spawnStructure('concrete4', 'atreides', 2, 28);
  destroyStructure(world, find(world, 'harkonnen', 'windtrap'), by('atreides'));   // 300 → 3
  destroyStructure(world, find(world, 'harkonnen', 'turret'), null);               // 125 → 1, whoever did it
  destroyStructure(world, wall, by('atreides'));                                    // walls do not score
  destroyStructure(world, silo, by('harkonnen'));                                    // 150 → 1 lost
  world.houses.get('atreides').credits = 1234.9;
  const s = world.mission.score();
  assert.equal(s.killedValue, 3 + 1);
  assert.equal(s.lostValue, 1);
  assert.equal(s.survivingValue, 4 + 3 + 4, 'yard 400, wind trap 300, refinery 400: no walls or slabs');
  assert.equal(s.credits, 1234);
  assert.equal(s.minutes, 1);
  run(world, 61);
  assert.equal(world.mission.score().minutes, 2, 'floor(seconds / 60) + 1');
});

test('a cheap building still scores one', () => {
  const { world } = setup();
  const cheap = world.spawnStructure('turret', 'harkonnen', 27, 2);
  cheap.type = { ...cheap.type, cost: 40 };
  destroyStructure(world, cheap, by('atreides'));
  assert.equal(world.mission.score().killedValue, 1);
});

test('the end message has the C2 shape, frozen at the end', () => {
  const { world } = setup({ minSeconds: 10 });
  razeBase(world, 'harkonnen', 'atreides');
  assert.ok(runUntil(world, () => world.outcome, 12) >= 0);
  run(world, 5);
  const m = world.mission.result();
  assert.deepEqual(Object.keys(m), ['dune', 'house', 'mission', 'won', 'draw', 'seconds', 'stats', 'score']);
  assert.deepEqual([m.dune, m.house, m.mission, m.won, m.draw, m.seconds], ['missionEnd', 'atreides', 3, true, false, 10]);
  assert.deepEqual(Object.keys(m.score), ['minutes', 'credits', 'survivingValue', 'killedValue', 'lostValue']);
  assert.equal(m.score.minutes, 1);
  assert.equal(m.score.killedValue, 4 + 3);
  assert.equal(m.stats.won, true);
  assert.deepEqual(m.stats.rows.map((r) => r.label), ['Spice harvested', 'Units destroyed', 'Units lost', 'Buildings destroyed', 'Buildings lost']);
  assert.doesNotThrow(() => structuredClone(m), 'it goes through postMessage');
  assert.equal(JSON.parse(JSON.stringify(m)).score.killedValue, 7);
});

test('the score inputs freeze at the outcome: what happens during the fly-over does not count', () => {
  const { world } = setup({ minSeconds: 10 });
  razeBase(world, 'harkonnen', 'atreides');   // the enemy's turret still stands (turrets do not count)
  assert.ok(runUntil(world, () => world.outcome, 12) >= 0);
  const atEnd = world.mission.result();
  // the 1.5 s + 4.2 s before GameView posts: the leftover turret knocks down a building, the player's tanks
  // finish the turret, a harvester unloads
  const turret = find(world, 'harkonnen', 'turret');
  destroyStructure(world, find(world, 'atreides', 'windtrap'), { house: 'harkonnen', id: turret.id, kind: 'structure' });
  destroyStructure(world, turret, by('atreides'));
  world.houses.get('atreides').credits += 300;
  run(world, 5.7);
  const posted = world.mission.result();
  assert.deepEqual(posted.score, atEnd.score);
  assert.deepEqual(posted.stats, atEnd.stats, 'the stats froze with it');
  assert.deepEqual(world.mission.debug().score, atEnd.score);
});

test('a lost mission says so', () => {
  const { world } = setup({ minSeconds: 3 });
  razeBase(world, 'atreides', 'harkonnen');
  run(world, 3.3);
  const m = world.mission.result();
  assert.deepEqual([m.won, m.draw], [false, false]);
  assert.equal(m.score.lostValue, 4 + 3 + 4);
  assert.equal(m.score.survivingValue, 0);
});

test('the debug state shows the objective, its progress, the next reinforcement and the outcome', () => {
  const { world } = setup({ reinforcements: [{ house: 'atreides', units: ['quad'], at: 30 }] });
  const d = world.mission.debug();
  assert.deepEqual([d.house, d.mission, d.objective.kind, d.progress.left, d.minSeconds, d.outcome], ['atreides', 3, 'destroy', 2, 120, null]);
  assert.deepEqual(d.nextReinforcement, { at: 30, units: ['quad'], via: 'carryall' });
  assert.equal(d.objective.text, world.mission.hudLine());
  assert.doesNotThrow(() => JSON.stringify(d));
});
