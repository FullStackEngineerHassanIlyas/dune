// The battles behind the tooltips' Strong and Weak (src/data/effectiveness.js). A plain run checks the table was
// played with the game's numbers of today and fights a few of its claims out again. UPDATE_EFFECTIVENESS=1 plays every
// pair (in worker threads, a minute or two) and writes the table into src/data/effectiveness.js.
import { isMainThread, parentPort, workerData, Worker } from 'node:worker_threads';
import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { flatWorld, run } from './helpers.mjs';
import { orderAttackMove } from '../src/sim/orders.js';
import { UNITS } from '../src/data/units.js';
import { STRUCTURES } from '../src/data/structures.js';
import { WEAPONS } from '../src/data/weapons.js';
import * as TUNING from '../src/data/tuning.js';
import { G } from '../src/data/terrain.js';
import { ROSTER, FOUGHT, FOUGHT_WITH, fightScore, matchups } from '../src/data/effectiveness.js';

const HARNESS = 1;   // raise when the battles below change: the table is then played again
const BUDGETS = [[700, 1400], [1500, 2800]], SEEDS = [1, 2, 3, 4], GROUNDS = [G.ROCK, G.SAND], SECONDS = 240;
const TABLE_FILE = new URL('../src/data/effectiveness.js', import.meta.url);
const cost = (id) => (UNITS[id] ?? STRUCTURES[id]).cost;

/** How many of each come closest to the same money, both totals within [lo, hi] credits. */
function counts(a, b, lo, hi) {
  let best = null;
  for (let na = 1; na <= 30; na++) for (let nb = 1; nb <= 30; nb++) {
    const A = na * cost(a), B = nb * cost(b);
    if (A < lo || B < lo || A > hi || B > hi) continue;
    const miss = Math.abs(A - B) / Math.max(A, B);
    if (!best || miss < best.miss - 1e-9 || (Math.abs(miss - best.miss) < 1e-9 && A < best.A)) best = { na, nb, miss, A };
  }
  return best;
}

/**
 * `na` of `a` from the west against `nb` of `b` from the east (turrets stand, powered, and the units come at them).
 * Odd seeds give `a` to the Atreides, even ones to the Harkonnen. Returns the share of hit points each side still
 * has, counting only units its own house holds at the end (a gassed unit is not its side's until it comes back).
 */
export function battle(a, na, b, nb, seed, ground) {
  const world = flatWorld(60, 32, ground, seed);
  const [HA, HB] = seed % 2 ? ['atreides', 'harkonnen'] : ['harkonnen', 'atreides'];
  for (const h of [HA, HB]) world.houses.get(h).isAI = true;
  world.fogOfWar = false;
  const line = (type, n, house, x0, dir) => Array.from({ length: n }, (_, i) => world.spawnUnit(type, house, x0 + dir * Math.floor(i / 6), 13 + (i % 6), { heading: dir > 0 ? 0 : Math.PI }));
  const turrets = !!STRUCTURES[b];
  const A = line(a, na, HA, 12, -1);
  let B;
  if (turrets) {
    for (const y of [2, 6, 10]) world.spawnStructure('windtrap', HB, 55, y);
    B = Array.from({ length: nb }, (_, i) => world.spawnStructure(b, HB, 38 + 2 * (i % 4), 11 + 2 * Math.floor(i / 4)));
    orderAttackMove(world, A, 41, 14);
  } else {
    B = line(b, nb, HB, 40, 1);
    orderAttackMove(world, A, 44, 15);
    orderAttackMove(world, B, 8, 15);
  }
  const standing = (v) => (turrets && B.includes(v) ? world.structures.has(v.id) : world.units.has(v.id));
  const movers = turrets ? A : [...A, ...B];
  const regroup = () => {   // whoever stands idle (arrived, back from the gas) goes to just inside its range of the nearest enemy
    for (const u of movers) {
      if (!world.units.has(u.id) || u.order.type !== 'idle' || u.target) continue;
      let best = null, bd = Infinity;
      for (const v of [...A, ...B]) {
        if (!standing(v) || v.house === u.house) continue;
        const d = Math.hypot(v.x - u.x, v.y - u.y);
        if (d < bd) { bd = d; best = v; }
      }
      const reach = Math.max(1, (u.type.range ?? 1) - 1);
      if (best && bd > reach) orderAttackMove(world, [u], best.x + ((u.x - best.x) * reach) / bd, best.y + ((u.y - best.y) * reach) / bd);
    }
  };
  for (let t = 0; t < SECONDS; t++) {
    run(world, 1);
    if (!A.some(standing) || !B.some(standing)) break;
    regroup();
  }
  const left = (list, n, house) => list.filter((v) => standing(v) && v.house === house).reduce((s, v) => s + v.hp / v.maxHp, 0) / n;
  return { a: left(A, na, HA), b: left(B, nb, HB) };
}

/** `a` against `b`: the mean of (a's share left - b's share left) over both budgets, every seed and both grounds. */
export function pairScore(a, b, { budgets = BUDGETS, seeds = SEEDS, grounds = GROUNDS } = {}) {
  let sum = 0, n = 0;
  for (const [lo, hi] of budgets) {
    const { na, nb } = counts(a, b, lo, hi);
    for (const seed of seeds) for (const ground of grounds) {
      const r = battle(a, na, b, nb, seed, ground);
      sum += r.a - r.b;
      n++;
    }
  }
  return sum / n;
}

/** Every pair the table holds, in the roster's order (two turrets never meet). */
const pairs = () => ROSTER.flatMap((a, i) => ROSTER.slice(i + 1).filter((b) => !(STRUCTURES[a] && STRUCTURES[b])).map((b) => [a, b]));

/** A short hash of every number the battles depend on: the fighters, their weapons, the combat tuning. */
export function fingerprint() {
  const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));
  const fighters = ROSTER.map((id) => [id, UNITS[id]
    ? pick(UNITS[id], ['cost', 'hp', 'move', 'speed', 'turn', 'turret', 'weapon', 'damage', 'range', 'fireDelay', 'firesTwice', 'targetAir', 'sight', 'explodes'])
    : pick(STRUCTURES[id], ['cost', 'hp', 'w', 'h', 'power', 'weapon', 'damage', 'range', 'fireDelay', 'targetAir', 'near'])]);
  const tuning = pick(TUNING, ['SPEED_BASE', 'TURN_RATE', 'TURRET_TURN_RATE', 'SECOND_SHOT_DELAY', 'SCATTER', 'DEATH_SPLASH', 'AIM_TOLERANCE', 'GUARD_RADIUS', 'RETALIATE_RANGE', 'AIR', 'SONIC', 'DEVIATOR']);
  const text = JSON.stringify({ HARNESS, BUDGETS, SEEDS, SECONDS, fighters, windtrap: STRUCTURES.windtrap.power, WEAPONS, tuning });
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** Writes the FOUGHT block of src/data/effectiveness.js from [a, b, score] rows. */
function writeTable(rows) {
  const by = new Map(ROSTER.map((id) => [id, []]));
  const order = (id) => ROSTER.indexOf(id);
  for (const [a, b, s] of rows.sort((x, y) => order(x[0]) - order(y[0]) || order(x[1]) - order(y[1]))) by.get(a).push(`${b}: ${Number(s.toFixed(2)) || 0}`);
  const body = ROSTER.filter((id) => by.get(id).length).map((id) => `  ${id}: { ${by.get(id).join(', ')} },`).join('\n');
  const src = readFileSync(TABLE_FILE, 'utf8');
  const block = /(\/\/ ---- FOUGHT:[^\n]*\n)[\s\S]*?(\/\/ ---- end of FOUGHT ----)/;
  if (!block.test(src)) throw new Error('no FOUGHT block in src/data/effectiveness.js');
  writeFileSync(TABLE_FILE, src.replace(block, (_, head, tail) => `${head}export const FOUGHT_WITH = '${fingerprint()}';\nexport const FOUGHT = {\n${body}\n};\n${tail}`));
}

if (!isMainThread) {
  parentPort.postMessage(workerData.pairs.map(([a, b]) => [a, b, pairScore(a, b)]));
} else {
  const { default: test } = await import('node:test');
  const { default: assert } = await import('node:assert/strict');

  if (process.env.UPDATE_EFFECTIVENESS) {
    test('every pair fought out, the table written', { timeout: 30 * 60 * 1000 }, async () => {
      const list = pairs(), n = Math.max(1, Math.min(8, availableParallelism() - 1, list.length));
      const shards = await Promise.all(Array.from({ length: n }, (_, k) => new Promise((resolve, reject) => {
        const w = new Worker(fileURLToPath(import.meta.url), { workerData: { pairs: list.filter((_, i) => i % n === k) } });
        w.once('message', resolve);
        w.once('error', reject);
      })));
      const rows = shards.flat();
      assert.equal(rows.length, list.length);
      writeTable(rows);
    });
  } else {
    test('the table was fought with the game\'s numbers of today', () => {
      assert.equal(FOUGHT_WITH, fingerprint(), 'units, weapons or combat tuning changed: play the table again with UPDATE_EFFECTIVENESS=1 node --test tests/effectiveness-fights.test.mjs');
      for (const [a, b] of pairs()) assert.equal(typeof FOUGHT[a]?.[b], 'number', `${a} vs ${b} missing`);
    });

    // Claims the tooltips make, fought again on two seeds (each house on the west once): the table and the battles agree.
    const claims = [
      ['deviator', 1, 'soldier', 12, 1, 'the gas turns soldiers on each other'],
      ['siegeTank', 1, 'trike', 4, 1, 'the Siege Tank outlasts four Trikes'],
      ['combatTank', 4, 'infantry', 12, 1, 'tanks against infantry'],
      ['missileTank', 2, 'turret', 7, 1, 'the Missile Tank outranges the Gun Turret'],
      ['raider', 4, 'combatTank', 2, -1, 'machine guns do little to tanks'],
      ['ornithopter', 2, 'troopers', 6, -1, 'Trooper rockets bring Ornithopters down'],
    ];
    for (const [a, na, b, nb, sign, why] of claims) {
      test(`fought again: ${na} ${a} against ${nb} ${b} (${why})`, () => {
        const table = fightScore(a, b);
        assert.equal(Math.sign(table), sign, `table ${table}`);
        const r = [1, 2].map((seed) => battle(a, na, b, nb, seed, G.ROCK)), mean = r.reduce((s, x) => s + x.a - x.b, 0) / r.length;
        assert.equal(Math.sign(mean), sign, `battles ${JSON.stringify(r)}, table ${table}`);
      });
    }

    test('what the tooltips say follows from the battles', () => {
      assert.ok(matchups('deviator').strong.includes('Infantry') && !matchups('deviator').weak.includes('Light vehicles'), `${JSON.stringify(matchups('deviator'))}`);
      assert.ok(!matchups('raider').strong.includes('Tanks') && !matchups('trike').strong.includes('Tanks') && !matchups('quad').strong.includes('Tanks'));
      for (const id of ['siegeTank', 'missileTank', 'sonicTank', 'devastator']) assert.ok(!matchups(id).weak.includes('Light vehicles'), `${id}: ${matchups(id).weak}`);
    });
  }
}
