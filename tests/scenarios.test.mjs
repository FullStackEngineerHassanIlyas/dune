// The smoke scenarios (scripts/scenarios.mjs and the phase 3 streams' scripts/scenarios/*.mjs) name real scenes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS } from '../scripts/scenarios.mjs';
import { SCENES, BATTLES } from '../src/scenes/registry.js';

test('every smoke scenario names a registered scene', () => {
  for (const [name, { query }] of Object.entries(SCENARIOS)) {
    const scene = new URLSearchParams(query).get('scene') ?? (query ? 'skirmish' : 'menu');   // as src/main.js picks it
    assert.ok(scene in SCENES, `${name}: unknown scene "${scene}"`);
  }
});

test('every battle scene is registered', () => {
  for (const name of BATTLES) assert.ok(name in SCENES, name);
});
