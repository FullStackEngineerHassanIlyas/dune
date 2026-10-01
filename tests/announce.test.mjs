import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { alertUnitKilled, alertStructureKilled } from '../src/sim/announce.js';
import { flatWorld, run, runUntil } from './helpers.mjs';

function base() {
  const world = flatWorld(32, 32, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 5000;
  h.startBuffer = 100000;
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  world.spawnStructure('windtrap', 'atreides', 0, 0);
  return { world, h };
}
const said = (world) => world.events.drain().filter((e) => e.type === 'eva').map((e) => `${e.key}:${e.text}`);

test('the infantry line says Training; the other lines say Building', () => {
  const { world } = base();
  world.spawnStructure('barracks', 'atreides', 10, 10);
  world.spawnStructure('lightFactory', 'atreides', 14, 10);
  world.issue('atreides', { type: 'build', typeId: 'soldier' });
  world.step();
  assert.deepEqual(said(world), ['training:Training.']);
  world.issue('atreides', { type: 'build', typeId: 'trike' });
  world.step();
  assert.deepEqual(said(world), ['building:Building.']);
});

test('resuming a held soldier trains again; resuming a held structure builds again', () => {
  const { world } = base();
  world.spawnStructure('barracks', 'atreides', 10, 10);
  world.issue('atreides', { type: 'build', typeId: 'soldier' });
  world.issue('atreides', { type: 'hold', typeId: 'soldier' });
  world.step();
  assert.deepEqual(said(world), ['training:Training.', 'onHold:Production on hold.']);
  world.issue('atreides', { type: 'build', typeId: 'soldier' });
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  world.issue('atreides', { type: 'hold', typeId: 'windtrap' });
  world.issue('atreides', { type: 'build', typeId: 'windtrap' });
  world.step();
  assert.deepEqual(said(world), ['training:Training.', 'building:Building.', 'onHold:Production on hold.', 'building:Building.']);
});

test('resuming a held upgrade says Upgrading, on the infantry line too', () => {
  const { world } = base();
  world.spawnStructure('outpost', 'atreides', 14, 4);
  world.spawnStructure('barracks', 'atreides', 10, 10);
  world.issue('atreides', { type: 'build', typeId: 'upgrade:barracks' });
  world.issue('atreides', { type: 'hold', typeId: 'upgrade:barracks' });
  world.issue('atreides', { type: 'build', typeId: 'upgrade:barracks' });
  world.step();
  assert.deepEqual(said(world), ['upgrading:Upgrading.', 'onHold:Production on hold.', 'upgrading:Upgrading.']);
});

test('a finished unit is ready; a finished harvester is deployed', () => {
  const { world } = base();
  world.spawnStructure('lightFactory', 'atreides', 10, 10);
  world.spawnStructure('heavyFactory', 'atreides', 14, 10);
  world.issue('atreides', { type: 'build', typeId: 'trike' });
  assert.ok(runUntil(world, () => [...world.units.values()].some((u) => u.typeId === 'trike'), 40) >= 0);
  assert.ok(said(world).includes('unitReady:Unit ready.'));
  world.issue('atreides', { type: 'build', typeId: 'harvester' });
  assert.ok(runUntil(world, () => [...world.units.values()].some((u) => u.typeId === 'harvester'), 120) >= 0);
  const lines = said(world);
  assert.ok(lines.includes('harvesterDeployed:Harvester deployed.'), lines.join(', '));
  assert.ok(!lines.some((l) => l.startsWith('unitReady')));
});

test('a kill names the house that lost it, for the voice to say', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const mine = world.spawnUnit('combatTank', 'atreides', 5, 5);
  const theirs = world.spawnUnit('trike', 'harkonnen', 7, 5);
  alertUnitKilled(world, theirs, mine);
  const e = world.events.drain().find((x) => x.type === 'eva' && x.key === 'enemyUnitDestroyed');
  assert.equal(e.house, 'atreides');
  assert.equal(e.foe, 'harkonnen');
  assert.equal(e.text, 'Harkonnen unit destroyed.');
  const s = world.spawnStructure('silo', 'ordos', 12, 12);
  alertStructureKilled(world, s, mine);
  const f = world.events.drain().find((x) => x.type === 'eva' && x.key === 'enemyStructureDestroyed');
  assert.equal(f.foe, 'ordos');
});

test('an idle run of the production line says nothing', () => {
  const { world } = base();
  run(world, 2);
  assert.deepEqual(said(world), []);
});
