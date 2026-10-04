// What the tooltips' Strong and Weak say, read from the table of real battles (src/data/effectiveness.js; the
// battles themselves: effectiveness-fights.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../src/data/units.js';
import { ROSTER, fightScore, matchups, effectivenessTable } from '../src/data/effectiveness.js';

test('machine guns are strong against infantry; cannons against infantry and light vehicles; rockets against tanks and turrets', () => {
  for (const id of ['trike', 'quad', 'raider']) assert.ok(matchups(id).strong.includes('Infantry'), `${id}: ${matchups(id).strong}`);
  for (const c of ['Infantry', 'Light vehicles']) assert.ok(matchups('combatTank').strong.includes(c), `${matchups('combatTank').strong}`);
  for (const c of ['Tanks', 'Turrets']) assert.ok(matchups('missileTank').strong.includes(c), `${matchups('missileTank').strong}`);
});

test('the light vehicles are no answer to tanks, and the heavy tanks are not weak against them', () => {
  for (const id of ['trike', 'raider', 'quad']) assert.ok(!matchups(id).strong.includes('Tanks'), `${id}: ${matchups(id).strong}`);
  assert.ok(matchups('raider').weak.includes('Tanks'), `${matchups('raider').weak}`);
  for (const id of ['siegeTank', 'missileTank', 'sonicTank', 'devastator']) assert.ok(!matchups(id).weak.includes('Light vehicles'), `${id}: ${matchups(id).weak}`);
});

test('infantry is weak against tanks; the Deviator\'s gas is strong against infantry and light vehicles', () => {
  for (const id of ['soldier', 'infantry', 'trooper', 'troopers']) assert.ok(matchups(id).weak.includes('Tanks'), `${id}: ${matchups(id).weak}`);
  assert.ok(fightScore('combatTank', 'infantry') > 0.8, 'a walkover');
  assert.deepEqual(matchups('deviator').strong.slice(0, 2), ['Infantry', 'Light vehicles']);
  assert.ok(!matchups('deviator').weak.includes('Light vehicles') && !matchups('deviator').weak.includes('Light Infantry'));
});

test('without anti-air a unit is weak against aircraft; with it, strong', () => {
  for (const id of ROSTER) {
    const u = UNITS[id], m = matchups(id);
    if (!u || id === 'ornithopter') continue;
    if (u.targetAir) assert.ok(m.strong.includes('Aircraft'), `${id} shoots aircraft: ${m.strong}`);
    else assert.ok(m.weak.includes('Aircraft'), `${id} cannot: ${m.weak}`);
  }
  assert.ok(matchups('ornithopter').weak.includes('Heavy Trooper') && matchups('ornithopter').weak.includes('Trooper Squad'), 'named: the infantry that shoots back');
  assert.ok(matchups('turret').strong.includes('Aircraft') && matchups('rocketTurret').strong.includes('Aircraft'));
});

test('turrets: what outranges them wins; exceptions to a listed class are named; two turrets never meet', () => {
  assert.ok(fightScore('missileTank', 'turret') > 0.6 && fightScore('missileTank', 'rocketTurret') > 0.6, 'range 9 against 5 and 8');
  assert.ok(matchups('sonicTank').strong.includes('Gun Turret') && matchups('sonicTank').weak.includes('Rocket Turret'), 'range 8: past the Gun Turret, not past the Rocket Turret');
  assert.ok(matchups('rocketTurret').strong.includes('Tanks') && matchups('rocketTurret').weak.includes('Missile Tank'), 'strong against tanks, but not that one');
  assert.equal(fightScore('turret', 'rocketTurret'), 0);
  assert.ok(!('defences' in matchups('turret').scores));
});

test('a fight seen from the other side is the same fight', () => {
  for (const a of ROSTER) for (const t of ROSTER) assert.ok(Math.abs(fightScore(a, t) + fightScore(t, a)) < 1e-9, `${a} vs ${t}`);
  const table = effectivenessTable();
  assert.equal(table.combatTank.combatTank, 0);
  assert.ok(Object.values(table).every((row) => Object.values(row).every((v) => v >= -1 && v <= 1)));
});

test('what does not fight has no matchups, and each is worked out once', () => {
  for (const id of ['harvester', 'saboteur', 'mcv', 'carryall', 'sandworm', 'windtrap']) assert.equal(matchups(id), null, id);
  assert.equal(matchups('quad'), matchups('quad'), 'cached');
  assert.deepEqual(matchups('fremen'), matchups('troopers'), 'the Palace Fremen fight as a Trooper Squad');
});
