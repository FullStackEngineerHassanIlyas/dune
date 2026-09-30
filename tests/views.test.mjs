import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { G } from '../src/data/terrain.js';
import { Heightfield } from '../src/render/heightfield.js';
import { UnitViews } from '../src/render/views/unit-views.js';
import { StructureViews } from '../src/render/views/structure-views.js';
import { flatWorld } from './helpers.mjs';

const pos = (m) => new THREE.Vector3().setFromMatrixPosition(m);

test('unit views follow the simulation: create, pose, hide squad members, remove', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new UnitViews(new THREE.Scene(), hf);
  const tank = world.spawnUnit('combatTank', 'atreides', 3, 3, { heading: 0 });
  const squad = world.spawnUnit('troopers', 'harkonnen', 6, 6);
  views.sync(world, 1, 0.016);
  const p = pos(views.views.get(tank.id).handles[0].matrix);
  assert.deepEqual([+p.x.toFixed(2), +p.z.toFixed(2)], [3.5, 3.5]);
  assert.ok(Math.abs(p.y - hf.heightAt(3.5, 3.5)) < 0.01);
  assert.equal(views.views.get(squad.id).handles.length, 3);
  squad.hp = 40;
  views.sync(world, 1, 0.016);
  assert.deepEqual(views.views.get(squad.id).handles.map((h) => h.visible), [true, false, false]);
  world.removeUnit(tank);
  views.sync(world, 1, 0.016);
  assert.equal(views.views.has(tank.id), false);
  assert.equal(views.model('combatTank').count, 0);
});

test('interpolation and the turret sign convention', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new UnitViews(new THREE.Scene(), hf);
  const tank = world.spawnUnit('combatTank', 'atreides', 3, 3, { heading: 0 });
  tank.px = 3.5; tank.x = 4.5;              // moved one tile east during the last tick
  tank.turret = tank.pturret = Math.PI / 2; // turret faces south, hull faces east
  views.sync(world, 0.5, 0.016);
  assert.ok(Math.abs(views.renderPos(tank).x - 4.0) < 1e-9);
  assert.ok(Math.abs(views.views.get(tank.id).handles[0].params.turret + Math.PI / 2) < 1e-9);
});

test('house changes recolour the view', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const views = new UnitViews(new THREE.Scene(), new Heightfield(world.map, { sub: 2, seed: 1 }));
  const tank = world.spawnUnit('combatTank', 'atreides', 3, 3);
  views.sync(world, 1, 0.016);
  tank.house = 'ordos';
  views.sync(world, 1, 0.016);
  assert.equal(views.views.get(tank.id).handles[0].color.getHex(), new THREE.Color(0x2e9e3e).getHex());
});

test('structure views sit on the footprint centre and rise over 0.9 s', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new StructureViews(new THREE.Scene(), hf);
  const cy = world.spawnStructure('constructionYard', 'ordos', 4, 6);
  views.sync(world, 1000);
  const v = views.views.get(cy.id);
  const p = pos(v.handles[0].matrix);
  assert.deepEqual([p.x, p.z], [5, 7]);
  const s0 = new THREE.Vector3().setFromMatrixScale(v.handles[0].matrix).y;
  views.sync(world, 1450);
  const s1 = new THREE.Vector3().setFromMatrixScale(v.handles[0].matrix).y;
  views.sync(world, 2000);
  const s2 = new THREE.Vector3().setFromMatrixScale(v.handles[0].matrix).y;
  assert.ok(s0 < s1 && s1 < s2 && Math.abs(s2 - 1) < 1e-9);
  world.removeStructure(cy);
  views.sync(world, 2100);
  views.sync(world, 2900);   // after the 0.7 s sink-away
  assert.equal(views.views.size, 0);
});

test('vehicles never tilt more than 25 degrees, even beside cliffs', () => {
  const world = flatWorld(24, 16, G.ROCK);
  for (let y = 4; y < 12; y++) for (let x = 12; x < 16; x++) world.map.ground[world.map.idx(x, y)] = G.MOUNTAIN;
  const hf = new Heightfield(world.map, { sub: 4, seed: 3 });
  let spot = null;
  for (let x = 10; x < 12.5 && !spot; x += 0.05) if (hf.normalAt(x, 8.5).y < Math.cos(THREE.MathUtils.degToRad(32))) spot = x;
  assert.ok(spot, 'precondition: a steep slope beside the mountains');
  const views = new UnitViews(new THREE.Scene(), hf);
  const tank = world.spawnUnit('combatTank', 'atreides', 11, 8, { heading: 0 });
  tank.x = tank.px = spot;
  views.sync(world, 1, 0.016);
  const up = new THREE.Vector3().setFromMatrixColumn(views.views.get(tank.id).handles[0].matrix, 1).normalize();
  assert.ok(THREE.MathUtils.radToDeg(up.angleTo(new THREE.Vector3(0, 1, 0))) <= 25.5, `tilt ${THREE.MathUtils.radToDeg(up.angleTo(new THREE.Vector3(0, 1, 0)))}`);
});

test('enemy units and structures stay hidden outside the viewer\'s sight', () => {
  const world = flatWorld(40, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const units = new UnitViews(new THREE.Scene(), hf, { viewer: 'atreides' });
  const structures = new StructureViews(new THREE.Scene(), hf, { viewer: 'atreides' });
  world.spawnUnit('combatTank', 'atreides', 3, 8);
  const enemy = world.spawnUnit('quad', 'harkonnen', 30, 8);
  const yard = world.spawnStructure('constructionYard', 'harkonnen', 32, 4);
  world.step();
  units.sync(world, 1, 0.016);
  structures.sync(world, 1000);
  assert.equal(units.views.get(enemy.id).handles[0].visible, false);
  assert.equal(structures.views.get(yard.id).handles[0].visible, false);
  world.spawnUnit('trike', 'atreides', 29, 6);
  for (let i = 0; i < 5; i++) world.step();   // fog refreshes every five ticks
  units.sync(world, 1, 0.016);
  structures.sync(world, 1100);
  assert.equal(units.views.get(enemy.id).handles[0].visible, true);
  assert.equal(structures.views.get(yard.id).handles[0].visible, true);
});

test('wall arms reach only towards walled neighbours', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new StructureViews(new THREE.Scene(), hf, { viewer: 'atreides' });
  const a = world.spawnStructure('wall', 'atreides', 5, 5);
  world.spawnStructure('wall', 'atreides', 6, 5);
  world.spawnStructure('wall', 'atreides', 5, 6);
  world.step();
  views.sync(world, 1000);
  const [, e, s, w, n] = views.views.get(a.id).handles;   // post, then arms E, S, W, N
  assert.deepEqual([e.visible, s.visible, w.visible, n.visible], [true, true, false, false]);
});

test('a sold structure sinks away over 0.7 s and is then removed', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new StructureViews(new THREE.Scene(), hf, { viewer: 'atreides' });
  const trap = world.spawnStructure('windtrap', 'atreides', 4, 4);
  views.sync(world, 0);
  views.sync(world, 2000);
  world.removeStructure(trap, 'sold');
  views.sync(world, 2300);   // the view notices the removal and starts sinking
  views.sync(world, 2650);
  const v = views.views.get(trap.id);
  assert.ok(v, 'still sinking');
  const sy = new THREE.Vector3().setFromMatrixScale(v.handles[0].matrix).y;
  assert.ok(sy < 0.6 && sy > 0.4, `scale ${sy}`);
  views.sync(world, 3100);
  assert.equal(views.views.has(trap.id), false);
});

test('the heavy factory door opens when a vehicle is built there, and turrets rest facing north', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new StructureViews(new THREE.Scene(), hf, { viewer: 'atreides' });
  const hf1 = world.spawnStructure('heavyFactory', 'atreides', 4, 4);
  const gun = world.spawnStructure('turret', 'atreides', 10, 10);
  views.sync(world, 5000);
  assert.equal(views.views.get(hf1.id).handles[0].params.door, 0);
  assert.ok(Math.abs(views.views.get(gun.id).handles[0].params.turret - Math.PI / 2) < 1e-9);
  views.notify({ type: 'unitBuilt', structureId: hf1.id }, 5000);
  views.sync(world, 5600);
  assert.ok(views.views.get(hf1.id).handles[0].params.door > 0.3);
  views.sync(world, 8000);
  assert.equal(views.views.get(hf1.id).handles[0].params.door, 0);
});

import { runUntil } from './helpers.mjs';

test('a vehicle in the repair bay stands on the pad while the hoist works and welds', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 1000;
  h.startBuffer = 5000;
  world.spawnStructure('windtrap', 'atreides', 1, 1);
  const bay = world.spawnStructure('repair', 'atreides', 8, 8);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const units = new UnitViews(new THREE.Scene(), hf);
  const structures = new StructureViews(new THREE.Scene(), hf);
  const t = world.spawnUnit('combatTank', 'atreides', 9, 12);
  t.hp = 100;
  structures.sync(world, 0);
  assert.equal(structures.weldPoint(bay.id, 0), null, 'nothing to weld');
  world.issue('atreides', { type: 'repairAt', ids: [t.id], structureId: bay.id });
  assert.ok(runUntil(world, () => bay.bay?.state === 'repairing', 20) > 0);
  structures.sync(world, 5000);
  units.sync(world, 1, 0.016);
  const p = pos(units.views.get(t.id).handles[0].matrix);
  assert.deepEqual([+p.x.toFixed(2), +p.z.toFixed(2)], [9.5, 9]);
  assert.ok(p.y > hf.heightAt(9.5, 9) + 0.05, 'on the pad plate');
  const w = structures.weldPoint(bay.id, 5000);
  assert.ok(w && Math.abs(w.x - 9.5) < 1e-9 && w.y > hf.heightAt(9.5, 9) + 0.3);
  assert.notEqual(structures.views.get(bay.id).handles[0].params.arm, 0);
});

test('aircraft fly at their height and bank into turns; a load hangs under its Carryall', () => {
  const world = flatWorld(24, 24, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new UnitViews(new THREE.Scene(), hf);
  const o = world.spawnUnit('ornithopter', 'atreides', 6, 6, { heading: 0 });
  const c = world.spawnUnit('carryall', 'atreides', 12, 12);
  const h = world.spawnUnit('harvester', 'atreides', 12, 12, { inside: c.id });
  c.cargo = h.id;
  h.alt = c.alt - 0.35;
  o.pheading = -0.1;   // turning right this tick
  views.sync(world, 1, 0.016);
  const po = pos(views.views.get(o.id).handles[0].matrix);
  assert.ok(Math.abs(po.y - hf.heightAt(6.5, 6.5) - o.alt) < 0.01, 'at its flying height');
  const up = new THREE.Vector3().setFromMatrixColumn(views.views.get(o.id).handles[0].matrix, 1);
  assert.ok(up.z > 0.05, 'banked into the turn');
  const ph = pos(views.views.get(h.id).handles[0].matrix), pc = pos(views.views.get(c.id).handles[0].matrix);
  assert.ok(pc.y - ph.y > 0.3 && Math.abs(pc.x - ph.x) < 1e-6, 'hanging under it');
  assert.notEqual(views.views.get(o.id).handles[0].params.flap, undefined);
  assert.equal(views.views.get(c.id).handles[0].params.claws, 0, 'claws closed on the load');
});

test('the Starport\'s pad lights pulse while its Frigate is due', () => {
  const world = flatWorld(40, 30, G.ROCK);
  const h = world.houses.get('atreides');
  h.credits = 5000;
  h.startBuffer = 100000;
  world.spawnStructure('windtrap', 'atreides', 1, 1);
  const s = world.spawnStructure('starport', 'atreides', 10, 10);
  world.step();
  const views = new StructureViews(new THREE.Scene(), new Heightfield(world.map, { sub: 2, seed: 1 }));
  views.sync(world, 1000);
  assert.equal(views.views.get(s.id).handles[0].params.padLights, 1);
  world.issue('atreides', { type: 'starportOrder', typeId: 'quad' });
  world.step();
  views.sync(world, 1100);
  assert.notEqual(views.views.get(s.id).handles[0].params.padLights, 1);
});

import { HOUSES } from '../src/data/houses.js';

test('Fremen wear their sand colour whoever calls them; a Devastator counting down glows', () => {
  const world = flatWorld(16, 16, G.ROCK);
  const views = new UnitViews(new THREE.Scene(), new Heightfield(world.map, { sub: 2, seed: 1 }));
  const f = world.spawnUnit('fremen', 'atreides', 3, 3);
  const d = world.spawnUnit('devastator', 'harkonnen', 8, 8);
  views.sync(world, 1, 0.016);
  assert.equal(views.views.get(f.id).handles[0].color.getHex(), new THREE.Color(HOUSES.fremen.color).getHex());
  assert.equal(views.views.get(d.id).handles[0].params.warn, 0);
  world.issue('harkonnen', { type: 'destruct', ids: [d.id] });
  world.step();
  views.sync(world, 1, 0.016);
  assert.ok(views.views.get(d.id).handles[0].params.warn > 0);
});

test('a Saboteur crossing a wall walks on top of it', () => {
  const world = flatWorld(12, 6, G.ROCK);
  world.spawnStructure('wall', 'harkonnen', 5, 2);
  const sab = world.spawnUnit('saboteur', 'ordos', 3, 2);
  world.issue('ordos', { type: 'move', ids: [sab.id], x: 5, y: 2 });
  assert.ok(runUntil(world, () => sab.tx === 5 && !sab.step, 15) > 0);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const views = new UnitViews(new THREE.Scene(), hf);
  views.sync(world, 1, 0.016);
  const y = pos(views.views.get(sab.id).handles[0].matrix).y;
  assert.ok(Math.abs(y - (hf.heightAt(5.5, 2.5) + 0.364)) < 0.01, `y ${y}`);
});

import { MissileViews, arcHeight } from '../src/render/views/missile-views.js';

test('the Death Hand flies as a missile high over its path and is gone when it lands', () => {
  assert.equal(arcHeight('bullet', 0.5, 10), 0);
  assert.ok(arcHeight('rocket', 0.5, 10) > 0 && arcHeight('rocket', 0.5, 10) <= 1.2);
  assert.ok(arcHeight('deathHand', 0.5, 30) >= 10 && arcHeight('deathHand', 0, 30) === 0);
  const views = new MissileViews(new THREE.Scene());
  const world = { projectiles: new Map([[1, { id: 1, projectile: 'deathHand', house: 'harkonnen', x: 10, y: 5, px: 10, py: 5, sx: 5, sy: 5, tx: 15, ty: 5 }]]) };
  views.sync(world, 1, () => 0);
  assert.ok(pos(views.handles.get(1).matrix).y > 3, 'high over the midpoint');
  world.projectiles.delete(1);
  views.sync(world, 1, () => 0);
  assert.equal(views.handles.size, 0);
  assert.equal(views.model.count, 0);
});

test('rockets fly as a rocket body, nose along their path, mini-rockets smaller; bullets have none', () => {
  const views = new MissileViews(new THREE.Scene());
  const shot = (id, projectile, weapon, x) => [id, { id, projectile, weapon, house: 'harkonnen', x, y: 5, px: x - 0.5, py: 5, sx: 2, sy: 5, tx: 10, ty: 5, speed: 12.5 }];
  const world = { projectiles: new Map([shot(1, 'rocket', 'rocket', 3), shot(2, 'rocket', 'miniRocket', 3), shot(3, 'bullet', 'mg', 3)]) };
  views.sync(world, 1, () => 0);
  assert.equal(views.handles.size, 2, 'the bullet has no body');
  assert.equal(views.rockets.count, 2);
  const axis = (m) => new THREE.Vector3().setFromMatrixColumn(m, 0);
  const nose = axis(views.handles.get(1).matrix);
  assert.ok(nose.x > 0.8 && nose.y > 0.05, `early in its flight it climbs toward the target (${nose.toArray().map((v) => v.toFixed(2))})`);
  assert.ok(axis(views.handles.get(2).matrix).length() < nose.length() * 0.8, 'a mini-rocket is smaller');
  world.projectiles.get(1).x = world.projectiles.get(1).px = 9.5;
  views.sync(world, 1, () => 0);
  assert.ok(axis(views.handles.get(1).matrix).y < -0.05, 'late in its flight it dives');
  world.projectiles.clear();
  views.sync(world, 1, () => 0);
  assert.equal(views.rockets.count, 0);
  views.dispose();
});

import { shotPoint } from '../src/render/views/missile-views.js';

test('a shot leaves its gun above the ground and comes down just above its target', () => {
  const p = { projectile: 'rocket', x: 2, y: 5, px: 2, py: 5, sx: 2, sy: 5, tx: 10, ty: 5, speed: 12.5 };
  const out = {};
  shotPoint(p, 0, () => 1, out);
  assert.ok(Math.abs(out.y - 1.35) < 1e-6 && out.dx > 0 && out.dy > 0, 'from the gun, climbing');
  Object.assign(p, { x: 10, px: 10 });
  shotPoint(p, 0, () => 1, out);
  assert.ok(Math.abs(out.y - 1.2) < 1e-6 && out.dy < 0, 'onto the target, falling');
  assert.ok(Math.abs(Math.hypot(out.dx, out.dy, out.dz) - 1) < 1e-9 && out.speed > 12.5);
});

import { Effects } from '../src/render/effects.js';
import { ShotFx } from '../src/render/shot-fx.js';

test('shots in flight leave tracers, and rockets a smoke trail from the launcher that ends when they land', () => {
  const fx = new Effects(new THREE.Scene(), { particles: 4000, flashLights: 0 });
  const trails = new ShotFx(fx);
  const rocket = { id: 1, projectile: 'rocket', weapon: 'rocket', x: 2, y: 5, px: 2, py: 5, sx: 2, sy: 5, tx: 10, ty: 5, speed: 12.5 };
  const bullet = { id: 2, projectile: 'bullet', weapon: 'mg', x: 3, y: 8, px: 2.5, py: 8, sx: 2, sy: 8, tx: 6, ty: 8, speed: 15 };
  const world = { projectiles: new Map([[1, rocket], [2, bullet]]) };
  let unseen = true;
  trails.update(world, 1, () => 0, () => !unseen);
  assert.equal(fx.glow.n + fx.smoke.n, 0, 'nothing where the viewer cannot see');
  unseen = false;
  for (let k = 1; k <= 20; k++) {   // a second of flight, the rocket two tiles along
    rocket.px = rocket.x;
    rocket.x = 2 + (k / 20) * 2;
    trails.update(world, 1, () => 0, () => true);
  }
  assert.ok(fx.smoke.n >= 15, `smoke laid along two tiles (${fx.smoke.n})`);
  let nearLauncher = 0;
  for (let i = 0; i < fx.smoke.n; i++) if (fx.smoke.pos[i * 3] < 2.5) nearLauncher++;
  assert.ok(nearLauncher >= 2, 'the trail reaches back to the launcher');
  assert.ok(fx.glow.n >= 20, 'a flare and a tracer every frame');
  world.projectiles.clear();
  trails.update(world, 1, () => 0, () => true);
  assert.equal(trails.trails.size, 0, 'a landed rocket\'s trail record goes back to the pool');
  assert.equal(trails.spare.length, 1);
});

test('dispose takes every unit, structure and missile mesh off the scene', () => {
  const world = flatWorld(32, 32, G.ROCK);
  const hf = new Heightfield(world.map, { sub: 2, seed: 1 });
  const scene = new THREE.Scene();
  const units = new UnitViews(scene, hf), structures = new StructureViews(scene, hf), missiles = new MissileViews(scene);
  world.spawnUnit('combatTank', 'atreides', 3, 3);
  world.spawnUnit('troopers', 'harkonnen', 8, 8);
  const palace = world.spawnStructure('palace', 'harkonnen', 20, 20);
  palace.readyAt = 0;
  world.issue('harkonnen', { type: 'palace', x: 4, y: 4 });
  world.step();
  units.sync(world, 1, 0.016);
  structures.sync(world, 0);
  missiles.sync(world, 1, () => 0);
  assert.ok(missiles.model, 'the Death Hand is in flight');
  assert.ok(scene.children.length > 0);
  const meshes = [...units.models.values(), ...structures.models.values(), missiles.model].flatMap((m) => m.meshes);
  const shared = new Set(meshes.flatMap((m) => [m.material, m.geometry]));   // shared with the next battle: must stay alive
  const freedMeshes = new Set(), freedShared = new Set();
  for (const m of meshes) m.addEventListener('dispose', () => freedMeshes.add(m));
  for (const o of shared) o.addEventListener('dispose', () => freedShared.add(o));
  units.dispose();
  structures.dispose();
  missiles.dispose();
  assert.equal(scene.children.length, 0);
  assert.ok(meshes.length > 0);
  assert.equal(freedMeshes.size, meshes.length, 'every instanced mesh is freed');
  assert.equal(freedShared.size, 0, 'the shared geometry and materials are spared');
});
