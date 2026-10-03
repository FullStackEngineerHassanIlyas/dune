// Saved campaign progress: localStorage 'dune2-3d.campaign', versioned, per house, and safe with corrupt, missing or
// blocked storage; the result a battle posts (contract C2) read defensively.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY, VERSION, emptyProgress, cleanProgress, loadProgress, saveProgress, joinHouse, jumpTo, recordResult, continues, finished } from '../src/campaign/progress.js';
import { readResult, sampleResult } from '../src/campaign/result.js';

const memory = (init = {}) => {
  const data = { ...init };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
};
const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
const full = { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); } };

const endMessage = (over = {}) => ({
  dune: 'missionEnd', house: 'ordos', mission: 2, won: true, draw: false, seconds: 14 * 60 + 10,
  stats: { won: true, seconds: 850, rows: [
    { label: 'Spice harvested', you: 7014, enemy: 1553 }, { label: 'Units destroyed', you: 35, enemy: 6 }, { label: 'Units lost', you: 6, enemy: 35 },
    { label: 'Buildings destroyed', you: 4, enemy: 0 }, { label: 'Buildings lost', you: 0, enemy: 4 }] },
  score: { minutes: 15, credits: 2712, survivingValue: 31, killedValue: 9, lostValue: 0 },
  ...over,
});

test('nothing stored, a blocked store or no store at all: an empty campaign', () => {
  assert.deepEqual(loadProgress(memory()), emptyProgress());
  assert.deepEqual(loadProgress(blocked), emptyProgress());
  assert.deepEqual(loadProgress(null), emptyProgress());
  assert.equal(emptyProgress().version, VERSION);
  assert.equal(KEY, 'dune2-3d.campaign');
});

test('corrupt or foreign data reads as an empty campaign', () => {
  for (const raw of ['{', 'null', '42', '"text"', '[]', JSON.stringify({ version: 99, house: 'ordos', houses: { ordos: { mission: 4 } } })]) {
    assert.deepEqual(loadProgress(memory({ [KEY]: raw })), emptyProgress(), raw);
  }
});

test('progress survives a save and a load, per house', () => {
  const store = memory();
  let p = joinHouse(emptyProgress(), 'harkonnen');
  p = recordResult(p, readResult(endMessage({ house: 'harkonnen', mission: 1 })));
  p = joinHouse(p, 'ordos');
  assert.equal(saveProgress(p, store), true);
  const back = loadProgress(store);
  assert.deepEqual(back, p);
  assert.equal(back.house, 'ordos', 'the house joined last is the current one');
  assert.equal(back.houses.harkonnen.mission, 2);
  assert.equal(back.houses.ordos.mission, 1);
  assert.equal(JSON.parse(store.data[KEY]).version, VERSION);
});

test('a store that refuses to save keeps the game going: save says false, nothing throws', () => {
  assert.equal(saveProgress(joinHouse(emptyProgress(), 'atreides'), blocked), false);
  assert.equal(saveProgress(joinHouse(emptyProgress(), 'atreides'), full), false);
  assert.equal(saveProgress(joinHouse(emptyProgress(), 'atreides'), null), false);
});

test('cleaning drops unknown houses, out-of-range missions and junk scores', () => {
  const p = cleanProgress({ version: VERSION, house: 'fremen', houses: { atreides: { mission: 12, best: { 1: 50, 2: 'x', 12: 4, 3: -2 } }, ordos: { mission: 0 }, sardaukar: { mission: 3 }, harkonnen: 'junk' }, last: { house: 'atreides' } });
  assert.equal(p.house, null);
  assert.deepEqual(Object.keys(p.houses), ['atreides', 'ordos']);
  assert.equal(p.houses.atreides.mission, 10, 'past the last mission is a won campaign');
  assert.deepEqual(p.houses.atreides.best, { 1: 50 });
  assert.equal(p.houses.ordos.mission, 1);
  assert.equal(p.last, null, 'a result without a mission is dropped');
});

test('a win opens the next mission and keeps the best score; a loss keeps the mission', () => {
  let p = joinHouse(emptyProgress(), 'ordos');
  p = jumpTo(p, 'ordos', 2);
  const won = readResult(endMessage());
  p = recordResult(p, won);
  assert.equal(p.houses.ordos.mission, 3);
  assert.equal(p.houses.ordos.best[2], won.score);
  assert.deepEqual(p.last, won);
  const lost = readResult(endMessage({ mission: 3, won: false, score: { minutes: 9, credits: 0, survivingValue: 0, killedValue: 0, lostValue: 0 } }));
  p = recordResult(p, lost);
  assert.equal(p.houses.ordos.mission, 3, 'the same mission again');
  assert.equal(p.houses.ordos.best[3], undefined, 'a lost mission sets no best score');
  assert.equal(p.last.won, false);
  const worse = readResult(endMessage({ score: { minutes: 44, credits: 0, survivingValue: 0, killedValue: 0, lostValue: 0 } }));
  p = recordResult(jumpTo(p, 'ordos', 2), worse);
  assert.equal(p.houses.ordos.best[2], won.score, 'a replay that scores less keeps the better score');
});

test('winning mission 9 finishes the house; a finished house is not offered to continue', () => {
  let p = jumpTo(emptyProgress(), 'atreides', 9);
  p = recordResult(p, readResult(endMessage({ house: 'atreides', mission: 9 })));
  assert.equal(p.houses.atreides.mission, 10);
  assert.deepEqual(finished(p), ['atreides']);
  assert.deepEqual(continues(p), []);
});

test('a password or a replay never lowers the saved game; a won Arrakis stays won', () => {
  let p = jumpTo(emptyProgress(), 'ordos', 7);
  p = jumpTo(p, 'ordos', 2);
  assert.equal(p.houses.ordos.mission, 7, 'an earlier password keeps the save at mission 7');
  assert.equal(p.house, 'ordos');
  p = recordResult(p, readResult(endMessage({ house: 'ordos', mission: 2 })));
  assert.equal(p.houses.ordos.mission, 7, 'winning the replay does not move it back');
  p = recordResult(p, readResult(endMessage({ house: 'ordos', mission: 3, won: false })));
  assert.equal(p.houses.ordos.mission, 7, 'nor does losing one');
  p = recordResult(p, readResult(endMessage({ house: 'ordos', mission: 7 })));
  assert.equal(p.houses.ordos.mission, 8, 'winning the saved mission moves on as ever');
  assert.equal(jumpTo(p, 'ordos', 9).houses.ordos.mission, 9, 'a later password moves it on');
  let a = recordResult(jumpTo(emptyProgress(), 'atreides', 9), readResult(endMessage({ house: 'atreides', mission: 9 })));
  a = jumpTo(a, 'atreides', 2);
  assert.equal(a.houses.atreides.mission, 10);
  assert.deepEqual(finished(a), ['atreides']);
});

test('joining a won house again starts it at mission 1 and keeps Arrakis won in the record', () => {
  let p = recordResult(jumpTo(emptyProgress(), 'atreides', 9), readResult(endMessage({ house: 'atreides', mission: 9 })));
  p = joinHouse(p, 'atreides');
  assert.equal(p.houses.atreides.mission, 1);
  assert.deepEqual(finished(p), ['atreides'], 'the ending stays on offer');
  assert.deepEqual(continues(p), [{ house: 'atreides', mission: 1 }]);
  const store = memory();
  saveProgress(p, store);
  assert.deepEqual(loadProgress(store), p, 'and it survives a reload');
  assert.equal(cleanProgress({ version: VERSION, houses: { ordos: { mission: 10 } } }).houses.ordos.won, true, 'an older save at 10 is a won house');
  assert.equal(cleanProgress({ version: VERSION, houses: { ordos: { mission: 3, won: 'yes' } } }).houses.ordos.won, undefined, 'only true is a win');
});

test('continue offers the current house first, then the others in the Sega order', () => {
  let p = jumpTo(emptyProgress(), 'harkonnen', 4);
  p = jumpTo(p, 'atreides', 2);
  p = jumpTo(p, 'ordos', 7);
  p = { ...p, house: 'atreides' };
  assert.deepEqual(continues(p), [{ house: 'atreides', mission: 2 }, { house: 'ordos', mission: 7 }, { house: 'harkonnen', mission: 4 }]);
  assert.deepEqual(continues(emptyProgress()), []);
});

test('a result is read defensively: a bad house or mission is no result, numbers are cleaned, the score follows C11', () => {
  assert.equal(readResult(null), null);
  assert.equal(readResult({ dune: 'missionEnd', house: 'fremen', mission: 2 }), null);
  assert.equal(readResult({ dune: 'missionEnd', house: 'ordos', mission: 10 }), null);
  assert.equal(readResult({ dune: 'missionEnd', house: 'ordos', mission: '2' })?.mission, 2, 'a number in a string is still a number');
  const r = readResult(endMessage());
  assert.deepEqual(r.rows, { spice: [7014, 1553], units: [35, 6], structures: [4, 0] });
  assert.equal(r.score, Math.max(0, 9 - 0 + 31 + 27 + (90 - 15)));
  assert.equal(r.rank, 'Sand Warrior');
  assert.equal(r.seconds, 850);
  assert.equal(r.won, true);
  const bare = readResult({ dune: 'missionEnd', house: 'atreides', mission: 1, won: 'yes', seconds: -4, stats: 'junk', score: { killedValue: 'many' } });
  assert.equal(bare.won, false, 'only true is a win');
  assert.equal(bare.seconds, 0);
  assert.deepEqual(bare.rows, { spice: [0, 0], units: [0, 0], structures: [0, 0] });
  assert.equal(bare.score, 44, 'only the time bonus: minutes from the seconds when the score has none');
});

test('a draw is not a win', () => {
  const r = readResult(endMessage({ won: false, draw: true }));
  assert.equal(r.won, false);
  assert.equal(r.draw, true);
});

test('development shots get a plausible sample result', () => {
  const r = sampleResult('harkonnen', 4);
  assert.equal(r.house, 'harkonnen');
  assert.equal(r.mission, 4);
  assert.equal(r.won, true);
  assert.ok(r.rows.spice[0] > 0 && r.rows.units[0] > 0 && r.rows.structures[0] > 0);
  assert.equal(typeof r.rank, 'string');
  assert.equal(sampleResult('ordos', 9, { won: false }).won, false);
  assert.deepEqual(cleanProgress({ version: VERSION, last: r }).last, r, 'a sample is a valid saved result');
});
