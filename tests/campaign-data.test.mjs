// The campaign module's interface (contract C1): houses, missions, plain fresh copies, determinism.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_HOUSES, MISSIONS, missionDef, missionList } from '../src/data/campaign.js';
import { generateMap } from '../src/sim/mapgen.js';
import { segaOpens } from '../src/sim/tech.js';
import { checkMission } from './scenarios-helpers.mjs';

test('three houses in the Mega Drive house-select order, nine missions each', () => {
  assert.deepEqual(CAMPAIGN_HOUSES, ['atreides', 'ordos', 'harkonnen']);
  assert.equal(MISSIONS, 9);
  for (const house of CAMPAIGN_HOUSES) {
    const list = missionList(house);
    assert.equal(list.length, 9);
    list.forEach((def, k) => { assert.equal(def.id, `${house}-${k + 1}`); assert.equal(def.mission, k + 1); assert.equal(def.house, house); });
  }
});

test('anything else is null or empty', () => {
  for (const [h, n] of [['atreides', 0], ['atreides', 10], ['atreides', 1.5], ['atreides', '3'], ['sardaukar', 1], ['fremen', 2], [undefined, 1]]) assert.equal(missionDef(h, n), null, `${h} ${n}`);
  assert.deepEqual(missionList('mercenary'), []);
});

test('a definition is plain data, a fresh copy each call, the same every time', () => {
  for (const house of CAMPAIGN_HOUSES) for (let n = 1; n <= 9; n++) {
    const a = missionDef(house, n);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a, `${a.id} survives JSON`);
    a.player.units.length = 0;
    a.houses.length = 0;
    const b = missionDef(house, n);
    assert.ok(b.player.units.length > 0 && b.houses.length > 0, `${a.id}: a caller's changes do not leak`);
  }
});

test('the maps differ from mission to mission and house to house, but the last one', () => {
  const seen = new Map();
  for (const house of CAMPAIGN_HOUSES) for (let n = 1; n <= 8; n++) {
    const def = missionDef(house, n);
    const key = JSON.stringify(def.map);
    assert.ok(!seen.has(key), `${def.id} repeats ${seen.get(key)}`);
    seen.set(key, def.id);
  }
  const finals = CAMPAIGN_HOUSES.map((h) => generateMap(missionDef(h, 9).map).map.ground);
  assert.deepEqual(finals[0], finals[1]);
  assert.deepEqual(finals[0], finals[2]);
});

test('the checker catches a broken definition', () => {
  const broken = (change) => { const def = missionDef('atreides', 3); change(def); return checkMission(def); };
  const has = (problems, text) => problems.some((p) => p.includes(text));
  assert.deepEqual(broken(() => {}), []);
  assert.ok(has(broken((d) => { d.houses[0].structures[1].x = d.houses[0].structures[0].x; d.houses[0].structures[1].y = d.houses[0].structures[0].y; }), 'overlaps'));
  assert.ok(has(broken((d) => { d.houses[0].units[0].x = d.houses[0].structures[0].x; d.houses[0].units[0].y = d.houses[0].structures[0].y; }), 'on harkonnen'));
  assert.ok(has(broken((d) => { d.houses[0].units[0].type = 'sonicTank'; }), 'unit sonicTank'));
  assert.ok(has(broken((d) => { d.houses[0].structures.push({ type: 'ix', x: 1, y: 1 }); }), 'structure ix'));
  assert.ok(has(broken((d) => { d.houses[0].structures.push({ type: 'silo', x: 30, y: 30 }); }), 'off rock'));
  assert.ok(has(broken((d) => { d.houses[0].concrete.length = 0; }), 'without concrete'));
  assert.ok(has(broken((d) => { d.player.units[1].x = d.player.units[0].x; d.player.units[1].y = d.player.units[0].y; }), 'two units'));
  assert.ok(has(broken((d) => { d.reinforcements.find((r) => r.house === 'harkonnen').units = ['sonicTank']; }), 'reinforcement units'));
  assert.ok(has(broken((d) => { d.objective = { kind: 'quota' }; }), 'objective'));
  assert.ok(has(broken((d) => { d.map.sites[0].id = 'home'; }), 'player'));
});

test('titles name the objective and the enemy', () => {
  assert.equal(missionDef('atreides', 1).title, 'Harvest 1000 credits');
  assert.equal(missionDef('ordos', 2).title, 'Harvest 2700 credits or destroy the Harkonnen base');
  assert.equal(missionDef('harkonnen', 3).title, 'Destroy the Ordos base');
  assert.equal(missionDef('ordos', 5).title, 'Destroy both Harkonnen bases');
  assert.equal(missionDef('atreides', 8).title, 'Destroy the Ordos and Harkonnen bases');
  assert.equal(missionDef('harkonnen', 9).title, 'Destroy both Sardaukar bases');
});

test('the start force can be built or bought soon after: what the briefing can call new technology', () => {
  // the Mega Drive hands out units ahead of the ladder (a Quad in Atreides 2); what a mission opens is listed per house
  for (const house of CAMPAIGN_HOUSES) {
    const opened = new Set();
    for (let n = 1; n <= 9; n++) for (const name of segaOpens(n, house)) { assert.ok(!opened.has(name), `${house} ${name} opens twice`); opened.add(name); }
    assert.ok(opened.has('Palace') && opened.has('Starport') && !opened.has('House of IX'));
  }
});
