// The skirmish's "Computers allied" choice (ui/skirmish-setup.js → game/setup.js → sim/alliance.js): Off, the
// default, keeps the free-for-all; On makes every computer house one side against the player, so they never fight
// each other, share what they see, all come for the player, and the player wins only when every one is out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skirmishQuery, cleanSetup, loadSetup, saveSetup, DEFAULT_SETUP } from '../src/ui/skirmish-setup.js';
import { readParams } from '../src/core/params.js';
import { setupSkirmish, skirmishOptions, findFreeTile } from '../src/game/setup.js';
import { friendly } from '../src/sim/alliance.js';
import { sizeUpRivals } from '../src/sim/ai.js';
import { destroyStructure } from '../src/sim/combat.js';
import { structureVisibleTo, updateFog } from '../src/sim/fog.js';
import { run, runUntil } from './helpers.mjs';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const THREE = [{ house: 'harkonnen', difficulty: 'normal' }, { house: 'ordos', difficulty: 'hard' }, { house: 'sardaukar', difficulty: 'easy' }];
const battle = (allied, extra = {}) => setupSkirmish({ seed: 4, size: 64, house: 'atreides', opponents: THREE, allied, visibility: 'revealed', ...extra });
const tough = (u) => { u.hp = u.maxHp = 100000; return u; };

test('Computers allied is Off by default, remembered with the other skirmish choices and carried by the battle URL', () => {
  assert.equal(DEFAULT_SETUP.allied, false, 'a free-for-all, as before');
  assert.equal(cleanSetup({}).allied, false);
  for (const odd of ['true', 1, 'on', null]) assert.equal(cleanSetup({ allied: odd }).allied, false, `${JSON.stringify(odd)} is no choice`);
  const store = memory();
  const setup = { house: 'ordos', opponents: THREE.slice(0, 2), allied: true, techLevel: 6, worms: 'off', size: 96, seed: 9, credits: 5000, visibility: 'fog' };
  saveSetup(setup, store);
  assert.deepEqual(loadSetup(store), cleanSetup(setup));
  assert.equal(loadSetup(store).allied, true, 'On is remembered');
  saveSetup({ ...setup, allied: false }, store);
  assert.equal(loadSetup(store).allied, false, 'and Off');

  const on = new URLSearchParams(skirmishQuery({ ...setup, allied: true }));
  assert.equal(on.get('allied'), '1');
  assert.equal(new URLSearchParams(skirmishQuery({ ...setup, allied: false })).has('allied'), false, 'Off leaves the URL as it was');
  assert.equal(skirmishOptions(readParams(`?${on}`)).allied, true);
  assert.equal(skirmishOptions(readParams('?scene=skirmish&house=atreides')).allied, false);
});

test('On, the battle URL sets every computer house on one side and the player alone; Off, nobody is allied', () => {
  const q = skirmishQuery({ house: 'atreides', opponents: THREE, allied: true, seed: 4, size: 64 });
  const { world, opponents } = setupSkirmish(skirmishOptions(readParams(`?${q}`)));
  assert.deepEqual(opponents, ['harkonnen', 'ordos', 'sardaukar']);
  for (const a of opponents) for (const b of opponents) assert.ok(friendly(world, a, b), `${a} and ${b} are allies`);
  for (const a of opponents) assert.ok(!friendly(world, a, 'atreides'), `${a} fights the player`);
  assert.equal(battle(false).world.teams, null, 'Off: every house for itself');
  assert.equal(setupSkirmish({ seed: 4, house: 'atreides', opponents: THREE.slice(0, 1), allied: true }).world.teams, null, 'one opponent has nobody to ally with');
});

/** A computer tank of each of two houses face to face in the middle of the map, too tough to die. */
function faceOff(world) {
  const mid = Math.floor(world.map.w / 2);
  const a = findFreeTile(world, mid, mid, 'tracked', 10), b = findFreeTile(world, a.x + 2, a.y, 'tracked', 6, 1);
  return [tough(world.spawnUnit('combatTank', 'harkonnen', a.x, a.y)), tough(world.spawnUnit('combatTank', 'ordos', b.x, b.y))];
}
const firedBy = (world, ids) => world.events.drain().filter((e) => e.type === 'fired' && ids.includes(e.id));

test('On, computer tanks side by side hold their fire; Off, they fight', () => {
  for (const allied of [true, false]) {
    const { world } = battle(allied);
    const [h, o] = faceOff(world);
    world.events.drain();
    run(world, 6);
    const shots = firedBy(world, [h.id, o.id]);
    if (allied) {
      assert.equal(shots.length, 0, 'allies never shoot each other');
      assert.ok(h.hp === h.maxHp && o.hp === o.maxHp);
    } else {
      assert.ok(shots.some((e) => e.id === h.id) && shots.some((e) => e.id === o.id), 'a free-for-all: both open fire');
      assert.ok(h.hp < h.maxHp && o.hp < o.maxHp);
    }
  }
});

test('On, a computer wave passes a nearer computer base by and comes for the player; Off, it takes the nearer one', () => {
  for (const allied of [true, false]) {
    const { world, starts } = battle(allied);
    const home = starts[1];   // the Harkonnen's corner
    // an Ordos outpost right beside the Harkonnen, far nearer than the player's base
    const near = findFreeTile(world, home.x + (home.x < world.map.w / 2 ? 6 : -6), home.y, 'tracked', 6);
    world.spawnStructure('silo', 'ordos', near.x, near.y);
    assert.deepEqual(sizeUpRivals(world, 'harkonnen', home).map((r) => r.house).sort(), allied ? ['atreides'] : ['atreides', 'ordos', 'sardaukar']);
    const brain = world.houses.get('harkonnen').brain;
    for (let k = 0; k < 6; k++) { const t = findFreeTile(world, home.x, home.y, 'tracked', 8, 2); world.spawnUnit('combatTank', 'harkonnen', t.x, t.y); }
    world.houses.get('harkonnen').credits = 0;
    brain.nextAttack = 0;
    let wave = null;
    runUntil(world, () => { for (const e of world.events.drain()) if (e.type === 'aiAttack' && e.house === 'harkonnen') wave ??= e; return !!wave; }, 20);
    assert.ok(wave, 'the Harkonnen attacked');
    assert.equal(wave.target, allied ? 'atreides' : 'ordos');
  }
});

test('On, the computers share their sight, and the player wins only when every one of them is out', () => {
  const { world, opponents } = battle(true, { visibility: 'shroud' });
  const silo = world.spawnStructure('silo', 'sardaukar', 2, 2);
  updateFog(world);
  assert.ok(structureVisibleTo(world, 'harkonnen', silo), 'what the Sardaukar see, the Harkonnen see');
  for (const id of opponents) {
    // knock each computer out in turn (its MCV gone, no building): the game goes on while any is left
    for (const u of [...world.units.values()]) if (u.house === id && u.type.deploysTo) world.removeUnit(u);
    for (const s of [...world.structures.values()]) if (s.house === id) destroyStructure(world, s, null);
    run(world, 1);
    if (id !== opponents.at(-1)) assert.equal(world.outcome, null, `the player has not won while ${opponents.slice(opponents.indexOf(id) + 1)} stand`);
  }
  assert.ok(runUntil(world, () => world.outcome, 2) >= 0);
  assert.equal(world.outcome.winner, 'atreides');
});
