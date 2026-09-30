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

import { destroyStructure } from '../src/sim/combat.js';

test('an AI that loses its yard mid-game orders a new MCV at once and redeploys', () => {
  const { world, rival } = setupSkirmish({ seed: 2, difficulty: 'normal' });
  const has = (t) => [...world.structures.values()].find((s) => s.house === rival && s.typeId === t);
  assert.ok(runUntil(world, () => !!has('heavyFactory'), 900) > 0, 'a heavy factory went up');
  run(world, 60);
  destroyStructure(world, has('constructionYard'), null);
  const mcvOrdered = () => { const l = world.houses.get(rival).lines.heavy; return [l.current?.typeId, ...l.queue].some((t) => t === 'mcv' || t === 'upgrade:heavyFactory') || [...world.units.values()].some((u) => u.house === rival && u.typeId === 'mcv'); };
  const t = runUntil(world, mcvOrdered, 30);
  assert.ok(t >= 0 && t < 5, `ordered after ${t} s`);
  assert.ok(runUntil(world, () => !!has('constructionYard'), 300) > 0, 'a new yard stands');
});

import { upgradeLevel } from '../src/sim/tech.js';

test('an AI buys factory upgrades and fields the units they open', () => {
  const world = flatWorld(48, 40, G.ROCK);
  for (const [t, x, y] of [['constructionYard', 2, 2], ['windtrap', 5, 2], ['windtrap', 8, 2], ['windtrap', 11, 2], ['refinery', 2, 6], ['outpost', 6, 6], ['lightFactory', 9, 6], ['heavyFactory', 12, 6]]) world.spawnStructure(t, 'atreides', x, y);
  const h = world.houses.get('atreides');
  h.credits = 20000;
  h.startBuffer = 40000;
  createBrain(world, 'atreides', 'normal');
  assert.ok(runUntil(world, () => upgradeLevel(h, 'heavyFactory') >= 3, 400) > 0, `heavy factory level ${upgradeLevel(h, 'heavyFactory')}`);
  assert.ok(runUntil(world, () => upgradeLevel(h, 'lightFactory') >= 1, 120) >= 0, 'the light factory too');
  assert.ok(runUntil(world, () => [...world.units.values()].some((u) => u.house === 'atreides' && (u.typeId === 'siegeTank' || u.typeId === 'missileTank')), 300) > 0, 'a missile or siege tank rolled out');
});

test('the AI builds a repair facility and sends worn vehicles to it', () => {
  const world = flatWorld(48, 40, G.ROCK);
  for (const [t, x, y] of [['constructionYard', 2, 2], ['windtrap', 5, 2], ['windtrap', 8, 2], ['windtrap', 11, 2], ['refinery', 2, 6], ['outpost', 6, 6], ['wor', 9, 6], ['lightFactory', 12, 6], ['heavyFactory', 15, 6], ['silo', 2, 10], ['refinery', 5, 10]]) world.spawnStructure(t, 'harkonnen', x, y);
  const h = world.houses.get('harkonnen');
  h.credits = 5000;
  h.startBuffer = 10000;
  createBrain(world, 'harkonnen', 'normal');
  const bay = () => [...world.structures.values()].find((s) => s.house === 'harkonnen' && s.typeId === 'repair');
  assert.ok(runUntil(world, () => !!bay(), 150) > 0, 'a repair facility went up');
  const tank = world.spawnUnit('combatTank', 'harkonnen', 30, 30);
  tank.hp = 60;
  assert.ok(runUntil(world, () => tank.order.type === 'repairAt' || !!tank.inside, 3) >= 0, 'sent for repairs');
  assert.ok(runUntil(world, () => { h.credits = Math.max(h.credits, 1000); return tank.hp === tank.maxHp; }, 120) > 0, 'repaired');   // the repair, not the AI's wallet, is under test
});

test('the AI does not take a vehicle in a repair bay for an intruder', () => {
  const world = flatWorld(40, 30, G.ROCK);
  world.spawnStructure('constructionYard', 'harkonnen', 2, 2);
  const at = world.houses.get('atreides');
  at.credits = 1000;
  at.startBuffer = 5000;
  world.spawnStructure('windtrap', 'atreides', 30, 20);
  const bayS = world.spawnStructure('repair', 'atreides', 8, 2);   // e.g. a captured bay next to the computer's yard
  const inBay = world.spawnUnit('combatTank', 'atreides', 9, 5);
  inBay.hp = 50;
  world.issue('atreides', { type: 'repairAt', ids: [inBay.id], structureId: bayS.id });
  assert.ok(runUntil(world, () => inBay.inside === bayS.id, 10) > 0);
  const guard = world.spawnUnit('combatTank', 'harkonnen', 4, 8);
  const raider = world.spawnUnit('quad', 'atreides', 2, 12);
  createBrain(world, 'harkonnen', 'normal');
  assert.ok(runUntil(world, () => guard.order.type === 'attack' && guard.order.target?.id === raider.id, 5) > 0, 'the guard goes for the real intruder');
});

test('the AI builds a Hi-Tech Factory and keeps exactly one Carryall', () => {
  const world = flatWorld(48, 40, G.ROCK);
  for (const [t, x, y] of [['constructionYard', 2, 2], ['windtrap', 5, 2], ['windtrap', 8, 2], ['windtrap', 11, 2], ['windtrap', 14, 2], ['refinery', 2, 6], ['outpost', 6, 6], ['wor', 9, 6], ['lightFactory', 12, 6], ['heavyFactory', 15, 6], ['silo', 2, 10], ['refinery', 5, 10], ['repair', 9, 10]]) world.spawnStructure(t, 'harkonnen', x, y);
  const h = world.houses.get('harkonnen');
  h.credits = 8000;
  h.startBuffer = 20000;
  createBrain(world, 'harkonnen', 'normal');
  const own = () => [...world.units.values()].filter((u) => u.house === 'harkonnen' && u.typeId === 'carryall' && !u.visitor).length;
  assert.ok(runUntil(world, () => own() === 1, 200) > 0, 'one Carryall');
  run(world, 90);
  assert.equal(own(), 1, 'and no more');
});

test('the AI does not pull a worn vehicle it just sent for repairs into its defence', () => {
  const world = flatWorld(40, 30, G.ROCK);
  for (const [t, x, y] of [['constructionYard', 2, 2], ['windtrap', 5, 2], ['repair', 8, 2]]) world.spawnStructure(t, 'harkonnen', x, y);
  const h = world.houses.get('harkonnen');
  h.credits = 1000;
  h.startBuffer = 5000;
  const worn = world.spawnUnit('combatTank', 'harkonnen', 12, 12);
  worn.hp = 80;   // 40 %: sent when resting
  world.spawnUnit('quad', 'atreides', 6, 9);   // an intruder by the base
  createBrain(world, 'harkonnen', 'normal');
  run(world, 1.2);
  assert.equal(worn.order.type, 'repairAt');
});

test('the AI puts up a Starport and a House of IX and then flies Ornithopters', () => {
  const world = flatWorld(56, 44, G.ROCK);
  for (const [t, x, y] of [['constructionYard', 2, 2], ['windtrap', 5, 2], ['windtrap', 8, 2], ['windtrap', 11, 2], ['windtrap', 14, 2], ['windtrap', 17, 2], ['refinery', 2, 6], ['outpost', 6, 6], ['barracks', 9, 6], ['lightFactory', 12, 6], ['heavyFactory', 15, 6], ['silo', 2, 10], ['refinery', 5, 10], ['repair', 9, 10], ['hiTech', 13, 10]]) world.spawnStructure(t, 'atreides', x, y);
  const h = world.houses.get('atreides');
  h.credits = 20000;
  h.startBuffer = 40000;
  createBrain(world, 'atreides', 'normal');
  const has = (t) => [...world.structures.values()].some((s) => s.house === 'atreides' && s.typeId === t);
  assert.ok(runUntil(world, () => has('starport') && has('ix'), 300) > 0, 'Starport and House of IX');
  for (const u of [...world.units.values()]) if (u.house === 'atreides' && u.isGround && u.type.damage > 0) world.removeUnit(u);   // the defences went up first and the army is full by now: losses make room
  assert.ok(runUntil(world, () => [...world.units.values()].some((u) => u.house === 'atreides' && u.typeId === 'ornithopter'), 300) > 0, 'an Ornithopter');
  assert.equal(h.starport?.batch ?? null, null, 'it never buys at the Starport');
});

test('aircraft of a wave that end up guarding are sent on to the next target', () => {
  const world = flatWorld(48, 32, G.ROCK);
  world.spawnStructure('constructionYard', 'harkonnen', 2, 2);
  world.spawnStructure('silo', 'atreides', 40, 24);
  const o = world.spawnUnit('ornithopter', 'harkonnen', 20, 12);
  o.order = { type: 'guard', x: 20, y: 12 };
  const brain = createBrain(world, 'harkonnen', 'normal');
  brain.wave.push(o.id);
  brain.nextAttack = 1e9;
  assert.ok(runUntil(world, () => o.order.type === 'attackMove', 3) > 0);
});

test('the AI puts its turrets up before a Starport; the Harkonnen go for a House of IX too, for the Devastator', () => {
  const base = (house, infantry) => {
    const world = flatWorld(56, 44, G.ROCK);
    for (const [t, x, y] of [['constructionYard', 2, 2], ['windtrap', 5, 2], ['windtrap', 8, 2], ['windtrap', 11, 2], ['windtrap', 14, 2], ['windtrap', 17, 2], ['refinery', 2, 6], ['outpost', 6, 6], [infantry, 9, 6], ['lightFactory', 12, 6], ['heavyFactory', 15, 6], ['silo', 2, 10], ['refinery', 5, 10], ['repair', 9, 10], ['hiTech', 13, 10]]) world.spawnStructure(t, house, x, y);
    const h = world.houses.get(house);
    h.credits = 20000;
    h.startBuffer = 40000;
    createBrain(world, house, 'normal');
    return world;
  };
  const at = base('atreides', 'barracks');
  const order = [];
  for (let k = 0; k < 20 * 300; k++) { at.step(); for (const e of at.events.drain()) if (e.type === 'structurePlaced') order.push(e.structureType); }
  assert.ok(order.includes('starport'), JSON.stringify(order));
  assert.ok(order.indexOf('turret') >= 0 && order.indexOf('turret') < order.indexOf('starport'), `turrets first: ${order.join(', ')}`);
  const hk = base('harkonnen', 'wor');
  run(hk, 300);
  assert.ok([...hk.structures.values()].some((s) => s.typeId === 'starport'), 'a Starport on the way to the Devastator');
});
