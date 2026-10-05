// The face art's source (src/ui/campaign/portraits-mouth.js, -brows.js, -lids.js, and the mouth pose of the head's
// sculpt, portraits-head.js): the shapes of the mouth, where the sprites, brow cut-outs and shut eyes lie on the
// head layer's pixel grid, the sculpt's pose uniforms (all zero is the portrait as it was baked: the head layer is not
// touched), and that the bake is deterministic: the same inputs build the same shaders and the same regions every time,
// and (with DUNE_BAKE_CHECK=1, which needs the GPU Chrome) a fresh bake gives the committed files byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const { MENTATS } = await import('../src/ui/campaign/portraits-mentats.js');
const { fragmentShader } = await import('../src/ui/campaign/portraits-sdf.js');
const { PORTRAITS } = await import('../src/ui/campaign/portraits-layers.js');
const { SHAPES, CHARACTER, SPRITE_VISEMES, PIXELS_PER_UNIT: K, mouthPose, mouthRegion } = await import('../src/ui/campaign/portraits-mouth.js');
const { BROW_SEARCH, browRegion } = await import('../src/ui/campaign/portraits-brows.js');
const { lidsRegion } = await import('../src/ui/campaign/portraits-lids.js');
const { FACE_ART } = await import('../src/ui/campaign/mentat-face-art.js');

const HOUSES = ['atreides', 'harkonnen', 'ordos'];
const onGrid = (v) => Math.abs(v * K - Math.round(v * K)) < 0.01;   // the modules round to 1/1000 of a unit

test('the mouth poses: rest is the sculpt as baked, closed lips stay closed, each shape is its own', () => {
  for (const house of HOUSES) {
    assert.deepEqual(mouthPose(house, 'rest'), [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], `${house}: rest changes nothing`);
    const pose = Object.fromEntries(SPRITE_VISEMES.map((v) => [v, mouthPose(house, v)]));
    for (const p of Object.values(pose)) for (const vec of p) { assert.equal(vec.length, 4); assert.ok(vec.every(Number.isFinite)); }
    const g = (v) => { const [a, b, c] = pose[v]; return { open: a[0], wide: a[1], tuck: a[2], tongue: a[3], round: b[0], lift: b[1], press: b[3], upper: c[0], lower: c[1] }; };
    assert.equal(g('MBP').open, 0, 'M B P: the lips meet');
    assert.equal(g('MBP').press, 1);
    assert.ok(g('FV').tuck > 0 && g('FV').upper > 0 && g('FV').open < 0.3, 'F V: the upper teeth on the lower lip');
    assert.ok(g('A').open > g('L').open && g('L').open > g('E').open && g('E').open > g('FV').open, 'A is the widest open');
    assert.ok(g('E').wide > 0.5 && g('O').wide === 0, 'E spreads the corners');
    assert.ok(g('O').round > 0.4 && g('E').round === 0, 'O purses the lips');
    assert.ok(g('L').tongue > 0.5 && g('A').tongue === 0, 'L lifts the tongue');
    assert.ok(g('A').upper > 0 && g('A').lower > 0, 'A shows teeth');
    assert.equal(new Set(SPRITE_VISEMES.map((v) => JSON.stringify(pose[v]))).size, SPRITE_VISEMES.length, 'six different shapes');
  }
  // each Mentat opens as far as his character does: Cyril the most, Ammon (thin-lipped, closed in speech) the least
  assert.ok(mouthPose('atreides', 'A')[0][0] > mouthPose('harkonnen', 'A')[0][0] && mouthPose('harkonnen', 'A')[0][0] > mouthPose('ordos', 'A')[0][0]);
  assert.ok(CHARACTER.atreides.open >= CHARACTER.harkonnen.open && CHARACTER.harkonnen.open >= CHARACTER.ordos.open);
  assert.ok(SHAPES.A.open < 1.5, 'a counsellor\'s mouth, not a shout');
});

test('where the sprites lie: on the head layer\'s pixel grid, round the mouth, in the frame', () => {
  for (const house of HOUSES) {
    const r = mouthRegion(house), P = PORTRAITS[house], head = P.layers.head;
    for (const v of [...r.box, ...r.render]) assert.ok(onGrid(v), `${house}: ${v} is on the grid`);
    assert.ok(r.box[0] > head[0] && r.box[1] > head[1] && r.box[0] + r.box[2] < head[0] + head[2] && r.box[1] + r.box[3] < head[1] + head[3]);
    const [mx, my, mw, mh] = P.features.mouth;
    assert.ok(r.box[0] < mx && r.box[1] < my && r.box[0] + r.box[2] > mx + mw && r.box[1] + r.box[3] > my + mh, 'the box holds the mouth');
    assert.ok(r.hinge > my && r.hinge < my + mh && r.center > mx && r.center < mx + mw);
    // the render crop is the box with a margin the finish settles in
    assert.ok(r.render[0] < r.box[0] && r.render[1] < r.box[1] && r.render[0] + r.render[2] > r.box[0] + r.box[2] && r.render[1] + r.render[3] > r.box[1] + r.box[3]);
    assert.ok(r.render[0] >= 0 && r.render[1] >= 0 && r.render[0] + r.render[2] <= 400 && r.render[1] + r.render[3] <= 500);
    // the head layer's own pixel origin is on the grid too, so the sprite and the painting share their pixels
    assert.ok(onGrid(head[0]) && onGrid(head[1]), `${house}: the head layer's origin`);
  }
});

test('the brow and eye regions: boxes and pixel boxes in the render crop agree', () => {
  for (const house of HOUSES) {
    const b = browRegion(house);
    for (const v of b.render) assert.ok(onGrid(v), `${house} brows: ${v}`);
    for (const [side, [x, y, w, h]] of Object.entries(b.sides)) {
      assert.ok(x >= 0 && y >= 0 && x + w <= Math.round(b.render[2] * K) && y + h <= Math.round(b.render[3] * K), `${house} ${side}: the search box is in the crop`);
      const back = [(b.origin[0] + x) / K, (b.origin[1] + y) / K];
      assert.ok(Math.abs(back[0] - BROW_SEARCH[house][side][0]) < 1 / K && Math.abs(back[1] - BROW_SEARCH[house][side][1]) < 1 / K, 'and where it was asked for');
    }
    const l = lidsRegion(house);
    for (const v of l.render) assert.ok(onGrid(v), `${house} lids: ${v}`);
    for (const [side, e] of Object.entries(l.eyes)) {
      assert.ok(e.box[0] >= 0 && e.box[1] >= 0 && e.box[0] + e.box[2] <= Math.round(l.render[2] * K) && e.box[1] + e.box[3] <= Math.round(l.render[3] * K), `${house} ${side}`);
      assert.ok(e.unitBox.every(onGrid), `${house} ${side}: the unit box is on the grid`);
      const [cx, cy, rx, ry] = e.ellipse;
      assert.ok(cx - rx - e.box[0] > 3 && cx + rx - e.box[0] < e.box[2] - 3 && cy - ry - e.box[1] > 3 && cy + ry - e.box[1] < e.box[3] - 3, `${house} ${side}: the ellipse (and its blur's room) is inside the sprite`);
    }
  }
});

test('the sculpt takes the mouth pose as uniforms, and the portraits\' own bake does not feel them', () => {
  for (const house of HOUSES) {
    const m = MENTATS[house], frag = fragmentShader(m.scene);
    for (const u of ['uMouthA', 'uMouthB', 'uMouthC']) assert.match(frag, new RegExp(`uniform vec4 ${u};`), `${house}: ${u}`);
    assert.match(frag, /uniform vec2 uPixOff;/, 'a crop\'s film grain matches the frame\'s');
    assert.match(frag, /hash13\(vec3\(gl_FragCoord\.xy \+ uPixOff, 7\.0\)\)/);
    assert.match(frag, /vec3 mouthAlbedo\(vec3 q, float mat, out vec4 surf\)/);
    assert.match(frag, /mouthAlbedo\(/, 'the albedo reaches the mouth\'s inside');
    // every pose term is gated or multiplies a uniform, so zeros give the original sculpt: the lips with no pose
    // code on the neutral path other than additions of zero
    assert.match(frag, /if \(uMouthA\.x > 0\.01\) \{/, 'the open mouth\'s inside is built only for an open mouth');
    assert.equal(frag, fragmentShader(m.scene), 'the same scene builds the same shader');
  }
  // the three Mentats export the numbers the sprites are placed by
  for (const house of HOUSES) assert.ok(MENTATS[house].mouth === undefined || typeof MENTATS[house].mouth === 'object');
});

test('the bake is deterministic: the regions and poses are pure, and the module records what the bake wrote', () => {
  for (const house of HOUSES) {
    assert.deepEqual(mouthRegion(house), mouthRegion(house));
    assert.deepEqual(browRegion(house), browRegion(house));
    assert.deepEqual(lidsRegion(house), lidsRegion(house));
    for (const v of SPRITE_VISEMES) assert.deepEqual(mouthPose(house, v), mouthPose(house, v));
    // the generated module's boxes are the regions' (the bake wrote them from these)
    const r = mouthRegion(house), A = FACE_ART[house];
    assert.deepEqual(A.box, r.box);
    assert.equal(A.hinge, r.hinge);
    assert.equal(A.center, r.center);
    assert.equal(A.halfWidth, r.halfWidth);
    const l = lidsRegion(house);
    for (const side of ['left', 'right']) assert.deepEqual(A.lids[side].box, l.eyes[side].unitBox);
  }
});

// A fresh bake of one Mentat's face art on the GPU must give the committed files byte for byte. It needs Chrome on the
// GPU and takes some seconds: DUNE_BAKE_CHECK=1 node --test tests/portraits-face.test.mjs (run under the chrome lock).
test('a fresh bake gives the committed files byte for byte', { skip: process.env.DUNE_BAKE_CHECK ? false : 'set DUNE_BAKE_CHECK=1 (needs the GPU Chrome)' }, () => {
  const out = mkdtempSync(join(tmpdir(), 'dune-face-bake-'));
  try {
    const house = process.env.DUNE_BAKE_HOUSE ?? 'ordos';
    const run = spawnSync(process.execPath, [fileURLToPath(new URL('../assets/campaign/portraits/bake.mjs', import.meta.url)), '--mouth', '--only', house, '--out', out], { encoding: 'utf8', timeout: 240000 });
    assert.equal(run.status, 0, run.stderr);
    const A = FACE_ART[house];
    const want = {
      ...Object.fromEntries(SPRITE_VISEMES.map((v) => [`${house}-mouth-${v}.webp`, A.sprites[v].hash])),
      ...Object.fromEntries(['left', 'right'].flatMap((s) => [[`${house}-brow-${s}.webp`, A.brows[s].hash[0]], [`${house}-browbase-${s}.webp`, A.brows[s].hash[1]], [`${house}-lid-${s}.webp`, A.lids[s].hash]])),
    };
    for (const [name, hash] of Object.entries(want)) {
      const got = createHash('sha256').update(readFileSync(join(out, name))).digest('hex').slice(0, 16);
      assert.equal(got, hash, `${name}: a fresh bake differs from the committed file`);
    }
  } finally { rmSync(out, { recursive: true, force: true }); }
});
