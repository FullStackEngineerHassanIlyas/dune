import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { setupSkirmish } from '../src/game/setup.js';
import { createBrain } from '../src/sim/ai.js';
import { computePower } from '../src/sim/economy.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

const owned = (world, houseId) => {
  const n = {};
  for (const s of world.structures.values()) if (s.house === houseId) n[s.typeId] = (n[s.typeId] ?? 0) + 1;
  return n;
};

test('the AI deploys its MCV and builds power and a refinery first', () => {
  const { world, rival } = setupSkirmish({ seed: 11 });
  createBrain(world, rival, 'normal');
  run(world, 90);
  const n = owned(world, rival);
  assert.ok(n.constructionYard === 1 && n.windtrap >= 1 && n.refinery >= 1, JSON.stringify(n));
  assert.ok([...world.units.values()].some((u) => u.house === rival && u.typeId === 'harvester'));
});

test('the AI follows its build order and keeps its power up', () => {
  const { world, rival } = setupSkirmish({ seed: 5, enemy: 'harkonnen' });
  createBrain(world, rival, 'normal');
  run(world, 600);
  const n = owned(world, rival);
  for (const t of ['outpost', 'wor', 'lightFactory', 'heavyFactory']) assert.ok(n[t] >= 1, `${t} in ${JSON.stringify(n)}`);
  const p = computePower(world, rival);
  assert.ok(p.produced >= p.used, `power ${p.produced}/${p.used}`);
});

test('an AI without room or money does not spam commands', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const m = world.map;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)) > 1.5) m.ground[m.idx(x, y)] = G.MOUNTAIN;
  m.revision++;
  world.spawnStructure('constructionYard', 'harkonnen', 7, 7);
  const brain = createBrain(world, 'harkonnen', 'hard');
  const h = world.houses.get('harkonnen');
  h.credits = 0;
  run(world, 60);
  assert.equal(brain.commands, 0, 'nothing to pay with: no orders');
  h.credits = 5000;
  h.startBuffer = 5000;   // room to take the refunds back
  run(world, 120);
  assert.ok(brain.commands <= 6, `${brain.commands} commands in two minutes with nowhere to build`);
  assert.ok(Math.abs(h.credits - 5000) < 1e-6, 'every cancelled structure was refunded');
});

test('an AI that lost its yard carries on with what it has', () => {
  const world = flatWorld(32, 24, G.ROCK);
  for (const [t, x, y] of [['windtrap', 2, 2], ['windtrap', 5, 2], ['refinery', 2, 6], ['heavyFactory', 8, 6]]) world.spawnStructure(t, 'harkonnen', x, y);
  const h = world.houses.get('harkonnen');
  h.credits = 3000;
  h.startBuffer = 5000;
  createBrain(world, 'harkonnen', 'normal');
  run(world, 120);
  const harvesters = [...world.units.values()].filter((u) => u.house === 'harkonnen' && u.typeId === 'harvester').length;
  assert.ok(harvesters >= 2, `${harvesters} harvesters`);
});

test('Hard doubles down on income: harvest is worth half again as much', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 0;
  h.startBuffer = 5000;
  createBrain(world, 'atreides', 'hard');
  world.spawnStructure('refinery', 'atreides', 8, 8);
  const u = [...world.units.values()].find((x) => x.typeId === 'harvester');
  u.harvest.load = 700;
  u.harvest.state = 'toRefinery';
  run(world, 20);
  assert.ok(Math.abs(h.credits - 1050) < 1e-6, `credits ${h.credits}`);
  assert.equal(h.buildSpeed, 1.25);
});

test('the AI builds an army and sends its first wave after the attack timer', () => {
  const { world, house, rival } = setupSkirmish({ seed: 11, difficulty: 'hard' });
  const waves = [];
  for (let t = 0; t < 9 * 60 * 20 && !waves.length; t++) {
    world.step();
    for (const e of world.events.drain()) if (e.type === 'aiAttack' && e.house === rival) waves.push({ ...e, at: world.time });
  }
  assert.equal(waves.length, 1, 'a wave went out');
  assert.ok(waves[0].at >= 210 - 1, `not before the timer (${waves[0].at})`);
  assert.ok(waves[0].size >= 5);
  run(world, 180);
  assert.ok(world.houses.get(rival).stats.unitsKilled + world.houses.get(rival).stats.structuresKilled > 0, 'the wave hurt the player');
  assert.ok(world.houses.get(house).stats.unitsLost + world.houses.get(house).stats.structuresLost > 0);
});

test('the AI defends its base against intruders', () => {
  const world = flatWorld(40, 24, G.ROCK);
  for (const [t, x, y] of [['constructionYard', 2, 2], ['windtrap', 5, 2]]) world.spawnStructure(t, 'harkonnen', x, y);
  const guards = [world.spawnUnit('combatTank', 'harkonnen', 3, 12), world.spawnUnit('combatTank', 'harkonnen', 5, 12)];
  createBrain(world, 'harkonnen', 'normal');
  world.houses.get('harkonnen').credits = 0;
  const raider = world.spawnUnit('quad', 'atreides', 12, 4);
  run(world, 2);
  assert.ok(guards.every((u) => u.order.type === 'attack' && u.order.target.id === raider.id), guards.map((u) => u.order.type).join());
});

test('an AI wave breaks through a wall ring to reach the buildings inside', () => {
  const world = flatWorld(48, 24, G.ROCK);
  world.spawnStructure('constructionYard', 'harkonnen', 2, 2);
  const yard = world.spawnStructure('constructionYard', 'atreides', 36, 11);
  for (let y = 6; y <= 18; y++) for (let x = 31; x <= 43; x++) {
    if (Math.max(Math.abs(x - 37), Math.abs(y - 12)) === 6) world.spawnStructure('wall', 'atreides', x, y);
  }
  for (let k = 0; k < 6; k++) world.spawnUnit('combatTank', 'harkonnen', 6, 6 + k * 2);
  const brain = createBrain(world, 'harkonnen', 'hard');
  world.houses.get('harkonnen').credits = 0;
  brain.nextAttack = 0;
  run(world, 300);
  assert.ok(!world.structures.has(yard.id) || yard.hp < yard.maxHp, 'the wave got at the yard');
  assert.ok(brain.commands < 120, `${brain.commands} commands in five minutes`);
});

test('an AI that lost its yard builds and deploys a new MCV', () => {
  const world = flatWorld(40, 30, G.ROCK);
  for (const [t, x, y] of [['windtrap', 2, 2], ['windtrap', 5, 2], ['refinery', 2, 6], ['heavyFactory', 8, 6]]) world.spawnStructure(t, 'harkonnen', x, y);
  const h = world.houses.get('harkonnen');
  h.credits = 3000;
  h.startBuffer = 5000;
  createBrain(world, 'harkonnen', 'normal');
  const hasYard = () => [...world.structures.values()].some((s) => s.house === 'harkonnen' && s.typeId === 'constructionYard');
  assert.ok(runUntil(world, hasYard, 150) > 0, 'a new yard stands');
});

import { builtStorage } from '../src/sim/economy.js';

test('the AI stops building silos at four', () => {
  const world = flatWorld(48, 32, G.ROCK);
  for (const [t, x, y] of [['constructionYard', 2, 2], ['windtrap', 5, 2], ['windtrap', 8, 2], ['windtrap', 11, 2], ['refinery', 2, 6]]) world.spawnStructure(t, 'harkonnen', x, y);
  const h = world.houses.get('harkonnen');
  const brain = createBrain(world, 'harkonnen', 'hard');
  brain.nextAttack = 1e9;
  for (let k = 0; k < 20 * 900; k++) {   // fifteen minutes with the stores always nearly full
    h.credits = Math.max(h.credits, 0.95 * Math.max(builtStorage(world, 'harkonnen'), h.startBuffer ?? 0));
    world.step();
  }
  const silos = [...world.structures.values()].filter((s) => s.house === 'harkonnen' && s.typeId === 'silo').length;
  assert.ok(silos <= 4, `${silos} silos`);
});
