import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { WORM, WORM_HOUSE, spawnWorm, preyPriority, findPrey, wormSetting, wormSpawnSpot, sandLine } from '../src/sim/worm.js';
import { findTarget, validTarget, damage, killUnit } from '../src/sim/combat.js';
import { deathHandBlast } from '../src/sim/palace.js';
import { DEATH_HAND } from '../src/data/tuning.js';
import { MOVE } from '../src/data/units.js';
import { setupSkirmish } from '../src/game/setup.js';
import { unitVisibleTo } from '../src/sim/fog.js';
import { World } from '../src/sim/world.js';
import { GameMap } from '../src/sim/map.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

const desert = (w = 40, h = 40, seed = 1) => flatWorld(w, h, G.SAND, seed);
const worms = (world) => [...world.units.values()].filter((u) => u.typeId === 'sandworm');
/** Steps the world, gathering its events as it goes. */
function watch(world, seconds, until = null) {
  const seen = [];
  for (let i = 0; i < seconds * 20; i++) {
    world.step();
    seen.push(...world.events.drain());
    if (until?.(seen)) break;
  }
  return seen;
}

test('the setting decides how many worms roam: off none, few one, many three; nothing set reads few', () => {
  const most = (setting, seconds) => {
    const world = desert(64, 64, 4);
    if (setting === undefined) delete world.rules.worms; else world.rules.worms = setting;
    let top = 0, first = -1;
    for (let i = 0; i < seconds * 20; i++) {
      world.step();
      const n = worms(world).length;
      if (n && first < 0) first = world.time;
      top = Math.max(top, n);
    }
    return { top, first };
  };
  assert.equal(new World({ map: new GameMap(8, 8) }).rules.worms, 'off', 'a bare world has none');
  assert.equal(most('off', 300).top, 0);
  const few = most('few', 300);
  assert.equal(few.top, 1);
  assert.ok(few.first >= WORM.first.few[0] && few.first <= WORM.first.few[1] + 1, `the first worm after ${few.first} s`);
  assert.equal(most(undefined, 300).top, 1, 'a missing setting is few');
  assert.equal(most('many', 300).top, 3);
  assert.equal(wormSetting({ rules: { worms: 'lots' } }), 'few');
});

test('a worm is born on a large stretch of sand, away from every base and unit', () => {
  const world = desert(64, 64);
  const yard = world.spawnStructure('constructionYard', 'atreides', 4, 4);
  world.spawnUnit('combatTank', 'harkonnen', 50, 50);
  for (let y = 0; y < 64; y++) for (let x = 30; x < 34; x++) world.map.ground[world.map.idx(x, y)] = G.ROCK;   // a ridge of rock splits the desert
  for (let y = 0; y < 64; y++) for (let x = 34; x < 64; x++) if (x > 40 || y > 8) world.map.ground[world.map.idx(x, y)] = G.ROCK;   // east: only a small patch of sand
  world.map.revision++;
  for (let k = 0; k < 40; k++) {
    const s = wormSpawnSpot(world);
    assert.ok(s.x < 30, `on the large western sand, not the small patch: ${s.x},${s.y}`);
    assert.ok(Math.hypot(s.x - yard.x - 1, s.y - yard.y - 1) >= WORM.clear.base, 'clear of the base');
    assert.ok(world.map.isSand(world.map.idx(s.x, s.y)));
  }
  const rock = flatWorld(30, 30, G.ROCK);
  assert.equal(wormSpawnSpot(rock), null, 'no sand, no worm');
});

test('prey by the original priority: wheeled 5000, tracked and Harvesters 1000, infantry 100; ×4 busy, ÷ distance, ×2 close', () => {
  const world = desert();
  const worm = spawnWorm(world, 10, 10);
  const trike = world.spawnUnit('trike', 'atreides', 13, 10);
  const tank = world.spawnUnit('combatTank', 'harkonnen', 10, 12);
  const harvester = world.spawnUnit('harvester', 'atreides', 10, 15);
  const soldier = world.spawnUnit('soldier', 'ordos', 11, 10);
  const thopter = world.spawnUnit('ornithopter', 'atreides', 11, 11);
  assert.equal(preyPriority(world, worm, trike), Math.floor(5000 / 3));
  assert.equal(preyPriority(world, worm, tank), (1000 / 2) * 2, 'two tiles away: doubled');
  assert.equal(preyPriority(world, worm, harvester), 1000 / 5);
  assert.equal(preyPriority(world, worm, soldier), 100 * 2);
  assert.equal(preyPriority(world, worm, thopter), 0, 'never aircraft');
  tank.cooldown = 1;   // it has just fired
  assert.equal(preyPriority(world, worm, tank), (4000 / 2) * 2);
  world.issue('atreides', { type: 'move', ids: [trike.id], x: 30, y: 10 });
  world.step();
  assert.equal(preyPriority(world, worm, trike), Math.floor(20000 / tileDist(trike, worm)), 'moving: ×4');
  assert.equal(findPrey(world, worm), trike, 'the fast, moving trike is the most wanted');
});
const tileDist = (a, b) => { const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y); return Math.ceil(Math.max(dx, dy) + Math.min(dx, dy) / 2 - 1e-9); };

test('only units standing on sand or dunes are prey: rock, concrete and the air are safe', () => {
  const world = desert();
  const map = world.map;
  const worm = spawnWorm(world, 10, 10);
  map.ground[map.idx(12, 10)] = G.ROCK;
  map.ground[map.idx(10, 12)] = G.DUNE;
  map.concrete[map.idx(8, 10)] = 1;
  map.revision++;
  const onRock = world.spawnUnit('trike', 'atreides', 12, 10);
  const onSlab = world.spawnUnit('trike', 'atreides', 8, 10);
  const onDune = world.spawnUnit('combatTank', 'atreides', 10, 12);
  const far = world.spawnUnit('soldier', 'harkonnen', 30, 30);
  assert.equal(preyPriority(world, worm, onRock), 0);
  assert.equal(preyPriority(world, worm, onSlab), 0);
  assert.ok(preyPriority(world, worm, onDune) > 0, 'dunes are sand');
  assert.equal(findPrey(world, worm), onDune, 'the tank on the dune, not the trikes beside it on rock and concrete');
  onDune.inside = 99;
  assert.equal(findPrey(world, worm), far, 'held inside something: safe');
});

test('a worm surfaces under its prey, swallows it whole, eats three units and then dives away for good', () => {
  const world = desert(48, 24);
  const worm = spawnWorm(world, 4, 12, { heading: 0 });
  const meals = [[14, 6], [16, 18], [26, 12], [40, 12]].map(([x, y]) => world.spawnUnit('harvester', 'atreides', x, y));
  meals[0].harvest.load = 600;   // a full load would spill as spice — not from a worm's belly
  const seen = watch(world, 120, (s) => s.some((e) => e.type === 'wormGone'));
  const eaten = seen.filter((e) => e.type === 'unitDestroyed' && e.cause === 'eaten');
  assert.equal(eaten.length, 3, 'three meals');
  assert.equal(seen.filter((e) => e.type === 'wormAte').length, 3);
  assert.ok(seen.some((e) => e.type === 'wormSurfaced'));
  assert.equal(seen.filter((e) => e.type === 'explosion').length, 0, 'no blast, no wreck');
  assert.equal(world.map.spice.reduce((n, v) => n + v, 0), 0, 'no spilled spice');
  assert.ok(!world.units.has(worm.id), 'gone');
  assert.equal(seen.find((e) => e.type === 'wormGone').why, 'fed');
  assert.equal(meals.filter((u) => world.units.has(u.id)).length, 1, 'the fourth is spared');
  for (const e of eaten) assert.equal(e.by, WORM_HOUSE);
});

test('under the sand a worm cannot be targeted; up, it can be shot, and after 400 damage it flees', () => {
  const world = desert(40, 24);
  const worm = spawnWorm(world, 6, 12);
  const tank = world.spawnUnit('siegeTank', 'atreides', 8, 12);
  world.step();
  assert.equal(worm.submerged, true);
  assert.equal(findTarget(world, 'atreides', tank.x, tank.y, 6, { ignoreFog: true }), null, 'under the sand: nothing to shoot');
  assert.equal(validTarget(world, 'atreides', { kind: 'unit', id: worm.id }), false);
  assert.ok(runUntil(world, () => !worm.submerged, 10) >= 0, 'it comes up under the tank');
  assert.deepEqual(findTarget(world, 'harkonnen', 10, 12, 6, { ignoreFog: true, exclude: tank.id }), { kind: 'unit', id: worm.id }, 'up: a target');
  assert.equal(validTarget(world, 'atreides', { kind: 'unit', id: worm.id }), true);
  const fresh = desert(40, 24);
  const w2 = spawnWorm(fresh, 20, 12);
  w2.worm.state = 'up';
  w2.submerged = false;
  w2.rise = 1;
  damage(fresh, w2, WORM.flee - 1, { house: 'atreides', id: 0, kind: 'unit' });
  fresh.step();
  assert.equal(w2.worm.state, 'up', '399 damage: it stays');
  damage(fresh, w2, 1, { house: 'atreides', id: 0, kind: 'unit' });
  const seen = watch(fresh, 10, (s) => s.some((e) => e.type === 'wormGone'));
  assert.ok(seen.some((e) => e.type === 'wormFled'));
  assert.equal(seen.find((e) => e.type === 'wormGone')?.why, 'fled');
  assert.ok(!fresh.units.has(w2.id));
  assert.equal(w2.hp, 1000 - WORM.flee, '1000 HP: far from dead');
});

test('under the sand a worm is out of reach of every blast: no splash, no Death Hand', () => {
  const world = desert(40, 30);
  const worm = spawnWorm(world, 20, 15);
  worm.worm.rest = worm.worm.scanAt = 1e9;   // lying still
  world.step();
  const tank = world.spawnUnit('missileTank', 'harkonnen', 20, 15);
  killUnit(world, tank, { house: 'atreides', id: 0, kind: 'unit' });   // it blows up right on top of the worm
  deathHandBlast(world, { house: 'atreides', sourceId: 0, sourceKind: 'structure', x: worm.x, y: worm.y, damage: DEATH_HAND.damage ?? 600 });
  assert.equal(worm.submerged, true);
  assert.equal(worm.hp, 1000, 'not a scratch');
  watch(world, 2);
  assert.equal(worm.worm.fled, false, 'and no reason to flee');
});

/** Whether the worm's tile is worm ground (sand, dunes, spice). */
const onSand = (world, u) => world.map.moveFactor(world.map.idx(Math.floor(u.x), Math.floor(u.y)), MOVE.WORM) > 0;

test('the sand line follows the tiles exactly: a line clipping a rock corner is not open sand', () => {
  const world = desert(12, 12), map = world.map;
  map.ground[map.idx(5, 5)] = G.ROCK;
  map.revision++;
  assert.equal(sandLine(map, 4.5, 5.6, 5.6, 4.5), false, 'it cuts across the corner of the rock at 5,5');
  assert.equal(sandLine(map, 4.5, 4.5, 6.5, 4.5), true, 'along the rock: open');
  assert.equal(sandLine(map, 4.5, 4.9, 6.5, 4.9), true);
  assert.equal(sandLine(map, 3.5, 6.5, 7.5, 6.5), true);
  assert.equal(sandLine(map, 3.5, 3.5, 7.5, 7.5), false, 'straight through it');
  assert.equal(sandLine(map, 4.5, 3.5, 7.5, 8.5), false, 'through its corner point: shut, as the pathfinder would have it');
  assert.equal(sandLine(map, 3.5, 3.5, 4.5, 4.5), true, 'past an open corner');
});

test('a worm keeps to its sand: round a lone rock to its prey, never across a corner', () => {
  for (const [px, py] of [[8, 6], [9, 7], [7, 8]]) for (const [wx, wy] of [[2, 3], [2, 4], [3, 2], [4, 3], [3, 4]]) {
    const world = desert(16, 16), map = world.map;
    map.ground[map.idx(6, 5)] = G.ROCK;
    map.revision++;
    const worm = spawnWorm(world, wx, wy, { heading: 0 });
    const prey = world.spawnUnit('trike', 'atreides', px, py);
    for (let i = 0; i < 20 * 8 && world.units.has(prey.id); i++) {
      world.step();
      assert.ok(onSand(world, worm), `from ${wx},${wy} to ${px},${py}: on the rock at ${worm.x.toFixed(2)},${worm.y.toFixed(2)}`);
    }
    assert.ok(!world.units.has(prey.id), `from ${wx},${wy}: the trike at ${px},${py} is eaten all the same`);
  }
});

test('a worm left on rock goes straight back to the nearest sand and hunts on; with no sand near it dives away', () => {
  const world = desert(30, 20), map = world.map;
  for (let y = 0; y < 20; y++) for (let x = 0; x < 12; x++) map.ground[map.idx(x, y)] = G.ROCK;
  map.revision++;
  const worm = spawnWorm(world, 10, 10);   // set down on the rock, two tiles from the sand
  const prey = world.spawnUnit('trike', 'atreides', 20, 10);
  assert.ok(runUntil(world, () => onSand(world, worm), 3) >= 0, 'back on the sand');
  assert.ok(runUntil(world, () => !world.units.has(prey.id), 20) >= 0, 'and the hunt goes on');
  const rock = flatWorld(30, 30, G.ROCK);
  rock.map.ground[rock.map.idx(0, 0)] = G.SAND;
  const lost = spawnWorm(rock, 15, 15);
  const seen = watch(rock, 10, (s) => s.some((e) => e.type === 'wormGone'));
  assert.ok(!rock.units.has(lost.id), 'no sand anywhere near: gone, so the world can send another');
  assert.equal(seen.find((e) => e.type === 'wormGone')?.why, 'stranded');
});

test('in a long skirmish no worm ends up lying on rock', () => {
  const { world } = setupSkirmish({ seed: 3, size: 64, aiPlayer: true });
  world.rules.worms = 'few';
  const since = new Map();
  let worst = 0, where = '';
  for (let i = 0; i < 20 * 60 * 12; i++) {
    world.step();
    world.events.drain();
    for (const u of worms(world)) {
      const t = onSand(world, u) ? null : (since.get(u.id) ?? world.time);
      since.set(u.id, t);
      if (t !== null && world.time - t > worst) { worst = world.time - t; where = `worm ${u.id} at ${u.x.toFixed(2)},${u.y.toFixed(2)} (${u.worm.state}) since ${t.toFixed(1)} s`; }
    }
  }
  assert.ok(worst === 0, `on rock for ${worst.toFixed(2)} s: ${where}`);
});

test('the world gets another worm some time after one goes', () => {
  const world = desert(64, 64, 2);
  world.rules.worms = 'few';
  const first = worms(world)[0] ?? (run(world, WORM.first.few[1] + 2), worms(world)[0]);
  assert.ok(first, 'a worm came');
  world.removeUnit(first, 'dived');
  const gone = world.time;
  assert.ok(runUntil(world, () => worms(world).length === 1, WORM.again.few[1] + 5) > 0, 'another came');
  assert.ok(world.time - gone >= WORM.again.few[0] - 1, `not at once: ${(world.time - gone).toFixed(0)} s later`);
});

test('worms are deterministic: the same seed makes the same worm do the same things', () => {
  const trace = (seed) => {
    const world = desert(64, 64, seed);
    world.rules.worms = 'many';
    for (const [x, y] of [[10, 10], [50, 12], [30, 40], [12, 52]]) world.spawnUnit('trike', 'atreides', x, y);
    const out = [];
    for (let i = 0; i < 20 * 150; i++) {
      world.step();
      if (i % 100 === 0) for (const w of worms(world)) out.push(`${w.id}:${w.x.toFixed(3)},${w.y.toFixed(3)},${w.worm.state}`);
    }
    return out.join(' ');
  };
  const a = trace(7);
  assert.ok(a.length > 0, 'worms appeared');
  assert.equal(trace(7), a);
  assert.notEqual(trace(8), a);
});

test('worms do not reshuffle the rest of the simulation\'s dice', () => {
  const world = desert(64, 64, 3), quiet = desert(64, 64, 3);
  world.rules.worms = 'many';
  run(world, 120);
  run(quiet, 120);
  assert.ok(worms(world).length > 0);
  assert.equal(world.rng.next(), quiet.rng.next());
});

test('a worm under the sand is seen where the viewer sees: always revealed, in sight with fog, once explored with the shroud', () => {
  const make = (visibility) => {
    const world = desert(40, 20);
    world.visibility = visibility;
    world.fogOfWar = visibility !== 'revealed';
    const tank = world.spawnUnit('combatTank', 'atreides', 4, 10);
    const worm = spawnWorm(world, 6, 10);
    worm.worm.rest = worm.worm.scanAt = 1e9;   // keep it lying still, deaf to the tank
    world.step();
    return { world, tank, worm };
  };
  for (const visibility of ['shroud', 'fog', 'revealed']) {
    const { world, worm } = make(visibility);
    assert.equal(unitVisibleTo(world, 'atreides', worm), true, `${visibility}: in sight`);
    worm.x = worm.px = 30.5; worm.tx = 30;   // far off, in ground never seen
    world.step();
    assert.equal(unitVisibleTo(world, 'atreides', worm), visibility === 'revealed', `${visibility}: out of sight, unexplored`);
  }
  const { world, tank, worm } = make('fog');
  world.issue('atreides', { type: 'move', ids: [tank.id], x: 30, y: 10 });
  run(world, 30);
  worm.x = 6.5; worm.tx = 6;
  world.step();
  assert.equal(unitVisibleTo(world, 'atreides', worm), false, 'fog: explored but out of sight hides it');
  const shroud = make('shroud');
  shroud.world.issue('atreides', { type: 'move', ids: [shroud.tank.id], x: 30, y: 10 });
  run(shroud.world, 30);
  shroud.worm.x = 6.5; shroud.worm.tx = 6;
  shroud.world.step();
  assert.equal(unitVisibleTo(shroud.world, 'atreides', shroud.worm), true, 'shroud: ground once seen stays in view');
});

test('long AI games with worms keep every invariant: a worm under the sand holds no tile and frees the ones it takes', async () => {
  const { setupSkirmish } = await import('../src/game/setup.js');
  const { checkInvariants } = await import('../src/sim/invariants.js');
  for (const seed of [1, 6]) {
    const { world } = setupSkirmish({ seed, size: 64, house: 'atreides', aiPlayer: true, worms: 'many', fog: false });
    let worms = 0;
    for (let s = 0; s < 8 * 60 * 20; s++) {
      world.step();
      if (s % 20) continue;
      worms = Math.max(worms, [...world.units.values()].filter((u) => u.typeId === 'sandworm').length);
      const problems = checkInvariants(world);
      assert.deepEqual(problems, [], `seed ${seed} at ${world.time.toFixed(1)} s`);
    }
    assert.ok(worms > 0, 'worms were out');
  }
});
