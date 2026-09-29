import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

function field() {
  const world = flatWorld(48, 32, G.ROCK);
  world.fogOfWar = false;   // hunting by sight is the fog's business; these tests are about the flying
  const o = world.spawnUnit('ornithopter', 'atreides', 4, 4, { heading: 0 });
  return { world, o };
}
const hurt = (u) => u.hp < u.maxHp;

test('an idle Ornithopter hunts the nearest enemy and strafes it', () => {
  const { world, o } = field();
  const near = world.spawnUnit('combatTank', 'harkonnen', 20, 12);
  const far = world.spawnUnit('combatTank', 'harkonnen', 44, 28);
  assert.ok(runUntil(world, () => hurt(near), 20) > 0, 'the nearest enemy is hit');
  assert.ok(!hurt(far));
  assert.equal(o.order.type, 'idle');
});

test('it fires twice a pass above half health, once below', () => {
  const count = (hp) => {
    const { world, o } = field();
    o.hp = hp;
    const t = world.spawnUnit('combatTank', 'harkonnen', 12, 4);
    t.hp = t.maxHp = 100000;
    let shots = 0;
    for (let k = 0; k < 20 * 12; k++) { world.step(); shots += world.events.drain().filter((e) => e.type === 'fired' && e.id === o.id).length; }
    return shots;
  };
  const full = count(25), low = count(10);
  assert.ok(full > 0 && low > 0);
  assert.ok(full >= 1.6 * low, `full ${full} vs low ${low}`);
});

test('an attack order sends it after that target; Stop sets it hunting again', () => {
  const { world, o } = field();
  const near = world.spawnUnit('combatTank', 'harkonnen', 14, 8);
  const far = world.spawnUnit('combatTank', 'harkonnen', 36, 24);
  near.hp = near.maxHp = 100000;
  world.issue('atreides', { type: 'attack', ids: [o.id], targetKind: 'unit', targetId: far.id });
  assert.ok(runUntil(world, () => hurt(far), 25) > 0);
  assert.ok(!hurt(near), 'it left the nearer one alone');
  world.removeUnit(far);
  run(world, 1);
  assert.equal(o.order.type, 'guard', 'its target gone, it guards where it is');
  world.issue('atreides', { type: 'stop', ids: [o.id] });
  assert.ok(runUntil(world, () => hurt(near), 25) > 0, 'hunting again');
});

test('on guard it engages only what comes near its post', () => {
  const { world, o } = field();
  o.order = { type: 'guard', x: 6, y: 6 };
  const away = world.spawnUnit('combatTank', 'harkonnen', 30, 20);
  run(world, 10);
  assert.ok(!hurt(away));
  const close = world.spawnUnit('combatTank', 'harkonnen', 9, 8);
  assert.ok(runUntil(world, () => hurt(close), 15) > 0);
});

test('an Ornithopter that loses its target goes back to hunting', () => {
  const { world, o } = field();
  const a = world.spawnUnit('combatTank', 'harkonnen', 16, 6);
  const b = world.spawnUnit('combatTank', 'harkonnen', 30, 20);
  assert.ok(runUntil(world, () => o.target?.id === a.id, 5) >= 0);
  world.removeUnit(a);
  assert.ok(runUntil(world, () => hurt(b), 25) > 0, 'on to the next one');
});

test('a target inside its turning circle is still hit: it flies on and comes round', () => {
  const { world } = field();
  const t = world.spawnUnit('combatTank', 'harkonnen', 5, 6);   // just off its right wing
  assert.ok(runUntil(world, () => hurt(t), 20) > 0);
});

test('it works through a pack of targets without circling one for ever', () => {
  const { world } = field();
  const pack = [];
  for (let k = 0; k < 6; k++) pack.push(world.spawnUnit('combatTank', 'harkonnen', 20 + (k % 3), 12 + Math.floor(k / 3)));
  for (const t of pack) t.hp = 60;   // two hits each
  assert.ok(runUntil(world, () => pack.every((t) => !world.units.has(t.id)), 120) > 0, `${pack.filter((t) => world.units.has(t.id)).length} left`);
});
