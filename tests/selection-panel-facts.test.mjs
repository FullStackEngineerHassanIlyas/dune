// The selection panel's compact facts, taken from the build tooltips: a unit's or turret's weapon and what it is
// strong and weak against, an own factory's build speed; nothing for groups or enemy buildings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { Selection } from '../src/input/selection.js';
import { selectionPanelModel } from '../src/ui/selection-panel.js';
import { matchups } from '../src/data/effectiveness.js';
import { flatWorld, run } from './helpers.mjs';

const pick = (world, ids, structureId = null) => {
  const sel = new Selection();
  if (structureId) sel.setStructure(structureId); else sel.set(ids);
  return selectionPanelModel(world, sel, 'atreides');
};
const facts = (m) => m.facts.map((f) => `${f.label}: ${f.text}`);

test('a unit shows its weapon and what it beats and loses to — an enemy one too', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5);
  assert.deepEqual(facts(pick(world, [tank.id])), ['Cannon: 25 dmg · range 4 · reload 2.0 s', `Strong: ${matchups('combatTank').strong.join(', ')}`, `Weak: ${matchups('combatTank').weak.join(', ')}`]);
  const foe = world.spawnUnit('missileTank', 'harkonnen', 9, 9);
  assert.equal(pick(world, [foe.id]).facts[0].text, '75 dmg · range 9 · reload 3.0 s', 'what a unit type does is no secret');
  const harv = world.spawnUnit('harvester', 'atreides', 12, 5);
  assert.deepEqual(pick(world, [harv.id]).facts, [], 'unarmed');
  assert.deepEqual(pick(world, [tank.id, harv.id]).facts, [], 'a group keeps its list of types');
});

test('an own factory shows its build speed; a turret its gun; an enemy building nothing', () => {
  const world = flatWorld(32, 32, G.ROCK);
  world.spawnStructure('windtrap', 'atreides', 20, 20);
  const hf = world.spawnStructure('heavyFactory', 'atreides', 4, 4);
  run(world, 0.5);
  assert.deepEqual(facts(pick(world, [], hf.id)), ['Build speed: 100 % · another one adds 25 %']);
  world.spawnStructure('heavyFactory', 'atreides', 10, 4);
  run(world, 0.5);
  assert.deepEqual(facts(pick(world, [], hf.id)), ['Build speed: 125 % · 2 on this line'], 'the answer to "do more factories build faster?"');
  const gun = world.spawnStructure('turret', 'atreides', 4, 10);
  assert.equal(pick(world, [], gun.id).facts[0].text, '20 dmg · range 5 · reload 2.0 s');
  const theirs = world.spawnStructure('turret', 'harkonnen', 25, 25);
  assert.deepEqual(pick(world, [], theirs.id).facts, [], 'no intel on enemy buildings');
});
