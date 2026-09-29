import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../src/data/units.js';
import { STRUCTURES } from '../src/data/structures.js';
import { WEAPONS, shotFor } from '../src/data/weapons.js';
import { projectileSpeed, SCATTER } from '../src/data/tuning.js';

test('every armed unit and turret names a known weapon', () => {
  for (const [id, u] of Object.entries(UNITS)) if (u.weapon && u.weapon !== 'swallow') assert.ok(WEAPONS[u.weapon], `${id} → ${u.weapon}`);
  for (const id of ['turret', 'rocketTurret']) {
    const s = STRUCTURES[id];
    assert.ok(WEAPONS[s.weapon] && s.damage > 0 && s.range > 0 && s.fireDelay > 0, id);
  }
  assert.ok(WEAPONS[STRUCTURES.rocketTurret.near.weapon]);
});

test('guns always hit, rockets scatter, the rocket turret homes', () => {
  assert.equal(shotFor('cannon', 3).accurate, true);
  assert.equal(shotFor('rocket', 5).accurate, false);
  assert.deepEqual([shotFor('turretRocket', 6).accurate, shotFor('turretRocket', 6).homing], [true, true]);
  assert.equal(shotFor('nope', 1), null);
  assert.ok(SCATTER.wildChance > 0 && SCATTER.wildChance < 0.1);
});

test('troopers fire bullets up close and weaker, scattering mini-rockets beyond two tiles', () => {
  assert.equal(shotFor('trooperRocket', 2).projectile, 'bullet');
  const far = shotFor('trooperRocket', 4);
  assert.deepEqual([far.projectile, far.accurate, far.damageScale], ['rocket', false, 0.75]);
  assert.equal(Math.round(UNITS.trooper.damage * far.damageScale), 4, '5 → 4 as in the original');
});

test('projectiles cross a screen of battle in well under a second', () => {
  assert.ok(projectileSpeed(WEAPONS.cannon.speed) > 12);
  assert.ok(projectileSpeed(WEAPONS.rocket.speed) > 8 && projectileSpeed(WEAPONS.rocket.speed) < projectileSpeed(WEAPONS.cannon.speed));
});
