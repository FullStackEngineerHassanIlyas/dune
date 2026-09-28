import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS } from '../src/data/units.js';
import { STRUCTURES } from '../src/data/structures.js';
import { MAT } from '../src/render/models/kit.js';
import { modelDef, unitModelId, structureModelId } from '../src/render/models/index.js';

const MATS = new Set(Object.values(MAT));

test('every unit type resolves to a model that builds', () => {
  for (const typeId of Object.keys(UNITS)) {
    const def = modelDef(unitModelId(typeId));
    assert.ok(def.parts.length >= 1, typeId);
    assert.ok(def.radius > 0, `${typeId} radius`);
    for (const p of def.parts) assert.ok(MATS.has(p.material), `${typeId} material ${p.material}`);
  }
});

test('ground combat models expose the nodes the views drive', () => {
  for (const id of ['combatTank', 'siegeTank', 'missileTank', 'deviator']) assert.ok(modelDef(id).nodes.turret, `${id} turret`);
  for (const id of ['combatTank', 'siegeTank']) assert.ok(modelDef(id).nodes.barrel, `${id} barrel`);
  assert.ok(modelDef('harvester').nodes.drum);
  assert.ok(modelDef('soldier').nodes.legL && modelDef('trooper').nodes.legR);
  assert.ok(Object.values(modelDef('quad').nodes).some((n) => n.param === 'wheel'));
  assert.ok(modelDef('constructionYard').nodes.crane);
});

test('every structure resolves to a model (placeholders until plan 1b)', () => {
  for (const [id, s] of Object.entries(STRUCTURES)) {
    const def = modelDef(structureModelId(id, s.w, s.h));
    assert.ok(def.parts.length >= 1, id);
  }
});

test('model sizes stay inside their footprint', () => {
  for (const id of ['combatTank', 'siegeTank', 'missileTank', 'harvester', 'mcv', 'trike', 'quad', 'devastator']) {
    for (const p of modelDef(id).parts) {
      if (p.node !== 'root') continue;
      p.geometry.computeBoundingBox();
      const b = p.geometry.boundingBox;
      assert.ok(b.max.x - b.min.x <= 1.1 && b.max.z - b.min.z <= 0.8, `${id} fits about one tile`);
      assert.ok(b.min.y >= -0.01, `${id} does not sink below the ground`);
    }
  }
});
