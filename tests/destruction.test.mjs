import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { G } from '../src/data/terrain.js';
import { Heightfield } from '../src/render/heightfield.js';
import { Effects } from '../src/render/effects.js';
import { Debris } from '../src/render/debris.js';
import { Rubble } from '../src/render/rubble.js';
import { Wrecks, wreckDef } from '../src/render/wrecks.js';
import { Destruction } from '../src/render/destruction.js';
import * as burn from '../src/render/burn-fx.js';
import { modelDef } from '../src/render/models/index.js';
import { MAT } from '../src/render/models/kit.js';
import { UnitViews } from '../src/render/views/unit-views.js';
import { StructureViews } from '../src/render/views/structure-views.js';
import { flatWorld } from './helpers.mjs';

const pos = (m) => new THREE.Vector3().setFromMatrixPosition(m);
const scaleY = (m) => new THREE.Vector3().setFromMatrixScale(m).y;
const flat = { heightAt: () => 0, normalAt: (x, z, out = {}) => Object.assign(out, { x: 0, y: 1, z: 0 }) };
const steps = (seconds, fn, dt = 1 / 30) => { for (let t = 0; t < seconds; t += dt) fn(dt); };

function stage(quality = { particles: 4000, shadows: 0, flashLights: 0 }) {
  const world = flatWorld(24, 24, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const scene = new THREE.Scene();
  const effects = new Effects(scene, quality);
  const marks = [];
  const decals = { scorch: (x, y, r) => marks.push(['scorch', x, y, r]), crater: (x, y, r) => marks.push(['crater', x, y, r]), blob: (x, y, r) => marks.push(['blob', x, y, r]) };
  const d = new Destruction(scene, quality, { effects, hf, decals });
  return { world, hf, scene, effects, marks, d };
}

test('debris tumbles, bounces once, settles on the ground, then sinks away and frees its slot', () => {
  const debris = new Debris(new THREE.Scene(), { capacity: 8 });
  debris.emit({ x: 0, y: 0.5, z: 0, vx: 1, vy: 3, vz: 0, size: [0.1, 0.02, 0.08], rest: 1 });
  const bounces = [];
  let last = 0;
  steps(1.5, (dt) => { debris.update(dt, flat.heightAt); if (debris.state[0] !== last) bounces.push((last = debris.state[0])); });
  assert.deepEqual(bounces.slice(0, 2), [1, 2], 'one bounce, then at rest');
  assert.ok(debris.pos[0] > 0.5, 'thrown sideways');
  assert.ok(Math.abs(debris.pos[1]) < 0.05, 'lying on the ground');
  steps(2.5, (dt) => debris.update(dt, flat.heightAt));
  assert.equal(debris.n, 0, 'rest, then sink, then gone');
});

test('the debris pool never grows past its capacity', () => {
  const debris = new Debris(new THREE.Scene(), { capacity: 10 });
  let accepted = 0;
  for (let k = 0; k < 30; k++) accepted += debris.emit({ x: 0, y: 1, z: 0, vy: 2, size: [0.1, 0.1, 0.1] }) ? 1 : 0;
  assert.equal(accepted, 10);
  debris.update(0.016, flat.heightAt);
  assert.equal(debris.mesh.count, 10);
});

test('rubble covers the footprint, a new building clears it, and a full ring reuses the oldest pieces', () => {
  const rubble = new Rubble(new THREE.Scene(), { capacity: 64 });
  rubble.site(4, 4, 3, 3, () => 0);
  assert.ok(rubble.used >= 20, `pieces ${rubble.used}`);
  for (let i = 0; i < rubble.used; i++) {
    const x = rubble.at[i * 2], z = rubble.at[i * 2 + 1];
    assert.ok(x >= 3.7 && x <= 7.3 && z >= 3.7 && z <= 7.3, `inside the footprint: ${x}, ${z}`);
  }
  rubble.clear(4, 4, 3, 3);
  const m = new THREE.Matrix4();
  for (let i = 0; i < rubble.used; i++) { rubble.mesh.getMatrixAt(i, m); assert.equal(scaleY(m), 0); }
  for (let k = 0; k < 10; k++) rubble.site(10, 10, 3, 3, () => 0);
  assert.equal(rubble.used, 64);
  assert.equal(rubble.mesh.count, 64);
});

test('a wreck is the charred model: dark, untinted, no lights, no tread scroll, one part per node', () => {
  const live = modelDef('combatTank'), wreck = wreckDef('combatTank');
  assert.ok(wreck.parts.every((p) => p.material === MAT.DARK));
  assert.ok(wreck.parts.every((p) => !p.geometry.getAttribute('aTread')));
  assert.equal(wreck.parts.length, new Set(live.parts.map((p) => p.node)).size);
  const c = wreck.parts[0].geometry.getAttribute('color');
  let max = 0;
  for (let i = 0; i < c.count; i++) max = Math.max(max, c.getX(i), c.getY(i), c.getZ(i));
  assert.ok(max < 0.2, 'burnt black');
  assert.ok(wreck.height > 0.2 && wreck.height < 0.6, `height ${wreck.height}`);
});

test('a wreck lies sunk where the vehicle died, burns, then sinks away within its life', () => {
  const effects = new Effects(new THREE.Scene(), { particles: 2000, flashLights: 0 });
  const wrecks = new Wrecks(new THREE.Scene(), flat, { cap: 4 });
  const w = wrecks.add({ modelId: 'combatTank', x: 5, z: 6, heading: 1, life: 20, burn: 5 });
  wrecks.update(0.1, effects);
  const p = pos(w.h.matrix);
  assert.deepEqual([p.x, p.z], [5, 6]);
  assert.ok(p.y < 0 && p.y > -0.1, 'slightly sunk');
  steps(1, (dt) => wrecks.update(dt, effects));
  assert.ok(effects.glow.n > 0 && effects.smoke.n > 0, 'burning');
  steps(17.5, (dt) => wrecks.update(dt, effects));
  assert.ok(pos(w.h.matrix).y < -0.2, 'sinking into the sand');
  steps(2, (dt) => wrecks.update(dt, effects));
  assert.equal(wrecks.count, 0);
  assert.equal(wrecks.model('combatTank').count, 0);
});

test('past the cap the oldest wrecks start sinking early', () => {
  const wrecks = new Wrecks(new THREE.Scene(), flat, { cap: 2 });
  const first = wrecks.add({ modelId: 'trike', x: 1, z: 1, life: 30 });
  wrecks.add({ modelId: 'trike', x: 2, z: 1, life: 30 });
  wrecks.add({ modelId: 'quad', x: 3, z: 1, life: 30 });
  assert.ok(first.age >= first.life - 5, 'the first is on its way down');
  steps(5, (dt) => wrecks.update(dt, null));
  assert.equal(wrecks.count, 2);
});

test('a wreck that dies in the air falls, spinning, and crashes', () => {
  const wrecks = new Wrecks(new THREE.Scene(), flat);
  const crashed = [];
  const w = wrecks.add({ modelId: 'ornithopter', x: 5, z: 5, heading: 0, alt: 1.2, vx: 1, size: 1 });
  steps(2, (dt) => wrecks.update(dt, null, () => true, (x) => crashed.push(x)));
  assert.deepEqual(crashed, [w]);
  assert.ok(w.x > 5.3, 'drifted on');
  assert.equal(w.fall, null);
});

test('building wrecks leaves the live model and its tread animation alone', () => {
  const scene = new THREE.Scene();
  const world = flatWorld(16, 16, G.ROCK);
  const views = new UnitViews(scene, new Heightfield(world.map, { sub: 2, seed: 1 }));
  world.spawnUnit('combatTank', 'atreides', 3, 3);
  views.sync(world, 1, 0.016);
  const tread = modelDef('combatTank').parts.find((p) => p.material === MAT.TREAD).geometry.getAttribute('aTread');
  const wrecks = new Wrecks(scene, flat);
  for (let k = 0; k < 12; k++) wrecks.add({ modelId: 'combatTank', x: k, z: 1 });
  wrecks.update(0.1, null);
  assert.equal(modelDef('combatTank').parts.find((p) => p.material === MAT.TREAD).geometry.getAttribute('aTread'), tread);
});

test('a vehicle dies in a fireball, throws debris, leaves a wreck, and its ammunition cooks off after', () => {
  const { d, effects, marks } = stage();
  d.unitDestroyed({ id: 9, typeId: 'siegeTank', house: 'harkonnen', x: 8, y: 8, cause: 'destroyed' }, { x: 8.2, z: 8, heading: 0.5, turret: 1, alt: 0, visible: true, inside: false });
  assert.equal(d.wrecks.count, 1);
  assert.ok(d.debris.n >= 8, `debris ${d.debris.n}`);
  assert.ok(effects.glow.n > 10 && effects.smoke.n > 5);
  assert.equal(d.pending.length, 2, 'two secondary blasts for a heavy tank');
  assert.ok(marks.some(([k]) => k === 'crater'));
  steps(1, (dt) => d.update(dt));
  assert.equal(d.pending.length, 0);
});

test('light vehicles go up smaller than heavy ones; a Devastator that destructs leaves no wreck', () => {
  const a = stage(), b = stage();
  a.d.unitDestroyed({ typeId: 'trike', house: 'atreides', x: 5, y: 5 }, { x: 5, z: 5, heading: 0, visible: true });
  b.d.unitDestroyed({ typeId: 'harvester', house: 'atreides', x: 5, y: 5 }, { x: 5, z: 5, heading: 0, visible: true });
  assert.ok(a.d.debris.n < b.d.debris.n);
  assert.ok(a.effects.glow.n < b.effects.glow.n);
  assert.ok(a.d.wrecks.list[0].life < b.d.wrecks.list[0].life);
  const c = stage();
  c.d.unitDestroyed({ typeId: 'devastator', house: 'harkonnen', x: 5, y: 5, cause: 'destructed' }, { x: 5, z: 5, heading: 0, visible: true });
  assert.equal(c.d.wrecks.count, 0);
  assert.ok(c.d.debris.n > 10);
});

test('deaths out of sight, inside buildings or while catching up throw nothing', () => {
  const { d, effects } = stage();
  d.unitDestroyed({ typeId: 'combatTank', house: 'atreides', x: 5, y: 5 }, { x: 5, z: 5, visible: false });
  d.unitDestroyed({ typeId: 'combatTank', house: 'atreides', x: 5, y: 5 }, { x: 5, z: 5, visible: true, inside: true });
  d.unitDestroyed({ typeId: 'combatTank', house: 'atreides', x: 5, y: 5 }, { x: 5, z: 5, visible: true }, false);
  assert.equal(d.wrecks.count + d.debris.n + effects.glow.n + effects.smoke.n, 0);
});

test('crushed infantry leave a stain; shot infantry only a puff', () => {
  const { d, marks, effects } = stage();
  d.unitDestroyed({ typeId: 'soldier', house: 'atreides', x: 5, y: 5, cause: 'crushed' }, { x: 5, z: 5, visible: true });
  assert.deepEqual(marks.map(([k]) => k), ['blob']);
  d.unitDestroyed({ typeId: 'soldier', house: 'atreides', x: 6, y: 5, cause: 'destroyed' }, { x: 6, z: 5, visible: true });
  assert.equal(marks.length, 1);
  assert.ok(effects.smoke.n > 0);
  assert.equal(d.wrecks.count + d.debris.n, 0);
});

test('a destroyed building goes down in stages: blasts across the footprint, chunks, dust, then burning rubble', () => {
  const { d, effects, marks } = stage();
  d.structureDestroyed({ id: 3, typeId: 'heavyFactory', house: 'ordos', x: 6, y: 6, w: 3, h: 3 });
  assert.ok(d.pending.filter((b) => b.kind === 'blast').length >= 5);
  assert.ok(d.pending.some((b) => b.kind === 'dust'));
  for (const b of d.pending) if (b.kind === 'blast') assert.ok(b.x >= 6 && b.x <= 9 && b.z >= 6 && b.z <= 9);
  assert.ok(d.debris.n >= 20, `chunks ${d.debris.n}`);
  assert.ok(d.rubble.used >= 20);
  assert.ok(marks.filter(([k]) => k === 'scorch').length >= 9);
  assert.equal(d.sites.length, 1);
  const before = effects.smoke.n;
  steps(1.6, (dt) => { d.update(dt); effects.update(dt); });
  assert.equal(d.pending.length, 0, 'every stage has gone off within 1.6 s');
  assert.ok(effects.smoke.n > before / 2, 'dust and smoke hang over the ruin');
  steps(60, (dt) => d.update(dt), 0.25);
  assert.equal(d.sites.length, 0, 'the fires burn out');
  assert.ok(d.rubble.used >= 20, 'the rubble stays');
});

test('a building destroyed while catching up leaves rubble and scorch but no fireworks', () => {
  const { d, effects, marks } = stage();
  d.structureDestroyed({ id: 3, typeId: 'windtrap', house: 'ordos', x: 6, y: 6, w: 2, h: 2 }, false);
  assert.ok(d.rubble.used > 0 && marks.length > 0);
  assert.equal(d.pending.length + d.debris.n + d.sites.length + effects.glow.n + effects.smoke.n, 0);
});

test('a wall falls small: a few chunks and no lingering fire', () => {
  const { d } = stage();
  d.structureDestroyed({ id: 4, typeId: 'wall', house: 'ordos', x: 6, y: 6, w: 1, h: 1 });
  assert.ok(d.rubble.used <= 6);
  assert.equal(d.sites.length, 0);
  assert.equal(d.pending.filter((b) => b.kind === 'blast').length, 1);
});

test('placing a building on old ruins clears the rubble and wrecks and puts the fires out', () => {
  const { d } = stage();
  d.structureDestroyed({ id: 3, typeId: 'windtrap', house: 'ordos', x: 6, y: 6, w: 2, h: 2 });
  d.unitDestroyed({ typeId: 'quad', house: 'ordos', x: 7, y: 7 }, { x: 7, z: 7, heading: 0, visible: true });
  d.unitDestroyed({ typeId: 'quad', house: 'ordos', x: 12, y: 7 }, { x: 12, z: 7, heading: 0, visible: true });
  d.structurePlaced({ x: 6, y: 6, w: 2, h: 2 });
  assert.equal(d.sites.length, 0);
  assert.equal(d.wrecks.count, 1, 'only the wreck off the new footprint stays');
  const m = new THREE.Matrix4();
  for (let i = 0; i < d.rubble.used; i++) { d.rubble.mesh.getMatrixAt(i, m); assert.equal(scaleY(m), 0); }
});

test('damage states: smoke past half health, flames below a quarter, from fixed roof points', () => {
  const { d, world, effects } = stage();
  const tank = world.spawnUnit('combatTank', 'atreides', 5, 5);
  const yard = world.spawnStructure('constructionYard', 'atreides', 10, 10);
  const at = (u) => ({ x: u.x, z: u.y });
  steps(1, (dt) => d.wounded(world, dt, at));
  assert.equal(effects.glow.n + effects.smoke.n, 0, 'healthy: nothing');
  tank.hp = tank.maxHp * 0.4;
  steps(1, (dt) => d.wounded(world, dt, at));
  assert.ok(effects.smoke.n > 0 && effects.glow.n === 0, 'wounded: smoke only');
  tank.hp = tank.maxHp * 0.2;
  steps(1, (dt) => d.wounded(world, dt, at));
  assert.ok(effects.glow.n > 0, 'critical: on fire');
  yard.hp = yard.maxHp * 0.2;
  const a = d.roofPoints(yard);
  d.wounded(world, 0.2, at);
  assert.equal(d.roofPoints(yard), a, 'the same points every time');
  for (const p of a) assert.ok(p.x > 10 && p.x < 12 && p.z > 10 && p.z < 12 && p.y > 0.2);
});

test('lingering fire and smoke give way when the particle pools are nearly full', () => {
  const { d, effects } = stage({ particles: 800, shadows: 0, flashLights: 0 });
  d.structureDestroyed({ id: 3, typeId: 'windtrap', house: 'ordos', x: 6, y: 6, w: 2, h: 2 }, false);
  d.sites.push({ x: 6, y: 6, w: 2, h: 2, cx: 7, cz: 7, points: [{ x: 7, z: 7 }], age: 0, fireFor: 30, smokeFor: 60, clock: 0 });
  while (effects.smoke.n < effects.smoke.capacity * 0.7) effects.smokePuff(0, 0, 0);
  const smoke = effects.smoke.n, glow = effects.glow.n;
  steps(0.5, (dt) => d.update(dt));
  assert.equal(effects.smoke.n, smoke);
  assert.equal(effects.glow.n, glow);
  effects.smoke.n = 0;
  steps(0.5, (dt) => d.update(dt));
  assert.ok(effects.glow.n > glow, 'burning again once there is room');
});

test('dispose takes the debris, rubble and wrecks off the scene', () => {
  const { d, scene, effects } = stage();
  d.unitDestroyed({ typeId: 'combatTank', house: 'atreides', x: 5, y: 5 }, { x: 5, z: 5, visible: true });
  d.structureDestroyed({ id: 3, typeId: 'windtrap', house: 'ordos', x: 6, y: 6, w: 2, h: 2 });
  d.update(0.1);
  d.dispose();
  effects.dispose();
  assert.equal(scene.children.length, 0);
});

test('infantry fall where they die and are gone a few seconds later; vehicles leave their view at once', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const views = new UnitViews(new THREE.Scene(), new Heightfield(world.map, { sub: 2, seed: 1 }));
  const man = world.spawnUnit('soldier', 'atreides', 3, 3, { heading: 0 });
  const tank = world.spawnUnit('combatTank', 'atreides', 6, 6);
  views.sync(world, 1, 0.016);
  const up0 = new THREE.Vector3().setFromMatrixColumn(views.views.get(man.id).handles[0].matrix, 1);
  assert.ok(up0.y > 0.99);
  assert.ok(views.notifyDeath({ id: tank.id, cause: 'destroyed' }));
  const pose = views.notifyDeath({ id: man.id, cause: 'destroyed' });
  assert.deepEqual([pose.x, pose.z], [3.5, 3.5]);
  world.removeUnit(man);
  world.removeUnit(tank);
  views.sync(world, 1, 0.016);
  assert.equal(views.views.size, 0);
  assert.equal(views.model('combatTank').count, 0, 'the tank is replaced by its wreck elsewhere');
  assert.equal(views.fallen.length, 1);
  steps(0.8, (dt) => views.sync(world, 1, dt));
  const up = new THREE.Vector3().setFromMatrixColumn(views.fallen[0].h.matrix, 1).normalize();
  assert.ok(up.y < 0.2, 'lying down');
  steps(5, (dt) => views.sync(world, 1, dt));
  assert.equal(views.fallen.length, 0);
  assert.equal(views.model('soldier').count, 0);
});

test('crushed infantry lie flattened; a squad down to one man leaves two figures fallen', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const views = new UnitViews(new THREE.Scene(), new Heightfield(world.map, { sub: 2, seed: 1 }));
  const man = world.spawnUnit('soldier', 'atreides', 3, 3);
  const squad = world.spawnUnit('troopers', 'harkonnen', 8, 8);
  views.sync(world, 1, 0.016);
  squad.hp = squad.maxHp / 3;
  views.sync(world, 1, 0.016);
  assert.equal(views.fallen.length, 2);
  views.notifyDeath({ id: man.id, cause: 'crushed' });
  world.removeUnit(man);
  views.sync(world, 1, 0.016);
  const flatMan = views.fallen.find((f) => f.crushed);
  assert.ok(flatMan && scaleY(flatMan.h.matrix) < 0.2);
});

test('a destroyed building collapses over 1.9 s; a sold one still sinks in 0.7 s', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const views = new StructureViews(new THREE.Scene(), new Heightfield(world.map, { sub: 2, seed: 1 }));
  const trap = world.spawnStructure('windtrap', 'atreides', 4, 4);
  views.sync(world, 0);
  views.sync(world, 2000);
  views.notify({ type: 'structureDestroyed', id: trap.id }, 2000);
  world.removeStructure(trap, 'destroyed');
  views.sync(world, 2100);
  const v = views.views.get(trap.id);
  assert.ok(scaleY(v.handles[0].matrix) > 0.9, 'shuddering first');
  views.sync(world, 3300);
  const mid = scaleY(v.handles[0].matrix);
  assert.ok(mid < 0.8 && mid > 0.05, `slumping ${mid}`);
  const up = new THREE.Vector3().setFromMatrixColumn(v.handles[0].matrix, 1).normalize();
  assert.ok(up.y < 0.9995, 'leaning');
  views.sync(world, 3400);
  assert.ok(views.views.has(trap.id), 'still coming down after the 0.7 s a sale takes');
  views.sync(world, 4000);
  assert.equal(views.views.has(trap.id), false);
});

test('fire, smoke and blasts fill their particles from constant templates, allocating nothing per call', () => {
  const seen = new Set();
  const pool = { spawn: (t) => { seen.add(t); return 0; }, emit: () => assert.fail('a fresh object per particle') };
  const fx = { glow: pool, smoke: pool };
  const all = () => {
    burn.greySmoke(fx, 0, 0, 0, 1.2); burn.blackSmoke(fx, 0, 0, 0, 0.6); burn.fire(fx, 0, 0, 0, 0.8); burn.sparks(fx, 0, 0, 0, 4);
    burn.fireball(fx, 0, 0, 0, 1.3); burn.blast(fx, 0, 0, 0, 0.9); burn.spiceBurst(fx, 0, 0, 0); burn.collapseDust(fx, 0, 0, 0, 3, 3);
  };
  for (let k = 0; k < 20; k++) all();   // a flame's tip comes only now and then
  const templates = seen.size;
  for (let k = 0; k < 20; k++) all();
  assert.equal(seen.size, templates, 'the same few templates every time');
  const debris = new Debris(new THREE.Scene(), { capacity: 4 });
  debris.emit({ x: 0, y: 1, z: 0, vy: 3, size: [0.1, 0.1, 0.1], burn: 2 });
  for (let k = 0; k < 30; k++) debris.update(1 / 30, () => 0, fx);
  assert.ok(seen.size > templates && seen.size <= templates + 2, 'a burning piece trails from its own two');
});
