import test from 'node:test';
import assert from 'node:assert/strict';
import { setupSkirmish } from '../src/game/setup.js';
import { checkInvariants } from '../src/sim/invariants.js';

// Four computer houses on a Huge map for twenty game minutes, timed: the simulation must stay cheap with every
// brain thinking and four armies on the move (measured 1.4–2.4 ms a step on the dev box under heavy load).
test('four houses, every one a computer: twenty game minutes on a 128 map, free-for-all and affordable', () => {
  const { world, house, opponents } = setupSkirmish({ seed: 3, size: 128, house: 'atreides', fog: false, aiPlayer: true,
    opponents: [{ house: 'harkonnen' }, { house: 'ordos' }, { house: 'sardaukar' }] });
  const all = [house, ...opponents];
  const placed = new Map(), targets = new Set(), fights = new Map();
  let spent = 0;
  for (let t = 0; t < 20 * 60 * 20; t++) {
    const start = performance.now();
    world.step();
    spent += performance.now() - start;
    for (const e of world.events.drain()) {
      if (e.type === 'structurePlaced') placed.set(e.house, (placed.get(e.house) ?? 0) + 1);
      if (e.type === 'aiAttack') targets.add(`${e.house}>${e.target}`);
      if ((e.type === 'unitDestroyed' || e.type === 'structureDestroyed') && e.by && e.by !== e.house) fights.set(`${e.by}>${e.house}`, (fights.get(`${e.by}>${e.house}`) ?? 0) + 1);
    }
    if (t % 6000 === 0) assert.deepEqual(checkInvariants(world), [], `invariants at ${t / 1200} min`);
  }
  const mean = spent / 24000;
  assert.ok(mean < 6, `${mean.toFixed(2)} ms a step on average`);
  for (const id of all) assert.ok((placed.get(id) ?? 0) >= 6, `${id} built ${placed.get(id) ?? 0} structures`);
  const amongComputers = [...fights].filter(([k]) => k.split('>').every((id) => opponents.includes(id)));
  assert.ok(amongComputers.length >= 2, `computers fought each other: ${[...fights].map(([k, n]) => `${k} ${n}`).join(', ')}`);
  assert.ok(new Set([...targets].map((k) => k.split('>')[1])).size >= 3, `waves went for several houses: ${[...targets].join(', ')}`);
});
