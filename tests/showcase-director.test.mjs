import test from 'node:test';
import assert from 'node:assert/strict';
import { ShowcaseDirector, SHOWCASE, PLAYABLE } from '../src/game/showcase-director.js';
import { G } from '../src/data/terrain.js';

const fighters = (d, s) => [...d.world.units.values()].filter((u) => u.house === d.houses[s] && u.isGround && u.type.weapon);
const EXTRA = { sonic: 2, deviator: 1, devastator: 1 };

test('two different houses on a 64×40 map: rock at both ends, no peaks in the middle lane', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const d = new ShowcaseDirector({ seed });
    assert.equal(new Set(d.houses).size, 2);
    for (const h of d.houses) assert.ok(PLAYABLE.includes(h));
    const m = d.world.map;
    assert.deepEqual([m.w, m.h], [SHOWCASE.w, SHOWCASE.h]);
    for (let y = 0; y < m.h; y++) {
      assert.equal(m.ground[m.idx(3, y)], G.ROCK);
      assert.equal(m.ground[m.idx(m.w - 4, y)], G.ROCK);
    }
    for (let x = 12; x < m.w - 12; x++) for (let y = 12; y <= 28; y++) assert.notEqual(m.ground[m.idx(x, y)], G.MOUNTAIN, `peak at ${x},${y} (seed ${seed})`);
  }
});

test('each side starts with 10–14 fighters on their own tiles, and its base behind them', () => {
  for (const seed of [2, 7, 13]) {
    const d = new ShowcaseDirector({ seed });
    for (const s of [0, 1]) {
      const n = fighters(d, s).length - (s === d.specialSide ? EXTRA[d.special] ?? 0 : 0);
      assert.ok(n >= 10 && n <= 14, `seed ${seed} side ${s}: ${n}`);
      const types = [...d.world.structures.values()].filter((b) => b.house === d.houses[s]).map((b) => b.typeId);
      assert.ok(types.includes('constructionYard') && types.includes('windtrap'));
      assert.equal(types.filter((t) => t === 'wall').length, 4);
    }
    for (const u of d.world.units.values()) assert.equal(d.world.map.unit[d.world.map.idx(u.tx, u.ty)], u.id);
  }
});

test('the armies meet within the lead time', () => {
  for (const seed of [3, 8]) {
    const d = new ShowcaseDirector({ seed });
    let shots = 0;
    d.run(SHOWCASE.lead, (e) => { if (e.type === 'fired') shots++; });
    assert.ok(shots > 0, `seed ${seed}: no shots in ${SHOWCASE.lead} s`);
  }
});

test('the same seed plays the same battle', () => {
  const a = new ShowcaseDirector({ seed: 42 }), b = new ShowcaseDirector({ seed: 42 });
  a.run(15);
  b.run(15);
  assert.deepEqual(a.houses, b.houses);
  assert.equal(a.special, b.special);
  const units = (d) => [...d.world.units.values()].map((u) => [u.typeId, u.tx, u.ty, u.hp]);
  assert.deepEqual(units(a), units(b));
});
