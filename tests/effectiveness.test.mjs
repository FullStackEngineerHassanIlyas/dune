import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../src/data/units.js';
import { TARGET_CLASSES, combatant, dpsAgainst, fightScore, matchups, rocketHitChance, effectivenessTable, canHit } from '../src/data/effectiveness.js';
import { deviatable } from '../src/sim/combat.js';
import { canCapture } from '../src/sim/capture.js';
import { G } from '../src/data/terrain.js';
import { flatWorld } from './helpers.mjs';

const ids = [...new Set(TARGET_CLASSES.flatMap((k) => k.types))];

test('machine guns are strong against infantry; cannons and rockets against tanks', () => {
  for (const id of ['trike', 'quad', 'raider']) assert.ok(matchups(id).strong.includes('Infantry'), `${id}: ${matchups(id).strong}`);
  for (const id of ['combatTank', 'missileTank']) assert.ok(matchups(id).strong.includes('Tanks'), `${id}: ${matchups(id).strong}`);
  const rocket = combatant('missileTank');
  assert.ok(dpsAgainst(rocket, combatant('combatTank'), 4) > 2 * dpsAgainst(rocket, combatant('soldier'), 4), 'a 75-point rocket wastes most of itself on a 20-point soldier');
});

test('infantry is weak against tanks, which run it down', () => {
  for (const id of ['soldier', 'infantry', 'trooper', 'troopers']) assert.ok(matchups(id).weak.includes('Tanks'), `${id}: ${matchups(id).weak}`);
  assert.ok(fightScore('combatTank', 'infantry') > 0.8, 'a walkover');
  assert.ok(fightScore('combatTank', 'infantry') > fightScore('quad', 'infantry'), 'the Quad has the gun but not the tracks');
});

test('without anti-air a unit is weak against aircraft; with it, strong', () => {
  for (const id of ids) {
    const u = UNITS[id], m = matchups(id);
    if (!u || id === 'ornithopter' || !m) continue;
    if (u.targetAir) assert.ok(m.strong.includes('Aircraft'), `${id} shoots aircraft: ${m.strong}`);
    else assert.ok(m.weak.includes('Aircraft'), `${id} cannot: ${m.weak}`);
  }
  assert.ok(matchups('ornithopter').weak.includes('Heavy Trooper') || matchups('ornithopter').weak.includes('Trooper Squad'), 'named: the infantry that shoots back');
  assert.ok(matchups('turret').strong.includes('Aircraft'), 'the Gun Turret fires at aircraft');
});

test('whatever outranges a turret destroys it unanswered; two turrets never meet', () => {
  assert.equal(fightScore('missileTank', 'rocketTurret'), 1, 'range 9 against 8');
  assert.equal(fightScore('sonicTank', 'turret'), 1, 'range 8 against 5');
  assert.equal(fightScore('turret', 'missileTank'), -1);
  assert.equal(fightScore('turret', 'rocketTurret'), 0);
  assert.ok(!('defences' in matchups('turret').scores));
});

test('a fight seen from the other side is the same fight', () => {
  for (const a of ids) for (const t of ids) assert.ok(Math.abs(fightScore(a, t) + fightScore(t, a)) < 1e-9, `${a} vs ${t}`);
  const table = effectivenessTable();
  assert.equal(table.combatTank.combatTank, 0);
  assert.ok(Object.values(table).every((row) => Object.values(row).every((v) => v >= -1 && v <= 1)));
});

test('rockets scatter more the further they fly and hit a big building more often than a unit', () => {
  assert.ok(rocketHitChance(0) >= 15 / 16, 'close up only the wild throw (1 in 16) can miss');
  assert.ok(rocketHitChance(9) < rocketHitChance(4) && rocketHitChance(4) < rocketHitChance(1));
  assert.ok(rocketHitChance(9, 3, 3) > rocketHitChance(9, 1, 1));
  assert.ok(rocketHitChance(9) > 0.2 && rocketHitChance(9) < 0.6, `${rocketHitChance(9)}`);
});

test('the rules mirror the simulation: gas, capture, crushing and anti-air', () => {
  const world = flatWorld(30, 30, G.ROCK);
  let checked = 0;
  for (const [k, id] of Object.keys(UNITS).entries()) {
    const c = combatant(id);
    if (!c) continue;
    const u = world.spawnUnit(id, 'harkonnen', 4 + (k % 4) * 5, 2 + k);
    assert.equal(c.deviatable, deviatable(u), `${id}: gas`);
    assert.equal(c.air, !u.isGround, `${id}: air`);
    checked++;
  }
  assert.ok(checked >= 18, `${checked} unit types checked`);
  assert.ok(canHit(combatant('deviator'), combatant('combatTank')) && !canHit(combatant('deviator'), combatant('mcv')), 'gas only where it takes');
  assert.ok(!canHit(combatant('sonicTank'), combatant('sonicTank')), 'the wave spares Sonic Tanks');
  assert.ok(!canHit(combatant('combatTank'), combatant('ornithopter')) && canHit(combatant('missileTank'), combatant('ornithopter')));
  assert.ok(['soldier', 'infantry', 'trooper', 'troopers'].every((id) => canCapture({ typeId: id })));
});

test('what does not fight has no matchups, and the table is worked out once', () => {
  assert.equal(matchups('harvester'), null);
  assert.equal(matchups('saboteur'), null);
  assert.equal(matchups('mcv'), null);
  assert.equal(matchups('quad'), matchups('quad'), 'cached');
  assert.deepEqual(matchups('fremen'), matchups('troopers'), 'the Palace Fremen fight as a Trooper Squad');
});
