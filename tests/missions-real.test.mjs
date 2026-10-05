// The 27 real campaign missions set up through game/mission-setup.js (final review): what the campaign data tests'
// own world builder (scenarios-helpers.mjs) leaves out — standing orders, brains with the mission's parameters,
// alliances, the Sega ladder applied at set-up, world.mission with its objective and reinforcement schedule — checked
// on the real data, and a game minute of each mission run clean.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missionDef, CAMPAIGN_HOUSES, MISSIONS } from '../src/data/campaign.js';
import { setupMission } from '../src/game/mission-setup.js';
import { buildOptions } from '../src/sim/tech.js';
import { segaStructureTech } from '../src/data/sega-tech.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { friendly, hostile } from '../src/sim/alliance.js';
import { DIFFICULTY } from '../src/sim/ai.js';

const missions = () => CAMPAIGN_HOUSES.flatMap((house) => Array.from({ length: MISSIONS }, (_, k) => missionDef(house, k + 1)));
const computers = (def) => [...new Set([...def.houses.map((h) => h.id), ...def.reinforcements.map((r) => r.house)])].filter((id) => id !== def.house);

test('every real mission sets up without a problem, on the Sega ladder, with its objective, title and schedule', () => {
  for (const def of missions()) {
    const { world, problems, house } = setupMission(def);
    assert.deepEqual(problems, [], def.id);
    assert.equal(house, def.house);
    assert.equal(world.rules.tech, 'sega', def.id);
    for (const h of world.houses.values()) assert.equal(h.techRules, 'sega', `${def.id}: ${h.id} on the Sega ladder from the start`);
    assert.equal(world.houses.get(def.house).techLevel, def.mission);
    const m = world.mission;
    assert.ok(m, def.id);
    assert.equal(m.kind, def.objective.kind, def.id);
    assert.equal(m.quota, def.objective.quota ?? 0, def.id);
    assert.equal(m.title, def.title, def.id);
    assert.equal(m.minSeconds, 120);
    const d = m.debug();
    assert.equal(d.pending, def.reinforcements.length, `${def.id}: every reinforcement scheduled`);
    assert.equal(d.outcome, null);
    assert.equal(world.rules.worms, def.worms);
    assert.deepEqual(checkInvariants(world), [], `${def.id} at set-up`);
  }
});

test('every real mission: the player\'s first build options keep to the mission\'s rung of the ladder', () => {
  for (const def of missions()) {
    const { world } = setupMission(def);
    const opts = buildOptions(world, def.house);
    assert.ok(opts.structure.includes('windtrap'), `${def.id}: ${opts.structure}`);
    for (const t of opts.structure) assert.ok(segaStructureTech(t, def.house) <= def.mission, `${def.id}: ${t} ahead of the ladder`);
    assert.ok(!opts.structure.includes('ix'), def.id);
    assert.equal(opts.structure.includes('palace'), false, `${def.id}: no Palace without a Starport`);
  }
});

test('every real mission: computer houses are allies, the player everyone\'s enemy; units carry their standing orders', () => {
  for (const def of missions()) {
    const { world } = setupMission(def);
    const side = computers(def);
    for (const a of side) {
      assert.ok(hostile(world, a, def.house), `${def.id}: ${a} against the player`);
      for (const b of side) assert.ok(friendly(world, a, b), `${def.id}: ${a} with ${b}`);
    }
    const d = world.mission.debug();
    const orders = def.houses.flatMap((h) => h.units.map((u) => u.order));
    assert.equal(d.hunters, orders.filter((o) => o === 'hunt').length, `${def.id} hunters`);
    assert.equal(d.ambushes, orders.filter((o) => o === 'ambush').length, `${def.id} ambushes`);
    for (const h of def.houses) {
      const brain = world.houses.get(h.id).brain;
      assert.ok(brain?.params, `${def.id}: ${h.id} thinks with the mission's parameters`);
      if (h.ai.passive) { assert.equal(brain.nextAttack, Infinity, `${def.id}: ${h.id} passive`); continue; }
      assert.equal(brain.nextAttack, h.ai.firstAttack, `${def.id}: ${h.id} first attack`);
      assert.equal(brain.params.waveEvery, h.ai.attackEvery, `${def.id}: ${h.id} wave timing`);
      assert.equal(brain.params.buildSpeed, h.ai.buildSpeed);
      assert.equal(brain.difficulty, h.ai.difficulty);
      assert.ok(DIFFICULTY[brain.difficulty]);
    }
    for (const u of world.units.values()) {
      if (u.house === def.house || !u.isGround || !u.type.weapon || u.harvest) continue;
      assert.ok(u.order.type === 'guard' || u.order.type === 'idle', `${def.id}: ${u.house} ${u.typeId} ${u.order.type}`);
    }
  }
});

test('every real mission runs a game minute clean: invariants hold, the computers do not fight each other, the hunters go', () => {
  for (const def of missions()) {
    const { world } = setupMission(def);
    const side = new Set(computers(def));
    const friendlyFire = [];
    const prev = world.onDamaged;
    world.onDamaged = (victim, attacker) => {
      if (attacker && side.has(attacker.house) && side.has(victim.house) && attacker.house !== victim.house) friendlyFire.push(`${attacker.house} hit ${victim.house} ${victim.typeId}`);
      prev?.(victim, attacker);
    };
    const hunters = def.houses.flatMap((h) => h.units).filter((u) => u.order === 'hunt').length;
    for (let k = 1; k <= 60 * 20; k++) {
      world.step();
      if (k % 20 === 0) world.events.drain();
      if (k % 400 === 0) assert.deepEqual(checkInvariants(world), [], `${def.id} at ${world.time} s`);
      if (k === 40) assert.ok([...world.units.values()].filter((u) => side.has(u.house) && (u.order.type === 'attackMove' || u.order.type === 'attack')).length >= hunters, `${def.id}: the hunters set off`);
    }
    assert.deepEqual(friendlyFire, [], def.id);
    assert.equal(world.outcome, null, `${def.id}: nothing ends before the two minutes`);
    for (const h of def.houses) if (!h.ai.passive) assert.ok(world.houses.get(h.id).brain.commands > 0, `${def.id}: ${h.id} thinks`);
  }
});
