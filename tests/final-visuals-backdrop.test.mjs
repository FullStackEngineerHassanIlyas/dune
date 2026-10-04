// The menu backdrop readies its next battle's GPU side a slice a frame (src/scenes/menu-backdrop.js finishSlice): on
// the page's first battle that is every model, program and texture, half a second at once, which froze the opening's
// planet at 23.5 s when the player was quick at the gate. Driven here on stand-ins for the renderer, frame by frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MenuBackdrop } from '../src/scenes/menu-backdrop.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

/** A backdrop whose next battle is simulated ahead and waits to be finished; the renderer's calls are logged. */
function rig({ objects = 40, newPrograms = [3, 7, 8, 20, 39] } = {}) {
  const log = [], programs = [], pending = [];
  const parts = ['terrain', 'units', 'structures', 'effects', 'hidden'].map((name) => ({ name, visible: name !== 'hidden' }));
  const meshes = Array.from({ length: objects }, (_, i) => ({ isMesh: true, name: `mesh${i}`, adds: newPrograms.includes(i) ? 1 : 0 }));
  const renderer = {
    info: { programs }, target: 'screen',
    getRenderTarget() { return this.target; },
    setRenderTarget(t) { this.target = t; },
    compileAsync(o) {
      log.push({ compile: o.name, target: this.target });
      for (let k = 0; k < o.adds; k++) programs.push({});
      return o.adds ? new Promise((resolve) => pending.push(resolve)) : Promise.resolve();
    },
  };
  const r3d = {
    renderer, camera: {}, composer: { readBuffer: 'composer' },
    scene: { traverse: (fn) => [{ isLight: true, name: 'sun' }, ...meshes].forEach(fn) },
    compile() { log.push({ compileAll: true }); },
    warm() { log.push({ warm: parts.filter((p) => p.visible).map((p) => p.name) }); },
  };
  const world = { units: new Map([[1, { typeId: 'trike', move: 'wheeled' }], [2, { typeId: 'sandworm', move: 'worm' }]]), structures: new Map([[3, { typeId: 'windtrap', w: 2, h: 2, type: {} }]]) };
  const next = { director: { world }, stage: { root: { children: parts }, prime: () => log.push({ prime: true }) }, ticksLeft: 0, ready: false };
  const backdrop = Object.assign(Object.create(MenuBackdrop.prototype), { r3d, next, planetOnly: false, disposeRetired: () => log.push({ dispose: true }) });
  return { backdrop, next, log, pending, parts, meshes };
}

test('the next battle is finished over many frames: never two new programs compiling at once, the off-screen frame a part at a time', async () => {
  const { backdrop, next, log, pending, parts } = rig();
  const frames = [];
  for (let frame = 0; frame < 200 && !next.ready; frame++) {
    const from = log.length, waiting = pending.length > 0;
    backdrop.prepare();
    frames.push({ work: log.slice(from), waiting });
    if (waiting) pending.splice(0).forEach((resolve) => resolve());   // the driver takes a frame per program
    await tick();
  }
  assert.equal(next.ready, true, 'finished');
  assert.ok(frames.length > 10, `spread over ${frames.length} frames`);
  assert.equal(log.filter((e) => e.compileAll).length, 0, 'never the whole scene at once');
  // views are made before anything compiles, every compile draws for the composer's target, and the target comes back
  const firstCompile = log.findIndex((e) => e.compile);
  assert.ok(log.findIndex((e) => e.prime) >= 0 && log.findIndex((e) => e.prime) < firstCompile);
  assert.ok(log.filter((e) => e.compile).every((e) => e.target === 'composer'));
  assert.equal(backdrop.r3d.renderer.target, 'screen');
  assert.equal(log.filter((e) => e.compile).length, 40, 'every object compiled once');
  // at most one object bringing new programs per frame, and nothing more while one is compiling
  for (const { work, waiting } of frames) {
    const fresh = work.filter((e) => e.compile && [3, 7, 8, 20, 39].includes(Number(e.compile.slice(4))));
    assert.ok(fresh.length <= 1, JSON.stringify(work));
    if (waiting) assert.equal(work.length, 0, `work while a program compiles: ${JSON.stringify(work)}`);
  }
  assert.equal(frames.filter((f) => f.waiting).length, 5, 'it waited for each new program');
  // the warm: each shown part on its own, then the whole as it opens; the hidden part stays hidden; then the old battle goes
  const warms = log.filter((e) => e.warm).map((e) => e.warm.join('+'));
  assert.deepEqual(warms.slice(0, -1).sort(), ['effects', 'structures', 'terrain', 'units']);
  assert.equal(warms.at(-1), 'terrain+units+structures+effects');
  assert.deepEqual(parts.map((p) => p.visible), [true, true, true, true, false], 'visibility as it was');
  assert.deepEqual(log.at(-1), { dispose: true });
  const after = log.length;
  backdrop.prepare();
  assert.equal(log.length, after, 'nothing more once ready');
});

test('objects that bring no new program are compiled many to a frame', async () => {
  const { backdrop, next, log } = rig({ objects: 300, newPrograms: [] });
  let frames = 0;
  while (!next.ready && frames < 100) { backdrop.prepare(); frames++; await tick(); }
  assert.equal(next.ready, true);
  assert.equal(log.filter((e) => e.compile).length, 300);
  assert.ok(frames < 40, `${frames} frames`);
});

test('ensureReady still finishes everything at once, also half-way through the slices', async () => {
  const { backdrop, next, log } = rig();
  for (let i = 0; i < 6; i++) { backdrop.prepare(); await tick(); }
  assert.equal(next.ready, false);
  backdrop.ensureReady();
  assert.equal(next.ready, true);
  assert.ok(log.some((e) => e.compileAll));
  assert.deepEqual(log.at(-1), { dispose: true });
});
