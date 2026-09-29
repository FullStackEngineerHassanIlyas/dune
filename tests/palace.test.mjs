import test from 'node:test';
import assert from 'node:assert/strict';
import { STRUCTURES } from '../src/data/structures.js';
import { canBuild } from '../src/sim/tech.js';
import { palaceWeapon, palaceReady, deathHandBlast } from '../src/sim/palace.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

function palace(house) {
  const world = flatWorld(48, 32);
  const s = world.spawnStructure('palace', house, 2, 2);
  return { world, s };
}
const charge = (world, s) => { s.readyAt = world.time; };

test('a Palace arms its house weapon: the Death Hand in seven minutes, Fremen and Saboteur in four', () => {
  assert.deepEqual(['harkonnen', 'atreides', 'ordos'].map(palaceWeapon), ['deathHand', 'fremen', 'saboteur']);
  const { world, s } = palace('harkonnen');
  run(world, 419);
  assert.ok(!palaceReady(world, s));
  run(world, 1.5);
  assert.ok(palaceReady(world, s));
  const said = world.events.drain().filter((e) => e.type === 'eva' && e.key === 'weaponReady');
  assert.deepEqual(said.map((e) => [e.house, e.text]), [['harkonnen', 'Death Hand ready.']]);
  for (const house of ['atreides', 'ordos']) {
    const p = palace(house);
    run(p.world, 239);
    assert.ok(!palaceReady(p.world, p.s), house);
    run(p.world, 1.5);
    assert.ok(palaceReady(p.world, p.s), house);
  }
});

test('the Death Hand fires only when charged; it rises from the Palace and comes down near the aim', () => {
  const { world, s } = palace('harkonnen');
  world.issue('harkonnen', { type: 'palace', x: 40, y: 20 });
  world.step();
  assert.equal(world.projectiles.size, 0);
  assert.ok(world.events.drain().some((e) => e.type === 'eva' && e.key === 'notReady'));
  charge(world, s);
  world.issue('harkonnen', { type: 'palace', x: 40, y: 20 });
  world.step();
  const [p] = [...world.projectiles.values()];
  assert.equal(p.projectile, 'deathHand');
  assert.deepEqual([p.sx, p.sy], [3.5, 3.5], 'from the Palace');
  assert.ok(Math.hypot(p.tx - 40.5, p.ty - 20.5) <= 2 + 1e-9, 'within two tiles of the aim');
  assert.ok(s.readyAt >= world.time + 419, 'the clock starts again');
  assert.ok(runUntil(world, () => world.projectiles.size === 0, 10) > 0, 'it lands');
  assert.ok(world.events.drain().some((e) => e.type === 'deathHandBlast'));
});

test('the Death Hand bursts in 17 blasts that wreck what stands there, friend or foe', () => {
  const { world, s } = palace('harkonnen');
  const yard = world.spawnStructure('constructionYard', 'atreides', 30, 20);
  const own = world.spawnUnit('combatTank', 'harkonnen', 32, 21);
  world.events.drain();
  deathHandBlast(world, { house: 'harkonnen', sourceId: s.id, sourceKind: 'structure', x: 31, y: 21, damage: 150 });
  const large = world.events.drain().filter((e) => e.type === 'explosion' && e.size === 'large').length;
  assert.equal(large, 17 + (world.structures.has(yard.id) ? 0 : 1), 'seventeen blasts (and the yard going up)');
  assert.ok(yard.hp <= yard.maxHp - 300, `yard ${yard.hp}`);
  assert.ok(own.hp < own.maxHp, 'no friend is spared');
});

test('a Death Hand among exploding vehicles counts each kill once', () => {
  const { world, s } = palace('harkonnen');
  const mcvs = [[30, 20], [31, 20], [30, 21], [31, 21]].map(([x, y]) => world.spawnUnit('mcv', 'atreides', x, y));
  deathHandBlast(world, { house: 'harkonnen', sourceId: s.id, sourceKind: 'structure', x: 31, y: 21, damage: 150 });
  const dead = mcvs.filter((u) => !world.units.has(u.id)).length;
  assert.ok(dead >= 3, `${dead} dead`);
  assert.equal(world.houses.get('harkonnen').stats.unitsKilled, dead);
  assert.equal(world.houses.get('atreides').stats.unitsLost, dead);
});

test('an aim off the map is brought back onto it', () => {
  const { world, s } = palace('harkonnen');
  charge(world, s);
  world.issue('harkonnen', { type: 'palace', x: -30, y: 999 });
  world.step();
  const [p] = [...world.projectiles.values()];
  assert.ok(p.tx >= 0.5 && p.tx <= 2.5 && p.ty >= 29.5 && p.ty <= 31.5, `${p.tx}, ${p.ty}`);
});

test('one Palace to a house, and it cannot be captured', () => {
  const world = flatWorld(40, 30);
  for (const [t, x, y] of [['constructionYard', 1, 1], ['windtrap', 4, 1], ['refinery', 7, 1], ['starport', 11, 1]]) world.spawnStructure(t, 'harkonnen', x, y);
  assert.ok(canBuild(world, 'harkonnen', 'palace'));
  world.spawnStructure('palace', 'harkonnen', 20, 10);
  assert.ok(!canBuild(world, 'harkonnen', 'palace'));
  assert.ok(!STRUCTURES.palace.conquerable);
});
