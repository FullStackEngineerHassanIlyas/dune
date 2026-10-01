import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { Announcer, APPROACH_TILES, WARN_EVERY, sightingText } from '../src/game/announcer.js';
import { Selection } from '../src/input/selection.js';
import { flatWorld } from './helpers.mjs';

// A stand-in for the VoicePlayer: records what the announcer asks it to say.
function fakePlayer() {
  return { lines: [], interrupts: [], updates: 0, say(id) { this.lines.push(id); return true; }, interrupt(id) { this.interrupts.push(id); return true; }, update() { this.updates++; } };
}
function setup() {
  const world = flatWorld(48, 48, G.ROCK);
  world.fogOfWar = false;
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  const player = fakePlayer(), messages = [];
  const a = new Announcer({ world, house: 'atreides', player, onMessage: (t) => messages.push(t), rng: () => 0 });
  return { world, a, player, messages };
}

test('the player\'s events are voiced, others\' are not, and the battle\'s end cuts in', () => {
  const { a, player } = setup();
  a.onEvent({ type: 'eva', house: 'atreides', key: 'constructionComplete' }, 0);
  a.onEvent({ type: 'eva', house: 'harkonnen', key: 'constructionComplete' }, 0);
  a.onEvent({ type: 'fired', house: 'atreides' }, 0);
  a.onEvent({ type: 'eva', house: 'atreides', key: 'missionAccomplished' }, 1);
  assert.deepEqual(player.lines, ['constructionComplete']);
  assert.deepEqual(player.interrupts, ['missionAccomplished']);
});

test('an enemy Death Hand is announced only when it falls near the player\'s base', () => {
  const { a, player } = setup();
  a.onEvent({ type: 'palaceFired', house: 'harkonnen', weapon: 'deathHand', x: 40, y: 40 }, 0);
  a.onEvent({ type: 'palaceFired', house: 'harkonnen', weapon: 'deathHand', x: 8, y: 8 }, 0);
  assert.deepEqual(player.lines, ['missileApproaching']);
});

test('unit orders the player gives draw one acknowledgement per frame, once, even while paused', () => {
  const { world, a, player } = setup();
  const u = world.spawnUnit('trike', 'atreides', 10, 10);
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  a.frame(0);
  assert.deepEqual(player.lines, [], 'production answers for itself');
  world.issue('atreides', { type: 'move', ids: [u.id], x: 12, y: 12 });
  world.issue('harkonnen', { type: 'move', ids: [99], x: 12, y: 12 });
  a.frame(0.1);
  a.frame(0.2);   // paused: the same commands are still waiting
  assert.deepEqual(player.lines, ['acknowledged']);
  world.step();
  world.issue('atreides', { type: 'attack', ids: [u.id], x: 20, y: 20, force: true });
  a.frame(0.3);
  assert.deepEqual(player.lines, ['acknowledged', 'affirmative']);
  assert.equal(player.updates, 4);
});

test('selecting one of the player\'s own units reports; pruning the dead or picking an enemy does not', () => {
  const { world, a, player } = setup();
  const mine = world.spawnUnit('trike', 'atreides', 10, 10), theirs = world.spawnUnit('trike', 'harkonnen', 30, 30);
  const sel = new Selection();
  a.frame(0, sel);
  sel.set([theirs.id]);
  a.frame(0.1, sel);
  assert.deepEqual(player.lines, []);
  sel.set([mine.id]);
  a.frame(0.2, sel);
  assert.deepEqual(player.lines, ['reporting']);
  sel.prune(() => false);
  a.frame(0.3, sel);
  assert.deepEqual(player.lines, ['reporting']);
});

test('the radar coming up or going down is announced, not its first reading', () => {
  const { a, player } = setup();
  a.frame(0, null, false);
  a.frame(0.1, null, false);
  a.frame(0.2, null, true);
  a.frame(0.3, null, false);
  assert.deepEqual(player.lines, ['radarOn', 'radarOff']);
});

test('an enemy seen near the base is announced once, by house, with a message; a far one is not', () => {
  const { world, a, player, messages } = setup();
  world.spawnUnit('trike', 'harkonnen', 40, 40);
  a.frame(0);
  assert.deepEqual(player.lines, []);
  const near = world.spawnUnit('quad', 'harkonnen', 4 + 2 + APPROACH_TILES - 2, 6);
  a.frame(1);
  assert.deepEqual(player.lines, ['approaching.harkonnen']);
  assert.deepEqual(messages, ['Warning: Harkonnen unit approaching.']);
  world.spawnUnit('trike', 'ordos', 8, 12);
  a.frame(2);
  assert.equal(player.lines.length, 1, 'the next sighting waits out the warning interval');
  a.frame(2 + WARN_EVERY);
  assert.deepEqual(player.lines, ['approaching.harkonnen', 'approaching.ordos']);
  assert.ok(a.warned.has(near.id));
  world.units.delete(near.id);
  a.frame(4 + WARN_EVERY);
  assert.ok(!a.warned.has(near.id), 'the dead are forgotten');
  world.spawnUnit('carryall', 'harkonnen', 6, 12);
  a.frame(60);
  assert.equal(player.lines.length, 2, 'flying freight is no attack');
});

test('a sandworm in sight is announced wherever it is', () => {
  const { world, a, player, messages } = setup();
  world.spawnUnit('sandworm', 'fremen', 40, 40);
  a.frame(0);
  assert.deepEqual(player.lines, ['wormsign']);
  assert.deepEqual(messages, ['Warning: wormsign.']);
});

test('sighting texts match the spoken lines', () => {
  assert.equal(sightingText('ordos'), 'Warning: Ordos unit approaching.');
  assert.equal(sightingText('sardaukar'), 'Warning: Sardaukar approaching.');
  assert.equal(sightingText('mercenary'), 'Warning: enemy unit approaching.');
});
