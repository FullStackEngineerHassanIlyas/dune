// Where the Phase 2 streams meet (worms, opponents, options): checks the lead added while merging them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { G } from '../src/data/terrain.js';
import { Controller } from '../src/input/controller.js';
import { Selection } from '../src/input/selection.js';
import { Groups } from '../src/input/groups.js';
import { spawnWorm } from '../src/sim/worm.js';
import { flatWorld } from './helpers.mjs';

const NONE = { shift: false, ctrl: false, alt: false };
const px = (t) => (t + 0.5) * 40;

test('a worm can be pointed at and attacked on the move as well as up, as in the original', () => {
  const world = flatWorld(20, 20, G.SAND);
  const tank = world.spawnUnit('combatTank', 'atreides', 3, 3);
  const worm = spawnWorm(world, 10, 10);
  const cursors = [];
  const c = new Controller({
    world, house: 'atreides', selection: new Selection(), groups: new Groups(), settings: { scheme: 'classic' },
    project: (x, z) => ({ x: x * 40, y: z * 40, visible: true, pxPerUnit: 40 }),
    ground: (sx, sy) => ({ x: sx / 40, y: 0, z: sy / 40 }),
    viewport: () => ({ left: 0, top: 0, right: 2000, bottom: 2000 }),
    rig: { lookAt() {}, reset() {} }, positionOf: (u) => ({ x: u.x, z: u.y }), onCursor: (name) => cursors.push(name),
  });
  c.selection.set([tank.id]);
  assert.ok(worm.submerged, 'a new worm starts under the sand');
  assert.equal(c.hitTest(px(10), px(10))?.unit, worm, 'its ridge on the move can be pointed at');
  worm.submerged = false;
  assert.equal(c.hitTest(px(10), px(10))?.unit, worm, 'and so can a worm up');
});
