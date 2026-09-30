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
    assert.equal(d.world.rules.victory, false);
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
  for (let seed = 1; seed <= 20; seed++) {
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
  for (let seed = 1; seed <= 12; seed++) {
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

test('the fight never runs dry: both sides keep fighters for three minutes and reinforcements come', () => {
  const d = new ShowcaseDirector({ seed: 11 });
  for (let k = 0; k < 18; k++) {
    d.run(10);
    for (const s of [0, 1]) assert.ok(fighters(d, s).length > 0, `side ${s} empty at ${d.world.time.toFixed(0)} s`);
  }
  assert.ok(d.reinforced > 0);
});

test('the hotspot follows the shots, and falls back to the centre when they stop', () => {
  const d = new ShowcaseDirector({ seed: 1 });
  assert.deepEqual(d.hotspot, d.center);
  for (let i = 0; i < 5; i++) d.onEvent({ type: 'fired', x: 20.5, y: 10.5 });
  for (let i = 0; i < 240; i++) d.updateHotspot();
  assert.ok(Math.hypot(d.hotspot.x - 20.5, d.hotspot.z - 10.5) < 0.5);
  d.world.time += SHOWCASE.hotspotWindow + 0.1;   // the shots age out
  for (let i = 0; i < 240; i++) d.updateHotspot();
  assert.ok(Math.hypot(d.hotspot.x - d.center.x, d.hotspot.z - d.center.z) < 0.5);
});

test('the armies meet in the middle: the hotspot sits between the bases', () => {
  for (const seed of [5, 9]) {
    const d = new ShowcaseDirector({ seed });
    d.run(SHOWCASE.lead + 10);
    const { x, z } = d.hotspot;
    assert.ok(z >= 0 && z <= SHOWCASE.h, `z ${z}`);
    assert.ok(x > 12 && x < SHOWCASE.w - 12, `seed ${seed}: x ${x.toFixed(1)} sits at a base`);
  }
});

test('every house special turns up across seeds and happens within half a minute of the battle', () => {
  const seen = new Map();
  for (let seed = 1; seen.size < 5 && seed < 300; seed++) {
    const d = new ShowcaseDirector({ seed });
    if (seen.has(d.special)) continue;
    d.run(SHOWCASE.lead + 30);
    seen.set(d.special, d.specialSeen);
  }
  assert.deepEqual([...seen.keys()].sort(), ['deathHand', 'devastator', 'deviator', 'ornithopters', 'sonic']);
  for (const [special, ok] of seen) assert.ok(ok, `${special} did not happen`);
});
