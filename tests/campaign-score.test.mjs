// Campaign score, ranks, time and passwords (contract C11; research.md §5, §6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionScore, RANKS, rankFor, formatTime, minutesOf } from '../src/campaign/score.js';
import { PASSWORDS, passwordFor, completionPassword, normalisePassword, readPassword } from '../src/campaign/passwords.js';

const base = { killedValue: 0, lostValue: 0, survivingValue: 0, credits: 0, minutes: 0 };

test('the score adds kills, survivors, credits and the time bonus, and takes losses off (C11)', () => {
  assert.equal(missionScore({ killedValue: 12, lostValue: 3, survivingValue: 20, credits: 1250, minutes: 10 }, 1), 12 - 3 + 20 + 12 + (45 - 10));
  assert.equal(missionScore({ ...base, credits: 199 }, 2), 1 + 90, 'credits count in whole hundreds');
  assert.equal(missionScore({ ...base, credits: 99.9 }, 1), 45, 'and a fraction of a hundred counts for nothing');
});

test('the time bonus ends at 45 minutes a mission and never goes below nothing', () => {
  assert.equal(missionScore({ ...base, minutes: 44 }, 1), 1);
  assert.equal(missionScore({ ...base, minutes: 45 }, 1), 0);
  assert.equal(missionScore({ ...base, minutes: 46 }, 1), 0);
  assert.equal(missionScore({ ...base, minutes: 1 }, 9), 404);
  assert.equal(missionScore({ ...base, minutes: 405 }, 9), 0);
  assert.equal(missionScore({ ...base, minutes: 300, survivingValue: 7 }, 9), 112);
});

test('a score never falls below zero, and bad inputs count as nothing', () => {
  assert.equal(missionScore({ ...base, lostValue: 500, minutes: 99 }, 1), 0);
  assert.equal(missionScore({ ...base, lostValue: 30, survivingValue: 29, minutes: 99 }, 1), 0);
  assert.equal(missionScore({ killedValue: NaN, lostValue: 'x', survivingValue: undefined, credits: -50, minutes: Infinity }, 1), 0);
  assert.equal(missionScore({}, 3), 0, 'no minutes at all is no bonus, not the whole bonus');
  assert.equal(missionScore({ ...base, killedValue: 10.7, minutes: 50 }, 1), 10, 'whole points only');
});

test('nine Sega ranks, lowest first, each from its minimum score (C11)', () => {
  assert.deepEqual(RANKS.map(([name]) => name), ['Sand Snake', 'Desert Mongoose', 'Sand Warrior', 'Dune Trooper', 'Squad Leader',
    'Outpost Commander', 'Base Commander', 'Scourge of Dune', 'Ruler of Arrakis']);
  assert.deepEqual(RANKS.map(([, min]) => min), [0, 50, 100, 150, 200, 250, 300, 375, 420]);
  for (let i = 0; i < RANKS.length; i++) {
    const [name, min] = RANKS[i];
    assert.equal(rankFor(min), name, `${name} from ${min}`);
    if (i > 0) assert.equal(rankFor(min - 1), RANKS[i - 1][0], `${min - 1} is still ${RANKS[i - 1][0]}`);
  }
  assert.equal(rankFor(0), 'Sand Snake');
  assert.equal(rankFor(-5), 'Sand Snake');
  assert.equal(rankFor(99999), 'Ruler of Arrakis');
  assert.equal(rankFor(NaN), 'Sand Snake');
});

test('the scores seen on a Sega Atreides run land on the ranks it showed (research.md §5)', () => {
  const seen = [[10, 'Sand Snake'], [52, 'Desert Mongoose'], [94, 'Desert Mongoose'], [121, 'Sand Warrior'], [194, 'Dune Trooper'],
    [243, 'Squad Leader'], [302, 'Base Commander'], [353, 'Base Commander'], [401, 'Scourge of Dune'], [440, 'Ruler of Arrakis']];
  for (const [score, rank] of seen) assert.equal(rankFor(score), rank, String(score));
});

test('time shows as h:mm of whole minutes; minutes played round up as the original counts them', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(59), '0:00');
  assert.equal(formatTime(60), '0:01');
  assert.equal(formatTime(14 * 60 + 30), '0:14');
  assert.equal(formatTime(3600 + 5 * 60), '1:05');
  assert.equal(formatTime(-3), '0:00');
  assert.equal(formatTime(NaN), '0:00');
  assert.equal(minutesOf(0), 1);
  assert.equal(minutesOf(59.9), 1);
  assert.equal(minutesOf(60), 2);
  assert.equal(minutesOf(-1), 1);
});

test('the Sega passwords: missions 2 to 9 of each house (research.md §6)', () => {
  assert.deepEqual(PASSWORDS.atreides, ['DIPLOMATIC', 'SPICEDANCE', 'ETERNALSUN', 'DEFTHUNTER', 'FAIRMENTAT', 'ASHLIKENNY', 'SONICBLAST', 'DUNERUNNER']);
  assert.deepEqual(PASSWORDS.ordos, ['DOMINATION', 'SPICESABRE', 'ARRAKISSUN', 'COLDHUNTER', 'WILYMENTAT', 'SLYMELANIE', 'STEALTHWAR', 'POWERCRUSH']);
  assert.deepEqual(PASSWORDS.harkonnen, ['DEMOLITION', 'SPICESATYR', 'BURNINGSUN', 'DARKHUNTER', 'EVILMENTAT', 'ITSJOEBWAN', 'DEVASTATOR', 'DEATHRULER']);
  assert.equal(passwordFor('atreides', 2), 'DIPLOMATIC');
  assert.equal(passwordFor('harkonnen', 9), 'DEATHRULER');
  assert.equal(passwordFor('atreides', 1), null, 'mission 1 needs none');
  assert.equal(passwordFor('atreides', 10), null);
  assert.equal(passwordFor('sardaukar', 3), null);
  assert.equal(completionPassword('ordos', 1), 'DOMINATION', 'completing mission 1 gives the word for mission 2');
  assert.equal(completionPassword('ordos', 8), 'POWERCRUSH');
  assert.equal(completionPassword('ordos', 9), null, 'the last mission ends the campaign instead');
});

test('a password is read without regard to case, spaces or anything but letters', () => {
  assert.equal(normalisePassword(' spice-dance 1 '), 'SPICEDANCE');
  assert.deepEqual(readPassword('spicedance'), { house: 'atreides', mission: 3 });
  assert.deepEqual(readPassword('Wily Mentat'), { house: 'ordos', mission: 6 });
  assert.deepEqual(readPassword('ITSJOEBWAN'), { house: 'harkonnen', mission: 7 });
  for (const word of ['', 'SPICE', 'SPICEDANCEX', 'LOOKAROUND', null, undefined, 42]) assert.equal(readPassword(word), null, String(word));
  const all = Object.values(PASSWORDS).flat();
  assert.equal(new Set(all).size, 24, 'no word opens two missions');
  for (const word of all) assert.match(word, /^[A-Z]{10}$/);
});
