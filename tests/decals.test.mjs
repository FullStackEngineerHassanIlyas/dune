import test from 'node:test';
import assert from 'node:assert/strict';

// A stand-in 2D canvas that records what is stamped where, so the decal map runs under Node.
class Ctx {
  constructor() { this.draws = []; this.turns = []; this.at = [0, 0]; }
  createRadialGradient() { return { addColorStop() {} }; }
  translate(x, y) { this.at = [x, y]; }
  rotate(a) { this.turns.push(a); }
  drawImage(img, x, y, w) { this.draws.push({ img, x: this.at[0], y: this.at[1], size: w }); }
}
for (const f of ['beginPath', 'arc', 'fill', 'moveTo', 'lineTo', 'quadraticCurveTo', 'closePath', 'stroke', 'fillRect', 'save', 'restore', 'scale']) Ctx.prototype[f] = () => {};
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext() { return (this.ctx ??= new Ctx()); } }) };

const { DecalMap } = await import('../src/render/decals.js');

const kinds = (map) => map.ctx.draws.map((d) => Object.keys(map.stamps).find((k) => map.stamps[k].includes(d.img)));

test('every ground impact leaves its own mark: pocks, craters with scorch, cracks on rock and concrete', () => {
  const map = new DecalMap(32, 32), marks = (f) => { map.ctx.draws = []; f(); return kinds(map); };
  assert.deepEqual([...new Set(marks(() => map.mark(4, 4, 'bullet', 'sand')))], ['pock']);
  assert.deepEqual(marks(() => map.mark(4, 4, 'shell', 'sand')).sort(), ['crater', 'scorch']);
  assert.ok(marks(() => map.mark(4, 4, 'shell', 'concrete')).includes('cracks'));
  assert.ok(marks(() => map.mark(4, 4, 'rocket', 'rock')).includes('cracks'));
  assert.ok(!marks(() => map.mark(4, 4, 'rocket', 'dune')).includes('cracks'), 'sand digs, it does not crack');
  const blast = marks(() => map.blast(4, 4, 1.8, 'sand'));
  assert.ok(blast.filter((k) => k === 'scorch').length >= 3 && blast.includes('crater'), 'a big blast blackens a wide, blotched patch');
  assert.ok(map.dirty);
});

test('marks sit where they land, sized by the blow, and never repeat the same turn', () => {
  const map = new DecalMap(32, 32);
  map.mark(10, 20, 'rocket', 'sand', 1);
  const rocket = map.ctx.draws.at(-1);
  assert.deepEqual([rocket.x, rocket.y], [10 * map.px, 20 * map.px]);
  map.ctx.draws = [];
  map.mark(10, 20, 'rocket', 'sand', 0.65);
  assert.ok(map.ctx.draws.at(-1).size < rocket.size, 'a mini-rocket leaves a smaller crater');
  map.ctx.draws = [];
  map.blast(5, 5, 1.8, 'sand');
  assert.ok(map.ctx.draws.at(-1).size > rocket.size * 2, 'a building going up leaves a big one');
  assert.ok(new Set(map.ctx.turns).size === map.ctx.turns.length, 'each stamp turned its own way');
});

test('the map lines up with the ground and uploads at most five times a second', () => {
  const map = new DecalMap(40, 24);
  assert.equal(map.texture.flipY, false, 'canvas row y is map row y (the shader samples (x, z) / size)');
  assert.equal(map.canvas.width, 40 * map.px);
  assert.ok(map.px >= 32 && map.canvas.width <= 2048);
  const v = map.texture.version;
  map.pock(3, 3);
  map.flush(1000);
  map.pock(3, 3);
  map.flush(1100);
  assert.equal(map.texture.version, v + 1);
  map.flush(1300);
  assert.equal(map.texture.version, v + 2);
  assert.ok(new DecalMap(128, 128).canvas.width <= 2048, 'a big map keeps the texture within 2048');
  const big = new DecalMap(64, 64);
  assert.ok(big.interval >= 4 * map.interval - 1, 'and uploads it less often, moving no more data than a small one');
});

test('the map uploads as plain bytes and the terrain decodes its sRGB itself', async () => {
  const THREE = await import('three');
  const { readFile } = await import('node:fs/promises');
  // an sRGB texture takes the browser's slow path: on an Intel laptop each 2048² upload stalled its frame by 100 ms or more
  assert.equal(new DecalMap(64, 64).texture.colorSpace, THREE.NoColorSpace);
  const shader = await readFile(new URL('../src/render/terrain-shader.js', import.meta.url), 'utf8');
  assert.match(shader, /pow\(texture2D\(uDecals, [^;]*\)\.rgb, vec3\(2\.2\)\)/, 'decoded to linear before it darkens the ground');
});
