// The Mentat's face engine (notes docs/superpowers/notes/2026-10-05-mentat-face.md) on a counting fake DOM built
// from the real portrait markup (portraits.js), following a voice that plays real timing tracks (MentatTrack of
// src/audio/mentat-voice.js) on a hand-cranked clock: lip-sync, smooth blending, expressions eased and held, blinks,
// silence, stopping and teardown, voice Off and reduced motion, and no allocation in the frame loop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import v8 from 'node:v8';
import vm from 'node:vm';
import { MentatTrack, VISEMES, EXPRESSIONS } from '../src/audio/mentat-voice.js';
import { mentatSvg } from '../src/ui/campaign/portraits.js';
import { MentatFace, createMentatFace, attachMentatFace } from '../src/ui/campaign/mentat-face.js';
import { POSE, tables } from '../src/ui/campaign/mentat-face-svg.js';
import { rigFor } from '../src/ui/campaign/mentat-face-rigs.js';
import { PARAMS, compileRig } from '../src/ui/campaign/mentat-face-rig.js';

import { ADVICE, synth, clone, FakeEl, fakeDocument, parseSvg, shape, makeStage, fakeVoice, frames } from './mentat-face-fakes.mjs';

function setup(house = 'atreides', json = ADVICE, opts = {}) {
  const voice = fakeVoice(json);
  const stage = makeStage(house, voice);
  const d = frames(voice);
  const face = attachMentatFace(stage, opts.rig ?? clone(rigFor(house)), { raf: d.raf, caf: d.caf, reducedMotion: false, ...opts });
  return { voice, stage, d, face };
}
const sprite = (stage, v) => stage.svg.querySelector(`.cpmf-v-${v}`);
const opacity = (el) => Number(el.getAttribute('opacity'));

test('attached, the face waits for a line; then it is drawn into the portrait, inside the head\'s own sway', () => {
  const { voice, stage, d, face } = setup();
  const before = shape(stage.svg);
  assert.ok(face instanceof MentatFace);
  assert.equal(d.requests, 0, 'no frames before he speaks');
  assert.equal(shape(stage.svg), before, 'the portrait is untouched until then');
  assert.equal(voice.listeners.line.size, 1);
  voice.play();
  assert.equal(face.running, true);
  d.step();
  const sway = stage.svg.querySelector('.cpm-sway');
  const head = sway.querySelector('.cpmf-head');
  assert.equal(sway.childNodes.length, 1, 'the head box holds what the sway held');
  assert.ok(head.parentNode === sway);
  // the head's boxes: one nods, one rolls about the pivot, and inside it the painting, the face's SVG, the CSS blink
  const roll = head.querySelector('.cpmf-roll');
  assert.ok(roll.parentNode === head);
  assert.match(roll.getAttribute('style'), /transform-origin:50% 62\.\d+%/, 'rolls about the neck\'s root');
  assert.deepEqual(roll.childNodes.map((n) => n.attrs.get('class')), ['cpm-l', 'cpmf-svg', 'cpm-l cpm-blink'], 'the face sits over the head painting, under the blink');
  assert.match(roll.childNodes[0].attrs.get('src'), /atreides-head\.webp$/);
  const svg = head.querySelector('.cpmf-svg');
  assert.equal(svg.localName, 'svg');
  assert.match(svg.getAttribute('viewBox'), /^[\d.]+ [\d.]+ [\d.]+ [\d.]+$/, 'the SVG covers the face in frame units');
  const root = head.querySelector('.cpmf-face');
  assert.ok(root.parentNode === svg);
  assert.equal(root.getAttribute('display'), 'inline');
  // the layers in the SVG: the brows' bare patches of head first, the brows' own sprites last (over the lids)
  assert.deepEqual(root.childNodes.map((n) => n.attrs.get('class')).filter((c) => /^cpmf-(bases|brows)$/.test(c)), ['cpmf-bases', 'cpmf-brows']);
  assert.equal(root.childNodes.at(-1).attrs.get('class'), 'cpmf-brows');
  assert.ok(root.childNodes.findIndex((n) => /lid/.test(n.attrs.get('class') ?? '')) < root.childNodes.length - 1);
  assert.equal(stage.svg.querySelector('.cpm-blink').style.visibility, 'hidden', 'the face blinks for the CSS while it runs');
  assert.ok(sprite(stage, 'rest') === null, 'at rest the painting\'s own mouth shows');
  for (const v of VISEMES.slice(1)) assert.ok(sprite(stage, v));
  for (const id of stage.svg.querySelectorAll('mask').map((m) => m.attrs.get('id'))) assert.match(id, /^cpmf\d+-/);
});

test('the mouth follows the voice: the shape held is the sprite shown, the jaw opens with the loudness', () => {
  const { voice, stage, d, face } = setup();
  voice.play();
  const tr = voice.track;
  // the longest-held shapes of each kind: well inside them the sprite is (nearly) all there is
  const held = {};
  for (let i = 0; i < tr.visemeTimes.length - 1; i++) {
    const v = VISEMES[tr.visemeShapes[i]], len = tr.visemeTimes[i + 1] - tr.visemeTimes[i];
    if (v !== 'rest' && len > (held[v]?.len ?? 0.17)) held[v] = { at: tr.visemeTimes[i], len };
  }
  assert.ok(Object.keys(held).length >= 3, Object.keys(held).join());
  for (const [v, { at, len }] of Object.entries(held).sort((a, b) => a[1].at - b[1].at)) {
    while (voice.clock[0] < at + Math.min(len - 0.02, 0.16)) d.step(16);
    const k = VISEMES.indexOf(v);
    if (!face.frame.speaking) continue;
    assert.ok(face.w[k] > 0.85, `${v} at ${at.toFixed(2)}: ${face.w[k]}`);
    assert.ok(opacity(sprite(stage, v)) > 0.85, `${v} shown`);
  }
  // loud and open: the jaw stretches the mouth; closed lips (M B P) keep it shut however loud
  let open = 0, closedMax = 0;
  voice.clock[0] = 0;
  d.run(tr.duration, () => {
    const sy = face.pose[POSE.mouthSy];
    if (face.w[3] > 0.9) open = Math.max(open, sy);
    if (face.w[1] > 0.95) closedMax = Math.max(closedMax, sy);
  });
  assert.ok(open > 1.06, `the jaw opens on A: ${open}`);
  assert.ok(closedMax < 1.03, `and stays shut on M/B/P: ${closedMax}`);
});

test('nothing pops: from frame to frame at 60, 30 or 144 fps the mouth, jaw, brows and head move in small steps', () => {
  for (const [dms, wMax] of [[16, 0.5], [33, 0.9], [7, 0.3]]) {   // a shape takes three frames or so at 60 (half of one in a frame at most), two at 30
    const { voice, d, face } = setup('harkonnen', synth([[300, 2600, 'angry'], [3100, 5200, 'sly'], [5600, 7000, 'pleased']], { every: 70 }));
    voice.play();
    const prev = new Float64Array(face.pose.length), prevW = new Float64Array(7);
    let worstW = 0, worstJaw = 0, worstBrow = 0, worstTilt = 0, n = 0;
    while (voice.clock[0] < voice.track.duration + 0.1) {
      d.step(dms);
      if (n++ > 0) {
        for (let i = 0; i < 7; i++) worstW = Math.max(worstW, Math.abs(face.w[i] - prevW[i]));
        worstJaw = Math.max(worstJaw, Math.abs(face.pose[POSE.mouthSy] - prev[POSE.mouthSy]));
        worstBrow = Math.max(worstBrow, Math.abs(face.pose[POSE.browLy] - prev[POSE.browLy]), Math.abs(face.pose[POSE.browRr] - prev[POSE.browRr]) / 7);
        worstTilt = Math.max(worstTilt, Math.abs(face.pose[POSE.tilt] - prev[POSE.tilt]));
      }
      prev.set(face.pose); prevW.set(face.w);
    }
    voice.end();
    d.run(0.3, () => { for (let i = 0; i < 7; i++) worstW = Math.max(worstW, Math.abs(face.w[i] - prevW[i])); prevW.set(face.w); });
    // the voice's own frame jumps a whole shape (1) when shapes come faster than its 60 ms blend and at the line's end
    assert.ok(worstW < wMax, `${dms} ms: a shape's weight jumped ${worstW.toFixed(3)}`);
    assert.ok(worstJaw < 0.1 * dms / 16 + 0.02, `${dms} ms: the jaw jumped ${worstJaw.toFixed(3)}`);
    assert.ok(worstBrow < 0.6 * dms / 16, `${dms} ms: a brow jumped ${worstBrow.toFixed(3)}`);
    assert.ok(worstTilt < 0.25 * dms / 16, `${dms} ms: the head jumped ${worstTilt.toFixed(3)}°`);
  }
});

test('expressions ease in over the rig\'s easing time (the head\'s longer) without overshoot, and hold between sentences', () => {
  const json = synth([[200, 1500, 'neutral'], [1900, 3400, 'angry'], [3800, 5000, 'pleased']]);
  const { voice, d, face } = setup('harkonnen', json);
  const { targets, exprIndex } = compileRig(rigFor('harkonnen'));
  const neutral = targets[exprIndex.neutral], angry = targets[exprIndex.angry];
  voice.play();
  while (voice.clock[0] < 1.85) d.step(16);
  for (let p = 0; p < PARAMS.length; p++) assert.ok(Math.abs(face.e[p] - neutral[p]) < 0.01, `neutral ${PARAMS[p]}`);
  // the step to angry: under way at half the rig's easing time, within 5 % at that time (the head's: at its own), never past
  const { ease, headEase } = compileRig(rigFor('harkonnen')).motion, E = ease * 1000, H = headEase * 1000;
  while (voice.clock[0] < 1.9) d.step(16);
  const from = Float64Array.from(face.e);
  const at = (ms) => { while (voice.clock[0] < 1.9 + ms / 1000) d.step(16); return Float64Array.from(face.e); };
  const eHalf = at(E / 2), eDone = at(E * 1.05), eHead = at(H * 1.05);
  for (let p = 0; p < PARAMS.length; p++) {
    const span = angry[p] - from[p];
    if (Math.abs(span) < 0.05) continue;
    const f50 = (eHalf[p] - from[p]) / span, fDone = (eDone[p] - from[p]) / span, fHead = (eHead[p] - from[p]) / span;
    assert.ok(f50 > 0.1 && f50 < 0.9, `${PARAMS[p]} at half the easing: ${f50.toFixed(2)}`);
    if (PARAMS[p] === 'tilt' || PARAMS[p] === 'nod') {   // the head is heavier: it settles in its own time
      assert.ok(fDone > 0.5 && fDone < 0.94 && fHead > 0.94 && fHead <= 1 + 1e-9, `${PARAMS[p]}: ${fDone.toFixed(3)} at ${E} ms, ${fHead.toFixed(3)} at ${H} ms`);
    } else assert.ok(fDone > 0.94 && fDone <= 1 + 1e-9 && fHead <= 1 + 1e-9, `${PARAMS[p]} at ${E} ms: ${fDone.toFixed(3)}`);
  }
  // between sentences (3.4 … 3.8 s) the anger holds while the mouth closes
  while (voice.clock[0] < 3.75) d.step(16);
  assert.equal(face.frame.speaking, false);
  for (let p = 0; p < PARAMS.length; p++) assert.ok(Math.abs(face.e[p] - angry[p]) < 0.01, `held ${PARAMS[p]}`);
  assert.ok(face.w[0] > 0.99 && face.pose[POSE.mouthSy] < 1.01, 'silence closes the mouth');
  // the brows show it: Radnor's anger draws both down and the inner ends in
  assert.ok(face.pose[POSE.browLy] > 1.5 && face.pose[POSE.browRy] > 1.5 && face.pose[POSE.browLr] > 5 && face.pose[POSE.browRr] < -5);
});

test('he blinks as he speaks (the lids close on his own schedule and at phrases), and the mouth shuts at the end', () => {
  const sentences = Array.from({ length: 10 }, (_, i) => [i * 3000 + 200, i * 3000 + 2600, EXPRESSIONS[i % 7]]);
  const { voice, stage, d, face } = setup('ordos', synth(sentences));
  voice.play();
  let blinks = 0, shut = false, lidsShown = 0;
  const lidL = stage.svg.querySelector('.cpmf-lid-left');
  d.run(30, () => {
    const c = face.pose[POSE.lidL];
    if (c > 0.99 && !shut) blinks++;
    shut = c > 0.99;
    if (opacity(lidL) === 1 && Number(stage.svg.querySelectorAll('linearGradient').find((g) => g.attrs.get('id') === `${face.uid}-lid-left-f`).childNodes[1].getAttribute('offset')) === 1) lidsShown++;
  });
  assert.ok(blinks >= 30 / 5.8 && blinks <= 30 / 2.6 * 1.4 + 2, `${blinks} blinks in 30 s`);
  assert.ok(lidsShown > 0, 'a blink draws the lids all the way');
  // the end of the line: the mouth closes at once, the look is held, then eased back to the painting
  voice.end();
  d.run(0.2);
  assert.ok(face.w[0] > 0.99 && face.x[0] < 0.01, 'mouth shut');
  const held = Math.abs(face.e[0]) + Math.abs(face.e[5]) + Math.abs(face.e[6]);
  assert.ok(held > 0.1, 'the last look holds a moment');
  d.run(3);
  assert.equal(face.running, false, 'and the loop sleeps');
  assert.ok(d.pending === null);
  assert.equal(stage.svg.querySelector('.cpmf-face').getAttribute('display'), 'none', 'the painting again');
  assert.equal(stage.svg.querySelector('.cpm-blink').style.visibility, '', 'the CSS blinks again');
});

test('the loop stops on the voice\'s end, starts again with the next line, and ends for good when the stage leaves', () => {
  const { voice, stage, d, face } = setup('atreides', synth([[100, 1200, 'pleased']]));
  const pristine = (() => { const s = makeStage('atreides', voice); return shape(s.svg); })();
  voice.play();
  d.run(0.8);
  voice.end();
  const frames0 = face.frames;
  d.run(4);
  assert.equal(face.running, false);
  assert.ok(face.frames - frames0 < 60 * 2.6, `settled after ${face.frames - frames0} frames`);
  const req = d.requests;
  d.run(1);
  assert.equal(d.requests, req, 'no frames while asleep');
  // the next line wakes it
  voice.play();
  assert.equal(face.running, true);
  d.run(0.5);
  assert.ok(face.frames > frames0 + 10);
  // the stage leaves the page (a new screen): the face lets go and the portrait is as portraits.js made it
  stage.el.parentNode.removeChild(stage.el);
  d.step();
  assert.equal(face.destroyed, true);
  assert.ok(d.pending === null);
  assert.equal(voice.listeners.line.size + voice.listeners.end.size, 0, 'the voice is let go');
  assert.equal(shape(stage.svg), pristine);
  face.destroy();   // twice is harmless
});

test('destroy() mid-line puts the portrait back; a line for a stage already gone ends its face without a frame', () => {
  const a = setup('ordos');
  const pristine = shape(makeStage('ordos', a.voice).svg);
  a.voice.play();
  a.d.run(1);
  a.face.destroy();
  assert.equal(shape(a.stage.svg), pristine);
  assert.ok(a.d.pending === null);
  assert.equal(a.voice.listeners.line.size, 0);
  // a stage built, shown, then replaced before its Mentat spoke: the next line (the new screen's) ends it
  const b = setup('harkonnen');
  b.d.step();
  b.stage.el.parentNode.removeChild(b.stage.el);
  b.face.wasConnected = true;
  b.voice.play();
  assert.equal(b.face.destroyed, true);
  assert.equal(b.d.requests, 0);
  // never shown at all: it gives up after a few frames
  const voice = fakeVoice(ADVICE), stage = makeStage('atreides', voice, { attach: false }), d = frames(voice);
  const face = createMentatFace({ rig: clone(rigFor('atreides')), voice, el: stage.el, art: stage.svg, raf: d.raf, caf: d.caf, reducedMotion: false });
  voice.play();
  d.run(0.2);
  assert.equal(face.destroyed, true);
});

test('Mentat voice Off: no line ever sounds, so the portrait stays the still painting with its mouth closed', () => {
  const voice = fakeVoice(ADVICE);
  voice.enabled = false;            // MentatVoice.say() gives null: no 'line' is ever emitted
  const stage = makeStage('harkonnen', voice), d = frames(voice);
  const before = shape(stage.svg);
  const face = attachMentatFace(stage, clone(rigFor('harkonnen')), { raf: d.raf, caf: d.caf });
  assert.ok(face);
  for (let i = 0; i < 60; i++) d.step();
  assert.equal(d.requests, 0);
  assert.equal(shape(stage.svg), before);
  assert.equal(face.running, false);
  // and nothing to attach to
  assert.ok(attachMentatFace({ ...stage, voice: null }, rigFor('harkonnen')) === null);
  assert.ok(attachMentatFace({ ...stage, portrait: null }, rigFor('harkonnen')) === null);
  assert.ok(attachMentatFace(stage, null) === null);
});

test('a bad rig does not break the briefing: attach warns and gives null; createMentatFace throws', () => {
  const voice = fakeVoice(ADVICE), stage = makeStage('ordos', voice);
  const bad = clone(rigFor('ordos'));
  delete bad.expressions.sad;
  const warn = console.warn, said = [];
  console.warn = (...a) => said.push(a.join(' '));
  try { assert.ok(attachMentatFace(stage, bad) === null); } finally { console.warn = warn; }
  assert.match(said[0], /expressions\.sad is missing/);
  assert.throws(() => createMentatFace({ rig: bad, voice, el: stage.el }), TypeError);
  assert.equal(voice.listeners.line.size, 0);
});

test('reduced motion: the mouth alone moves; brows, lids, corners and head keep the painting', () => {
  const { voice, stage, d, face } = setup('ordos', synth([[100, 3000, 'sly'], [3300, 6000, 'angry']]), { reducedMotion: true });
  voice.play();
  let mouthMoved = 0, still = true;
  d.run(6.2, () => {
    if (face.w[0] < 0.5) mouthMoved++;
    for (const k of ['tilt', 'nod', 'browLy', 'browRy', 'browLr', 'browRr', 'browLx', 'cornerLy', 'cornerRy', 'lidL', 'lidR', 'mouthY', 'mouthSkew']) if (face.pose[POSE[k]] !== 0) still = false;
    if (face.pose[POSE.mouthSx] !== 1) still = false;
  });
  assert.ok(mouthMoved > 60, 'the mouth speaks');
  assert.ok(still, 'nothing else moves');
  // what does not move is out of the picture (a warp at rest would only repaint the painting), as are unseen shapes
  for (const part of ['brow-left', 'brow-right', 'corner-left', 'corner-right', 'lid-left', 'lid-right']) {
    assert.equal(stage.svg.querySelector(`.cpmf-${part}`).getAttribute('display'), 'none', part);
  }
  for (const v of VISEMES.slice(1)) assert.equal(sprite(stage, v).getAttribute('display'), face.pose[POSE.alpha + VISEMES.indexOf(v)] >= 0.5 / 255 ? 'inline' : 'none', v);
  assert.equal(stage.svg.querySelector('.cpm-blink').style.visibility, '', 'the CSS (still under reduced motion) keeps its lids');
});

/**
 * A voice that replays a real track's frames from typed arrays (worked out once, 60 a second): it fills the frame
 * as MentatTrack.at() would and allocates nothing, so the heap's growth is the engine's own.
 */
function replayVoice(json, fps = 60) {
  const track = new MentatTrack(json), n = Math.ceil(track.duration * fps);
  const cols = { speaking: new Uint8Array(n), shape: new Uint8Array(n), from: new Uint8Array(n), mix: new Float64Array(n), open: new Float64Array(n), sentence: new Int32Array(n), expr: new Uint8Array(n) };
  const f = { t: 0, speaking: false, viseme: 'rest', shape: 0, from: 0, mix: 1, open: 0, expression: 'neutral', word: -1, sentence: -1 };
  for (let i = 0; i < n; i++) {
    track.at(i / fps, f);
    cols.speaking[i] = f.speaking ? 1 : 0; cols.shape[i] = f.shape; cols.from[i] = f.from; cols.mix[i] = f.mix; cols.open[i] = f.open;
    cols.sentence[i] = f.sentence; cols.expr[i] = EXPRESSIONS.indexOf(f.expression);
  }
  const at = new Int32Array(1);
  const line = { state: 'playing' };
  return {
    current: line, frames: n,
    on() { return () => {}; },
    now(out) {
      const i = at[0];
      out.speaking = cols.speaking[i] === 1; out.shape = cols.shape[i]; out.from = cols.from[i]; out.mix = cols.mix[i]; out.open = cols.open[i];
      out.sentence = cols.sentence[i]; out.expression = EXPRESSIONS[cols.expr[i]]; out.viseme = VISEMES[out.shape];
      at[0] = i + 1 < n ? i + 1 : 0;
      return out;
    },
  };
}

test('the frame loop allocates nothing: no heap growth over 10k frames, no elements made, only table strings written', () => {
  const sentences = Array.from({ length: 12 }, (_, i) => [i * 2500 + 150, i * 2500 + 2200, EXPRESSIONS[i % 7]]);
  const voice = replayVoice(synth(sentences, { every: 90 }));
  const stage = makeStage('harkonnen', voice), d = frames(null);
  const face = createMentatFace({ rig: clone(rigFor('harkonnen')), voice, el: stage.el, art: stage.svg, raf: d.raf, caf: d.caf, reducedMotion: false });
  assert.equal(face.running, true, 'a line was playing when it was made');
  const loop = (n) => { for (let i = 0; i < n; i++) d.step(i % 3 === 2 ? 18 : 16); };
  loop(20000);   // warm: the engine's code optimised
  // the young generation (where every new object, string and boxed number goes): after a collection, 10k more
  // frames leave it nearly where it was. One number boxed a frame would show at once: 10k x 16 bytes = 160 kB;
  // what is left (a few kB) is V8 recompiling the test's own loop. A collection during the loop would empty it
  // (the delta would go below zero): that too would mean the frames allocate.
  v8.setFlagsFromString('--expose-gc');
  const gc = vm.runInNewContext('gc');
  const young = () => v8.getHeapSpaceStatistics().find((sp) => sp.space_name === 'new_space').space_used_size;
  gc(); gc();
  const before = young();
  loop(10000);
  const grew = young() - before;
  assert.ok(grew >= 0 && grew < 24 * 1024, `the young heap grew ${grew} bytes over 10k frames`);
  // the counting fake: nothing made, every value written one of the strings made at the start
  const doc = stage.doc, created = doc.created, sets = doc.sets;
  const allowed = new Set([...Object.values(tables()).flatMap((q) => q.s), 'inline', 'none']);
  let foreign = 0;
  doc.watch = (v) => { if (!allowed.has(v)) foreign++; };
  loop(10000);
  doc.watch = null;
  assert.equal(doc.created, created, 'no element made in the loop');
  assert.equal(foreign, 0, 'every value written is one of the strings made at the start');
  assert.ok(doc.sets > sets + 10000, 'and the face did draw');
  assert.ok(face.running && face.frames === 40000);
});

test('each corner of the mouth moves its own half: a sneer lifts one side while the other stays or falls', () => {
  const { voice, stage, d, face } = setup('harkonnen', synth([[100, 3000, 'sly'], [3300, 6000, 'angry']], { cycle: 'aeo' }));
  voice.play();
  d.run(2.6);
  const e = face.e, rig = rigFor('harkonnen');
  assert.ok(e[5] > 0.1 && e[6] > 0.9, `Radnor's sly look: the corners ${e[5].toFixed(2)} / ${e[6].toFixed(2)}`);
  // the right half is skewed up by about the corner's lift over the half width; the left is nearly level
  const lift = rig.mouth.lift, half = rig.mouth.halfWidth;
  const wantR = -Math.atan(e[6] * lift / half) * 57.29578, wantL = Math.atan(e[5] * lift / half) * 57.29578;
  assert.ok(Math.abs(face.pose[POSE.mouthSkewR] - wantR) < 1e-6 && Math.abs(face.pose[POSE.mouthSkew] - wantL) < 1e-6);
  assert.ok(face.pose[POSE.mouthSkewR] < -5 && Math.abs(face.pose[POSE.mouthSkew]) < 2, `${face.pose[POSE.mouthSkew].toFixed(2)} / ${face.pose[POSE.mouthSkewR].toFixed(2)} degrees`);
  // the sprites are drawn once and shown by two halves, each under a mask, the two added up (so no hairline shows between them)
  const uses = stage.svg.querySelectorAll('use');
  assert.equal(uses.length, 2);
  assert.deepEqual(stage.svg.querySelectorAll('g').filter((g) => /plus-lighter/.test(g.getAttribute('style') ?? '')).length, 2);
  for (const u of uses) assert.equal(u.getAttribute('href'), `#${face.uid}-stack`);
  const stack = stage.svg.querySelector('defs').querySelectorAll('g').find((g) => g.getAttribute('id') === `${face.uid}-stack`);
  assert.equal(stack.querySelectorAll('image').length, VISEMES.length - 1, 'one image per sprite, once');
  // angry: the left corner now falls, the right stays up (the skews have opposite senses on the two halves)
  d.run(3.2);
  assert.ok(face.e[5] < -0.4 && face.pose[POSE.mouthSkew] < 0 && face.pose[POSE.mouthSkewR] < 0);
});

test('a brow is a cut-out over a bare patch of the head, drawn only while it is moved; the lids are a sprite per eye', () => {
  const { voice, stage, d, face } = setup('ordos', synth([[100, 2000, 'neutral'], [2400, 4200, 'sly']]));
  const rig = rigFor('ordos');
  voice.play();
  d.step();
  const root = stage.svg.querySelector('.cpmf-face');
  const bases = stage.svg.querySelector('.cpmf-bases'), brows = stage.svg.querySelector('.cpmf-brows');
  assert.ok(root.childNodes[0] === bases, 'the patches under everything');
  for (const side of ['left', 'right']) {
    const base = bases.querySelector(`.cpmf-brow-${side}-base`), brow = brows.querySelector(`.cpmf-brow-${side}`);
    assert.ok(base && brow);
    assert.match(base.getAttribute('href'), new RegExp(`ordos-browbase-${side}\\.webp$`));
    assert.match(brow.querySelector('image').getAttribute('href'), new RegExp(`ordos-brow-${side}\\.webp$`));
    const lid = stage.svg.querySelector(`.cpmf-lid-${side}`);
    assert.match(lid.getAttribute('href'), new RegExp(`ordos-lid-${side}\\.webp$`));
    assert.equal(lid.getAttribute('x'), String(rig.lids[side].box[0]), 'the eye\'s own sprite sits at its own box');
  }
  // Ammon's neutral lifts his right brow a little: that one is in the picture while he speaks
  d.run(0.6);
  assert.equal(bases.querySelector('.cpmf-brow-right-base').getAttribute('display'), 'inline');
  assert.equal(brows.querySelector('.cpmf-brow-right').getAttribute('display'), 'inline');
  // the line ends and the look is let go: the whole face is out of the picture, the painting alone shows
  voice.end();
  d.run(4);
  assert.equal(face.running, false);
  assert.equal(root.getAttribute('display'), 'none');
});

test('a brow that rests at the painting is out of the picture: patch and cut-out show only while it is moved', () => {
  const { voice, stage, d } = setup('harkonnen', synth([[100, 1500, 'sly']], { tail: 100 }));
  voice.play();
  d.run(0.05);
  // Radnor's sly look raises his right brow and lowers his left a little: the first frames have not moved them far yet
  const left = stage.svg.querySelector('.cpmf-brows').querySelector('.cpmf-brow-left'), right = stage.svg.querySelector('.cpmf-brows').querySelector('.cpmf-brow-right');
  d.run(1);
  for (const brow of [left, right]) assert.equal(brow.getAttribute('display'), 'inline');
  const base = stage.svg.querySelector('.cpmf-bases').querySelector('.cpmf-brow-left-base');
  assert.equal(base.getAttribute('display'), left.getAttribute('display'), 'the patch and the cut-out go together');
});
