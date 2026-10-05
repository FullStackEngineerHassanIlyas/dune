// The Mentat's face, its arithmetic and its rig (notes docs/superpowers/notes/2026-10-05-mentat-face.md): springs,
// mouth-shape weights and their stacking, blinks, the rig's validation, the stand-in rigs and their sprites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { omegaFor, springStep, visemeTargets, normalizeWeights, stackAlphas, openness, Blinker } from '../src/ui/campaign/mentat-face-motion.js';
import { validateRig, compileRig, assertRig, PARAMS, PARAM_RANGE, VISEMES, EXPRESSIONS } from '../src/ui/campaign/mentat-face-rig.js';
import { standInRig, standInRigs, mouthSpriteSvg, mouthBox, FACE_SPOTS, EXPRESSION_SETS } from '../src/ui/campaign/mentat-face-standin.js';
import { PORTRAITS } from '../src/ui/campaign/portraits-layers.js';

const HOUSES = ['atreides', 'harkonnen', 'ordos'];
const clone = (o) => JSON.parse(JSON.stringify(o));

test('a critically damped spring settles within 5 % in its time, never overshoots a step, and is exact at any dt', () => {
  for (const settle of [0.06, 0.2, 0.6]) {
    const x = new Float64Array(1), v = new Float64Array(1), w = omegaFor(settle);
    let t = 0, peak = 0;
    while (t < settle - 1e-9) { springStep(x, v, 0, 1, w, 1 / 240); t += 1 / 240; peak = Math.max(peak, x[0]); }
    assert.ok(x[0] > 0.949 && x[0] < 0.96, `${settle}s: ${x[0]}`);
    for (let i = 0; i < 2000; i++) { springStep(x, v, 0, 1, w, 1 / 240); peak = Math.max(peak, x[0]); }
    assert.ok(peak <= 1 + 1e-12, 'no overshoot');
    // one step of 2 dt is two steps of dt (the solution is exact, so frame rate does not change the motion)
    const a = new Float64Array([0.3]), av = new Float64Array([2]), b = new Float64Array([0.3]), bv = new Float64Array([2]);
    springStep(a, av, 0, -1, w, 0.05);
    springStep(b, bv, 0, -1, w, 0.025); springStep(b, bv, 0, -1, w, 0.025);
    assert.ok(Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(av[0] - bv[0]) < 1e-9);
    // stable however long the frame
    const c = new Float64Array([5]), cv = new Float64Array([0]);
    springStep(c, cv, 0, 0, w, 10);
    assert.ok(Math.abs(c[0]) < 1e-6 && Number.isFinite(cv[0]));
  }
});

test('a voice frame gives the mouth shapes\' weights: the move from one shape to the next; silence is rest', () => {
  const w = new Float64Array(7);
  visemeTargets({ from: 3, shape: 5, mix: 0.25 }, true, w);
  assert.deepEqual([...w], [0, 0, 0, 0.75, 0, 0.25, 0]);
  visemeTargets({ from: 4, shape: 4, mix: 0.6 }, true, w);
  assert.deepEqual([...w], [0, 0, 0, 0, 1, 0, 0]);
  visemeTargets({ from: 3, shape: 5, mix: 0.5 }, false, w);
  assert.deepEqual([...w], [1, 0, 0, 0, 0, 0, 0], 'not speaking: the mouth closes');
  visemeTargets({ from: 99, shape: -2, mix: NaN }, true, w);
  assert.deepEqual([...w], [1, 0, 0, 0, 0, 0, 0], 'nonsense reads as rest');
  const n = normalizeWeights(Float64Array.from([-0.1, 0.5, 0.5, 0, 0, 0, 0.2]));
  assert.ok(Math.abs(n.reduce((a, b) => a + b) - 1) < 1e-12 && n[0] === 0);
  assert.deepEqual([...normalizeWeights(new Float64Array(7))], [1, 0, 0, 0, 0, 0, 0]);
  assert.equal(openness(Float64Array.from([0, 0, 0, 0.5, 0, 0.5, 0]), Float64Array.from([0, 0, 0.2, 1, 0.55, 0.75, 0.6])), 0.875);
});

test('stacked sprites at their stacking opacities show the weighted average of the shapes', () => {
  const colors = [0.9, 0.1, 0.3, 0.5, 0.7, 0.2, 0.6];
  for (const w of [[1, 0, 0, 0, 0, 0, 0], [0.2, 0.3, 0, 0.5, 0, 0, 0], [0, 0, 0, 0.25, 0.25, 0.25, 0.25], [0, 0.6, 0, 0, 0, 0, 0.4]]) {
    const a = stackAlphas(Float64Array.from(w), new Float64Array(7));
    let out = 0;                                // over-compositing in drawing order
    for (let i = 0; i < 7; i++) out = out * (1 - a[i]) + colors[i] * a[i];
    const want = w.reduce((s, wi, i) => s + wi * colors[i], 0);
    assert.ok(Math.abs(out - want) < 1e-12, `${w}: ${out} vs ${want}`);
    assert.ok(a.every((x) => x >= 0 && x <= 1));
  }
  // the painting at rest (no sprite) lets a shape fade in linearly over it
  const a = stackAlphas(Float64Array.from([0.7, 0, 0, 0.3, 0, 0, 0]), new Float64Array(7));
  assert.equal(a[0], 1); assert.ok(Math.abs(a[3] - 0.3) < 1e-12);
});

test('blinks come on a seeded schedule within their interval, close fully and open again, and a sentence nudges one', () => {
  const opts = { min: 2.4, max: 5.6, double: 0.15, close: 0.07, hold: 0.04, open: 0.13, seed: 7 };
  const run = (seed) => {
    const b = new Blinker({ ...opts, seed });
    const starts = [];
    let prev = 0, maxv = 0;
    for (let i = 0; i <= 600 * 60; i++) {
      const t = i / 60, v = b.value(t);
      if (v > 0 && prev === 0) starts.push(t);
      prev = v; maxv = Math.max(maxv, v);
    }
    return { starts, maxv };
  };
  const { starts, maxv } = run(7);
  assert.deepEqual(run(7).starts, starts, 'the same seed blinks the same');
  assert.notDeepEqual(run(8).starts, starts);
  assert.equal(maxv, 1, 'the eyes shut');
  const gaps = starts.slice(1).map((t, i) => t - starts[i]);
  const doubles = gaps.filter((g) => g < 0.5).length;
  for (const g of gaps) assert.ok(g < 0.5 || (g >= opts.min && g <= opts.max + 0.25 + 0.05), `gap ${g}`);
  assert.ok(starts.length > 600 / opts.max && starts.length < 600 / opts.min * 1.3, `${starts.length} blinks in 10 min`);
  assert.ok(doubles > 0 && doubles < starts.length * 0.3, `${doubles} doubles`);
  // a blink's shape: shut within `close`, open again within its length
  const b = new Blinker({ ...opts, seed: 3 });
  const t0 = b.next;
  assert.equal(b.value(t0 - 0.01), 0);
  assert.ok(b.value(t0 + 0.035) > 0 && b.value(t0 + 0.035) < 1);
  assert.equal(b.value(t0 + 0.09), 1);
  assert.equal(b.value(t0 + 0.25), 0);
  // a sentence's start brings the next blink forward, unless he has just blinked
  const n = new Blinker({ ...opts, seed: 5 });
  n.value(0); n.value(1.5);
  assert.ok(n.next > 1.6);
  assert.equal(n.nudge(1.5), true);
  assert.ok(n.next <= 1.56 + 1e-9);
  n.value(1.6);
  assert.equal(n.nudge(1.8), false, 'blinking now');
  n.value(2.0);
  assert.equal(n.nudge(2.1), false, 'just blinked');
});

test('the stand-in rigs are valid, sit on today\'s paintings and give every viseme and expression', () => {
  const rigs = standInRigs();
  for (const h of HOUSES) {
    const rig = rigs[h];
    assert.deepEqual(validateRig(rig), { ok: true, errors: [] }, h);
    assert.equal(rig.name, PORTRAITS[h].name);
    assert.deepEqual(rig.head.box, PORTRAITS[h].layers.head);
    assert.deepEqual(rig.lids.box, PORTRAITS[h].layers.lids);
    assert.equal(rig.mouth.sprites.rest, null, 'at rest the painting\'s own mouth shows');
    for (const v of VISEMES.slice(1)) assert.match(rig.mouth.sprites[v], /^data:image\/svg\+xml/);
    const [x, y, w, hh] = rig.head.box, [mx, my] = FACE_SPOTS[h].mid;
    assert.ok(mx > x && mx < x + w && my > y && my < y + hh, 'the mouth is on the head');
    const [bx, by, bw, bh] = rig.mouth.box;
    for (const [cx, cy] of FACE_SPOTS[h].corners) assert.ok(cx > bx && cx < bx + bw && cy > by && cy < by + bh, 'the corners are in the mouth box');
    for (const e of EXPRESSIONS) assert.ok(rig.expressions[e], `${h} ${e}`);
    const c = compileRig(rig);
    assert.equal(c.targets.length, EXPRESSIONS.length);
    assert.ok(c.targets.every((t) => t.length === PARAMS.length && t.every(Number.isFinite)));
  }
  assert.equal(standInRig('fremen'), null);
});

test('each Mentat\'s expressions are in character: Cyril\'s kindly concern, Radnor\'s sneer, Ammon\'s sly half-smile', () => {
  const { atreides: cy, harkonnen: ra, ordos: am } = EXPRESSION_SETS;
  // Cyril: concern lifts his inner brows (furrow < 0) when he warns or grieves; warmth turns both corners up
  assert.ok(cy.warning.furrow < 0 && cy.sad.furrow < 0 && cy.neutral.furrow <= 0);
  assert.ok(cy.pleased.cornerL > 0.4 && cy.pleased.cornerR > 0.4 && Math.abs(cy.pleased.cornerL - cy.pleased.cornerR) < 0.1, 'an even smile');
  assert.ok(cy.sad.cornerL < 0 && cy.sad.nod > 0);
  // Radnor: the sneer is one-sided (his smirk's side up, the other down) under drawn-down brows
  for (const e of ['neutral', 'sly', 'pleased']) assert.ok(ra[e].cornerR - ra[e].cornerL > 0.25, `Radnor ${e}`);
  assert.ok(ra.sly.cornerR >= 0.7 && ra.sly.cornerL <= 0 && ra.sly.browL < 0 && ra.sly.lidL > 0.3);
  assert.ok(ra.angry.furrow === 1 && ra.angry.browL < -0.5);
  // Ammon: one brow up and a smile on one side, the lids lowered
  for (const e of ['neutral', 'sly']) assert.ok(am[e].browR > (am[e].browL ?? 0) && am[e].cornerR > am[e].cornerL, `Ammon ${e}`);
  assert.ok(am.sly.browR >= 0.5 && am.sly.cornerR - am.sly.cornerL >= 0.5 && am.sly.lidL >= 0.3);
  for (const set of [cy, ra, am]) for (const t of Object.values(set)) for (const [k, v] of Object.entries(t)) {
    const [lo, hi] = PARAM_RANGE[k];
    assert.ok(v >= lo && v <= hi, `${k} ${v}`);
  }
});

test('the stand-in mouth sprites are well-formed SVG drawn in the mouth\'s box', () => {
  for (const h of HOUSES) {
    const [bx, by, bw, bh] = mouthBox(FACE_SPOTS[h]);
    for (const v of VISEMES.slice(1)) {
      const svg = mouthSpriteSvg(h, v);
      assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), `${h} ${v}`);
      assert.ok(svg.includes(`viewBox="${bx} ${by} ${bw} ${bh}"`));
      assert.ok(!/NaN|undefined|Infinity/.test(svg), `${h} ${v}: a bad number`);
      const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
      assert.equal(new Set(ids).size, ids.length, 'unique ids');
      for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref), `${h} ${v}: #${ref} is defined`);
      assert.ok(svg.length < 40000);
    }
    assert.equal(mouthSpriteSvg(h, 'rest'), null);
    // open shapes have an inside; the closed lips do not
    assert.ok(mouthSpriteSvg(h, 'A').includes('clip-path') && !mouthSpriteSvg(h, 'MBP').includes('clip-path'));
  }
});

test('a bad rig is told what is wrong, field by field', () => {
  const good = standInRig('ordos');
  const cases = [
    [(r) => { r.v = 2; }, /v must be 1/],
    [(r) => { delete r.mouth.sprites.O; }, /mouth\.sprites\.O is missing/],
    [(r) => { r.mouth.sprites.Q = 'x.webp'; }, /mouth\.sprites\.Q is not a viseme/],
    [(r) => { r.mouth.sprites.A = 42; }, /mouth\.sprites\.A must be a URL or null/],
    [(r) => { for (const v of VISEMES) r.mouth.sprites[v] = null; }, /no sprite at all/],
    [(r) => { r.mouth.box = [380, 480, 60, 60]; }, /mouth\.box lies outside the frame/],
    [(r) => { r.mouth.hinge = 10; }, /mouth\.hinge/],
    [(r) => { r.brows.left.box = [1, 2, 3]; }, /brows\.left\.box must be a box/],
    [(r) => { r.brows.right.feather = 3; }, /brows\.right\.feather/],
    [(r) => { r.lids.left.box = [0, 0, 20, 20]; }, /lids\.left\.box must lie in lids\.box/],
    [(r) => { r.lids.right.open = [190, 170]; }, /lids\.right\.open/],
    [(r) => { r.head.src = ''; }, /head\.src/],
    [(r) => { delete r.expressions.sly; }, /expressions\.sly is missing/],
    [(r) => { r.expressions.angry.sneer = 1; }, /expressions\.angry\.sneer is not a parameter/],
    [(r) => { r.expressions.pleased.cornerR = 3; }, /expressions\.pleased\.cornerR must be a number in -1\.\.1/],
    [(r) => { r.expressions.bored = {}; }, /expressions\.bored is not an expression/],
    [(r) => { r.motion.blink.min = 9; }, /motion\.blink\.max must be >= min/],
    [(r) => { r.motion.wobble = 1; }, /motion\.wobble/],
    [(r) => { r.jaw.drop = -1; }, /jaw\.drop/],
  ];
  for (const [spoil, msg] of cases) {
    const r = clone(good);
    spoil(r);
    const { ok, errors } = validateRig(r);
    assert.equal(ok, false, String(msg));
    assert.ok(errors.some((e) => msg.test(e)), `${msg}: ${errors.join('; ')}`);
    assert.throws(() => assertRig(r), (err) => err instanceof TypeError && msg.test(err.message) && /\(ordos\)/.test(err.message));
  }
  assert.equal(validateRig(null).ok, false);
  // the optional parts may be left out (a rig with a mouth and expressions only still runs)
  const lean = clone(good);
  delete lean.brows; delete lean.corners; delete lean.jaw; delete lean.lids; delete lean.motion;
  assert.deepEqual(validateRig(lean), { ok: true, errors: [] });
});
