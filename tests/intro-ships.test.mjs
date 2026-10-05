// The three house ships of the opening: their flights (src/game/intro-timeline.js) and their model
// (src/render/models/units/house-ship.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { INTRO_MARKS, SHIPS, SHIP_HOUSES, SHIP_TIME, shipAt, shipPose } from '../src/game/intro-timeline.js';
import { planetFraming } from '../src/render/planet.js';
import { modelDef } from '../src/render/models/index.js';
import { MAT } from '../src/render/models/kit.js';
import { HOUSES } from '../src/data/houses.js';

const ASPECTS = [16 / 9, 4 / 3, 21 / 9, 9 / 16];
const T = Math.tan((19 * Math.PI) / 180);

/** NDC of a world point seen from the framing camera (on +z at the framing distance, looking at the centre, lens-shifted). */
function ndc(p, aspect) {
  const f = planetFraming(aspect), depth = f.distance - p[2];
  return { x: p[0] / (depth * T * aspect) + f.shiftX, y: p[1] / (depth * T) + f.shiftY, depth };
}

const pose = (i, t, aspect) => shipPose(i, t, { aspect, framing: planetFraming(aspect) });

test('the ships come one by one, blue, red and green, 1.5 s apart, never two at once', () => {
  assert.deepEqual(SHIP_HOUSES, ['atreides', 'harkonnen', 'ordos']);
  assert.deepEqual(SHIPS.map((s) => s.house), SHIP_HOUSES);
  const [a, b, c] = INTRO_MARKS.ships;
  assert.ok(Math.abs(b - a - 1.5) < 1e-9 && Math.abs(c - b - 1.5) < 1e-9);
  assert.ok(SHIP_TIME < 1.5 && SHIP_TIME >= 1.3);
  for (let t = 15; t < 26; t += 0.01) {
    const flying = [0, 1, 2].filter((i) => shipAt(i, t) !== null);
    assert.ok(flying.length <= 1, `${flying.length} ships at ${t}`);
    if (flying.length) assert.ok(t >= INTRO_MARKS.ships[flying[0]] && t < INTRO_MARKS.ships[flying[0]] + SHIP_TIME);
  }
  assert.equal(pose(0, INTRO_MARKS.ships[0] - 0.01, 16 / 9).visible, false);
  assert.equal(pose(0, INTRO_MARKS.ships[0], 16 / 9).visible, true);
  assert.equal(pose(2, INTRO_MARKS.ships[2] + SHIP_TIME, 16 / 9).visible, false);
  // house colours: blue, red and green lamps
  const hue = (id) => new THREE.Color(HOUSES[id].color).getHSL({}).h * 360;
  assert.ok(hue('atreides') > 200 && hue('atreides') < 240);
  assert.ok(hue('harkonnen') < 15 || hue('harkonnen') > 345);
  assert.ok(hue('ordos') > 100 && hue('ordos') < 150);
});

test('each ship enters past a screen edge, close in front of the camera, and recedes all the way, shrinking', () => {
  for (const aspect of ASPECTS) {
    for (let i = 0; i < 3; i++) {
      const first = pose(i, INTRO_MARKS.ships[i], aspect), at = ndc(first.position, aspect);
      assert.ok(Math.abs(at.x) > 1 || Math.abs(at.y) > 1, `ship ${i} at ${aspect}: enters inside the frame (${at.x}, ${at.y})`);
      assert.ok(at.depth < 1.2, `ship ${i}: enters far away`);
      let depth = 0, size = Infinity, onScreen = false;
      for (let u = 0; u < 1; u += 0.02) {
        const p = pose(i, INTRO_MARKS.ships[i] + u * SHIP_TIME, aspect), n = ndc(p.position, aspect);
        assert.ok(n.depth > depth, `ship ${i} comes nearer at u ${u}`);
        assert.ok(p.scale / n.depth < size, `ship ${i} grows on screen at u ${u}`);
        assert.ok(p.forward[2] < 0, 'it flies away from the camera, its lamps towards us');
        assert.ok(Math.abs(Math.hypot(...p.up) - 1) < 1e-9 && Math.abs(p.up[0] * p.forward[0] + p.up[1] * p.forward[1] + p.up[2] * p.forward[2]) < 1e-9);
        if (Math.abs(n.x) < 0.9 && Math.abs(n.y) < 0.9) onScreen = true;
        depth = n.depth;
        size = p.scale / n.depth;
      }
      assert.ok(onScreen, `ship ${i} at ${aspect} is never well in view`);
    }
  }
});

test('each ship lands inside the planet disc, about 0.6 of the radius out, and is gone', () => {
  for (const aspect of ASPECTS) {
    const f = planetFraming(aspect);
    for (let i = 0; i < 3; i++) {
      const end = pose(i, INTRO_MARKS.ships[i] + SHIP_TIME - 1e-6, aspect);
      const p = new THREE.Vector3(...end.position);
      assert.ok(Math.abs(p.length() - 1) < 1e-3, `ship ${i} ends on the surface (${p.length()})`);
      assert.ok(p.z > 0, 'on the face towards the camera');
      const out = Math.hypot(p.x, p.y);
      assert.ok(out > 0.5 && out < 0.75, `ship ${i} lands ${out} radii out`);
      assert.ok(end.scale < 1e-5, 'shrunk to nothing');
      const at = ndc(end.position, aspect), centre = ndc([0, 0, 0], aspect);
      const radius = 1 / Math.sqrt(f.distance ** 2 - 1) / T;   // the disc's radius in NDC y
      assert.ok(Math.hypot((at.x - centre.x) * aspect, at.y - centre.y) < radius, `ship ${i} lands outside the disc at ${aspect}`);
    }
  }
  // the landing spots as the Sega release has them: Atreides upper right, Harkonnen upper left, Ordos on the night side (right)
  const land = (i) => pose(i, INTRO_MARKS.ships[i] + SHIP_TIME - 1e-6, 16 / 9).position;
  assert.ok(land(0)[0] > 0 && land(0)[1] > 0);
  assert.ok(land(1)[0] < 0 && land(1)[1] > 0);
  assert.ok(land(2)[0] > 0 && land(2)[1] < 0);
});

test('the flights are smooth: no jump in position from one frame to the next', () => {
  for (let i = 0; i < 3; i++) {
    let last = null;
    for (let t = INTRO_MARKS.ships[i]; t < INTRO_MARKS.ships[i] + SHIP_TIME; t += 1 / 120) {
      const p = new THREE.Vector3(...pose(i, t, 16 / 9).position);
      if (last) assert.ok(p.distanceTo(last) < 0.06, `ship ${i} jumps at ${t}`);
      last = p;
    }
  }
});

test('the ship model builds: grey hull, house-coloured lamps on its stern facing back, house edges on its blades', () => {
  const def = modelDef('houseShip');
  assert.equal(def.name, 'houseShip');
  assert.ok(def.radius > 0.4 && def.radius < 1);
  const mats = new Set(def.parts.map((p) => p.material));
  for (const m of mats) assert.ok(Object.values(MAT).includes(m), m);
  for (const m of [MAT.PAINT, MAT.HOUSE, MAT.HOUSE_LIGHT, MAT.LIGHT, MAT.DARK]) assert.ok(mats.has(m), `no ${m} part`);
  const lamps = def.parts.find((p) => p.material === MAT.HOUSE_LIGHT).geometry;
  lamps.computeBoundingBox();
  assert.ok(lamps.boundingBox.max.x < -0.3, 'the lamps sit on the stern');
  assert.ok(lamps.boundingBox.min.z < -0.1 && lamps.boundingBox.max.z > 0.1, 'two lamps, left and right');
  const all = new THREE.Box3();
  for (const p of def.parts) { p.geometry.computeBoundingBox(); all.union(p.geometry.boundingBox); }
  const size = all.getSize(new THREE.Vector3());
  assert.ok(size.z > 0.9 && size.z < 1.1, `about 1 wide across the blades (${size.z})`);
  assert.ok(size.y < size.x * 0.5, 'a flat saucer');
  const tris = def.parts.reduce((n, p) => n + p.geometry.attributes.position.count / 3, 0);
  assert.ok(tris < 6000, `${tris} triangles`);
});

test('each ship sweeps past as it enters and meets the atmosphere as it sinks, once, in arrival order', async () => {
  const { SHIP_SOUNDS, shipSoundsBetween, INTRO_MARKS, SHIP_TIME } = await import('../src/game/intro-timeline.js');
  const { RECIPES } = await import('../src/audio/synth.js');
  assert.equal(SHIP_SOUNDS.length, 6);
  for (const s of SHIP_SOUNDS) assert.ok(RECIPES[s.id], `${s.id} is a synthesized sound`);
  assert.deepEqual(SHIP_SOUNDS.filter((s) => s.id === 'shipPass').map((s) => s.at), [...INTRO_MARKS.ships]);
  for (const s of SHIP_SOUNDS.filter((c) => c.id === 'shipEntry')) assert.ok(s.at < INTRO_MARKS.ships[2] + SHIP_TIME + 0.01);
  let heard = [];
  for (let t = 0; t < 30; t += 1 / 60) heard.push(...shipSoundsBetween(t, t + 1 / 60));
  assert.equal(heard.length, 6, 'every cue once over a frame-by-frame run');
  assert.deepEqual(shipSoundsBetween(25, 10), [], 'a jump back plays nothing');
  assert.deepEqual(shipSoundsBetween(19, 19), [], 'a still frame plays nothing');
  assert.ok(SHIP_SOUNDS.every((s) => Math.abs(s.pan) <= 0.6));
});
