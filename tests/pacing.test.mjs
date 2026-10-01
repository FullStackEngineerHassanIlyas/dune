import test from 'node:test';
import assert from 'node:assert/strict';
import { G, SURFACE, moveFactor } from '../src/data/terrain.js';
import { STRUCTURES } from '../src/data/structures.js';
import { UNITS, onFoot } from '../src/data/units.js';
import { groundSpeed, buildSeconds } from '../src/data/tuning.js';
import { itemSeconds } from '../src/sim/production.js';
import { upgradeLevel } from '../src/sim/tech.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

// Pacing (docs/superpowers/notes/2026-10-01-pacing.md): minor buildings and upgrades are quick, infantry keeps up.

test('minor buildings build in seconds, not half a minute', () => {
  assert.ok(itemSeconds('windtrap') < 10, `wind trap ${itemSeconds('windtrap')} s`);
  assert.ok(itemSeconds('silo') < 10, `silo ${itemSeconds('silo')} s`);
  assert.ok(itemSeconds('wall') <= 6, `wall ${itemSeconds('wall')} s`);
  assert.ok(itemSeconds('turret') < 16, `gun turret ${itemSeconds('turret')} s`);
  assert.ok(itemSeconds('rocketTurret') < 36, `rocket turret ${itemSeconds('rocketTurret')} s`);
  assert.ok(itemSeconds('concrete') >= 2 && itemSeconds('concrete') < 3, 'a slab is quick but still shows its build');
});

test('bigger and stronger structures still take longer; the late-game ones keep the original pace', () => {
  const ids = Object.keys(STRUCTURES).filter((id) => STRUCTURES[id].requires);
  for (const a of ids) for (const b of ids) {
    if (STRUCTURES[a].buildTime < STRUCTURES[b].buildTime) assert.ok(itemSeconds(a) <= itemSeconds(b), `${a} before ${b}`);
  }
  for (const id of ['hiTech', 'starport', 'ix', 'palace']) assert.equal(itemSeconds(id), buildSeconds(STRUCTURES[id].buildTime), id);
  assert.equal(itemSeconds('combatTank'), buildSeconds(UNITS.combatTank.buildTime), 'units keep their build times');
});

test('an upgrade takes five seconds, between a slab and a wall as in the original', () => {
  assert.equal(itemSeconds('upgrade:heavyFactory'), 5);
  assert.ok(itemSeconds('concrete') < itemSeconds('upgrade:barracks') && itemSeconds('upgrade:barracks') < itemSeconds('wall'));
});

function factoryBase(house = 'atreides') {
  const world = flatWorld(32, 32, G.ROCK);
  const h = world.houses.get(house);
  h.credits = 5000;
  h.startBuffer = 100000;
  world.spawnStructure('constructionYard', house, 4, 4);
  world.spawnStructure('windtrap', house, 0, 0);
  const hf = world.spawnStructure('heavyFactory', house, 10, 10);
  return { world, h, hf };
}
const tanks = (world) => [...world.units.values()].filter((u) => u.typeId === 'combatTank').length;

test('an upgrade starts at once: the unit in hand steps aside and finishes afterwards, paid once', () => {
  const { world, h } = factoryBase();
  world.issue('atreides', { type: 'build', typeId: 'combatTank', count: 2 });
  run(world, 10);
  const tank = h.lines.heavy.current, progress = tank.progress;
  assert.ok(progress > 0.3 && progress < 0.4, `progress ${progress}`);
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  world.step();
  assert.equal(h.lines.heavy.current.typeId, 'upgrade:heavyFactory');
  assert.deepEqual(h.lines.heavy.queue, ['combatTank', 'combatTank']);
  assert.equal(h.lines.heavy.aside, tank);
  assert.equal(tank.progress, progress, 'nothing is lost');
  run(world, 5.1);
  assert.equal(upgradeLevel(h, 'heavyFactory'), 1);
  assert.equal(h.lines.heavy.current, tank, 'the tank picks up where it left off');
  assert.equal(h.lines.heavy.aside, null);
  assert.ok(Math.abs(tank.paid - tank.cost * tank.progress) < 1e-6, 'paid as it runs, once');
  const left = (1 - tank.progress) * itemSeconds('combatTank');
  const t = runUntil(world, () => tanks(world) === 1, 40);
  assert.ok(Math.abs(t - left) < 0.15, `finished after ${t} s, expected ${left}`);
  world.step();
  assert.notEqual(h.lines.heavy.current, tank);
  assert.ok(h.lines.heavy.current.progress < 0.01, 'the second tank starts from scratch');
});

test('cancelling the unit set aside refunds what it had paid', () => {
  const { world, h } = factoryBase();
  world.issue('atreides', { type: 'build', typeId: 'combatTank' });
  run(world, 10);
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  world.step();
  world.issue('atreides', { type: 'hold', typeId: 'combatTank' });
  world.step();
  assert.deepEqual(h.lines.heavy.queue, []);
  assert.equal(h.lines.heavy.aside, null);
  assert.ok(Math.abs(h.credits - (5000 - h.lines.heavy.current.paid)) < 1e-6, `credits ${h.credits}: all but the upgrade so far refunded`);
  run(world, 5.1);
  assert.equal(upgradeLevel(h, 'heavyFactory'), 1);
  assert.ok(Math.abs(h.credits - 4800) < 1e-6, 'only the upgrade was paid for');   // the Heavy Factory's first level costs 200 (one factory)
  assert.equal(h.lines.heavy.current, null);
});

test('a unit ordered as an upgrade finishes waits behind the item set aside, which is never lost', () => {
  const { world, h } = factoryBase();
  world.issue('atreides', { type: 'build', typeId: 'combatTank' });
  run(world, 10);
  const tank = h.lines.heavy.current, paid = tank.paid;
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });
  runUntil(world, () => upgradeLevel(h, 'heavyFactory') === 1, 10);
  assert.equal(h.lines.heavy.current, null, 'the line is free for one tick');
  world.issue('atreides', { type: 'build', typeId: 'harvester' });   // the computer topping up its Harvesters, or a quick click
  world.step();
  assert.equal(h.lines.heavy.current, tank, 'the tank set aside comes back first');
  assert.deepEqual(h.lines.heavy.queue, ['harvester']);
  world.issue('atreides', { type: 'build', typeId: 'upgrade:heavyFactory' });   // the next level sets the tank aside again
  world.step();
  assert.equal(h.lines.heavy.aside, tank);
  const inHand = () => [h.lines.heavy.current, h.lines.heavy.aside].reduce((n, it) => n + (it?.paid ?? 0), 0);
  assert.ok(tank.paid >= paid && Math.abs(h.credits + inHand() - (5000 - 300)) < 1e-6, 'every credit is in the bank, the upgrade done or an item in hand');
});

test('the yard upgrade sets aside a structure under construction, but waits for a ready one to be placed', () => {
  const { world, h } = factoryBase();
  world.issue('atreides', { type: 'build', typeId: 'outpost' });
  run(world, 5);
  const outpost = h.lines.structure.current;
  world.issue('atreides', { type: 'build', typeId: 'upgrade:constructionYard' });
  world.step();
  assert.equal(h.lines.structure.current.typeId, 'upgrade:constructionYard');
  assert.deepEqual(h.lines.structure.queue, ['outpost']);
  run(world, 5.1);
  assert.equal(upgradeLevel(h, 'constructionYard'), 1);
  assert.equal(h.lines.structure.current, outpost);
  run(world, itemSeconds('outpost'));
  assert.equal(outpost.state, 'ready');
  world.events.drain();
  h.upgrades.constructionYard = 1;
  world.spawnStructure('outpost', 'atreides', 20, 4);
  world.issue('atreides', { type: 'build', typeId: 'upgrade:constructionYard' });
  world.step();
  assert.equal(h.lines.structure.current, outpost, 'a ready structure keeps the yard');
  assert.ok(world.events.drain().some((e) => e.key === 'busy'));
});

test('a Combat Tank still outruns every foot soldier but the Saboteur, on any ground they share', () => {
  const tank = UNITS.combatTank;
  for (const surface of Object.values(SURFACE)) {
    const tf = moveFactor(surface, tank.move);
    if (!tf) continue;
    const top = groundSpeed(tank.speed, tf, tank.move);
    for (const [id, u] of Object.entries(UNITS)) {
      if (!onFoot(u.move) || u.sabotage) continue;
      assert.ok(groundSpeed(u.speed, moveFactor(surface, u.move), u.move) < top, `${id} on surface ${surface}`);
    }
  }
});

function march(typeId, house) {
  const world = flatWorld(24, 12, G.SAND);
  const u = world.spawnUnit(typeId, house, 2, 5, { heading: 0 });
  world.issue(house, { type: 'move', ids: [u.id], x: 12, y: 5 });
  return runUntil(world, () => u.order.type === 'idle' && u.tx === 12, 60);
}

test('infantry crosses ten tiles of open sand at a pace that keeps up with the battle', () => {
  const squad = march('infantry', 'atreides'), soldier = march('soldier', 'atreides');
  const troopers = march('troopers', 'harkonnen'), trooper = march('trooper', 'harkonnen');
  assert.ok(squad > 15 && squad < 23, `Infantry Squad ${squad} s (was 37 s)`);
  assert.ok(soldier > 13 && soldier < 20, `Light Infantry ${soldier} s (was 29 s)`);
  assert.ok(troopers > 12 && troopers < 18.5, `Trooper Squad ${troopers} s (was 26 s)`);
  assert.ok(trooper > 10 && trooper < 15, `Heavy Trooper ${trooper} s (was 20 s)`);
  assert.ok(march('combatTank', 'atreides') < trooper, 'the tank still gets there first');
});
