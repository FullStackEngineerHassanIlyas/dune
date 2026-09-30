import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlanetShot, planetFraming, diveRate, menuShare, SEAM_ALTITUDE } from '../src/render/planet.js';
import { FOG_COLOR } from '../src/render/renderer.js';

const WIDE = [['16:9', 16 / 9], ['4:3', 4 / 3]];

/** Camera position, forward and the planet's altitude after an update at this dive (no time passes). */
function pose(p, dive, aspect = 16 / 9) {
  p.update(0, { dive, aspect });
  const forward = new THREE.Vector3();
  p.camera.getWorldDirection(forward);
  return { position: p.camera.position.clone(), forward, altitude: p.altitude };
}

/** The landing site: at the seam the camera sits straight above it, looking straight down. */
function site(p, aspect = 16 / 9) {
  return pose(p, 1, aspect).forward.negate();
}

/** The light, in world space, from the planet shader's view-space uniform. */
function light(p) {
  return p.surface.material.uniforms.uLight.value.clone().transformDirection(p.camera.matrixWorld);
}

/** Widest angle between the camera's forward and its frustum's corner rays (the lens shift makes it lopsided). */
function viewCone(camera, forward) {
  let widest = 0;
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const corner = new THREE.Vector3(x, y, 0.5).unproject(camera).sub(camera.position);
    widest = Math.max(widest, corner.angleTo(forward));
  }
  return widest;
}

/** Does the planet (unit sphere at the origin) hide the point `to` from `from`? */
function hidden(from, to) {
  const d = to.clone().sub(from), len = d.length();
  d.divideScalar(len);
  const b = from.dot(d), c = from.lengthSq() - 1, disc = b * b - c;
  if (disc <= 0) return false;
  const t = -b - Math.sqrt(disc);
  return t > 0 && t < len;
}

test('the planet sits right of centre on wide screens and in the middle on tall ones', () => {
  const wide = planetFraming(16 / 9), tall = planetFraming(9 / 16);
  assert.ok(wide.offsetX > 0.5);
  assert.equal(tall.offsetX, 0);
  assert.ok(wide.distance > 2 && tall.distance > wide.distance);
});

/** The rim's outline on screen (NDC) after an update: { minX, maxX, minY, maxY }. */
function rimExtent(p) {
  const cam = p.camera, centre = new THREE.Vector3(), rim = p.atmosphere.geometry.parameters.radius;
  const axis = centre.clone().sub(cam.position).normalize();
  const cone = Math.asin(rim / cam.position.distanceTo(centre));   // the rim's outline as seen from the camera
  const side = new THREE.Vector3(0, 1, 0).cross(axis).normalize(), up = axis.clone().cross(side);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    const dir = axis.clone().multiplyScalar(Math.cos(cone))
      .addScaledVector(side, Math.sin(cone) * Math.cos(a)).addScaledVector(up, Math.sin(cone) * Math.sin(a));
    const ndc = cam.position.clone().addScaledVector(dir, 5).project(cam);
    minX = Math.min(minX, ndc.x); maxX = Math.max(maxX, ndc.x); minY = Math.min(minY, ndc.y); maxY = Math.max(maxY, ndc.y);
  }
  return { minX, maxX, minY, maxY };
}

test('framing: the whole planet and its rim stay in the frame, round, a little in from the right edge and clear of the menu', () => {
  for (const [name, aspect] of WIDE) {
    const p = new PlanetShot({ seed: 1 });
    p.update(0, { aspect });
    const { minX, maxX, minY, maxY } = rimExtent(p);
    assert.ok(maxX < 0.99 && maxX > 0.85, `${name}: a small margin at the right edge (rim reaches ${maxX.toFixed(3)})`);
    assert.ok(minY > -1 && maxY < 1, `${name}: top and bottom inside (${minY.toFixed(3)}..${maxY.toFixed(3)})`);
    const menu = 2 * (0.07 + 380 / (aspect * 900)) - 1;   // the menu column's right edge (7vw + 380px) at 900px tall
    assert.ok(minX > menu, `${name}: clear of the menu (rim from ${minX.toFixed(3)}, menu to ${menu.toFixed(3)})`);
    assert.ok(maxY - minY > 1.2, `${name}: fills most of the height (${((maxY - minY) / 2).toFixed(2)})`);
    const round = ((maxX - minX) * aspect) / (maxY - minY);
    assert.ok(Math.abs(round - 1) < 0.005, `${name}: a round disc, not an ellipse (${round.toFixed(4)})`);
    p.dispose();
  }
});

test('framing keeps clear of the menu column at its real width, whatever the window\'s height', () => {
  // the column is 7vw + 380px: on a short window its fixed 380px take a bigger share of the width
  for (const [w, h] of [[1024, 768], [1280, 720], [1366, 768], [1600, 900], [1920, 1080], [1280, 1024]]) {
    const p = new PlanetShot({ seed: 1 });
    p.update(0, { aspect: w / h, menu: menuShare(w) });
    const { minX, maxX, minY, maxY } = rimExtent(p);
    assert.ok(minX > 2 * menuShare(w) - 1, `${w}×${h}: rim from ${minX.toFixed(3)}, menu to ${(2 * menuShare(w) - 1).toFixed(3)}`);
    assert.ok(maxX < 0.99 && minY > -1 && maxY < 1, `${w}×${h}: inside the frame`);
    assert.ok(Math.abs(p.diveRate() - Math.log(p.altitude / SEAM_ALTITUDE)) < 1e-9, `${w}×${h}: the seam rate follows the framing`);
    p.dispose();
  }
  assert.equal(menuShare(1600), 0.07 + 380 / 1600);
});

test('the landing site lies on the lit part of the visible disc, off centre', () => {
  const p = new PlanetShot({ seed: 1 });
  const s = site(p);
  p.update(0, { dive: 0 });
  const toCamera = p.camera.position.clone().sub(s).normalize();
  assert.ok(s.dot(toCamera) > 0.5, 'facing the framing camera');
  assert.ok(s.dot(light(p)) > 0.3, 'in sunlight');
  const disc = new THREE.Vector3().project(p.camera), at = s.clone().project(p.camera);
  const rimNdc = 1 / Math.sqrt(p.camera.position.lengthSq() - 1) / Math.tan((p.camera.fov * Math.PI) / 360);
  assert.ok(Math.hypot((at.x - disc.x) * (16 / 9), at.y - disc.y) > 0.2 * rimNdc, 'not the disc centre');
  p.dispose();
});

// design change (revision 2): the dive used to stop 1.3 radii out on the centre line; it now flies all the way down to
// the landing site, where the battle takes over
test('the dive ends straight above the landing site at SEAM_ALTITUDE, looking straight down', () => {
  const p = new PlanetShot({ seed: 1 });
  const far = pose(p, 0), seam = pose(p, 1);
  const s = seam.forward.clone().negate();
  assert.ok(Math.abs(s.length() - 1) < 1e-9);
  assert.ok(seam.position.distanceTo(s.clone().multiplyScalar(1 + SEAM_ALTITUDE)) < 1e-9, 'straight above the site');
  assert.ok(Math.abs(seam.altitude - SEAM_ALTITUDE) < 1e-9);
  assert.ok(SEAM_ALTITUDE >= 0.003 && SEAM_ALTITUDE <= 0.006);
  assert.ok(far.altitude > 2 && far.position.length() > 3, 'the framing shot is far out');
  assert.ok(p.camera.near < SEAM_ALTITUDE, 'the ground under the seam is not clipped');
  p.dispose();
});

test('the dive path is continuous: smooth position and view, altitude always falling, the log-zoom rate it promises', () => {
  const p = new PlanetShot({ seed: 1 });
  const framing = planetFraming(16 / 9);
  const start = pose(p, 0);
  assert.ok(start.position.distanceTo(new THREE.Vector3(0, 0, framing.distance)) < 1e-12, 'dive 0 is the framing shot');
  assert.ok(start.forward.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-12);
  const step = 1 / 4000;
  let prev = start, prevMove = null, prevTurn = null;
  for (let i = 1; i <= 4000; i++) {
    const cur = pose(p, i * step), at = `k=${(i * step).toFixed(4)}`;
    const move = cur.position.clone().sub(prev.position), turn = cur.forward.clone().sub(prev.forward);
    assert.ok(move.length() < 12 * step, `${at}: position jumps ${move.length()}`);
    assert.ok(cur.forward.angleTo(prev.forward) < 3 * step, `${at}: view turns ${cur.forward.angleTo(prev.forward)}`);
    // no kinks either: the velocity of the camera (relative to its height) and of its view change gently
    if (prevMove) assert.ok(move.clone().sub(prevMove).length() < 0.05 * step * cur.altitude, `${at}: a kink in the path`);
    if (prevTurn) assert.ok(turn.clone().sub(prevTurn).length() < 0.05 * step, `${at}: a kink in the turn`);
    assert.ok(cur.altitude < prev.altitude, `${at}: altitude must keep falling`);
    prev = cur;
    prevMove = move;
    prevTurn = turn;
  }
  assert.ok(pose(p, step).position.distanceTo(start.position) < 1e-4, 'it eases out of the framing shot');
  assert.ok(Math.abs(pose(p, 1).altitude - SEAM_ALTITUDE) < 1e-9);
  const h = 1e-5, rate = -(Math.log(pose(p, 1).altitude) - Math.log(pose(p, 1 - h).altitude)) / h;
  assert.ok(Math.abs(rate - p.diveRate()) < 1e-3 * p.diveRate(), `closing log-rate ${rate} vs diveRate() ${p.diveRate()}`);
  assert.equal(p.diveRate(), diveRate(16 / 9));
  assert.ok(diveRate(4 / 3) > 0 && diveRate(9 / 16) > diveRate(16 / 9), 'per framing: farther out, a faster seam');
  p.dispose();
});

test('the view has turned to look straight down by 60 % of the dive, with a level horizon', () => {
  const p = new PlanetShot({ seed: 1 });
  const down = site(p).negate();
  assert.ok(pose(p, 0.6).forward.angleTo(down) < 1e-6);
  for (let k = 0; k <= 1; k += 0.01) {
    pose(p, k);
    const right = new THREE.Vector3(1, 0, 0).transformDirection(p.camera.matrixWorld);
    assert.ok(Math.abs(right.y) < 1e-9, `k=${k.toFixed(2)}: no roll (the camera's x axis stays level)`);
  }
  p.dispose();
});

test('the spin eases to a stop as the dive starts, so the ground never slides under the camera', () => {
  const p = new PlanetShot({ seed: 1 });
  const turn = (dive, dt = 1) => { const a = p.spin.rotation.y; p.update(dt, { dive }); return p.spin.rotation.y - a; };
  const free = turn(0), early = turn(0.2);
  assert.ok(free > 0 && early > 0 && early < free);
  assert.equal(turn(0.35), 0);
  assert.equal(turn(0.8), 0);
  assert.equal(turn(1), 0);
  assert.ok(Math.abs(turn(0) - free) < 1e-12, 'and turns again once the emerge is back out');
  p.dispose();
});

test('the haze rises to the battlefield fog colour and space fades out as the planet fills the view', () => {
  const p = new PlanetShot({ seed: 1 });
  const u = p.surface.material.uniforms;
  assert.ok(u.uFog.value.equals(new THREE.Color(FOG_COLOR)), 'the renderer fog colour, converted to linear the same way');
  pose(p, 0);
  assert.equal(u.uHaze.value, 0);
  assert.ok(p.atmosphere.visible && p.moon.visible && p.stars.visible);
  let last = 0;
  for (let k = 0; k <= 1.0001; k += 0.02) {
    pose(p, k);
    assert.ok(u.uHaze.value >= last - 1e-12, 'the haze only thickens on the way down');
    last = u.uHaze.value;
    if (p.altitude >= 0.3) assert.equal(u.uHaze.value, 0);
  }
  pose(p, 1);
  assert.ok(Math.abs(u.uHaze.value - 0.97) < 1e-9);
  assert.ok(!p.atmosphere.visible && !p.moon.visible && !p.stars.visible && !p.nebula.visible, 'the seam is ground and haze only');
  p.dispose();
});

test('the moon crosses the lit face in the planet phase, calmly, with its shadow on the planet most of the time', () => {
  const p = new PlanetShot({ seed: 1 });
  const radius = p.moon.geometry.parameters.radius;
  let over = 0, shadowed = 0, samples = 0, first = null, last = null;
  for (let t = 0; t <= 10.0001; t += 0.5) {
    p.startPass(t);
    p.update(0, { dive: 0 });
    const cam = p.camera.position, m = p.moon.position, sun = light(p);
    const ndc = m.clone().project(p.camera), disc = new THREE.Vector3().project(p.camera);
    const discR = 1 / Math.sqrt(cam.lengthSq() - 1) / Math.tan((p.camera.fov * Math.PI) / 360);
    const rel = new THREE.Vector2(((ndc.x - disc.x) * (16 / 9)) / discR, (ndc.y - disc.y) / discR);
    if (rel.length() < 1 && !hidden(cam, m)) over++;
    // where the shadow of the moon's centre falls: back from the moon, away from the sun, onto the planet
    const b = m.dot(sun), disc2 = b * b - m.lengthSq() + 1;
    if (disc2 > 0 && b > 0) {
      const spot = m.clone().addScaledVector(sun, -(b - Math.sqrt(disc2)));
      if (spot.dot(cam.clone().sub(spot)) > 0 && spot.dot(sun) > 0.05) shadowed++;
    }
    first ??= rel;
    last = rel;
    samples++;
    assert.ok(m.length() > 1 + radius * 2, 'the moon stays well clear of the ground');
  }
  assert.ok(over / samples > 0.7, `over the planet's face ${over}/${samples}`);
  assert.ok(shadowed / samples > 0.7, `shadow on the visible lit face ${shadowed}/${samples}`);
  const travel = first.distanceTo(last) / 2;   // as a share of the planet's width
  assert.ok(travel > 0.22 && travel < 0.38, `a quarter to a third of the width, not ${travel.toFixed(3)}`);
  p.dispose();
});

test('the moon keeps out of the dive and the emerge: never before the site, out of view once the camera is close', () => {
  const margin = (2 * Math.PI) / 180;
  const windows = [
    ['dive', (k) => 10 + 4 * k],    // moon time 10..14 while the dive runs 0..1
    ['emerge', (k) => -3.5 * k],    // -3.5..0 while the emerge runs the dive back from 1 to 0
  ];
  for (const [shape, aspect] of [...WIDE, ['21:9', 21 / 9], ['9:16', 9 / 16]]) {
    const p = new PlanetShot({ seed: 1 });
    const s = site(p, aspect), radius = p.moon.geometry.parameters.radius;
    for (const [name, moonTime] of windows) {
      for (let k = 0; k <= 1.0001; k += 0.005) {
        p.startPass(moonTime(k));
        const { position: cam, forward, altitude } = pose(p, k, aspect);
        const m = p.moon.position, at = `${shape} ${name} k=${k.toFixed(3)}`;
        if (hidden(cam, m)) continue;   // behind the planet
        const toMoon = m.clone().sub(cam), size = Math.asin(Math.min(1, radius / toMoon.length()));
        const toSite = s.clone().sub(cam);
        if (toMoon.length() < toSite.length()) {
          assert.ok(toMoon.angleTo(toSite) > size + margin, `${at}: the moon is between the camera and the site`);
        }
        if (altitude < 1) {   // within a planet radius of the site: the moon's disc, grown by the margin, is off the picture
          const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(p.camera.projectionMatrix, p.camera.matrixWorldInverse));
          const grown = radius + toMoon.length() * Math.tan(margin);
          assert.ok(frustum.planes.slice(0, 4).some((plane) => plane.distanceToPoint(m) < -grown), `${at}: the moon is in view near the site`);
        }
        if (altitude < 0.5) {   // closer still: outside even the cone round the frustum's corners
          assert.ok(toMoon.angleTo(forward) > viewCone(p.camera, forward) + size + margin, `${at}: the moon is inside the view cone`);
        }
      }
    }
    p.dispose();
  }
});

test('the moon shadow uniform follows the moon, in view space', () => {
  const p = new PlanetShot({ seed: 1 });
  for (const [t, dive] of [[3, 0], [7, 0], [12, 0.5]]) {
    p.startPass(t);
    p.update(0, { dive });
    const u = p.surface.material.uniforms.uMoon.value;
    const expected = p.moon.position.clone().applyMatrix4(p.camera.matrixWorldInverse);
    assert.ok(new THREE.Vector3(u.x, u.y, u.z).distanceTo(expected) < 1e-9, `moon time ${t}`);
    assert.equal(u.w, p.moon.geometry.parameters.radius);
  }
  p.dispose();
});

test('moon time: startPass sets it, update advances it, slower under reduced motion', () => {
  const a = new PlanetShot({ seed: 1 }), b = new PlanetShot({ seed: 1 });
  a.startPass(2);
  b.startPass(2);
  a.update(1, {});
  b.update(1, { reduced: true });
  assert.equal(a.moonTime, 3);
  assert.ok(b.moonTime > 2 && b.moonTime < a.moonTime);
  const c = new PlanetShot({ seed: 1 }), before = c.moon.position.clone();
  c.update(5, {});
  assert.ok(c.moon.position.distanceTo(before) > 0.05, 'without startPass it simply orbits');
  for (const s of [a, b, c]) s.dispose();
});

test('the planet turns, slower under reduced motion; the stars stay within the particle budget', () => {
  const a = new PlanetShot({ seed: 1 }), b = new PlanetShot({ seed: 1 });
  const a0 = a.spin.rotation.y, b0 = b.spin.rotation.y;
  a.update(1, {});
  b.update(1, { reduced: true });
  assert.ok(a.spin.rotation.y - a0 > b.spin.rotation.y - b0 && b.spin.rotation.y > b0);
  assert.ok(a.stars.geometry.attributes.position.count <= 3000);
  a.update(1, { pixelRatio: 2 });
  assert.equal(a.stars.material.uniforms.uPixelRatio.value, 2);
});
