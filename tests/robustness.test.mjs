import test from 'node:test';
import assert from 'node:assert/strict';
import { guardFrame } from '../src/core/guard.js';
import { checkInvariants } from '../src/sim/invariants.js';
import { createGradePass } from '../src/render/grade-pass.js';
import { G } from '../src/data/terrain.js';
import { flatWorld } from './helpers.mjs';

test('guardFrame reports the first exception once and stops', () => {
  const errors = [];
  let calls = 0;
  const frame = guardFrame(() => { calls++; if (calls === 2) throw new Error('boom'); }, (e) => errors.push(e.message));
  assert.equal(frame(), true);
  assert.equal(frame(), false);
  assert.equal(frame(), false);
  assert.deepEqual(errors, ['boom']);
  assert.equal(calls, 2);
});

test('invariants hold for a healthy world and catch corruption', () => {
  const world = flatWorld(16, 16, G.ROCK);
  world.spawnUnit('combatTank', 'atreides', 3, 3);
  const cy = world.spawnStructure('constructionYard', 'atreides', 8, 8);
  assert.deepEqual(checkInvariants(world), []);
  world.map.unit[world.map.idx(12, 12)] = 999;
  world.map.structure[world.map.idx(cy.x, cy.y)] = 0;
  const problems = checkInvariants(world);
  assert.ok(problems.some((p) => p.includes('missing unit 999')));
  assert.ok(problems.some((p) => p.includes(`structure ${cy.id} lost tile`)));
});

test('grade pass carries tint, saturation and vignette uniforms', () => {
  const pass = createGradePass();
  assert.equal(pass.uniforms.uVignette.value, 0.32);
  assert.ok(pass.material.fragmentShader.includes('smoothstep'));
});
