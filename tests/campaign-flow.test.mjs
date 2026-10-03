// The campaign's flow between the menu screens and the battle (research.md §6, contracts C2 and C3): house
// selection, joining, briefing, region zoom, the mission, results or defeat, retry, passwords and the end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREENS, SEGA_ORDER, launchQuery, backOf, step, resolveScreen } from '../src/campaign/flow.js';
import { emptyProgress, jumpTo } from '../src/campaign/progress.js';
import { readResult } from '../src/campaign/result.js';

const result = (house, mission, won, over = {}) => readResult({ dune: 'missionEnd', house, mission, won, seconds: 600,
  score: { minutes: 11, credits: 1500, survivingValue: 20, killedValue: 5, lostValue: 1 }, ...over });

/** Runs actions from a start, returning every state on the way. */
function run(actions, progress = emptyProgress(), state = { screen: 'campaign' }) {
  const seen = [];
  for (const action of actions) {
    const out = step(progress, state, action);
    progress = out.progress;
    state = out.state;
    seen.push(out);
  }
  return { progress, state, seen };
}

test('the campaign screens are the nine the shell knows (C3), and the houses stand in the Sega order', () => {
  assert.deepEqual(SCREENS, ['campaign', 'campaign-house', 'campaign-join', 'campaign-briefing', 'campaign-region', 'campaign-results',
    'campaign-password', 'campaign-defeat', 'campaign-ending']);
  assert.deepEqual(SEGA_ORDER, ['atreides', 'ordos', 'harkonnen']);
});

test('the launch query names the mission scene, the house and the mission (C2)', () => {
  assert.equal(launchQuery('ordos', 3), 'scene=mission&house=ordos&mission=3');
  assert.equal(launchQuery('harkonnen', 9, 77), 'scene=mission&house=harkonnen&mission=9&seed=77');
  assert.throws(() => launchQuery('fremen', 1));
  assert.throws(() => launchQuery('ordos', 0));
  assert.throws(() => launchQuery('ordos', 10));
});

test('a new campaign: house, three pages and yes, the briefing of mission 1, proceed, the region, then the mission', () => {
  const { progress, state, seen } = run([{ type: 'new' }, { type: 'pick', house: 'ordos' }, { type: 'join' }, { type: 'proceed' }, { type: 'launch' }]);
  assert.deepEqual(seen.map((s) => s.state.screen), ['campaign-house', 'campaign-join', 'campaign-briefing', 'campaign-region', 'mission']);
  assert.equal(seen[2].state.mission, 1);
  assert.equal(seen[4].launch, 'scene=mission&house=ordos&mission=1');
  assert.equal(progress.house, 'ordos');
  assert.equal(progress.houses.ordos.mission, 1);
  assert.equal(state.house, 'ordos');
  assert.ok(seen[2].save, 'joining saves');
});

test('declining a house goes back to the house selection, saving nothing', () => {
  const { seen, progress } = run([{ type: 'new' }, { type: 'pick', house: 'harkonnen' }, { type: 'decline' }]);
  assert.equal(seen[2].state.screen, 'campaign-house');
  assert.deepEqual(progress, emptyProgress());
});

test('a win: results, then the next mission\'s briefing; the progress is saved with the result', () => {
  const start = run([{ type: 'new' }, { type: 'pick', house: 'atreides' }, { type: 'join' }, { type: 'proceed' }, { type: 'launch' }]);
  const { seen, progress } = run([{ type: 'result', result: result('atreides', 1, true) }, { type: 'next' }], start.progress, start.state);
  assert.equal(seen[0].state.screen, 'campaign-results');
  assert.ok(seen[0].save);
  assert.equal(seen[1].state.screen, 'campaign-briefing');
  assert.equal(seen[1].state.mission, 2);
  assert.equal(progress.houses.atreides.mission, 2);
});

test('a defeat: the Mentat\'s lose lines, then the same mission\'s briefing to try again', () => {
  const p = jumpTo(emptyProgress(), 'harkonnen', 5);
  const { seen, progress } = run([{ type: 'proceed' }, { type: 'launch' }, { type: 'result', result: result('harkonnen', 5, false) }, { type: 'retry' }, { type: 'proceed' }, { type: 'launch' }],
    p, { screen: 'campaign-briefing', house: 'harkonnen', mission: 5 });
  assert.deepEqual(seen.map((s) => s.state.screen), ['campaign-region', 'mission', 'campaign-defeat', 'campaign-briefing', 'campaign-region', 'mission']);
  assert.equal(seen[3].state.mission, 5);
  assert.equal(seen[5].launch, 'scene=mission&house=harkonnen&mission=5');
  assert.equal(progress.houses.harkonnen.mission, 5);
});

test('a result for another mission than the one played is still the one recorded (the battle knows best)', () => {
  const { state, progress } = run([{ type: 'result', result: result('ordos', 4, true) }], jumpTo(emptyProgress(), 'atreides', 2), { screen: 'mission', house: 'atreides', mission: 2 });
  assert.equal(state.house, 'ordos');
  assert.equal(state.mission, 4);
  assert.equal(progress.houses.ordos.mission, 5);
  assert.equal(progress.house, 'ordos');
});

test('quitting a mission returns to its briefing', () => {
  const state = { screen: 'mission', house: 'ordos', mission: 6 };
  const p = jumpTo(emptyProgress(), 'ordos', 6);
  assert.equal(resolveScreen('campaign', state, p), 'campaign-briefing');
  const out = step(p, state, { type: 'quit' });
  assert.deepEqual(out.state, { screen: 'campaign-briefing', house: 'ordos', mission: 6 });
  assert.equal(resolveScreen('campaign', { screen: 'campaign-house' }, p), 'campaign', 'from anywhere else it is the hub');
});

test('the results screen of a lost mission is the defeat screen', () => {
  const lost = { ...emptyProgress(), last: result('ordos', 3, false) };
  assert.equal(resolveScreen('campaign-results', { screen: 'campaign-results' }, lost), 'campaign-defeat');
  const won = { ...emptyProgress(), last: result('ordos', 3, true) };
  assert.equal(resolveScreen('campaign-results', { screen: 'campaign-results' }, won), 'campaign-results');
  assert.equal(resolveScreen('options', {}, won), 'options', 'other screens pass through');
});

test('the end: winning mission 9 leads from the results to the ending, and the ending to the title', () => {
  const p = jumpTo(emptyProgress(), 'harkonnen', 9);
  const { seen, progress } = run([{ type: 'result', result: result('harkonnen', 9, true) }, { type: 'next' }, { type: 'done' }], p, { screen: 'mission', house: 'harkonnen', mission: 9 });
  assert.deepEqual(seen.map((s) => s.state.screen), ['campaign-results', 'campaign-ending', 'title']);
  assert.equal(progress.houses.harkonnen.mission, 10);
});

test('continue picks up a house where it was left; a finished house opens its ending', () => {
  let p = jumpTo(emptyProgress(), 'ordos', 4);
  assert.deepEqual(step(p, { screen: 'campaign' }, { type: 'continue' }).state, { screen: 'campaign-briefing', house: 'ordos', mission: 4 });
  p = jumpTo(p, 'atreides', 2);
  assert.deepEqual(step(p, { screen: 'campaign' }, { type: 'continue', house: 'ordos' }).state, { screen: 'campaign-briefing', house: 'ordos', mission: 4 });
  assert.equal(step(p, { screen: 'campaign' }, { type: 'continue' }).state.house, 'atreides', 'without a house: the current one');
  p = { ...p, houses: { ...p.houses, atreides: { mission: 10, best: {} } } };
  assert.equal(step(p, { screen: 'campaign' }, { type: 'continue', house: 'atreides' }).state.screen, 'campaign-ending');
  assert.equal(step(emptyProgress(), { screen: 'campaign' }, { type: 'continue' }).state.screen, 'campaign', 'nothing to continue: the hub stays');
});

test('a password jumps to its house and mission and saves it; a wrong one says so and stays', () => {
  const ok = step(emptyProgress(), { screen: 'campaign-password' }, { type: 'password', text: 'coldhunter' });
  assert.deepEqual(ok.state, { screen: 'campaign-briefing', house: 'ordos', mission: 5 });
  assert.equal(ok.progress.house, 'ordos');
  assert.equal(ok.progress.houses.ordos.mission, 5);
  assert.ok(ok.save);
  const bad = step(emptyProgress(), { screen: 'campaign-password' }, { type: 'password', text: 'spicedanse' });
  assert.equal(bad.state.screen, 'campaign-password');
  assert.equal(bad.state.error, 'unknown');
  assert.equal(bad.save, undefined);
});

test('Back and Esc chain: briefing, region and the rest lead where the player came from', () => {
  assert.equal(backOf('campaign'), 'title');
  assert.equal(backOf('campaign-house'), 'campaign');
  assert.equal(backOf('campaign-join'), 'campaign-house');
  assert.equal(backOf('campaign-briefing'), 'campaign');
  assert.equal(backOf('campaign-region'), 'campaign-briefing');
  assert.equal(backOf('campaign-password'), 'campaign');
  for (const s of ['campaign-results', 'campaign-defeat', 'campaign-ending']) assert.equal(backOf(s), null, `${s} has no way back, only on`);
  const out = step(emptyProgress(), { screen: 'campaign-region', house: 'ordos', mission: 2 }, { type: 'back' });
  assert.deepEqual(out.state, { screen: 'campaign-briefing', house: 'ordos', mission: 2 });
});

test('a button can open a campaign screen directly, and nothing else', () => {
  assert.deepEqual(step(emptyProgress(), { screen: 'campaign' }, { type: 'open', screen: 'campaign-password' }).state, { screen: 'campaign-password' });
  assert.deepEqual(step(emptyProgress(), { screen: 'campaign' }, { type: 'open', screen: 'campaign-ending', house: 'ordos', mission: 9 }).state,
    { screen: 'campaign-ending', house: 'ordos', mission: 9 });
  assert.deepEqual(step(emptyProgress(), { screen: 'campaign-defeat', house: 'ordos', mission: 4 }, { type: 'open', screen: 'campaign' }).state,
    { screen: 'campaign', house: 'ordos', mission: 4 }, 'the hub remembers the house');
  const state = { screen: 'campaign' };
  assert.equal(step(emptyProgress(), state, { type: 'open', screen: 'options' }).state, state);
});

test('an action that does not fit the screen changes nothing', () => {
  const state = { screen: 'campaign-house' };
  const p = emptyProgress();
  assert.equal(step(p, state, { type: 'join' }).state, state, 'join with no house picked');
  assert.equal(step(p, state, { type: 'pick', house: 'mercenary' }).state, state);
  assert.equal(step(p, state, { type: 'nonsense' }).state, state);
  assert.equal(step(p, { screen: 'campaign-results', house: 'ordos', mission: 3 }, { type: 'retry' }).state.screen, 'campaign-results');
});
