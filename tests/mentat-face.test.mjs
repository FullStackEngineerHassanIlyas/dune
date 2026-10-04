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
import { standInRig } from '../src/ui/campaign/mentat-face-standin.js';
import { PARAMS, compileRig } from '../src/ui/campaign/mentat-face-rig.js';

// atreides/m1-advice as the voice renders it (assets/voice/mentat/atreides/m1-advice.json): a real track
const ADVICE = {"v":1,"id":"atreides/m1-advice","ms":16855,"lines":["Lay concrete before anything else. Buildings set on","bare rock start weakened.","Then raise a Wind Trap for power, and after it a","Spice Refinery. The Refinery brings its own Harvester."],"words":[[93,305,0,0,3],[412,1183,0,4,12],[1263,1635,0,13,19],[1768,2220,0,20,28],[2353,2921,0,29,33],[3605,4216,0,35,44],[4323,4509,0,45,48],[4589,4695,0,49,51],[4775,5094,1,0,4],[5174,5706,1,5,9],[5839,6184,1,10,15],[6264,7019,1,16,24],[7695,7908,2,0,4],[7961,8280,2,5,10],[8333,8386,2,11,12],[8493,8785,2,13,17],[8865,9184,2,18,22],[9238,9291,2,23,26],[9397,10142,2,27,32],[10328,10408,2,34,37],[10514,10807,2,38,43],[10860,11046,2,44,46],[11126,11179,2,47,48],[11285,11844,3,0,5],[11924,12800,3,6,14],[13443,13522,3,16,19],[13575,14533,3,20,28],[14639,14985,3,29,35],[15038,15198,3,36,39],[15331,15597,3,40,43],[15677,16710,3,44,53]],"sentences":[[93,2921,0,4,"neutral"],[3605,7019,5,11,"neutral"],[7695,12800,12,24,"neutral"],[13443,16710,25,30,"neutral"]],"visemes":{"t":[0,93,146,305,412,491,598,837,917,1263,1316,1422,1475,1715,2007,2061,2433,2566,2921,3605,3658,3764,3844,4216,4323,4535,4642,4775,4828,5014,5174,5493,5706,5839,5945,6131,6264,6317,6583,6690,7019,7695,7748,7961,8014,8333,8386,8493,8546,8918,8972,9131,9238,9264,9397,9477,9663,9769,10142,10328,10355,10461,10567,10647,10700,10753,10860,11126,11179,11285,11392,11445,11631,11924,11977,12083,12136,12296,12402,12456,12562,12800,13443,13469,13575,13629,13762,13841,14001,14107,14161,14267,14533,14639,14693,14719,15278,15411,15517,15730,15943,16022,16368,16710],"s":"rlereoeoemefoelelermelereoemeaoereaeoeaerleoearoeoamfomaoaraeafeaoearemaeoefaeaoerlaoefaeaoermoeaoeafear"},"env":{"hz":30,"q":"00x____z__wjEmvuy_z-_-uiounzzzxwrWllSNE0q_ylfez_--pQ7vzz_--zwhasyyyzzzzzzxvutoswvvttnRD62000000000000000000h-zr_____zx_-yzz--zzwwwxvq-xwnt-zz--uld_yyyyyyyxxx-z-yxvjM52idUIC400lwxhn_yyzwdNcxx-_zxpRiiwyuuttsqjbNA81000000000000000000Wy-__zz___-_-yyz-_yxyzyxxwx__z----vhTuuozyxwnVCSddyqVestyxyyyxvvuttnPE00000000000x__-zxxuedZv-zyyxvblf400uzyxyxsXCT-wxyxyxvuwvsdHu-xngbc-yyz--zzwuutrsqlWH62000000000000000008v-_z___wkifdm_zz------yxyxxxvmL9452007__zz--_zwx_vdlykME-z---yyzyzsnoq_yyzzwqwyvvwwvQhvvutsmZTPCE70000"}};

/**
 * A made-up track: sentences [startMs, endMs, expression] with the mouth cycling `cycle` (track letters) every
 * `every` ms inside each and the voice loud (`loud` 0..63) there, quiet between.
 */
function synth(sentences, { cycle = 'maeofl', every = 110, loud = 50, tail = 600 } = {}) {
  const ms = sentences.at(-1)[1] + tail;
  const vt = [0], vs = ['r'], words = [], sents = [];
  sentences.forEach(([a, b, expression], i) => {
    for (let t = a, k = 0; t < b; t += every, k++) { vt.push(t); vs.push(cycle[k % cycle.length]); }
    vt.push(b); vs.push('r');
    words.push([a, b, i, 0, 4]);
    sents.push([a, b, i, i, expression]);
  });
  const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
  let q = '';
  for (let f = 0; f < Math.ceil((ms / 1000) * 30); f++) {
    const t = (f / 30) * 1000, on = sentences.some(([a, b]) => t >= a && t <= b);
    q += B64[on ? (f % 3 === 0 ? Math.round(loud * 0.6) : loud) : 0];
  }
  return { v: 1, id: 'test/synth', ms, lines: sentences.map((_, i) => `Line ${i}.`), words, sentences: sents, visemes: { t: vt, s: vs.join('') }, env: { hz: 30, q } };
}

// ---- a counting fake DOM, enough for the portrait's SVG ----
class FakeEl {
  constructor(doc, tag) {
    this.ownerDocument = doc; this.localName = tag; this.tagName = tag; this.nodeType = 1;
    this.attrs = new Map(); this.childNodes = []; this.parentNode = null; this.style = { visibility: '' };
  }
  setAttribute(k, v) { const d = this.ownerDocument; d.sets++; this.attrs.set(k, v); if (d.watch !== null) d.watch(v); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  appendChild(n) { n.parentNode?.removeChild(n); n.parentNode = this; this.childNodes.push(n); return n; }
  insertBefore(n, ref) {
    if (!ref) return this.appendChild(n);
    n.parentNode?.removeChild(n);
    this.childNodes.splice(this.childNodes.indexOf(ref), 0, n);
    n.parentNode = this;
    return n;
  }
  removeChild(n) { const i = this.childNodes.indexOf(n); if (i >= 0) this.childNodes.splice(i, 1); n.parentNode = null; return n; }
  get firstChild() { return this.childNodes[0] ?? null; }
  get nextSibling() { const p = this.parentNode; return p ? p.childNodes[p.childNodes.indexOf(this) + 1] ?? null : null; }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === this.ownerDocument.body; }
  matches(sel) { return sel.startsWith('.') ? (this.attrs.get('class') ?? '').split(/\s+/).includes(sel.slice(1)) : this.localName === sel; }
  querySelector(sel) {
    for (const c of this.childNodes) { if (c.matches(sel)) return c; const f = c.querySelector(sel); if (f) return f; }
    return null;
  }
  querySelectorAll(sel) { const out = []; const walk = (n) => { for (const c of n.childNodes) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
}
function fakeDocument() {
  const doc = { created: 0, sets: 0, watch: null };
  doc.createElementNS = (ns, tag) => { doc.created++; return new FakeEl(doc, tag); };
  doc.body = new FakeEl(doc, 'body');
  return doc;
}
/** The portrait's markup (mentatSvg) as fake elements: tags and attributes, the <style>'s text left out. */
function parseSvg(doc, markup) {
  const root = new FakeEl(doc, '#root');
  const stack = [root];
  for (const m of markup.replace(/<style>[\s\S]*?<\/style>/, '<style/>').matchAll(/<(\/?)([\w-]+)([^>]*?)(\/?)>/g)) {
    const [, close, tag, attrs, self] = m;
    if (close) { stack.pop(); continue; }
    const el = new FakeEl(doc, tag);
    for (const [, k, v] of attrs.matchAll(/([\w:-]+)="([^"]*)"/g)) el.attrs.set(k, v);
    stack.at(-1).appendChild(el);
    if (!self) stack.push(el);
  }
  return root.childNodes[0];
}
const shape = (n) => `${n.localName}${[...n.attrs].map(([k, v]) => ` ${k}=${v}`).join('')}[${n.childNodes.map(shape).join(',')}]`;

/** A stage as mentatStage makes it: the section in the page, the figure with the portrait's SVG, the voice. */
function makeStage(house, voice, { attach = true } = {}) {
  const doc = fakeDocument();
  const el = new FakeEl(doc, 'section'), portrait = new FakeEl(doc, 'figure');
  const svg = parseSvg(doc, mentatSvg(house));
  portrait.appendChild(svg);
  el.appendChild(portrait);
  if (attach) doc.body.appendChild(el);
  return { doc, el, portrait, svg, voice };
}

/** A voice like MentatVoice for the face: on(), current, now(out); play() / end() as the real one emits them. */
function fakeVoice(json) {
  const track = new MentatTrack(json);
  const clock = new Float64Array(1);
  const listeners = { line: new Set(), end: new Set() };
  const line = { state: 'loading', track, duration: track.duration, at(t, out) { return track.at(t, out); }, now(out) { return track.at(clock[0], out); } };
  return {
    enabled: true, current: null, clock, listeners, line, track,
    on(type, fn) { listeners[type].add(fn); return () => listeners[type].delete(fn); },
    now(out) {
      const l = this.current;
      if (l !== null && l.state === 'playing') return l.now(out);
      out.t = 0; out.speaking = false; out.from = out.shape; out.shape = 0; out.viseme = 'rest'; out.mix = 1; out.open = 0; out.word = -1; out.sentence = -1;
      return out;
    },
    play() { line.state = 'playing'; this.current = line; clock[0] = 0; for (const fn of [...listeners.line]) fn(line); },
    end(reason = 'ended') { line.state = reason; this.current = null; for (const fn of [...listeners.end]) fn(line, reason); },
  };
}

/** The frame scheduler, cranked by hand: step(ms) runs the pending frame `ms` later (and moves the voice's clock). */
function frames(voice) {
  const d = { pending: null, id: 0, ms: 0, requests: 0 };
  d.raf = (fn) => { d.pending = fn; d.requests++; return ++d.id; };
  d.caf = (id) => { if (id === d.id) d.pending = null; };
  d.step = (dms = 16) => {
    d.ms += dms;
    if (voice && voice.current !== null) voice.clock[0] += dms / 1000;
    const fn = d.pending;
    d.pending = null;
    if (fn !== null) fn(d.ms);
    return fn !== null;
  };
  d.run = (seconds, each = null) => { for (let i = 0, n = Math.round(seconds * 60); i < n; i++) { d.step(i % 3 === 2 ? 18 : 16); each?.(); } };
  return d;
}

function setup(house = 'atreides', json = ADVICE, opts = {}) {
  const voice = fakeVoice(json);
  const stage = makeStage(house, voice);
  const d = frames(voice);
  const face = attachMentatFace(stage, opts.rig ?? standInRig(house), { raf: d.raf, caf: d.caf, reducedMotion: false, ...opts });
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
  assert.equal(sway.childNodes.length, 1, 'the head group holds what the sway held');
  assert.equal(head.parentNode, sway);
  const inner = head.querySelector('.cpmf-face').parentNode;
  assert.deepEqual(inner.childNodes.map((n) => n.attrs.get('class') ?? n.localName), ['image', 'cpmf-face', 'cpm-blink'], 'the face sits over the head painting, under the blink');
  assert.match(inner.childNodes[0].attrs.get('href'), /atreides-head\.webp$/);
  assert.equal(head.querySelector('.cpmf-face').getAttribute('display'), 'inline');
  assert.equal(stage.svg.querySelector('.cpm-blink').style.visibility, 'hidden', 'the face blinks for the CSS while it runs');
  assert.equal(sprite(stage, 'rest'), null, 'at rest the painting\'s own mouth shows');
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
  assert.ok(open > 1.15, `the jaw opens on A: ${open}`);
  assert.ok(closedMax < 1.06, `and stays shut on M/B/P: ${closedMax}`);
});

test('nothing pops: from frame to frame at 60, 30 or 144 fps the mouth, jaw, brows and head move in small steps', () => {
  for (const [dms, wMax] of [[16, 0.42], [33, 0.66], [7, 0.25]]) {
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

test('expressions ease in over about 200 ms (the head 350 ms) without overshoot, and hold between sentences', () => {
  const json = synth([[200, 1500, 'neutral'], [1900, 3400, 'angry'], [3800, 5000, 'pleased']]);
  const { voice, d, face } = setup('harkonnen', json);
  const { targets, exprIndex } = compileRig(standInRig('harkonnen'));
  const neutral = targets[exprIndex.neutral], angry = targets[exprIndex.angry];
  voice.play();
  while (voice.clock[0] < 1.85) d.step(16);
  for (let p = 0; p < PARAMS.length; p++) assert.ok(Math.abs(face.e[p] - neutral[p]) < 0.01, `neutral ${PARAMS[p]}`);
  // the step to angry: under way at 100 ms, within 5 % at 200 ms, never past the target
  while (voice.clock[0] < 1.9) d.step(16);
  const from = Float64Array.from(face.e);
  const at = (ms) => { while (voice.clock[0] < 1.9 + ms / 1000) d.step(16); return Float64Array.from(face.e); };
  const e100 = at(100), e200 = at(210);
  const e350 = at(360);
  for (let p = 0; p < PARAMS.length; p++) {
    const span = angry[p] - from[p];
    if (Math.abs(span) < 0.05) continue;
    const f100 = (e100[p] - from[p]) / span, f200 = (e200[p] - from[p]) / span, f350 = (e350[p] - from[p]) / span;
    assert.ok(f100 > 0.1 && f100 < 0.9, `${PARAMS[p]} at 100 ms: ${f100.toFixed(2)}`);
    if (PARAMS[p] === 'tilt' || PARAMS[p] === 'nod') {   // the head is heavier: it settles in 350 ms
      assert.ok(f200 > 0.5 && f200 < 0.94 && f350 > 0.94 && f350 <= 1 + 1e-9, `${PARAMS[p]}: ${f200.toFixed(3)} at 200 ms, ${f350.toFixed(3)} at 350 ms`);
    } else assert.ok(f200 > 0.94 && f200 <= 1 + 1e-9 && f350 <= 1 + 1e-9, `${PARAMS[p]} at 200 ms: ${f200.toFixed(3)}`);
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
  assert.equal(d.pending, null);
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
  assert.equal(d.pending, null);
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
  assert.equal(a.d.pending, null);
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
  const face = createMentatFace({ rig: standInRig('atreides'), voice, el: stage.el, svg: stage.svg, raf: d.raf, caf: d.caf, reducedMotion: false });
  voice.play();
  d.run(0.2);
  assert.equal(face.destroyed, true);
});

test('Mentat voice Off: no line ever sounds, so the portrait stays the still painting with its mouth closed', () => {
  const voice = fakeVoice(ADVICE);
  voice.enabled = false;            // MentatVoice.say() gives null: no 'line' is ever emitted
  const stage = makeStage('harkonnen', voice), d = frames(voice);
  const before = shape(stage.svg);
  const face = attachMentatFace(stage, standInRig('harkonnen'), { raf: d.raf, caf: d.caf });
  assert.ok(face);
  for (let i = 0; i < 60; i++) d.step();
  assert.equal(d.requests, 0);
  assert.equal(shape(stage.svg), before);
  assert.equal(face.running, false);
  // and nothing to attach to
  assert.equal(attachMentatFace({ ...stage, voice: null }, standInRig('harkonnen')), null);
  assert.equal(attachMentatFace({ ...stage, portrait: null }, standInRig('harkonnen')), null);
  assert.equal(attachMentatFace(stage, null), null);
});

test('a bad rig does not break the briefing: attach warns and gives null; createMentatFace throws', () => {
  const voice = fakeVoice(ADVICE), stage = makeStage('ordos', voice);
  const bad = standInRig('ordos');
  delete bad.expressions.sad;
  const warn = console.warn, said = [];
  console.warn = (...a) => said.push(a.join(' '));
  try { assert.equal(attachMentatFace(stage, bad), null); } finally { console.warn = warn; }
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
  const face = createMentatFace({ rig: standInRig('harkonnen'), voice, el: stage.el, svg: stage.svg, raf: d.raf, caf: d.caf, reducedMotion: false });
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
  const allowed = new Set(Object.values(tables()).flatMap((q) => q.s));
  let foreign = 0;
  doc.watch = (v) => { if (!allowed.has(v)) foreign++; };
  loop(10000);
  doc.watch = null;
  assert.equal(doc.created, created, 'no element made in the loop');
  assert.equal(foreign, 0, 'every value written is one of the strings made at the start');
  assert.ok(doc.sets > sets + 10000, 'and the face did draw');
  assert.ok(face.running && face.frames === 40000);
});
