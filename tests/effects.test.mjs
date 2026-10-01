import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ParticlePool, Effects } from '../src/render/effects.js';

test('particles move, age and die; a pool never grows past its capacity', () => {
  const pool = new ParticlePool(new THREE.Scene(), 16, { additive: true });
  let accepted = 0;
  for (let k = 0; k < 20; k++) accepted += pool.emit({ x: 0, y: 0, z: 0, vx: 2, life: k < 10 ? 0.1 : 1, size: [1, 1], color: [1, 1, 1], alpha: [1, 0] }) ? 1 : 0;
  assert.equal(accepted, 16);
  pool.update(0.05);
  assert.equal(pool.mesh.count, 16);
  assert.ok(pool.pos[0] > 0.05, 'moved');
  pool.update(0.1);
  assert.equal(pool.n, 6, 'the ten short-lived ones are gone');
});

test('bigger explosions throw more particles, never beyond the budget', () => {
  const fx = new Effects(new THREE.Scene(), { particles: 400, flashLights: 0 });
  fx.explosion(0, 0, 0, 'small');
  const small = fx.glow.n + fx.smoke.n;
  fx.explosion(0, 0, 0, 'large');
  assert.ok(fx.glow.n + fx.smoke.n - small > small);
  for (let k = 0; k < 100; k++) fx.explosion(0, 0, 0, 'large');
  assert.ok(fx.glow.n <= fx.glow.capacity && fx.smoke.n <= fx.smoke.capacity);
  assert.ok(fx.glow.capacity + fx.smoke.capacity <= 400);
});

test('muzzle flashes borrow a fixed set of point lights that fade out', () => {
  const scene = new THREE.Scene();
  const fx = new Effects(scene, { particles: 400, flashLights: 2 });
  const count = () => scene.children.filter((o) => o.isPointLight).length;
  assert.equal(count(), 2);
  for (let k = 0; k < 5; k++) fx.muzzle(k, 0.3, 0, true);
  assert.equal(count(), 2);
  assert.ok(fx.lights.some((l) => l.light.intensity > 0));
  fx.update(0.2);
  assert.ok(fx.lights.every((l) => l.light.intensity === 0));
});

test('short-lived flashes are drawn at least once even at low frame rates', () => {
  const pool = new ParticlePool(new THREE.Scene(), 16, { additive: true });
  pool.emit({ x: 0, y: 0, z: 0, life: 0.04, size: [1, 1], color: [1, 1, 1], alpha: [1, 0] });
  pool.update(1 / 15);
  assert.equal(pool.mesh.count, 1, 'drawn in the frame it was born');
  pool.update(1 / 15);
  assert.equal(pool.n, 0);
});

test('dust is sand-coloured smoke that rises and fades', () => {
  const fx = new Effects(new THREE.Scene(), { particles: 400, flashLights: 0 });
  fx.dust(1, 0, 2, 1);
  assert.equal(fx.smoke.n, 1);
  assert.equal(fx.glow.n, 0);
  const y0 = fx.smoke.pos[1];
  fx.update(0.5);
  assert.ok(fx.smoke.pos[1] > y0, 'rises');
  fx.update(2);
  assert.equal(fx.smoke.n, 0, 'fades away');
});

test('empty pools do not re-upload their buffers', () => {
  const pool = new ParticlePool(new THREE.Scene(), 16, { additive: true });
  pool.update(0.1);
  const v = pool.alphaAttr.version;
  pool.update(0.1);
  pool.update(0.1);
  assert.equal(pool.alphaAttr.version, v);
});

test('welding throws a few short-lived sparks and no smoke', () => {
  const fx = new Effects(new THREE.Scene(), { particles: 400, flashLights: 0 });
  fx.weld(0, 0.4, 0);
  assert.ok(fx.glow.n >= 2 && fx.smoke.n === 0);
  fx.update(0.4);   // every particle shows for at least one frame …
  fx.update(0.016);
  assert.equal(fx.glow.n, 0, '… and is gone within a moment');
});

test('the sonic wave, Deviator gas and the Death Hand each have their own look, within the budget', () => {
  const fx = new Effects(new THREE.Scene(), { particles: 400, flashLights: 0 });
  const count = () => fx.glow.n + fx.smoke.n;
  const looks = { sonic: () => fx.sonic(0, 0, 0, 0), gasTrail: () => fx.trail('gas', 0, 0, 0), gasCloud: () => fx.impact(0, 0, 0, 'gas', false), deathHand: () => fx.trail('deathHand', 0, 0, 0), shockwave: () => fx.shockwave(0, 0, 0), rise: () => fx.rise(0, 0, 0) };
  for (const [name, make] of Object.entries(looks)) {
    const before = count();
    make();
    assert.ok(count() > before, name);
  }
  assert.ok(fx.glow.n <= fx.glow.capacity && fx.smoke.n <= fx.smoke.capacity);
});

test('dispose takes the particle meshes and flash lights off the scene', () => {
  const scene = new THREE.Scene();
  const fx = new Effects(scene, { particles: 400, flashLights: 2 });
  fx.explosion(0, 0, 0, 'large');
  assert.ok(scene.children.length >= 4);
  const freed = [];
  const spies = [fx.glow.mesh.geometry, fx.glow.mesh.material, fx.smoke.mesh.geometry, fx.smoke.mesh.material];
  for (const o of spies) o.addEventListener('dispose', () => freed.push(o));
  fx.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(new Set(freed).size, 4, 'each pool frees its own geometry and material');
  assert.doesNotThrow(() => fx.dispose(), 'disposing twice is harmless');
});

test('tracers and shell streaks stretch back along their flight', () => {
  const fx = new Effects(new THREE.Scene(), { particles: 400, flashLights: 0 });
  fx.tracer(0, 0.3, 0, 15, 0, 0, 'mg');
  fx.tracer(0, 0.3, 1, 0, 0, 15, 'cannon', 'shell');
  fx.update(0.01);
  const m = fx.glow.mesh.instanceMatrix.array;
  assert.equal(fx.glow.n, 2);
  assert.ok(m[4] < -0.3 && Math.abs(m[6]) < 1e-6, 'the bullet streak trails behind it along x');
  assert.ok(m[16 + 6] < -0.3 && Math.abs(m[16 + 4]) < 1e-6, 'the shell streak trails behind it along z');
  assert.ok(fx.glow.size[2] > fx.glow.size[0], 'a shell streak is thicker than a bullet tracer');
});

test('round sprites carry no streak; smoke drifts on the wind and curls', () => {
  const fx = new Effects(new THREE.Scene(), { particles: 400, flashLights: 0 });
  fx.smokePuff(0, 0, 0);
  fx.update(0.01);
  assert.deepEqual([...fx.smoke.mesh.instanceMatrix.array.slice(4, 7)], [0, 0, 0]);
  const x0 = fx.smoke.pos[0], z0 = fx.smoke.pos[2];
  for (let k = 0; k < 60; k++) fx.update(1 / 60);
  assert.ok(Math.hypot(fx.smoke.pos[0] - x0, fx.smoke.pos[2] - z0) > 0.02, 'it has drifted sideways');
  assert.ok(fx.smoke.pos[1] > 0.2, 'and still rises');
});

test('a rocket trail lays its smoke evenly, the same at any frame rate', () => {
  const lay = (steps) => {
    const fx = new Effects(new THREE.Scene(), { particles: 4000, flashLights: 0 });
    let from = 0;
    for (let k = 1; k <= steps; k++) {
      const to = (6 * k) / steps;
      from += fx.rocketTrail('rocket', from, 0.5, 0, to, 0.5, 0, 1, 0, 0, 12.5);
    }
    return fx.smoke.n;
  };
  const fast = lay(30), slow = lay(8);
  assert.ok(fast >= 50, `a dense trail over six tiles (${fast})`);
  assert.ok(Math.abs(fast - slow) <= 2, `${fast} puffs at 60 fps, ${slow} at 16`);
});

test('a rocket launch throws its backblast out behind the launcher', () => {
  const fx = new Effects(new THREE.Scene(), { particles: 4000, flashLights: 0 });
  fx.launch(0, 0.4, 0, 0, 0, 'sand');
  assert.ok(fx.smoke.n >= 6 && fx.glow.n >= 2);
  let behind = 0;
  for (let i = 0; i < fx.smoke.n; i++) if (fx.smoke.vel[i * 3] < 0) behind++;
  assert.ok(behind / fx.smoke.n > 0.8, 'the smoke goes backward');
  const air = new Effects(new THREE.Scene(), { particles: 4000, flashLights: 0 });
  air.launch(0, 2, 0, 0, 0, null);
  assert.ok(air.smoke.n < fx.smoke.n, 'fired from the air it kicks up no dust');
});

test('impacts differ by what they strike: sparks off metal, dirt off the ground, a blast for a rocket', () => {
  const make = () => new Effects(new THREE.Scene(), { particles: 4000, flashLights: 0 });
  const metal = make(), sand = make(), rock = make(), rocket = make(), mini = make();
  metal.impact(0, 0, 0, 'bullet', true, 'mg', 'sand');
  sand.impact(0, 0, 0, 'bullet', false, 'mg', 'sand');
  rock.impact(0, 0, 0, 'bullet', false, 'mg', 'rock');
  rocket.impact(0, 0, 0, 'rocket', false, 'rocket', 'sand');
  mini.impact(0, 0, 0, 'rocket', false, 'miniRocket', 'sand');
  assert.ok(metal.glow.n >= 2 && metal.smoke.n === 0, 'metal: sparks only');
  assert.ok(sand.smoke.n >= 2, 'sand: a spray of dirt');
  assert.ok(rock.glow.n > sand.glow.n, 'rock: chips spark too');
  assert.ok(rocket.smoke.n > mini.smoke.n && rocket.glow.n > mini.glow.n, 'a full rocket bursts bigger than a mini-rocket');
});

test('Low throws fewer particles than High for the same explosion', () => {
  const low = new Effects(new THREE.Scene(), { particles: 1500, flashLights: 0 });
  const high = new Effects(new THREE.Scene(), { particles: 8000, flashLights: 0 });
  low.explosion(0, 0, 0, 'large');
  high.explosion(0, 0, 0, 'large');
  assert.ok(low.glow.n + low.smoke.n < (high.glow.n + high.smoke.n) / 2);
});
