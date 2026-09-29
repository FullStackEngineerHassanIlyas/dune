import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { G } from '../src/data/terrain.js';
import { Heightfield } from '../src/render/heightfield.js';
import { PlacementGhost } from '../src/render/placement-ghost.js';
import { checkPlacement } from '../src/sim/placement.js';
import { flatWorld } from './helpers.mjs';

const colours = (ghost) => ghost.cells.map((c) => (c.material === ghost.cellMaterials.concrete ? 'g' : c.material === ghost.cellMaterials.bare ? 'y' : 'r')).join('');

test('the ghost shows green on own concrete, yellow on bare rock and red when it cannot go', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const ghost = new PlacementGhost(new THREE.Scene(), hf);
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  world.map.concrete[world.map.idx(6, 4)] = world.houses.get('atreides').slot + 1;
  ghost.show({ typeId: 'windtrap', x: 6, y: 4, check: checkPlacement(world, 'atreides', 'windtrap', 6, 4) });
  assert.equal(ghost.group.visible, true);
  assert.equal(colours(ghost), 'gyyy');
  assert.ok(ghost.body.children.length > 0, 'a translucent model');
  ghost.show({ typeId: 'windtrap', x: 12, y: 12, check: checkPlacement(world, 'atreides', 'windtrap', 12, 12) });
  assert.equal(colours(ghost), 'rrrr', 'away from the base');
  ghost.show({ typeId: 'concrete', x: 6, y: 5, check: checkPlacement(world, 'atreides', 'concrete', 6, 5) });
  assert.equal(colours(ghost), 'g', 'a slab that fits is green');
  assert.equal(ghost.body.children.length, 0, 'slabs have no model');
  ghost.show({ typeId: 'turret', x: 6, y: 6, check: checkPlacement(world, 'atreides', 'turret', 6, 6) });
  assert.ok(ghost.body.children.some((m) => m.position.y > 0.3), 'node parts sit at their pivots (the gun on top of the bunker)');
  ghost.show(null);
  assert.equal(ghost.group.visible, false);
});

test('next to the base only the blocked cells turn red', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const ghost = new PlacementGhost(new THREE.Scene(), hf);
  world.spawnStructure('constructionYard', 'atreides', 4, 4);
  world.spawnUnit('soldier', 'atreides', 7, 5);
  ghost.show({ typeId: 'windtrap', x: 6, y: 4, check: checkPlacement(world, 'atreides', 'windtrap', 6, 4) });
  assert.equal(colours(ghost), 'yyyr');
});
