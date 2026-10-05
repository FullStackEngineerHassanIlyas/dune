// The Mentats' face art and rigs (src/ui/campaign/mentat-face-rigs.js, mentat-face-art.js; the files baked by
// assets/campaign/portraits/bake.mjs --mouth): every sprite is there at the size its box declares, on the head layer's
// pixel grid and on the head; the generated module records the very bytes on disk (a re-bake that changes them is seen
// here); the lot stays small; the rigs are valid and their parts lie where the art does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const { MENTAT_RIGS, rigFor } = await import('../src/ui/campaign/mentat-face-rigs.js');
const { FACE_ART } = await import('../src/ui/campaign/mentat-face-art.js');
const { PORTRAITS } = await import('../src/ui/campaign/portraits-layers.js');
const { validateRig, EXPRESSIONS, VISEMES } = await import('../src/ui/campaign/mentat-face-rig.js');
const { PIXELS_PER_UNIT: K, SPRITE_VISEMES } = await import('../src/ui/campaign/portraits-mouth.js');

const DIR = new URL('../assets/campaign/portraits/', import.meta.url);
const HOUSES = ['atreides', 'harkonnen', 'ordos'];
const SIDES = ['left', 'right'];
const file = (name) => fileURLToPath(new URL(name, DIR));
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

/** The pixel size of a WebP file (lossy, lossless or extended), from its header. */
function webpSize(buf) {
  assert.equal(buf.toString('latin1', 0, 4), 'RIFF');
  assert.equal(buf.toString('latin1', 8, 12), 'WEBP');
  const kind = buf.toString('latin1', 12, 16);
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  assert.fail(`not a WebP chunk: ${kind}`);
}
const px = (v) => Math.round(v * K);
const onGrid = (v) => Math.abs(v * K - Math.round(v * K)) < 0.01;
const inside = ([x, y, w, h], [X, Y, W, H], m = 0.01) => x >= X - m && y >= Y - m && x + w <= X + W + m && y + h <= Y + H + m;

/** Every file the art names: [house, file name, box (frame units), recorded bytes, recorded hash]. */
function artFiles(house) {
  const A = FACE_ART[house], out = [];
  for (const v of SPRITE_VISEMES) out.push([`${house}-mouth-${v}.webp`, A.box, A.sprites[v].bytes, A.sprites[v].hash, A.sprites[v].size]);
  for (const side of SIDES) {
    out.push([`${house}-brow-${side}.webp`, A.brows[side].box, A.brows[side].bytes[0], A.brows[side].hash[0]]);
    out.push([`${house}-browbase-${side}.webp`, A.brows[side].base, A.brows[side].bytes[1], A.brows[side].hash[1]]);
    out.push([`${house}-lid-${side}.webp`, A.lids[side].box, A.lids[side].bytes, A.lids[side].hash]);
  }
  return out;
}

test('every sprite is on disk at the pixel size its box declares, and the module records the very bytes', () => {
  for (const house of HOUSES) {
    const files = artFiles(house);
    assert.equal(files.length, 6 + 6, `${house}: six mouth shapes, two brows and their patches, two shut eyes`);
    for (const [name, box, bytes, hash, size] of files) {
      const buf = readFileSync(file(name));
      assert.equal(buf.length, bytes, `${name}: bytes`);
      assert.equal(sha(buf), hash, `${name}: hash (bake again and commit the module if the art changed)`);
      const [w, h] = webpSize(buf);
      assert.deepEqual([w, h], [px(box[2]), px(box[3])], `${name} is ${w}x${h}, its box ${box[2]} x ${box[3]} units is ${px(box[2])}x${px(box[3])} px`);
      if (size) assert.deepEqual([w, h], size, `${name}: the recorded size`);
      assert.ok(onGrid(box[0]) && onGrid(box[1]) && onGrid(box[2]) && onGrid(box[3]), `${name}: its box is on the head layer's pixel grid (${box})`);
    }
  }
  // nothing in the folder is a face file the module does not know (a stale sprite left behind)
  const known = new Set(HOUSES.flatMap((h) => artFiles(h).map((f) => f[0])));
  const found = readdirSync(DIR).filter((n) => /-(mouth|brow|browbase|lid)-[\w]+\.webp$/.test(n));
  assert.deepEqual(found.sort(), [...known].sort());
});

test('the face art lies on the head, where the portrait\'s features are', () => {
  for (const house of HOUSES) {
    const A = FACE_ART[house], P = PORTRAITS[house], head = P.layers.head;
    assert.ok(inside(A.box, head), `${house}: the mouth box is on the head layer`);
    const m = P.features.mouth;
    assert.ok(inside(m, A.box), `${house}: the mouth's own box ${m} lies in the sprites' ${A.box}`);
    assert.ok(A.hinge > m[1] && A.hinge < m[1] + m[3], `${house}: the lip line is between the lips`);
    assert.ok(A.center > m[0] && A.center < m[0] + m[2] && A.halfWidth > 10 && A.halfWidth < m[2], `${house}: centre and half width`);
    for (const side of SIDES) {
      const brow = A.brows[side], feat = P.features[side === 'left' ? 'browL' : 'browR'], eye = P.features[side === 'left' ? 'eyeL' : 'eyeR'];
      assert.ok(inside(brow.box, brow.base), `${house} ${side}: the cut-out lies in the patch it moves over`);
      assert.ok(inside(brow.base, head), `${house} ${side}: the patch lies on the head`);
      // the cut-out is a brow: it overlaps the brow's analytic box and sits above the eye's middle
      const [bx, by, bw, bh] = brow.box;
      assert.ok(bx < feat[0] + feat[2] && bx + bw > feat[0] && by < feat[1] + feat[3] && by + bh > feat[1], `${house} ${side}: the brow is where the sculpt puts it`);
      assert.ok(by + bh / 2 < eye[1] + eye[3] / 2, `${house} ${side}: above the eye`);
      const lid = A.lids[side];
      assert.ok(inside(lid.box, head), `${house} ${side}: the shut eye lies on the head`);
      assert.ok(inside(eye, lid.box), `${house} ${side}: and covers the eye`);
    }
  }
});

test('the face art is small: every file under 40 KB, all three Mentats together under 1.5 MB', () => {
  let total = 0, biggest = 0;
  for (const house of HOUSES) for (const [name] of artFiles(house)) { const n = statSync(file(name)).size; total += n; biggest = Math.max(biggest, n); }
  assert.ok(biggest < 40 * 1024, `the largest is ${biggest} bytes`);
  assert.ok(total < 1.5 * 1024 * 1024, `all together ${total} bytes`);
  assert.ok(total > 50 * 1024, 'and there is art in them');
});

test('the rigs are valid, name the baked files, and put every part where the art lies', () => {
  assert.deepEqual(Object.keys(MENTAT_RIGS), HOUSES);
  for (const house of HOUSES) {
    const rig = rigFor(house), A = FACE_ART[house], P = PORTRAITS[house];
    assert.deepEqual(validateRig(rig), { ok: true, errors: [] }, house);
    assert.equal(rig.house, house);
    assert.deepEqual(rig.mouth.box, A.box);
    assert.equal(rig.mouth.hinge, A.hinge);
    for (const v of VISEMES) {
      if (v === 'rest') assert.equal(rig.mouth.sprites.rest, null);
      else assert.ok(rig.mouth.sprites[v].endsWith(`assets/campaign/portraits/${house}-mouth-${v}.webp`), v);
    }
    for (const side of SIDES) {
      assert.deepEqual(rig.brows[side].box, A.brows[side].box);
      assert.deepEqual(rig.brows[side].base.box, A.brows[side].base);
      assert.ok(rig.brows[side].src.endsWith(`${house}-brow-${side}.webp`) && rig.brows[side].base.src.endsWith(`${house}-browbase-${side}.webp`));
      assert.ok(rig.lids[side].src.endsWith(`${house}-lid-${side}.webp`));
      assert.deepEqual(rig.lids[side].box, A.lids[side].box);
      // the eye's opening lies in its sprite, inside the eye's own box widened by the lids' reach
      const [top, bottom] = rig.lids[side].open, eye = P.features[side === 'left' ? 'eyeL' : 'eyeR'];
      assert.ok(top >= eye[1] - 8 && bottom <= eye[1] + eye[3] + 8 && bottom - top >= 6, `${house} ${side}: opening ${top}..${bottom} on the eye ${eye}`);
      // a corner of the mouth and the chin are where the mouth is
      const [cx, cy, cw, ch] = rig.corners[side].box;
      assert.ok(cy < A.hinge && cy + ch > A.hinge && cx >= A.box[0] && cx + cw <= A.box[0] + A.box[2], `${house} ${side}: the corner's box holds the lip line`);
    }
    assert.ok(rig.jaw.box[1] > A.hinge && rig.jaw.box[1] < A.hinge + 20, `${house}: the chin hangs just under the lips`);
    assert.ok(inside(rig.jaw.box, P.layers.head, 4), `${house}: the chin box is on the head`);
    for (const e of EXPRESSIONS) assert.ok(rig.expressions[e], `${house} ${e}`);
    // the sprites open the mouth by their gap: the table the jaw follows rises with it
    const o = rig.mouth.open;
    assert.ok(o.rest === 0 && o.MBP === 0 && o.A === 1 && o.FV < o.E && o.E < o.L && o.L < o.O && o.O <= o.A, `${house}: ${JSON.stringify(o)}`);
  }
});
