// The won mission's fly-over (research §5): seven Carryalls in a V in the winner's colour cross the view in
// about four seconds, from below the bottom of the screen to beyond the top, and are gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Flyover, vFormation, flightPlan, FLYOVER } from '../src/render/flyover.js';
import { HOUSES } from '../src/data/houses.js';

const scene = () => { const kids = new Set(); return { kids, add: (m) => kids.add(m), remove: (m) => kids.delete(m) }; };
const rig = (yaw = 0) => ({ yaw, distance: 16, target: { x: 30, y: 0, z: 30 } });
const pos = (h) => ({ x: h.matrix.elements[12], y: h.matrix.elements[13], z: h.matrix.elements[14] });

test('a V of seven: the leader in front, pairs behind on either side', () => {
  const v = vFormation(7, 1.5);
  assert.equal(v.length, 7);
  assert.deepEqual(v[0], { back: 0, side: 0 });
  for (let k = 1; k < 7; k += 2) {
    assert.equal(v[k].back, v[k + 1].back);
    assert.equal(v[k].side, -v[k + 1].side);
    assert.ok(v[k].back > v[k - 1].back - 1e-9);
  }
});

test('the flight runs along the view through the point looked at', () => {
  const p = flightPlan({ x: 10, z: 20 }, { x: 0, z: -1 }, { behind: 5, ahead: 8, seconds: 4, tail: 3 });
  assert.deepEqual([p.x0, p.z0, p.length, p.speed], [10, 25, 16, 4]);
});

test('the Carryalls cross the screen upwards in the house colour and are gone after the flight', () => {
  const s = scene();
  const f = new Flyover(s, { house: 'ordos', heightAt: () => 1 });
  assert.equal(f.handles.length, FLYOVER.count);
  assert.ok(f.handles.every((h) => !h.visible), 'nothing shows before it starts');
  assert.equal(f.handles[0].color.getHex(), HOUSES.ordos.color);
  f.start(rig(0));   // yaw 0 looks north: screen up is −z
  const lead = f.handles[0], start = pos(lead);
  assert.ok(start.z > 30 + 10, 'it comes in from below the view (south)');
  assert.ok(start.y > 1 + 3, 'high over the ground');
  let steps = 0;
  while (!f.update(1 / 60)) steps++;
  assert.ok(Math.abs(steps / 60 - FLYOVER.seconds) < 0.05, `about ${FLYOVER.seconds} s`);
  f.done = false; f.t = FLYOVER.seconds; f.pose();
  const end = pos(lead), tail = pos(f.handles[6]);
  assert.ok(end.z < 30 - 20 && tail.z < 30 - 20, 'all of it beyond the top of the view');
  assert.ok(Math.abs(end.x - 30) < 1e-6, 'straight up the screen');
  f.update(0.1);
  f.dispose();
  assert.equal(s.kids.size, 0, 'nothing left in the scene');
});

test('a turned camera turns the flight with it', () => {
  const f = new Flyover(scene(), { house: 'atreides' });
  f.start(rig(Math.PI / 2));   // looking west: screen up is −x
  const a = pos(f.handles[0]);
  f.update(1);
  const b = pos(f.handles[0]);
  assert.ok(b.x < a.x - 3 && Math.abs(b.z - a.z) < 1e-6);
});
