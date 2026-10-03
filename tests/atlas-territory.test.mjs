// The territory map's data (src/data/territory.js, contract C5): 27 regions, who holds which after each mission
// (the PC's REGION[AHO].INI groups) and the region each mission is fought in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, ownership, targetRegion, changes, ownerOf, HOME, STEPS } from '../src/data/territory.js';

const HOUSES = ['atreides', 'harkonnen', 'ordos'];
const OWNERS = ['atreides', 'harkonnen', 'ordos', 'sardaukar'];
// The Sega campaign's opponents per mission 2–9 (research.md §6): the target region belongs to one of them.
const ENEMIES = {
  atreides: [null, ['ordos'], ['harkonnen'], ['harkonnen'], ['ordos'], ['harkonnen'], ['ordos'], ['ordos', 'harkonnen'], ['sardaukar']],
  harkonnen: [null, ['atreides'], ['ordos'], ['ordos'], ['atreides'], ['ordos'], ['atreides'], ['atreides', 'ordos'], ['sardaukar']],
  ordos: [null, ['harkonnen'], ['atreides'], ['atreides'], ['harkonnen'], ['atreides'], ['harkonnen'], ['atreides', 'harkonnen'], ['sardaukar']],
};

test('27 regions with ids 1 to 27', () => {
  assert.equal(REGIONS.length, 27);
  assert.deepEqual(REGIONS.map((r) => r.id), Array.from({ length: 27 }, (_, i) => i + 1));
  assert.equal(STEPS, 9);
});

test('every step of every campaign hands each region to at most one house', () => {
  for (const house of HOUSES) {
    for (let step = 0; step <= 9; step++) {
      const own = ownership(house, step);
      assert.deepEqual(Object.keys(own).sort(), [...OWNERS].sort());
      const seen = new Set();
      for (const o of OWNERS) {
        for (const id of own[o]) {
          assert.ok(id >= 1 && id <= 27, `${house} step ${step}: bad id ${id}`);
          assert.ok(!seen.has(id), `${house} step ${step}: region ${id} held twice`);
          seen.add(id);
          assert.equal(ownerOf(house, step, id), o);
        }
      }
    }
  }
});

test('the opening claims are the PC map’s: Atreides west, Harkonnen north, Ordos east', () => {
  for (const house of HOUSES) {
    const own = ownership(house, 0);
    assert.deepEqual([...own.atreides].sort((a, b) => a - b), [7, 13, 14, 20, 21, 22]);
    assert.deepEqual([...own.harkonnen].sort((a, b) => a - b), [3, 4, 5, 6, 9, 10]);
    assert.deepEqual([...own.ordos].sort((a, b) => a - b), [19, 23, 24, 25, 26, 27]);
    assert.deepEqual(own.sardaukar, []);
    assert.deepEqual(ownership(house, 1), own, 'mission 1 is fought at home and takes no land');
  }
});

test('the player only gains land, step by step', () => {
  for (const house of HOUSES) {
    let before = new Set(ownership(house, 0)[house]);
    for (let step = 1; step <= 9; step++) {
      const now = new Set(ownership(house, step)[house]);
      for (const id of before) assert.ok(now.has(id), `${house} lost region ${id} at step ${step}`);
      before = now;
    }
  }
});

test('after mission 8 only the Emperor’s region stands against the player, and step 9 leaves it so', () => {
  const last = { atreides: 6, harkonnen: 15, ordos: 4 };
  for (const house of HOUSES) {
    for (const step of [8, 9]) {
      const own = ownership(house, step);
      assert.deepEqual(own.sardaukar, [last[house]], `${house} step ${step}`);
      assert.equal(own[house].length, 26, `${house} step ${step}`);
      for (const rival of HOUSES.filter((h) => h !== house)) assert.deepEqual(own[rival], [], `${house} step ${step}: ${rival}`);
    }
    assert.equal(targetRegion(house, 9), last[house]);
  }
});

test('each mission’s region: mission 1 at home, then held by that mission’s enemy at its briefing', () => {
  for (const house of HOUSES) {
    assert.equal(targetRegion(house, 1), HOME[house]);
    assert.equal(ownerOf(house, 0, HOME[house]), house);
    for (let mission = 2; mission <= 9; mission++) {
      const id = targetRegion(house, mission), owner = ownerOf(house, mission - 1, id);
      assert.notEqual(owner, house, `${house} mission ${mission}: region ${id} is already the player's`);
      if (mission === 2 && owner === null) continue;   // the Harkonnen's and the Ordos's mission-2 choices are all unclaimed land
      assert.ok(ENEMIES[house][mission - 1].includes(owner), `${house} mission ${mission}: region ${id} is held by ${owner}`);
    }
    assert.equal(targetRegion(house, 0), null);
    assert.equal(targetRegion(house, 10), null);
  }
});

test('each mission’s region becomes the player’s once it is won (missions 2 to 8)', () => {
  for (const house of HOUSES) {
    for (let mission = 2; mission <= 8; mission++) assert.equal(ownerOf(house, mission, targetRegion(house, mission)), house, `${house} mission ${mission}`);
  }
});

test('changes lists exactly the regions that change hands at a step', () => {
  for (const house of HOUSES) {
    assert.deepEqual(changes(house, 0), []);
    assert.deepEqual(changes(house, 1), []);
    for (let step = 1; step <= 9; step++) {
      const list = changes(house, step);
      for (const { id, from, to } of list) {
        assert.equal(ownerOf(house, step - 1, id), from);
        assert.equal(ownerOf(house, step, id), to);
        assert.notEqual(from, to);
      }
      const n = REGIONS.filter((r) => ownerOf(house, step - 1, r.id) !== ownerOf(house, step, r.id)).length;
      assert.equal(list.length, n);
    }
    assert.ok(changes(house, 2).some((c) => c.to === house), `${house} gains land at step 2`);
  }
});

test('unknown houses and steps fall back safely', () => {
  assert.deepEqual(ownership('atreides', -3), ownership('atreides', 0));
  assert.deepEqual(ownership('atreides', 42), ownership('atreides', 9));
  assert.deepEqual(ownership('sardaukar', 2), ownership('atreides', 2));
  assert.equal(targetRegion('nobody', 3), targetRegion('atreides', 3));
});
