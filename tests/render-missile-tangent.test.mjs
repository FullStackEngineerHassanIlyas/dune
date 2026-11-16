import test from 'node:test';
import assert from 'node:assert/strict';
import { shotPoint } from '../src/render/views/missile-views.js';

for (const projectile of ['rocket', 'gas', 'deathHand']) {
  test(`${projectile} nose follows its arc at launch and arrival`, () => {
    const p = { projectile, sx: 2, sy: 5, tx: 12, ty: 5, y: 5, py: 5, speed: 12.5 };
    const at = x => shotPoint({ ...p, x, px: x }, 1, () => 0, {});
    const eps = 1e-5;
    for (const x of [2, 12]) {
      const pose = at(x);
      const derivative = x === 2 ? (at(x + eps).y - pose.y) / eps : (pose.y - at(x - eps).y) / eps;
      assert.ok(Math.abs(pose.dy / pose.dx - derivative) < 1e-5, `${projectile} at ${x}: nose slope ${pose.dy / pose.dx}, path slope ${derivative}`);
    }
  });
}
